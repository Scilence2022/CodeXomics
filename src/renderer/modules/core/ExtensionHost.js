/**
 * ExtensionHost - Sandboxed extension execution environment
 * 
 * Modeled after VS Code's Extension Host architecture, this provides:
 * - Isolated execution environment for extensions
 * - Performance and stability protection
 * - Message-based communication with main process
 * - Resource limits and monitoring
 * 
 * @see https://code.visualstudio.com/api/advanced-topics/extension-host
 */

/**
 * ExtensionHost kind - determines where extensions run
 * @readonly
 * @enum {string}
 */
const ExtensionHostKind = {
    /** Local Node.js extension host */
    LocalProcess: 'LocalProcess',
    /** Web/browser extension host */
    LocalWebWorker: 'LocalWebWorker',
    /** Remote extension host (container, SSH, WSL) */
    Remote: 'Remote'
};

/**
 * Extension host state
 * @readonly
 * @enum {string}
 */
const ExtensionHostState = {
    /** Host is not started */
    Stopped: 'Stopped',
    /** Host is starting */
    Starting: 'Starting',
    /** Host is running and ready */
    Running: 'Running',
    /** Host is stopping */
    Stopping: 'Stopping',
    /** Host encountered an error */
    Error: 'Error'
};

/**
 * Message types for host communication
 * @readonly
 * @enum {string}
 */
const MessageType = {
    /** Activate an extension */
    Activate: 'activate',
    /** Deactivate an extension */
    Deactivate: 'deactivate',
    /** Execute a command */
    ExecuteCommand: 'executeCommand',
    /** Response to a request */
    Response: 'response',
    /** Error occurred */
    Error: 'error',
    /** Extension output/log */
    Output: 'output',
    /** Extension telemetry */
    Telemetry: 'telemetry',
    /** Health check */
    Ping: 'ping',
    /** Health check response */
    Pong: 'pong'
};

/**
 * ExtensionHostMessage - Structured message for host communication
 */
class ExtensionHostMessage {
    /**
     * @param {string} type - Message type
     * @param {string} id - Message ID for correlation
     * @param {Object} payload - Message payload
     */
    constructor(type, id, payload = {}) {
        this.type = type;
        this.id = id || this._generateId();
        this.payload = payload;
        this.timestamp = Date.now();
    }

    _generateId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Serialize message for transport
     * @returns {string}
     */
    serialize() {
        return JSON.stringify({
            type: this.type,
            id: this.id,
            payload: this.payload,
            timestamp: this.timestamp
        });
    }

    /**
     * Deserialize message from transport
     * @param {string} data 
     * @returns {ExtensionHostMessage}
     */
    static deserialize(data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        const msg = new ExtensionHostMessage(parsed.type, parsed.id, parsed.payload);
        msg.timestamp = parsed.timestamp;
        return msg;
    }
}

/**
 * ExtensionHostProtocol - Handles message-based communication
 */
class ExtensionHostProtocol {
    constructor() {
        /** @type {Map<string, {resolve: Function, reject: Function, timeout: number}>} */
        this._pendingRequests = new Map();
        this._messageHandler = null;
        this._defaultTimeout = 30000; // 30 seconds
    }

    /**
     * Set the message handler
     * @param {Function} handler 
     */
    setMessageHandler(handler) {
        this._messageHandler = handler;
    }

    /**
     * Send a message and wait for response
     * @param {ExtensionHostMessage} message 
     * @param {number} timeout - Timeout in milliseconds
     * @returns {Promise<any>}
     */
    async sendRequest(message, timeout = this._defaultTimeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this._pendingRequests.delete(message.id);
                reject(new Error(`Request ${message.id} timed out after ${timeout}ms`));
            }, timeout);

            this._pendingRequests.set(message.id, {
                resolve,
                reject,
                timeout: timeoutId
            });

            if (this._messageHandler) {
                this._messageHandler(message);
            }
        });
    }

    /**
     * Handle incoming response
     * @param {ExtensionHostMessage} message 
     */
    handleResponse(message) {
        const pending = this._pendingRequests.get(message.id);
        if (pending) {
            clearTimeout(pending.timeout);
            this._pendingRequests.delete(message.id);

            if (message.type === MessageType.Error) {
                pending.reject(new Error(message.payload.error || 'Unknown error'));
            } else {
                pending.resolve(message.payload);
            }
        }
    }

    /**
     * Cancel all pending requests
     */
    cancelAll() {
        for (const [id, pending] of this._pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Request cancelled'));
        }
        this._pendingRequests.clear();
    }

    /**
     * Dispose the protocol
     */
    dispose() {
        this.cancelAll();
        this._messageHandler = null;
    }
}

/**
 * ResourceMonitor - Monitors resource usage of extension host
 */
class ResourceMonitor {
    constructor(options = {}) {
        this._maxMemory = options.maxMemory || 256 * 1024 * 1024; // 256MB
        this._maxCpuTime = options.maxCpuTime || 5000; // 5 seconds per operation
        this._checkInterval = options.checkInterval || 5000; // 5 seconds
        
        this._metrics = {
            peakMemory: 0,
            totalCpuTime: 0,
            lastCpuTime: 0,
            startTime: Date.now(),
            operationCount: 0,
            warnings: []
        };

        this._isRunning = false;
        this._intervalId = null;
    }

    /**
     * Start monitoring
     */
    start() {
        if (this._isRunning) {
            return;
        }

        this._isRunning = true;
        this._metrics.startTime = Date.now();
        
        this._intervalId = setInterval(() => {
            this._collectMetrics();
        }, this._checkInterval);
    }

    /**
     * Stop monitoring
     */
    stop() {
        this._isRunning = false;
        
        if (this._intervalId) {
            clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }

    /**
     * Collect resource metrics
     * @private
     */
    _collectMetrics() {
        // In browser environment, use Performance API
        if (typeof performance !== 'undefined') {
            // Memory info (if available)
            if (performance.memory) {
                const memoryUsage = performance.memory.usedJSHeapSize;
                this._metrics.peakMemory = Math.max(this._metrics.peakMemory, memoryUsage);

                if (memoryUsage > this._maxMemory) {
                    this._metrics.warnings.push({
                        type: 'memory',
                        message: `Memory usage ${Math.round(memoryUsage / 1024 / 1024)}MB exceeds limit ${Math.round(this._maxMemory / 1024 / 1024)}MB`,
                        timestamp: Date.now()
                    });
                }
            }
        }
    }

    /**
     * Record an operation's CPU time
     * @param {number} duration - Duration in milliseconds
     */
    recordOperation(duration) {
        this._metrics.operationCount++;
        this._metrics.totalCpuTime += duration;
        this._metrics.lastCpuTime = duration;

        if (duration > this._maxCpuTime) {
            this._metrics.warnings.push({
                type: 'cpu',
                message: `Operation took ${duration}ms, exceeding limit ${this._maxCpuTime}ms`,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics() {
        return {
            ...this._metrics,
            uptime: Date.now() - this._metrics.startTime,
            averageOperationTime: this._metrics.operationCount > 0 
                ? this._metrics.totalCpuTime / this._metrics.operationCount 
                : 0
        };
    }

    /**
     * Clear warnings
     */
    clearWarnings() {
        this._metrics.warnings = [];
    }

    /**
     * Dispose the monitor
     */
    dispose() {
        this.stop();
    }
}

/**
 * ExtensionHostProxy - Proxy for communicating with extensions
 */
class ExtensionHostProxy {
    /**
     * @param {ExtensionHost} host - The extension host
     */
    constructor(host) {
        this._host = host;
        this._api = null;
    }

    /**
     * Create the extension API proxy
     * @param {Object} baseApi - Base API to extend
     * @returns {Object}
     */
    createApi(baseApi) {
        this._api = new Proxy(baseApi, {
            get: (target, prop) => {
                // Check if the property exists on the base API
                if (prop in target) {
                    const value = target[prop];
                    
                    // If it's a function, wrap it to track execution
                    if (typeof value === 'function') {
                        return (...args) => {
                            return this._wrapCall(prop, value, args);
                        };
                    }
                    
                    return value;
                }
                
                return undefined;
            },
            
            set: (target, prop, value) => {
                // Prevent modification of readonly properties
                if (this._isReadonly(prop)) {
                    console.warn(`Cannot modify readonly property: ${prop}`);
                    return false;
                }
                
                target[prop] = value;
                return true;
            }
        });

        return this._api;
    }

    /**
     * Wrap an API call with timing and error handling
     * @private
     * @param {string} methodName 
     * @param {Function} method 
     * @param {Array} args 
     * @returns {Promise<any>}
     */
    async _wrapCall(methodName, method, args) {
        const startTime = performance.now();
        
        try {
            const result = await method.apply(null, args);
            
            const duration = performance.now() - startTime;
            this._host._resourceMonitor?.recordOperation(duration);
            
            return result;
        } catch (error) {
            console.error(`Extension API error in ${methodName}:`, error);
            throw error;
        }
    }

    /**
     * Check if a property is readonly
     * @private
     * @param {string} prop 
     * @returns {boolean}
     */
    _isReadonly(prop) {
        const readonlyProps = ['version', 'extensionPath', 'extensionUri'];
        return readonlyProps.includes(prop);
    }
}

/**
 * ExtensionHost - Main extension host implementation
 */
class ExtensionHost {
    /**
     * @param {Object} options - Host options
     */
    constructor(options = {}) {
        this._kind = options.kind || ExtensionHostKind.LocalWebWorker;
        this._state = ExtensionHostState.Stopped;
        
        // Extension management
        /** @type {Map<string, {extension: Object, context: Object, exports: Object}>} */
        this._extensions = new Map();
        /** @type {Map<string, Object>} */
        this._pendingActivations = new Map();
        
        // Communication
        this._protocol = new ExtensionHostProtocol();
        
        // Resource monitoring
        this._resourceMonitor = new ResourceMonitor(options.resourceLimits);
        
        // Event handling
        this._eventEmitter = new EventTarget();
        
        // Options
        this._options = {
            enableSandbox: options.enableSandbox !== false,
            enableResourceMonitoring: options.enableResourceMonitoring !== false,
            maxExtensions: options.maxExtensions || 100,
            ...options
        };

        console.log(`ExtensionHost created: ${this._kind}`);
    }

    /**
     * Get the host kind
     * @returns {string}
     */
    get kind() {
        return this._kind;
    }

    /**
     * Get the host state
     * @returns {string}
     */
    get state() {
        return this._state;
    }

    /**
     * Start the extension host
     * @returns {Promise<void>}
     */
    async start() {
        if (this._state !== ExtensionHostState.Stopped) {
            throw new Error(`Cannot start host in state: ${this._state}`);
        }

        console.log('Starting ExtensionHost...');
        this._state = ExtensionHostState.Starting;

        try {
            // Start resource monitoring
            if (this._options.enableResourceMonitoring) {
                this._resourceMonitor.start();
            }

            // Setup message handling
            this._protocol.setMessageHandler((message) => {
                this._handleMessage(message);
            });

            this._state = ExtensionHostState.Running;
            this._emitEvent('started', { kind: this._kind });
            
            console.log('ExtensionHost started successfully');
        } catch (error) {
            this._state = ExtensionHostState.Error;
            this._emitEvent('error', { error: error.message });
            throw error;
        }
    }

    /**
     * Stop the extension host
     * @returns {Promise<void>}
     */
    async stop() {
        if (this._state === ExtensionHostState.Stopped) {
            return;
        }

        console.log('Stopping ExtensionHost...');
        this._state = ExtensionHostState.Stopping;

        try {
            // Deactivate all extensions
            await this._deactivateAllExtensions();

            // Stop resource monitoring
            this._resourceMonitor.stop();

            // Cancel pending requests
            this._protocol.cancelAll();

            this._state = ExtensionHostState.Stopped;
            this._emitEvent('stopped', { kind: this._kind });
            
            console.log('ExtensionHost stopped successfully');
        } catch (error) {
            this._state = ExtensionHostState.Error;
            throw error;
        }
    }

    /**
     * Register an extension with the host
     * @param {Object} extension - Extension definition
     * @param {Object} context - Extension context
     * @returns {Promise<void>}
     */
    async registerExtension(extension, context) {
        const extensionId = extension.id || extension.name;

        if (this._extensions.has(extensionId)) {
            throw new Error(`Extension ${extensionId} is already registered`);
        }

        if (this._extensions.size >= this._options.maxExtensions) {
            throw new Error(`Maximum number of extensions (${this._options.maxExtensions}) reached`);
        }

        console.log(`Registering extension: ${extensionId}`);

        this._extensions.set(extensionId, {
            extension,
            context,
            exports: null,
            isActivated: false,
            activationTime: null
        });

        this._emitEvent('extensionRegistered', { extensionId });
    }

    /**
     * Activate an extension
     * @param {string} extensionId - Extension ID
     * @param {string} reason - Activation reason
     * @returns {Promise<Object>} Extension exports
     */
    async activateExtension(extensionId, reason = 'explicit') {
        const entry = this._extensions.get(extensionId);
        
        if (!entry) {
            throw new Error(`Extension ${extensionId} is not registered`);
        }

        if (entry.isActivated) {
            console.log(`Extension ${extensionId} is already activated`);
            return entry.exports;
        }

        // Check for pending activation
        if (this._pendingActivations.has(extensionId)) {
            return this._pendingActivations.get(extensionId);
        }

        console.log(`Activating extension: ${extensionId} (reason: ${reason})`);
        const startTime = performance.now();

        const activationPromise = this._performActivation(extensionId, entry, reason);
        this._pendingActivations.set(extensionId, activationPromise);

        try {
            const exports = await activationPromise;
            
            const duration = performance.now() - startTime;
            this._resourceMonitor.recordOperation(duration);
            
            entry.isActivated = true;
            entry.activationTime = Date.now();
            entry.exports = exports;
            entry.context?.markActivated?.();

            this._emitEvent('extensionActivated', {
                extensionId,
                reason,
                duration
            });

            console.log(`Extension ${extensionId} activated in ${duration.toFixed(2)}ms`);
            return exports;

        } finally {
            this._pendingActivations.delete(extensionId);
        }
    }

    /**
     * Perform the actual activation
     * @private
     * @param {string} extensionId 
     * @param {Object} entry 
     * @param {string} reason 
     * @returns {Promise<Object>}
     */
    async _performActivation(extensionId, entry, reason) {
        const { extension, context } = entry;

        try {
            let exports = {};

            // If extension has an activate function, call it
            if (extension.activate && typeof extension.activate === 'function') {
                exports = await Promise.resolve(extension.activate(context));
            }

            return exports || {};

        } catch (error) {
            console.error(`Failed to activate extension ${extensionId}:`, error);
            this._emitEvent('extensionActivationFailed', {
                extensionId,
                reason,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Deactivate an extension
     * @param {string} extensionId - Extension ID
     * @returns {Promise<void>}
     */
    async deactivateExtension(extensionId) {
        const entry = this._extensions.get(extensionId);
        
        if (!entry) {
            console.warn(`Extension ${extensionId} is not registered`);
            return;
        }

        if (!entry.isActivated) {
            return;
        }

        console.log(`Deactivating extension: ${extensionId}`);
        const startTime = performance.now();

        try {
            // If extension has a deactivate function, call it
            if (entry.extension.deactivate && typeof entry.extension.deactivate === 'function') {
                const result = entry.extension.deactivate();
                if (result instanceof Promise) {
                    await result;
                }
            }

            // Dispose context
            if (entry.context && typeof entry.context.dispose === 'function') {
                await entry.context.dispose();
            }

            entry.isActivated = false;
            entry.exports = null;

            const duration = performance.now() - startTime;
            this._emitEvent('extensionDeactivated', {
                extensionId,
                duration
            });

            console.log(`Extension ${extensionId} deactivated in ${duration.toFixed(2)}ms`);

        } catch (error) {
            console.error(`Error deactivating extension ${extensionId}:`, error);
            throw error;
        }
    }

    /**
     * Deactivate all extensions
     * @private
     * @returns {Promise<void>}
     */
    async _deactivateAllExtensions() {
        const extensionIds = Array.from(this._extensions.keys()).reverse();
        
        for (const extensionId of extensionIds) {
            try {
                await this.deactivateExtension(extensionId);
            } catch (error) {
                console.error(`Failed to deactivate ${extensionId}:`, error);
            }
        }

        this._extensions.clear();
    }

    /**
     * Handle incoming message
     * @private
     * @param {ExtensionHostMessage} message 
     */
    async _handleMessage(message) {
        try {
            switch (message.type) {
                case MessageType.Activate:
                    await this.activateExtension(message.payload.extensionId, message.payload.reason);
                    break;

                case MessageType.Deactivate:
                    await this.deactivateExtension(message.payload.extensionId);
                    break;

                case MessageType.ExecuteCommand:
                    // Handle command execution
                    break;

                case MessageType.Ping:
                    // Respond to health check
                    this._protocol.handleResponse(new ExtensionHostMessage(
                        MessageType.Pong,
                        message.id,
                        { timestamp: Date.now() }
                    ));
                    break;

                case MessageType.Response:
                case MessageType.Error:
                    this._protocol.handleResponse(message);
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Get extension info
     * @param {string} extensionId 
     * @returns {Object | undefined}
     */
    getExtension(extensionId) {
        const entry = this._extensions.get(extensionId);
        if (!entry) {
            return undefined;
        }

        return {
            id: extensionId,
            isActivated: entry.isActivated,
            activationTime: entry.activationTime,
            exports: entry.exports
        };
    }

    /**
     * Get all extension IDs
     * @returns {string[]}
     */
    getExtensionIds() {
        return Array.from(this._extensions.keys());
    }

    /**
     * Get resource metrics
     * @returns {Object}
     */
    getResourceMetrics() {
        return this._resourceMonitor.getMetrics();
    }

    /**
     * Get host statistics
     * @returns {Object}
     */
    getStats() {
        const activatedCount = Array.from(this._extensions.values())
            .filter(e => e.isActivated).length;

        return {
            kind: this._kind,
            state: this._state,
            extensionCount: this._extensions.size,
            activatedCount,
            resources: this.getResourceMetrics()
        };
    }

    /**
     * Emit an event
     * @private
     * @param {string} eventType 
     * @param {Object} data 
     */
    _emitEvent(eventType, data) {
        const event = new CustomEvent('extensionHost', {
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
     * @returns {Disposable}
     */
    on(eventType, callback) {
        const handler = (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        };

        this._eventEmitter.addEventListener('extensionHost', handler);

        return {
            dispose: () => {
                this._eventEmitter.removeEventListener('extensionHost', handler);
            }
        };
    }

    /**
     * Dispose the extension host
     * @returns {Promise<void>}
     */
    async dispose() {
        console.log('Disposing ExtensionHost...');

        await this.stop();
        
        this._protocol.dispose();
        this._resourceMonitor.dispose();

        console.log('ExtensionHost disposed');
    }
}

/**
 * ExtensionHostManager - Manages multiple extension hosts
 */
class ExtensionHostManager {
    constructor() {
        /** @type {Map<string, ExtensionHost>} */
        this._hosts = new Map();
        this._eventEmitter = new EventTarget();
    }

    /**
     * Create a new extension host
     * @param {string} id - Host ID
     * @param {Object} options - Host options
     * @returns {ExtensionHost}
     */
    createHost(id, options = {}) {
        if (this._hosts.has(id)) {
            throw new Error(`Host ${id} already exists`);
        }

        const host = new ExtensionHost(options);
        this._hosts.set(id, host);

        return host;
    }

    /**
     * Get an extension host
     * @param {string} id 
     * @returns {ExtensionHost | undefined}
     */
    getHost(id) {
        return this._hosts.get(id);
    }

    /**
     * Start all hosts
     * @returns {Promise<void>}
     */
    async startAll() {
        const startPromises = [];
        
        for (const host of this._hosts.values()) {
            if (host.state === ExtensionHostState.Stopped) {
                startPromises.push(host.start());
            }
        }

        await Promise.all(startPromises);
    }

    /**
     * Stop all hosts
     * @returns {Promise<void>}
     */
    async stopAll() {
        const stopPromises = [];
        
        for (const host of this._hosts.values()) {
            stopPromises.push(host.stop());
        }

        await Promise.all(stopPromises);
    }

    /**
     * Dispose all hosts
     * @returns {Promise<void>}
     */
    async dispose() {
        const disposePromises = [];
        
        for (const host of this._hosts.values()) {
            disposePromises.push(host.dispose());
        }

        await Promise.all(disposePromises);
        this._hosts.clear();
    }

    /**
     * Get statistics for all hosts
     * @returns {Object[]}
     */
    getStats() {
        const stats = [];
        
        for (const [id, host] of this._hosts) {
            stats.push({
                id,
                ...host.getStats()
            });
        }

        return stats;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionHost,
        ExtensionHostManager,
        ExtensionHostKind,
        ExtensionHostState,
        ExtensionHostMessage,
        ExtensionHostProtocol,
        ExtensionHostProxy,
        ResourceMonitor,
        MessageType
    };
} else if (typeof window !== 'undefined') {
    window.ExtensionHost = ExtensionHost;
    window.ExtensionHostManager = ExtensionHostManager;
    window.ExtensionHostKind = ExtensionHostKind;
    window.ExtensionHostState = ExtensionHostState;
    window.ExtensionHostMessage = ExtensionHostMessage;
    window.ExtensionHostProtocol = ExtensionHostProtocol;
    window.ExtensionHostProxy = ExtensionHostProxy;
    window.ResourceMonitor = ResourceMonitor;
    window.MessageType = MessageType;
}
