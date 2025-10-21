/**
 * EventBus - Centralized event management system
 * Provides type-safe event handling, middleware support, and performance optimization
 */
class EventBus {
    constructor(options = {}) {
        this.events = new Map();
        this.wildcardListeners = new Set();
        this.middleware = [];
        this.eventHistory = [];
        
        // Configuration
        this.config = {
            maxListeners: options.maxListeners || 100,
            maxHistorySize: options.maxHistorySize || 1000,
            enableLogging: options.enableLogging !== false,
            enablePerformanceTracking: options.enablePerformanceTracking !== false,
            ...options
        };
        
        // Performance metrics
        this.metrics = {
            eventsEmitted: 0,
            listenersTriggered: 0,
            averageEmitTime: 0,
            totalEmitTime: 0,
            errorCount: 0
        };
        
        // Event type registry for validation
        this.eventTypes = new Set();
        
        // Setup core event types
        this.registerEventTypes([
            'state:changed',
            'service:registered',
            'command:executed',
            'error',
            'listener:error',
            'performance:slow',
            'batch:completed',
            'context:destroyed'
        ]);
        
        if (this.config.enableLogging) {
            console.log('🔄 [EventBus] Initialized with configuration:', this.config);
        }
    }
    
    /**
     * Register valid event types for validation
     */
    registerEventTypes(types) {
        if (Array.isArray(types)) {
            types.forEach(type => this.eventTypes.add(type));
        } else {
            this.eventTypes.add(types);
        }
        
        if (this.config.enableLogging) {
            console.log(`🔄 [EventBus] Registered event types:`, types);
        }
    }
    
    /**
     * Subscribe to events with advanced options
     */
    on(event, listener, options = {}) {
        // Validate event type if registry is not empty
        if (this.eventTypes.size > 0 && !this.eventTypes.has(event) && event !== '*') {
            console.warn(`🚨 [EventBus] Unknown event type: ${event}. Registered types:`, Array.from(this.eventTypes));
        }
        
        // Handle wildcard listeners
        if (event === '*') {
            const wrappedListener = this.wrapListener(listener, options);
            this.wildcardListeners.add(wrappedListener);
            
            return () => this.wildcardListeners.delete(wrappedListener);
        }
        
        // Handle specific event listeners
        if (!this.events.has(event)) {
            this.events.set(event, new Set());
        }
        
        const listeners = this.events.get(event);
        
        // Check listener limit
        if (listeners.size >= this.config.maxListeners) {
            console.warn(`🚨 [EventBus] Max listeners (${this.config.maxListeners}) exceeded for event: ${event}`);
        }
        
        const wrappedListener = this.wrapListener(listener, options);
        listeners.add(wrappedListener);
        
        // Return unsubscribe function
        return () => {
            listeners.delete(wrappedListener);
            if (listeners.size === 0) {
                this.events.delete(event);
            }
        };
    }
    
    /**
     * Subscribe to event only once
     */
    once(event, listener, options = {}) {
        return this.on(event, listener, { ...options, once: true });
    }
    
    /**
     * Subscribe with automatic cleanup after timeout
     */
    timeout(event, listener, timeoutMs, options = {}) {
        const unsubscribe = this.on(event, listener, options);
        
        const timeoutId = setTimeout(() => {
            unsubscribe();
            if (this.config.enableLogging) {
                console.log(`⏰ [EventBus] Listener for '${event}' timed out after ${timeoutMs}ms`);
            }
        }, timeoutMs);
        
        // Return enhanced unsubscribe that also clears timeout
        return () => {
            clearTimeout(timeoutId);
            unsubscribe();
        };
    }
    
    /**
     * Wrap listener with options and error handling
     */
    wrapListener(listener, options) {
        const wrappedListener = (eventData) => {
            try {
                // Apply filters if specified
                if (options.filter && !options.filter(eventData)) {
                    return;
                }
                
                // Apply throttling if specified
                if (options.throttle) {
                    this.throttleListener(listener, options.throttle, eventData);
                    return;
                }
                
                // Apply debouncing if specified
                if (options.debounce) {
                    this.debounceListener(listener, options.debounce, eventData);
                    return;
                }
                
                // Call listener
                if (options.async) {
                    Promise.resolve(listener(eventData))
                        .catch(error => this.handleListenerError(error, eventData));
                } else {
                    listener(eventData);
                }
                
                this.metrics.listenersTriggered++;
                
            } catch (error) {
                this.handleListenerError(error, eventData);
            }
        };
        
        // Store original listener for debugging
        wrappedListener._original = listener;
        wrappedListener._options = options;
        
        return wrappedListener;
    }
    
    /**
     * Throttle listener execution
     */
    throttleListener(listener, delay, eventData) {
        const key = `throttle_${eventData.name}_${listener.toString().slice(0, 50)}`;
        
        if (!this.throttleTimers) {
            this.throttleTimers = new Map();
        }
        
        if (!this.throttleTimers.has(key)) {
            listener(eventData);
            this.throttleTimers.set(key, true);
            
            setTimeout(() => {
                this.throttleTimers.delete(key);
            }, delay);
        }
    }
    
    /**
     * Debounce listener execution
     */
    debounceListener(listener, delay, eventData) {
        const key = `debounce_${eventData.name}_${listener.toString().slice(0, 50)}`;
        
        if (!this.debounceTimers) {
            this.debounceTimers = new Map();
        }
        
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }
        
        const timeoutId = setTimeout(() => {
            listener(eventData);
            this.debounceTimers.delete(key);
        }, delay);
        
        this.debounceTimers.set(key, timeoutId);
    }
    
    /**
     * Emit event to all listeners with middleware support
     */
    emit(event, data, metadata = {}) {
        const startTime = performance.now();
        
        try {
            // Create event data object
            const eventData = {
                name: event,
                data,
                metadata: {
                    ...metadata,
                    timestamp: Date.now(),
                    id: crypto.randomUUID(),
                    source: metadata.source || 'unknown'
                }
            };
            
            // Apply middleware
            const processedEventData = this.applyMiddleware(eventData);
            
            // Add to history
            this.addToHistory(processedEventData);
            
            // Emit to specific listeners
            const listeners = this.events.get(event);
            if (listeners) {
                for (const listener of listeners) {
                    this.safeCallListener(listener, processedEventData);
                    
                    // Remove once listeners immediately
                    if (listener._options?.once) {
                        listeners.delete(listener);
                    }
                }
                
                // Clean up empty listener sets
                if (listeners.size === 0) {
                    this.events.delete(event);
                }
            }
            
            // Emit to wildcard listeners
            for (const listener of this.wildcardListeners) {
                this.safeCallListener(listener, processedEventData);
                
                // Remove once listeners
                if (listener._options?.once) {
                    this.wildcardListeners.delete(listener);
                }
            }
            
            // Update metrics
            const duration = performance.now() - startTime;
            this.updateMetrics(duration);
            
            // Check for slow events
            if (duration > 10 && this.config.enablePerformanceTracking) {
                this.emit('performance:slow', {
                    event,
                    duration,
                    listenerCount: (listeners?.size || 0) + this.wildcardListeners.size
                });
            }
            
            return processedEventData;
            
        } catch (error) {
            console.error('🚨 [EventBus] Error emitting event:', error);
            this.handleEmitError(error, event, data);
            throw error;
        }
    }
    
    /**
     * Emit event asynchronously
     */
    async emitAsync(event, data, metadata = {}) {
        return new Promise((resolve, reject) => {
            try {
                const result = this.emit(event, data, { ...metadata, async: true });
                resolve(result);
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * Emit event with timeout
     */
    emitWithTimeout(event, data, timeoutMs = 5000, metadata = {}) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Event '${event}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);
            
            try {
                const result = this.emit(event, data, metadata);
                clearTimeout(timeoutId);
                resolve(result);
            } catch (error) {
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }
    
    /**
     * Apply middleware chain to event data
     */
    applyMiddleware(eventData) {
        let processedData = eventData;
        
        for (const middleware of this.middleware) {
            try {
                const result = middleware(processedData);
                if (result !== undefined) {
                    processedData = result;
                }
            } catch (error) {
                console.error('🚨 [EventBus] Middleware error:', error);
                this.emit('middleware:error', { error, eventData: processedData });
            }
        }
        
        return processedData;
    }
    
    /**
     * Safely call listener with error handling
     */
    safeCallListener(listener, eventData) {
        try {
            listener(eventData);
        } catch (error) {
            this.handleListenerError(error, eventData);
        }
    }
    
    /**
     * Handle listener errors
     */
    handleListenerError(error, eventData) {
        console.error('🚨 [EventBus] Listener error:', error);
        this.metrics.errorCount++;
        
        // Emit error event (but prevent infinite loops)
        if (eventData.name !== 'listener:error') {
            this.emit('listener:error', { error, eventData });
        }
    }
    
    /**
     * Handle emit errors
     */
    handleEmitError(error, event, data) {
        console.error('🚨 [EventBus] Emit error:', error);
        this.metrics.errorCount++;
        
        // Try to emit error event (but prevent infinite loops)
        if (event !== 'error') {
            try {
                this.emit('error', { error, event, data });
            } catch (emitError) {
                console.error('🚨 [EventBus] Error emitting error event:', emitError);
            }
        }
    }
    
    /**
     * Add middleware for cross-cutting concerns
     */
    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        
        this.middleware.push(middleware);
        
        if (this.config.enableLogging) {
            console.log(`🔄 [EventBus] Middleware added (${this.middleware.length} total)`);
        }
    }
    
    /**
     * Remove all listeners for an event
     */
    off(event) {
        if (event === '*') {
            this.wildcardListeners.clear();
        } else {
            this.events.delete(event);
        }
        
        if (this.config.enableLogging) {
            console.log(`🔄 [EventBus] All listeners removed for event: ${event}`);
        }
    }
    
    /**
     * Remove all listeners
     */
    removeAllListeners() {
        this.events.clear();
        this.wildcardListeners.clear();
        
        if (this.config.enableLogging) {
            console.log('🔄 [EventBus] All listeners removed');
        }
    }
    
    /**
     * Get listener count for event
     */
    listenerCount(event) {
        if (event === '*') {
            return this.wildcardListeners.size;
        }
        
        return this.events.get(event)?.size || 0;
    }
    
    /**
     * Get all registered events
     */
    getEvents() {
        return Array.from(this.events.keys());
    }
    
    /**
     * Add event to history
     */
    addToHistory(eventData) {
        this.eventHistory.push(eventData);
        
        // Limit history size
        if (this.eventHistory.length > this.config.maxHistorySize) {
            this.eventHistory.shift();
        }
    }
    
    /**
     * Get event history
     */
    getHistory(eventName = null, limit = 100) {
        let history = this.eventHistory;
        
        if (eventName) {
            history = history.filter(event => event.name === eventName);
        }
        
        return history.slice(-limit);
    }
    
    /**
     * Clear event history
     */
    clearHistory() {
        this.eventHistory = [];
        
        if (this.config.enableLogging) {
            console.log('🔄 [EventBus] Event history cleared');
        }
    }
    
    /**
     * Update performance metrics
     */
    updateMetrics(duration) {
        this.metrics.eventsEmitted++;
        this.metrics.totalEmitTime += duration;
        this.metrics.averageEmitTime = this.metrics.totalEmitTime / this.metrics.eventsEmitted;
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalListeners: Array.from(this.events.values())
                .reduce((total, set) => total + set.size, 0) + this.wildcardListeners.size,
            eventTypes: this.events.size,
            wildcardListeners: this.wildcardListeners.size,
            middlewareCount: this.middleware.length,
            historySize: this.eventHistory.length
        };
    }
    
    /**
     * Debug information
     */
    debug() {
        const debug = {
            events: Object.fromEntries(
                Array.from(this.events.entries()).map(([event, listeners]) => [
                    event,
                    {
                        listenerCount: listeners.size,
                        listeners: Array.from(listeners).map(l => ({
                            options: l._options,
                            original: l._original?.name || 'anonymous'
                        }))
                    }
                ])
            ),
            wildcardListeners: this.wildcardListeners.size,
            metrics: this.getMetrics(),
            recentEvents: this.getHistory(null, 10)
        };
        
        console.table(debug.metrics);
        return debug;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear all listeners
        this.removeAllListeners();
        
        // Clear timers
        if (this.throttleTimers) {
            this.throttleTimers.clear();
        }
        
        if (this.debounceTimers) {
            for (const timeoutId of this.debounceTimers.values()) {
                clearTimeout(timeoutId);
            }
            this.debounceTimers.clear();
        }
        
        // Clear history
        this.clearHistory();
        
        // Clear middleware
        this.middleware = [];
        
        if (this.config.enableLogging) {
            console.log('🔄 [EventBus] Destroyed and resources cleaned up');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
} else if (typeof window !== 'undefined') {
    window.EventBus = EventBus;
}