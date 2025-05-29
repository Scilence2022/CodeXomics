/**
 * FileManager - Handles all file operations including loading, parsing, and file type management
 */
class FileManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.currentFile = null;
    }

    async openFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.fasta,.fa,.gff,.gtf,.bed,.vcf,.bam,.sam,.gb,.gbk,.genbank';
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0].path);
            }
        };
        input.click();
    }

    openSpecificFileType(fileType) {
        const input = document.createElement('input');
        input.type = 'file';
        
        // Set specific file filters based on type
        switch (fileType) {
            case 'genome':
                input.accept = '.fasta,.fa,.gb,.gbk,.genbank';
                break;
            case 'annotation':
                input.accept = '.gff,.gtf,.bed';
                break;
            case 'variant':
                input.accept = '.vcf';
                break;
            case 'reads':
                input.accept = '.sam,.bam';
                break;
            case 'any':
            default:
                input.accept = '.fasta,.fa,.gff,.gtf,.bed,.vcf,.bam,.sam,.gb,.gbk,.genbank';
                break;
        }
        
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0].path);
            }
        };
        input.click();
    }

    async loadFile(filePath) {
        this.genomeBrowser.showLoading(true);
        this.genomeBrowser.updateStatus('Loading file...');

        try {
            // Get file info
            const fileInfo = await ipcRenderer.invoke('get-file-info', filePath);
            if (!fileInfo.success) {
                throw new Error(fileInfo.error);
            }

            // Check file size and warn for very large files
            const fileSizeMB = fileInfo.info.size / (1024 * 1024);
            if (fileSizeMB > 50) {
                const proceed = confirm(
                    `This file is ${fileSizeMB.toFixed(1)} MB. Large files may take time to load and parse. Continue?`
                );
                if (!proceed) {
                    this.genomeBrowser.updateStatus('File loading cancelled');
                    return;
                }
            }

            // Read file content
            this.genomeBrowser.updateStatus('Reading file content...');
            const fileData = await ipcRenderer.invoke('read-file', filePath);
            if (!fileData.success) {
                throw new Error(fileData.error);
            }

            this.currentFile = {
                path: filePath,
                info: fileInfo.info,
                data: fileData.data
            };

            // Parse file based on extension
            await this.parseFile();
            
            // Update UI
            this.genomeBrowser.updateFileInfo();
            this.genomeBrowser.hideWelcomeScreen();
            this.genomeBrowser.updateStatus('File loaded successfully');

        } catch (error) {
            console.error('Error loading file:', error);
            this.genomeBrowser.updateStatus(`Error: ${error.message}`);
            alert(`Failed to load file: ${error.message}`);
        } finally {
            this.genomeBrowser.showLoading(false);
        }
    }

    async parseFile() {
        const extension = this.currentFile.info.extension.toLowerCase();
        
        switch (extension) {
            case '.fasta':
            case '.fa':
                await this.parseFasta();
                break;
            case '.gb':
            case '.gbk':
            case '.genbank':
                await this.parseGenBank();
                break;
            case '.gff':
            case '.gtf':
                await this.parseGFF();
                break;
            case '.bed':
                await this.parseBED();
                break;
            case '.vcf':
                await this.parseVCF();
                break;
            case '.sam':
                await this.parseSAM();
                break;
            default:
                // Try to parse as FASTA by default
                await this.parseFasta();
        }
    }

    async parseFasta() {
        const lines = this.currentFile.data.split('\n');
        const sequences = {};
        let currentSeq = null;
        let currentData = '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('>')) {
                // Save previous sequence
                if (currentSeq) {
                    sequences[currentSeq] = currentData;
                }
                // Start new sequence
                currentSeq = trimmed.substring(1).split(' ')[0];
                currentData = '';
            } else if (trimmed && currentSeq) {
                currentData += trimmed.toUpperCase();
            }
        }

        // Save last sequence
        if (currentSeq) {
            sequences[currentSeq] = currentData;
        }

        this.genomeBrowser.currentSequence = sequences;
        this.genomeBrowser.populateChromosomeSelect();
        
        // Update export menu state
        if (this.genomeBrowser.exportManager) {
            this.genomeBrowser.exportManager.updateExportMenuState();
        }
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            this.genomeBrowser.selectChromosome(firstChr);
        }
    }

    async parseGenBank() {
        const lines = this.currentFile.data.split('\n');
        const sequences = {};
        const annotations = {};
        let currentSeq = null;
        let currentData = '';
        let inOrigin = false;
        let features = [];
        let currentFeature = null;
        
        // Progress tracking for large files
        const totalLines = lines.length;
        let processedLines = 0;
        const updateInterval = Math.max(1000, Math.floor(totalLines / 100)); // Update every 1% or 1000 lines
        
        this.genomeBrowser.updateStatus('Parsing GenBank file...');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Update progress for large files
            processedLines++;
            if (processedLines % updateInterval === 0) {
                const progress = Math.round((processedLines / totalLines) * 100);
                this.genomeBrowser.updateStatus(`Parsing GenBank file... ${progress}%`);
                
                // Allow UI to update for large files
                if (totalLines > 50000) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Parse LOCUS line for sequence name
            if (line.startsWith('LOCUS')) {
                const parts = line.split(/\s+/);
                currentSeq = parts[1];
                sequences[currentSeq] = '';
                annotations[currentSeq] = [];
                features = [];
                continue;
            }

            // Parse FEATURES section
            if (line.startsWith('FEATURES')) {
                continue;
            }

            // Parse individual features - improved pattern matching
            if (line.match(/^\s{5}\w+\s+/) && !inOrigin && currentSeq) {
                const featureMatch = line.match(/^\s{5}(\w+)\s+(.+)/);
                if (featureMatch) {
                    const [, type, location] = featureMatch;
                    
                    // Save previous feature if it exists
                    if (currentFeature) {
                        // Add name from qualifiers if available
                        if (currentFeature.qualifiers.gene) {
                            currentFeature.name = currentFeature.qualifiers.gene;
                        } else if (currentFeature.qualifiers.locus_tag) {
                            currentFeature.name = currentFeature.qualifiers.locus_tag;
                        } else if (currentFeature.qualifiers.product) {
                            currentFeature.name = currentFeature.qualifiers.product;
                        }
                        
                        // Add product information
                        if (currentFeature.qualifiers.product) {
                            currentFeature.product = currentFeature.qualifiers.product;
                        }
                        
                        // Add note information
                        if (currentFeature.qualifiers.note) {
                            currentFeature.note = currentFeature.qualifiers.note;
                        }
                    }
                    
                    currentFeature = {
                        type: type,
                        location: location,
                        qualifiers: {},
                        start: null,
                        end: null,
                        strand: 1,
                        name: null,
                        product: null,
                        note: null
                    };
                    
                    // Parse location
                    this.parseGenBankLocation(currentFeature, location);
                    features.push(currentFeature);
                }
                continue;
            }

            // Parse qualifiers - improved pattern matching
            if (line.match(/^\s{21}\//) && currentFeature) {
                const qualMatch = line.match(/^\s{21}\/(\w+)(?:=(.*))?$/);
                if (qualMatch) {
                    const [, key, value] = qualMatch;
                    if (value) {
                        // Handle quoted values and multi-line values
                        let cleanValue = value.replace(/^"/, '').replace(/"$/, '');
                        currentFeature.qualifiers[key] = cleanValue;
                    } else {
                        currentFeature.qualifiers[key] = true;
                    }
                }
                continue;
            }
            
            // Handle multi-line qualifier values
            if (line.match(/^\s{21}[^\/]/) && currentFeature) {
                const lastKey = Object.keys(currentFeature.qualifiers).pop();
                if (lastKey && typeof currentFeature.qualifiers[lastKey] === 'string') {
                    const continuationValue = line.trim().replace(/^"/, '').replace(/"$/, '');
                    currentFeature.qualifiers[lastKey] += ' ' + continuationValue;
                }
                continue;
            }

            // Parse ORIGIN section
            if (line.startsWith('ORIGIN')) {
                inOrigin = true;
                
                // Process the last feature
                if (currentFeature) {
                    if (currentFeature.qualifiers.gene) {
                        currentFeature.name = currentFeature.qualifiers.gene;
                    } else if (currentFeature.qualifiers.locus_tag) {
                        currentFeature.name = currentFeature.qualifiers.locus_tag;
                    } else if (currentFeature.qualifiers.product) {
                        currentFeature.name = currentFeature.qualifiers.product;
                    }
                    
                    if (currentFeature.qualifiers.product) {
                        currentFeature.product = currentFeature.qualifiers.product;
                    }
                    
                    if (currentFeature.qualifiers.note) {
                        currentFeature.note = currentFeature.qualifiers.note;
                    }
                }
                
                annotations[currentSeq] = features;
                this.genomeBrowser.updateStatus(`Parsed ${features.length} features, reading sequence...`);
                continue;
            }

            // Parse sequence data
            if (inOrigin && trimmed && !line.startsWith('//')) {
                const seqData = line.replace(/\d+/g, '').replace(/\s+/g, '').toUpperCase();
                currentData += seqData;
                continue;
            }

            // End of record
            if (line.startsWith('//')) {
                if (currentSeq && currentData) {
                    sequences[currentSeq] = currentData;
                }
                inOrigin = false;
                currentData = '';
                currentFeature = null;
                continue;
            }
        }

        this.genomeBrowser.currentSequence = sequences;
        this.genomeBrowser.currentAnnotations = annotations;
        
        // Log parsing results
        const totalFeatures = Object.values(annotations).reduce((sum, feats) => sum + feats.length, 0);
        console.log(`GenBank parsing complete: ${Object.keys(sequences).length} sequence(s), ${totalFeatures} features`);
        
        this.genomeBrowser.populateChromosomeSelect();
        
        // Update export menu state
        if (this.genomeBrowser.exportManager) {
            this.genomeBrowser.exportManager.updateExportMenuState();
        }
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            this.genomeBrowser.selectChromosome(firstChr);
        }
    }

    parseGenBankLocation(feature, location) {
        // Enhanced location parsing - handles various GenBank location formats
        let isComplement = false;
        let cleanLocation = location;

        // Handle complement locations
        if (location.includes('complement')) {
            isComplement = true;
            feature.strand = -1;
            cleanLocation = location.replace(/complement\(|\)/g, '');
        }

        // Handle join locations (take first range for simplicity)
        if (cleanLocation.includes('join')) {
            const joinMatch = cleanLocation.match(/join\(([^)]+)\)/);
            if (joinMatch) {
                const ranges = joinMatch[1].split(',');
                cleanLocation = ranges[0].trim();
            }
        }

        // Handle order locations (take first range for simplicity)
        if (cleanLocation.includes('order')) {
            const orderMatch = cleanLocation.match(/order\(([^)]+)\)/);
            if (orderMatch) {
                const ranges = orderMatch[1].split(',');
                cleanLocation = ranges[0].trim();
            }
        }

        // Remove any remaining parentheses and angle brackets
        cleanLocation = cleanLocation.replace(/[<>()]/g, '');

        // Parse range (e.g., "123..456")
        const rangeMatch = cleanLocation.match(/(\d+)\.\.(\d+)/);
        if (rangeMatch) {
            feature.start = parseInt(rangeMatch[1]);
            feature.end = parseInt(rangeMatch[2]);
        } else {
            // Single position (e.g., "123")
            const singleMatch = cleanLocation.match(/(\d+)/);
            if (singleMatch) {
                feature.start = parseInt(singleMatch[1]);
                feature.end = feature.start;
            }
        }

        // Ensure start is always less than or equal to end
        if (feature.start && feature.end && feature.start > feature.end) {
            [feature.start, feature.end] = [feature.end, feature.start];
        }
    }

    async parseVCF() {
        const lines = this.currentFile.data.split('\n');
        const variants = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('#') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 8) continue;
            
            const [chrom, pos, id, ref, alt, qual, filter, info] = fields;
            
            if (!variants[chrom]) {
                variants[chrom] = [];
            }
            
            const variant = {
                chromosome: chrom,
                start: parseInt(pos) - 1, // Convert to 0-based
                end: parseInt(pos) - 1 + ref.length,
                id: id === '.' ? null : id,
                ref: ref,
                alt: alt,
                quality: qual === '.' ? null : parseFloat(qual),
                filter: filter,
                info: info
            };
            
            variants[chrom].push(variant);
        }
        
        this.genomeBrowser.currentVariants = variants;
        this.genomeBrowser.updateStatus(`Loaded VCF file with variants for ${Object.keys(variants).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseSAM() {
        const lines = this.currentFile.data.split('\n');
        const reads = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('@') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 11) continue;
            
            const [qname, flag, rname, pos, mapq, cigar, rnext, pnext, tlen, seq, qual] = fields;
            
            // Skip unmapped reads
            if (rname === '*' || pos === '0') continue;
            
            if (!reads[rname]) {
                reads[rname] = [];
            }
            
            const read = {
                id: qname,
                chromosome: rname,
                start: parseInt(pos) - 1, // Convert to 0-based
                end: parseInt(pos) - 1 + seq.length, // Approximate end position
                strand: (parseInt(flag) & 16) ? '-' : '+',
                mappingQuality: parseInt(mapq),
                cigar: cigar,
                sequence: seq,
                quality: qual
            };
            
            reads[rname].push(read);
        }
        
        this.genomeBrowser.currentReads = reads;
        this.genomeBrowser.updateStatus(`Loaded SAM file with reads for ${Object.keys(reads).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseGFF() {
        const lines = this.currentFile.data.split('\n');
        const annotations = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('#') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 9) continue;
            
            const [seqname, source, feature, start, end, score, strand, frame, attribute] = fields;
            
            if (!annotations[seqname]) {
                annotations[seqname] = [];
            }
            
            // Parse attributes
            const qualifiers = {};
            const attrs = attribute.split(';');
            for (const attr of attrs) {
                const [key, value] = attr.split('=');
                if (key && value) {
                    qualifiers[key.trim()] = value.trim().replace(/"/g, '');
                }
            }
            
            const annotation = {
                type: feature,
                start: parseInt(start),
                end: parseInt(end),
                strand: strand === '-' ? -1 : 1,
                score: score === '.' ? null : parseFloat(score),
                source: source,
                qualifiers: qualifiers
            };
            
            annotations[seqname].push(annotation);
        }
        
        this.genomeBrowser.currentAnnotations = annotations;
        this.genomeBrowser.updateStatus(`Loaded GFF file with annotations for ${Object.keys(annotations).length} sequence(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseBED() {
        const lines = this.currentFile.data.split('\n');
        const annotations = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('#') || trimmed.startsWith('track') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 3) continue;
            
            const chrom = fields[0];
            const start = parseInt(fields[1]);
            const end = parseInt(fields[2]);
            const name = fields[3] || 'BED_feature';
            const score = fields[4] ? parseFloat(fields[4]) : null;
            const strand = fields[5] === '-' ? -1 : 1;
            
            if (!annotations[chrom]) {
                annotations[chrom] = [];
            }
            
            const annotation = {
                type: 'BED_feature',
                start: start + 1, // Convert to 1-based
                end: end,
                strand: strand,
                score: score,
                qualifiers: {
                    name: name,
                    score: score
                }
            };
            
            annotations[chrom].push(annotation);
        }
        
        this.genomeBrowser.currentAnnotations = annotations;
        this.genomeBrowser.updateStatus(`Loaded BED file with features for ${Object.keys(annotations).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    updateFileInfo() {
        const fileInfo = document.getElementById('fileInfo');
        if (this.currentFile) {
            const info = this.currentFile.info;
            fileInfo.innerHTML = `
                <div class="file-detail">
                    <strong>Name:</strong> ${info.name}
                </div>
                <div class="file-detail">
                    <strong>Size:</strong> ${(info.size / 1024).toFixed(2)} KB
                </div>
                <div class="file-detail">
                    <strong>Type:</strong> ${info.extension}
                </div>
                <div class="file-detail">
                    <strong>Sequences:</strong> ${Object.keys(this.genomeBrowser.currentSequence || {}).length}
                </div>
            `;
        } else {
            fileInfo.innerHTML = '<p class="no-file">No file loaded</p>';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
} 