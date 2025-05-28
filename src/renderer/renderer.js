const { ipcRenderer } = require('electron');

class GenomeBrowser {
    constructor() {
        this.currentFile = null;
        this.currentSequence = null;
        this.currentAnnotations = null;
        this.currentPosition = { start: 0, end: 1000 };
        this.igvBrowser = null;
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.zoomLevel = 1;
        this.genes = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIPC();
        this.updateStatus('Ready');
    }

    setupEventListeners() {
        // File operations
        document.getElementById('openFileBtn').addEventListener('click', () => this.openFile());
        document.getElementById('welcomeOpenBtn').addEventListener('click', () => this.openFile());

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.showSearchModal());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.quickSearch();
        });

        // Position navigation
        document.getElementById('goToBtn').addEventListener('click', () => this.goToPosition());
        document.getElementById('positionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.goToPosition();
        });

        // Navigation controls
        document.getElementById('prevBtn').addEventListener('click', () => this.navigatePrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateNext());

        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.zoomOut());
        document.getElementById('resetZoomBtn').addEventListener('click', () => this.resetZoom());

        // Sequence controls
        document.getElementById('copySequenceBtn').addEventListener('click', () => this.copySequence());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportSequence());

        // Modal controls
        this.setupModalControls();

        // Chromosome selection
        document.getElementById('chromosomeSelect').addEventListener('change', (e) => {
            this.selectChromosome(e.target.value);
        });
    }

    setupModalControls() {
        // Search modal
        const searchModal = document.getElementById('searchModal');
        const gotoModal = document.getElementById('gotoModal');

        // Close modal handlers
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').classList.remove('show');
            });
        });

        // Modal search
        document.getElementById('modalSearchBtn').addEventListener('click', () => {
            this.performSearch();
        });

        // Modal goto
        document.getElementById('modalGotoBtn').addEventListener('click', () => {
            this.performGoto();
        });

        // Close modals on outside click
        [searchModal, gotoModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });
    }

    setupIPC() {
        // Handle file opened from main process
        ipcRenderer.on('file-opened', (event, filePath) => {
            this.loadFile(filePath);
        });

        // Handle menu actions
        ipcRenderer.on('show-search', () => {
            this.showSearchModal();
        });

        ipcRenderer.on('show-goto', () => {
            this.showGotoModal();
        });
    }

    async openFile() {
        // This will trigger the main process to show file dialog
        // The result will come back via IPC
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

    async loadFile(filePath) {
        this.showLoading(true);
        this.updateStatus('Loading file...');

        try {
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

            this.currentFile = {
                path: filePath,
                info: fileInfo.info,
                data: fileData.data
            };

            // Parse file based on extension
            await this.parseFile();
            
            // Update UI
            this.updateFileInfo();
            this.hideWelcomeScreen();
            this.updateStatus('File loaded successfully');

        } catch (error) {
            console.error('Error loading file:', error);
            this.updateStatus(`Error: ${error.message}`);
            alert(`Failed to load file: ${error.message}`);
        } finally {
            this.showLoading(false);
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
            default:
                // Try to parse as FASTA by default
                await this.parseFasta();
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

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Parse LOCUS line for sequence name
            if (line.startsWith('LOCUS')) {
                const parts = line.split(/\s+/);
                currentSeq = parts[1];
                sequences[currentSeq] = '';
                annotations[currentSeq] = [];
                features = [];
            }

            // Parse FEATURES section
            if (line.startsWith('FEATURES')) {
                continue;
            }

            // Parse individual features
            if (line.startsWith('     ') && !inOrigin && currentSeq) {
                const featureMatch = line.match(/^\s+(\w+)\s+(.+)/);
                if (featureMatch) {
                    const [, type, location] = featureMatch;
                    currentFeature = {
                        type: type,
                        location: location,
                        qualifiers: {},
                        start: null,
                        end: null,
                        strand: 1
                    };
                    
                    // Parse location
                    this.parseGenBankLocation(currentFeature, location);
                    features.push(currentFeature);
                }
            }

            // Parse qualifiers
            if (line.startsWith('                     /') && currentFeature) {
                const qualMatch = line.match(/^\s+\/(\w+)=?"?([^"]*)"?/);
                if (qualMatch) {
                    const [, key, value] = qualMatch;
                    currentFeature.qualifiers[key] = value.replace(/"/g, '');
                }
            }

            // Parse ORIGIN section
            if (line.startsWith('ORIGIN')) {
                inOrigin = true;
                annotations[currentSeq] = features;
                continue;
            }

            // Parse sequence data
            if (inOrigin && trimmed && !line.startsWith('//')) {
                const seqData = line.replace(/\d+/g, '').replace(/\s+/g, '').toUpperCase();
                currentData += seqData;
            }

            // End of record
            if (line.startsWith('//')) {
                if (currentSeq && currentData) {
                    sequences[currentSeq] = currentData;
                }
                inOrigin = false;
                currentData = '';
            }
        }

        this.currentSequence = sequences;
        this.currentAnnotations = annotations;
        this.populateChromosomeSelect();
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            this.selectChromosome(firstChr);
        }
    }

    parseGenBankLocation(feature, location) {
        // Simple location parsing - handles basic cases like "123..456" and "complement(123..456)"
        let isComplement = false;
        let cleanLocation = location;

        if (location.includes('complement')) {
            isComplement = true;
            feature.strand = -1;
            cleanLocation = location.replace(/complement\(|\)/g, '');
        }

        const rangeMatch = cleanLocation.match(/(\d+)\.\.(\d+)/);
        if (rangeMatch) {
            feature.start = parseInt(rangeMatch[1]);
            feature.end = parseInt(rangeMatch[2]);
        } else {
            const singleMatch = cleanLocation.match(/(\d+)/);
            if (singleMatch) {
                feature.start = parseInt(singleMatch[1]);
                feature.end = feature.start;
            }
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

        this.currentSequence = sequences;
        this.populateChromosomeSelect();
        
        // Select first chromosome by default
        const firstChr = Object.keys(sequences)[0];
        if (firstChr) {
            this.selectChromosome(firstChr);
        }
    }

    populateChromosomeSelect() {
        const select = document.getElementById('chromosomeSelect');
        select.innerHTML = '<option value="">Select chromosome...</option>';
        
        if (this.currentSequence) {
            Object.keys(this.currentSequence).forEach(chr => {
                const option = document.createElement('option');
                option.value = chr;
                option.textContent = chr;
                select.appendChild(option);
            });
        }
    }

    selectChromosome(chromosome) {
        if (!chromosome || !this.currentSequence[chromosome]) return;

        const sequence = this.currentSequence[chromosome];
        this.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        
        // Update chromosome select
        document.getElementById('chromosomeSelect').value = chromosome;
        
        // Update statistics
        this.updateStatistics(chromosome, sequence);
        
        // Show sequence and annotations
        this.displayGenomeView(chromosome, sequence);
    }

    updateStatistics(chromosome, sequence) {
        const length = sequence.length;
        const gcCount = (sequence.match(/[GC]/g) || []).length;
        const gcContent = ((gcCount / length) * 100).toFixed(2);

        document.getElementById('sequenceLength').textContent = length.toLocaleString();
        document.getElementById('gcContent').textContent = `${gcContent}%`;
        document.getElementById('currentPosition').textContent = 
            `${this.currentPosition.start + 1}-${this.currentPosition.end}`;
    }

    displayGenomeView(chromosome, sequence) {
        // Create EcoCyc-like genome browser view
        const container = document.getElementById('genomeViewer');
        container.innerHTML = '';
        
        // Create genome browser container
        const browserContainer = document.createElement('div');
        browserContainer.className = 'genome-browser-container';
        
        // Create ruler
        const ruler = this.createRuler();
        browserContainer.appendChild(ruler);
        
        // Create gene track
        if (this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const geneTrack = this.createGeneTrack(chromosome);
            browserContainer.appendChild(geneTrack);
        }
        
        // Create sequence track
        const sequenceTrack = this.createSequenceTrack(chromosome, sequence);
        browserContainer.appendChild(sequenceTrack);
        
        container.appendChild(browserContainer);
        
        // Update sequence display
        this.displaySequence(chromosome, sequence);
    }

    createRuler() {
        const ruler = document.createElement('div');
        ruler.className = 'genome-ruler';
        
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const range = end - start;
        const tickInterval = Math.max(1, Math.floor(range / 10));
        
        for (let pos = start; pos <= end; pos += tickInterval) {
            const tick = document.createElement('div');
            tick.className = 'ruler-tick';
            tick.style.left = `${((pos - start) / range) * 100}%`;
            tick.textContent = pos.toLocaleString();
            ruler.appendChild(tick);
        }
        
        return ruler;
    }

    createGeneTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'gene-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Genes & Features';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        
        const annotations = this.currentAnnotations[chromosome] || [];
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const range = end - start;
        
        // Include all relevant gene types and features
        const visibleGenes = annotations.filter(feature => {
            const validTypes = ['gene', 'CDS', 'mRNA', 'tRNA', 'rRNA', 'misc_feature', 
                              'regulatory', 'promoter', 'terminator', 'repeat_region'];
            return validTypes.includes(feature.type) || feature.type.includes('RNA');
        }).filter(gene => 
            gene.start && gene.end && 
            gene.start <= end && gene.end >= start
        );
        
        console.log(`Displaying ${visibleGenes.length} genes/features in region ${start}-${end}`);
        
        visibleGenes.forEach((gene, index) => {
            const geneElement = document.createElement('div');
            
            // Normalize gene type for CSS class
            let geneType = gene.type.toLowerCase();
            if (geneType.includes('rna') && !['mrna', 'trna', 'rrna'].includes(geneType)) {
                geneType = 'misc_feature';
            }
            
            geneElement.className = `gene-element ${geneType}`;
            
            const geneStart = Math.max(gene.start, start);
            const geneEnd = Math.min(gene.end, end);
            const left = ((geneStart - start) / range) * 100;
            const width = ((geneEnd - geneStart) / range) * 100;
            
            geneElement.style.left = `${left}%`;
            geneElement.style.width = `${Math.max(width, 0.3)}%`;
            
            // Ensure minimum visibility
            if (width < 0.5) {
                geneElement.style.minWidth = '8px';
            }
            
            if (gene.strand === -1) {
                geneElement.classList.add('reverse-strand');
            }
            
            // Create comprehensive gene label
            const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || gene.qualifiers.product || gene.type;
            const geneInfo = `${geneName} (${gene.type})`;
            const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
            
            geneElement.title = `${geneInfo}\nPosition: ${positionInfo}`;
            
            // Set text content based on available space
            if (width > 2) {
                geneElement.textContent = geneName.length > 12 ? geneName.substring(0, 12) + '...' : geneName;
            } else if (width > 0.8) {
                geneElement.textContent = geneName.substring(0, 3);
            } else {
                geneElement.textContent = '';
            }
            
            // Add click handler for detailed info
            geneElement.addEventListener('click', () => {
                this.showGeneDetails(gene);
            });
            
            trackContent.appendChild(geneElement);
        });
        
        // Add message if no genes found
        if (visibleGenes.length === 0) {
            const noGenesMsg = document.createElement('div');
            noGenesMsg.className = 'no-genes-message';
            noGenesMsg.textContent = 'No genes/features in this region';
            noGenesMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noGenesMsg);
        }
        
        track.appendChild(trackContent);
        return track;
    }

    showGeneDetails(gene) {
        const details = [];
        details.push(`Type: ${gene.type}`);
        details.push(`Position: ${gene.start}-${gene.end}`);
        details.push(`Strand: ${gene.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}`);
        details.push(`Length: ${gene.end - gene.start + 1} bp`);
        
        if (gene.qualifiers) {
            Object.entries(gene.qualifiers).forEach(([key, value]) => {
                if (value && value !== 'Unknown') {
                    details.push(`${key}: ${value}`);
                }
            });
        }
        
        alert(details.join('\n'));
    }

    createSequenceTrack(chromosome, sequence) {
        const track = document.createElement('div');
        track.className = 'sequence-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Sequence';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content sequence-visualization';
        
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Show sequence if zoomed in enough
        if (end - start <= 1000) {
            const seqDisplay = document.createElement('div');
            seqDisplay.className = 'sequence-bases-display';
            seqDisplay.innerHTML = this.colorizeSequence(subsequence);
            trackContent.appendChild(seqDisplay);
        } else {
            // Show GC content visualization for larger regions
            const gcDisplay = this.createGCContentVisualization(subsequence);
            trackContent.appendChild(gcDisplay);
        }
        
        track.appendChild(trackContent);
        return track;
    }

    createGCContentVisualization(sequence) {
        const container = document.createElement('div');
        container.className = 'gc-content-visualization';
        
        const windowSize = Math.max(1, Math.floor(sequence.length / 100));
        
        for (let i = 0; i < sequence.length; i += windowSize) {
            const window = sequence.substring(i, i + windowSize);
            const gcCount = (window.match(/[GC]/g) || []).length;
            const gcPercent = (gcCount / window.length) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'gc-bar';
            bar.style.height = `${gcPercent}%`;
            bar.style.backgroundColor = `hsl(${120 - gcPercent}, 70%, 50%)`;
            bar.title = `GC: ${gcPercent.toFixed(1)}%`;
            
            container.appendChild(bar);
        }
        
        return container;
    }

    displaySequence(chromosome, sequence) {
        const container = document.getElementById('sequenceContent');
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Create formatted sequence display
        let html = '';
        const lineLength = 60;
        
        for (let i = 0; i < subsequence.length; i += lineLength) {
            const line = subsequence.substring(i, i + lineLength);
            const position = start + i + 1;
            
            html += `<div class="sequence-line">`;
            html += `<span class="sequence-position">${position.toLocaleString()}</span>`;
            html += `<span class="sequence-bases">${this.colorizeSequence(line)}</span>`;
            html += `</div>`;
        }
        
        container.innerHTML = html;
        
        // Update sequence title
        document.getElementById('sequenceTitle').textContent = 
            `${chromosome}:${start + 1}-${end}`;
        
        // Show sequence display
        document.getElementById('sequenceDisplay').style.display = 'flex';
    }

    colorizeSequence(sequence) {
        return sequence.split('').map(base => {
            const className = `base-${base.toLowerCase()}`;
            return `<span class="${className}">${base}</span>`;
        }).join('');
    }

    hideWelcomeScreen() {
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }

    updateFileInfo() {
        const fileInfo = document.getElementById('fileInfo');
        const info = this.currentFile.info;
        
        fileInfo.innerHTML = `
            <div class="file-details">
                <div class="file-name">${info.name}</div>
                <div class="file-meta">Size: ${this.formatFileSize(info.size)}</div>
                <div class="file-meta">Modified: ${new Date(info.modified).toLocaleDateString()}</div>
                <div class="file-meta">Type: ${info.extension.toUpperCase()}</div>
            </div>
        `;
    }

    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Navigation methods
    navigatePrevious() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const windowSize = this.currentPosition.end - this.currentPosition.start;
        const newStart = Math.max(0, this.currentPosition.start - windowSize);
        const newEnd = newStart + windowSize;

        this.currentPosition = { start: newStart, end: newEnd };
        this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        this.updateStatistics(currentChr, this.currentSequence[currentChr]);
    }

    navigateNext() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        const windowSize = this.currentPosition.end - this.currentPosition.start;
        const newStart = Math.min(sequence.length - windowSize, this.currentPosition.start + windowSize);
        const newEnd = Math.min(sequence.length, newStart + windowSize);

        this.currentPosition = { start: newStart, end: newEnd };
        this.displayGenomeView(currentChr, sequence);
        this.updateStatistics(currentChr, sequence);
    }

    // Zoom methods
    zoomIn() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const center = Math.floor((this.currentPosition.start + this.currentPosition.end) / 2);
        const newWindowSize = Math.max(100, Math.floor((this.currentPosition.end - this.currentPosition.start) / 2));
        const newStart = Math.max(0, center - Math.floor(newWindowSize / 2));
        const newEnd = Math.min(this.currentSequence[currentChr].length, newStart + newWindowSize);

        this.currentPosition = { start: newStart, end: newEnd };
        this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        this.updateStatistics(currentChr, this.currentSequence[currentChr]);
    }

    zoomOut() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        const center = Math.floor((this.currentPosition.start + this.currentPosition.end) / 2);
        const newWindowSize = Math.min(sequence.length, (this.currentPosition.end - this.currentPosition.start) * 2);
        const newStart = Math.max(0, center - Math.floor(newWindowSize / 2));
        const newEnd = Math.min(sequence.length, newStart + newWindowSize);

        this.currentPosition = { start: newStart, end: newEnd };
        this.displayGenomeView(currentChr, sequence);
        this.updateStatistics(currentChr, sequence);
    }

    resetZoom() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        this.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        this.displayGenomeView(currentChr, sequence);
        this.updateStatistics(currentChr, sequence);
    }

    // Search methods
    showSearchModal() {
        document.getElementById('searchModal').classList.add('show');
        document.getElementById('modalSearchInput').focus();
    }

    showGotoModal() {
        document.getElementById('gotoModal').classList.add('show');
        document.getElementById('modalPositionInput').focus();
    }

    quickSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (query) {
            this.searchSequence(query);
        }
    }

    performSearch() {
        const query = document.getElementById('modalSearchInput').value.trim();
        const caseSensitive = document.getElementById('caseSensitive').checked;
        const reverseComplement = document.getElementById('reverseComplement').checked;

        if (query) {
            this.searchSequence(query, caseSensitive, reverseComplement);
            document.getElementById('searchModal').classList.remove('show');
        }
    }

    searchSequence(query, caseSensitive = false, reverseComplement = false) {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        const searchQuery = caseSensitive ? query : query.toUpperCase();
        const searchSequence = caseSensitive ? sequence : sequence.toUpperCase();

        this.searchResults = [];
        
        // Search for the query
        let index = searchSequence.indexOf(searchQuery);
        while (index !== -1) {
            this.searchResults.push(index);
            index = searchSequence.indexOf(searchQuery, index + 1);
        }

        // Search for reverse complement if requested
        if (reverseComplement) {
            const revComp = this.getReverseComplement(searchQuery);
            let revIndex = searchSequence.indexOf(revComp);
            while (revIndex !== -1) {
                this.searchResults.push(revIndex);
                revIndex = searchSequence.indexOf(revComp, revIndex + 1);
            }
        }

        this.searchResults.sort((a, b) => a - b);
        this.currentSearchIndex = 0;

        if (this.searchResults.length > 0) {
            this.goToSearchResult(0);
            this.updateStatus(`Found ${this.searchResults.length} matches`);
        } else {
            this.updateStatus('No matches found');
        }
    }

    getReverseComplement(sequence) {
        const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G' };
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }

    goToSearchResult(index) {
        if (index < 0 || index >= this.searchResults.length) return;

        const position = this.searchResults[index];
        const windowSize = 1000;
        const newStart = Math.max(0, position - Math.floor(windowSize / 2));
        const newEnd = Math.min(this.currentSequence[document.getElementById('chromosomeSelect').value].length, 
                               newStart + windowSize);

        this.currentPosition = { start: newStart, end: newEnd };
        this.displayGenomeView(document.getElementById('chromosomeSelect').value, 
                           this.currentSequence[document.getElementById('chromosomeSelect').value]);
        this.updateStatistics(document.getElementById('chromosomeSelect').value, 
                            this.currentSequence[document.getElementById('chromosomeSelect').value]);
    }

    // Position navigation
    goToPosition() {
        const input = document.getElementById('positionInput').value.trim();
        this.parseAndGoToPosition(input);
    }

    performGoto() {
        const input = document.getElementById('modalPositionInput').value.trim();
        this.parseAndGoToPosition(input);
        document.getElementById('gotoModal').classList.remove('show');
    }

    parseAndGoToPosition(input) {
        if (!input) return;

        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        let start, end;

        // Parse different position formats
        if (input.includes(':')) {
            // Format: chr:start-end or chr:position
            const [chr, pos] = input.split(':');
            if (pos.includes('-')) {
                const [s, e] = pos.split('-');
                start = parseInt(s) - 1; // Convert to 0-based
                end = parseInt(e);
            } else {
                const position = parseInt(pos) - 1; // Convert to 0-based
                start = Math.max(0, position - 500);
                end = Math.min(sequence.length, position + 500);
            }
        } else {
            // Just a position number
            const position = parseInt(input) - 1; // Convert to 0-based
            start = Math.max(0, position - 500);
            end = Math.min(sequence.length, position + 500);
        }

        // Validate and adjust positions
        start = Math.max(0, Math.min(start, sequence.length - 1));
        end = Math.max(start + 1, Math.min(end, sequence.length));

        this.currentPosition = { start, end };
        this.displayGenomeView(currentChr, sequence);
        this.updateStatistics(currentChr, sequence);
        this.updateStatus(`Navigated to position ${start + 1}-${end}`);
    }

    // Utility methods
    copySequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        const subsequence = sequence.substring(this.currentPosition.start, this.currentPosition.end);
        
        navigator.clipboard.writeText(subsequence).then(() => {
            this.updateStatus('Sequence copied to clipboard');
        }).catch(err => {
            console.error('Failed to copy sequence:', err);
            this.updateStatus('Failed to copy sequence');
        });
    }

    exportSequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence[currentChr]) return;

        const sequence = this.currentSequence[currentChr];
        const subsequence = sequence.substring(this.currentPosition.start, this.currentPosition.end);
        const fasta = `>${currentChr}:${this.currentPosition.start + 1}-${this.currentPosition.end}\n${subsequence}`;
        
        const blob = new Blob([fasta], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentChr}_${this.currentPosition.start + 1}-${this.currentPosition.end}.fasta`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.updateStatus('Sequence exported');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    async parseGFF() {
        // Basic GFF parser - for demonstration
        const lines = this.currentFile.data.split('\n');
        const annotations = {};
        
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const parts = line.split('\t');
            if (parts.length >= 9) {
                const [seqname, source, feature, start, end, score, strand, frame, attributes] = parts;
                
                if (!annotations[seqname]) {
                    annotations[seqname] = [];
                }
                
                annotations[seqname].push({
                    type: feature,
                    start: parseInt(start),
                    end: parseInt(end),
                    strand: strand === '-' ? -1 : 1,
                    qualifiers: this.parseGFFAttributes(attributes)
                });
            }
        }
        
        this.currentAnnotations = annotations;
        this.updateStatus('GFF file loaded - annotations only');
    }

    parseGFFAttributes(attributeString) {
        const attributes = {};
        const pairs = attributeString.split(';');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                attributes[key.trim()] = value.trim().replace(/"/g, '');
            }
        }
        
        return attributes;
    }

    async parseBED() {
        // Basic BED parser - for demonstration
        const lines = this.currentFile.data.split('\n');
        const annotations = {};
        
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const parts = line.split('\t');
            if (parts.length >= 3) {
                const [chrom, start, end, name, score, strand] = parts;
                
                if (!annotations[chrom]) {
                    annotations[chrom] = [];
                }
                
                annotations[chrom].push({
                    type: 'region',
                    start: parseInt(start) + 1, // BED is 0-based, convert to 1-based
                    end: parseInt(end),
                    strand: strand === '-' ? -1 : 1,
                    qualifiers: { name: name || 'Unknown' }
                });
            }
        }
        
        this.currentAnnotations = annotations;
        this.updateStatus('BED file loaded - annotations only');
    }

    async parseVCF() {
        // Basic VCF parser - for demonstration
        const lines = this.currentFile.data.split('\n');
        const annotations = {};
        
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const parts = line.split('\t');
            if (parts.length >= 8) {
                const [chrom, pos, id, ref, alt, qual, filter, info] = parts;
                
                if (!annotations[chrom]) {
                    annotations[chrom] = [];
                }
                
                annotations[chrom].push({
                    type: 'variant',
                    start: parseInt(pos),
                    end: parseInt(pos) + ref.length - 1,
                    strand: 1,
                    qualifiers: { 
                        id: id || 'Unknown',
                        ref: ref,
                        alt: alt,
                        quality: qual
                    }
                });
            }
        }
        
        this.currentAnnotations = annotations;
        this.updateStatus('VCF file loaded - variants only');
    }
}

// Initialize the genome browser when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genomeBrowser = new GenomeBrowser();
}); 