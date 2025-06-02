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
        input.accept = '.fasta,.fa,.gff,.gtf,.bed,.vcf,.sam,.bam,.gb,.gbk,.gbff,.genbank,.wig';
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                this.loadFile(e.target.files[0].path);
            }
        };
        input.click();
    }

    openSpecificFileType(fileType) {
        // Close the dropdown menu before opening file dialog
        this.genomeBrowser.uiManager.closeFileDropdown();
        
        const input = document.createElement('input');
        input.type = 'file';
        
        // Set specific file filters based on type
        switch (fileType) {
            case 'genome':
                input.accept = '.fasta,.fa,.gb,.gbk,.gbff,.genbank';
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
            case 'tracks':
                input.accept = '.wig';
                break;
            case 'any':
            default:
                input.accept = '.fasta,.fa,.gff,.gtf,.bed,.vcf,.sam,.bam,.gb,.gbk,.gbff,.genbank,.wig';
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

            // Check file size and warn for very large files (excluding SAM/BAM which use dynamic loading)
            const fileSizeMB = fileInfo.info.size / (1024 * 1024);
            const extension = fileInfo.info.extension.toLowerCase();
            
            // Skip warning for SAM/BAM files since they use dynamic loading and can handle large files efficiently
            const usesDynamicLoading = extension === '.sam' || extension === '.bam';
            
            if (fileSizeMB > 50 && !usesDynamicLoading) {
                const proceed = confirm(
                    `This file is ${fileSizeMB.toFixed(1)} MB. Large files may take time to load and parse. Continue?`
                );
                if (!proceed) {
                    this.genomeBrowser.updateStatus('File loading cancelled');
                    return;
                }
            }

            this.currentFile = {
                path: filePath,
                info: fileInfo.info,
                data: null // Will be populated during streaming or regular reading
            };

            // Use streaming for very large files or SAM files
            if (fileSizeMB > 100 || extension === '.sam') {
                await this.loadFileStream(filePath);
            } else {
                await this.loadFileRegular(filePath);
            }
            
            // Update UI
            this.genomeBrowser.updateFileInfo();
            this.genomeBrowser.hideWelcomeScreen();
            this.genomeBrowser.updateStatus('File loaded successfully');

            // Auto-enable tracks for the loaded file type
            this.autoEnableTracksForFileType(extension);

        } catch (error) {
            console.error('Error loading file:', error);
            this.genomeBrowser.updateStatus(`Error: ${error.message}`);
            alert(`Failed to load file: ${error.message}`);
        } finally {
            this.genomeBrowser.showLoading(false);
        }
    }

    async loadFileRegular(filePath) {
        // Set up progress listener for streaming reads
        const progressHandler = (event, progressData) => {
            const { progress, totalRead, fileSize } = progressData;
            const readMB = (totalRead / (1024 * 1024)).toFixed(1);
            const totalMB = (fileSize / (1024 * 1024)).toFixed(1);
            this.genomeBrowser.updateStatus(`Reading file... ${progress}% (${readMB}/${totalMB} MB)`);
        };
        
        ipcRenderer.on('file-read-progress', progressHandler);

        // Read file content
        this.genomeBrowser.updateStatus('Reading file content...');
        const fileData = await ipcRenderer.invoke('read-file', filePath);
        
        // Remove progress listener
        ipcRenderer.removeListener('file-read-progress', progressHandler);
        
        if (!fileData.success) {
            throw new Error(fileData.error);
        }

        this.currentFile.data = fileData.data;

        // Parse file based on extension
        await this.parseFile();
    }

    async loadFileStream(filePath) {
        // For very large SAM files, we'll still read the file but use ReadsManager for dynamic loading
        // This is much simpler and more memory efficient than the old streaming approach
        
        return new Promise(async (resolve, reject) => {
            try {
                // Set up progress listener for file reading
                const progressHandler = (event, progressData) => {
                    const { progress, totalRead, fileSize } = progressData;
                    const readMB = (totalRead / (1024 * 1024)).toFixed(1);
                    const totalMB = (fileSize / (1024 * 1024)).toFixed(1);
                    this.genomeBrowser.updateStatus(`Reading large SAM file... ${progress}% (${readMB}/${totalMB} MB)`);
                };
                
                ipcRenderer.on('file-read-progress', progressHandler);
                
                // Read the entire file (ReadsManager will handle memory efficiency through dynamic loading)
                this.genomeBrowser.updateStatus('Reading large SAM file...');
                const fileData = await ipcRenderer.invoke('read-file', filePath);
                
                // Remove progress listener
                ipcRenderer.removeListener('file-read-progress', progressHandler);
                
                if (!fileData.success) {
                    throw new Error(fileData.error);
                }

                this.currentFile.data = fileData.data;

                // Initialize ReadsManager directly (this handles large files efficiently)
                this.genomeBrowser.updateStatus('Initializing dynamic reads loading system...');
                await this.genomeBrowser.readsManager.initializeWithSAMData(this.currentFile.data, this.currentFile.info.path);
                
                // Clear old reads to save memory
                this.genomeBrowser.currentReads = {};
                
                // Log initialization
                const stats = this.genomeBrowser.readsManager.getCacheStats();
                console.log(`Large SAM file initialized with ReadsManager - estimated ${stats.totalReads} reads`);
                
                this.genomeBrowser.updateStatus(`Initialized large SAM file with dynamic loading (estimated ${stats.totalReads} reads)`);
                
                // Auto-enable reads track
                this.autoEnableTracksForFileType('.sam');
                
                // If we already have sequence data, refresh the view
                const currentChr = document.getElementById('chromosomeSelect').value;
                if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
                    this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
                }
                
                resolve();
                
            } catch (error) {
                reject(error);
            }
        });
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
            case '.gbff':
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
            case '.bam':
                await this.parseBAM();
                break;
            case '.wig':
                await this.parseWIG();
                break;
            default:
                throw new Error(`Unsupported file format: ${extension}. Supported formats: FASTA (.fasta, .fa), GenBank (.gb, .gbk, .gbff), GFF (.gff, .gtf), BED (.bed), VCF (.vcf), SAM (.sam), WIG (.wig). Note: BAM files require conversion to SAM format first.`);
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
        console.log('Starting GenBank parsing...');
        const lines = this.currentFile.data.split('\n');
        console.log(`Total lines to parse: ${lines.length}`);
        
        const sequences = {};
        const annotations = {};
        let currentSeq = null;
        let currentData = '';
        let inOrigin = false;
        let features = [];
        let currentFeature = null;
        let currentQualifierKey = null;
        
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
                console.log(`Found LOCUS: ${currentSeq}`);
                sequences[currentSeq] = '';
                annotations[currentSeq] = [];
                features = [];
                currentFeature = null;
                currentQualifierKey = null;
                continue;
            }

            // Parse FEATURES section
            if (line.startsWith('FEATURES')) {
                console.log('Found FEATURES section');
                continue;
            }

            // Parse individual features - improved pattern matching
            if (line.match(/^\s{5}\w+\s+/) && !inOrigin && currentSeq) {
                const featureMatch = line.match(/^\s{5}(\w+)\s+(.+)/);
                if (featureMatch) {
                    const [, type, location] = featureMatch;
                    
                    // Save previous feature if it exists
                    if (currentFeature) {
                        this.finalizeFeature(currentFeature);
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
                    
                    currentQualifierKey = null;
                    
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
                    currentQualifierKey = key;
                    
                    if (value !== undefined) {
                        // Handle quoted values and start of multi-line values
                        let cleanValue = value.replace(/^"/, '').replace(/"$/, '');
                        
                        // For very long qualifiers like translation, limit initial storage
                        if (key === 'translation' && cleanValue.length > 1000) {
                            // Store only first part for memory efficiency
                            currentFeature.qualifiers[key] = cleanValue.substring(0, 100) + '...';
                        } else {
                            currentFeature.qualifiers[key] = cleanValue;
                        }
                    } else {
                        currentFeature.qualifiers[key] = true;
                        currentQualifierKey = null; // No continuation expected
                    }
                }
                continue;
            }
            
            // Handle multi-line qualifier values - improved efficiency
            if (line.match(/^\s{21}[^\/]/) && currentFeature && currentQualifierKey) {
                const continuationValue = line.trim().replace(/^"/, '').replace(/"$/, '');
                
                // For translation qualifiers, skip most of the content to save memory
                if (currentQualifierKey === 'translation') {
                    // Only keep the first part, ignore the rest
                    if (!currentFeature.qualifiers[currentQualifierKey].includes('...')) {
                        currentFeature.qualifiers[currentQualifierKey] += continuationValue.substring(0, 50);
                        if (currentFeature.qualifiers[currentQualifierKey].length > 100) {
                            currentFeature.qualifiers[currentQualifierKey] = 
                                currentFeature.qualifiers[currentQualifierKey].substring(0, 100) + '...';
                        }
                    }
                } else {
                    // For other qualifiers, keep the full content but with reasonable limits
                    if (currentFeature.qualifiers[currentQualifierKey].length < 2000) {
                        currentFeature.qualifiers[currentQualifierKey] += ' ' + continuationValue;
                    }
                }
                continue;
            }

            // Parse ORIGIN section
            if (line.startsWith('ORIGIN')) {
                inOrigin = true;
                console.log(`Found ORIGIN section, parsed ${features.length} features`);
                
                // Process the last feature
                if (currentFeature) {
                    this.finalizeFeature(currentFeature);
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
                    console.log(`Completed sequence ${currentSeq}, length: ${currentData.length}`);
                }
                inOrigin = false;
                currentData = '';
                currentFeature = null;
                currentQualifierKey = null;
                continue;
            }
        }

        console.log(`Final results: ${Object.keys(sequences).length} sequences, ${Object.keys(annotations).length} annotation sets`);
        console.log('Sequences:', Object.keys(sequences));
        
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
            console.log(`Selecting first chromosome: ${firstChr}`);
            this.genomeBrowser.selectChromosome(firstChr);
        }
    }

    finalizeFeature(feature) {
        // Add name from qualifiers if available
        if (feature.qualifiers.gene) {
            feature.name = feature.qualifiers.gene;
        } else if (feature.qualifiers.locus_tag) {
            feature.name = feature.qualifiers.locus_tag;
        } else if (feature.qualifiers.product) {
            feature.name = feature.qualifiers.product;
        }
        
        // Add product information
        if (feature.qualifiers.product) {
            feature.product = feature.qualifiers.product;
        }
        
        // Add note information
        if (feature.qualifiers.note) {
            feature.note = feature.qualifiers.note;
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
        
        // Auto-enable variants track
        this.autoEnableTracksForFileType('.vcf');
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseSAM() {
        // Initialize the reads manager with the SAM data instead of parsing all reads into memory
        await this.genomeBrowser.readsManager.initializeWithSAMData(this.currentFile.data, this.currentFile.info.path);
        
        // Clear the old currentReads to save memory - ReadsManager will handle reads dynamically
        this.genomeBrowser.currentReads = {};
        
        // Log initialization
        const stats = this.genomeBrowser.readsManager.getCacheStats();
        console.log(`SAM file initialized with ReadsManager - estimated ${stats.totalReads} reads`);
        
        this.genomeBrowser.updateStatus(`Initialized SAM file with dynamic loading (${stats.totalReads} reads estimated)`);
        
        // Auto-enable reads track
        this.autoEnableTracksForFileType('.sam');
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseBAM() {
        // BAM files are binary format and require special parsing libraries
        // For now, we'll show an informative error message
        throw new Error(`BAM files are binary format and not currently supported. Please convert your BAM file to SAM format using tools like samtools:
        
samtools view -h your_file.bam > your_file.sam

Then load the SAM file instead. SAM files contain the same alignment data in text format that can be parsed by this application.`);
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

    async parseWIG() {
        console.log('Starting WIG parsing...');
        const lines = this.currentFile.data.split('\n');
        console.log(`Total lines to parse: ${lines.length}`);
        
        const wigTracks = {};
        let currentTrack = null;
        let currentChromosome = null;
        let currentStep = null;
        let currentStart = null;
        let currentSpan = 1;
        let isFixedStep = false;
        let isVariableStep = false;
        
        // Progress tracking for large files
        const totalLines = lines.length;
        let processedLines = 0;
        const updateInterval = Math.max(1000, Math.floor(totalLines / 100));
        
        this.genomeBrowser.updateStatus('Parsing WIG file...');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Update progress for large files
            processedLines++;
            if (processedLines % updateInterval === 0) {
                const progress = Math.round((processedLines / totalLines) * 100);
                this.genomeBrowser.updateStatus(`Parsing WIG file... ${progress}%`);
                
                // Allow UI to update for large files
                if (totalLines > 10000) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            
            // Skip empty lines and comments
            if (!line || line.startsWith('#')) continue;
            
            // Parse track definition line
            if (line.startsWith('track')) {
                const trackParams = this.parseWIGTrackLine(line);
                currentTrack = {
                    name: trackParams.name || `Track_${Object.keys(wigTracks).length + 1}`,
                    description: trackParams.description || '',
                    type: trackParams.type || 'wiggle_0',
                    color: trackParams.color || '0,0,0',
                    visibility: trackParams.visibility || 'full',
                    autoScale: trackParams.autoScale !== 'off',
                    viewLimits: trackParams.viewLimits || null,
                    maxHeightPixels: trackParams.maxHeightPixels || null,
                    data: {}
                };
                wigTracks[currentTrack.name] = currentTrack;
                console.log(`Created WIG track: ${currentTrack.name}`);
                continue;
            }
            
            // Parse declaration lines
            if (line.startsWith('fixedStep')) {
                const params = this.parseWIGDeclarationLine(line);
                currentChromosome = params.chrom;
                currentStart = params.start - 1; // Convert to 0-based
                currentStep = params.step || 1;
                currentSpan = params.span || 1;
                isFixedStep = true;
                isVariableStep = false;
                
                // Ensure track exists
                if (!currentTrack) {
                    currentTrack = {
                        name: 'Default_Track',
                        description: 'Default WIG track',
                        type: 'wiggle_0',
                        color: '0,0,0',
                        visibility: 'full',
                        autoScale: true,
                        viewLimits: null,
                        maxHeightPixels: null,
                        data: {}
                    };
                    wigTracks[currentTrack.name] = currentTrack;
                }
                
                // Initialize chromosome data
                if (!currentTrack.data[currentChromosome]) {
                    currentTrack.data[currentChromosome] = [];
                }
                continue;
            }
            
            if (line.startsWith('variableStep')) {
                const params = this.parseWIGDeclarationLine(line);
                currentChromosome = params.chrom;
                currentSpan = params.span || 1;
                isFixedStep = false;
                isVariableStep = true;
                
                // Ensure track exists
                if (!currentTrack) {
                    currentTrack = {
                        name: 'Default_Track',
                        description: 'Default WIG track',
                        type: 'wiggle_0',
                        color: '0,0,0',
                        visibility: 'full',
                        autoScale: true,
                        viewLimits: null,
                        maxHeightPixels: null,
                        data: {}
                    };
                    wigTracks[currentTrack.name] = currentTrack;
                }
                
                // Initialize chromosome data
                if (!currentTrack.data[currentChromosome]) {
                    currentTrack.data[currentChromosome] = [];
                }
                continue;
            }
            
            // Parse data lines
            if (currentTrack && currentChromosome) {
                if (isFixedStep) {
                    // Fixed step format: just the value
                    const value = parseFloat(line);
                    if (!isNaN(value)) {
                        currentTrack.data[currentChromosome].push({
                            start: currentStart,
                            end: currentStart + currentSpan,
                            value: value
                        });
                        currentStart += currentStep;
                    }
                } else if (isVariableStep) {
                    // Variable step format: position value
                    const parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        const position = parseInt(parts[0]) - 1; // Convert to 0-based
                        const value = parseFloat(parts[1]);
                        if (!isNaN(position) && !isNaN(value)) {
                            currentTrack.data[currentChromosome].push({
                                start: position,
                                end: position + currentSpan,
                                value: value
                            });
                        }
                    }
                }
            }
        }
        
        // Store WIG tracks data - merge with existing tracks instead of replacing
        const existingWIGTracks = this.genomeBrowser.currentWIGTracks || {};
        
        // Handle track name conflicts by renaming duplicates
        Object.keys(wigTracks).forEach(trackName => {
            let finalTrackName = trackName;
            let counter = 1;
            
            // If track name already exists, add a number suffix
            while (existingWIGTracks[finalTrackName]) {
                finalTrackName = `${trackName}_${counter}`;
                counter++;
            }
            
            // If we had to rename, update the track name
            if (finalTrackName !== trackName) {
                wigTracks[finalTrackName] = wigTracks[trackName];
                wigTracks[finalTrackName].name = finalTrackName;
                delete wigTracks[trackName];
                console.log(`Renamed duplicate track "${trackName}" to "${finalTrackName}"`);
            }
        });
        
        // Merge new tracks with existing tracks
        this.genomeBrowser.currentWIGTracks = { ...existingWIGTracks, ...wigTracks };
        
        const totalTracksAfterMerge = Object.keys(this.genomeBrowser.currentWIGTracks).length;
        const newTracksCount = Object.keys(wigTracks).length;
        
        console.log(`Merged ${newTracksCount} new WIG tracks. Total tracks: ${totalTracksAfterMerge}`);
        
        // Log track statistics
        Object.entries(wigTracks).forEach(([trackName, track]) => {
            const totalDataPoints = Object.values(track.data).reduce((sum, chrData) => sum + chrData.length, 0);
            console.log(`WIG Track "${trackName}": ${totalDataPoints} data points across ${Object.keys(track.data).length} chromosomes`);
        });
        
        this.genomeBrowser.updateStatus(`Added ${newTracksCount} WIG track(s). Total: ${totalTracksAfterMerge} tracks`);
        
        // Auto-enable WIG tracks
        this.autoEnableTracksForFileType('.wig');
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }
    
    parseWIGTrackLine(line) {
        const params = {};
        
        // Extract parameters from track line
        // Format: track type=wiggle_0 name="Track Name" description="Description" visibility=full
        const matches = line.match(/(\w+)=(?:"([^"]*)"|(\S+))/g);
        if (matches) {
            matches.forEach(match => {
                const [, key, quotedValue, unquotedValue] = match.match(/(\w+)=(?:"([^"]*)"|(\S+))/);
                params[key] = quotedValue || unquotedValue;
            });
        }
        
        return params;
    }
    
    parseWIGDeclarationLine(line) {
        const params = {};
        
        // Extract parameters from declaration line
        // Format: fixedStep chrom=chr1 start=1 step=1 span=1
        const matches = line.match(/(\w+)=(\S+)/g);
        if (matches) {
            matches.forEach(match => {
                const [, key, value] = match.match(/(\w+)=(\S+)/);
                if (key === 'start' || key === 'step' || key === 'span') {
                    params[key] = parseInt(value);
                } else {
                    params[key] = value;
                }
            });
        }
        
        return params;
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

    autoEnableTracksForFileType(extension) {
        // Auto-enable tracks based on the file type that was just loaded
        const trackCheckboxes = {
            toolbar: {
                variants: document.getElementById('trackVariants'),
                reads: document.getElementById('trackReads'),
                wigTracks: document.getElementById('trackWIG')
            },
            sidebar: {
                variants: document.getElementById('sidebarTrackVariants'),
                reads: document.getElementById('sidebarTrackReads'),
                wigTracks: document.getElementById('sidebarTrackWIG')
            }
        };

        let tracksToEnable = [];
        let statusMessage = '';

        switch (extension.toLowerCase()) {
            case '.vcf':
                tracksToEnable = ['variants'];
                statusMessage = 'VCF Variants track automatically enabled';
                break;
            case '.sam':
            case '.bam':
                tracksToEnable = ['reads'];
                statusMessage = 'Aligned Reads track automatically enabled';
                break;
            case '.wig':
                tracksToEnable = ['wigTracks'];
                statusMessage = 'WIG track automatically enabled';
                break;
        }

        // Enable the tracks
        if (tracksToEnable.length > 0) {
            tracksToEnable.forEach(trackType => {
                // Enable in toolbar
                if (trackCheckboxes.toolbar[trackType]) {
                    trackCheckboxes.toolbar[trackType].checked = true;
                }
                // Enable in sidebar
                if (trackCheckboxes.sidebar[trackType]) {
                    trackCheckboxes.sidebar[trackType].checked = true;
                }
                // Add to visible tracks
                this.genomeBrowser.visibleTracks.add(trackType);
            });

            // Update the genome view to show the new tracks
            this.genomeBrowser.updateVisibleTracks();
            
            // Show status message
            this.genomeBrowser.updateStatus(statusMessage);
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
} 