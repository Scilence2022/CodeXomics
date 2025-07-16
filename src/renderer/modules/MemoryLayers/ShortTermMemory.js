/**
 * ShortTermMemory - Fast, temporary storage for recent function calls
 * Optimized for high-frequency access and immediate context
 */
class ShortTermMemory {
    constructor() {
        this.memory = new Map();
        this.accessCounts = new Map();
        this.timestamps = new Map();
        
        // Configuration
        this.maxSize = 1000;
        this.ttl = 300000; // 5 minutes
        this.cleanupInterval = 60000; // 1 minute
        
        // Statistics
        this.stats = {
            totalStored: 0,
            totalRetrieved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            evictions: 0,
            size: 0
        };
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        console.log('🧠 ShortTermMemory initialized');
    }
    
    /**
     * Initialize the memory layer
     */
    async initialize() {
        // Clear any existing data
        this.memory.clear();
        this.accessCounts.clear();
        this.timestamps.clear();
        
        // Reset statistics
        this.stats = {
            totalStored: 0,
            totalRetrieved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            evictions: 0,
            size: 0
        };
        
        console.log('✅ ShortTermMemory initialized');
    }
    
    /**
     * Store a memory entry
     */
    async store(entry) {
        const key = this.generateKey(entry.functionName, entry.parameters);
        
        // Check if we need to evict entries
        if (this.memory.size >= this.maxSize) {
            this.evictLeastUsed();
        }
        
        // Store the entry
        this.memory.set(key, entry);
        this.accessCounts.set(key, 1);
        this.timestamps.set(key, Date.now());
        
        // Update statistics
        this.stats.totalStored++;
        this.stats.size = this.memory.size;
        
        console.log(`🧠 ShortTermMemory stored: ${entry.functionName}`);
    }
    
    /**
     * Search for memory entries
     */
    async search(functionName, parameters, context = {}) {
        const results = [];
        const searchKey = this.generateKey(functionName, parameters);
        
        // Direct match
        if (this.memory.has(searchKey)) {
            const entry = this.memory.get(searchKey);
            this.updateAccess(searchKey);
            results.push(entry);
            this.stats.cacheHits++;
        } else {
            this.stats.cacheMisses++;
        }
        
        // Fuzzy search for similar entries
        const similarResults = this.fuzzySearch(functionName, parameters);
        results.push(...similarResults);
        
        // Update statistics
        this.stats.totalRetrieved += results.length;
        
        // Sort by recency and relevance
        return this.rankResults(results, functionName, parameters);
    }
    
    /**
     * Fuzzy search for similar entries
     */
    fuzzySearch(functionName, parameters) {
        const results = [];
        
        for (const [key, entry] of this.memory.entries()) {
            // Check function name similarity
            if (entry.functionName === functionName) {
                // Check parameter similarity
                const similarity = this.calculateSimilarity(entry.parameters, parameters);
                if (similarity > 0.7) { // 70% similarity threshold
                    this.updateAccess(key);
                    results.push({
                        ...entry,
                        similarity
                    });
                }
            }
        }
        
        return results;
    }
    
    /**
     * Calculate similarity between parameter sets
     */
    calculateSimilarity(params1, params2) {
        const keys1 = Object.keys(params1);
        const keys2 = Object.keys(params2);
        const commonKeys = keys1.filter(key => keys2.includes(key));
        
        if (commonKeys.length === 0) return 0;
        
        let similarity = 0;
        for (const key of commonKeys) {
            if (params1[key] === params2[key]) {
                similarity += 1;
            } else if (typeof params1[key] === 'number' && typeof params2[key] === 'number') {
                // Numeric similarity
                const diff = Math.abs(params1[key] - params2[key]);
                const max = Math.max(params1[key], params2[key]);
                if (max > 0) {
                    similarity += Math.max(0, 1 - (diff / max));
                }
            }
        }
        
        return similarity / commonKeys.length;
    }
    
    /**
     * Rank results by relevance and recency
     */
    rankResults(results, functionName, parameters) {
        return results
            .map(result => ({
                ...result,
                score: this.calculateScore(result, functionName, parameters)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5); // Return top 5 results
    }
    
    /**
     * Calculate relevance score
     */
    calculateScore(result, functionName, parameters) {
        let score = 0;
        
        // Function name match
        if (result.functionName === functionName) {
            score += 10;
        }
        
        // Parameter similarity
        if (result.similarity) {
            score += result.similarity * 5;
        }
        
        // Recency bonus
        const age = Date.now() - result.timestamp;
        const recencyBonus = Math.max(0, 1 - (age / this.ttl));
        score += recencyBonus * 3;
        
        // Access count bonus
        const accessCount = this.accessCounts.get(this.generateKey(result.functionName, result.parameters)) || 0;
        score += Math.min(accessCount, 5) * 0.5;
        
        return score;
    }
    
    /**
     * Update access count for a key
     */
    updateAccess(key) {
        const currentCount = this.accessCounts.get(key) || 0;
        this.accessCounts.set(key, currentCount + 1);
        this.timestamps.set(key, Date.now());
    }
    
    /**
     * Evict least used entries
     */
    evictLeastUsed() {
        const entries = Array.from(this.memory.entries()).map(([key, entry]) => ({
            key,
            entry,
            accessCount: this.accessCounts.get(key) || 0,
            timestamp: this.timestamps.get(key) || 0
        }));
        
        // Sort by access count and recency
        entries.sort((a, b) => {
            if (a.accessCount !== b.accessCount) {
                return a.accessCount - b.accessCount;
            }
            return a.timestamp - b.timestamp;
        });
        
        // Evict 10% of entries
        const evictCount = Math.ceil(this.maxSize * 0.1);
        for (let i = 0; i < evictCount && i < entries.length; i++) {
            const { key } = entries[i];
            this.memory.delete(key);
            this.accessCounts.delete(key);
            this.timestamps.delete(key);
            this.stats.evictions++;
        }
        
        this.stats.size = this.memory.size;
        console.log(`🧠 ShortTermMemory evicted ${evictCount} entries`);
    }
    
    /**
     * Clean up expired entries
     */
    async cleanup() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, timestamp] of this.timestamps.entries()) {
            if (now - timestamp > this.ttl) {
                expiredKeys.push(key);
            }
        }
        
        // Remove expired entries
        for (const key of expiredKeys) {
            this.memory.delete(key);
            this.accessCounts.delete(key);
            this.timestamps.delete(key);
        }
        
        this.stats.size = this.memory.size;
        
        if (expiredKeys.length > 0) {
            console.log(`🧠 ShortTermMemory cleaned up ${expiredKeys.length} expired entries`);
        }
    }
    
    /**
     * Clear all memory
     */
    async clear() {
        this.memory.clear();
        this.accessCounts.clear();
        this.timestamps.clear();
        
        this.stats = {
            totalStored: 0,
            totalRetrieved: 0,
            cacheHits: 0,
            cacheMisses: 0,
            evictions: 0,
            size: 0
        };
        
        console.log('🧠 ShortTermMemory cleared');
    }
    
    /**
     * Get memory statistics
     */
    getStats() {
        return {
            ...this.stats,
            maxSize: this.maxSize,
            ttl: this.ttl,
            hitRate: this.stats.totalRetrieved > 0 ? 
                this.stats.cacheHits / this.stats.totalRetrieved : 0
        };
    }
    
    /**
     * Generate key for memory entry
     */
    generateKey(functionName, parameters) {
        return `${functionName}:${JSON.stringify(parameters)}`;
    }
    
    /**
     * Start cleanup timer
     */
    startCleanupTimer() {
        setInterval(() => {
            this.cleanup();
        }, this.cleanupInterval);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShortTermMemory;
} 