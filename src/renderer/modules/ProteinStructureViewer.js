/**
 * Protein Structure Viewer Module
 * Manages 3D protein structure visualization using NGL Viewer
 */

class ProteinStructureViewer {
    constructor() {
        this.structureWindows = new Map(); // Track open structure windows
        this.currentStructures = new Map(); // Track loaded structures
        this.initializeModule();
    }

    initializeModule() {
        console.log('ProteinStructureViewer module initialized');
        
        // Add protein viewer button to UI if it doesn't exist
        this.addProteinViewerButton();
        
        // Listen for protein structure-related messages from MCP server
        this.setupMCPListeners();
    }

    /**
     * Add protein viewer button to the main interface
     */
    addProteinViewerButton() {
        const toolbar = document.querySelector('.toolbar') || document.querySelector('.navigation-controls');
        if (!toolbar) return;

        // Check if button already exists
        if (document.getElementById('protein-viewer-btn')) return;

        const proteinBtn = document.createElement('button');
        proteinBtn.id = 'protein-viewer-btn';
        proteinBtn.className = 'btn';
        proteinBtn.innerHTML = '<i class="fas fa-cube"></i> 3D Proteins';
        proteinBtn.title = 'Open Protein Structure Viewer';
        proteinBtn.onclick = () => this.showProteinSearchDialog();
        
        toolbar.appendChild(proteinBtn);
    }

    /**
     * Show dialog to search for protein structures
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
                <div class="dialog-header">
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
            `;
            document.head.appendChild(style);
        }

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
        const windowId = `protein-${pdbId}-${Date.now()}`;
        
        console.log('Opening protein structure viewer for:', pdbId);
        console.log('PDB data length:', pdbData ? pdbData.length : 'No data');
        
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
                viewerWindow.document.getElementById('loading').textContent = 
                    'Error: NGL library failed to load. Please check your internet connection.';
                return;
            }

            const NGL = viewerWindow.NGL;
            console.log('NGL library loaded successfully');
            
            // Check if viewport element exists
            const viewportElement = viewerWindow.document.getElementById('viewport');
            if (!viewportElement) {
                console.error('Viewport element not found');
                viewerWindow.document.getElementById('loading').textContent = 
                    'Error: Viewport element not found';
                return;
            }

            const stage = new NGL.Stage(viewportElement, {
                backgroundColor: "white"
            });

            console.log('NGL stage created');

            // Add representation controls
            let currentRepresentation = 'cartoon';
            let spinning = false;
            let component = null;

            // Validate PDB data
            if (!pdbData || pdbData.length === 0) {
                console.error('No PDB data provided');
                viewerWindow.document.getElementById('loading').textContent = 
                    'Error: No protein structure data received';
                return;
            }

            console.log('Loading PDB data...');
            
            // Load structure from PDB string data directly
            // Use NGL's built-in string loading method
            const stringBlob = new Blob([pdbData], { type: 'text/plain' });
            const dataUrl = URL.createObjectURL(stringBlob);
            
            stage.loadFile(dataUrl, { ext: 'pdb' })
                .then(function(comp) {
                    console.log('PDB structure loaded successfully');
                    component = comp;
                    
                    // Clean up the object URL
                    URL.revokeObjectURL(dataUrl);
                    
                    // Add default representation
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
                    
                }).catch(function(error) {
                    console.error('Error loading PDB structure:', error);
                    
                    // Clean up the object URL in case of error
                    URL.revokeObjectURL(dataUrl);
                    
                    const loadingElement = viewerWindow.document.getElementById('loading');
                    if (loadingElement) {
                        loadingElement.textContent = 
                            'Error loading structure: ' + error.message + 
                            ' (Check console for details)';
                    }
                });

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
        }
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
        
        // Try MCPServerManager.executeTool first
        if (mcpManager && mcpManager.executeTool) {
            try {
                return await mcpManager.executeTool(toolName, parameters);
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
}

// Initialize the protein structure viewer
const proteinStructureViewer = new ProteinStructureViewer();

// Make it globally available
window.proteinStructureViewer = proteinStructureViewer;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProteinStructureViewer;
} 