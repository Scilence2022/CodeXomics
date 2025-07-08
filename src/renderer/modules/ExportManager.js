/**
 * ExportManager - Handles exporting genome data in various formats
 */
class ExportManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    // Export current genome as FASTA
    exportAsFasta() {
        if (!this.genomeBrowser.currentSequence) {
            alert('No genome data loaded to export.');
            return;
        }

        const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
        let fastaContent = '';

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            fastaContent += `>${chr}\n`;
            
            // Split sequence into lines of 80 characters
            for (let i = 0; i < sequence.length; i += 80) {
                fastaContent += sequence.substring(i, i + 80) + '\n';
            }
        });

        this.downloadFile(fastaContent, 'genome.fasta', 'text/plain');
    }

    // Export current genome as GenBank format
    exportAsGenBank() {
        if (!this.genomeBrowser.currentSequence) {
            alert('No genome data loaded to export.');
            return;
        }

        const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
        let genbankContent = '';

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            // GenBank header
            genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
            genbankContent += `DEFINITION  ${chr}\n`;
            genbankContent += `ACCESSION   ${chr}\n`;
            genbankContent += `VERSION     ${chr}\n`;
            genbankContent += `KEYWORDS    .\n`;
            genbankContent += `SOURCE      .\n`;
            genbankContent += `  ORGANISM  .\n`;
            genbankContent += `FEATURES             Location/Qualifiers\n`;
            genbankContent += `     source          1..${sequence.length}\n`;
            
            // Add features
            features.forEach(feature => {
                const location = feature.strand === '-' ? 
                    `complement(${feature.start}..${feature.end})` : 
                    `${feature.start}..${feature.end}`;
                
                genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;
                
                if (feature.name) {
                    genbankContent += `                     /gene="${feature.name}"\n`;
                }
                if (feature.product) {
                    genbankContent += `                     /product="${feature.product}"\n`;
                }
                if (feature.note) {
                    genbankContent += `                     /note="${feature.note}"\n`;
                }
            });
            
            genbankContent += `ORIGIN\n`;
            
            // Add sequence in GenBank format (60 chars per line, numbered)
            for (let i = 0; i < sequence.length; i += 60) {
                const lineNum = (i + 1).toString().padStart(9);
                const seqLine = sequence.substring(i, i + 60).toLowerCase();
                const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
                genbankContent += `${lineNum} ${formattedSeq}\n`;
            }
            
            genbankContent += `//\n\n`;
        });

        this.downloadFile(genbankContent, 'genome.gbk', 'text/plain');
    }

    // Export CDS sequences as FASTA
    exportCDSAsFasta() {
        if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentAnnotations) {
            alert('No genome data or features loaded to export CDS.');
            return;
        }

        let cdsContent = '';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                if (feature.type === 'CDS' || feature.type === 'gene') {
                    const cdsSequence = this.extractFeatureSequence(sequence, feature);
                    const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;
                    
                    cdsContent += `>${header}\n`;
                    
                    // Split sequence into lines of 80 characters
                    for (let i = 0; i < cdsSequence.length; i += 80) {
                        cdsContent += cdsSequence.substring(i, i + 80) + '\n';
                    }
                }
            });
        });

        if (!cdsContent) {
            alert('No CDS features found to export.');
            return;
        }

        this.downloadFile(cdsContent, 'cds_sequences.fasta', 'text/plain');
    }

    // Export protein sequences as FASTA
    exportProteinAsFasta() {
        if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentAnnotations) {
            alert('No genome data or features loaded to export proteins.');
            return;
        }

        let proteinContent = '';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);
        const processedFeatures = new Set(); // Track processed features to avoid duplicates

        chromosomes.forEach(chr => {
            const sequence = this.genomeBrowser.currentSequence[chr];
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                // Only process CDS features, skip gene features to avoid duplication
                if (feature.type === 'CDS') {
                    // Create unique identifier to avoid duplicates
                    const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;
                    
                    if (!processedFeatures.has(featureId)) {
                        processedFeatures.add(featureId);
                        
                        const cdsSequence = this.extractFeatureSequence(sequence, feature);
                        // Don't pass strand parameter since extractFeatureSequence already handles reverse complement
                        const proteinSequence = this.translateDNA(cdsSequence);
                        
                        // Remove trailing asterisks (stop codons) from protein sequence
                        const cleanProteinSequence = proteinSequence.replace(/\*+$/, '');
                        
                        const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;
                        
                        proteinContent += `>${header}\n`;
                        
                        // Split sequence into lines of 80 characters
                        for (let i = 0; i < cleanProteinSequence.length; i += 80) {
                            proteinContent += cleanProteinSequence.substring(i, i + 80) + '\n';
                        }
                    }
                }
            });
        });

        if (!proteinContent) {
            alert('No protein-coding features found to export.');
            return;
        }

        this.downloadFile(proteinContent, 'protein_sequences.fasta', 'text/plain');
    }

    // Export features as GFF format
    exportAsGFF() {
        if (!this.genomeBrowser.currentAnnotations) {
            alert('No features loaded to export as GFF.');
            return;
        }

        let gffContent = '##gff-version 3\n';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);

        chromosomes.forEach(chr => {
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach((feature, index) => {
                const id = feature.id || feature.name || `feature_${index + 1}`;
                const name = feature.name || id;
                const type = feature.type || 'misc_feature';
                const strand = feature.strand || '+';
                const score = feature.score || '.';
                const phase = feature.phase || '.';
                
                let attributes = `ID=${id}`;
                if (feature.name && feature.name !== id) {
                    attributes += `;Name=${feature.name}`;
                }
                if (feature.product) {
                    attributes += `;product=${feature.product}`;
                }
                if (feature.note) {
                    attributes += `;Note=${feature.note}`;
                }
                
                gffContent += `${chr}\t.\t${type}\t${feature.start}\t${feature.end}\t${score}\t${strand}\t${phase}\t${attributes}\n`;
            });
        });

        this.downloadFile(gffContent, 'features.gff3', 'text/plain');
    }

    // Export features as BED format
    exportAsBED() {
        if (!this.genomeBrowser.currentAnnotations) {
            alert('No features loaded to export as BED.');
            return;
        }

        let bedContent = 'track name="Genome Features" description="Exported genome features"\n';
        const chromosomes = Object.keys(this.genomeBrowser.currentAnnotations);

        chromosomes.forEach(chr => {
            const features = this.genomeBrowser.currentAnnotations[chr] || [];
            
            features.forEach(feature => {
                const name = feature.name || feature.id || 'feature';
                const score = feature.score || 1000;
                const strand = feature.strand || '+';
                
                // BED format: chrom, chromStart (0-based), chromEnd, name, score, strand
                bedContent += `${chr}\t${feature.start - 1}\t${feature.end}\t${name}\t${score}\t${strand}\n`;
            });
        });

        this.downloadFile(bedContent, 'features.bed', 'text/plain');
    }

    // Export current view as FASTA
    exportCurrentViewAsFasta() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No chromosome selected or sequence loaded.');
            return;
        }

        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const start = this.genomeBrowser.currentStart || 1;
        const end = this.genomeBrowser.currentEnd || sequence.length;
        
        const viewSequence = sequence.substring(start - 1, end);
        const header = `${currentChr}:${start}-${end}`;
        
        let fastaContent = `>${header}\n`;
        
        // Split sequence into lines of 80 characters
        for (let i = 0; i < viewSequence.length; i += 80) {
            fastaContent += viewSequence.substring(i, i + 80) + '\n';
        }

        this.downloadFile(fastaContent, `${currentChr}_${start}-${end}.fasta`, 'text/plain');
    }

    // Helper method to extract feature sequence
    extractFeatureSequence(sequence, feature) {
        let featureSeq = sequence.substring(feature.start - 1, feature.end);
        
        // Reverse complement if on negative strand
        if (feature.strand === '-') {
            featureSeq = this.reverseComplement(featureSeq);
        }
        
        return featureSeq;
    }

    // Helper method to reverse complement DNA sequence
    reverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'a': 't', 't': 'a', 'g': 'c', 'c': 'g',
            'N': 'N', 'n': 'n'
        };
        
        return sequence
            .split('')
            .reverse()
            .map(base => complement[base] || base)
            .join('');
    }

    // Helper method to translate DNA to protein
    translateDNA(dnaSequence, strand = null) {
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand || 1);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
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

        let sequence = dnaSequence.toUpperCase();
        
        // Only perform reverse complement if strand is provided and sequence hasn't been processed yet
        if (strand === -1 && !dnaSequence.includes('processed')) {
            sequence = this.reverseComplement(sequence);
        }
        
        let protein = '';
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            if (codon.length === 3) {
                protein += codonTable[codon] || 'X';
            }
        }
        
        return protein;
    }

    // Helper method to download file
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

    // Enable/disable export menu based on data availability
    updateExportMenuState() {
        const exportBtn = document.getElementById('exportFileBtn');
        const hasData = this.genomeBrowser.currentSequence && 
                       Object.keys(this.genomeBrowser.currentSequence).length > 0;
        
        if (exportBtn) {
            exportBtn.disabled = !hasData;
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
} 