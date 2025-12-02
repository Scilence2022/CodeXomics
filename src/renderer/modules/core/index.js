/**
 * Core Extension System - Module Index
 * 
 * This module provides a VS Code-inspired extension architecture for GenomeExplorer.
 * It includes all core components for extension lifecycle management, contribution points,
 * command registration, and sandboxed execution.
 * 
 * @module core
 * @author GenomeExplorer Team
 * @version 2.0.0
 */

// Re-export all core modules
// These should be loaded in the correct order due to dependencies

/**
 * Load order:
 * 1. Disposable - Base resource management (no dependencies)
 * 2. ExtensionContext - Extension lifecycle (uses Disposable)
 * 3. ExtensionHost - Sandboxed execution (uses Disposable)
 * 4. ExtensionManifest - Manifest parsing and validation (no dependencies)
 * 5. ContributionRegistry - Contribution management (no dependencies)
 * 6. ActivationEventsService - Lazy loading (no dependencies)
 * 7. CommandRegistry - Command management (uses Disposable)
 * 8. ExtensionService - Unified service (uses all above)
 */

const CORE_MODULES = [
    'Disposable',
    'ExtensionContext',
    'ExtensionHost',
    'ExtensionManifest',
    'ContributionRegistry',
    'ActivationEventsService',
    'CommandRegistry',
    'ExtensionService'
];

/**
 * CoreExtensionSystem - Facade for the entire extension system
 */
class CoreExtensionSystem {
    constructor() {
        this._isLoaded = false;
        this._loadPromise = null;
        this._modules = {};
    }

    /**
     * Load all core modules
     * @returns {Promise<void>}
     */
    async load() {
        if (this._loadPromise) {
            return this._loadPromise;
        }

        this._loadPromise = this._performLoad();
        return this._loadPromise;
    }

    /**
     * Perform the actual loading
     * @private
     */
    async _performLoad() {
        console.log('Loading Core Extension System modules...');

        for (const moduleName of CORE_MODULES) {
            try {
                // Check if module is already loaded globally
                if (typeof window !== 'undefined' && window[moduleName]) {
                    this._modules[moduleName] = window[moduleName];
                    console.log(`Module loaded: ${moduleName} (from window)`);
                } else {
                    // Try to load via script
                    await this._loadScript(`modules/core/${moduleName}.js`);
                    if (typeof window !== 'undefined' && window[moduleName]) {
                        this._modules[moduleName] = window[moduleName];
                    }
                    console.log(`Module loaded: ${moduleName}`);
                }
            } catch (error) {
                console.error(`Failed to load module ${moduleName}:`, error);
                throw error;
            }
        }

        this._isLoaded = true;
        console.log('Core Extension System loaded successfully');
    }

    /**
     * Load a script dynamically
     * @private
     * @param {string} src 
     * @returns {Promise<void>}
     */
    _loadScript(src) {
        return new Promise((resolve, reject) => {
            if (typeof document === 'undefined') {
                // Node.js environment
                try {
                    require(`./${src.replace('modules/core/', '')}`);
                    resolve();
                } catch (error) {
                    reject(error);
                }
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = false;
            script.onload = () => resolve();
            script.onerror = (error) => reject(error);
            document.head.appendChild(script);
        });
    }

    /**
     * Check if system is loaded
     * @returns {boolean}
     */
    get isLoaded() {
        return this._isLoaded;
    }

    /**
     * Get a specific module
     * @param {string} name 
     * @returns {any}
     */
    getModule(name) {
        return this._modules[name];
    }

    /**
     * Create an ExtensionService instance
     * @param {Object} options 
     * @returns {ExtensionService}
     */
    createExtensionService(options = {}) {
        if (!this._isLoaded) {
            throw new Error('Core Extension System not loaded. Call load() first.');
        }

        return new ExtensionService(options);
    }

    /**
     * Create a ManifestBuilder instance
     * @returns {ManifestBuilder}
     */
    createManifestBuilder() {
        if (!this._isLoaded) {
            throw new Error('Core Extension System not loaded. Call load() first.');
        }

        return new ManifestBuilder();
    }
}

// Create singleton instance
const coreExtensionSystem = new CoreExtensionSystem();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CoreExtensionSystem,
        coreExtensionSystem,
        CORE_MODULES
    };
} else if (typeof window !== 'undefined') {
    window.CoreExtensionSystem = CoreExtensionSystem;
    window.coreExtensionSystem = coreExtensionSystem;
    window.CORE_MODULES = CORE_MODULES;
}
