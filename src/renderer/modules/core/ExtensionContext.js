/**
 * ExtensionContext - Extension lifecycle and state management
 * 
 * Modeled after VS Code's ExtensionContext API, this provides extensions with:
 * - Subscription management for disposable resources
 * - Global and workspace-scoped persistent storage
 * - Extension metadata and paths
 * - Secrets storage for sensitive data
 * - Lifecycle state management
 * 
 * @see https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
 */

// Import Disposable utilities (will be loaded as global in browser)
// const { Disposable, DisposableStore } = require('./Disposable');

/**
 * Represents the mode in which an extension is running
 * @readonly
 * @enum {number}
 */
const ExtensionMode = {
    /** Extension is running in a production environment */
    Production: 1,
    /** Extension is running in development mode */
    Development: 2,
    /** Extension is running in test mode */
    Test: 3
};

/**
 * Extension runtime environment types
 * @readonly
 * @enum {string}
 */
const ExtensionKind = {
    /** Extension runs in the UI/local process */
    UI: 'ui',
    /** Extension runs in a workspace/remote process */
    Workspace: 'workspace'
};

/**
 * Memento - Key-value storage with get/set/update operations
 * 
 * Used for globalState and workspaceState persistence.
 */
class Memento {
    /**
     * @param {string} id - Unique identifier for this memento
     * @param {string} scope - Storage scope ('global' or 'workspace')
     * @param {Object} storageBackend - Storage backend for persistence
     */
    constructor(id, scope, storageBackend = null) {
        this._id = id;
        this._scope = scope;
        this._storage = storageBackend;
        this._cache = new Map();
        this._keysForSync = new Set();
        this._isDirty = false;
        
        // Load initial state
        this._loadFromStorage();
    }

    /**
     * Load state from storage backend
     * @private
     */
    _loadFromStorage() {
        if (!this._storage) {
            return;
        }

        try {
            const key = this._getStorageKey();
            const data = this._storage.get(key);
            
            if (data && typeof data === 'object') {
                for (const [k, v] of Object.entries(data)) {
                    this._cache.set(k, v);
                }
            }
        } catch (error) {
            console.error(`Failed to load memento state for ${this._id}:`, error);
        }
    }

    /**
     * Get the storage key for this memento
     * @private
     * @returns {string}
     */
    _getStorageKey() {
        return `extension.${this._id}.${this._scope}State`;
    }

    /**
     * Return all keys stored in this Memento
     * @returns {readonly string[]}
     */
    keys() {
        return Array.from(this._cache.keys());
    }

    /**
     * Get a value from the memento
     * @template T
     * @param {string} key - The key to retrieve
     * @param {T} [defaultValue] - Default value if key doesn't exist
     * @returns {T | undefined}
     */
    get(key, defaultValue) {
        const value = this._cache.get(key);
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Store a value in the memento
     * @template T
     * @param {string} key - The key to store
     * @param {T} value - The value to store
     * @returns {Promise<void>}
     */
    async update(key, value) {
        if (value === undefined) {
            this._cache.delete(key);
        } else {
            this._cache.set(key, value);
        }

        this._isDirty = true;
        await this._persist();
    }

    /**
     * Persist the memento state to storage
     * @private
     * @returns {Promise<void>}
     */
    async _persist() {
        if (!this._storage || !this._isDirty) {
            return;
        }

        try {
            const key = this._getStorageKey();
            const data = Object.fromEntries(this._cache);
            await this._storage.set(key, data);
            this._isDirty = false;
        } catch (error) {
            console.error(`Failed to persist memento state for ${this._id}:`, error);
        }
    }

    /**
     * Set keys that should be synced across machines
     * @param {readonly string[]} keys - Keys to sync
     */
    setKeysForSync(keys) {
        this._keysForSync = new Set(keys);
    }

    /**
     * Get keys marked for sync
     * @returns {readonly string[]}
     */
    getKeysForSync() {
        return Array.from(this._keysForSync);
    }

    /**
     * Clear all stored data
     * @returns {Promise<void>}
     */
    async clear() {
        this._cache.clear();
        this._isDirty = true;
        await this._persist();
    }
}

/**
 * SecretStorage - Secure storage for sensitive data
 * 
 * Provides encrypted storage for secrets like API keys and tokens.
 */
class SecretStorage {
    /**
     * @param {string} extensionId - The extension identifier
     * @param {Object} storageBackend - Storage backend for persistence
     */
    constructor(extensionId, storageBackend = null) {
        this._extensionId = extensionId;
        this._storage = storageBackend;
        this._cache = new Map();
        this._eventEmitter = new EventTarget();
        
        // Load initial secrets
        this._loadSecrets();
    }

    /**
     * Load secrets from storage
     * @private
     */
    _loadSecrets() {
        if (!this._storage) {
            return;
        }

        try {
            const key = this._getStorageKey();
            const encrypted = this._storage.get(key);
            
            if (encrypted) {
                // In a real implementation, this would decrypt the data
                const data = this._decrypt(encrypted);
                if (data && typeof data === 'object') {
                    for (const [k, v] of Object.entries(data)) {
                        this._cache.set(k, v);
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to load secrets for ${this._extensionId}:`, error);
        }
    }

    /**
     * Get the storage key for secrets
     * @private
     * @returns {string}
     */
    _getStorageKey() {
        return `extension.${this._extensionId}.secrets`;
    }

    /**
     * Simple encryption (in production, use proper encryption)
     * @private
     * @param {string} data 
     * @returns {string}
     */
    _encrypt(data) {
        // In production, use proper encryption (e.g., Electron's safeStorage)
        return btoa(JSON.stringify(data));
    }

    /**
     * Simple decryption (in production, use proper decryption)
     * @private
     * @param {string} encrypted 
     * @returns {Object}
     */
    _decrypt(encrypted) {
        try {
            return JSON.parse(atob(encrypted));
        } catch {
            return {};
        }
    }

    /**
     * Get a secret value
     * @param {string} key - The secret key
     * @returns {Promise<string | undefined>}
     */
    async get(key) {
        return this._cache.get(key);
    }

    /**
     * Store a secret value
     * @param {string} key - The secret key
     * @param {string} value - The secret value
     * @returns {Promise<void>}
     */
    async store(key, value) {
        const oldValue = this._cache.get(key);
        this._cache.set(key, value);
        
        await this._persist();
        
        // Emit change event
        const event = new CustomEvent('secretChanged', {
            detail: { key, oldValue, newValue: value }
        });
        this._eventEmitter.dispatchEvent(event);
    }

    /**
     * Delete a secret
     * @param {string} key - The secret key
     * @returns {Promise<void>}
     */
    async delete(key) {
        const oldValue = this._cache.get(key);
        this._cache.delete(key);
        
        await this._persist();
        
        // Emit change event
        const event = new CustomEvent('secretChanged', {
            detail: { key, oldValue, newValue: undefined }
        });
        this._eventEmitter.dispatchEvent(event);
    }

    /**
     * Persist secrets to storage
     * @private
     * @returns {Promise<void>}
     */
    async _persist() {
        if (!this._storage) {
            return;
        }

        try {
            const key = this._getStorageKey();
            const data = Object.fromEntries(this._cache);
            const encrypted = this._encrypt(data);
            await this._storage.set(key, encrypted);
        } catch (error) {
            console.error(`Failed to persist secrets for ${this._extensionId}:`, error);
        }
    }

    /**
     * Register a listener for secret changes
     * @param {Function} listener - The listener function
     * @returns {Disposable}
     */
    onDidChange(listener) {
        const handler = (event) => listener(event.detail);
        this._eventEmitter.addEventListener('secretChanged', handler);
        
        return new Disposable(() => {
            this._eventEmitter.removeEventListener('secretChanged', handler);
        });
    }
}

/**
 * EnvironmentVariableCollection - Manages environment variables for extension
 */
class EnvironmentVariableCollection {
    constructor() {
        this._variables = new Map();
        this._persistent = true;
        this._description = '';
    }

    /**
     * Whether the collection is persistent across sessions
     */
    get persistent() {
        return this._persistent;
    }

    set persistent(value) {
        this._persistent = value;
    }

    /**
     * Description of the collection
     */
    get description() {
        return this._description;
    }

    set description(value) {
        this._description = value;
    }

    /**
     * Replace an environment variable value
     * @param {string} variable - Variable name
     * @param {string} value - New value
     * @param {Object} options - Options
     */
    replace(variable, value, options = {}) {
        this._variables.set(variable, { type: 'replace', value, options });
    }

    /**
     * Append to an environment variable
     * @param {string} variable - Variable name
     * @param {string} value - Value to append
     * @param {Object} options - Options
     */
    append(variable, value, options = {}) {
        this._variables.set(variable, { type: 'append', value, options });
    }

    /**
     * Prepend to an environment variable
     * @param {string} variable - Variable name
     * @param {string} value - Value to prepend
     * @param {Object} options - Options
     */
    prepend(variable, value, options = {}) {
        this._variables.set(variable, { type: 'prepend', value, options });
    }

    /**
     * Get an environment variable mutation
     * @param {string} variable - Variable name
     * @returns {Object | undefined}
     */
    get(variable) {
        return this._variables.get(variable);
    }

    /**
     * Delete an environment variable mutation
     * @param {string} variable - Variable name
     */
    delete(variable) {
        this._variables.delete(variable);
    }

    /**
     * Clear all mutations
     */
    clear() {
        this._variables.clear();
    }

    /**
     * Iterate over all mutations
     * @param {Function} callback - Callback for each mutation
     */
    forEach(callback) {
        this._variables.forEach((mutation, variable) => {
            callback(mutation, variable, this);
        });
    }

    /**
     * Get iterator for mutations
     */
    [Symbol.iterator]() {
        return this._variables.entries();
    }
}

/**
 * ExtensionContext - Core extension context class
 * 
 * Provides extensions with access to:
 * - Extension metadata and paths
 * - Subscription management for disposables
 * - Persistent storage (global and workspace scoped)
 * - Secrets storage
 * - Environment variable management
 */
class ExtensionContext {
    /**
     * @param {Object} options - Context initialization options
     * @param {Object} options.extension - Extension metadata
     * @param {string} options.extensionPath - Path to extension directory
     * @param {Object} options.storageBackend - Storage backend for persistence
     * @param {number} options.extensionMode - Extension mode (Production/Development/Test)
     */
    constructor(options = {}) {
        const {
            extension = {},
            extensionPath = '',
            storageBackend = null,
            extensionMode = ExtensionMode.Production
        } = options;

        // Extension metadata
        this._extension = extension;
        this._extensionPath = extensionPath;
        this._extensionMode = extensionMode;
        this._extensionId = extension.id || 'unknown';
        
        // Storage backend reference
        this._storageBackend = storageBackend;

        // Subscriptions - disposables owned by the extension
        this._subscriptions = [];

        // Storage instances
        this._globalState = new Memento(this._extensionId, 'global', storageBackend);
        this._workspaceState = new Memento(this._extensionId, 'workspace', storageBackend);
        this._secrets = new SecretStorage(this._extensionId, storageBackend);

        // Environment variables
        this._environmentVariableCollection = new EnvironmentVariableCollection();

        // Extension URI paths
        this._extensionUri = this._createUri(extensionPath);
        this._globalStorageUri = this._createUri(`${extensionPath}/globalStorage`);
        this._storageUri = this._createUri(`${extensionPath}/storage`);
        this._logUri = this._createUri(`${extensionPath}/logs`);

        // Lifecycle state
        this._isActivated = false;
        this._activationTime = null;

        console.log(`ExtensionContext created for: ${this._extensionId}`);
    }

    /**
     * Create a URI-like object
     * @private
     * @param {string} path 
     * @returns {Object}
     */
    _createUri(path) {
        return {
            scheme: 'file',
            path: path,
            fsPath: path,
            toString: () => `file://${path}`
        };
    }

    // ===== Extension Metadata =====

    /**
     * The extension object containing manifest information
     * @returns {Object}
     */
    get extension() {
        return this._extension;
    }

    /**
     * The unique identifier of the extension
     * @returns {string}
     */
    get extensionId() {
        return this._extensionId;
    }

    /**
     * The absolute file path of the directory containing the extension
     * @returns {string}
     */
    get extensionPath() {
        return this._extensionPath;
    }

    /**
     * The URI of the directory containing the extension
     * @returns {Object}
     */
    get extensionUri() {
        return this._extensionUri;
    }

    /**
     * The current extension mode
     * @returns {number}
     */
    get extensionMode() {
        return this._extensionMode;
    }

    // ===== Storage =====

    /**
     * Global persistent storage (across workspaces)
     * @returns {Memento}
     */
    get globalState() {
        return this._globalState;
    }

    /**
     * Workspace-scoped persistent storage
     * @returns {Memento}
     */
    get workspaceState() {
        return this._workspaceState;
    }

    /**
     * Secret storage for sensitive data
     * @returns {SecretStorage}
     */
    get secrets() {
        return this._secrets;
    }

    /**
     * URI for global storage location
     * @returns {Object}
     */
    get globalStorageUri() {
        return this._globalStorageUri;
    }

    /**
     * URI for workspace storage location
     * @returns {Object}
     */
    get storageUri() {
        return this._storageUri;
    }

    /**
     * URI for extension log files
     * @returns {Object}
     */
    get logUri() {
        return this._logUri;
    }

    // ===== Subscriptions =====

    /**
     * Array of subscriptions that will be disposed when the extension is deactivated
     * @returns {Array<Disposable>}
     */
    get subscriptions() {
        return this._subscriptions;
    }

    /**
     * Add a disposable to subscriptions
     * @param {Disposable} disposable 
     * @returns {Disposable}
     */
    subscribe(disposable) {
        this._subscriptions.push(disposable);
        return disposable;
    }

    // ===== Environment =====

    /**
     * Environment variable collection for this extension
     * @returns {EnvironmentVariableCollection}
     */
    get environmentVariableCollection() {
        return this._environmentVariableCollection;
    }

    // ===== Lifecycle =====

    /**
     * Mark the extension as activated
     */
    markActivated() {
        this._isActivated = true;
        this._activationTime = Date.now();
    }

    /**
     * Check if the extension is activated
     * @returns {boolean}
     */
    get isActivated() {
        return this._isActivated;
    }

    /**
     * Get activation timestamp
     * @returns {number | null}
     */
    get activationTime() {
        return this._activationTime;
    }

    /**
     * Get the storage path for the extension (deprecated, use storageUri)
     * @returns {string | undefined}
     */
    get storagePath() {
        return this._storageUri?.fsPath;
    }

    /**
     * Get the global storage path (deprecated, use globalStorageUri)
     * @returns {string}
     */
    get globalStoragePath() {
        return this._globalStorageUri?.fsPath;
    }

    /**
     * Get the log path (deprecated, use logUri)
     * @returns {string}
     */
    get logPath() {
        return this._logUri?.fsPath;
    }

    /**
     * Get a path relative to the extension directory
     * @param {...string} pathSegments - Path segments
     * @returns {string}
     */
    asAbsolutePath(...pathSegments) {
        return [this._extensionPath, ...pathSegments].join('/');
    }

    /**
     * Dispose all subscriptions and cleanup
     * @returns {Promise<void>}
     */
    async dispose() {
        console.log(`Disposing ExtensionContext for: ${this._extensionId}`);

        // Dispose all subscriptions in reverse order
        const subscriptions = this._subscriptions.splice(0);
        
        for (let i = subscriptions.length - 1; i >= 0; i--) {
            const subscription = subscriptions[i];
            try {
                if (subscription && typeof subscription.dispose === 'function') {
                    const result = subscription.dispose();
                    if (result instanceof Promise) {
                        await result;
                    }
                }
            } catch (error) {
                console.error(`Error disposing subscription in ${this._extensionId}:`, error);
            }
        }

        // Clear state
        this._isActivated = false;
        
        console.log(`ExtensionContext disposed for: ${this._extensionId}`);
    }
}

/**
 * ExtensionContextFactory - Factory for creating extension contexts
 */
class ExtensionContextFactory {
    /**
     * @param {Object} storageBackend - Default storage backend
     */
    constructor(storageBackend = null) {
        this._storageBackend = storageBackend;
        this._contexts = new Map();
    }

    /**
     * Create a new extension context
     * @param {Object} extension - Extension metadata
     * @param {Object} options - Additional options
     * @returns {ExtensionContext}
     */
    create(extension, options = {}) {
        const extensionId = extension.id || extension.name;
        
        // Check if context already exists
        if (this._contexts.has(extensionId)) {
            console.warn(`Context already exists for ${extensionId}, returning existing context`);
            return this._contexts.get(extensionId);
        }

        const context = new ExtensionContext({
            extension,
            extensionPath: options.extensionPath || `/extensions/${extensionId}`,
            storageBackend: options.storageBackend || this._storageBackend,
            extensionMode: options.extensionMode || ExtensionMode.Production
        });

        this._contexts.set(extensionId, context);
        return context;
    }

    /**
     * Get an existing context
     * @param {string} extensionId 
     * @returns {ExtensionContext | undefined}
     */
    get(extensionId) {
        return this._contexts.get(extensionId);
    }

    /**
     * Dispose a specific context
     * @param {string} extensionId 
     * @returns {Promise<void>}
     */
    async dispose(extensionId) {
        const context = this._contexts.get(extensionId);
        if (context) {
            await context.dispose();
            this._contexts.delete(extensionId);
        }
    }

    /**
     * Dispose all contexts
     * @returns {Promise<void>}
     */
    async disposeAll() {
        const disposePromises = [];
        
        for (const context of this._contexts.values()) {
            disposePromises.push(context.dispose());
        }
        
        await Promise.all(disposePromises);
        this._contexts.clear();
    }

    /**
     * Get the number of active contexts
     * @returns {number}
     */
    get size() {
        return this._contexts.size;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionContext,
        ExtensionContextFactory,
        ExtensionMode,
        ExtensionKind,
        Memento,
        SecretStorage,
        EnvironmentVariableCollection
    };
} else if (typeof window !== 'undefined') {
    window.ExtensionContext = ExtensionContext;
    window.ExtensionContextFactory = ExtensionContextFactory;
    window.ExtensionMode = ExtensionMode;
    window.ExtensionKind = ExtensionKind;
    window.Memento = Memento;
    window.SecretStorage = SecretStorage;
    window.EnvironmentVariableCollection = EnvironmentVariableCollection;
}
