/**
 * RPCProtocol - Remote Procedure Call protocol implementation
 * Inspired by VS Code's RPC protocol for extension communication
 * Handles communication between main process and extension host
 */
class RPCProtocol {
    constructor() {
        this.channel = null;
        this.callbacks = new Map();
        this.nextRequestId = 0;
        this.methodHandlers = new Map();
        this.eventListeners = new Map();
        
        // Performance metrics
        this.metrics = {
            totalCalls: 0,
            successfulCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        };
        
        // Request timeout management
        this.requestTimeouts = new Map();
        this.defaultTimeout = 10000; // 10s default timeout
        
        console.log('RPCProtocol initialized');
    }
    
    /**
     * Initialize communication channel
     */
    initializeChannel(channel) {
        this.channel = channel;
        this.channel.onmessage = this.handleIncomingMessage.bind(this);
        this.channel.onerror = this.handleChannelError.bind(this);
        console.log('RPC channel initialized');
    }
    
    /**
     * Register method handler
     */
    registerMethod(method, handler) {
        this.methodHandlers.set(method, handler);
        console.log(`Registered RPC method: ${method}`);
    }
    
    /**
     * Invoke remote method
     */
    async invoke(method, params = {}) {
        const requestId = this.nextRequestId++;
        const startTime = performance.now();
        
        return new Promise((resolve, reject) => {
            // Create callback entry
            this.callbacks.set(requestId, {
                resolve,
                reject,
                startTime
            });
            
            // Create request message
            const request = {
                type: 'request',
                id: requestId,
                method,
                params
            };
            
            // Send request
            this.sendMessage(request);
            
            // Set timeout
            const timeoutId = setTimeout(() => {
                this.requestTimeouts.delete(requestId);
                this.callbacks.delete(requestId);
                reject(new Error(`RPC call ${method} timed out`));
            }, this.defaultTimeout);
            
            this.requestTimeouts.set(requestId, timeoutId);
        });
    }
    
    /**
     * Send notification (one-way communication)
     */
    notify(method, params = {}) {
        const notification = {
            type: 'notification',
            method,
            params
        };
        
        this.sendMessage(notification);
    }
    
    /**
     * Send event
     */
    sendEvent(eventName, data = {}) {
        const event = {
            type: 'event',
            event: eventName,
            data
        };
        
        this.sendMessage(event);
    }
    
    /**
     * Send message through the channel
     */
    sendMessage(message) {
        try {
            const serialized = JSON.stringify(message);
            this.channel.postMessage(serialized);
            console.log(`📤 RPC message sent: ${message.type} ${message.method || message.event}`);
        } catch (error) {
            console.error('❌ Failed to send RPC message:', error);
        }
    }
    
    /**
     * Handle incoming messages
     */
    handleIncomingMessage(event) {
        try {
            const message = JSON.parse(event.data);
            console.log(`📥 RPC message received: ${message.type} ${message.method || message.event}`);
            
            switch (message.type) {
                case 'request':
                    this.handleRequest(message);
                    break;
                case 'response':
                    this.handleResponse(message);
                    break;
                case 'notification':
                    this.handleNotification(message);
                    break;
                case 'event':
                    this.handleEvent(message);
                    break;
                default:
                    console.error('❌ Unknown RPC message type:', message.type);
            }
        } catch (error) {
            console.error('❌ Failed to parse RPC message:', error);
        }
    }
    
    /**
     * Handle RPC request
     */
    async handleRequest(request) {
        try {
            const { id, method, params } = request;
            const handler = this.methodHandlers.get(method);
            
            if (!handler) {
                throw new Error(`Method not found: ${method}`);
            }
            
            // Execute handler
            const result = await handler(params);
            
            // Send response
            const response = {
                type: 'response',
                id,
                result
            };
            
            this.sendMessage(response);
        } catch (error) {
            // Send error response
            const errorResponse = {
                type: 'response',
                id: request.id,
                error: {
                    code: -32603,
                    message: error.message,
                    data: error.stack
                }
            };
            
            this.sendMessage(errorResponse);
        }
    }
    
    /**
     * Handle RPC response
     */
    handleResponse(response) {
        const { id, result, error } = response;
        const callback = this.callbacks.get(id);
        
        if (!callback) {
            return;
        }
        
        // Clear timeout
        const timeoutId = this.requestTimeouts.get(id);
        if (timeoutId) {
            clearTimeout(timeoutId);
            this.requestTimeouts.delete(id);
        }
        
        // Update metrics
        const duration = performance.now() - callback.startTime;
        this.updateMetrics(true, duration);
        
        // Process response
        if (error) {
            callback.reject(new Error(error.message));
        } else {
            callback.resolve(result);
        }
        
        this.callbacks.delete(id);
    }
    
    /**
     * Handle RPC notification
     */
    async handleNotification(notification) {
        const { method, params } = notification;
        const handler = this.methodHandlers.get(method);
        
        if (handler) {
            try {
                await handler(params);
            } catch (error) {
                console.error(`❌ Error handling notification ${method}:`, error);
            }
        }
    }
    
    /**
     * Handle RPC event
     */
    handleEvent(eventMessage) {
        const { event, data } = eventMessage;
        const listeners = this.eventListeners.get(event) || [];
        
        for (const listener of listeners) {
            try {
                listener(data);
            } catch (error) {
                console.error(`❌ Error in event listener ${event}:`, error);
            }
        }
    }
    
    /**
     * Add event listener
     */
    on(event, listener) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(listener);
    }
    
    /**
     * Remove event listener
     */
    off(event, listener) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }
    
    /**
     * Handle channel error
     */
    handleChannelError(error) {
        console.error('RPC channel error:', error);
        // Notify all pending requests of failure
        for (const [requestId, callback] of this.callbacks) {
            callback.reject(new Error('RPC channel error'));
        }
        this.callbacks.clear();
    }
    
    /**
     * Update performance metrics
     */
    updateMetrics(success, duration) {
        this.metrics.totalCalls++;
        
        if (success) {
            this.metrics.successfulCalls++;
        } else {
            this.metrics.failedCalls++;
        }
        
        // Update average response time
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalCalls - 1) + duration) / 
            this.metrics.totalCalls;
    }
    
    /**
     * Get RPC metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    
    /**
     * Dispose resources
     */
    dispose() {
        console.log('Disposing RPCProtocol...');
        
        // Clear all timeouts
        for (const timeoutId of this.requestTimeouts.values()) {
            clearTimeout(timeoutId);
        }
        
        // Notify pending requests
        for (const callback of this.callbacks.values()) {
            callback.reject(new Error('RPC protocol disposed'));
        }
        
        // Clear all maps
        this.callbacks.clear();
        this.methodHandlers.clear();
        this.eventListeners.clear();
        this.requestTimeouts.clear();
        
        // Close channel
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        
        console.log('RPCProtocol disposed');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RPCProtocol;
} else if (typeof window !== 'undefined') {
    window.RPCProtocol = RPCProtocol;
}
