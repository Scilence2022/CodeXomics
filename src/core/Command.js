/**
 * Command - Command pattern implementation for standardized function execution
 * Provides validation, hooks, error handling, and performance tracking
 */
class Command {
    constructor(name, handler, options = {}) {
        this.name = name;
        this.handler = handler;
        this.id = crypto.randomUUID();
        this.createdAt = Date.now();
        
        // Command configuration
        this.options = {
            timeout: options.timeout || 30000, // 30 seconds default
            retries: options.retries || 0,
            validateInput: options.validateInput !== false,
            validateOutput: options.validateOutput !== false,
            logExecution: options.logExecution !== false,
            trackPerformance: options.trackPerformance !== false,
            ...options
        };
        
        // Validation schemas
        this.inputSchema = options.inputSchema || null;
        this.outputSchema = options.outputSchema || null;
        
        // Hooks
        this.hooks = {
            before: options.hooks?.before || [],
            after: options.hooks?.after || [],
            error: options.hooks?.error || [],
            finally: options.hooks?.finally || []
        };
        
        // Metadata for debugging and documentation
        this.metadata = {
            description: options.description || '',
            category: options.category || 'general',
            tags: options.tags || [],
            version: options.version || '1.0.0',
            author: options.author || 'unknown',
            ...options.metadata
        };
        
        // Execution statistics
        this.stats = {
            executionCount: 0,
            successCount: 0,
            errorCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            lastExecuted: null,
            lastError: null
        };
        
        // Validate handler
        if (typeof handler !== 'function') {
            throw new Error(`Command handler must be a function, got ${typeof handler}`);
        }
    }
    
    /**
     * Execute command with full context and error handling
     */
    async execute(context, params = {}, executionOptions = {}) {
        const executionId = crypto.randomUUID();
        const startTime = performance.now();
        
        this.stats.executionCount++;
        this.stats.lastExecuted = Date.now();
        
        if (this.options.logExecution) {
            console.log(`🚀 [Command:${this.name}] Starting execution ${executionId}`, { params, executionOptions });
        }
        
        try {
            // Input validation
            if (this.options.validateInput) {
                this.validateInput(params);
            }
            
            // Run before hooks
            await this.runHooks('before', context, params, executionOptions);
            
            // Execute with timeout and retries
            const result = await this.executeWithRetries(context, params, executionOptions);
            
            // Output validation
            if (this.options.validateOutput && this.outputSchema) {
                this.validateOutput(result);
            }
            
            // Run after hooks
            await this.runHooks('after', context, params, result, executionOptions);
            
            // Update statistics
            const executionTime = performance.now() - startTime;
            this.updateSuccessStats(executionTime);
            
            const successResult = {
                success: true,
                data: result,
                metadata: {
                    commandId: this.id,
                    commandName: this.name,
                    executionId,
                    executionTime,
                    timestamp: Date.now(),
                    attempt: executionOptions.attempt || 1,
                    ...this.metadata
                }
            };
            
            if (this.options.logExecution) {
                console.log(`✅ [Command:${this.name}] Completed successfully in ${executionTime.toFixed(2)}ms`);
            }
            
            return successResult;
            
        } catch (error) {
            // Update error statistics
            const executionTime = performance.now() - startTime;
            this.updateErrorStats(error, executionTime);
            
            // Run error hooks
            await this.runHooks('error', context, params, error, executionOptions);
            
            const errorResult = {
                success: false,
                error: {
                    message: error.message,
                    name: error.name,
                    code: error.code || 'COMMAND_ERROR',
                    details: error.details || {},
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                metadata: {
                    commandId: this.id,
                    commandName: this.name,
                    executionId,
                    executionTime,
                    timestamp: Date.now(),
                    attempt: executionOptions.attempt || 1,
                    ...this.metadata
                }
            };
            
            if (this.options.logExecution) {
                console.error(`❌ [Command:${this.name}] Failed after ${executionTime.toFixed(2)}ms:`, error.message);
            }
            
            return errorResult;
            
        } finally {
            // Run finally hooks
            try {
                await this.runHooks('finally', context, params, executionOptions);
            } catch (hookError) {
                console.error(`🚨 [Command:${this.name}] Finally hook error:`, hookError);
            }
        }
    }
    
    /**
     * Execute with retry logic
     */
    async executeWithRetries(context, params, executionOptions) {
        let lastError;
        const maxAttempts = (executionOptions.retries ?? this.options.retries) + 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Execute with timeout
                const result = await this.executeWithTimeout(
                    context, 
                    params, 
                    { ...executionOptions, attempt }
                );
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                if (attempt < maxAttempts) {
                    const delay = this.calculateRetryDelay(attempt);
                    
                    if (this.options.logExecution) {
                        console.warn(`🔄 [Command:${this.name}] Attempt ${attempt} failed, retrying in ${delay}ms:`, error.message);
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    if (this.options.logExecution) {
                        console.error(`🚨 [Command:${this.name}] All ${maxAttempts} attempts failed`);
                    }
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Execute with timeout
     */
    async executeWithTimeout(context, params, executionOptions) {
        const timeout = executionOptions.timeout || this.options.timeout;
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Command '${this.name}' timed out after ${timeout}ms`));
            }, timeout);
        });
        
        const executionPromise = this.handler(context, params, executionOptions);
        
        return Promise.race([executionPromise, timeoutPromise]);
    }
    
    /**
     * Calculate retry delay with exponential backoff
     */
    calculateRetryDelay(attempt) {
        const baseDelay = this.options.retryDelay || 1000;
        const maxDelay = this.options.maxRetryDelay || 10000;
        const backoffFactor = this.options.backoffFactor || 2;
        
        const delay = baseDelay * Math.pow(backoffFactor, attempt - 1);
        return Math.min(delay, maxDelay);
    }
    
    /**
     * Validate input parameters
     */
    validateInput(params) {
        if (!this.inputSchema) {
            return; // No validation schema defined
        }
        
        try {
            // Simple validation - in production, use a proper schema validator like Joi or Ajv
            if (typeof this.inputSchema === 'function') {
                const isValid = this.inputSchema(params);
                if (!isValid) {
                    throw new Error('Input validation failed');
                }
            } else if (typeof this.inputSchema === 'object') {
                this.validateObjectSchema(params, this.inputSchema, 'input');
            }
        } catch (error) {
            const validationError = new Error(`Input validation failed for command '${this.name}': ${error.message}`);
            validationError.code = 'VALIDATION_ERROR';
            validationError.details = { params, schema: this.inputSchema };
            throw validationError;
        }
    }
    
    /**
     * Validate output result
     */
    validateOutput(result) {
        if (!this.outputSchema) {
            return; // No validation schema defined
        }
        
        try {
            if (typeof this.outputSchema === 'function') {
                const isValid = this.outputSchema(result);
                if (!isValid) {
                    throw new Error('Output validation failed');
                }
            } else if (typeof this.outputSchema === 'object') {
                this.validateObjectSchema(result, this.outputSchema, 'output');
            }
        } catch (error) {
            const validationError = new Error(`Output validation failed for command '${this.name}': ${error.message}`);
            validationError.code = 'OUTPUT_VALIDATION_ERROR';
            validationError.details = { result, schema: this.outputSchema };
            throw validationError;
        }
    }
    
    /**
     * Simple object schema validation
     */
    validateObjectSchema(data, schema, context) {
        for (const [key, validator] of Object.entries(schema)) {
            if (validator.required && !(key in data)) {
                throw new Error(`Required field '${key}' missing in ${context}`);
            }
            
            if (key in data && validator.type) {
                const actualType = typeof data[key];
                if (actualType !== validator.type) {
                    throw new Error(`Field '${key}' should be ${validator.type}, got ${actualType}`);
                }
            }
            
            if (key in data && validator.validate) {
                const isValid = validator.validate(data[key]);
                if (!isValid) {
                    throw new Error(`Field '${key}' validation failed`);
                }
            }
        }
    }
    
    /**
     * Run hooks of specified type
     */
    async runHooks(type, context, params, ...args) {
        const hooks = this.hooks[type] || [];
        
        for (const hook of hooks) {
            try {
                if (typeof hook === 'function') {
                    await hook(context, params, ...args);
                } else if (hook && typeof hook.execute === 'function') {
                    await hook.execute(context, params, ...args);
                }
            } catch (error) {
                console.error(`🚨 [Command:${this.name}] Hook '${type}' error:`, error);
                
                // For error hooks, don't throw to avoid infinite loops
                if (type !== 'error') {
                    throw error;
                }
            }
        }
    }
    
    /**
     * Add hook
     */
    addHook(type, hook) {
        if (!this.hooks[type]) {
            this.hooks[type] = [];
        }
        
        this.hooks[type].push(hook);
        return this; // Fluent interface
    }
    
    /**
     * Remove hook
     */
    removeHook(type, hook) {
        if (this.hooks[type]) {
            const index = this.hooks[type].indexOf(hook);
            if (index > -1) {
                this.hooks[type].splice(index, 1);
            }
        }
        return this; // Fluent interface
    }
    
    /**
     * Update success statistics
     */
    updateSuccessStats(executionTime) {
        this.stats.successCount++;
        this.updateExecutionStats(executionTime);
    }
    
    /**
     * Update error statistics
     */
    updateErrorStats(error, executionTime) {
        this.stats.errorCount++;
        this.stats.lastError = {
            message: error.message,
            timestamp: Date.now()
        };
        this.updateExecutionStats(executionTime);
    }
    
    /**
     * Update execution statistics
     */
    updateExecutionStats(executionTime) {
        this.stats.totalExecutionTime += executionTime;
        this.stats.averageExecutionTime = this.stats.totalExecutionTime / this.stats.executionCount;
    }
    
    /**
     * Get command statistics
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.executionCount > 0 
                ? (this.stats.successCount / this.stats.executionCount) * 100 
                : 0,
            errorRate: this.stats.executionCount > 0 
                ? (this.stats.errorCount / this.stats.executionCount) * 100 
                : 0
        };
    }
    
    /**
     * Reset statistics
     */
    resetStats() {
        this.stats = {
            executionCount: 0,
            successCount: 0,
            errorCount: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            lastExecuted: null,
            lastError: null
        };
        return this;
    }
    
    /**
     * Clone command with new options
     */
    clone(newOptions = {}) {
        return new Command(this.name, this.handler, {
            ...this.options,
            ...newOptions,
            metadata: {
                ...this.metadata,
                ...newOptions.metadata
            },
            hooks: {
                ...this.hooks,
                ...newOptions.hooks
            }
        });
    }
    
    /**
     * Convert to JSON representation
     */
    toJSON() {
        return {
            name: this.name,
            id: this.id,
            createdAt: this.createdAt,
            options: this.options,
            metadata: this.metadata,
            stats: this.getStats(),
            hooks: Object.fromEntries(
                Object.entries(this.hooks).map(([type, hooks]) => [
                    type, 
                    hooks.map(h => h.name || 'anonymous')
                ])
            )
        };
    }
    
    /**
     * Get debug information
     */
    debug() {
        return {
            name: this.name,
            id: this.id,
            options: this.options,
            metadata: this.metadata,
            stats: this.getStats(),
            hooks: Object.fromEntries(
                Object.entries(this.hooks).map(([type, hooks]) => [
                    type, 
                    hooks.length
                ])
            ),
            inputSchema: !!this.inputSchema,
            outputSchema: !!this.outputSchema
        };
    }
    
    /**
     * String representation
     */
    toString() {
        return `Command(${this.name})[${this.id.slice(0, 8)}]`;
    }
}

/**
 * Command Registry - Manages collection of commands
 */
class CommandRegistry {
    constructor() {
        this.commands = new Map();
        this.categories = new Map();
        this.aliases = new Map();
    }
    
    /**
     * Register command
     */
    register(command) {
        if (!(command instanceof Command)) {
            throw new Error('Only Command instances can be registered');
        }
        
        if (this.commands.has(command.name)) {
            console.warn(`Command '${command.name}' already exists, overwriting`);
        }
        
        this.commands.set(command.name, command);
        
        // Add to category
        const category = command.metadata.category || 'general';
        if (!this.categories.has(category)) {
            this.categories.set(category, new Set());
        }
        this.categories.get(category).add(command.name);
        
        console.log(`📝 [CommandRegistry] Registered command: ${command.name}`);
        return this;
    }
    
    /**
     * Get command by name
     */
    get(name) {
        // Check direct name first
        if (this.commands.has(name)) {
            return this.commands.get(name);
        }
        
        // Check aliases
        const aliasedName = this.aliases.get(name);
        if (aliasedName && this.commands.has(aliasedName)) {
            return this.commands.get(aliasedName);
        }
        
        return null;
    }
    
    /**
     * Execute command by name
     */
    async execute(name, context, params = {}, options = {}) {
        const command = this.get(name);
        if (!command) {
            throw new Error(`Command '${name}' not found`);
        }
        
        return await command.execute(context, params, options);
    }
    
    /**
     * Add alias for command
     */
    alias(alias, commandName) {
        if (!this.commands.has(commandName)) {
            throw new Error(`Command '${commandName}' not found`);
        }
        
        this.aliases.set(alias, commandName);
        return this;
    }
    
    /**
     * Get all commands
     */
    getAll() {
        return Array.from(this.commands.values());
    }
    
    /**
     * Get commands by category
     */
    getByCategory(category) {
        const commandNames = this.categories.get(category);
        if (!commandNames) {
            return [];
        }
        
        return Array.from(commandNames).map(name => this.commands.get(name));
    }
    
    /**
     * Get command names
     */
    getNames() {
        return Array.from(this.commands.keys());
    }
    
    /**
     * Get categories
     */
    getCategories() {
        return Array.from(this.categories.keys());
    }
    
    /**
     * Remove command
     */
    unregister(name) {
        const command = this.commands.get(name);
        if (!command) {
            return false;
        }
        
        // Remove from commands
        this.commands.delete(name);
        
        // Remove from category
        const category = command.metadata.category || 'general';
        this.categories.get(category)?.delete(name);
        
        // Remove aliases
        for (const [alias, commandName] of this.aliases.entries()) {
            if (commandName === name) {
                this.aliases.delete(alias);
            }
        }
        
        console.log(`📝 [CommandRegistry] Unregistered command: ${name}`);
        return true;
    }
    
    /**
     * Clear all commands
     */
    clear() {
        this.commands.clear();
        this.categories.clear();
        this.aliases.clear();
        console.log('📝 [CommandRegistry] All commands cleared');
    }
    
    /**
     * Get registry statistics
     */
    getStats() {
        return {
            commandCount: this.commands.size,
            categoryCount: this.categories.size,
            aliasCount: this.aliases.size,
            categories: Object.fromEntries(
                Array.from(this.categories.entries()).map(([cat, commands]) => [
                    cat, 
                    commands.size
                ])
            )
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Command, CommandRegistry };
} else if (typeof window !== 'undefined') {
    window.Command = Command;
    window.CommandRegistry = CommandRegistry;
}