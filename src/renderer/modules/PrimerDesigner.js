/**
 * PrimerDesigner.js
 * Core engine for primer design, property calculation, and binding site analysis.
 * This class provides static utility methods used by both ChatBox and MCP server integrations.
 */

const IUPAC_COMPLEMENT = {
  A: 'T', T: 'A', G: 'C', C: 'G',
  R: 'Y', Y: 'R', M: 'K', K: 'M',
  S: 'S', W: 'W', B: 'V', D: 'H',
  H: 'D', V: 'B', N: 'N',
  a: 't', t: 'a', g: 'c', c: 'g',
  r: 'y', y: 'r', m: 'k', k: 'm',
  s: 's', w: 'w', b: 'v', d: 'h',
  h: 'd', v: 'b', n: 'n',
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
          `Sequence contains ${(invalidRatio * 100).toFixed(1)}% non-ATCG characters (${invalidChars.substring(0, 20)}...). ` +
                `Only A, T, C, G are supported for primer calculations.`,
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

    const targetTm = options.targetTm || 60.0;
    const baseTmTolerance = options.tmTolerance || 2.0;
    const minLen = options.minLen || 18;
    const maxLen = options.maxLen || 25;
    const minPropSize = options.minProductSize || Math.min(seq.length, 100);
    const maxPropSize = options.maxProductSize || seq.length;

    const strictnessLevels = [
      {tmTol: baseTmTolerance, gcMin: 40, gcMax: 60, requireGcClamp: true, avoidHairpin: true},
      {tmTol: baseTmTolerance + 2.0, gcMin: 35, gcMax: 65, requireGcClamp: true, avoidHairpin: true},
      {tmTol: baseTmTolerance + 5.0, gcMin: 30, gcMax: 70, requireGcClamp: false, avoidHairpin: true},
      {tmTol: baseTmTolerance + 10.0, gcMin: 20, gcMax: 80, requireGcClamp: false, avoidHairpin: false},
    ];

    for (const strictness of strictnessLevels) {
      const pairs = this._findPrimerPairsWithStrictness(seq, minLen, maxLen, targetTm, minPropSize, maxPropSize, strictness);
      if (pairs && pairs.length > 0) {
        pairs.sort((a, b) => a.tmDifference - b.tmDifference);
        return pairs[0];
      }
    }

    return null;
  }

  static _findPrimerPairsWithStrictness(seq, minLen, maxLen, targetTm, minPropSize, maxPropSize, strictness) {
    const pairs = [];

    const searchRegionSize = Math.min(200, Math.floor(seq.length / 2));
    const forwardRegion = seq.substring(0, searchRegionSize);
    const forwardPrimers = this._findCandidatePrimersEfficient(forwardRegion, minLen, maxLen, targetTm, strictness);

    const reverseRegionStart = Math.max(0, seq.length - searchRegionSize);
    const reverseRegion = seq.substring(reverseRegionStart);

    const reverseCandidatesRaw = this._findCandidatePrimersEfficient(reverseRegion, minLen, maxLen, targetTm, strictness);

    const reversePrimers = reverseCandidatesRaw.map((cand) => ({
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
          const tmDiff = Math.abs(fp.tm - rp.tm);
          if (tmDiff <= strictness.tmTol) {
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
    const {tmTol, gcMin, gcMax, requireGcClamp, avoidHairpin} = strictness;
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

  /**
     * Find binding sites for a primer in a template sequence
     * @param {string} primer - The primer sequence
     * @param {string} template - The template sequence (e.g., a chromosome)
     * @param {number} maxMismatches - Maximum allowed mismatches
     * @param {Object} options - Optional: { maxSites: number } to limit results
     * @returns {Array} Array of binding site objects with position, strand, and mismatch count
     */
  static findBindingSites(primer, template, maxMismatches = 0, options = {}) {
    if (!primer || !template) return [];

    const maxSites = options.maxSites || 10000;

    const pSeq = primer.toUpperCase().replace(/[^ATCG]/g, '');
    const tSeq = template.toUpperCase().replace(/[^ATCG]/g, '');
    const pRevComp = this.reverseComplement(pSeq);
    const pLen = pSeq.length;

    const sites = [];

    if (pLen === 0 || tSeq.length < pLen) return sites;

    for (let i = 0; i <= tSeq.length - pLen && sites.length < maxSites; i++) {
      let mismatches = 0;
      for (let j = 0; j < pLen; j++) {
        if (tSeq[i + j] !== pSeq[j]) {
          mismatches++;
          if (mismatches > maxMismatches) break;
        }
      }
      if (mismatches <= maxMismatches) {
        sites.push({
          start: i,
          end: i + pLen,
          strand: '+',
          mismatches: mismatches,
          sequence: tSeq.substring(i, i + pLen),
        });
      }
    }

    for (let i = 0; i <= tSeq.length - pLen && sites.length < maxSites; i++) {
      let mismatches = 0;
      for (let j = 0; j < pLen; j++) {
        if (tSeq[i + j] !== pRevComp[j]) {
          mismatches++;
          if (mismatches > maxMismatches) break;
        }
      }
      if (mismatches <= maxMismatches) {
        sites.push({
          start: i,
          end: i + pLen,
          strand: '-',
          mismatches: mismatches,
          sequence: tSeq.substring(i, i + pLen),
        });
      }
    }

    if (sites.length >= maxSites) {
      sites.truncated = true;
      sites.totalMatchedAtLeast = maxSites;
    }

    return sites;
  }

  /**
     * Reverse complement a DNA sequence, supporting IUPAC ambiguity codes.
     */
  static reverseComplement(dna) {
    return dna.split('').reverse().map((base) => IUPAC_COMPLEMENT[base] || base).join('');
  }

  // --- Internal Helpers ---

  static _findCandidatePrimers(seq, minLen, maxLen, targetTm, strictness) {
    return this._findCandidatePrimersEfficient(seq, minLen, maxLen, targetTm, strictness).map((cand) => ({
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
} else if (typeof window !== 'undefined') {
  window.PrimerDesigner = PrimerDesigner;
}
