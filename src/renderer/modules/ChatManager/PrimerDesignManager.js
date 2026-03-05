/**
 * PrimerDesignManager - Handles PCR/qPCR primer design functionality
 */

class PrimerDesignManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;
  }

  async designPCRPrimers(parameters) {
    const { target_sequence, chromosome, start, end, gene_name, primer_length = 20, tm_range = [55, 65] } = parameters;

    let sequence = target_sequence;

    // Get sequence from genome if coordinates provided
    if (!sequence && chromosome && start !== undefined && end !== undefined) {
      sequence = await this.getSequenceFromCoordinates(chromosome, start, end);
    }

    // Get sequence from gene name if provided
    if (!sequence && gene_name) {
      sequence = await this.getSequenceFromGene(gene_name);
    }

    if (!sequence) {
      throw new Error('Target sequence not provided or could not be retrieved');
    }

    // Design primers
    const primers = this.designPrimers(sequence, primer_length, tm_range);

    return {
      success: true,
      targetSequence: sequence.substring(0, 50) + '...',
      targetLength: sequence.length,
      primers: primers
    };
  }

  async designqPCRPrimers(parameters) {
    const { target_sequence, chromosome, start, end, gene_name, amplicon_size = 150, primer_length = 20 } = parameters;

    let sequence = target_sequence;

    if (!sequence && chromosome && start !== undefined && end !== undefined) {
      sequence = await this.getSequenceFromCoordinates(chromosome, start, end);
    }

    if (!sequence && gene_name) {
      sequence = await this.getSequenceFromGene(gene_name);
    }

    if (!sequence) {
      throw new Error('Target sequence not provided or could not be retrieved');
    }

    // Design qPCR primers with specific amplicon size
    const primers = this.designqPCRPrimersForSequence(sequence, amplicon_size, primer_length);

    return {
      success: true,
      targetSequence: sequence.substring(0, 50) + '...',
      targetLength: sequence.length,
      ampliconSize: amplicon_size,
      primers: primers
    };
  }

  async designPrimersForGene(parameters) {
    const { gene_name, primer_type = 'pcr' } = parameters;

    if (!gene_name) {
      throw new Error('Gene name is required');
    }

    const sequence = await this.getSequenceFromGene(gene_name);
    
    if (!sequence) {
      throw new Error(`Could not retrieve sequence for gene: ${gene_name}`);
    }

    if (primer_type === 'qpcr') {
      return this.designqPCRPrimers({ target_sequence: sequence });
    } else {
      return this.designPCRPrimers({ target_sequence: sequence });
    }
  }

  async analyzePrimerStructure(parameters) {
    const { sequence } = parameters;

    if (!sequence) {
      throw new Error('Primer sequence is required');
    }

    const analysis = {
      length: sequence.length,
      gcContent: this.calculateGCContent(sequence),
      tm: this.calculateTm(sequence),
      hairpin: this.checkHairpin(sequence),
      selfDimer: this.checkSelfDimer(sequence),
      stability: this.assessStability(sequence)
    };

    return {
      success: true,
      analysis: analysis
    };
  }

  async calculateTm(parameters) {
    const { sequence } = parameters;

    if (!sequence) {
      throw new Error('Sequence is required');
    }

    const tm = this.calculateMeltingTemperature(sequence);

    return {
      success: true,
      sequence: sequence,
      length: sequence.length,
      tm: tm,
      method: 'nearest_neighbor'
    };
  }

  // Helper methods

  designPrimers(sequence, primerLength, tmRange) {
    const primers = [];
    
    // Design forward primers
    for (let i = 0; i < Math.min(100, sequence.length - primerLength); i++) {
      const fwdSeq = sequence.substring(i, i + primerLength);
      const tm = this.calculateTm(fwdSeq);
      
      if (tm >= tmRange[0] && tm <= tmRange[1]) {
        primers.push({
          direction: 'forward',
          sequence: fwdSeq,
          position: i,
          tm: tm,
          gcContent: this.calculateGCContent(fwdSeq)
        });
      }
    }

    // Design reverse primers
    const revComp = this.reverseComplement(sequence);
    for (let i = 0; i < Math.min(100, revComp.length - primerLength); i++) {
      const revSeq = revComp.substring(i, i + primerLength);
      const tm = this.calculateTm(revSeq);
      
      if (tm >= tmRange[0] && tm <= tmRange[1]) {
        primers.push({
          direction: 'reverse',
          sequence: revSeq,
          position: sequence.length - i - primerLength,
          tm: tm,
          gcContent: this.calculateGCContent(revSeq)
        });
      }
    }

    // Return best primer pairs
    return this.selectBestPrimerPairs(primers, 3);
  }

  designqPCRPrimersForSequence(sequence, ampliconSize, primerLength) {
    const primers = [];

    // Search for primer pairs with specific amplicon size
    for (let i = 0; i < sequence.length - ampliconSize; i++) {
      const fwdRegion = sequence.substring(i, i + 100);
      const revRegion = sequence.substring(i + ampliconSize - 100, i + ampliconSize);

      const fwdPrimers = this.findPrimersInRegion(fwdRegion, primerLength, 'forward', i);
      const revPrimers = this.findPrimersInRegion(revRegion, primerLength, 'reverse', i + ampliconSize);

      for (const fwd of fwdPrimers) {
        for (const rev of revPrimers) {
          primers.push({
            forward: fwd,
            reverse: rev,
            ampliconSize: ampliconSize,
            ampliconSequence: sequence.substring(fwd.position, rev.position + primerLength)
          });
        }
      }
    }

    return primers.slice(0, 5);
  }

  findPrimersInRegion(region, primerLength, direction, offset) {
    const primers = [];
    const tmRange = [58, 62]; // qPCR specific

    for (let i = 0; i <= region.length - primerLength; i++) {
      const seq = region.substring(i, i + primerLength);
      const tm = this.calculateTm(seq);

      if (tm >= tmRange[0] && tm <= tmRange[1]) {
        primers.push({
          direction: direction,
          sequence: seq,
          position: offset + i,
          tm: tm,
          gcContent: this.calculateGCContent(seq)
        });
      }
    }

    return primers;
  }

  selectBestPrimerPairs(primers, count) {
    // Sort by Tm closeness to 60°C and GC content between 40-60%
    const scored = primers.map(p => ({
      ...p,
      score: Math.abs(p.tm - 60) + (p.gcContent < 40 || p.gcContent > 60 ? 10 : 0)
    }));

    scored.sort((a, b) => a.score - b.score);
    return scored.slice(0, count);
  }

  calculateTm(sequence) {
    // Simple nearest-neighbor approximation
    const seq = sequence.toUpperCase();
    const gc = (seq.match(/[GC]/g) || []).length;
    const at = (seq.match(/[AT]/g) || []).length;
    const length = seq.length;

    if (length < 14) {
      return 2 * at + 4 * gc;
    } else {
      return 64.9 + 41 * (gc - 16.4) / length;
    }
  }

  calculateMeltingTemperature(sequence) {
    return this.calculateTm(sequence);
  }

  calculateGCContent(sequence) {
    const seq = sequence.toUpperCase();
    const gc = (seq.match(/[GC]/g) || []).length;
    return (gc / seq.length * 100).toFixed(1);
  }

  checkHairpin(sequence) {
    // Simplified hairpin check
    const seq = sequence.toUpperCase();
    const revComp = this.reverseComplement(seq);
    
    // Check for 4-base self-complementarity at ends
    const isProblematic = seq.substring(0, 4) === revComp.substring(0, 4);
    
    return {
      isProblematic: isProblematic,
      details: isProblematic ? 'Potential hairpin structure detected' : 'No hairpin detected'
    };
  }

  checkSelfDimer(sequence) {
    // Simplified self-dimer check
    const seq = sequence.toUpperCase();
    const revComp = this.reverseComplement(seq);
    
    // Check for significant complementarity
    let matches = 0;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i] === revComp[seq.length - 1 - i]) {
        matches++;
      }
    }
    
    const isProblematic = matches > seq.length * 0.7;
    
    return {
      isProblematic: isProblematic,
      complementarity: (matches / seq.length * 100).toFixed(1) + '%'
    };
  }

  assessStability(sequence) {
    const gc = parseFloat(this.calculateGCContent(sequence));
    const tm = this.calculateTm(sequence);

    if (gc >= 40 && gc <= 60 && tm >= 55 && tm <= 65) {
      return 'Good';
    } else if (gc >= 35 && gc <= 65 && tm >= 50 && tm <= 70) {
      return 'Acceptable';
    } else {
      return 'Poor';
    }
  }

  async getSequenceFromCoordinates(chromosome, start, end) {
    if (!this.app?.currentSequence?.[chromosome]) {
      return null;
    }
    return this.app.currentSequence[chromosome].substring(start, end);
  }

  async getSequenceFromGene(geneName) {
    if (!this.app?.currentAnnotations) {
      return null;
    }

    // Search for gene in annotations
    for (const chr in this.app.currentAnnotations) {
      const annotations = this.app.currentAnnotations[chr];
      const gene = annotations.find(a => 
        a.name?.toLowerCase() === geneName.toLowerCase() ||
        a.locus_tag?.toLowerCase() === geneName.toLowerCase()
      );

      if (gene && this.app.currentSequence?.[chr]) {
        return this.app.currentSequence[chr].substring(gene.start, gene.end);
      }
    }

    return null;
  }

  reverseComplement(sequence) {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
    return sequence
      .split('')
      .reverse()
      .map(base => complement[base.toUpperCase()] || base)
      .join('');
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerDesignManager;
}
