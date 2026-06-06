import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const ROOT = process.cwd();

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

function loadBrowserClass(relativePath, globalName, extraSandbox = {}) {
  const sandbox = {
    window: {},
    console,
    ...extraSandbox,
  };
  sandbox.window = { ...sandbox.window, ...(extraSandbox.window || {}) };
  vm.createContext(sandbox);
  vm.runInContext(readSource(relativePath), sandbox);
  return sandbox.window[globalName] || sandbox.module?.exports;
}

describe('file loading tool aliases', () => {
  it('routes common LLM file-loading aliases to canonical services', async () => {
    const ToolExecutionService = loadBrowserClass(
      'src/renderer/modules/chat/services/ToolExecutionService.js',
      'ToolExecutionService'
    );

    const calls = [];
    const fileService = {
      async loadGenomeFile(parameters) {
        calls.push(['loadGenomeFile', parameters]);
        return { success: true, tool: 'load_genome_file' };
      },
      async loadAnnotationFile(parameters) {
        calls.push(['loadAnnotationFile', parameters]);
        return { success: true, tool: 'load_annotation_file' };
      },
    };

    const service = new ToolExecutionService({}, { services: { file: fileService } });

    await service.execute('load_genome', { filePath: '/tmp/ecoli.gbk' });
    await service.execute('load_bed_file', { filePath: '/tmp/features.bed' });

    expect(calls).toEqual([
      ['loadGenomeFile', { filePath: '/tmp/ecoli.gbk' }],
      ['loadAnnotationFile', { filePath: '/tmp/features.bed' }],
    ]);
  });

  it('classifies aliases in FunctionCallsOrganizer', () => {
    const FunctionCallsOrganizer = loadBrowserClass(
      'src/renderer/modules/FunctionCallsOrganizer.js',
      'FunctionCallsOrganizer',
      { module: { exports: {} } }
    );

    const organizer = new FunctionCallsOrganizer({ app: {} });

    expect(organizer.getFunctionCategory('load_genome').name).toBe('dataRetrieval');
    expect(organizer.getFunctionCategory('load_bed_file').name).toBe('dataRetrieval');
  });

  it('registers canonical registry snapshot tools in FunctionCallsOrganizer', () => {
    const FunctionCallsOrganizer = loadBrowserClass(
      'src/renderer/modules/FunctionCallsOrganizer.js',
      'FunctionCallsOrganizer',
      { module: { exports: {} } }
    );

    const organizer = new FunctionCallsOrganizer({ app: {} });
    organizer.registerToolRegistrySnapshot({
      tools: [
        { name: 'custom_registry_tool', category: 'custom_category', source: 'user_registry' },
        { name: 'remote_blast_lookup', category: 'external_apis', source: 'app_registry' },
      ],
      builtInTools: [{ name: 'load_extra_track', category: 'file_loading', source: 'builtin_tools_map' }],
    });

    expect(organizer.getFunctionCategory('custom_registry_tool').name).toBe('registryDynamic');
    expect(organizer.getFunctionCategory('remote_blast_lookup').name).toBe('blastSearch');
    expect(organizer.getFunctionCategory('load_extra_track').name).toBe('dataRetrieval');
  });

  it('replaces stale registry tools when FunctionCallsOrganizer receives a new snapshot', () => {
    const FunctionCallsOrganizer = loadBrowserClass(
      'src/renderer/modules/FunctionCallsOrganizer.js',
      'FunctionCallsOrganizer',
      { module: { exports: {} } }
    );

    const organizer = new FunctionCallsOrganizer({ app: {} });
    organizer.registerToolRegistrySnapshot({
      tools: [{ name: 'temporary_registry_tool', category: 'custom_category', source: 'user_registry' }],
    });
    organizer.registerToolRegistrySnapshot({
      tools: [{ name: 'replacement_registry_tool', category: 'custom_category', source: 'user_registry' }],
    });

    expect(organizer.getFunctionCategory('temporary_registry_tool')).toBeNull();
    expect(organizer.getFunctionCategory('replacement_registry_tool').name).toBe('registryDynamic');
  });

  it('matches benchmark expected canonical tools with alias names', () => {
    const BenchmarkEvaluatorBase = loadBrowserClass(
      'src/renderer/modules/benchmark-suites/BenchmarkEvaluatorBase.js',
      'BenchmarkEvaluatorBase'
    );
    const evaluator = new BenchmarkEvaluatorBase();

    expect(evaluator.matchToolName('load_genome', 'load_genome_file')).toBe('alias');
    expect(evaluator.matchToolName('load_bed_file', 'load_annotation_file')).toBe('alias');
  });
});
