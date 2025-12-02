/**
 * LifecycleManager - Comprehensive extension lifecycle management
 * Inspired by VS Code's extension lifecycle system
 * Handles extension installation, activation, deactivation, updating, and uninstallation
 */

// Extension states inspired by VS Code
const EXTENSION_STATES = {
    UNINSTALLED: 'uninstalled',
    INSTALLED: 'installed',
    ENABLED: 'enabled',
    ACTIVATED: 'activated',
    DISABLED: 'disabled',
    ERROR: 'error'
};

/**
 * LifecycleManager - Core lifecycle management class
 */
class LifecycleManager {
    constructor(app, configManager, securityManager = null) {
        this.app = app;
        this.configManager = configManager;
        this.securityManager = securityManager;
        
        // Extension state management
        this.extensionStates = new Map();
        this.extensionInstallPaths = new Map();
        this.extensionDependencies = new Map();
        
        // Update management
        this.updateQueue = [];
        this.isUpdating = false;
        
        // Event bus for lifecycle events
        this.eventBus = new EventTarget();
        
        // Load saved extension states
        this.loadExtensionStates();
        
        console.log('LifecycleManager initialized');
    }
    
    /**
     * Load saved extension states from configuration
     */
    loadExtensionStates() {
        try {
            const savedStates = this.configManager?.getConfig('extensionStates') || {};
            for (const [extensionId, state] of Object.entries(savedStates)) {
                this.extensionStates.set(extensionId, state);
            }
        } catch (error) {
            console.error('Failed to load extension states:', error);
        }
    }
    
    /**
     * Save extension states to configuration
     */
    saveExtensionStates() {
        try {
            const statesToSave = {};
            for (const [extensionId, state] of this.extensionStates) {
                statesToSave[extensionId] = state;
            }
            this.configManager?.setConfig('extensionStates', statesToSave);
        } catch (error) {
            console.error('Failed to save extension states:', error);
        }
    }
    
    /**
     * Install extension
     */
    async installExtension(extensionPackage, options = {}) {
        const { force = false } = options;
        
        try {
            console.log(`📥 Installing extension: ${extensionPackage.id}@${extensionPackage.version}`);
            
            // Check if already installed
            const currentState = this.getExtensionState(extensionPackage.id);
            if (currentState !== EXTENSION_STATES.UNINSTALLED && !force) {
                throw new Error(`Extension ${extensionPackage.id} is already installed`);
            }
            
            // Validate extension package
            if (!extensionPackage.id || !extensionPackage.main) {
                throw new Error('Invalid extension package: missing required fields');
            }
            
            // Set initial state
            this.setExtensionState(extensionPackage.id, EXTENSION_STATES.INSTALLED);
            
            // Emit installation event
            this.emitEvent('extension:installed', {
                extensionId: extensionPackage.id,
                version: extensionPackage.version,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension installed: ${extensionPackage.id}@${extensionPackage.version}`);
            
            return {
                success: true,
                extensionId: extensionPackage.id,
                state: EXTENSION_STATES.INSTALLED
            };
            
        } catch (error) {
            console.error(`❌ Failed to install extension ${extensionPackage.id}:`, error);
            this.setExtensionState(extensionPackage.id, EXTENSION_STATES.ERROR);
            this.emitEvent('extension:installFailed', {
                extensionId: extensionPackage.id,
                error: error.message,
                timestamp: Date.now()
            });
            throw error;
        }
    }
    
    /**
     * Enable extension
     */
    async enableExtension(extensionId) {
        try {
            console.log(`🔄 Enabling extension: ${extensionId}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if extension is installed
            if (currentState === EXTENSION_STATES.UNINSTALLED) {
                throw new Error(`Extension ${extensionId} is not installed`);
            }
            
            // Check if already enabled
            if (currentState === EXTENSION_STATES.ENABLED || currentState === EXTENSION_STATES.ACTIVATED) {
                return;
            }
            
            // Update state
            this.setExtensionState(extensionId, EXTENSION_STATES.ENABLED);
            
            // Emit enable event
            this.emitEvent('extension:enabled', {
                extensionId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension enabled: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to enable extension ${extensionId}:`, error);
            throw error;
        }
    }
    
    /**
     * Activate extension
     */
    async activateExtension(extensionId) {
        try {
            console.log(`🚀 Activating extension: ${extensionId}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if extension is enabled
            if (currentState !== EXTENSION_STATES.ENABLED) {
                await this.enableExtension(extensionId);
            }
            
            // Update state
            this.setExtensionState(extensionId, EXTENSION_STATES.ACTIVATED);
            
            // Emit activation event
            this.emitEvent('extension:activated', {
                extensionId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension activated: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to activate extension ${extensionId}:`, error);
            this.setExtensionState(extensionId, EXTENSION_STATES.ERROR);
            this.emitEvent('extension:activationFailed', {
                extensionId,
                error: error.message,
                timestamp: Date.now()
            });
            throw error;
        }
    }
    
    /**
     * Deactivate extension
     */
    async deactivateExtension(extensionId) {
        try {
            console.log(`⏹️ Deactivating extension: ${extensionId}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if already deactivated
            if (currentState !== EXTENSION_STATES.ACTIVATED) {
                return;
            }
            
            // Update state
            this.setExtensionState(extensionId, EXTENSION_STATES.ENABLED);
            
            // Emit deactivation event
            this.emitEvent('extension:deactivated', {
                extensionId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension deactivated: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to deactivate extension ${extensionId}:`, error);
            throw error;
        }
    }
    
    /**
     * Disable extension
     */
    async disableExtension(extensionId) {
        try {
            console.log(`🔄 Disabling extension: ${extensionId}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if already disabled
            if (currentState === EXTENSION_STATES.DISABLED || currentState === EXTENSION_STATES.UNINSTALLED) {
                return;
            }
            
            // Deactivate first if active
            if (currentState === EXTENSION_STATES.ACTIVATED) {
                await this.deactivateExtension(extensionId);
            }
            
            // Update state
            this.setExtensionState(extensionId, EXTENSION_STATES.DISABLED);
            
            // Emit disable event
            this.emitEvent('extension:disabled', {
                extensionId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension disabled: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to disable extension ${extensionId}:`, error);
            throw error;
        }
    }
    
    /**
     * Uninstall extension
     */
    async uninstallExtension(extensionId, options = {}) {
        const { force = false } = options;
        
        try {
            console.log(`🗑️ Uninstalling extension: ${extensionId}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if already uninstalled
            if (currentState === EXTENSION_STATES.UNINSTALLED && !force) {
                return;
            }
            
            // Disable and deactivate first
            if (currentState === EXTENSION_STATES.ACTIVATED) {
                await this.deactivateExtension(extensionId);
            }
            if (currentState === EXTENSION_STATES.ENABLED) {
                await this.disableExtension(extensionId);
            }
            
            // Remove security permissions
            if (this.securityManager) {
                this.securityManager.clearExtensionPermissions(extensionId);
            }
            
            // Update state
            this.setExtensionState(extensionId, EXTENSION_STATES.UNINSTALLED);
            
            // Remove extension data
            this.extensionInstallPaths.delete(extensionId);
            this.extensionDependencies.delete(extensionId);
            
            // Emit uninstall event
            this.emitEvent('extension:uninstalled', {
                extensionId,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension uninstalled: ${extensionId}`);
            
        } catch (error) {
            console.error(`❌ Failed to uninstall extension ${extensionId}:`, error);
            this.setExtensionState(extensionId, EXTENSION_STATES.ERROR);
            this.emitEvent('extension:uninstallFailed', {
                extensionId,
                error: error.message,
                timestamp: Date.now()
            });
            throw error;
        }
    }
    
    /**
     * Update extension
     */
    async updateExtension(extensionId, newVersion) {
        try {
            console.log(`🔄 Updating extension: ${extensionId} to version ${newVersion}`);
            
            // Get current state
            const currentState = this.getExtensionState(extensionId);
            
            // Check if extension is installed
            if (currentState === EXTENSION_STATES.UNINSTALLED) {
                throw new Error(`Extension ${extensionId} is not installed`);
            }
            
            // Deactivate during update
            let wasActivated = false;
            if (currentState === EXTENSION_STATES.ACTIVATED) {
                await this.deactivateExtension(extensionId);
                wasActivated = true;
            }
            
            // Emit update event
            this.emitEvent('extension:updating', {
                extensionId,
                oldVersion: this.getExtensionVersion(extensionId),
                newVersion,
                timestamp: Date.now()
            });
            
            // In a real implementation, this would download and install the new version
            // For now, we'll just update the state
            
            // Reactivate if it was activated before
            if (wasActivated) {
                await this.activateExtension(extensionId);
            }
            
            // Emit updated event
            this.emitEvent('extension:updated', {
                extensionId,
                version: newVersion,
                timestamp: Date.now()
            });
            
            console.log(`✅ Extension updated: ${extensionId}@${newVersion}`);
            
            return {
                success: true,
                extensionId,
                version: newVersion
            };
            
        } catch (error) {
            console.error(`❌ Failed to update extension ${extensionId}:`, error);
            this.setExtensionState(extensionId, EXTENSION_STATES.ERROR);
            this.emitEvent('extension:updateFailed', {
                extensionId,
                error: error.message,
                timestamp: Date.now()
            });
            throw error;
        }
    }
    
    /**
     * Get extension state
     */
    getExtensionState(extensionId) {
        return this.extensionStates.get(extensionId) || EXTENSION_STATES.UNINSTALLED;
    }
    
    /**
     * Set extension state
     */
    setExtensionState(extensionId, state) {
        this.extensionStates.set(extensionId, state);
        this.saveExtensionStates();
    }
    
    /**
     * Get extension version (mock implementation)
     */
    getExtensionVersion(extensionId) {
        // In a real implementation, this would get the actual version
        return '1.0.0';
    }
    
    /**
     * Check if extension is in a specific state
     */
    isExtensionInState(extensionId, state) {
        return this.getExtensionState(extensionId) === state;
    }
    
    /**
     * Get all extensions in a specific state
     */
    getExtensionsByState(state) {
        const result = [];
        for (const [extensionId, extensionState] of this.extensionStates) {
            if (extensionState === state) {
                result.push(extensionId);
            }
        }
        return result;
    }
    
    /**
     * Get all extension states
     */
    getAllExtensionStates() {
        const states = {};
        for (const [extensionId, state] of this.extensionStates) {
            states[extensionId] = state;
        }
        return states;
    }
    
    /**
     * Register extension dependency
     */
    registerDependency(extensionId, dependencyId) {
        if (!this.extensionDependencies.has(extensionId)) {
            this.extensionDependencies.set(extensionId, new Set());
        }
        this.extensionDependencies.get(extensionId).add(dependencyId);
    }
    
    /**
     * Get extension dependencies
     */
    getDependencies(extensionId) {
        return Array.from(this.extensionDependencies.get(extensionId) || []);
    }
    
    /**
     * Check if extension has dependencies
     */
    hasDependencies(extensionId) {
        return (this.extensionDependencies.get(extensionId)?.size || 0) > 0;
    }
    
    /**
     * Emit lifecycle event
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent('extension-lifecycle-event', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });
        
        this.eventBus.dispatchEvent(event);
        console.log(`🔔 Lifecycle event fired: ${eventType}`, data);
    }
    
    /**
     * Add event listener
     */
    on(eventType, callback) {
        this.eventBus.addEventListener('extension-lifecycle-event', (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        });
    }
    
    /**
     * Remove event listener
     */
    off(eventType, callback) {
        this.eventBus.removeEventListener('extension-lifecycle-event', callback);
    }
    
    /**
     * Get lifecycle manager stats
     */
    getStats() {
        const states = this.getAllExtensionStates();
        const counts = {};
        
        // Count extensions by state
        for (const state of Object.values(EXTENSION_STATES)) {
            counts[state] = Object.values(states).filter(s => s === state).length;
        }
        
        return {
            totalExtensions: Object.keys(states).length,
            extensionCountsByState: counts,
            hasSecurityManager: !!this.securityManager
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LifecycleManager,
        EXTENSION_STATES
    };
} else if (typeof window !== 'undefined') {
    window.LifecycleManager = LifecycleManager;
    window.EXTENSION_STATES = EXTENSION_STATES;
}
