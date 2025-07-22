/**
 * Internal MCP Server for Genome AI Studio
 * 
 * This runs inside the renderer process and has direct access to all Genome Studio modules.
 * It communicates with the main process MCP server via IPC.
 */

// Access ipcRenderer without redeclaring
let mcpServerIpc;
try {
    if (typeof ipcRenderer !== 'undefined') {
        mcpServerIpc = ipcRenderer;
    } else {
        mcpServerIpc = require('electron').ipcRenderer;
    }
} catch (e) {
    mcpServerIpc = require('electron').ipcRenderer;
}

class InternalMCPServer {
    constructor() {
        this.genomeStudio = null;
        this.isRunning = false;
        this.setupIPCHandlers();
    }

    // Initialize with Genome Studio instance
    initialize(genomeStudioInstance) {
        this.genomeStudio = genomeStudioInstance;
        console.log('🔧 Internal MCP Server initialized with Genome Studio instance');
    }

    // Setup IPC handlers for communication with main process MCP server
    setupIPCHandlers() {
        mcpServerIpc.on('mcp-tool-call', async (event, request) => {
            const { requestId, method, parameters } = request;
            
            try {
                const result = await this.executeMethod(method, parameters);
                
                // Send success response back to main process
                mcpServerIpc.send('mcp-tool-response', {
                    requestId,
                    success: true,
                    result
                });
                
            } catch (error) {
                console.error(`🚨 MCP Tool Error for method ${method}:`, error);
                
                // Send error response back to main process
                mcpServerIpc.send('mcp-tool-response', {
                    requestId,
                    success: false,
                    error: error.message
                });
            }
        });
    }

    // Execute the requested method
    async executeMethod(method, parameters) {
        if (!this.genomeStudio) {
            throw new Error('Genome Studio instance not available');
        }

        switch (method) {
            // Navigation methods
            case 'navigateToPosition':
                return await this.navigateToPosition(parameters);
            
            case 'searchFeatures':
                return await this.searchFeatures(parameters);
            
            case 'jumpToGene':
                return await this.jumpToGene(parameters);
            
            case 'searchGeneByName':
                return await this.searchGeneByName(parameters);

            // State management
            case 'getCurrentState':
                return await this.getCurrentState(parameters);
            
            case 'getGenomeInfo':
                return await this.getGenomeInfo(parameters);

            // Track management
            case 'toggleTrack':
                return await this.toggleTrack(parameters);

            // Sequence analysis
            case 'getCodingSequence':
                return await this.getCodingSequence(parameters);
            
            case 'getSequenceRegion':
                return await this.getSequenceRegion(parameters);

            // Utility methods
            case 'ping':
                return this.ping();

            default:
                throw new Error(`Unknown method: ${method}`);
        }
    }

    // Navigation implementations
    async navigateToPosition({ chromosome, start, end }) {
        if (!this.genomeStudio.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        await this.genomeStudio.navigationManager.navigateToPosition(chromosome, start, end);
        
        return {
            success: true,
            chromosome,
            start,
            end,
            message: `Navigated to ${chromosome}:${start}-${end}`
        };
    }

    async searchFeatures({ query, featureType }) {
        if (!this.genomeStudio.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const results = await this.genomeStudio.navigationManager.searchFeatures(query, featureType);
        
        return {
            success: true,
            query,
            featureType,
            results: results || [],
            count: results ? results.length : 0
        };
    }

    async jumpToGene({ geneName }) {
        if (!this.genomeStudio.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const result = await this.genomeStudio.navigationManager.jumpToGene(geneName);
        
        return {
            success: true,
            geneName,
            result
        };
    }

    async searchGeneByName({ name }) {
        if (!this.genomeStudio.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const results = await this.genomeStudio.navigationManager.searchGeneByName(name);
        
        return {
            success: true,
            geneName: name,
            results: results || [],
            found: results && results.length > 0
        };
    }

    // State management implementations
    async getCurrentState() {
        const state = {
            timestamp: Date.now()
        };

        if (this.genomeStudio.navigationManager) {
            state.navigation = {
                currentChromosome: this.genomeStudio.currentChromosome,
                currentPosition: this.genomeStudio.currentPosition,
                zoomLevel: this.genomeStudio.navigationManager.zoomLevel
            };
        }

        if (this.genomeStudio.fileManager) {
            state.files = {
                loadedFiles: this.genomeStudio.loadedFiles || [],
                currentGenome: this.genomeStudio.fileManager.currentGenome
            };
        }

        if (this.genomeStudio.trackRenderer) {
            state.tracks = {
                visibleTracks: Object.keys(this.genomeStudio.trackVisibility || {}),
                trackVisibility: this.genomeStudio.trackVisibility
            };
        }

        return state;
    }

    async getGenomeInfo() {
        if (!this.genomeStudio.fileManager) {
            throw new Error('FileManager not available');
        }

        const genomeInfo = {
            name: this.genomeStudio.fileManager.currentGenome?.name || 'Unknown',
            length: this.genomeStudio.sequenceLength || 0,
            chromosomes: this.genomeStudio.currentSequence ? Object.keys(this.genomeStudio.currentSequence) : [],
            loadedFiles: this.genomeStudio.loadedFiles || []
        };

        return {
            success: true,
            genomeInfo
        };
    }

    // Track management implementation
    async toggleTrack({ trackName, visible }) {
        if (!this.genomeStudio.trackRenderer) {
            throw new Error('TrackRenderer not available');
        }

        // Update track visibility
        this.genomeStudio.trackVisibility = this.genomeStudio.trackVisibility || {};
        this.genomeStudio.trackVisibility[trackName] = visible;

        // Trigger track re-rendering
        if (this.genomeStudio.trackRenderer.render) {
            await this.genomeStudio.trackRenderer.render();
        }

        return {
            success: true,
            trackName,
            visible,
            message: `Track ${trackName} ${visible ? 'shown' : 'hidden'}`
        };
    }

    // Sequence analysis implementations
    async getCodingSequence({ geneName, includeUtrs = false }) {
        if (!this.genomeStudio.sequenceUtils) {
            throw new Error('SequenceUtils not available');
        }

        const sequence = this.genomeStudio.sequenceUtils.getCodingSequence ? 
            await this.genomeStudio.sequenceUtils.getCodingSequence(geneName, includeUtrs) :
            '';

        return {
            success: true,
            geneName,
            includeUtrs,
            sequence: sequence || '',
            length: sequence ? sequence.length : 0
        };
    }

    async getSequenceRegion({ chromosome, start, end }) {
        if (!this.genomeStudio.currentSequence || !this.genomeStudio.currentSequence[chromosome]) {
            throw new Error(`Sequence for chromosome ${chromosome} not available`);
        }

        const fullSequence = this.genomeStudio.currentSequence[chromosome];
        const sequence = fullSequence.substring(start - 1, end); // Convert to 0-based indexing

        return {
            success: true,
            chromosome,
            start,
            end,
            sequence: sequence || '',
            length: sequence ? sequence.length : 0
        };
    }

    // Utility implementations
    ping() {
        return {
            success: true,
            timestamp: Date.now(),
            message: 'Internal MCP Server is ready',
            genomeStudioReady: !!this.genomeStudio,
            modules: {
                navigationManager: !!this.genomeStudio?.navigationManager,
                fileManager: !!this.genomeStudio?.fileManager,
                trackRenderer: !!this.genomeStudio?.trackRenderer,
                sequenceUtils: !!this.genomeStudio?.sequenceUtils
            }
        };
    }

    // Start the internal server
    start() {
        this.isRunning = true;
        console.log('✅ Internal MCP Server started');
        
        // Notify main process that internal server is ready
        mcpServerIpc.send('internal-mcp-server-ready');
    }

    // Stop the internal server
    stop() {
        this.isRunning = false;
        console.log('🛑 Internal MCP Server stopped');
        
        // Notify main process that internal server is stopped
        mcpServerIpc.send('internal-mcp-server-stopped');
    }

    // Get server status
    getStatus() {
        return {
            running: this.isRunning,
            genomeStudioReady: !!this.genomeStudio,
            modules: this.genomeStudio ? {
                navigationManager: !!this.genomeStudio.navigationManager,
                fileManager: !!this.genomeStudio.fileManager,
                trackRenderer: !!this.genomeStudio.trackRenderer,
                sequenceUtils: !!this.genomeStudio.sequenceUtils
            } : {}
        };
    }
}

module.exports = InternalMCPServer;