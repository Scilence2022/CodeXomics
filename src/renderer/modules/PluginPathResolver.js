/**
 * PluginPathResolver - Production-ready plugin path resolution
 * 
 * Handles path resolution for plugins in both development and production environments.
 * Ensures built-in plugins remain accessible in ASAR archives while providing
 * writable directories for user-installed plugins.
 * 
 * @version 1.0.0
 */

class PluginPathResolver {
    constructor() {
        this._isInitialized = false;
        this._builtinPluginsPath = null;
        this._userPluginsPath = null;
        this._isDevelopment = false;
        this._isElectron = false;
    }

    /**
     * Initialize path resolver
     * Must be called before using any path resolution methods
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this._isInitialized) {
            return;
        }

        try {
            // Detect if running in Electron environment
            this._isElectron = typeof window !== 'undefined' && 
                              typeof window.electronAPI !== 'undefined';

            if (this._isElectron) {
                // Get paths from main process via IPC
                const paths = await window.electronAPI.getPluginPaths();
                this._builtinPluginsPath = paths.builtinPluginsPath;
                this._userPluginsPath = paths.userPluginsPath;
                this._isDevelopment = paths.isDevelopment;
            } else {
                // Fallback for browser/development environment
                this._isDevelopment = true;
                this._builtinPluginsPath = 'src/renderer/modules/Plugins';
                this._userPluginsPath = 'src/renderer/modules/Plugins/UserInstalled';
            }

            // Ensure user plugins directory exists (only in Electron)
            if (this._isElectron && this._userPluginsPath) {
                await this._ensureUserPluginsDirectory();
            }

            this._isInitialized = true;
            console.log('PluginPathResolver initialized:', {
                isDevelopment: this._isDevelopment,
                isElectron: this._isElectron,
                builtinPath: this._builtinPluginsPath,
                userPath: this._userPluginsPath
            });

        } catch (error) {
            console.error('Failed to initialize PluginPathResolver:', error);
            // Use safe defaults
            this._isDevelopment = true;
            this._builtinPluginsPath = 'src/renderer/modules/Plugins';
            this._userPluginsPath = 'src/renderer/modules/Plugins/UserInstalled';
            this._isInitialized = true;
        }
    }

    /**
     * Ensure user plugins directory exists
     * @private
     */
    async _ensureUserPluginsDirectory() {
        try {
            if (this._isElectron && window.electronAPI?.ensureDirectory) {
                await window.electronAPI.ensureDirectory(this._userPluginsPath);
            }
        } catch (error) {
            console.error('Failed to create user plugins directory:', error);
        }
    }

    /**
     * Get the path for built-in plugins
     * These are bundled with the application and read-only
     * @returns {string}
     */
    getBuiltinPluginsPath() {
        if (!this._isInitialized) {
            throw new Error('PluginPathResolver not initialized. Call initialize() first.');
        }
        return this._builtinPluginsPath;
    }

    /**
     * Get the path for user-installed plugins
     * This is a writable directory in the user's data folder
     * @returns {string}
     */
    getUserPluginsPath() {
        if (!this._isInitialized) {
            throw new Error('PluginPathResolver not initialized. Call initialize() first.');
        }
        return this._userPluginsPath;
    }

    /**
     * Get all plugin search paths in priority order
     * Built-in plugins are loaded first, then user plugins
     * @returns {string[]}
     */
    getAllPluginPaths() {
        return [
            this.getBuiltinPluginsPath(),
            this.getUserPluginsPath()
        ];
    }

    /**
     * Determine if a plugin is built-in or user-installed based on its path
     * @param {string} pluginPath 
     * @returns {'builtin' | 'user' | 'unknown'}
     */
    getPluginSource(pluginPath) {
        if (!pluginPath) return 'unknown';
        
        if (pluginPath.includes(this._builtinPluginsPath)) {
            return 'builtin';
        } else if (pluginPath.includes(this._userPluginsPath)) {
            return 'user';
        }
        
        return 'unknown';
    }

    /**
     * Get the installation path for a new plugin
     * @param {string} pluginId 
     * @returns {string}
     */
    getInstallPath(pluginId) {
        if (!pluginId) {
            throw new Error('Plugin ID is required');
        }
        
        // User plugins are always installed to the user plugins directory
        return `${this.getUserPluginsPath()}/${pluginId}`;
    }

    /**
     * Check if running in development mode
     * @returns {boolean}
     */
    isDevelopment() {
        return this._isDevelopment;
    }

    /**
     * Check if running in Electron environment
     * @returns {boolean}
     */
    isElectron() {
        return this._isElectron;
    }

    /**
     * Get plugin manifest path
     * @param {string} pluginId 
     * @param {'builtin' | 'user'} source 
     * @returns {string}
     */
    getManifestPath(pluginId, source = 'user') {
        const basePath = source === 'builtin' 
            ? this.getBuiltinPluginsPath()
            : this.getUserPluginsPath();
        
        return `${basePath}/${pluginId}/plugin.json`;
    }

    /**
     * Convert relative plugin path to absolute
     * @param {string} relativePath 
     * @param {'builtin' | 'user'} source 
     * @returns {string}
     */
    resolve(relativePath, source = 'builtin') {
        const basePath = source === 'builtin'
            ? this.getBuiltinPluginsPath()
            : this.getUserPluginsPath();
        
        return `${basePath}/${relativePath}`;
    }

    /**
     * Get statistics about plugin paths
     * @returns {Object}
     */
    getStats() {
        return {
            initialized: this._isInitialized,
            isDevelopment: this._isDevelopment,
            isElectron: this._isElectron,
            paths: {
                builtin: this._builtinPluginsPath,
                user: this._userPluginsPath
            }
        };
    }
}

// Create singleton instance
const pluginPathResolver = new PluginPathResolver();

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PluginPathResolver,
        pluginPathResolver
    };
} else if (typeof window !== 'undefined') {
    window.PluginPathResolver = PluginPathResolver;
    window.pluginPathResolver = pluginPathResolver;
    console.log('✅ PluginPathResolver singleton registered on window object');
}
