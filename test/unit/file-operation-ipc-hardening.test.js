import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const FILE_MANAGER = path.join(process.cwd(), 'src/renderer/modules/FileManager.js');
const FILE_OPERATION_SERVICE = path.join(process.cwd(), 'src/renderer/modules/chat/services/FileOperationService.js');

function loadFileOperationService(electronAPI) {
  const sandbox = {
    window: { electronAPI },
    console,
    process,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8'), sandbox);
  return sandbox.window.FileOperationService;
}

describe('file operation IPC hardening', () => {
  it('does not use renderer fs/path require in FileManager load notifications', () => {
    const source = fs.readFileSync(FILE_MANAGER, 'utf8');

    expect(source).toContain('getPathModule()');
    expect(source).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(source).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });

  it('exports files through preload writeFile instead of renderer fs fallback', () => {
    const source = fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8');
    const methodStart = source.indexOf('async writeFileDirectly');
    const methodEnd = source.indexOf('\n  getCurrentWorkingDirectory()', methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(source).toContain('getPathModule()');
    expect(methodSource).toContain('electronAPI?.writeFile');
    expect(methodSource).toContain('electronAPI.writeFile is unavailable in the hardened renderer');
    expect(methodSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(methodSource).not.toMatch(/\brequire\(['"]path['"]\)/);
  });

  it('validates explicit file paths through preload file info in the renderer', () => {
    const source = fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8');
    const methodStart = source.indexOf('async validateFilePath');
    const methodEnd = source.indexOf('// 1. FILE LOADING OPERATIONS', methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(methodSource).toContain('window.electronAPI?.authorizeFileLoad');
    expect(methodSource).toContain('window.electronAPI?.getSelectedFileInfo');
    expect(methodSource).toContain('Read-only file-load authorization is unavailable');
    expect(methodSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });

  it('authorizes every direct-path load tool through the shared read-only boundary', () => {
    const source = fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8');
    const expectedCalls = [
      "this.validateFilePath(filePath, 'Genome file', 'load_genome_file')",
      "this.validateFilePath(filePath, 'Annotation file', 'load_annotation_file')",
      "this.validateFilePath(filePath, 'Variant file', 'load_variant_file')",
      "this.validateFilePath(filePath, 'Reads file', 'load_reads_file')",
      "this.validateFilePath(wigPath, 'WIG track file', 'load_wig_tracks')",
      "this.validateFilePath(filePath, 'Operon file', 'load_operon_file')",
    ];

    expectedCalls.forEach(call => expect(source).toContain(call));
  });

  it('requests read-only authorization before executing every direct-path load', async () => {
    const authorizationCalls = [];
    const electronAPI = {
      async authorizeFileLoad(filePath, toolName) {
        authorizationCalls.push([filePath, toolName]);
        return { success: true, filePath };
      },
      async getSelectedFileInfo(filePath) {
        return {
          success: true,
          info: { path: filePath, isDirectory: false },
        };
      },
    };
    const fileManager = {
      async loadFile() {},
      async loadMultipleWIGFiles() {},
      async loadOperonFile() {},
    };
    const FileOperationService = loadFileOperationService(electronAPI);
    const service = new FileOperationService({ fileManager }, {});

    await service.loadGenomeFile({ filePath: '/outside/genome.fa' });
    await service.loadAnnotationFile({ filePath: '/outside/annotation.gff' });
    await service.loadVariantFile({ filePath: '/outside/variants.vcf' });
    await service.loadReadsFile({ filePath: '/outside/reads.bam' });
    await service.loadWigTracks({ filePaths: ['/outside/a.wig', '/outside/b.wig'] });
    await service.loadOperonFile({ filePath: '/outside/operons.tsv' });

    expect(authorizationCalls).toEqual([
      ['/outside/genome.fa', 'load_genome_file'],
      ['/outside/annotation.gff', 'load_annotation_file'],
      ['/outside/variants.vcf', 'load_variant_file'],
      ['/outside/reads.bam', 'load_reads_file'],
      ['/outside/a.wig', 'load_wig_tracks'],
      ['/outside/b.wig', 'load_wig_tracks'],
      ['/outside/operons.tsv', 'load_operon_file'],
    ]);
  });
});
