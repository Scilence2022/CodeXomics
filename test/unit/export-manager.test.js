import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const EXPORT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ExportManager.js');

describe('ExportManager', () => {
  let ExportManager;
  let originalWindow;

  beforeEach(() => {
    originalWindow = global.window;
    global.window = global.window || {};
    ExportManager = require(EXPORT_MANAGER_PATH);
  });

  afterEach(() => {
    global.window = originalWindow;
    vi.restoreAllMocks();
  });

  it('exports Current View FASTA from the active browsing position', () => {
    const manager = new ExportManager({
      currentChromosome: 'chr1',
      currentSequence: {
        chr1: 'ACGTACGTACGT',
      },
      currentPosition: {
        start: 4,
        end: 8,
      },
    });
    const downloadSpy = vi.spyOn(manager, 'downloadFile').mockImplementation(() => {});

    manager.exportCurrentViewAsFasta();

    expect(downloadSpy).toHaveBeenCalledWith('>chr1:5-8\nACGT\n', 'chr1_5-8.fasta', 'text/plain');
  });
});
