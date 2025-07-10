/**
 * LegacyCompatibilityAdapter - Provides backward compatibility during migration
 * Wraps new improved patterns with legacy API interfaces
 */
class LegacyCompatibilityAdapter {
    constructor(modernContext, legacyGenomeBrowser) {
        this.context = modernContext;
        this.legacy = legacyGenomeBrowser;
        this.migrationMode = 'gradual'; // 'gradual', 'full', 'legacy-only'
        
        // Track which modules have been migrated
        this.migratedModules = new Set();
        
        // Store original methods for fallback
        this.originalMethods = new Map();
        
        // Performance comparison metrics
        this.performanceComparison = {
            legacy: { calls: 0, totalTime: 0 },
            modern: { calls: 0, totalTime: 0 }
        };
        
        this.setupCompatibilityLayer();
        this.setupPerformanceMonitoring();
        
        console.log('🔄 [LegacyCompatibilityAdapter] Initialized compatibility layer');
    }
    
    /**
     * Setup the main compatibility layer
     */
    setupCompatibilityLayer() {
        this.setupActionManagerCompatibility();
        this.setupSequenceUtilsCompatibility();
        this.setupEventSystemCompatibility();
        this.setupStateManagementCompatibility();
        this.setupErrorHandlingCompatibility();
    }
    
    /**
     * ActionManager compatibility layer
     */
    setupActionManagerCompatibility() {
        if (this.legacy.actionManager) {
            // Store original methods
            this.originalMethods.set('actionManager.setCursorPosition', 
                this.legacy.actionManager.setCursorPosition?.bind(this.legacy.actionManager)
            );
            this.originalMethods.set('actionManager.handlePasteSequence', 
                this.legacy.actionManager.handlePasteSequence?.bind(this.legacy.actionManager)
            );
            this.originalMethods.set('actionManager.handleDeleteSequence', 
                this.legacy.actionManager.handleDeleteSequence?.bind(this.legacy.actionManager)
            );
            
            // Wrap setCursorPosition
            this.legacy.actionManager.setCursorPosition = this.createCompatibilityWrapper(
                'actionManager.setCursorPosition',
                async (position) => {
                    if (this.shouldUseMoern('actionManager')) {
                        const result = await this.context.execute('action:setCursorPosition', { position });
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('actionManager.setCursorPosition')(position);
                    }
                }
            );
            
            // Wrap handlePasteSequence
            this.legacy.actionManager.handlePasteSequence = this.createCompatibilityWrapper(
                'actionManager.handlePasteSequence',
                async (options = {}) => {
                    if (this.shouldUseMoern('actionManager')) {
                        const result = await this.context.execute('action:paste', options);
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('actionManager.handlePasteSequence')(options);
                    }
                }
            );
            
            // Wrap handleDeleteSequence
            this.legacy.actionManager.handleDeleteSequence = this.createCompatibilityWrapper(
                'actionManager.handleDeleteSequence',
                async (options = {}) => {
                    if (this.shouldUseMoern('actionManager')) {
                        const result = await this.context.execute('action:delete', options);
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('actionManager.handleDeleteSequence')(options);
                    }
                }
            );
            
            console.log('🔄 [LegacyCompatibilityAdapter] ActionManager compatibility layer setup');
        }
    }
    
    /**
     * SequenceUtils compatibility layer
     */
    setupSequenceUtilsCompatibility() {
        if (this.legacy.sequenceUtils) {
            // Store original methods
            this.originalMethods.set('sequenceUtils.setCursorPosition', 
                this.legacy.sequenceUtils.setCursorPosition?.bind(this.legacy.sequenceUtils)
            );
            this.originalMethods.set('sequenceUtils.setCursorColor', 
                this.legacy.sequenceUtils.setCursorColor?.bind(this.legacy.sequenceUtils)
            );
            this.originalMethods.set('sequenceUtils.handleSequenceClick', 
                this.legacy.sequenceUtils.handleSequenceClick?.bind(this.legacy.sequenceUtils)
            );
            
            // Wrap setCursorPosition
            this.legacy.sequenceUtils.setCursorPosition = this.createCompatibilityWrapper(
                'sequenceUtils.setCursorPosition',
                async (position, options = {}) => {
                    if (this.shouldUseMoern('sequenceUtils')) {
                        const result = await this.context.execute('sequence:setCursor', { 
                            position, 
                            ...options 
                        });
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('sequenceUtils.setCursorPosition')(position, options);
                    }
                }
            );
            
            // Wrap setCursorColor
            this.legacy.sequenceUtils.setCursorColor = this.createCompatibilityWrapper(
                'sequenceUtils.setCursorColor',
                async (color) => {
                    if (this.shouldUseMoern('sequenceUtils')) {
                        const result = await this.context.execute('sequence:setCursorColor', { color });
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('sequenceUtils.setCursorColor')(color);
                    }
                }
            );
            
            // Wrap handleSequenceClick
            this.legacy.sequenceUtils.handleSequenceClick = this.createCompatibilityWrapper(
                'sequenceUtils.handleSequenceClick',
                async (event, position) => {
                    if (this.shouldUseMoern('sequenceUtils')) {
                        const result = await this.context.execute('sequence:click', { 
                            event: this.serializeEvent(event), 
                            position 
                        });
                        if (!result.success) {
                            throw new Error(result.error.message);
                        }
                        return result.data;
                    } else {
                        return this.originalMethods.get('sequenceUtils.handleSequenceClick')(event, position);
                    }
                }
            );
            
            console.log('🔄 [LegacyCompatibilityAdapter] SequenceUtils compatibility layer setup');
        }
    }
    
    /**
     * Event system compatibility
     */
    setupEventSystemCompatibility() {
        // Legacy event system compatibility
        if (!this.legacy.on) {
            this.legacy.on = (event, callback) => {
                return this.context.getService('eventBus').on(event, (eventData) => {
                    // Transform modern event data to legacy format
                    callback(eventData.data, eventData.metadata);
                });
            };
        }
        
        if (!this.legacy.emit) {
            this.legacy.emit = (event, data, metadata = {}) => {
                return this.context.getService('eventBus').emit(event, data, metadata);
            };
        }
        
        if (!this.legacy.off) {
            this.legacy.off = (event) => {
                return this.context.getService('eventBus').off(event);
            };
        }
        
        // Bridge legacy events to modern event bus
        this.bridgeLegacyEvents();
        
        console.log('🔄 [LegacyCompatibilityAdapter] Event system compatibility setup');
    }
    
    /**
     * State management compatibility
     */
    setupStateManagementCompatibility() {
        // Provide legacy state access patterns
        if (!this.legacy.getState) {
            this.legacy.getState = (key, defaultValue) => {
                return this.context.getState(key, defaultValue);
            };
        }
        
        if (!this.legacy.setState) {
            this.legacy.setState = (key, value, metadata = {}) => {
                return this.context.setState(key, value, metadata);
            };
        }
        
        // Bridge existing properties to context state
        this.bridgeExistingState();
        
        console.log('🔄 [LegacyCompatibilityAdapter] State management compatibility setup');
    }
    
    /**
     * Error handling compatibility
     */
    setupErrorHandlingCompatibility() {
        // Wrap legacy methods that might throw to use Result pattern
        if (!this.legacy.safeExecute) {
            this.legacy.safeExecute = async (fn, ...args) => {
                try {
                    const result = await fn(...args);
                    return Result.success(result);
                } catch (error) {
                    return Result.error(error);
                }
            };
        }
        
        // Global error handler that bridges to modern error system
        const originalErrorHandler = window.onerror;
        window.onerror = (message, source, lineno, colno, error) => {
            // Emit to modern error system
            this.context.getService('eventBus').emit('error:unhandled', {
                message,
                source,
                lineno,
                colno,
                error
            });
            
            // Call original handler if it exists
            if (originalErrorHandler) {
                return originalErrorHandler(message, source, lineno, colno, error);
            }
        };
        
        console.log('🔄 [LegacyCompatibilityAdapter] Error handling compatibility setup');
    }
    
    /**
     * Create a compatibility wrapper that can switch between legacy and modern implementations
     */
    createCompatibilityWrapper(methodName, modernImplementation) {
        return async (...args) => {
            const startTime = performance.now();
            let useModern = false;
            let result;
            
            try {
                if (this.shouldUseMoern(methodName)) {
                    useModern = true;
                    result = await modernImplementation(...args);
                    
                    // Track modern performance
                    const duration = performance.now() - startTime;
                    this.performanceComparison.modern.calls++;
                    this.performanceComparison.modern.totalTime += duration;
                } else {
                    // Use legacy implementation
                    const legacyMethod = this.originalMethods.get(methodName);
                    if (legacyMethod) {
                        result = await legacyMethod(...args);
                        
                        // Track legacy performance
                        const duration = performance.now() - startTime;
                        this.performanceComparison.legacy.calls++;
                        this.performanceComparison.legacy.totalTime += duration;
                    } else {
                        throw new Error(`Legacy method ${methodName} not found`);
                    }
                }
                
                return result;
                
            } catch (error) {
                console.error(`🚨 [LegacyCompatibilityAdapter] Error in ${methodName} (${useModern ? 'modern' : 'legacy'}):`, error);
                
                // If modern implementation fails, try legacy fallback
                if (useModern && this.originalMethods.has(methodName)) {
                    console.warn(`🔄 [LegacyCompatibilityAdapter] Falling back to legacy implementation for ${methodName}`);
                    try {
                        return await this.originalMethods.get(methodName)(...args);
                    } catch (fallbackError) {
                        console.error(`🚨 [LegacyCompatibilityAdapter] Fallback also failed for ${methodName}:`, fallbackError);
                        throw fallbackError;
                    }
                }
                
                throw error;
            }
        };
    }
    
    /**
     * Determine if modern implementation should be used
     */
    shouldUseMoern(moduleOrMethod) {
        // Extract module name from method name if needed
        const moduleName = moduleOrMethod.includes('.') 
            ? moduleOrMethod.split('.')[0] 
            : moduleOrMethod;
        
        switch (this.migrationMode) {
            case 'full':
                return true;
            case 'legacy-only':
                return false;
            case 'gradual':
            default:
                return this.migratedModules.has(moduleName);
        }
    }
    
    /**
     * Mark a module as migrated
     */
    markModuleAsMigrated(moduleName) {
        this.migratedModules.add(moduleName);
        console.log(`✅ [LegacyCompatibilityAdapter] Module '${moduleName}' marked as migrated`);
        
        // Emit migration event
        this.context.getService('eventBus').emit('migration:module-completed', {
            moduleName,
            migratedModules: Array.from(this.migratedModules)
        });
    }
    
    /**
     * Bridge legacy events to modern event bus
     */
    bridgeLegacyEvents() {
        // Common legacy events that should be bridged
        const legacyEvents = [
            'sequenceLoaded',
            'cursorPositioned',
            'sequenceChanged',
            'actionQueued',
            'actionExecuted'
        ];
        
        legacyEvents.forEach(eventName => {
            // Listen for legacy-style events and re-emit as modern events
            if (this.legacy.addEventListener) {
                this.legacy.addEventListener(eventName, (data) => {
                    this.context.getService('eventBus').emit(`legacy:${eventName}`, data);
                });
            }
        });
    }
    
    /**
     * Bridge existing state properties to context state
     */
    bridgeExistingState() {
        // Bridge common properties
        const stateProperties = [
            { legacy: 'currentSequence', modern: 'sequence:current' },
            { legacy: 'currentChromosome', modern: 'chromosome:current' },
            { legacy: 'currentPosition', modern: 'position:current' },
            { legacy: 'cursorPosition', modern: 'cursor:position' }
        ];
        
        stateProperties.forEach(({ legacy, modern }) => {
            if (this.legacy[legacy] !== undefined) {
                // Initialize modern state with legacy value
                this.context.setState(modern, this.legacy[legacy], {
                    source: 'legacy-bridge',
                    timestamp: Date.now()
                });
                
                // Set up bidirectional sync
                this.context.subscribe(modern, (change) => {
                    this.legacy[legacy] = change.newValue;
                });
            }
        });
    }
    
    /**
     * Serialize event object for modern system
     */
    serializeEvent(event) {
        if (!event) return null;
        
        return {
            type: event.type,
            target: {
                tagName: event.target?.tagName,
                className: event.target?.className,
                id: event.target?.id
            },
            clientX: event.clientX,
            clientY: event.clientY,
            button: event.button,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            timestamp: event.timeStamp || Date.now()
        };
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Periodically log performance comparison
        setInterval(() => {
            const legacy = this.performanceComparison.legacy;
            const modern = this.performanceComparison.modern;
            
            if (legacy.calls > 0 || modern.calls > 0) {
                console.log('📊 [LegacyCompatibilityAdapter] Performance Comparison:', {
                    legacy: {
                        calls: legacy.calls,
                        avgTime: legacy.calls > 0 ? (legacy.totalTime / legacy.calls).toFixed(2) + 'ms' : 'N/A'
                    },
                    modern: {
                        calls: modern.calls,
                        avgTime: modern.calls > 0 ? (modern.totalTime / modern.calls).toFixed(2) + 'ms' : 'N/A'
                    }
                });
                
                // Emit performance metrics
                this.context.getService('eventBus').emit('performance:comparison', {
                    legacy: { ...legacy },
                    modern: { ...modern }
                });
            }
        }, 30000); // Every 30 seconds
    }
    
    /**
     * Switch migration mode
     */
    setMigrationMode(mode) {
        const validModes = ['gradual', 'full', 'legacy-only'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid migration mode: ${mode}. Valid modes: ${validModes.join(', ')}`);
        }
        
        this.migrationMode = mode;
        console.log(`🔄 [LegacyCompatibilityAdapter] Migration mode set to: ${mode}`);
        
        this.context.getService('eventBus').emit('migration:mode-changed', { mode });
    }
    
    /**
     * Get migration status
     */
    getMigrationStatus() {
        return {
            mode: this.migrationMode,
            migratedModules: Array.from(this.migratedModules),
            performanceComparison: this.performanceComparison,
            totalMethods: this.originalMethods.size
        };
    }
    
    /**
     * Force fallback to legacy for specific method
     */
    forceLegacyFallback(methodName, reason = 'Manual fallback') {
        console.warn(`🔄 [LegacyCompatibilityAdapter] Forcing legacy fallback for ${methodName}: ${reason}`);
        
        // Remove from migrated modules temporarily
        const moduleName = methodName.split('.')[0];
        this.migratedModules.delete(moduleName);
        
        this.context.getService('eventBus').emit('migration:forced-fallback', {
            methodName,
            reason,
            moduleName
        });
    }
    
    /**
     * Clean up compatibility layer
     */
    destroy() {
        // Restore original methods
        for (const [methodPath, originalMethod] of this.originalMethods.entries()) {
            const [moduleName, methodName] = methodPath.split('.');
            if (this.legacy[moduleName] && originalMethod) {
                this.legacy[moduleName][methodName] = originalMethod;
            }
        }
        
        // Clear collections
        this.migratedModules.clear();
        this.originalMethods.clear();
        
        console.log('🔄 [LegacyCompatibilityAdapter] Compatibility layer destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LegacyCompatibilityAdapter;
} else if (typeof window !== 'undefined') {
    window.LegacyCompatibilityAdapter = LegacyCompatibilityAdapter;
}