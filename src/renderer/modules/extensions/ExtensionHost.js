/**
 * ExtensionHost - The core extension execution environment
 * Inspired by VS Code's Extension Host architecture
 * Provides isolated execution environment for plugins
 */
class ExtensionHost {
    constructor(app, configManager, options = {}) {
        this.app = app;
        this.configManager = configManager;
        this.options = {
            enableProcessIsolation: true,
            maxConcurrentExtensions: 10,
            extensionTimeout: 30000, // 30s timeout for extension operations
            ...options
        };
        
        // Core components
        this.rpcProtocol = null;
        this.extensionRegistry = new Map();
        this.extensionContexts = new Map();
        this.activationEvents = new Map();
        this.activeExtensions = new Set();
        
        // Process isolation
        this.extensionProcesses = new Map();
        this.processPool = [];
        this.maxProcesses = options.maxConcurrentExtensions || 10;
        
        // State management
        this.isRunning = false;
        this.startupPromise = null;
        
        // Performance metrics
        this.metrics = {
            extensionsLoaded: 0,
            activationTime: 0,
            activeExtensionCount: 0,
            totalRpcCalls: 0,
            processSpawns: 0,
            processFailures: 0
        };
        
        console.log('ExtensionHost initialized with options:', this.options);
    }
    
    /**
     * Start the extension host
     */
    async start() {
        if (this.isRunning) {
            return;
        }
        
        try {
            console.log('🚀 Starting ExtensionHost...');
            const startTime = performance.now();
            
            // Initialize RPC protocol
            const RPCProtocol = require('./RPCProtocol');
            this.rpcProtocol = new RPCProtocol();
            
            // Initialize process pool if process isolation is enabled
            if (this.options.enableProcessIsolation) {
                await this.initializeProcessPool();
            }
            
            // Load installed extensions
            await this.loadExtensions();
            
            this.isRunning = true;
            this.metrics.activationTime = performance.now() - startTime;
            
            console.log('✅ ExtensionHost started successfully');
            console.log(`📊 Loaded ${this.metrics.extensionsLoaded} extensions`);
            
        } catch (error) {
            console.error('❌ ExtensionHost failed to start:', error);
            throw error;
        }
    }

    /**
     * Setup extension activation event listeners
     */
    setupActivationEventListeners() {
        console.log('🔔 Setting up activation event listeners...');
        // In a real implementation, this would setup various event listeners
        // for activation events like onLanguage, onCommand, onView, etc.
    }
    
    /**
     * Initialize process pool for isolated extension execution
     */
    async initializeProcessPool() {
        console.log(`🔧 Initializing process pool with ${this.maxProcesses} processes...`);
        
        // In Electron renderer process, we need to use the main process for spawning child processes
        // This is a simplified implementation - in production, we'd use Electron's IPC to communicate with main process
        
        // Check if we're in Electron renderer process
        if (typeof window !== 'undefined' && window.require) {
            try {
                const { ipcRenderer } = window.require('electron');
                this.ipcRenderer = ipcRenderer;
                
                // Setup IPC listeners for process management
                this.ipcRenderer.on('extension-process-message', (event, message) => {
                    this.handleProcessMessage(message);
                });
                
                this.ipcRenderer.on('extension-process-exited', (event, { processId, exitCode, signal }) => {
                    this.handleProcessExit(processId, exitCode, signal);
                });
                
                console.log('✅ Process pool initialized with IPC communication');
            } catch (error) {
                console.warn('⚠️  Failed to initialize IPC for process isolation:', error);
                console.warn('📌 Falling back to non-isolated mode');
                this.options.enableProcessIsolation = false;
            }
        }
    }
    
    /**
     * Create isolated process for extension execution
     */
    async createExtensionProcess(extension) {
        if (!this.options.enableProcessIsolation) {
            return null;
        }
        
        try {
            this.metrics.processSpawns++;
            
            // In production, this would spawn a real child process
            // For now, we'll create a mock process object
            const processId = `ext-process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            const extensionProcess = {
                id: processId,
                extensionId: extension.id,
                status: 'running',
                startTime: Date.now(),
                rpcChannel: null,
                exitCode: null
            };
            
            this.extensionProcesses.set(extension.id, extensionProcess);
            this.processPool.push(extensionProcess);
            
            console.log(`✅ Created extension process: ${processId} for ${extension.id}`);
            return extensionProcess;
            
        } catch (error) {
            this.metrics.processFailures++;
            console.error(`❌ Failed to create process for ${extension.id}:`, error);
            throw error;
        }
    }
    
    /**
     * Handle message from extension process
     */
    handleProcessMessage(message) {
        // Forward message to RPC protocol
        if (this.rpcProtocol && message.type) {
            this.rpcProtocol.handleIncomingMessage({ data: JSON.stringify(message) });
        }
    }
    
    /**
     * Handle extension process exit
     */
    handleProcessExit(processId, exitCode, signal) {
        console.log(`💀 Extension process exited: ${processId}, code: ${exitCode}, signal: ${signal}`);
        
        // Find and clean up process
        for (const [extensionId, process] of this.extensionProcesses) {
            if (process.id === processId) {
                this.extensionProcesses.delete(extensionId);
                this.processPool = this.processPool.filter(p => p.id !== processId);
                break;
            }
        }
        
        // If the process exited unexpectedly, we should reactivate the extension
        if (exitCode !== 0 && signal === null) {
            console.warn(`⚠️  Extension process crashed, will attempt to restart`);
        }
    }
    
    /**
     * Stop the extension host
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        try {
            console.log('⏹️ Stopping ExtensionHost...');
            
            // Deactivate all active extensions
            await this.deactivateAllExtensions();
            
            // Cleanup resources
            this.rpcProtocol.dispose();
            this.extensionRegistry.clear();
            this.extensionContexts.clear();
            this.activationEvents.clear();
            this.activeExtensions.clear();
            
            this.isRunning = false;
            console.log('✅ ExtensionHost stopped successfully');
            
        } catch (error) {
            console.error('❌ ExtensionHost failed to stop cleanly:', error);
        }
    }
    
    /**
     * Load all installed extensions
     */
    async loadExtensions() {
        console.log('📦 Loading extensions...');
        
        // In future, this would load from extensions directory
        // For now, we'll simulate loading built-in extensions
        const extensions = this.getBuiltinExtensions();
        
        for (const extension of extensions) {
            await this.loadExtension(extension);
        }
    }
    
    /**
     * Load extension metadata and register activation events
     * This implements lazy loading - full extension activation happens on event trigger
     */
    async loadExtension(extension) {
        try {
            console.log(`📂 Loading extension metadata: ${extension.id}@${extension.version}`);
            
            // Only load metadata initially for lazy loading
            const extensionMetadata = {
                id: extension.id,
                name: extension.name,
                version: extension.version,
                publisher: extension.publisher,
                description: extension.description,
                activationEvents: extension.activationEvents || [],
                contributes: extension.contributes || {},
                permissions: extension.permissions || [],
                main: extension.main,
                browser: extension.browser,
                engines: extension.engines
            };
            
            // Create and store extension context (minimal version for now)
            const context = this.createExtensionContext(extensionMetadata);
            this.extensionContexts.set(extension.id, context);
            
            // Register extension in registry
            this.extensionRegistry.set(extension.id, extensionMetadata);
            
            // Register activation events
            this.registerActivationEvents(extensionMetadata);
            
            this.metrics.extensionsLoaded++;
            
            console.log(`✅ Extension metadata loaded: ${extension.id}`);
            
        } catch (error) {
            console.error(`❌ Failed to load extension metadata ${extension.id}:`, error);
        }
    }
    
    /**
     * Full extension activation - load the actual extension code
     */
    async fullyActivateExtension(extensionId) {
        try {
            const extensionMetadata = this.extensionRegistry.get(extensionId);
            if (!extensionMetadata) {
                throw new Error(`Extension not found: ${extensionId}`);
            }
            
            console.log(`📦 Fully activating extension: ${extensionId}`);
            
            // Load the actual extension module
            let extensionModule;
            try {
                // In a real system, this would use the extension's main entry point
                // For now, we'll simulate loading
                extensionModule = {
                    activate: async (context) => {
                        console.log(`Extension ${extensionId} activated`);
                        // Extension would register its commands, providers, etc. here
                    },
                    deactivate: async () => {
                        console.log(`Extension ${extensionId} deactivated`);
                    }
                };
            } catch (loadError) {
                console.error(`❌ Failed to load extension module ${extensionId}:`, loadError);
                throw loadError;
            }
            
            // Store the loaded module
            extensionMetadata.module = extensionModule;
            
            // Get extension context
            const context = this.extensionContexts.get(extensionId);
            
            // Call extension's activate method
            if (extensionModule.activate) {
                await extensionModule.activate(context);
            }
            
            console.log(`✅ Extension fully activated: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to fully activate extension ${extensionId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create extension context using ExtensionContext class
     */
    createExtensionContext(extension) {
        const { ExtensionContext } = require('./ExtensionContext');
        return new ExtensionContext(extension, {
            extensionPath: `extensions/${extension.id}`,
            storagePath: `storage/${extension.id}`,
            logPath: `logs/${extension.id}`
        });
    }
    
    /**
     * Register activation events for extension
     */
    registerActivationEvents(extension) {
        if (!extension.activationEvents) {
            return;
        }
        
        for (const event of extension.activationEvents) {
            if (!this.activationEvents.has(event)) {
                this.activationEvents.set(event, new Set());
            }
            this.activationEvents.get(event).add(extension.id);
        }
    }
    
    /**
     * Activate extension when activation event is triggered
     * Implements lazy loading - full activation only happens when needed
     */
    async activateExtension(extensionId) {
        if (this.activeExtensions.has(extensionId)) {
            return;
        }
        
        try {
            const extension = this.extensionRegistry.get(extensionId);
            if (!extension) {
                throw new Error(`Extension not found: ${extensionId}`);
            }
            
            console.log(`🚀 Activating extension: ${extensionId}`);
            
            // Create isolated process if enabled
            if (this.options.enableProcessIsolation) {
                await this.createExtensionProcess(extension);
            }
            
            // Fully activate the extension (load the actual code)
            await this.fullyActivateExtension(extensionId);
            
            // Add to active extensions
            this.activeExtensions.add(extensionId);
            this.metrics.activeExtensionCount = this.activeExtensions.size;
            
            console.log(`✅ Extension activated: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to activate extension ${extensionId}:`, error);
        }
    }
    
    /**
     * Deactivate extension and clean up resources
     */
    async deactivateExtension(extensionId) {
        if (!this.activeExtensions.has(extensionId)) {
            return;
        }
        
        try {
            console.log(`⏹️ Deactivating extension: ${extensionId}`);
            
            const extension = this.extensionRegistry.get(extensionId);
            if (extension) {
                // Call extension's deactivate method if it exists
                if (extension.module && extension.module.deactivate) {
                    await extension.module.deactivate();
                }
                
                // Clean up extension module
                if (extension.module) {
                    delete extension.module;
                }
            }
            
            // Cleanup extension process if it exists
            if (this.extensionProcesses.has(extensionId)) {
                const process = this.extensionProcesses.get(extensionId);
                // In real implementation, we would terminate the process
                this.extensionProcesses.delete(extensionId);
                this.processPool = this.processPool.filter(p => p.extensionId !== extensionId);
            }
            
            // Cleanup subscriptions
            const context = this.extensionContexts.get(extensionId);
            if (context) {
                context.dispose();
            }
            
            // Remove from active extensions
            this.activeExtensions.delete(extensionId);
            this.metrics.activeExtensionCount = this.activeExtensions.size;
            
            console.log(`✅ Extension deactivated: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to deactivate extension ${extensionId}:`, error);
        }
    }
    
    /**
     * Deactivate all active extensions
     */
    async deactivateAllExtensions() {
        for (const extensionId of this.activeExtensions) {
            await this.deactivateExtension(extensionId);
        }
    }
    
    /**
     * Fire activation event and activate all listening extensions
     */
    async fireActivationEvent(eventName, payload = {}) {
        console.log(`🔥 Activation event fired: ${eventName}`);
        
        const extensionsToActivate = this.activationEvents.get(eventName) || new Set();
        
        for (const extensionId of extensionsToActivate) {
            await this.activateExtension(extensionId);
        }
    }
    
    /**
     * Get built-in extensions (temporary implementation)
     */
    getBuiltinExtensions() {
        return [
            {
                id: 'genome-explorer.genomic-analysis',
                name: 'Genomic Analysis Suite',
                version: '2.0.0',
                publisher: 'GenomeExplorerTeam',
                description: 'Core genomic analysis functions',
                main: './genomicAnalysisExtension.js',
                activationEvents: ['onLanguage:fasta', 'onCommand:genomic.analyzeGCContent'],
                contributes: {
                    commands: [
                        {
                            command: 'genomic.analyzeGCContent',
                            title: 'Analyze GC Content',
                            category: 'Genomic Analysis'
                        }
                    ]
                }
            }
        ];
    }
    
    /**
     * Get extension host metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            isRunning: this.isRunning,
            extensionCount: this.extensionRegistry.size
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionHost;
} else if (typeof window !== 'undefined') {
    window.ExtensionHost = ExtensionHost;
}
