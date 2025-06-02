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
        const dialog = this.createProteinSearchDialog();
        document.body.appendChild(dialog);
        dialog.showModal();
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
        const pdbId = document.getElementById('pdb-id-input').value.trim();
        const resultsDiv = document.getElementById('search-results');

        if (!pdbId) {
            alert('Please enter a PDB ID');
            return;
        }

        resultsDiv.innerHTML = '<div class="loading">Searching for protein structure...</div>';

        try {
            const structureData = await this.requestMCPTool('fetch_protein_structure', {
                pdbId: pdbId
            });

            if (structureData.success) {
                this.openStructureViewer(structureData.pdbData, structureData.geneName, pdbId);
                document.querySelector('.protein-search-dialog').close();
            }

        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">Error searching structure: ${error.message}</div>`;
        }
    }

    /**
     * Open 3D protein structure viewer in new window
     */
    openStructureViewer(pdbData, proteinName, pdbId) {
        const windowId = `protein-${pdbId}-${Date.now()}`;
        
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

        // Initialize NGL viewer after window loads
        viewerWindow.onload = () => {
            this.initializeNGLViewer(viewerWindow, pdbData, proteinName, pdbId);
        };

        this.structureWindows.set(windowId, viewerWindow);
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
                <script src="https://unpkg.com/ngl@2.3.1/dist/ngl.js"></script>
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
                    <div class="loading" id="loading">Loading protein structure...</div>
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
            const NGL = viewerWindow.NGL;
            const stage = new NGL.Stage("viewport", {
                backgroundColor: "white"
            });

            // Add representation controls
            let currentRepresentation = 'cartoon';
            let spinning = false;
            let component = null;

            // Load structure from PDB data
            const blob = new Blob([pdbData], { type: 'text/plain' });
            const file = new File([blob], `${pdbId}.pdb`);

            stage.loadFile(file).then(function(comp) {
                component = comp;
                
                // Add default representation
                comp.addRepresentation(currentRepresentation, {
                    colorScheme: "chainid"
                });
                
                // Auto view
                comp.autoView();
                
                // Hide loading
                viewerWindow.document.getElementById('loading').style.display = 'none';
            }).catch(function(error) {
                console.error('Error loading structure:', error);
                viewerWindow.document.getElementById('loading').textContent = 
                    'Error loading structure: ' + error.message;
            });

            // Add control functions to window
            viewerWindow.resetView = () => {
                if (component) component.autoView();
            };

            viewerWindow.toggleRepresentation = () => {
                if (!component) return;
                
                component.removeAllRepresentations();
                
                const representations = ['cartoon', 'ball+stick', 'spacefill', 'surface', 'backbone'];
                const currentIndex = representations.indexOf(currentRepresentation);
                const nextIndex = (currentIndex + 1) % representations.length;
                currentRepresentation = representations[nextIndex];
                
                component.addRepresentation(currentRepresentation, {
                    colorScheme: "chainid"
                });
            };

            viewerWindow.toggleSpin = () => {
                spinning = !spinning;
                stage.setSpin(spinning);
            };

            viewerWindow.showInfo = () => {
                alert(`Protein: ${proteinName}\nPDB ID: ${pdbId}\nRepresentation: ${currentRepresentation}`);
            };

            // Handle window resize
            viewerWindow.addEventListener('resize', () => {
                stage.handleResize();
            });

        } catch (error) {
            console.error('Error initializing NGL viewer:', error);
            viewerWindow.document.getElementById('loading').textContent = 
                'Error initializing 3D viewer: ' + error.message;
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
        if (window.mcpServerManager && window.mcpServerManager.executeTool) {
            return await window.mcpServerManager.executeTool(toolName, parameters);
        } else {
            throw new Error('MCP Server not connected');
        }
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