/**
 * Genome Studio RPC Handler
 * 
 * This module handles RPC calls from the MCP server and provides direct access
 * to Genome AI Studio functionality without WebSocket overhead.
 */

// Access ipcRenderer without redeclaring
let genomeRPCIpc;
try {
    if (typeof ipcRenderer !== 'undefined') {
        genomeRPCIpc = ipcRenderer;
    } else {
        genomeRPCIpc = require('electron').ipcRenderer;
    }
} catch (e) {
    genomeRPCIpc = require('electron').ipcRenderer;
}

class GenomeStudioRPCHandler {
    constructor() {
        this.modules = {}; // Will be populated with module references
        this.setupIPCListeners();
    }

    // Initialize with module references
    initialize(modules) {
        this.modules = modules;
        console.log('🔧 GenomeStudioRPCHandler initialized with modules:', Object.keys(modules));
    }

    // Setup IPC listeners for RPC calls
    setupIPCListeners() {
        genomeRPCIpc.on('genome-rpc-call', (event, request) => {
            this.handleRPCCall(request);
        });
    }

    // Handle incoming RPC calls
    async handleRPCCall(request) {
        const { requestId, method, parameters } = request;
        
        try {
            console.log(`🔧 RPC Call: ${method}`, parameters);
            
            const result = await this.executeMethod(method, parameters);
            
            // Send success response
            genomeRPCIpc.send('genome-rpc-response', {
                requestId,
                success: true,
                result
            });
            
        } catch (error) {
            console.error(`🚨 RPC Error for method ${method}:`, error);
            
            // Send error response
            genomeRPCIpc.send('genome-rpc-response', {
                requestId,
                success: false,
                error: error.message || 'Unknown RPC error'
            });
        }
    }

    // Execute the requested method
    async executeMethod(method, parameters) {
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

            // Annotation methods
            case 'addAnnotation':
                return await this.addAnnotation(parameters);
            
            case 'exportData':
                return await this.exportData(parameters);

            // File management
            case 'loadFile':
                return await this.loadFile(parameters);
            
            case 'saveProject':
                return await this.saveProject(parameters);

            // Utility methods
            case 'getAvailableMethods':
                return this.getAvailableMethods();
            
            case 'ping':
                return this.ping();

            default:
                throw new Error(`Unknown RPC method: ${method}`);
        }
    }

    // Navigation implementations
    async navigateToPosition({ chromosome, start, end }) {
        if (!this.modules.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        // Navigate to the specified position
        await this.modules.navigationManager.navigateToPosition(chromosome, start, end);
        
        return {
            success: true,
            chromosome,
            start,
            end,
            message: `Navigated to ${chromosome}:${start}-${end}`
        };
    }

    async searchFeatures({ query, featureType }) {
        if (!this.modules.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const results = await this.modules.navigationManager.searchFeatures(query, featureType);
        
        return {
            success: true,
            query,
            featureType,
            results: results || [],
            count: results ? results.length : 0
        };
    }

    async jumpToGene({ geneName }) {
        if (!this.modules.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const result = await this.modules.navigationManager.jumpToGene(geneName);
        
        return {
            success: true,
            geneName,
            result
        };
    }

    async searchGeneByName({ name }) {
        if (!this.modules.navigationManager) {
            throw new Error('NavigationManager not available');
        }
        
        const results = await this.modules.navigationManager.searchGeneByName(name);
        
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
            timestamp: Date.now(),
            modules: Object.keys(this.modules)
        };

        if (this.modules.navigationManager) {
            state.navigation = {
                currentChromosome: this.modules.navigationManager.currentChromosome,
                currentPosition: this.modules.navigationManager.currentPosition,
                zoomLevel: this.modules.navigationManager.zoomLevel
            };
        }

        if (this.modules.fileManager) {
            state.files = {
                loadedFiles: this.modules.fileManager.loadedFiles || [],
                currentGenome: this.modules.fileManager.currentGenome
            };
        }

        if (this.modules.trackRenderer) {
            state.tracks = {
                visibleTracks: this.modules.trackRenderer.visibleTracks || [],
                trackCount: this.modules.trackRenderer.getAllTracks ? this.modules.trackRenderer.getAllTracks().length : 0
            };
        }

        return state;
    }

    async getGenomeInfo() {
        if (!this.modules.fileManager) {
            throw new Error('FileManager not available');
        }

        const genomeInfo = this.modules.fileManager.getGenomeInfo ? 
            this.modules.fileManager.getGenomeInfo() : 
            {
                name: 'Unknown',
                length: 0,
                chromosomes: []
            };

        return {
            success: true,
            genomeInfo
        };
    }

    // Track management implementations
    async toggleTrack({ trackName, visible }) {
        if (!this.modules.trackRenderer) {
            throw new Error('TrackRenderer not available');
        }

        const result = this.modules.trackRenderer.toggleTrack ? 
            await this.modules.trackRenderer.toggleTrack(trackName, visible) :
            { success: false, message: 'toggleTrack method not available' };

        return {
            success: true,
            trackName,
            visible,
            result
        };
    }

    // Sequence analysis implementations
    async getCodingSequence({ geneName, includeUtrs = false }) {
        if (!this.modules.sequenceUtils) {
            throw new Error('SequenceUtils not available');
        }

        const sequence = this.modules.sequenceUtils.getCodingSequence ? 
            await this.modules.sequenceUtils.getCodingSequence(geneName, includeUtrs) :
            null;

        return {
            success: true,
            geneName,
            includeUtrs,
            sequence: sequence || '',
            length: sequence ? sequence.length : 0
        };
    }

    async getSequenceRegion({ chromosome, start, end }) {
        if (!this.modules.sequenceUtils && !this.modules.fileManager) {
            throw new Error('SequenceUtils or FileManager not available');
        }

        let sequence = '';
        
        if (this.modules.sequenceUtils && this.modules.sequenceUtils.getSequenceRegion) {
            sequence = await this.modules.sequenceUtils.getSequenceRegion(chromosome, start, end);
        } else if (this.modules.fileManager && this.modules.fileManager.getSequenceRegion) {
            sequence = await this.modules.fileManager.getSequenceRegion(chromosome, start, end);
        }

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
    getAvailableMethods() {
        return [
            'navigateToPosition',
            'searchFeatures', 
            'jumpToGene',
            'searchGeneByName',
            'getCurrentState',
            'getGenomeInfo',
            'toggleTrack',
            'getCodingSequence',
            'getSequenceRegion',
            'addAnnotation',
            'exportData',
            'loadFile',
            'saveProject',
            'getAvailableMethods',
            'ping'
        ];
    }

    ping() {
        return {
            success: true,
            timestamp: Date.now(),
            message: 'Genome AI Studio RPC is ready',
            modules: Object.keys(this.modules)
        };
    }

    // Placeholder implementations for other methods
    async addAnnotation({ annotation }) {
        return { success: false, message: 'addAnnotation not implemented yet' };
    }

    async exportData({ format, options }) {
        return { success: false, message: 'exportData not implemented yet' };
    }

    async loadFile({ filePath, fileType }) {
        return { success: false, message: 'loadFile not implemented yet' };
    }

    async saveProject({ projectPath }) {
        return { success: false, message: 'saveProject not implemented yet' };
    }
}

module.exports = GenomeStudioRPCHandler;