/**
 * GenomeContext - Centralized context management system
 * Provides reactive state management, dependency injection, and cross-cutting concerns
 */
class GenomeContext {
    constructor(options = {}) {
        this.state = new Map();
        this.subscribers = new Map();
        this.middleware = [];
        this.services = new Map();
        this.eventBus = null;
        this.cacheManager = null;
        this.taskQueue = null;
        
        // Configuration
        this.config = {
            enableLogging: options.enableLogging !== false,
            enablePerformanceTracking: options.enablePerformanceTracking !== false,
            maxSubscribers: options.maxSubscribers || 1000,
            stateHistorySize: options.stateHistorySize || 100,
            ...options
        };
        
        // State history for debugging and undo functionality
        this.stateHistory = [];
        this.currentHistoryIndex = -1;
        
        // Performance tracking
        this.performanceMetrics = {
            stateUpdates: 0,
            subscriptionCalls: 0,
            averageUpdateTime: 0,
            totalUpdateTime: 0
        };
        
        this.initializeCore();
    }
    
    /**
     * Initialize core systems
     */
    initializeCore() {
        // Initialize event bus
        this.eventBus = new EventBus();
        
        // Initialize cache manager
        this.cacheManager = new CacheManager({
            defaultTTL: 300000, // 5 minutes
            maxSize: 1000
        });
        
        // Initialize task queue
        this.taskQueue = new TaskQueue({
            maxConcurrency: 4
        });
        
        // Register core services
        this.registerService('eventBus', this.eventBus);
        this.registerService('cacheManager', this.cacheManager);
        this.registerService('taskQueue', this.taskQueue);
        
        // Set up core middleware
        this.setupCoreMiddleware();
        
        if (this.config.enableLogging) {
            console.log('🧬 [GenomeContext] Core systems initialized');
        }
    }
    
    /**
     * Set up core middleware for logging, validation, and performance tracking
     */
    setupCoreMiddleware() {
        // Logging middleware
        if (this.config.enableLogging) {
            this.use((action, next) => {
                const startTime = performance.now();
                console.log(`🔧 [GenomeContext] ${action.type}:`, action.payload);
                
                const result = next();
                
                const endTime = performance.now();
                console.log(`✅ [GenomeContext] ${action.type} completed in ${(endTime - startTime).toFixed(2)}ms`);
                
                return result;
            });
        }
        
        // Performance tracking middleware
        if (this.config.enablePerformanceTracking) {
            this.use((action, next) => {
                const startTime = performance.now();
                const result = next();
                const duration = performance.now() - startTime;
                
                this.updatePerformanceMetrics(action.type, duration);
                
                return result;
            });
        }
        
        // Validation middleware
        this.use((action, next) => {
            if (!action.type) {
                throw new Error('Action type is required');
            }
            
            if (action.type.includes('state:set') && !action.payload?.key) {
                throw new Error('State key is required for state updates');
            }
            
            return next();
        });
    }
    
    /**
     * Reactive state management with history tracking
     */
    setState(key, value, metadata = {}) {
        const startTime = performance.now();
        
        try {
            const oldValue = this.state.get(key);
            
            // Create state change record
            const stateChange = {
                key,
                oldValue,
                newValue: value,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    id: crypto.randomUUID()
                }
            };
            
            // Apply middleware
            const action = { type: 'state:set', payload: { key, value, metadata } };
            this.applyMiddleware(action, () => {
                // Update state
                this.state.set(key, value);
                
                // Add to history
                this.addToHistory(stateChange);
                
                // Notify subscribers
                this.notifySubscribers(key, value, oldValue, metadata);
                
                // Emit event
                this.eventBus?.emit('state:changed', stateChange);
                
                return { success: true, data: value };
            });
            
            this.performanceMetrics.stateUpdates++;
            
        } catch (error) {
            console.error('🚨 [GenomeContext] Error setting state:', error);
            this.eventBus?.emit('error', { error, context: 'setState', key, value });
            throw error;
        }
    }
    
    /**
     * Get state value with optional default
     */
    getState(key, defaultValue = undefined) {
        return this.state.has(key) ? this.state.get(key) : defaultValue;
    }
    
    /**
     * Get all state as object
     */
    getAllState() {
        return Object.fromEntries(this.state);
    }
    
    /**
     * Subscribe to state changes with automatic cleanup
     */
    subscribe(key, callback, options = {}) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, new Set());
        }
        
        const subscribers = this.subscribers.get(key);
        
        if (subscribers.size >= this.config.maxSubscribers) {
            console.warn(`🚨 [GenomeContext] Max subscribers (${this.config.maxSubscribers}) reached for key: ${key}`);
        }
        
        // Wrap callback with error handling and options
        const wrappedCallback = this.wrapSubscriberCallback(callback, options);
        subscribers.add(wrappedCallback);
        
        // Emit current value if immediate is true
        if (options.immediate && this.state.has(key)) {
            this.safeCallSubscriber(wrappedCallback, {
                key,
                newValue: this.state.get(key),
                oldValue: undefined,
                metadata: { immediate: true }
            });
        }
        
        this.performanceMetrics.subscriptionCalls++;
        
        // Return unsubscribe function
        return () => {
            subscribers.delete(wrappedCallback);
            if (subscribers.size === 0) {
                this.subscribers.delete(key);
            }
        };
    }
    
    /**
     * Wrap subscriber callback with error handling and options
     */
    wrapSubscriberCallback(callback, options) {
        return (changeData) => {
            try {
                // Apply filters if specified
                if (options.filter && !options.filter(changeData)) {
                    return;
                }
                
                // Apply debouncing if specified
                if (options.debounce) {
                    this.debounceCallback(callback, options.debounce, changeData);
                } else {
                    callback(changeData);
                }
                
                // Remove subscription if once is true
                if (options.once) {
                    const subscribers = this.subscribers.get(changeData.key);
                    subscribers?.delete(callback);
                }
                
            } catch (error) {
                console.error('🚨 [GenomeContext] Subscriber error:', error);
                this.eventBus?.emit('subscriber:error', { error, changeData });
            }
        };
    }
    
    /**
     * Debounce callback execution
     */
    debounceCallback(callback, delay, data) {
        const key = `debounce_${data.key}`;
        
        if (this.debounceTimers?.[key]) {
            clearTimeout(this.debounceTimers[key]);
        }
        
        if (!this.debounceTimers) {
            this.debounceTimers = {};
        }
        
        this.debounceTimers[key] = setTimeout(() => {
            callback(data);
            delete this.debounceTimers[key];
        }, delay);
    }
    
    /**
     * Notify all subscribers of state change
     */
    notifySubscribers(key, newValue, oldValue, metadata) {
        const subscribers = this.subscribers.get(key);
        if (!subscribers) return;
        
        const changeData = { key, newValue, oldValue, metadata };
        
        for (const subscriber of subscribers) {
            this.safeCallSubscriber(subscriber, changeData);
        }
        
        // Also notify wildcard subscribers
        const wildcardSubscribers = this.subscribers.get('*');
        if (wildcardSubscribers) {
            for (const subscriber of wildcardSubscribers) {
                this.safeCallSubscriber(subscriber, changeData);
            }
        }
    }
    
    /**
     * Safely call subscriber with error handling
     */
    safeCallSubscriber(subscriber, changeData) {
        try {
            subscriber(changeData);
        } catch (error) {
            console.error('🚨 [GenomeContext] Subscriber callback error:', error);
            this.eventBus?.emit('subscriber:error', { error, changeData });
        }
    }
    
    /**
     * Service registration and dependency injection
     */
    registerService(name, service, options = {}) {
        if (this.services.has(name)) {
            console.warn(`🚨 [GenomeContext] Service '${name}' already registered, overwriting`);
        }
        
        this.services.set(name, {
            service,
            options: {
                singleton: true,
                lazy: false,
                ...options
            },
            createdAt: Date.now()
        });
        
        this.eventBus?.emit('service:registered', { name, options });
        
        if (this.config.enableLogging) {
            console.log(`🔧 [GenomeContext] Service '${name}' registered`);
        }
    }
    
    /**
     * Get service from container
     */
    getService(name) {
        const serviceRecord = this.services.get(name);
        
        if (!serviceRecord) {
            throw new Error(`Service '${name}' not found. Available services: ${Array.from(this.services.keys()).join(', ')}`);
        }
        
        return serviceRecord.service;
    }
    
    /**
     * Check if service exists
     */
    hasService(name) {
        return this.services.has(name);
    }
    
    /**
     * Get all registered services
     */
    getServiceNames() {
        return Array.from(this.services.keys());
    }
    
    /**
     * Add middleware function
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.middleware.push(middleware);
        
        if (this.config.enableLogging) {
            console.log(`🔧 [GenomeContext] Middleware added (${this.middleware.length} total)`);
        }
    }
    
    /**
     * Apply middleware chain
     */
    applyMiddleware(action, finalHandler) {
        let index = 0;
        
        const next = () => {
            if (index < this.middleware.length) {
                const middleware = this.middleware[index++];
                return middleware(action, next);
            } else {
                return finalHandler();
            }
        };
        
        return next();
    }
    
    /**
     * Execute command with full context
     */
    async execute(commandName, params = {}, options = {}) {
        const command = this.getService('commandRegistry')?.getCommand(commandName);
        
        if (!command) {
            throw new Error(`Command '${commandName}' not found`);
        }
        
        return await command.execute(this, params, options);
    }
    
    /**
     * Batch state updates for performance
     */
    batch(updates) {
        const startTime = performance.now();
        const results = [];
        
        // Disable notifications during batch
        const originalNotify = this.notifySubscribers;
        const batchedNotifications = [];
        
        this.notifySubscribers = (key, newValue, oldValue, metadata) => {
            batchedNotifications.push({ key, newValue, oldValue, metadata });
        };
        
        try {
            // Execute all updates
            for (const update of updates) {
                if (typeof update === 'function') {
                    results.push(update(this));
                } else if (update.type === 'setState') {
                    this.setState(update.key, update.value, update.metadata);
                    results.push({ success: true });
                }
            }
            
            // Restore notification and send batched notifications
            this.notifySubscribers = originalNotify;
            
            // Send all notifications at once
            for (const notification of batchedNotifications) {
                this.notifySubscribers(
                    notification.key,
                    notification.newValue,
                    notification.oldValue,
                    { ...notification.metadata, batched: true }
                );
            }
            
            const duration = performance.now() - startTime;
            
            this.eventBus?.emit('batch:completed', {
                updateCount: updates.length,
                duration,
                results
            });
            
            return results;
            
        } catch (error) {
            // Restore notification function on error
            this.notifySubscribers = originalNotify;
            throw error;
        }
    }
    
    /**
     * State history management
     */
    addToHistory(stateChange) {
        // Remove any history after current index (for undo/redo)
        if (this.currentHistoryIndex < this.stateHistory.length - 1) {
            this.stateHistory = this.stateHistory.slice(0, this.currentHistoryIndex + 1);
        }
        
        this.stateHistory.push(stateChange);
        this.currentHistoryIndex = this.stateHistory.length - 1;
        
        // Limit history size
        if (this.stateHistory.length > this.config.stateHistorySize) {
            this.stateHistory.shift();
            this.currentHistoryIndex--;
        }
    }
    
    /**
     * Undo last state change
     */
    undo() {
        if (this.currentHistoryIndex < 0) {
            return false;
        }
        
        const change = this.stateHistory[this.currentHistoryIndex];
        this.setState(change.key, change.oldValue, { 
            ...change.metadata, 
            undo: true 
        });
        
        this.currentHistoryIndex--;
        return true;
    }
    
    /**
     * Redo next state change
     */
    redo() {
        if (this.currentHistoryIndex >= this.stateHistory.length - 1) {
            return false;
        }
        
        this.currentHistoryIndex++;
        const change = this.stateHistory[this.currentHistoryIndex];
        
        this.setState(change.key, change.newValue, { 
            ...change.metadata, 
            redo: true 
        });
        
        return true;
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(actionType, duration) {
        this.performanceMetrics.totalUpdateTime += duration;
        this.performanceMetrics.averageUpdateTime = 
            this.performanceMetrics.totalUpdateTime / this.performanceMetrics.stateUpdates;
    }
    
    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            stateSize: this.state.size,
            subscriberCount: Array.from(this.subscribers.values())
                .reduce((total, set) => total + set.size, 0),
            serviceCount: this.services.size,
            middlewareCount: this.middleware.length,
            historySize: this.stateHistory.length
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear all state
        this.state.clear();
        
        // Clear all subscribers
        this.subscribers.clear();
        
        // Clear history
        this.stateHistory = [];
        this.currentHistoryIndex = -1;
        
        // Clear debounce timers
        if (this.debounceTimers) {
            Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
            this.debounceTimers = {};
        }
        
        // Destroy services
        for (const [name, { service }] of this.services) {
            if (service && typeof service.destroy === 'function') {
                try {
                    service.destroy();
                } catch (error) {
                    console.error(`Error destroying service '${name}':`, error);
                }
            }
        }
        
        this.services.clear();
        this.middleware = [];
        
        this.eventBus?.emit('context:destroyed');
        
        if (this.config.enableLogging) {
            console.log('🧬 [GenomeContext] Context destroyed and resources cleaned up');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GenomeContext;
} else if (typeof window !== 'undefined') {
    window.GenomeContext = GenomeContext;
}