/**
 * PluginSystemBootstrap - Modern extension system initialization for GenomeExplorer
 * Provides clean startup and initialization for the VS Code-inspired extension system
 */
class PluginSystemBootstrap {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.requiredModules = [
            "ExtensionManager",
            "ExtensionHost",
            "ExtensionAPIProxy",
            "RPCProtocol",
            "ExtensionContext",
            "ExtensionManifest",
            "SecurityManager",
            "LifecycleManager"
        ];
        
        console.log("🚀 PluginSystemBootstrap initialized");
    }

    /**
     * Initialize the complete extension system
     */
    async initialize(app, configManager = null) {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization(app, configManager);
        return this.initializationPromise;
    }

    /**
     * Perform the actual initialization
     */
    async _performInitialization(app, configManager) {
        try {
            console.log("🔧 Starting VS Code-inspired extension system initialization...");

            // 1. Import all required modules
            const ExtensionManager = require('./extensions/ExtensionManager');
            
            // 2. Initialize the new ExtensionManager
            const extensionManager = new ExtensionManager(app, configManager, {
                enableExtensionHost: true,
                enableMarketplace: true,
                enableAutoUpdates: true,
                enableSecurityValidation: true
            });

            // 3. Initialize the extension system
            await extensionManager.initialize();

            // 4. Set global references
            if (typeof window !== "undefined") {
                window.extensionManager = extensionManager;
                window.pluginManagerV2 = extensionManager; // Keep backwards compatibility
            }

            this.isInitialized = true;
            console.log("✅ VS Code-inspired extension system initialization complete");
            
            return {
                extensionManager,
                success: true,
                message: "Extension system initialized successfully"
            };

        } catch (error) {
            console.error("❌ Extension system initialization failed:", error);
            throw new Error(`Extension system initialization failed: ${error.message}`);
        }
    }
}

// Export for use
if (typeof module !== "undefined" && module.exports) {
    // CommonJS export for Node.js testing
    module.exports = PluginSystemBootstrap;
} else if (typeof window !== "undefined") {
    // Browser export for global access
    window.PluginSystemBootstrap = PluginSystemBootstrap;
}
