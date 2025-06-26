/**
 * PluginResourceManager - Intelligent resource management for plugin system
 * Monitors memory, CPU usage, and manages resource allocation for plugin execution
 */
class PluginResourceManager {
    constructor(options = {}) {
        this.options = {
            memoryThreshold: 0.8,
            cpuThreshold: 0.9,
            maxConcurrentExecutions: 5,
            resourceCheckInterval: 5000,
            cleanupInterval: 30000,
            ...options
        };
        
        this.resourceMetrics = {
            memory: { current: 0, peak: 0, average: 0 },
            cpu: { current: 0, peak: 0, average: 0 },
            executions: { active: 0, total: 0, failed: 0 }
        };
        
        this.activeExecutions = new Map();
        this.executionQueue = [];
        this.usageHistory = [];
        this.maxHistorySize = 100;
        
        this.startMonitoring();
        console.log('PluginResourceManager initialized');
    }

    startMonitoring() {
        this.monitoringTimer = setInterval(() => {
            this.updateResourceMetrics();
        }, this.options.resourceCheckInterval);
        
        this.cleanupTimer = setInterval(() => {
            this.performCleanup();
        }, this.options.cleanupInterval);
    }

    async checkResourceAvailability() {
        await this.updateResourceMetrics();
        
        const memory = this.resourceMetrics.memory.current;
        const cpu = this.resourceMetrics.cpu.current;
        const activeExecs = this.resourceMetrics.executions.active;
        
        const canExecute = 
            memory < this.options.memoryThreshold &&
            cpu < this.options.cpuThreshold &&
            activeExecs < this.options.maxConcurrentExecutions;
        
        const reason = !canExecute ? 
            (memory >= this.options.memoryThreshold ? 'memory_exhausted' :
             cpu >= this.options.cpuThreshold ? 'cpu_overload' :
             'max_concurrent_reached') : null;
        
        return { canExecute, memory, cpu, activeExecutions: activeExecs, reason };
    }

    async requestExecution(pluginId, functionName, priority = 'normal') {
        const resourceCheck = await this.checkResourceAvailability();
        const executionId = `${pluginId}.${functionName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        if (resourceCheck.canExecute) {
            const execution = {
                id: executionId,
                pluginId,
                functionName,
                priority,
                startTime: Date.now(),
                status: 'running'
            };
            
            this.activeExecutions.set(executionId, execution);
            this.resourceMetrics.executions.active++;
            this.resourceMetrics.executions.total++;
            
            return { granted: true, executionId, waitTime: 0 };
        } else {
            const queueEntry = {
                id: executionId,
                pluginId,
                functionName,
                priority,
                queuedAt: Date.now()
            };
            
            this.addToQueue(queueEntry);
            return { granted: false, executionId, reason: resourceCheck.reason };
        }
    }

    releaseExecution(executionId, result = 'success') {
        const execution = this.activeExecutions.get(executionId);
        if (!execution) return;
        
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        execution.result = result;
        
        this.activeExecutions.delete(executionId);
        this.resourceMetrics.executions.active--;
        
        if (result === 'error') {
            this.resourceMetrics.executions.failed++;
        }
        
        this.processQueue();
    }

    addToQueue(queueEntry) {
        const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
        const entryPriority = priorityOrder[queueEntry.priority] || 2;
        
        let insertIndex = this.executionQueue.length;
        for (let i = 0; i < this.executionQueue.length; i++) {
            const existingPriority = priorityOrder[this.executionQueue[i].priority] || 2;
            if (entryPriority > existingPriority) {
                insertIndex = i;
                break;
            }
        }
        
        this.executionQueue.splice(insertIndex, 0, queueEntry);
    }

    async processQueue() {
        while (this.executionQueue.length > 0) {
            const resourceCheck = await this.checkResourceAvailability();
            if (!resourceCheck.canExecute) break;
            
            const queueEntry = this.executionQueue.shift();
            const execution = {
                id: queueEntry.id,
                pluginId: queueEntry.pluginId,
                functionName: queueEntry.functionName,
                priority: queueEntry.priority,
                startTime: Date.now(),
                waitTime: Date.now() - queueEntry.queuedAt,
                status: 'running'
            };
            
            this.activeExecutions.set(queueEntry.id, execution);
            this.resourceMetrics.executions.active++;
            this.resourceMetrics.executions.total++;
        }
    }

    async updateResourceMetrics() {
        try {
            let memoryUsage = 0;
            if (typeof performance !== 'undefined' && performance.memory) {
                const memory = performance.memory;
                memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
            }
            
            let cpuUsage = 0;
            const activeExecs = this.activeExecutions.size;
            if (activeExecs > 0) {
                cpuUsage = Math.min(activeExecs / this.options.maxConcurrentExecutions, 1);
            }
            
            this.resourceMetrics.memory.current = memoryUsage;
            this.resourceMetrics.memory.peak = Math.max(this.resourceMetrics.memory.peak, memoryUsage);
            
            this.resourceMetrics.cpu.current = cpuUsage;
            this.resourceMetrics.cpu.peak = Math.max(this.resourceMetrics.cpu.peak, cpuUsage);
            
            this.usageHistory.push({
                timestamp: Date.now(),
                memory: memoryUsage,
                cpu: cpuUsage,
                activeExecutions: activeExecs
            });
            
            if (this.usageHistory.length > this.maxHistorySize) {
                this.usageHistory.shift();
            }
            
            this.updateAverages();
        } catch (error) {
            console.error('Error updating resource metrics:', error);
        }
    }

    updateAverages() {
        if (this.usageHistory.length === 0) return;
        
        const memorySum = this.usageHistory.reduce((sum, entry) => sum + entry.memory, 0);
        const cpuSum = this.usageHistory.reduce((sum, entry) => sum + entry.cpu, 0);
        
        this.resourceMetrics.memory.average = memorySum / this.usageHistory.length;
        this.resourceMetrics.cpu.average = cpuSum / this.usageHistory.length;
    }

    async performCleanup() {
        const now = Date.now();
        const maxExecutionTime = 300000; // 5 minutes
        
        for (const [executionId, execution] of this.activeExecutions) {
            if (now - execution.startTime > maxExecutionTime) {
                console.warn(`Terminating hung execution: ${executionId}`);
                this.releaseExecution(executionId, 'timeout');
            }
        }
        
        if (typeof global !== 'undefined' && global.gc) {
            global.gc();
        }
        
        const maxQueueAge = 600000; // 10 minutes
        this.executionQueue = this.executionQueue.filter(entry => 
            now - entry.queuedAt < maxQueueAge
        );
    }

    getResourceStats() {
        return {
            metrics: { ...this.resourceMetrics },
            thresholds: {
                memory: this.options.memoryThreshold,
                cpu: this.options.cpuThreshold,
                maxConcurrent: this.options.maxConcurrentExecutions
            },
            current: {
                activeExecutions: this.activeExecutions.size,
                queueLength: this.executionQueue.length
            }
        };
    }

    destroy() {
        if (this.monitoringTimer) clearInterval(this.monitoringTimer);
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        
        this.activeExecutions.clear();
        this.executionQueue.length = 0;
        this.usageHistory.length = 0;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginResourceManager;
} else if (typeof window !== 'undefined') {
    window.PluginResourceManager = PluginResourceManager;
} 