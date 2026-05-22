import { describe, it, expect } from 'vitest';
import PrimerDesigner from '../../src/renderer/modules/PrimerDesigner.js';

describe('Primer Designer Mismatch Binding Tests', () => {
  // Test sequence: 100bp template sequence
  const template =
    'ATGCGCTATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG';

  // Exact match primer
  const perfectPrimer = 'ATGCGCTATC'; // matches start of template exactly (+ strand)

  // Primer with mismatch at 5' end (position 1, i.e., index 0)
  // Template: A T G C G C T A T C
  // Primer:   T T G C G C T A T C
  const fivePrimeMismatchPrimer = 'TTGCGCTATC';

  // Primer with mismatch at 3' end (position 10, i.e., index 9, the 3' terminal)
  // Template: A T G C G C T A T C
  // Primer:   A T G C G C T A T A
  const threePrimeTerminalMismatchPrimer = 'ATGCGCTATA';

  // Primer with mismatch at 3' region but not terminal (position 8, i.e., index 7, which is position 3 from 3' end)
  // Template: A T G C G C T A T C
  // Primer:   A T G C G C T C T C
  const threePrimeNearMismatchPrimer = 'ATGCGCTCTC';

  describe('findBindingSites - Exact Match (maxMismatches = 0)', () => {
    it('should find exact matches with score 100 and no mismatches', () => {
      const results = PrimerDesigner.findBindingSites(perfectPrimer, template, 0);
      expect(results.length).toBeGreaterThan(0);

      const best = results[0];
      expect(best.start).toBe(0);
      expect(best.strand).toBe('+');
      expect(best.mismatches).toBe(0);
      expect(best.bindingScore).toBe(100.0);
      expect(best.mismatchDetails).toEqual([]);
    });

    it('should not find mismatched sites when maxMismatches is 0', () => {
      const results = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 0);
      // It shouldn't find the mismatch site at index 0
      const atStart = results.find(r => r.start === 0 && r.strand === '+');
      expect(atStart).toBeUndefined();
    });
  });

  describe('findBindingSites - Mismatch Tolerance', () => {
    it('should find mismatched sites when maxMismatches is greater than 0', () => {
      const results = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1);
      const atStart = results.find(r => r.start === 0 && r.strand === '+');
      expect(atStart).toBeDefined();
      expect(atStart.mismatches).toBe(1);
      expect(atStart.threePrimeMismatches).toBe(0);
      expect(atStart.terminalMismatch).toBe(false);
      expect(atStart.bindingScore).toBeLessThan(100.0);
    });

    it('should respect maxMismatches and filter out sites with too many mismatches', () => {
      // 2 mismatches primer
      const twoMismatchPrimer = 'TTGCGCTATA'; // indices 0 and 9 mismatch
      const results1 = PrimerDesigner.findBindingSites(twoMismatchPrimer, template, 1);
      expect(results1.find(r => r.start === 0 && r.strand === '+')).toBeUndefined();

      const results2 = PrimerDesigner.findBindingSites(twoMismatchPrimer, template, 2);
      expect(results2.find(r => r.start === 0 && r.strand === '+')).toBeDefined();
    });
  });

  describe("findBindingSites - 3' End Filtering", () => {
    it("should filter out sites with too many 3' end mismatches when max3PrimeMismatches is set", () => {
      // 3' terminal mismatch has 1 mismatch in last 5bp (at index 9)
      const resultsWithFilter = PrimerDesigner.findBindingSites(threePrimeTerminalMismatchPrimer, template, 1, {
        max3PrimeMismatches: 0,
      });
      const siteWithFilter = resultsWithFilter.find(r => r.start === 0 && r.strand === '+');
      expect(siteWithFilter).toBeUndefined();

      const resultsWithoutFilter = PrimerDesigner.findBindingSites(threePrimeTerminalMismatchPrimer, template, 1);
      const siteWithoutFilter = resultsWithoutFilter.find(r => r.start === 0 && r.strand === '+');
      expect(siteWithoutFilter).toBeDefined();
      expect(siteWithoutFilter.threePrimeMismatches).toBe(1);
      expect(siteWithoutFilter.terminalMismatch).toBe(true);
    });
  });

  describe('findBindingSites - Default Parameters', () => {
    it('should default maxMismatches to 3 when not specified', () => {
      // fivePrimeMismatchPrimer has 1 mismatch, should be found with defaults
      const results = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template);
      const atStart = results.find(r => r.start === 0 && r.strand === '+');
      expect(atStart).toBeDefined();
      expect(atStart.mismatches).toBe(1);

      // twoMismatchPrimer has 2 mismatches, should also be found
      const twoMismatchPrimer = 'TTGCGCTATA'; // indices 0 and 9 mismatch
      const results2 = PrimerDesigner.findBindingSites(twoMismatchPrimer, template);
      const atStart2 = results2.find(r => r.start === 0 && r.strand === '+');
      expect(atStart2).toBeDefined();
      expect(atStart2.mismatches).toBe(2);
    });

    it('should default max3PrimeMismatches to 1 when not specified', () => {
      // Primer with 2 mismatches in the last 5 bp (e.g. index 8 and 9 mismatch)
      // Template: A T G C G C T A T C
      // Primer:   A T G C G C T A A A (indices 8 and 9 mismatch)
      const two3PrimeMismatchPrimer = 'ATGCGCTAAA';

      // With default parameters, it should filter this out since max3PrimeMismatches defaults to 1
      const resultsDefault = PrimerDesigner.findBindingSites(two3PrimeMismatchPrimer, template);
      const siteDefault = resultsDefault.find(r => r.start === 0 && r.strand === '+');
      expect(siteDefault).toBeUndefined();

      // If we explicitly pass max3PrimeMismatches: 2 in options, it should be found
      const resultsCustom = PrimerDesigner.findBindingSites(two3PrimeMismatchPrimer, template, 3, {
        max3PrimeMismatches: 2,
      });
      const siteCustom = resultsCustom.find(r => r.start === 0 && r.strand === '+');
      expect(siteCustom).toBeDefined();
      expect(siteCustom.threePrimeMismatches).toBe(2);
    });
  });

  describe('Scoring Logic', () => {
    it("should score 5' mismatches higher than 3' mismatches", () => {
      // 5' end mismatch
      const resFivePrime = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1);
      const scoreFivePrime = resFivePrime.find(r => r.start === 0 && r.strand === '+').bindingScore;

      // 3' end terminal mismatch
      const resThreePrimeTerminal = PrimerDesigner.findBindingSites(threePrimeTerminalMismatchPrimer, template, 1);
      const scoreThreePrimeTerminal = resThreePrimeTerminal.find(r => r.start === 0 && r.strand === '+').bindingScore;

      // 3' region mismatch (index 7, pos 3 from 3' end)
      const resThreePrimeNear = PrimerDesigner.findBindingSites(threePrimeNearMismatchPrimer, template, 1);
      const scoreThreePrimeNear = resThreePrimeNear.find(r => r.start === 0 && r.strand === '+').bindingScore;

      // 5' mismatch should have a much higher score (better quality binding) than a terminal 3' mismatch
      expect(scoreFivePrime).toBeGreaterThan(scoreThreePrimeNear);
      expect(scoreThreePrimeNear).toBeGreaterThan(scoreThreePrimeTerminal);
    });
  });

  describe('Thermodynamic Calculations', () => {
    it('should compute Tm and deltaG when scoringMode is thermodynamic', () => {
      const results = PrimerDesigner.findBindingSites(perfectPrimer, template, 0, {
        scoringMode: 'thermodynamic',
      });
      const site = results[0];
      expect(site.bindingTm).toBeDefined();
      expect(site.bindingDeltaG).toBeDefined();
      expect(typeof site.bindingTm).toBe('number');
      expect(typeof site.bindingDeltaG).toBe('number');
    });

    it('should predict lower Tm for mismatched duplexes compared to perfect matches', () => {
      const resPerfect = PrimerDesigner.findBindingSites(perfectPrimer, template, 0, {
        scoringMode: 'thermodynamic',
      });
      const tmPerfect = resPerfect[0].bindingTm;

      const resMismatched = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1, {
        scoringMode: 'thermodynamic',
      });
      const tmMismatched = resMismatched.find(r => r.start === 0 && r.strand === '+').bindingTm;

      expect(tmPerfect).toBeGreaterThan(tmMismatched);
    });

    it('should respect minBindingTm and filter out weak binding sites', () => {
      // Find all 1 mismatch sites, then filter with a high minBindingTm
      const resultsAll = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1, {
        scoringMode: 'thermodynamic',
      });
      const siteTm = resultsAll.find(r => r.start === 0 && r.strand === '+').bindingTm;

      // Filter out if minBindingTm is set higher than predicted Tm
      const resultsFiltered = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1, {
        scoringMode: 'thermodynamic',
        minBindingTm: siteTm + 2.0,
      });
      expect(resultsFiltered.find(r => r.start === 0 && r.strand === '+')).toBeUndefined();

      // Keep if minBindingTm is set lower than predicted Tm
      const resultsKept = PrimerDesigner.findBindingSites(fivePrimeMismatchPrimer, template, 1, {
        scoringMode: 'thermodynamic',
        minBindingTm: siteTm - 2.0,
      });
      expect(resultsKept.find(r => r.start === 0 && r.strand === '+')).toBeDefined();
    });

    it('should adjust Tm based on salt and primer concentration', () => {
      // Reference condition (50 mM Na+, 250 nM primer)
      const res1 = PrimerDesigner.findBindingSites(perfectPrimer, template, 0, {
        scoringMode: 'thermodynamic',
        naConcentration: 0.05,
        primerConcentration: 250e-9,
      });
      const tm1 = res1[0].bindingTm;

      // Higher salt concentration (150 mM Na+) should stabilize duplex and increase Tm
      const res2 = PrimerDesigner.findBindingSites(perfectPrimer, template, 0, {
        scoringMode: 'thermodynamic',
        naConcentration: 0.15,
        primerConcentration: 250e-9,
      });
      const tm2 = res2[0].bindingTm;

      expect(tm2).toBeGreaterThan(tm1);
    });
  });

  describe('Reverse Complement Strand Detection', () => {
    it('should detect binding sites on the reverse complement strand', () => {
      // Template starts with ATGCGCTATC (+ strand match)
      // Reverse complement of ATGCGCTATC is GATAGCGCAT (- strand match)
      // Let's place GATAGCGCAT in the template
      const customTemplate = 'AAAAAAAAAAGATAGCGCATAAAAAAAAAA';

      const results = PrimerDesigner.findBindingSites(perfectPrimer, customTemplate, 0);
      const revSite = results.find(r => r.strand === '-');
      expect(revSite).toBeDefined();
      expect(revSite.start).toBe(10);
      expect(revSite.sequence).toBe('GATAGCGCAT');
    });
  });
});
