const { ipcRenderer } = require('electron');

/**
 * Main GenomeBrowser class - now modular and organized
 */
class GenomeBrowser {
    constructor() {
        // Core data
        this.currentSequence = {};
        this.currentAnnotations = {};
        this.currentVariants = {};
        this.currentReads = {};
        this.currentPosition = { start: 0, end: 10000 };
        this.zoomLevel = 1;
        
        // Default visible tracks - show Genes & Features, Sequence (top), and GC Content by default
        this.visibleTracks = new Set(['genes', 'sequence', 'gc']);
        
        // Separate control for bottom sequence display
        this.showBottomSequence = true;
        
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
        
        // Initialize modules
        this.fileManager = new FileManager(this);
        this.trackRenderer = new TrackRenderer(this);
        this.navigationManager = new NavigationManager(this);
        this.uiManager = new UIManager(this);
        this.sequenceUtils = new SequenceUtils(this);
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupIPC();
        this.updateStatus('Ready');
        
        // Initialize UI components
        this.uiManager.initializeSplitter();
        this.uiManager.initializeHorizontalSplitter();
        
        // Add window resize listener for responsive sequence display
        window.addEventListener('resize', () => {
            this.uiManager.handleWindowResize();
        });
    }

    setupEventListeners() {
        // File operations - dropdown menu
        document.getElementById('openFileBtn').addEventListener('click', () => this.uiManager.toggleFileDropdown());
        document.getElementById('openGenomeBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('genome'));
        document.getElementById('openAnnotationBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('annotation'));
        document.getElementById('openVariantBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('variant'));
        document.getElementById('openReadsBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('reads'));
        document.getElementById('openAnyBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('any'));

        // Welcome screen buttons
        document.getElementById('welcomeOpenGenomeBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('genome'));
        document.getElementById('welcomeOpenAnnotationBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('annotation'));
        document.getElementById('welcomeOpenVariantBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('variant'));
        document.getElementById('welcomeOpenReadsBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('reads'));

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.file-menu-container')) {
                this.uiManager.closeFileDropdown();
            }
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.navigationManager.showSearchModal());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigationManager.quickSearch();
        });

        // Position navigation
        document.getElementById('goToBtn').addEventListener('click', () => this.navigationManager.goToPosition());
        document.getElementById('positionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigationManager.goToPosition();
        });

        // Navigation controls (sidebar)
        document.getElementById('prevBtn').addEventListener('click', () => this.navigationManager.navigatePrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigationManager.navigateNext());

        // Navigation controls (genome view)
        document.getElementById('prevBtnGenome').addEventListener('click', () => this.navigationManager.navigatePrevious());
        document.getElementById('nextBtnGenome').addEventListener('click', () => this.navigationManager.navigateNext());

        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.navigationManager.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.navigationManager.zoomOut());
        document.getElementById('resetZoomBtn').addEventListener('click', () => this.navigationManager.resetZoom());

        // Sequence controls
        document.getElementById('copySequenceBtn').addEventListener('click', () => this.sequenceUtils.copySequence());
        document.getElementById('exportBtn').addEventListener('click', () => this.sequenceUtils.exportSequence());

        // Sequence panel toggle
        document.getElementById('toggleSequencePanel').addEventListener('click', () => this.uiManager.toggleSequencePanel());

        // Modal controls
        this.uiManager.setupModalControls();

        // Chromosome selection
        document.getElementById('chromosomeSelect').addEventListener('change', (e) => {
            this.sequenceUtils.selectChromosome(e.target.value);
        });

        // Track selection (toolbar checkboxes)
        document.getElementById('trackSequence').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGenes').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGC').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackVariants').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackReads').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackProteins').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackBottomSequence').addEventListener('change', () => this.updateBottomSequenceVisibility());

        // Sidebar track controls
        document.getElementById('sidebarTrackSequence').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
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
                this.uiManager.closePanel(panelId);
            });
        });

        // Feature filter toggle button
        document.getElementById('toggleFeatureFilters').addEventListener('click', () => {
            this.uiManager.toggleFeatureFilters();
        });

        // Setup feature filter event listeners
        this.setupFeatureFilterListeners();

        // Toggle buttons for toolbar sections
        document.getElementById('toggleTracks').addEventListener('click', () => {
            this.uiManager.toggleTracks();
        });
        
        // Sidebar toggle button
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.uiManager.toggleSidebar();
        });
        
        // Splitter toggle button
        document.getElementById('splitterToggleBtn').addEventListener('click', () => {
            this.uiManager.toggleSidebarFromSplitter();
        });
        
        // Floating toggle button
        document.getElementById('floatingToggleBtn').addEventListener('click', () => {
            this.uiManager.toggleSidebarFromSplitter();
        });
    }

    setupFeatureFilterListeners() {
        // Toolbar feature filter controls
        const toolbarFilters = [
            'showGenes', 'showCDS', 'showMRNA', 'showTRNA', 'showRRNA',
            'showPromoter', 'showTerminator', 'showRegulatory', 'showOther'
        ];
        
        const sidebarFilters = [
            'sidebarShowGenes', 'sidebarShowCDS', 'sidebarShowMRNA', 'sidebarShowTRNA', 'sidebarShowRRNA',
            'sidebarShowPromoter', 'sidebarShowTerminator', 'sidebarShowRegulatory', 'sidebarShowOther'
        ];

        // Map filter IDs to gene filter keys
        const filterMap = {
            'showGenes': 'genes', 'showCDS': 'CDS', 'showMRNA': 'mRNA', 'showTRNA': 'tRNA', 'showRRNA': 'rRNA',
            'showPromoter': 'promoter', 'showTerminator': 'terminator', 'showRegulatory': 'regulatory', 'showOther': 'other'
        };

        // Setup toolbar listeners
        toolbarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '')];
                this.geneFilters[filterKey] = e.target.checked;
                this.syncSidebarFeatureFilter(filterId.replace('show', 'sidebarShow'), e.target.checked);
                this.updateGeneDisplay();
            });
        });

        // Setup sidebar listeners
        sidebarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '').replace('Show', 'show')];
                this.geneFilters[filterKey] = e.target.checked;
                this.syncToolbarFeatureFilter(filterId.replace('sidebar', ''), e.target.checked);
                this.updateGeneDisplay();
            });
        });
    }

    setupIPC() {
        // Handle file opened from main process
        ipcRenderer.on('file-opened', (event, filePath) => {
            this.fileManager.loadFile(filePath);
        });

        // Handle menu actions
        ipcRenderer.on('show-search', () => {
            this.navigationManager.showSearchModal();
        });

        ipcRenderer.on('show-goto', () => {
            this.navigationManager.showGotoModal();
        });

        // Handle panel management
        ipcRenderer.on('show-panel', (event, panelId) => {
            this.uiManager.showPanel(panelId);
        });

        ipcRenderer.on('show-all-panels', () => {
            this.uiManager.showAllPanels();
        });
    }

    // Core genome display method
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
        const ruler = this.trackRenderer.createRuler();
        browserContainer.appendChild(ruler);
        
        // Create tracks in order for proper alignment
        // 1. Gene track (only if genes track is selected and annotations exist)
        if (this.visibleTracks.has('genes') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const geneTrack = this.trackRenderer.createGeneTrack(chromosome);
            browserContainer.appendChild(geneTrack);
        }
        
        // 2. Sequence track (only if sequence track is selected) - TOP sequence track
        if (this.visibleTracks.has('sequence')) {
            const sequenceTrack = this.trackRenderer.createSequenceTrack(chromosome, sequence);
            browserContainer.appendChild(sequenceTrack);
        }
        
        // 3. GC Content track (only if GC track is selected)
        if (this.visibleTracks.has('gc')) {
            const gcTrack = this.trackRenderer.createGCTrack(chromosome, sequence);
            browserContainer.appendChild(gcTrack);
        }
        
        // 4. Variants track (show if selected, even without data)
        if (this.visibleTracks.has('variants')) {
            const variantTrack = this.trackRenderer.createVariantTrack(chromosome);
            browserContainer.appendChild(variantTrack);
        }
        
        // 5. Aligned reads track (show if selected, even without data)
        if (this.visibleTracks.has('reads')) {
            const readsTrack = this.trackRenderer.createReadsTrack(chromosome);
            browserContainer.appendChild(readsTrack);
        }
        
        // 6. Protein track (only if proteins track is selected and we have CDS annotations)
        if (this.visibleTracks.has('proteins') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const proteinTrack = this.trackRenderer.createProteinTrack(chromosome);
            browserContainer.appendChild(proteinTrack);
        }
        
        container.appendChild(browserContainer);
        
        // Update BOTTOM sequence display - controlled separately
        if (this.showBottomSequence) {
            this.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
        } else {
            // Hide sequence display if bottom sequence is not enabled
            document.getElementById('sequenceDisplay').style.display = 'none';
        }
    }

    // Track management methods
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
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    updateBottomSequenceVisibility() {
        this.showBottomSequence = document.getElementById('trackBottomSequence').checked;
        
        // Sync with sidebar
        document.getElementById('sidebarTrackBottomSequence').checked = this.showBottomSequence;
        
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
            sequenceSection.style.display = 'none';
            splitter.style.display = 'none';
            
            // Reset genome section to take full space
            const genomeSection = document.getElementById('genomeViewerSection');
            genomeSection.style.flex = '1';
            genomeSection.style.height = 'auto';
        }
    }

    updateBottomSequenceVisibilityFromSidebar() {
        this.showBottomSequence = document.getElementById('sidebarTrackBottomSequence').checked;
        
        // Sync with toolbar
        document.getElementById('trackBottomSequence').checked = this.showBottomSequence;
        
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
            sequenceSection.style.display = 'none';
            splitter.style.display = 'none';
            
            // Reset genome section to take full space
            const genomeSection = document.getElementById('genomeViewerSection');
            genomeSection.style.flex = '1';
            genomeSection.style.height = 'auto';
        }
    }

    // Gene filter methods
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

    // Delegate methods to modules
    updateFileInfo() {
        this.fileManager.updateFileInfo();
    }

    hideWelcomeScreen() {
        this.uiManager.hideWelcomeScreen();
    }

    updateStatus(message) {
        this.uiManager.updateStatus(message);
    }

    showLoading(show) {
        this.uiManager.showLoading(show);
    }

    populateChromosomeSelect() {
        this.sequenceUtils.populateChromosomeSelect();
    }

    selectChromosome(chromosome) {
        this.sequenceUtils.selectChromosome(chromosome);
    }

    updateStatistics(chromosome, sequence) {
        this.sequenceUtils.updateStatistics(chromosome, sequence);
    }

    displayEnhancedSequence(chromosome, sequence) {
        this.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
    }

    translateDNA(dnaSequence, strand) {
        return this.sequenceUtils.translateDNA(dnaSequence, strand);
    }

    makeDraggable(element, chromosome) {
        this.navigationManager.makeDraggable(element, chromosome);
    }
}

// Initialize the genome browser when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genomeBrowser = new GenomeBrowser();
}); 