import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const FileManager = require('../../src/renderer/modules/FileManager.js');
const ReadsManager = require('../../src/renderer/modules/ReadsManager.js');
require('../../src/renderer/modules/chat/services/FileOperationService.js');

function createImportFixture(ipc) {
  vi.stubGlobal('ipcRenderer', {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(ipc),
  });
  const browser = {
    loadedGenomePath: '/previous.gbk',
    loadedGenomeSourceSha256: 'old-digest',
    currentSequence: { previous: 'ACGT' },
    currentAnnotations: { previous: [{ type: 'gene' }] },
    loadedOperons: [{ name: 'operon' }],
    showLoading: vi.fn(),
    showNotification: vi.fn(),
    updateStatus: vi.fn(),
    populateChromosomeSelect: vi.fn(),
  };
  const manager = new FileManager(browser);
  manager.currentFile = { path: browser.loadedGenomePath };
  browser.fileManager = manager;
  const service = new window.FileOperationService({ app: browser });
  service.app = browser;
  service.validateFilePath = vi.fn();
  return { browser, manager, service };
}

describe('file import outcomes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a read failure to ChatBox and keeps the prior source and operons', async () => {
    const { browser, manager, service } = createImportFixture(async channel => {
      if (channel === 'get-file-info') {
        return { success: true, info: { name: 'new.gbk', extension: '.gbk', size: 100 } };
      }
      throw new Error('File disappeared');
    });

    await expect(service.loadGenomeFile({ filePath: '/new.gbk' })).resolves.toMatchObject({
      success: false,
      error: 'File disappeared',
    });
    expect(manager.currentFile.path).toBe('/previous.gbk');
    expect(browser.loadedOperons).toEqual([{ name: 'operon' }]);
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('file-read-progress', expect.any(Function));
  });

  it('rejects a second import during overlay verification and restores the previous genome on failure', async () => {
    let rejectOverlay;
    let startedOverlay;
    const pendingOverlay = new Promise((_, reject) => {
      rejectOverlay = reject;
    });
    const enteredOverlay = new Promise(resolve => {
      startedOverlay = resolve;
    });
    const { browser, manager } = createImportFixture(async channel => {
      if (channel === 'get-file-info') {
        return { success: true, info: { name: 'new.gbk', extension: '.gbk', size: 100 } };
      }
      return {
        success: true,
        data: 'LOCUS       new 4 bp DNA linear\nORIGIN\n        1 tgca\n//\n',
        sourceSha256: 'new-digest',
      };
    });
    browser.chatManager = {
      services: {
        annotation: {
          restoreCommittedAnnotationOverlay() {
            startedOverlay();
            return pendingOverlay;
          },
        },
      },
    };
    const first = manager.loadFile('/new.gbk', { reportErrors: false });
    await enteredOverlay;
    await expect(manager.loadFile('/other.gbk', { reportErrors: false })).resolves.toMatchObject({ status: 'busy' });
    rejectOverlay(new Error('Cannot restore overlay'));
    await expect(first).resolves.toMatchObject({ success: false, error: 'Cannot restore overlay' });
    expect(manager.currentFile.path).toBe('/previous.gbk');
    expect(browser.currentSequence).toEqual({ previous: 'ACGT' });
    expect(browser.loadedGenomePath).toBe('/previous.gbk');
    expect(browser.loadedGenomeSourceSha256).toBe('old-digest');
    expect(browser.populateChromosomeSelect).not.toHaveBeenCalled();
  });

  it('keeps the previous workspace when a GenBank import is cancelled during overlay replay', async () => {
    const controller = new AbortController();
    const { browser, manager, service } = createImportFixture(async channel =>
      channel === 'get-file-info'
        ? { success: true, info: { name: 'new.gbk', extension: '.gbk', size: 100 } }
        : {
            success: true,
            data: 'LOCUS       new 4 bp DNA linear\nORIGIN\n        1 tgca\n//\n',
            sourceSha256: 'new-digest',
          }
    );
    browser.chatManager = {
      services: {
        annotation: {
          async restoreCommittedAnnotationOverlay(beforePublish) {
            expect(browser.loadedGenomePath).toBe('/new.gbk');
            controller.abort(new Error('MCP request cancelled'));
            expect(beforePublish).toThrow('MCP request cancelled');
          },
        },
      },
    };

    await expect(
      service.loadGenomeFile({ filePath: '/new.gbk', __executionContext: { signal: controller.signal } })
    ).resolves.toMatchObject({ success: false, status: 'cancelled', error: 'MCP request cancelled' });
    expect(manager.currentFile.path).toBe('/previous.gbk');
    expect(browser.loadedGenomePath).toBe('/previous.gbk');
    expect(browser.loadedGenomeSourceSha256).toBe('old-digest');
    expect(browser.currentSequence).toEqual({ previous: 'ACGT' });
    expect(browser.populateChromosomeSelect).not.toHaveBeenCalled();
  });

  it('does not publish a FASTA genome whose request deadline elapsed during the file read', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(100);
    try {
      const { browser, service } = createImportFixture(async channel => {
        if (channel === 'get-file-info') {
          return { success: true, info: { name: 'new.fa', extension: '.fa', size: 12 } };
        }
        now.mockReturnValue(200);
        return { success: true, data: '>new\r\nACGT', sourceSha256: 'new-digest' };
      });

      await expect(
        service.loadGenomeFile({ filePath: '/new.fa', __executionContext: { requestDeadline: 200 } })
      ).resolves.toMatchObject({ success: false, status: 'cancelled', error: expect.stringContaining('deadline') });
      expect(browser.loadedGenomePath).toBe('/previous.gbk');
      expect(browser.currentSequence).toEqual({ previous: 'ACGT' });
      expect(browser.populateChromosomeSelect).not.toHaveBeenCalled();
      expect(ipcRenderer.removeListener).toHaveBeenCalledWith('file-read-progress', expect.any(Function));
    } finally {
      now.mockRestore();
    }
  });

  it('imports all FASTA records with CRLF and a final line without a newline', async () => {
    const { browser, manager } = createImportFixture(async () => {});
    manager.currentFile = { path: '/new.fa', data: '>first label\r\nac\r\ngt\r\n>last\r\ntgca' };
    browser.selectChromosome = vi.fn();
    manager.updateLoadedFilesList = vi.fn();

    await manager.parseFasta();
    expect(browser.currentSequence).toEqual({ first: 'ACGT', last: 'TGCA' });
    expect(browser.selectChromosome).toHaveBeenCalledWith('first');
  });

  it('reports malformed operon data and honors an explicit format for files with another extension', async () => {
    let data = '{bad json';
    const { browser, service } = createImportFixture(async channel =>
      channel === 'get-file-info'
        ? { success: true, info: { name: 'regulon.txt', extension: '.txt' } }
        : { success: true, data }
    );
    const parameters = { filePath: '/regulon.txt', format: 'json' };

    await expect(service.loadOperonFile(parameters)).resolves.toMatchObject({
      success: false,
      status: 'failed',
      error: expect.stringContaining('JSON parsing error'),
    });
    expect(browser.loadedOperons).toEqual([{ name: 'operon' }]);
    expect(browser.showNotification).not.toHaveBeenCalled();

    data = '[{"name":"new-operon","start":1,"end":5}]';
    await expect(service.loadOperonFile(parameters)).resolves.toMatchObject({
      success: true,
      status: 'loaded',
      count: 1,
      format: 'json',
    });
    expect(browser.loadedOperons).toMatchObject([{ name: 'new-operon', start: 1, end: 5 }]);
  });

  it('does not publish operons when the calling request is cancelled while reading', async () => {
    const controller = new AbortController();
    const { browser, manager, service } = createImportFixture(async channel => {
      if (channel === 'get-file-info') return { success: true, info: { extension: '.json', name: 'operons.json' } };
      controller.abort(new Error('MCP request cancelled'));
      return { success: true, data: '[{"name":"too-late"}]' };
    });

    await expect(
      service.loadOperonFile({ filePath: '/operons.json', __executionContext: { signal: controller.signal } })
    ).resolves.toMatchObject({ success: false, status: 'cancelled', error: 'MCP request cancelled' });
    expect(browser.loadedOperons).toEqual([{ name: 'operon' }]);
    expect(manager.isLoadingFile).toBe(false);
  });

  it('applies display sampling on each read-cache hit and separates filter settings', async () => {
    const reads = Array.from({ length: 1200 }, (_, i) => ({ id: i, start: 1, end: 5 }));
    const manager = new ReadsManager({});
    manager.rawReadsData = 'fixture';
    manager.loadReadsForRegion = vi.fn(async () => reads);
    const sampled = await manager.getReadsForRegion('chr', 0, 10, { enableSampling: true, samplingThreshold: 1000 });
    const full = await manager.getReadsForRegion('chr', 0, 10, { enableSampling: false });
    expect(sampled).toHaveLength(240);
    expect(full).toHaveLength(1200);
    expect(manager.loadReadsForRegion).toHaveBeenCalledTimes(1);
    await manager.getReadsForRegion('chr', 0, 10, { ignoreChromosome: true });
    expect(manager.loadReadsForRegion).toHaveBeenCalledTimes(2);
  });
});
