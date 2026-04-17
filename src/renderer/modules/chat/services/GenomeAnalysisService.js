/**
 * GenomeAnalysisService - Extracted from ChatManager
 */
class GenomeAnalysisService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async getGenomeInfo(params = {}) {
    if (!this.app || !this.app.currentSequence) {
      throw new Error('No genome data loaded');
    }

    const { include_statistics = true, include_annotations = true, include_chromosomes = true } = params;

    const sequenceLength = Object.values(this.app.currentSequence).reduce((acc, seq) => acc + seq.length, 0);

    const genomeInfo = {
      name: this.app.fileManager?.currentGenome?.name || 'Unknown',
      length: this.app.sequenceLength || sequenceLength,
      loadedFiles: this.app.loadedFiles || [],
    };

    if (include_chromosomes) {
      genomeInfo.chromosomes = Object.keys(this.app.currentSequence);
    }

    // Comprehensive statistical counts by gene type (e.g., CDS, tRNA, rRNA)
    if (include_annotations && this.app.currentAnnotations) {
      let totalFeatures = 0;
      let featureCounts = {};
      
      const chromosomes = Object.keys(this.app.currentAnnotations);
      for (const chr of chromosomes) {
        const features = this.app.currentAnnotations[chr] || [];
        totalFeatures += features.length;
        
        for (const feature of features) {
          const type = feature.type || 'unknown';
          featureCounts[type] = (featureCounts[type] || 0) + 1;
        }
      }
      
      genomeInfo.annotations = {
        hasData: true,
        totalFeatures,
        featureCounts
      };
    } else {
      genomeInfo.annotations = {
        hasData: false,
        totalFeatures: 0,
        featureCounts: {}
      };
    }

    // Comprehensive sequence statistics per chromosome
    if (include_statistics) {
       const chromosomeStats = {};
       const chroms = Object.keys(this.app.currentSequence);
       for (const chr of chroms) {
          const seq = this.app.currentSequence[chr];
          const gcCount = (seq.match(/[GgCc]/g) || []).length;
          const gcPercent = Math.round((gcCount / seq.length) * 10000) / 100;
          
          chromosomeStats[chr] = {
             length: seq.length,
             gcPercent: gcPercent
          };
       }
       genomeInfo.statistics = { chromosomeStats };
    }

    return {
      success: true,
      genomeInfo
    };
  }

  async getSequence(params) {
    const { chromosome, start, end } = this._normalizeRegionParams(params);
    if (this.app && this.app.getSequenceForRegion) {
      const sequence = await this.app.getSequenceForRegion(chromosome, start, end);
      return { chromosome, start, end, sequence, length: sequence.length };
    }
    throw new Error('Sequence retrieval not available');
  }

  async sequenceStatistics(params) {
    const {
      include = ['basic', 'composition', 'complexity'],
      sequence,
      sequenceType = 'dna',
    } = params;

    const { chromosome, start, end } = this._normalizeRegionParams(params);
    const chr = chromosome;
    const regionStart = start;
    const regionEnd = end;

    let inputSequence;

    // If sequence is provided directly, use it
    if (sequence) {
      inputSequence = sequence.replace(/\s/g, '').toUpperCase();
      // Remove stop codon if protein sequence
      if (sequenceType === 'protein' && inputSequence.endsWith('*')) {
        inputSequence = inputSequence.slice(0, -1);
      }
    } else {
      inputSequence = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
    }

    const stats = {};

    // Basic composition
    if (include.includes('basic') || include.includes('composition')) {
      if (sequenceType === 'protein') {
        // Protein amino acid composition
        const aaCounts = {};
        const aminoAcids = [
          'A',
          'R',
          'N',
          'D',
          'C',
          'Q',
          'E',
          'G',
          'H',
          'I',
          'L',
          'K',
          'M',
          'F',
          'P',
          'S',
          'T',
          'W',
          'Y',
          'V',
        ];

        // Initialize counts
        aminoAcids.forEach(aa => (aaCounts[aa] = 0));

        // Count amino acids
        for (const aa of inputSequence) {
          if (aminoAcids.includes(aa)) {
            aaCounts[aa]++;
          }
        }

        const length = inputSequence.length;
        const composition = { length: length };

        // Calculate percentages
        aminoAcids.forEach(aa => {
          composition[aa] = {
            count: aaCounts[aa],
            percentage: ((aaCounts[aa] / length) * 100).toFixed(2),
          };
        });

        // Add amino acid properties
        const hydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W', 'Y'];
        const charged = ['R', 'K', 'D', 'E'];
        const polar = ['N', 'Q', 'S', 'T', 'Y'];
        const basic = ['R', 'K', 'H'];
        const acidic = ['D', 'E'];

        const hydrophobicCount = hydrophobic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const chargedCount = charged.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const polarCount = polar.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const basicCount = basic.reduce((sum, aa) => sum + aaCounts[aa], 0);
        const acidicCount = acidic.reduce((sum, aa) => sum + aaCounts[aa], 0);

        composition.properties = {
          hydrophobic: { count: hydrophobicCount, percentage: ((hydrophobicCount / length) * 100).toFixed(2) },
          charged: { count: chargedCount, percentage: ((chargedCount / length) * 100).toFixed(2) },
          polar: { count: polarCount, percentage: ((polarCount / length) * 100).toFixed(2) },
          basic: { count: basicCount, percentage: ((basicCount / length) * 100).toFixed(2) },
          acidic: { count: acidicCount, percentage: ((acidicCount / length) * 100).toFixed(2) },
        };

        stats.composition = composition;
      } else {
        // DNA nucleotide composition
        const counts = { A: 0, T: 0, G: 0, C: 0, N: 0 };
        for (const base of inputSequence) {
          counts[base] = (counts[base] || 0) + 1;
        }

        const length = inputSequence.length;
        stats.composition = {
          length: length,
          A: { count: counts.A, percentage: ((counts.A / length) * 100).toFixed(2) },
          T: { count: counts.T, percentage: ((counts.T / length) * 100).toFixed(2) },
          G: { count: counts.G, percentage: ((counts.G / length) * 100).toFixed(2) },
          C: { count: counts.C, percentage: ((counts.C / length) * 100).toFixed(2) },
          GC: { percentage: (((counts.G + counts.C) / length) * 100).toFixed(2) },
          AT: { percentage: (((counts.A + counts.T) / length) * 100).toFixed(2) },
        };
      }
    }

    // AT/GC skew
    if (include.includes('skew') || include.includes('at_skew') || include.includes('gc_skew')) {
      const windowSize = Math.max(100, Math.floor(sequence.length / 50));
      const skewData = [];

      for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
        const window = sequence.substring(i, i + windowSize);
        const A = (window.match(/A/g) || []).length;
        const T = (window.match(/T/g) || []).length;
        const G = (window.match(/G/g) || []).length;
        const C = (window.match(/C/g) || []).length;

        const atSkew = (A - T) / (A + T) || 0;
        const gcSkew = (G - C) / (G + C) || 0;

        skewData.push({
          position: regionStart + i + windowSize / 2,
          atSkew: parseFloat(atSkew.toFixed(3)),
          gcSkew: parseFloat(gcSkew.toFixed(3)),
        });
      }

      stats.skew = skewData.slice(0, 20); // Limit data points
    }

    // Complexity (low complexity regions)
    if (include.includes('complexity')) {
      const windowSize = 50;
      const lowComplexityRegions = [];

      for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
        const window = sequence.substring(i, i + windowSize);
        const uniqueBases = new Set(window).size;
        const complexity = uniqueBases / 4; // Normalized to 0-1

        if (complexity < 0.6) {
          // Low complexity threshold
          lowComplexityRegions.push({
            start: regionStart + i,
            end: regionStart + i + windowSize,
            complexity: parseFloat(complexity.toFixed(3)),
          });
        }
      }

      stats.complexity = {
        lowComplexityRegions: lowComplexityRegions.length,
        regions: lowComplexityRegions.slice(0, 10),
      };
    }

    return {
      chromosome: chr,
      region: `${regionStart}-${regionEnd}`,
      analysisTypes: include,
      statistics: stats,
    };
  }

  async genomeCodonUsageAnalysis(params) {
    const { featureType = 'CDS', minLength = 300, maxGenes } = params;
    const { chromosome } = this._normalizeRegionParams(params);

    console.log('🧬 [ChatManager] Starting genome-wide codon usage analysis:', params);

    if (!this.app || !this.app.currentAnnotations) {
      console.error('❌ [ChatManager] No genome data loaded');
      console.error('App exists:', !!this.app);
      console.error('currentAnnotations exists:', !!this.app?.currentAnnotations);
      throw new Error('No genome data loaded');
    }

    // Debug: Log the current annotations structure
    console.log('🔍 [ChatManager] currentAnnotations structure:', {
      type: typeof this.app.currentAnnotations,
      isArray: Array.isArray(this.app.currentAnnotations),
      keys: Object.keys(this.app.currentAnnotations),
      keysCount: Object.keys(this.app.currentAnnotations).length,
      sample: Object.keys(this.app.currentAnnotations).slice(0, 3),
    });

    // Get all chromosomes to analyze
    const chromosomes = chromosome ? [chromosome] : Object.keys(this.app.currentAnnotations);

    console.log('📊 [ChatManager] Chromosomes to analyze:', {
      requested: chromosome,
      found: chromosomes,
      count: chromosomes.length,
    });

    if (chromosomes.length === 0) {
      console.error('❌ [ChatManager] No chromosomes found');
      console.error('Available keys in currentAnnotations:', Object.keys(this.app.currentAnnotations));
      console.error('Data structure type:', typeof this.app.currentAnnotations);
      console.error('Is array?', Array.isArray(this.app.currentAnnotations));

      // Check alternative data sources
      if (this.app.annotations) {
        console.log('🔍 Found alternative: app.annotations', Object.keys(this.app.annotations));
      }
      if (this.app.genomeData) {
        console.log('🔍 Found alternative: app.genomeData', Object.keys(this.app.genomeData));
      }

      throw new Error(
        'No chromosomes found in loaded genome. The genome file may not have been loaded properly or the annotation data is empty.'
      );
    }

    // Genetic code and synonymous codon groups
    const geneticCode = {
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

    const synonymousCodons = {
      F: ['TTT', 'TTC'],
      L: ['TTA', 'TTG', 'CTT', 'CTC', 'CTA', 'CTG'],
      S: ['TCT', 'TCC', 'TCA', 'TCG', 'AGT', 'AGC'],
      Y: ['TAT', 'TAC'],
      C: ['TGT', 'TGC'],
      W: ['TGG'],
      P: ['CCT', 'CCC', 'CCA', 'CCG'],
      H: ['CAT', 'CAC'],
      Q: ['CAA', 'CAG'],
      R: ['CGT', 'CGC', 'CGA', 'CGG', 'AGA', 'AGG'],
      I: ['ATT', 'ATC', 'ATA'],
      M: ['ATG'],
      T: ['ACT', 'ACC', 'ACA', 'ACG'],
      N: ['AAT', 'AAC'],
      K: ['AAA', 'AAG'],
      V: ['GTT', 'GTC', 'GTA', 'GTG'],
      A: ['GCT', 'GCC', 'GCA', 'GCG'],
      D: ['GAT', 'GAC'],
      E: ['GAA', 'GAG'],
      G: ['GGT', 'GGC', 'GGA', 'GGG'],
      '*': ['TAA', 'TAG', 'TGA'],
    };

    // Genome-wide codon counts
    const genomeCodonCounts = {};
    const genomeAminoAcidCounts = {};
    let totalGenes = 0;
    let totalCodons = 0;
    let totalSequenceLength = 0;
    const geneResults = [];

    // Iterate through all chromosomes
    for (const chr of chromosomes) {
      const features = this.app.currentAnnotations[chr] || [];

      // Filter for CDS features
      const cdsFeatures = features.filter(f => f.type === featureType);

      for (const feature of cdsFeatures) {
        // Apply length filter
        const featureLength = feature.end - feature.start + 1;
        if (featureLength < minLength) {
          continue;
        }

        // Apply max genes limit if specified
        if (maxGenes && totalGenes >= maxGenes) {
          break;
        }

        try {
          // Get sequence for this feature
          let featureSeq = await this.app.getSequenceForRegion(chr, feature.start, feature.end);

          // Handle negative strand
          if (feature.strand === '-') {
            featureSeq = this.reverseComplement(featureSeq);
          }

          // Count codons in this feature
          for (let i = 0; i < featureSeq.length - 2; i += 3) {
            const codon = featureSeq.substring(i, i + 3);
            const aminoAcid = geneticCode[codon];

            if (aminoAcid) {
              genomeCodonCounts[codon] = (genomeCodonCounts[codon] || 0) + 1;
              genomeAminoAcidCounts[aminoAcid] = (genomeAminoAcidCounts[aminoAcid] || 0) + 1;
              totalCodons++;
            }
          }

          totalSequenceLength += featureSeq.length;
          totalGenes++;

          geneResults.push({
            chromosome: chr,
            name: feature.name || feature.id,
            locusTag: feature.locusTag,
            start: feature.start,
            end: feature.end,
            length: featureLength,
            strand: feature.strand,
          });
        } catch (error) {
          console.warn(`Failed to analyze gene ${feature.name || feature.id}:`, error);
          continue;
        }
      }

      // Break if maxGenes reached
      if (maxGenes && totalGenes >= maxGenes) {
        break;
      }
    }

    if (totalGenes === 0) {
      throw new Error(`No ${featureType} features found matching criteria (minLength: ${minLength})`);
    }

    // Calculate genome-wide RSCU and preferences
    const genomeRSCU = {};
    const genomeCodonPreferences = {};

    for (const [aa, codons] of Object.entries(synonymousCodons)) {
      const aaCount = genomeAminoAcidCounts[aa] || 0;
      if (aaCount > 0) {
        const expectedFreq = codons.length > 1 ? aaCount / codons.length : aaCount;

        genomeCodonPreferences[aa] = {
          aminoAcid: aa,
          totalCount: aaCount,
          synonymousCodons: codons.length,
          codons: [],
          statistics: {},
        };

        // Calculate RSCU for each codon
        for (const codon of codons) {
          const observedCount = genomeCodonCounts[codon] || 0;
          const rscuValue = expectedFreq > 0 ? observedCount / expectedFreq : 0;
          genomeRSCU[codon] = rscuValue;

          // Classify preference level
          let preference = 'neutral';
          if (codons.length > 1) {
            if (rscuValue > 1.5) preference = 'highly preferred';
            else if (rscuValue > 1.0) preference = 'preferred';
            else if (rscuValue < 0.3) preference = 'highly rare';
            else if (rscuValue < 0.6) preference = 'rare';
          }

          genomeCodonPreferences[aa].codons.push({
            codon: codon,
            count: observedCount,
            percentage: aaCount > 0 ? parseFloat(((observedCount / aaCount) * 100).toFixed(2)) : 0,
            rscu: parseFloat(rscuValue.toFixed(3)),
            preference: preference,
          });
        }

        // Sort codons by usage within each amino acid (descending)
        genomeCodonPreferences[aa].codons.sort((a, b) => b.percentage - a.percentage);

        // Set most and least preferred
        if (genomeCodonPreferences[aa].codons.length > 0) {
          genomeCodonPreferences[aa].mostPreferred = genomeCodonPreferences[aa].codons[0].codon;
          genomeCodonPreferences[aa].leastPreferred =
            genomeCodonPreferences[aa].codons[genomeCodonPreferences[aa].codons.length - 1].codon;

          // Calculate usage statistics for multi-codon amino acids
          if (codons.length > 1) {
            const usagePercentages = genomeCodonPreferences[aa].codons.map(c => c.percentage);
            const mean = usagePercentages.reduce((sum, p) => sum + p, 0) / usagePercentages.length;
            const variance =
              usagePercentages.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / usagePercentages.length;
            const stdDev = Math.sqrt(variance);

            // Calculate Effective Number of Codons (ENC) for this amino acid
            // ENC = 1 / sum(p_i^2) where p_i is the proportion of each codon
            const encValue =
              1 /
              genomeCodonPreferences[aa].codons.reduce((sum, c) => {
                const proportion = c.percentage / 100;
                return sum + proportion * proportion;
              }, 0);

            genomeCodonPreferences[aa].statistics = {
              mean: parseFloat(mean.toFixed(2)),
              stdDev: parseFloat(stdDev.toFixed(2)),
              coefficientOfVariation: mean > 0 ? parseFloat(((stdDev / mean) * 100).toFixed(2)) : 0,
              effectiveNumberOfCodons: parseFloat(encValue.toFixed(2)),
              biasStrength: parseFloat((((codons.length - encValue) / (codons.length - 1)) * 100).toFixed(2)), // 0-100% bias strength
            };
          } else {
            genomeCodonPreferences[aa].statistics = {
              mean: 100,
              stdDev: 0,
              coefficientOfVariation: 0,
              effectiveNumberOfCodons: 1,
              biasStrength: 0, // No bias for single-codon amino acids
            };
          }
        }
      }
    }

    // Calculate overall codon usage
    const genomeCodonUsage = Object.entries(genomeCodonCounts)
      .map(([codon, count]) => ({
        codon: codon,
        aminoAcid: geneticCode[codon],
        count: count,
        frequency: parseFloat(((count / totalCodons) * 100).toFixed(2)),
        rscu: genomeRSCU[codon] ? parseFloat(genomeRSCU[codon].toFixed(3)) : null,
      }))
      .sort((a, b) => b.frequency - a.frequency);

    // Calculate GC content at different codon positions
    const gcByPosition = { pos1: 0, pos2: 0, pos3: 0 };
    for (const [codon, count] of Object.entries(genomeCodonCounts)) {
      if (codon.length === 3) {
        if (codon[0] === 'G' || codon[0] === 'C') gcByPosition.pos1 += count;
        if (codon[1] === 'G' || codon[1] === 'C') gcByPosition.pos2 += count;
        if (codon[2] === 'G' || codon[2] === 'C') gcByPosition.pos3 += count;
      }
    }

    const gcContent = {
      position1: parseFloat(((gcByPosition.pos1 / totalCodons) * 100).toFixed(2)),
      position2: parseFloat(((gcByPosition.pos2 / totalCodons) * 100).toFixed(2)),
      position3: parseFloat(((gcByPosition.pos3 / totalCodons) * 100).toFixed(2)),
      overall: parseFloat(
        (((gcByPosition.pos1 + gcByPosition.pos2 + gcByPosition.pos3) / (totalCodons * 3)) * 100).toFixed(2)
      ),
    };

    console.log(
      `✅ [ChatManager] Genome-wide codon usage analysis complete: ${totalGenes} genes, ${totalCodons} codons`
    );

    // Truncate analyzedGenes to prevent huge response (keep only first 20 as sample)
    const sampleGenes = geneResults.slice(0, 20);

    // Truncate codonPreferences - only include top amino acids with significant bias
    const truncatedPreferences = {};
    const sortedAAs = Object.entries(genomeCodonPreferences)
      .filter(([aa]) => aa !== '*') // Exclude stop codons
      .sort((a, b) => (b[1].statistics?.biasStrength || 0) - (a[1].statistics?.biasStrength || 0))
      .slice(0, 10); // Top 10 amino acids with most bias

    for (const [aa, pref] of sortedAAs) {
      truncatedPreferences[aa] = pref;
    }

    return {
      success: true,
      analysisType: 'genome-wide',
      totalGenes: totalGenes,
      totalCodons: totalCodons,
      totalSequenceLength: totalSequenceLength,
      chromosomes: chromosomes,
      featureType: featureType,
      minLength: minLength,
      uniqueCodons: Object.keys(genomeCodonCounts).length,
      // Only include top/bottom codons, not full array
      mostFrequentCodons: genomeCodonUsage.slice(0, 10),
      leastFrequentCodons: genomeCodonUsage.slice(-10).reverse(),
      aminoAcidComposition: genomeAminoAcidCounts,
      // Truncated preferences (top 10 by bias strength)
      codonPreferences: truncatedPreferences,
      gcContent: gcContent,
      // Sample of analyzed genes (first 20 only)
      analyzedGenesSample: sampleGenes,
      totalGenesAnalyzed: geneResults.length,
      note: `Showing sample of ${sampleGenes.length} genes out of ${geneResults.length} total. Full data available via ChatBox.`,
    };
  }

  async aminoAcidComposition(params) {
    const { proteinSequence, geneName } = params;

    if (!proteinSequence) {
      throw new Error('Protein sequence is required for amino acid composition analysis');
    }

    // Clean the sequence (remove stop codon if present)
    let cleanSequence = proteinSequence.replace(/\s/g, '').toUpperCase();
    if (cleanSequence.endsWith('*')) {
      cleanSequence = cleanSequence.slice(0, -1);
    }

    // Define amino acids and their properties
    const aminoAcids = [
      'A',
      'R',
      'N',
      'D',
      'C',
      'Q',
      'E',
      'G',
      'H',
      'I',
      'L',
      'K',
      'M',
      'F',
      'P',
      'S',
      'T',
      'W',
      'Y',
      'V',
    ];
    const aminoAcidNames = {
      A: 'Alanine',
      R: 'Arginine',
      N: 'Asparagine',
      D: 'Aspartic acid',
      C: 'Cysteine',
      Q: 'Glutamine',
      E: 'Glutamic acid',
      G: 'Glycine',
      H: 'Histidine',
      I: 'Isoleucine',
      L: 'Leucine',
      K: 'Lysine',
      M: 'Methionine',
      F: 'Phenylalanine',
      P: 'Proline',
      S: 'Serine',
      T: 'Threonine',
      W: 'Tryptophan',
      Y: 'Tyrosine',
      V: 'Valine',
    };

    const hydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W', 'Y'];
    const charged = ['R', 'K', 'D', 'E'];
    const polar = ['N', 'Q', 'S', 'T', 'Y'];
    const basic = ['R', 'K', 'H'];
    const acidic = ['D', 'E'];
    const aromatic = ['F', 'W', 'Y'];
    const small = ['A', 'G', 'S'];

    // Count amino acids
    const aaCounts = {};
    aminoAcids.forEach(aa => (aaCounts[aa] = 0));

    for (const aa of cleanSequence) {
      if (aminoAcids.includes(aa)) {
        aaCounts[aa]++;
      }
    }

    const length = cleanSequence.length;

    // Calculate composition
    const composition = aminoAcids
      .map(aa => ({
        aa: aa,
        name: aminoAcidNames[aa],
        count: aaCounts[aa],
        percentage: ((aaCounts[aa] / length) * 100).toFixed(2),
      }))
      .sort((a, b) => b.count - a.count);

    // Calculate property groups
    const hydrophobicCount = hydrophobic.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const chargedCount = charged.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const polarCount = polar.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const basicCount = basic.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const acidicCount = acidic.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const aromaticCount = aromatic.reduce((sum, aa) => sum + aaCounts[aa], 0);
    const smallCount = small.reduce((sum, aa) => sum + aaCounts[aa], 0);

    const properties = {
      hydrophobic: { count: hydrophobicCount, percentage: ((hydrophobicCount / length) * 100).toFixed(2) },
      charged: { count: chargedCount, percentage: ((chargedCount / length) * 100).toFixed(2) },
      polar: { count: polarCount, percentage: ((polarCount / length) * 100).toFixed(2) },
      basic: { count: basicCount, percentage: ((basicCount / length) * 100).toFixed(2) },
      acidic: { count: acidicCount, percentage: ((acidicCount / length) * 100).toFixed(2) },
      aromatic: { count: aromaticCount, percentage: ((aromaticCount / length) * 100).toFixed(2) },
      small: { count: smallCount, percentage: ((smallCount / length) * 100).toFixed(2) },
    };

    return {
      gene: geneName || 'Unknown',
      length: length,
      composition: composition,
      properties: properties,
      mostAbundant: composition.slice(0, 5),
      leastAbundant: composition
        .filter(aa => aa.count > 0)
        .slice(-5)
        .reverse(),
    };
  }


  /**
   * Normalize region parameters (chromosome, start, end) with aliases and fallbacks
   */
  _normalizeRegionParams(params) {
    if (!params) params = {};

    // 1. Extract chromosome with aliases
    let chromosome = params.chromosome || params.chrom || params.chr || params.target;

    // 2. Fallback to app state if missing
    if (!chromosome && this.app) {
      chromosome = this.app.currentChromosome;
    }

    if (!chromosome) {
      throw new Error('No chromosome specified and none currently selected');
    }

    // 3. Extract start/end with aliases
    let start = params.start !== undefined ? params.start : (params.begin !== undefined ? params.begin : null);
    let end = params.end !== undefined ? params.end : (params.stop !== undefined ? params.stop : null);

    // 4. Fallback to current browser position if positions are missing
    if (start === null && this.app && this.app.currentPosition) {
      start = this.app.currentPosition.start;
    }
    if (end === null && this.app && this.app.currentPosition) {
      end = this.app.currentPosition.end;
    }

    // 5. Hard fallbacks to chromosome boundaries
    if (start === null) start = 1;
    if (end === null && this.app && this.app.currentSequence && this.app.currentSequence[chromosome]) {
      end = this.app.currentSequence[chromosome].length;
    } else if (end === null) {
      // Default small region if length unknown
      end = start + 1000;
    }

    // Ensure numeric
    start = parseInt(start);
    end = parseInt(end);

    return { chromosome, start, end };
  }
}

window.GenomeAnalysisService = GenomeAnalysisService;
