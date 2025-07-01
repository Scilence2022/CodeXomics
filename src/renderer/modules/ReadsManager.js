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
    async getReadsForRegion(chromosome, start, end, settings = {}) {
        if (!this.rawReadsData && !this.isStreaming && !this.isBamMode) {
            console.warn('No SAM/BAM data loaded');
            return [];
        }

        // Use direct region query instead of expanded regions
        const regionKey = this.getRegionKey(chromosome, start, end);
        
        console.log(`🔍 [ReadsManager] Direct region query:`, {
            requestedRegion: `${start}-${end}`,
            cacheKey: regionKey
        });
        
        // Check cache first
        if (this.cache.has(regionKey)) {
            this.stats.cacheHits++;
            const cached = this.cache.get(regionKey);
            cached.lastAccessed = Date.now();
            
            console.log(`✅ [ReadsManager] Cache HIT for key: ${regionKey}`);
            console.log(`🔍 [ReadsManager] Cached reads count: ${cached.reads.length}`);
            
            return cached.reads;
        }

        console.log(`❌ [ReadsManager] Cache MISS for key: ${regionKey}`);
        this.stats.cacheMisses++;
        
        // Use appropriate loading method based on mode
        let reads;
        if (this.isBamMode && this.bamReader) {
            // Use BAM reader for binary BAM files - pass sampling settings to BAM loading
            reads = await this.loadReadsForRegionBAM(chromosome, start, end, settings);
        } else if (this.isStreaming) {
            // Use streaming mode for very large files
            reads = await this.loadReadsForRegionStream(chromosome, start, end, settings);
        } else {
            // Use in-memory mode for normal files
            reads = await this.loadReadsForRegion(chromosome, start, end, settings);
        }
        
        // Apply sampling if enabled and threshold is exceeded
        const sampledReads = this.applySampling(reads, settings);
        
        // Cache the sampled results (to avoid caching huge datasets)
        this.cacheRegion(regionKey, sampledReads);
        
        console.log(`🔍 [ReadsManager] Final result: ${sampledReads.length} reads for region ${start}-${end}${sampledReads.length !== reads.length ? ` (sampled from ${reads.length})` : ''}`);
        
        return sampledReads;
    }

    /**
     * Generate a cache key for a region
     */
    getRegionKey(chromosome, start, end) {
        // Use exact region boundaries for direct querying
        return `${chromosome}:${start}-${end}`;
    }

    /**
     * Apply read sampling based on settings
     */
    applySampling(reads, settings = {}) {
        // Check if sampling is enabled and threshold is exceeded
        if (!settings.enableSampling || reads.length <= (settings.samplingThreshold || 10000)) {
            return reads;
        }

        const threshold = settings.samplingThreshold || 10000;
        const mode = settings.samplingMode || 'percentage';
        const percentage = settings.samplingPercentage || 20;
        const fixedCount = settings.samplingCount || 5000;

        console.log(`🎲 [ReadsManager] Sampling activated: ${reads.length} reads exceed threshold of ${threshold}`);

        let targetCount;
        if (mode === 'percentage') {
            targetCount = Math.max(1, Math.floor(reads.length * percentage / 100));
        } else {
            targetCount = Math.min(fixedCount, reads.length);
        }

        // Ensure we don't sample more than available
        targetCount = Math.min(targetCount, reads.length);

        console.log(`🎲 [ReadsManager] Sampling ${targetCount} reads from ${reads.length} (mode: ${mode}${mode === 'percentage' ? `, ${percentage}%` : `, max: ${fixedCount}`})`);

        // Analyze position distribution before sampling
        const positions = reads.map(read => read.start).sort((a, b) => a - b);
        const minPos = positions[0];
        const maxPos = positions[positions.length - 1];
        console.log(`🎲 [ReadsManager] Original position range: ${minPos}-${maxPos}`);

        // Use reservoir sampling algorithm for better distribution
        // This ensures each read has equal probability of being selected regardless of position
        const sampledReads = [];
        
        for (let i = 0; i < reads.length; i++) {
            if (sampledReads.length < targetCount) {
                // Fill the reservoir
                sampledReads.push(reads[i]);
            } else {
                // Randomly replace elements in the reservoir
                const j = Math.floor(Math.random() * (i + 1));
                if (j < targetCount) {
                    sampledReads[j] = reads[i];
                }
            }
        }

        // Verify position distribution after sampling
        if (sampledReads.length > 0) {
            const sampledPositions = sampledReads.map(read => read.start).sort((a, b) => a - b);
            const sampledMinPos = sampledPositions[0];
            const sampledMaxPos = sampledPositions[sampledPositions.length - 1];
            console.log(`🎲 [ReadsManager] Sampled position range: ${sampledMinPos}-${sampledMaxPos}`);
            
            // Check distribution quality
            const originalSpan = maxPos - minPos;
            const sampledSpan = sampledMaxPos - sampledMinPos;
            const coverageRatio = sampledSpan / originalSpan;
            console.log(`🎲 [ReadsManager] Position coverage ratio: ${(coverageRatio * 100).toFixed(1)}%`);
            
            if (coverageRatio < 0.8) {
                console.warn(`⚠️ [ReadsManager] Low position coverage after sampling (${(coverageRatio * 100).toFixed(1)}%)`);
                console.warn(`   This may indicate non-uniform read distribution in the original data`);
            }
        }
        
        // Store sampling information for statistics
        sampledReads._samplingInfo = {
            originalCount: reads.length,
            sampledCount: targetCount,
            mode: mode,
            threshold: threshold,
            percentage: mode === 'percentage' ? percentage : null,
            fixedCount: mode === 'fixed' ? fixedCount : null,
            positionCoverage: sampledReads.length > 0 ? (sampledMaxPos - sampledMinPos) / (maxPos - minPos) : 0
        };

        console.log(`✅ [ReadsManager] Reservoir sampling complete: ${sampledReads.length} reads selected`);
        
        return sampledReads;
    }

    /**
     * Load reads for a specific region from the raw SAM data
     */
    async loadReadsForRegion(chromosome, start, end, settings = {}) {
        // Query the exact target region without expansion
        console.log(`🎯 [ReadsManager] Direct SAM region query - no expansion`);
        
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
            
            // Skip unmapped reads
            if (rname === '*' || pos === '0') continue;
            
            // Check chromosome matching - only skip if ignoreChromosome is false and chromosome doesn't match
            if (!settings.ignoreChromosome && rname !== chromosome) continue;
            
            const readStart = parseInt(pos); // Keep 1-based coordinates for consistency
            const readEnd = readStart + seq.length - 1;
            
            // Check if read overlaps with our target region (direct overlap check)
            if (readEnd >= start && readStart <= end) {
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
        console.log(`✅ [ReadsManager] Loaded ${reads.length} reads for target region ${chromosome}:${start}-${end} (ignoreChromosome: ${settings.ignoreChromosome})`);
        
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
    async loadReadsForRegionBAM(chromosome, start, end, settings = {}) {
        console.log(`🧬 [ReadsManager] === READS MANAGER BAM LOADING DEBUG START ===`);
        console.log(`🧬 [ReadsManager] loadReadsForRegionBAM called with:`, {
            chromosome, start, end,
            currentFile: this.currentFile,
            isBamMode: this.isBamMode,
            ignoreChromosome: settings.ignoreChromosome,
            hasIndex: this.bamReader?.isIndexed(),
            bamReaderInitialized: this.bamReader?.isInitialized,
            settings: settings
        });
        
        if (!this.bamReader) {
            console.error('❌ [ReadsManager] No BAM reader available');
            throw new Error('No BAM reader available');
        }

        try {
            // Query the exact target region without expansion
            console.log(`🎯 [ReadsManager] Direct region query - no expansion`);
            
            // Convert to 0-based coordinates for BAM reader (BAM uses 0-based, GenomeExplorer uses 1-based)
            const bamSearchStart = Math.max(0, start - 1);
            const bamSearchEnd = end - 1;
            
            console.log(`🔍 [ReadsManager] Coordinate conversion:`, {
                originalRange: `${start}-${end}`,
                bamCoordinates: `${bamSearchStart}-${bamSearchEnd + 1}`,
                noExpansion: true
            });
            
            this.genomeBrowser.updateStatus(`Loading BAM reads for region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}...`);
            
            // Get reads using BAM reader with settings - use 0-based coordinates
            console.log(`🔍 [ReadsManager] Calling bamReader.getRecordsForRange with:`, {
                chromosome,
                start: bamSearchStart,
                end: bamSearchEnd + 1,
                settings
            });
            
            const reads = await this.bamReader.getRecordsForRange(chromosome, bamSearchStart, bamSearchEnd + 1, settings);
            
            console.log(`✅ [ReadsManager] Retrieved ${reads.length.toLocaleString()} reads from BAM file`);
            console.log(`🔍 [ReadsManager] Settings used: ignoreChromosome=${settings.ignoreChromosome}`);
            
            // Log sample reads for debugging
            if (reads.length > 0) {
                console.log(`🔍 [ReadsManager] Sample reads (first 3):`, 
                    reads.slice(0, 3).map(read => ({
                        id: read.id,
                        chromosome: read.chromosome,
                        position: `${read.start}-${read.end}`,
                        strand: read.strand,
                        mappingQuality: read.mappingQuality,
                        flags: read.flags
                    }))
                );
                
                // Check if reads are distributed across the region
                const positions = reads.map(read => read.start).sort((a, b) => a - b);
                const minPos = positions[0];
                const maxPos = positions[positions.length - 1];
                console.log(`🎯 [ReadsManager] Reads position distribution: ${minPos}-${maxPos} (target: ${start}-${end})`);
                
                // Sample positions to check distribution
                if (reads.length > 10) {
                    const sampleIndices = [0, Math.floor(reads.length * 0.25), Math.floor(reads.length * 0.5), Math.floor(reads.length * 0.75), reads.length - 1];
                    const samplePositions = sampleIndices.map(i => positions[i]);
                    console.log(`🎯 [ReadsManager] Sample positions (0%, 25%, 50%, 75%, 100%):`, samplePositions);
                }
            } else {
                console.warn(`⚠️ [ReadsManager] NO READS FOUND! This could be due to:`);
                console.warn(`   1. No reads in the specified region`);
                console.warn(`   2. Chromosome name mismatch (try ignoreChromosome=true)`);
                console.warn(`   3. Coordinate system mismatch`);
                console.warn(`   4. BAM file index issues`);
                console.warn(`   5. Mapping quality filtering`);
                
                // Get BAM reader stats for debugging
                const bamStats = this.bamReader.getStats();
                console.warn(`🔍 [ReadsManager] BAM file stats:`, {
                    totalReads: bamStats.totalReads,
                    hasIndex: bamStats.hasIndex,
                    indexType: bamStats.indexType,
                    referencesCount: bamStats.references
                });
                
                // Get available chromosomes
                const references = this.bamReader.getReferences();
                console.warn(`🔍 [ReadsManager] Available chromosomes:`, 
                    references.slice(0, 10).map(ref => ref.name)
                );
            }
            
            this.stats.loadedRegions++;
            console.log(`🧬 [ReadsManager] === READS MANAGER BAM LOADING DEBUG END ===`);
            return reads;
            
        } catch (error) {
            console.error('❌ [ReadsManager] Error loading BAM reads:', error);
            console.error('❌ [ReadsManager] Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Load reads for a specific region using file streaming (for very large files)
     */
    async loadReadsForRegionStream(chromosome, start, end, settings = {}) {
        console.log(`[ReadsManager] loadReadsForRegionStream called with:`, {
            chromosome, start, end,
            currentFile: this.currentFile,
            isStreaming: this.isStreaming,
            ignoreChromosome: settings.ignoreChromosome
        });
        
        if (!this.currentFile) {
            console.error('[ReadsManager] No currentFile set for streaming');
            throw new Error('No SAM file loaded for streaming');
        }

        // Query the exact target region without expansion
        console.log(`🎯 [ReadsManager] Direct streaming region query - no expansion`);
        
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
                    
                    // Skip unmapped reads
                    if (rname === '*' || pos === '0') continue;
                    
                    // Check chromosome matching - only skip if ignoreChromosome is false and chromosome doesn't match
                    if (!settings.ignoreChromosome && rname !== chromosome) continue;
                    
                    const readStart = parseInt(pos); // Keep 1-based coordinates for consistency
                    const readEnd = readStart + seq.length - 1;
                    
                    // Check if read overlaps with our target region (direct overlap check)
                    if (readEnd >= start && readStart <= end) {
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
                
                console.log(`✅ [ReadsManager] Loaded ${reads.length} reads for target region ${chromosome}:${start}-${end} from streaming (ignoreChromosome: ${settings.ignoreChromosome})`);
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