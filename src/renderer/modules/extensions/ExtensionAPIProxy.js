/**
 * ExtensionAPIProxy - Proxy-based extension API
 * Inspired by VS Code's API proxy pattern
 * Intercepts API calls and routes them through RPC for process isolation
 */

/**
 * API Proxy Handler - Intercepts all API calls
 */
class APIProxyHandler {
    constructor(rpcProtocol, apiName, permissions = {}) {
        this.rpcProtocol = rpcProtocol;
        this.apiName = apiName;
        this.permissions = permissions;
        this.methodCache = new Map();
        
        console.log(`Created API proxy handler for ${apiName}`);
    }
    
    /**
     * Intercept property access
     */
    get(target, property, receiver) {
        // Handle special properties
        if (property === '__proto__' || property === 'constructor' || property === 'toString') {
            return Reflect.get(target, property, receiver);
        }
        
        // If it's a property (not a function), return directly
        if (typeof target[property] !== 'function') {
            return target[property];
        }
        
        // If we already have a cached proxy for this method, return it
        if (this.methodCache.has(property)) {
            return this.methodCache.get(property);
        }
        
        // Create a proxy function that will be called over RPC
        const proxyMethod = async (...args) => {
            // Check permission
            const permission = `${this.apiName}.${property}`;
            this.checkPermission(permission);
            
            // Create RPC call
            const method = `${this.apiName}.${property}`;
            return this.rpcProtocol.invoke(method, { args });
        };
        
        // Cache the proxy method for future use
        this.methodCache.set(property, proxyMethod);
        
        return proxyMethod;
    }
    
    /**
     * Check if extension has required permission
     */
    checkPermission(permission) {
        if (!this.permissions[permission] && !this.permissions['*']) {
            throw new Error(`Permission denied: ${permission}`);
        }
    }
}

/**
 * ExtensionAPI - Main extension API class that uses proxies
 * Provides structured API access with process isolation
 */
class ExtensionAPI {
    constructor(app, rpcProtocol, permissions = {}) {
        this.app = app;
        this.rpcProtocol = rpcProtocol;
        this.permissions = permissions;
        
        // Create API modules with proxies
        this.genome = this.createAPIProxy('genome', {
            getSequence: async (chromosome, start, end, options = {}) => {
                // Actual implementation for main process
                return this.app.genomeBrowser?.getSequence(chromosome, start, end, options);
            },
            getChromosomeLength: async (chromosome) => {
                return this.app.genomeBrowser?.getChromosomeLength(chromosome);
            },
            getCurrentState: async () => {
                return this.app.genomeBrowser?.getCurrentState();
            }
        });
        
        this.annotations = this.createAPIProxy('annotations', {
            getAnnotations: async (region, filters = {}) => {
                return this.app.genomeBrowser?.getAnnotations(region, filters);
            },
            searchAnnotations: async (query, options = {}) => {
                return this.app.genomeBrowser?.searchAnnotations(query, options);
            }
        });
        
        this.tracks = this.createAPIProxy('tracks', {
            getTrackData: async (trackName, region = null) => {
                return this.app.genomeBrowser?.getTrackData(trackName, region);
            },
            createTrack: async (trackDefinition) => {
                return this.app.genomeBrowser?.createTrack(trackDefinition);
            }
        });
        
        this.ui = this.createAPIProxy('ui', {
            showInformationMessage: async (message, options = {}) => {
                return this.app.showInformationMessage?.(message, options);
            },
            showErrorMessage: async (message, options = {}) => {
                return this.app.showErrorMessage?.(message, options);
            },
            showInputBox: async (options = {}) => {
                return this.app.showInputBox?.(options);
            }
        });
        
        this.fs = this.createAPIProxy('fs', {
            readFile: async (path, options = {}) => {
                // File system access with permission checks
                this.checkPermission('fs.read');
                const fs = require('fs').promises;
                return fs.readFile(path, options);
            },
            writeFile: async (path, data, options = {}) => {
                this.checkPermission('fs.write');
                const fs = require('fs').promises;
                return fs.writeFile(path, data, options);
            },
            exists: async (path) => {
                this.checkPermission('fs.read');
                const fs = require('fs').promises;
                try {
                    await fs.access(path);
                    return true;
                } catch {
                    return false;
                }
            }
        });
        
        console.log('ExtensionAPI initialized with proxy pattern');
    }
    
    /**
     * Create API proxy for a specific module
     */
    createAPIProxy(apiName, implementation) {
        // If we have an RPC protocol, create a proxy that routes calls through RPC
        if (this.rpcProtocol) {
            const proxyHandler = new APIProxyHandler(this.rpcProtocol, apiName, this.permissions);
            return new Proxy(implementation, proxyHandler);
        }
        
        // Otherwise, return the direct implementation (for non-isolated mode)
        return implementation;
    }
    
    /**
     * Register API methods with RPC protocol
     */
    registerAPIMethods() {
        if (!this.rpcProtocol) {
            return;
        }
        
        // Register all API methods with the RPC protocol
        this._registerModuleMethods('genome', this.genome);
        this._registerModuleMethods('annotations', this.annotations);
        this._registerModuleMethods('tracks', this.tracks);
        this._registerModuleMethods('ui', this.ui);
        this._registerModuleMethods('fs', this.fs);
        
        console.log('Registered all API methods with RPC protocol');
    }
    
    /**
     * Register methods for a specific module
     */
    _registerModuleMethods(moduleName, module) {
        for (const [methodName, method] of Object.entries(module)) {
            if (typeof method === 'function') {
                const fullMethodName = `${moduleName}.${methodName}`;
                this.rpcProtocol.registerMethod(fullMethodName, async ({ args }) => {
                    try {
                        return await method(...args);
                    } catch (error) {
                        console.error(`Error in ${fullMethodName}:`, error);
                        throw error;
                    }
                });
            }
        }
    }
    
    /**
     * Check permission for direct calls
     */
    checkPermission(permission) {
        if (!this.permissions[permission] && !this.permissions['*']) {
            throw new Error(`Permission denied: ${permission}`);
        }
    }
    
    /**
     * Update permissions
     */
    updatePermissions(newPermissions) {
        this.permissions = { ...this.permissions, ...newPermissions };
        console.log('ExtensionAPI permissions updated:', this.permissions);
    }
    
    /**
     * Get API stats
     */
    getStats() {
        return {
            modules: ['genome', 'annotations', 'tracks', 'ui', 'fs'],
            permissions: Object.keys(this.permissions).filter(p => this.permissions[p]),
            hasRpc: !!this.rpcProtocol
        };
    }
}

/**
 * Factory function to create ExtensionAPI instances
 */
function createExtensionAPI(app, rpcProtocol, permissions = {}) {
    return new ExtensionAPI(app, rpcProtocol, permissions);
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionAPI,
        APIProxyHandler,
        createExtensionAPI
    };
} else if (typeof window !== 'undefined') {
    window.ExtensionAPI = ExtensionAPI;
    window.APIProxyHandler = APIProxyHandler;
    window.createExtensionAPI = createExtensionAPI;
}
