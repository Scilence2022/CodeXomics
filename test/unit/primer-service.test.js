import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const PrimerDesigner = require('../../src/renderer/modules/PrimerDesigner.js');
const PrimerManager = require('../../src/renderer/modules/PrimerManager.js');
const browserGlobals = { PrimerDesigner };
const serviceSource = readFileSync('src/renderer/modules/chat/services/PrimerService.js', 'utf8');
new Function('window', serviceSource)(browserGlobals);
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
