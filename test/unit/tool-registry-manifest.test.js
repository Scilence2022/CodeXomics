import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const { SNAPSHOT_SCHEMA_VERSION, ToolRegistryService } = require('../../src/main/tool-registry-service');
const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration');

const ROOT = process.cwd();
const REGISTRY_ROOT = path.join(ROOT, 'tools_registry');
const MANIFEST_PATH = path.join(REGISTRY_ROOT, 'generated', 'tool-registry-manifest.json');

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

describe('generated tool registry manifest', () => {
  it('matches app YAML and built-in tool counts without leaking absolute paths', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const yamlToolCount = findToolYamlFiles(REGISTRY_ROOT).length;
    const builtInCount = new BuiltInToolsIntegration().builtInToolsMap.size;

    expect(manifest.success).toBe(true);
    expect(manifest.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(manifest.counts.appTools).toBe(yamlToolCount);
    expect(manifest.counts.tools).toBe(yamlToolCount);
    expect(manifest.counts.builtInTools).toBe(builtInCount);
    expect(manifest.toolsByName.load_genome_file.isBuiltIn).toBe(true);
    expect(manifest.roots.appRegistry).toBe('app://tools_registry');
    expect(JSON.stringify(manifest)).not.toContain(ROOT);
  });

  it('falls back to the generated manifest when the app YAML registry is unavailable', async () => {
    const service = new ToolRegistryService({
      registryRoot: path.join(ROOT, '.missing-tool-registry-root'),
      userRegistryRoot: null,
      generatedManifestPath: MANIFEST_PATH,
      cacheTtlMs: 1,
    });

    const snapshot = await service.getSnapshot({ force: true });

    expect(snapshot.success).toBe(true);
    expect(snapshot.toolsByName.load_genome_file.isBuiltIn).toBe(true);
    expect(snapshot.diagnostics.some(diagnostic => diagnostic.message.includes('manifest fallback'))).toBe(true);
    expect(snapshot.diagnostics.every(diagnostic => diagnostic.severity !== 'error')).toBe(true);
  });
});
