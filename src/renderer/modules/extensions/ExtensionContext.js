/**
 * ExtensionContext - Standardized extension context
 * Inspired by VS Code's ExtensionContext
 * Provides consistent API for extensions to access resources and services
 */
class ExtensionContext {
    constructor(extension, options = {}) {
        this.extension = extension;
        this.options = options;
        
        // Extension subscriptions for automatic cleanup
        this.subscriptions = [];
        
        // State management
        this.globalState = new Map();
        this.workspaceState = new Map();
        
        // Path management
        this.extensionPath = options.extensionPath || `extensions/${extension.id}`;
        this.storagePath = options.storagePath || `storage/${extension.id}`;
        this.logPath = options.logPath || `logs/${extension.id}`;
        
        // Secret storage (secure storage for API keys, etc.)
        this.secretStorage = new SecretStorage(this.extension.id);
        
        // Extension URI scheme
        this.extensionUri = {
            scheme: 'extension',
            authority: extension.id,
            path: '/',
            fragment: '',
            query: ''
        };
        
        console.log(`ExtensionContext created for: ${extension.id}`);
    }
    
    /**
     * Convert relative path to absolute path within extension directory
     */
    asAbsolutePath(relativePath) {
        if (relativePath.startsWith('/')) {
            return relativePath;
        }
        return `${this.extensionPath}/${relativePath}`;
    }
    
    /**
     * Get extension URI as string
     */
    getExtensionUriString() {
        return `${this.extensionUri.scheme}://${this.extensionUri.authority}${this.extensionUri.path}`;
    }
    
    /**
     * Register disposable resource
     */
    disposeOnDeactivate(disposable) {
        if (typeof disposable === 'function') {
            this.subscriptions.push({ dispose: disposable });
        } else if (disposable && typeof disposable.dispose === 'function') {
            this.subscriptions.push(disposable);
        }
    }
    
    /**
     * Register command
     */
    registerCommand(commandId, callback) {
        const disposable = {
            dispose: () => {
                // Implementation will be provided by ExtensionAPI
            }
        };
        this.subscriptions.push(disposable);
        return disposable;
    }
    
    /**
     * Register event listener
     */
    registerEvent(eventId, callback) {
        const disposable = {
            dispose: () => {
                // Implementation will be provided by ExtensionAPI
            }
        };
        this.subscriptions.push(disposable);
        return disposable;
    }
    
    /**
     * Get context information for debugging
     */
    getDebugInfo() {
        return {
            extensionId: this.extension.id,
            extensionPath: this.extensionPath,
            storagePath: this.storagePath,
            logPath: this.logPath,
            subscriptionCount: this.subscriptions.length
        };
    }
    
    /**
     * Dispose all subscriptions
     */
    dispose() {
        console.log(`Disposing ExtensionContext for: ${this.extension.id}`);
        
        // Dispose all subscriptions in reverse order
        for (let i = this.subscriptions.length - 1; i >= 0; i--) {
            try {
                this.subscriptions[i].dispose();
            } catch (error) {
                console.error(`Error disposing subscription ${i} for ${this.extension.id}:`, error);
            }
        }
        
        // Clear subscriptions
        this.subscriptions = [];
        
        console.log(`ExtensionContext disposed for: ${this.extension.id}`);
    }
}

/**
 * SecretStorage - Secure storage for extension secrets
 * Provides encrypted storage for sensitive information
 */
class SecretStorage {
    constructor(extensionId) {
        this.extensionId = extensionId;
        this.secrets = new Map();
    }
    
    /**
     * Get secret value
     */
    async get(key) {
        // In production, this would use encrypted storage
        return this.secrets.get(key) || null;
    }
    
    /**
     * Store secret value
     */
    async store(key, value) {
        // In production, this would use encrypted storage
        this.secrets.set(key, value);
    }
    
    /**
     * Delete secret value
     */
    async delete(key) {
        // In production, this would use encrypted storage
        return this.secrets.delete(key);
    }
    
    /**
     * Clear all secrets for extension
     */
    async clear() {
        this.secrets.clear();
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ExtensionContext, SecretStorage };
} else if (typeof window !== 'undefined') {
    window.ExtensionContext = ExtensionContext;
    window.SecretStorage = SecretStorage;
}
