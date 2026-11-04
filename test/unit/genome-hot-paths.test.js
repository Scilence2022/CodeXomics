import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const TrackRenderer = require('../../src/renderer/modules/TrackRenderer.js');
const UnifiedSequenceProcessing = require('../../src/renderer/modules/UnifiedSequenceProcessing.js');
const MicrobeGenomicsFunctions = require('../../src/renderer/modules/MicrobeGenomicsFunctions.js');
const PrimerDesigner = require('../../src/renderer/modules/PrimerDesigner.js');

describe('genome track calculations', () => {
  const renderer = new TrackRenderer({});

  it('preserves input order and inclusive edges in a linear feature viewport', () => {
    renderer.trackSettings.genes = { circularMode: false };
    const trailing = { id: 'trailing', start: '20', end: '22' };
    const leading = { id: 'leading', start: 8, end: 10 };
    const invalid = { id: 'invalid', start: 10, end: Infinity };
    const visible = renderer.filterFeaturesByViewport([trailing, null, invalid, leading], { start: 10, end: 20 });
    expect(visible).toEqual([trailing, leading]);
    expect(visible[0]).toBe(trailing);
  });

  it('picks the first available row when several reads end before the next read starts', () => {
    const reads = [
      { id: 'a', start: 0, end: 5 },
      { id: 'b', start: 0, end: 2 },
      { id: 'c', start: 2, end: 3 },
      { id: 'd', start: 3, end: 4 },
      { id: 'e', start: 6, end: 7 },
    ];
    const rows = renderer.arrangeReadsInRows(reads);
    expect(rows.map(row => row.map(read => read.id))).toEqual([['a', 'e'], ['b', 'd'], ['c']]);
  });

  it('clips read coverage and counts both inclusive bin endpoints', () => {
    const reads = [
      { start: -2, end: 1 },
      { start: 1, end: 2 },
      { start: 3, end: 7 },
      { start: 4, end: 4 },
    ];
    expect(renderer.calculateCoverage(reads, 0, 4)).toEqual([1, 2, 1, 1]);
    expect(renderer.calculateCoverage(reads, 2, 2)).toEqual([]);
  });

  it('preserves GC gaps, lowercase counts and the final window at the viewport edge', () => {
    const sequence = 'acgtNNNNNNccGTc';
    const data = renderer.calculateDynamicGCData(sequence, 4, 2, 18);
    expect(data.segmentStarts).toEqual([0, 2]);
    expect(data.domainLength).toBe(18);
    expect(data.detailedData.at(-1).windowEnd).toBe(sequence.length);
    for (const { position, windowStart, windowEnd, ...composition } of data.detailedData) {
      expect(position).toBe(windowStart + 2);
      expect(composition).toEqual(renderer.analyzeGCWindow(sequence.slice(windowStart, windowEnd)));
    }
  });
});

describe('sequence analysis hot paths', () => {
  it('retains rounded window values and existing ambiguity weights', () => {
    const result = UnifiedSequenceProcessing.computeGC('gBvN', {
      includeAmbiguous: true,
      method: 'window',
      windowSize: 2,
    });
    expect(result.gcContent).toBe(50);
    expect(result.statistics).toMatchObject({ minGC: '33.50', maxGC: '66.50', averageGC: '50.00' });
    expect(result.statistics.windowData).toEqual([
      { position: 1, end: 2, gcContent: 66.5, sequence: 'GB' },
      { position: 2, end: 3, gcContent: 50, sequence: 'BV' },
      { position: 3, end: 4, gcContent: 33.5, sequence: 'VN' },
    ]);
  });

  it('computes summary values for more windows than a function call can receive as arguments', () => {
    const result = UnifiedSequenceProcessing.computeGC('AC'.repeat(75_001), { method: 'window', windowSize: 2 });
    expect(result.success).toBe(true);
    expect(result.statistics).toMatchObject({ windows: 150_001, minGC: '50.00', maxGC: '50.00' });
  });

  it('preserves edit distances across unequal lengths and UTF-16 code units', () => {
    expect(UnifiedSequenceProcessing.levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(UnifiedSequenceProcessing.levenshteinDistance('sitting', 'kitten')).toBe(3);
    expect(UnifiedSequenceProcessing.levenshteinDistance('🧬', '')).toBe(2);
    expect(MicrobeGenomicsFunctions.levenshteinDistance('gene', 'genes')).toBe(1);
  });

  it('keeps nested reverse-strand ORFs in their original order when they share a stop', () => {
    expect(MicrobeGenomicsFunctions.findORFs('TTACATCAT', 1)).toEqual([
      { start: 3, end: 10, frame: -1, length: 2, sequence: 'ATGATGTAA' },
      { start: 3, end: 7, frame: -1, length: 1, sequence: 'ATGTAA' },
    ]);
    expect(MicrobeGenomicsFunctions.findORFs('ATGATGATG', 1)).toEqual([]);
  });

  it('preserves overlapping exact primer hits, strand order, and truncation metadata', () => {
    const sites = PrimerDesigner.findBindingSites('ATAT', 'atNatat', 0, { maxSites: 3 });
    expect(sites.map(({ start, strand, mismatches }) => [start, strand, mismatches])).toEqual([
      [0, '+', 0],
      [2, '+', 0],
      [0, '-', 0],
    ]);
    expect(sites.truncated).toBe(true);
    expect(sites.totalMatchedAtLeast).toBe(3);
  });
});
