import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import crypto from 'crypto';
import { createRequire } from 'module';

const FILE_MANAGER = path.join(process.cwd(), 'src/renderer/modules/FileManager.js');
const FILE_OPERATION_SERVICE = path.join(process.cwd(), 'src/renderer/modules/chat/services/FileOperationService.js');
const IPC_HANDLERS = path.join(process.cwd(), 'src/main/ipc-handlers.js');
const SIDECAR_STORAGE = path.join(process.cwd(), 'src/main/sidecar-storage.js');
const require = createRequire(import.meta.url);

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
    expect(source).toContain('this.autoWorkingDirectory = fileDir');
    expect(source).toContain(
      'this.genomeBrowser.updateStatus(`Working directory set to: $' + '{path.basename(this.autoWorkingDirectory)}`)'
    );
    expect(source).not.toContain('this.genomeBrowser.showNotification(`Working directory set to:');
    expect(source).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(source).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });

  it('replays the committed annotation overlay before rendering a parsed GenBank genome', () => {
    const source = fs.readFileSync(FILE_MANAGER, 'utf8');
    const pathBindIndex = source.indexOf(
      'this.genomeBrowser.loadedGenomePath = this.currentFile?.path || this.currentFile?.info?.path || null;'
    );
    const assignIndex = source.indexOf('this.genomeBrowser.currentAnnotations = annotations;');
    const replayIndex = source.indexOf('await annotationService.restoreCommittedAnnotationOverlay();');
    const renderIndex = source.indexOf('this.genomeBrowser.populateChromosomeSelect();', assignIndex);

    expect(pathBindIndex).toBeGreaterThan(-1);
    expect(assignIndex).toBeGreaterThan(pathBindIndex);
    expect(replayIndex).toBeGreaterThan(assignIndex);
    expect(renderIndex).toBeGreaterThan(replayIndex);
  });

  it('preserves GFF phase and common feature identifiers during parsing', () => {
    const source = fs.readFileSync(FILE_MANAGER, 'utf8');
    const parseStart = source.indexOf('async parseGFF(options = {})');
    const parseEnd = source.indexOf('async parseBED(options = {})', parseStart);
    const parseSource = source.slice(parseStart, parseEnd);

    expect(parseSource).toContain('const [seqname, source, feature, start, end, score, strand, phase, attribute]');
    expect(parseSource).toContain("phase: phase === '.' ? null : Number.parseInt(phase, 10)");
    expect(parseSource).toContain('qualifiers.ID || qualifiers.gene_id || qualifiers.transcript_id');
  });

  it('decodes GFF3 percent-escaped identifiers as UTF-8', async () => {
    const FileManager = require('../../src/renderer/modules/FileManager.js');
    const genomeBrowser = {
      currentSequence: null,
      updateStatus() {},
    };
    const manager = new FileManager(genomeBrowser);
    let parsedAnnotations = null;
    manager.createNewAnnotationTrack = annotations => {
      parsedAnnotations = annotations;
    };
    manager.currentFile = {
      data: 'chr1\tRefSeq\tgene\t1\t10\t.\t+\t.\tID=gene-1;Name=%CE%B1-factor',
      info: { name: 'unicode.gff3' },
    };
    const chromosomeSelect = document.createElement('select');
    chromosomeSelect.id = 'chromosomeSelect';
    document.body.appendChild(chromosomeSelect);

    try {
      await manager.parseGFF({ mergeWithExisting: false });
    } finally {
      chromosomeSelect.remove();
    }

    expect(parsedAnnotations.chr1[0].name).toBe('α-factor');
    expect(parsedAnnotations.chr1[0].qualifiers.Name).toBe('α-factor');
  });

  it('flushes sidecar data to a temporary file before atomically replacing the ledger', () => {
    const source = fs.readFileSync(IPC_HANDLERS, 'utf8');
    const helperStart = source.indexOf('const writeFileAtomically = async');
    const helperEnd = source.indexOf('const sanitizeScreenshotFormat', helperStart);
    const helperSource = source.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(-1);
    expect(helperSource).toContain("fs.promises.open(tempPath, 'wx', 0o600)");
    expect(helperSource).toContain('await handle.sync()');
    expect(helperSource).toContain('await fs.promises.rename(tempPath, destinationPath)');
    expect(helperSource).toContain("fs.promises.open(path.dirname(destinationPath), 'r')");
    expect(helperSource).toContain('await directoryHandle.sync()');
    expect(source).toContain('await writeFileAtomically(sidecarPath, content)');
    expect(source).toContain('await writeFileAtomically(fallbackPath, content)');
  });

  it('selects the newest valid sidecar and rejects stale cross-window writes with storage CAS', () => {
    const source = fs.readFileSync(IPC_HANDLERS, 'utf8');
    const candidateStart = source.indexOf('const readNewestSidecarCandidate = async');
    const candidateEnd = source.indexOf('const sanitizeScreenshotFormat', candidateStart);
    const candidateSource = source.slice(candidateStart, candidateEnd);

    expect(candidateSource).toContain('All existing sidecar candidates are corrupt');
    expect(candidateSource).toContain('right.storageRevision - left.storageRevision');
    expect(candidateSource).toContain('stats.mtimeMs || 0');
    expect(candidateSource).not.toContain('Date.parse(data.lastModified)');
    expect(candidateSource.indexOf('assertSidecarValueSize(data)')).toBeGreaterThan(
      candidateSource.indexOf('JSON.parse(content)')
    );
    expect(source).toContain("code: 'SIDECAR_CONFLICT'");
    expect(source).toContain('expectedRevision !== currentRevision');
    expect(source).toContain('withSidecarWriteLock(safeGenomePath');
  });

  it('isolates fallback sidecars with SHA-256 and treats the legacy hash only as a migration candidate', () => {
    const source = fs.readFileSync(IPC_HANDLERS, 'utf8');
    const storageSource = fs.readFileSync(SIDECAR_STORAGE, 'utf8');
    const legacyHash = value => {
      let hash = 0;
      for (const character of value) {
        hash = (hash << 5) - hash + character.charCodeAt(0);
        hash |= 0;
      }
      return Math.abs(hash).toString(16);
    };
    const firstPath = '/tmp/Aa.gbk';
    const secondPath = '/tmp/BB.gbk';

    expect(legacyHash(firstPath)).toBe(legacyHash(secondPath));
    expect(crypto.createHash('sha256').update(firstPath).digest('hex')).not.toBe(
      crypto.createHash('sha256').update(secondPath).digest('hex')
    );
    expect(storageSource).toMatch(/crypto\s*\.createHash\('sha256'\)/);
    expect(source).toContain('buildFallbackPaths(');
    expect(source).toContain('[sidecarPath, fallbackPath, ...legacyFallbackPaths]');
    expect(source).toContain('if (selected.isLegacy)');
    expect(source).toContain('_sourceGenomePathSha256: sourcePathHash');
    expect(storageSource).toContain('fallback sidecar has no verifiable genome-path binding');
    expect(source).toContain('assertSidecarContentSize(migratedContent)');
    expect(source).toContain('await writeFileAtomically(fallbackPath, migratedContent)');
    expect(source).toContain('assertSidecarContentSize(stats.size)');
    expect(source).toContain('assertSidecarContentSize(content)');
    expect(source).not.toContain('writeFileAtomically(legacyFallbackPath');
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
