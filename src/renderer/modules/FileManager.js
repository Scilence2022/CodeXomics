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
                input.multiple = true; // Allow multiple WIG file selection
                break;
            case 'operon':
                input.accept = '.json,.csv,.txt,.operon';
                break;
            case 'any':
            default:
                input.accept = '.fasta,.fa,.gff,.gtf,.bed,.vcf,.sam,.bam,.gb,.gbk,.gbff,.genbank,.wig,.json,.csv,.txt,.operon';
                break;
        }
        
        input.onchange = (e) => {
            if (e.target.files.length > 0) {
                if (fileType === 'tracks' && e.target.files.length > 1) {
                    // Handle multiple WIG files
                    this.loadMultipleWIGFiles(Array.from(e.target.files).map(file => file.path));
                } else if (fileType === 'operon') {
                    // Handle operon file
                    this.loadOperonFile(e.target.files[0].path);
                } else {
                    // Handle single file
                    this.loadFile(e.target.files[0].path);
                }
            }
        };
        input.click();
    }

    async loadOperonFile(filePath) {
        console.log('🔬 FileManager.loadOperonFile() called with path:', filePath);
        this.genomeBrowser.showLoading(true);
        this.genomeBrowser.updateStatus('Loading operon file...');

        try {
            // Get file info
            const fileInfo = await ipcRenderer.invoke('get-file-info', filePath);
            if (!fileInfo.success) {
                throw new Error(fileInfo.error);
            }

            // Read file content
            const fileContent = await ipcRenderer.invoke('read-file', filePath);
            if (!fileContent.success) {
                throw new Error(fileContent.error);
            }

            console.log('📄 File content loaded successfully');
            console.log('📄 Content length:', fileContent.data ? fileContent.data.length : 'undefined');
            console.log('📄 Content preview:', fileContent.data ? fileContent.data.substring(0, 200) : 'undefined');

            // Parse operon data based on file extension
            const extension = fileInfo.info.extension.toLowerCase();
            console.log('📄 File extension:', extension);
            let operonData;
            
            switch (extension) {
                case '.json':
                    operonData = this.parseOperonJSON(fileContent.data);
                    break;
                case '.csv':
                    operonData = this.parseOperonCSV(fileContent.data);
                    break;
                case '.txt':
                case '.operon':
                    operonData = this.parseOperonTXT(fileContent.data);
                    break;
                default:
                    throw new Error(`Unsupported operon file format: ${extension}`);
            }

            // Store operon data in genome browser
            this.genomeBrowser.loadedOperons = operonData;
            this.genomeBrowser.currentFile = {
                path: filePath,
                info: fileInfo.info,
                type: 'operon',
                data: operonData
            };

            // Update UI
            this.genomeBrowser.updateStatus(`Loaded ${operonData.length} operons from ${fileInfo.info.name}`);
            this.genomeBrowser.showNotification(`Successfully loaded ${operonData.length} operons`, 'success');

            // Refresh genome view to show operons
            if (this.genomeBrowser.currentChromosome) {
                this.genomeBrowser.displayGenomeView();
            } else {
                // If no chromosome is selected, just update the operon panel
                this.updateOperonPanel();
            }

        } catch (error) {
            console.error('Error loading operon file:', error);
            this.genomeBrowser.updateStatus('Error loading operon file');
            this.genomeBrowser.showNotification(`Error loading operon file: ${error.message}`, 'error');
        } finally {
            this.genomeBrowser.showLoading(false);
        }
    }

    parseOperonJSON(content) {
        try {
            const data = JSON.parse(content);
            
            // Handle different JSON formats
            if (Array.isArray(data)) {
                return data.map(operon => this.normalizeOperonData(operon));
            } else if (data.operons && Array.isArray(data.operons)) {
                return data.operons.map(operon => this.normalizeOperonData(operon));
            } else if (data.operon && Array.isArray(data.operon)) {
                return data.operon.map(operon => this.normalizeOperonData(operon));
            } else {
                throw new Error('Invalid JSON format: expected array of operons or object with operons property');
            }
        } catch (error) {
            throw new Error(`JSON parsing error: ${error.message}`);
        }
    }

    parseOperonCSV(content) {
        const lines = content.split('\n').filter(line => line.trim());
        const operons = [];
        
        // Skip header if present
        let startIndex = 0;
        if (lines.length > 0 && lines[0].toLowerCase().includes('operon')) {
            startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const columns = line.split(',').map(col => col.trim().replace(/^["']|["']$/g, ''));
            
            if (columns.length < 4) {
                console.warn(`Skipping invalid operon line ${i + 1}: insufficient columns`);
                continue;
            }

            const operon = {
                name: columns[0] || `operon_${i}`,
                start: parseInt(columns[1]) || 0,
                end: parseInt(columns[2]) || 0,
                strand: columns[3] === '-' ? -1 : 1,
                genes: columns[4] ? columns[4].split(';').map(gene => gene.trim()) : [],
                chromosome: columns[5] || this.genomeBrowser.currentChromosome || 'unknown'
            };

            operons.push(this.normalizeOperonData(operon));
        }

        return operons;
    }

    parseOperonTXT(content) {
        console.log('📝 Parsing TXT operon file...');
        console.log('Content preview:', content.substring(0, 200));
        
        if (!content || typeof content !== 'string') {
            console.error('❌ Invalid content for TXT parsing');
            return [];
        }
        
        const lines = content.split('\n');
        const operons = [];
        
        console.log(`📊 Total lines: ${lines.length}`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip empty lines and comments
            if (!line || !line.trim() || line.trim().startsWith('#')) {
                continue;
            }
            
            const trimmedLine = line.trim();
            console.log(`🔍 Processing line ${i + 1}: ${trimmedLine.substring(0, 50)}...`);

            // Try different text formats
            let operon;
            
            // Check if line contains tabs (tab-separated format)
            if (trimmedLine.includes('\t')) {
                const tabSeparated = trimmedLine.split('\t');
                console.log(`📋 Tab-separated fields: ${tabSeparated.length}`);
                
                if (tabSeparated.length >= 4) {
                    operon = {
                        name: tabSeparated[0].trim(),
                        start: parseInt(tabSeparated[1]) || 0,
                        end: parseInt(tabSeparated[2]) || 0,
                        strand: tabSeparated[3].trim() === '-' ? -1 : 1,
                        genes: tabSeparated[4] ? tabSeparated[4].split(',').map(g => g.trim()) : [],
                        chromosome: tabSeparated[5] ? tabSeparated[5].trim() : (this.genomeBrowser.currentChromosome || 'unknown'),
                        description: tabSeparated[6] ? tabSeparated[6].trim() : '',
                        confidence: tabSeparated[7] ? parseFloat(tabSeparated[7]) : 1.0,
                        source: tabSeparated[8] ? tabSeparated[8].trim() : 'user_loaded'
                    };
                    console.log(`✅ Created operon from tab-separated: ${operon.name}`);
                }
            }
            // Check if line contains spaces (space-separated format)
            else if (trimmedLine.includes(' ')) {
                const spaceSeparated = trimmedLine.split(/\s+/);
                console.log(`📋 Space-separated fields: ${spaceSeparated.length}`);
                
                if (spaceSeparated.length >= 4) {
                    operon = {
                        name: spaceSeparated[0],
                        start: parseInt(spaceSeparated[1]) || 0,
                        end: parseInt(spaceSeparated[2]) || 0,
                        strand: spaceSeparated[3] === '-' ? -1 : 1,
                        genes: spaceSeparated.slice(4),
                        chromosome: this.genomeBrowser.currentChromosome || 'unknown'
                    };
                    console.log(`✅ Created operon from space-separated: ${operon.name}`);
                }
            }
            else {
                console.warn(`⚠️ Skipping line ${i + 1}: unrecognized format`);
                continue;
            }

            if (operon) {
                operons.push(this.normalizeOperonData(operon));
            }
        }

        console.log(`📊 Parsed ${operons.length} operons from TXT file`);
        return operons;
    }

    normalizeOperonData(operon) {
        // Ensure all required fields are present and properly formatted
        return {
            name: operon.name || `operon_${Date.now()}`,
            start: parseInt(operon.start) || 0,
            end: parseInt(operon.end) || 0,
            strand: operon.strand === '-' || operon.strand === -1 ? -1 : 1,
            genes: Array.isArray(operon.genes) ? operon.genes : (operon.genes ? operon.genes.split(',').map(g => g.trim()) : []),
            chromosome: operon.chromosome || this.genomeBrowser.currentChromosome || 'unknown',
            description: operon.description || operon.desc || '',
            confidence: operon.confidence || operon.score || 1.0,
            source: operon.source || 'user_loaded'
        };
    }

    updateOperonPanel() {
        // Update the operon panel to show loaded operons
        if (this.genomeBrowser.trackRenderer && this.genomeBrowser.loadedOperons) {
            const visibleOperons = new Set();
            this.genomeBrowser.loadedOperons.forEach(operon => {
                visibleOperons.add(operon.name);
            });
            this.genomeBrowser.trackRenderer.updateOperonsPanel(this.genomeBrowser.loadedOperons, visibleOperons);
        }
    }

    async loadFile(filePath) {
        console.log('🔍 FileManager.loadFile() called with path:', filePath);
        this.genomeBrowser.showLoading(true);
        this.genomeBrowser.updateStatus('Loading file...');

        try {
            // Clear loaded operons when loading a new genome file
            if (this.genomeBrowser.loadedOperons) {
                this.genomeBrowser.loadedOperons = [];
                console.log('🧬 Cleared loaded operons for new genome file');
            }

            // Get file info
            console.log('📋 Getting file info for:', filePath);
            const fileInfo = await ipcRenderer.invoke('get-file-info', filePath);
            console.log('📋 File info result:', fileInfo);
            if (!fileInfo.success) {
                throw new Error(fileInfo.error);
            }

            // Check file size and warn for very large files (excluding SAM/BAM which use dynamic loading)
            const fileSizeMB = fileInfo.info.size / (1024 * 1024);
            const extension = fileInfo.info.extension.toLowerCase();
            
            // Get streaming threshold from track settings for consistent behavior
            const readsSettings = this.genomeBrowser.trackRenderer.getTrackSettings('reads');
            const streamingThreshold = readsSettings.streamingThreshold || 50;
            
            // Skip warning for SAM/BAM files since they use dynamic loading and can handle large files efficiently
            const usesDynamicLoading = extension === '.sam' || extension === '.bam';
            
            if (fileSizeMB > streamingThreshold && !usesDynamicLoading) {
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

            // Use streaming for files > threshold, but ONLY for SAM files (not BAM files)
            // BAM files should always use loadFileRegular() -> parseBAM() -> BamReader
            // SAM files can be extremely large and benefit from streaming even at smaller sizes
            const shouldUseStreaming = (extension === '.sam' && fileSizeMB > streamingThreshold);
            
            if (shouldUseStreaming) {
                console.log(`Using streaming mode for large SAM file: ${fileSizeMB.toFixed(1)} MB`);
                await this.loadFileStream(filePath);
            } else {
                console.log(`Using regular loading for ${extension} file: ${fileSizeMB.toFixed(1)} MB`);
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
            
            // Provide more helpful error messages for common issues
            let errorMessage = error.message;
            
            if (error.message.includes('Cannot create a string longer than')) {
                errorMessage = `File is too large to load into memory (JavaScript string limit exceeded). 
                
This typically happens with files larger than ~500MB. Please try:
1. Using a smaller SAM file
2. Converting to BAM format and using appropriate tools
3. Splitting the file into smaller chunks

File size: ${this.currentFile?.info ? (this.currentFile.info.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown'}`;
            } else if (error.message.includes('out of memory') || error.message.includes('Maximum call stack')) {
                errorMessage = `Insufficient memory to load this file. 
                
The file is too large for the available system memory. Please try:
1. Closing other applications to free memory
2. Using a smaller file
3. Restarting the application

File size: ${this.currentFile?.info ? (this.currentFile.info.size / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown'}`;
            }
            
            this.genomeBrowser.updateStatus(`Error: ${errorMessage}`);
            
            // Show a more user-friendly alert for memory-related errors
            if (error.message.includes('Cannot create a string longer than') || 
                error.message.includes('out of memory') || 
                error.message.includes('Maximum call stack')) {
                alert(`Failed to load file due to size/memory limitations:\n\n${errorMessage}`);
            } else {
                alert(`Failed to load file: ${error.message}`);
            }
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
            // Check if this is a BAM file
            if (fileData.isBamFile) {
                this.genomeBrowser.updateStatus('BAM file detected, switching to BAM parsing mode...');
                console.log(`BAM file detected: ${(fileData.fileSize / (1024 * 1024)).toFixed(1)} MB`);
                
                // Skip regular file reading for BAM files - they'll be handled by BAM parser
                this.currentFile.data = null; // BAM files don't use text data
                await this.parseFile();
                return;
            }
            
            // Check if the error is due to file being too large for memory
            if (fileData.requiresStreaming) {
                this.genomeBrowser.updateStatus('File too large for memory loading, switching to streaming...');
                console.log(`File is too large (${(fileData.fileSize / (1024 * 1024)).toFixed(1)} MB), using streaming mode`);
                
                // Automatically switch to streaming mode
                await this.loadFileStream(filePath);
                return;
            }
            
            throw new Error(fileData.error);
        }

        this.currentFile.data = fileData.data;

        // Parse file based on extension
        await this.parseFile();
    }

    async loadFileStream(filePath) {
        // Skip full file analysis for SAM files - initialize streaming mode directly
        try {
            console.log('🚀 Initializing large SAM file in streaming mode (skipping full analysis)...');
            
            // Get basic file information without reading content
            const fileStats = await ipcRenderer.invoke('get-file-info', filePath);
            if (!fileStats.success) {
                throw new Error(fileStats.error);
            }
            
            const fileSizeMB = (fileStats.info.size / (1024 * 1024)).toFixed(1);
            
            this.genomeBrowser.updateStatus(`🧬 Initializing large SAM file (${fileSizeMB} MB) in streaming mode...`);
            
            // Don't store the data - just set up streaming mode
            this.currentFile.data = null; // Explicitly set to null to save memory
            
            // Initialize ReadsManager in streaming mode without pre-analysis
            console.log(`[FileManager] Initializing ReadsManager with streaming SAM: ${filePath}`);
            await this.genomeBrowser.readsManager.initializeWithStreamingSAM(filePath);
            
            // Provide a rough estimate based on file size for UI purposes
            const estimatedReads = Math.floor(fileStats.info.size / 200); // Rough estimate: ~200 bytes per SAM line
            this.genomeBrowser.readsManager.stats.totalReads = estimatedReads;
            
            // Clear old reads to save memory
            this.genomeBrowser.currentReads = {};
            
            console.log(`✅ Large SAM file ready for on-demand streaming queries`);
            console.log(`   📁 File: ${fileSizeMB} MB`);
            console.log(`   📊 Estimated reads: ${estimatedReads.toLocaleString()}`);
            console.log(`   🔍 Mode: On-demand streaming (no pre-loading)`);
            
            this.genomeBrowser.updateStatus(`✅ SAM file ready: ${fileSizeMB} MB (streaming mode - reads loaded on-demand)`);
            
            // Auto-enable reads track
            this.autoEnableTracksForFileType('.sam');
            
            // If we already have sequence data, refresh the view
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
                this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            }
            
        } catch (error) {
            throw new Error(`Failed to initialize streaming SAM file: ${error.message}`);
        }
    }

    async parseFile() {
        const extension = this.currentFile.info.extension.toLowerCase();
        console.log('🔍 parseFile() called with extension:', extension);
        
        switch (extension) {
            case '.fasta':
            case '.fa':
                console.log('📂 Parsing as FASTA file');
                await this.parseFasta();
                break;
            case '.gb':
            case '.gbk':
            case '.gbff':
            case '.genbank':
                console.log('📂 Parsing as GenBank file');
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
        
        // Update all tabs with loaded genome data
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.onGenomeLoaded(sequences, this.currentFile?.path);
        }
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            this.genomeBrowser.selectChromosome(firstChr);
        }
    }

    async parseGenBank() {
        console.log('🔬 Starting GenBank parsing...');
        console.log('📄 Current file data length:', this.currentFile?.data?.length || 'No data');
        if (!this.currentFile?.data) {
            throw new Error('No file data available for GenBank parsing');
        }
        const lines = this.currentFile.data.split('\n');
        console.log(`📄 Total lines to parse: ${lines.length}`);
        
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
                            cleanValue = cleanValue.substring(0, 100) + '...';
                        }
                        
                        // Support multiple values for the same qualifier key
                        if (currentFeature.qualifiers[key]) {
                            // If key already exists, convert to array or append to existing array
                            if (Array.isArray(currentFeature.qualifiers[key])) {
                                currentFeature.qualifiers[key].push(cleanValue);
                            } else {
                                // Convert existing single value to array
                                currentFeature.qualifiers[key] = [currentFeature.qualifiers[key], cleanValue];
                            }
                        } else {
                            // First occurrence, store as single value
                            currentFeature.qualifiers[key] = cleanValue;
                        }
                    } else {
                        // Support multiple boolean qualifiers
                        if (currentFeature.qualifiers[key]) {
                            if (Array.isArray(currentFeature.qualifiers[key])) {
                                currentFeature.qualifiers[key].push(true);
                            } else {
                                currentFeature.qualifiers[key] = [currentFeature.qualifiers[key], true];
                            }
                        } else {
                            currentFeature.qualifiers[key] = true;
                        }
                        currentQualifierKey = null; // No continuation expected
                    }
                }
                continue;
            }
            
            // Handle multi-line qualifier values - improved efficiency
            if (line.match(/^\s{21}[^\/]/) && currentFeature && currentQualifierKey) {
                const continuationValue = line.trim().replace(/^"/, '').replace(/"$/, '');
                
                // Get the current qualifier value (handle both single values and arrays)
                let currentValue = currentFeature.qualifiers[currentQualifierKey];
                
                // If it's an array, work with the last element
                if (Array.isArray(currentValue)) {
                    const lastIndex = currentValue.length - 1;
                    currentValue = currentValue[lastIndex];
                    
                    // For translation qualifiers, skip most of the content to save memory
                    if (currentQualifierKey === 'translation') {
                        // Only keep the first part, ignore the rest
                        if (!currentValue.includes('...')) {
                            currentValue += continuationValue.substring(0, 50);
                            if (currentValue.length > 100) {
                                currentValue = currentValue.substring(0, 100) + '...';
                            }
                            currentFeature.qualifiers[currentQualifierKey][lastIndex] = currentValue;
                        }
                    } else {
                        // For other qualifiers, keep the full content (no artificial limits)
                        // Only apply reasonable limits to extremely large qualifiers (>50KB) to prevent memory issues
                        if (currentValue.length < 50000) {
                            currentFeature.qualifiers[currentQualifierKey][lastIndex] = currentValue + ' ' + continuationValue;
                        } else {
                            // For extremely large qualifiers, add truncation indicator
                            if (!currentValue.includes('[TRUNCATED]')) {
                                currentFeature.qualifiers[currentQualifierKey][lastIndex] = currentValue + ' [TRUNCATED - Content too large]';
                            }
                        }
                    }
                } else {
                    // Single value case
                    // For translation qualifiers, skip most of the content to save memory
                    if (currentQualifierKey === 'translation') {
                        // Only keep the first part, ignore the rest
                        if (!currentValue.includes('...')) {
                            currentValue += continuationValue.substring(0, 50);
                            if (currentValue.length > 100) {
                                currentValue = currentValue.substring(0, 100) + '...';
                            }
                            currentFeature.qualifiers[currentQualifierKey] = currentValue;
                        }
                    } else {
                        // For other qualifiers, keep the full content (no artificial limits)
                        // Only apply reasonable limits to extremely large qualifiers (>50KB) to prevent memory issues
                        if (currentValue.length < 50000) {
                            currentFeature.qualifiers[currentQualifierKey] = currentValue + ' ' + continuationValue;
                        } else {
                            // For extremely large qualifiers, add truncation indicator
                            if (!currentValue.includes('[TRUNCATED]')) {
                                currentFeature.qualifiers[currentQualifierKey] = currentValue + ' [TRUNCATED - Content too large]';
                            }
                        }
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
        
        // Extract and store source feature information separately for metadata
        this.extractSourceFeatures(annotations);
        
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
        
        // Update all tabs with loaded genome data
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.onGenomeLoaded(sequences, this.currentFile?.path);
        }
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            console.log(`Selecting first chromosome: ${firstChr}`);
            this.genomeBrowser.selectChromosome(firstChr);
        }
    }

    /**
     * Helper function to get the first value from a qualifier (supports both single values and arrays)
     */
    getQualifierValue(qualifiers, key) {
        if (!qualifiers || !qualifiers[key]) return null;
        
        const value = qualifiers[key];
        if (Array.isArray(value)) {
            return value.length > 0 ? value[0] : null;
        }
        return value;
    }
    
    /**
     * Helper function to get all values from a qualifier as an array
     */
    getAllQualifierValues(qualifiers, key) {
        if (!qualifiers || !qualifiers[key]) return [];
        
        const value = qualifiers[key];
        if (Array.isArray(value)) {
            return value;
        }
        return [value];
    }

    finalizeFeature(feature) {
        // Add name from qualifiers if available
        const geneName = this.getQualifierValue(feature.qualifiers, 'gene');
        const locusTag = this.getQualifierValue(feature.qualifiers, 'locus_tag');
        const product = this.getQualifierValue(feature.qualifiers, 'product');
        
        if (geneName) {
            feature.name = geneName;
        } else if (locusTag) {
            feature.name = locusTag;
        } else if (product) {
            feature.name = product;
        }
        
        // Add product information
        if (product) {
            feature.product = product;
        }
        
        // Add note information
        const note = this.getQualifierValue(feature.qualifiers, 'note');
        if (note) {
            feature.note = note;
        }
    }

    /**
     * Extract source feature information for genome metadata
     */
    extractSourceFeatures(annotations) {
        const sourceFeatures = {};
        
        for (const [chromosome, features] of Object.entries(annotations)) {
            const sourceFeature = features.find(feature => feature.type.toLowerCase() === 'source');
            if (sourceFeature) {
                sourceFeatures[chromosome] = {
                    organism: this.getQualifierValue(sourceFeature.qualifiers, 'organism') || 'Unknown',
                    strain: this.getQualifierValue(sourceFeature.qualifiers, 'strain') || null,
                    plasmid: this.getQualifierValue(sourceFeature.qualifiers, 'plasmid') || null,
                    note: this.getQualifierValue(sourceFeature.qualifiers, 'note') || null,
                    db_xref: this.getQualifierValue(sourceFeature.qualifiers, 'db_xref') || null,
                    mol_type: this.getQualifierValue(sourceFeature.qualifiers, 'mol_type') || null,
                    isolation_source: this.getQualifierValue(sourceFeature.qualifiers, 'isolation_source') || null,
                    country: this.getQualifierValue(sourceFeature.qualifiers, 'country') || null,
                    collection_date: this.getQualifierValue(sourceFeature.qualifiers, 'collection_date') || null,
                    collected_by: this.getQualifierValue(sourceFeature.qualifiers, 'collected_by') || null,
                    host: this.getQualifierValue(sourceFeature.qualifiers, 'host') || null,
                    serotype: this.getQualifierValue(sourceFeature.qualifiers, 'serotype') || null,
                    serovar: this.getQualifierValue(sourceFeature.qualifiers, 'serovar') || null,
                    qualifiers: sourceFeature.qualifiers
                };
            }
        }
        
        // Store source features in genome browser for later access
        this.genomeBrowser.sourceFeatures = sourceFeatures;
        console.log('📋 Extracted source features:', sourceFeatures);
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
        try {
            // Add to multi-file manager
            const result = await this.genomeBrowser.multiFileManager.addVcfFile(
                this.currentFile.path || this.currentFile.info.path,
                this.currentFile.data
            );
            
            console.log(`✅ VCF file added to multi-file manager: ${result.fileId}`);
            
            // For backward compatibility, also update currentVariants if this is the first VCF file
            const vcfFiles = this.genomeBrowser.multiFileManager.getVcfFiles();
            if (vcfFiles.length === 1) {
                this.genomeBrowser.currentVariants = vcfFiles[0].data;
            }
            
            this.genomeBrowser.updateStatus(`✅ VCF file loaded: ${result.metadata.name} (${result.metadata.variantCount} variants)`);
        
        // Update all tabs with new VCF data
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.onAdditionalFileLoaded('vcf', this.genomeBrowser.currentVariants, this.currentFile?.path);
        }
        
        // Auto-enable variants track
        this.autoEnableTracksForFileType('.vcf');
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            }
            
        } catch (error) {
            console.error('❌ VCF parsing failed:', error);
            this.genomeBrowser.updateStatus(`Failed to load VCF file: ${error.message}`, 'error');
            throw error;
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
        try {
            // Import BamReader module (ES6 module)
            if (typeof BamReader === 'undefined') {
                console.log('Loading BamReader module...');
                
                // Load BamReader as a regular script (not ES6 module) for Electron compatibility
                try {
                    const script = document.createElement('script');
                    script.src = './modules/BamReader.js';
                    document.head.appendChild(script);
                    
                    // Wait for BamReader to be available
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            reject(new Error('BamReader loading timeout'));
                        }, 10000);
                        
                        script.onload = () => {
                            clearTimeout(timeout);
                            // Wait a bit more for the class to be available
                            setTimeout(() => {
                                if (typeof BamReader !== 'undefined') {
                                    resolve();
                                } else {
                                    reject(new Error('BamReader class not available after loading'));
                                }
                            }, 100);
                        };
                        script.onerror = (error) => {
                            clearTimeout(timeout);
                            reject(error);
                        };
                    });
                } catch (importError) {
                    console.error('Failed to load BamReader:', importError);
                    throw new Error(`Failed to load BamReader module: ${importError.message}`);
                }
            }

            this.genomeBrowser.updateStatus('🧬 Initializing BAM file with multi-file support...');
            
            // Add to multi-file manager
            const result = await this.genomeBrowser.multiFileManager.addBamFile(this.currentFile.path);
            
            console.log(`✅ BAM file added to multi-file manager: ${result.fileId}`);
            
            // For backward compatibility, also initialize single-file mode if this is the first BAM file
            const bamFiles = this.genomeBrowser.multiFileManager.getBamFiles();
            if (bamFiles.length === 1) {
                // Store BAM reader for backward compatibility
                this.genomeBrowser.bamReader = bamFiles[0].reader;
            
                // Initialize ReadsManager with first BAM file
                await this.genomeBrowser.readsManager.initializeWithBAMReader(bamFiles[0].reader);
            
            // Clear old reads to save memory
            this.genomeBrowser.currentReads = {};
            }
            
            // Create informative status message
            const stats = result.metadata.stats;
            const statusMessage = stats.hasIndex ? 
                `✅ BAM file loaded: ${result.metadata.name} (${stats.references.length} chromosomes, indexed)` :
                `⚠️ BAM file loaded: ${result.metadata.name} (${stats.references.length} chromosomes, no index)`;
            
            this.genomeBrowser.updateStatus(statusMessage);
            
            // Auto-enable reads track when BAM file is loaded
            console.log('🔧 [FileManager] Auto-enabling reads track after BAM file load');
            if (!this.genomeBrowser.visibleTracks.has('reads')) {
                this.genomeBrowser.visibleTracks.add('reads');
                
                // Update UI checkboxes to reflect this change
                const trackReadsCheckbox = document.getElementById('trackReads');
                const sidebarTrackReadsCheckbox = document.getElementById('sidebarTrackReads');
                
                if (trackReadsCheckbox) {
                    trackReadsCheckbox.checked = true;
                    console.log('🔧 [FileManager] Updated toolbar reads checkbox');
                }
                if (sidebarTrackReadsCheckbox) {
                    sidebarTrackReadsCheckbox.checked = true;
                    console.log('🔧 [FileManager] Updated sidebar reads checkbox');
                }
                
                // Trigger view refresh to show the reads track
                if (this.genomeBrowser.currentChromosome && this.genomeBrowser.currentSequence) {
                    console.log('🔧 [FileManager] Refreshing view to show reads track');
                    setTimeout(() => {
                        this.genomeBrowser.displayGenomeView(
                            this.genomeBrowser.currentChromosome,
                            this.genomeBrowser.currentSequence[this.genomeBrowser.currentChromosome]
                        );
                    }, 100); // Small delay to ensure everything is properly initialized
                }
            }
            
            // Update all tabs with new BAM data
            if (this.genomeBrowser.tabManager) {
                this.genomeBrowser.tabManager.onAdditionalFileLoaded('bam', null, this.currentFile?.path);
            }
            
            // Show index recommendation if no index found
            if (!stats.hasIndex) {
                console.warn('💡 Recommendation: Create an index for faster queries:');
                console.warn('   samtools index your_file.bam');
            }
            
        } catch (error) {
            console.error('❌ Error parsing BAM file:', error);
            
            // Provide helpful error message
            let errorMessage = error.message;
            
            if (error.message.includes('Cannot resolve module') || 
                error.message.includes('BamReader is not defined') ||
                error.message.includes('Failed to load BamReader') ||
                error.message.includes('@gmod/bam')) {
                errorMessage = `BAM file support requires @gmod/bam library. Please ensure the application is properly installed with all dependencies.

Common fixes:
1. Restart the application completely
2. Try reinstalling dependencies: npm install
3. Check if @gmod/bam is properly installed in node_modules

If the issue persists, you can convert your BAM file to SAM format using samtools:
samtools view -h your_file.bam > your_file.sam

Then load the SAM file instead.

Technical details: ${error.message}`;
            } else if (error.message.includes('BAI index')) {
                errorMessage = `BAM file loaded but no BAI index found. For better performance with large BAM files, create an index:

samtools index your_file.bam

The BAM file will still work but may be slower for large files.

Original error: ${error.message}`;
            }
            
            throw new Error(errorMessage);
        }
    }

    async parseGFF() {
        const lines = this.currentFile.data.split('\n');
        const newAnnotations = {};
        let featureCount = 0;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('#') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 9) continue;
            
            const [seqname, source, feature, start, end, score, strand, frame, attribute] = fields;
            
            if (!newAnnotations[seqname]) {
                newAnnotations[seqname] = [];
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
            
            newAnnotations[seqname].push(annotation);
            featureCount++;
        }
        
        // Merge with existing annotations instead of replacing
        this.mergeAnnotations(newAnnotations);
        
        this.genomeBrowser.updateStatus(`Loaded GFF file with ${featureCount} features for ${Object.keys(newAnnotations).length} sequence(s). Merged with existing annotations.`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }

    async parseBED() {
        const lines = this.currentFile.data.split('\n');
        const newAnnotations = {};
        let featureCount = 0;
        let trackInfo = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines
            if (!trimmed) continue;
            
            // Parse track header line
            if (trimmed.startsWith('track')) {
                trackInfo = this.parseBEDTrackHeader(trimmed);
                continue;
            }
            
            // Skip comment lines
            if (trimmed.startsWith('#')) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 3) continue;
            
            const chrom = fields[0];
            const start = parseInt(fields[1]);
            const end = parseInt(fields[2]);
            const name = fields[3] || `BED_feature_${featureCount + 1}`;
            const score = fields[4] ? parseFloat(fields[4]) : 1000;
            const strand = fields[5] === '-' ? -1 : 1;
            
            // Parse additional BED fields if present
            const thickStart = fields[6] ? parseInt(fields[6]) : start;
            const thickEnd = fields[7] ? parseInt(fields[7]) : end;
            const itemRgb = fields[8] ? fields[8] : null;
            const blockCount = fields[9] ? parseInt(fields[9]) : 1;
            const blockSizes = fields[10] ? fields[10].split(',').map(s => parseInt(s)) : [end - start];
            const blockStarts = fields[11] ? fields[11].split(',').map(s => parseInt(s)) : [0];
            
            if (!newAnnotations[chrom]) {
                newAnnotations[chrom] = [];
            }
            
            const annotation = {
                type: 'BED_feature',
                start: start + 1, // Convert to 1-based
                end: end,
                strand: strand,
                score: score,
                qualifiers: {
                    name: name,
                    score: score,
                    thickStart: thickStart + 1, // Convert to 1-based
                    thickEnd: thickEnd,
                    itemRgb: itemRgb,
                    blockCount: blockCount,
                    blockSizes: blockSizes,
                    blockStarts: blockStarts,
                    source: trackInfo?.name || 'BED',
                    description: trackInfo?.description || 'BED annotation'
                }
            };
            
            newAnnotations[chrom].push(annotation);
            featureCount++;
        }
        
        // Merge with existing annotations instead of replacing
        this.mergeAnnotations(newAnnotations);
        
        this.genomeBrowser.updateStatus(`Loaded BED file with ${featureCount} features for ${Object.keys(newAnnotations).length} chromosome(s). Merged with existing annotations.`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
        }
    }
    
    parseBEDTrackHeader(headerLine) {
        // Parse track header line: track name=CHOPCHOP description=lysC visibility="pack" itemRgb="On"
        const trackInfo = {};
        const matches = headerLine.match(/(\w+)="?([^"\s]+)"?/g);
        
        if (matches) {
            matches.forEach(match => {
                const [key, value] = match.split('=');
                trackInfo[key] = value.replace(/"/g, '');
            });
        }
        
        return trackInfo;
    }
    
    /**
     * Merge new annotations with existing annotations
     * @param {Object} newAnnotations - New annotations to merge
     */
    mergeAnnotations(newAnnotations) {
        // Initialize currentAnnotations if it doesn't exist
        if (!this.genomeBrowser.currentAnnotations) {
            this.genomeBrowser.currentAnnotations = {};
        }
        
        // Merge annotations for each chromosome
        Object.keys(newAnnotations).forEach(chromosome => {
            if (!this.genomeBrowser.currentAnnotations[chromosome]) {
                this.genomeBrowser.currentAnnotations[chromosome] = [];
            }
            
            // Add new annotations to existing ones
            const existingCount = this.genomeBrowser.currentAnnotations[chromosome].length;
            this.genomeBrowser.currentAnnotations[chromosome].push(...newAnnotations[chromosome]);
            const newCount = this.genomeBrowser.currentAnnotations[chromosome].length;
            
            console.log(`Merged ${newCount - existingCount} new annotations for chromosome ${chromosome} (total: ${newCount})`);
        });
        
        // Update loaded files list
        if (!this.genomeBrowser.loadedFiles) {
            this.genomeBrowser.loadedFiles = [];
        }
        
        // Add file to loaded files if not already present
        const fileName = this.currentFile.info.name;
        const fileExtension = this.currentFile.info.extension.toLowerCase();
        const fileType = this.getFileTypeFromExtension(fileExtension);
        
        const existingFile = this.genomeBrowser.loadedFiles.find(file => file.name === fileName);
        if (!existingFile) {
            this.genomeBrowser.loadedFiles.push({
                name: fileName,
                type: fileType,
                size: this.currentFile.info.size,
                path: this.currentFile.info.path,
                loadedAt: new Date().toISOString()
            });
        }
    }
    
    /**
     * Get file type from extension
     * @param {string} extension - File extension
     * @returns {string} File type
     */
    getFileTypeFromExtension(extension) {
        const typeMap = {
            '.bed': 'BED',
            '.gff': 'GFF',
            '.gff3': 'GFF',
            '.gtf': 'GTF',
            '.vcf': 'VCF',
            '.sam': 'SAM',
            '.bam': 'BAM',
            '.wig': 'WIG',
            '.fasta': 'FASTA',
            '.fa': 'FASTA',
            '.gb': 'GenBank',
            '.gbk': 'GenBank',
            '.gbff': 'GenBank'
        };
        
        return typeMap[extension] || 'Unknown';
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
        
        // Update all tabs with new WIG data
        if (this.genomeBrowser.tabManager) {
            this.genomeBrowser.tabManager.onAdditionalFileLoaded('wig', this.genomeBrowser.currentWIGTracks, this.currentFile?.path);
        }
        
        // Only auto-enable WIG tracks if this is not part of a multiple file loading operation
        // (to avoid multiple calls that cause duplication)
        if (!this._isLoadingMultipleWIGFiles) {
            this.autoEnableTracksForFileType('.wig');
        }
        
        // If we already have sequence data, refresh the view (only for single file loading)
        if (!this._isLoadingMultipleWIGFiles) {
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
                this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            }
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
                wigTracks: document.getElementById('trackWIG'),
                genes: document.getElementById('trackGenes')
            },
            sidebar: {
                variants: document.getElementById('sidebarTrackVariants'),
                reads: document.getElementById('sidebarTrackReads'),
                wigTracks: document.getElementById('sidebarTrackWIG'),
                genes: document.getElementById('sidebarTrackGenes')
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
            case '.bed':
            case '.gff':
            case '.gtf':
                tracksToEnable = ['genes'];
                statusMessage = 'Gene/Annotation track automatically enabled for BED/GFF file';
                break;
        }

        // Check if tracks need to be enabled (avoid duplicate enabling)
        let tracksAlreadyEnabled = true;
        let enabledAnyTrack = false;
        
        tracksToEnable.forEach(trackType => {
            // Check if track is already enabled
            const toolbarChecked = trackCheckboxes.toolbar[trackType] && trackCheckboxes.toolbar[trackType].checked;
            const sidebarChecked = trackCheckboxes.sidebar[trackType] && trackCheckboxes.sidebar[trackType].checked;
            const inVisibleTracks = this.genomeBrowser.visibleTracks.has(trackType);
            
            if (!toolbarChecked || !sidebarChecked || !inVisibleTracks) {
                tracksAlreadyEnabled = false;
                
                // Enable in toolbar
                if (trackCheckboxes.toolbar[trackType] && !trackCheckboxes.toolbar[trackType].checked) {
                    trackCheckboxes.toolbar[trackType].checked = true;
                }
                // Enable in sidebar
                if (trackCheckboxes.sidebar[trackType] && !trackCheckboxes.sidebar[trackType].checked) {
                    trackCheckboxes.sidebar[trackType].checked = true;
                }
                // Add to visible tracks
                if (!this.genomeBrowser.visibleTracks.has(trackType)) {
                    this.genomeBrowser.visibleTracks.add(trackType);
                    enabledAnyTrack = true;
                }
            }
        });

        // Only update the genome view if we actually enabled new tracks
        if (enabledAnyTrack && !tracksAlreadyEnabled) {
            // Update the genome view to show the new tracks
            this.genomeBrowser.updateVisibleTracks();
            
            // Show status message
            this.genomeBrowser.updateStatus(statusMessage);
        } else if (tracksToEnable.length > 0 && tracksAlreadyEnabled) {
            // Show message that tracks were already enabled
            this.genomeBrowser.updateStatus(`${statusMessage.replace('automatically enabled', 'already enabled')}`);
        }
    }

    async loadMultipleWIGFiles(filePaths) {
        this.genomeBrowser.showLoading(true);
        this.genomeBrowser.updateStatus(`Loading ${filePaths.length} WIG files...`);

        // Set flag to prevent individual parseWIG calls from auto-enabling tracks
        this._isLoadingMultipleWIGFiles = true;

        try {
            const results = [];
            let successCount = 0;
            let errorCount = 0;

            // Process each file
            for (let i = 0; i < filePaths.length; i++) {
                const filePath = filePaths[i];
                const fileName = filePath.split('/').pop();
                
                try {
                    this.genomeBrowser.updateStatus(`Processing WIG file ${i + 1}/${filePaths.length}: ${fileName}`);
                    
                    // Get file info
                    const fileInfo = await ipcRenderer.invoke('get-file-info', filePath);
                    if (!fileInfo.success) {
                        throw new Error(fileInfo.error);
                    }

                    // Read file content
                    const fileData = await ipcRenderer.invoke('read-file', filePath);
                    if (!fileData.success) {
                        throw new Error(fileData.error);
                    }

                    // Create temporary file object for parsing
                    this.currentFile = {
                        path: filePath,
                        info: fileInfo.info,
                        data: fileData.data
                    };

                    // Parse WIG file (will not auto-enable tracks due to flag)
                    const tracksBefore = Object.keys(this.genomeBrowser.currentWIGTracks || {}).length;
                    await this.parseWIG();
                    const tracksAfter = Object.keys(this.genomeBrowser.currentWIGTracks || {}).length;
                    const newTracksFromThisFile = tracksAfter - tracksBefore;
                    
                    results.push({
                        file: fileName,
                        status: 'success',
                        tracks: newTracksFromThisFile
                    });
                    successCount++;
                    
                } catch (error) {
                    console.error(`Error loading WIG file ${fileName}:`, error);
                    results.push({
                        file: fileName,
                        status: 'error',
                        error: error.message
                    });
                    errorCount++;
                }
            }

            // Clear the flag
            this._isLoadingMultipleWIGFiles = false;

            // Update UI
            this.genomeBrowser.updateFileInfo();
            this.genomeBrowser.hideWelcomeScreen();
            
            // Auto-enable WIG tracks only once for all loaded files
            if (successCount > 0) {
                this.autoEnableTracksForFileType('.wig');
            }

            // Refresh view if sequence is loaded (only once after all files are processed)
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
                this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            }

            // Show summary
            const summary = this.createMultipleWIGLoadSummary(results, successCount, errorCount);
            this.genomeBrowser.updateStatus(summary.statusText);
            
            // Show detailed results if there were any errors
            if (errorCount > 0) {
                this.showMultipleWIGLoadResults(results);
            }

        } catch (error) {
            console.error('Error loading multiple WIG files:', error);
            this.genomeBrowser.updateStatus(`Error: ${error.message}`);
            alert(`Failed to load WIG files: ${error.message}`);
        } finally {
            // Ensure flag is cleared even if an error occurs
            this._isLoadingMultipleWIGFiles = false;
            this.genomeBrowser.showLoading(false);
        }
    }

    createMultipleWIGLoadSummary(results, successCount, errorCount) {
        const totalTracks = results
            .filter(r => r.status === 'success')
            .reduce((total, r) => total + (r.tracks || 0), 0);

        let statusText;
        if (errorCount === 0) {
            statusText = `Successfully loaded ${successCount} WIG files with ${totalTracks} tracks`;
        } else if (successCount === 0) {
            statusText = `Failed to load all ${errorCount} WIG files`;
        } else {
            statusText = `Loaded ${successCount}/${successCount + errorCount} WIG files (${totalTracks} tracks, ${errorCount} errors)`;
        }

        return {
            statusText,
            totalTracks,
            successCount,
            errorCount
        };
    }

    showMultipleWIGLoadResults(results) {
        // Create a simple results dialog
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const content = document.createElement('div');
        content.className = 'modal-content';
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 20px;
            max-width: 600px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;

        const title = document.createElement('h3');
        title.textContent = 'WIG Files Loading Results';
        title.style.marginTop = '0';

        const resultsList = document.createElement('div');
        resultsList.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            margin: 15px 0;
        `;

        results.forEach(result => {
            const item = document.createElement('div');
            item.style.cssText = `
                padding: 8px;
                margin: 5px 0;
                border-radius: 4px;
                display: flex;
                align-items: center;
                gap: 10px;
                ${result.status === 'success' ? 'background: #d4edda; border: 1px solid #c3e6cb;' : 'background: #f8d7da; border: 1px solid #f5c6cb;'}
            `;

            const icon = document.createElement('span');
            icon.innerHTML = result.status === 'success' ? '✅' : '❌';

            const text = document.createElement('span');
            if (result.status === 'success') {
                text.textContent = `${result.file} - ${result.tracks} tracks loaded`;
            } else {
                text.textContent = `${result.file} - Error: ${result.error}`;
            }
            text.style.flex = '1';

            item.appendChild(icon);
            item.appendChild(text);
            resultsList.appendChild(item);
        });

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.className = 'btn btn-secondary';
        closeButton.style.cssText = `
            background: #6c757d;
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            float: right;
        `;

        closeButton.onclick = () => {
            document.body.removeChild(modal);
        };

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        content.appendChild(title);
        content.appendChild(resultsList);
        content.appendChild(closeButton);
        modal.appendChild(content);
        document.body.appendChild(modal);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileManager;
} 