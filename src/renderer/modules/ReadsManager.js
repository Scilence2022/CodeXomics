/**
 * ReadsManager - Dynamic loading and caching system for NGS reads
 * Only loads reads for the current viewing region and manages memory efficiently
 */

class ReadsManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.rawReadsData = null; // Store the original SAM file data
    this.cache = new Map(); // Cache for loaded regions
    this.maxCacheBytes = 24 * 1024 * 1024;
    this.maxCacheSize = 50; // Maximum number of cached regions
    this.regionSize = 50000; // Size of each cached region (50kb)
    this.currentFile = null;
    this.isStreaming = false;
    this.sourceController = new AbortController();

    // Statistics
    this.stats = {
      totalReads: 0,
      loadedRegions: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  changeReadSource() {
    this.sourceController.abort();
    this.sourceController = new AbortController();
  }

  /**
   * Initialize reads manager with SAM file data
   */
  async initializeWithSAMData(fileData, filePath) {
    this.changeReadSource();
    this.rawReadsData = fileData;
    this.currentFile = filePath;
    this.isStreaming = false;
    this.isBamMode = false;
    this.bamReader = null;
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
      console.warn(
        `Large SAM file in memory: ~${fileSizeMB.toFixed(1)} MB. Consider using streaming for better performance.`
      );
    }

    console.log('ReadsManager initialized with dynamic loading');
  }

  /**
   * Parse SAM file header to extract metadata
   */
  async parseHeader() {
    const text = this.rawReadsData;
    let count = 0;
    let cursor = 0;
    while (cursor < text.length) {
      const newline = text.indexOf('\n', cursor);
      if (text[cursor] !== '@' && text[cursor] !== '\r' && text[cursor] !== '\n') count++;
      if (newline === -1) break;
      cursor = newline + 1;
    }
    this.stats.totalReads = count;

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
    const regionKey = this.getRegionKey(chromosome, start, end, settings);

    console.log(`🔍 [ReadsManager] Direct region query:`, {
      requestedRegion: `${start}-${end}`,
      cacheKey: regionKey,
    });

    // Check cache first
    if (this.cache.has(regionKey)) {
      this.stats.cacheHits++;
      const cached = this.cache.get(regionKey);
      cached.lastAccessed = Date.now();

      console.log(`✅ [ReadsManager] Cache HIT for key: ${regionKey}`);
      console.log(`🔍 [ReadsManager] Cached reads count: ${cached.reads.length}`);

      return this.applySampling(cached.reads, settings);
    }

    console.log(`❌ [ReadsManager] Cache MISS for key: ${regionKey}`);
    this.stats.cacheMisses++;

    // Use appropriate loading method based on mode
    const { signal } = this.sourceController;
    let reads;
    try {
      if (this.isBamMode && this.bamReader) {
        // Use BAM reader for binary BAM files - pass sampling settings to BAM loading
        reads = await this.loadReadsForRegionBAM(chromosome, start, end, settings);
      } else if (this.isStreaming) {
        reads = await this.loadReadsForRegionStream(chromosome, start, end, settings, signal);
      } else {
        reads = await this.loadReadsForRegion(chromosome, start, end, settings, signal);
      }
    } catch (error) {
      if (signal.aborted) return [];
      throw error;
    }

    if (signal.aborted) return [];
    // Apply sampling if enabled and threshold is exceeded
    const sampledReads = this.applySampling(reads, settings);
    this.cacheRegion(regionKey, reads);

    console.log(
      `🔍 [ReadsManager] Final result: ${sampledReads.length} reads for region ${start}-${end}${sampledReads.length !== reads.length ? ` (sampled from ${reads.length})` : ''}`
    );

    return sampledReads;
  }

  /**
   * Generate a cache key for a region
   */
  getRegionKey(chromosome, start, end, settings = {}) {
    return JSON.stringify([
      chromosome,
      start,
      end,
      settings.ignoreChromosome === true,
      settings.minMappingQuality || 0,
      settings.showSecondary !== false,
      settings.showSupplementary !== false,
      settings.viewportCoordinates === true,
      settings.depthViewport || null,
    ]);
  }

  /**
   * Apply read sampling based on settings
   */
  applySampling(reads, settings = {}) {
    // Validate and clamp settings to safe ranges
    const threshold = Math.min(100000, Math.max(1000, parseInt(settings.samplingThreshold) || 10000));
    const mode = settings.samplingMode === 'fixed' ? 'fixed' : 'percentage';
    const percentage = Math.min(100, Math.max(1, parseInt(settings.samplingPercentage) || 20));
    const fixedCount = Math.min(50000, Math.max(1000, parseInt(settings.samplingCount) || 5000));

    // Check if sampling is enabled and threshold is exceeded
    if (!settings.enableSampling || reads.length <= threshold) {
      return reads;
    }

    console.log(`🎲 [ReadsManager] Sampling activated: ${reads.length} reads exceed threshold of ${threshold}`);

    let targetCount;
    if (mode === 'percentage') {
      targetCount = Math.max(1, Math.floor((reads.length * percentage) / 100));
    } else {
      targetCount = Math.min(fixedCount, reads.length);
    }

    // Ensure we don't sample more than available
    targetCount = Math.min(targetCount, reads.length);

    console.log(
      `🎲 [ReadsManager] Sampling ${targetCount} reads from ${reads.length} (mode: ${mode}${mode === 'percentage' ? `, ${percentage}%` : `, max: ${fixedCount}`})`
    );

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

    // Verify position distribution after sampling and store sampling information
    let positionCoverage = 0;
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

      // Calculate position coverage for sampling info
      positionCoverage = (sampledMaxPos - sampledMinPos) / (maxPos - minPos);
    }

    // Store sampling information for statistics
    sampledReads._sourceSamplingInfo = reads._sourceSamplingInfo;
    sampledReads._alignmentDepth = reads._alignmentDepth;
    sampledReads._samplingInfo = {
      originalCount: reads.length,
      sampledCount: targetCount,
      mode: mode,
      threshold: threshold,
      percentage: mode === 'percentage' ? percentage : null,
      fixedCount: mode === 'fixed' ? fixedCount : null,
      positionCoverage: positionCoverage,
    };

    console.log(`✅ [ReadsManager] Reservoir sampling complete: ${sampledReads.length} reads selected`);

    return sampledReads;
  }

  /**
   * Load reads for a specific region from the raw SAM data
   */
  async loadReadsForRegion(chromosome, start, end, settings = {}, signal) {
    const { SamRegion } =
      typeof module !== 'undefined' && module.exports ? require('../../shared/alignment-depth') : window.alignmentDepth;
    const sourceStart = this.getSamSourceStart(start, settings);
    const region = new SamRegion(chromosome, sourceStart, end, settings);
    const text = this.rawReadsData;
    let cursor = 0;
    let lines = 0;
    while (cursor < text.length) {
      const newline = text.indexOf('\n', cursor);
      const lineEnd = newline < 0 ? text.length : newline;
      region.addLine(text.slice(cursor, lineEnd));
      cursor = lineEnd + 1;
      if (++lines % 10000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
        signal?.throwIfAborted();
      }
    }
    this.stats.loadedRegions++;
    return this.readsFromSamResult(region.summarize());
  }

  getSamSourceStart(start, settings) {
    return Math.max(0, settings.viewportCoordinates ? start : start - 1);
  }

  readsFromSamResult(result) {
    const reads = result.reads || [];
    if (result.sourceSamplingInfo) reads._sourceSamplingInfo = result.sourceSamplingInfo;
    if (result.depth) reads._alignmentDepth = result.depth;
    return reads;
  }

  /**
   * Filter reads to exact region boundaries
   */
  filterReadsForExactRegion(reads, start, end) {
    return reads.filter(read => read.start <= end && read.end >= start);
  }

  /**
   * Cache region data with LRU eviction
   */
  cacheRegion(regionKey, reads) {
    const bytes = reads.reduce(
      (sum, read) =>
        sum + 256 + 2 * ((read.sequence?.length || 0) + (read.quality?.length || 0) + (read.cigar?.length || 0)),
      (reads._alignmentDepth?.alignedBases.length || 0) * 8
    );
    if (bytes > this.maxCacheBytes) return;

    this.cache.delete(regionKey);
    let usedBytes = Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.bytes, 0);
    const oldest = Array.from(this.cache).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    for (const [key, entry] of oldest) {
      if (this.cache.size < this.maxCacheSize && usedBytes + bytes <= this.maxCacheBytes) break;
      this.cache.delete(key);
      usedBytes -= entry.bytes;
    }
    this.cache.set(regionKey, { reads, lastAccessed: Date.now(), bytes, size: reads.length });
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
      this.getReadsForRegion(chromosome, nextStart, nextEnd),
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
    const memoryUsage = Array.from(this.cache.values()).reduce((total, entry) => total + entry.size, 0);

    return {
      ...this.stats,
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      memoryUsage: memoryUsage,
      hitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0,
    };
  }

  /**
   * Handle navigation change - clear distant cache entries
   */
  onNavigationChange(chromosome, start, end) {
    const regionSize = end - start;
    const clearDistance = regionSize * 10; // Clear cache entries more than 10 regions away

    const entriesToRemove = [];

    for (const [key] of this.cache.entries()) {
      const [keyChromosome, keyStart] = JSON.parse(key);

      // Different chromosome - remove immediately
      if (keyChromosome !== chromosome) {
        entriesToRemove.push(key);
        continue;
      }

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
    this.changeReadSource();
    this.rawReadsData = null;
    this.cache.clear();
    this.currentFile = null;
    this.isStreaming = false;
    this.isBamMode = false;
    this.bamReader = null;
  }

  /**
   * Initialize reads manager with streaming SAM data
   * This method processes SAM data in chunks to avoid memory issues
   */
  async initializeWithStreamingSAM(filePath) {
    this.changeReadSource();
    this.currentFile = filePath;
    this.cache.clear();
    this.stats.totalReads = 0;
    this.stats.loadedRegions = 0;
    this.stats.cacheHits = 0;
    this.stats.cacheMisses = 0;
    this.rawReadsData = null; // Don't store the full data in memory
    this.isStreaming = true;
    this.isBamMode = false;
    this.bamReader = null;

    console.log('ReadsManager initialized with streaming mode for large SAM files');
  }

  /**
   * Initialize reads manager with BAM reader
   * This method uses the BamReader to handle binary BAM files efficiently
   */
  async initializeWithBAMReader(bamReader) {
    this.changeReadSource();
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
      chromosome,
      start,
      end,
      currentFile: this.currentFile,
      isBamMode: this.isBamMode,
      ignoreChromosome: settings.ignoreChromosome,
      hasIndex: this.bamReader?.isIndexed(),
      bamReaderInitialized: this.bamReader?.isInitialized,
      settings: settings,
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
        noExpansion: true,
      });

      this.genomeBrowser.updateStatus(
        `Loading BAM reads for region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()}...`
      );

      // Get reads using BAM reader with settings - use 0-based coordinates
      console.log(`🔍 [ReadsManager] Calling bamReader.getRecordsForRange with:`, {
        chromosome,
        start: bamSearchStart,
        end: bamSearchEnd + 1,
        settings,
      });

      const reads = await this.bamReader.getRecordsForRange(chromosome, bamSearchStart, bamSearchEnd + 1, settings);

      console.log(`✅ [ReadsManager] Retrieved ${reads.length.toLocaleString()} reads from BAM file`);
      console.log(`🔍 [ReadsManager] Settings used: ignoreChromosome=${settings.ignoreChromosome}`);

      // Log sample reads for debugging
      if (reads.length > 0) {
        console.log(
          `🔍 [ReadsManager] Sample reads (first 3):`,
          reads.slice(0, 3).map(read => ({
            id: read.id,
            chromosome: read.chromosome,
            position: `${read.start}-${read.end}`,
            strand: read.strand,
            mappingQuality: read.mappingQuality,
            flags: read.flags,
          }))
        );

        // Check if reads are distributed across the region
        const positions = reads.map(read => read.start).sort((a, b) => a - b);
        const minPos = positions[0];
        const maxPos = positions[positions.length - 1];
        console.log(`🎯 [ReadsManager] Reads position distribution: ${minPos}-${maxPos} (target: ${start}-${end})`);

        // Sample positions to check distribution
        if (reads.length > 10) {
          const sampleIndices = [
            0,
            Math.floor(reads.length * 0.25),
            Math.floor(reads.length * 0.5),
            Math.floor(reads.length * 0.75),
            reads.length - 1,
          ];
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
          referencesCount: bamStats.references,
        });

        // Get available chromosomes
        const references = this.bamReader.getReferences();
        console.warn(
          `🔍 [ReadsManager] Available chromosomes:`,
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
  async loadReadsForRegionStream(chromosome, start, end, settings = {}, signal) {
    if (!this.currentFile) throw new Error('No SAM file loaded for streaming');
    const api = window.electronAPI;
    const requestId = globalThis.crypto.randomUUID();
    const cancel = () => {
      api.cancelSamRegionQuery(requestId).catch(error => console.warn('Could not cancel the SAM query:', error));
    };
    signal?.throwIfAborted();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const result = await api.getSamReadsForRange(
        this.currentFile,
        chromosome,
        this.getSamSourceStart(start, settings),
        end,
        settings,
        requestId
      );
      signal?.throwIfAborted();
      this.stats.loadedRegions++;
      return this.readsFromSamResult(result);
    } finally {
      signal?.removeEventListener('abort', cancel);
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ReadsManager;
}
