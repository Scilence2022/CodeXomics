import { describe, it, expect } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BaseCompositionAnalyzer = require(path.join(process.cwd(), 'src/renderer/modules/BaseCompositionAnalyzer.js'));

// Helper: build a minimal read object as produced by BamReader / ReadsManager.
function read(start, cigar, sequence, strand = '+') {
  return { start, cigar, sequence, strand };
}

describe('BaseCompositionAnalyzer.baseAtReference (CIGAR-aware extraction)', () => {
  it('reads a plain ungapped match column by column (1-based)', () => {
    const r = read(100, '5M', 'ACGTA');
    expect(BaseCompositionAnalyzer.baseAtReference(r, 100)).toEqual({ kind: 'base', base: 'A' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 101)).toEqual({ kind: 'base', base: 'C' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 104)).toEqual({ kind: 'base', base: 'A' });
    // One past the end is not covered.
    expect(BaseCompositionAnalyzer.baseAtReference(r, 105)).toEqual({ kind: 'none' });
    // Before the start is not covered.
    expect(BaseCompositionAnalyzer.baseAtReference(r, 99)).toEqual({ kind: 'none' });
  });

  it('reports a deletion when a D operation spans the column', () => {
    // 2M2D2M: ref 100,101 = A,C ; 102,103 deleted ; 104,105 = G,T
    const r = read(100, '2M2D2M', 'ACGT');
    expect(BaseCompositionAnalyzer.baseAtReference(r, 101)).toEqual({ kind: 'base', base: 'C' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 102)).toEqual({ kind: 'del' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 103)).toEqual({ kind: 'del' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 104)).toEqual({ kind: 'base', base: 'G' });
  });

  it('captures an insertion immediately following a column', () => {
    // 2M2I2M with seq AC[GG]TT: ref 100=A, 101=C (+ following ins GG), 102=T, 103=T
    const r = read(100, '2M2I2M', 'ACGGTT');
    expect(BaseCompositionAnalyzer.baseAtReference(r, 101)).toEqual({
      kind: 'base',
      base: 'C',
      followingInsertion: 'GG',
    });
    // The column before the insertion boundary carries no insertion annotation.
    expect(BaseCompositionAnalyzer.baseAtReference(r, 100)).toEqual({ kind: 'base', base: 'A' });
    // Bases after the insertion resume correctly.
    expect(BaseCompositionAnalyzer.baseAtReference(r, 102)).toEqual({ kind: 'base', base: 'T' });
  });

  it('honours a leading soft-clip offset into the read sequence', () => {
    // 2S3M with seq NNACG: the clipped NN are skipped; ref 100=A,101=C,102=G
    const r = read(100, '2S3M', 'NNACG');
    expect(BaseCompositionAnalyzer.baseAtReference(r, 100)).toEqual({ kind: 'base', base: 'A' });
    expect(BaseCompositionAnalyzer.baseAtReference(r, 102)).toEqual({ kind: 'base', base: 'G' });
  });

  it('reports a reference skip (N) distinct from a deletion', () => {
    const r = read(100, '2M2N2M', 'ACGT');
    expect(BaseCompositionAnalyzer.baseAtReference(r, 102)).toEqual({ kind: 'skip' });
  });

  it('falls back to an ungapped mapping when CIGAR is missing or "*"', () => {
    expect(BaseCompositionAnalyzer.baseAtReference(read(100, '', 'ACGT'), 102)).toEqual({ kind: 'base', base: 'G' });
    expect(BaseCompositionAnalyzer.baseAtReference(read(100, '*', 'ACGT'), 103)).toEqual({ kind: 'base', base: 'T' });
    expect(BaseCompositionAnalyzer.baseAtReference(read(100, '*', 'ACGT'), 104)).toEqual({ kind: 'none' });
  });
});

describe('BaseCompositionAnalyzer.tally', () => {
  it('counts alleles, strands, and percentages over the aligned total', () => {
    const reads = [
      read(100, '3M', 'AAA', '+'),
      read(100, '3M', 'ACA', '+'),
      read(100, '3M', 'AGA', '-'),
      read(100, '3M', 'CAA', '-'),
    ];
    // At column 100: A, A, A, C
    const r = BaseCompositionAnalyzer.tally(reads, 100);
    expect(r.depth).toBe(4);
    expect(r.aligned).toBe(4);
    expect(r.counts).toEqual({ A: 3, C: 1, G: 0, T: 0, N: 0 });
    expect(r.strand.A).toEqual({ '+': 2, '-': 1 });
    expect(r.strand.C).toEqual({ '+': 0, '-': 1 });
    expect(r.percentages.A).toBe(75);
    expect(r.percentages.C).toBe(25);
  });

  it('includes deletions in depth and reports del % over depth', () => {
    const reads = [
      read(100, '3M', 'AAA'), // col 101 -> A
      read(100, '3M', 'ACA'), // col 101 -> C
      read(100, '2M2D1M', 'AAA'), // col 101 -> A ... col 102 -> del
    ];
    // Evaluate column 102: reads 1&2 don't reach a del; read 3 is a deletion.
    const r = BaseCompositionAnalyzer.tally(reads, 102);
    // reads 1 & 2 have base at 102 (index 2 -> 'A'), read 3 is a deletion
    expect(r.counts.A).toBe(2);
    expect(r.deletions).toBe(1);
    expect(r.depth).toBe(3);
    expect(r.aligned).toBe(2);
    expect(r.percentages.del).toBe(Math.round((1 / 3) * 1000) / 10);
  });

  it('aggregates insertion sequences and counts', () => {
    const reads = [read(100, '2M2I2M', 'ACGGTT'), read(100, '2M2I2M', 'TCGGAA')];
    // At column 101 both reads carry a following insertion "GG".
    const r = BaseCompositionAnalyzer.tally(reads, 101);
    expect(r.insertions.count).toBe(2);
    expect(r.insertions.sequences).toEqual({ GG: 2 });
  });

  it('returns an empty tally when no read covers the column', () => {
    const r = BaseCompositionAnalyzer.tally([read(100, '3M', 'ACG')], 200);
    expect(r.depth).toBe(0);
    expect(r.aligned).toBe(0);
    expect(r.percentages.A).toBe(0);
  });

  it('coerces non-ACGT base calls to N', () => {
    const r = BaseCompositionAnalyzer.tally([read(100, '1M', 'R')], 100);
    expect(r.counts.N).toBe(1);
    expect(r.aligned).toBe(1);
  });
});
