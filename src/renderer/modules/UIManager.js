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
        document.getElementById('statusText').textContent = message;
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    handleWindowResize() {
        // Recalculate sequence display if visible
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[currentChr]) {
            if (this.genomeBrowser.visibleTracks.has('sequence')) {
                this.genomeBrowser.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIManager;
} 