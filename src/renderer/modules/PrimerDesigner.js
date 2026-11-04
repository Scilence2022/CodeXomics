/**
 * PrimerDesigner.js
 * Core engine for primer design, property calculation, and binding site analysis.
 * This class provides static utility methods used by both ChatBox and MCP server integrations.
 */

const IUPAC_COMPLEMENT = {
  A: 'T',
  T: 'A',
  G: 'C',
  C: 'G',
  R: 'Y',
  Y: 'R',
  M: 'K',
  K: 'M',
  S: 'S',
  W: 'W',
  B: 'V',
  D: 'H',
  H: 'D',
  V: 'B',
  N: 'N',
  a: 't',
  t: 'a',
  g: 'c',
  c: 'g',
  r: 'y',
  y: 'r',
  m: 'k',
  k: 'm',
  s: 's',
  w: 'w',
  b: 'v',
  d: 'h',
  h: 'd',
  v: 'b',
  n: 'n',
};

class PrimerDesigner {
  // ---------------------------------------------------------------------------
  // Reaction conditions
  // ---------------------------------------------------------------------------

  /**
   * Default reaction conditions for every thermodynamic calculation. Monovalent,
   * Mg2+ and dNTP values are Primer3's defaults, so a reported Tm is directly
   * comparable with Primer3 / Primer-BLAST / primer3-py. The oligo concentration
   * keeps the app's historical 250 nM.
   */
  static DEFAULT_REACTION_CONDITIONS = Object.freeze({
    naConcentration: 0.05, // M monovalent cations
    mgConcentration: 0.0015, // M Mg2+
    dntpConcentration: 0.0006, // M total dNTP (chelates Mg2+ ~1:1)
    primerConcentration: 250e-9, // M oligo
  });

  /** Fill missing or invalid condition values from DEFAULT_REACTION_CONDITIONS. */
  static resolveConditions(options = {}) {
    const defaults = this.DEFAULT_REACTION_CONDITIONS;
    const source = options || {};
    const nonNegative = (value, fallback) => (Number.isFinite(value) && value >= 0 ? value : fallback);
    const positive = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
    const conditions = {
      naConcentration: nonNegative(source.naConcentration, defaults.naConcentration),
      mgConcentration: nonNegative(source.mgConcentration, defaults.mgConcentration),
      dntpConcentration: nonNegative(source.dntpConcentration, defaults.dntpConcentration),
      primerConcentration: positive(source.primerConcentration, defaults.primerConcentration),
    };
    // ln([Na+eq]) must be defined: a cation-free buffer falls back to the default Na+.
    if (this._sodiumEquivalent(conditions) <= 0) {
      conditions.naConcentration = defaults.naConcentration;
    }
    return conditions;
  }

  /**
   * Na+-equivalent concentration (M) of a buffer with Mg2+ and dNTP.
   * von Ahsen et al. (2001) Clin Chem 47:1956 — the conversion Primer3 applies
   * before its SantaLucia salt correction. dNTPs bind Mg2+, so only free Mg2+ counts.
   */
  static _sodiumEquivalent(conditions) {
    const freeMgMillimolar = Math.max(0, (conditions.mgConcentration - conditions.dntpConcentration) * 1000);
    return conditions.naConcentration + (120 * Math.sqrt(freeMgMillimolar)) / 1000;
  }

  /** Human-readable summary of the conditions a Tm/ΔG was computed under. */
  static describeConditions(options = {}) {
    const c = this.resolveConditions(options);
    const fmt = value => String(Number(value.toPrecision(3)));
    return (
      `${fmt(c.naConcentration * 1000)} mM Na⁺ · ${fmt(c.mgConcentration * 1000)} mM Mg²⁺ · ` +
      `${fmt(c.dntpConcentration * 1000)} mM dNTP · ${fmt(c.primerConcentration * 1e9)} nM oligo`
    );
  }

  /**
   * Calculate properties of a primer sequence
   * @param {string} sequence - DNA sequence of the primer
   * @param {Object} [options] - reaction conditions (see DEFAULT_REACTION_CONDITIONS)
   * @returns {Object} Primer properties including length, GC%, Tm and secondary structure
   */
  static calculateProperties(sequence, options = {}) {
    if (!sequence || typeof sequence !== 'string') {
      throw new Error('Valid DNA sequence is required');
    }

    const upper = sequence.toUpperCase();
    const invalidChars = upper.replace(/[ATCG]/g, '');
    const invalidRatio = invalidChars.length / upper.length;

    if (invalidRatio > 0.1) {
      throw new Error(
        `Sequence contains ${(invalidRatio * 100).toFixed(1)}% non-ATCG characters ` +
          `(${invalidChars.substring(0, 20)}...). Only A, T, C, G are supported for primer calculations.`
      );
    }

    const seq = upper.replace(/[^ATCG]/g, '');
    const length = seq.length;

    if (length === 0) {
      throw new Error('Sequence contains no valid DNA characters');
    }

    const warnings = [];
    if (invalidChars.length > 0) {
      warnings.push(`${invalidChars.length} non-ATCG character(s) were stripped from the sequence`);
    }

    const gCount = (seq.match(/G/g) || []).length;
    const cCount = (seq.match(/C/g) || []).length;
    const gcContent = ((gCount + cCount) / length) * 100;

    const conditions = this.resolveConditions(options);
    const tm = this.calculateTm(seq, conditions);
    const hairpin = this.calculateHairpin(seq, conditions);
    const selfDimer = this.calculateDimer(seq, seq, conditions);
    const threePrimeStability = this.calculateThreePrimeStability(seq);

    const result = {
      sequence: seq,
      length: length,
      gcContent: Number(gcContent.toFixed(2)),
      tm: Number(tm.toFixed(2)),
      hasHairpinPotential: Boolean(hairpin?.flagged),
      hairpin,
      selfDimer,
      threePrimeStability,
      gcClampCount: this._threePrimeGcCount(seq),
      conditions,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Canonical melting-temperature model for a perfectly matched primer–template
   * duplex. Uses the nearest-neighbor thermodynamic model (SantaLucia 1998) — the
   * SAME engine that findBindingSites uses for binding Tm — so the Tm reported for
   * a primer is consistent across calculate_primer_properties, design output, and
   * binding-site prediction.
   *
   * The nearest-neighbor parameters were fitted on short oligos, so the model is
   * used down to MIN_NN_LENGTH nt; only shorter fragments (which are not primers)
   * fall back to the Wallace blend in `_calculateTm`.
   *
   * @param {string} sequence - primer sequence (5'→3')
   * @param {Object} [options] - reaction conditions (see DEFAULT_REACTION_CONDITIONS)
   * @returns {number} Tm in °C
   */
  static calculateTm(sequence, options = {}) {
    const seq = String(sequence || '')
      .toUpperCase()
      .replace(/[^ATCG]/g, '');
    if (seq.length === 0) return 0;

    if (seq.length < this.MIN_NN_LENGTH) {
      const gCount = (seq.match(/G/g) || []).length;
      const cCount = (seq.match(/C/g) || []).length;
      const gcContent = ((gCount + cCount) / seq.length) * 100;
      return this._calculateTm(seq, gCount, cCount, gcContent);
    }

    // A perfectly matched duplex: template === primer, so every nearest-neighbor
    // step uses Watson–Crick match parameters.
    return this._calculateBindingTm(seq, seq, this.resolveConditions(options)).tm;
  }

  /** Shortest oligo the nearest-neighbor Tm model is applied to. */
  static MIN_NN_LENGTH = 8;

  /**
   * Wallace-rule / basic-GC Tm approximation for fragments shorter than
   * MIN_NN_LENGTH. Not used for primers; calculateTm() is the reported Tm.
   */
  static _calculateTm(seq, gCount, cCount, gcContent) {
    const length = seq.length;
    const aCount = (seq.match(/A/g) || []).length;
    const tCount = (seq.match(/T/g) || []).length;

    const wallaceTm = 2 * (aCount + tCount) + 4 * (gCount + cCount);
    const saltAdjustedTm = 81.5 + 0.41 * gcContent - 675 / length;

    if (length < 14) {
      const weight = (length - 1) / 13;
      return wallaceTm * (1 - weight) + saltAdjustedTm * weight;
    }

    return saltAdjustedTm;
  }

  /**
   * Design a primer pair for a given target sequence
   * @param {string} targetSequence - The DNA sequence to amplify
   * @param {Object} options - Design parameters (targetTm, minLen, maxLen)
   * @param {number} [options.requiredAmpliconStart] - 0-based offset the product must start at or before.
   * @param {number} [options.requiredAmpliconEnd] - 0-based exclusive offset the product must end at or after.
   * @returns {Object} Best primer pair found, or null if none match criteria
   */
  static designPrimerPair(targetSequence, options = {}) {
    if (!targetSequence || targetSequence.length < 150) {
      throw new Error('Target sequence must be at least 150bp to design primers');
    }

    const seq = targetSequence.toUpperCase().replace(/[^ATCG]/g, '');

    if (seq.length < 150) {
      throw new Error(`After removing non-ATCG characters, only ${seq.length}bp remain. Need at least 150bp.`);
    }

    const conditions = this.resolveConditions(options);
    const targetTm = Number.isFinite(options.targetTm) ? options.targetTm : 60.0;
    const baseTmTolerance = Number.isFinite(options.tmTolerance) ? options.tmTolerance : 2.0;
    const minLen = Number.isFinite(options.minLen) ? Math.floor(options.minLen) : 18;
    const maxLen = Number.isFinite(options.maxLen) ? Math.floor(options.maxLen) : 25;
    const minPropSize = Number.isFinite(options.minProductSize)
      ? Math.floor(options.minProductSize)
      : Math.min(seq.length, 100);
    const maxPropSize = Number.isFinite(options.maxProductSize) ? Math.floor(options.maxProductSize) : seq.length;
    const hasCustomGcRange = Number.isFinite(options.minGcContent) || Number.isFinite(options.maxGcContent);
    const minGcContent = Number.isFinite(options.minGcContent) ? options.minGcContent : 40;
    const maxGcContent = Number.isFinite(options.maxGcContent) ? options.maxGcContent : 60;
    const gcClampOverride = typeof options.requireGcClamp === 'boolean' ? options.requireGcClamp : null;
    const avoidHairpinOverride = typeof options.avoidHairpin === 'boolean' ? options.avoidHairpin : null;
    const requiredAmpliconStart = Number.isFinite(options.requiredAmpliconStart)
      ? Math.max(0, Math.floor(options.requiredAmpliconStart))
      : null;
    const requiredAmpliconEnd = Number.isFinite(options.requiredAmpliconEnd)
      ? Math.min(seq.length, Math.ceil(options.requiredAmpliconEnd))
      : null;

    if (minLen < 1 || maxLen < minLen) {
      throw new Error(`Invalid primer length range: minLen=${minLen}, maxLen=${maxLen}`);
    }
    if (minPropSize < 1 || maxPropSize < minPropSize) {
      throw new Error(`Invalid product size range: minProductSize=${minPropSize}, maxProductSize=${maxPropSize}`);
    }
    if (minGcContent < 0 || maxGcContent > 100 || maxGcContent < minGcContent) {
      throw new Error(`Invalid GC range: minGcContent=${minGcContent}, maxGcContent=${maxGcContent}`);
    }

    const strictnessLevels = this._buildStrictnessLevels({
      baseTmTolerance,
      hasCustomGcRange,
      minGcContent,
      maxGcContent,
      gcClampOverride,
      avoidHairpinOverride,
    });

    for (const strictness of strictnessLevels) {
      const pairs = this._findPrimerPairsWithStrictness(
        seq,
        minLen,
        maxLen,
        targetTm,
        minPropSize,
        maxPropSize,
        strictness,
        { requiredAmpliconStart, requiredAmpliconEnd, conditions }
      );
      if (pairs && pairs.length > 0) {
        pairs.sort((a, b) => a.designScore - b.designScore);
        const best = pairs[0];
        // Candidates were already filtered on the canonical nearest-neighbor Tm,
        // so the reported Tm is the one the target was matched against.
        const heteroDimer = this.calculateDimer(best.forward.sequence, best.reverse.sequence, conditions);
        if (heteroDimer) best.heteroDimer = heteroDimer;
        best.conditions = conditions;
        return best;
      }
    }

    return null;
  }

  static _buildStrictnessLevels(options) {
    const { baseTmTolerance, hasCustomGcRange, minGcContent, maxGcContent, gcClampOverride, avoidHairpinOverride } =
      options;

    const gcRanges = hasCustomGcRange
      ? [
          [minGcContent, maxGcContent],
          [minGcContent, maxGcContent],
          [minGcContent, maxGcContent],
          [minGcContent, maxGcContent],
        ]
      : [
          [40, 60],
          [35, 65],
          [30, 70],
          [20, 80],
        ];
    const defaults = [
      { tmTol: baseTmTolerance, requireGcClamp: true, avoidHairpin: true },
      { tmTol: baseTmTolerance + 2.0, requireGcClamp: true, avoidHairpin: true },
      { tmTol: baseTmTolerance + 5.0, requireGcClamp: false, avoidHairpin: true },
      { tmTol: baseTmTolerance + 10.0, requireGcClamp: false, avoidHairpin: false },
    ];

    return defaults.map((strictness, index) => ({
      ...strictness,
      gcMin: gcRanges[index][0],
      gcMax: gcRanges[index][1],
      requireGcClamp: gcClampOverride === null ? strictness.requireGcClamp : gcClampOverride,
      avoidHairpin: avoidHairpinOverride === null ? strictness.avoidHairpin : avoidHairpinOverride,
    }));
  }

  static _findPrimerPairsWithStrictness(
    seq,
    minLen,
    maxLen,
    targetTm,
    minPropSize,
    maxPropSize,
    strictness,
    constraints = {}
  ) {
    const pairs = [];
    const { requiredAmpliconStart, requiredAmpliconEnd } = constraints;
    const conditions = constraints.conditions || this.resolveConditions();
    const hasRequiredStart = Number.isFinite(requiredAmpliconStart);
    const hasRequiredEnd = Number.isFinite(requiredAmpliconEnd);

    const searchRegionSize = Math.min(200, Math.floor(seq.length / 2));
    const forwardRegion = seq.substring(0, searchRegionSize);
    const forwardPrimers = this._findCandidatePrimersEfficient(
      forwardRegion,
      minLen,
      maxLen,
      targetTm,
      strictness,
      conditions
    );

    const reverseRegionStart = Math.max(0, seq.length - searchRegionSize);
    const reverseRegion = seq.substring(reverseRegionStart);

    const reverseCandidatesRaw = this._findCandidatePrimersEfficient(
      reverseRegion,
      minLen,
      maxLen,
      targetTm,
      strictness,
      conditions
    );

    const reversePrimers = reverseCandidatesRaw.map(cand => ({
      sequence: this.reverseComplement(cand.sequence),
      startPos: reverseRegionStart + cand.startPos,
      endPos: reverseRegionStart + cand.endPos,
      length: cand.length,
      tm: cand.tm,
      gcContent: cand.gcContent,
    }));

    const MAX_PAIRS = 50;
    for (const fp of forwardPrimers) {
      if (pairs.length >= MAX_PAIRS) break;
      for (const rp of reversePrimers) {
        const productSize = rp.endPos - fp.startPos;

        if (productSize >= minPropSize && productSize <= maxPropSize) {
          if (hasRequiredStart && fp.startPos > requiredAmpliconStart) {
            continue;
          }
          if (hasRequiredEnd && rp.endPos < requiredAmpliconEnd) {
            continue;
          }

          const tmDiff = Math.abs(fp.tm - rp.tm);
          if (tmDiff <= strictness.tmTol) {
            const extraUpstream = hasRequiredStart ? Math.max(0, requiredAmpliconStart - fp.startPos) : 0;
            const extraDownstream = hasRequiredEnd ? Math.max(0, rp.endPos - requiredAmpliconEnd) : 0;
            const designScore = tmDiff + (extraUpstream + extraDownstream) / 1000;
            pairs.push({
              forward: {
                sequence: fp.sequence,
                tm: fp.tm,
                gcContent: fp.gcContent,
                length: fp.length,
                bindStart: fp.startPos,
                bindEnd: fp.startPos + fp.length,
              },
              reverse: {
                sequence: rp.sequence,
                tm: rp.tm,
                gcContent: rp.gcContent,
                length: rp.length,
                bindStart: rp.endPos - rp.length,
                bindEnd: rp.endPos,
              },
              productSize: productSize,
              tmDifference: Number(tmDiff.toFixed(2)),
              designScore: Number(designScore.toFixed(4)),
            });
            if (pairs.length >= MAX_PAIRS) break;
          }
        }
      }
    }

    return pairs;
  }

  /**
   * Efficient candidate primer finder using sliding window for GC calculation.
   * Avoids calling calculateProperties() for every subsequence. Tm is the
   * canonical nearest-neighbor Tm: the target is an absolute temperature, so a
   * cheaper approximation here would silently shift every designed primer.
   */
  static _findCandidatePrimersEfficient(seq, minLen, maxLen, targetTm, strictness, conditions = null) {
    const reaction = conditions || this.resolveConditions();
    const { tmTol, gcMin, gcMax, requireGcClamp, avoidHairpin } = strictness;
    const MAX_CANDIDATES = 200;
    const candidates = [];

    for (let i = 0; i <= seq.length - minLen && candidates.length < MAX_CANDIDATES; i++) {
      let gcInWindow = 0;
      for (let k = i; k < i + minLen; k++) {
        const ch = seq[k];
        if (ch === 'G' || ch === 'C') gcInWindow++;
      }

      for (let len = minLen; len <= maxLen && i + len <= seq.length && candidates.length < MAX_CANDIDATES; len++) {
        if (len > minLen) {
          const addedChar = seq[i + len - 1];
          if (addedChar === 'G' || addedChar === 'C') gcInWindow++;
        }

        const gcContent = (gcInWindow / len) * 100;

        if (gcContent < gcMin || gcContent > gcMax) continue;

        const subSeq = seq.substring(i, i + len);
        const tm = this.calculateTm(subSeq, reaction);

        if (Math.abs(tm - targetTm) > tmTol) continue;

        if (requireGcClamp) {
          const lastChar = subSeq[subSeq.length - 1];
          if (lastChar !== 'G' && lastChar !== 'C') continue;
        }

        if (avoidHairpin && this.calculateHairpin(subSeq, reaction)?.flagged) continue;

        candidates.push({
          startPos: i,
          endPos: i + len,
          length: len,
          sequence: subSeq,
          tm: Number(tm.toFixed(2)),
          gcContent: Number(gcContent.toFixed(2)),
        });
      }
    }

    return candidates;
  }

  // ---------------------------------------------------------------------------
  // Nearest-Neighbor Thermodynamic Parameters
  // ---------------------------------------------------------------------------

  /**
   * Watson-Crick nearest-neighbor ΔH (kcal/mol) and ΔS (cal/mol·K) parameters.
   * Reference: SantaLucia, J. (1998). Proc Natl Acad Sci USA 95:1460-1465.
   * Key format: 5'-XY-3' / 3'-X'Y'-5' encoded as "XY" (primer dinucleotide, 5'→3').
   */
  static _NN_MATCH_PARAMS = {
    AA: { dH: -7.9, dS: -22.2 }, // AA/TT
    AT: { dH: -7.2, dS: -20.4 }, // AT/TA
    TA: { dH: -7.2, dS: -21.3 }, // TA/AT
    CA: { dH: -8.5, dS: -22.7 }, // CA/GT
    GT: { dH: -8.4, dS: -22.4 }, // GT/CA
    CT: { dH: -7.8, dS: -21.0 }, // CT/GA
    GA: { dH: -8.2, dS: -22.2 }, // GA/CT
    CG: { dH: -10.6, dS: -27.2 }, // CG/GC
    GC: { dH: -9.8, dS: -24.4 }, // GC/CG
    GG: { dH: -8.0, dS: -19.9 }, // GG/CC
    TT: { dH: -7.9, dS: -22.2 }, // TT/AA
    TG: { dH: -8.5, dS: -22.7 }, // TG/AC
    AC: { dH: -8.4, dS: -22.4 }, // AC/TG
    TC: { dH: -8.2, dS: -22.2 }, // TC/AG
    AG: { dH: -7.8, dS: -21.0 }, // AG/TC
    CC: { dH: -8.0, dS: -19.9 }, // CC/GG
  };

  /**
   * Internal single-mismatch nearest-neighbor ΔH/ΔS parameters.
   * References:
   *   - Allawi & SantaLucia (1997) Biochemistry 36:10581 (G·T mismatches)
   *   - Allawi & SantaLucia (1998a) Biochemistry 37:9435 (G·A mismatches)
   *   - Allawi & SantaLucia (1998b) Biochemistry 37:2170 (C·T mismatches)
   *   - Allawi & SantaLucia (1998c) Nucl Acids Res 26:2694 (A·C mismatches)
   *
   * Key format: "PrimerDinuc/TemplateDinuc" — the primer bases in 5'→3' over
   * the template bases in 3'→5' (antiparallel). Only internal mismatch contexts
   * are tabulated; terminal mismatches use a simplified penalty.
   *
   * Each entry replaces the matched NN parameter when a mismatch is present at
   * the junction between the two dinucleotide bases.
   */
  static _NN_MISMATCH_PARAMS = {
    // --- G·T (and T·G) mismatches ---
    'AG/TT': { dH: -0.9, dS: -4.3 },
    'AT/TG': { dH: -2.3, dS: -8.9 },
    'CG/GT': { dH: -5.2, dS: -15.4 },
    'CT/GG': { dH: -3.2, dS: -10.4 },
    'GG/CT': { dH: -4.1, dS: -11.7 },
    'GT/CG': { dH: -5.2, dS: -15.4 },
    'TG/AT': { dH: -2.3, dS: -8.9 },
    'TT/AG': { dH: -0.9, dS: -4.3 },
    // --- G·A (and A·G) mismatches ---
    'AA/TG': { dH: -0.6, dS: -2.3 },
    'AG/TA': { dH: -0.7, dS: -2.3 },
    'CA/GG': { dH: -0.7, dS: -2.3 },
    'CG/GA': { dH: -4.0, dS: -13.2 },
    'GA/CG': { dH: -0.6, dS: -1.0 },
    'GG/CA': { dH: 0.5, dS: 3.2 },
    'TA/AG': { dH: 0.7, dS: 0.7 },
    'TG/AA': { dH: 3.0, dS: 7.4 },
    // --- C·T (and T·C) mismatches ---
    'AC/TG': { dH: 0.7, dS: 0.2 },
    'AT/TC': { dH: -1.2, dS: -6.2 },
    'CC/GG': { dH: -0.8, dS: -4.5 },
    'CT/GC': { dH: -1.5, dS: -6.1 },
    'GC/CT': { dH: 2.3, dS: 5.4 },
    'GT/CC': { dH: 5.2, dS: 13.5 },
    'TC/AT': { dH: -1.2, dS: -6.2 },
    'TT/AC': { dH: 0.7, dS: 0.2 },
    // --- A·C (and C·A) mismatches ---
    'AA/TC': { dH: 2.3, dS: 4.6 },
    'AC/TA': { dH: 5.3, dS: 14.6 },
    'CA/GC': { dH: 1.9, dS: 3.7 },
    'CC/GA': { dH: 0.6, dS: -0.6 },
    'GA/CC': { dH: 5.2, dS: 14.2 },
    'GC/CA': { dH: -0.7, dS: -3.8 },
    'TA/AC': { dH: 3.4, dS: 8.0 },
    'TC/AA': { dH: 7.6, dS: 20.2 },
    // --- A·A mismatches ---
    'AA/TA': { dH: 1.2, dS: 1.7 },
    'CA/GA': { dH: -0.9, dS: -4.2 },
    'GA/CA': { dH: -2.9, dS: -9.8 },
    'TA/AA': { dH: 4.7, dS: 12.9 },
    // --- C·C mismatches ---
    'AC/TC': { dH: 0.0, dS: -4.4 },
    'CC/GC': { dH: -1.5, dS: -7.2 },
    'GC/CC': { dH: 3.6, dS: 8.9 },
    'TC/AC': { dH: 6.1, dS: 16.4 },
    // --- G·G mismatches ---
    'AG/TG': { dH: -3.1, dS: -9.5 },
    'CG/GG': { dH: -4.9, dS: -15.3 },
    'GG/CG': { dH: -6.0, dS: -15.8 },
    'TG/AG': { dH: 1.6, dS: 3.6 },
    // --- T·T mismatches ---
    'AT/TT': { dH: -2.7, dS: -10.8 },
    'CT/GT': { dH: -5.0, dS: -15.8 },
    'GT/CT': { dH: -2.2, dS: -8.4 },
    'TT/AT': { dH: 0.2, dS: -1.5 },
  };

  /**
   * Look up a single-mismatch stack. The table lists each context once; the same
   * stack read from the other strand ("XY/AB" rotated 180° is "BA/YX") covers the
   * mismatch-first orientation.
   */
  static _mismatchParams(key) {
    const direct = this._NN_MISMATCH_PARAMS[key];
    if (direct) return direct;
    const [top, bottom] = key.split('/');
    if (!top || !bottom || top.length !== 2 || bottom.length !== 2) return null;
    return this._NN_MISMATCH_PARAMS[`${bottom[1]}${bottom[0]}/${top[1]}${top[0]}`] || null;
  }

  /**
   * Position-dependent mismatch penalty weights (indexed from 3' end, 0-based).
   * A mismatch at the 3' terminal (index 0) is penalized most heavily because
   * DNA polymerase extends from the 3' hydroxyl — a terminal mismatch nearly
   * abolishes extension. Mismatches toward the 5' end primarily affect Tm/binding
   * stability but not polymerase extension.
   *
   * Reference: Primer-BLAST (Ye et al., 2012, BMC Bioinformatics 13:134)
   */
  static _POSITION_WEIGHTS = [
    10.0, // position 1 from 3' end (terminal) — near-complete extension block
    7.0, // position 2
    5.0, // position 3
    3.0, // position 4
    2.0, // position 5
  ];

  static _DEFAULT_POSITION_WEIGHT = 1.0; // positions 6+ (5' region)

  // ---------------------------------------------------------------------------
  // Binding Site Detection (Mismatch-Tolerant)
  // ---------------------------------------------------------------------------

  /**
   * Find binding sites for a primer in a template sequence with scientifically
   * rigorous mismatch tolerance.
   *
   * Uses position-dependent scoring (3' end weighted), optional nearest-neighbor
   * thermodynamic Tm estimation, and configurable filtering for 3' end specificity.
   *
   * @param {string} primer - The primer sequence (5'→3')
   * @param {string} template - The template sequence (e.g., a chromosome)
   * @param {number} maxMismatches - Maximum allowed total mismatches (default: 0)
   * @param {Object} options - Advanced options:
   *   @param {number} [options.maxSites=10000] - Maximum sites to return
   *   @param {number} [options.max3PrimeMismatches] - Max mismatches in last 5 bp at 3' end
   *   @param {number} [options.minBindingTm] - Minimum predicted binding Tm (°C) for inclusion
   *   @param {string} [options.scoringMode='fast'] - 'fast' (position-weighted Hamming) or
   *                   'thermodynamic' (includes nearest-neighbor Tm calculation)
   *   @param {number} [options.naConcentration=0.05] - Na⁺ concentration in M (default 50 mM)
   *   @param {number} [options.mgConcentration=0.0015] - Mg²⁺ concentration in M (default 1.5 mM)
   *   @param {number} [options.dntpConcentration=0.0006] - total dNTP concentration in M (default 0.6 mM)
   *   @param {number} [options.primerConcentration=250e-9] - Total primer concentration in M
   * @returns {Array} Array of binding site objects sorted by bindingScore (descending)
   */
  static findBindingSites(primer, template, maxMismatches = 3, options = {}) {
    if (!primer || !template) return [];

    const maxMM = maxMismatches !== undefined && maxMismatches !== null ? maxMismatches : 3;
    const maxSites = options.maxSites || 10000;
    const max3PrimeMM = Number.isFinite(options.max3PrimeMismatches) ? options.max3PrimeMismatches : 1;
    const minBindingTm = Number.isFinite(options.minBindingTm) ? options.minBindingTm : undefined;
    const scoringMode = options.scoringMode || 'fast';
    const conditions = this.resolveConditions(options);

    const pSeq = primer.toUpperCase().replace(/[^ATCG]/g, '');
    const tSeq = template.toUpperCase().replace(/[^ATCG]/g, '');
    const pRevComp = this.reverseComplement(pSeq);
    const pLen = pSeq.length;

    const sites = [];

    if (pLen === 0 || tSeq.length < pLen) return sites;

    // Scan both strands
    const strands = [
      { query: pSeq, label: '+' },
      { query: pRevComp, label: '-' },
    ];

    const exact = maxMM === 0;
    const lastStart = tSeq.length - pLen;
    const threePrimeStart = Math.max(0, pLen - 5);
    for (const { query, label } of strands) {
      let start = -1;
      while (sites.length < maxSites) {
        start = exact ? tSeq.indexOf(query, start + 1) : start + 1;
        if (start < 0 || start > lastStart) break;

        // Approximate matches can be ruled out sooner by checking the last
        // five positions first, where the mismatch limit is usually tighter.
        let mismatches = 0;
        let pass = true;
        if (!exact) {
          for (let j = pLen - 1; j >= 0; j--) {
            if (tSeq[start + j] === query[j]) continue;
            mismatches++;
            if (mismatches > maxMM || (j >= threePrimeStart && mismatches > max3PrimeMM)) {
              pass = false;
              break;
            }
          }
        }
        if (!pass) continue;

        const templateWindow = tSeq.substring(start, start + pLen);
        const quality = this._scoreMismatchQuality(query, templateWindow);

        // A negative 3' limit also excludes perfect matches.
        if (quality.threePrimeMismatches > max3PrimeMM) continue;

        // --- Phase 3: Thermodynamic analysis (optional) ---
        let bindingTm = null;
        let bindingDeltaG = null;

        if (scoringMode === 'thermodynamic' || minBindingTm !== undefined) {
          const thermo = this._calculateBindingTm(query, templateWindow, conditions);
          bindingTm = thermo.tm;
          bindingDeltaG = thermo.deltaG;

          // Filter by minimum Tm
          if (minBindingTm !== undefined && bindingTm < minBindingTm) {
            continue;
          }
        }

        // Assemble enriched result
        const site = {
          start,
          end: start + pLen,
          strand: label,
          mismatches: mismatches,
          sequence: templateWindow,
          primerSequence: pSeq,
          primerAlignedSequence: query,
          genomicSequence: templateWindow,
          // Enriched fields
          threePrimeMismatches: quality.threePrimeMismatches,
          terminalMismatch: quality.terminalMismatch,
          bindingScore: quality.bindingScore,
          mismatchDetails: quality.mismatchDetails,
        };

        if (bindingTm !== null) {
          site.bindingTm = Number(bindingTm.toFixed(1));
          site.bindingDeltaG = Number(bindingDeltaG.toFixed(2));
        }

        sites.push(site);
      }
    }

    if (sites.length >= maxSites) {
      sites.truncated = true;
      sites.totalMatchedAtLeast = maxSites;
    }

    // Sort by binding score (best matches first)
    sites.sort((a, b) => b.bindingScore - a.bindingScore);

    return sites;
  }

  /**
   * Score the quality of a primer-template alignment considering position-dependent
   * mismatch penalties, consecutive mismatches, and mismatch types.
   *
   * @param {string} primerSeq - Primer sequence (5'→3'), already uppercased
   * @param {string} templateWindowSeq - Template window (same length), already uppercased
   * @returns {Object} Mismatch quality analysis
   */
  static _scoreMismatchQuality(primerSeq, templateWindowSeq) {
    const pLen = primerSeq.length;
    const mismatchPositions = [];
    const mismatchDetails = [];
    let threePrimeMismatches = 0;
    let terminalMismatch = false;

    // Identify all mismatches
    for (let j = 0; j < pLen; j++) {
      if (primerSeq[j] !== templateWindowSeq[j]) {
        const posFrom3Prime = pLen - 1 - j; // 0 = 3' terminal

        if (posFrom3Prime < 5) {
          threePrimeMismatches++;
        }
        if (posFrom3Prime === 0) {
          terminalMismatch = true;
        }

        const primerBase = primerSeq[j];
        const templateBase = templateWindowSeq[j];
        const mmType = this._classifyMismatch(primerBase, templateBase);

        mismatchPositions.push(j);
        mismatchDetails.push({
          position: j, // 0-indexed from 5' end
          posFrom3Prime: posFrom3Prime, // 0-indexed from 3' end
          primer: primerBase,
          template: templateBase,
          type: mmType,
        });
      }
    }

    // Calculate binding score (0-100)
    const bindingScore = this._calculateBindingScore(pLen, mismatchDetails, mismatchPositions);

    return {
      totalMismatches: mismatchDetails.length,
      threePrimeMismatches,
      terminalMismatch,
      consecutiveRuns: this._maxConsecutiveRun(mismatchPositions),
      mismatchPositions,
      mismatchDetails,
      bindingScore,
    };
  }

  /**
   * Calculate a composite binding score (0-100) based on:
   * - Total mismatches (30% weight)
   * - 3' end mismatches with position-dependent penalties (35% weight)
   * - Consecutive mismatch penalty (10% weight)
   * - Mismatch type penalty: transversions penalized more than transitions (25% weight)
   *
   * A perfect match scores 100. Scores below ~30 indicate very unlikely binding.
   *
   * @param {number} primerLength - Length of the primer
   * @param {Array} mismatchDetails - Array of mismatch detail objects
   * @param {Array} mismatchPositions - Array of 0-indexed mismatch positions
   * @returns {number} Binding score (0-100), rounded to 1 decimal
   */
  static _calculateBindingScore(primerLength, mismatchDetails, mismatchPositions) {
    if (mismatchDetails.length === 0) return 100.0;

    // Component 1: Total mismatch penalty (30%)
    // Each mismatch costs proportional to primer length, capped at 100% penalty
    const totalMismatchPenalty = Math.min(1.0, mismatchDetails.length / (primerLength * 0.4));

    // Component 2: Position-dependent 3' end penalty (35%)
    // Weighted sum of position penalties normalized by max possible penalty
    let positionPenaltySum = 0;
    const maxPositionPenalty = this._POSITION_WEIGHTS[0]; // worst case: terminal mismatch
    for (const mm of mismatchDetails) {
      const idx = mm.posFrom3Prime;
      const weight = idx < this._POSITION_WEIGHTS.length ? this._POSITION_WEIGHTS[idx] : this._DEFAULT_POSITION_WEIGHT;
      positionPenaltySum += weight;
    }
    const positionPenalty = Math.min(1.0, positionPenaltySum / (maxPositionPenalty * 2));

    // Component 3: Consecutive mismatch penalty (10%)
    // Consecutive mismatches create destabilizing bubbles
    const maxRun = this._maxConsecutiveRun(mismatchPositions);
    const consecutivePenalty = maxRun >= 3 ? 1.0 : maxRun >= 2 ? 0.6 : 0.0;

    // Component 4: Mismatch type penalty (25%)
    // Transversions are more destabilizing than transitions
    let typePenaltySum = 0;
    for (const mm of mismatchDetails) {
      typePenaltySum += mm.type === 'transversion' ? 1.0 : 0.6;
    }
    const typePenalty = Math.min(1.0, typePenaltySum / (primerLength * 0.3));

    // Weighted composite
    const totalPenalty =
      totalMismatchPenalty * 0.3 + positionPenalty * 0.35 + consecutivePenalty * 0.1 + typePenalty * 0.25;

    const score = Math.max(0, (1.0 - totalPenalty) * 100);
    return Number(score.toFixed(1));
  }

  /**
   * Calculate predicted binding Tm for a (possibly mismatched) primer-template duplex
   * using the nearest-neighbor thermodynamic model.
   *
   * For matched positions, Watson-Crick NN parameters are used.
   * For mismatched positions, mismatch-specific NN parameters from Allawi & SantaLucia
   * are substituted. If a specific mismatch context is not in the table, a
   * conservative average penalty is applied.
   *
   * References:
   *   - SantaLucia & Hicks (2004) Annu Rev Biophys Biomol Struct 33:415
   *   - SantaLucia (1998) PNAS 95:1460 (entropy salt correction)
   *   - von Ahsen et al. (2001) Clin Chem 47:1956 (Mg2+/dNTP → Na+-equivalent)
   * This is Primer3's default model, so Tm agrees with primer3 calc_tm.
   *
   * @param {string} primerSeq - Primer sequence (5'→3'), uppercased ATCG only
   * @param {string} templateSeq - Template window (same length), uppercased ATCG only
   * @param {Object|number} [conditions] - reaction conditions; a number is read as the
   *   legacy Na⁺ concentration (M), with `legacyPrimerConc` as the oligo concentration
   * @param {number} [legacyPrimerConc] - oligo concentration in M (legacy signature only)
   * @returns {{tm: number, deltaG: number, deltaH: number, deltaS: number}}
   */
  static _calculateBindingTm(primerSeq, templateSeq, conditions = null, legacyPrimerConc = undefined) {
    const reaction =
      typeof conditions === 'number'
        ? this.resolveConditions({ naConcentration: conditions, primerConcentration: legacyPrimerConc })
        : this.resolveConditions(conditions || {});
    const primerConc = reaction.primerConcentration;
    const R = 1.987; // gas constant in cal/(mol·K)
    const pLen = primerSeq.length;

    // Initiation parameters (SantaLucia 1998)
    // +0.2 kcal/mol ΔH, -5.6 cal/mol·K ΔS initiation for duplex
    let totalDH = 0.2;
    let totalDS = -5.6;

    // Terminal A-T penalty: +2.2 kcal/mol ΔH, +6.9 cal/mol·K ΔS per terminal A-T pair
    if (primerSeq[0] === 'A' || primerSeq[0] === 'T') {
      totalDH += 2.2;
      totalDS += 6.9;
    }
    if (primerSeq[pLen - 1] === 'A' || primerSeq[pLen - 1] === 'T') {
      totalDH += 2.2;
      totalDS += 6.9;
    }

    // Build complement map for the template (as it would pair with primer)
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };

    for (let j = 0; j < pLen - 1; j++) {
      const primerDinuc = primerSeq[j] + primerSeq[j + 1];
      const isMismatchAt0 = primerSeq[j] !== templateSeq[j];
      const isMismatchAt1 = primerSeq[j + 1] !== templateSeq[j + 1];

      if (!isMismatchAt0 && !isMismatchAt1) {
        // Both positions match — use standard Watson-Crick NN params
        const nnKey = primerDinuc;
        const params = this._NN_MATCH_PARAMS[nnKey];
        if (params) {
          totalDH += params.dH;
          totalDS += params.dS;
        }
      } else {
        // At least one mismatch in this dinucleotide step
        // Build the mismatch lookup key: "PrimerDinuc/TemplateDinuc"
        // Template dinucleotide is read 3'→5' (antiparallel), which is the
        // complement of the template window 5'→3'
        const actualTemplate0 = complement[templateSeq[j]] || templateSeq[j];
        const actualTemplate1 = complement[templateSeq[j + 1]] || templateSeq[j + 1];
        const templateDinuc = actualTemplate0 + actualTemplate1;
        const mmKey = primerDinuc + '/' + templateDinuc;
        const mmParams = this._mismatchParams(mmKey);

        if (mmParams) {
          totalDH += mmParams.dH;
          totalDS += mmParams.dS;
        } else {
          // Fallback: average internal mismatch penalty
          // ~+1.0 kcal/mol ΔH, +1.0 cal/mol·K ΔS (destabilizing)
          totalDH += 1.0;
          totalDS += 1.0;
        }
      }
    }

    // Salt correction (SantaLucia 1998) on the Na+-equivalent of the buffer:
    // ΔS_corrected = ΔS + 0.368 × (N-1) × ln([Na⁺eq])
    const saltCorrection = 0.368 * (pLen - 1) * Math.log(this._sodiumEquivalent(reaction));
    const correctedDS = totalDS + saltCorrection;

    // Tm = ΔH / (ΔS + R × ln(C_T/x)) - 273.15, x = 4 for two different strands and
    // x = 1 (plus a -1.4 e.u. symmetry term) for a self-complementary duplex.
    const selfComplementary = primerSeq === templateSeq && primerSeq === this.reverseComplement(primerSeq);
    const symmetryDS = selfComplementary ? -1.4 : 0;
    const strandFactor = selfComplementary ? 1 : 4;
    const tm = (totalDH * 1000) / (correctedDS + symmetryDS + R * Math.log(primerConc / strandFactor)) - 273.15;

    // ΔG at 37°C
    const deltaG = totalDH - 310.15 * ((correctedDS + symmetryDS) / 1000);

    return {
      tm: Number.isFinite(tm) ? tm : 0,
      deltaG: Number.isFinite(deltaG) ? deltaG : 0,
      deltaH: totalDH,
      deltaS: correctedDS,
    };
  }

  /**
   * Classify a base mismatch as transition or transversion.
   * - Transitions: purine↔purine (A↔G) or pyrimidine↔pyrimidine (C↔T)
   *   → less destabilizing (wobble pairing possible)
   * - Transversions: purine↔pyrimidine (A↔C, A↔T, G↔C, G↔T reversed context)
   *   → more destabilizing
   *
   * @param {string} base1 - First base
   * @param {string} base2 - Second base
   * @returns {string} 'transition' or 'transversion'
   */
  static _classifyMismatch(base1, base2) {
    const purines = new Set(['A', 'G']);
    const sameClass = (purines.has(base1) && purines.has(base2)) || (!purines.has(base1) && !purines.has(base2));
    return sameClass ? 'transition' : 'transversion';
  }

  /**
   * Find the longest run of consecutive integers in a sorted array.
   * Used to detect consecutive mismatch runs (destabilizing bubbles).
   *
   * @param {Array<number>} positions - Sorted array of mismatch positions
   * @returns {number} Length of longest consecutive run (0 if empty)
   */
  static _maxConsecutiveRun(positions) {
    if (positions.length <= 1) return positions.length;

    let maxRun = 1;
    let currentRun = 1;
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] === positions[i - 1] + 1) {
        currentRun++;
        if (currentRun > maxRun) maxRun = currentRun;
      } else {
        currentRun = 1;
      }
    }
    return maxRun;
  }

  /**
   * Reverse complement a DNA sequence, supporting IUPAC ambiguity codes.
   */
  static reverseComplement(dna) {
    return dna
      .split('')
      .reverse()
      .map(base => IUPAC_COMPLEMENT[base] || base)
      .join('');
  }

  // --- Internal Helpers ---

  static _findCandidatePrimers(seq, minLen, maxLen, targetTm, strictness, conditions = null) {
    return this._findCandidatePrimersEfficient(seq, minLen, maxLen, targetTm, strictness, conditions).map(cand => ({
      sequence: cand.sequence,
      startPos: cand.startPos,
      length: cand.length,
      tm: cand.tm,
      gcContent: cand.gcContent,
    }));
  }

  // ---------------------------------------------------------------------------
  // Secondary structure: hairpins, dimers, 3' end
  // ---------------------------------------------------------------------------

  /**
   * ΔG°37 limits (kcal/mol) past which a structure is flagged. A structure whose
   * stem includes the primer's 3' terminus can be extended by the polymerase, so
   * it has the stricter limit. Values follow the common IDT / Premier Biosoft
   * guidance.
   */
  static STRUCTURE_THRESHOLDS = Object.freeze({
    hairpin3Prime: -2.0,
    hairpinInternal: -3.0,
    dimer3Prime: -5.0,
    dimerInternal: -6.0,
  });

  /** Hairpin loop initiation ΔG°37 (kcal/mol), SantaLucia & Hicks (2004) Table 4. */
  static _HAIRPIN_LOOP_DG = {
    3: 3.5,
    4: 3.5,
    5: 3.3,
    6: 4.0,
    7: 4.2,
    8: 4.3,
    9: 4.5,
    10: 4.6,
    12: 5.0,
    14: 5.1,
    16: 5.3,
    18: 5.5,
    20: 5.7,
    25: 6.1,
    30: 6.3,
  };

  /** Bimolecular duplex initiation ΔG°37 and terminal A·T penalty (SantaLucia & Hicks 2004). */
  static _DUPLEX_INIT_DG = 1.96;
  static _TERMINAL_AT_DG = 0.05;
  /**
   * Mean stabilisation (kcal/mol) a helix end gains from a neighbouring unpaired
   * nucleotide (dangling end or terminal mismatch). The per-context tables are not
   * modelled; this single value was calibrated so the median hairpin/dimer ΔG
   * matches Primer3's thermodynamic alignment on random 18–30-mers.
   */
  static _HELIX_END_DG = -0.8;
  static _WATSON_CRICK = { A: 'T', T: 'A', G: 'C', C: 'G' };

  static _cleanSequence(sequence) {
    return String(sequence || '')
      .toUpperCase()
      .replace(/[^ATCG]/g, '');
  }

  /** ΔG°37 of one Watson–Crick stack, with a per-stack entropy salt term. */
  static _stackDeltaG(dinucleotide, saltEntropyPerStack = 0) {
    const params = this._NN_MATCH_PARAMS[dinucleotide];
    if (!params) return 0;
    return params.dH - 310.15 * ((params.dS + saltEntropyPerStack) / 1000);
  }

  static _saltEntropyPerStack(conditions) {
    return 0.368 * Math.log(this._sodiumEquivalent(this.resolveConditions(conditions || {})));
  }

  static _terminalPenalty(base) {
    return base === 'A' || base === 'T' ? this._TERMINAL_AT_DG : 0;
  }

  /** Hairpin loop ΔG°37, extrapolated beyond the table with Jacobson–Stockmayer. */
  static _hairpinLoopDeltaG(loopLength) {
    const table = this._HAIRPIN_LOOP_DG;
    if (table[loopLength] !== undefined) return table[loopLength];
    const sizes = Object.keys(table)
      .map(Number)
      .sort((a, b) => a - b);
    let reference = sizes[0];
    for (const size of sizes) {
      if (size <= loopLength) reference = size;
    }
    return table[reference] + 2.44 * 0.0019872 * 310.15 * Math.log(loopLength / reference);
  }

  /**
   * Most stable single hairpin (perfect Watson–Crick stem of ≥3 bp closing a loop
   * of ≥3 nt). ΔG°37 = stem stacks + loop initiation + terminal A·T penalty.
   *
   * @returns {null|{deltaG:number, stemLength:number, loopLength:number, start:number,
   *   end:number, involves3Prime:boolean, flagged:boolean, dotBracket:string}}
   *   `start`/`end` are 0-based indices of the outer stem pair.
   */
  static calculateHairpin(sequence, options = {}) {
    const seq = this._cleanSequence(sequence);
    const n = seq.length;
    const minStem = 3;
    const minLoop = 3;
    if (n < 2 * minStem + minLoop || n > 200) return null;

    const wc = this._WATSON_CRICK;
    const salt = this._saltEntropyPerStack(options);
    let best = null;

    for (let i = 0; i < n; i++) {
      for (let j = n - 1; j - i + 1 >= 2 * minStem + minLoop; j--) {
        if (wc[seq[i]] !== seq[j]) continue;
        // Only start at an outer pair that cannot extend outward; the inner
        // sub-stems are visited while the stem grows below.
        if (i > 0 && j < n - 1 && wc[seq[i - 1]] === seq[j + 1]) continue;

        let stemDeltaG = this._terminalPenalty(seq[i]);
        for (let pairs = 1; ; pairs++) {
          const loopLength = j - i - 2 * pairs + 1;
          if (loopLength < minLoop) break;
          if (pairs > 1) {
            stemDeltaG += this._stackDeltaG(seq[i + pairs - 2] + seq[i + pairs - 1], salt);
          }
          if (pairs >= minStem) {
            const outerFlanked = i > 0 || j < n - 1;
            const deltaG =
              stemDeltaG +
              this._hairpinLoopDeltaG(loopLength) +
              this._HELIX_END_DG + // loop-closing pair always faces the loop
              (outerFlanked ? this._HELIX_END_DG : 0);
            if (!best || deltaG < best.deltaG) {
              best = { deltaG, stemLength: pairs, loopLength, start: i, end: j };
            }
          }
          const nextLoop = j - i - 2 * (pairs + 1) + 1;
          if (nextLoop < minLoop || wc[seq[i + pairs]] !== seq[j - pairs]) break;
        }
      }
    }

    if (!best) return null;
    const involves3Prime = best.end === n - 1;
    const limit = involves3Prime ? this.STRUCTURE_THRESHOLDS.hairpin3Prime : this.STRUCTURE_THRESHOLDS.hairpinInternal;
    const dotBracket = Array.from({ length: n }, (_, index) => {
      if (index >= best.start && index < best.start + best.stemLength) return '(';
      if (index <= best.end && index > best.end - best.stemLength) return ')';
      return '.';
    }).join('');
    return {
      deltaG: Number(best.deltaG.toFixed(2)),
      stemLength: best.stemLength,
      loopLength: best.loopLength,
      start: best.start,
      end: best.end,
      involves3Prime,
      flagged: best.deltaG < limit,
      dotBracket,
    };
  }

  /**
   * Most stable dimer between two oligos (self-dimer when both are the same).
   * Strands are aligned antiparallel at every offset; each contiguous run of
   * Watson–Crick pairs is scored as initiation + stacks + terminal A·T penalties.
   *
   * @returns {null|{deltaG:number, length:number, involves3Prime:boolean,
   *   flagged:boolean, alignment:string[]}} `alignment` is three display lines.
   */
  static calculateDimer(sequenceA, sequenceB = sequenceA, options = {}) {
    const a = this._cleanSequence(sequenceA);
    const b = this._cleanSequence(sequenceB);
    if (a.length < 2 || b.length < 2 || a.length > 300 || b.length > 300) return null;

    const wc = this._WATSON_CRICK;
    const salt = this._saltEntropyPerStack(options);
    const bReversed = b.split('').reverse().join(''); // 3'→5'
    let best = null;

    // a[i] faces bReversed[i - shift]. Walk each diagonal and score every segment
    // that starts and ends on a Watson–Crick pair; single internal mismatches are
    // bridged with the Allawi & SantaLucia mismatch stacks, two in a row end it.
    const isPair = (i, shift) => wc[a[i]] === bReversed[i - shift];
    const stepDeltaG = (x, shift) => {
      const p0 = isPair(x, shift);
      const p1 = isPair(x + 1, shift);
      if (p0 && p1) return this._stackDeltaG(a[x] + a[x + 1], salt);
      if (!p0 && !p1) return null;
      const params = this._mismatchParams(`${a[x]}${a[x + 1]}/${bReversed[x - shift]}${bReversed[x + 1 - shift]}`);
      if (!params) return null;
      return params.dH - 310.15 * ((params.dS + salt) / 1000);
    };

    for (let shift = -(bReversed.length - 1); shift <= a.length - 1; shift++) {
      const first = Math.max(0, shift);
      const last = Math.min(a.length - 1, bReversed.length - 1 + shift);
      for (let runStart = first; runStart < last; runStart++) {
        if (!isPair(runStart, shift)) continue;
        let sum = 0;
        for (let x = runStart; x < last; x++) {
          const step = stepDeltaG(x, shift);
          if (step === null) break;
          sum += step;
          const runEnd = x + 1;
          if (!isPair(runEnd, shift)) continue;
          const startFlanked = runStart > 0 || runStart - shift > 0;
          const endFlanked = runEnd < a.length - 1 || runEnd - shift < bReversed.length - 1;
          const deltaG =
            this._DUPLEX_INIT_DG +
            sum +
            this._terminalPenalty(a[runStart]) +
            this._terminalPenalty(a[runEnd]) +
            (startFlanked ? this._HELIX_END_DG : 0) +
            (endFlanked ? this._HELIX_END_DG : 0);
          if (!best || deltaG < best.deltaG) best = { deltaG, runStart, runEnd, shift };
        }
      }
    }

    if (!best) return null;
    const { runStart, runEnd, shift } = best;
    // a's 3' end is its last base; b's 3' end is bReversed[0].
    const involves3Prime = runEnd === a.length - 1 || runStart - shift === 0;
    const limit = involves3Prime ? this.STRUCTURE_THRESHOLDS.dimer3Prime : this.STRUCTURE_THRESHOLDS.dimerInternal;

    const padA = Math.max(0, -shift);
    const padB = Math.max(0, shift);
    let bars = ' '.repeat(padA + runStart);
    for (let i = runStart; i <= runEnd; i++) bars += wc[a[i]] === bReversed[i - shift] ? '|' : ' ';
    return {
      deltaG: Number(best.deltaG.toFixed(2)),
      length: runEnd - runStart + 1,
      involves3Prime,
      flagged: best.deltaG < limit,
      alignment: [`5' ${' '.repeat(padA)}${a} 3'`, `   ${bars}`, `3' ${' '.repeat(padB)}${bReversed} 5'`],
    };
  }

  /**
   * ΔG°37 (1 M Na⁺, Primer3 convention) of the duplex formed by the 3'-terminal
   * pentamer: how tightly the 3' end holds on its own. Very stable ends tolerate
   * internal mismatches and so prime off-target.
   */
  static calculateThreePrimeStability(sequence, bases = 5) {
    const seq = this._cleanSequence(sequence);
    if (seq.length < bases) return null;
    const end = seq.slice(-bases);
    let deltaG = this._DUPLEX_INIT_DG + this._terminalPenalty(end[0]) + this._terminalPenalty(end[end.length - 1]);
    for (let i = 0; i < end.length - 1; i++) deltaG += this._stackDeltaG(end[i] + end[i + 1]);
    return { deltaG: Number(deltaG.toFixed(2)), sequence: end };
  }

  /** Number of G/C among the 3'-terminal five bases. */
  static _threePrimeGcCount(sequence, bases = 5) {
    const end = this._cleanSequence(sequence).slice(-bases);
    return (end.match(/[GC]/g) || []).length;
  }

  /** Longest mononucleotide run and longest dinucleotide repeat (in repeat units). */
  static findRepeats(sequence) {
    const seq = this._cleanSequence(sequence);
    let longestRun = { base: '', length: 0 };
    for (let i = 0; i < seq.length; ) {
      let j = i;
      while (j < seq.length && seq[j] === seq[i]) j++;
      if (j - i > longestRun.length) longestRun = { base: seq[i], length: j - i };
      i = j;
    }
    let longestDinucleotide = { unit: '', repeats: 0 };
    for (let i = 0; i + 1 < seq.length; i++) {
      const unit = seq.slice(i, i + 2);
      if (unit[0] === unit[1]) continue;
      let repeats = 1;
      while (seq.slice(i + repeats * 2, i + repeats * 2 + 2) === unit) repeats++;
      if (repeats > longestDinucleotide.repeats) longestDinucleotide = { unit, repeats };
    }
    return { longestRun, longestDinucleotide };
  }

  /** Default thresholds for assessPrimerQuality(); override per call with `profile`. */
  static QUALITY_PROFILE = Object.freeze({
    tm: { optimal: [55, 65], acceptable: [50, 70] },
    gcContent: { optimal: [40, 60], acceptable: [30, 70] },
    length: { optimal: [18, 25], acceptable: [15, 30] },
    gcClamp: { optimal: [1, 3], acceptable: [1, 3] },
    maxMononucleotideRun: 4,
    maxDinucleotideRepeats: 4,
  });

  /**
   * One-stop primer QC used by the Primer Details panel. A 5' tail does not anneal
   * in the first cycles, so Tm, GC%, length and the 3' checks describe the
   * annealing region; hairpin and dimer checks use the full oligo because the
   * tail can still fold back or pair.
   *
   * @param {string} sequence - full oligo 5'→3' (including any 5' tail)
   * @param {Object} [options] - { fivePrimeTail, conditions, profile }
   */
  static assessPrimerQuality(sequence, options = {}) {
    const full = this._cleanSequence(sequence);
    if (!full) return null;
    const tail = this._cleanSequence(options.fivePrimeTail || '');
    const tailLength = tail && full.startsWith(tail) && tail.length < full.length ? tail.length : 0;
    const anneal = full.slice(tailLength);
    const conditions = this.resolveConditions(options.conditions || {});
    const profile = { ...this.QUALITY_PROFILE, ...(options.profile || {}) };

    const gcContent = ((anneal.match(/[GC]/g) || []).length / anneal.length) * 100;
    const tm = this.calculateTm(anneal, conditions);
    const fullTm = tailLength ? this.calculateTm(full, conditions) : null;
    const hairpin = this.calculateHairpin(full, conditions);
    const selfDimer = this.calculateDimer(full, full, conditions);
    const threePrimeStability = this.calculateThreePrimeStability(anneal);
    const gcClampCount = this._threePrimeGcCount(anneal);
    const repeats = this.findRepeats(anneal);

    const grade = (value, range) => {
      if (value >= range.optimal[0] && value <= range.optimal[1]) return 'good';
      if (value >= range.acceptable[0] && value <= range.acceptable[1]) return 'acceptable';
      return 'warning';
    };
    const fmtRange = (range, unit) => `${range[0]}–${range[1]}${unit}`;
    const checks = [];

    const tmStatus = grade(tm, profile.tm);
    checks.push({
      id: 'tm',
      label: tailLength ? 'Tm (annealing)' : 'Tm',
      value: tm,
      status: tmStatus,
      message:
        tmStatus === 'good'
          ? `Optimal (${fmtRange(profile.tm.optimal, ' °C')})`
          : tmStatus === 'acceptable'
            ? 'Acceptable'
            : tm < profile.tm.optimal[0]
              ? 'Low — may not anneal'
              : 'High — risk of mispriming',
    });

    const gcStatus = grade(gcContent, profile.gcContent);
    checks.push({
      id: 'gc',
      label: 'GC content',
      value: gcContent,
      status: gcStatus,
      message:
        gcStatus === 'good'
          ? `Optimal (${fmtRange(profile.gcContent.optimal, '%')})`
          : gcStatus === 'acceptable'
            ? 'Acceptable'
            : gcContent < profile.gcContent.optimal[0]
              ? 'AT-rich'
              : 'GC-rich',
    });

    const lengthStatus = grade(anneal.length, profile.length);
    checks.push({
      id: 'length',
      label: tailLength ? 'Length (annealing)' : 'Length',
      value: anneal.length,
      status: lengthStatus,
      message:
        lengthStatus === 'good'
          ? `Optimal (${fmtRange(profile.length.optimal, ' nt')})`
          : lengthStatus === 'acceptable'
            ? 'Acceptable'
            : anneal.length < profile.length.optimal[0]
              ? 'Too short'
              : 'Too long',
    });

    const clampStatus = grade(gcClampCount, profile.gcClamp);
    checks.push({
      id: 'gcClamp',
      label: "3' GC clamp",
      value: gcClampCount,
      status: clampStatus,
      message:
        gcClampCount === 0
          ? "No G/C in the last 5 bases — weak 3' end"
          : gcClampCount > profile.gcClamp.optimal[1]
            ? `${gcClampCount} G/C in the last 5 bases — mispriming risk`
            : `${gcClampCount} G/C in the last 5 bases`,
    });

    if (threePrimeStability) {
      checks.push({
        id: 'threePrimeStability',
        label: "3' end ΔG",
        value: threePrimeStability.deltaG,
        status: 'info',
        message: `Last 5 bases ${threePrimeStability.sequence}`,
      });
    }

    const structureCheck = (id, label, structure, describe) => {
      if (!structure) {
        checks.push({ id, label, value: null, status: 'good', message: 'None detected' });
        return;
      }
      checks.push({
        id,
        label,
        value: structure.deltaG,
        status: structure.flagged ? 'warning' : 'good',
        message: describe(structure),
        structure,
      });
    };
    structureCheck('hairpin', 'Hairpin', hairpin, h =>
      h.flagged
        ? `${h.stemLength} bp stem, ${h.loopLength} nt loop${h.involves3Prime ? " at the 3' end" : ''}`
        : 'Weak — not expected to form'
    );
    structureCheck('selfDimer', 'Self-dimer', selfDimer, d =>
      d.flagged ? `${d.length} bp${d.involves3Prime ? " involving the 3' end" : ''}` : 'Weak — not expected to form'
    );

    const run = repeats.longestRun;
    const di = repeats.longestDinucleotide;
    const runBad = run.length > profile.maxMononucleotideRun;
    const diBad = di.repeats > profile.maxDinucleotideRepeats;
    checks.push({
      id: 'repeats',
      label: 'Runs / repeats',
      value: Math.max(run.length, di.repeats),
      status: runBad || diBad ? 'warning' : 'good',
      message:
        runBad || diBad
          ? [runBad ? `${run.base} run of ${run.length}` : '', diBad ? `${di.unit} × ${di.repeats}` : '']
              .filter(Boolean)
              .join(', ')
          : `No run > ${profile.maxMononucleotideRun} nt or repeat > ${profile.maxDinucleotideRepeats}×`,
    });

    const statuses = checks.map(check => check.status);
    const overall = statuses.includes('warning') ? 'warning' : statuses.includes('acceptable') ? 'acceptable' : 'good';

    return {
      sequence: full,
      annealingSequence: anneal,
      tailLength,
      length: full.length,
      annealingLength: anneal.length,
      tm: Number(tm.toFixed(2)),
      fullTm: fullTm === null ? null : Number(fullTm.toFixed(2)),
      gcContent: Number(gcContent.toFixed(2)),
      hairpin,
      selfDimer,
      threePrimeStability,
      gcClampCount,
      repeats,
      conditions,
      conditionsLabel: this.describeConditions(conditions),
      checks,
      overall,
    };
  }

  /** @deprecated Boolean view of calculateHairpin(); kept for older callers. */
  static _checkHairpinPotential(seq) {
    return Boolean(this.calculateHairpin(seq)?.flagged);
  }
}

// Export for Node.js (MCP server) or make available globally for browser (ChatManager)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerDesigner;
}
if (typeof window !== 'undefined') {
  window.PrimerDesigner = PrimerDesigner;
}
