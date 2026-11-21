import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const PrimerDesigner = require('../../src/renderer/modules/PrimerDesigner.js');
const PrimerManager = require('../../src/renderer/modules/PrimerManager.js');
const browserGlobals = { PrimerDesigner };
const serviceSource = readFileSync('src/renderer/modules/chat/services/PrimerService.js', 'utf8');
runInNewContext(serviceSource, { window: browserGlobals, document });
const { PrimerService } = browserGlobals;

function setup(strand = '+') {
  const chromosome = 'chr-test';
  const geneStart = 401;
  const codingSequence = Array.from(createHash('sha512').update('primer service test template').digest(), byte =>
    [6, 4, 2, 0].map(shift => 'ACGT'[(byte >> shift) & 3]).join('')
  ).join('');
  const geneEnd = geneStart + codingSequence.length - 1;
  const genomicSequence = strand === '-' ? PrimerDesigner.reverseComplement(codingSequence) : codingSequence;
  const app = {
    currentChromosome: chromosome,
    currentSequence: { [chromosome]: 'A'.repeat(geneStart - 1) + genomicSequence + 'A'.repeat(100) },
    visibleTracks: new Set(),
  };
  const persistence = { get: vi.fn(), set: vi.fn() };
  app.primerManager = new PrimerManager(app, persistence);
  const chat = {
    MicrobeFns: {
      getCodingSequence: vi.fn(() => ({ chromosome, start: geneStart, end: geneEnd, strand, codingSequence })),
    },
    getSequence: vi.fn(async ({ chromosome, start, end }) => ({
      chromosome,
      start,
      end,
      sequence: app.currentSequence[chromosome].slice(start - 1, end),
    })),
  };
  return { chromosome, geneStart, geneEnd, app, persistence, service: new PrimerService(app, chat) };
}

describe('ChatBox primer design and saving', () => {
  it.each(['+', '-'])(
    'saves both gene-designed primers on their genomic strands for a %s strand gene',
    async strand => {
      const { chromosome, geneStart, geneEnd, app, persistence, service } = setup(strand);
      const pair = await service.designPrimers({ geneName: 'example' });

      expect(pair.target).toMatchObject({ chromosome, geneStart, geneEnd, geneStrand: strand });
      expect(pair.forward.strand).toBe(strand);
      expect(pair.reverse.strand).toBe(strand === '+' ? '-' : '+');
      for (const [name, primer] of Object.entries({ forward: pair.forward, reverse: pair.reverse })) {
        expect(primer.genomicStart).toBeGreaterThanOrEqual(geneStart);
        expect(primer.genomicEnd).toBeLessThanOrEqual(geneEnd);
        const saved = await service.savePrimer({
          chromosome: pair.target.chromosome,
          name,
          start: primer.genomicStart,
          end: primer.genomicEnd,
          strand: primer.strand,
          sequence: primer.sequence,
        });
        expect(saved.primer.pinnedSites).toEqual([
          expect.objectContaining({ strand: primer.strand, bindingSequence: primer.sequence, mismatches: [] }),
        ]);
      }
      expect(app.visibleTracks.has('primers')).toBe(true);
      expect(persistence.set).toHaveBeenLastCalledWith(
        'primers.data',
        expect.arrayContaining([
          expect.objectContaining({ name: 'forward' }),
          expect.objectContaining({ name: 'reverse' }),
        ])
      );
    }
  );

  it('preserves genomic offsets across ambiguous bases in a coordinate-based design', async () => {
    const { chromosome, geneStart, geneEnd, app, service } = setup();
    const original = app.currentSequence[chromosome];
    const ambiguousOffset = geneStart + 120;
    const template = original.slice(0, ambiguousOffset) + 'NNNNN' + original.slice(ambiguousOffset + 5);
    app.currentSequence[chromosome] = template;
    const pair = await service.designPrimers({ chromosome, start: geneStart, end: geneEnd });

    expect(pair.target.chromosome).toBe(chromosome);
    expect(pair.reverse.genomicStart).toBeGreaterThan(ambiguousOffset + 5);
    const reverseSite = template.slice(pair.reverse.genomicStart - 1, pair.reverse.genomicEnd);
    expect(PrimerDesigner.reverseComplement(reverseSite)).toBe(pair.reverse.sequence);
  });

  it('reports a coordinate error before saving a template offset of zero', async () => {
    const { chromosome, persistence, service } = setup();
    await expect(service.savePrimer({ chromosome, name: 'forward', start: 0, end: 21 })).rejects.toThrow(
      'use genomicStart and genomicEnd'
    );
    expect(persistence.set).not.toHaveBeenCalled();
  });
});

describe('ChatBox primer listing', () => {
  it('lists the same saved primers as the library, grouping sites by primer ID', async () => {
    const { app, chromosome, service } = setup();
    const manager = app.primerManager;
    const pinned = { chromosome, start: 10, end: 29, strand: '+' };
    const placed = await manager.addPrimer({ name: 'Example', sequence: 'A'.repeat(20), pinnedSites: [pinned] });
    const unplaced = await manager.addPrimer({ name: 'Example', sequence: 'C'.repeat(20) }, { mergeDuplicates: false });
    const predictedOnly = await manager.addPrimer({ name: 'Predicted only', sequence: 'G'.repeat(20) });
    const cachedSites = new Map([
      [
        placed.id,
        [
          { id: 'same-as-pinned', ...pinned },
          { id: 'another-site', ...pinned, start: 50, end: 69 },
        ],
      ],
      [predictedOnly.id, [{ id: 'prediction', ...pinned, start: 70, end: 89 }]],
    ]);
    const getCachedSites = id => cachedSites.get(id) || [];
    manager.setBindingService({ getCachedSites, predictForViewport: primer => getCachedSites(primer.id) });

    // The old unscoped listing called this with null and only saw the pinned site.
    expect(manager.getRenderableBindingSites(null)).toHaveLength(1);
    const result = await service.listPrimers();

    expect(result).toMatchObject({ success: true, chromosome, count: 3 });
    expect(result.primers.map(primer => primer.id)).toEqual(manager.listPrimers().map(primer => primer.id));
    expect(result.primers[0]).toMatchObject({
      id: placed.id,
      bindingSiteCount: 2,
      predictionsCached: true,
      bindingSites: [
        { chromosome, start: 10, end: 29, origin: 'pinned' },
        { chromosome, start: 50, end: 69, origin: 'predicted' },
      ],
    });
    expect(result.primers[1]).toMatchObject({
      id: unplaced.id,
      bindingSiteCount: 0,
      bindingSites: [],
      predictionsCached: true,
    });
    expect(result.primers[2]).toMatchObject({
      id: predictedOnly.id,
      bindingSiteCount: 1,
      bindingSites: [{ start: 70, end: 89, origin: 'predicted' }],
    });
  });

  it('scopes sites to the selected chromosome and filters primers by interval overlap', async () => {
    const { app, chromosome, service } = setup();
    const pinnedSites = [
      { chromosome, start: 10, end: 29, strand: '+' },
      { chromosome, start: 40, end: 59, strand: '+' },
      { chromosome: 'other', start: 1, end: 20, strand: '-' },
    ];
    const placed = await app.primerManager.addPrimer({ name: 'Placed', sequence: 'A'.repeat(20), pinnedSites });
    await app.primerManager.addPrimer({ name: 'Unplaced', sequence: 'C'.repeat(20) });
    app.primerManager.setBindingService({ getCachedSites: () => null, predictForViewport: () => [] });

    const scoped = await service.listPrimers({ chromosome: 'other' });
    expect(scoped.count).toBe(2);
    expect(scoped.primers[0]).toMatchObject({
      bindingSiteCount: 1,
      bindingSites: [{ chromosome: 'other' }],
      predictionsCached: false,
    });

    const regional = await service.listPrimerAnnotations({ start: 29, end: 35 });
    expect(regional).toMatchObject({
      chromosome,
      count: 1,
      primers: [{ id: placed.id, bindingSiteCount: 1, bindingSites: [{ start: 10, end: 29 }] }],
    });
  });
});
