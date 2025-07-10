/**
 * Result - Functional error handling pattern
 * Provides type-safe error handling and composable result operations
 */
class Result {
    constructor(success, data, error = null, metadata = {}) {
        this.success = success;
        this.data = data;
        this.error = error;
        this.metadata = {
            timestamp: Date.now(),
            id: crypto.randomUUID(),
            ...metadata
        };
        
        // Freeze the result to prevent mutation
        Object.freeze(this);
    }
    
    /**
     * Create successful result
     */
    static success(data, metadata = {}) {
        return new Result(true, data, null, metadata);
    }
    
    /**
     * Create error result
     */
    static error(error, metadata = {}) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        return new Result(false, null, errorObj, metadata);
    }
    
    /**
     * Create result from promise
     */
    static async fromPromise(promise, metadata = {}) {
        try {
            const data = await promise;
            return Result.success(data, metadata);
        } catch (error) {
            return Result.error(error, metadata);
        }
    }
    
    /**
     * Create result from function execution
     */
    static fromFunction(fn, metadata = {}) {
        try {
            const data = fn();
            return Result.success(data, metadata);
        } catch (error) {
            return Result.error(error, metadata);
        }
    }
    
    /**
     * Create result from async function execution
     */
    static async fromAsyncFunction(fn, metadata = {}) {
        try {
            const data = await fn();
            return Result.success(data, metadata);
        } catch (error) {
            return Result.error(error, metadata);
        }
    }
    
    /**
     * Combine multiple results
     */
    static combine(results, metadata = {}) {
        const errors = [];
        const data = [];
        
        for (const result of results) {
            if (result.success) {
                data.push(result.data);
            } else {
                errors.push(result.error);
            }
        }
        
        if (errors.length > 0) {
            const combinedError = new Error(`Combined errors: ${errors.map(e => e.message).join(', ')}`);
            combinedError.errors = errors;
            return Result.error(combinedError, metadata);
        }
        
        return Result.success(data, metadata);
    }
    
    /**
     * Execute all results and return first success or all errors
     */
    static async race(promises, metadata = {}) {
        const results = await Promise.allSettled(
            promises.map(p => Result.fromPromise(p))
        );
        
        // Find first successful result
        for (const settledResult of results) {
            if (settledResult.status === 'fulfilled' && settledResult.value.success) {
                return settledResult.value;
            }
        }
        
        // All failed, combine errors
        const errors = results
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value.error)
            .filter(Boolean);
            
        const combinedError = new Error(`All operations failed: ${errors.map(e => e.message).join(', ')}`);
        combinedError.errors = errors;
        return Result.error(combinedError, metadata);
    }
    
    /**
     * Transform data if successful
     */
    map(fn) {
        if (this.success) {
            try {
                const transformedData = fn(this.data);
                return Result.success(transformedData, {
                    ...this.metadata,
                    transformed: true,
                    originalData: this.data
                });
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    transformError: true,
                    originalData: this.data
                });
            }
        }
        return this;
    }
    
    /**
     * Transform data asynchronously if successful
     */
    async mapAsync(fn) {
        if (this.success) {
            try {
                const transformedData = await fn(this.data);
                return Result.success(transformedData, {
                    ...this.metadata,
                    transformedAsync: true,
                    originalData: this.data
                });
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    transformError: true,
                    originalData: this.data
                });
            }
        }
        return this;
    }
    
    /**
     * Chain operations that return Results
     */
    flatMap(fn) {
        if (this.success) {
            try {
                const result = fn(this.data);
                if (!(result instanceof Result)) {
                    throw new Error('flatMap function must return a Result');
                }
                return result;
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    flatMapError: true
                });
            }
        }
        return this;
    }
    
    /**
     * Chain async operations that return Results
     */
    async flatMapAsync(fn) {
        if (this.success) {
            try {
                const result = await fn(this.data);
                if (!(result instanceof Result)) {
                    throw new Error('flatMapAsync function must return a Result');
                }
                return result;
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    flatMapAsyncError: true
                });
            }
        }
        return this;
    }
    
    /**
     * Transform error if failed
     */
    mapError(fn) {
        if (!this.success) {
            try {
                const transformedError = fn(this.error);
                return Result.error(transformedError, {
                    ...this.metadata,
                    errorTransformed: true,
                    originalError: this.error
                });
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    errorTransformError: true,
                    originalError: this.error
                });
            }
        }
        return this;
    }
    
    /**
     * Provide alternative value if failed
     */
    recover(fn) {
        if (!this.success) {
            try {
                const recoveredData = fn(this.error);
                return Result.success(recoveredData, {
                    ...this.metadata,
                    recovered: true,
                    originalError: this.error
                });
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    recoveryError: true,
                    originalError: this.error
                });
            }
        }
        return this;
    }
    
    /**
     * Provide alternative Result if failed
     */
    recoverWith(fn) {
        if (!this.success) {
            try {
                const result = fn(this.error);
                if (!(result instanceof Result)) {
                    throw new Error('recoverWith function must return a Result');
                }
                return result;
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    recoverWithError: true,
                    originalError: this.error
                });
            }
        }
        return this;
    }
    
    /**
     * Execute side effect without changing result
     */
    tap(fn) {
        if (this.success) {
            try {
                fn(this.data);
            } catch (error) {
                console.warn('Result.tap error (ignored):', error);
            }
        }
        return this;
    }
    
    /**
     * Execute side effect on error without changing result
     */
    tapError(fn) {
        if (!this.success) {
            try {
                fn(this.error);
            } catch (error) {
                console.warn('Result.tapError error (ignored):', error);
            }
        }
        return this;
    }
    
    /**
     * Filter result based on predicate
     */
    filter(predicate, errorMessage = 'Filter condition not met') {
        if (this.success) {
            try {
                if (predicate(this.data)) {
                    return this;
                } else {
                    return Result.error(new Error(errorMessage), {
                        ...this.metadata,
                        filtered: true,
                        originalData: this.data
                    });
                }
            } catch (error) {
                return Result.error(error, {
                    ...this.metadata,
                    filterError: true
                });
            }
        }
        return this;
    }
    
    /**
     * Check if result matches condition
     */
    exists(predicate) {
        if (this.success) {
            try {
                return predicate(this.data);
            } catch (error) {
                return false;
            }
        }
        return false;
    }
    
    /**
     * Get data or throw error
     */
    unwrap() {
        if (this.success) {
            return this.data;
        }
        throw this.error;
    }
    
    /**
     * Get data or return default value
     */
    unwrapOr(defaultValue) {
        return this.success ? this.data : defaultValue;
    }
    
    /**
     * Get data or compute default value
     */
    unwrapOrElse(fn) {
        if (this.success) {
            return this.data;
        }
        try {
            return fn(this.error);
        } catch (error) {
            console.error('Error computing default value:', error);
            return undefined;
        }
    }
    
    /**
     * Convert to Promise
     */
    toPromise() {
        return this.success 
            ? Promise.resolve(this.data)
            : Promise.reject(this.error);
    }
    
    /**
     * Convert to JSON representation
     */
    toJSON() {
        return {
            success: this.success,
            data: this.data,
            error: this.error ? {
                message: this.error.message,
                name: this.error.name,
                stack: this.error.stack
            } : null,
            metadata: this.metadata
        };
    }
    
    /**
     * Create Result from JSON
     */
    static fromJSON(json) {
        const error = json.error ? new Error(json.error.message) : null;
        if (error && json.error.name) {
            error.name = json.error.name;
        }
        
        return new Result(json.success, json.data, error, json.metadata || {});
    }
    
    /**
     * Debug representation
     */
    toString() {
        if (this.success) {
            return `Result.Success(${JSON.stringify(this.data)})`;
        } else {
            return `Result.Error(${this.error.message})`;
        }
    }
    
    /**
     * Check if this is a successful result
     */
    isSuccess() {
        return this.success;
    }
    
    /**
     * Check if this is an error result
     */
    isError() {
        return !this.success;
    }
    
    /**
     * Get error or null
     */
    getError() {
        return this.error;
    }
    
    /**
     * Get data or null
     */
    getData() {
        return this.data;
    }
    
    /**
     * Get metadata
     */
    getMetadata() {
        return this.metadata;
    }
    
    /**
     * Create new result with additional metadata
     */
    withMetadata(additionalMetadata) {
        return new Result(this.success, this.data, this.error, {
            ...this.metadata,
            ...additionalMetadata
        });
    }
    
    /**
     * Retry operation with exponential backoff
     */
    static async retry(fn, options = {}) {
        const {
            maxAttempts = 3,
            baseDelay = 1000,
            maxDelay = 10000,
            backoffFactor = 2,
            retryCondition = () => true
        } = options;
        
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await fn(attempt);
                return Result.success(result, { 
                    attempt, 
                    maxAttempts,
                    retried: attempt > 1 
                });
            } catch (error) {
                lastError = error;
                
                if (!retryCondition(error, attempt)) {
                    break;
                }
                
                if (attempt < maxAttempts) {
                    const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        return Result.error(lastError, { 
            maxAttempts,
            finalAttempt: maxAttempts,
            retriesExhausted: true 
        });
    }
    
    /**
     * Execute function with timeout
     */
    static async timeout(fn, timeoutMs, metadata = {}) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(`Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        });
        
        try {
            const result = await Promise.race([fn(), timeoutPromise]);
            return Result.success(result, { ...metadata, timedOut: false });
        } catch (error) {
            return Result.error(error, { 
                ...metadata, 
                timedOut: error.message.includes('timed out'),
                timeoutMs 
            });
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Result;
} else if (typeof window !== 'undefined') {
    window.Result = Result;
}