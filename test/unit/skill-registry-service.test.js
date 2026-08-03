import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const {
  SkillRegistryService,
  parseFrontmatter,
  normalizeSkillId,
  isSafeSkillId,
} = require('../../src/main/skill-registry-service');

const APP_SKILLS_ROOT = path.join(process.cwd(), '.agent', 'skills');

const tempRoots = [];

function makeUserSkillsRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexomics-skills-'));
  tempRoots.push(root);
  return root;
}

function writeAnthropicSkill(root, dirName, frontmatter, body = '# Body\n\nSteps here.') {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\n${frontmatter}\n---\n\n${body}\n`);
  return dir;
}

afterEach(() => {
  while (tempRoots.length) {
    const root = tempRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('parseFrontmatter', () => {
  it('splits YAML frontmatter from the markdown body', () => {
    const { data, body } = parseFrontmatter('---\nname: demo\ndescription: A demo\n---\n\nBody text\n');
    expect(data).toEqual({ name: 'demo', description: 'A demo' });
    expect(body.trim()).toBe('Body text');
  });

  it('tolerates a UTF-8 BOM and CRLF line endings', () => {
    const { data } = parseFrontmatter('﻿---\r\nname: demo\r\ndescription: d\r\n---\r\nBody\r\n');
    expect(data).toEqual({ name: 'demo', description: 'd' });
  });

  it('returns no data when the document has no frontmatter', () => {
    const { data, body } = parseFrontmatter('# Just markdown\n');
    expect(data).toBeNull();
    expect(body).toContain('Just markdown');
  });

  it('throws on malformed frontmatter so the caller can record a diagnostic', () => {
    expect(() => parseFrontmatter('---\nsteps:\n  - a\n  bad_key: x\n---\nbody')).toThrow();
  });
});

describe('skill id normalization', () => {
  it('accepts snake_case and kebab-case ids', () => {
    expect(normalizeSkillId('primer_design')).toBe('primer_design');
    expect(normalizeSkillId('codon-optimizer')).toBe('codon-optimizer');
  });

  it('normalizes spaced and mixed-case names', () => {
    expect(normalizeSkillId('My Skill')).toBe('my-skill');
  });

  it('strips path separators rather than producing a traversable id', () => {
    // Normalization sanitizes; the result is always a plain id that cannot walk
    // out of a skills root. Traversal itself is rejected by isSafeSkillId and the
    // isPathInside check in getSkill/getSkillResource.
    const normalized = normalizeSkillId('../../etc/passwd');
    expect(normalized).toBe('etcpasswd');
    expect(isSafeSkillId(normalized)).toBe(true);
  });

  it('returns null for input with no usable characters', () => {
    expect(normalizeSkillId('')).toBe(null);
    expect(normalizeSkillId('../..')).toBe(null);
    expect(normalizeSkillId(null)).toBe(null);
  });

  it('rejects raw traversal strings as skill ids', () => {
    expect(isSafeSkillId('../evil')).toBe(false);
    expect(isSafeSkillId('/etc/passwd')).toBe(false);
    expect(isSafeSkillId('a'.repeat(65))).toBe(false);
  });
});

describe('SkillRegistryService - shipped skills', () => {
  it('loads every built-in skill with no diagnostics', async () => {
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const snapshot = await service.getSnapshot();

    expect(snapshot.success).toBe(true);
    expect(snapshot.diagnostics).toEqual([]);
    expect(snapshot.counts.skills).toBeGreaterThanOrEqual(1);

    const ids = snapshot.skills.map(skill => skill.id).sort();
    expect(ids).toContain('primer_design');
  });

  it('merges SKILL_REGISTRY.yaml metadata into the native skill entries', async () => {
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const snapshot = await service.getSnapshot();
    const primer = snapshot.skillsById.primer_design;

    expect(primer.category).toBe('primer_design');
    expect(primer.requiresGenome).toBe(true);
    // The workflow runs against the loaded genome; BLAST is opt-in, not required.
    expect(primer.requiresNetwork).toBe(false);
    expect(primer.typicalDurationSeconds).toBe(20);
    expect(primer.toolsUsed).toContain('design_primers');
    expect(primer.triggers.length).toBeGreaterThan(0);
  });

  it('references only tools that exist in the tool registry', async () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'tools_registry/generated/tool-registry-manifest.json'), 'utf-8')
    );
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const snapshot = await service.getSnapshot();

    // A skill that names a tool the app does not have sends the assistant down a
    // dead end, and the failure only surfaces mid-workflow at runtime.
    for (const skill of snapshot.skills) {
      for (const tool of skill.toolsUsed) {
        expect(manifest.toolsByName[tool], `${skill.id} references unknown tool '${tool}'`).toBeDefined();
      }
    }
  });

  it('excludes skill bodies from the snapshot and serves them on demand', async () => {
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const snapshot = await service.getSnapshot();

    for (const skill of snapshot.skills) {
      expect(skill.body).toBeUndefined();
      expect(skill.bodyLength).toBeGreaterThan(0);
    }

    const loaded = await service.getSkill('primer_design');
    expect(loaded.success).toBe(true);
    expect(loaded.body.length).toBeGreaterThan(0);
    expect(loaded.body).not.toContain('name: primer_design');
  });

  it('returns the frontmatter step plan alongside the Markdown body', async () => {
    // The executable half of a native skill lives in its frontmatter. Returning only the
    // body would hand the assistant prose with no steps, parameters, or agent_notes.
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const loaded = await service.getSkill('primer_design');

    expect(loaded.workflow).toBeTruthy();
    expect(Array.isArray(loaded.workflow.steps)).toBe(true);
    expect(loaded.workflow.steps.length).toBeGreaterThan(0);
    expect(loaded.workflow.steps.map(step => step.tool)).toContain('design_primers');
    expect(loaded.workflow.agent_notes).toBeTruthy();
    expect(loaded.workflow.outputs?.summary_template).toBeTruthy();
    expect(loaded.workflow.preconditions).toBeTruthy();

    // Discovery metadata already travels in the snapshot; don't duplicate it here.
    expect(loaded.workflow.name).toBeUndefined();
    expect(loaded.workflow.triggers).toBeUndefined();
  });

  it('skips README and template files', async () => {
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });
    const snapshot = await service.getSnapshot();
    const ids = snapshot.skills.map(skill => skill.id);

    expect(ids).not.toContain('readme');
    expect(ids).not.toContain('skill_template');
  });
});

describe('SkillRegistryService - Anthropic-format skills', () => {
  it('loads a SKILL.md bundle with its resources', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    const dir = writeAnthropicSkill(
      userSkillsRoot,
      'codon-optimizer',
      ['name: codon-optimizer', 'description: Optimize a CDS for a target host.', 'license: MIT'].join('\n')
    );
    fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'references', 'ecoli.tsv'), 'codon\tfreq\n');

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });
    const snapshot = await service.getSnapshot();
    const skill = snapshot.skillsById['codon-optimizer'];

    expect(skill).toBeDefined();
    expect(skill.format).toBe('anthropic');
    expect(skill.isBuiltIn).toBe(false);
    expect(skill.license).toBe('MIT');
    expect(skill.resources).toEqual(['references/ecoli.tsv']);
  });

  it('maps allowed-tools onto toolsUsed', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    writeAnthropicSkill(
      userSkillsRoot,
      'demo',
      ['name: demo', 'description: Demo skill.', 'allowed-tools: [get_sequence, compute_gc]'].join('\n')
    );

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });
    const snapshot = await service.getSnapshot();

    expect(snapshot.skillsById.demo.toolsUsed).toEqual(['get_sequence', 'compute_gc']);
  });

  it('ignores directories without a SKILL.md and warns on files without frontmatter', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    fs.mkdirSync(path.join(userSkillsRoot, 'not-a-skill'), { recursive: true });
    fs.writeFileSync(path.join(userSkillsRoot, 'not-a-skill', 'notes.md'), 'just notes');
    fs.writeFileSync(path.join(userSkillsRoot, 'loose.md'), 'no frontmatter');

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });
    const snapshot = await service.getSnapshot();

    expect(snapshot.skillsById['not-a-skill']).toBeUndefined();
    expect(snapshot.skillsById.loose).toBeUndefined();
    expect(snapshot.diagnostics.some(d => d.file === 'loose.md')).toBe(true);
  });

  it('reads a skill resource and refuses undeclared paths', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    const dir = writeAnthropicSkill(userSkillsRoot, 'demo', ['name: demo', 'description: Demo skill.'].join('\n'));
    fs.writeFileSync(path.join(dir, 'table.tsv'), 'a\tb\n');

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });

    const ok = await service.getSkillResource('demo', 'table.tsv');
    expect(ok.success).toBe(true);
    expect(ok.content).toBe('a\tb\n');

    const escape = await service.getSkillResource('demo', '../../../etc/passwd');
    expect(escape.success).toBe(false);
    expect(escape.content).toBeNull();
  });
});

describe('SkillRegistryService - safety boundaries', () => {
  it('rejects unsafe skill ids without touching the filesystem', async () => {
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot: null });

    for (const badId of ['../../etc/passwd', '/etc/passwd', 'a'.repeat(65), '']) {
      const result = await service.getSkill(badId);
      expect(result.success).toBe(false);
      expect(result.body).toBeNull();
    }
  });

  it('refuses to let a user skill shadow a built-in skill', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    writeAnthropicSkill(
      userSkillsRoot,
      'primer_design',
      ['name: primer_design', 'description: Override attempt.'].join('\n')
    );

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });
    const snapshot = await service.getSnapshot();

    expect(snapshot.skillsById.primer_design.isBuiltIn).toBe(true);
    expect(snapshot.success).toBe(false);
    expect(snapshot.diagnostics.some(d => d.severity === 'error' && d.skill === 'primer_design')).toBe(true);
  });

  it('skips oversized skill documents', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    const dir = path.join(userSkillsRoot, 'huge');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      `---\nname: huge\ndescription: too big\n---\n${'x'.repeat(600 * 1024)}`
    );

    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });
    const snapshot = await service.getSnapshot();

    expect(snapshot.skillsById.huge).toBeUndefined();
    expect(snapshot.diagnostics.some(d => /oversized/i.test(d.message))).toBe(true);
  });

  it('returns an empty inventory instead of throwing when a root is missing', async () => {
    const service = new SkillRegistryService({
      appSkillsRoot: path.join(os.tmpdir(), 'codexomics-missing-skills-root'),
      userSkillsRoot: null,
    });
    const snapshot = await service.getSnapshot();

    expect(snapshot.success).toBe(true);
    expect(snapshot.skills).toEqual([]);
  });

  it('caches snapshots and refreshes them on reload', async () => {
    const userSkillsRoot = makeUserSkillsRoot();
    const service = new SkillRegistryService({ appSkillsRoot: APP_SKILLS_ROOT, userSkillsRoot });

    const before = await service.getSnapshot();
    writeAnthropicSkill(userSkillsRoot, 'late-arrival', ['name: late-arrival', 'description: Added later.'].join('\n'));

    const cached = await service.getSnapshot();
    expect(cached.skillsById['late-arrival']).toBeUndefined();
    expect(cached.registryHash).toBe(before.registryHash);

    const reloaded = await service.reload();
    expect(reloaded.skillsById['late-arrival']).toBeDefined();
    expect(reloaded.registryHash).not.toBe(before.registryHash);
  });
});
