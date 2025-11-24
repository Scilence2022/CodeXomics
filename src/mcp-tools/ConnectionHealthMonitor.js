/**
 * Connection Health Monitor
 * Monitors MCP server connections, client health, and system status
 */

const EventEmitter = require('events');

class ConnectionHealthMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            pingInterval: config.pingInterval || 30000, // 30 seconds
            timeoutThreshold: config.timeoutThreshold || 60000, // 1 minute
            healthCheckInterval: config.healthCheckInterval || 10000, // 10 seconds
            maxMissedPings: config.maxMissedPings || 3,
            ...config
        };
        
        // Track all connections
        this.connections = new Map();
        
        // Health check intervals
        this.intervals = {
            ping: null,
            healthCheck: null
        };
        
        // System metrics
        this.metrics = {
            startTime: Date.now(),
            totalConnections: 0,
            totalDisconnections: 0,
            totalToolExecutions: 0,
            totalErrors: 0,
            averageResponseTime: 0
        };
        
        // Start monitoring
        this.startMonitoring();
    }
    
    /**
     * Register a new connection
     */
    registerConnection(connectionId, connectionInfo) {
        const connection = {
            id: connectionId,
            type: connectionInfo.type || 'unknown', // 'sse', 'websocket', 'http'
            connectedAt: Date.now(),
            lastActivity: Date.now(),
            lastPing: null,
            missedPings: 0,
            isHealthy: true,
            metadata: {
                ip: connectionInfo.ip,
                userAgent: connectionInfo.userAgent,
                sessionId: connectionInfo.sessionId,
                ...connectionInfo.metadata
            },
            stats: {
                toolExecutions: 0,
                errors: 0,
                totalResponseTime: 0
            }
        };
        
        this.connections.set(connectionId, connection);
        this.metrics.totalConnections++;
        
        this.emit('connectionRegistered', connection);
        console.log(`📡 Connection registered: ${connectionId} (${connection.type})`);
        
        return connection;
    }
    
    /**
     * Unregister a connection
     */
    unregisterConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            this.connections.delete(connectionId);
            this.metrics.totalDisconnections++;
            
            this.emit('connectionUnregistered', connection);
            console.log(`🔌 Connection unregistered: ${connectionId}`);
            
            return connection;
        }
        
        return null;
    }
    
    /**
     * Update connection activity
     */
    updateActivity(connectionId) {
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            connection.lastActivity = Date.now();
            connection.missedPings = 0;
            
            if (!connection.isHealthy) {
                connection.isHealthy = true;
                this.emit('connectionRecovered', connection);
            }
        }
    }
    
    /**
     * Record ping response
     */
    recordPing(connectionId) {
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            connection.lastPing = Date.now();
            connection.missedPings = 0;
            this.updateActivity(connectionId);
        }
    }
    
    /**
     * Record missed ping
     */
    recordMissedPing(connectionId) {
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            connection.missedPings++;
            
            if (connection.missedPings >= this.config.maxMissedPings) {
                connection.isHealthy = false;
                this.emit('connectionUnhealthy', connection);
                console.warn(`⚠️  Connection unhealthy: ${connectionId} (${connection.missedPings} missed pings)`);
            }
        }
    }
    
    /**
     * Record tool execution
     */
    recordToolExecution(connectionId, toolName, responseTime, success = true) {
        const connection = this.connections.get(connectionId);
        
        if (connection) {
            connection.stats.toolExecutions++;
            connection.stats.totalResponseTime += responseTime;
            
            if (!success) {
                connection.stats.errors++;
                this.metrics.totalErrors++;
            }
            
            this.updateActivity(connectionId);
        }
        
        this.metrics.totalToolExecutions++;
        
        // Update average response time
        const totalTime = Array.from(this.connections.values())
            .reduce((sum, c) => sum + c.stats.totalResponseTime, 0);
        const totalExecs = Array.from(this.connections.values())
            .reduce((sum, c) => sum + c.stats.toolExecutions, 0);
        
        this.metrics.averageResponseTime = totalExecs > 0 ? totalTime / totalExecs : 0;
    }
    
    /**
     * Start monitoring
     */
    startMonitoring() {
        // Periodic ping to check connection health
        this.intervals.ping = setInterval(() => {
            this.performPingCheck();
        }, this.config.pingInterval);
        
        // Periodic health check
        this.intervals.healthCheck = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        console.log('🏥 Connection health monitoring started');
    }
    
    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.intervals.ping) {
            clearInterval(this.intervals.ping);
        }
        
        if (this.intervals.healthCheck) {
            clearInterval(this.intervals.healthCheck);
        }
        
        console.log('🛑 Connection health monitoring stopped');
    }
    
    /**
     * Perform ping check on all connections
     */
    performPingCheck() {
        const now = Date.now();
        
        for (const [connectionId, connection] of this.connections.entries()) {
            const timeSinceLastPing = connection.lastPing ? now - connection.lastPing : Infinity;
            
            // Check if we should ping this connection
            if (timeSinceLastPing > this.config.pingInterval) {
                this.emit('pingRequired', { connectionId, connection });
            }
        }
    }
    
    /**
     * Perform comprehensive health check
     */
    performHealthCheck() {
        const now = Date.now();
        const unhealthy = [];
        const stale = [];
        
        for (const [connectionId, connection] of this.connections.entries()) {
            const timeSinceActivity = now - connection.lastActivity;
            
            // Check for stale connections
            if (timeSinceActivity > this.config.timeoutThreshold) {
                stale.push(connectionId);
                
                if (connection.isHealthy) {
                    connection.isHealthy = false;
                    this.emit('connectionStale', connection);
                }
            }
            
            // Track unhealthy connections
            if (!connection.isHealthy) {
                unhealthy.push(connectionId);
            }
        }
        
        // Emit health check results
        this.emit('healthCheckComplete', {
            total: this.connections.size,
            healthy: this.connections.size - unhealthy.length,
            unhealthy: unhealthy.length,
            stale: stale.length
        });
        
        // Auto-cleanup stale connections after extended timeout
        const extendedTimeout = this.config.timeoutThreshold * 2;
        for (const connectionId of stale) {
            const connection = this.connections.get(connectionId);
            if (connection && (now - connection.lastActivity) > extendedTimeout) {
                console.log(`🧹 Auto-removing stale connection: ${connectionId}`);
                this.unregisterConnection(connectionId);
            }
        }
    }
    
    /**
     * Get connection health status
     */
    getConnectionHealth(connectionId) {
        const connection = this.connections.get(connectionId);
        
        if (!connection) {
            return {
                exists: false,
                error: 'Connection not found'
            };
        }
        
        const now = Date.now();
        const timeSinceActivity = now - connection.lastActivity;
        const timeSinceConnection = now - connection.connectedAt;
        
        return {
            exists: true,
            isHealthy: connection.isHealthy,
            connectionId,
            type: connection.type,
            uptime: timeSinceConnection,
            lastActivityAgo: timeSinceActivity,
            missedPings: connection.missedPings,
            stats: {
                ...connection.stats,
                averageResponseTime: connection.stats.toolExecutions > 0 
                    ? connection.stats.totalResponseTime / connection.stats.toolExecutions 
                    : 0,
                errorRate: connection.stats.toolExecutions > 0
                    ? connection.stats.errors / connection.stats.toolExecutions
                    : 0
            }
        };
    }
    
    /**
     * Get overall system health
     */
    getSystemHealth() {
        const now = Date.now();
        const connections = Array.from(this.connections.values());
        
        const healthy = connections.filter(c => c.isHealthy).length;
        const unhealthy = connections.length - healthy;
        
        return {
            status: unhealthy === 0 ? 'healthy' : (healthy > 0 ? 'degraded' : 'unhealthy'),
            uptime: now - this.metrics.startTime,
            connections: {
                total: connections.length,
                healthy,
                unhealthy,
                byType: this.getConnectionsByType()
            },
            metrics: {
                ...this.metrics,
                averageResponseTime: Math.round(this.metrics.averageResponseTime),
                errorRate: this.metrics.totalToolExecutions > 0
                    ? (this.metrics.totalErrors / this.metrics.totalToolExecutions * 100).toFixed(2) + '%'
                    : '0%'
            },
            timestamp: now
        };
    }
    
    /**
     * Get connections grouped by type
     */
    getConnectionsByType() {
        const byType = {};
        
        for (const connection of this.connections.values()) {
            const type = connection.type || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
        }
        
        return byType;
    }
    
    /**
     * Get all connections
     */
    getAllConnections() {
        return Array.from(this.connections.values()).map(c => ({
            id: c.id,
            type: c.type,
            isHealthy: c.isHealthy,
            connectedAt: c.connectedAt,
            lastActivity: c.lastActivity,
            metadata: c.metadata
        }));
    }
    
    /**
     * Cleanup and destroy
     */
    destroy() {
        this.stopMonitoring();
        this.connections.clear();
        this.removeAllListeners();
    }
}

module.exports = ConnectionHealthMonitor;
