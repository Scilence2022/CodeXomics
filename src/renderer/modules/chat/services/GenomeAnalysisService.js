/**
 * GenomeAnalysisService - Handles sequence analysis operations extracted from ChatManager
 */
class GenomeAnalysisService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // 1. SEQUENCE RETRIEVAL AND BASIC OPS
  getSequenceSelection() {
    if (this.app.uiManager) {
      return this.app.uiManager.getSelection();
    }
    return null;
  }

  async getSequence(params) {
    const { chromosome, start, end, strand = '+' } = params;

    if (!chromosome || start === undefined || end === undefined) {
      throw new Error('Missing required parameters: chromosome, start, end');
    }

    if (!this.app.currentSequence || !this.app.currentSequence[chromosome]) {
      throw new Error(`Sequence not found for chromosome: ${chromosome}`);
    }

    let sequence = this.app.currentSequence[chromosome].substring(start - 1, end);

    if (strand === '-') {
      sequence = this.reverseComplement(sequence);
    }

    return {
      success: true,
      chromosome,
      start,
      end,
      strand,
      length: sequence.length,
      sequence,
    };
  }

  reverseComplement(paramsOrSequence) {
    const sequence = typeof paramsOrSequence === 'object' ? (paramsOrSequence.sequence || paramsOrSequence.dna_sequence || paramsOrSequence.dna) : paramsOrSequence;
    
    if (!sequence || typeof sequence !== 'string') {
      throw new Error('Sequence is required');
    }

    if (this.app?.stringUtils && typeof this.app.stringUtils.reverseComplement === 'function') {
      return this.app.stringUtils.reverseComplement(sequence);
    }
    
    // Fallback implementation
    const complementMap = {
      'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C',
      'a': 't', 't': 'a', 'c': 'g', 'g': 'c',
      'N': 'N', 'n': 'n'
    };
    
    return sequence
      .split('')
      .reverse()
      .map(char => complementMap[char] || char)
      .join('');
  }

  // 2. CODING AND TRANSLATION
  async getCodingSequence(params) {
    const locusTag = params.locusTag || params.locus_tag;
    const geneName = params.geneName || params.gene_name;
    
    if (!locusTag && !geneName) {
      throw new Error('Must provide either locusTag (locus_tag) or geneName (gene_name)');
    }
    
    // Attempt to use MicrobeGenomicsFunctions
    if (window.MicrobeFns && window.MicrobeFns.getCodingSequence) {
      try {
        const id = locusTag || geneName;
        return window.MicrobeFns.getCodingSequence(id);
      } catch (e) {
        console.warn('MicrobeFns.getCodingSequence fallback:', e);
      }
    }
    
    // Fallback logic
    if (this.chatManager && typeof this.chatManager.searchGeneByName === 'function') {
      const searchResult = await this.chatManager.searchGeneByName({ name: locusTag || geneName });
      
      if (searchResult.found && searchResult.genes.length > 0) {
        const gene = searchResult.genes[0];
        return this.getSequence({
          chromosome: gene.chromosome || searchResult.chromosome || this.app.currentChromosome,
          start: gene.start,
          end: gene.end,
          strand: gene.strand
        });
      }
    }
    
    throw new Error(`Could not extract coding sequence for ${locusTag || geneName}`);
  }

  async translateSequence(params) {
    const sequence = typeof params === 'string' ? params : (params.sequence || params.dna_sequence || params.dna);
    const strand = params.strand || '+';
    const geneticCode = params.geneticCode || params.genetic_code || 11;
    
    if (!sequence) {
      throw new Error('Sequence is required for translation');
    }

    let seqToProcess = sequence.toUpperCase().replace(/U/g, 'T');
    if (strand === '-') {
      seqToProcess = this.reverseComplement(seqToProcess);
    }
    
    // Use app stringUtils if available
    if (this.app.stringUtils && this.app.stringUtils.translate) {
      const protein = this.app.stringUtils.translate(seqToProcess);
      return { success: true, protein_sequence: protein, length: protein.length };
    }
    
    // Built-in standard genetic code fallback (NCBI code 1 / bacterial code 11 for initiation)
    const CODON_TABLE = {
      'TTT':'F','TTC':'F','TTA':'L','TTG':'L',
      'CTT':'L','CTC':'L','CTA':'L','CTG':'L',
      'ATT':'I','ATC':'I','ATA':'I','ATG':'M',
      'GTT':'V','GTC':'V','GTA':'V','GTG':'V',
      'TCT':'S','TCC':'S','TCA':'S','TCG':'S',
      'CCT':'P','CCC':'P','CCA':'P','CCG':'P',
      'ACT':'T','ACC':'T','ACA':'T','ACG':'T',
      'GCT':'A','GCC':'A','GCA':'A','GCG':'A',
      'TAT':'Y','TAC':'Y','TAA':'*','TAG':'*',
      'CAT':'H','CAC':'H','CAA':'Q','CAG':'Q',
      'AAT':'N','AAC':'N','AAA':'K','AAG':'K',
      'GAT':'D','GAC':'D','GAA':'E','GAG':'E',
      'TGT':'C','TGC':'C','TGA':'*','TGG':'W',
      'CGT':'R','CGC':'R','CGA':'R','CGG':'R',
      'AGT':'S','AGC':'S','AGA':'R','AGG':'R',
      'GGT':'G','GGC':'G','GGA':'G','GGG':'G'
    };
    
    let protein = '';
    for (let i = 0; i + 2 < seqToProcess.length; i += 3) {
      const codon = seqToProcess.substring(i, i + 3);
      const aa = CODON_TABLE[codon] || 'X';
      if (aa === '*') break; // stop at stop codon
      protein += aa;
    }
    
    return {
      success: true,
      protein_sequence: protein,
      length: protein.length
    };
  }

  // 3. ANALYSIS METRICS
  async calculateGCContent(params) {
    let sequence = typeof params === 'string' ? params : (params.sequence || params.dna_sequence || params.dna);
    
    if (!sequence && params.chromosome && params.start && params.end) {
      const seqResult = await this.getSequence(params);
      sequence = seqResult.sequence;
    }
    
    if (!sequence) {
      throw new Error('Must provide sequence or region coordinates');
    }
    
    const gcCount = (sequence.match(/[GCgc]/g) || []).length;
    const gcPercentage = (gcCount / sequence.length) * 100;
    
    return {
      success: true,
      length: sequence.length,
      gc_count: gcCount,
      gc_percentage: gcPercentage.toFixed(2)
    };
  }

  async codonUsageAnalysis(params) {
    let sequence = typeof params === 'string' ? params : (params.sequence || params.dna_sequence || params.dna);
    
    if (!sequence && params.chromosome && params.start && params.end) {
      const seqResult = await this.getSequence(params);
      sequence = seqResult.sequence;
    }
    
    if (!sequence) {
      throw new Error('Must provide sequence or region coordinates');
    }
    
    sequence = sequence.toUpperCase();
    
    // Simple codon counting
    const codons = {};
    const totalCodons = Math.floor(sequence.length / 3);
    
    for (let i = 0; i < sequence.length - 2; i += 3) {
      const codon = sequence.substring(i, i + 3);
      codons[codon] = (codons[codon] || 0) + 1;
    }
    
    // Calculate frequencies
    const frequencies = {};
    for (const [codon, count] of Object.entries(codons)) {
      frequencies[codon] = {
        count,
        frequency: ((count / totalCodons) * 1000).toFixed(2) + ' per 1000' // similar to standard RSCU output
      };
    }
    
    return {
      success: true,
      total_codons: totalCodons,
      codon_usage: frequencies
    };
  }

  async findOpenReadingFrames(params) {
    let sequence = typeof params === 'string' ? params : (params.sequence || params.dna_sequence || params.dna);
    const minLength = params.minLength || params.min_length || 100; // in bp
    const strand = params.strand || 'both'; // '+', '-', or 'both'
    
    if (!sequence && params.chromosome && params.start && params.end) {
      const seqResult = await this.getSequence(params);
      sequence = seqResult.sequence;
    }
    
    if (!sequence) {
      throw new Error('Must provide sequence or region coordinates');
    }

    const orfs = [];
    const minCodons = Math.floor(minLength / 3);
    
    // Standard start/stop codons (genetic code 11 default)
    const startCodons = ['ATG', 'GTG', 'TTG'];
    const stopCodons = ['TAA', 'TAG', 'TGA'];
    
    const analyzeStrand = (seq, currentStrand) => {
      const strandOrfs = [];
      const seqUpper = seq.toUpperCase();
      
      // Look in all 3 frames
      for (let frame = 0; frame < 3; frame++) {
        let inOrf = false;
        let startPos = -1;
        
        for (let i = frame; i < seqUpper.length - 2; i += 3) {
          const codon = seqUpper.substring(i, i + 3);
          
          if (!inOrf && startCodons.includes(codon)) {
            inOrf = true;
            startPos = i;
          } else if (inOrf && stopCodons.includes(codon)) {
            const length = i + 3 - startPos;
            if (length >= minLength) {
              strandOrfs.push({
                start: currentStrand === '+' ? startPos + 1 : seq.length - (i + 3) + 1,
                end: currentStrand === '+' ? i + 3 : seq.length - startPos,
                strand: currentStrand,
                frame: frame + 1,
                length: length,
                start_codon: seqUpper.substring(startPos, startPos + 3),
                stop_codon: codon
              });
            }
            inOrf = false; // reset for next ORF
          }
        }
      }
      return strandOrfs;
    };
    
    if (strand === '+' || strand === 'both') {
      orfs.push(...analyzeStrand(sequence, '+'));
    }
    
    if (strand === '-' || strand === 'both') {
      const revComp = this.reverseComplement(sequence);
      orfs.push(...analyzeStrand(revComp, '-'));
    }
    
    // Sort by length descending
    orfs.sort((a, b) => b.length - a.length);
    
    return {
      success: true,
      sequence_length: sequence.length,
      orf_count: orfs.length,
      min_length: minLength,
      orfs
    };
  }

  // 4. BROWSER/WORKSPACE INFO
  async getGenomeInfo(params) {
    if (!this.app.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
      throw new Error('No genome loaded');
    }
    
    const chromosomes = Object.keys(this.app.currentSequence);
    const summary = {
      chromosomes: chromosomes.length,
      total_length: 0,
      total_annotations: 0
    };
    
    const details = chromosomes.map(chr => {
      const seqLen = this.app.currentSequence[chr].length;
      const annCount = this.app.currentAnnotations?.[chr]?.length || 0;
      
      summary.total_length += seqLen;
      summary.total_annotations += annCount;
      
      return {
        id: chr,
        length: seqLen,
        annotation_count: annCount
      };
    });
    
    return {
      success: true,
      summary,
      chromosomes: details
    };
  }

  checkGenomicsEnvironment() {
    return {
      success: true,
      hasSequence: !!this.app.currentSequence && Object.keys(this.app.currentSequence).length > 0,
      hasAnnotations: !!this.app.currentAnnotations && Object.keys(this.app.currentAnnotations).length > 0,
      currentChromosome: this.app.currentChromosome || null,
      microbeToolsAvailable: typeof window.MicrobeFns !== 'undefined'
    };
  }

  // ALIASES for tools that use snake_case logic
  async computeGc(params) {
    return this.calculateGCContent(params);
  }

  async translateDna(params) {
    return this.translateSequence(params);
  }
}

// Make it available globally if needed by plugin system
window.GenomeAnalysisService = GenomeAnalysisService;
