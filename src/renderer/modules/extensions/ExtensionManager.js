/**
 * ExtensionManager - Main extension orchestrator
 * Inspired by VS Code's ExtensionManager
 * Provides unified API for managing extensions, activation, and lifecycle
 */
class ExtensionManager {
    constructor(app, configManager, options = {}) {
        this.app = app;
        this.configManager = configManager;
        this.options = {
            enableExtensionHost: true,
            enableMarketplace: true,
            enableAutoUpdates: true,
            enableSecurityValidation: true,
            ...options
        };
        
        // Core components
        this.extensionHost = null;
        this.rpcProtocol = null;
        this.extensionApi = null;
        this.marketplace = null;
        
        // Extension registries
        this.extensionRegistry = new Map();
        this.contributionRegistry = new ContributionRegistry();
        
        // State management
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Event bus for extension-related events
        this.eventBus = new EventTarget();
        
        console.log('ExtensionManager initialized with options:', this.options);
    }
    
    /**
     * Initialize the extension system
     */
    async initialize() {
        if (this.isInitialized) {
            return this.initializationPromise;
        }
        
        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
    }
    
    /**
     * Perform actual initialization with lifecycle management
     */
    async _performInitialization() {
        try {
            console.log('🔧 Initializing ExtensionManager components...');
            
            // Initialize SecurityManager for enhanced permission handling
            const { SecurityManager } = require('./SecurityManager');
            this.securityManager = new SecurityManager(this.app, this.configManager);
            
            // Initialize LifecycleManager for extension lifecycle handling
            const { LifecycleManager } = require('./LifecycleManager');
            this.lifecycleManager = new LifecycleManager(this.app, this.configManager, this.securityManager);
            
            // Initialize ExtensionHost
            if (this.options.enableExtensionHost) {
                const ExtensionHost = require('./ExtensionHost');
                this.extensionHost = new ExtensionHost(this.app, this.configManager);
                await this.extensionHost.start();
            }
            
            // Initialize Extension API with proxy pattern
            const { createExtensionAPI } = require('./ExtensionAPIProxy');
            this.extensionApi = createExtensionAPI(this.app, this.rpcProtocol, {
                // Pass permissions from security manager
                ...this.securityManager.getDefaultPermissions()
            });
            
            // Register API methods with RPC protocol
            this.extensionApi.registerAPIMethods();
            
            // Initialize marketplace if enabled
            if (this.options.enableMarketplace) {
                // In future, we'll implement a full marketplace
                this.marketplace = {
                    installedExtensions: [],
                    availableExtensions: []
                };
            }
            
            // Setup contribution registry
            this.setupContributionRegistry();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.emitEvent('system-initialized', { timestamp: Date.now() });
            
            console.log('✅ ExtensionManager initialization complete');
            
        } catch (error) {
            console.error('❌ ExtensionManager initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Setup contribution registry
     */
    setupContributionRegistry() {
        // Register contribution types
        this.contributionRegistry.registerContributionType('commands', {
            validate: (contribution) => {
                return !!contribution.command && !!contribution.title;
            }
        });
        
        this.contributionRegistry.registerContributionType('menus', {
            validate: (contribution) => {
                return !!contribution.id && !!contribution.command;
            }
        });
        
        this.contributionRegistry.registerContributionType('keybindings', {
            validate: (contribution) => {
                return !!contribution.command && !!contribution.key;
            }
        });
        
        this.contributionRegistry.registerContributionType('languages', {
            validate: (contribution) => {
                return !!contribution.id && !!contribution.aliases;
            }
        });
        
        console.log('Contribution registry setup complete');
    }
    
    /**
     * Register extension with security validation
     */
    async registerExtension(extensionManifest) {
        try {
            // Validate extension manifest
            this.validateExtensionManifest(extensionManifest);
            
            // Check for conflicts
            if (this.extensionRegistry.has(extensionManifest.id)) {
                throw new Error(`Extension ${extensionManifest.id} is already registered`);
            }
            
            // Validate permissions with SecurityManager
            if (this.securityManager) {
                const permissionValidation = this.securityManager.validateExtensionPermissions(
                    extensionManifest.id, 
                    extensionManifest
                );
                
                // Log warnings if any
                for (const warning of permissionValidation.warnings) {
                    console.warn(`Permission warning for ${extensionManifest.id}:`, warning);
                }
            }
            
            // Register extension
            this.extensionRegistry.set(extensionManifest.id, extensionManifest);
            
            // Register permissions with SecurityManager
            if (this.securityManager && extensionManifest.permissions) {
                this.securityManager.registerExtensionPermissions(
                    extensionManifest.id, 
                    extensionManifest.permissions
                );
            }
            
            // Register contributions
            if (extensionManifest.contributes) {
                this.contributionRegistry.registerContributions(extensionManifest.id, extensionManifest.contributes);
            }
            
            // Register activation events
            if (this.extensionHost && extensionManifest.activationEvents) {
                this.extensionHost.registerActivationEvents(extensionManifest);
            }
            
            this.emitEvent('extension-registered', { extensionId: extensionManifest.id });
            console.log(`✅ Extension registered: ${extensionManifest.id}`);
            
        } catch (error) {
            console.error(`❌ Failed to register extension ${extensionManifest.id}:`, error);
            throw error;
        }
    }
    
    /**
     * Validate extension manifest
     */
    validateExtensionManifest(manifest) {
        const { ExtensionManifest } = require('./ExtensionManifest');
        
        // Validate manifest against schema
        const validationResult = ExtensionManifest.validate(manifest);
        
        if (!validationResult.valid) {
            throw new Error(`Invalid extension manifest: ${validationResult.errors.join('; ')}`);
        }
        
        return validationResult;
    }
    
    /**
     * Activate extension by ID with lifecycle tracking
     */
    async activateExtension(extensionId) {
        if (!this.extensionHost) {
            throw new Error('ExtensionHost is not enabled');
        }
        
        // Track activation in lifecycle manager
        if (this.lifecycleManager) {
            await this.lifecycleManager.activateExtension(extensionId);
        }
        
        // Activate in extension host
        await this.extensionHost.activateExtension(extensionId);
        
        this.emitEvent('extension-activated', { extensionId });
    }
    
    /**
     * Deactivate extension by ID with lifecycle tracking
     */
    async deactivateExtension(extensionId) {
        if (!this.extensionHost) {
            throw new Error('ExtensionHost is not enabled');
        }
        
        // Deactivate in extension host first
        await this.extensionHost.deactivateExtension(extensionId);
        
        // Track deactivation in lifecycle manager
        if (this.lifecycleManager) {
            await this.lifecycleManager.deactivateExtension(extensionId);
        }
        
        this.emitEvent('extension-deactivated', { extensionId });
    }
    
    /**
     * Fire activation event
     */
    async fireActivationEvent(eventName, payload = {}) {
        if (!this.extensionHost) {
            return;
        }
        
        await this.extensionHost.fireActivationEvent(eventName, payload);
    }
    
    /**
     * Get all registered extensions
     */
    getExtensions() {
        return Array.from(this.extensionRegistry.values());
    }
    
    /**
     * Get extension by ID
     */
    getExtension(extensionId) {
        return this.extensionRegistry.get(extensionId);
    }
    
    /**
     * Get contributions by type
     */
    getContributions(type) {
        return this.contributionRegistry.getContributions(type);
    }
    
    /**
     * Get active extensions
     */
    getActiveExtensions() {
        if (!this.extensionHost) {
            return [];
        }
        return Array.from(this.extensionHost.activeExtensions);
    }
    
    /**
     * Execute command contributed by extension
     */
    async executeCommand(commandId, args = []) {
        // Find command contribution
        const commandContribution = this.contributionRegistry.findCommand(commandId);
        if (!commandContribution) {
            throw new Error(`Command not found: ${commandId}`);
        }
        
        // Activate extension if needed
        await this.activateExtension(commandContribution.extensionId);
        
        // Execute command via RPC or direct call
        if (this.rpcProtocol) {
            return this.rpcProtocol.invoke('command.execute', {
                commandId,
                args
            });
        } else {
            // Direct execution for non-isolated mode
            const commandHandler = this.contributionRegistry.getCommandHandler(commandId);
            if (!commandHandler) {
                throw new Error(`No handler registered for command: ${commandId}`);
            }
            return commandHandler(args);
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Setup app-level event listeners
        if (this.app && this.app.on) {
            this.app.on('workspace:opened', (workspace) => {
                this.fireActivationEvent('onWorkspaceOpen', { workspace });
            });
            
            this.app.on('file:opened', (file) => {
                // Determine file language and fire onLanguage event
                const language = this.determineLanguage(file);
                this.fireActivationEvent(`onLanguage:${language}`, { file });
            });
        }
        
        console.log('Extension event listeners setup complete');
    }
    
    /**
     * Determine language from file
     */
    determineLanguage(file) {
        // Simple implementation - will be enhanced later
        const extension = file.split('.').pop().toLowerCase();
        const languageMap = {
            'fasta': 'fasta',
            'fa': 'fasta',
            'gb': 'genbank',
            'gff': 'gff',
            'bed': 'bed',
            'vcf': 'vcf'
        };
        
        return languageMap[extension] || 'plaintext';
    }
    
    /**
     * Get system stats
     */
    getSystemStats() {
        return {
            extensions: {
                total: this.extensionRegistry.size,
                active: this.getActiveExtensions().length
            },
            contributionTypes: this.contributionRegistry.getContributionTypes(),
            extensionHost: this.extensionHost ? this.extensionHost.getMetrics() : null,
            marketplace: this.marketplace ? this.marketplace.getStats() : null
        };
    }
    
    /**
     * Emit extension event
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent('extension-manager-event', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });
        
        this.eventBus.dispatchEvent(event);
        console.log(`🔔 Extension event fired: ${eventType}`, data);
    }
    
    /**
     * Add event listener
     */
    on(eventType, callback) {
        this.eventBus.addEventListener('extension-manager-event', (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        });
    }
    
    /**
     * Dispose resources
     */
    async dispose() {
        console.log('🧹 Disposing ExtensionManager...');
        
        // Stop extension host
        if (this.extensionHost) {
            await this.extensionHost.stop();
        }
        
        // Dispose other components
        if (this.rpcProtocol) {
            this.rpcProtocol.dispose();
        }
        
        // Clear registries
        this.extensionRegistry.clear();
        this.contributionRegistry.dispose();
        
        this.isInitialized = false;
        console.log('✅ ExtensionManager disposed');
    }
}

/**
 * ContributionRegistry - Manages extension contributions
 * Handles registration and retrieval of extension contributions
 */
class ContributionRegistry {
    constructor() {
        this.contributions = new Map();
        this.contributionTypes = new Map();
        this.commandHandlers = new Map();
        
        console.log('ContributionRegistry initialized');
    }
    
    /**
     * Register contribution type
     */
    registerContributionType(type, options = {}) {
        this.contributionTypes.set(type, {
            validate: options.validate || (() => true),
            ...options
        });
    }
    
    /**
     * Register extensions contributions
     */
    registerContributions(extensionId, contributions) {
        for (const [type, contributionList] of Object.entries(contributions)) {
            if (!Array.isArray(contributionList)) {
                continue;
            }
            
            if (!this.contributions.has(type)) {
                this.contributions.set(type, []);
            }
            
            const typeContributions = this.contributions.get(type);
            
            for (const contribution of contributionList) {
                // Validate contribution
                const typeConfig = this.contributionTypes.get(type);
                if (typeConfig && !typeConfig.validate(contribution)) {
                    console.warn(`Invalid contribution for ${extensionId}: ${type}`, contribution);
                    continue;
                }
                
                // Add extension ID to contribution
                typeContributions.push({
                    ...contribution,
                    extensionId
                });
            }
        }
    }
    
    /**
     * Get contributions by type
     */
    getContributions(type) {
        return this.contributions.get(type) || [];
    }
    
    /**
     * Get all contribution types
     */
    getContributionTypes() {
        return Array.from(this.contributionTypes.keys());
    }
    
    /**
     * Find command by ID
     */
    findCommand(commandId) {
        const commands = this.contributions.get('commands') || [];
        return commands.find(cmd => cmd.command === commandId);
    }
    
    /**
     * Register command handler
     */
    registerCommandHandler(commandId, handler) {
        this.commandHandlers.set(commandId, handler);
    }
    
    /**
     * Get command handler
     */
    getCommandHandler(commandId) {
        return this.commandHandlers.get(commandId);
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        this.contributions.clear();
        this.contributionTypes.clear();
        this.commandHandlers.clear();
    }
}

// ExtensionAPI is now imported from ExtensionAPIProxy.js
// The API uses proxy pattern for RPC communication

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExtensionManager;
} else if (typeof window !== 'undefined') {
    window.ExtensionManager = ExtensionManager;
}
