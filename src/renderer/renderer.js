const { ipcRenderer } = require('electron');

class GenomeBrowser {
    constructor() {
        this.currentFile = null;
        this.currentSequence = {};
        this.currentAnnotations = {};
        this.currentVariants = {};
        this.currentReads = {};
        this.currentPosition = { start: 0, end: 10000 };
        this.igvBrowser = null;
        this.searchResults = [];
        this.currentSearchIndex = 0;
        this.zoomLevel = 1;
        this.genes = [];
        
        // Default visible tracks - only show Genes & Features, Sequence, and GC Content by default
        this.visibleTracks = new Set(['genes', 'sequence', 'gc']);
        
        // Gene filter settings
        this.geneFilters = {
            genes: true,
            CDS: true,
            mRNA: true,
            tRNA: true,
            rRNA: true,
            promoter: true,
            terminator: true,
            regulatory: true,
            other: true
        };
        
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

        // Navigation controls (sidebar)
        document.getElementById('prevBtn').addEventListener('click', () => this.navigatePrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateNext());

        // Navigation controls (genome view)
        document.getElementById('prevBtnGenome').addEventListener('click', () => this.navigatePrevious());
        document.getElementById('nextBtnGenome').addEventListener('click', () => this.navigateNext());

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

        // Track selection (toolbar checkboxes)
        document.getElementById('trackSequence').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGenes').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGC').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackVariants').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackReads').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackProteins').addEventListener('change', () => this.updateVisibleTracks());

        // Sidebar track controls
        document.getElementById('sidebarTrackSequence').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackGenes').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackGC').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackVariants').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackReads').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackProteins').addEventListener('change', () => this.updateVisibleTracksFromSidebar());

        // Panel close buttons
        document.querySelectorAll('.close-panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panelId = e.target.closest('.close-panel-btn').dataset.panel;
                this.closePanel(panelId);
            });
        });

        // Feature filter toggle button
        document.getElementById('toggleFeatureFilters').addEventListener('click', () => {
            this.toggleFeatureFilters();
        });

        // Toolbar feature filter controls
        document.getElementById('showGenes').addEventListener('change', (e) => {
            this.geneFilters.genes = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowGenes', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showCDS').addEventListener('change', (e) => {
            this.geneFilters.CDS = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowCDS', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showMRNA').addEventListener('change', (e) => {
            this.geneFilters.mRNA = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowMRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showTRNA').addEventListener('change', (e) => {
            this.geneFilters.tRNA = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowTRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showRRNA').addEventListener('change', (e) => {
            this.geneFilters.rRNA = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowRRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showPromoter').addEventListener('change', (e) => {
            this.geneFilters.promoter = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowPromoter', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showTerminator').addEventListener('change', (e) => {
            this.geneFilters.terminator = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowTerminator', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showRegulatory').addEventListener('change', (e) => {
            this.geneFilters.regulatory = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowRegulatory', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('showOther').addEventListener('change', (e) => {
            this.geneFilters.other = e.target.checked;
            this.syncSidebarFeatureFilter('sidebarShowOther', e.target.checked);
            this.updateGeneDisplay();
        });

        // Sidebar feature filter controls
        document.getElementById('sidebarShowGenes').addEventListener('change', (e) => {
            this.geneFilters.genes = e.target.checked;
            this.syncToolbarFeatureFilter('showGenes', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowCDS').addEventListener('change', (e) => {
            this.geneFilters.CDS = e.target.checked;
            this.syncToolbarFeatureFilter('showCDS', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowMRNA').addEventListener('change', (e) => {
            this.geneFilters.mRNA = e.target.checked;
            this.syncToolbarFeatureFilter('showMRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowTRNA').addEventListener('change', (e) => {
            this.geneFilters.tRNA = e.target.checked;
            this.syncToolbarFeatureFilter('showTRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowRRNA').addEventListener('change', (e) => {
            this.geneFilters.rRNA = e.target.checked;
            this.syncToolbarFeatureFilter('showRRNA', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowPromoter').addEventListener('change', (e) => {
            this.geneFilters.promoter = e.target.checked;
            this.syncToolbarFeatureFilter('showPromoter', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowTerminator').addEventListener('change', (e) => {
            this.geneFilters.terminator = e.target.checked;
            this.syncToolbarFeatureFilter('showTerminator', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowRegulatory').addEventListener('change', (e) => {
            this.geneFilters.regulatory = e.target.checked;
            this.syncToolbarFeatureFilter('showRegulatory', e.target.checked);
            this.updateGeneDisplay();
        });
        document.getElementById('sidebarShowOther').addEventListener('change', (e) => {
            this.geneFilters.other = e.target.checked;
            this.syncToolbarFeatureFilter('showOther', e.target.checked);
            this.updateGeneDisplay();
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

        // Handle panel management
        ipcRenderer.on('show-panel', (event, panelId) => {
            this.showPanel(panelId);
        });

        ipcRenderer.on('show-all-panels', () => {
            this.showAllPanels();
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
            case '.sam':
                await this.parseSAM();
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
        
        // Initialize track checkboxes if not already done
        if (!document.getElementById('trackSequence').checked && !document.getElementById('trackGenes').checked) {
            document.getElementById('trackSequence').checked = true;
            document.getElementById('trackGenes').checked = true;
            this.updateVisibleTracks();
        }
        
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
        
        // Show navigation controls
        document.getElementById('genomeNavigation').style.display = 'block';
        
        // Create genome browser container
        const browserContainer = document.createElement('div');
        browserContainer.className = 'genome-browser-container';
        
        // Create ruler (always show)
        const ruler = this.createRuler();
        browserContainer.appendChild(ruler);
        
        // Create tracks in order for proper alignment
        // 1. Gene track (only if genes track is selected and annotations exist)
        if (this.visibleTracks.has('genes') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const geneTrack = this.createGeneTrack(chromosome);
            browserContainer.appendChild(geneTrack);
        }
        
        // 2. Sequence track (only if sequence track is selected)
        if (this.visibleTracks.has('sequence')) {
            const sequenceTrack = this.createSequenceTrack(chromosome, sequence);
            browserContainer.appendChild(sequenceTrack);
        }
        
        // 3. GC Content track (only if GC track is selected)
        if (this.visibleTracks.has('gc')) {
            const gcTrack = this.createGCTrack(chromosome, sequence);
            browserContainer.appendChild(gcTrack);
        }
        
        // 4. Variants track (only if variants track is selected and we have variant data)
        if (this.visibleTracks.has('variants') && this.currentVariants && this.currentVariants[chromosome]) {
            const variantTrack = this.createVariantTrack(chromosome);
            browserContainer.appendChild(variantTrack);
        }
        
        // 5. Aligned reads track (only if reads track is selected and we have read data)
        if (this.visibleTracks.has('reads') && this.currentReads && this.currentReads[chromosome]) {
            const readsTrack = this.createReadsTrack(chromosome);
            browserContainer.appendChild(readsTrack);
        }
        
        // 6. Protein track (only if proteins track is selected and we have CDS annotations)
        if (this.visibleTracks.has('proteins') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const proteinTrack = this.createProteinTrack(chromosome);
            browserContainer.appendChild(proteinTrack);
        }
        
        container.appendChild(browserContainer);
        
        // Update sequence display with enhanced information when zoomed in
        if (this.visibleTracks.has('sequence')) {
            this.displayEnhancedSequence(chromosome, sequence);
        } else {
            // Hide sequence display if sequence track is not selected
            document.getElementById('sequenceDisplay').style.display = 'none';
        }
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
        
        // Include all relevant gene types and features, filtered by user preferences
        const visibleGenes = annotations.filter(feature => {
            const validTypes = ['gene', 'CDS', 'mRNA', 'tRNA', 'rRNA', 'misc_feature', 
                              'regulatory', 'promoter', 'terminator', 'repeat_region'];
            return (validTypes.includes(feature.type) || feature.type.includes('RNA')) &&
                   this.shouldShowGeneType(feature.type);
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
            noGenesMsg.textContent = 'No genes/features in this region or all filtered out';
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

    createGCTrack(chromosome, sequence) {
        const track = document.createElement('div');
        track.className = 'gc-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'GC Content';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '80px';
        
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Create GC content visualization
        const gcDisplay = this.createGCContentVisualization(subsequence);
        trackContent.appendChild(gcDisplay);
        
        track.appendChild(trackContent);
        return track;
    }

    createReadsTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'reads-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Aligned Reads';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '120px';
        
        const reads = this.currentReads[chromosome] || [];
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const range = end - start;
        
        // Filter reads that overlap with current region
        const visibleReads = reads.filter(read => 
            read.start <= end && read.end >= start
        );
        
        console.log(`Displaying ${visibleReads.length} reads in region ${start}-${end}`);
        
        // Create read elements with stacking to avoid overlap
        const readLanes = [];
        visibleReads.forEach((read, index) => {
            // Find available lane for this read
            let lane = 0;
            while (lane < readLanes.length && readLanes[lane] > read.start) {
                lane++;
            }
            if (lane >= readLanes.length) {
                readLanes.push(0);
            }
            readLanes[lane] = read.end;
            
            const readElement = document.createElement('div');
            readElement.className = 'read-element';
            
            const readStart = Math.max(read.start, start);
            const readEnd = Math.min(read.end, end);
            const left = ((readStart - start) / range) * 100;
            const width = Math.max(((readEnd - readStart) / range) * 100, 0.5);
            
            readElement.style.left = `${left}%`;
            readElement.style.width = `${width}%`;
            readElement.style.height = '8px';
            readElement.style.top = `${10 + (lane * 12)}px`;
            readElement.style.position = 'absolute';
            readElement.style.background = read.strand === -1 ? '#ff6b6b' : '#4ecdc4';
            readElement.style.borderRadius = '2px';
            readElement.style.cursor = 'pointer';
            readElement.style.border = '1px solid rgba(0,0,0,0.2)';
            
            // Create read tooltip
            const readInfo = `Read: ${read.name || 'Unknown'}\n` +
                            `Position: ${read.start}-${read.end}\n` +
                            `Strand: ${read.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}\n` +
                            `Quality: ${read.quality || 'N/A'}`;
            
            readElement.title = readInfo;
            
            // Add click handler for detailed info
            readElement.addEventListener('click', () => {
                alert(readInfo);
            });
            
            trackContent.appendChild(readElement);
        });
        
        // Add message if no reads found
        if (visibleReads.length === 0) {
            const noReadsMsg = document.createElement('div');
            noReadsMsg.className = 'no-reads-message';
            noReadsMsg.textContent = 'No aligned reads in this region';
            noReadsMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noReadsMsg);
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
            html += `<span class="sequence-position" style="user-select: none;">${position.toLocaleString()}</span>`;
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
        // Check if there's any selected text first
        const selectedText = window.getSelection().toString();
        
        if (selectedText) {
            // Filter out line numbers and only keep DNA sequence characters
            const cleanSequence = selectedText.replace(/[\d,\s\n\r]/g, '').replace(/[^ATCGN]/gi, '');
            
            if (cleanSequence.length > 0) {
                navigator.clipboard.writeText(cleanSequence).then(() => {
                    this.updateStatus(`Copied ${cleanSequence.length} bases to clipboard`);
                    alert(`Sequence copied!\nLength: ${cleanSequence.length} bases`);
                }).catch(err => {
                    console.error('Failed to copy selected sequence:', err);
                    this.updateStatus('Failed to copy selected sequence');
                });
            } else {
                alert('Please select DNA sequence text (not line numbers).\nSelect the sequence letters (A, T, C, G) in the sequence display.');
            }
            return;
        }
        
        // If no text is selected, prompt user to select sequence
        alert('Please select a sequence portion to copy.\nYou can select DNA sequence text in the sequence display area below.\nNote: Line numbers will be automatically filtered out.');
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
        // Enhanced VCF parser
        const lines = this.currentFile.data.split('\n');
        const variants = {};
        
        for (const line of lines) {
            if (line.startsWith('#') || !line.trim()) continue;
            
            const parts = line.split('\t');
            if (parts.length >= 8) {
                const [chrom, pos, id, ref, alt, qual, filter, info] = parts;
                
                if (!variants[chrom]) {
                    variants[chrom] = [];
                }
                
                variants[chrom].push({
                    start: parseInt(pos),
                    end: parseInt(pos) + ref.length - 1,
                    id: id === '.' ? null : id,
                    ref: ref,
                    alt: alt,
                    quality: qual === '.' ? null : parseFloat(qual),
                    filter: filter,
                    info: info
                });
            }
        }
        
        this.currentVariants = variants;
        this.updateStatus('VCF file loaded - variants available');
        console.log('Loaded variants:', variants);
    }

    async parseSAM() {
        // Basic SAM parser - for demonstration (simplified)
        const lines = this.currentFile.data.split('\n');
        const reads = {};
        
        for (const line of lines) {
            if (line.startsWith('@') || !line.trim()) continue; // Skip header lines
            
            const parts = line.split('\t');
            if (parts.length >= 11) {
                const [qname, flag, rname, pos, mapq, cigar, rnext, pnext, tlen, seq, qual] = parts;
                
                if (rname === '*') continue; // Skip unmapped reads
                
                if (!reads[rname]) {
                    reads[rname] = [];
                }
                
                // Calculate read end position based on CIGAR string
                const readLength = seq.length;
                const startPos = parseInt(pos);
                const endPos = startPos + readLength - 1;
                
                // Determine strand from flag
                const flagInt = parseInt(flag);
                const isReverse = (flagInt & 16) !== 0;
                
                reads[rname].push({
                    name: qname,
                    start: startPos,
                    end: endPos,
                    strand: isReverse ? -1 : 1,
                    quality: parseInt(mapq),
                    sequence: seq,
                    cigar: cigar
                });
            }
        }
        
        this.currentReads = reads;
        this.updateStatus('SAM file loaded - aligned reads available');
        console.log('Loaded reads:', reads);
    }

    // Panel management methods
    closePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
            this.checkSidebarVisibility();
        }
    }

    showPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'block';
            this.showSidebar();
        }
    }

    showAllPanels() {
        const panels = ['fileInfoSection', 'navigationSection', 'statisticsSection', 'tracksSection', 'featuresSection'];
        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.style.display = 'block';
            }
        });
        this.showSidebar();
    }

    checkSidebarVisibility() {
        const panels = ['fileInfoSection', 'navigationSection', 'statisticsSection', 'tracksSection', 'featuresSection'];
        const visiblePanels = panels.filter(panelId => {
            const panel = document.getElementById(panelId);
            return panel && panel.style.display !== 'none';
        });

        if (visiblePanels.length === 0) {
            this.hideSidebar();
        }
    }

    hideSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        sidebar.classList.add('collapsed');
        mainContent.classList.add('sidebar-collapsed');
    }

    showSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        sidebar.classList.remove('collapsed');
        mainContent.classList.remove('sidebar-collapsed');
    }

    // Track selection methods
    updateVisibleTracks() {
        // Get selected tracks from toolbar checkboxes
        const tracks = new Set();
        if (document.getElementById('trackGenes').checked) tracks.add('genes');
        if (document.getElementById('trackSequence').checked) tracks.add('sequence');
        if (document.getElementById('trackGC').checked) tracks.add('gc');
        if (document.getElementById('trackVariants').checked) tracks.add('variants');
        if (document.getElementById('trackReads').checked) tracks.add('reads');
        if (document.getElementById('trackProteins').checked) tracks.add('proteins');
        
        this.visibleTracks = tracks;
        
        // Sync with sidebar
        document.getElementById('sidebarTrackGenes').checked = tracks.has('genes');
        document.getElementById('sidebarTrackSequence').checked = tracks.has('sequence');
        document.getElementById('sidebarTrackGC').checked = tracks.has('gc');
        document.getElementById('sidebarTrackVariants').checked = tracks.has('variants');
        document.getElementById('sidebarTrackReads').checked = tracks.has('reads');
        document.getElementById('sidebarTrackProteins').checked = tracks.has('proteins');
        
        console.log('Visible tracks:', Array.from(this.visibleTracks));
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    updateVisibleTracksFromSidebar() {
        // Get selected tracks from sidebar checkboxes
        const tracks = new Set();
        if (document.getElementById('sidebarTrackGenes').checked) tracks.add('genes');
        if (document.getElementById('sidebarTrackSequence').checked) tracks.add('sequence');
        if (document.getElementById('sidebarTrackGC').checked) tracks.add('gc');
        if (document.getElementById('sidebarTrackVariants').checked) tracks.add('variants');
        if (document.getElementById('sidebarTrackReads').checked) tracks.add('reads');
        if (document.getElementById('sidebarTrackProteins').checked) tracks.add('proteins');
        
        this.visibleTracks = tracks;
        
        // Sync with toolbar
        document.getElementById('trackGenes').checked = tracks.has('genes');
        document.getElementById('trackSequence').checked = tracks.has('sequence');
        document.getElementById('trackGC').checked = tracks.has('gc');
        document.getElementById('trackVariants').checked = tracks.has('variants');
        document.getElementById('trackReads').checked = tracks.has('reads');
        document.getElementById('trackProteins').checked = tracks.has('proteins');
        
        console.log('Visible tracks:', Array.from(this.visibleTracks));
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    // Feature filter methods
    toggleFeatureFilters() {
        const filterDiv = document.getElementById('featureFilterCheckboxes');
        const toggleBtn = document.getElementById('toggleFeatureFilters');
        
        if (filterDiv.style.display === 'none') {
            filterDiv.style.display = 'grid';
            toggleBtn.classList.add('active');
        } else {
            filterDiv.style.display = 'none';
            toggleBtn.classList.remove('active');
        }
    }

    syncSidebarFeatureFilter(sidebarId, checked) {
        const sidebarElement = document.getElementById(sidebarId);
        if (sidebarElement) {
            sidebarElement.checked = checked;
        }
    }

    syncToolbarFeatureFilter(toolbarId, checked) {
        const toolbarElement = document.getElementById(toolbarId);
        if (toolbarElement) {
            toolbarElement.checked = checked;
        }
    }

    // Gene filtering methods
    updateGeneDisplay() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    shouldShowGeneType(geneType) {
        const type = geneType.toLowerCase();
        if (type === 'gene') return this.geneFilters.genes;
        if (type === 'cds') return this.geneFilters.CDS;
        if (type === 'mrna') return this.geneFilters.mRNA;
        if (type === 'trna') return this.geneFilters.tRNA;
        if (type === 'rrna') return this.geneFilters.rRNA;
        if (type === 'promoter') return this.geneFilters.promoter;
        if (type === 'terminator') return this.geneFilters.terminator;
        if (type === 'regulatory') return this.geneFilters.regulatory;
        return this.geneFilters.other;
    }

    createVariantTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'variant-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'VCF Variants';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '60px';
        
        const variants = this.currentVariants[chromosome] || [];
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const range = end - start;
        
        // Filter for variants in the current region
        const visibleVariants = variants.filter(variant => 
            variant.start && variant.end && 
            variant.start <= end && variant.end >= start
        );
        
        console.log(`Displaying ${visibleVariants.length} variants in region ${start}-${end}`);
        
        visibleVariants.forEach((variant, index) => {
            const variantElement = document.createElement('div');
            variantElement.className = 'variant-element';
            
            const variantStart = Math.max(variant.start, start);
            const variantEnd = Math.min(variant.end, end);
            const left = ((variantStart - start) / range) * 100;
            const width = Math.max(((variantEnd - variantStart) / range) * 100, 0.2);
            
            variantElement.style.left = `${left}%`;
            variantElement.style.width = `${width}%`;
            variantElement.style.height = '12px';
            variantElement.style.top = '20px';
            variantElement.style.position = 'absolute';
            variantElement.style.background = '#e74c3c';
            variantElement.style.borderRadius = '2px';
            variantElement.style.cursor = 'pointer';
            
            // Create variant tooltip
            const variantInfo = `Variant: ${variant.id || 'Unknown'}\n` +
                              `Position: ${variant.start}-${variant.end}\n` +
                              `Ref: ${variant.ref || 'N/A'}\n` +
                              `Alt: ${variant.alt || 'N/A'}\n` +
                              `Quality: ${variant.quality || 'N/A'}`;
            
            variantElement.title = variantInfo;
            
            // Add click handler for detailed info
            variantElement.addEventListener('click', () => {
                alert(variantInfo);
            });
            
            trackContent.appendChild(variantElement);
        });
        
        // Add message if no variants found
        if (visibleVariants.length === 0) {
            const noVariantsMsg = document.createElement('div');
            noVariantsMsg.className = 'no-variants-message';
            noVariantsMsg.textContent = 'No variants in this region';
            noVariantsMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noVariantsMsg);
        }
        
        track.appendChild(trackContent);
        return track;
    }

    createProteinTrack(chromosome) {
        const track = document.createElement('div');
        track.className = 'protein-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'Proteins';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content';
        trackContent.style.height = '80px';
        
        const annotations = this.currentAnnotations[chromosome] || [];
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const range = end - start;
        
        // Filter for CDS features that can be translated to proteins
        const proteins = annotations.filter(feature => 
            feature.type === 'CDS' &&
            feature.start && feature.end && 
            feature.start <= end && feature.end >= start &&
            this.shouldShowGeneType('CDS')
        );
        
        console.log(`Displaying ${proteins.length} proteins in region ${start}-${end}`);
        
        proteins.forEach((protein, index) => {
            const proteinElement = document.createElement('div');
            proteinElement.className = 'protein-element';
            
            const proteinStart = Math.max(protein.start, start);
            const proteinEnd = Math.min(protein.end, end);
            const left = ((proteinStart - start) / range) * 100;
            const width = Math.max(((proteinEnd - proteinStart) / range) * 100, 0.3);
            
            proteinElement.style.left = `${left}%`;
            proteinElement.style.width = `${Math.max(width, 0.3)}%`;
            
            if (protein.strand === -1) {
                proteinElement.classList.add('reverse-strand');
            }
            
            // Create protein label
            const proteinName = protein.qualifiers.product || protein.qualifiers.gene || protein.qualifiers.locus_tag || 'Protein';
            const proteinInfo = `${proteinName} (CDS)`;
            const positionInfo = `${protein.start}-${protein.end} (${protein.strand === -1 ? '-' : '+'} strand)`;
            
            proteinElement.title = `${proteinInfo}\nPosition: ${positionInfo}`;
            
            // Set text content based on available space
            if (width > 2) {
                proteinElement.textContent = proteinName.length > 10 ? proteinName.substring(0, 10) + '...' : proteinName;
            } else if (width > 0.8) {
                proteinElement.textContent = proteinName.substring(0, 3);
            } else {
                proteinElement.textContent = '';
            }
            
            // Add click handler for detailed info
            proteinElement.addEventListener('click', () => {
                this.showProteinDetails(protein, chromosome);
            });
            
            trackContent.appendChild(proteinElement);
        });
        
        // Add message if no proteins found
        if (proteins.length === 0) {
            const noProteinsMsg = document.createElement('div');
            noProteinsMsg.className = 'no-proteins-message';
            noProteinsMsg.textContent = 'No proteins in this region or CDS filtered out';
            noProteinsMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noProteinsMsg);
        }
        
        track.appendChild(trackContent);
        return track;
    }

    showProteinDetails(protein, chromosome) {
        const sequence = this.currentSequence[chromosome];
        const dnaSequence = sequence.substring(protein.start - 1, protein.end);
        const proteinSequence = this.translateDNA(dnaSequence, protein.strand);
        
        const details = [];
        details.push(`Type: Protein (CDS)`);
        details.push(`Position: ${protein.start}-${protein.end}`);
        details.push(`Strand: ${protein.strand === -1 ? 'Reverse (-)' : 'Forward (+)'}`);
        details.push(`Length: ${protein.end - protein.start + 1} bp (${Math.floor((protein.end - protein.start + 1) / 3)} aa)`);
        details.push(`DNA Sequence: ${dnaSequence.substring(0, 60)}${dnaSequence.length > 60 ? '...' : ''}`);
        details.push(`Protein Sequence: ${proteinSequence.substring(0, 20)}${proteinSequence.length > 20 ? '...' : ''}`);
        
        if (protein.qualifiers) {
            Object.entries(protein.qualifiers).forEach(([key, value]) => {
                if (value && value !== 'Unknown') {
                    details.push(`${key}: ${value}`);
                }
            });
        }
        
        alert(details.join('\n'));
    }

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

    displayEnhancedSequence(chromosome, sequence) {
        const container = document.getElementById('sequenceContent');
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        const windowSize = end - start;
        
        // Show detailed sequence information when zoomed in enough
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
        
        // Show sequence display
        document.getElementById('sequenceDisplay').style.display = 'flex';
    }

    displayDetailedSequence(chromosome, subsequence, start) {
        const container = document.getElementById('sequenceContent');
        const annotations = this.currentAnnotations[chromosome] || [];
        
        // Create formatted sequence display with annotations
        let html = '<div class="detailed-sequence-view">';
        html += '<div class="sequence-info"><strong>DNA Sequence:</strong></div>';
        
        const lineLength = 60;
        
        for (let i = 0; i < subsequence.length; i += lineLength) {
            const line = subsequence.substring(i, i + lineLength);
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
        
        // Create formatted sequence display with basic annotations
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
}

// Initialize the genome browser when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genomeBrowser = new GenomeBrowser();
}); 