// @ts-check
/**
 * Main-process Tool Registry service.
 *
 * The renderer consumes sanitized JSON snapshots from this service instead of
 * reading tools_registry/ directly. This keeps local file access available to
 * the Electron app while preserving the hardened renderer boundary.
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration');

const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const USER_TOOL_MAX_BYTES = 256 * 1024;

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

function isSafeToolName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9_]*$/.test(name);
}

function isPathInside(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeCategoryFromPath(registryRoot, filePath) {
  const relativePath = path.relative(registryRoot, filePath);
  const parts = relativePath.split(path.sep);
  return parts.length > 1 ? parts[0] : null;
}

function hasJavaScriptImplementation(tool) {
  const implementation = tool.implementation || {};
  const execution = tool.execution || {};
  const implementationType = String(implementation.type || execution.type || tool.execution_type || '').toLowerCase();
  const blockedTypes = new Set(['built-in', 'builtin', 'javascript', 'js', 'node', 'module', 'script', 'local']);
  const blockedFields = ['code', 'script', 'module', 'path', 'file', 'handler', 'method', 'entrypoint'];

  if (blockedTypes.has(implementationType)) {
    return true;
  }

  return blockedFields.some(field => Object.prototype.hasOwnProperty.call(implementation, field));
}

class ToolRegistryService {
  constructor(options = {}) {
    this.app = options.app || null;
    this.registryRoot =
      options.registryRoot ||
      (this.app && typeof this.app.getAppPath === 'function'
        ? path.join(this.app.getAppPath(), 'tools_registry')
        : path.resolve(__dirname, '../../tools_registry'));
    this.userRegistryRoot =
      options.userRegistryRoot ||
      (this.app && typeof this.app.getPath === 'function'
        ? path.join(this.app.getPath('userData'), 'tool-registry')
        : null);
    this.generatedManifestPath =
      options.generatedManifestPath || path.join(this.registryRoot, 'generated', 'tool-registry-manifest.json');
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
        createDiagnostic('error', 'Tool registry snapshot generation failed', {
          source: 'tool_registry_service',
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

  async getTool(toolName) {
    if (!isSafeToolName(toolName)) {
      return {
        success: false,
        error: 'Invalid tool name',
        tool: null,
      };
    }

    const snapshot = await this.getSnapshot();
    const tool = snapshot.toolsByName[toolName] || null;
    return {
      success: !!tool,
      tool,
      error: tool ? null : `Tool not found: ${toolName}`,
    };
  }

  async loadSnapshot() {
    const diagnostics = [];
    const hash = crypto.createHash('sha256');
    const categories = await this.loadCategories(diagnostics, hash);
    const builtInTools = this.loadBuiltInTools(diagnostics, hash);
    const builtInToolsByName = new Map(builtInTools.map(tool => [tool.name, tool]));
    const appTools = await this.loadToolsFromRoot(this.registryRoot, 'app_registry', diagnostics, hash, {
      builtInToolsByName,
      disallowBuiltInCollisions: false,
    });

    if (appTools.length === 0) {
      const fallbackSnapshot = await this.loadGeneratedManifestFallback(diagnostics);
      if (fallbackSnapshot) {
        return fallbackSnapshot;
      }
    }

    let userTools = [];
    if (this.userRegistryRoot) {
      await this.ensureUserRegistryRoot(diagnostics);
      const appToolNames = new Set(appTools.map(tool => tool.name));
      userTools = await this.loadToolsFromRoot(this.userRegistryRoot, 'user_registry', diagnostics, hash, {
        builtInToolsByName,
        disallowBuiltInCollisions: true,
        disallowToolNames: appToolNames,
        maxBytes: USER_TOOL_MAX_BYTES,
      });
    }

    const tools = [...appTools, ...userTools];
    const toolsByName = {};
    const duplicateNames = new Set();
    for (const tool of tools) {
      if (toolsByName[tool.name]) {
        duplicateNames.add(tool.name);
        continue;
      }
      toolsByName[tool.name] = tool;
    }

    for (const name of duplicateNames) {
      diagnostics.push(
        createDiagnostic('warning', `Duplicate tool definition encountered; first definition kept in toolsByName`, {
          tool: name,
        })
      );
    }

    return {
      success: diagnostics.every(diagnostic => diagnostic.severity !== 'error'),
      schemaVersion: SNAPSHOT_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      registryHash: hash.digest('hex'),
      roots: {
        appRegistry: 'app://tools_registry',
        userRegistry: this.userRegistryRoot ? 'userData://tool-registry' : null,
      },
      counts: {
        tools: tools.length,
        appTools: appTools.length,
        userTools: userTools.length,
        uniqueTools: Object.keys(toolsByName).length,
        categories: Object.keys(categories.categories || {}).length,
        builtInTools: builtInTools.length,
        diagnostics: diagnostics.length,
      },
      categories,
      tools,
      toolsByName,
      builtInTools,
      builtInToolsByName: Object.fromEntries(builtInTools.map(tool => [tool.name, tool])),
      aliases: this.buildAliases(tools),
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
        appRegistry: 'app://tools_registry',
        userRegistry: this.userRegistryRoot ? 'userData://tool-registry' : null,
      },
      counts: {
        tools: 0,
        appTools: 0,
        userTools: 0,
        uniqueTools: 0,
        categories: 0,
        builtInTools: 0,
        diagnostics: diagnostics.length,
      },
      categories: { categories: {} },
      tools: [],
      toolsByName: {},
      builtInTools: [],
      builtInToolsByName: {},
      aliases: {},
      diagnostics,
    };
  }

  async loadGeneratedManifestFallback(previousDiagnostics = []) {
    try {
      const content = await fs.readFile(this.generatedManifestPath, 'utf8');
      const parsed = JSON.parse(content);
      const snapshot = this.migrateSnapshot(parsed);
      const fallbackDiagnostics = previousDiagnostics.map(diagnostic => ({
        ...diagnostic,
        severity: diagnostic.severity === 'error' ? 'warning' : diagnostic.severity,
        recoveredBy: diagnostic.severity === 'error' ? 'generated_manifest' : diagnostic.recoveredBy,
      }));
      snapshot.diagnostics = [
        ...fallbackDiagnostics,
        ...snapshot.diagnostics,
        createDiagnostic('warning', 'Loaded generated tool registry manifest fallback', {
          source: 'generated_manifest',
        }),
      ];
      snapshot.success = this.hasUsableSnapshot(snapshot);
      snapshot.counts = {
        ...(snapshot.counts || {}),
        diagnostics: snapshot.diagnostics.length,
      };
      return snapshot;
    } catch (error) {
      previousDiagnostics.push(
        createDiagnostic('error', 'Generated tool registry manifest fallback is unavailable', {
          source: 'generated_manifest',
          error: error.message,
        })
      );
      return null;
    }
  }

  hasUsableSnapshot(snapshot) {
    return (
      !!snapshot &&
      snapshot.schemaVersion === SNAPSHOT_SCHEMA_VERSION &&
      Array.isArray(snapshot.tools) &&
      snapshot.tools.length > 0 &&
      snapshot.toolsByName &&
      typeof snapshot.toolsByName === 'object'
    );
  }

  migrateSnapshot(snapshot) {
    const migrated = cloneSerializable(snapshot || {});
    migrated.schemaVersion = migrated.schemaVersion || SNAPSHOT_SCHEMA_VERSION;
    migrated.generatedAt = migrated.generatedAt || new Date().toISOString();
    migrated.categories = migrated.categories || { categories: {} };
    migrated.tools = Array.isArray(migrated.tools) ? migrated.tools : Object.values(migrated.toolsByName || {});
    migrated.builtInTools = Array.isArray(migrated.builtInTools) ? migrated.builtInTools : [];
    migrated.toolsByName =
      migrated.toolsByName ||
      Object.fromEntries(migrated.tools.filter(tool => tool && tool.name).map(tool => [tool.name, tool]));
    migrated.builtInToolsByName =
      migrated.builtInToolsByName ||
      Object.fromEntries(migrated.builtInTools.filter(tool => tool && tool.name).map(tool => [tool.name, tool]));
    migrated.aliases = migrated.aliases || {};
    migrated.diagnostics = Array.isArray(migrated.diagnostics) ? migrated.diagnostics : [];
    migrated.counts = {
      tools: migrated.tools.length,
      appTools: migrated.counts?.appTools ?? migrated.tools.length,
      userTools: migrated.counts?.userTools ?? 0,
      uniqueTools: Object.keys(migrated.toolsByName).length,
      categories: Object.keys(migrated.categories.categories || {}).length,
      builtInTools: migrated.builtInTools.length,
      diagnostics: migrated.diagnostics.length,
      ...(migrated.counts || {}),
    };
    return migrated;
  }

  async ensureUserRegistryRoot(diagnostics) {
    try {
      await fs.mkdir(this.userRegistryRoot, { recursive: true });
    } catch (error) {
      diagnostics.push(
        createDiagnostic('warning', 'User tool registry directory is unavailable', {
          source: 'user_registry',
          error: error.message,
        })
      );
    }
  }

  loadBuiltInTools(diagnostics, hash) {
    try {
      const integration = new BuiltInToolsIntegration();
      const builtInTools = [];

      for (const [name, info] of integration.builtInToolsMap.entries()) {
        const normalized = {
          name,
          ...cloneSerializable(info),
          isBuiltIn: true,
          isExternal: false,
          source: 'builtin_tools_map',
        };
        builtInTools.push(normalized);
        hash.update(`builtin:${name}:${JSON.stringify(normalized)}\n`);
      }

      return builtInTools;
    } catch (error) {
      diagnostics.push(
        createDiagnostic('error', 'Failed to load built-in tools map', {
          source: 'builtin_tools_map',
          error: error.message,
        })
      );
      return [];
    }
  }

  async loadCategories(diagnostics, hash) {
    const merged = { categories: {} };
    const categoryFiles = [
      { root: this.registryRoot, source: 'app_registry' },
      ...(this.userRegistryRoot ? [{ root: this.userRegistryRoot, source: 'user_registry' }] : []),
    ];

    for (const entry of categoryFiles) {
      const filePath = path.join(entry.root, 'tool_categories.yaml');
      try {
        const content = await fs.readFile(filePath, 'utf8');
        hash.update(`category:${entry.source}:${content}\n`);
        const parsed = yaml.load(content) || {};
        if (parsed.categories && typeof parsed.categories === 'object') {
          Object.assign(merged.categories, cloneSerializable(parsed.categories));
        }
      } catch (error) {
        if (entry.source === 'app_registry') {
          diagnostics.push(
            createDiagnostic('error', 'Failed to load app tool categories', {
              source: entry.source,
              file: 'tool_categories.yaml',
              error: error.message,
            })
          );
        }
      }
    }

    return merged;
  }

  async loadToolsFromRoot(registryRoot, source, diagnostics, hash, options = {}) {
    const tools = [];
    if (!registryRoot) return tools;

    const resolvedRoot = path.resolve(registryRoot);
    if (!isPathInside(resolvedRoot, resolvedRoot)) {
      diagnostics.push(createDiagnostic('error', 'Invalid registry root', { source }));
      return tools;
    }

    let yamlFiles = [];
    try {
      yamlFiles = await this.findYamlFiles(resolvedRoot, diagnostics, source);
    } catch (error) {
      if (source === 'app_registry') {
        diagnostics.push(
          createDiagnostic('error', 'Unable to scan app tool registry', {
            source,
            error: error.message,
          })
        );
      }
      return tools;
    }

    const seenNames = new Set();
    for (const filePath of yamlFiles) {
      const relativeFile = path.relative(resolvedRoot, filePath);
      if (path.basename(filePath) === 'tool_categories.yaml') continue;

      if (!isPathInside(resolvedRoot, filePath)) {
        diagnostics.push(
          createDiagnostic('warning', 'Skipped registry file outside allowed root', {
            source,
            file: relativeFile,
          })
        );
        continue;
      }

      try {
        const stat = await fs.stat(filePath);
        if (options.maxBytes && stat.size > options.maxBytes) {
          diagnostics.push(
            createDiagnostic('warning', 'Skipped oversized user tool definition', {
              source,
              file: relativeFile,
              bytes: stat.size,
              maxBytes: options.maxBytes,
            })
          );
          continue;
        }

        const content = await fs.readFile(filePath, 'utf8');
        hash.update(`tool:${source}:${relativeFile}:${content}\n`);
        const parsed = yaml.load(content);
        if (!parsed || typeof parsed !== 'object') {
          diagnostics.push(
            createDiagnostic('warning', 'Skipped empty or invalid tool definition', {
              source,
              file: relativeFile,
            })
          );
          continue;
        }

        const normalized = this.normalizeTool(parsed, {
          source,
          relativeFile,
          categoryFromPath: normalizeCategoryFromPath(resolvedRoot, filePath),
          builtInToolsByName: options.builtInToolsByName || new Map(),
        });

        const validation = this.validateTool(normalized, {
          source,
          relativeFile,
          disallowBuiltInCollisions: !!options.disallowBuiltInCollisions,
          disallowToolNames: options.disallowToolNames || new Set(),
          builtInToolsByName: options.builtInToolsByName || new Map(),
          seenNames,
        });

        diagnostics.push(...validation.diagnostics);
        if (!validation.valid) continue;

        seenNames.add(normalized.name);
        tools.push(normalized);
      } catch (error) {
        diagnostics.push(
          createDiagnostic(source === 'app_registry' ? 'warning' : 'error', 'Failed to load tool definition', {
            source,
            file: relativeFile,
            error: error.message,
          })
        );
      }
    }

    return tools;
  }

  async findYamlFiles(root, diagnostics = null, source = null) {
    const results = [];
    let entries = [];
    try {
      entries = await fs.readdir(root, { withFileTypes: true });
    } catch (error) {
      if (error && error.code === 'ENOENT') return results;
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await this.findYamlFiles(fullPath, diagnostics, source)));
      } else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) {
        results.push(fullPath);
      } else if (entry.isFile() && source === 'user_registry' && diagnostics) {
        diagnostics.push(
          createDiagnostic('warning', 'Skipped non-YAML user registry file', {
            source,
            file: path.relative(root, fullPath),
            reason: 'User-defined tools must be YAML descriptors; JavaScript or other executable files are not loaded.',
          })
        );
      }
    }

    return results.sort();
  }

  normalizeTool(rawTool, context) {
    const builtInInfo = context.builtInToolsByName.get(rawTool.name);
    const implementation = rawTool.implementation || {};
    const isBuiltIn =
      !!builtInInfo ||
      rawTool.execution_type === 'built-in' ||
      rawTool.execution?.type === 'built-in' ||
      implementation.type === 'built-in';

    return {
      ...cloneSerializable(rawTool),
      name: rawTool.name,
      description: rawTool.description || '',
      category: rawTool.category || builtInInfo?.category || context.categoryFromPath || 'uncategorized',
      source: context.source,
      sourceFile: context.relativeFile,
      isBuiltIn,
      isExternal: isBuiltIn ? false : rawTool.is_external === true,
      execution_type: isBuiltIn ? 'built-in' : rawTool.execution_type || rawTool.execution?.type || 'registry',
      implementation: isBuiltIn
        ? {
            ...cloneSerializable(implementation),
            type: 'built-in',
            method: builtInInfo?.method || implementation.method,
          }
        : cloneSerializable(implementation),
      priority: Number.isFinite(rawTool.priority) ? rawTool.priority : builtInInfo?.priority || 5,
      keywords: Array.isArray(rawTool.keywords) ? rawTool.keywords.filter(keyword => typeof keyword === 'string') : [],
      parameters:
        rawTool.parameters && typeof rawTool.parameters === 'object'
          ? cloneSerializable(rawTool.parameters)
          : { type: 'object', properties: {}, required: [] },
      sample_usages: Array.isArray(rawTool.sample_usages) ? cloneSerializable(rawTool.sample_usages) : [],
      builtin: builtInInfo ? cloneSerializable(builtInInfo) : null,
    };
  }

  validateTool(tool, options) {
    const diagnostics = [];
    if (!isSafeToolName(tool.name)) {
      diagnostics.push(
        createDiagnostic('error', 'Tool definition has an invalid name', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name || null,
        })
      );
      return { valid: false, diagnostics };
    }

    if (options.seenNames.has(tool.name)) {
      diagnostics.push(
        createDiagnostic('warning', 'Duplicate tool name in registry root', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
    }

    if (options.disallowBuiltInCollisions && options.builtInToolsByName.has(tool.name)) {
      diagnostics.push(
        createDiagnostic('error', 'User tool cannot override a built-in tool', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
      return { valid: false, diagnostics };
    }

    if (options.disallowToolNames.has(tool.name)) {
      diagnostics.push(
        createDiagnostic('error', 'User tool cannot override an app registry tool', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
      return { valid: false, diagnostics };
    }

    if (options.source === 'user_registry' && hasJavaScriptImplementation(tool)) {
      diagnostics.push(
        createDiagnostic('error', 'User tool cannot define local JavaScript or built-in implementation', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
      return { valid: false, diagnostics };
    }

    if (!tool.parameters || typeof tool.parameters !== 'object') {
      diagnostics.push(
        createDiagnostic('warning', 'Tool definition has no parameter schema', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
    }

    if (tool.isBuiltIn && tool.isExternal) {
      diagnostics.push(
        createDiagnostic('warning', 'Built-in tool was marked external; snapshot normalized it to built-in', {
          source: options.source,
          file: options.relativeFile,
          tool: tool.name,
        })
      );
    }

    return { valid: true, diagnostics };
  }

  buildAliases(tools) {
    const aliases = {};
    for (const tool of tools) {
      const toolAliases = tool.aliases || tool.legacy_aliases || [];
      if (!Array.isArray(toolAliases)) continue;
      for (const alias of toolAliases) {
        if (isSafeToolName(alias) && !aliases[alias]) {
          aliases[alias] = tool.name;
        }
      }
    }
    return aliases;
  }
}

module.exports = {
  ToolRegistryService,
  SNAPSHOT_SCHEMA_VERSION,
  USER_TOOL_MAX_BYTES,
  hasJavaScriptImplementation,
};
