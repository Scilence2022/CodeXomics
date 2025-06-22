/**
 * ReadsManager - Dynamic loading and caching system for NGS reads
 * Only loads reads for the current viewing region and manages memory efficiently
 */

class ReadsManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.rawReadsData = null; // Store the original SAM file data
        this.cache = new Map(); // Cache for loaded regions
        this.maxCacheSize = 50; // Maximum number of cached regions
        this.regionSize = 50000; // Size of each cached region (50kb)
        this.currentFile = null;
        this.isStreaming = false;
        
        // Statistics
        this.stats = {
            totalReads: 0,
            loadedRegions: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }

    /**
     * Initialize reads manager with SAM file data
     */
    async initializeWithSAMData(fileData, filePath) {
        this.rawReadsData = fileData;
        this.currentFile = filePath;
        this.cache.clear();
        this.stats.totalReads = 0;
        this.stats.loadedRegions = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        
        // Parse header to get basic information
        await this.parseHeader();
        
        // For very large files, warn about memory usage
        const fileSizeMB = (fileData.length * 2) / (1024 * 1024); // Rough estimate (UTF-16)
        if (fileSizeMB > 100) {
            console.warn(`Large SAM file in memory: ~${fileSizeMB.toFixed(1)} MB. Consider using streaming for better performance.`);
        }
        
        console.log('ReadsManager initialized with dynamic loading');
    }

    /**
     * Parse SAM file header to extract metadata
     */
    async parseHeader() {
        const lines = this.rawReadsData.split('\n');
        let headerLines = 0;
        
        for (const line of lines) {
            if (line.startsWith('@')) {
                headerLines++;
                // Could extract reference sequences, read groups, etc. here
            } else {
                break;
            }
        }
        
        // Estimate total reads (rough approximation)
        const dataLines = lines.length - headerLines;
        this.stats.totalReads = Math.max(0, dataLines - 10); // Account for empty lines
        
        console.log(`SAM file contains approximately ${this.stats.totalReads} reads`);
    }

    /**
     * Get reads for a specific region (main entry point)
     */
    async getReadsForRegion(chromosome, start, end) {
        if (!this.rawReadsData && !this.isStreaming && !this.isBamMode) {
            console.warn('No SAM/BAM data loaded');
            return [];
        }

        const regionKey = this.getRegionKey(chromosome, start, end);
        
        // Check cache first
        if (this.cache.has(regionKey)) {
            this.stats.cacheHits++;
            const cached = this.cache.get(regionKey);
            cached.lastAccessed = Date.now();
            
            // Filter to exact boundaries
            return this.filterReadsForExactRegion(cached.reads, start, end);
        }

        this.stats.cacheMisses++;
        
        // Use appropriate loading method based on mode
        let reads;
        if (this.isBamMode && this.bamReader) {
            // Use BAM reader for binary BAM files
            reads = await this.loadReadsForRegionBAM(chromosome, start, end);
        } else if (this.isStreaming) {
            // Use streaming mode for very large files
            reads = await this.loadReadsForRegionStream(chromosome, start, end);
        } else {
            // Use in-memory mode for normal files
            reads = await this.loadReadsForRegion(chromosome, start, end);
        }
        
        // Cache the results
        this.cacheRegion(regionKey, reads);
        
        // Filter to exact boundaries and return
        return this.filterReadsForExactRegion(reads, start, end);
    }

    /**
     * Generate a cache key for a region
     */
    getRegionKey(chromosome, start, end) {
        // Round to region boundaries for better cache efficiency
        const regionStart = Math.floor(start / this.regionSize) * this.regionSize;
        const regionEnd = Math.ceil(end / this.regionSize) * this.regionSize;
        return `${chromosome}:${regionStart}-${regionEnd}`;
    }

    /**
     * Load reads for a specific region from the raw SAM data
     */
    async loadReadsForRegion(chromosome, start, end) {
        // Expand the search region to include some buffer for better caching
        const bufferSize = this.regionSize;
        const searchStart = Math.max(0, start - bufferSize);
        const searchEnd = end + bufferSize;
        
        const reads = [];
        const lines = this.rawReadsData.split('\n');
        let processedLines = 0;
        const totalLines = lines.length;
        
        this.genomeBrowser.updateStatus(`Loading reads for region ${chromosome}:${start}-${end}...`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('@') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 11) continue;
            
            const [qname, flag, rname, pos, mapq, cigar, rnext, pnext, tlen, seq, qual] = fields;
            
            // Skip unmapped reads or reads not on this chromosome
            if (rname === '*' || pos === '0' || rname !== chromosome) continue;
            
            const readStart = parseInt(pos) - 1; // Convert to 0-based
            const readEnd = readStart + seq.length;
            
            // Check if read overlaps with our search region
            if (readEnd >= searchStart && readStart <= searchEnd) {
                const read = {
                    id: qname,
                    chromosome: rname,
                    start: readStart,
                    end: readEnd,
                    strand: (parseInt(flag) & 16) ? '-' : '+',
                    mappingQuality: parseInt(mapq),
                    cigar: cigar,
                    sequence: seq,
                    quality: qual
                };
                
                reads.push(read);
            }
            
            processedLines++;
            
            // Update progress and yield occasionally for large files
            if (processedLines % 10000 === 0) {
                const progress = Math.round((processedLines / totalLines) * 100);
                this.genomeBrowser.updateStatus(`Loading reads... ${progress}% (${reads.length} reads found)`);
                
                // Yield control to prevent UI blocking
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        
        this.stats.loadedRegions++;
        console.log(`Loaded ${reads.length} reads for expanded region ${chromosome}:${searchStart}-${searchEnd}`);
        
        return reads;
    }

    /**
     * Filter reads to exact region boundaries
     */
    filterReadsForExactRegion(reads, start, end) {
        return reads.filter(read => 
            read.start <= end && read.end >= start
        );
    }

    /**
     * Cache region data with LRU eviction
     */
    cacheRegion(regionKey, reads) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxCacheSize) {
            this.evictOldestCacheEntries();
        }
        
        this.cache.set(regionKey, {
            reads: reads,
            lastAccessed: Date.now(),
            size: reads.length
        });
        
        console.log(`Cached region ${regionKey} with ${reads.length} reads (cache size: ${this.cache.size})`);
    }

    /**
     * Evict oldest cache entries to make room for new ones
     */
    evictOldestCacheEntries() {
        const entriesToRemove = Math.max(1, Math.floor(this.maxCacheSize * 0.2)); // Remove 20% of cache
        const entries = Array.from(this.cache.entries());
        
        // Sort by last accessed time (oldest first)
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        for (let i = 0; i < entriesToRemove; i++) {
            if (entries[i]) {
                this.cache.delete(entries[i][0]);
                console.log(`Evicted cache entry: ${entries[i][0]}`);
            }
        }
    }

    /**
     * Preload reads for adjacent regions (optional optimization)
     */
    async preloadAdjacentRegions(chromosome, start, end) {
        const regionSize = end - start;
        const buffer = regionSize; // Preload regions of same size on both sides
        
        // Preload previous region
        const prevStart = Math.max(0, start - buffer);
        const prevEnd = start;
        
        // Preload next region  
        const nextStart = end;
        const nextEnd = end + buffer;
        
        // Load in background without blocking
        Promise.all([
            this.getReadsForRegion(chromosome, prevStart, prevEnd),
            this.getReadsForRegion(chromosome, nextStart, nextEnd)
        ]).catch(error => {
            console.warn('Error preloading adjacent regions:', error);
        });
    }

    /**
     * Clear cache for memory management
     */
    clearCache() {
        this.cache.clear();
        console.log('Reads cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        const memoryUsage = Array.from(this.cache.values())
            .reduce((total, entry) => total + entry.size, 0);
        
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            memoryUsage: memoryUsage,
            hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
        };
    }

    /**
     * Handle navigation change - clear distant cache entries
     */
    onNavigationChange(chromosome, start, end) {
        const currentRegionKey = this.getRegionKey(chromosome, start, end);
        const regionSize = end - start;
        const clearDistance = regionSize * 10; // Clear cache entries more than 10 regions away
        
        const entriesToRemove = [];
        
        for (const [key, data] of this.cache.entries()) {
            const [keyChromosome, keyRange] = key.split(':');
            
            // Different chromosome - remove immediately
            if (keyChromosome !== chromosome) {
                entriesToRemove.push(key);
                continue;
            }
            
            // Parse region coordinates
            const [keyStart] = keyRange.split('-').map(Number);
            const distance = Math.abs(keyStart - start);
            
            // Remove if too far from current position
            if (distance > clearDistance) {
                entriesToRemove.push(key);
            }
        }
        
        // Remove distant entries
        entriesToRemove.forEach(key => {
            this.cache.delete(key);
            console.log(`Removed distant cache entry: ${key}`);
        });
        
        // Optionally preload adjacent regions
        if (this.rawReadsData) {
            this.preloadAdjacentRegions(chromosome, start, end);
        }
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.rawReadsData = null;
        this.cache.clear();
        this.currentFile = null;
    }

    /**
     * Initialize reads manager with streaming SAM data
     * This method processes SAM data in chunks to avoid memory issues
     */
    async initializeWithStreamingSAM(filePath) {
        this.currentFile = filePath;
        this.cache.clear();
        this.stats.totalReads = 0;
        this.stats.loadedRegions = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        this.rawReadsData = null; // Don't store the full data in memory
        this.isStreaming = true;
        
        console.log('ReadsManager initialized with streaming mode for large SAM files');
    }

    /**
     * Initialize reads manager with BAM reader
     * This method uses the BamReader to handle binary BAM files efficiently
     */
    async initializeWithBAMReader(bamReader) {
        this.bamReader = bamReader;
        this.currentFile = bamReader.filePath;
        this.cache.clear();
        this.rawReadsData = null; // BAM data is handled by bamReader
        this.isStreaming = false; // BAM reader handles streaming internally
        this.isBamMode = true;
        
        // Get statistics from BAM reader
        const stats = bamReader.getStats();
        this.stats.totalReads = stats.totalReads;
        this.stats.loadedRegions = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        
        console.log('ReadsManager initialized with BAM reader mode');
    }

    /**
     * Process SAM data chunks during streaming
     */
    processStreamingChunk(lines) {
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('@')) continue;
            
            // Count reads for statistics
            this.stats.totalReads++;
        }
    }

    /**
     * Load reads for a specific region using BAM reader
     */
    async loadReadsForRegionBAM(chromosome, start, end) {
        console.log(`[ReadsManager] loadReadsForRegionBAM called with:`, {
            chromosome, start, end,
            currentFile: this.currentFile,
            isBamMode: this.isBamMode
        });
        
        if (!this.bamReader) {
            console.error('[ReadsManager] No BAM reader available');
            throw new Error('No BAM reader available');
        }

        try {
            // Expand the search region to include some buffer for better caching
            const bufferSize = this.regionSize;
            const searchStart = Math.max(0, start - bufferSize);
            const searchEnd = end + bufferSize;
            
            this.genomeBrowser.updateStatus(`Loading BAM reads for region ${chromosome}:${start}-${end}...`);
            
            // Get reads using BAM reader
            const reads = await this.bamReader.getReadsForRegion(chromosome, searchStart, searchEnd);
            
            console.log(`[ReadsManager] Retrieved ${reads.length} reads from BAM file`);
            
            this.stats.loadedRegions++;
            return reads;
            
        } catch (error) {
            console.error('[ReadsManager] Error loading BAM reads:', error);
            throw error;
        }
    }

    /**
     * Load reads for a specific region using file streaming (for very large files)
     */
    async loadReadsForRegionStream(chromosome, start, end) {
        console.log(`[ReadsManager] loadReadsForRegionStream called with:`, {
            chromosome, start, end,
            currentFile: this.currentFile,
            isStreaming: this.isStreaming
        });
        
        if (!this.currentFile) {
            console.error('[ReadsManager] No currentFile set for streaming');
            throw new Error('No SAM file loaded for streaming');
        }

        // For streaming mode, we need to read the file on-demand
        // This is more memory-efficient but slower for repeated access
        const bufferSize = Math.max(50000, end - start + 20000); // Buffer region
        const searchStart = Math.max(0, start - bufferSize);
        const searchEnd = end + bufferSize;
        
        const reads = [];
        
        return new Promise((resolve, reject) => {
            let processedLines = 0;
            
            const linesHandler = (event, { lines }) => {
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('@')) continue;
                    
                    const fields = trimmed.split('\t');
                    if (fields.length < 11) continue;
                    
                    const [qname, flag, rname, pos, mapq, cigar, rnext, pnext, tlen, seq, qual] = fields;
                    
                    // Skip unmapped reads or reads not on this chromosome
                    if (rname === '*' || pos === '0' || rname !== chromosome) continue;
                    
                    const readStart = parseInt(pos) - 1; // Convert to 0-based
                    const readEnd = readStart + seq.length;
                    
                    // Check if read overlaps with our search region
                    if (readEnd >= searchStart && readStart <= searchEnd) {
                        const read = {
                            id: qname,
                            chromosome: rname,
                            start: readStart,
                            end: readEnd,
                            strand: (parseInt(flag) & 16) ? '-' : '+',
                            mappingQuality: parseInt(mapq),
                            cigar: cigar,
                            sequence: seq,
                            quality: qual
                        };
                        
                        reads.push(read);
                    }
                    
                    processedLines++;
                }
            };
            
            const completeHandler = (event, { totalLines }) => {
                if (typeof ipcRenderer !== 'undefined') {
                    ipcRenderer.removeListener('file-lines-chunk', linesHandler);
                    ipcRenderer.removeListener('file-stream-complete', completeHandler);
                }
                
                console.log(`Loaded ${reads.length} reads for region ${chromosome}:${start}-${end} from streaming`);
                resolve(reads);
            };
            
            const errorHandler = (error) => {
                if (typeof ipcRenderer !== 'undefined') {
                    ipcRenderer.removeListener('file-lines-chunk', linesHandler);
                    ipcRenderer.removeListener('file-stream-complete', completeHandler);
                }
                reject(error);
            };
            
            // Check if ipcRenderer is available
            if (typeof ipcRenderer === 'undefined') {
                reject(new Error('ipcRenderer not available'));
                return;
            }
            
            // Set up event listeners
            ipcRenderer.on('file-lines-chunk', linesHandler);
            ipcRenderer.on('file-stream-complete', completeHandler);
            
            // Start streaming the file for this region
            ipcRenderer.invoke('read-file-stream', this.currentFile)
                .then(result => {
                    if (!result.success) {
                        errorHandler(new Error(result.error));
                    }
                })
                .catch(errorHandler);
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReadsManager;
} 