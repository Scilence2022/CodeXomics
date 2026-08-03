/**
 * SkillService - renderer-side skill discovery, gating, and progressive disclosure.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/SkillService.js');

const SKILLS = [
  {
    id: 'primer_design',
    name: 'primer_design',
    description: 'Design a validated PCR primer pair.',
    category: 'primer_design',
    tags: ['primers', 'pcr'],
    triggers: ['design primers', 'PCR primers'],
    toolsUsed: ['design_primers', 'blast_search'],
    typicalDurationSeconds: 30,
    requiresGenome: true,
    requiresNetwork: true,
    isBuiltIn: true,
    format: 'native',
    resources: [],
    version: '1.0.0',
  },
  {
    id: 'codon-optimizer',
    name: 'codon-optimizer',
    description: 'Optimize a CDS for a target host.',
    category: 'sequence_analysis',
    tags: ['codon'],
    triggers: ['optimize codons'],
    toolsUsed: ['codon_usage_analysis'],
    typicalDurationSeconds: null,
    requiresGenome: false,
    requiresNetwork: false,
    isBuiltIn: false,
    format: 'anthropic',
    resources: ['references/ecoli.tsv'],
    version: '',
  },
];

function loadSkillService() {
  const source = fs.readFileSync(SERVICE_PATH, 'utf-8');
  const sandbox = { window: {}, console, CustomEvent: class {}, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'SkillService.js' });
  return { SkillService: sandbox.window.SkillService, sandbox };
}

function makeHarness({ disabledIds = [], skills = SKILLS, bodies = {}, workflows = {} } = {}) {
  const { SkillService, sandbox } = loadSkillService();

  const config = { 'skills.disabledIds': [...disabledIds] };
  const chatManager = {
    configManager: {
      get: (key, fallback) => (key in config ? config[key] : fallback),
      set: async (key, value) => {
        config[key] = value;
      },
    },
  };

  sandbox.window.electronAPI = {
    getSkillRegistrySnapshot: async () => ({
      success: true,
      skills,
      skillsById: Object.fromEntries(skills.map(s => [s.id, s])),
      counts: { skills: skills.length },
      diagnostics: [],
    }),
    reloadSkillRegistry: async () => ({
      success: true,
      skills,
      skillsById: Object.fromEntries(skills.map(s => [s.id, s])),
      counts: { skills: skills.length },
      diagnostics: [],
    }),
    getSkill: async id =>
      bodies[id] !== undefined
        ? { success: true, body: bodies[id], workflow: workflows[id] ?? null }
        : { success: false, error: `Skill not found: ${id}` },
    onSkillRegistryUpdated: () => {},
  };

  return { service: new SkillService(null, chatManager), config, sandbox };
}

describe('SkillService', () => {
  let harness;

  beforeEach(async () => {
    harness = makeHarness({
      bodies: { primer_design: '# Primer Design\n\nStep 1...' },
      workflows: {
        primer_design: {
          steps: [{ id: 'design_pair', tool: 'design_primers' }],
          agent_notes: 'Call design_primers ONCE with geneName.',
          outputs: { summary_template: '## Primer pair' },
        },
      },
    });
    await harness.service.ensureSnapshot();
  });

  it('exposes every inventoried skill with an enabled flag', () => {
    const all = harness.service.getAllSkills();
    expect(all).toHaveLength(2);
    expect(all.every(skill => skill.enabled)).toBe(true);
  });

  it('renders a compact prompt index that omits skill bodies', () => {
    const index = harness.service.getSkillIndexForPrompt();

    expect(index).toContain('===AGENT SKILLS===');
    expect(index).toContain('primer_design');
    expect(index).toContain('codon-optimizer');
    expect(index).toContain('triggers: design primers');
    expect(index).toContain('requires: genome+network');
    expect(index).toContain('get_skill');
    expect(index).not.toContain('Step 1...');
  });

  it('returns an empty prompt index when no skills are enabled', async () => {
    for (const skill of SKILLS) {
      await harness.service.setSkillEnabled(skill.id, false);
    }
    expect(harness.service.getSkillIndexForPrompt()).toBe('');
  });

  it('persists disable state and drops the skill from the prompt index', async () => {
    const result = await harness.service.setSkillEnabled('primer_design', false);

    expect(result.success).toBe(true);
    expect(harness.config['skills.disabledIds']).toEqual(['primer_design']);
    expect(harness.service.getEnabledSkills().map(s => s.id)).toEqual(['codon-optimizer']);

    const index = harness.service.getSkillIndexForPrompt();
    expect(index).not.toContain('- primer_design:');
    // The worked example must name a skill that is actually loadable.
    expect(index).toContain('"skill_id": "codon-optimizer"');
  });

  it('re-enables a skill by removing it from the disabled list', async () => {
    await harness.service.setSkillEnabled('primer_design', false);
    await harness.service.setSkillEnabled('primer_design', true);

    expect(harness.config['skills.disabledIds']).toEqual([]);
    expect(harness.service.isEnabled('primer_design')).toBe(true);
  });

  describe('list_skills', () => {
    it('lists enabled skills with discovery metadata', async () => {
      const result = await harness.service.listSkills({});

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.skills[0]).toMatchObject({
        skill_id: 'primer_design',
        source: 'built-in',
        requires_genome: true,
      });
      expect(result.skills[0].workflow).toBeUndefined();
    });

    it('filters by category and free-text query', async () => {
      const byCategory = await harness.service.listSkills({ category: 'primer_design' });
      expect(byCategory.skills.map(s => s.skill_id)).toEqual(['primer_design']);

      const byQuery = await harness.service.listSkills({ query: 'codon' });
      expect(byQuery.skills.map(s => s.skill_id)).toEqual(['codon-optimizer']);
    });

    it('hides disabled skills unless include_disabled is set', async () => {
      await harness.service.setSkillEnabled('codon-optimizer', false);

      expect((await harness.service.listSkills({})).count).toBe(1);
      expect((await harness.service.listSkills({ include_disabled: true })).count).toBe(2);
    });
  });

  describe('get_skill', () => {
    it('loads the workflow on demand', async () => {
      const result = await harness.service.getSkill({ skill_id: 'primer_design' });

      expect(result.success).toBe(true);
      expect(result.guide).toContain('Step 1...');
      expect(result.tools_used).toContain('design_primers');
      expect(result.instructions).toBeTruthy();
    });

    it('returns the structured step plan, not just the prose body', async () => {
      // Native-format skills keep their step plan in the frontmatter. Returning only the
      // Markdown body would strip steps, agent_notes, and the output template — the parts
      // the assistant actually executes.
      const result = await harness.service.getSkill({ skill_id: 'primer_design' });

      expect(result.workflow).toBeTruthy();
      expect(result.workflow.steps[0].tool).toBe('design_primers');
      expect(result.workflow.agent_notes).toContain('geneName');
      expect(result.workflow.outputs.summary_template).toBeTruthy();
    });

    it('requires skill_id', async () => {
      const result = await harness.service.getSkill({});
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/skill_id/);
    });

    it('reports available skills when the id is unknown', async () => {
      const result = await harness.service.getSkill({ skill_id: 'nope' });

      expect(result.success).toBe(false);
      expect(result.available_skills).toContain('primer_design');
    });

    it('refuses to load a disabled skill', async () => {
      await harness.service.setSkillEnabled('primer_design', false);
      const result = await harness.service.getSkill({ skill_id: 'primer_design' });

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/disabled/i);
    });

    it('caches the body so repeat loads do not re-hit IPC', async () => {
      let calls = 0;
      const original = harness.sandbox.window.electronAPI.getSkill;
      harness.sandbox.window.electronAPI.getSkill = async id => {
        calls++;
        return original(id);
      };

      await harness.service.getSkill({ skill_id: 'primer_design' });
      await harness.service.getSkill({ skill_id: 'primer_design' });

      expect(calls).toBe(1);
    });
  });

  describe('benchmark isolation', () => {
    // Skills must never alter benchmark prompts: the oracle expects a fixed tool
    // sequence, and a skill index would invite unexpected list_skills/get_skill calls.
    function loadContextService() {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src/renderer/modules/chat/services/LLMContextService.js'),
        'utf-8'
      );
      const sandbox = { window: {}, console, module: { exports: {} } };
      vm.createContext(sandbox);
      vm.runInContext(`${source}\n;globalThis.__LLMContextService = LLMContextService;`, sandbox, {
        filename: 'LLMContextService.js',
      });
      return sandbox.__LLMContextService;
    }

    function makeContext(isBenchmarkMode) {
      const LLMContextService = loadContextService();
      const chatManager = {
        isBenchmarkMode: () => isBenchmarkMode,
        services: { skill: harness.service },
      };
      return new LLMContextService(null, chatManager);
    }

    it('includes the skill index outside benchmark mode', () => {
      expect(makeContext(false).getSkillsContextString()).toContain('===AGENT SKILLS===');
    });

    it('omits the skill index while a benchmark is running', () => {
      expect(makeContext(true).getSkillsContextString()).toBe('');
    });

    it('omits the skill index when the benchmark-mode check throws', () => {
      const LLMContextService = loadContextService();
      const ctx = new LLMContextService(null, {
        isBenchmarkMode: () => {
          throw new Error('benchmark UI unavailable');
        },
        services: { skill: harness.service },
      });
      expect(ctx.getSkillsContextString()).toBe('');
    });
  });

  it('degrades to an empty inventory when the IPC bridge is missing', async () => {
    const { SkillService } = loadSkillService();
    const service = new SkillService(null, { configManager: { get: (k, d) => d } });

    const snapshot = await service.ensureSnapshot();
    expect(snapshot.skills).toEqual([]);
    expect(service.getSkillIndexForPrompt()).toBe('');

    const result = await service.getSkill({ skill_id: 'primer_design' });
    expect(result.success).toBe(false);
  });
});
