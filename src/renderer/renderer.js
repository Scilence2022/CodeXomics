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
        
        // Default visible tracks - show Genes & Features and GC Content by default
        this.visibleTracks = new Set(['genes', 'gc']);
        
        // Separate control for bottom sequence display
        this.showBottomSequence = true;
        
        // Gene filter settings - hide "gene" features by default since they're represented by CDS, ncRNA, etc.
        this.geneFilters = {
            genes: false,  // Hide gene features by default
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
        
        // Initialize splitter functionality
        this.initializeSplitter();
        
        // Initialize horizontal splitter functionality
        this.initializeHorizontalSplitter();
        
        // Add window resize listener for responsive sequence display
        window.addEventListener('resize', () => {
            this.handleWindowResize();
        });
    }

    handleWindowResize() {
        // Recalculate sequence display if visible
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            if (this.visibleTracks.has('sequence')) {
                this.displayEnhancedSequence(currentChr, this.currentSequence[currentChr]);
            }
        }
    }

    setupEventListeners() {
        // File operations - dropdown menu
        document.getElementById('openFileBtn').addEventListener('click', () => this.toggleFileDropdown());
        document.getElementById('openGenomeBtn').addEventListener('click', () => this.openSpecificFileType('genome'));
        document.getElementById('openAnnotationBtn').addEventListener('click', () => this.openSpecificFileType('annotation'));
        document.getElementById('openVariantBtn').addEventListener('click', () => this.openSpecificFileType('variant'));
        document.getElementById('openReadsBtn').addEventListener('click', () => this.openSpecificFileType('reads'));
        document.getElementById('openAnyBtn').addEventListener('click', () => this.openSpecificFileType('any'));

        // Welcome screen buttons
        document.getElementById('welcomeOpenGenomeBtn').addEventListener('click', () => this.openSpecificFileType('genome'));
        document.getElementById('welcomeOpenAnnotationBtn').addEventListener('click', () => this.openSpecificFileType('annotation'));
        document.getElementById('welcomeOpenVariantBtn').addEventListener('click', () => this.openSpecificFileType('variant'));
        document.getElementById('welcomeOpenReadsBtn').addEventListener('click', () => this.openSpecificFileType('reads'));

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.file-menu-container')) {
                this.closeFileDropdown();
            }
            
            // Auto-hide toggle panels when clicking outside
            if (!e.target.closest('#toggleTracks') && !e.target.closest('#trackCheckboxes')) {
                this.hideTracksPanel();
            }
            
            if (!e.target.closest('#toggleFeatureFilters') && !e.target.closest('#featureFilterCheckboxes')) {
                this.hideFeatureFiltersPanel();
            }
        });

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

        // Sequence panel toggle
        document.getElementById('toggleSequencePanel').addEventListener('click', () => this.toggleSequencePanel());

        // Modal controls
        this.setupModalControls();

        // Chromosome selection
        document.getElementById('chromosomeSelect').addEventListener('change', (e) => {
            this.selectChromosome(e.target.value);
        });

        // Track selection (toolbar checkboxes)
        document.getElementById('trackGenes').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGC').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackVariants').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackReads').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackProteins').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackBottomSequence').addEventListener('change', () => this.updateBottomSequenceVisibility());

        // Sidebar track controls
        document.getElementById('sidebarTrackGenes').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackGC').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackVariants').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackReads').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackProteins').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackBottomSequence').addEventListener('change', () => this.updateBottomSequenceVisibilityFromSidebar());

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

        // Toggle buttons for toolbar sections
        document.getElementById('toggleTracks').addEventListener('click', () => {
            this.toggleTracks();
        });
        
        // Sidebar toggle button
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.toggleSidebar();
        });
        
        // Splitter toggle button
        document.getElementById('splitterToggleBtn').addEventListener('click', () => {
            this.toggleSidebarFromSplitter();
        });
        
        // Floating toggle button
        document.getElementById('floatingToggleBtn').addEventListener('click', () => {
            this.toggleSidebarFromSplitter();
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

    toggleFileDropdown() {
        const dropdown = document.getElementById('fileDropdownMenu');
        dropdown.classList.toggle('show');
    }

    closeFileDropdown() {
        const dropdown = document.getElementById('fileDropdownMenu');
        dropdown.classList.remove('show');
    }

    openSpecificFileType(fileType) {
        this.closeFileDropdown();
        
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
        
        // PRESERVE TRACK HEIGHTS before clearing container
        const preservedHeights = new Map();
        const trackTypeMapping = {
            'gene': 'genes',
            'gc': 'gc',
            'variant': 'variants',
            'reads': 'reads',
            'protein': 'proteins'
        };

        const existingTracks = container.querySelectorAll('[class*="-track"]');
        console.log('[displayGenomeView] Existing tracks found for height preservation:', existingTracks.length);
        existingTracks.forEach(track => {
            const trackContent = track.querySelector('.track-content');
            if (trackContent && trackContent.style.height && trackContent.style.height !== '') {
                let baseType = null;
                for (const cls of track.classList) {
                    if (cls.endsWith('-track') && !cls.startsWith('track-splitter')) { // Ensure it's a main track div
                        baseType = cls.replace('-track', '');
                        break;
                    }
                }
                if (baseType) {
                    const mappedType = trackTypeMapping[baseType];
                    if (mappedType) {
                        preservedHeights.set(mappedType, trackContent.style.height);
                        console.log(`[displayGenomeView] Preserving height for ${mappedType} (from class ${baseType}-track): ${trackContent.style.height}`);
                    } else {
                        console.warn(`[displayGenomeView] No mapping found for base track type: ${baseType} from classList:`, track.classList);
                    }
                } else {
                    // console.log('[displayGenomeView] Could not determine baseType for track:', track.className);
                }
            } else if (trackContent) {
                // console.log('[displayGenomeView] No style.height to preserve for track (or height is empty string):', track.className, 'Height:', trackContent.style.height);
            }
        });
        console.log('[displayGenomeView] Preserved heights map:', preservedHeights);
        
        container.innerHTML = '';
        
        // Show navigation controls
        document.getElementById('genomeNavigation').style.display = 'block';
        
        // Create genome browser container
        const browserContainer = document.createElement('div');
        browserContainer.className = 'genome-browser-container';
        
        // Create ruler (always show)
        const ruler = this.createRuler();
        browserContainer.appendChild(ruler);
        
        // Collect all tracks to be displayed
        const tracksToShow = [];
        
        // 1. Gene track (only if genes track is selected and annotations exist)
        if (this.visibleTracks.has('genes') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const geneTrack = this.createGeneTrack(chromosome);
            tracksToShow.push({ element: geneTrack, type: 'genes' });
        }
        
        // 2. GC Content track (only if GC track is selected)
        if (this.visibleTracks.has('gc')) {
            const gcTrack = this.createGCTrack(chromosome, sequence);
            tracksToShow.push({ element: gcTrack, type: 'gc' });
        }
        
        // 3. Variants track (show if selected, even without data)
        if (this.visibleTracks.has('variants')) {
            const variantTrack = this.createVariantTrack(chromosome);
            tracksToShow.push({ element: variantTrack, type: 'variants' });
        }
        
        // 4. Aligned reads track (show if selected, even without data)
        if (this.visibleTracks.has('reads')) {
            const readsTrack = this.createReadsTrack(chromosome);
            tracksToShow.push({ element: readsTrack, type: 'reads' });
        }
        
        // 5. Protein track (only if proteins track is selected and we have CDS annotations)
        if (this.visibleTracks.has('proteins') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const proteinTrack = this.createProteinTrack(chromosome);
            tracksToShow.push({ element: proteinTrack, type: 'proteins' });
        }
        
        // Add tracks with splitters between them
        tracksToShow.forEach((track, index) => {
            // Add the track
            browserContainer.appendChild(track.element);
            
            // RESTORE PRESERVED HEIGHT if it exists
            const trackContent = track.element.querySelector('.track-content');
            const typeToRestore = track.type;
            if (trackContent && preservedHeights.has(typeToRestore)) {
                const heightToRestore = preservedHeights.get(typeToRestore);
                trackContent.style.height = heightToRestore;
                console.log(`[displayGenomeView] Restored height for ${typeToRestore}: ${heightToRestore}`);
            } else if (trackContent) {
                 console.log(`[displayGenomeView] No preserved height found for ${typeToRestore}. Current height: ${trackContent.style.height}`);
            }
            
            // Add splitter after each track except the last one
            if (index < tracksToShow.length - 1) {
                const splitter = this.createTrackSplitter(track.type, tracksToShow[index + 1].type);
                browserContainer.appendChild(splitter);
            }
        });
        
        container.appendChild(browserContainer);
        
        // Update BOTTOM sequence display - controlled separately
        if (this.showBottomSequence) {
            this.displayEnhancedSequence(chromosome, sequence);
        } else {
            // Hide sequence display if bottom sequence is not enabled
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
        
        // Add draggable functionality
        this.makeDraggable(trackContent, chromosome);
        
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
        
        // Add draggable functionality
        this.makeDraggable(trackContent, chromosome);
        
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        const range = end - start;
        
        // Create single-line sequence display with dynamic sizing
        const seqDisplay = document.createElement('div');
        seqDisplay.className = 'sequence-single-line';
        seqDisplay.style.position = 'relative';
        seqDisplay.style.height = '30px';
        seqDisplay.style.overflow = 'hidden';
        seqDisplay.style.display = 'flex';
        seqDisplay.style.alignItems = 'center';
        
        // Calculate font size based on available space and sequence length
        const containerWidth = trackContent.offsetWidth || 800; // fallback width
        const maxFontSize = 16;
        const minFontSize = 4;
        const calculatedFontSize = Math.max(minFontSize, Math.min(maxFontSize, containerWidth / range * 0.8));
        
        // Create sequence bases with dynamic positioning
        for (let i = 0; i < subsequence.length; i++) {
            const base = subsequence[i];
            const baseElement = document.createElement('span');
            baseElement.className = `base-${base.toLowerCase()} sequence-base-inline`;
            baseElement.textContent = base;
            baseElement.style.position = 'absolute';
            baseElement.style.left = `${(i / range) * 100}%`;
            baseElement.style.fontSize = `${calculatedFontSize}px`;
            baseElement.style.fontFamily = 'monospace';
            baseElement.style.fontWeight = 'bold';
            baseElement.style.textAlign = 'center';
            baseElement.style.lineHeight = '30px';
            baseElement.style.userSelect = 'text';
            baseElement.style.cursor = 'text';
            
            // Add tooltip with position info
            const position = start + i + 1;
            baseElement.title = `Position: ${position}, Base: ${base}`;
            
            seqDisplay.appendChild(baseElement);
        }
        
        trackContent.appendChild(seqDisplay);
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
        
        // Add draggable functionality
        this.makeDraggable(trackContent, chromosome);
        
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
        
        // Check if we have any reads data at all
        if (!this.currentReads || Object.keys(this.currentReads).length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-reads-message';
            noDataMsg.textContent = 'No SAM/BAM file loaded. Load a SAM/BAM file to see aligned reads.';
            noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noDataMsg);
            track.appendChild(trackContent);
            return track;
        }
        
        // Filter reads that overlap with current region
        const visibleReads = reads.filter(read => 
            read.start && read.end && 
            read.start <= end && read.end >= start
        );
        
        console.log(`Displaying ${visibleReads.length} reads in region ${start}-${end}`);
        
        visibleReads.forEach((read, index) => {
            const readElement = document.createElement('div');
            readElement.className = 'read-element';
            
            const readStart = Math.max(read.start, start);
            const readEnd = Math.min(read.end, end);
            const left = ((readStart - start) / range) * 100;
            const width = Math.max(((readEnd - readStart) / range) * 100, 0.2);
            
            readElement.style.left = `${left}%`;
            readElement.style.width = `${width}%`;
            readElement.style.height = '12px';
            readElement.style.top = '20px';
            readElement.style.position = 'absolute';
            readElement.style.background = read.strand === '+' ? '#00b894' : '#f39c12';
            readElement.style.borderRadius = '2px';
            readElement.style.cursor = 'pointer';
            
            // Create read tooltip
            const readInfo = `Read: ${read.id || 'Unknown'}\n` +
                              `Position: ${read.start}-${read.end}\n` +
                              `Strand: ${read.strand || 'N/A'}\n` +
                              `Mapping Quality: ${read.mappingQuality || 'N/A'}`;
            
            readElement.title = readInfo;
            
            // Add click handler for detailed info
            readElement.addEventListener('click', () => {
                alert(readInfo);
            });
            
            trackContent.appendChild(readElement);
        });
        
        // Add message if no reads found in this region
        if (visibleReads.length === 0) {
            const noReadsMsg = document.createElement('div');
            noReadsMsg.className = 'no-reads-message';
            noReadsMsg.textContent = 'No reads in this region';
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
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
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

    // Initialize splitter functionality
    initializeSplitter() {
        const splitter = document.getElementById('splitter');
        const genomeSection = document.getElementById('genomeViewerSection');
        const sequenceSection = document.getElementById('sequenceDisplaySection');
        const viewerContainer = document.getElementById('viewerContainer');
        
        if (!splitter || !genomeSection || !sequenceSection || !viewerContainer) {
            console.warn('Splitter elements not found, skipping initialization');
            return;
        }
        
        let isResizing = false;
        let startY = 0;
        let startGenomeHeight = 0;
        let startSequenceHeight = 0;
        
        // Mouse events for dragging
        splitter.addEventListener('mousedown', (e) => {
            isResizing = true;
            startY = e.clientY;
            startGenomeHeight = genomeSection.offsetHeight;
            startSequenceHeight = sequenceSection.offsetHeight;
            
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            splitter.classList.add('active');
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaY = e.clientY - startY;
            const containerHeight = viewerContainer.offsetHeight;
            const splitterHeight = splitter.offsetHeight;
            
            // Calculate new heights
            const newGenomeHeight = startGenomeHeight + deltaY;
            const newSequenceHeight = startSequenceHeight - deltaY;
            
            // Set minimum heights (increased for better usability)
            const minHeight = 200;
            const maxGenomeHeight = containerHeight - minHeight - splitterHeight;
            const maxSequenceHeight = containerHeight - minHeight - splitterHeight;
            
            if (newGenomeHeight >= minHeight && newGenomeHeight <= maxGenomeHeight &&
                newSequenceHeight >= minHeight && newSequenceHeight <= maxSequenceHeight) {
                
                genomeSection.style.flex = 'none';
                genomeSection.style.height = `${newGenomeHeight}px`;
                
                sequenceSection.style.flex = 'none';
                sequenceSection.style.height = `${newSequenceHeight}px`;
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                splitter.classList.remove('active');
            }
        });
        
        // Keyboard accessibility
        splitter.setAttribute('tabindex', '0');
        splitter.setAttribute('role', 'separator');
        splitter.setAttribute('aria-label', 'Resize panels');
        
        splitter.addEventListener('keydown', (e) => {
            const step = 20; // pixels to move per keypress
            let deltaY = 0;
            
            switch(e.key) {
                case 'ArrowUp':
                    deltaY = -step;
                    break;
                case 'ArrowDown':
                    deltaY = step;
                    break;
                case 'Home':
                    // Reset to default split
                    genomeSection.style.flex = '1';
                    genomeSection.style.height = 'auto';
                    sequenceSection.style.flex = 'none';
                    sequenceSection.style.height = '300px';
                    e.preventDefault();
                    return;
                default:
                    return;
            }
            
            e.preventDefault();
            
            // Apply keyboard movement
            const currentGenomeHeight = genomeSection.offsetHeight;
            const currentSequenceHeight = sequenceSection.offsetHeight;
            const containerHeight = viewerContainer.offsetHeight;
            const splitterHeight = splitter.offsetHeight;
            
            const newGenomeHeight = currentGenomeHeight + deltaY;
            const newSequenceHeight = currentSequenceHeight - deltaY;
            
            const minHeight = 200;
            const maxGenomeHeight = containerHeight - minHeight - splitterHeight;
            const maxSequenceHeight = containerHeight - minHeight - splitterHeight;
            
            if (newGenomeHeight >= minHeight && newGenomeHeight <= maxGenomeHeight &&
                newSequenceHeight >= minHeight && newSequenceHeight <= maxSequenceHeight) {
                
                genomeSection.style.flex = 'none';
                genomeSection.style.height = `${newGenomeHeight}px`;
                
                sequenceSection.style.flex = 'none';
                sequenceSection.style.height = `${newSequenceHeight}px`;
            }
        });
        
        // Double-click to reset to default split
        splitter.addEventListener('dblclick', () => {
            genomeSection.style.flex = '1';
            genomeSection.style.height = 'auto';
            sequenceSection.style.flex = 'none';
            sequenceSection.style.height = '300px';
        });
    }

    displayDetailedSequence(chromosome, subsequence, start) {
        const container = document.getElementById('sequenceContent');
        const annotations = this.currentAnnotations[chromosome] || [];
        
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

    updateBottomSequenceVisibility() {
        const trackBottomSequence = document.getElementById('trackBottomSequence');
        if (!trackBottomSequence) return;
        
        this.showBottomSequence = trackBottomSequence.checked;
        
        // Sync with sidebar
        const sidebarTrackBottomSequence = document.getElementById('sidebarTrackBottomSequence');
        if (sidebarTrackBottomSequence) {
            sidebarTrackBottomSequence.checked = this.showBottomSequence;
        }
        
        // Show/hide sequence display section and splitter
        const sequenceSection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        
        if (this.showBottomSequence) {
            // Refresh the genome view if a file is loaded
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
                this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
            }
        } else {
            // Hide sequence display section and splitter
            if (sequenceSection) sequenceSection.style.display = 'none';
            if (splitter) splitter.style.display = 'none';
            
            // Reset genome section to take full space
            const genomeSection = document.getElementById('genomeViewerSection');
            if (genomeSection) {
                genomeSection.style.flex = '1';
                genomeSection.style.height = 'auto';
            }
        }
    }

    updateBottomSequenceVisibilityFromSidebar() {
        const sidebarTrackBottomSequence = document.getElementById('sidebarTrackBottomSequence');
        if (!sidebarTrackBottomSequence) return;
        
        this.showBottomSequence = sidebarTrackBottomSequence.checked;
        
        // Sync with toolbar
        const trackBottomSequence = document.getElementById('trackBottomSequence');
        if (trackBottomSequence) {
            trackBottomSequence.checked = this.showBottomSequence;
        }
        
        // Show/hide sequence display section and splitter
        const sequenceSection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        
        if (this.showBottomSequence) {
            // Refresh the genome view if a file is loaded
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
                this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
            }
        } else {
            // Hide sequence display section and splitter
            if (sequenceSection) sequenceSection.style.display = 'none';
            if (splitter) splitter.style.display = 'none';
            
            // Reset genome section to take full space
            const genomeSection = document.getElementById('genomeViewerSection');
            if (genomeSection) {
                genomeSection.style.flex = '1';
                genomeSection.style.height = 'auto';
            }
        }
    }

    updateVisibleTracks() {
        // Get selected tracks from toolbar checkboxes
        const tracks = new Set();
        const trackGenes = document.getElementById('trackGenes');
        const trackGC = document.getElementById('trackGC');
        const trackVariants = document.getElementById('trackVariants');
        const trackReads = document.getElementById('trackReads');
        const trackProteins = document.getElementById('trackProteins');
        
        if (trackGenes && trackGenes.checked) tracks.add('genes');
        if (trackGC && trackGC.checked) tracks.add('gc');
        if (trackVariants && trackVariants.checked) tracks.add('variants');
        if (trackReads && trackReads.checked) tracks.add('reads');
        if (trackProteins && trackProteins.checked) tracks.add('proteins');
        
        this.visibleTracks = tracks;
        
        // Sync with sidebar
        const sidebarTrackGenes = document.getElementById('sidebarTrackGenes');
        const sidebarTrackGC = document.getElementById('sidebarTrackGC');
        const sidebarTrackVariants = document.getElementById('sidebarTrackVariants');
        const sidebarTrackReads = document.getElementById('sidebarTrackReads');
        const sidebarTrackProteins = document.getElementById('sidebarTrackProteins');
        
        if (sidebarTrackGenes) sidebarTrackGenes.checked = tracks.has('genes');
        if (sidebarTrackGC) sidebarTrackGC.checked = tracks.has('gc');
        if (sidebarTrackVariants) sidebarTrackVariants.checked = tracks.has('variants');
        if (sidebarTrackReads) sidebarTrackReads.checked = tracks.has('reads');
        if (sidebarTrackProteins) sidebarTrackProteins.checked = tracks.has('proteins');
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    updateVisibleTracksFromSidebar() {
        // Get selected tracks from sidebar checkboxes
        const tracks = new Set();
        const sidebarTrackGenes = document.getElementById('sidebarTrackGenes');
        const sidebarTrackGC = document.getElementById('sidebarTrackGC');
        const sidebarTrackVariants = document.getElementById('sidebarTrackVariants');
        const sidebarTrackReads = document.getElementById('sidebarTrackReads');
        const sidebarTrackProteins = document.getElementById('sidebarTrackProteins');
        
        if (sidebarTrackGenes && sidebarTrackGenes.checked) tracks.add('genes');
        if (sidebarTrackGC && sidebarTrackGC.checked) tracks.add('gc');
        if (sidebarTrackVariants && sidebarTrackVariants.checked) tracks.add('variants');
        if (sidebarTrackReads && sidebarTrackReads.checked) tracks.add('reads');
        if (sidebarTrackProteins && sidebarTrackProteins.checked) tracks.add('proteins');
        
        this.visibleTracks = tracks;
        
        // Sync with toolbar
        const trackGenes = document.getElementById('trackGenes');
        const trackGC = document.getElementById('trackGC');
        const trackVariants = document.getElementById('trackVariants');
        const trackReads = document.getElementById('trackReads');
        const trackProteins = document.getElementById('trackProteins');
        
        if (trackGenes) trackGenes.checked = tracks.has('genes');
        if (trackGC) trackGC.checked = tracks.has('gc');
        if (trackVariants) trackVariants.checked = tracks.has('variants');
        if (trackReads) trackReads.checked = tracks.has('reads');
        if (trackProteins) trackProteins.checked = tracks.has('proteins');
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
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
        
        // Check if we have any variant data at all
        if (!this.currentVariants || Object.keys(this.currentVariants).length === 0) {
            const noDataMsg = document.createElement('div');
            noDataMsg.className = 'no-variants-message';
            noDataMsg.textContent = 'No VCF file loaded. Load a VCF file to see variants.';
            noDataMsg.style.cssText = `
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-style: italic;
                font-size: 12px;
            `;
            trackContent.appendChild(noDataMsg);
            track.appendChild(trackContent);
            return track;
        }
        
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
        
        // Add message if no variants found in this region
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

    shouldShowGeneType(type) {
        const typeMap = {
            'gene': 'genes',
            'CDS': 'CDS',
            'mRNA': 'mRNA',
            'tRNA': 'tRNA',
            'rRNA': 'rRNA',
            'promoter': 'promoter',
            'terminator': 'terminator',
            'regulatory': 'regulatory',
            'misc_feature': 'other',
            'repeat_region': 'other'
        };
        
        const filterKey = typeMap[type] || 'other';
        return this.geneFilters[filterKey];
    }

    updateGeneDisplay() {
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
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

    toggleFeatureFilters() {
        const checkboxes = document.getElementById('featureFilterCheckboxes');
        const button = document.getElementById('toggleFeatureFilters');
        
        if (checkboxes.style.display === 'none' || checkboxes.style.display === '') {
            checkboxes.style.display = 'grid'; // Use grid as defined in CSS
            button.classList.add('active');
        } else {
            checkboxes.style.display = 'none';
            button.classList.remove('active');
        }
    }
    
    toggleTracks() {
        const checkboxes = document.getElementById('trackCheckboxes');
        const button = document.getElementById('toggleTracks');
        
        if (checkboxes.style.display === 'none' || checkboxes.style.display === '') {
            checkboxes.style.display = 'flex'; // Use flex as defined in CSS
            button.classList.add('active');
        } else {
            checkboxes.style.display = 'none';
            button.classList.remove('active');
        }
    }

    hideTracksPanel() {
        const checkboxes = document.getElementById('trackCheckboxes');
        const button = document.getElementById('toggleTracks');
        
        if (checkboxes && checkboxes.style.display !== 'none') {
            checkboxes.style.display = 'none';
            button.classList.remove('active');
        }
    }

    hideFeatureFiltersPanel() {
        const checkboxes = document.getElementById('featureFilterCheckboxes');
        const button = document.getElementById('toggleFeatureFilters');
        
        if (checkboxes && checkboxes.style.display !== 'none') {
            checkboxes.style.display = 'none';
            button.classList.remove('active');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar.classList.contains('collapsed')) {
            // Show sidebar
            sidebar.classList.remove('collapsed');
            horizontalSplitter.classList.remove('hidden');
            mainContent.classList.remove('sidebar-collapsed');
        } else {
            // Hide sidebar
            sidebar.classList.add('collapsed');
            horizontalSplitter.classList.add('hidden');
            mainContent.classList.add('sidebar-collapsed');
        }
        
        // Update all toggle button states
        this.updateToggleButtonStates();
        
        // Trigger a resize event to ensure proper layout adjustment
        window.dispatchEvent(new Event('resize'));
    }

    showPanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'block';
            
            // Show sidebar and splitter if they were hidden
            this.showSidebarIfHidden();
        }
    }

    closePanel(panelId) {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
            
            // Check if all panels are closed and hide sidebar if so
            this.checkAndHideSidebarIfAllPanelsClosed();
        }
    }

    checkAndHideSidebarIfAllPanelsClosed() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        const floatingToggleBtn = document.getElementById('floatingToggleBtn');
        
        // Get all sidebar sections
        const allPanels = document.querySelectorAll('.sidebar-section');
        const visiblePanels = Array.from(allPanels).filter(panel => 
            panel.style.display !== 'none'
        );
        
        if (visiblePanels.length === 0) {
            // All panels are closed, hide sidebar
            sidebar.classList.add('collapsed');
            horizontalSplitter.classList.add('hidden');
            mainContent.classList.add('sidebar-collapsed');
            
            // Update splitter toggle button
            if (splitterToggleBtn) {
                splitterToggleBtn.classList.add('collapsed');
                splitterToggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                splitterToggleBtn.title = 'Show Sidebar';
            }
            
            // Show floating toggle button
            if (floatingToggleBtn) {
                floatingToggleBtn.style.display = 'flex';
            }
            
            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
        }
    }

    showSidebarIfHidden() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        
        if (sidebar.classList.contains('collapsed')) {
            // Show sidebar and splitter
            sidebar.classList.remove('collapsed');
            horizontalSplitter.classList.remove('hidden');
            mainContent.classList.remove('sidebar-collapsed');
            
            // Update splitter toggle button
            if (splitterToggleBtn) {
                splitterToggleBtn.classList.remove('collapsed');
                splitterToggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                splitterToggleBtn.title = 'Hide Sidebar';
            }
            
            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
        }
    }

    showAllPanels() {
        const panels = document.querySelectorAll('.sidebar-section');
        panels.forEach(panel => {
            panel.style.display = 'block';
        });
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
                    <strong>Sequences:</strong> ${Object.keys(this.currentSequence || {}).length}
                </div>
            `;
        } else {
            fileInfo.innerHTML = '<p class="no-file">No file loaded</p>';
        }
    }

    hideWelcomeScreen() {
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }

    updateStatus(message) {
        document.getElementById('statusText').textContent = message;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    displaySequence(chromosome, sequence) {
        const container = document.getElementById('sequenceContent');
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
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

    createGCContentVisualization(sequence) {
        const gcDisplay = document.createElement('div');
        gcDisplay.className = 'gc-content-display';
        gcDisplay.style.position = 'relative';
        gcDisplay.style.height = '60px';
        gcDisplay.style.background = 'rgba(255, 255, 255, 0.1)';
        gcDisplay.style.border = '1px solid rgba(0, 0, 0, 0.1)';
        gcDisplay.style.borderRadius = '4px';
        
        const windowSize = Math.max(10, Math.floor(sequence.length / 50));
        
        for (let i = 0; i < sequence.length - windowSize; i += windowSize) {
            const window = sequence.substring(i, i + windowSize);
            const gcCount = (window.match(/[GC]/g) || []).length;
            const gcPercent = (gcCount / windowSize) * 100;
            
            const bar = document.createElement('div');
            bar.className = 'gc-bar';
            bar.style.position = 'absolute';
            bar.style.left = `${(i / sequence.length) * 100}%`;
            bar.style.width = `${(windowSize / sequence.length) * 100}%`;
            bar.style.height = `${(gcPercent / 100) * 50}px`;
            bar.style.bottom = '5px';
            bar.style.background = `hsl(${120 - (gcPercent * 1.2)}, 70%, 50%)`;
            bar.style.borderRadius = '2px';
            bar.title = `GC Content: ${gcPercent.toFixed(1)}%`;
            
            gcDisplay.appendChild(bar);
        }
        
        return gcDisplay;
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

    // Navigation methods
    navigatePrevious() {
        const range = this.currentPosition.end - this.currentPosition.start;
        const newStart = Math.max(0, this.currentPosition.start - range);
        const newEnd = newStart + range;
        
        this.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.updateStatistics(currentChr, this.currentSequence[currentChr]);
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    navigateNext() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) return;
        
        const sequence = this.currentSequence[currentChr];
        const range = this.currentPosition.end - this.currentPosition.start;
        const newStart = this.currentPosition.start + range;
        const newEnd = Math.min(sequence.length, newStart + range);
        
        if (newStart < sequence.length) {
            this.currentPosition = { start: newStart, end: newEnd };
            this.updateStatistics(currentChr, sequence);
            this.displayGenomeView(currentChr, sequence);
        }
    }

    // Zoom methods
    zoomIn() {
        const currentRange = this.currentPosition.end - this.currentPosition.start;
        const newRange = Math.max(100, Math.floor(currentRange / 2));
        const center = Math.floor((this.currentPosition.start + this.currentPosition.end) / 2);
        const newStart = Math.max(0, center - Math.floor(newRange / 2));
        const newEnd = newStart + newRange;
        
        this.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.updateStatistics(currentChr, this.currentSequence[currentChr]);
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    zoomOut() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) return;
        
        const sequence = this.currentSequence[currentChr];
        const currentRange = this.currentPosition.end - this.currentPosition.start;
        const newRange = Math.min(sequence.length, currentRange * 2);
        const center = Math.floor((this.currentPosition.start + this.currentPosition.end) / 2);
        const newStart = Math.max(0, center - Math.floor(newRange / 2));
        const newEnd = Math.min(sequence.length, newStart + newRange);
        
        this.currentPosition = { start: newStart, end: newEnd };
        this.updateStatistics(currentChr, sequence);
        this.displayGenomeView(currentChr, sequence);
    }

    resetZoom() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) return;
        
        const sequence = this.currentSequence[currentChr];
        this.currentPosition = { start: 0, end: Math.min(10000, sequence.length) };
        this.updateStatistics(currentChr, sequence);
        this.displayGenomeView(currentChr, sequence);
    }

    // Search and navigation methods
    showSearchModal() {
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('modalSearchInput').focus();
        }
    }

    showGotoModal() {
        const modal = document.getElementById('gotoModal');
        if (modal) {
            modal.classList.add('show');
            document.getElementById('modalPositionInput').focus();
        }
    }

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
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            alert('Please select a chromosome first');
            return;
        }
        
        const sequence = this.currentSequence[currentChr];
        let start, end;
        
        // Parse different formats: "1000", "1000-2000", "chr1:1000-2000"
        if (input.includes(':')) {
            const [chr, range] = input.split(':');
            if (range.includes('-')) {
                const [s, e] = range.split('-');
                start = parseInt(s) - 1; // Convert to 0-based
                end = parseInt(e);
            } else {
                start = parseInt(range) - 1;
                end = start + 1000;
            }
        } else if (input.includes('-')) {
            const [s, e] = input.split('-');
            start = parseInt(s) - 1;
            end = parseInt(e);
        } else {
            start = parseInt(input) - 1;
            end = start + 1000;
        }
        
        // Validate and adjust bounds
        start = Math.max(0, start);
        end = Math.min(sequence.length, end);
        
        if (start >= end) {
            alert('Invalid position range');
            return;
        }
        
        this.currentPosition = { start, end };
        this.updateStatistics(currentChr, sequence);
        this.displayGenomeView(currentChr, sequence);
    }

    quickSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (query) {
            this.performSearch(query);
        }
    }

    performSearch(query = null) {
        const searchQuery = query || document.getElementById('modalSearchInput').value.trim();
        if (!searchQuery) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            alert('Please select a chromosome first');
            return;
        }
        
        const sequence = this.currentSequence[currentChr];
        const caseSensitive = document.getElementById('caseSensitive')?.checked || false;
        const includeReverseComplement = document.getElementById('reverseComplement')?.checked || false;
        
        // Prepare search query based on case sensitivity
        const searchTerm = caseSensitive ? searchQuery : searchQuery.toUpperCase();
        const sequenceToSearch = caseSensitive ? sequence : sequence.toUpperCase();
        
        const results = [];
        
        // 1. Search for gene names in annotations
        if (this.currentAnnotations && this.currentAnnotations[currentChr]) {
            const annotations = this.currentAnnotations[currentChr];
            
            annotations.forEach(annotation => {
                if (annotation.qualifiers) {
                    // Search in gene names
                    const geneName = annotation.qualifiers.gene || '';
                    const locusTag = annotation.qualifiers.locus_tag || '';
                    const product = annotation.qualifiers.product || '';
                    const note = annotation.qualifiers.note || '';
                    
                    const searchFields = [geneName, locusTag, product, note].join(' ');
                    const fieldToSearch = caseSensitive ? searchFields : searchFields.toUpperCase();
                    
                    if (fieldToSearch.includes(searchTerm)) {
                        results.push({
                            type: 'gene',
                            position: annotation.start,
                            end: annotation.end,
                            name: geneName || locusTag || annotation.type,
                            details: `${annotation.type}: ${product || 'No description'}`,
                            annotation: annotation
                        });
                    }
                }
            });
        }
        
        // 2. Search for exact sequence matches
        if (searchTerm.match(/^[ATGCN]+$/i)) { // Only search if it looks like a DNA sequence
            let index = sequenceToSearch.indexOf(searchTerm);
            while (index !== -1) {
                results.push({
                    type: 'sequence',
                    position: index,
                    end: index + searchTerm.length,
                    name: `Sequence match`,
                    details: `Found "${searchQuery}" at position ${index + 1}`
                });
                index = sequenceToSearch.indexOf(searchTerm, index + 1);
            }
            
            // 3. Search for reverse complement if requested
            if (includeReverseComplement && searchTerm.match(/^[ATGC]+$/i)) {
                const reverseComplement = this.getReverseComplement(searchTerm);
                const rcToSearch = caseSensitive ? reverseComplement : reverseComplement.toUpperCase();
                
                let rcIndex = sequenceToSearch.indexOf(rcToSearch);
                while (rcIndex !== -1) {
                    results.push({
                        type: 'sequence',
                        position: rcIndex,
                        end: rcIndex + rcToSearch.length,
                        name: `Reverse complement match`,
                        details: `Found reverse complement "${reverseComplement}" at position ${rcIndex + 1}`
                    });
                    rcIndex = sequenceToSearch.indexOf(rcToSearch, rcIndex + 1);
                }
            }
        }
        
        // Sort results by position
        results.sort((a, b) => a.position - b.position);
        
        if (results.length > 0) {
            // Store results for navigation
            this.searchResults = results;
            this.currentSearchIndex = 0;
            
            // Populate search results panel
            this.populateSearchResults(results, searchQuery);
            
            // Navigate to first result automatically
            this.navigateToSearchResult(0);
            
            // Show brief success message
            this.updateStatus(`Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"`);
        } else {
            let searchInfo = `No matches found for "${searchQuery}"`;
            if (includeReverseComplement && searchQuery.match(/^[ATGC]+$/i)) {
                const rc = this.getReverseComplement(searchQuery);
                searchInfo += ` (also searched for reverse complement: "${rc}")`;
            }
            this.updateStatus(searchInfo);
        }
        
        // Close modal if it was opened
        const modal = document.getElementById('searchModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    copySequence() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            alert('No sequence to copy');
            return;
        }
        
        const sequence = this.currentSequence[currentChr];
        const subsequence = sequence.substring(this.currentPosition.start, this.currentPosition.end);
        
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
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            alert('No sequence to export');
            return;
        }
        
        const sequence = this.currentSequence[currentChr];
        const subsequence = sequence.substring(this.currentPosition.start, this.currentPosition.end);
        
        const fastaContent = `>${currentChr}:${this.currentPosition.start + 1}-${this.currentPosition.end}\n${subsequence}`;
        
        const blob = new Blob([fastaContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentChr}_${this.currentPosition.start + 1}-${this.currentPosition.end}.fasta`;
        a.click();
        URL.revokeObjectURL(url);
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
        
        this.currentVariants = variants;
        this.updateStatus(`Loaded VCF file with variants for ${Object.keys(variants).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
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
        
        this.currentReads = reads;
        this.updateStatus(`Loaded SAM file with reads for ${Object.keys(reads).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
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
        
        this.currentAnnotations = annotations;
        this.updateStatus(`Loaded GFF file with annotations for ${Object.keys(annotations).length} sequence(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
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
        
        this.currentAnnotations = annotations;
        this.updateStatus(`Loaded BED file with features for ${Object.keys(annotations).length} chromosome(s)`);
        
        // If we already have sequence data, refresh the view
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    // Initialize horizontal splitter functionality
    initializeHorizontalSplitter() {
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const sidebar = document.getElementById('sidebar');
        const viewerContainer = document.getElementById('viewerContainer');
        const mainContent = document.querySelector('.main-content');
        
        if (!horizontalSplitter || !sidebar || !viewerContainer || !mainContent) {
            console.warn('Horizontal splitter elements not found, skipping initialization');
            return;
        }
        
        let isResizing = false;
        let startX = 0;
        let startSidebarWidth = 0;
        
        // Mouse events for dragging
        horizontalSplitter.addEventListener('mousedown', (e) => {
            // Don't start resizing if clicking on the toggle button
            if (e.target.closest('.splitter-toggle-btn')) {
                return;
            }
            
            isResizing = true;
            startX = e.clientX;
            startSidebarWidth = sidebar.offsetWidth;
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            horizontalSplitter.classList.add('active');
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const newSidebarWidth = startSidebarWidth + deltaX;
            
            // Set minimum and maximum widths
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.5; // Max 50% of window width
            
            if (newSidebarWidth >= minWidth && newSidebarWidth <= maxWidth) {
                sidebar.style.width = `${newSidebarWidth}px`;
                sidebar.style.flex = 'none';
                
                // Ensure sidebar is visible when resizing
                if (sidebar.classList.contains('collapsed')) {
                    this.showSidebarIfHidden();
                }
            }
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                horizontalSplitter.classList.remove('active');
                
                // Update toggle button state after resize
                this.updateToggleButtonStates();
            }
        });
        
        // Keyboard accessibility
        horizontalSplitter.setAttribute('tabindex', '0');
        horizontalSplitter.setAttribute('role', 'separator');
        horizontalSplitter.setAttribute('aria-label', 'Resize sidebar');
        
        horizontalSplitter.addEventListener('keydown', (e) => {
            const step = 20; // pixels to move per keypress
            let deltaX = 0;
            
            switch(e.key) {
                case 'ArrowLeft':
                    deltaX = -step;
                    break;
                case 'ArrowRight':
                    deltaX = step;
                    break;
                case 'Home':
                    // Reset to default width
                    sidebar.style.width = '280px';
                    sidebar.style.flex = 'none';
                    this.showSidebarIfHidden();
                    this.updateToggleButtonStates();
                    e.preventDefault();
                    return;
                default:
                    return;
            }
            
            e.preventDefault();
            
            // Apply keyboard movement
            const currentWidth = sidebar.offsetWidth;
            const newWidth = currentWidth + deltaX;
            
            const minWidth = 200;
            const maxWidth = window.innerWidth * 0.5;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebar.style.width = `${newWidth}px`;
                sidebar.style.flex = 'none';
                
                // Ensure sidebar is visible when resizing
                if (sidebar.classList.contains('collapsed')) {
                    this.showSidebarIfHidden();
                }
                this.updateToggleButtonStates();
            }
        });
        
        // Double-click to reset to default width
        horizontalSplitter.addEventListener('dblclick', () => {
            sidebar.style.width = '280px';
            sidebar.style.flex = 'none';
            this.showSidebarIfHidden();
            this.updateToggleButtonStates();
        });
    }

    updateToggleButtonStates() {
        const sidebar = document.getElementById('sidebar');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        const floatingToggleBtn = document.getElementById('floatingToggleBtn');
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        
        const isCollapsed = sidebar.classList.contains('collapsed');
        
        // Update splitter toggle button
        if (splitterToggleBtn) {
            if (isCollapsed) {
                splitterToggleBtn.classList.add('collapsed');
                splitterToggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                splitterToggleBtn.title = 'Show Sidebar';
            } else {
                splitterToggleBtn.classList.remove('collapsed');
                splitterToggleBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                splitterToggleBtn.title = 'Hide Sidebar';
            }
        }
        
        // Update floating toggle button
        if (floatingToggleBtn) {
            floatingToggleBtn.style.display = isCollapsed ? 'flex' : 'none';
        }
        
        // Update toolbar toggle button
        if (toggleSidebarBtn) {
            if (isCollapsed) {
                toggleSidebarBtn.classList.add('active');
                toggleSidebarBtn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                toggleSidebarBtn.classList.remove('active');
                toggleSidebarBtn.innerHTML = '<i class="fas fa-sidebar"></i>';
            }
        }
    }

    toggleSidebarFromSplitter() {
        this.toggleSidebar();
    }

    // Make track content draggable for navigation
    makeDraggable(element, chromosome) {
        let isDragging = false;
        let startX = 0;
        let startPosition = 0;
        let dragThreshold = 5; // Minimum pixels to move before considering it a drag
        let hasDragged = false;
        let lastUpdateX = 0; // Track last update position to prevent excessive updates
        
        element.style.cursor = 'grab';
        element.title = 'Drag left or right to navigate through the genome\nKeyboard: ← → arrows, Home, End';
        
        const handleMouseDown = (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;
            
            // Don't start dragging if a splitter is being resized
            if (document.body.hasAttribute('data-splitter-resizing')) return;
            
            isDragging = true;
            hasDragged = false;
            startX = e.clientX;
            lastUpdateX = e.clientX;
            startPosition = this.currentPosition.start;
            element.style.cursor = 'grabbing';
            element.classList.add('dragging');
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };
        
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            
            // Don't update if a splitter is being resized
            if (document.body.hasAttribute('data-splitter-resizing')) return;
            
            const deltaX = e.clientX - startX;
            
            // Check if we've moved enough to consider this a drag
            if (Math.abs(deltaX) > dragThreshold) {
                hasDragged = true;
            }
            
            if (!hasDragged) return;
            
            // Only update if mouse moved significantly since last update
            const deltaFromLastUpdate = Math.abs(e.clientX - lastUpdateX);
            if (deltaFromLastUpdate < 3) return; // Reduce update frequency
            
            lastUpdateX = e.clientX;
            
            // Calculate movement with much more conservative approach
            const currentRange = this.currentPosition.end - this.currentPosition.start;
            const elementWidth = element.offsetWidth || 800; // fallback width
            const sequence = this.currentSequence[chromosome];
            
            // Calculate how much of the genome each pixel represents
            // Use a much smaller sensitivity factor for fine control
            const genomeFraction = currentRange / sequence.length; // What fraction of genome is currently visible
            const pixelMovement = deltaX; // Total pixel movement from start
            
            // Convert pixel movement to genome position change
            // Use a very conservative multiplier to prevent jumping
            const movementFactor = 1.50; // Increased from 0.05 for better responsiveness
            const positionChange = Math.round(pixelMovement * currentRange * movementFactor / elementWidth);
            
            // Calculate new position (drag right = move left in genome, drag left = move right)
            const newStart = Math.max(0, Math.min(
                sequence.length - currentRange,
                startPosition - positionChange
            ));
            const newEnd = newStart + currentRange;
            
            // Only update if position actually changed
            if (newStart !== this.currentPosition.start) {
                this.currentPosition = { start: newStart, end: newEnd };
                
                // Throttle updates for better performance
                if (!this.dragUpdateTimeout) {
                    this.dragUpdateTimeout = setTimeout(() => {
                        this.updateStatistics(chromosome, sequence);
                        this.displayGenomeView(chromosome, sequence);
                        this.dragUpdateTimeout = null;
                    }, 32); // Reduced frequency for smoother performance
                }
            }
        };
        
        const handleMouseUp = (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            element.style.cursor = 'grab';
            element.classList.remove('dragging');
            document.body.style.userSelect = '';
            
            // If we didn't drag much, allow click events to propagate
            if (!hasDragged) {
                // Let click events on gene elements work normally
                return;
            }
            
            // Final update after drag ends
            if (this.dragUpdateTimeout) {
                clearTimeout(this.dragUpdateTimeout);
                this.dragUpdateTimeout = null;
            }
            
            const sequence = this.currentSequence[chromosome];
            this.updateStatistics(chromosome, sequence);
            this.displayGenomeView(chromosome, sequence);
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const handleMouseLeave = () => {
            if (isDragging) {
                handleMouseUp();
            }
        };
        
        // Add event listeners
        element.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        element.addEventListener('mouseleave', handleMouseLeave);
        
        // Add keyboard navigation
        element.setAttribute('tabindex', '0');
        element.addEventListener('keydown', (e) => {
            const sequence = this.currentSequence[chromosome];
            const currentRange = this.currentPosition.end - this.currentPosition.start;
            const step = Math.max(1, Math.floor(currentRange * 0.1)); // 10% of current view
            
            let newStart = this.currentPosition.start;
            
            switch(e.key) {
                case 'ArrowLeft':
                    newStart = Math.max(0, this.currentPosition.start - step);
                    break;
                case 'ArrowRight':
                    newStart = Math.min(sequence.length - currentRange, this.currentPosition.start + step);
                    break;
                case 'Home':
                    newStart = 0;
                    break;
                case 'End':
                    newStart = Math.max(0, sequence.length - currentRange);
                    break;
                default:
                    return; // Don't prevent default for other keys
            }
            
            e.preventDefault();
            
            const newEnd = newStart + currentRange;
            this.currentPosition = { start: newStart, end: newEnd };
            this.updateStatistics(chromosome, sequence);
            this.displayGenomeView(chromosome, sequence);
        });
        
        // Store cleanup function for later removal if needed
        element._dragCleanup = () => {
            element.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            element.removeEventListener('mouseleave', handleMouseLeave);
        };
    }

    // Create a resizable splitter between tracks
    createTrackSplitter(topTrackType, bottomTrackType) {
        const splitter = document.createElement('div');
        splitter.className = 'track-splitter';
        splitter.setAttribute('data-top-track', topTrackType);
        splitter.setAttribute('data-bottom-track', bottomTrackType);
        
        // Add visual indicator
        const handle = document.createElement('div');
        handle.className = 'track-splitter-handle';
        handle.innerHTML = '⋯';
        splitter.appendChild(handle);
        
        // Add resize functionality
        this.makeTrackSplitterResizable(splitter);
        
        return splitter;
    }

    // Make track splitter resizable
    makeTrackSplitterResizable(splitter) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;
        let topTrack = null;
        let bottomTrack = null;
        let currentDeltaY = 0; // Track the current delta for visual feedback
        
        // Add unique identifier for this splitter's auto-adjust setting
        const splitterId = `${splitter.getAttribute('data-top-track')}-${splitter.getAttribute('data-bottom-track')}`;
        
        const startResize = (e) => {
            isResizing = true;
            startY = e.clientY || e.touches[0].clientY;
            currentDeltaY = 0;
            
            // Set a global flag to prevent track content dragging during splitter resize
            document.body.setAttribute('data-splitter-resizing', 'true');
            
            // Find the tracks above and below this splitter
            topTrack = splitter.previousElementSibling;
            bottomTrack = splitter.nextElementSibling;
            
            if (topTrack && bottomTrack) {
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    startTopHeight = topContent.offsetHeight;
                    startBottomHeight = bottomContent.offsetHeight;
                }
            }
            
            splitter.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };
        
        const doResize = (e) => {
            if (!isResizing || !topTrack || !bottomTrack) return;
            
            const currentY = e.clientY || e.touches[0].clientY;
            currentDeltaY = currentY - startY;
            
            // Only provide visual feedback by moving the splitter position
            // Do NOT change track heights during dragging
            splitter.style.transform = `translateY(${currentDeltaY}px)`;
            
            e.preventDefault();
        };
        
        const stopResize = () => {
            if (!isResizing) return;
            
            isResizing = false;
            splitter.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Remove the global flag to allow track content dragging again
            document.body.removeAttribute('data-splitter-resizing');
            
            // Reset splitter visual position
            splitter.style.transform = '';
            
            // NOW apply the height changes based on the final delta
            if (topTrack && bottomTrack && Math.abs(currentDeltaY) > 5) { // Only apply if meaningful drag
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    const newTopHeight = Math.max(30, startTopHeight + currentDeltaY);
                    const newBottomHeight = Math.max(30, startBottomHeight - currentDeltaY);
                    
                    topContent.style.height = `${newTopHeight}px`;
                    bottomContent.style.height = `${newBottomHeight}px`;
                }
            }
            
            topTrack = null;
            bottomTrack = null;
            currentDeltaY = 0;
        };
        
        // Improved auto-adjust height calculation - only triggered on double-click
        const autoAdjustHeight = () => {
            const topTrack = splitter.previousElementSibling;
            const bottomTrack = splitter.nextElementSibling;
            
            if (topTrack && bottomTrack) {
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    // Add visual feedback
                    splitter.classList.add('auto-adjusting');
                    
                    // Calculate optimal height for top track based on its content
                    let optimalHeight = 80; // Increased default minimum
                    
                    // Get track type from data attributes
                    const topTrackType = splitter.getAttribute('data-top-track');
                    
                    switch (topTrackType) {
                        case 'genes':
                            // For gene tracks, calculate based on number of rows needed
                            const geneElements = topContent.querySelectorAll('.gene-element');
                            if (geneElements.length > 0) {
                                // Find the maximum row (top position) used and add element height
                                let maxRow = 0;
                                let elementHeight = 23; // Default gene element height
                                geneElements.forEach(gene => {
                                    const top = parseInt(gene.style.top) || 0;
                                    const height = parseInt(gene.style.height) || elementHeight;
                                    maxRow = Math.max(maxRow, top + height);
                                });
                                optimalHeight = Math.max(100, maxRow + 60); // Increased padding
                            } else {
                                optimalHeight = 100; // Default for empty gene tracks
                            }
                            break;
                        case 'reads':
                            // For reads tracks, calculate based on number of rows
                            const readElements = topContent.querySelectorAll('.read-element');
                            if (readElements.length > 0) {
                                let maxRow = 0;
                                let elementHeight = 12; // Default read element height
                                readElements.forEach(read => {
                                    const top = parseInt(read.style.top) || 0;
                                    const height = parseInt(read.style.height) || elementHeight;
                                    maxRow = Math.max(maxRow, top + height);
                                });
                                optimalHeight = Math.max(80, maxRow + 40); // Increased padding
                            } else {
                                optimalHeight = 80; // Default for empty reads tracks
                            }
                            break;
                        case 'gc':
                            optimalHeight = 100; // Increased height for GC content
                            break;
                        case 'variants':
                            const variantElements = topContent.querySelectorAll('.variant-element');
                            if (variantElements.length > 0) {
                                optimalHeight = 80; // Good height for variants with data
                            } else {
                                optimalHeight = 60; // Smaller for empty variant tracks
                            }
                            break;
                        case 'proteins':
                            const proteinElements = topContent.querySelectorAll('.protein-element');
                            if (proteinElements.length > 0) {
                                let maxRow = 0;
                                let elementHeight = 21; // Default protein element height
                                proteinElements.forEach(protein => {
                                    const top = parseInt(protein.style.top) || 0;
                                    const height = parseInt(protein.style.height) || elementHeight;
                                    maxRow = Math.max(maxRow, top + height);
                                });
                                optimalHeight = Math.max(90, maxRow + 50); // Increased padding
                            } else {
                                optimalHeight = 90; // Default for empty protein tracks
                            }
                            break;
                        default:
                            optimalHeight = 80; // Increased default
                    }
                    
                    // Apply the optimal height with smooth transition
                    topContent.style.transition = 'height 0.3s ease';
                    topContent.style.height = `${optimalHeight}px`;
                    
                    // Remove transition and animation classes after animation completes
                    setTimeout(() => {
                        topContent.style.transition = '';
                        splitter.classList.remove('auto-adjusting');
                    }, 300);
                    
                    console.log(`Auto-adjusted ${topTrackType} track to ${optimalHeight}px for splitter ${splitterId}`);
                }
            }
        };
        
        // Mouse events
        splitter.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        // Touch events for mobile
        splitter.addEventListener('touchstart', startResize);
        document.addEventListener('touchmove', doResize);
        document.addEventListener('touchend', stopResize);
        
        // Double-click for auto-adjust - this is the ONLY way to trigger auto-adjust
        splitter.addEventListener('dblclick', autoAdjustHeight);
        
        // Keyboard accessibility
        splitter.setAttribute('tabindex', '0');
        splitter.setAttribute('role', 'separator');
        splitter.setAttribute('aria-label', 'Resize tracks (double-click to auto-adjust)');
        
        splitter.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                const topContent = splitter.previousElementSibling?.querySelector('.track-content');
                const bottomContent = splitter.nextElementSibling?.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    const delta = e.key === 'ArrowUp' ? -10 : 10;
                    const currentTopHeight = topContent.offsetHeight;
                    const currentBottomHeight = bottomContent.offsetHeight;
                    
                    const newTopHeight = Math.max(30, currentTopHeight + delta);
                    const newBottomHeight = Math.max(30, currentBottomHeight - delta);
                    
                    topContent.style.height = `${newTopHeight}px`;
                    bottomContent.style.height = `${newBottomHeight}px`;
                }
                
                e.preventDefault();
            } else if (e.key === 'Enter' || e.key === ' ') {
                // Auto-adjust on Enter or Space - separate trigger from manual resizing
                autoAdjustHeight();
                e.preventDefault();
            }
        });
    }

    toggleSequencePanel() {
        const sequenceContent = document.getElementById('sequenceContent');
        const toggleButton = document.getElementById('toggleSequencePanel');
        const splitter = document.getElementById('splitter');
        const sequenceSection = document.getElementById('sequenceDisplaySection');
        
        if (sequenceContent.style.display === 'none') {
            // Show sequence content
            sequenceContent.style.display = 'flex';
            toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
            toggleButton.title = 'Hide Sequence Panel';
            
            // Restore splitter functionality
            splitter.style.display = 'flex';
            
            // Restore section height
            sequenceSection.style.minHeight = '200px';
            sequenceSection.style.maxHeight = '60vh';
        } else {
            // Hide sequence content
            sequenceContent.style.display = 'none';
            toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
            toggleButton.title = 'Show Sequence Panel';
            
            // Hide splitter when content is hidden
            splitter.style.display = 'none';
            
            // Minimize section height to just show header
            sequenceSection.style.minHeight = 'auto';
            sequenceSection.style.maxHeight = 'auto';
            
            // Reset genome section to take full space
            const genomeSection = document.getElementById('genomeViewerSection');
            genomeSection.style.flex = '1';
            genomeSection.style.height = 'auto';
        }
        
        // Trigger resize event for layout adjustment
        window.dispatchEvent(new Event('resize'));
    }

    // Populate the search results panel
    populateSearchResults(results, searchQuery) {
        const searchResultsSection = document.getElementById('searchResultsSection');
        const searchResultsList = document.getElementById('searchResultsList');
        
        if (results.length === 0) {
            searchResultsList.innerHTML = '<p class="no-results">No search results</p>';
            searchResultsSection.style.display = 'none';
            return;
        }
        
        // Show the search results panel at the top
        searchResultsSection.style.display = 'block';
        
        // Create header
        let html = `<div class="search-results-header">Found ${results.length} match${results.length > 1 ? 'es' : ''} for "${searchQuery}"</div>`;
        
        // Create result items
        results.forEach((result, index) => {
            html += `
                <div class="search-result-item" data-index="${index}">
                    <div class="search-result-header">
                        <span class="search-result-name">${result.name}</span>
                        <span class="search-result-type ${result.type}">${result.type}</span>
                    </div>
                    <div class="search-result-position">Position: ${result.position + 1}-${result.end}</div>
                    <div class="search-result-details">${result.details}</div>
                </div>
            `;
        });
        
        searchResultsList.innerHTML = html;
        
        // Add click handlers for navigation
        searchResultsList.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                this.navigateToSearchResult(index);
                
                // Highlight selected result
                searchResultsList.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
                e.currentTarget.classList.add('selected');
            });
        });
        
        // Highlight first result as selected
        const firstItem = searchResultsList.querySelector('.search-result-item');
        if (firstItem) {
            firstItem.classList.add('selected');
        }
    }

    // Navigate to a specific search result
    navigateToSearchResult(index) {
        if (!this.searchResults || index < 0 || index >= this.searchResults.length) return;
        
        const result = this.searchResults[index];
        const currentChr = document.getElementById('chromosomeSelect').value;
        const sequence = this.currentSequence[currentChr];
        
        // Calculate view range with context
        const start = Math.max(0, result.position - 500);
        const end = Math.min(sequence.length, result.end + 500);
        
        this.currentPosition = { start, end };
        this.updateStatistics(currentChr, sequence);
        this.displayGenomeView(currentChr, sequence);
        
        this.currentSearchIndex = index;
        
        // Update status
        this.updateStatus(`Showing result ${index + 1} of ${this.searchResults.length}: ${result.name}`);
    }
}

// Initialize the genome browser when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genomeBrowser = new GenomeBrowser();
}); 