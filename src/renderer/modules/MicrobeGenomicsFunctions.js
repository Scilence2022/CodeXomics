/*
 * MicrobeGenomicsFunctions.js
 * -------------------------------------------------------------
 * A lightweight façade exposing *very basic* function calls for
 * common microbe-genomics tasks.  Each function is intentionally
 * simple (do one thing and return a result) so LLM chains / agents
 * can combine them to perform complex analyses.
 *
 * ❶ Navigation      – move to / query genomic regions
 * ❷ Analysis        – compute simple statistics on sequences
 * ❸ Calculation     – arithmetic helpers (coverage, depth, etc.)
 * ❹ Prediction      – naïve motif / feature predictions
 * ❺ Search          – locate genes / features / motifs
 * ❻ Editing         – modify existing annotations
 * ❼ Addition        – add new sequences / tracks / annotations
 * -------------------------------------------------------------
 * All functions are PURE (no UI side-effects) unless explicitly
 * named "navigate…" or "edit…/add…" (which do mutate state).
 * -------------------------------------------------------------
 * USAGE EXAMPLE (pseudo-code / LLM chain):
 *    // Complex task: For gene "dnaA" predict promoter and GC% 200bp upstream
 *    const gene = MicrobeFns.searchGeneByName('dnaA');
 *    const upstream = MicrobeFns.getUpstreamRegion(gene, 200);
 *    const gcPct   = MicrobeFns.computeGC(upstream.sequence);
 *    const promo   = MicrobeFns.predictPromoter(upstream.sequence);
 *    MicrobeFns.addAnnotation(upstream.chrom, promo);
 *    MicrobeFns.navigateTo(upstream.chrom, upstream.start, upstream.end);
 */

class MicrobeGenomicsFunctions {
  /* --------------------------------------------------------- */
  /*  NAVIGATION  (delegated to NavigationManager)             */
  /* --------------------------------------------------------- */

  static _getNavManager() {
    const gb = window.genomeBrowser;
    if (!gb || !gb.navigationManager) throw new Error('NavigationManager not available');
    return gb.navigationManager;
  }

  static parseZoomFactor(value) {
    return this._getNavManager().parseZoomFactor(value);
  }

  static navigateTo(chromosome, start, end) {
    return this._getNavManager().navigateToPosition(chromosome, start, end);
  }

  static jumpToGene(geneName) {
    return this._getNavManager().jumpToGene(geneName);
  }

  static getCurrentRegion() {
    return this._getNavManager().getCurrentRegion();
  }

  static scrollLeft(bp = 1000) {
    return this._getNavManager().scrollLeft(bp);
  }

  static scrollRight(bp = 1000) {
    return this._getNavManager().scrollRight(bp);
  }

  static zoomIn(factor = 2) {
    return this._getNavManager().zoomIn(factor);
  }

  static zoomOut(factor = 2) {
    return this._getNavManager().zoomOut(factor);
  }

  /* --------------------------------------------------------- */
  /*  ANALYSIS                                                */
  /* --------------------------------------------------------- */

  /**
   * Compute GC percentage for a DNA sequence
   * @param {string} dna - DNA sequence string
   * @returns {number} GC percentage (0-100)
   */
  static computeGC(dna) {
    // Use unified sequence processing implementation
    if (window.UnifiedSequenceProcessing) {
      const result = window.UnifiedSequenceProcessing.legacyComputeGC(dna);
      return result;
    }

    // Fallback to original implementation if unified module not available
    if (!dna || typeof dna !== 'string') return 0;
    const g = (dna.match(/G/gi) || []).length;
    const c = (dna.match(/C/gi) || []).length;
    const valid = g + c + (dna.match(/[AT]/gi) || []).length;
    return valid === 0 ? 0 : ((g + c) / valid) * 100;
  }

  /**
   * Get reverse complement of DNA sequence
   * @param {string} dna - DNA sequence
   * @returns {string} Reverse complement sequence
   */
  static reverseComplement(dna) {
    if (!dna || typeof dna !== 'string') return '';
    // Use unified sequence processing implementation
    if (window.UnifiedSequenceProcessing) {
      const result = window.UnifiedSequenceProcessing.legacyReverseComplement(dna);
      return result;
    }

    // Fallback to original implementation if unified module not available
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
    return dna
      .toUpperCase()
      .split('')
      .reverse()
      .map(base => complement[base] || 'N')
      .join('');
  }

  /**
   * Translate DNA sequence to protein (single frame)
   * @param {string} dna - DNA sequence (should be in frame)
   * @param {number} frame - Reading frame (0, 1, or 2)
   * @returns {string} Amino acid sequence
   */
  static translateDNA(dna, frame = 0) {
    if (!dna || typeof dna !== 'string') return '';
    // Use unified translation implementation
    if (window.UnifiedDNATranslation) {
      const result = window.UnifiedDNATranslation.legacyTranslateDNA(dna, frame);
      return result;
    }

    // Fallback to original implementation if unified module not available
    const codonTable = {
      TTT: 'F',
      TTC: 'F',
      TTA: 'L',
      TTG: 'L',
      TCT: 'S',
      TCC: 'S',
      TCA: 'S',
      TCG: 'S',
      TAT: 'Y',
      TAC: 'Y',
      TAA: '*',
      TAG: '*',
      TGT: 'C',
      TGC: 'C',
      TGA: '*',
      TGG: 'W',
      CTT: 'L',
      CTC: 'L',
      CTA: 'L',
      CTG: 'L',
      CCT: 'P',
      CCC: 'P',
      CCA: 'P',
      CCG: 'P',
      CAT: 'H',
      CAC: 'H',
      CAA: 'Q',
      CAG: 'Q',
      CGT: 'R',
      CGC: 'R',
      CGA: 'R',
      CGG: 'R',
      ATT: 'I',
      ATC: 'I',
      ATA: 'I',
      ATG: 'M',
      ACT: 'T',
      ACC: 'T',
      ACA: 'T',
      ACG: 'T',
      AAT: 'N',
      AAC: 'N',
      AAA: 'K',
      AAG: 'K',
      AGT: 'S',
      AGC: 'S',
      AGA: 'R',
      AGG: 'R',
      GTT: 'V',
      GTC: 'V',
      GTA: 'V',
      GTG: 'V',
      GCT: 'A',
      GCC: 'A',
      GCA: 'A',
      GCG: 'A',
      GAT: 'D',
      GAC: 'D',
      GAA: 'E',
      GAG: 'E',
      GGT: 'G',
      GGC: 'G',
      GGA: 'G',
      GGG: 'G',
    };

    const sequence = dna.toUpperCase().slice(frame);
    let protein = '';
    for (let i = 0; i < sequence.length - 2; i += 3) {
      const codon = sequence.substr(i, 3);
      protein += codonTable[codon] || 'X';
    }
    return protein;
  }

  /**
   * Find Open Reading Frames (ORFs) in a sequence
   * @param {string} dna - DNA sequence
   * @param {number} minLength - Minimum ORF length in codons (default: 30)
   * @returns {Array} Array of ORF objects {start, end, frame, sequence}
   */
  static findORFs(dna, minLength = 30) {
    if (!dna || typeof dna !== 'string') return [];
    const orfs = [];
    const startCodons = ['ATG'];
    const stopCodons = ['TAA', 'TAG', 'TGA'];

    // Check all 6 reading frames (3 forward, 3 reverse)
    for (let strand = 0; strand < 2; strand++) {
      const seq = strand === 0 ? dna.toUpperCase() : this.reverseComplement(dna);

      for (let frame = 0; frame < 3; frame++) {
        for (let i = frame; i < seq.length - 2; i += 3) {
          const codon = seq.substr(i, 3);

          if (startCodons.includes(codon)) {
            // Found start codon, look for stop codon
            for (let j = i + 3; j < seq.length - 2; j += 3) {
              const stopCodon = seq.substr(j, 3);
              if (stopCodons.includes(stopCodon)) {
                const orfLength = (j - i) / 3;
                if (orfLength >= minLength) {
                  orfs.push({
                    start: strand === 0 ? i + 1 : dna.length - j,
                    end: strand === 0 ? j + 3 : dna.length - i + 1,
                    frame: strand === 0 ? frame + 1 : -(frame + 1),
                    length: orfLength,
                    sequence: seq.substr(i, j - i + 3),
                  });
                }
                break;
              }
            }
          }
        }
      }
    }
    return orfs.sort((a, b) => a.start - b.start);
  }

  /**
   * Calculate sequence entropy (complexity measure)
   * @param {string} sequence - DNA/RNA sequence
   * @returns {number} Shannon entropy value
   */
  static calculateEntropy(sequence) {
    if (!sequence || typeof sequence !== 'string') return 0;
    const counts = {};
    for (const base of sequence.toUpperCase()) {
      counts[base] = (counts[base] || 0) + 1;
    }

    const length = sequence.length;
    let entropy = 0;
    for (const count of Object.values(counts)) {
      const p = count / length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  /* --------------------------------------------------------- */
  /*  CALCULATION                                             */
  /* --------------------------------------------------------- */

  /**
   * Compute GC% for a genomic region
   * @param {string} chromosome - Chromosome name
   * @param {number} start - Start position
   * @param {number} end - End position
   * @returns {number} GC percentage
   */
  static calcRegionGC(chromosome, start, end) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.currentSequence[chromosome]) return 0;
    const seq = gb.currentSequence[chromosome].substring(start, end);
    return this.computeGC(seq);
  }

  /**
   * Calculate melting temperature of DNA sequence
   * @param {string} dna - DNA sequence
   * @returns {number} Estimated melting temperature in Celsius
   */
  static calculateMeltingTemp(dna) {
    if (!dna || typeof dna !== 'string') return 0;
    if (dna.length < 14) {
      // For short sequences, use simple formula
      const a = (dna.match(/[AT]/gi) || []).length;
      const gc = (dna.match(/[GC]/gi) || []).length;
      return 2 * a + 4 * gc;
    } else {
      // For longer sequences, use more accurate formula
      const gc = this.computeGC(dna);
      return 81.5 + 0.41 * gc - 675 / dna.length;
    }
  }

  /**
   * Calculate molecular weight of DNA sequence
   * @param {string} dna - DNA sequence
   * @returns {number} Molecular weight in Daltons
   */
  static calculateMolecularWeight(dna) {
    if (!dna || typeof dna !== 'string') return 0;
    const weights = { A: 331.2, T: 322.2, G: 347.2, C: 307.2 };
    let weight = 0;
    for (const base of dna.toUpperCase()) {
      weight += weights[base] || 0;
    }
    return weight - (dna.length - 1) * 18.01; // Subtract water molecules
  }

  /**
   * Analyze codon usage in a coding sequence
   * @param {string} dna - DNA coding sequence
   * @returns {Object} Codon usage statistics
   */
  static analyzeCodonUsage(dna) {
    if (!dna || typeof dna !== 'string') return {};
    const codonCounts = {};
    const sequence = dna.toUpperCase();

    for (let i = 0; i < sequence.length - 2; i += 3) {
      const codon = sequence.substr(i, 3);
      if (codon.length === 3 && !/N/.test(codon)) {
        codonCounts[codon] = (codonCounts[codon] || 0) + 1;
      }
    }

    const totalCodons = Object.values(codonCounts).reduce((a, b) => a + b, 0);
    const codonFreqs = {};
    for (const [codon, count] of Object.entries(codonCounts)) {
      codonFreqs[codon] = count / totalCodons;
    }

    return { counts: codonCounts, frequencies: codonFreqs, total: totalCodons };
  }

  /* --------------------------------------------------------- */
  /*  PREDICTION                                              */
  /* --------------------------------------------------------- */

  /**
   * Simple promoter prediction based on -10 box (TATAAT motif)
   * @param {string} seq - DNA sequence to scan
   * @param {RegExp} motif - Promoter motif pattern (default: TATAAT)
   * @returns {Object|null} Promoter prediction or null
   */
  static predictPromoter(seq, motif = /TATAAT/i) {
    const idx = seq.search(motif);
    return idx === -1 ? null : { type: 'promoter_pred', start: idx + 1, end: idx + 6, confidence: 0.5 };
  }

  /**
   * Predict Shine-Dalgarno sequences (ribosome binding sites)
   * @param {string} seq - DNA sequence upstream of coding region
   * @returns {Array} Array of predicted RBS sites
   */
  static predictRBS(seq) {
    const sdMotifs = [/AGGAGG/gi, /AGGAG/gi, /GGAGG/gi];
    const sites = [];

    for (const motif of sdMotifs) {
      let match;
      while ((match = motif.exec(seq)) !== null) {
        sites.push({
          type: 'RBS',
          start: match.index + 1,
          end: match.index + match[0].length,
          sequence: match[0],
          confidence: motif.source.length / 6, // Longer motifs get higher confidence
        });
      }
    }
    return sites.sort((a, b) => a.start - b.start);
  }

  /**
   * Simple transcription terminator prediction (inverted repeats)
   * @param {string} seq - DNA sequence
   * @returns {Array} Array of predicted terminators
   */
  static predictTerminator(seq) {
    const terminators = [];
    const minStemLength = 4;
    const maxLoopSize = 10;

    // Simple hairpin detection
    for (let i = 0; i < seq.length - 20; i++) {
      for (let stemLen = minStemLength; stemLen <= 8; stemLen++) {
        const stem1 = seq.substr(i, stemLen);
        const stem2Rev = this.reverseComplement(stem1);

        for (let loopSize = 3; loopSize <= maxLoopSize; loopSize++) {
          const stem2Start = i + stemLen + loopSize;
          if (stem2Start + stemLen > seq.length) break;

          const stem2 = seq.substr(stem2Start, stemLen);
          if (stem2 === stem2Rev) {
            terminators.push({
              type: 'terminator',
              start: i + 1,
              end: stem2Start + stemLen,
              stemLength: stemLen,
              loopSize: loopSize,
              confidence: stemLen / 8,
            });
            break;
          }
        }
      }
    }
    return terminators;
  }

  /* --------------------------------------------------------- */
  /*  SEARCH                                                  */
  /* --------------------------------------------------------- */

  /**
   * Find gene by name or locus tag
   * @param {string} name - Gene name or locus tag
   * @returns {Object|null} Gene object or null if not found
   */
  static searchGeneByName(name) {
    // Use unified sequence processing implementation
    if (window.UnifiedSequenceProcessing) {
      const result = window.UnifiedSequenceProcessing.legacySearchGeneByName(name);
      return result;
    }

    // Fallback to original implementation if unified module not available
    const gb = window.genomeBrowser;
    if (!gb) throw new Error('GenomeBrowser not initialised');
    name = name.toLowerCase();
    for (const [chr, feats] of Object.entries(gb.currentAnnotations || {})) {
      const hit = feats.find(f => {
        const q = f.qualifiers || {};
        return (q.gene && q.gene.toLowerCase() === name) || (q.locus_tag && q.locus_tag.toLowerCase() === name);
      });
      if (hit) return { chromosome: chr, feature: hit };
    }
    return null;
  }

  /**
   * IUPAC ambiguity code map for motif expansion
   */
  static IUPAC_CODES = {
    A: 'A', C: 'C', G: 'G', T: 'T',
    R: '[AG]', Y: '[CT]', S: '[GC]', W: '[AT]',
    K: '[GT]', M: '[AC]', B: '[CGT]', D: '[AGT]',
    H: '[ACT]', V: '[ACG]', N: '[ACGT]',
  };

  /**
   * Expand IUPAC ambiguity codes in a motif to a regex pattern string.
   * Returns null if the motif is pure ACGT (no ambiguity codes).
   */
  static _expandIUPACToRegex(motif) {
    const pureBases = /^[ACGTacgt]+$/;
    if (pureBases.test(motif)) return null;

    let regex = '';
    let hasAmbiguity = false;
    for (const ch of motif.toUpperCase()) {
      const expanded = MicrobeGenomicsFunctions.IUPAC_CODES[ch];
      if (expanded && expanded !== ch) {
        hasAmbiguity = true;
        regex += expanded;
      } else if (expanded) {
        regex += expanded;
      } else {
        regex += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
    }
    return hasAmbiguity ? regex : null;
  }

  /**
   * Reverse complement a DNA sequence (supports IUPAC codes)
   */
  static _reverseComplement(seq) {
    const complement = {
      A: 'T', T: 'A', G: 'C', C: 'G',
      R: 'Y', Y: 'R', S: 'S', W: 'W',
      K: 'M', M: 'K', B: 'V', D: 'H',
      H: 'D', V: 'B', N: 'N',
    };
    return seq.toUpperCase().split('').reverse().map(b => complement[b] || b).join('');
  }

  /**
   * Search for sequence motif/pattern with full feature support
   * @param {string|object} pattern - RegExp pattern, IUPAC motif string, or parameters object
   * @param {string} [chromosome] - Target chromosome (optional)
   * @param {number} [start] - Start position of search region (0-based, optional)
   * @param {number} [end] - End position of search region (0-based exclusive, optional)
   * @param {string} [strand='both'] - Strand to search: '+', '-', or 'both'
   * @param {number} [maxMismatches=0] - Maximum allowed mismatches
   * @param {boolean} [caseSensitive=false] - Case-sensitive search
   * @returns {Object} Search result with matches and summary
   */
  static searchSequenceMotif(pattern, chromosome = null, start = null, end = null, strand = 'both', maxMismatches = 0, caseSensitive = false) {
    const gb = window.genomeBrowser;
    if (!gb) throw new Error('GenomeBrowser not initialised');

    // Handle case where pattern is a parameters object instead of a string
    if (pattern && typeof pattern === 'object' && !pattern.exec) {
      if (!chromosome && (pattern.chromosome || pattern.chr)) {
        chromosome = pattern.chromosome || pattern.chr;
      }
      if (start === null && pattern.start !== undefined) start = pattern.start;
      if (end === null && pattern.end !== undefined) end = pattern.end;
      if (strand === 'both' && pattern.strand) strand = pattern.strand;
      if (maxMismatches === 0 && pattern.maxMismatches !== undefined) maxMismatches = pattern.maxMismatches;
      if (maxMismatches === 0 && pattern.max_mismatches !== undefined) maxMismatches = pattern.max_mismatches;
      if (!caseSensitive && pattern.caseSensitive !== undefined) caseSensitive = pattern.caseSensitive;
      if (!caseSensitive && pattern.case_sensitive !== undefined) caseSensitive = pattern.case_sensitive;
      pattern = pattern.pattern || pattern.motif || pattern.sequence || pattern.query || String(pattern);
    }

    if (!pattern || (typeof pattern !== 'string' && typeof pattern.exec !== 'function')) {
      throw new Error('A valid motif pattern string is required');
    }

    const motifStr = typeof pattern === 'string' ? pattern.toUpperCase() : String(pattern).toUpperCase();
    const iupacRegex = MicrobeGenomicsFunctions._expandIUPACToRegex(motifStr);

    const chromosomes = chromosome ? [chromosome] : Object.keys(gb.currentSequence || {});
    const allMatches = [];
    const maxResults = 500;

    for (const chr of chromosomes) {
      let fullSeq = gb.currentSequence[chr];
      if (!fullSeq) continue;

      // Apply region bounds
      const seqStart = start != null ? start : 0;
      const seqEnd = end != null ? end : fullSeq.length;
      const seq = (caseSensitive ? fullSeq : fullSeq.toUpperCase()).substring(seqStart, seqEnd);
      const regionLen = seqEnd - seqStart;

      if (maxMismatches === 0) {
        // ---- Fast regex path ----
        const regexPattern = iupacRegex || motifStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(regexPattern, flags);

        // Forward strand
        if (strand === '+' || strand === 'both') {
          regex.lastIndex = 0;
          let m;
          while ((m = regex.exec(seq)) !== null && allMatches.length < maxResults) {
            allMatches.push({
              chromosome: chr,
              position: seqStart + m.index + 1,  // 1-based
              end: seqStart + m.index + m[0].length,
              sequence: m[0],
              strand: '+',
              mismatches: 0,
            });
            if (m[0].length === 0) regex.lastIndex++;
          }
        }

        // Reverse strand
        if (strand === '-' || strand === 'both') {
          const rcMotif = MicrobeGenomicsFunctions._reverseComplement(motifStr);
          const rcRegexStr = iupacRegex
            ? MicrobeGenomicsFunctions._expandIUPACToRegex(rcMotif) || rcMotif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            : rcMotif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const rcRegex = new RegExp(rcRegexStr, flags);
          const rcSeq = MicrobeGenomicsFunctions._reverseComplement(seq);
          rcRegex.lastIndex = 0;
          let m;
          while ((m = rcRegex.exec(rcSeq)) !== null && allMatches.length < maxResults) {
            const fwdPos = seq.length - m.index - m[0].length;
            allMatches.push({
              chromosome: chr,
              position: seqStart + fwdPos + 1,
              end: seqStart + fwdPos + m[0].length,
              sequence: m[0],
              strand: '-',
              mismatches: 0,
            });
            if (m[0].length === 0) rcRegex.lastIndex++;
          }
        }
      } else {
        // ---- Mismatch-tolerant brute-force path ----
        const motifLen = motifStr.length;

        if (strand === '+' || strand === 'both') {
          for (let i = 0; i <= seq.length - motifLen && allMatches.length < maxResults; i++) {
            const sub = seq.substring(i, i + motifLen);
            const mm = MicrobeGenomicsFunctions._countMismatches(sub, motifStr);
            if (mm <= maxMismatches) {
              allMatches.push({
                chromosome: chr,
                position: seqStart + i + 1,
                end: seqStart + i + motifLen,
                sequence: sub,
                strand: '+',
                mismatches: mm,
              });
            }
          }
        }

        if (strand === '-' || strand === 'both') {
          const rcMotif = MicrobeGenomicsFunctions._reverseComplement(motifStr);
          const rcLen = rcMotif.length;
          for (let i = 0; i <= seq.length - rcLen && allMatches.length < maxResults; i++) {
            const sub = seq.substring(i, i + rcLen);
            const mm = MicrobeGenomicsFunctions._countMismatches(sub, rcMotif);
            if (mm <= maxMismatches) {
              allMatches.push({
                chromosome: chr,
                position: seqStart + i + 1,
                end: seqStart + i + rcLen,
                sequence: sub,
                strand: '-',
                mismatches: mm,
              });
            }
          }
        }
      }
    }

    // Sort by chromosome then position
    allMatches.sort((a, b) => a.chromosome.localeCompare(b.chromosome) || a.position - b.position);

    // Compute summary
    const fwdCount = allMatches.filter(m => m.strand === '+').length;
    const revCount = allMatches.filter(m => m.strand === '-').length;
    const totalRegionLen = chromosomes.reduce((sum, chr) => {
      const s = start != null ? start : 0;
      const e = end != null ? end : (gb.currentSequence[chr]?.length || 0);
      return sum + (e - s);
    }, 0);
    const density = totalRegionLen > 0 ? (allMatches.length / totalRegionLen * 1000).toFixed(3) : 0;

    return {
      success: true,
      motif: motifStr,
      iupacExpanded: iupacRegex !== null,
      strandSearched: strand,
      allowedMismatches: maxMismatches,
      totalMatches: allMatches.length,
      forwardMatches: fwdCount,
      reverseMatches: revCount,
      densityPerKb: parseFloat(density),
      matches: allMatches.slice(0, maxResults),
    };
  }

  /**
   * Count mismatches between two equal-length sequences
   */
  static _countMismatches(seq1, seq2) {
    if (seq1.length !== seq2.length) return Infinity;
    let mm = 0;
    for (let i = 0; i < seq1.length; i++) {
      if (seq1[i] !== seq2[i]) mm++;
    }
    return mm;
  }

  /**
   * Find features at a specific genomic position
   * @param {string} chromosome - Chromosome name
   * @param {number} position - Genomic position
   * @returns {Array} Array of overlapping features
   */
  static searchByPosition(chromosome, position) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.currentAnnotations[chromosome]) return [];

    return gb.currentAnnotations[chromosome].filter(feature => position >= feature.start && position <= feature.end);
  }

  /**
   * Find intergenic regions (gaps between genes)
   * @param {string} chromosome - Chromosome name
   * @param {number} minLength - Minimum intergenic region length (default: 50)
   * @returns {Array} Array of intergenic regions
   */
  static searchIntergenicRegions(chromosome, minLength = 50) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.currentAnnotations[chromosome]) return [];

    const genes = gb.currentAnnotations[chromosome]
      .filter(f => f.type === 'CDS' || f.type === 'gene')
      .sort((a, b) => a.start - b.start);

    const intergenic = [];
    for (let i = 0; i < genes.length - 1; i++) {
      const gap = genes[i + 1].start - genes[i].end - 1;
      if (gap >= minLength) {
        intergenic.push({
          chromosome: chromosome,
          start: genes[i].end + 1,
          end: genes[i + 1].start - 1,
          length: gap,
        });
      }
    }
    return intergenic;
  }

  /* --------------------------------------------------------- */
  /*  EDITING                                                 */
  /* --------------------------------------------------------- */

  /**
   * Edit an existing annotation
   * @param {string} chromosome - Chromosome name
   * @param {string} featureId - Feature ID to edit
   * @param {Object} patch - Properties to update
   * @returns {boolean} Success status
   */
  static editAnnotation(chromosome, featureId, patch) {
    const gb = window.genomeBrowser;
    const feats = gb.currentAnnotations[chromosome] || [];
    const target = feats.find(f => f.id === featureId);
    if (!target) return false;
    Object.assign(target, patch);
    return true;
  }

  /**
   * Delete an annotation by ID
   * @param {string} chromosome - Chromosome name
   * @param {string} featureId - Feature ID to delete
   * @returns {boolean} Success status
   */
  static deleteAnnotation(chromosome, featureId) {
    const gb = window.genomeBrowser;
    const feats = gb.currentAnnotations[chromosome] || [];
    const index = feats.findIndex(f => f.id === featureId);
    if (index === -1) return false;
    feats.splice(index, 1);
    return true;
  }

  /**
   * Merge two overlapping annotations
   * @param {string} chromosome - Chromosome name
   * @param {string} id1 - First feature ID
   * @param {string} id2 - Second feature ID
   * @returns {Object|null} Merged feature or null
   */
  static mergeAnnotations(chromosome, id1, id2) {
    const gb = window.genomeBrowser;
    const feats = gb.currentAnnotations[chromosome] || [];
    const feat1 = feats.find(f => f.id === id1);
    const feat2 = feats.find(f => f.id === id2);

    if (!feat1 || !feat2) return null;

    const merged = {
      id: `merged_${id1}_${id2}`,
      type: feat1.type,
      start: Math.min(feat1.start, feat2.start),
      end: Math.max(feat1.end, feat2.end),
      qualifiers: { ...feat1.qualifiers, ...feat2.qualifiers },
    };

    // Remove original features and add merged
    this.deleteAnnotation(chromosome, id1);
    this.deleteAnnotation(chromosome, id2);
    this.addAnnotation(chromosome, merged);

    return merged;
  }

  /* --------------------------------------------------------- */
  /*  ADDITION                                                */
  /* --------------------------------------------------------- */

  /**
   * Add a new feature annotation
   * @param {string} chromosome - Target chromosome
   * @param {Object} feature - Feature object to add
   * @returns {Object} Added feature
   */
  static addAnnotation(chromosome, feature) {
    const gb = window.genomeBrowser;
    if (!gb) throw new Error('GenomeBrowser not initialised');
    if (!gb.currentAnnotations[chromosome]) gb.currentAnnotations[chromosome] = [];

    // Ensure feature has required properties
    if (!feature.id) feature.id = `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    if (!feature.type) feature.type = 'misc_feature';

    gb.currentAnnotations[chromosome].push(feature);
    return feature;
  }

  /**
   * Get upstream region of a gene/feature
   * @param {Object} geneObj - Gene object from searchGeneByName
   * @param {number} length - Upstream region length (default: 200)
   * @returns {Object} Upstream region object
   */
  static getUpstreamRegion(geneObj, length = 200) {
    const { chromosome, feature } = geneObj;
    const start = Math.max(0, feature.start - length - 1);
    const end = feature.start - 1;
    const gb = window.genomeBrowser;
    const seq = gb.currentSequence[chromosome].substring(start, end);
    return { chromosome, start, end, sequence: seq };
  }

  /**
   * Get downstream region of a gene/feature
   * @param {Object} geneObj - Gene object from searchGeneByName
   * @param {number} length - Downstream region length (default: 200)
   * @returns {Object} Downstream region object
   */
  static getDownstreamRegion(geneObj, length = 200) {
    const { chromosome, feature } = geneObj;
    const gb = window.genomeBrowser;
    const seqLength = gb.currentSequence[chromosome].length;
    const start = feature.end + 1;
    const end = Math.min(seqLength, feature.end + length);
    const seq = gb.currentSequence[chromosome].substring(start, end);
    return { chromosome, start, end, sequence: seq };
  }

  /**
   * Add a custom track (e.g., for displaying analysis results)
   * @param {string} trackName - Name of the track
   * @param {Array} data - Array of data points {position, value}
   * @param {string} trackType - Type of track (default: 'line')
   * @returns {Object} Track object
   */
  static addTrack(trackName, data, trackType = 'line') {
    const gb = window.genomeBrowser;
    if (!gb.customTracks) gb.customTracks = {};

    const track = {
      name: trackName,
      type: trackType,
      data: data,
      created: new Date().toISOString(),
    };

    gb.customTracks[trackName] = track;
    return track;
  }

  /**
   * Add SNP/variant data
   * @param {string} chromosome - Chromosome name
   * @param {number} position - Variant position
   * @param {string} ref - Reference allele
   * @param {string} alt - Alternative allele
   * @param {Object} info - Additional variant information
   * @returns {Object} Variant object
   */
  static addVariant(chromosome, position, ref, alt, info = {}) {
    const gb = window.genomeBrowser;
    if (!gb.variants) gb.variants = {};
    if (!gb.variants[chromosome]) gb.variants[chromosome] = [];

    const variant = {
      chromosome,
      position,
      ref,
      alt,
      id: `var_${chromosome}_${position}_${ref}_${alt}`,
      info,
      added: new Date().toISOString(),
    };

    gb.variants[chromosome].push(variant);
    return variant;
  }

  /* --------------------------------------------------------- */
  /*  SEQUENCE EXTRACTION                                     */
  /* --------------------------------------------------------- */

  /**
   * Get coding sequence (CDS) for a gene by name or locus tag
   * @param {string} identifier - Gene name or locus tag
   * @returns {Object|null} CDS information or null if not found
   */
  static getCodingSequence(identifier) {
    const gb = window.genomeBrowser;
    if (!gb) throw new Error('GenomeBrowser not initialised');

    // First, find the gene by name or locus tag
    const geneResult = this.searchGeneByName(identifier);
    if (!geneResult) {
      // Provide more helpful error information
      const availableGenes = this.getAvailableGeneNames();
      const suggestions = this.generateGeneSuggestions(identifier, availableGenes);

      return {
        success: false,
        error: `Gene "${identifier}" not found`,
        identifier: identifier,
        suggestions: suggestions,
        availableGenesCount: availableGenes.length,
        availableGenesSample: availableGenes.slice(0, 10), // Show first 10 genes
        message: `Gene "${identifier}" not found in the current genome. ${suggestions.length > 0 ? 'Try one of these similar genes: ' + suggestions.join(', ') : 'No similar genes found.'}`,
      };
    }

    const { chromosome, feature } = geneResult;

    // Check if we have sequence data for this chromosome
    if (!gb.currentSequence || !gb.currentSequence[chromosome]) {
      return {
        success: false,
        error: `No sequence data available for chromosome ${chromosome}`,
        identifier: identifier,
        chromosome: chromosome,
      };
    }

    // Get the genomic DNA sequence for the gene region
    const fullSequence = gb.currentSequence[chromosome];
    let geneSequence = fullSequence.substring(feature.start - 1, feature.end);

    // Determine gene name and locus tag for result
    const geneName = gb.getQualifierValue(feature.qualifiers, 'gene') || identifier;
    const locusTag = gb.getQualifierValue(feature.qualifiers, 'locus_tag') || identifier;

    // Handle strand direction
    let codingSequence = geneSequence;
    const isReverse = feature.strand === -1 || feature.strand === '-';

    if (isReverse) {
      // For reverse strand genes, get reverse complement
      codingSequence = this.reverseComplement(geneSequence);
    }

    // Calculate additional information
    const gcContent = this.computeGC(codingSequence);
    const proteinSequence = this.translateDNA(codingSequence);

    return {
      success: true,
      identifier: identifier,
      geneName: geneName,
      locusTag: locusTag,
      chromosome: chromosome,
      start: feature.start,
      end: feature.end,
      strand: isReverse ? '-' : '+',
      length: codingSequence.length,
      codingSequence: codingSequence,
      proteinSequence: proteinSequence,
      gcContent: parseFloat(gcContent.toFixed(2)),
      proteinLength: proteinSequence.length,
      geneType: feature.type || 'CDS',
      qualifiers: feature.qualifiers || {},
    };
  }

  /**
   * Get available gene names from current annotations
   * @returns {Array} Array of available gene names and locus tags
   */
  static getAvailableGeneNames() {
    const gb = window.genomeBrowser;
    if (!gb || !gb.currentAnnotations) return [];

    const geneNames = new Set();

    for (const [chr, features] of Object.entries(gb.currentAnnotations)) {
      features.forEach(feature => {
        const qualifiers = feature.qualifiers || {};
        if (qualifiers.gene) {
          geneNames.add(qualifiers.gene);
        }
        if (qualifiers.locus_tag) {
          geneNames.add(qualifiers.locus_tag);
        }
      });
    }

    return Array.from(geneNames).sort();
  }

  /**
   * Get a sample of available genes for display
   * @param {number} count - Number of genes to return (default: 20)
   * @returns {Array} Array of sample gene names
   */
  static getSampleGenes(count = 20) {
    const availableGenes = this.getAvailableGeneNames();
    return availableGenes.slice(0, count);
  }

  /**
   * Search for genes by partial name match
   * @param {string} partialName - Partial gene name to search for
   * @param {number} maxResults - Maximum number of results to return (default: 10)
   * @returns {Array} Array of matching gene names
   */
  static searchGenesByPartialName(partialName, maxResults = 10) {
    const availableGenes = this.getAvailableGeneNames();
    const partialLower = partialName.toLowerCase();

    const matches = availableGenes.filter(gene => gene.toLowerCase().includes(partialLower));

    return matches.slice(0, maxResults);
  }

  /**
   * Generate gene name suggestions based on input
   * @param {string} input - Input gene identifier
   * @param {Array} availableGenes - Array of available gene names
   * @returns {Array} Array of suggested gene names
   */
  static generateGeneSuggestions(input, availableGenes) {
    if (!input || !availableGenes.length) return [];

    const inputLower = input.toLowerCase();
    const suggestions = [];

    // Exact prefix matches
    const prefixMatches = availableGenes.filter(gene => gene.toLowerCase().startsWith(inputLower));
    suggestions.push(...prefixMatches.slice(0, 5));

    // Contains matches
    const containsMatches = availableGenes.filter(
      gene => gene.toLowerCase().includes(inputLower) && !prefixMatches.includes(gene)
    );
    suggestions.push(...containsMatches.slice(0, 3));

    // Fuzzy matches (simple similarity)
    const fuzzyMatches = availableGenes.filter(gene => {
      const geneLower = gene.toLowerCase();
      const similarity = this.calculateStringSimilarity(inputLower, geneLower);
      return similarity > 0.3 && !suggestions.includes(gene);
    });
    suggestions.push(...fuzzyMatches.slice(0, 2));

    return suggestions.slice(0, 10); // Limit to 10 suggestions
  }

  /**
   * Calculate simple string similarity (0-1)
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score
   */
  static calculateStringSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    const editDistance = this.levenshteinDistance(str1, str2);
    return 1 - editDistance / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Edit distance
   */
  static levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get coding sequences for multiple genes
   * @param {Array<string>} identifiers - Array of gene names or locus tags
   * @returns {Array} Array of CDS results
   */
  static getMultipleCodingSequences(identifiers) {
    if (!Array.isArray(identifiers)) {
      throw new Error('Identifiers must be an array');
    }

    return identifiers.map(identifier => this.getCodingSequence(identifier));
  }

  /**
   * Export coding sequence in FASTA format
   * @param {string} identifier - Gene name or locus tag
   * @param {boolean} includeProtein - Whether to include protein translation
   * @returns {string} FASTA formatted sequence(s)
   */
  static exportCodingSequenceFasta(identifier, includeProtein = false) {
    const result = this.getCodingSequence(identifier);

    if (!result.success) {
      throw new Error(result.error);
    }

    let fasta = '';

    // DNA sequence
    const dnaHeader = `>${result.geneName || result.locusTag}_CDS ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand) [${result.length} bp]`;
    fasta += `${dnaHeader}\n${result.codingSequence}\n`;

    // Protein sequence if requested
    if (includeProtein) {
      const proteinHeader = `>${result.geneName || result.locusTag}_PROTEIN translated from ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand) [${result.proteinLength} aa]`;
      fasta += `\n${proteinHeader}\n${result.proteinSequence}\n`;
    }

    return fasta;
  }

  /* --------------------------------------------------------- */
  /*  UTILITY METHODS                                         */
  /* --------------------------------------------------------- */

  /**
   * Get available function categories for LLM guidance
   * @returns {Object} Object with function categories and descriptions
   */
  static getFunctionCategories() {
    return {
      navigation: {
        description: 'Functions to move around the genome and change view',
        functions: ['navigateTo', 'jumpToGene', 'getCurrentRegion', 'scrollLeft', 'scrollRight', 'zoomIn', 'zoomOut'],
      },
      analysis: {
        description: 'Functions to analyze sequence properties and features',
        functions: ['computeGC', 'reverseComplement', 'translateDNA', 'findORFs', 'calculateEntropy'],
      },
      calculation: {
        description: 'Functions for genomic calculations and statistics',
        functions: ['calcRegionGC', 'calculateMeltingTemp', 'calculateMolecularWeight', 'analyzeCodonUsage'],
      },
      prediction: {
        description: 'Functions to predict genomic features and motifs',
        functions: ['predictPromoter', 'predictRBS', 'predictTerminator'],
      },
      search: {
        description: 'Functions to find genes, motifs, and genomic features',
        functions: ['searchGeneByName', 'searchSequenceMotif', 'searchByPosition', 'searchIntergenicRegions'],
      },
      editing: {
        description: 'Functions to modify existing annotations and features',
        functions: ['editAnnotation', 'deleteAnnotation', 'mergeAnnotations'],
      },
      addition: {
        description: 'Functions to add new annotations, tracks, and data',
        functions: ['addAnnotation', 'getUpstreamRegion', 'getDownstreamRegion', 'addTrack', 'addVariant'],
      },
      sequence_actions: {
        description: 'Functions to manipulate genome sequences via action queue',
        functions: [
          'copy_sequence',
          'cut_sequence',
          'paste_sequence',
          'delete_sequence',
          'insert_sequence',
          'replace_sequence',
        ],
      },
    };
  }

  /* --------------------------------------------------------- */
  /*  SEQUENCE ACTIONS                                        */
  /* --------------------------------------------------------- */

  /**
   * Copy sequence from specified region to action queue
   * @param {string} chromosome - Source chromosome
   * @param {number} start - Start position (1-based)
   * @param {number} end - End position (1-based)
   * @param {string} strand - Strand ('+' or '-')
   * @returns {object} Result with action ID and details
   */
  static copy_sequence(chromosome, start, end, strand = '+') {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    const target = `${chromosome}:${start}-${end}(${strand})`;
    const length = end - start + 1;
    const metadata = { chromosome, start, end, strand, selectionSource: 'function_call' };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.COPY_SEQUENCE,
      target,
      `Copy ${length.toLocaleString()} bp from ${chromosome}:${start}-${end}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'copy',
      target: target,
      length: length,
      message: `Copy action queued for ${chromosome}:${start}-${end} (${length} bp)`,
    };
  }

  /**
   * Cut sequence from specified region to action queue
   * @param {string} chromosome - Source chromosome
   * @param {number} start - Start position (1-based)
   * @param {number} end - End position (1-based)
   * @param {string} strand - Strand ('+' or '-')
   * @returns {object} Result with action ID and details
   */
  static cut_sequence(chromosome, start, end, strand = '+') {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    const target = `${chromosome}:${start}-${end}(${strand})`;
    const length = end - start + 1;
    const metadata = { chromosome, start, end, strand, selectionSource: 'function_call' };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.CUT_SEQUENCE,
      target,
      `Cut ${length.toLocaleString()} bp from ${chromosome}:${start}-${end}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'cut',
      target: target,
      length: length,
      message: `Cut action queued for ${chromosome}:${start}-${end} (${length} bp)`,
    };
  }

  /**
   * Paste sequence at specified position from clipboard
   * @param {string} chromosome - Target chromosome
   * @param {number} position - Insert position (1-based)
   * @returns {object} Result with action ID and details
   */
  static paste_sequence(chromosome, position) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    if (!gb.actionManager.clipboard || !gb.actionManager.clipboard.sequence) {
      throw new Error('No sequence in clipboard to paste');
    }

    const target = `${chromosome}:${position}`;
    const clipboardLength = gb.actionManager.clipboard.sequence.length;
    const metadata = {
      chromosome,
      start: position,
      end: position,
      strand: '+',
      clipboardData: gb.actionManager.clipboard,
      selectionSource: 'function_call',
    };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.PASTE_SEQUENCE,
      target,
      `Paste ${clipboardLength.toLocaleString()} bp at ${chromosome}:${position}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'paste',
      target: target,
      length: clipboardLength,
      message: `Paste action queued for ${chromosome}:${position} (${clipboardLength} bp)`,
    };
  }

  /**
   * Delete sequence from specified region
   * @param {string} chromosome - Target chromosome
   * @param {number} start - Start position (1-based)
   * @param {number} end - End position (1-based)
   * @returns {object} Result with action ID and details
   */
  static delete_sequence(chromosome, start, end) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    const target = `${chromosome}:${start}-${end}`;
    const length = end - start + 1;
    const metadata = { chromosome, start, end, strand: '+', selectionSource: 'function_call' };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.DELETE_SEQUENCE,
      target,
      `Delete ${length.toLocaleString()} bp from ${chromosome}:${start}-${end}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'delete',
      target: target,
      length: length,
      message: `Delete action queued for ${chromosome}:${start}-${end} (${length} bp)`,
    };
  }

  /**
   * Insert sequence at specified position
   * @param {string} chromosome - Target chromosome
   * @param {number} position - Insert position (1-based)
   * @param {string} sequence - Sequence to insert
   * @returns {object} Result with action ID and details
   */
  static insert_sequence(chromosome, position, sequence) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    const target = `${chromosome}:${position}`;
    const metadata = {
      chromosome,
      start: position,
      end: position,
      strand: '+',
      insertSequence: sequence,
      selectionSource: 'function_call',
    };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.INSERT_SEQUENCE,
      target,
      `Insert ${sequence.length.toLocaleString()} bp at ${chromosome}:${position}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'insert',
      target: target,
      length: sequence.length,
      message: `Insert action queued for ${chromosome}:${position} (${sequence.length} bp)`,
    };
  }

  /**
   * Replace sequence in specified region
   * @param {string} chromosome - Target chromosome
   * @param {number} start - Start position (1-based)
   * @param {number} end - End position (1-based)
   * @param {string} newSequence - New sequence to replace with
   * @returns {object} Result with action ID and details
   */
  static replace_sequence(chromosome, start, end, newSequence) {
    const gb = window.genomeBrowser;
    if (!gb || !gb.actionManager) {
      throw new Error('ActionManager not available');
    }

    const target = `${chromosome}:${start}-${end}`;
    const originalLength = end - start + 1;
    const metadata = {
      chromosome,
      start,
      end,
      strand: '+',
      newSequence: newSequence,
      selectionSource: 'function_call',
    };

    const actionId = gb.actionManager.addAction(
      gb.actionManager.ACTION_TYPES.REPLACE_SEQUENCE,
      target,
      `Replace ${originalLength.toLocaleString()} bp with ${newSequence.length.toLocaleString()} bp at ${chromosome}:${start}-${end}`,
      metadata
    );

    return {
      success: true,
      actionId: actionId,
      action: 'replace',
      target: target,
      originalLength: originalLength,
      newLength: newSequence.length,
      message: `Replace action queued for ${chromosome}:${start}-${end} (${originalLength} → ${newSequence.length} bp)`,
    };
  }

  /**
   * Get usage examples for LLM learning
   * @returns {Array} Array of example usage patterns
   */
  static getUsageExamples() {
    return [
      {
        task: 'Analyze promoter region of a gene',
        steps: [
          "const gene = MicrobeFns.searchGeneByName('dnaA');",
          'const upstream = MicrobeFns.getUpstreamRegion(gene, 200);',
          'const gcContent = MicrobeFns.computeGC(upstream.sequence);',
          'const promoter = MicrobeFns.predictPromoter(upstream.sequence);',
          'MicrobeFns.navigateTo(upstream.chromosome, upstream.start, upstream.end);',
        ],
      },
      {
        task: 'Find and analyze ORFs in intergenic regions',
        steps: [
          "const intergenic = MicrobeFns.searchIntergenicRegions('chromosome', 100);",
          'for (const region of intergenic) {',
          '  const seq = gb.currentSequence[region.chromosome].substring(region.start, region.end);',
          '  const orfs = MicrobeFns.findORFs(seq, 10);',
          '  if (orfs.length > 0) MicrobeFns.addAnnotation(region.chromosome, orfs[0]);',
          '}',
        ],
      },
      {
        task: 'Search for ribosome binding sites near start codons',
        steps: [
          "const startCodons = MicrobeFns.searchSequenceMotif('ATG');",
          'for (const atg of startCodons) {',
          '  const upstream = gb.currentSequence[atg.chromosome].substring(atg.start-30, atg.start-1);',
          '  const rbs = MicrobeFns.predictRBS(upstream);',
          '  if (rbs.length > 0) MicrobeFns.addAnnotation(atg.chromosome, rbs[0]);',
          '}',
        ],
      },
    ];
  }
}

// Expose globally & via module export
if (typeof window !== 'undefined') {
  window.MicrobeFns = MicrobeGenomicsFunctions;
  window.MicrobeGenomicsFunctions = MicrobeGenomicsFunctions; // Also expose under full name
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MicrobeGenomicsFunctions;
}
