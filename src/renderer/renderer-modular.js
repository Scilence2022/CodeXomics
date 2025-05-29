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
        
        // Operon color assignment
        this.operonColors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', 
            '#1abc9c', '#e67e22', '#34495e', '#f1c40f', '#e91e63',
            '#8e44ad', '#16a085', '#27ae60', '#2980b9', '#d35400',
            '#c0392b', '#7f8c8d', '#f39c12', '#8e44ad', '#2c3e50'
        ];
        this.operonAssignments = new Map(); // Map operon names to color indices
        this.nextColorIndex = 0;
        
        // Initialize modules
        this.fileManager = new FileManager(this);
        this.trackRenderer = new TrackRenderer(this);
        this.navigationManager = new NavigationManager(this);
        this.uiManager = new UIManager(this);
        this.sequenceUtils = new SequenceUtils(this);
        this.exportManager = new ExportManager(this);
        
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

        // Export operations - dropdown menu
        document.getElementById('exportFileBtn').addEventListener('click', () => this.uiManager.toggleExportDropdown());
        document.getElementById('exportFastaBtn').addEventListener('click', () => this.exportManager.exportAsFasta());
        document.getElementById('exportGenbankBtn').addEventListener('click', () => this.exportManager.exportAsGenBank());
        document.getElementById('exportCDSFastaBtn').addEventListener('click', () => this.exportManager.exportCDSAsFasta());
        document.getElementById('exportProteinFastaBtn').addEventListener('click', () => this.exportManager.exportProteinAsFasta());
        document.getElementById('exportGFFBtn').addEventListener('click', () => this.exportManager.exportAsGFF());
        document.getElementById('exportBEDBtn').addEventListener('click', () => this.exportManager.exportAsBED());
        document.getElementById('exportCurrentViewBtn').addEventListener('click', () => this.exportManager.exportCurrentViewAsFasta());

        // Welcome screen buttons
        document.getElementById('welcomeOpenGenomeBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('genome'));
        document.getElementById('welcomeOpenAnnotationBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('annotation'));
        document.getElementById('welcomeOpenVariantBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('variant'));
        document.getElementById('welcomeOpenReadsBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('reads'));

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.file-menu-container')) {
                this.uiManager.closeFileDropdown();
                this.uiManager.closeExportDropdown();
            }
            
            // Auto-hide toggle panels when clicking outside
            if (!e.target.closest('#toggleTracks') && !e.target.closest('#trackCheckboxes')) {
                this.uiManager.hideTracksPanel();
            }
            
            if (!e.target.closest('#toggleFeatureFilters') && !e.target.closest('#featureFilterCheckboxes')) {
                this.uiManager.hideFeatureFiltersPanel();
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
        const ruler = this.trackRenderer.createRuler();
        browserContainer.appendChild(ruler);
        
        // Collect all tracks to be displayed
        const tracksToShow = [];
        
        // 1. Gene track (only if genes track is selected and annotations exist)
        if (this.visibleTracks.has('genes') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const geneTrack = this.trackRenderer.createGeneTrack(chromosome);
            tracksToShow.push({ element: geneTrack, type: 'genes' });
        }
        
        // 2. GC Content track (only if GC track is selected)
        if (this.visibleTracks.has('gc')) {
            const gcTrack = this.trackRenderer.createGCTrack(chromosome, sequence);
            tracksToShow.push({ element: gcTrack, type: 'gc' });
        }
        
        // 3. Variants track (show if selected, even without data)
        if (this.visibleTracks.has('variants')) {
            const variantTrack = this.trackRenderer.createVariantTrack(chromosome);
            tracksToShow.push({ element: variantTrack, type: 'variants' });
        }
        
        // 4. Aligned reads track (show if selected, even without data)
        if (this.visibleTracks.has('reads')) {
            const readsTrack = this.trackRenderer.createReadsTrack(chromosome);
            tracksToShow.push({ element: readsTrack, type: 'reads' });
        }
        
        // 5. Protein track (only if proteins track is selected and we have CDS annotations)
        if (this.visibleTracks.has('proteins') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
            const proteinTrack = this.trackRenderer.createProteinTrack(chromosome);
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
            this.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
        } else {
            // Hide sequence display if bottom sequence is not enabled
            document.getElementById('sequenceDisplay').style.display = 'none';
        }
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

    // Track management methods
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

    // Operon detection and color assignment methods
    detectOperons(annotations) {
        // Simple operon detection based on gene proximity and strand
        const operons = [];
        const genes = annotations.filter(feature => 
            ['CDS', 'mRNA', 'tRNA', 'rRNA'].includes(feature.type)
        ).sort((a, b) => a.start - b.start);

        if (genes.length === 0) return operons;

        let currentOperon = [genes[0]];
        const maxGap = 500; // Maximum gap between genes in an operon (bp)

        for (let i = 1; i < genes.length; i++) {
            const prevGene = genes[i - 1];
            const currentGene = genes[i];
            
            // Check if genes are close enough and on the same strand to be in the same operon
            const gap = currentGene.start - prevGene.end;
            const sameStrand = prevGene.strand === currentGene.strand;
            
            if (gap <= maxGap && sameStrand && gap >= 0) {
                currentOperon.push(currentGene);
            } else {
                // Finalize current operon if it has multiple genes
                if (currentOperon.length > 1) {
                    operons.push({
                        genes: [...currentOperon],
                        start: currentOperon[0].start,
                        end: currentOperon[currentOperon.length - 1].end,
                        strand: currentOperon[0].strand,
                        name: this.generateOperonName(currentOperon)
                    });
                }
                currentOperon = [currentGene];
            }
        }

        // Don't forget the last operon
        if (currentOperon.length > 1) {
            operons.push({
                genes: [...currentOperon],
                start: currentOperon[0].start,
                end: currentOperon[currentOperon.length - 1].end,
                strand: currentOperon[0].strand,
                name: this.generateOperonName(currentOperon)
            });
        }

        return operons;
    }

    generateOperonName(genes) {
        // Generate operon name based on first gene or common prefix
        const firstGene = genes[0];
        const geneName = firstGene.qualifiers.gene || firstGene.qualifiers.locus_tag || 'unknown';
        
        // Try to find common prefix among gene names
        const geneNames = genes.map(g => g.qualifiers.gene || g.qualifiers.locus_tag || '').filter(n => n);
        if (geneNames.length > 1) {
            const commonPrefix = this.findCommonPrefix(geneNames);
            if (commonPrefix.length > 2) {
                return `${commonPrefix}_operon`;
            }
        }
        
        return `${geneName}_operon`;
    }

    findCommonPrefix(strings) {
        if (strings.length === 0) return '';
        
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (strings[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }

    assignOperonColor(operonName) {
        if (!this.operonAssignments.has(operonName)) {
            this.operonAssignments.set(operonName, this.nextColorIndex);
            this.nextColorIndex = (this.nextColorIndex + 1) % this.operonColors.length;
        }
        return this.operonColors[this.operonAssignments.get(operonName)];
    }

    getGeneOperonInfo(gene, operons) {
        // Find which operon this gene belongs to
        for (const operon of operons) {
            if (operon.genes.some(g => g.start === gene.start && g.end === gene.end)) {
                return {
                    operonName: operon.name,
                    color: this.assignOperonColor(operon.name),
                    isInOperon: true
                };
            }
        }
        
        // Gene is not in an operon, assign individual color
        const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || `${gene.type}_${gene.start}`;
        return {
            operonName: geneName,
            color: this.assignOperonColor(geneName),
            isInOperon: false
        };
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