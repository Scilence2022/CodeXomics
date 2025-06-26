/**
 * PluginAPI - Unified plugin interface layer
 * Provides secure, cached, and permission-controlled access to application data
 * Decouples plugins from direct app dependencies
 */
class PluginAPI {
    constructor(app, permissions = {}) {
        this.app = app;
        this.permissions = {
            'genome.read': true,
            'annotations.read': true,
            'features.read': true,
            'tracks.read': true,
            'export.data': false,
            'modify.data': false,
            ...permissions
        };
        
        // Initialize cache with LRU eviction
        this.cache = new Map();
        this.cacheMaxSize = 100;
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0
        };
        
        // Performance monitoring
        this.metrics = {
            totalRequests: 0,
            averageResponseTime: 0,
            errorCount: 0
        };
        
        console.log('PluginAPI initialized with permissions:', this.permissions);
    }

    /**
     * Check if plugin has required permission
     */
    checkPermission(permission) {
        if (!this.permissions[permission]) {
            throw new PluginPermissionError(`Permission denied: ${permission}`);
        }
    }

    /**
     * Safe sequence retrieval with caching
     */
    async getSequence(chromosome, start, end, options = {}) {
        this.checkPermission('genome.read');
        
        const startTime = performance.now();
        this.metrics.totalRequests++;
        
        try {
            // Generate cache key
            const cacheKey = `seq:${chromosome}:${start}:${end}:${JSON.stringify(options)}`;
            
            // Check cache first
            if (this.cache.has(cacheKey)) {
                this.cacheStats.hits++;
                const cached = this.cache.get(cacheKey);
                // Move to end (LRU)
                this.cache.delete(cacheKey);
                this.cache.set(cacheKey, cached);
                return cached.data;
            }
            
            this.cacheStats.misses++;
            
            // Get sequence from app
            let sequence = null;
            if (this.app?.genomeBrowser?.getSequence) {
                sequence = await this.app.genomeBrowser.getSequence(chromosome, start, end);
            } else if (this.app?.getSequence) {
                sequence = await this.app.getSequence(chromosome, start, end);
            } else if (typeof window !== 'undefined' && window.genomeBrowser?.getSequence) {
                sequence = await window.genomeBrowser.getSequence(chromosome, start, end);
            }
            
            if (!sequence) {
                throw new PluginDataError(`Unable to retrieve sequence for ${chromosome}:${start}-${end}`);
            }
            
            // Cache the result
            const cacheEntry = {
                data: sequence,
                timestamp: Date.now(),
                accessCount: 1
            };
            
            this.setCacheEntry(cacheKey, cacheEntry);
            
            // Update metrics
            const responseTime = performance.now() - startTime;
            this.updateMetrics(responseTime);
            
            return sequence;
            
        } catch (error) {
            this.metrics.errorCount++;
            if (error instanceof PluginPermissionError || error instanceof PluginDataError) {
                throw error;
            }
            throw new PluginDataError(`Sequence retrieval failed: ${error.message}`);
        }
    }

    /**
     * Safe annotations retrieval
     */
    async getAnnotations(region, filters = {}) {
        this.checkPermission('annotations.read');
        
        const startTime = performance.now();
        this.metrics.totalRequests++;
        
        try {
            const cacheKey = `ann:${region.chromosome}:${region.start}:${region.end}:${JSON.stringify(filters)}`;
            
            if (this.cache.has(cacheKey)) {
                this.cacheStats.hits++;
                return this.getCacheEntry(cacheKey).data;
            }
            
            this.cacheStats.misses++;
            
            let annotations = [];
            if (this.app?.genomeBrowser?.getAnnotations) {
                annotations = await this.app.genomeBrowser.getAnnotations(region, filters);
            } else if (this.app?.getAnnotations) {
                annotations = await this.app.getAnnotations(region, filters);
            } else if (typeof window !== 'undefined' && window.genomeBrowser?.getAnnotations) {
                annotations = await window.genomeBrowser.getAnnotations(region, filters);
            }
            
            const cacheEntry = {
                data: annotations,
                timestamp: Date.now(),
                accessCount: 1
            };
            
            this.setCacheEntry(cacheKey, cacheEntry);
            
            const responseTime = performance.now() - startTime;
            this.updateMetrics(responseTime);
            
            return annotations;
            
        } catch (error) {
            this.metrics.errorCount++;
            throw new PluginDataError(`Annotations retrieval failed: ${error.message}`);
        }
    }

    /**
     * Safe features retrieval
     */
    async getFeatures(chromosome, start, end, type = null) {
        this.checkPermission('features.read');
        
        const startTime = performance.now();
        this.metrics.totalRequests++;
        
        try {
            const cacheKey = `feat:${chromosome}:${start}:${end}:${type}`;
            
            if (this.cache.has(cacheKey)) {
                this.cacheStats.hits++;
                return this.getCacheEntry(cacheKey).data;
            }
            
            this.cacheStats.misses++;
            
            let features = [];
            if (this.app?.genomeBrowser?.getFeatures) {
                features = await this.app.genomeBrowser.getFeatures(chromosome, start, end, type);
            } else if (typeof window !== 'undefined' && window.genomeBrowser?.getFeatures) {
                features = await window.genomeBrowser.getFeatures(chromosome, start, end, type);
            }
            
            const cacheEntry = {
                data: features,
                timestamp: Date.now(),
                accessCount: 1
            };
            
            this.setCacheEntry(cacheKey, cacheEntry);
            
            const responseTime = performance.now() - startTime;
            this.updateMetrics(responseTime);
            
            return features;
            
        } catch (error) {
            this.metrics.errorCount++;
            throw new PluginDataError(`Features retrieval failed: ${error.message}`);
        }
    }

    /**
     * Get current genome browser state
     */
    getCurrentState() {
        this.checkPermission('genome.read');
        
        try {
            if (this.app?.genomeBrowser?.getCurrentState) {
                return this.app.genomeBrowser.getCurrentState();
            } else if (typeof window !== 'undefined' && window.genomeBrowser) {
                return {
                    currentChromosome: window.genomeBrowser.currentChromosome,
                    currentPosition: window.genomeBrowser.currentPosition,
                    visibleTracks: window.genomeBrowser.visibleTracks || [],
                    loadedFiles: window.genomeBrowser.loadedFiles || [],
                    sequenceLength: window.genomeBrowser.sequenceLength || 0
                };
            }
            
            return null;
        } catch (error) {
            throw new PluginDataError(`State retrieval failed: ${error.message}`);
        }
    }

    /**
     * Get track data
     */
    async getTrackData(trackName, region = null) {
        this.checkPermission('tracks.read');
        
        const startTime = performance.now();
        this.metrics.totalRequests++;
        
        try {
            const cacheKey = `track:${trackName}:${region ? `${region.chromosome}:${region.start}:${region.end}` : 'full'}`;
            
            if (this.cache.has(cacheKey)) {
                this.cacheStats.hits++;
                return this.getCacheEntry(cacheKey).data;
            }
            
            this.cacheStats.misses++;
            
            let trackData = null;
            if (this.app?.genomeBrowser?.getTrackData) {
                trackData = await this.app.genomeBrowser.getTrackData(trackName, region);
            } else if (typeof window !== 'undefined' && window.genomeBrowser?.getTrackData) {
                trackData = await window.genomeBrowser.getTrackData(trackName, region);
            }
            
            if (trackData) {
                const cacheEntry = {
                    data: trackData,
                    timestamp: Date.now(),
                    accessCount: 1
                };
                
                this.setCacheEntry(cacheKey, cacheEntry);
            }
            
            const responseTime = performance.now() - startTime;
            this.updateMetrics(responseTime);
            
            return trackData;
            
        } catch (error) {
            this.metrics.errorCount++;
            throw new PluginDataError(`Track data retrieval failed: ${error.message}`);
        }
    }

    /**
     * Cache management
     */
    setCacheEntry(key, entry) {
        // Implement LRU eviction
        if (this.cache.size >= this.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.cacheStats.evictions++;
        }
        
        this.cache.set(key, entry);
    }

    getCacheEntry(key) {
        const entry = this.cache.get(key);
        entry.accessCount++;
        
        // Move to end (LRU)
        this.cache.delete(key);
        this.cache.set(key, entry);
        
        return entry;
    }

    /**
     * Clear cache
     */
    clearCache(pattern = null) {
        if (!pattern) {
            this.cache.clear();
            return;
        }
        
        const regex = new RegExp(pattern);
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Update performance metrics
     */
    updateMetrics(responseTime) {
        this.metrics.averageResponseTime = 
            (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) / 
            this.metrics.totalRequests;
    }

    /**
     * Get performance statistics
     */
    getStats() {
        return {
            cache: {
                ...this.cacheStats,
                size: this.cache.size,
                hitRate: this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses) || 0
            },
            performance: {
                ...this.metrics,
                errorRate: this.metrics.errorCount / this.metrics.totalRequests || 0
            },
            permissions: this.permissions
        };
    }

    /**
     * Update permissions
     */
    updatePermissions(newPermissions) {
        this.permissions = { ...this.permissions, ...newPermissions };
        console.log('PluginAPI permissions updated:', this.permissions);
    }
}

/**
 * Custom error classes for better error handling
 */
class PluginPermissionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PluginPermissionError';
    }
}

class PluginDataError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PluginDataError';
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginAPI, PluginPermissionError, PluginDataError };
} else if (typeof window !== 'undefined') {
    window.PluginAPI = PluginAPI;
    window.PluginPermissionError = PluginPermissionError;
    window.PluginDataError = PluginDataError;
} 