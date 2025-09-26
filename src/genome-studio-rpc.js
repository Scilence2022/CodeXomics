/**
 * CodeXomics RPC Interface
 * 
 * This module provides direct RPC access to CodeXomics functionality
 * without requiring WebSocket connections. It uses Electron's IPC mechanism
 * for efficient local communication.
 */

const { ipcMain, BrowserWindow } = require('electron');
const { EventEmitter } = require('events');

class GenomeStudioRPC extends EventEmitter {
    constructor() {
        super();
        this.mainWindow = null;
        this.pendingRequests = new Map(); // requestId -> { resolve, reject, timeout }
        this.initialized = false;
    }

    // Initialize the RPC system
    initialize() {
        if (this.initialized) return;
        if (!ipcMain) {
            console.warn('ipcMain not available, RPC initialization deferred');
            return;
        }
        this.setupIPCHandlers();
        this.initialized = true;
    }

    // Set the main window reference
    setMainWindow(mainWindow) {
        this.mainWindow = mainWindow;
        
        // Listen for responses from the renderer process
        this.mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
            if (channel === 'genome-rpc-response') {
                this.handleResponse(args[0]);
            }
        });
    }

    // Setup IPC handlers for RPC communication
    setupIPCHandlers() {
        // Handle RPC calls from the unified MCP server
        ipcMain.handle('genome-rpc-call', async (event, method, parameters) => {
            return await this.call(method, parameters);
        });

        // Handle responses from renderer process
        ipcMain.on('genome-rpc-response', (event, response) => {
            this.handleResponse(response);
        });
    }

    // Make an RPC call to CodeXomics
    async call(method, parameters = {}, timeout = 30000) {
        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
            throw new Error('CodeXomics is not running or main window is not available');
        }

        const requestId = this.generateRequestId();
        
        return new Promise((resolve, reject) => {
            // Set up timeout
            const timeoutHandle = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error(`RPC call timeout for method: ${method}`));
            }, timeout);

            // Store the request
            this.pendingRequests.set(requestId, {
                resolve,
                reject,
                timeout: timeoutHandle,
                method,
                parameters
            });

            // Send the RPC call to renderer process
            this.mainWindow.webContents.send('genome-rpc-call', {
                requestId,
                method,
                parameters
            });
        });
    }

    // Handle response from renderer process
    handleResponse(response) {
        const { requestId, success, result, error } = response;
        
        const pendingRequest = this.pendingRequests.get(requestId);
        if (!pendingRequest) {
            console.warn(`Received response for unknown request ID: ${requestId}`);
            return;
        }

        // Clear timeout and remove from pending requests
        clearTimeout(pendingRequest.timeout);
        this.pendingRequests.delete(requestId);

        // Resolve or reject the promise
        if (success) {
            pendingRequest.resolve(result);
        } else {
            pendingRequest.reject(new Error(error || 'Unknown RPC error'));
        }
    }

    // Generate unique request ID
    generateRequestId() {
        return `rpc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Navigation methods
    async navigateToPosition(chromosome, start, end) {
        return await this.call('navigateToPosition', { chromosome, start, end });
    }

    async searchFeatures(query, featureType = null) {
        return await this.call('searchFeatures', { query, featureType });
    }

    async jumpToGene(geneName) {
        return await this.call('jumpToGene', { geneName });
    }

    async searchGeneByName(name) {
        return await this.call('searchGeneByName', { name });
    }

    // State management methods
    async getCurrentState() {
        return await this.call('getCurrentState');
    }

    async getGenomeInfo() {
        return await this.call('getGenomeInfo');
    }

    // Track management methods
    async toggleTrack(trackName, visible) {
        return await this.call('toggleTrack', { trackName, visible });
    }

    // Sequence analysis methods
    async getCodingSequence(geneName, includeUtrs = false) {
        return await this.call('getCodingSequence', { geneName, includeUtrs });
    }

    async getSequenceRegion(chromosome, start, end) {
        return await this.call('getSequenceRegion', { chromosome, start, end });
    }

    // Annotation methods
    async addAnnotation(annotation) {
        return await this.call('addAnnotation', { annotation });
    }

    async exportData(format, options = {}) {
        return await this.call('exportData', { format, options });
    }

    // File management methods
    async loadFile(filePath, fileType = null) {
        return await this.call('loadFile', { filePath, fileType });
    }

    async saveProject(projectPath) {
        return await this.call('saveProject', { projectPath });
    }

    // Utility methods
    async getAvailableMethods() {
        return await this.call('getAvailableMethods');
    }

    async ping() {
        return await this.call('ping');
    }

    // Check if CodeXomics is ready for RPC calls
    isReady() {
        return this.mainWindow && !this.mainWindow.isDestroyed() && !this.mainWindow.webContents.isLoading();
    }

    // Get current status
    getStatus() {
        return {
            ready: this.isReady(),
            pendingRequests: this.pendingRequests.size,
            windowExists: !!this.mainWindow,
            windowDestroyed: this.mainWindow ? this.mainWindow.isDestroyed() : true
        };
    }

    // Clean up resources
    destroy() {
        // Clear all pending requests
        for (const [requestId, pendingRequest] of this.pendingRequests) {
            clearTimeout(pendingRequest.timeout);
            pendingRequest.reject(new Error('RPC interface destroyed'));
        }
        this.pendingRequests.clear();
        
        // Remove event listeners
        this.removeAllListeners();
    }
}

// Export singleton instance
module.exports = new GenomeStudioRPC();