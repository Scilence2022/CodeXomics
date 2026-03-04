/**
 * PrimerDesign.js
 * -------------------------------------------------------------
 * Comprehensive primer design module for PCR, sequencing, and cloning.
 * Includes Tm calculation, hairpin detection, primer-dimer prediction,
 * and optimal primer selection algorithms.
 * -------------------------------------------------------------
 */

class PrimerDesign {
  /* --------------------------------------------------------- */
  /*  PHYSICAL CALCULATIONS                                    */
  /* --------------------------------------------------------- */

  /**
   * Calculate melting temperature using nearest-neighbor thermodynamics
   * @param {string} sequence - DNA sequence
   * @param {Object} options - Calculation options
   * @returns {number} Melting temperature in Celsius
   */
  static calculateTm(sequence, options = {}) {
    const seq = sequence.toUpperCase().trim();
    if (seq.length === 0) return 0;

    const {
      saltConc = 50,      // mM Na+ equivalent
      primerConc = 0.5,   // µM
      method = 'nearest_neighbor' // 'nearest_neighbor', 'basic', 'salt_adjusted'
    } = options;

    switch (method) {
      case 'basic':
        return this.calculateTmBasic(seq);
      case 'salt_adjusted':
        return this.calculateTmSaltAdjusted(seq, saltConc);
      default:
        return this.calculateTmNearestNeighbor(seq, saltConc, primerConc);
    }
  }

  /**
   * Basic Tm calculation (simplified formula)
   * For sequences < 14bp: Tm = 2°C × (A+T) + 4°C × (G+C)
   * For longer sequences: Tm = 81.5 + 0.41×GC% - 675/length
   */
  static calculateTmBasic(seq) {
    const a = (seq.match(/A/g) || []).length;
    const t = (seq.match(/T/g) || []).length;
    const g = (seq.match(/G/g) || []).length;
    const c = (seq.match(/C/g) || []).length;

    if (seq.length < 14) {
      return 2 * (a + t) + 4 * (g + c);
    } else {
      const gcPercent = ((g + c) / seq.length) * 100;
      return 81.5 + 0.41 * gcPercent - 675 / seq.length;
    }
  }

  /**
   * Salt-adjusted Tm calculation
   * Tm = 81.5 + 0.41×GC% - 675/length + 16.6×log10([Na+])
   */
  static calculateTmSaltAdjusted(seq, saltConc = 50) {
    const gcCount = (seq.match(/[GC]/g) || []).length;
    const gcPercent = (gcCount / seq.length) * 100;
    const saltCorrection = 16.6 * Math.log10(saltConc / 1000);
    return 81.5 + 0.41 * gcPercent - 675 / seq.length + saltCorrection;
  }

  /**
   * Nearest-neighbor thermodynamics (most accurate)
   * Uses SantaLucia 1998 thermodynamic parameters
   */
  static calculateTmNearestNeighbor(seq, saltConc = 50, primerConc = 0.5) {
    // SantaLucia 1998 nearest-neighbor parameters (kcal/mol at 37°C)
    const nnEnthalpy = {
      'AA': -7.9, 'TT': -7.9, 'AT': -7.2, 'TA': -7.2,
      'CA': -8.5, 'TG': -8.5, 'GT': -8.4, 'AC': -8.4,
      'CT': -7.8, 'AG': -7.8, 'GA': -8.2, 'TC': -8.2,
      'CG': -10.6, 'GC': -9.8, 'GG': -8.0, 'CC': -8.0,
      'A': 2.2, 'T': 2.2, 'G': 0.0, 'C': 0.0  // Initiation
    };

    const nnEntropy = {
      'AA': -21.9, 'TT': -21.9, 'AT': -20.4, 'TA': -21.3,
      'CA': -22.7, 'TG': -22.7, 'GT': -22.4, 'AC': -22.4,
      'CT': -21.0, 'AG': -21.0, 'GA': -22.2, 'TC': -22.2,
      'CG': -27.2, 'GC': -24.4, 'GG': -19.9, 'CC': -19.9,
      'A': 6.9, 'T': 6.9, 'G': 0.0, 'C': 0.0  // Initiation
    };

    let dH = 0;  // Enthalpy (kcal/mol)
    let dS = 0;  // Entropy (cal/mol·K)

    // Add initiation parameters
    dH += nnEnthalpy[seq[0]] || 0;
    dS += nnEntropy[seq[0]] || 0;

    // Add nearest-neighbor parameters
    for (let i = 0; i < seq.length - 1; i++) {
      const pair = seq.substring(i, i + 2);
      dH += nnEnthalpy[pair] || -7.0;  // Default fallback
      dS += nnEntropy[pair] || -20.0;
    }

    // Symmetry correction (if self-complementary)
    if (this.isSelfComplementary(seq)) {
      dS -= 1.4;
    }

    // Salt correction (SantaLucia 1998)
    const saltCorrection = 0.368 * seq.length * Math.log(saltConc / 1000);
    dS += saltCorrection;

    // Calculate Tm
    const R = 1.987;  // Gas constant (cal/mol·K)
    const Tm = (dH * 1000) / (dS + R * Math.log(primerConc / 1000000000)) - 273.15;

    return Math.round(Tm * 10) / 10;
  }

  /**
   * Check if sequence is self-complementary
   */
  static isSelfComplementary(seq) {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const revComp = seq.split('').reverse().map(b => complement[b] || b).join('');
    return seq === revComp;
  }

  /**
   * Calculate GC content percentage
   */
  static calculateGCContent(seq) {
    const gc = (seq.match(/[GC]/gi) || []).length;
    return (gc / seq.length) * 100;
  }

  /**
   * Calculate molecular weight of DNA sequence
   */
  static calculateMolecularWeight(seq) {
    const weights = { A: 313.21, T: 304.2, G: 329.21, C: 289.18 };
    let mw = 0;
    for (const base of seq.toUpperCase()) {
      mw += weights[base] || 0;
    }
    return mw - 61.96;  // Subtract water
  }

  /* --------------------------------------------------------- */
  /*  SECONDARY STRUCTURE DETECTION                            */
  /* --------------------------------------------------------- */

  /**
   * Detect hairpin structures in a primer sequence
   * @param {string} sequence - DNA sequence
   * @param {Object} options - Detection options
   * @returns {Object} Hairpin analysis result
   */
  static detectHairpin(sequence, options = {}) {
    const seq = sequence.toUpperCase();
    const {
      minStemLength = 3,
      maxLoopSize = 10,
      minLoopSize = 3,
      maxHairpins = 5
    } = options;

    const hairpins = [];
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };

    for (let i = 0; i < seq.length - minStemLength * 2 - minLoopSize; i++) {
      for (let stemLen = minStemLength; stemLen <= 8; stemLen++) {
        for (let loopSize = minLoopSize; loopSize <= maxLoopSize; loopSize++) {
          const stem1Start = i;
          const stem1End = i + stemLen;
          const loopStart = stem1End;
          const stem2Start = loopStart + loopSize;
          const stem2End = stem2Start + stemLen;

          if (stem2End > seq.length) continue;

          const stem1 = seq.substring(stem1Start, stem1End);
          const stem2 = seq.substring(stem2Start, stem2End);
          const stem2RevComp = stem2.split('').reverse().map(b => complement[b] || b).join('');

          if (stem1 === stem2RevComp) {
            // Calculate hairpin stability
            const stability = this.calculateHairpinStability(stem1, loopSize);

            hairpins.push({
              stem1Start: stem1Start + 1,  // 1-based
              stem1End: stem1End,
              loopStart: loopStart + 1,
              loopEnd: stem2Start,
              stem2Start: stem2Start + 1,
              stem2End: stem2End,
              stemLength: stemLen,
              loopSize: loopSize,
              stem1Sequence: stem1,
              stem2Sequence: stem2,
              loopSequence: seq.substring(loopStart, stem2Start),
              stability: stability,
              isStable: stability > -3.0  // Threshold for stable hairpin
            });

            if (hairpins.length >= maxHairpins) {
              return {
                hasHairpin: true,
                hairpins: hairpins,
                worstStability: Math.min(...hairpins.map(h => h.stability)),
                isProblematic: hairpins.some(h => h.isStable)
              };
            }
          }
        }
      }
    }

    return {
      hasHairpin: hairpins.length > 0,
      hairpins: hairpins,
      worstStability: hairpins.length > 0 ? Math.min(...hairpins.map(h => h.stability)) : 0,
      isProblematic: hairpins.some(h => h.isStable)
    };
  }

  /**
   * Calculate approximate hairpin stability (simplified)
   * Returns ΔG in kcal/mol (negative = stable)
   */
  static calculateHairpinStability(stemSeq, loopSize) {
    // Simplified stability calculation
    const gcContent = this.calculateGCContent(stemSeq);
    const stemContribution = -0.1 * stemSeq.length * (gcContent / 100 + 0.5);
    const loopPenalty = 0.05 * loopSize;
    return stemContribution + loopPenalty;
  }

  /**
   * Detect primer-dimer potential between two sequences
   * @param {string} seq1 - First sequence
   * @param {string} seq2 - Second sequence
   * @param {Object} options - Detection options
   * @returns {Object} Dimer analysis result
   */
  static detectPrimerDimer(seq1, seq2, options = {}) {
    const s1 = seq1.toUpperCase();
    const s2 = seq2.toUpperCase();
    const {
      minComplementarity = 6,
      maxMismatches = 1,
      check3PrimeEnd = true,
      min3PrimeMatch = 4
    } = options;

    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const s2RevComp = s2.split('').reverse().map(b => complement[b] || b).join('');

    const dimers = [];

    // Check all possible alignments
    for (let offset = -s1.length + minComplementarity; offset < s1.length; offset++) {
      let matches = 0;
      let mismatches = 0;
      let alignment = [];
      let s1Start = -1, s1End = -1, s2Start = -1, s2End = -1;

      for (let i = 0; i < s1.length; i++) {
        const j = i - offset;
        if (j >= 0 && j < s2RevComp.length) {
          const match = s1[i] === s2RevComp[j];
          alignment.push(match ? '|' : 'x');
          if (match) {
            matches++;
            if (s1Start === -1) {
              s1Start = i;
              s2Start = j;
            }
            s1End = i;
            s2End = j;
          } else {
            mismatches++;
          }
        } else {
          alignment.push(' ');
        }
      }

      // Check if this alignment forms a significant dimer
      if (matches >= minComplementarity && mismatches <= maxMismatches) {
        // Check 3' end complementarity
        const s1ThreePrime = s1.slice(-min3PrimeMatch);
        const s2ThreePrime = s2.slice(-min3PrimeMatch);
        const s2ThreePrimeRevComp = s2ThreePrime.split('').reverse().map(b => complement[b] || b).join('');

        let threePrimeMatches = 0;
        for (let i = 0; i < min3PrimeMatch; i++) {
          if (s1ThreePrime[s1ThreePrime.length - 1 - i] === s2ThreePrimeRevComp[i]) {
            threePrimeMatches++;
          }
        }

        const is3PrimeProblem = threePrimeMatches >= min3PrimeMatch - 1;

        dimers.push({
          offset: offset,
          matches: matches,
          mismatches: mismatches,
          alignment: alignment.join(''),
          s1Region: `${s1Start + 1}-${s1End + 1}`,
          s2Region: `${s2.length - s2End}-${s2.length - s2Start}`,
          is3PrimeProblem: is3PrimeProblem,
          severity: is3PrimeProblem ? 'high' : (matches >= 8 ? 'medium' : 'low')
        });
      }
    }

    // Sort by severity
    dimers.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      hasDimer: dimers.length > 0,
      dimers: dimers.slice(0, 5),  // Return top 5
      worstSeverity: dimers.length > 0 ? dimers[0].severity : 'none',
      isProblematic: dimers.some(d => d.severity === 'high')
    };
  }

  /**
   * Check for self-dimer potential
   */
  static detectSelfDimer(sequence, options = {}) {
    return this.detectPrimerDimer(sequence, sequence, options);
  }

  /* --------------------------------------------------------- */
  /*  PRIMER DESIGN ALGORITHMS                                 */
  /* --------------------------------------------------------- */

  /**
   * Design PCR primers for a target region
   * @param {string} sequence - Target DNA sequence
   * @param {Object} options - Design options
   * @returns {Object} Designed primers
   */
  static designPCRPrimers(sequence, options = {}) {
    const targetSeq = sequence.toUpperCase().replace(/[^ATGC]/g, '');
    const {
      targetTm = 60,
      tmTolerance = 3,
      minLength = 18,
      maxLength = 25,
      minGC = 40,
      maxGC = 60,
      maxPolyBase = 4,
      avoid3PrimeGC = true,
      ampliconSize = null  // If provided, design internal primers
    } = options;

    // Design forward primer (at the start)
    const forwardPrimer = this.findOptimalPrimer(
      targetSeq.substring(0, 200),  // Look at first 200bp
      {
        targetTm,
        tmTolerance,
        minLength,
        maxLength,
        minGC,
        maxGC,
        maxPolyBase,
        avoid3PrimeGC,
        direction: 'forward'
      }
    );

    // Design reverse primer (at the end)
    const reversePrimer = this.findOptimalPrimer(
      this.reverseComplement(targetSeq.slice(-200)),  // Look at last 200bp, reversed
      {
        targetTm,
        tmTolerance,
        minLength,
        maxLength,
        minGC,
        maxGC,
        maxPolyBase,
        avoid3PrimeGC,
        direction: 'forward'  // We're working with reverse complement
      }
    );

    // Adjust reverse primer positions to match original sequence
    if (reversePrimer) {
      const revCompLength = targetSeq.length;
      const originalStart = revCompLength - reversePrimer.position.end + 1;
      const originalEnd = revCompLength - reversePrimer.position.start + 1;
      reversePrimer.position = { start: originalStart, end: originalEnd };
      reversePrimer.sequence = this.reverseComplement(reversePrimer.sequence);
    }

    // Analyze primer pair compatibility
    const pairAnalysis = forwardPrimer && reversePrimer
      ? this.analyzePrimerPair(forwardPrimer.sequence, reversePrimer.sequence)
      : null;

    return {
      forward: forwardPrimer,
      reverse: reversePrimer,
      pairAnalysis: pairAnalysis,
      ampliconSize: forwardPrimer && reversePrimer
        ? reversePrimer.position.end - forwardPrimer.position.start + 1
        : null
    };
  }

  /**
   * Design sequencing primers
   */
  static designSequencingPrimers(sequence, options = {}) {
    const targetSeq = sequence.toUpperCase().replace(/[^ATGC]/g, '');
    const {
      targetTm = 55,
      readLength = 500,
      overlap = 100,
      ...pcrOptions
    } = options;

    const primers = [];
    let position = 0;

    while (position < targetSeq.length) {
      const primer = this.findOptimalPrimer(
        targetSeq.substring(position, position + 200),
        {
          targetTm,
          minLength: 16,
          maxLength: 22,
          direction: 'forward',
          ...pcrOptions
        }
      );

      if (primer) {
        primer.position.start += position;
        primer.position.end += position;
        primers.push(primer);
        position += readLength - overlap;
      } else {
        break;
      }
    }

    return {
      primers: primers,
      coverage: this.calculateCoverage(primers, targetSeq.length),
      strategy: 'walking'
    };
  }

  /**
   * Design qPCR primers with enhanced specificity requirements
   */
  static designqPCRPrimers(sequence, options = {}) {
    const pcrResult = this.designPCRPrimers(sequence, {
      targetTm: 60,
      tmTolerance: 2,
      minLength: 18,
      maxLength: 22,
      minGC: 45,
      maxGC: 55,
      maxPolyBase: 3,
      avoid3PrimeGC: true,
      ...options
    });

    // Additional qPCR-specific validation
    if (pcrResult.forward && pcrResult.reverse) {
      // Check for amplicon size (ideal: 80-200bp for qPCR)
      const ampliconSize = pcrResult.ampliconSize;
      pcrResult.qpcrValidation = {
        ampliconSize: ampliconSize,
        isOptimalSize: ampliconSize >= 80 && ampliconSize <= 200,
        sizeCategory: ampliconSize < 80 ? 'too_small' : ampliconSize > 200 ? 'too_large' : 'optimal',
        tmDifference: Math.abs(pcrResult.forward.tm - pcrResult.reverse.tm),
        isTmBalanced: Math.abs(pcrResult.forward.tm - pcrResult.reverse.tm) <= 2
      };
    }

    return pcrResult;
  }

  /**
   * Find optimal primer within a sequence window
   */
  static findOptimalPrimer(sequence, options = {}) {
    const {
      targetTm = 60,
      tmTolerance = 3,
      minLength = 18,
      maxLength = 25,
      minGC = 40,
      maxGC = 60,
      maxPolyBase = 4,
      avoid3PrimeGC = true,
      direction = 'forward'
    } = options;

    const candidates = [];

    // Generate all possible primers in the window
    for (let start = 0; start <= sequence.length - minLength; start++) {
      for (let length = minLength; length <= maxLength && start + length <= sequence.length; length++) {
        const primerSeq = sequence.substring(start, start + length);

        // Validate primer
        const validation = this.validatePrimer(primerSeq, {
          minGC,
          maxGC,
          maxPolyBase,
          avoid3PrimeGC
        });

        if (!validation.isValid) continue;

        // Calculate Tm
        const tm = this.calculateTm(primerSeq, { method: 'nearest_neighbor' });

        // Check Tm within tolerance
        if (Math.abs(tm - targetTm) <= tmTolerance) {
          // Check for hairpin and self-dimer
          const hairpin = this.detectHairpin(primerSeq);
          const selfDimer = this.detectSelfDimer(primerSeq);

          if (!hairpin.isProblematic && !selfDimer.isProblematic) {
            candidates.push({
              sequence: primerSeq,
              position: { start: start + 1, end: start + length },
              length: length,
              tm: tm,
              gcContent: this.calculateGCContent(primerSeq),
              hairpinRisk: hairpin.worstStability,
              selfDimerRisk: selfDimer.worstSeverity,
              validation: validation,
              score: this.scorePrimer(primerSeq, tm, targetTm, hairpin, selfDimer)
            });
          }
        }
      }
    }

    // Sort by score (higher is better)
    candidates.sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Validate a primer sequence against design rules
   */
  static validatePrimer(sequence, options = {}) {
    const {
      minGC = 40,
      maxGC = 60,
      maxPolyBase = 4,
      avoid3PrimeGC = true
    } = options;

    const issues = [];

    // GC content check
    const gcContent = this.calculateGCContent(sequence);
    if (gcContent < minGC) issues.push(`GC content too low (${gcContent.toFixed(1)}% < ${minGC}%)`);
    if (gcContent > maxGC) issues.push(`GC content too high (${gcContent.toFixed(1)}% > ${maxGC}%)`);

    // Poly-base runs
    const polyA = (sequence.match(/A{${maxPolyBase + 1},}/g) || []).length;
    const polyT = (sequence.match(/T{${maxPolyBase + 1},}/g) || []).length;
    const polyG = (sequence.match(/G{${maxPolyBase + 1},}/g) || []).length;
    const polyC = (sequence.match(/C{${maxPolyBase + 1},}/g) || []).length;

    if (polyA > 0) issues.push(`Poly-A run detected`);
    if (polyT > 0) issues.push(`Poly-T run detected`);
    if (polyG > 0) issues.push(`Poly-G run detected`);
    if (polyC > 0) issues.push(`Poly-C run detected`);

    // 3' end check
    if (avoid3PrimeGC) {
      const lastBase = sequence[sequence.length - 1];
      if (lastBase === 'G' || lastBase === 'C') {
        // Not a strict failure, just a warning
      }
    }

    return {
      isValid: issues.length === 0 || issues.every(i => !i.includes('too')),
      gcContent: gcContent,
      issues: issues
    };
  }

  /**
   * Score a primer candidate (higher is better)
   */
  static scorePrimer(sequence, tm, targetTm, hairpin, selfDimer) {
    let score = 100;

    // Tm closeness to target
    score -= Math.abs(tm - targetTm) * 5;

    // Penalize hairpin risk
    if (hairpin.hasHairpin) {
      score += hairpin.worstStability * 10;
    }

    // Penalize self-dimer
    if (selfDimer.hasDimer) {
      const severityPenalty = { high: 30, medium: 15, low: 5 };
      score -= severityPenalty[selfDimer.worstSeverity] || 0;
    }

    // Prefer moderate GC content (50% is ideal)
    const gc = this.calculateGCContent(sequence);
    score -= Math.abs(gc - 50) * 0.5;

    // Prefer longer primers (up to a point)
    score += Math.min(sequence.length - 18, 7) * 2;

    return score;
  }

  /**
   * Analyze primer pair compatibility
   */
  static analyzePrimerPair(forwardSeq, reverseSeq) {
    const forwardTm = this.calculateTm(forwardSeq);
    const reverseTm = this.calculateTm(reverseSeq);
    const tmDiff = Math.abs(forwardTm - reverseTm);

    const crossDimer = this.detectPrimerDimer(forwardSeq, reverseSeq);

    return {
      tmDifference: tmDiff,
      isTmCompatible: tmDiff <= 5,
      crossDimer: crossDimer,
      isCompatible: tmDiff <= 5 && !crossDimer.isProblematic,
      issues: []
        .concat(tmDiff > 5 ? [`Tm difference too large (${tmDiff.toFixed(1)}°C)`] : [])
        .concat(crossDimer.isProblematic ? ['Problematic primer-dimer detected'] : [])
    };
  }

  /**
   * Calculate coverage of sequencing primers
   */
  static calculateCoverage(primers, totalLength) {
    const covered = new Set();
    for (const primer of primers) {
      // Approximate coverage from primer position
      const start = primer.position.start;
      const end = Math.min(start + 500, totalLength);  // Assume 500bp reads
      for (let i = start; i <= end; i++) {
        covered.add(i);
      }
    }
    return (covered.size / totalLength) * 100;
  }

  /* --------------------------------------------------------- */
  /*  UTILITY FUNCTIONS                                        */
  /* --------------------------------------------------------- */

  /**
   * Get reverse complement
   */
  static reverseComplement(seq) {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
    return seq.toUpperCase().split('').reverse().map(b => complement[b] || b).join('');
  }

  /**
   * Generate primer report
   */
  static generatePrimerReport(primerData) {
    const lines = [
      '=== Primer Design Report ===',
      ''
    ];

    if (primerData.forward) {
      lines.push('Forward Primer:');
      lines.push(`  Sequence: ${primerData.forward.sequence}`);
      lines.push(`  Position: ${primerData.forward.position.start}-${primerData.forward.position.end}`);
      lines.push(`  Length: ${primerData.forward.length} bp`);
      lines.push(`  Tm: ${primerData.forward.tm}°C`);
      lines.push(`  GC%: ${primerData.forward.gcContent.toFixed(1)}%`);
      lines.push('');
    }

    if (primerData.reverse) {
      lines.push('Reverse Primer:');
      lines.push(`  Sequence: ${primerData.reverse.sequence}`);
      lines.push(`  Position: ${primerData.reverse.position.start}-${primerData.reverse.position.end}`);
      lines.push(`  Length: ${primerData.reverse.length} bp`);
      lines.push(`  Tm: ${primerData.reverse.tm}°C`);
      lines.push(`  GC%: ${primerData.reverse.gcContent.toFixed(1)}%`);
      lines.push('');
    }

    if (primerData.pairAnalysis) {
      lines.push('Primer Pair Analysis:');
      lines.push(`  Tm Difference: ${primerData.pairAnalysis.tmDifference.toFixed(1)}°C`);
      lines.push(`  Cross-dimer: ${primerData.pairAnalysis.crossDimer.hasDimer ? 'Detected' : 'None'}`);
      lines.push(`  Compatible: ${primerData.pairAnalysis.isCompatible ? 'Yes' : 'No'}`);
      if (primerData.ampliconSize) {
        lines.push(`  Amplicon Size: ${primerData.ampliconSize} bp`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export primers in various formats
   */
  static exportPrimers(primerData, format = 'csv') {
    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(primerData);
      case 'fasta':
        return this.exportToFASTA(primerData);
      case 'json':
        return JSON.stringify(primerData, null, 2);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  static exportToCSV(primerData) {
    const rows = ['Name,Sequence,Length,Tm,GC%,Position'];
    if (primerData.forward) {
      rows.push(`Forward,${primerData.forward.sequence},${primerData.forward.length},${primerData.forward.tm},${primerData.forward.gcContent.toFixed(1)},${primerData.forward.position.start}-${primerData.forward.position.end}`);
    }
    if (primerData.reverse) {
      rows.push(`Reverse,${primerData.reverse.sequence},${primerData.reverse.length},${primerData.reverse.tm},${primerData.reverse.gcContent.toFixed(1)},${primerData.reverse.position.start}-${primerData.reverse.position.end}`);
    }
    return rows.join('\n');
  }

  static exportToFASTA(primerData) {
    const lines = [];
    if (primerData.forward) {
      lines.push(`>Forward_Primer Tm=${primerData.forward.tm}C GC=${primerData.forward.gcContent.toFixed(1)}%`);
      lines.push(primerData.forward.sequence);
    }
    if (primerData.reverse) {
      lines.push(`>Reverse_Primer Tm=${primerData.reverse.tm}C GC=${primerData.reverse.gcContent.toFixed(1)}%`);
      lines.push(primerData.reverse.sequence);
    }
    return lines.join('\n');
  }
}

// Expose globally
if (typeof window !== 'undefined') {
  window.PrimerDesign = PrimerDesign;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerDesign;
}