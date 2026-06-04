import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { ToolRegistryService } = require('../../src/main/tool-registry-service');
const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration');

const REGISTRY_ROOT = path.join(process.cwd(), 'tools_registry');

function findToolYamlFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findToolYamlFiles(fullPath));
    } else if (/\.ya?ml$/i.test(entry.name) && entry.name !== 'tool_categories.yaml') {
      files.push(fullPath);
    }
  }
  return files;
}

describe('ToolRegistryService', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads a sanitized snapshot that matches app YAML and built-in map counts', async () => {
    const service = new ToolRegistryService({
      registryRoot: REGISTRY_ROOT,
      userRegistryRoot: null,
      cacheTtlMs: 1,
    });

    const snapshot = await service.getSnapshot();
    const yamlToolCount = findToolYamlFiles(REGISTRY_ROOT).length;
    const builtInCount = new BuiltInToolsIntegration().builtInToolsMap.size;

    expect(snapshot.success).toBe(true);
    expect(snapshot.counts.appTools).toBe(yamlToolCount);
    expect(snapshot.counts.builtInTools).toBe(builtInCount);
    expect(snapshot.counts.categories).toBeGreaterThanOrEqual(18);
    expect(snapshot.toolsByName.load_genome_file.isBuiltIn).toBe(true);
    expect(snapshot.builtInToolsByName.load_genome_file.isExternal).toBe(false);
    expect(snapshot.roots.appRegistry).toBe('app://tools_registry');
    expect(JSON.stringify(snapshot)).not.toContain(REGISTRY_ROOT);
  });

  it('loads user overlay YAML but rejects user overrides of app tools', async () => {
    const userRegistryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexomics-tool-registry-'));
    tempDirs.push(userRegistryRoot);

    fs.writeFileSync(
      path.join(userRegistryRoot, 'custom_overlay_tool.yaml'),
      [
        "name: 'custom_overlay_tool'",
        "description: 'User overlay test tool'",
        "category: 'utility'",
        'priority: 5',
        "keywords: ['custom', 'overlay']",
        'parameters:',
        "  type: 'object'",
        '  properties: {}',
      ].join('\n')
    );

    fs.writeFileSync(
      path.join(userRegistryRoot, 'load_genome_file.yaml'),
      [
        "name: 'load_genome_file'",
        "description: 'Attempted built-in override'",
        "category: 'utility'",
        'priority: 1',
        'parameters:',
        "  type: 'object'",
        '  properties: {}',
      ].join('\n')
    );

    const service = new ToolRegistryService({
      registryRoot: REGISTRY_ROOT,
      userRegistryRoot,
      cacheTtlMs: 1,
    });

    const snapshot = await service.getSnapshot();

    expect(snapshot.counts.userTools).toBe(1);
    expect(snapshot.toolsByName.custom_overlay_tool.source).toBe('user_registry');
    expect(snapshot.toolsByName.load_genome_file.source).toBe('app_registry');
    expect(snapshot.diagnostics.some(diagnostic => diagnostic.message.includes('cannot override'))).toBe(true);
  });
});
