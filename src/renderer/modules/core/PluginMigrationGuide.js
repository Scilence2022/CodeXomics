/**
 * Plugin Migration Guide - Upgrading to VS Code-inspired Architecture
 * 
 * This guide demonstrates how to migrate existing plugins to the new
 * VS Code-inspired extension architecture for GenomeExplorer.
 * 
 * @version 2.0.0
 * @author GenomeExplorer Team
 */

/**
 * ============================================================================
 * MIGRATION OVERVIEW
 * ============================================================================
 * 
 * The new architecture provides:
 * 1. Extension Manifest - Declarative configuration (like package.json)
 * 2. Activation Events - Lazy loading for better performance
 * 3. Contribution Points - Standardized extension points
 * 4. Disposable Pattern - Proper resource cleanup
 * 5. Extension Context - Lifecycle management
 * 6. Command Registry - Unified command handling
 * 
 * ============================================================================
 * STEP 1: DEFINE EXTENSION MANIFEST
 * ============================================================================
 */

// BEFORE: Plugins had scattered metadata
/*
class OldPlugin {
    constructor(app, configManager) {
        this.name = 'My Plugin';
        this.version = '1.0.0';
        // ... initialization
    }
    
    getMetadata() {
        return {
            name: 'My Plugin',
            version: '1.0.0',
            description: 'Some plugin'
        };
    }
}
*/

// AFTER: Centralized manifest with full contribution points
const MyPluginManifest = {
    // Required metadata
    name: 'my-plugin',
    displayName: 'My Plugin',
    description: 'Enhanced plugin with VS Code architecture',
    version: '2.0.0',
    publisher: 'YourName',
    
    // Activation events - when to load the plugin
    activationEvents: [
        'onCommand:myPlugin.doSomething',      // Load when command is invoked
        'onLanguage:fasta',                     // Load for specific file types
        'workspaceContains:**/*.custom',        // Load when workspace has files
        'onStartupFinished'                     // Load after startup (deferred)
    ],
    
    // Contribution points - what the plugin provides
    contributes: {
        // Commands
        commands: [
            {
                command: 'myPlugin.doSomething',
                title: 'Do Something',
                category: 'My Plugin'
            }
        ],
        
        // Functions for AI/LLM integration
        functions: {
            doSomething: {
                name: 'doSomething',
                description: 'Performs an action',
                parameters: {
                    type: 'object',
                    properties: {
                        input: { type: 'string', description: 'Input value' }
                    },
                    required: ['input']
                }
            }
        },
        
        // Configuration
        configuration: {
            title: 'My Plugin',
            properties: {
                'myPlugin.setting1': {
                    type: 'boolean',
                    default: true,
                    description: 'Enable feature X'
                }
            }
        }
    },
    
    // Dependencies
    extensionDependencies: ['genomeexplorer.core'],
    
    // Security permissions
    permissions: {
        'genome.read': true
    }
};

/**
 * ============================================================================
 * STEP 2: IMPLEMENT ACTIVATE/DEACTIVATE PATTERN
 * ============================================================================
 */

// BEFORE: Constructor-based initialization
/*
class OldPlugin {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        this.init();
    }
    
    init() {
        // Everything initialized at once
        this.setupHandlers();
        this.loadData();
        this.registerEvents();
    }
}
*/

// AFTER: Explicit lifecycle with activate/deactivate
class MyPluginExtension {
    static getManifest() {
        return MyPluginManifest;
    }
    
    constructor(context) {
        this.context = context;
        this.disposables = [];
        this.isActive = false;
    }
    
    /**
     * Activate is called when plugin is loaded
     * @param {ExtensionContext} context 
     */
    async activate(context) {
        console.log('Activating My Plugin...');
        
        // 1. Register commands
        this._registerCommands(context);
        
        // 2. Initialize services
        await this._initializeServices();
        
        // 3. Set up event handlers
        this._registerEventHandlers(context);
        
        this.isActive = true;
        
        // Return public API
        return {
            doSomething: this.doSomething.bind(this)
        };
    }
    
    /**
     * Deactivate is called when plugin is unloaded
     */
    async deactivate() {
        console.log('Deactivating My Plugin...');
        
        // Dispose all registered resources
        for (const disposable of this.disposables) {
            try {
                await disposable.dispose();
            } catch (error) {
                console.error('Dispose error:', error);
            }
        }
        
        this.disposables = [];
        this.isActive = false;
    }
    
    // Implementation details...
    _registerCommands(context) {
        // Use CommandRegistry if available
        if (typeof CommandRegistry !== 'undefined') {
            const registry = window.commandRegistry;
            registry?.registerCommand(
                'myPlugin.doSomething',
                (params) => this.doSomething(params)
            );
        }
    }
    
    async _initializeServices() {
        // Initialize any services needed
    }
    
    _registerEventHandlers(context) {
        // Register event handlers
    }
    
    // Public API methods
    async doSomething(params) {
        return { result: 'done', params };
    }
}

/**
 * ============================================================================
 * STEP 3: USE DISPOSABLE PATTERN FOR RESOURCES
 * ============================================================================
 */

// BEFORE: Manual cleanup scattered throughout code
/*
class OldPlugin {
    registerHandlers() {
        window.addEventListener('resize', this.onResize);
        document.addEventListener('click', this.onClick);
    }
    
    destroy() {
        window.removeEventListener('resize', this.onResize);
        document.removeEventListener('click', this.onClick);
        // Easy to forget cleanup
    }
}
*/

// AFTER: Disposable pattern ensures proper cleanup
class ResourceManagedPlugin {
    constructor(context) {
        this.disposables = [];
    }
    
    activate(context) {
        // Register handler and get disposable
        const resizeDisposable = this._registerEventHandler(
            window, 'resize', this.onResize.bind(this)
        );
        this.disposables.push(resizeDisposable);
        
        // Also add to context for automatic cleanup
        context.subscriptions.push(resizeDisposable);
        
        // Create interval with automatic cleanup
        const intervalDisposable = this._createInterval(
            () => this.periodicCheck(),
            5000
        );
        this.disposables.push(intervalDisposable);
        context.subscriptions.push(intervalDisposable);
    }
    
    _registerEventHandler(target, event, handler) {
        target.addEventListener(event, handler);
        return {
            dispose: () => target.removeEventListener(event, handler)
        };
    }
    
    _createInterval(callback, ms) {
        const intervalId = setInterval(callback, ms);
        return {
            dispose: () => clearInterval(intervalId)
        };
    }
    
    onResize() { /* handle resize */ }
    periodicCheck() { /* periodic work */ }
}

/**
 * ============================================================================
 * STEP 4: USE EXTENSION CONTEXT FOR STATE
 * ============================================================================
 */

// BEFORE: State stored in various places
/*
class OldPlugin {
    saveState() {
        localStorage.setItem('plugin-state', JSON.stringify(this.state));
    }
    
    loadState() {
        const saved = localStorage.getItem('plugin-state');
        this.state = saved ? JSON.parse(saved) : {};
    }
}
*/

// AFTER: Use ExtensionContext storage APIs
class ContextAwarePlugin {
    async activate(context) {
        // Load workspace-specific state
        const workspaceState = context.workspaceState;
        this.cachedData = await workspaceState.get('cachedData', {});
        
        // Load global state (persists across workspaces)
        const globalState = context.globalState;
        this.preferences = await globalState.get('preferences', {});
        
        // Access secrets securely
        const secrets = context.secrets;
        this.apiKey = await secrets.get('apiKey');
    }
    
    async saveData(key, value) {
        await this.context.workspaceState.update(key, value);
    }
    
    async savePreference(key, value) {
        await this.context.globalState.update(key, value);
    }
    
    async storeSecret(key, value) {
        await this.context.secrets.store(key, value);
    }
}

/**
 * ============================================================================
 * STEP 5: REGISTER CONTRIBUTIONS DECLARATIVELY
 * ============================================================================
 */

// BEFORE: Imperative registration
/*
class OldPlugin {
    registerFunctions() {
        window.pluginManager.registerPlugin('my-plugin', {
            type: 'function',
            functions: {
                myFunction: {
                    description: 'Does something',
                    executor: this.myFunction.bind(this)
                }
            }
        });
    }
}
*/

// AFTER: Declarative in manifest, automatic registration
const DeclarativePluginManifest = {
    name: 'declarative-plugin',
    contributes: {
        // Functions are declared, implementation separate
        functions: {
            analyzeData: {
                name: 'analyzeData',
                description: 'Analyze genomic data',
                parameters: {
                    type: 'object',
                    properties: {
                        data: { type: 'array' },
                        method: { type: 'string', enum: ['fast', 'accurate'] }
                    },
                    required: ['data']
                },
                category: 'analysis'
            }
        },
        
        // Menus are declared
        menus: {
            'commandPalette': [
                { command: 'declarativePlugin.analyzeData' }
            ]
        }
    }
};

class DeclarativePlugin {
    static getManifest() {
        return DeclarativePluginManifest;
    }
    
    async activate(context) {
        // Implementation connects to manifest declarations
        // Commands auto-registered from manifest
        // Functions auto-exposed for AI/LLM
    }
    
    // Implementation of declared function
    async analyzeData(params) {
        const { data, method = 'fast' } = params;
        // ... analysis logic
        return { results: [] };
    }
}

/**
 * ============================================================================
 * MIGRATION CHECKLIST
 * ============================================================================
 * 
 * □ Create extension manifest with all metadata
 * □ Define activation events for lazy loading
 * □ Declare all contribution points (commands, functions, menus)
 * □ Implement activate() function returning public API
 * □ Implement deactivate() for cleanup
 * □ Convert all resources to disposables
 * □ Use context storage instead of localStorage
 * □ Register commands through CommandRegistry
 * □ Test activation/deactivation cycle
 * □ Verify LLM/AI function integration
 * 
 * ============================================================================
 * COMMON MIGRATION PATTERNS
 * ============================================================================
 */

// Pattern 1: Wrapping existing plugin class
function wrapLegacyPlugin(LegacyPluginClass) {
    return {
        async activate(context) {
            const app = context.extension.app;
            const configManager = context.extension.configManager;
            
            const legacyInstance = new LegacyPluginClass(app, configManager);
            
            // Store for cleanup
            context.subscriptions.push({
                dispose: () => {
                    if (legacyInstance.destroy) {
                        legacyInstance.destroy();
                    }
                }
            });
            
            return legacyInstance;
        },
        
        deactivate() {
            // Handled by subscription disposal
        }
    };
}

// Pattern 2: Gradual migration
class GradualMigrationPlugin {
    // Keep old API for compatibility
    static init(app, configManager) {
        console.warn('Deprecated: Use activate() instead');
        const instance = new GradualMigrationPlugin({ 
            extension: { app, configManager } 
        });
        instance.activate(instance.context);
        return instance;
    }
    
    // New API
    async activate(context) {
        // New initialization
    }
    
    async deactivate() {
        // Cleanup
    }
}

// Pattern 3: Feature flags for gradual rollout
class FeatureFlagPlugin {
    async activate(context) {
        const useNewArchitecture = context.configuration?.get('useNewArchitecture', true);
        
        if (useNewArchitecture) {
            await this._activateNewWay(context);
        } else {
            await this._activateLegacyWay(context);
        }
    }
    
    async _activateNewWay(context) {
        // New implementation
    }
    
    async _activateLegacyWay(context) {
        // Legacy implementation
    }
}

/**
 * ============================================================================
 * ENTRY POINT TEMPLATE
 * ============================================================================
 */

// Standard entry point for new plugins
async function activate(context) {
    const extension = new MyPluginExtension(context);
    return extension.activate(context);
}

async function deactivate() {
    // Usually empty - cleanup via subscriptions
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        activate,
        deactivate,
        MyPluginExtension,
        MyPluginManifest
    };
}
