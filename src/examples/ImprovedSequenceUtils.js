/**
 * ImprovedSequenceUtils - Demonstration of improved function calling patterns
 * Shows how to refactor existing SequenceUtils using the new architecture
 */
class ImprovedSequenceUtils {
    constructor(context) {
        this.context = context;
        this.eventBus = context.getService('eventBus');
        this.cacheManager = context.getService('cacheManager');
        this.taskQueue = context.getService('taskQueue');
        
        // Create specialized caches
        this.renderCache = this.cacheManager.createCache('sequence-render', {
            ttl: 300000, // 5 minutes
            maxSize: 500,
            tags: ['sequence', 'render']
        });
        
        this.featureCache = this.cacheManager.createCache('sequence-features', {
            ttl: 600000, // 10 minutes
            maxSize: 1000,
            tags: ['sequence', 'features']
        });
        
        // Register commands
        this.registerCommands();
        
        // Subscribe to relevant events
        this.setupEventHandlers();
        
        console.log('🧬 [ImprovedSequenceUtils] Initialized with improved patterns');
    }
    
    /**
     * Register commands for sequence operations
     */
    registerCommands() {
        const commandRegistry = this.context.getService('commandRegistry');
        
        // Cursor positioning command
        const setCursorCommand = new Command(
            'sequence:setCursor',
            this.setCursorPositionHandler.bind(this),
            {
                description: 'Set cursor position in sequence view',
                category: 'sequence',
                timeout: 5000,
                logExecution: true,
                inputSchema: {
                    position: { type: 'number', required: true, validate: pos => pos >= 0 },
                    chromosome: { type: 'string', required: false },
                    source: { type: 'string', required: false }
                },
                hooks: {
                    before: [this.validateCursorPosition.bind(this)],
                    after: [this.notifyCursorChange.bind(this)]
                }
            }
        );
        
        commandRegistry.register(setCursorCommand);
        
        // Sequence rendering command
        const renderCommand = new Command(
            'sequence:render',
            this.renderSequenceHandler.bind(this),
            {
                description: 'Render sequence with optimized caching',
                category: 'sequence',
                timeout: 10000,
                retries: 2,
                logExecution: true,
                inputSchema: {
                    chromosome: { type: 'string', required: true },
                    sequence: { type: 'string', required: true },
                    viewStart: { type: 'number', required: true },
                    viewEnd: { type: 'number', required: true }
                }
            }
        );
        
        commandRegistry.register(renderCommand);
        
        // Color change command
        const colorCommand = new Command(
            'sequence:setCursorColor',
            this.setCursorColorHandler.bind(this),
            {
                description: 'Update cursor color with validation',
                category: 'sequence',
                timeout: 2000,
                inputSchema: {
                    color: { 
                        type: 'string', 
                        required: true,
                        validate: color => /^#[0-9A-Fa-f]{6}$/.test(color)
                    }
                }
            }
        );
        
        commandRegistry.register(colorCommand);
    }
    
    /**
     * Setup event handlers for reactive updates
     */
    setupEventHandlers() {
        // Listen for state changes
        this.context.subscribe('sequence:current', (change) => {
            this.handleSequenceChange(change.newValue, change.oldValue);
        }, { immediate: true });
        
        this.context.subscribe('cursor:position', (change) => {
            this.handleCursorPositionChange(change.newValue);
        });
        
        // Listen for window resize events
        this.eventBus.on('window:resize', (eventData) => {
            this.handleWindowResize(eventData.data);
        }, { debounce: 150 });
        
        // Listen for cache invalidation events
        this.eventBus.on('sequence:invalidate', (eventData) => {
            this.invalidateCache(eventData.data.tags);
        });
    }
    
    /**
     * Improved cursor position setting with Result pattern
     */
    async setCursorPosition(position, options = {}) {
        try {
            const result = await this.context.execute('sequence:setCursor', {
                position,
                chromosome: options.chromosome || this.getCurrentChromosome(),
                source: options.source || 'user'
            });
            
            return Result.success(result.data, {
                position,
                timestamp: Date.now()
            });
            
        } catch (error) {
            return Result.error(error, {
                position,
                operation: 'setCursorPosition'
            });
        }
    }
    
    /**
     * Command handler for cursor positioning
     */
    async setCursorPositionHandler(context, params) {
        const { position, chromosome, source } = params;
        
        // Update context state
        context.setState('cursor:position', position, {
            chromosome,
            source,
            timestamp: Date.now()
        });
        
        // Position cursor element
        await this.positionCursorElement(position);
        
        // Update ActionManager if available
        const actionManager = context.getService('actionManager');
        if (actionManager) {
            actionManager.setCursorPosition(position);
        }
        
        return {
            position,
            chromosome,
            success: true
        };
    }
    
    /**
     * Validation hook for cursor position
     */
    async validateCursorPosition(context, params) {
        const { position, chromosome } = params;
        const currentSequence = context.getState('sequence:current');
        
        if (currentSequence && position >= currentSequence.length) {
            throw new Error(`Cursor position ${position} exceeds sequence length ${currentSequence.length}`);
        }
        
        if (chromosome) {
            const availableChromosomes = context.getState('chromosomes:available') || [];
            if (!availableChromosomes.includes(chromosome)) {
                throw new Error(`Chromosome ${chromosome} not available`);
            }
        }
    }
    
    /**
     * Notification hook for cursor changes
     */
    async notifyCursorChange(context, params, result) {
        this.eventBus.emit('cursor:positioned', {
            position: result.position,
            chromosome: result.chromosome,
            timestamp: Date.now()
        });
        
        // Update status bar
        this.updateCursorStatus(result.position);
    }
    
    /**
     * Improved sequence rendering with caching and performance tracking
     */
    async renderSequence(chromosome, sequence, viewStart, viewEnd, options = {}) {
        const renderKey = `${chromosome}:${viewStart}:${viewEnd}:${sequence.length}`;
        
        // Check cache first
        const cached = this.renderCache.get(renderKey);
        if (cached && !options.force) {
            this.eventBus.emit('render:cache-hit', { renderKey, cached: true });
            return Result.success(cached, { cached: true });
        }
        
        try {
            // Execute render command
            const result = await this.context.execute('sequence:render', {
                chromosome,
                sequence,
                viewStart,
                viewEnd,
                ...options
            });
            
            // Cache the result
            this.renderCache.set(renderKey, result.data);
            
            return Result.success(result.data, {
                renderKey,
                cached: false,
                executionTime: result.metadata.executionTime
            });
            
        } catch (error) {
            return Result.error(error, {
                renderKey,
                operation: 'renderSequence'
            });
        }
    }
    
    /**
     * Command handler for sequence rendering
     */
    async renderSequenceHandler(context, params) {
        const { chromosome, sequence, viewStart, viewEnd } = params;
        const startTime = performance.now();
        
        // Get rendering settings
        const settings = context.getState('sequence:settings') || this.getDefaultSettings();
        
        // Perform rendering with optimized batching
        const renderResult = await this.performOptimizedRender({
            chromosome,
            sequence,
            viewStart,
            viewEnd,
            settings
        });
        
        const executionTime = performance.now() - startTime;
        
        // Emit performance event if slow
        if (executionTime > 100) {
            this.eventBus.emit('performance:slow-render', {
                executionTime,
                chromosome,
                sequenceLength: sequence.length,
                viewRange: viewEnd - viewStart
            });
        }
        
        return {
            html: renderResult.html,
            lineCount: renderResult.lineCount,
            executionTime,
            settings
        };
    }
    
    /**
     * Improved cursor color setting with validation
     */
    async setCursorColor(color) {
        try {
            const result = await this.context.execute('sequence:setCursorColor', { color });
            return Result.success(result.data);
        } catch (error) {
            return Result.error(error, { color, operation: 'setCursorColor' });
        }
    }
    
    /**
     * Command handler for cursor color
     */
    async setCursorColorHandler(context, params) {
        const { color } = params;
        
        // Update context state
        context.setState('cursor:color', color, {
            timestamp: Date.now(),
            source: 'user'
        });
        
        // Update CSS styles
        this.updateCursorStyles(color);
        
        // Emit change event
        this.eventBus.emit('cursor:color-changed', { color });
        
        return { color, updated: true };
    }
    
    /**
     * Batch operations for performance
     */
    async batchUpdate(operations) {
        const results = await this.context.batch(operations.map(op => {
            return (context) => {
                switch (op.type) {
                    case 'setCursor':
                        return this.setCursorPositionHandler(context, op.params);
                    case 'render':
                        return this.renderSequenceHandler(context, op.params);
                    case 'setColor':
                        return this.setCursorColorHandler(context, op.params);
                    default:
                        throw new Error(`Unknown operation type: ${op.type}`);
                }
            };
        }));
        
        return Result.success(results, {
            operationCount: operations.length,
            batchExecuted: true
        });
    }
    
    /**
     * Handle sequence changes reactively
     */
    handleSequenceChange(newSequence, oldSequence) {
        if (!newSequence) return;
        
        // Invalidate related caches
        this.cacheManager.invalidateByTags(['sequence']);
        
        // Reposition cursor if needed
        const currentCursorPos = this.context.getState('cursor:position');
        if (currentCursorPos >= 0 && currentCursorPos < newSequence.length) {
            this.taskQueue.add(
                () => this.positionCursorElement(currentCursorPos),
                'normal'
            );
        }
        
        this.eventBus.emit('sequence:changed', {
            newSequence: newSequence.slice(0, 100) + '...', // Truncate for logging
            oldSequence: oldSequence?.slice(0, 100) + '...',
            lengthChange: newSequence.length - (oldSequence?.length || 0)
        });
    }
    
    /**
     * Handle cursor position changes
     */
    handleCursorPositionChange(position) {
        // Queue cursor positioning for next frame
        this.taskQueue.add(
            () => this.positionCursorElement(position),
            'high'
        );
        
        // Update status bar
        this.updateCursorStatus(position);
    }
    
    /**
     * Handle window resize with debouncing
     */
    handleWindowResize(resizeData) {
        // Invalidate render cache since dimensions changed
        this.renderCache.clear();
        
        // Reposition cursor
        const currentCursorPos = this.context.getState('cursor:position');
        if (currentCursorPos >= 0) {
            this.taskQueue.add(
                () => this.positionCursorElement(currentCursorPos),
                'high'
            );
        }
        
        console.log('🔧 [ImprovedSequenceUtils] Handled window resize', resizeData);
    }
    
    /**
     * Optimized rendering with smart caching
     */
    async performOptimizedRender(params) {
        const { chromosome, sequence, viewStart, viewEnd, settings } = params;
        
        // Use virtual scrolling for large sequences
        if (sequence.length > 10000) {
            return this.renderVirtualized(params);
        } else {
            return this.renderFull(params);
        }
    }
    
    /**
     * Virtualized rendering for large sequences
     */
    async renderVirtualized(params) {
        // Implementation would go here
        return {
            html: '<div>Virtualized render placeholder</div>',
            lineCount: Math.ceil(params.sequence.length / 80),
            virtualized: true
        };
    }
    
    /**
     * Full rendering for smaller sequences
     */
    async renderFull(params) {
        // Implementation would go here
        return {
            html: '<div>Full render placeholder</div>',
            lineCount: Math.ceil(params.sequence.length / 80),
            virtualized: false
        };
    }
    
    /**
     * Position cursor element with improved accuracy
     */
    async positionCursorElement(position) {
        // Implementation using the improved positioning logic
        console.log(`🎯 [ImprovedSequenceUtils] Positioning cursor at ${position}`);
        
        // This would contain the actual DOM manipulation logic
        return { positioned: true, position };
    }
    
    /**
     * Update cursor styles
     */
    updateCursorStyles(color) {
        // Implementation for updating CSS
        console.log(`🎨 [ImprovedSequenceUtils] Updated cursor color to ${color}`);
    }
    
    /**
     * Update cursor status display
     */
    updateCursorStatus(position) {
        // Implementation for status bar update
        this.eventBus.emit('status:update', {
            type: 'cursor',
            message: `Cursor: ${position + 1}`,
            position
        });
    }
    
    /**
     * Get current chromosome
     */
    getCurrentChromosome() {
        return this.context.getState('chromosome:current') || 'chr1';
    }
    
    /**
     * Get default settings
     */
    getDefaultSettings() {
        return {
            cursorColor: '#000000',
            showIndicators: true,
            lineHeight: 28
        };
    }
    
    /**
     * Invalidate cache by tags
     */
    invalidateCache(tags = []) {
        this.cacheManager.invalidateByTags(tags);
        console.log(`🗑️ [ImprovedSequenceUtils] Invalidated cache for tags:`, tags);
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            context: this.context.getPerformanceMetrics(),
            eventBus: this.eventBus.getMetrics(),
            renderCache: this.renderCache.size,
            featureCache: this.featureCache.size
        };
    }
    
    /**
     * Debug information
     */
    debug() {
        return {
            metrics: this.getMetrics(),
            state: this.context.getAllState(),
            cacheStats: this.cacheManager.getStats()
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear caches
        this.renderCache.clear();
        this.featureCache.clear();
        
        // Remove event listeners (they have unsubscribe functions)
        // In a real implementation, store unsubscribe functions and call them
        
        console.log('🧬 [ImprovedSequenceUtils] Destroyed and cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImprovedSequenceUtils;
} else if (typeof window !== 'undefined') {
    window.ImprovedSequenceUtils = ImprovedSequenceUtils;
}