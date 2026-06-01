import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrimerManager = require(path.join(process.cwd(), 'src/renderer/modules/PrimerManager.js'));

describe('PrimerManager', () => {
  function createGenomeBrowser() {
    return {
      currentChromosome: 'chr1',
      currentSequence: {
        chr1: 'AAATGCGCTATCGGG',
      },
      currentAnnotations: {
        chr1: [],
      },
      fileManager: {
        currentFile: { path: '/tmp/example.gbk' },
      },
      visibleTracks: new Set(),
      getQualifierValue: (qualifiers, key) => qualifiers?.[key] || '',
      displayGenomeView: vi.fn(),
      sequenceUtils: {
        displayEnhancedSequence: vi.fn(),
      },
    };
  }

  function createSidecar() {
    const store = {};
    return {
      store,
      get: vi.fn(async (filePath, key) => store[key] || []),
      set: vi.fn(async (filePath, key, value) => {
        store[key] = value;
      }),
    };
  }

  it('stores primer oligos and binding sites in sidecar data', async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const primer = await manager.addPrimer({
      name: 'F-test',
      sequence: 'ATGCGCTATC',
      bindingSites: [{ chromosome: 'chr1', start: 3, end: 12, strand: '+' }],
    });

    expect(primer.sequence).toBe('ATGCGCTATC');
    expect(primer.bindingSites[0].bindingSequence).toBe('ATGCGCTATC');
    expect(sidecar.set).toHaveBeenCalledWith('/tmp/example.gbk', 'primers', expect.any(Array));
    expect(sidecar.store.primers[0].bindingSites[0].chromosome).toBe('chr1');
  });

  it('orients reverse binding sequences for comparison to primer sequence', async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const primer = await manager.addPrimer({
      name: 'R-test',
      sequence: 'GATAGCGCAT',
      bindingSites: [{ chromosome: 'chr1', start: 3, end: 12, strand: '-' }],
    });

    expect(primer.bindingSites[0].bindingSequence).toBe('GATAGCGCAT');
    expect(primer.bindingSites[0].mismatches).toEqual([]);
  });

  it('migrates legacy primer annotations without mutating annotations', async () => {
    const genomeBrowser = createGenomeBrowser();
    genomeBrowser.currentAnnotations.chr1 = [
      {
        id: 'legacy1',
        type: 'primer',
        start: 3,
        end: 12,
        strand: 1,
        qualifiers: { gene: 'legacy-primer', sequence: 'ATGCGCTATC' },
      },
    ];
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const migrated = await manager.migrateLegacyPrimerAnnotations({ persist: true });
    const renderables = manager.getRenderableBindingSites('chr1');

    expect(migrated).toBe(1);
    expect(renderables).toHaveLength(1);
    expect(renderables[0].name).toBe('legacy-primer');
    expect(genomeBrowser.currentAnnotations.chr1).toHaveLength(1);
  });
});
