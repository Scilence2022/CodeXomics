/**
 * PluginSystemBootstrap - Modern plugin system initialization for GenomeExplorer
 * Provides clean startup and initialization for PluginManagerV2 with marketplace
 */
class PluginSystemBootstrap {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
        this.requiredModules = [
            "PluginAPI",
            "PluginResourceManager", 
            "PluginMarketplace",
            "PluginDependencyResolver",
            "PluginSecurityValidator",
            "PluginUpdateManager",
            "PluginManagerV2",
            "PluginMarketplaceUI"
        ];
        
        console.log("🚀 PluginSystemBootstrap initialized");
    }

    /**
     * Initialize the complete plugin system
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
            console.log("🔧 Starting PluginManagerV2 system initialization...");

            // 1. Load all required modules
            await this.loadAllModules();
            
            // 2. Verify all modules are available
            this.verifyModulesLoaded();
            
            // 3. Initialize PluginManagerV2
            const pluginManager = new PluginManagerV2(app, configManager, {
                enableResourceManagement: true,
                enableMarketplace: true,
                enableSecurityValidation: true,
                enableDependencyResolution: true,
                enableAutoUpdates: true,
                enableCaching: true
            });

            // 4. Wait for complete initialization
            await new Promise(resolve => {
                const checkInit = () => {
                    if (pluginManager.isInitialized) {
                        resolve();
                    } else {
                        setTimeout(checkInit, 100);
                    }
                };
                setTimeout(checkInit, 100);
            });

            // 5. Initialize Plugin Management UI
            const pluginManagementUI = new PluginManagementUI(pluginManager, configManager);
            
            // 6. Set global references
            if (typeof window !== "undefined") {
                window.pluginManagerV2 = pluginManager;
                window.pluginManagementUI = pluginManagementUI;
            }

            this.isInitialized = true;
            console.log("✅ PluginManagerV2 system initialization complete");
            
            return {
                pluginManager,
                pluginManagementUI,
                success: true,
                message: "Plugin system initialized successfully"
            };

        } catch (error) {
            console.error("❌ Plugin system initialization failed:", error);
            throw new Error(`Plugin system initialization failed: ${error.message}`);
        }
    }
}

// Export for use
if (typeof window !== "undefined") {
    window.PluginSystemBootstrap = PluginSystemBootstrap;
}
