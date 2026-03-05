/**
 * GenomicsToolManager - Handles genome analysis functions
 */

class GenomicsToolManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;
  }

  async navigateToPosition(params) {
    const { chromosome, position, start, end } = params;
    
    if (!this.app) {
      throw new Error('App not available');
    }

    const chr = chromosome || this.app.currentChromosome;
    const pos = position || start || 1;

    if (!chr) {
      throw new Error('No chromosome specified');
    }

    // Navigate to position
    this.app.currentChromosome = chr;
    this.app.currentPosition = pos;

    if (this.app.genomeNavigationBar) {
      this.app.genomeNavigationBar.navigateToPosition(chr, pos);
    }

    return {
      success: true,
      chromosome: chr,
      position: pos,
      message: `Navigated to ${chr}:${pos.toLocaleString()}`
    };
  }

  async searchGeneByName(params) {
    const { gene_name, geneName } = params;
    const searchTerm = gene_name || geneName;

    if (!searchTerm) {
      throw new Error('Gene name is required');
    }

    if (!this.app || !this.app.navigationManager) {
      throw new Error('Navigation manager not available');
    }

    const results = this.app.navigationManager.searchAnnotations(searchTerm);

    return {
      success: true,
      query: searchTerm,
      count: results.length,
      results: results.slice(0, 10) // Limit to first 10
    };
  }

  async getSequence(params) {
    const { chromosome, start, end, chr } = params;
    
    const chrom = chromosome || chr || this.app?.currentChromosome;
    
    if (!chrom || !this.app?.currentSequence?.[chrom]) {
      throw new Error('Chromosome data not available');
    }

    const seq = this.app.currentSequence[chrom];
    const s = Math.max(0, start || 0);
    const e = Math.min(seq.length, end || seq.length);

    return {
      success: true,
      chromosome: chrom,
      start: s,
      end: e,
      length: e - s,
      sequence: seq.substring(s, e)
    };
  }

  async analyzeRegion(params) {
    const { chromosome, start, end, chr } = params;
    
    const chrom = chromosome || chr || this.app?.currentChromosome;
    
    if (!chrom) {
      throw new Error('Chromosome not specified');
    }

    const analysis = {
      chromosome: chrom,
      start: start || 0,
      end: end || 0,
      features: []
    };

    // Get features in region
    if (this.app?.currentAnnotations?.[chrom]) {
      const annotations = this.app.currentAnnotations[chrom];
      analysis.features = annotations.filter(f => 
        f.end >= start && f.start <= end
      );
    }

    return {
      success: true,
      ...analysis,
      featureCount: analysis.features.length
    };
  }

  async calculateGCContent(params) {
    const { chromosome, start, end, sequence, chr } = params;
    
    let seq;
    
    if (sequence) {
      seq = sequence;
    } else {
      const chrom = chromosome || chr || this.app?.currentChromosome;
      if (!chrom || !this.app?.currentSequence?.[chrom]) {
        throw new Error('Sequence data not available');
      }
      const fullSeq = this.app.currentSequence[chrom];
      seq = fullSeq.substring(start || 0, end || fullSeq.length);
    }

    const gc = (seq.match(/[gcGC]/g) || []).length;
    const at = (seq.match(/[atAT]/g) || []).length;
    const total = gc + at;

    return {
      success: true,
      gcCount: gc,
      atCount: at,
      total: total,
      gcContent: total > 0 ? (gc / total * 100).toFixed(2) + '%' : 'N/A',
      gcRatio: total > 0 ? (gc / total).toFixed(4) : 0
    };
  }

  async findOpenReadingFrames(params) {
    const { chromosome, start, end, min_length = 300, chr } = params;
    
    const chrom = chromosome || chr || this.app?.currentChromosome;
    
    if (!chrom || !this.app?.currentSequence?.[chrom]) {
      throw new Error('Sequence data not available');
    }

    const seq = this.app.currentSequence[chrom];
    const s = start || 0;
    const e = end || seq.length;
    const region = seq.substring(s, e);

    const orfs = [];
    const startCodons = ['ATG'];
    const stopCodons = ['TAA', 'TAG', 'TGA'];

    // Search on both strands
    for (let strand of [1, -1]) {
      const searchSeq = strand === 1 ? region : this.reverseComplement(region);
      
      for (let frame = 0; frame < 3; frame++) {
        let inOrf = false;
        let orfStart = 0;

        for (let i = frame; i < searchSeq.length - 2; i += 3) {
          const codon = searchSeq.substring(i, i + 3).toUpperCase();

          if (!inOrf && startCodons.includes(codon)) {
            inOrf = true;
            orfStart = i;
          } else if (inOrf && stopCodons.includes(codon)) {
            const length = i - orfStart + 3;
            if (length >= min_length) {
              orfs.push({
                start: strand === 1 ? s + orfStart : e - i - 3,
                end: strand === 1 ? s + i + 3 : e - orfStart,
                length: length,
                strand: strand,
                frame: frame
              });
            }
            inOrf = false;
          }
        }
      }
    }

    return {
      success: true,
      count: orfs.length,
      orfs: orfs
    };
  }

  async searchMotif(params) {
    const { chromosome, pattern, motif, chr } = params;
    
    const searchPattern = pattern || motif;
    const chrom = chromosome || chr || this.app?.currentChromosome;
    
    if (!chrom || !this.app?.currentSequence?.[chrom]) {
      throw new Error('Sequence data not available');
    }

    if (!searchPattern) {
      throw new Error('Search pattern is required');
    }

    const seq = this.app.currentSequence[chrom].toUpperCase();
    const patternUpper = searchPattern.toUpperCase();
    const matches = [];

    // Simple exact match search
    let pos = seq.indexOf(patternUpper);
    while (pos !== -1) {
      matches.push({
        position: pos,
        sequence: patternUpper,
        strand: '+'
      });
      pos = seq.indexOf(patternUpper, pos + 1);
    }

    // Search reverse complement
    const revComp = this.reverseComplement(patternUpper);
    if (revComp !== patternUpper) {
      pos = seq.indexOf(revComp);
      while (pos !== -1) {
        matches.push({
          position: pos,
          sequence: revComp,
          strand: '-'
        });
        pos = seq.indexOf(revComp, pos + 1);
      }
    }

    return {
      success: true,
      pattern: searchPattern,
      matches: matches.sort((a, b) => a.position - b.position)
    };
  }

  async findRestrictionSites(params) {
    const { chromosome, enzyme, chr } = params;
    
    const chrom = chromosome || chr || this.app?.currentChromosome;
    
    if (!chrom || !this.app?.currentSequence?.[chrom]) {
      throw new Error('Sequence data not available');
    }

    if (!enzyme) {
      throw new Error('Enzyme name is required');
    }

    // Common restriction enzymes
    const enzymes = {
      'ECORI': { site: 'GAATTC', cut: 1 },
      'BAMHI': { site: 'GGATCC', cut: 1 },
      'HINDIII': { site: 'AAGCTT', cut: 1 },
      'XHOI': { site: 'CTCGAG', cut: 1 },
      'PVUII': { site: 'CAGCTG', cut: 3 },
      'SALI': { site: 'GTCGAC', cut: 1 },
      'KPNI': { site: 'GGTACC', cut: 5 },
      'SMAI': { site: 'CCCGGG', cut: 3 }
    };

    const enzymeInfo = enzymes[enzyme.toUpperCase()];
    if (!enzymeInfo) {
      throw new Error(`Unknown enzyme: ${enzyme}`);
    }

    const seq = this.app.currentSequence[chrom].toUpperCase();
    const sites = [];
    let pos = seq.indexOf(enzymeInfo.site);

    while (pos !== -1) {
      sites.push({
        position: pos,
        site: enzymeInfo.site,
        cutSite: pos + enzymeInfo.cut
      });
      pos = seq.indexOf(enzymeInfo.site, pos + 1);
    }

    return {
      success: true,
      enzyme: enzyme,
      recognitionSite: enzymeInfo.site,
      siteCount: sites.length,
      sites: sites
    };
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
  module.exports = GenomicsToolManager;
}
