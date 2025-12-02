/**
 * ActivationEventsService - Lazy activation event system
 * 
 * Modeled after VS Code's activation events, this provides:
 * - Event-based lazy loading of extensions
 * - Support for various activation triggers
 * - Dependency-aware activation ordering
 * - Performance optimization through deferred loading
 * 
 * @see https://code.visualstudio.com/api/references/activation-events
 */

/**
 * Activation trigger types
 * @readonly
 * @enum {string}
 */
const ActivationTrigger = {
    /** Explicit activation request */
    Explicit: 'explicit',
    /** Activated by dependent extension */
    Dependency: 'dependency',
    /** Activated by activation event */
    Event: 'event',
    /** Activated on startup */
    Startup: 'startup',
    /** Activated after startup finished */
    StartupFinished: 'startupFinished'
};

/**
 * ActivationRequest - Represents a pending activation request
 */
class ActivationRequest {
    /**
     * @param {string} extensionId - Extension to activate
     * @param {string} trigger - Activation trigger type
     * @param {string} event - The activation event that triggered this
     */
    constructor(extensionId, trigger, event = null) {
        this.id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.extensionId = extensionId;
        this.trigger = trigger;
        this.event = event;
        this.timestamp = Date.now();
        this.status = 'pending';
        this.error = null;
        this.duration = null;
    }

    /**
     * Mark as started
     */
    start() {
        this.status = 'activating';
        this._startTime = performance.now();
    }

    /**
     * Mark as completed
     */
    complete() {
        this.status = 'completed';
        this.duration = performance.now() - this._startTime;
    }

    /**
     * Mark as failed
     * @param {Error} error 
     */
    fail(error) {
        this.status = 'failed';
        this.error = error.message;
        this.duration = performance.now() - this._startTime;
    }
}

/**
 * ActivationQueue - Manages activation request queue
 */
class ActivationQueue {
    constructor() {
        /** @type {ActivationRequest[]} */
        this._queue = [];
        /** @type {Map<string, ActivationRequest>} */
        this._pending = new Map();
        /** @type {Map<string, ActivationRequest>} */
        this._completed = new Map();
        this._isProcessing = false;
    }

    /**
     * Add a request to the queue
     * @param {ActivationRequest} request 
     */
    enqueue(request) {
        // Skip if already activated or pending
        if (this._completed.has(request.extensionId)) {
            return false;
        }

        if (this._pending.has(request.extensionId)) {
            return false;
        }

        this._queue.push(request);
        this._pending.set(request.extensionId, request);
        return true;
    }

    /**
     * Get the next request from the queue
     * @returns {ActivationRequest | null}
     */
    dequeue() {
        return this._queue.shift() || null;
    }

    /**
     * Mark an extension as activated
     * @param {ActivationRequest} request 
     */
    markCompleted(request) {
        this._pending.delete(request.extensionId);
        this._completed.set(request.extensionId, request);
    }

    /**
     * Check if an extension is already activated
     * @param {string} extensionId 
     * @returns {boolean}
     */
    isActivated(extensionId) {
        return this._completed.has(extensionId);
    }

    /**
     * Check if an extension is pending activation
     * @param {string} extensionId 
     * @returns {boolean}
     */
    isPending(extensionId) {
        return this._pending.has(extensionId);
    }

    /**
     * Get queue size
     * @returns {number}
     */
    get size() {
        return this._queue.length;
    }

    /**
     * Get all completed activations
     * @returns {ActivationRequest[]}
     */
    getCompleted() {
        return Array.from(this._completed.values());
    }

    /**
     * Clear the queue
     */
    clear() {
        this._queue = [];
        this._pending.clear();
    }
}

/**
 * ActivationEventsService - Main activation events service
 */
class ActivationEventsService {
    /**
     * @param {Object} options - Service options
     */
    constructor(options = {}) {
        this._options = {
            enableStartupActivation: true,
            enableLazyActivation: true,
            activationTimeout: 30000, // 30 seconds
            ...options
        };

        // Event listeners by activation event type
        /** @type {Map<string, Set<string>>} */
        this._eventToExtensions = new Map();

        // Extension manifests
        /** @type {Map<string, Object>} */
        this._manifests = new Map();

        // Activation queue
        this._queue = new ActivationQueue();

        // Activation handler
        this._activationHandler = null;

        // Event emitter
        this._eventEmitter = new EventTarget();

        // Statistics
        this._stats = {
            totalActivations: 0,
            successfulActivations: 0,
            failedActivations: 0,
            totalActivationTime: 0,
            eventTriggers: new Map()
        };

        // Startup state
        this._isStartupComplete = false;
        this._startupActivationPromise = null;

        console.log('ActivationEventsService initialized');
    }

    /**
     * Set the activation handler
     * @param {Function} handler - Handler function (extensionId, trigger, event) => Promise<void>
     */
    setActivationHandler(handler) {
        this._activationHandler = handler;
    }

    /**
     * Register an extension's activation events
     * @param {string} extensionId - Extension ID
     * @param {Object} manifest - Extension manifest
     */
    registerExtension(extensionId, manifest) {
        this._manifests.set(extensionId, manifest);

        const activationEvents = manifest.activationEvents || [];

        for (const event of activationEvents) {
            if (!this._eventToExtensions.has(event)) {
                this._eventToExtensions.set(event, new Set());
            }
            this._eventToExtensions.get(event).add(extensionId);
        }

        console.log(`Registered activation events for ${extensionId}:`, activationEvents);
    }

    /**
     * Unregister an extension
     * @param {string} extensionId 
     */
    unregisterExtension(extensionId) {
        this._manifests.delete(extensionId);

        for (const [event, extensions] of this._eventToExtensions) {
            extensions.delete(extensionId);
            if (extensions.size === 0) {
                this._eventToExtensions.delete(event);
            }
        }
    }

    /**
     * Trigger activation for a specific event
     * @param {string} event - The activation event (e.g., "onCommand:myCommand")
     * @returns {Promise<void>}
     */
    async triggerEvent(event) {
        console.log(`Triggering activation event: ${event}`);

        // Track event trigger
        const count = this._stats.eventTriggers.get(event) || 0;
        this._stats.eventTriggers.set(event, count + 1);

        // Find extensions that should activate
        const extensions = this._getExtensionsForEvent(event);

        if (extensions.length === 0) {
            console.log(`No extensions registered for event: ${event}`);
            return;
        }

        console.log(`Found ${extensions.length} extensions for event:`, extensions);

        // Queue activation requests
        const requests = extensions.map(extId => 
            new ActivationRequest(extId, ActivationTrigger.Event, event)
        );

        for (const request of requests) {
            this._queue.enqueue(request);
        }

        // Process queue
        await this._processQueue();

        this._emitEvent('eventTriggered', { event, extensions });
    }

    /**
     * Get extensions that should activate for an event
     * @private
     * @param {string} event 
     * @returns {string[]}
     */
    _getExtensionsForEvent(event) {
        const extensions = new Set();

        // Direct match
        const direct = this._eventToExtensions.get(event);
        if (direct) {
            for (const ext of direct) {
                extensions.add(ext);
            }
        }

        // Pattern match (e.g., "onCommand:*" matches "onCommand:myCommand")
        for (const [pattern, exts] of this._eventToExtensions) {
            if (pattern.endsWith('*')) {
                const prefix = pattern.slice(0, -1);
                if (event.startsWith(prefix)) {
                    for (const ext of exts) {
                        extensions.add(ext);
                    }
                }
            }
        }

        // Startup event matches all
        if (this._eventToExtensions.has('*')) {
            for (const ext of this._eventToExtensions.get('*')) {
                extensions.add(ext);
            }
        }

        return Array.from(extensions);
    }

    /**
     * Activate extensions registered for startup
     * @returns {Promise<void>}
     */
    async activateStartupExtensions() {
        if (this._startupActivationPromise) {
            return this._startupActivationPromise;
        }

        console.log('Activating startup extensions...');

        this._startupActivationPromise = this._performStartupActivation();
        await this._startupActivationPromise;

        this._isStartupComplete = true;
        this._emitEvent('startupComplete', {});
    }

    /**
     * Perform startup activation
     * @private
     */
    async _performStartupActivation() {
        // First, activate '*' extensions
        const immediateExtensions = this._eventToExtensions.get('*') || new Set();
        
        for (const extensionId of immediateExtensions) {
            const request = new ActivationRequest(
                extensionId, 
                ActivationTrigger.Startup, 
                '*'
            );
            this._queue.enqueue(request);
        }

        await this._processQueue();

        // Then activate 'onStartupFinished' extensions
        const deferredExtensions = this._eventToExtensions.get('onStartupFinished') || new Set();
        
        // Use setTimeout to defer these activations
        if (deferredExtensions.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
            
            for (const extensionId of deferredExtensions) {
                const request = new ActivationRequest(
                    extensionId,
                    ActivationTrigger.StartupFinished,
                    'onStartupFinished'
                );
                this._queue.enqueue(request);
            }

            await this._processQueue();
        }

        console.log('Startup activation complete');
    }

    /**
     * Explicitly activate an extension
     * @param {string} extensionId 
     * @returns {Promise<void>}
     */
    async activateExtension(extensionId) {
        if (this._queue.isActivated(extensionId)) {
            console.log(`Extension ${extensionId} is already activated`);
            return;
        }

        const request = new ActivationRequest(extensionId, ActivationTrigger.Explicit);
        
        if (!this._queue.enqueue(request)) {
            // Already pending
            return;
        }

        await this._processQueue();
    }

    /**
     * Activate an extension as a dependency
     * @param {string} extensionId - Extension that needs the dependency
     * @param {string} dependencyId - The dependency to activate
     * @returns {Promise<void>}
     */
    async activateDependency(extensionId, dependencyId) {
        if (this._queue.isActivated(dependencyId)) {
            return;
        }

        console.log(`Activating dependency ${dependencyId} for ${extensionId}`);

        const request = new ActivationRequest(
            dependencyId,
            ActivationTrigger.Dependency,
            `dependency:${extensionId}`
        );

        this._queue.enqueue(request);
        await this._processQueue();
    }

    /**
     * Process the activation queue
     * @private
     */
    async _processQueue() {
        if (this._queue._isProcessing) {
            return;
        }

        this._queue._isProcessing = true;

        try {
            while (this._queue.size > 0) {
                const request = this._queue.dequeue();
                if (!request) break;

                await this._activateExtension(request);
            }
        } finally {
            this._queue._isProcessing = false;
        }
    }

    /**
     * Activate a single extension
     * @private
     * @param {ActivationRequest} request 
     */
    async _activateExtension(request) {
        // Skip if already activated
        if (this._queue.isActivated(request.extensionId)) {
            return;
        }

        request.start();

        try {
            console.log(`Activating extension: ${request.extensionId} (${request.trigger})`);

            // Check for dependencies
            const manifest = this._manifests.get(request.extensionId);
            if (manifest && manifest.extensionDependencies) {
                for (const depId of manifest.extensionDependencies) {
                    await this.activateDependency(request.extensionId, depId);
                }
            }

            // Call activation handler
            if (this._activationHandler) {
                await Promise.race([
                    this._activationHandler(request.extensionId, request.trigger, request.event),
                    this._createTimeoutPromise(request.extensionId)
                ]);
            }

            request.complete();
            this._queue.markCompleted(request);

            // Update stats
            this._stats.totalActivations++;
            this._stats.successfulActivations++;
            this._stats.totalActivationTime += request.duration;

            this._emitEvent('extensionActivated', {
                extensionId: request.extensionId,
                trigger: request.trigger,
                event: request.event,
                duration: request.duration
            });

            console.log(`Extension ${request.extensionId} activated in ${request.duration?.toFixed(2)}ms`);

        } catch (error) {
            request.fail(error);
            this._queue.markCompleted(request);

            this._stats.totalActivations++;
            this._stats.failedActivations++;

            this._emitEvent('extensionActivationFailed', {
                extensionId: request.extensionId,
                trigger: request.trigger,
                error: error.message
            });

            console.error(`Failed to activate ${request.extensionId}:`, error);
        }
    }

    /**
     * Create a timeout promise
     * @private
     * @param {string} extensionId 
     * @returns {Promise}
     */
    _createTimeoutPromise(extensionId) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Activation timeout for ${extensionId}`));
            }, this._options.activationTimeout);
        });
    }

    /**
     * Check if an extension is activated
     * @param {string} extensionId 
     * @returns {boolean}
     */
    isActivated(extensionId) {
        return this._queue.isActivated(extensionId);
    }

    /**
     * Get activation info for an extension
     * @param {string} extensionId 
     * @returns {Object | null}
     */
    getActivationInfo(extensionId) {
        const completed = this._queue._completed.get(extensionId);
        if (!completed) {
            return null;
        }

        return {
            extensionId: completed.extensionId,
            trigger: completed.trigger,
            event: completed.event,
            timestamp: completed.timestamp,
            duration: completed.duration,
            status: completed.status
        };
    }

    /**
     * Get all activation events for an extension
     * @param {string} extensionId 
     * @returns {string[]}
     */
    getActivationEvents(extensionId) {
        const manifest = this._manifests.get(extensionId);
        return manifest?.activationEvents || [];
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            ...this._stats,
            registeredExtensions: this._manifests.size,
            activatedExtensions: this._queue._completed.size,
            pendingActivations: this._queue._pending.size,
            averageActivationTime: this._stats.totalActivations > 0
                ? this._stats.totalActivationTime / this._stats.successfulActivations
                : 0,
            eventTriggers: Object.fromEntries(this._stats.eventTriggers)
        };
    }

    /**
     * Get all activated extensions
     * @returns {string[]}
     */
    getActivatedExtensions() {
        return Array.from(this._queue._completed.keys());
    }

    /**
     * Emit an event
     * @private
     */
    _emitEvent(eventType, data) {
        const event = new CustomEvent('activationEvents', {
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

        this._eventEmitter.addEventListener('activationEvents', handler);

        return {
            dispose: () => {
                this._eventEmitter.removeEventListener('activationEvents', handler);
            }
        };
    }

    /**
     * Dispose the service
     */
    dispose() {
        this._queue.clear();
        this._eventToExtensions.clear();
        this._manifests.clear();
        this._activationHandler = null;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ActivationEventsService,
        ActivationRequest,
        ActivationQueue,
        ActivationTrigger
    };
} else if (typeof window !== 'undefined') {
    window.ActivationEventsService = ActivationEventsService;
    window.ActivationRequest = ActivationRequest;
    window.ActivationQueue = ActivationQueue;
    window.ActivationTrigger = ActivationTrigger;
}
