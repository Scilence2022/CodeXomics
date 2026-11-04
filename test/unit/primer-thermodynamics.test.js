import { describe, it, expect } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrimerDesigner = require(path.join(process.cwd(), 'src/renderer/modules/PrimerDesigner.js'));

// Reference values from primer3-py 2.4.0 calc_tm(seq, mv_conc=50, dv_conc, dntp_conc, dna_conc=250)
// (Primer3 defaults: SantaLucia 1998 parameters and salt correction, von Ahsen Mg2+ conversion).
const PRIMER3_TM = [
  // sequence, default (1.5 mM Mg, 0.6 mM dNTP), no Mg, 3 mM Mg / 0.8 mM dNTP
  ['GGGCATTTTCAGGAAGGTTA', 57.91, 51.98, 59.6],
  ['ATGCGCTATCGGATCGATCG', 62.47, 56.76, 64.1],
  ['TGACCTAGGCATGCAAGCTTGGCAC', 69.62, 63.51, 71.35],
  ['ACGTACGTAC', 31.73, 26.95, 33.09],
  ['AAAAAAAATTTTTTTT', 37.34, 31.85, 38.9], // self-complementary: symmetry correction
];

function seededRandomPrimer(seedRef, length) {
  let sequence = '';
  for (let i = 0; i < length; i++) {
    seedRef.value = (seedRef.value * 1103515245 + 12345) % 2147483648;
    sequence += 'ACGT'[Math.floor((seedRef.value / 2147483648) * 4)];
  }
  return sequence;
}

describe('PrimerDesigner reaction conditions and Tm', () => {
  it.each(PRIMER3_TM)('%s agrees with Primer3 under three buffers', (sequence, tmDefault, tmNoMg, tmHighMg) => {
    expect(PrimerDesigner.calculateTm(sequence)).toBeCloseTo(tmDefault, 1);
    expect(PrimerDesigner.calculateTm(sequence, { mgConcentration: 0, dntpConcentration: 0 })).toBeCloseTo(tmNoMg, 1);
    expect(PrimerDesigner.calculateTm(sequence, { mgConcentration: 0.003, dntpConcentration: 0.0008 })).toBeCloseTo(
      tmHighMg,
      1
    );
  });

  it('treats dNTP as chelating Mg2+ and falls back for invalid conditions', () => {
    const seq = 'GGGCATTTTCAGGAAGGTTA';
    const noFreeMg = PrimerDesigner.calculateTm(seq, { mgConcentration: 0.0006, dntpConcentration: 0.0006 });
    expect(noFreeMg).toBeCloseTo(PrimerDesigner.calculateTm(seq, { mgConcentration: 0, dntpConcentration: 0 }), 5);
    const resolved = PrimerDesigner.resolveConditions({
      naConcentration: 0,
      mgConcentration: 0,
      primerConcentration: -1,
    });
    expect(resolved.naConcentration).toBe(0.05);
    expect(resolved.primerConcentration).toBe(250e-9);
    expect(PrimerDesigner.describeConditions()).toBe('50 mM Na⁺ · 1.5 mM Mg²⁺ · 0.6 mM dNTP · 250 nM oligo');
  });

  it('binding-site Tm uses the same conditions as calculateTm', () => {
    const primer = 'ATGCGCTATCGGATCGATCG';
    const sites = PrimerDesigner.findBindingSites(primer, `AAAAAAAAAA${primer}AAAAAAAAAA`, 0, {
      scoringMode: 'thermodynamic',
      mgConcentration: 0.003,
    });
    const perfect = sites.find(site => site.strand === '+');
    expect(perfect.bindingTm).toBeCloseTo(PrimerDesigner.calculateTm(primer, { mgConcentration: 0.003 }), 0);
  });

  it('looks up mismatch-first stacks through the rotated table entry', () => {
    // 'TT/GA' is the 180° rotation of the tabulated 'AG/TT'.
    expect(PrimerDesigner._mismatchParams('TT/GA')).toEqual(PrimerDesigner._NN_MISMATCH_PARAMS['AG/TT']);
    expect(PrimerDesigner._mismatchParams('AA/TT')).toBeNull();
  });
});

describe('PrimerDesigner secondary structure', () => {
  it('flags far fewer random primers as hairpins than the old 4-mer motif check', () => {
    const seed = { value: 11 };
    let flagged = 0;
    const total = 1000;
    for (let i = 0; i < total; i++) {
      if (PrimerDesigner.calculateHairpin(seededRandomPrimer(seed, 20))?.flagged) flagged++;
    }
    // The motif heuristic flagged ~17% of random 20-mers; a ΔG cut-off flags a few percent.
    expect(flagged / total).toBeLessThan(0.05);
  });

  it('detects a stable hairpin and records its stem, loop and 3-prime involvement', () => {
    // 6 bp GC stem closing a 4 nt loop, stem ends at the 3' terminus.
    const hairpin = PrimerDesigner.calculateHairpin('ATTACGCCGCGAAAACGCGGC');
    expect(hairpin.flagged).toBe(true);
    expect(hairpin.stemLength).toBeGreaterThanOrEqual(6);
    expect(hairpin.involves3Prime).toBe(true);
    expect(hairpin.deltaG).toBeLessThan(-3);
    expect(hairpin.dotBracket).toHaveLength(21);
    expect(hairpin.dotBracket.endsWith(')')).toBe(true);
  });

  it('finds a palindromic self-dimer and draws its alignment', () => {
    const dimer = PrimerDesigner.calculateDimer('GAATTCCGCGGCCGCGAATTC');
    expect(dimer.flagged).toBe(true);
    expect(dimer.deltaG).toBeLessThan(-10);
    expect(dimer.alignment).toHaveLength(3);
    expect(dimer.alignment[0]).toContain('GAATTCCGCGGCCGCGAATTC');
    expect(dimer.alignment[1]).toMatch(/\|{6,}/);
  });

  it('marks a dimer that pairs the 3-prime end against the stricter limit', () => {
    // The 3' GCGC of each copy pairs with the other, leaving extendable 3' ends.
    const dimer = PrimerDesigner.calculateDimer('TTTTTTTTTTTTTTGCGCGC');
    expect(dimer.involves3Prime).toBe(true);
  });

  it('computes 3-prime pentamer stability on the Primer3 scale', () => {
    // SantaLucia 1998: GC -2.24, CG -2.17 ×2 each + 1.96 initiation = -6.86
    expect(PrimerDesigner.calculateThreePrimeStability('AAAAAGCGCG').deltaG).toBeCloseTo(-6.86, 1);
  });

  it('keeps calculateProperties backward compatible while exposing ΔG detail', () => {
    const props = PrimerDesigner.calculateProperties('CCCGATCGCCAGGACCGGGCATTTTCAGGAAGGTTA');
    expect(typeof props.hasHairpinPotential).toBe('boolean');
    expect(props.hairpin).toHaveProperty('deltaG');
    expect(props.selfDimer).toHaveProperty('alignment');
    expect(props.threePrimeStability.sequence).toBe('GGTTA');
    expect(props.conditions.mgConcentration).toBe(0.0015);
  });
});

describe('PrimerDesigner.assessPrimerQuality', () => {
  const tailed = 'CCCGATCGCCAGGACCGGGCATTTTCAGGAAGGTTA';
  const tail = 'CCCGATCGCCAGGACC';

  it('grades Tm, GC and length on the annealing region of a tailed primer', () => {
    const report = PrimerDesigner.assessPrimerQuality(tailed, { fivePrimeTail: tail });
    expect(report.tailLength).toBe(16);
    expect(report.annealingSequence).toBe('GGGCATTTTCAGGAAGGTTA');
    expect(report.tm).toBeCloseTo(57.91, 1);
    expect(report.fullTm).toBeGreaterThan(report.tm);
    const byId = Object.fromEntries(report.checks.map(check => [check.id, check]));
    expect(byId.length.value).toBe(20);
    expect(byId.length.status).toBe('good');
    expect(byId.tm.label).toBe('Tm (annealing)');
  });

  it('grades the whole oligo when there is no tail, with readable messages', () => {
    const report = PrimerDesigner.assessPrimerQuality(tailed);
    expect(report.tailLength).toBe(0);
    expect(report.fullTm).toBeNull();
    const byId = Object.fromEntries(report.checks.map(check => [check.id, check]));
    expect(byId.length.message).toBe('Too long');
    expect(byId.tm.message).toBe('High — risk of mispriming');
    expect(report.overall).toBe('warning');
  });

  it('ignores a tail that is not actually the 5-prime prefix', () => {
    const report = PrimerDesigner.assessPrimerQuality('GGGCATTTTCAGGAAGGTTA', { fivePrimeTail: 'AAAA' });
    expect(report.tailLength).toBe(0);
  });

  it('reports runs and the GC clamp', () => {
    const report = PrimerDesigner.assessPrimerQuality('ACGTAAAAAAGTCAGTCATA');
    const byId = Object.fromEntries(report.checks.map(check => [check.id, check]));
    expect(byId.repeats.status).toBe('warning');
    expect(byId.repeats.message).toContain('A run of 6');
    expect(byId.gcClamp.value).toBe(1);
  });
});

describe('PrimerDesigner.designPrimerPair', () => {
  it('returns primers whose reported Tm is near the requested target', () => {
    const seed = { value: 5 };
    const template = seededRandomPrimer(seed, 1200);
    const pair = PrimerDesigner.designPrimerPair(template, { targetTm: 60, tmTolerance: 2 });
    expect(pair).toBeTruthy();
    // Before candidate filtering used the canonical Tm, a 60 °C request reported ~48–50 °C.
    expect(Math.abs(pair.forward.tm - 60)).toBeLessThanOrEqual(7);
    expect(Math.abs(pair.reverse.tm - 60)).toBeLessThanOrEqual(7);
    expect(pair.forward.tm).toBeCloseTo(PrimerDesigner.calculateTm(pair.forward.sequence), 1);
    expect(pair.heteroDimer).toHaveProperty('deltaG');
    expect(pair.conditions.mgConcentration).toBe(0.0015);
  });
});
