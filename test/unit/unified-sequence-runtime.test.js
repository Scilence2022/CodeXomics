import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Processing = require('../../src/renderer/modules/UnifiedSequenceProcessing');
const Translation = require('../../src/renderer/modules/UnifiedDNATranslation');
const Microbe = require('../../src/renderer/modules/MicrobeGenomicsFunctions');
const SequenceTools = require('../../src/mcp-tools/sequence/SequenceTools');
describe('shared biological sequence runtime', () => {
  it.each(['ARYN', 'ATGCRYSWKMBDHVN', 'aryswkmbdhvn', ''])('preserves IUPAC complements for %s', sequence => {
    const expected = Processing.legacyReverseComplement(sequence);
    expect(Microbe.reverseComplement(sequence)).toBe(expected);
    expect(new SequenceTools({}).reverseComplement(sequence).toUpperCase()).toBe(expected);
    expect(Translation.reverseComplement(sequence)).toBe(expected);
  });
  it('maps ARYN to NRYT', () => expect(Microbe.reverseComplement('ARYN')).toBe('NRYT'));
  it('preserves legacy stop and ambiguous codon output', () => {
    expect(Microbe.translateDNA('ATGTAAATGNNN')).toBe('M*MX');
    expect(Microbe.translateDNA('AATG', 1)).toBe('M');
    expect(Microbe.translateDNA('AT')).toBe('');
  });
  it('preserves unrounded GC percentages', () => expect(Processing.legacyComputeGC('GATN')).toBeCloseTo(100 / 3, 12));
});
