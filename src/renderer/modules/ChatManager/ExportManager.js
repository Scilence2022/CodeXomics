/**
 * ExportManager - Handles data export functionality
 */

class ExportManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;
  }

  async exportData(params) {
    const { format = 'json', data_type = 'all' } = params;

    switch (data_type) {
      case 'sequence':
        return this.exportFastaSequence(params);
      case 'annotations':
        return this.exportGFFAnnotations(params);
      case 'features':
        return this.exportFeatures(params);
      default:
        return this.exportAllData(params);
    }
  }

  async exportFastaSequence(parameters) {
    const { chromosome, start, end, filename } = parameters;

    if (!this.app?.currentSequence) {
      throw new Error('No sequence data available');
    }

    const chr = chromosome || this.app.currentChromosome;
    if (!chr || !this.app.currentSequence[chr]) {
      throw new Error('Chromosome not found');
    }

    const seq = this.app.currentSequence[chr];
    const s = start || 0;
    const e = end || seq.length;
    const regionSeq = seq.substring(s, e);

    const header = `>${chr}:${s}-${e} exported from CodeXomics`;
    const fastaContent = this.formatFasta(header, regionSeq);

    const defaultFilename = filename || `${chr}_${s}_${e}.fasta`;
    this.downloadFile(fastaContent, defaultFilename, 'text/plain');

    return {
      success: true,
      format: 'FASTA',
      filename: defaultFilename,
      sequenceLength: regionSeq.length
    };
  }

  async exportGenBankFormat(parameters) {
    const { chromosome, filename } = parameters;

    if (!this.app?.currentSequence || !this.app?.currentAnnotations) {
      throw new Error('Genome data not available');
    }

    const chr = chromosome || this.app.currentChromosome;
    if (!chr) {
      throw new Error('Chromosome not specified');
    }

    const sequence = this.app.currentSequence[chr];
    const annotations = this.app.currentAnnotations[chr] || [];

    const genbankContent = this.formatGenBank(chr, sequence, annotations);

    const defaultFilename = filename || `${chr}.gb`;
    this.downloadFile(genbankContent, defaultFilename, 'text/plain');

    return {
      success: true,
      format: 'GenBank',
      filename: defaultFilename,
      featureCount: annotations.length
    };
  }

  async exportCDSFasta(parameters) {
    const { chromosome, filename } = parameters;

    if (!this.app?.currentSequence || !this.app?.currentAnnotations) {
      throw new Error('Genome data not available');
    }

    const chr = chromosome || this.app.currentChromosome;
    if (!chr) {
      throw new Error('Chromosome not specified');
    }

    const sequence = this.app.currentSequence[chr];
    const annotations = this.app.currentAnnotations[chr] || [];

    // Extract CDS sequences
    let fastaContent = '';
    const cdsFeatures = annotations.filter(a => a.type === 'CDS' || a.type === 'gene');

    for (const feature of cdsFeatures) {
      const cdsSeq = sequence.substring(feature.start, feature.end);
      const header = `>${feature.locus_tag || feature.name || 'unknown'} ${feature.product || ''} [${chr}:${feature.start}-${feature.end}]`;
      fastaContent += this.formatFasta(header, cdsSeq);
      fastaContent += '\n';
    }

    const defaultFilename = filename || `${chr}_CDS.fasta`;
    this.downloadFile(fastaContent, defaultFilename, 'text/plain');

    return {
      success: true,
      format: 'FASTA (CDS)',
      filename: defaultFilename,
      cdsCount: cdsFeatures.length
    };
  }

  async exportProteinFasta(parameters) {
    const { chromosome, filename } = parameters;

    if (!this.app?.currentSequence || !this.app?.currentAnnotations) {
      throw new Error('Genome data not available');
    }

    const chr = chromosome || this.app.currentChromosome;
    if (!chr) {
      throw new Error('Chromosome not specified');
    }

    const sequence = this.app.currentSequence[chr];
    const annotations = this.app.currentAnnotations[chr] || [];

    // Extract and translate CDS sequences
    let fastaContent = '';
    const cdsFeatures = annotations.filter(a => a.type === 'CDS');

    for (const feature of cdsFeatures) {
      const cdsSeq = sequence.substring(feature.start, feature.end);
      const proteinSeq = this.translateDNA(cdsSeq);
      
      if (proteinSeq) {
        const header = `>${feature.locus_tag || feature.name || 'unknown'} ${feature.product || ''} [${chr}:${feature.start}-${feature.end}]`;
        fastaContent += this.formatFasta(header, proteinSeq);
        fastaContent += '\n';
      }
    }

    const defaultFilename = filename || `${chr}_proteins.fasta`;
    this.downloadFile(fastaContent, defaultFilename, 'text/plain');

    return {
      success: true,
      format: 'FASTA (Protein)',
      filename: defaultFilename,
      proteinCount: cdsFeatures.length
    };
  }

  async exportGFFAnnotations(parameters) {
    const { chromosome, filename } = parameters;

    if (!this.app?.currentAnnotations) {
      throw new Error('No annotation data available');
    }

    const chr = chromosome || this.app.currentChromosome;
    const annotations = chr ? this.app.currentAnnotations[chr] : 
      Object.values(this.app.currentAnnotations).flat();

    let gffContent = '##gff-version 3\n';
    
    for (const feature of annotations || []) {
      const seqid = feature.seqid || feature.chromosome || chr || 'unknown';
      const source = feature.source || 'CodeXomics';
      const type = feature.type || 'gene';
      const start = (feature.start || 0) + 1; // GFF is 1-based
      const end = feature.end || start;
      const score = feature.score || '.';
      const strand = feature.strand || '+';
      const phase = feature.phase || '.';
      
      // Build attributes
      const attrs = [];
      if (feature.locus_tag) attrs.push(`ID=${feature.locus_tag}`);
      if (feature.name) attrs.push(`Name=${feature.name}`);
      if (feature.product) attrs.push(`product=${feature.product}`);
      if (feature.gene) attrs.push(`gene=${feature.gene}`);
      
      const attributes = attrs.join(';');
      
      gffContent += `${seqid}\t${source}\t${type}\t${start}\t${end}\t${score}\t${strand}\t${phase}\t${attributes}\n`;
    }

    const defaultFilename = filename || `${chr || 'genome'}.gff`;
    this.downloadFile(gffContent, defaultFilename, 'text/plain');

    return {
      success: true,
      format: 'GFF3',
      filename: defaultFilename,
      featureCount: annotations?.length || 0
    };
  }

  async exportFeatures(parameters) {
    const { chromosome, start, end, filename } = parameters;

    if (!this.app?.currentAnnotations) {
      throw new Error('No annotation data available');
    }

    const chr = chromosome || this.app.currentChromosome;
    const s = start || 0;
    const e = end || Infinity;

    const annotations = this.app.currentAnnotations[chr] || [];
    const featuresInRegion = annotations.filter(f => 
      f.end >= s && f.start <= e
    );

    const exportData = {
      chromosome: chr,
      start: s,
      end: e,
      featureCount: featuresInRegion.length,
      features: featuresInRegion
    };

    const content = JSON.stringify(exportData, null, 2);
    const defaultFilename = filename || `${chr}_features_${s}_${e}.json`;
    this.downloadFile(content, defaultFilename, 'application/json');

    return {
      success: true,
      format: 'JSON',
      filename: defaultFilename,
      featureCount: featuresInRegion.length
    };
  }

  async exportAllData(parameters) {
    const { filename = 'genome_export.json' } = parameters;

    const exportData = {
      exportDate: new Date().toISOString(),
      sequences: this.app?.currentSequence || {},
      annotations: this.app?.currentAnnotations || {},
      metadata: {
        chromosomeCount: Object.keys(this.app?.currentSequence || {}).length,
        totalFeatures: Object.values(this.app?.currentAnnotations || {})
          .reduce((sum, arr) => sum + arr.length, 0)
      }
    };

    const content = JSON.stringify(exportData, null, 2);
    this.downloadFile(content, filename, 'application/json');

    return {
      success: true,
      format: 'JSON (Complete)',
      filename: filename
    };
  }

  // Helper methods

  formatFasta(header, sequence, lineLength = 60) {
    let fasta = header + '\n';
    for (let i = 0; i < sequence.length; i += lineLength) {
      fasta += sequence.substring(i, i + lineLength) + '\n';
    }
    return fasta;
  }

  formatGenBank(chromosome, sequence, annotations) {
    let genbank = `LOCUS       ${chromosome} ${sequence.length} bp DNA linear\n`;
    genbank += `DEFINITION  Exported from CodeXomics\n`;
    genbank += `ACCESSION   ${chromosome}\n`;
    genbank += `VERSION     1.0\n`;
    genbank += `KEYWORDS    .\n`;
    genbank += `SOURCE      .\n`;
    genbank += `ORGANISM    .\n`;
    genbank += `FEATURES             Location/Qualifiers\n`;

    for (const feature of annotations) {
      const location = `${feature.start + 1}..${feature.end}`;
      genbank += `     ${feature.type.padEnd(16)}${location}\n`;
      if (feature.locus_tag) genbank += `                     /locus_tag="${feature.locus_tag}"\n`;
      if (feature.name) genbank += `                     /gene="${feature.name}"\n`;
      if (feature.product) genbank += `                     /product="${feature.product}"\n`;
    }

    genbank += `ORIGIN\n`;
    
    // Format sequence in GenBank style
    for (let i = 0; i < sequence.length; i += 60) {
      const lineNum = (i + 1).toString().padStart(9, ' ');
      let line = lineNum;
      for (let j = 0; j < 60 && i + j < sequence.length; j += 10) {
        line += ' ' + sequence.substring(i + j, i + j + 10).toLowerCase();
      }
      genbank += line + '\n';
    }

    genbank += `//\n`;
    return genbank;
  }

  translateDNA(dna) {
    const codonTable = {
      'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
      'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
      'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
      'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
      'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
      'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
      'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
      'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
      'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
      'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
      'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
      'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
      'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
      'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
      'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
      'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
    };

    const seq = dna.toUpperCase().replace(/[^ATCG]/g, '');
    let protein = '';

    for (let i = 0; i < seq.length - 2; i += 3) {
      const codon = seq.substring(i, i + 3);
      protein += codonTable[codon] || 'X';
    }

    return protein;
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExportManager;
}
