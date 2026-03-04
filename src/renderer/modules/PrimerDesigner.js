/**
 * PrimerDesigner.js
 * Core engine for primer design, property calculation, and binding site analysis.
 * This class provides static utility methods used by both ChatBox and MCP server integrations.
 */

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

        const seq = sequence.toUpperCase().replace(/[^ATCG]/g, '');
        const length = seq.length;

        if (length === 0) {
            throw new Error('Sequence contains no valid DNA characters');
        }

        // Calculate GC content
        const gCount = (seq.match(/G/g) || []).length;
        const cCount = (seq.match(/C/g) || []).length;
        const gcContent = ((gCount + cCount) / length) * 100;

        // Calculate Melting Temperature (Tm)
        // Using the same logic from MicrobeGenomicsFunctions but extracted here for specialized use
        let tm;
        if (length < 14) {
            // Wallace rule for short oligos: Tm = 2°C(A+T) + 4°C(G+C)
            const aCount = (seq.match(/A/g) || []).length;
            const tCount = (seq.match(/T/g) || []).length;
            tm = 2 * (aCount + tCount) + 4 * (gCount + cCount);
        } else {
            // Simple salt-adjusted formula for longer oligos
            tm = 81.5 + 0.41 * gcContent - 675 / length;
        }

        // Check for potential self-complementarity (simple hairpin check)
        // A more complex implementation would use nearest-neighbor thermodynamics
        const hasHairpinPotential = this._checkHairpinPotential(seq);

        return {
            sequence: seq,
            length: length,
            gcContent: Number(gcContent.toFixed(2)),
            tm: Number(tm.toFixed(2)),
            hasHairpinPotential: hasHairpinPotential
        };
    }

    /**
     * Design a primer pair for a given target sequence
     * @param {string} targetSequence - The DNA sequence to amplify
     * @param {Object} options - Design parameters (targetTm, minLen, maxLen)
     * @returns {Object} Best primer pair found, or null if none match criteria
     */
    static designPrimerPair(targetSequence, options = {}) {
        if (!targetSequence || targetSequence.length < 50) {
            throw new Error('Target sequence must be at least 50bp to design primers');
        }

        const seq = targetSequence.toUpperCase().replace(/[^ATCG]/g, '');

        // Default parameters
        const targetTm = options.targetTm || 60.0;
        const tmTolerance = options.tmTolerance || 2.0; // Allowed difference from target Tm (and between pair)
        const minLen = options.minLen || 18;
        const maxLen = options.maxLen || 25;
        const minPropSize = options.minProductSize || Math.min(seq.length, 100);
        const maxPropSize = options.maxProductSize || seq.length;

        const pairs = [];
        const forwardPrimers = this._findCandidatePrimers(seq.substring(0, Math.floor(seq.length / 2)), minLen, maxLen, targetTm, tmTolerance);

        // For reverse primers, we look at the end of the sequence, but we need their reverse complement
        const reverseRegionStart = Math.max(0, seq.length - Math.floor(seq.length / 2));
        const reverseRegion = seq.substring(reverseRegionStart);

        // Find candidates on the reverse strand (by finding them on the forward strand and reverse complementing)
        // Note: Candidates are found 5' -> 3' on the bottom strand, which means reading the top strand right-to-left
        const reverseCandidatesRaw = this._findCandidatePrimersRaw(reverseRegion, minLen, maxLen, targetTm, tmTolerance);

        const reversePrimers = reverseCandidatesRaw.map(cand => ({
            sequence: this.reverseComplement(cand.sequence),
            startPos: reverseRegionStart + cand.startPos,
            endPos: reverseRegionStart + cand.endPos,
            length: cand.length,
            tm: cand.tm,
            gcContent: cand.gcContent
        }));

        // Find pairs that meet product size criteria and have similar Tm
        for (const fp of forwardPrimers) {
            for (const rp of reversePrimers) {
                // rp.endPos is the 5' end of the reverse primer on the bottom strand
                // which corresponds to the 3' end on the top strand.
                // Product size = rp.endPos - fp.startPos
                const productSize = rp.endPos - fp.startPos;

                if (productSize >= minPropSize && productSize <= maxPropSize) {
                    const tmDiff = Math.abs(fp.tm - rp.tm);
                    if (tmDiff <= tmTolerance) {
                        pairs.push({
                            forward: {
                                sequence: fp.sequence,
                                tm: fp.tm,
                                gcContent: fp.gcContent,
                                length: fp.length,
                                bindStart: fp.startPos,
                                bindEnd: fp.startPos + fp.length
                            },
                            reverse: {
                                sequence: rp.sequence,
                                tm: rp.tm,
                                gcContent: rp.gcContent,
                                length: rp.length,
                                bindStart: rp.endPos - rp.length,
                                bindEnd: rp.endPos
                            },
                            productSize: productSize,
                            tmDifference: Number(tmDiff.toFixed(2))
                        });
                    }
                }
            }
        }

        // Sort by smallest Tm difference
        pairs.sort((a, b) => a.tmDifference - b.tmDifference);

        return pairs.length > 0 ? pairs[0] : null;
    }

    /**
     * Find binding sites for a primer in a template sequence
     * @param {string} primer - The primer sequence
     * @param {string} template - The template sequence (e.g., a chromosome)
     * @param {number} maxMismatches - Maximum allowed mismatches
     * @returns {Array} Array of binding site objects with position, strand, and mismatch count
     */
    static findBindingSites(primer, template, maxMismatches = 0) {
        if (!primer || !template) return [];

        const pSeq = primer.toUpperCase().replace(/[^ATCG]/g, '');
        const tSeq = template.toUpperCase().replace(/[^ATCG]/g, '');
        const pRevComp = this.reverseComplement(pSeq);
        const pLen = pSeq.length;

        const sites = [];

        if (pLen === 0 || tSeq.length < pLen) return sites;

        // Search forward strand
        for (let i = 0; i <= tSeq.length - pLen; i++) {
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
                    sequence: tSeq.substring(i, i + pLen)
                });
            }
        }

        // Search reverse strand using reverse complement of primer
        for (let i = 0; i <= tSeq.length - pLen; i++) {
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
                    sequence: tSeq.substring(i, i + pLen)
                });
            }
        }

        return sites;
    }

    /**
     * Reverse complement a DNA sequence
     */
    static reverseComplement(dna) {
        const complement = {
            A: 'T', T: 'A', G: 'C', C: 'G',
            a: 't', t: 'a', g: 'c', c: 'g',
            N: 'N', n: 'n'
        };
        return dna.split('').reverse().map(base => complement[base] || base).join('');
    }

    // --- Internal Helpers ---

    static _findCandidatePrimers(seq, minLen, maxLen, targetTm, tmTolerance) {
        return this._findCandidatePrimersRaw(seq, minLen, maxLen, targetTm, tmTolerance).map(cand => ({
            sequence: seq.substring(cand.startPos, cand.startPos + cand.length),
            startPos: cand.startPos,
            length: cand.length,
            tm: cand.tm,
            gcContent: cand.gcContent
        }));
    }

    static _findCandidatePrimersRaw(seq, minLen, maxLen, targetTm, tmTolerance) {
        const candidates = [];
        for (let i = 0; i <= seq.length - minLen; i++) {
            for (let len = minLen; len <= maxLen && i + len <= seq.length; len++) {
                const subSeq = seq.substring(i, i + len);
                const props = this.calculateProperties(subSeq);

                // Basic filters: Tm near target, GC% reasonable (40-60%), ending in G or C (GC clamp)
                if (Math.abs(props.tm - targetTm) <= tmTolerance &&
                    props.gcContent >= 40 && props.gcContent <= 60 &&
                    (subSeq.endsWith('G') || subSeq.endsWith('C')) &&
                    !props.hasHairpinPotential) {

                    candidates.push({
                        startPos: i,
                        endPos: i + len,
                        length: len,
                        sequence: subSeq,
                        tm: props.tm,
                        gcContent: props.gcContent
                    });
                }
            }
        }
        return candidates;
    }

    static _checkHairpinPotential(seq) {
        // Simple check: looking for inverted repeats of length >= 4 separated by loop >= 3
        for (let i = 0; i <= seq.length - 11; i++) {
            const motif = seq.substring(i, i + 4);
            const revComp = this.reverseComplement(motif);
            // Look for the reverse complement further down the sequence (leaving a loop of at least 3 bp)
            if (seq.substring(i + 7).includes(revComp)) {
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
