import { describe, it, expect } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: BlastManager } = loadScript('src/renderer/modules/BlastManager.js');
const manager = app => Object.assign(Object.create(BlastManager.prototype), { app });
describe('BLAST query source integrity', () => {
  it('rejects missing providers', async () => {
    await expect(manager({}).getSequenceFromRegion('chr', 1, 10)).rejects.toThrow('provider unavailable');
  });
  it('uses loaded sequence and requested coordinates', async () => {
    const calls = [];
    const m = manager({
      chatManager: {
        getSequence: async params => {
          calls.push(params);
          return { sequence: 'ARYN' };
        },
      },
    });
    expect(await m.getSequenceFromRegion('chr', 5, 8)).toBe('ARYN');
    expect(calls).toEqual([{ chromosome: 'chr', start: 5, end: 8 }]);
  });
  it.each([{ success: false, error: 'Genome unavailable' }, {}, { sequence: '' }])(
    'rejects unavailable regions',
    async result => {
      await expect(
        manager({ chatManager: { getSequence: async () => result } }).getSequenceFromRegion('chr', 1, 10)
      ).rejects.toThrow();
    }
  );
});

describe('BLAST search form query validation', () => {
  const m = manager({});

  it('normalizes a single FASTA record without changing its residues', () => {
    expect(m.parseSearchQuery('>example\r\nacgu ryn\r\n AGTC', 'blastn')).toEqual({
      sequence: 'ACGURYNAGTC',
      error: '',
    });
  });

  it('rejects multiple records and unexpected characters', () => {
    expect(m.parseSearchQuery('>first\nACGTACGTACGT\n >second\nACGTACGTACGT', 'blastn').error).toMatch(
      /one FASTA record/
    );
    expect(m.parseSearchQuery('ACGTACGTACGT12', 'blastn').error).toMatch(/Remove characters/);
  });

  it.each(['blastp', 'tblastn'])('requires a protein query for %s', program => {
    expect(m.parseSearchQuery('ACGTACGTACGT', program).error).toMatch(/requires a protein query/);
    expect(m.parseSearchQuery('MTEYKLVVVG', program).error).toBe('');
  });

  it('converts the zero-based viewport into one-based inclusive query coordinates', () => {
    const m = manager({ currentChromosome: 'chr', currentPosition: { start: 0, end: 100 } });
    expect(m.getCurrentQueryRegion()).toEqual({ chromosome: 'chr', start: 1, end: 100 });
    m.app.currentPosition = { start: 50, end: 150 };
    expect(m.getCurrentQueryRegion()).toEqual({ chromosome: 'chr', start: 51, end: 150 });
  });
});
