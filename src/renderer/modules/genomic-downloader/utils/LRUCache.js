/**
 * LRUCache - Least Recently Used cache implementation
 * Automatically evicts oldest entries when capacity is reached
 */
class LRUCache {
    constructor(capacity = 1000) {
        this.capacity = capacity;
        this.cache = new Map();
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {*} Cached value or undefined
     */
    get(key) {
        if (!this.cache.has(key)) {
            return undefined;
        }

        // Move to end (most recently used)
        const value = this.cache.get(key);
        this.cache.delete(key);
        this.cache.set(key, value);

        return value;
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     */
    set(key, value) {
        // If key exists, delete it first to update position
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Add new entry
        this.cache.set(key, value);

        // Evict oldest entry if capacity exceeded
        if (this.cache.size > this.capacity) {
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Check if key exists in cache
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.cache.has(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get current cache size
     * @returns {number}
     */
    get size() {
        return this.cache.size;
    }

    /**
     * Delete specific entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LRUCache;
} else {
    window.LRUCache = LRUCache;
}
