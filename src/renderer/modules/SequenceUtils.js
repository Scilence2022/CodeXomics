/**
 * SequenceUtils - Handles sequence processing, display, and biological utilities
 */
class SequenceUtils {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    // Sequence display methods
    displayEnhancedSequence(chromosome, sequence) {
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const windowSize = end - start;
        const subsequence = sequence.substring(start, end);
        
        // Choose display method based on window size
        if (windowSize <= 500) {
            this.displayDetailedSequence(chromosome, subsequence, start);
        } else if (windowSize <= 2000) {
            this.displaySequenceWithAnnotations(chromosome, subsequence, start);
        } else {
            this.displaySequence(chromosome, sequence);
        }
        
        // Update sequence title
        document.getElementById('sequenceTitle').textContent = 
            `${chromosome}:${start + 1}-${end} (${windowSize} bp)`;
        
        // Show sequence display section and splitter
        document.getElementById('sequenceDisplaySection').style.display = 'block';
        document.getElementById('splitter').style.display = 'flex';
        document.getElementById('sequenceDisplay').style.display = 'flex';
    }

    displayDetailedSequence(chromosome, subsequence, start) {
        const container = document.getElementById('sequenceContent');
        const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
        
        // Calculate optimal line length based on container width
        const containerWidth = container.offsetWidth || 800;
        const charWidth = 12;
        const positionWidth = 120;
        const availableWidth = containerWidth - positionWidth - 40;
        const optimalLineLength = Math.max(40, Math.min(120, Math.floor(availableWidth / charWidth)));
        
        // Create formatted sequence display with annotations
        let html = '<div class="detailed-sequence-view">';
        html += '<div class="sequence-info"><strong>DNA Sequence:</strong></div>';
        
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const line = subsequence.substring(i, i + optimalLineLength);
            const position = start + i + 1;
            
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${position.toLocaleString()}</span>`;
            html += `<span class="sequence-bases">${this.colorizeSequence(line)}</span>`;
            html += `</div>`;
        }
        
        // Add protein translations for CDS regions
        const cdsFeatures = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start <= start + subsequence.length &&
            feature.end >= start
        );
        
        if (cdsFeatures.length > 0) {
            html += '<div class="protein-translations">';
            html += '<div class="sequence-info"><strong>Protein Translations:</strong></div>';
            
            cdsFeatures.forEach(cds => {
                const cdsStart = Math.max(cds.start - start, 0);
                const cdsEnd = Math.min(cds.end - start, subsequence.length);
                const cdsSequence = subsequence.substring(cdsStart, cdsEnd);
                const proteinSequence = this.translateDNA(cdsSequence, cds.strand);
                const geneName = cds.qualifiers.gene || cds.qualifiers.locus_tag || 'Unknown';
                
                html += `<div class="protein-sequence">`;
                html += `<div class="protein-header">${geneName} (${cds.start}-${cds.end}, ${cds.strand === -1 ? '-' : '+'} strand):</div>`;
                html += `<div class="protein-seq">${this.colorizeProteinSequence(proteinSequence)}</div>`;
                html += `</div>`;
            });
            
            html += '</div>';
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    displaySequenceWithAnnotations(chromosome, subsequence, start) {
        const container = document.getElementById('sequenceContent');
        
        // Calculate optimal line length based on container width
        const containerWidth = container.offsetWidth || 800;
        const charWidth = 12;
        const positionWidth = 120;
        const availableWidth = containerWidth - positionWidth - 40;
        const optimalLineLength = Math.max(40, Math.min(120, Math.floor(availableWidth / charWidth)));
        
        // Create formatted sequence display with basic annotations
        let html = '';
        
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const line = subsequence.substring(i, i + optimalLineLength);
            const position = start + i + 1;
            
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${position.toLocaleString()}</span>`;
            html += `<span class="sequence-bases">${this.colorizeSequence(line)}</span>`;
            html += `</div>`;
        }
        
        container.innerHTML = html;
    }

    displaySequence(chromosome, sequence) {
        const container = document.getElementById('sequenceContent');
        const start = this.genomeBrowser.currentPosition.start;
        const end = this.genomeBrowser.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Calculate optimal line length based on container width
        const containerWidth = container.offsetWidth || 800; // fallback width
        const charWidth = 12; // approximate character width in pixels
        const positionWidth = 120; // space for position numbers
        const availableWidth = containerWidth - positionWidth - 40; // padding
        const optimalLineLength = Math.max(40, Math.min(120, Math.floor(availableWidth / charWidth)));
        
        // Create formatted sequence display
        let html = '';
        
        for (let i = 0; i < subsequence.length; i += optimalLineLength) {
            const line = subsequence.substring(i, i + optimalLineLength);
            const position = start + i + 1;
            
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${position.toLocaleString()}</span>`;
            html += `<span class="sequence-bases">${this.colorizeSequence(line)}</span>`;
            html += `</div>`;
        }
        
        container.innerHTML = html;
    }

    colorizeSequence(sequence) {
        return sequence.split('').map(base => {
            const className = `base-${base.toLowerCase()}`;
            return `<span class="${className}">${base}</span>`;
        }).join('');
    }

    colorizeProteinSequence(sequence) {
        const aaColors = {
            'A': '#ff6b6b', 'R': '#4ecdc4', 'N': '#45b7d1', 'D': '#f9ca24',
            'C': '#f0932b', 'Q': '#eb4d4b', 'E': '#6c5ce7', 'G': '#a29bfe',
            'H': '#fd79a8', 'I': '#00b894', 'L': '#00cec9', 'K': '#0984e3',
            'M': '#e17055', 'F': '#81ecec', 'P': '#fab1a0', 'S': '#00b894',
            'T': '#55a3ff', 'W': '#fd79a8', 'Y': '#fdcb6e', 'V': '#6c5ce7',
            '*': '#2d3436'
        };
        
        return sequence.split('').map(aa => {
            const color = aaColors[aa] || '#74b9ff';
            return `<span style="color: ${color}; font-weight: bold;">${aa}</span>`;
        }).join('');
    }

    // Biological utilities
    translateDNA(dnaSequence, strand = 1) {
        const geneticCode = {
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
        
        // Reverse complement if on negative strand
        if (strand === -1) {
            sequence = this.getReverseComplement(sequence);
        }
        
        let protein = '';
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substring(i, i + 3);
            protein += geneticCode[codon] || 'X';
        }
        
        return protein;
    }

    getReverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
            'N': 'N', 'R': 'Y', 'Y': 'R', 'S': 'S',
            'W': 'W', 'K': 'M', 'M': 'K', 'B': 'V',
            'D': 'H', 'H': 'D', 'V': 'B'
        };
        
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    // Sequence operations
    copySequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No sequence to copy');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const subsequence = sequence.substring(this.genomeBrowser.currentPosition.start, this.genomeBrowser.currentPosition.end);
        
        // Check if there's a text selection
        const selection = window.getSelection();
        let textToCopy = subsequence;
        
        if (selection.toString().length > 0) {
            // Use selected text
            textToCopy = selection.toString().replace(/\s+/g, '').replace(/\d+/g, '');
        } else {
            // Prompt user to select a region or copy all
            const userChoice = confirm('No text selected. Click OK to copy the entire visible sequence, or Cancel to select a specific region first.');
            if (!userChoice) {
                alert('Please select the text you want to copy, then click the Copy button again.');
                return;
            }
        }
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert(`Copied ${textToCopy.length} bases to clipboard`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        });
    }

    exportSequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            alert('No sequence to export');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const subsequence = sequence.substring(this.genomeBrowser.currentPosition.start, this.genomeBrowser.currentPosition.end);
        
        const fastaContent = `>${currentChr}:${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}\n${subsequence}`;
        
        const blob = new Blob([fastaContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentChr}_${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}.fasta`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Statistics and analysis
    updateStatistics(chromosome, sequence) {
        const length = sequence.length;
        const gcCount = (sequence.match(/[GC]/g) || []).length;
        const gcContent = ((gcCount / length) * 100).toFixed(2);

        document.getElementById('sequenceLength').textContent = length.toLocaleString();
        document.getElementById('gcContent').textContent = `${gcContent}%`;
        document.getElementById('currentPosition').textContent = 
            `${this.genomeBrowser.currentPosition.start + 1}-${this.genomeBrowser.currentPosition.end}`;
    }

    // Chromosome management
    populateChromosomeSelect() {
        const select = document.getElementById('chromosomeSelect');
        select.innerHTML = '<option value="">Select chromosome...</option>';
        
        if (this.genomeBrowser.currentSequence) {
            Object.keys(this.genomeBrowser.currentSequence).forEach(chr => {
                const option = document.createElement('option');
                option.value = chr;
                option.textContent = chr;
                select.appendChild(option);
            });
        }
    }

    selectChromosome(chromosome) {
        if (!chromosome || !this.genomeBrowser.currentSequence[chromosome]) return;

        const sequence = this.genomeBrowser.currentSequence[chromosome];
        this.genomeBrowser.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        
        // Update chromosome select
        document.getElementById('chromosomeSelect').value = chromosome;
        
        // Initialize track checkboxes if not already done - only check sequence track by default
        if (!document.getElementById('trackSequence').checked) {
            document.getElementById('trackSequence').checked = true;
            this.genomeBrowser.updateVisibleTracks();
        }
        
        // Update statistics
        this.updateStatistics(chromosome, sequence);
        
        // Show sequence and annotations
        this.genomeBrowser.displayGenomeView(chromosome, sequence);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceUtils;
} 