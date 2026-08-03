// @ts-check
/**
 * Main-process Skill Registry service.
 *
 * A Skill is a reusable, multi-step workflow document that teaches the assistant how
 * to accomplish a domain task with the CodeXomics tool suite. The renderer consumes
 * sanitized JSON snapshots from this service instead of reading skill directories
 * directly, which keeps local file access in the main process while preserving the
 * hardened renderer boundary (same contract as ToolRegistryService).
 *
 * Two on-disk layouts are supported:
 *   1. Native    - `<root>/<skill_id>.md` with YAML frontmatter, optionally enriched
 *                  by `<root>/SKILL_REGISTRY.yaml`.
 *   2. Anthropic - `<root>/<skill_dir>/SKILL.md` with `name` / `description`
 *                  frontmatter, plus optional bundled resource files.
 *
 * Snapshots carry metadata only. Skill bodies are fetched on demand through
 * getSkill(), so the assistant discloses skill content progressively instead of
 * paying for every skill body in every prompt.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const SKILL_MAX_BYTES = 512 * 1024;
const RESOURCE_MAX_BYTES = 512 * 1024;
const MAX_SKILLS_PER_ROOT = 200;
const MAX_RESOURCES_PER_SKILL = 50;
const MAX_BUNDLE_SCAN_DEPTH = 3;
const MAX_DESCRIPTION_LENGTH = 600;
const MAX_LIST_ENTRIES = 12;

const SKILL_FILENAME = 'SKILL.md';
const REGISTRY_FILENAME = 'SKILL_REGISTRY.yaml';
const NATIVE_RESERVED_FILES = new Set(['readme.md', 'skill_template.md', 'skill.md']);

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDiagnostic(severity, message, details = {}) {
  return {
    severity,
    message,
    ...details,
  };
}

function isSafeSkillId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 64 && /^[a-z0-9][a-z0-9_-]*$/.test(id);
}

function normalizeSkillId(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const normalized = rawValue
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[-_]+/, '')
    .slice(0, 64);
  return isSafeSkillId(normalized) ? normalized : null;
}

function isPathInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function toDisplayText(value, maxLength = MAX_DESCRIPTION_LENGTH) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function toStringList(value, maxEntries = MAX_LIST_ENTRIES) {
  if (!Array.isArray(value)) {
    return typeof value === 'string' && value.trim() ? [toDisplayText(value, 160)] : [];
  }
  const list = [];
  for (const entry of value) {
    if (list.length >= maxEntries) break;
    if (typeof entry === 'string' && entry.trim()) {
      list.push(toDisplayText(entry, 160));
    } else if (entry && typeof entry === 'object' && typeof entry.name === 'string') {
      list.push(toDisplayText(entry.name, 160));
    }
  }
  return list;
}

/**
 * Split a Markdown document into its YAML frontmatter and body.
 * Throws when the frontmatter block is present but not parseable YAML.
 */
function parseFrontmatter(content) {
  const normalized = String(content || '').replace(/^\uFEFF/, '');
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(normalized);
  if (!match) {
    return { data: null, body: normalized };
  }

  const parsed = yaml.load(match[1]);
  return {
    data: parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null,
    body: normalized.slice(match[0].length),
  };
}

class SkillRegistryService {
  constructor(options = {}) {
    this.app = options.app || null;
    this.appSkillsRoot =
      options.appSkillsRoot ||
      (this.app && typeof this.app.getAppPath === 'function'
        ? path.join(this.app.getAppPath(), '.agent', 'skills')
        : path.resolve(__dirname, '../../.agent/skills'));
    this.userSkillsRoot =
      options.userSkillsRoot ||
      (this.app && typeof this.app.getPath === 'function' ? path.join(this.app.getPath('userData'), 'skills') : null);
    this.cacheTtlMs = options.cacheTtlMs || DEFAULT_CACHE_TTL_MS;
    this.cachedSnapshot = null;
    this.cachedAt = 0;
  }

  async getSnapshot(options = {}) {
    const force = !!options.force;
    if (!force && this.cachedSnapshot && Date.now() - this.cachedAt < this.cacheTtlMs) {
      return cloneSerializable(this.cachedSnapshot);
    }

    let snapshot;
    try {
      snapshot = await this.loadSnapshot();
    } catch (error) {
      snapshot = this.createEmptySnapshot([
        createDiagnostic('error', 'Skill registry snapshot generation failed', {
          source: 'skill_registry_service',
          error: error.message,
        }),
      ]);
    }
    this.cachedSnapshot = snapshot;
    this.cachedAt = Date.now();
    return cloneSerializable(snapshot);
  }

  async reload() {
    this.cachedSnapshot = null;
    this.cachedAt = 0;
    return this.getSnapshot({ force: true });
  }

  async getMetadata() {
    const snapshot = await this.getSnapshot();
    return {
      success: snapshot.success,
      schemaVersion: snapshot.schemaVersion,
      generatedAt: snapshot.generatedAt,
      registryHash: snapshot.registryHash,
      counts: snapshot.counts,
      diagnostics: snapshot.diagnostics,
      roots: snapshot.roots,
    };
  }

  /**
   * Resolve the on-disk location of a skill without exposing absolute paths to callers.
   */
  async resolveSkillEntry(skillId) {
    if (!isSafeSkillId(skillId)) {
      return { error: 'Invalid skill id' };
    }

    const snapshot = await this.getSnapshot();
    const skill = snapshot.skillsById[skillId] || null;
    if (!skill) {
      return { error: `Skill not found: ${skillId}` };
    }

    const root = skill.source === 'user_skills' ? this.userSkillsRoot : this.appSkillsRoot;
    if (!root) {
      return { error: `Skill root unavailable for: ${skillId}` };
    }

    const absolutePath = path.resolve(root, skill.sourceFile);
    if (!isPathInside(root, absolutePath)) {
      return { error: `Skill path escapes its registry root: ${skillId}` };
    }

    return { skill, root, absolutePath };
  }

  /**
   * Return a skill's full content. Bodies are intentionally excluded from snapshots so
   * the assistant can load them on demand (progressive disclosure).
   *
   * Returns both halves of the document: the Markdown `body` (rationale, interpretation,
   * troubleshooting) and the execution-relevant frontmatter sections as `workflow`
   * (inputs, preconditions, steps, parallel_groups, outputs, agent_notes). Native-format
   * skills carry their actual step plan in the frontmatter, so returning the body alone
   * would strip the part the assistant needs most.
   */
  async getSkill(skillId) {
    const resolved = await this.resolveSkillEntry(skillId);
    if (resolved.error) {
      return { success: false, error: resolved.error, skill: null, body: null, workflow: null };
    }

    try {
      const stat = await fs.stat(resolved.absolutePath);
      if (stat.size > SKILL_MAX_BYTES) {
        return {
          success: false,
          error: `Skill document exceeds the ${SKILL_MAX_BYTES} byte limit`,
          skill: resolved.skill,
          body: null,
          workflow: null,
        };
      }

      const content = await fs.readFile(resolved.absolutePath, 'utf8');
      const { data, body } = parseFrontmatter(content);
      return {
        success: true,
        error: null,
        skill: resolved.skill,
        body: body.trim(),
        workflow: this.extractWorkflow(data),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to read skill: ${error.message}`,
        skill: resolved.skill,
        body: null,
        workflow: null,
      };
    }
  }

  /**
   * Pull the execution-relevant sections out of a skill's frontmatter. Discovery metadata
   * (name, description, tags, triggers) is omitted because the snapshot already carries it.
   */
  extractWorkflow(frontmatter) {
    if (!frontmatter || typeof frontmatter !== 'object') return null;

    const sections = ['inputs', 'preconditions', 'steps', 'parallel_groups', 'outputs', 'agent_notes'];
    const workflow = {};
    for (const key of sections) {
      if (frontmatter[key] !== undefined && frontmatter[key] !== null) {
        workflow[key] = cloneSerializable(frontmatter[key]);
      }
    }
    return Object.keys(workflow).length > 0 ? workflow : null;
  }

  /**
   * Read a resource file bundled alongside an Anthropic-format skill.
   */
  async getSkillResource(skillId, resourcePath) {
    const resolved = await this.resolveSkillEntry(skillId);
    if (resolved.error) {
      return { success: false, error: resolved.error, content: null };
    }

    const resources = resolved.skill.resources || [];
    if (typeof resourcePath !== 'string' || !resources.includes(resourcePath)) {
      return { success: false, error: `Resource is not declared by skill '${skillId}'`, content: null };
    }

    const skillDir = path.dirname(resolved.absolutePath);
    const absoluteResource = path.resolve(skillDir, resourcePath);
    if (!isPathInside(skillDir, absoluteResource)) {
      return { success: false, error: 'Resource path escapes the skill directory', content: null };
    }

    try {
      const stat = await fs.stat(absoluteResource);
      if (stat.size > RESOURCE_MAX_BYTES) {
        return {
          success: false,
          error: `Resource exceeds the ${RESOURCE_MAX_BYTES} byte limit`,
          content: null,
        };
      }
      const content = await fs.readFile(absoluteResource, 'utf8');
      return { success: true, error: null, content, resource: resourcePath };
    } catch (error) {
      return { success: false, error: `Failed to read resource: ${error.message}`, content: null };
    }
  }

  async loadSnapshot() {
    const diagnostics = [];
    const hash = crypto.createHash('sha256');

    const appSkills = await this.loadSkillsFromRoot(this.appSkillsRoot, 'app_skills', diagnostics, hash);

    let userSkills = [];
    if (this.userSkillsRoot) {
      await this.ensureUserSkillsRoot(diagnostics);
      const appSkillIds = new Set(appSkills.map(skill => skill.id));
      userSkills = await this.loadSkillsFromRoot(this.userSkillsRoot, 'user_skills', diagnostics, hash, {
        disallowSkillIds: appSkillIds,
      });
    }

    const skills = [...appSkills, ...userSkills];
    const skillsById = {};
    for (const skill of skills) {
      if (!skillsById[skill.id]) {
        skillsById[skill.id] = skill;
      }
    }

    return {
      success: diagnostics.every(diagnostic => diagnostic.severity !== 'error'),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      registryHash: hash.digest('hex'),
      roots: {
        appSkills: 'app://.agent/skills',
        userSkills: this.userSkillsRoot ? 'userData://skills' : null,
      },
      counts: {
        skills: skills.length,
        appSkills: appSkills.length,
        userSkills: userSkills.length,
        uniqueSkills: Object.keys(skillsById).length,
        nativeSkills: skills.filter(skill => skill.format === 'native').length,
        anthropicSkills: skills.filter(skill => skill.format === 'anthropic').length,
        diagnostics: diagnostics.length,
      },
      skills,
      skillsById,
      diagnostics,
    };
  }

  createEmptySnapshot(diagnostics = []) {
    return {
      success: false,
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      registryHash: crypto.createHash('sha256').update(JSON.stringify(diagnostics)).digest('hex'),
      roots: {
        appSkills: 'app://.agent/skills',
        userSkills: this.userSkillsRoot ? 'userData://skills' : null,
      },
      counts: {
        skills: 0,
        appSkills: 0,
        userSkills: 0,
        uniqueSkills: 0,
        nativeSkills: 0,
        anthropicSkills: 0,
        diagnostics: diagnostics.length,
      },
      skills: [],
      skillsById: {},
      diagnostics,
    };
  }

  async ensureUserSkillsRoot(diagnostics) {
    try {
      await fs.mkdir(this.userSkillsRoot, { recursive: true });
    } catch (error) {
      diagnostics.push(
        createDiagnostic('warning', 'User skills directory is unavailable', {
          source: 'user_skills',
          error: error.message,
        })
      );
    }
  }

  async loadSkillsFromRoot(skillsRoot, source, diagnostics, hash, options = {}) {
    const skills = [];
    if (!skillsRoot) return skills;

    const resolvedRoot = path.resolve(skillsRoot);
    let entries;
    try {
      entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
    } catch (error) {
      if (!error || error.code !== 'ENOENT') {
        diagnostics.push(
          createDiagnostic(source === 'app_skills' ? 'warning' : 'error', 'Unable to scan skills directory', {
            source,
            error: error.message,
          })
        );
      }
      return skills;
    }

    const registryIndex = await this.loadRegistryIndex(resolvedRoot, source, diagnostics, hash);
    const disallowSkillIds = options.disallowSkillIds || new Set();
    const seenIds = new Set();

    const sortedEntries = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sortedEntries) {
      if (skills.length >= MAX_SKILLS_PER_ROOT) {
        diagnostics.push(
          createDiagnostic('warning', 'Skill directory listing truncated', {
            source,
            limit: MAX_SKILLS_PER_ROOT,
          })
        );
        break;
      }

      if (entry.isSymbolicLink()) {
        diagnostics.push(
          createDiagnostic('warning', 'Skipped symlinked skill entry', {
            source,
            file: entry.name,
          })
        );
        continue;
      }

      let candidate = null;
      if (entry.isDirectory()) {
        candidate = await this.loadAnthropicSkill(resolvedRoot, entry.name, source, diagnostics, hash);
      } else if (entry.isFile() && /\.md$/i.test(entry.name) && !NATIVE_RESERVED_FILES.has(entry.name.toLowerCase())) {
        candidate = await this.loadNativeSkill(resolvedRoot, entry.name, source, diagnostics, hash, registryIndex);
      }

      if (!candidate) continue;

      if (seenIds.has(candidate.id)) {
        diagnostics.push(
          createDiagnostic('warning', 'Duplicate skill id in skills root; first definition kept', {
            source,
            file: candidate.sourceFile,
            skill: candidate.id,
          })
        );
        continue;
      }

      if (disallowSkillIds.has(candidate.id)) {
        diagnostics.push(
          createDiagnostic('error', 'User skill cannot override a built-in skill', {
            source,
            file: candidate.sourceFile,
            skill: candidate.id,
          })
        );
        continue;
      }

      seenIds.add(candidate.id);
      skills.push(candidate);
    }

    return skills;
  }

  /**
   * Load the optional native SKILL_REGISTRY.yaml index, keyed by skill id.
   */
  async loadRegistryIndex(resolvedRoot, source, diagnostics, hash) {
    const registryPath = path.join(resolvedRoot, REGISTRY_FILENAME);
    const index = new Map();

    let content;
    try {
      content = await fs.readFile(registryPath, 'utf8');
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        diagnostics.push(
          createDiagnostic('warning', 'Failed to read skill registry index', {
            source,
            file: REGISTRY_FILENAME,
            error: error.message,
          })
        );
      }
      return index;
    }

    try {
      hash.update(`skill-registry:${source}:${content}\n`);
      const parsed = yaml.load(content) || {};
      const entries = Array.isArray(parsed.skills) ? parsed.skills : [];
      for (const entry of entries) {
        if (!entry || typeof entry !== 'object') continue;
        const id = normalizeSkillId(entry.id);
        if (id) index.set(id, entry);
      }
    } catch (error) {
      diagnostics.push(
        createDiagnostic('warning', 'Skill registry index is not valid YAML', {
          source,
          file: REGISTRY_FILENAME,
          error: error.message,
        })
      );
    }

    return index;
  }

  async loadNativeSkill(resolvedRoot, fileName, source, diagnostics, hash, registryIndex) {
    const absolutePath = path.join(resolvedRoot, fileName);
    const parsed = await this.readSkillDocument(absolutePath, fileName, source, diagnostics, hash);
    if (!parsed) return null;

    const fallbackId = normalizeSkillId(path.basename(fileName, path.extname(fileName)));
    const id = normalizeSkillId(parsed.data?.name) || fallbackId;
    if (!id) {
      diagnostics.push(
        createDiagnostic('warning', 'Skipped skill with an unusable id', {
          source,
          file: fileName,
        })
      );
      return null;
    }

    return this.normalizeSkill(parsed.data || {}, {
      id,
      source,
      format: 'native',
      sourceFile: fileName,
      bodyLength: parsed.body.length,
      registryEntry: registryIndex.get(id) || null,
      resources: [],
    });
  }

  async loadAnthropicSkill(resolvedRoot, dirName, source, diagnostics, hash) {
    const skillDir = path.join(resolvedRoot, dirName);
    const skillFile = path.join(skillDir, SKILL_FILENAME);

    try {
      const stat = await fs.stat(skillFile);
      if (!stat.isFile()) return null;
    } catch {
      // Directories without a SKILL.md are not skill bundles; ignore silently.
      return null;
    }

    const relativeFile = path.join(dirName, SKILL_FILENAME);
    const parsed = await this.readSkillDocument(skillFile, relativeFile, source, diagnostics, hash);
    if (!parsed) return null;

    const id = normalizeSkillId(parsed.data?.name) || normalizeSkillId(dirName);
    if (!id) {
      diagnostics.push(
        createDiagnostic('warning', 'Skipped skill bundle with an unusable name', {
          source,
          file: relativeFile,
        })
      );
      return null;
    }

    if (!parsed.data || typeof parsed.data.description !== 'string' || !parsed.data.description.trim()) {
      diagnostics.push(
        createDiagnostic('warning', 'Skill bundle is missing a description; discovery accuracy will suffer', {
          source,
          file: relativeFile,
          skill: id,
        })
      );
    }

    const resources = await this.collectBundleResources(skillDir, diagnostics, source, relativeFile);

    return this.normalizeSkill(parsed.data || {}, {
      id,
      source,
      format: 'anthropic',
      sourceFile: relativeFile,
      bodyLength: parsed.body.length,
      registryEntry: null,
      resources,
    });
  }

  async readSkillDocument(absolutePath, relativeFile, source, diagnostics, hash) {
    try {
      const stat = await fs.stat(absolutePath);
      if (stat.size > SKILL_MAX_BYTES) {
        diagnostics.push(
          createDiagnostic('warning', 'Skipped oversized skill document', {
            source,
            file: relativeFile,
            bytes: stat.size,
            maxBytes: SKILL_MAX_BYTES,
          })
        );
        return null;
      }

      const content = await fs.readFile(absolutePath, 'utf8');
      hash.update(`skill:${source}:${relativeFile}:${content}\n`);

      const parsed = parseFrontmatter(content);
      if (!parsed.data) {
        diagnostics.push(
          createDiagnostic('warning', 'Skipped skill without YAML frontmatter', {
            source,
            file: relativeFile,
          })
        );
        return null;
      }
      return parsed;
    } catch (error) {
      diagnostics.push(
        createDiagnostic('warning', 'Failed to load skill document', {
          source,
          file: relativeFile,
          error: error.message,
        })
      );
      return null;
    }
  }

  /**
   * List supporting files bundled with an Anthropic-format skill, relative to the
   * skill directory. SKILL.md itself is excluded; it is served by getSkill().
   */
  async collectBundleResources(skillDir, diagnostics, source, relativeFile) {
    const resources = [];

    const walk = async (currentDir, depth) => {
      if (depth > MAX_BUNDLE_SCAN_DEPTH || resources.length >= MAX_RESOURCES_PER_SKILL) return;

      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of [...entries].sort((a, b) => a.name.localeCompare(b.name))) {
        if (resources.length >= MAX_RESOURCES_PER_SKILL) {
          diagnostics.push(
            createDiagnostic('warning', 'Skill resource listing truncated', {
              source,
              file: relativeFile,
              limit: MAX_RESOURCES_PER_SKILL,
            })
          );
          return;
        }
        if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name !== SKILL_FILENAME) {
          resources.push(path.relative(skillDir, fullPath).split(path.sep).join('/'));
        }
      }
    };

    await walk(skillDir, 0);
    return resources;
  }

  normalizeSkill(frontmatter, context) {
    const registryEntry = context.registryEntry || {};
    const description = toDisplayText(frontmatter.description || registryEntry.description || '');

    const triggers = toStringList(frontmatter.triggers || registryEntry.triggers);
    const tags = toStringList(frontmatter.tags || registryEntry.tags);
    const toolsUsed = toStringList(
      frontmatter.mcp_tools_used || registryEntry.mcp_tools_used || frontmatter['allowed-tools'] || frontmatter.tools,
      40
    );

    const durationSource = registryEntry.typical_duration_seconds ?? frontmatter.typical_duration_seconds;
    const duration = Number.isFinite(Number(durationSource)) ? Number(durationSource) : null;

    return {
      id: context.id,
      name: toDisplayText(frontmatter.name || context.id, 120),
      description,
      version: toDisplayText(frontmatter.version || registryEntry.version || '', 40),
      format: context.format,
      source: context.source,
      sourceFile: context.sourceFile,
      isBuiltIn: context.source === 'app_skills',
      category: toDisplayText(frontmatter.category || registryEntry.category || 'general', 60),
      complexity: toDisplayText(frontmatter.complexity || registryEntry.complexity || '', 40),
      tags,
      triggers,
      toolsUsed,
      typicalDurationSeconds: duration,
      requiresGenome: (registryEntry.requires_genome ?? frontmatter.requires_genome) === true,
      requiresNetwork: (registryEntry.requires_network ?? frontmatter.requires_network) === true,
      license: toDisplayText(frontmatter.license || '', 120),
      resources: context.resources || [],
      bodyLength: context.bodyLength,
    };
  }
}

module.exports = {
  SkillRegistryService,
  SNAPSHOT_SCHEMA_VERSION,
  SKILL_MAX_BYTES,
  parseFrontmatter,
  normalizeSkillId,
  isSafeSkillId,
};
