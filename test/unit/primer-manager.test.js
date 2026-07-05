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
    expect(primer.pinnedSites[0].bindingSequence).toBe('ATGCGCTATC');
    expect(sidecar.set).toHaveBeenCalledWith('/tmp/example.gbk', 'primers', expect.any(Array));
    expect(sidecar.store.primers[0].pinnedSites[0].chromosome).toBe('chr1');
  });

  it("persists color and 5' phosphorylation through add and update", async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const primer = await manager.addPrimer({
      name: 'P1',
      sequence: 'ATGCGCTATC',
      color: '#123456',
      fivePrimePhosphate: true,
    });
    expect(primer.color).toBe('#123456');
    expect(primer.fivePrimePhosphate).toBe(true);
    expect(manager.listPrimers()[0].fivePrimePhosphate).toBe(true);

    await manager.updatePrimer(primer.id, { fivePrimePhosphate: false, color: '#abcdef' });
    const updated = manager.getPrimer(primer.id);
    expect(updated.fivePrimePhosphate).toBe(false);
    expect(updated.color).toBe('#abcdef');
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

    expect(primer.pinnedSites[0].bindingSequence).toBe('GATAGCGCAT');
    expect(primer.pinnedSites[0].mismatches).toEqual([]);
  });

  it('imports and exports oligos via CSV (round-trip)', async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const csv =
      'name,sequence,fivePrimeTail,fivePrimePhosphate,tags,notes\nF1,ATGCGCTATC,,true,cloning|qPCR,first primer\nR1,GATAGCGCAT,,false,,second';
    const imported = await manager.importFromCSV(csv);
    expect(imported).toBe(2);
    expect(manager.primers.size).toBe(2);
    expect(manager.listPrimers().find(primer => primer.name === 'F1')?.fivePrimePhosphate).toBe(true);

    const exported = manager.exportToCSV();
    expect(exported).toContain('fivePrimePhosphate');
    expect(exported).toContain('F1');
    expect(exported).toContain('ATGCGCTATC');
    expect(exported).toContain('true');
    expect(exported).toContain('cloning|qPCR');
  });

  it('imports oligos from FASTA', async () => {
    const genomeBrowser = createGenomeBrowser();
    const manager = new PrimerManager(genomeBrowser, null, createSidecar());
    await manager.loadPrimers();

    const fasta = '>primerA description here\nATGCGCTATC\n>primerB\nGATAGCGCAT';
    const imported = await manager.importFromFasta(fasta);
    expect(imported).toBe(2);
    const names = manager.listPrimers().map(p => p.name);
    expect(names).toContain('primerA');
    expect(names).toContain('primerB');
  });

  it('creates and persists primer pairs, removing them when an oligo is deleted', async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const fwd = await manager.addPrimer({ name: 'F', sequence: 'ATGCGCTATC' });
    const rev = await manager.addPrimer({ name: 'R', sequence: 'GATAGCGCAT' });
    const pair = await manager.addPair({ name: 'amp1', forwardId: fwd.id, reverseId: rev.id });

    expect(manager.getPairForPrimer(fwd.id)?.id).toBe(pair.id);
    expect(sidecar.store.primerPairs).toHaveLength(1);

    await manager.removePrimer(fwd.id);
    expect(manager.listPairs()).toHaveLength(0); // pair removed with its primer
  });

  it('migrates legacy primer annotations and strips them from the genome', async () => {
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
      {
        id: 'gene1',
        type: 'gene',
        start: 1,
        end: 15,
        strand: 1,
        qualifiers: { gene: 'realGene' },
      },
    ];
    genomeBrowser.userDefinedFeatures = { chr1: [...genomeBrowser.currentAnnotations.chr1] };
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    const migrated = await manager.migrateLegacyPrimerAnnotations({ persist: true });
    const renderables = manager.getRenderableBindingSites('chr1');

    expect(migrated).toBe(1);
    expect(renderables).toHaveLength(1);
    expect(renderables[0].name).toBe('legacy-primer');
    // Primer feature is removed from the genome annotations (no GBK leak),
    // but real genes are left untouched.
    expect(genomeBrowser.currentAnnotations.chr1).toHaveLength(1);
    expect(genomeBrowser.currentAnnotations.chr1[0].type).toBe('gene');
    expect(genomeBrowser.userDefinedFeatures.chr1.some(f => f.type === 'primer')).toBe(false);
  });

  it("passes 5' phosphorylation through renderable primer binding sites", async () => {
    const genomeBrowser = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(genomeBrowser, null, sidecar);
    await manager.loadPrimers();

    await manager.addPrimer({
      name: 'P1',
      sequence: 'ATGCGCTATC',
      fivePrimePhosphate: true,
      bindingSites: [{ chromosome: 'chr1', start: 3, end: 12, strand: '+' }],
    });

    const [renderable] = manager.getRenderableBindingSites('chr1');
    expect(renderable.fivePrimePhosphate).toBe(true);
    expect(renderable.qualifiers.five_prime_phosphate).toBe(true);
  });
});
