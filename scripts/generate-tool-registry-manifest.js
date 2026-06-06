#!/usr/bin/env node
'use strict';

const fs = require('fs').promises;
const path = require('path');

const { ToolRegistryService } = require('../src/main/tool-registry-service');

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const registryRoot = path.join(repoRoot, 'tools_registry');
  const manifestPath = path.join(registryRoot, 'generated', 'tool-registry-manifest.json');

  const service = new ToolRegistryService({
    registryRoot,
    userRegistryRoot: null,
    generatedManifestPath: manifestPath,
    cacheTtlMs: 1,
  });

  const snapshot = await service.getSnapshot({ force: true });
  if (!snapshot.success || !Array.isArray(snapshot.tools) || snapshot.tools.length === 0) {
    throw new Error(`Cannot generate tool registry manifest: ${JSON.stringify(snapshot.diagnostics || [])}`);
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  const manifestLabel = path.relative(repoRoot, manifestPath);
  console.log(`Generated ${manifestLabel}`);
  console.log(`Tools: ${snapshot.counts.tools}; built-in mappings: ${snapshot.counts.builtInTools}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
