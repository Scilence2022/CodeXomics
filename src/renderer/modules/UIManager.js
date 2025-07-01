/**
 * UIManager - Handles all UI interactions, panels, splitters, and interface management
 */
class UIManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
    }

    // Panel management
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
            
            // Special handling for gene details panel
            if (panelId === 'geneDetailsSection') {
                this.genomeBrowser.clearGeneSelection();
            }
            
            // Special handling for read details panel
            if (panelId === 'readDetailsSection') {
                this.genomeBrowser.clearReadSelection();
            }
            
            // Special handling for search results panel
            if (panelId === 'searchResultsSection') {
                this.genomeBrowser.navigationManager.clearSearchResults();
                return; // Early return as clearSearchResults already handles display
            }
            
            // Check if all panels are closed and hide sidebar if so
            this.checkAndHideSidebarIfAllPanelsClosed();
        }
    }

    showAllPanels() {
        const panels = document.querySelectorAll('.sidebar-section');
        panels.forEach(panel => {
            panel.style.display = 'block';
        });
    }

    checkAndHideSidebarIfAllPanelsClosed() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        
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
            
            // Trigger resize event
            window.dispatchEvent(new Event('resize'));
        }
    }

    showSidebarIfHidden() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        
        // Check if sidebar is actually hidden (either by class or by width)
        const isHidden = sidebar.classList.contains('collapsed') || sidebar.offsetWidth === 0;
        
        if (isHidden) {
            // Show sidebar and splitter
            sidebar.classList.remove('collapsed');
            horizontalSplitter.classList.remove('hidden');
            mainContent.classList.remove('sidebar-collapsed');
            
            // Restore width if it was set to 0
            if (sidebar.style.width === '0px' || sidebar.offsetWidth === 0) {
                const previousWidth = sidebar.dataset.previousWidth || '280px';
                sidebar.style.width = previousWidth;
                sidebar.style.minWidth = '';
                sidebar.style.overflow = '';
                sidebar.style.flex = 'none';
            }
            
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

    // Toggle functionality
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const horizontalSplitter = document.getElementById('horizontalSplitter');
        const mainContent = document.querySelector('.main-content');
        
        // Check if sidebar is currently visible (either by class or by having a width)
        const isCurrentlyVisible = !sidebar.classList.contains('collapsed') && 
                                  sidebar.offsetWidth > 0;
        
        if (isCurrentlyVisible) {
            // Hide sidebar
            sidebar.classList.add('collapsed');
            horizontalSplitter.classList.add('hidden');
            mainContent.classList.add('sidebar-collapsed');
            
            // Store current width before hiding
            if (sidebar.style.width) {
                sidebar.dataset.previousWidth = sidebar.style.width;
            } else {
                sidebar.dataset.previousWidth = '280px'; // default width
            }
            
            // Set width to 0 to hide
            sidebar.style.width = '0px';
            sidebar.style.minWidth = '0px';
            sidebar.style.overflow = 'hidden';
        } else {
            // Show sidebar
            sidebar.classList.remove('collapsed');
            horizontalSplitter.classList.remove('hidden');
            mainContent.classList.remove('sidebar-collapsed');
            
            // Restore previous width or use default
            const previousWidth = sidebar.dataset.previousWidth || '280px';
            sidebar.style.width = previousWidth;
            sidebar.style.minWidth = '';
            sidebar.style.overflow = '';
            sidebar.style.flex = 'none';
        }
        
        // Update all toggle button states
        this.updateToggleButtonStates();
        
        // Trigger a resize event to ensure proper layout adjustment
        window.dispatchEvent(new Event('resize'));
    }

    toggleSidebarFromSplitter() {
        this.toggleSidebar();
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

    toggleSequencePanel() {
        const sequenceContent = document.getElementById('sequenceContent');
        const splitter = document.getElementById('splitter');
        const sequenceSection = document.getElementById('sequenceDisplaySection');
        
        if (sequenceContent.style.display === 'none') {
            // Show sequence content
            sequenceContent.style.display = 'flex';
            
            // Restore splitter functionality
            splitter.style.display = 'flex';
            
            // Restore section height
            sequenceSection.style.minHeight = '200px';
            sequenceSection.style.maxHeight = '60vh';
        } else {
            // Hide sequence content
            sequenceContent.style.display = 'none';
            
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

    updateToggleButtonStates() {
        const sidebar = document.getElementById('sidebar');
        const splitterToggleBtn = document.getElementById('splitterToggleBtn');
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        
        // Check if sidebar is actually collapsed (either by class or by width)
        const isCollapsed = sidebar.classList.contains('collapsed') || sidebar.offsetWidth === 0;
        
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

    // File dropdown management
    toggleFileDropdown() {
        const dropdown = document.getElementById('fileDropdownMenu');
        dropdown.classList.toggle('show');
    }

    closeFileDropdown() {
        const dropdown = document.getElementById('fileDropdownMenu');
        dropdown.classList.remove('show');
    }

    // Export dropdown management
    toggleExportDropdown() {
        const dropdown = document.getElementById('exportDropdownMenu');
        dropdown.classList.toggle('show');
    }

    closeExportDropdown() {
        const dropdown = document.getElementById('exportDropdownMenu');
        dropdown.classList.remove('show');
    }

    // Modal management
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
            this.genomeBrowser.navigationManager.performSearch();
        });

        // Modal goto
        document.getElementById('modalGotoBtn').addEventListener('click', () => {
            this.genomeBrowser.navigationManager.performGoto();
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

    // Splitter initialization
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
            const viewportHeight = window.innerHeight;
            
            // Calculate new heights
            const newGenomeHeight = startGenomeHeight + deltaY;
            const newSequenceHeight = startSequenceHeight - deltaY;
            
            // Set minimum heights and viewport-based maximums
            const minHeight = 150; // Reduced from 200 for more flexibility
            const maxSequenceHeight = Math.min(
                containerHeight - minHeight - splitterHeight,
                viewportHeight * 0.6  // Max 60% of viewport height
            );
            const maxGenomeHeight = containerHeight - minHeight - splitterHeight;
            
            // Ensure sequence window doesn't get too large
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
                    // Reset to default split - sequence gets reasonable height, genome gets the rest
                    const viewportHeight = window.innerHeight;
                    const defaultSequenceHeight = Math.min(250, viewportHeight * 0.3); // Max 30% of viewport or 250px
                    genomeSection.style.flex = '1';
                    genomeSection.style.height = 'auto';
                    sequenceSection.style.flex = 'none';
                    sequenceSection.style.height = `${defaultSequenceHeight}px`;
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
            const viewportHeight = window.innerHeight;
            
            const newGenomeHeight = currentGenomeHeight + deltaY;
            const newSequenceHeight = currentSequenceHeight - deltaY;
            
            const minHeight = 150; // Match mouse movement constraints
            const maxSequenceHeight = Math.min(
                containerHeight - minHeight - splitterHeight,
                viewportHeight * 0.6  // Max 60% of viewport height
            );
            const maxGenomeHeight = containerHeight - minHeight - splitterHeight;
            
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
            const viewportHeight = window.innerHeight;
            const defaultSequenceHeight = Math.min(250, viewportHeight * 0.3); // Max 30% of viewport or 250px
            genomeSection.style.flex = '1';
            genomeSection.style.height = 'auto';
            sequenceSection.style.flex = 'none';
            sequenceSection.style.height = `${defaultSequenceHeight}px`;
        });
    }

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
                
                // Update toggle button states during resize
                this.updateToggleButtonStates();
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

    // UI state management
    hideWelcomeScreen() {
        const welcomeScreen = document.querySelector('.welcome-screen');
        if (welcomeScreen) {
            welcomeScreen.style.display = 'none';
        }
    }

    updateStatus(message) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = message;
        } else {
            console.warn('Status element with id "statusText" not found. Status message:', message);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    handleWindowResize() {
        // Debounce resize events to avoid excessive refreshing
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            this.performWindowResize();
        }, 100); // Wait 100ms after resize stops
    }
    
    performWindowResize() {
        console.log('🔄 Handling window resize - using unified refresh');
        
        // Use the unified refresh function from TrackRenderer for consistency
        if (this.genomeBrowser.trackRenderer && this.genomeBrowser.trackRenderer.refreshViewAfterSettingsChange) {
            this.genomeBrowser.trackRenderer.refreshViewAfterSettingsChange();
        } else {
            // Fallback to original logic if unified function is not available
            console.log('⚠️ Unified refresh not available, using fallback logic');
            
            // Recalculate sequence display if visible
            const currentChr = document.getElementById('chromosomeSelect').value;
            if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
                if (this.genomeBrowser.visibleTracks.has('sequence')) {
                    this.genomeBrowser.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);
                }
            }
            
            // Refresh all SVG-based tracks to prevent text stretching
            this.refreshSVGTracks();
            
            // Update genome navigation bar if exists
            if (this.genomeBrowser.genomeNavigationBar) {
                this.genomeBrowser.genomeNavigationBar.resizeCanvas();
                this.genomeBrowser.genomeNavigationBar.draw();
            }
        }
    }
    
    /**
     * Refresh all SVG-based tracks to recalculate proper dimensions
     * This prevents gene text from stretching when window size changes
     */
    refreshSVGTracks() {
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[currentChr]) {
            console.log('⚠️ No current chromosome/sequence, skipping SVG refresh');
            return;
        }
        
        const sequence = this.genomeBrowser.currentSequence[currentChr];
        const annotations = this.genomeBrowser.currentAnnotations[currentChr] || [];
        const operons = this.genomeBrowser.operons || [];
        
        console.log('🔄 Refreshing SVG tracks for chromosome:', currentChr, '| Viewport:', this.genomeBrowser.currentPosition.start, '-', this.genomeBrowser.currentPosition.end);
        
        // Refresh gene track if visible
        if (this.genomeBrowser.visibleTracks.has('genes') && annotations.length > 0) {
            this.refreshGeneTrackSVG(currentChr, sequence, annotations, operons);
        }
        
        // Refresh reads track if visible
        if (this.genomeBrowser.visibleTracks.has('reads')) {
            this.refreshReadsTrackSVG(currentChr);
        }
        
        // Refresh other SVG-based tracks as needed
        this.refreshOtherSVGTracks(currentChr, sequence);
        
        console.log('✅ SVG tracks refresh completed');
    }
    
    /**
     * Refresh the gene track SVG to prevent text stretching
     */
    refreshGeneTrackSVG(chromosome, sequence, annotations, operons) {
        const geneTrack = document.querySelector('.gene-track');
        if (!geneTrack) return;
        
        const trackContent = geneTrack.querySelector('.track-content');
        if (!trackContent) return;
        
        // Get current viewport
        const viewport = {
            start: this.genomeBrowser.currentPosition.start,
            end: this.genomeBrowser.currentPosition.end,
            range: this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start
        };
        
        // Filter visible genes
        const visibleGenes = annotations.filter(gene => {
            return this.genomeBrowser.shouldShowGeneType(gene.type) &&
                   gene.end >= viewport.start && gene.start <= viewport.end;
        });
        
        if (visibleGenes.length === 0) return;
        
        // Clear existing content
        trackContent.innerHTML = '';
        
        // Get current gene track settings
        const geneSettings = this.genomeBrowser.trackRenderer.getGeneTrackSettings?.() || {};
        
        // Re-render the gene track with proper SVG dimensions
        this.genomeBrowser.trackRenderer.renderGeneElements(
            trackContent, 
            visibleGenes, 
            viewport, 
            operons, 
            geneSettings
        );
        
        // Update SVG text elements to handle the new container width properly
        const svgContainer = trackContent.querySelector('.genes-svg-container');
        if (svgContainer) {
            // Force layout recalculation to get accurate width
            trackContent.style.width = '100%';
            const containerWidth = trackContent.getBoundingClientRect().width || trackContent.offsetWidth || 800;
            
            // Update text elements for proper sizing after resize
            this.genomeBrowser.trackRenderer.updateSVGTextForResize(svgContainer, containerWidth);
        }
        
        console.log('🧬 Gene track SVG refreshed with', visibleGenes.length, 'genes');
    }
    
    /**
     * Refresh the reads track SVG if present
     */
    refreshReadsTrackSVG(chromosome) {
        const readsTrack = document.querySelector('.reads-track');
        if (!readsTrack) return;
        
        const trackContent = readsTrack.querySelector('.track-content');
        if (!trackContent) return;
        
        // Check if reads data exists for this chromosome
        const readsData = this.genomeBrowser.currentReads[chromosome];
        if (!readsData || readsData.length === 0) return;
        
        // Get current viewport
        const viewport = {
            start: this.genomeBrowser.currentPosition.start,
            end: this.genomeBrowser.currentPosition.end,
            range: this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start
        };
        
        // Re-render reads track
        const visibleReads = readsData.filter(read => 
            read.end >= viewport.start && read.start <= viewport.end
        );
        
        if (visibleReads.length > 0) {
            trackContent.innerHTML = '';
            this.genomeBrowser.trackRenderer.renderReadsTrack(
                trackContent,
                visibleReads,
                viewport
            );
            console.log('📊 Reads track SVG refreshed with', visibleReads.length, 'reads');
        }
    }
    
    /**
     * Refresh other SVG-based tracks (GC content, WIG tracks, etc.)
     */
    refreshOtherSVGTracks(chromosome, sequence) {
        // Refresh GC track if visible
        if (this.genomeBrowser.visibleTracks.has('gc') && sequence) {
            const gcTrack = document.querySelector('.gc-track');
            if (gcTrack) {
                const trackContent = gcTrack.querySelector('.track-content');
                if (trackContent) {
                    // Clear and re-render GC track
                    trackContent.innerHTML = '';
                    this.genomeBrowser.trackRenderer.createGCTrack(chromosome, sequence);
                    console.log('📈 GC track SVG refreshed');
                }
            }
        }
        
        // Refresh WIG tracks if present
        const wigTracks = document.querySelectorAll('.wig-track');
        wigTracks.forEach(wigTrack => {
            const trackContent = wigTrack.querySelector('.track-content');
            if (trackContent) {
                const trackName = wigTrack.getAttribute('data-track-name');
                if (trackName) {
                    // Re-render WIG track SVG
                    this.refreshWIGTrackSVG(wigTrack, trackName, chromosome);
                }
            }
        });
    }
    
    /**
     * Refresh a specific WIG track SVG
     */
    refreshWIGTrackSVG(wigTrackElement, trackName, chromosome) {
        const trackContent = wigTrackElement.querySelector('.track-content');
        if (!trackContent) return;
        
        // Get WIG data for this track
        const wigData = this.genomeBrowser.currentWIGData?.[chromosome]?.[trackName];
        if (!wigData) return;
        
        // Get current viewport
        const viewport = {
            start: this.genomeBrowser.currentPosition.start,
            end: this.genomeBrowser.currentPosition.end,
            range: this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start
        };
        
        // Filter visible data points
        const visibleData = wigData.filter(point => 
            point.end >= viewport.start && point.start <= viewport.start
        );
        
        if (visibleData.length > 0) {
            // Clear existing SVG
            const existingSvg = trackContent.querySelector('svg');
            if (existingSvg) {
                existingSvg.remove();
            }
            
            // Re-create SVG with proper dimensions
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.cssText = `
                width: 100%;
                height: 100%;
                display: block;
            `;
            
            // Re-render WIG visualization
            this.genomeBrowser.trackRenderer.createWIGVisualization?.(
                svg, 
                visibleData, 
                viewport, 
                wigData.color || '#3498db'
            );
            
            trackContent.appendChild(svg);
            console.log('📊 WIG track', trackName, 'SVG refreshed');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 