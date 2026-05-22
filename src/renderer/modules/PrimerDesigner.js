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
  /**
   * Calculate properties of a primer sequence
   * @param {string} sequence - DNA sequence of the primer
   * @returns {Object} Primer properties including length, GC%, and Tm
   */
  static calculateProperties(sequence) {
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

    const tm = this._calculateTm(seq, gCount, cCount, gcContent);

    const hasHairpinPotential = this._checkHairpinPotential(seq);

    const result = {
      sequence: seq,
      length: length,
      gcContent: Number(gcContent.toFixed(2)),
      tm: Number(tm.toFixed(2)),
      hasHairpinPotential: hasHairpinPotential,
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Unified Tm calculation using salt-adjusted formula with smooth transition.
   * For oligos < 14bp, blends Wallace rule with salt-adjusted to avoid discontinuity.
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
        { requiredAmpliconStart, requiredAmpliconEnd }
      );
      if (pairs && pairs.length > 0) {
        pairs.sort((a, b) => a.designScore - b.designScore);
        return pairs[0];
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
    const hasRequiredStart = Number.isFinite(requiredAmpliconStart);
    const hasRequiredEnd = Number.isFinite(requiredAmpliconEnd);

    const searchRegionSize = Math.min(200, Math.floor(seq.length / 2));
    const forwardRegion = seq.substring(0, searchRegionSize);
    const forwardPrimers = this._findCandidatePrimersEfficient(forwardRegion, minLen, maxLen, targetTm, strictness);

    const reverseRegionStart = Math.max(0, seq.length - searchRegionSize);
    const reverseRegion = seq.substring(reverseRegionStart);

    const reverseCandidatesRaw = this._findCandidatePrimersEfficient(
      reverseRegion,
      minLen,
      maxLen,
      targetTm,
      strictness
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
   * Avoids calling calculateProperties() for every subsequence.
   */
  static _findCandidatePrimersEfficient(seq, minLen, maxLen, targetTm, strictness) {
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
        const tm = this._calculateTm(subSeq, 0, 0, gcContent);

        if (Math.abs(tm - targetTm) > tmTol) continue;

        if (requireGcClamp) {
          const lastChar = subSeq[subSeq.length - 1];
          if (lastChar !== 'G' && lastChar !== 'C') continue;
        }

        if (avoidHairpin && this._checkHairpinPotential(subSeq)) continue;

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
    const naConc = Number.isFinite(options.naConcentration) ? options.naConcentration : 0.05;
    const primerConc = Number.isFinite(options.primerConcentration) ? options.primerConcentration : 250e-9;

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

    for (const { query, label } of strands) {
      for (let i = 0; i <= tSeq.length - pLen && sites.length < maxSites; i++) {
        // --- Phase 1: Quick Hamming distance with early exit ---
        let mismatches = 0;
        let pass = true;
        for (let j = 0; j < pLen; j++) {
          if (tSeq[i + j] !== query[j]) {
            mismatches++;
            if (mismatches > maxMM) {
              pass = false;
              break;
            }
          }
        }
        if (!pass) continue;

        const templateWindow = tSeq.substring(i, i + pLen);

        // --- Phase 2: Detailed mismatch quality scoring ---
        const quality = this._scoreMismatchQuality(query, templateWindow);

        // Apply 3' end filter
        if (max3PrimeMM !== undefined && quality.threePrimeMismatches > max3PrimeMM) {
          continue;
        }

        // --- Phase 3: Thermodynamic analysis (optional) ---
        let bindingTm = null;
        let bindingDeltaG = null;

        if (scoringMode === 'thermodynamic' || minBindingTm !== undefined) {
          const thermo = this._calculateBindingTm(query, templateWindow, naConc, primerConc);
          bindingTm = thermo.tm;
          bindingDeltaG = thermo.deltaG;

          // Filter by minimum Tm
          if (minBindingTm !== undefined && bindingTm < minBindingTm) {
            continue;
          }
        }

        // Assemble enriched result
        const site = {
          start: i,
          end: i + pLen,
          strand: label,
          mismatches: mismatches,
          sequence: templateWindow,
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
   *   - Owczarzy et al. (2004) Biochemistry 43:3537 (salt correction)
   *
   * @param {string} primerSeq - Primer sequence (5'→3'), uppercased ATCG only
   * @param {string} templateSeq - Template window (same length), uppercased ATCG only
   * @param {number} naConc - Na⁺ concentration in M
   * @param {number} primerConc - Total primer strand concentration in M
   * @returns {{tm: number, deltaG: number, deltaH: number, deltaS: number}}
   */
  static _calculateBindingTm(primerSeq, templateSeq, naConc = 0.05, primerConc = 250e-9) {
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
        const mmParams = this._NN_MISMATCH_PARAMS[mmKey];

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

    // Salt correction (Owczarzy et al. 2004)
    // ΔS_corrected = ΔS + 0.368 × (N-1) × ln([Na⁺])
    const saltCorrection = 0.368 * (pLen - 1) * Math.log(naConc);
    const correctedDS = totalDS + saltCorrection;

    // Tm = ΔH / (ΔS + R × ln(C_T/4)) - 273.15
    // For self-complementary: C_T/4, for non-self-complementary: C_T/4
    const tm = (totalDH * 1000) / (correctedDS + R * Math.log(primerConc / 4)) - 273.15;

    // ΔG at 37°C
    const deltaG = totalDH - 310.15 * (correctedDS / 1000);

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

  static _findCandidatePrimers(seq, minLen, maxLen, targetTm, strictness) {
    return this._findCandidatePrimersEfficient(seq, minLen, maxLen, targetTm, strictness).map(cand => ({
      sequence: cand.sequence,
      startPos: cand.startPos,
      length: cand.length,
      tm: cand.tm,
      gcContent: cand.gcContent,
    }));
  }

  static _checkHairpinPotential(seq, motifLen = 4, minLoop = 3) {
    const minTotalLen = motifLen + minLoop + motifLen;
    if (seq.length < minTotalLen) return false;

    for (let i = 0; i <= seq.length - minTotalLen; i++) {
      const motif = seq.substring(i, i + motifLen);
      const revComp = this.reverseComplement(motif);
      if (seq.substring(i + motifLen + minLoop).includes(revComp)) {
        return true;
      }
    }
    return false;
  }
}

// Export for Node.js (MCP server) or make available globally for browser (ChatManager)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerDesigner;
}
if (typeof window !== 'undefined') {
  window.PrimerDesigner = PrimerDesigner;
}
