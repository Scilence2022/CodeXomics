/**
 * ModernSequenceUtils - Improved sequence utilities with command pattern and modern architecture
 * Replaces legacy SequenceUtils with reactive patterns, caching, and event-driven architecture
 */
class ModernSequenceUtils {
    constructor(context) {
        this.context = context;
        this.eventBus = context.getService('eventBus');
        this.taskQueue = context.getService('taskQueue');
        this.cacheManager = context.getService('cacheManager');
        
        // Initialize state management
        this.initializeState();
        
        // Register commands
        this.registerCommands();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Create specialized caches
        this.renderCache = this.cacheManager.createCache('sequence-render', {
            ttl: 300000, // 5 minutes
            maxSize: 500,
            tags: ['sequence', 'render']
        });
        
        this.positionCache = this.cacheManager.createCache('sequence-position', {
            ttl: 120000, // 2 minutes
            maxSize: 1000,
            tags: ['sequence', 'position']
        });
        
        console.log('🧬 [ModernSequenceUtils] Initialized with modern patterns');
        // DEPRECATION NOTICE: Cursor-specific behaviors are scheduled for removal.
    }
    
    /**
     * Initialize reactive state management
     */
    initializeState() {
        // Initialize sequence-related state
        this.context.setState('sequence:cursor', {
            position: 0,
            color: '#000000',
            visible: true
        }, {
            source: 'ModernSequenceUtils',
            timestamp: Date.now()
        });
        
        this.context.setState('sequence:viewport', {
            start: 0,
            end: 100,
            width: 0,
            height: 0
        }, {
            source: 'ModernSequenceUtils',
            timestamp: Date.now()
        });
        
        this.context.setState('sequence:settings', {
            lineHeight: 28,
            characterWidth: 12,
            showIndicators: true,
            colorScheme: 'default'
        }, {
            source: 'ModernSequenceUtils',
            timestamp: Date.now()
        });
        
        // Subscribe to global cursor position changes
        this.context.subscribe('cursor:position', (change) => {
            this.syncCursorPosition(change.newValue);
        });
        
        // Subscribe to window resize
        this.context.subscribe('window:size', (change) => {
            this.handleViewportResize(change.newValue);
        });
    }
    
    /**
     * Register all sequence utility commands
     */
    registerCommands() {
        const commandRegistry = this.context.getService('commandRegistry');
        
        // Set cursor position command
        const setCursorCommand = new Command(
            'sequence:setCursor',
            this.setCursorHandler.bind(this),
            {
                description: 'Set cursor position in sequence view',
                category: 'sequence',
                timeout: 5000,
                inputSchema: {
                    position: { type: 'number', required: true, validate: pos => pos >= 0 },
                    chromosome: { type: 'string', required: false },
                    animate: { type: 'boolean', required: false }
                },
                hooks: {
                    before: [this.validateCursorPosition.bind(this)],
                    after: [this.notifyCursorChanged.bind(this)]
                }
            }
        );
        
        commandRegistry.register(setCursorCommand);
        
        // Set cursor color command
        const setCursorColorCommand = new Command(
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
                },
                hooks: {
                    after: [this.notifyColorChanged.bind(this)]
                }
            }
        );
        
        commandRegistry.register(setCursorColorCommand);
        
        // Handle sequence click command
        const handleClickCommand = new Command(
            'sequence:click',
            this.handleSequenceClickHandler.bind(this),
            {
                description: 'Handle sequence click events with position calculation',
                category: 'sequence',
                timeout: 3000,
                inputSchema: {
                    event: { type: 'object', required: true },
                    position: { type: 'number', required: false }
                },
                hooks: {
                    before: [this.validateClickEvent.bind(this)],
                    after: [this.notifySequenceClicked.bind(this)]
                }
            }
        );
        
        commandRegistry.register(handleClickCommand);
        
        // Render sequence command
        const renderCommand = new Command(
            'sequence:render',
            this.renderSequenceHandler.bind(this),
            {
                description: 'Render sequence with smart caching and optimization',
                category: 'sequence',
                timeout: 15000,
                retries: 2,
                inputSchema: {
                    chromosome: { type: 'string', required: true },
                    sequence: { type: 'string', required: true },
                    viewStart: { type: 'number', required: true },
                    viewEnd: { type: 'number', required: true },
                    container: { type: 'object', required: false }
                },
                hooks: {
                    before: [this.validateRenderParams.bind(this)],
                    after: [this.notifyRenderComplete.bind(this)]
                }
            }
        );
        
        commandRegistry.register(renderCommand);
        
        // Calculate position command
        const calculatePositionCommand = new Command(
            'sequence:calculatePosition',
            this.calculatePositionHandler.bind(this),
            {
                description: 'Calculate sequence position from screen coordinates',
                category: 'sequence',
                timeout: 1000,
                inputSchema: {
                    clientX: { type: 'number', required: true },
                    clientY: { type: 'number', required: true },
                    container: { type: 'object', required: false }
                }
            }
        );
        
        commandRegistry.register(calculatePositionCommand);
        
        console.log('📝 [ModernSequenceUtils] Commands registered');
    }
    
    /**
     * Setup event handlers for reactive behavior
     */
    setupEventHandlers() {
        // Listen for UI events
        this.eventBus.on('ui:sequence-click', (eventData) => {
            this.handleUISequenceClick(eventData.data);
        });
        
        // Listen for window resize events
        this.eventBus.on('window:resize', (eventData) => {
            this.handleWindowResize(eventData.data);
        }, { debounce: 150 });
        
        // Listen for sequence changes
        this.context.subscribe('sequence:current', (change) => {
            this.handleSequenceChange(change.newValue, change.oldValue);
        });
        
        // Listen for viewport changes
        this.context.subscribe('sequence:viewport', (change) => {
            this.handleViewportChange(change.newValue, change.oldValue);
        });
        
        console.log('🔗 [ModernSequenceUtils] Event handlers setup');
    }
    
    /**
     * Set cursor position command handler
     */
    async setCursorHandler(context, params) {
        const { position, chromosome, animate = true } = params;
        
        // Calculate cursor coordinates
        const coordinates = await this.calculateCursorCoordinates(position);
        
        // Update sequence cursor state
        const currentCursor = context.getState('sequence:cursor');
        const newCursor = {
            ...currentCursor,
            position,
            chromosome: chromosome || context.getState('chromosome:current'),
            coordinates,
            timestamp: Date.now()
        };
        
        context.setState('sequence:cursor', newCursor, {
            source: 'ModernSequenceUtils',
            action: 'setCursor',
            animate
        });
        
        // Update global cursor position
        context.setState('cursor:position', position, {
            source: 'ModernSequenceUtils',
            chromosome: newCursor.chromosome,
            timestamp: Date.now()
        });
        
        // Position cursor element
        await this.positionCursorElement(coordinates, animate);
        
        return {
            position,
            chromosome: newCursor.chromosome,
            coordinates,
            success: true
        };
    }
    
    /**
     * Set cursor color command handler
     */
    async setCursorColorHandler(context, params) {
        const { color } = params;
        
        // Update cursor state
        const currentCursor = context.getState('sequence:cursor');
        const newCursor = {
            ...currentCursor,
            color,
            timestamp: Date.now()
        };
        
        context.setState('sequence:cursor', newCursor, {
            source: 'ModernSequenceUtils',
            action: 'setCursorColor'
        });
        
        // Update cursor element styles
        await this.updateCursorStyles(color);
        
        return {
            color,
            success: true
        };
    }
    
    /**
     * Handle sequence click command handler
     */
    async handleSequenceClickHandler(context, params) {
        const { event, position } = params;
        
        // Calculate position if not provided
        let clickPosition = position;
        if (clickPosition === undefined) {
            const positionResult = await this.calculatePositionFromEvent(event);
            clickPosition = positionResult.position;
        }
        
        // Set cursor to clicked position
        const result = await context.execute('sequence:setCursor', {
            position: clickPosition,
            animate: true
        });
        
        if (!result.success) {
            throw new Error(`Failed to set cursor position: ${result.error.message}`);
        }
        
        return {
            position: clickPosition,
            event: {
                clientX: event.clientX,
                clientY: event.clientY,
                button: event.button
            },
            success: true
        };
    }
    
    /**
     * Render sequence command handler
     */
    async renderSequenceHandler(context, params) {
        const { chromosome, sequence, viewStart, viewEnd, container } = params;
        
        // Generate cache key
        const cacheKey = `${chromosome}:${viewStart}:${viewEnd}:${sequence.length}`;
        
        // Check cache first
        const cached = this.renderCache.get(cacheKey);
        if (cached) {
            return {
                ...cached,
                cached: true,
                timestamp: Date.now()
            };
        }
        
        const startTime = performance.now();
        
        // Get rendering settings
        const settings = context.getState('sequence:settings');
        
        // Perform rendering
        const renderResult = await this.performSequenceRender({
            chromosome,
            sequence,
            viewStart,
            viewEnd,
            settings,
            container
        });
        
        const executionTime = performance.now() - startTime;
        
        // Cache the result
        const result = {
            html: renderResult.html,
            lineCount: renderResult.lineCount,
            viewportInfo: renderResult.viewportInfo,
            executionTime,
            cached: false,
            timestamp: Date.now()
        };
        
        this.renderCache.set(cacheKey, result);
        
        // Emit performance event if slow
        if (executionTime > 100) {
            this.eventBus.emit('performance:slow-render', {
                executionTime,
                chromosome,
                sequenceLength: sequence.length,
                viewRange: viewEnd - viewStart
            });
        }
        
        return result;
    }
    
    /**
     * Calculate position from screen coordinates
     */
    async calculatePositionHandler(context, params) {
        const { clientX, clientY, container } = params;
        
        // Get viewport and settings
        const viewport = context.getState('sequence:viewport');
        const settings = context.getState('sequence:settings');
        
        // Calculate position from coordinates
        const position = await this.calculatePositionFromCoordinates(
            clientX, 
            clientY, 
            viewport, 
            settings, 
            container
        );
        
        return {
            position,
            coordinates: { x: clientX, y: clientY },
            success: true
        };
    }
    
    /**
     * Validation hook for cursor position
     */
    async validateCursorPosition(context, params) {
        const { position } = params;
        const currentSequence = context.getState('sequence:current');
        
        if (currentSequence && position >= currentSequence.length) {
            throw new Error(`Cursor position ${position} exceeds sequence length ${currentSequence.length}`);
        }
        
        if (position < 0) {
            throw new Error(`Cursor position cannot be negative: ${position}`);
        }
    }
    
    /**
     * Validation hook for click events
     */
    async validateClickEvent(context, params) {
        const { event } = params;
        
        if (!event || typeof event !== 'object') {
            throw new Error('Invalid click event object');
        }
        
        if (event.clientX === undefined || event.clientY === undefined) {
            throw new Error('Click event missing coordinate information');
        }
    }
    
    /**
     * Validation hook for render parameters
     */
    async validateRenderParams(context, params) {
        const { sequence, viewStart, viewEnd } = params;
        
        if (viewStart < 0 || viewEnd < 0) {
            throw new Error('View coordinates cannot be negative');
        }
        
        if (viewStart >= viewEnd) {
            throw new Error('View start must be less than view end');
        }
        
        if (viewEnd > sequence.length) {
            throw new Error(`View end ${viewEnd} exceeds sequence length ${sequence.length}`);
        }
    }
    
    /**
     * Notification hook for cursor changes
     */
    async notifyCursorChanged(context, params, result) {
        this.eventBus.emit('sequence:cursor-changed', {
            position: result.position,
            chromosome: result.chromosome,
            coordinates: result.coordinates,
            timestamp: Date.now()
        });
    }
    
    /**
     * Notification hook for color changes
     */
    async notifyColorChanged(context, params, result) {
        this.eventBus.emit('sequence:cursor-color-changed', {
            color: result.color,
            timestamp: Date.now()
        });
    }
    
    /**
     * Notification hook for sequence clicks
     */
    async notifySequenceClicked(context, params, result) {
        this.eventBus.emit('sequence:clicked', {
            position: result.position,
            event: result.event,
            timestamp: Date.now()
        });
    }
    
    /**
     * Notification hook for render completion
     */
    async notifyRenderComplete(context, params, result) {
        this.eventBus.emit('sequence:render-complete', {
            chromosome: params.chromosome,
            executionTime: result.executionTime,
            cached: result.cached,
            lineCount: result.lineCount,
            timestamp: Date.now()
        });
    }
    
    /**
     * Calculate cursor coordinates from position
     */
    async calculateCursorCoordinates(position) {
        const cacheKey = `coords:${position}`;
        const cached = this.positionCache.get(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        const settings = this.context.getState('sequence:settings');
        const viewport = this.context.getState('sequence:viewport');
        
        // Calculate coordinates based on position
        const line = Math.floor(position / 80); // Assuming 80 characters per line
        const column = position % 80;
        
        const coordinates = {
            x: column * settings.characterWidth + viewport.start,
            y: line * settings.lineHeight,
            line,
            column
        };
        
        this.positionCache.set(cacheKey, coordinates);
        
        return coordinates;
    }
    
    /**
     * Calculate position from screen coordinates
     */
    async calculatePositionFromCoordinates(clientX, clientY, viewport, settings, container) {
        // Get container bounds
        const containerBounds = container?.getBoundingClientRect() || { left: 0, top: 0 };
        
        // Calculate relative coordinates
        const relativeX = clientX - containerBounds.left;
        const relativeY = clientY - containerBounds.top;
        
        // Calculate line and column
        const line = Math.floor(relativeY / settings.lineHeight);
        const column = Math.floor(relativeX / settings.characterWidth);
        
        // Calculate position
        const position = line * 80 + column;
        
        return {
            position: Math.max(0, position),
            line,
            column,
            coordinates: { x: relativeX, y: relativeY }
        };
    }
    
    /**
     * Calculate position from event object
     */
    async calculatePositionFromEvent(event) {
        const result = await this.context.execute('sequence:calculatePosition', {
            clientX: event.clientX,
            clientY: event.clientY,
            container: event.target?.closest('.sequence-container')
        });
        
        return result.data;
    }
    
    /**
     * Position cursor element with animation
     */
    async positionCursorElement(coordinates, animate = true) {
        // Get cursor element
        const cursorElement = document.querySelector('.sequence-cursor');
        
        if (!cursorElement) {
            console.warn('🚨 [ModernSequenceUtils] Cursor element not found');
            return;
        }
        
        // Apply positioning
        if (animate) {
            cursorElement.style.transition = 'all 0.2s ease-in-out';
        } else {
            cursorElement.style.transition = 'none';
        }
        
        cursorElement.style.left = coordinates.x + 'px';
        cursorElement.style.top = coordinates.y + 'px';
        
        // Reset transition after animation
        if (animate) {
            setTimeout(() => {
                cursorElement.style.transition = 'none';
            }, 200);
        }
    }
    
    /**
     * Update cursor element styles
     */
    async updateCursorStyles(color) {
        const cursorElement = document.querySelector('.sequence-cursor');
        
        if (!cursorElement) {
            console.warn('🚨 [ModernSequenceUtils] Cursor element not found');
            return;
        }
        
        cursorElement.style.backgroundColor = color;
        cursorElement.style.borderColor = color;
        
        // Update any related style elements
        const styleElements = document.querySelectorAll('.cursor-related');
        styleElements.forEach(element => {
            element.style.color = color;
        });
    }
    
    /**
     * Perform sequence rendering with optimization
     */
    async performSequenceRender(params) {
        const { chromosome, sequence, viewStart, viewEnd, settings, container } = params;
        
        // Use virtualization for large sequences
        if (sequence.length > 50000) {
            return this.renderVirtualizedSequence(params);
        } else {
            return this.renderStandardSequence(params);
        }
    }
    
    /**
     * Render virtualized sequence for large datasets
     */
    async renderVirtualizedSequence(params) {
        const { sequence, viewStart, viewEnd, settings } = params;
        
        const visibleLines = Math.ceil((viewEnd - viewStart) / 80);
        const lineHeight = settings.lineHeight;
        
        let html = '<div class="sequence-content virtualized">';
        
        for (let i = 0; i < visibleLines; i++) {
            const lineStart = viewStart + i * 80;
            const lineEnd = Math.min(lineStart + 80, viewEnd);
            const lineContent = sequence.slice(lineStart, lineEnd);
            
            html += `<div class="sequence-line" style="height: ${lineHeight}px;">${lineContent}</div>`;
        }
        
        html += '</div>';
        
        return {
            html,
            lineCount: visibleLines,
            viewportInfo: {
                virtualized: true,
                visibleRange: [viewStart, viewEnd]
            }
        };
    }
    
    /**
     * Render standard sequence for smaller datasets
     */
    async renderStandardSequence(params) {
        const { sequence, viewStart, viewEnd, settings } = params;
        
        const visibleSequence = sequence.slice(viewStart, viewEnd);
        const lines = [];
        
        for (let i = 0; i < visibleSequence.length; i += 80) {
            const line = visibleSequence.slice(i, i + 80);
            lines.push(line);
        }
        
        const html = `
            <div class="sequence-content standard">
                ${lines.map((line, index) => `
                    <div class="sequence-line" data-line="${index}">
                        ${line}
                    </div>
                `).join('')}
            </div>
        `;
        
        return {
            html,
            lineCount: lines.length,
            viewportInfo: {
                virtualized: false,
                totalLines: lines.length
            }
        };
    }
    
    /**
     * Handle UI sequence click events
     */
    async handleUISequenceClick(data) {
        const { event } = data;
        
        try {
            const result = await this.context.execute('sequence:click', {
                event: this.serializeEvent(event)
            });
            
            this.eventBus.emit('sequence:ui-click-handled', {
                success: true,
                result: result.data
            });
            
        } catch (error) {
            this.eventBus.emit('sequence:ui-click-failed', {
                success: false,
                error: error.message
            });
        }
    }
    
    /**
     * Handle window resize events
     */
    handleWindowResize(resizeData) {
        // Update viewport dimensions
        this.context.setState('sequence:viewport', {
            ...this.context.getState('sequence:viewport'),
            width: resizeData.width,
            height: resizeData.height
        }, {
            source: 'resize',
            timestamp: Date.now()
        });
        
        // Invalidate render cache
        this.renderCache.clear();
        
        // Reposition cursor
        const currentCursor = this.context.getState('sequence:cursor');
        if (currentCursor.position >= 0) {
            this.taskQueue.add(
                () => this.recalculateCursorPosition(currentCursor.position),
                'high'
            );
        }
    }
    
    /**
     * Handle sequence changes
     */
    handleSequenceChange(newSequence, oldSequence) {
        if (!newSequence) return;
        
        // Invalidate all sequence-related caches
        this.cacheManager.invalidateByTags(['sequence']);
        
        // Validate cursor position
        const currentCursor = this.context.getState('sequence:cursor');
        if (currentCursor.position >= newSequence.length) {
            // Move cursor to end of sequence
            this.taskQueue.add(
                () => this.context.execute('sequence:setCursor', {
                    position: Math.max(0, newSequence.length - 1)
                }),
                'high'
            );
        }
        
        this.eventBus.emit('sequence:content-changed', {
            newLength: newSequence.length,
            oldLength: oldSequence?.length || 0,
            lengthDiff: newSequence.length - (oldSequence?.length || 0)
        });
    }
    
    /**
     * Handle viewport changes
     */
    handleViewportChange(newViewport, oldViewport) {
        // Invalidate render cache when viewport changes
        this.renderCache.clear();
        
        // Update cursor visibility
        const currentCursor = this.context.getState('sequence:cursor');
        const cursorVisible = currentCursor.position >= newViewport.start && 
                            currentCursor.position <= newViewport.end;
        
        if (currentCursor.visible !== cursorVisible) {
            this.context.setState('sequence:cursor', {
                ...currentCursor,
                visible: cursorVisible
            }, {
                source: 'viewport-change',
                timestamp: Date.now()
            });
        }
    }
    
    /**
     * Sync cursor position with global state
     */
    syncCursorPosition(position) {
        const currentCursor = this.context.getState('sequence:cursor');
        
        if (currentCursor.position !== position) {
            this.taskQueue.add(
                () => this.context.execute('sequence:setCursor', {
                    position,
                    animate: false
                }),
                'high'
            );
        }
    }
    
    /**
     * Handle viewport resize
     */
    handleViewportResize(newSize) {
        const currentViewport = this.context.getState('sequence:viewport');
        
        this.context.setState('sequence:viewport', {
            ...currentViewport,
            width: newSize.width,
            height: newSize.height
        }, {
            source: 'resize',
            timestamp: Date.now()
        });
    }
    
    /**
     * Recalculate cursor position after resize
     */
    async recalculateCursorPosition(position) {
        const coordinates = await this.calculateCursorCoordinates(position);
        await this.positionCursorElement(coordinates, false);
    }
    
    /**
     * Serialize event for command processing
     */
    serializeEvent(event) {
        return {
            type: event.type,
            clientX: event.clientX,
            clientY: event.clientY,
            button: event.button,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
            altKey: event.altKey,
            metaKey: event.metaKey,
            target: {
                tagName: event.target?.tagName,
                className: event.target?.className,
                id: event.target?.id
            },
            timestamp: event.timeStamp || Date.now()
        };
    }
    
    /**
     * Get current sequence state
     */
    getSequenceState() {
        return {
            cursor: this.context.getState('sequence:cursor'),
            viewport: this.context.getState('sequence:viewport'),
            settings: this.context.getState('sequence:settings'),
            currentSequence: this.context.getState('sequence:current'),
            currentChromosome: this.context.getState('chromosome:current')
        };
    }
    
    /**
     * Legacy API compatibility methods
     */
    
    // Legacy: setCursorPosition
    async setCursorPosition(position, options = {}) {
        const result = await this.context.execute('sequence:setCursor', {
            position,
            ...options
        });
        return result.success ? result.data : null;
    }
    
    // Legacy: setCursorColor
    async setCursorColor(color) {
        const result = await this.context.execute('sequence:setCursorColor', { color });
        return result.success ? result.data : null;
    }
    
    // Legacy: handleSequenceClick
    async handleSequenceClick(event, position) {
        const result = await this.context.execute('sequence:click', {
            event: this.serializeEvent(event),
            position
        });
        return result.success ? result.data : null;
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        const commandRegistry = this.context.getService('commandRegistry');
        const sequenceCommands = [
            'sequence:setCursor', 
            'sequence:setCursorColor', 
            'sequence:click', 
            'sequence:render',
            'sequence:calculatePosition'
        ];
        
        const commandStats = {};
        for (const commandName of sequenceCommands) {
            const command = commandRegistry.get(commandName);
            if (command) {
                commandStats[commandName] = command.getStats();
            }
        }
        
        return {
            commands: commandStats,
            caches: {
                render: {
                    size: this.renderCache.size,
                    hits: 0, // Would be tracked in real implementation
                    misses: 0
                },
                position: {
                    size: this.positionCache.size,
                    hits: 0,
                    misses: 0
                }
            },
            state: this.getSequenceState()
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear caches
        this.renderCache.clear();
        this.positionCache.clear();
        
        // Clear state
        this.context.setState('sequence:cursor', null, { source: 'destroy' });
        this.context.setState('sequence:viewport', null, { source: 'destroy' });
        
        console.log('🧹 [ModernSequenceUtils] Resources cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernSequenceUtils;
} else if (typeof window !== 'undefined') {
    window.ModernSequenceUtils = ModernSequenceUtils;
}