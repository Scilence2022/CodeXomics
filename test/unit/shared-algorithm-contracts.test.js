import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const Utils = require('../../src/renderer/modules/ParameterUtils');
const Sequence = require('../../src/mcp-tools/sequence/SequenceTools');
const Microbe = require('../../src/renderer/modules/MicrobeGenomicsFunctions');
const Search = require('../../src/renderer/modules/AdvancedSearchManager');
require('../../src/renderer/modules/VariantAnalyzer');
const Variant = window.VariantAnalyzer;
describe('shared algorithm contracts', () => {
  it.each([
    ['ATGC', 'dna'],
    ['AUGC', 'rna'],
    ['ARND*', 'protein'],
    [' a1-t g\nc ', 'auto'],
  ])('uses identical molecular weight results for %s', (sequence, type) => {
    expect(new Sequence({}).calculateMolecularWeight(sequence, type)).toBe(
      Microbe.calculateMolecularWeight(sequence, type)
    );
  });
  it('treats the stop symbol as zero mass rather than an unknown amino acid', () => {
    expect(Microbe.calculateMolecularWeight('A*', 'protein')).toBeCloseTo(89.1, 2);
  });
  it('complements mixed-case IUPAC symbols consistently in search and variant analysis', () => {
    expect(Search.prototype.getReverseComplement('AryN')).toBe('NryT');
    expect(Variant.prototype.reverseComplement('AryN')).toBe('NryT');
  });
  it.each(['<DEL:ME>', 'A,C', 'G[chr2:50[', 'N', '*', '.T'])(
    'withholds sequence impact for the unresolved alternate allele %s',
    async alt => {
      const result = await new Variant({}).analyzeVariant({ chromosome: 'chr1', start: 4, ref: 'G', alt });
      expect(result).toMatchObject({
        basicInfo: { position: 'chr1:5', alternative: alt },
        type: { lengthChange: null },
        impact: { severity: 'Unknown' },
        affectedGenes: [],
      });
    }
  );
  it('normalizes nested params and primer aliases without modifying input', () => {
    const input = { z: undefined, b: [{ z: 2, a: 1 }], primerSequence: 'ATGC' };
    const output = Utils.normalizeParams(input);
    expect(JSON.stringify(output)).toBe('{"b":[{"a":1,"z":2}],"sequence":"ATGC"}');
    expect(input.primerSequence).toBe('ATGC');
  });
  it('preserves common-key strict similarity semantics', () => {
    expect(Utils.calculateParameterSimilarity({ a: 1, b: 2 }, { a: 1, b: 3, c: 4 })).toBe(0.5);
    expect(Utils.calculateParameterSimilarity({}, {})).toBe(0);
  });
});
