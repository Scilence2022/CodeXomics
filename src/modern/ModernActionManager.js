/**
 * ModernActionManager - Command-based action management with improved patterns
 * Replaces legacy ActionManager with modern architecture
 */
class ModernActionManager {
    constructor(context) {
        this.context = context;
        this.eventBus = context.getService('eventBus');
        this.taskQueue = context.getService('taskQueue');
        this.cacheManager = context.getService('cacheManager');
        
        // Modern state management
        this.initializeState();
        
        // Register commands
        this.registerCommands();
        
        // Setup event handlers
        this.setupEventHandlers();
        
        // Create specialized caches
        this.actionCache = this.cacheManager.createCache('actions', {
            ttl: 600000, // 10 minutes
            maxSize: 1000,
            tags: ['actions']
        });
        
        console.log('🎯 [ModernActionManager] Initialized with modern patterns');
    }
    
    /**
     * Initialize reactive state management
     */
    initializeState() {
        // Initialize action-related state
        this.context.setState('actions:queue', [], {
            source: 'ModernActionManager',
            timestamp: Date.now()
        });
        
        this.context.setState('actions:clipboard', null, {
            source: 'ModernActionManager',
            timestamp: Date.now()
        });
        
        // DEPRECATED: actions:cursorPosition is scheduled for removal
        this.context.setState('actions:cursorPosition', 0, {
            source: 'ModernActionManager',
            timestamp: Date.now()
        });
        
        this.context.setState('actions:isExecuting', false, {
            source: 'ModernActionManager',
            timestamp: Date.now()
        });
        
        // Subscribe to cursor position changes
        this.context.subscribe('cursor:position', (change) => {
            this.context.setState('actions:cursorPosition', change.newValue, {
                source: 'cursor-sync',
                originalSource: change.metadata.source
            });
        });
    }
    
    /**
     * Register all action commands
     */
    registerCommands() {
        const commandRegistry = this.context.getService('commandRegistry');
        
        // Register cursor position command
        const setCursorPositionCommand = new Command(
            'action:setCursorPosition',
            this.setCursorPositionHandler.bind(this),
            {
                description: 'Set cursor position for actions',
                category: 'action',
                timeout: 5000,
                inputSchema: {
                    position: { type: 'number', required: true, validate: pos => pos >= 0 }
                },
                hooks: {
                    after: [this.notifyCursorPositionChange.bind(this)]
                }
            }
        );
        
        commandRegistry.register(setCursorPositionCommand);
        
        // Register paste command
        const pasteCommand = new Command(
            'action:paste',
            this.pasteSequenceHandler.bind(this),
            {
                description: 'Paste sequence at cursor or specified position',
                category: 'action',
                timeout: 10000,
                retries: 1,
                inputSchema: {
                    position: { type: 'number', required: false },
                    chromosome: { type: 'string', required: false },
                    force: { type: 'boolean', required: false }
                },
                hooks: {
                    before: [this.validatePasteOperation.bind(this)],
                    after: [this.notifyActionQueued.bind(this)]
                }
            }
        );
        
        commandRegistry.register(pasteCommand);
        
        // Register delete command
        const deleteCommand = new Command(
            'action:delete',
            this.deleteSequenceHandler.bind(this),
            {
                description: 'Delete sequence at specified position',
                category: 'action',
                timeout: 10000,
                inputSchema: {
                    position: { type: 'number', required: false },
                    length: { type: 'number', required: false },
                    chromosome: { type: 'string', required: false }
                },
                hooks: {
                    before: [this.validateDeleteOperation.bind(this)],
                    after: [this.notifyActionQueued.bind(this)]
                }
            }
        );
        
        commandRegistry.register(deleteCommand);
        
        // Register copy command
        const copyCommand = new Command(
            'action:copy',
            this.copySequenceHandler.bind(this),
            {
                description: 'Copy sequence to clipboard',
                category: 'action',
                timeout: 5000,
                inputSchema: {
                    start: { type: 'number', required: true },
                    end: { type: 'number', required: true },
                    chromosome: { type: 'string', required: false }
                }
            }
        );
        
        commandRegistry.register(copyCommand);
        
        // Register execute actions command
        const executeCommand = new Command(
            'action:executeAll',
            this.executeAllActionsHandler.bind(this),
            {
                description: 'Execute all queued actions',
                category: 'action',
                timeout: 60000,
                retries: 0 // Don't retry batch executions
            }
        );
        
        commandRegistry.register(executeCommand);
        
        console.log('📝 [ModernActionManager] Commands registered');
    }
    
    /**
     * Setup event handlers for reactive behavior
     */
    setupEventHandlers() {
        // Listen for UI events
        this.eventBus.on('ui:action-requested', (eventData) => {
            this.handleUIActionRequest(eventData.data);
        });
        
        // Listen for sequence changes to update available actions
        this.context.subscribe('sequence:current', (change) => {
            this.handleSequenceChange(change.newValue, change.oldValue);
        });
        
        // Listen for action queue changes
        this.context.subscribe('actions:queue', (change) => {
            this.handleActionQueueChange(change.newValue, change.oldValue);
        });
        
        console.log('🔗 [ModernActionManager] Event handlers setup');
    }
    
    /**
     * Set cursor position command handler
     */
    async setCursorPositionHandler(context, params) {
        const { position } = params;
        
        // Update context state
        context.setState('actions:cursorPosition', position, {
            source: 'ModernActionManager',
            action: 'setCursorPosition',
            timestamp: Date.now()
        });
        
        // Also update global cursor position
        context.setState('cursor:position', position, {
            source: 'ModernActionManager',
            timestamp: Date.now()
        });
        
        return {
            position,
            success: true,
            timestamp: Date.now()
        };
    }
    
    /**
     * Paste sequence command handler
     */
    async pasteSequenceHandler(context, params) {
        const { position, chromosome, force = false } = params;
        
        // Get clipboard data
        const clipboardData = context.getState('actions:clipboard');
        if (!clipboardData && !force) {
            throw new Error('No sequence data in clipboard');
        }
        
        // Determine target position
        const targetPosition = position !== undefined 
            ? position 
            : context.getState('actions:cursorPosition');
            
        const targetChromosome = chromosome || context.getState('chromosome:current');
        
        if (targetPosition < 0) {
            throw new Error('Invalid target position for paste operation');
        }
        
        // Create action object
        const action = {
            id: crypto.randomUUID(),
            type: 'PASTE_SEQUENCE',
            target: `${targetChromosome}:${targetPosition}`,
            description: `Paste ${clipboardData?.sequence?.length || 0} bp at position ${targetPosition}`,
            metadata: {
                chromosome: targetChromosome,
                position: targetPosition,
                clipboardData,
                timestamp: Date.now(),
                source: 'ModernActionManager'
            },
            status: 'pending'
        };
        
        // Add to action queue
        const currentQueue = context.getState('actions:queue') || [];
        const newQueue = [...currentQueue, action];
        context.setState('actions:queue', newQueue, {
            source: 'ModernActionManager',
            action: 'paste',
            actionId: action.id
        });
        
        return {
            action,
            queuePosition: newQueue.length - 1,
            success: true
        };
    }
    
    /**
     * Delete sequence command handler
     */
    async deleteSequenceHandler(context, params) {
        const { position, length = 1, chromosome } = params;
        
        // Determine target position
        const targetPosition = position !== undefined 
            ? position 
            : context.getState('actions:cursorPosition');
            
        const targetChromosome = chromosome || context.getState('chromosome:current');
        
        if (targetPosition < 0) {
            throw new Error('Invalid target position for delete operation');
        }
        
        // Create action object
        const action = {
            id: crypto.randomUUID(),
            type: 'DELETE_SEQUENCE',
            target: `${targetChromosome}:${targetPosition}`,
            description: `Delete ${length} bp from position ${targetPosition}`,
            metadata: {
                chromosome: targetChromosome,
                position: targetPosition,
                length,
                timestamp: Date.now(),
                source: 'ModernActionManager'
            },
            status: 'pending'
        };
        
        // Add to action queue
        const currentQueue = context.getState('actions:queue') || [];
        const newQueue = [...currentQueue, action];
        context.setState('actions:queue', newQueue, {
            source: 'ModernActionManager',
            action: 'delete',
            actionId: action.id
        });
        
        return {
            action,
            queuePosition: newQueue.length - 1,
            success: true
        };
    }
    
    /**
     * Copy sequence command handler
     */
    async copySequenceHandler(context, params) {
        const { start, end, chromosome } = params;
        
        const targetChromosome = chromosome || context.getState('chromosome:current');
        const currentSequence = context.getState('sequence:current');
        
        if (!currentSequence) {
            throw new Error('No sequence available for copy operation');
        }
        
        if (start < 0 || end > currentSequence.length || start >= end) {
            throw new Error(`Invalid copy range: ${start}-${end} (sequence length: ${currentSequence.length})`);
        }
        
        // Extract sequence data
        const sequenceData = currentSequence.substring(start, end);
        
        // Create clipboard data
        const clipboardData = {
            sequence: sequenceData,
            start,
            end,
            chromosome: targetChromosome,
            length: sequenceData.length,
            timestamp: Date.now(),
            source: 'ModernActionManager'
        };
        
        // Update clipboard state
        context.setState('actions:clipboard', clipboardData, {
            source: 'ModernActionManager',
            action: 'copy'
        });
        
        return {
            clipboardData,
            copied: true,
            success: true
        };
    }
    
    /**
     * Execute all actions command handler
     */
    async executeAllActionsHandler(context, params) {
        const actionQueue = context.getState('actions:queue') || [];
        
        if (actionQueue.length === 0) {
            return {
                executed: 0,
                success: true,
                message: 'No actions to execute'
            };
        }
        
        // Set executing state
        context.setState('actions:isExecuting', true, {
            source: 'ModernActionManager',
            action: 'executeAll'
        });
        
        const results = [];
        let successCount = 0;
        let errorCount = 0;
        
        try {
            // Execute actions sequentially
            for (const action of actionQueue) {
                try {
                    const result = await this.executeAction(action, context);
                    results.push(result);
                    
                    if (result.success) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                    
                    // Update action status
                    action.status = result.success ? 'completed' : 'failed';
                    action.result = result;
                    
                } catch (error) {
                    errorCount++;
                    action.status = 'failed';
                    action.error = error.message;
                    
                    results.push({
                        success: false,
                        error: error.message,
                        actionId: action.id
                    });
                }
                
                // Emit progress event
                this.eventBus.emit('action:execution-progress', {
                    total: actionQueue.length,
                    completed: results.length,
                    success: successCount,
                    errors: errorCount
                });
            }
            
            // Clear the queue after execution
            context.setState('actions:queue', [], {
                source: 'ModernActionManager',
                action: 'executeAll-complete'
            });
            
            return {
                executed: actionQueue.length,
                success: successCount,
                errors: errorCount,
                results,
                success: true
            };
            
        } finally {
            // Always clear executing state
            context.setState('actions:isExecuting', false, {
                source: 'ModernActionManager',
                action: 'executeAll-complete'
            });
        }
    }
    
    /**
     * Execute a single action
     */
    async executeAction(action, context) {
        console.log(`🚀 [ModernActionManager] Executing action: ${action.type} (${action.id})`);
        
        const startTime = performance.now();
        
        try {
            let result;
            
            switch (action.type) {
                case 'PASTE_SEQUENCE':
                    result = await this.executePasteAction(action, context);
                    break;
                    
                case 'DELETE_SEQUENCE':
                    result = await this.executeDeleteAction(action, context);
                    break;
                    
                case 'COPY_SEQUENCE':
                    result = await this.executeCopyAction(action, context);
                    break;
                    
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
            
            const executionTime = performance.now() - startTime;
            
            return {
                success: true,
                result,
                executionTime,
                actionId: action.id,
                timestamp: Date.now()
            };
            
        } catch (error) {
            const executionTime = performance.now() - startTime;
            
            return {
                success: false,
                error: error.message,
                executionTime,
                actionId: action.id,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Execute paste action
     */
    async executePasteAction(action, context) {
        const { metadata } = action;
        
        // In a real implementation, this would modify the sequence
        console.log(`📋 [ModernActionManager] Executing paste at ${metadata.chromosome}:${metadata.position}`);
        
        // Simulate sequence modification
        const currentSequence = context.getState('sequence:current') || '';
        const newSequence = currentSequence.slice(0, metadata.position) + 
                           metadata.clipboardData.sequence + 
                           currentSequence.slice(metadata.position);
        
        // Update sequence state
        context.setState('sequence:current', newSequence, {
            source: 'ModernActionManager',
            action: 'paste',
            actionId: action.id
        });
        
        return {
            operation: 'paste',
            position: metadata.position,
            insertedLength: metadata.clipboardData.sequence.length,
            newSequenceLength: newSequence.length
        };
    }
    
    /**
     * Execute delete action
     */
    async executeDeleteAction(action, context) {
        const { metadata } = action;
        
        // In a real implementation, this would modify the sequence
        console.log(`🗑️ [ModernActionManager] Executing delete at ${metadata.chromosome}:${metadata.position}`);
        
        // Simulate sequence modification
        const currentSequence = context.getState('sequence:current') || '';
        const newSequence = currentSequence.slice(0, metadata.position) + 
                           currentSequence.slice(metadata.position + metadata.length);
        
        // Update sequence state
        context.setState('sequence:current', newSequence, {
            source: 'ModernActionManager',
            action: 'delete',
            actionId: action.id
        });
        
        return {
            operation: 'delete',
            position: metadata.position,
            deletedLength: metadata.length,
            newSequenceLength: newSequence.length
        };
    }
    
    /**
     * Execute copy action
     */
    async executeCopyAction(action, context) {
        // Copy actions don't modify sequence, just return metadata
        return {
            operation: 'copy',
            copied: true,
            ...action.metadata
        };
    }
    
    /**
     * Validation hook for paste operations
     */
    async validatePasteOperation(context, params) {
        const clipboardData = context.getState('actions:clipboard');
        
        if (!clipboardData && !params.force) {
            throw new Error('No sequence data available in clipboard');
        }
        
        const currentSequence = context.getState('sequence:current');
        const position = params.position !== undefined 
            ? params.position 
            : context.getState('actions:cursorPosition');
            
        if (currentSequence && position > currentSequence.length) {
            throw new Error(`Paste position ${position} exceeds sequence length ${currentSequence.length}`);
        }
    }
    
    /**
     * Validation hook for delete operations
     */
    async validateDeleteOperation(context, params) {
        const currentSequence = context.getState('sequence:current');
        
        if (!currentSequence) {
            throw new Error('No sequence available for delete operation');
        }
        
        const position = params.position !== undefined 
            ? params.position 
            : context.getState('actions:cursorPosition');
        const length = params.length || 1;
        
        if (position < 0 || position >= currentSequence.length) {
            throw new Error(`Delete position ${position} is out of bounds`);
        }
        
        if (position + length > currentSequence.length) {
            throw new Error(`Delete range ${position}-${position + length} exceeds sequence length`);
        }
    }
    
    /**
     * Notification hook for cursor position changes
     */
    async notifyCursorPositionChange(context, params, result) {
        this.eventBus.emit('action:cursor-position-changed', {
            position: result.position,
            timestamp: result.timestamp
        });
    }
    
    /**
     * Notification hook for action queueing
     */
    async notifyActionQueued(context, params, result) {
        this.eventBus.emit('action:queued', {
            action: result.action,
            queuePosition: result.queuePosition
        });
    }
    
    /**
     * Handle UI action requests
     */
    async handleUIActionRequest(data) {
        const { actionType, params = {} } = data;
        
        try {
            let result;
            
            switch (actionType) {
                case 'paste':
                    result = await this.context.execute('action:paste', params);
                    break;
                    
                case 'delete':
                    result = await this.context.execute('action:delete', params);
                    break;
                    
                case 'copy':
                    result = await this.context.execute('action:copy', params);
                    break;
                    
                case 'execute':
                    result = await this.context.execute('action:executeAll', params);
                    break;
                    
                default:
                    throw new Error(`Unknown UI action type: ${actionType}`);
            }
            
            this.eventBus.emit('action:ui-request-completed', {
                actionType,
                result,
                success: true
            });
            
        } catch (error) {
            this.eventBus.emit('action:ui-request-failed', {
                actionType,
                error: error.message,
                success: false
            });
        }
    }
    
    /**
     * Handle sequence changes
     */
    handleSequenceChange(newSequence, oldSequence) {
        // Invalidate action cache when sequence changes
        this.actionCache.clear();
        
        // Update available actions based on sequence state
        this.updateAvailableActions(newSequence);
    }
    
    /**
     * Handle action queue changes
     */
    handleActionQueueChange(newQueue, oldQueue) {
        const queueLength = newQueue?.length || 0;
        const oldLength = oldQueue?.length || 0;
        
        if (queueLength !== oldLength) {
            this.eventBus.emit('action:queue-changed', {
                newLength: queueLength,
                oldLength,
                actions: newQueue
            });
        }
    }
    
    /**
     * Update available actions based on current state
     */
    updateAvailableActions(sequence) {
        const availableActions = [];
        
        if (sequence && sequence.length > 0) {
            availableActions.push('copy', 'delete');
        }
        
        const clipboardData = this.context.getState('actions:clipboard');
        if (clipboardData) {
            availableActions.push('paste');
        }
        
        this.context.setState('actions:available', availableActions, {
            source: 'ModernActionManager',
            sequenceLength: sequence?.length || 0
        });
    }
    
    /**
     * Get current action status
     */
    getActionStatus() {
        return {
            queue: this.context.getState('actions:queue') || [],
            clipboard: this.context.getState('actions:clipboard'),
            cursorPosition: this.context.getState('actions:cursorPosition'),
            isExecuting: this.context.getState('actions:isExecuting'),
            available: this.context.getState('actions:available') || []
        };
    }
    
    /**
     * Legacy API compatibility methods
     */
    
    // Legacy: setCursorPosition
    async setCursorPosition(position) {
        const result = await this.context.execute('action:setCursorPosition', { position });
        return result.success ? result.data : null;
    }
    
    // Legacy: handlePasteSequence
    async handlePasteSequence(options = {}) {
        const result = await this.context.execute('action:paste', options);
        return result.success ? result.data : null;
    }
    
    // Legacy: handleDeleteSequence
    async handleDeleteSequence(options = {}) {
        const result = await this.context.execute('action:delete', options);
        return result.success ? result.data : null;
    }
    
    /**
     * Get performance metrics
     */
    getMetrics() {
        const commandRegistry = this.context.getService('commandRegistry');
        const actionCommands = ['action:setCursorPosition', 'action:paste', 'action:delete', 'action:copy', 'action:executeAll'];
        
        const commandStats = {};
        for (const commandName of actionCommands) {
            const command = commandRegistry.get(commandName);
            if (command) {
                commandStats[commandName] = command.getStats();
            }
        }
        
        return {
            commands: commandStats,
            cache: {
                size: this.actionCache.size,
                hits: 0, // Would be tracked in real implementation
                misses: 0
            },
            state: this.getActionStatus()
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        // Clear caches
        this.actionCache.clear();
        
        // Clear state
        this.context.setState('actions:queue', [], { source: 'destroy' });
        this.context.setState('actions:clipboard', null, { source: 'destroy' });
        
        console.log('🧹 [ModernActionManager] Resources cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernActionManager;
} else if (typeof window !== 'undefined') {
    window.ModernActionManager = ModernActionManager;
}