/**
 * ContributionRegistry - Manages extension contributions
 * 
 * A centralized registry for all contribution points from extensions.
 * Modeled after VS Code's contribution point system, this provides:
 * - Registration of contribution point handlers
 * - Collection and organization of contributions by type
 * - Resolution and validation of contributions
 * - Event-based notification of contribution changes
 * 
 * @see https://code.visualstudio.com/api/references/contribution-points
 */

/**
 * ContributionPointDescriptor - Describes a contribution point type
 */
class ContributionPointDescriptor {
    /**
     * @param {Object} options - Descriptor options
     */
    constructor(options) {
        this.id = options.id;
        this.description = options.description || '';
        this.schema = options.schema || null;
        this.validate = options.validate || (() => true);
        this.transform = options.transform || ((c) => c);
        this.allowMultiple = options.allowMultiple !== false;
        this.priority = options.priority || 0;
    }
}

/**
 * Contribution - Represents a single contribution from an extension
 */
class Contribution {
    /**
     * @param {string} extensionId - The contributing extension's ID
     * @param {string} pointId - The contribution point ID
     * @param {Object} value - The contribution value
     */
    constructor(extensionId, pointId, value) {
        this.id = `${extensionId}:${pointId}:${Date.now()}`;
        this.extensionId = extensionId;
        this.pointId = pointId;
        this.value = value;
        this.timestamp = Date.now();
        this.isActive = true;
    }

    /**
     * Deactivate this contribution
     */
    deactivate() {
        this.isActive = false;
    }

    /**
     * Activate this contribution
     */
    activate() {
        this.isActive = true;
    }
}

/**
 * ContributionCollection - Collection of contributions for a specific point
 */
class ContributionCollection {
    /**
     * @param {string} pointId - The contribution point ID
     * @param {ContributionPointDescriptor} descriptor - The point descriptor
     */
    constructor(pointId, descriptor) {
        this.pointId = pointId;
        this.descriptor = descriptor;
        /** @type {Map<string, Contribution[]>} */
        this._byExtension = new Map();
        /** @type {Contribution[]} */
        this._all = [];
    }

    /**
     * Add a contribution
     * @param {Contribution} contribution 
     */
    add(contribution) {
        // Validate contribution
        if (!this.descriptor.validate(contribution.value)) {
            throw new Error(`Invalid contribution to ${this.pointId} from ${contribution.extensionId}`);
        }

        // Transform contribution value
        contribution.value = this.descriptor.transform(contribution.value);

        // Add to collections
        if (!this._byExtension.has(contribution.extensionId)) {
            this._byExtension.set(contribution.extensionId, []);
        }

        // Check for duplicates if not allowed
        if (!this.descriptor.allowMultiple) {
            const existing = this._byExtension.get(contribution.extensionId);
            if (existing.length > 0) {
                // Replace existing contribution
                this._removeByExtension(contribution.extensionId);
            }
        }

        this._byExtension.get(contribution.extensionId).push(contribution);
        this._all.push(contribution);

        // Sort by priority if descriptor has priority
        this._sortByPriority();
    }

    /**
     * Remove contributions from an extension
     * @param {string} extensionId 
     */
    _removeByExtension(extensionId) {
        const contributions = this._byExtension.get(extensionId) || [];
        
        for (const contribution of contributions) {
            const index = this._all.indexOf(contribution);
            if (index !== -1) {
                this._all.splice(index, 1);
            }
        }

        this._byExtension.delete(extensionId);
    }

    /**
     * Remove a contribution by its ID
     * @param {string} contributionId 
     * @returns {boolean}
     */
    removeById(contributionId) {
        for (const [extensionId, contributions] of this._byExtension) {
            const index = contributions.findIndex(c => c.id === contributionId);
            if (index !== -1) {
                contributions.splice(index, 1);
                
                const allIndex = this._all.findIndex(c => c.id === contributionId);
                if (allIndex !== -1) {
                    this._all.splice(allIndex, 1);
                }

                if (contributions.length === 0) {
                    this._byExtension.delete(extensionId);
                }

                return true;
            }
        }

        return false;
    }

    /**
     * Remove all contributions from an extension
     * @param {string} extensionId 
     * @returns {Contribution[]}
     */
    removeByExtension(extensionId) {
        const removed = this._byExtension.get(extensionId) || [];
        this._removeByExtension(extensionId);
        return removed;
    }

    /**
     * Get all active contributions
     * @returns {Contribution[]}
     */
    getAll() {
        return this._all.filter(c => c.isActive);
    }

    /**
     * Get all contribution values
     * @returns {any[]}
     */
    getAllValues() {
        return this.getAll().map(c => c.value);
    }

    /**
     * Get contributions from a specific extension
     * @param {string} extensionId 
     * @returns {Contribution[]}
     */
    getByExtension(extensionId) {
        return (this._byExtension.get(extensionId) || []).filter(c => c.isActive);
    }

    /**
     * Get contribution count
     * @returns {number}
     */
    get size() {
        return this._all.filter(c => c.isActive).length;
    }

    /**
     * Sort contributions by priority
     * @private
     */
    _sortByPriority() {
        this._all.sort((a, b) => {
            const priorityA = a.value.priority ?? this.descriptor.priority ?? 0;
            const priorityB = b.value.priority ?? this.descriptor.priority ?? 0;
            return priorityB - priorityA;
        });
    }

    /**
     * Clear all contributions
     */
    clear() {
        this._byExtension.clear();
        this._all = [];
    }

    /**
     * Iterate over all contributions
     * @param {Function} callback 
     */
    forEach(callback) {
        for (const contribution of this.getAll()) {
            callback(contribution);
        }
    }
}

/**
 * ContributionRegistry - Central registry for all contribution points
 */
class ContributionRegistry {
    constructor() {
        /** @type {Map<string, ContributionPointDescriptor>} */
        this._descriptors = new Map();
        /** @type {Map<string, ContributionCollection>} */
        this._collections = new Map();
        /** @type {Set<string>} */
        this._registeredExtensions = new Set();
        
        this._eventEmitter = new EventTarget();
        
        // Register built-in contribution points
        this._registerBuiltinPoints();

        console.log('ContributionRegistry initialized');
    }

    /**
     * Register built-in contribution points
     * @private
     */
    _registerBuiltinPoints() {
        // Commands contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'commands',
            description: 'Contribute commands that can be invoked',
            allowMultiple: true,
            validate: (cmd) => cmd && cmd.command && cmd.title,
            transform: (cmd) => ({
                id: cmd.command,
                title: cmd.title,
                category: cmd.category || '',
                description: cmd.description || '',
                icon: cmd.icon || null,
                enablement: cmd.enablement || null
            })
        }));

        // Functions contribution point (for AI tools)
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'functions',
            description: 'Contribute functions for AI tool integration',
            allowMultiple: true,
            validate: (func) => func && func.name && func.description && func.parameters,
            transform: (func) => ({
                name: func.name,
                description: func.description,
                parameters: func.parameters,
                executor: func.executor || null,
                returnType: func.returnType || 'object',
                examples: func.examples || [],
                category: func.category || 'general',
                priority: func.priority || 'normal'
            })
        }));

        // Visualizations contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'visualizations',
            description: 'Contribute data visualizations',
            allowMultiple: true,
            validate: (viz) => viz && viz.id && viz.name && viz.supportedDataTypes,
            transform: (viz) => ({
                id: viz.id,
                name: viz.name,
                description: viz.description || '',
                supportedDataTypes: viz.supportedDataTypes,
                executor: viz.executor || null,
                options: viz.options || {},
                priority: viz.priority || 0
            })
        }));

        // Configuration contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'configuration',
            description: 'Contribute configuration schemas',
            allowMultiple: false,
            validate: (config) => config && (config.properties || config.title)
        }));

        // Menus contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'menus',
            description: 'Contribute menu items',
            allowMultiple: true
        }));

        // Keybindings contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'keybindings',
            description: 'Contribute keyboard shortcuts',
            allowMultiple: true,
            validate: (kb) => kb && kb.command && kb.key
        }));

        // Views contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'views',
            description: 'Contribute sidebar views',
            allowMultiple: true
        }));

        // Languages contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'languages',
            description: 'Contribute language support',
            allowMultiple: true
        }));

        // Utilities contribution point
        this.registerContributionPoint(new ContributionPointDescriptor({
            id: 'utilities',
            description: 'Contribute utility functions',
            allowMultiple: true
        }));
    }

    /**
     * Register a new contribution point
     * @param {ContributionPointDescriptor} descriptor 
     */
    registerContributionPoint(descriptor) {
        if (this._descriptors.has(descriptor.id)) {
            console.warn(`Contribution point ${descriptor.id} is already registered`);
            return;
        }

        this._descriptors.set(descriptor.id, descriptor);
        this._collections.set(descriptor.id, new ContributionCollection(descriptor.id, descriptor));

        this._emitEvent('contributionPointRegistered', { pointId: descriptor.id });
        console.log(`Contribution point registered: ${descriptor.id}`);
    }

    /**
     * Get a contribution point descriptor
     * @param {string} pointId 
     * @returns {ContributionPointDescriptor | undefined}
     */
    getContributionPoint(pointId) {
        return this._descriptors.get(pointId);
    }

    /**
     * Get all registered contribution point IDs
     * @returns {string[]}
     */
    getContributionPointIds() {
        return Array.from(this._descriptors.keys());
    }

    /**
     * Register contributions from an extension manifest
     * @param {string} extensionId - Extension ID
     * @param {Object} contributes - Contribution definitions from manifest
     */
    registerContributions(extensionId, contributes) {
        if (!contributes || typeof contributes !== 'object') {
            return;
        }

        this._registeredExtensions.add(extensionId);

        for (const [pointId, contributions] of Object.entries(contributes)) {
            if (!this._collections.has(pointId)) {
                console.warn(`Unknown contribution point: ${pointId} from ${extensionId}`);
                continue;
            }

            const collection = this._collections.get(pointId);

            // Handle both array and object contributions
            if (Array.isArray(contributions)) {
                for (const contrib of contributions) {
                    this._addContribution(collection, extensionId, pointId, contrib);
                }
            } else if (typeof contributions === 'object') {
                // For object-style contributions (like functions: {name: {...}})
                for (const [key, value] of Object.entries(contributions)) {
                    const contrib = { name: key, ...value };
                    this._addContribution(collection, extensionId, pointId, contrib);
                }
            }
        }

        this._emitEvent('contributionsRegistered', { extensionId });
    }

    /**
     * Add a single contribution
     * @private
     */
    _addContribution(collection, extensionId, pointId, value) {
        try {
            const contribution = new Contribution(extensionId, pointId, value);
            collection.add(contribution);

            this._emitEvent('contributionAdded', {
                extensionId,
                pointId,
                contributionId: contribution.id
            });

        } catch (error) {
            console.error(`Failed to add contribution from ${extensionId} to ${pointId}:`, error);
        }
    }

    /**
     * Unregister all contributions from an extension
     * @param {string} extensionId 
     */
    unregisterContributions(extensionId) {
        for (const collection of this._collections.values()) {
            const removed = collection.removeByExtension(extensionId);
            
            if (removed.length > 0) {
                this._emitEvent('contributionsRemoved', {
                    extensionId,
                    pointId: collection.pointId,
                    count: removed.length
                });
            }
        }

        this._registeredExtensions.delete(extensionId);
        this._emitEvent('contributionsUnregistered', { extensionId });
    }

    /**
     * Get contributions for a specific point
     * @param {string} pointId 
     * @returns {ContributionCollection | undefined}
     */
    getContributions(pointId) {
        return this._collections.get(pointId);
    }

    /**
     * Get all contribution values for a point
     * @param {string} pointId 
     * @returns {any[]}
     */
    getContributionValues(pointId) {
        const collection = this._collections.get(pointId);
        return collection ? collection.getAllValues() : [];
    }

    /**
     * Get contributions from a specific extension for a point
     * @param {string} pointId 
     * @param {string} extensionId 
     * @returns {Contribution[]}
     */
    getContributionsByExtension(pointId, extensionId) {
        const collection = this._collections.get(pointId);
        return collection ? collection.getByExtension(extensionId) : [];
    }

    /**
     * Check if an extension has registered contributions
     * @param {string} extensionId 
     * @returns {boolean}
     */
    hasContributionsFrom(extensionId) {
        return this._registeredExtensions.has(extensionId);
    }

    /**
     * Get statistics about contributions
     * @returns {Object}
     */
    getStats() {
        const stats = {
            registeredExtensions: this._registeredExtensions.size,
            contributionPoints: this._descriptors.size,
            byPoint: {}
        };

        for (const [pointId, collection] of this._collections) {
            stats.byPoint[pointId] = collection.size;
        }

        return stats;
    }

    /**
     * Find contributions matching a predicate
     * @param {string} pointId 
     * @param {Function} predicate 
     * @returns {Contribution[]}
     */
    findContributions(pointId, predicate) {
        const collection = this._collections.get(pointId);
        if (!collection) {
            return [];
        }

        return collection.getAll().filter(c => predicate(c.value));
    }

    /**
     * Get a flattened view of all functions across extensions
     * @returns {Object[]}
     */
    getAllFunctions() {
        const functions = [];
        const collection = this._collections.get('functions');
        
        if (collection) {
            for (const contribution of collection.getAll()) {
                functions.push({
                    ...contribution.value,
                    extensionId: contribution.extensionId,
                    contributionId: contribution.id
                });
            }
        }

        return functions;
    }

    /**
     * Get a flattened view of all commands
     * @returns {Object[]}
     */
    getAllCommands() {
        const commands = [];
        const collection = this._collections.get('commands');
        
        if (collection) {
            for (const contribution of collection.getAll()) {
                commands.push({
                    ...contribution.value,
                    extensionId: contribution.extensionId,
                    contributionId: contribution.id
                });
            }
        }

        return commands;
    }

    /**
     * Get a flattened view of all visualizations
     * @returns {Object[]}
     */
    getAllVisualizations() {
        const visualizations = [];
        const collection = this._collections.get('visualizations');
        
        if (collection) {
            for (const contribution of collection.getAll()) {
                visualizations.push({
                    ...contribution.value,
                    extensionId: contribution.extensionId,
                    contributionId: contribution.id
                });
            }
        }

        return visualizations;
    }

    /**
     * Emit an event
     * @private
     */
    _emitEvent(eventType, data) {
        const event = new CustomEvent('contributionRegistry', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });

        this._eventEmitter.dispatchEvent(event);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
    }

    /**
     * Add event listener
     * @param {string} eventType 
     * @param {Function} callback 
     * @returns {Object}
     */
    on(eventType, callback) {
        const handler = (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        };

        this._eventEmitter.addEventListener('contributionRegistry', handler);

        return {
            dispose: () => {
                this._eventEmitter.removeEventListener('contributionRegistry', handler);
            }
        };
    }

    /**
     * Clear all contributions
     */
    clear() {
        for (const collection of this._collections.values()) {
            collection.clear();
        }
        this._registeredExtensions.clear();
        this._emitEvent('cleared', {});
    }

    /**
     * Dispose the registry
     */
    dispose() {
        this.clear();
        this._descriptors.clear();
        this._collections.clear();
    }
}

/**
 * ContributionPointHandler - Base class for handling specific contribution types
 */
class ContributionPointHandler {
    /**
     * @param {ContributionRegistry} registry 
     * @param {string} pointId 
     */
    constructor(registry, pointId) {
        this._registry = registry;
        this._pointId = pointId;
        this._handlers = new Map();
    }

    /**
     * Get all contributions for this point
     * @returns {Contribution[]}
     */
    getContributions() {
        const collection = this._registry.getContributions(this._pointId);
        return collection ? collection.getAll() : [];
    }

    /**
     * Register a handler for a specific contribution
     * @param {string} contributionId 
     * @param {Function} handler 
     */
    registerHandler(contributionId, handler) {
        this._handlers.set(contributionId, handler);
    }

    /**
     * Execute a handler for a contribution
     * @param {string} contributionId 
     * @param {any} args 
     * @returns {any}
     */
    async executeHandler(contributionId, ...args) {
        const handler = this._handlers.get(contributionId);
        if (!handler) {
            throw new Error(`No handler registered for contribution: ${contributionId}`);
        }

        return await handler(...args);
    }

    /**
     * Dispose this handler
     */
    dispose() {
        this._handlers.clear();
    }
}

/**
 * CommandContributionHandler - Handles command contributions
 */
class CommandContributionHandler extends ContributionPointHandler {
    constructor(registry) {
        super(registry, 'commands');
    }

    /**
     * Get all commands
     * @returns {Object[]}
     */
    getCommands() {
        return this.getContributions().map(c => ({
            id: c.value.id,
            title: c.value.title,
            category: c.value.category,
            extensionId: c.extensionId
        }));
    }

    /**
     * Get command by ID
     * @param {string} commandId 
     * @returns {Object | undefined}
     */
    getCommand(commandId) {
        const contributions = this.getContributions();
        const contribution = contributions.find(c => c.value.id === commandId);
        return contribution ? contribution.value : undefined;
    }
}

/**
 * FunctionContributionHandler - Handles function contributions (for AI tools)
 */
class FunctionContributionHandler extends ContributionPointHandler {
    constructor(registry) {
        super(registry, 'functions');
    }

    /**
     * Get all functions for LLM integration
     * @returns {Object[]}
     */
    getFunctionsForLLM() {
        return this.getContributions().map(c => ({
            name: `${c.extensionId}.${c.value.name}`,
            description: c.value.description,
            parameters: c.value.parameters,
            extensionId: c.extensionId,
            category: c.value.category
        }));
    }

    /**
     * Get function by full name
     * @param {string} fullName - Format: extensionId.functionName
     * @returns {Object | undefined}
     */
    getFunction(fullName) {
        const [extensionId, functionName] = fullName.split('.');
        const contributions = this.getContributions();
        
        const contribution = contributions.find(c => 
            c.extensionId === extensionId && c.value.name === functionName
        );

        return contribution ? {
            ...contribution.value,
            extensionId: contribution.extensionId,
            contributionId: contribution.id
        } : undefined;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ContributionRegistry,
        ContributionPointDescriptor,
        Contribution,
        ContributionCollection,
        ContributionPointHandler,
        CommandContributionHandler,
        FunctionContributionHandler
    };
} else if (typeof window !== 'undefined') {
    window.ContributionRegistry = ContributionRegistry;
    window.ContributionPointDescriptor = ContributionPointDescriptor;
    window.Contribution = Contribution;
    window.ContributionCollection = ContributionCollection;
    window.ContributionPointHandler = ContributionPointHandler;
    window.CommandContributionHandler = CommandContributionHandler;
    window.FunctionContributionHandler = FunctionContributionHandler;
}
