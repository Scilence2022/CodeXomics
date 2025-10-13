/**
 * Protein Structure Viewer Module
 * Manages 3D protein structure visualization using NGL Viewer
 */

class ProteinStructureViewer {
    constructor() {
        this.structureWindows = new Map(); // Track open structure windows
        this.currentStructures = new Map(); // Track loaded structures
        this.webglSupported = this.checkWebGLSupport(); // Check WebGL support
        this.initializeModule();
    }

    /**
     * Check if WebGL is supported in the current environment
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                console.warn('WebGL not supported in this environment');
                return false;
            }
            
            // Check WebGL extensions and capabilities
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                console.log('WebGL Vendor:', vendor);
                console.log('WebGL Renderer:', renderer);
                
                // Check for software rendering (usually indicates poor performance)
                if (renderer && (renderer.includes('Software') || renderer.includes('Microsoft'))) {
                    console.warn('WebGL is using software rendering, 3D performance may be limited');
                }
            }
            
            console.log('WebGL support detected and available');
            return true;
            
        } catch (error) {
            console.error('Error checking WebGL support:', error);
            return false;
        }
    }

    /**
     * Get WebGL context information for debugging
     */
    getWebGLInfo() {
        if (!this.webglSupported) {
            return {
                supported: false,
                message: 'WebGL is not supported in this environment'
            };
        }
        
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return {
                    supported: false,
                    message: 'WebGL context could not be created'
                };
            }
            
            const info = {
                supported: true,
                version: gl.getParameter(gl.VERSION),
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
                maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
                maxViewportDims: gl.getParameter(gl.MAX_VIEWPORT_DIMS)
            };
            
            // Get debug info if available
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                info.unmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                info.unmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
            
            return info;
            
        } catch (error) {
            return {
                supported: false,
                message: `Error getting WebGL info: ${error.message}`
            };
        }
    }

    initializeModule() {
        console.log('ProteinStructureViewer module initialized');
        
        // Add protein viewer button to UI if it doesn't exist
        this.addProteinViewerButton();
        
        // Listen for protein structure-related messages from MCP server
        this.setupMCPListeners();
    }

    /**
     * Add unified protein search button to the main interface
     */
    addProteinViewerButton() {
        const toolbar = document.querySelector('.toolbar') || document.querySelector('.navigation-controls');
        if (!toolbar) return;

        // Check if button already exists
        if (document.getElementById('unified-protein-search-btn')) return;

        // Remove old separate buttons if they exist
        const oldProteinBtn = document.getElementById('protein-viewer-btn');
        const oldAlphaFoldBtn = document.getElementById('alphafold-viewer-btn');
        if (oldProteinBtn) oldProteinBtn.remove();
        if (oldAlphaFoldBtn) oldAlphaFoldBtn.remove();

        const unifiedBtn = document.createElement('button');
        unifiedBtn.id = 'unified-protein-search-btn';
        unifiedBtn.className = 'btn';
        unifiedBtn.innerHTML = '<i class="fas fa-cubes"></i> Protein Structure';
        unifiedBtn.title = 'Search Protein Structures (PDB & AlphaFold)';
        unifiedBtn.onclick = () => this.showUnifiedProteinSearchDialog();
        
        toolbar.appendChild(unifiedBtn);
    }

    /**
     * Show unified protein search dialog
     */
    showUnifiedProteinSearchDialog() {
        // Remove any existing dialogs first
        const existingDialogs = document.querySelectorAll('.unified-protein-search-dialog, .protein-search-dialog, .alphafold-search-dialog');
        existingDialogs.forEach(dialog => dialog.remove());
        
        const dialog = this.createUnifiedProteinSearchDialog();
        document.body.appendChild(dialog);
        dialog.showModal();
        
        // Focus the input field
        setTimeout(() => {
            const inputField = document.getElementById('unified-search-input');
            if (inputField) {
                inputField.value = '';
                inputField.focus();
            }
        }, 100);
    }

    /**
     * Create unified protein search dialog
     */
    createUnifiedProteinSearchDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'unified-protein-search-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header draggable-header" data-dialog-id="unified-protein-search">
                    <h3>Protein Structure Search</h3>
                    <button class="close-btn" onclick="this.closest('dialog').close()">×</button>
                </div>
                <div class="dialog-body">
                    <div class="input-group">
                        <label for="unified-search-input">Gene Name or PDB ID:</label>
                        <input type="text" id="unified-search-input" placeholder="Enter gene name (e.g., TP53, lysC) or PDB ID (e.g., 1TUP)">
                    </div>
                    
                    <div class="input-group">
                        <label for="database-selection">Database:</label>
                        <select id="database-selection">
                            <option value="both">Both PDB & AlphaFold</option>
                            <option value="pdb">PDB Experimental Structures</option>
                            <option value="alphafold">AlphaFold Predictions</option>
                        </select>
                    </div>
                    
                    <div class="input-group">
                        <label for="species-selection">Species:</label>
                        <select id="species-selection">
                            <option value="auto">Auto-detect from current genome</option>
                            <option value="all">All species (no restriction)</option>
                            <option value="Homo sapiens">Human (Homo sapiens)</option>
                            <option value="Escherichia coli">E. coli (Escherichia coli)</option>
                            <option value="Corynebacterium glutamicum">C. glutamicum (Corynebacterium glutamicum)</option>
                            <option value="Bacillus subtilis">B. subtilis (Bacillus subtilis)</option>
                            <option value="Saccharomyces cerevisiae">Yeast (Saccharomyces cerevisiae)</option>
                            <option value="Mus musculus">Mouse (Mus musculus)</option>
                            <option value="Drosophila melanogaster">Fruit fly (Drosophila melanogaster)</option>
                            <option value="Caenorhabditis elegans">C. elegans</option>
                        </select>
                    </div>
                    
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="proteinStructureViewer.executeUnifiedSearch()">
                            <i class="fas fa-search"></i> Search Structures
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('dialog').close()">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return dialog;
    }

    /**
     * Execute unified protein structure search
     */
    executeUnifiedSearch() {
        const searchInput = document.getElementById('unified-search-input');
        const databaseSelect = document.getElementById('database-selection');
        const speciesSelect = document.getElementById('species-selection');
        
        if (!searchInput || !searchInput.value.trim()) {
            alert('Please enter a gene name or PDB ID');
            return;
        }
        
        const query = searchInput.value.trim();
        const database = databaseSelect.value;
        const species = speciesSelect.value;
        
        // Close the dialog
        const dialog = document.querySelector('.unified-protein-search-dialog');
        if (dialog) dialog.close();
        
        // Determine the organism for the search
        let organism = species;
        if (species === 'auto') {
            // Try to auto-detect from current genome if available
            if (window.genomeBrowser && typeof window.genomeBrowser.getCurrentOrganismInfo === 'function') {
                organism = window.genomeBrowser.getCurrentOrganismInfo();
            } else {
                organism = 'Unknown organism';
            }
        } else if (species === 'all') {
            organism = '';
        }
        
        // Execute search based on database selection
        if (database === 'both') {
            this.searchBothDatabases(query, organism);
        } else if (database === 'pdb') {
            this.searchPDBOnly(query, organism);
        } else if (database === 'alphafold') {
            this.searchAlphaFoldOnly(query, organism);
        }
    }

    /**
     * Search both PDB and AlphaFold databases
     */
    searchBothDatabases(query, organism) {
        if (!window.chatManager) {
            console.error('ChatManager not available');
            return;
        }
        
        let searchMessage;
        if (organism && organism !== 'Unknown organism') {
            searchMessage = `Search protein structures for "${query}" in ${organism}. Please search both PDB experimental structures and AlphaFold predictions for this protein.`;
        } else {
            searchMessage = `Search protein structures for "${query}". Please search both PDB experimental structures and AlphaFold predictions for this protein.`;
        }
        
        window.chatManager.sendMessageProgrammatically(searchMessage);
        this.showChatIfHidden();
    }

    /**
     * Search PDB database only
     */
    searchPDBOnly(query, organism) {
        if (!window.chatManager) {
            console.error('ChatManager not available');
            return;
        }
        
        let searchMessage;
        if (organism && organism !== 'Unknown organism') {
            searchMessage = `Search PDB protein structures for "${query}" in ${organism}.`;
        } else {
            searchMessage = `Search PDB protein structures for "${query}".`;
        }
        
        window.chatManager.sendMessageProgrammatically(searchMessage);
        this.showChatIfHidden();
    }

    /**
     * Search AlphaFold database only
     */
    searchAlphaFoldOnly(query, organism) {
        if (!window.chatManager) {
            console.error('ChatManager not available');
            return;
        }
        
        let searchMessage;
        if (organism && organism !== 'Unknown organism') {
            searchMessage = `Search AlphaFold protein structures for "${query}" in ${organism}.`;
        } else {
            searchMessage = `Search AlphaFold protein structures for "${query}".`;
        }
        
        window.chatManager.sendMessageProgrammatically(searchMessage);
        this.showChatIfHidden();
    }

    /**
     * Show chat box if hidden
     */
    showChatIfHidden() {
        const chatBox = document.querySelector('.chat-container');
        if (chatBox && !chatBox.classList.contains('visible')) {
            const toggleChatBtn = document.getElementById('toggleChatBtn');
            if (toggleChatBtn) {
                toggleChatBtn.click();
            }
        }
    }

    /**
     * Show dialog to search for protein structures (Legacy method - kept for compatibility)
     */
    showProteinSearchDialog() {
        // Remove any existing dialog first
        const existingDialog = document.querySelector('.protein-search-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const dialog = this.createProteinSearchDialog();
        document.body.appendChild(dialog);
        dialog.showModal();
        
        // Focus and clear the input field
        setTimeout(() => {
            const inputField = document.getElementById('pdb-id-input');
            if (inputField) {
                inputField.value = '';
                inputField.focus();
                console.log('Input field reset and focused');
            }
        }, 100);
    }

    /**
     * Create protein search dialog
     */
    createProteinSearchDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'protein-search-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header draggable-header" data-dialog-id="protein-search">
                    <h3>Load Protein Structure</h3>
                    <button class="close-btn" onclick="this.closest('dialog').close()">×</button>
                </div>
                <div class="dialog-body">
                    <div class="input-group">
                        <label for="pdb-id-input">PDB ID:</label>
                        <input type="text" id="pdb-id-input" placeholder="Enter PDB ID (e.g., 1TUP, 2HG4, 3K2F)">
                    </div>
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="proteinStructureViewer.searchProteinStructures()">
                            Load Structure
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('dialog').close()">
                            Cancel
                        </button>
                    </div>
                    <div id="search-results" class="search-results"></div>
                </div>
            </div>
        `;

        // Add styles
        if (!document.getElementById('protein-dialog-styles')) {
            const style = document.createElement('style');
            style.id = 'protein-dialog-styles';
            style.textContent = `
                .protein-search-dialog {
                    border: none;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                }

                .protein-search-dialog .dialog-content {
                    padding: 0;
                }

                .protein-search-dialog .dialog-header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                }

                .protein-search-dialog .dialog-header h3 {
                    margin: 0;
                    font-size: 1.2em;
                }

                .protein-search-dialog .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5em;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .protein-search-dialog .close-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                .protein-search-dialog .dialog-body {
                    padding: 20px;
                }

                .protein-search-dialog .input-group {
                    margin-bottom: 15px;
                }

                .protein-search-dialog .input-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: bold;
                    color: #333;
                }

                .protein-search-dialog .input-group input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    font-size: 14px;
                }

                .protein-search-dialog .button-group {
                    display: flex;
                    gap: 10px;
                    margin-top: 20px;
                }

                .protein-search-dialog .btn {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                }

                .protein-search-dialog .btn-primary {
                    background: #007bff;
                    color: white;
                }

                .protein-search-dialog .btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .protein-search-dialog .btn:hover {
                    opacity: 0.9;
                }

                .search-results {
                    margin-top: 20px;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .structure-result {
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    margin-bottom: 10px;
                    padding: 10px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }

                .structure-result:hover {
                    background-color: #f8f9fa;
                }

                .structure-result .title {
                    font-weight: bold;
                    color: #007bff;
                }

                .structure-result .details {
                    font-size: 0.9em;
                    color: #666;
                    margin-top: 5px;
                }

                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }

                /* Draggable functionality */
                .draggable-header {
                    cursor: move !important;
                }

                .dragging {
                    position: fixed !important;
                    z-index: 9999 !important;
                    pointer-events: none !important;
                }

                .dragging .dialog-content {
                    pointer-events: auto !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Add draggable functionality
        this.makeDraggable(dialog);

        return dialog;
    }

    /**
     * Search for protein structures
     */
    async searchProteinStructures() {
        const inputElement = document.getElementById('pdb-id-input');
        const pdbId = inputElement.value.trim();
        const resultsDiv = document.getElementById('search-results');

        console.log('=== PROTEIN SEARCH START ===');
        console.log('Input element found:', !!inputElement);
        console.log('Input element display value:', inputElement.value);
        console.log('Input element trimmed value:', pdbId);
        console.log('Requested PDB ID:', pdbId);

        if (!pdbId) {
            alert('Please enter a PDB ID');
            return;
        }

        resultsDiv.innerHTML = '<div class="loading">Searching for protein structure...</div>';

        try {
            console.log('Requesting MCP tool with parameters:', { pdbId: pdbId });
            const structureData = await this.requestMCPTool('fetch_protein_structure', {
                pdbId: pdbId
            });

            console.log('MCP response received:', {
                success: structureData.success,
                returnedPdbId: structureData.pdbId,
                dataLength: structureData.pdbData ? structureData.pdbData.length : 'No data',
                geneName: structureData.geneName
            });

            if (structureData.success) {
                // Verify we got the correct protein
                if (structureData.pdbId && structureData.pdbId.toUpperCase() !== pdbId.toUpperCase()) {
                    console.warn('PDB ID mismatch! Requested:', pdbId, 'Received:', structureData.pdbId);
                }
                
                this.openStructureViewer(structureData.pdbData, structureData.geneName, pdbId);
                document.querySelector('.protein-search-dialog').close();
                
                // Clear the input field after successful load
                inputElement.value = '';
                console.log('Input field cleared after successful load');
            }

        } catch (error) {
            console.error('Error in protein search:', error);
            resultsDiv.innerHTML = `<div class="error">Error searching structure: ${error.message}</div>`;
        }
        
        console.log('=== PROTEIN SEARCH END ===');
    }

    /**
     * Open 3D protein structure viewer in new window
     */
    openStructureViewer(pdbData, proteinName, pdbId) {
        // Check WebGL support before opening viewer
        if (!this.webglSupported) {
            this.showWebGLErrorDialog(proteinName, pdbId);
            return;
        }
        
        const windowId = `protein-${pdbId}-${Date.now()}`;
        
        console.log('Opening protein structure viewer for:', pdbId);
        console.log('PDB data length:', pdbData ? pdbData.length : 'No data');
        console.log('WebGL support status:', this.webglSupported);
        
        // Create new window
        const viewerWindow = window.open('', windowId, 
            'width=800,height=600,scrollbars=yes,resizable=yes,status=yes,menubar=no,toolbar=no'
        );

        if (!viewerWindow) {
            alert('Popup blocked. Please allow popups for this site.');
            return;
        }

        // Set up the viewer window content
        viewerWindow.document.write(this.getViewerHTML(proteinName, pdbId));
        viewerWindow.document.close();

        // Wait for window to load, then wait for NGL to load, then initialize
        viewerWindow.onload = () => {
            console.log('Viewer window loaded, waiting for NGL...');
            
            // Check periodically if NGL is ready
            const checkNGL = () => {
                if (viewerWindow.nglReady && viewerWindow.NGL) {
                    console.log('NGL is ready, initializing viewer...');
                    viewerWindow.document.getElementById('loading').textContent = 'Loading protein structure...';
                    this.initializeNGLViewer(viewerWindow, pdbData, proteinName, pdbId);
                } else if (viewerWindow.closed) {
                    console.log('Viewer window was closed before NGL loaded');
                    return;
                } else {
                    // Check again in 100ms
                    setTimeout(checkNGL, 100);
                }
            };
            
            // Start checking after a short delay to allow the load event to fire
            setTimeout(checkNGL, 100);
        };

        this.structureWindows.set(windowId, viewerWindow);
        
        console.log('Protein viewer window created with ID:', windowId);
    }

    /**
     * Show WebGL error dialog with fallback options
     */
    showWebGLErrorDialog(proteinName, pdbId) {
        const webglInfo = this.getWebGLInfo();
        
        const dialog = document.createElement('dialog');
        dialog.className = 'webgl-error-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>⚠️ 3D Viewer Not Available</h3>
                    <button class="close-btn" onclick="this.closest('dialog').close()">×</button>
                </div>
                <div class="dialog-body">
                    <div class="error-message">
                        <p><strong>WebGL is required but not available</strong></p>
                        <p>The 3D protein structure viewer requires WebGL support, which is not available in your current environment.</p>
                    </div>
                    
                    <div class="webgl-info">
                        <h4>System Information:</h4>
                        <ul>
                            <li><strong>WebGL Support:</strong> ${webglInfo.supported ? 'Available' : 'Not Available'}</li>
                            <li><strong>Browser:</strong> ${navigator.userAgent.split(' ').pop()}</li>
                            <li><strong>Platform:</strong> ${navigator.platform}</li>
                            ${webglInfo.message ? `<li><strong>Details:</strong> ${webglInfo.message}</li>` : ''}
                        </ul>
                    </div>
                    
                    <div class="solutions">
                        <h4>Possible Solutions:</h4>
                        <ul>
                            <li><strong>Windows:</strong> Update your graphics drivers and enable hardware acceleration</li>
                            <li><strong>Browser:</strong> Try a different browser (Chrome, Firefox, Edge)</li>
                            <li><strong>Settings:</strong> Enable WebGL in browser settings</li>
                            <li><strong>Antivirus:</strong> Check if security software is blocking WebGL</li>
                        </ul>
                    </div>
                    
                    <div class="alternatives">
                        <h4>Alternative Options:</h4>
                        <button class="btn btn-primary" onclick="proteinStructureViewer.downloadPDBFile('${pdbId}', '${proteinName}')">
                            📁 Download PDB File
                        </button>
                        <button class="btn btn-secondary" onclick="proteinStructureViewer.showPDBInfo('${pdbId}', '${proteinName}')">
                            ℹ️ Show Structure Info
                        </button>
                        <button class="btn btn-secondary" onclick="proteinStructureViewer.openRCSBPage('${pdbId}')">
                            🌐 View on RCSB PDB
                        </button>
                    </div>
                    
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" onclick="this.closest('dialog').close()">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add styles for the dialog
        if (!document.getElementById('webgl-error-styles')) {
            const styles = document.createElement('style');
            styles.id = 'webgl-error-styles';
            styles.textContent = `
                .webgl-error-dialog {
                    max-width: 600px;
                    border: none;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                    padding: 0;
                }
                .webgl-error-dialog .dialog-header {
                    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
                    color: white;
                    padding: 15px 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-radius: 8px 8px 0 0;
                }
                .webgl-error-dialog .dialog-body {
                    padding: 20px;
                }
                .webgl-error-dialog .error-message {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 4px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .webgl-error-dialog .webgl-info, 
                .webgl-error-dialog .solutions, 
                .webgl-error-dialog .alternatives {
                    margin-bottom: 20px;
                }
                .webgl-error-dialog h4 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    color: #333;
                }
                .webgl-error-dialog ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .webgl-error-dialog li {
                    margin-bottom: 5px;
                }
                .webgl-error-dialog .alternatives {
                    text-align: center;
                }
                .webgl-error-dialog .btn {
                    margin: 5px;
                    padding: 8px 16px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    text-decoration: none;
                    display: inline-block;
                }
                .webgl-error-dialog .btn-primary {
                    background: #0984e3;
                    color: white;
                }
                .webgl-error-dialog .btn-secondary {
                    background: #636e72;
                    color: white;
                }
                .webgl-error-dialog .btn:hover {
                    opacity: 0.9;
                }
                .webgl-error-dialog .dialog-footer {
                    text-align: right;
                    border-top: 1px solid #eee;
                    padding-top: 15px;
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(dialog);
        dialog.showModal();
    }

    /**
     * Download PDB file as fallback option
     */
    downloadPDBFile(pdbId, proteinName) {
        const pdbUrl = `https://files.rcsb.org/download/${pdbId}.pdb`;
        const link = document.createElement('a');
        link.href = pdbUrl;
        link.download = `${pdbId}_${proteinName}.pdb`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success message
        this.showNotification(`Downloading PDB file for ${proteinName} (${pdbId})`, 'info');
    }

    /**
     * Show PDB structure information as fallback
     */
    async showPDBInfo(pdbId, proteinName) {
        try {
            // Try to get structure info from MCP server
            const structureInfo = await this.requestMCPTool('fetch_protein_structure', {
                pdbId: pdbId,
                infoOnly: true
            });
            
            let infoContent = `
                <h3>Protein Structure Information</h3>
                <p><strong>Protein:</strong> ${proteinName}</p>
                <p><strong>PDB ID:</strong> ${pdbId}</p>
            `;
            
            if (structureInfo && structureInfo.success) {
                if (structureInfo.resolution) {
                    infoContent += `<p><strong>Resolution:</strong> ${structureInfo.resolution} Å</p>`;
                }
                if (structureInfo.method) {
                    infoContent += `<p><strong>Method:</strong> ${structureInfo.method}</p>`;
                }
                if (structureInfo.organism) {
                    infoContent += `<p><strong>Organism:</strong> ${structureInfo.organism}</p>`;
                }
                if (structureInfo.description) {
                    infoContent += `<p><strong>Description:</strong> ${structureInfo.description}</p>`;
                }
            } else {
                infoContent += `<p><em>Detailed structure information not available</em></p>`;
            }
            
            infoContent += `
                <p><strong>External Links:</strong></p>
                <ul>
                    <li><a href="https://www.rcsb.org/structure/${pdbId}" target="_blank">RCSB PDB Entry</a></li>
                    <li><a href="https://files.rcsb.org/download/${pdbId}.pdb" target="_blank">Download PDB File</a></li>
                    <li><a href="https://www.ebi.ac.uk/pdbe/entry/pdb/${pdbId}" target="_blank">PDBe Entry</a></li>
                </ul>
            `;
            
            this.showInfoDialog('Protein Structure Information', infoContent);
            
        } catch (error) {
            console.error('Error getting PDB info:', error);
            this.showInfoDialog('Protein Structure Information', `
                <h3>Protein Structure Information</h3>
                <p><strong>Protein:</strong> ${proteinName}</p>
                <p><strong>PDB ID:</strong> ${pdbId}</p>
                <p><em>Could not retrieve detailed information</em></p>
                <p><strong>External Links:</strong></p>
                <ul>
                    <li><a href="https://www.rcsb.org/structure/${pdbId}" target="_blank">RCSB PDB Entry</a></li>
                    <li><a href="https://files.rcsb.org/download/${pdbId}.pdb" target="_blank">Download PDB File</a></li>
                </ul>
            `);
        }
    }

    /**
     * Open RCSB PDB page for the structure
     */
    openRCSBPage(pdbId) {
        const url = `https://www.rcsb.org/structure/${pdbId}`;
        window.open(url, '_blank');
    }

    /**
     * Show information dialog
     */
    showInfoDialog(title, content) {
        const dialog = document.createElement('dialog');
        dialog.className = 'info-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>${title}</h3>
                    <button class="close-btn" onclick="this.closest('dialog').close()">×</button>
                </div>
                <div class="dialog-body">
                    ${content}
                </div>
                <div class="dialog-footer">
                    <button class="btn btn-secondary" onclick="this.closest('dialog').close()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        dialog.showModal();
        
        // Auto-close after user closes
        dialog.addEventListener('close', () => {
            document.body.removeChild(dialog);
        });
    }

    /**
     * Show notification message
     */
    showNotification(message, type = 'info') {
        // Try to use existing notification system
        if (window.genomeBrowser && window.genomeBrowser.showNotification) {
            window.genomeBrowser.showNotification(message, type);
        } else if (window.app && window.app.showNotification) {
            window.app.showNotification(message, type);
        } else {
            // Fallback to alert
            alert(message);
        }
    }

    /**
     * Handle NGL viewer errors with detailed feedback
     */
    handleNGLError(viewerWindow, errorMessage) {
        const loadingElement = viewerWindow.document.getElementById('loading');
        if (loadingElement) {
            const webglInfo = this.getWebGLInfo();
            
            loadingElement.innerHTML = `
                <div style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <h3 style="color: #e74c3c; margin-bottom: 15px;">⚠️ 3D Viewer Error</h3>
                    <p style="margin-bottom: 10px;"><strong>Error:</strong> ${errorMessage}</p>
                    
                    <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; font-size: 12px;">
                        <strong>System Information:</strong><br>
                        WebGL Support: ${webglInfo.supported ? '✓ Available' : '❌ Not Available'}<br>
                        Browser: ${navigator.userAgent.split(' ').pop()}<br>
                        Platform: ${navigator.platform}
                    </div>
                    
                    <div style="margin-top: 15px;">
                        <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Close Window</button>
                        <button onclick="window.open('https://www.rcsb.org/structure/${viewerWindow.pdbId || 'unknown'}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">View on RCSB</button>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Get HTML template for protein viewer window
     */
    getViewerHTML(proteinName, pdbId) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Protein Structure: ${proteinName} (${pdbId})</title>
                <script>
                    // Try multiple CDN sources for NGL viewer
                    function loadNGL() {
                        return new Promise((resolve, reject) => {
                            const scripts = [
                                'https://unpkg.com/ngl@2.3.1/dist/ngl.js',
                                'https://cdn.jsdelivr.net/npm/ngl@2.3.1/dist/ngl.js',
                                'https://unpkg.com/ngl@latest/dist/ngl.js'
                            ];
                            
                            function tryScript(index) {
                                if (index >= scripts.length) {
                                    reject(new Error('Failed to load NGL from all CDN sources'));
                                    return;
                                }
                                
                                const script = document.createElement('script');
                                script.src = scripts[index];
                                script.onload = () => {
                                    console.log('NGL loaded from:', scripts[index]);
                                    resolve();
                                };
                                script.onerror = () => {
                                    console.warn('Failed to load NGL from:', scripts[index]);
                                    tryScript(index + 1);
                                };
                                document.head.appendChild(script);
                            }
                            
                            tryScript(0);
                        });
                    }
                    
                    // Load NGL when page loads
                    window.addEventListener('load', () => {
                        loadNGL().then(() => {
                            console.log('NGL library loaded successfully');
                            window.nglReady = true;
                        }).catch((error) => {
                            console.error('Failed to load NGL:', error);
                            document.getElementById('loading').textContent = 
                                'Failed to load 3D viewer library. Please check your internet connection.';
                        });
                    });
                </script>
                <style>
                    body {
                        margin: 0;
                        padding: 0;
                        font-family: Arial, sans-serif;
                        background: #f0f0f0;
                    }
                    .header {
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 15px;
                        text-align: center;
                    }
                    .header h1 {
                        margin: 0;
                        font-size: 1.5em;
                    }
                    .header .pdb-id {
                        font-size: 0.9em;
                        opacity: 0.8;
                    }
                    .viewer-container {
                        height: calc(100vh - 80px);
                        position: relative;
                    }
                    .controls {
                        position: absolute;
                        top: 10px;
                        left: 10px;
                        background: rgba(255,255,255,0.9);
                        padding: 10px;
                        border-radius: 5px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        z-index: 1000;
                    }
                    .controls button {
                        margin: 2px;
                        padding: 5px 10px;
                        border: 1px solid #ddd;
                        background: white;
                        border-radius: 3px;
                        cursor: pointer;
                    }
                    .controls button:hover {
                        background: #f0f0f0;
                    }
                    #viewport {
                        width: 100%;
                        height: 100%;
                    }
                    .loading {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        text-align: center;
                        font-size: 1.2em;
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${proteinName}</h1>
                    <div class="pdb-id">PDB ID: ${pdbId}</div>
                </div>
                <div class="viewer-container">
                    <div class="controls">
                        <button onclick="resetView()">Reset View</button>
                        <button onclick="toggleRepresentation()">Toggle Style</button>
                        <button onclick="toggleSpin()">Auto Rotate</button>
                        <button onclick="showInfo()">Info</button>
                    </div>
                    <div class="loading" id="loading">Loading 3D viewer library...</div>
                    <div id="viewport"></div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Initialize NGL viewer in the protein window
     */
    initializeNGLViewer(viewerWindow, pdbData, proteinName, pdbId) {
        try {
            console.log('Initializing NGL viewer for:', pdbId);
            console.log('PDB data length:', pdbData ? pdbData.length : 'No data');
            
            // Check if NGL is available
            if (!viewerWindow.NGL) {
                console.error('NGL library not loaded');
                this.handleNGLError(viewerWindow, 'NGL library failed to load. This may be due to network issues or browser security restrictions.');
                return;
            }

            const NGL = viewerWindow.NGL;
            console.log('NGL library loaded successfully');
            
            // Check if viewport element exists
            const viewportElement = viewerWindow.document.getElementById('viewport');
            if (!viewportElement) {
                console.error('Viewport element not found');
                this.handleNGLError(viewerWindow, 'Viewport element not found in viewer window.');
                return;
            }

            // Try to create NGL stage with error handling
            let stage;
            try {
                stage = new NGL.Stage(viewportElement, {
                    backgroundColor: "white"
                });
            } catch (stageError) {
                console.error('Failed to create NGL stage:', stageError);
                this.handleNGLError(viewerWindow, `Failed to create 3D viewer: ${stageError.message}. This may be due to WebGL limitations on your system.`);
                return;
            }

            console.log('NGL stage created successfully');

            // Add representation controls
            let currentRepresentation = 'cartoon';
            let spinning = false;
            let component = null;

            // Validate PDB data
            if (!pdbData || pdbData.length === 0) {
                console.error('No PDB data provided');
                this.handleNGLError(viewerWindow, 'No protein structure data received. Please try again or check the PDB ID.');
                return;
            }

            console.log('Loading PDB data...');
            
            // Load structure from PDB string data directly with enhanced error handling
            // Use NGL's built-in string loading method
            const stringBlob = new Blob([pdbData], { type: 'text/plain' });
            const dataUrl = URL.createObjectURL(stringBlob);
            
            stage.loadFile(dataUrl, { ext: 'pdb' })
                .then(function(comp) {
                    console.log('PDB structure loaded successfully');
                    component = comp;
                    
                    // Clean up the object URL
                    URL.revokeObjectURL(dataUrl);
                    
                    try {
                        // Add default representation with error handling
                        comp.addRepresentation(currentRepresentation, {
                            colorScheme: "chainid"
                        });
                        
                        console.log('Representation added');
                        
                        // Auto view
                        comp.autoView();
                        
                        console.log('Auto view applied');
                        
                        // Hide loading
                        const loadingElement = viewerWindow.document.getElementById('loading');
                        if (loadingElement) {
                            loadingElement.style.display = 'none';
                        }
                        
                        console.log('NGL viewer initialization completed successfully');
                        
                    } catch (reprError) {
                        console.error('Error adding representation:', reprError);
                        const loadingElement = viewerWindow.document.getElementById('loading');
                        if (loadingElement) {
                            loadingElement.innerHTML = `
                                <div style="color: #e74c3c; text-align: center;">
                                    <h3>⚠️ Rendering Error</h3>
                                    <p>Failed to render protein structure: ${reprError.message}</p>
                                    <p>This may be due to WebGL limitations on your system.</p>
                                    <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Close</button>
                                </div>
                            `;
                        }
                    }
                    
                }).catch(function(error) {
                    console.error('Error loading PDB structure:', error);
                    
                    // Clean up the object URL in case of error
                    URL.revokeObjectURL(dataUrl);
                    
                    // Provide detailed error message based on error type
                    let errorMessage = 'Failed to load protein structure.';
                    if (error.message) {
                        if (error.message.includes('WebGL')) {
                            errorMessage = 'WebGL error occurred while loading structure. Your graphics drivers may need updating.';
                        } else if (error.message.includes('parse') || error.message.includes('format')) {
                            errorMessage = 'Invalid PDB format or corrupted structure data.';
                        } else {
                            errorMessage = `Loading error: ${error.message}`;
                        }
                    }
                    
                    const loadingElement = viewerWindow.document.getElementById('loading');
                    if (loadingElement) {
                        loadingElement.innerHTML = `
                            <div style="text-align: center; color: #e74c3c;">
                                <h3>⚠️ Loading Error</h3>
                                <p><strong>Error:</strong> ${errorMessage}</p>
                                <p><strong>PDB ID:</strong> ${pdbId}</p>
                                <div style="margin-top: 15px;">
                                    <button onclick="window.close()" style="background: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Close</button>
                                    <button onclick="window.open('https://www.rcsb.org/structure/${pdbId}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">View on RCSB</button>
                                    <button onclick="window.open('https://files.rcsb.org/download/${pdbId}.pdb', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Download PDB</button>
                                </div>
                            </div>
                        `;
                    }
                });

            // Store pdbId in window for error handlers
            viewerWindow.pdbId = pdbId;

            // Add control functions to window
            viewerWindow.resetView = () => {
                if (component) {
                    console.log('Resetting view');
                    component.autoView();
                }
            };

            viewerWindow.toggleRepresentation = () => {
                if (!component) return;
                
                console.log('Toggling representation from:', currentRepresentation);
                component.removeAllRepresentations();
                
                const representations = ['cartoon', 'ball+stick', 'spacefill', 'surface', 'backbone'];
                const currentIndex = representations.indexOf(currentRepresentation);
                const nextIndex = (currentIndex + 1) % representations.length;
                currentRepresentation = representations[nextIndex];
                
                console.log('New representation:', currentRepresentation);
                
                component.addRepresentation(currentRepresentation, {
                    colorScheme: "chainid"
                });
            };

            viewerWindow.toggleSpin = () => {
                spinning = !spinning;
                console.log('Toggle spin:', spinning);
                stage.setSpin(spinning);
            };

            viewerWindow.showInfo = () => {
                alert(`Protein: ${proteinName}\nPDB ID: ${pdbId}\nRepresentation: ${currentRepresentation}\nPDB Data Size: ${pdbData ? pdbData.length : 0} characters`);
            };

            // Handle window resize
            viewerWindow.addEventListener('resize', () => {
                console.log('Window resized, handling stage resize');
                stage.handleResize();
            });

        } catch (error) {
            console.error('Error initializing NGL viewer:', error);
            const loadingElement = viewerWindow.document.getElementById('loading');
            if (loadingElement) {
                loadingElement.textContent = 
                    'Error initializing 3D viewer: ' + error.message + 
                    ' (Check console for details)';
            }
        }
    }

    /**
     * Setup listeners for MCP server messages
     */
    setupMCPListeners() {
        // This will be called by the main MCP client when relevant messages arrive
        if (window.mcpServerManager) {
            window.mcpServerManager.addMessageHandler('protein-structure', (data) => {
                this.handleMCPMessage(data);
            });
        }
    }

    /**
     * Handle messages from MCP server
     */
    handleMCPMessage(data) {
        if (data.type === 'open_protein_viewer') {
            this.openStructureViewer(data.pdbData, data.proteinName, data.pdbId);
        } else if (data.type === 'open-alphafold-viewer') {
            this.openAlphaFoldViewer(data.data);
        }
    }

    /**
     * Open AlphaFold structure viewer
     */
    openAlphaFoldViewer(alphaFoldData) {
        const { structureData, uniprotId, geneName, confidenceData, organism } = alphaFoldData;
        
        console.log('Opening AlphaFold viewer for:', { uniprotId, geneName, organism });
        
        // Use the existing structure viewer but with AlphaFold branding
        const proteinName = `${geneName} (AlphaFold - ${organism})`;
        this.openStructureViewer(structureData, proteinName, uniprotId);
    }

    /**
     * Request MCP tool execution
     */
    async requestMCPTool(toolName, parameters) {
        // Try multiple ways to access the MCP server manager
        let mcpManager = null;
        let chatManager = null;
        
        if (window.chatManager) {
            chatManager = window.chatManager;
            if (chatManager.mcpServerManager) {
                mcpManager = chatManager.mcpServerManager;
            }
        } else if (window.genomeBrowser && window.genomeBrowser.chatManager) {
            chatManager = window.genomeBrowser.chatManager;
            if (chatManager.mcpServerManager) {
                mcpManager = chatManager.mcpServerManager;
            }
        } else if (window.mcpServerManager) {
            mcpManager = window.mcpServerManager;
        }
        
        // If we have an MCP manager but no connections, try to connect to the built-in server (only if auto-activation is allowed)
        if (mcpManager && mcpManager.getConnectedServersCount() === 0) {
            // Check if auto-activation is allowed
            const defaultSettings = { allowAutoActivation: false };
            const mcpSettings = mcpManager.configManager ? 
                mcpManager.configManager.get('mcpSettings', defaultSettings) : 
                defaultSettings;
                
            if (mcpSettings.allowAutoActivation) {
                console.log('No MCP servers connected, attempting to connect to built-in server...');
                try {
                    await mcpManager.connectToServer('genome-studio');
                    // Wait a moment for the connection to establish
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (error) {
                    console.warn('Failed to connect to built-in MCP server:', error.message);
                }
            } else {
                console.log('MCP auto-activation is disabled, skipping automatic connection');
            }
        }
        
        // Try MCPServerManager.executeToolOnServer first
        if (mcpManager && mcpManager.executeToolOnServer) {
            try {
                // Find which server has this tool
                const allTools = mcpManager.getAllAvailableTools();
                const tool = allTools.find(t => t.name === toolName);
                
                if (tool) {
                    console.log(`Executing tool ${toolName} on server: ${tool.serverName}`);
                    return await mcpManager.executeToolOnServer(tool.serverId, toolName, parameters);
                } else {
                    console.warn(`Tool ${toolName} not found in any connected MCP server`);
                }
            } catch (error) {
                console.warn('MCP server manager failed, trying ChatManager fallback:', error.message);
            }
        }
        
        // Try ChatManager.executeToolByName as fallback
        if (chatManager && chatManager.executeToolByName) {
            try {
                return await chatManager.executeToolByName(toolName, parameters);
            } catch (error) {
                console.warn('ChatManager executeToolByName failed:', error.message);
            }
        }
        
        throw new Error('MCP Server not connected or not available. Please ensure the MCP server is running and connected.');
    }

    /**
     * ALPHAFOLD INTEGRATION METHODS
     */

    /**
     * Show AlphaFold search dialog
     */
    showAlphaFoldSearchDialog() {
        // Remove any existing dialog first
        const existingDialog = document.querySelector('.alphafold-search-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }
        
        const dialog = this.createAlphaFoldSearchDialog();
        document.body.appendChild(dialog);
        dialog.showModal();
        
        // Focus and clear the input field
        setTimeout(() => {
            const inputField = document.getElementById('alphafold-gene-input');
            if (inputField) {
                inputField.value = '';
                inputField.focus();
                console.log('AlphaFold input field reset and focused');
            }
        }, 100);
    }

    /**
     * Create AlphaFold search dialog
     */
    createAlphaFoldSearchDialog() {
        const dialog = document.createElement('dialog');
        dialog.className = 'alphafold-search-dialog';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header draggable-header" data-dialog-id="alphafold-search">
                    <h3>Search AlphaFold Database</h3>
                    <button class="close-btn" onclick="this.closest('dialog').close()">×</button>
                </div>
                <div class="dialog-body">
                    <div class="input-group">
                        <label for="alphafold-gene-input">Gene Name:</label>
                        <input type="text" id="alphafold-gene-input" placeholder="Enter gene name (e.g., TP53, BRCA1)">
                    </div>
                    <div class="input-group">
                        <label for="alphafold-organism-input">Organism:</label>
                        <select id="alphafold-organism-input">
                            <option value="Homo sapiens">Human (Homo sapiens)</option>
                            <option value="Mus musculus">Mouse (Mus musculus)</option>
                            <option value="Escherichia coli">E. coli</option>
                        </select>
                    </div>
                    <div class="button-group">
                        <button class="btn btn-primary" onclick="proteinStructureViewer.searchAlphaFold()">
                            Search AlphaFold
                        </button>
                        <button class="btn btn-secondary" onclick="this.closest('dialog').close()">
                            Cancel
                        </button>
                    </div>
                    <div id="alphafold-search-results" class="search-results"></div>
                </div>
            </div>
        `;

        // Add AlphaFold dialog styles if not already added
        if (!document.getElementById('alphafold-dialog-styles')) {
            const style = document.createElement('style');
            style.id = 'alphafold-dialog-styles';
            style.textContent = `
                /* AlphaFold-specific styles */
                .alphafold-search-dialog {
                    border: none;
                    border-radius: 12px;
                    box-shadow: 0 6px 30px rgba(0,0,0,0.3);
                    max-width: 600px;
                    width: 95%;
                    max-height: 85vh;
                    overflow-y: auto;
                }

                .alphafold-search-dialog .dialog-content {
                    padding: 0;
                }

                .alphafold-search-dialog .dialog-header {
                    background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                    color: white;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: move;
                    user-select: none;
                }

                .alphafold-search-dialog .dialog-header h3 {
                    margin: 0;
                    font-size: 1.3em;
                }

                .alphafold-search-dialog .close-btn {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.5em;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .alphafold-search-dialog .close-btn:hover {
                    background: rgba(255,255,255,0.2);
                }

                .alphafold-search-dialog .dialog-body {
                    padding: 25px;
                }

                .alphafold-search-dialog .input-group {
                    margin-bottom: 20px;
                }

                .alphafold-search-dialog .input-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: #333;
                }

                .alphafold-search-dialog .input-group input,
                .alphafold-search-dialog .input-group select {
                    width: 100%;
                    padding: 12px 15px;
                    border: 2px solid #ddd;
                    border-radius: 6px;
                    font-size: 14px;
                    transition: border-color 0.3s ease;
                }

                .alphafold-search-dialog .input-group input:focus,
                .alphafold-search-dialog .input-group select:focus {
                    outline: none;
                    border-color: #4CAF50;
                    box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
                }

                .alphafold-search-dialog .button-group {
                    display: flex;
                    gap: 15px;
                    margin-top: 25px;
                }

                .alphafold-search-dialog .btn {
                    padding: 12px 25px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 500;
                    transition: all 0.3s ease;
                }

                .alphafold-search-dialog .btn-primary {
                    background: #4CAF50;
                    color: white;
                }

                .alphafold-search-dialog .btn-primary:hover {
                    background: #45a049;
                    transform: translateY(-1px);
                }

                .alphafold-search-dialog .btn-secondary {
                    background: #6c757d;
                    color: white;
                }

                .alphafold-search-dialog .btn-secondary:hover {
                    background: #5a6268;
                    transform: translateY(-1px);
                }

                .alphafold-result-item {
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .alphafold-result-item:hover {
                    background: #e9ecef;
                    border-color: #4CAF50;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.2);
                    transform: translateY(-1px);
                }

                .alphafold-result-title {
                    font-weight: 600;
                    font-size: 1.1em;
                    color: #333;
                    margin-bottom: 5px;
                }

                .alphafold-result-details {
                    font-size: 0.9em;
                    color: #666;
                    line-height: 1.4;
                }

                .search-results {
                    margin-top: 20px;
                }

                .search-results .loading {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                    font-style: italic;
                }

                .search-results .no-results {
                    text-align: center;
                    padding: 20px;
                    color: #999;
                    font-style: italic;
                }

                .search-results .error {
                    background: #f8d7da;
                    color: #721c24;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid #f5c6cb;
                }
            `;
            document.head.appendChild(style);
        }

        // Add draggable functionality
        this.makeDraggable(dialog);

        return dialog;
    }

    /**
     * Search AlphaFold database
     */
    async searchAlphaFold() {
        const geneName = document.getElementById('alphafold-gene-input').value.trim();
        const organism = document.getElementById('alphafold-organism-input').value;
        const resultsDiv = document.getElementById('alphafold-search-results');
        
        if (!geneName) {
            alert('Please enter a gene name');
            return;
        }
        
        resultsDiv.innerHTML = '<div class="loading">Searching AlphaFold database...</div>';
        
        try {
            console.log('Searching AlphaFold for:', geneName, 'in', organism);
            
            // Check if MCP server is connected first
            const chatManager = window.app?.chatManager;
            if (chatManager && chatManager.mcpServerManager) {
                const connectedCount = chatManager.mcpServerManager.getConnectedServersCount();
                console.log(`MCP servers connected: ${connectedCount}`);
                
                if (connectedCount === 0) {
                    console.log('No MCP servers connected, attempting to connect...');
                    try {
                        await chatManager.mcpServerManager.connectToServer('genome-studio');
                        console.log('Successfully connected to MCP server');
                    } catch (connectError) {
                        console.warn('Failed to auto-connect to MCP server:', connectError);
                        resultsDiv.innerHTML = '<div class="error">MCP server not connected. Please connect to MCP server first.</div>';
                        return;
                    }
                }
            }
            
            const results = await this.requestMCPTool('search_alphafold_by_gene', {
                geneName: geneName,
                organism: organism,
                maxResults: 10
            });
            
            console.log('AlphaFold search result:', results);
            
            this.displayAlphaFoldResults(resultsDiv, results.results || []);
            
        } catch (error) {
            console.error('AlphaFold search error:', error);
            resultsDiv.innerHTML = `<div class="error">Error: ${error.message}</div>`;
        }
    }

    /**
     * Display AlphaFold search results
     */
    displayAlphaFoldResults(resultsDiv, results) {
        if (!results || results.length === 0) {
            resultsDiv.innerHTML = '<div class="no-results">No AlphaFold structures found.</div>';
            return;
        }
        
        let html = `<h4>Found ${results.length} AlphaFold structure(s):</h4>`;
        
        for (const result of results) {
            const uniprotId = result.uniprotId;
            const geneName = result.geneName || 'Unknown';
            const proteinName = result.proteinName || 'Unknown protein';
            const organism = result.organism || 'Unknown organism';
            
            html += `
                <div class="alphafold-result-item" onclick="proteinStructureViewer.loadAlphaFoldStructure('${uniprotId}', '${geneName}')">
                    <div class="alphafold-result-title">
                        ${geneName} (${uniprotId})
                    </div>
                    <div class="alphafold-result-details">
                        <strong>Protein:</strong> ${proteinName}<br>
                        <strong>Organism:</strong> ${organism}
                    </div>
                </div>
            `;
        }
        
        resultsDiv.innerHTML = html;
    }

    /**
     * Load AlphaFold structure
     */
    async loadAlphaFoldStructure(uniprotId, geneName) {
        try {
            console.log('Loading AlphaFold structure:', uniprotId, geneName);
            
            const result = await this.requestMCPTool('fetch_alphafold_structure', {
                uniprotId: uniprotId,
                geneName: geneName,
                format: 'pdb'
            });
            
            // Close search dialog
            const searchDialog = document.querySelector('.alphafold-search-dialog');
            if (searchDialog) {
                searchDialog.close();
            }
            
            // Open structure viewer
            this.openStructureViewer(result.structureData, `${geneName} (AlphaFold)`, uniprotId);
            
        } catch (error) {
            console.error('Error loading AlphaFold structure:', error);
            alert(`Failed to load AlphaFold structure: ${error.message}`);
        }
    }

    /**
     * Make a dialog draggable by its header
     */
    makeDraggable(dialog) {
        const header = dialog.querySelector('.draggable-header');
        if (!header) return;

        let isDragging = false;
        let dragOffset = { x: 0, y: 0 };

        const startDrag = (e) => {
            // Only start drag if clicked on header (not on close button)
            if (e.target.classList.contains('close-btn')) return;
            
            isDragging = true;
            dialog.classList.add('dragging');
            
            const rect = dialog.getBoundingClientRect();
            dragOffset.x = e.clientX - rect.left;
            dragOffset.y = e.clientY - rect.top;
            
            // Prevent text selection during drag
            e.preventDefault();
            
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        };

        const doDrag = (e) => {
            if (!isDragging) return;
            
            const x = e.clientX - dragOffset.x;
            const y = e.clientY - dragOffset.y;
            
            // Keep dialog within viewport bounds
            const maxX = window.innerWidth - dialog.offsetWidth;
            const maxY = window.innerHeight - dialog.offsetHeight;
            
            const constrainedX = Math.max(0, Math.min(x, maxX));
            const constrainedY = Math.max(0, Math.min(y, maxY));
            
            dialog.style.left = constrainedX + 'px';
            dialog.style.top = constrainedY + 'px';
            dialog.style.margin = '0';
        };

        const stopDrag = () => {
            if (!isDragging) return;
            
            isDragging = false;
            dialog.classList.remove('dragging');
            
            document.removeEventListener('mousemove', doDrag);
            document.removeEventListener('mouseup', stopDrag);
        };

        // Touch support for mobile devices
        const startTouch = (e) => {
            if (e.target.classList.contains('close-btn')) return;
            
            isDragging = true;
            dialog.classList.add('dragging');
            
            const touch = e.touches[0];
            const rect = dialog.getBoundingClientRect();
            dragOffset.x = touch.clientX - rect.left;
            dragOffset.y = touch.clientY - rect.top;
            
            e.preventDefault();
            
            document.addEventListener('touchmove', doTouchDrag);
            document.addEventListener('touchend', stopTouchDrag);
        };

        const doTouchDrag = (e) => {
            if (!isDragging) return;
            
            const touch = e.touches[0];
            const x = touch.clientX - dragOffset.x;
            const y = touch.clientY - dragOffset.y;
            
            const maxX = window.innerWidth - dialog.offsetWidth;
            const maxY = window.innerHeight - dialog.offsetHeight;
            
            const constrainedX = Math.max(0, Math.min(x, maxX));
            const constrainedY = Math.max(0, Math.min(y, maxY));
            
            dialog.style.left = constrainedX + 'px';
            dialog.style.top = constrainedY + 'px';
            dialog.style.margin = '0';
        };

        const stopTouchDrag = () => {
            if (!isDragging) return;
            
            isDragging = false;
            dialog.classList.remove('dragging');
            
            document.removeEventListener('touchmove', doTouchDrag);
            document.removeEventListener('touchend', stopTouchDrag);
        };

        // Add event listeners for mouse events
        header.addEventListener('mousedown', startDrag);
        
        // Add event listeners for touch events
        header.addEventListener('touchstart', startTouch);
        
        // Reset position when dialog is opened
        dialog.addEventListener('show', () => {
            dialog.style.left = '';
            dialog.style.top = '';
            dialog.style.margin = '';
        });

        console.log('✅ Dialog made draggable');
    }
}

// Initialize the protein structure viewer
const proteinStructureViewer = new ProteinStructureViewer();

// Make it globally available
window.proteinStructureViewer = proteinStructureViewer;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProteinStructureViewer;
} 