import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrimerBindingService = require(path.join(process.cwd(), 'src/renderer/modules/PrimerBindingService.js'));
const PrimerManager = require(path.join(process.cwd(), 'src/renderer/modules/PrimerManager.js'));

// Perfect match for primer 'ATGCGCTATC' begins at 0-based index 4 -> 1-based 5..14
const TEMPLATE = 'TTTTATGCGCTATCGGGGCCCCAAAATTTT';
const PRIMER_SEQ = 'ATGCGCTATC';

function createGenomeBrowser(sequence = TEMPLATE) {
  return {
    currentChromosome: 'chr1',
    currentSequence: { chr1: sequence },
    currentAnnotations: { chr1: [] },
    fileManager: { currentFile: { path: '/tmp/example.gbk' } },
    visibleTracks: new Set(),
    getQualifierValue: (qualifiers, key) => qualifiers?.[key] || '',
    displayGenomeView: vi.fn(),
    sequenceUtils: { displayEnhancedSequence: vi.fn() },
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

describe('PrimerBindingService', () => {
  it('predicts binding sites in 1-based inclusive genome coordinates (sync preview)', () => {
    const gb = createGenomeBrowser();
    const svc = new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 0 } });
    const sites = svc.predictForViewport({ id: 'p1', sequence: PRIMER_SEQ }, 'chr1', {
      start: 1,
      end: TEMPLATE.length,
    });

    const forward = sites.find(s => s.strand === '+');
    expect(forward).toBeTruthy();
    expect(forward.start).toBe(5);
    expect(forward.end).toBe(14);
    expect(forward.bindingSequence).toBe(PRIMER_SEQ);
    expect(forward.mismatches).toHaveLength(0);
    expect(forward.origin).toBe('predicted');
  });

  it('caches a full-chromosome scan and summarizes off-targets', async () => {
    const gb = createGenomeBrowser();
    const svc = new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 0 } });
    const primer = { id: 'p1', sequence: PRIMER_SEQ };

    expect(svc.getCachedSites('p1', 'chr1')).toBeNull();
    const sites = await svc.ensureSites(primer, 'chr1');
    expect(sites.length).toBeGreaterThan(0);
    expect(svc.getCachedSites('p1', 'chr1')).not.toBeNull();

    const summary = svc.getOffTargetSummary(primer, 'chr1');
    expect(summary.perfect).toBe(1);
    expect(summary.total).toBe(1);
  });

  it('reports reverse-strand mismatch bases consistently with the binding sequence', () => {
    // primer ATGCGCTATC binds the '-' strand where the forward template reads
    // revcomp(primer)=GATAGCGCAT. One base changed (…CAA) creates a single mismatch.
    const primer = 'ATGCGCTATC';
    const gb = createGenomeBrowser('TTTTTGATAGCGCAATTTTT');
    const svc = new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 2 } });
    const sites = svc.predictForViewport({ id: 'p1', sequence: primer }, 'chr1', { start: 1, end: 20 });

    const rev = sites.find(s => s.strand === '-' && s.mismatches.length > 0);
    expect(rev).toBeTruthy();
    expect(rev.bindingSequence).toBe('TTGCGCTATC');
    rev.mismatches.forEach(mm => {
      // primer base and genome base come from the same primer-aligned index, and differ
      expect(primer[mm.primerIndex]).toBe(mm.primerBase);
      expect(rev.bindingSequence[mm.primerIndex]).toBe(mm.genomeBase);
      expect(mm.primerBase).not.toBe(mm.genomeBase);
    });
  });

  it('invalidates the cache on demand', async () => {
    const gb = createGenomeBrowser();
    const svc = new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 0 } });
    await svc.ensureSites({ id: 'p1', sequence: PRIMER_SEQ }, 'chr1');
    expect(svc.getCachedSites('p1', 'chr1')).not.toBeNull();

    svc.invalidate();
    expect(svc.getCachedSites('p1', 'chr1')).toBeNull();
  });
});

describe('PrimerManager + real-time prediction', () => {
  it('renders predicted sites for an identity-only oligo', async () => {
    const gb = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(gb, null, sidecar);
    await manager.loadPrimers();
    manager.setBindingService(new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 0 } }));

    const primer = await manager.addPrimer({ name: 'F-test', sequence: PRIMER_SEQ });
    expect(primer.pinnedSites).toHaveLength(0); // identity only — no stored placement

    await manager.bindingService.ensureSites(primer, 'chr1');
    const renderables = manager.getRenderableBindingSites('chr1', { start: 1, end: TEMPLATE.length });

    expect(renderables).toHaveLength(1);
    expect(renderables[0].origin).toBe('predicted');
    expect(renderables[0].start).toBe(5);
    expect(renderables[0].strand).toBe('+');
  });

  it('deduplicates a predicted site that coincides with a pinned site (pinned wins)', async () => {
    const gb = createGenomeBrowser();
    const sidecar = createSidecar();
    const manager = new PrimerManager(gb, null, sidecar);
    await manager.loadPrimers();
    manager.setBindingService(new PrimerBindingService(gb, { useWorker: false, stringency: { maxMismatches: 0 } }));

    const primer = await manager.addPrimer({
      name: 'F-pinned',
      sequence: PRIMER_SEQ,
      bindingSites: [{ chromosome: 'chr1', start: 5, end: 14, strand: '+' }],
    });
    await manager.bindingService.ensureSites(primer, 'chr1');

    const renderables = manager.getRenderableBindingSites('chr1', { start: 1, end: TEMPLATE.length });
    expect(renderables).toHaveLength(1);
    expect(renderables[0].origin).toBe('pinned');
  });
});
