/**
 * BamReader - Enhanced BAM file parser using @gmod/bam library
 * Directly uses @gmod/bam API for optimal performance and compatibility
 */

import { BamFile } from '@gmod/bam';
import { LocalFile } from 'generic-filehandle2';

class BamReader {
    constructor() {
        this.filePath = null;
        this.indexPath = null;
        this.bamFile = null;
        this.isInitialized = false;
        this.hasIndex = false;
        this.indexType = null; // 'bai' or 'csi'
        this.header = null;
        this.references = [];
        this.totalReads = 0;
        this.fileSize = 0;
        this.indexSize = 0;
        this.performanceStats = {
            queriesWithIndex: 0,
            queriesWithoutIndex: 0,
            averageQueryTime: 0,
            totalQueryTime: 0,
            queryCount: 0
        };
    }

    /**
     * Initialize BAM file reader with automatic index detection
     * @param {string} filePath - Path to the BAM file
     * @param {Object} options - Optional configuration
     * @param {string} options.indexPath - Explicit path to index file (optional)
     * @param {boolean} options.requireIndex - Whether to require an index file (default: false)
     * @returns {Promise<Object>} Initialization result
     */
    async initialize(filePath, options = {}) {
        try {
            console.log('🧬 BamReader: Initializing with file:', filePath);
            
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('Invalid file path provided');
            }

            // Reset state
            this.reset();
            this.filePath = filePath;

            // Detect index files
            await this.detectIndexFiles(filePath, options);

            // Create BAM file instance using @gmod/bam directly
            const bamFileConfig = {
                bamPath: filePath
            };

            // Add index configuration if available
            if (this.hasIndex && this.indexPath) {
                if (this.indexType === 'bai') {
                    bamFileConfig.baiPath = this.indexPath;
                } else if (this.indexType === 'csi') {
                    bamFileConfig.csiPath = this.indexPath;
                }
            }

            // Enhanced cache configuration for better performance
            bamFileConfig.cacheSize = this.hasIndex ? 200 : 50; // Larger cache if indexed
            bamFileConfig.yieldThreadTime = 100;

            console.log('🔧 Creating BAM file instance with @gmod/bam:', {
                bamPath: filePath,
                indexPath: this.hasIndex ? this.indexPath : 'none',
                indexType: this.hasIndex ? this.indexType : 'none',
                cacheSize: bamFileConfig.cacheSize
            });

            // Create BamFile instance
            this.bamFile = new BamFile(bamFileConfig);

            // Get header - this is fast and required
            console.log('📋 Reading BAM header...');
            this.header = await this.bamFile.getHeader();
            this.references = this.header.references || [];
            
            // Get file size information
            await this.getFileSizeInfo();

            this.isInitialized = true;

            console.log('✅ BamReader: Successfully initialized BAM file (direct @gmod/bam API)');
            console.log(`  📊 References: ${this.references.length}`);
            console.log(`  📈 Total reads: ${this.totalReads > 0 ? this.totalReads.toLocaleString() : 'Will be counted on-demand'}`);
            console.log(`  💾 File size: ${this.getFormattedFileSize()}`);
            console.log(`  🔍 Index: ${this.hasIndex ? `${this.indexType.toUpperCase()} (${this.getFormattedIndexSize()})` : 'Not available'}`);

            // Log performance implications
            if (!this.hasIndex) {
                console.warn('⚠️  BamReader: No index file found. Queries may be slower for large files.');
                console.warn('   💡 Consider creating an index with: samtools index file.bam');
            } else {
                console.log('🚀 BamReader: Index available - fast random access enabled');
                console.log('   📊 Read counts will be determined during actual queries');
            }

            return {
                success: true,
                header: this.header,
                references: this.references,
                totalReads: this.totalReads,
                fileSize: this.fileSize,
                hasIndex: this.hasIndex,
                indexType: this.indexType,
                indexPath: this.indexPath,
                indexSize: this.indexSize
            };

        } catch (error) {
            console.error('❌ BamReader: Initialization failed:', error);
            this.reset();
            throw new Error(`Failed to initialize BAM file: ${error.message}`);
        }
    }

    /**
     * Detect and validate index files
     * @private
     */
    async detectIndexFiles(filePath, options = {}) {
        // Strategy 1: Use explicitly provided index path
        if (options.indexPath) {
            if (await this.fileExists(options.indexPath)) {
                this.indexPath = options.indexPath;
                this.indexType = options.indexPath.endsWith('.csi') ? 'csi' : 'bai';
                this.hasIndex = true;
                console.log('✅ Using provided index file:', this.indexPath);
                await this.getIndexSize();
                return;
            } else {
                console.warn('⚠️ Provided index file not found:', options.indexPath);
            }
        }

        // Strategy 2: Auto-detect standard index files
        const indexCandidates = [
            { path: filePath + '.bai', type: 'bai' },           // standard: file.bam.bai
            { path: filePath.replace('.bam', '.bai'), type: 'bai' }, // alternative: file.bai
            { path: filePath + '.csi', type: 'csi' },           // CSI index: file.bam.csi
            { path: filePath.replace('.bam', '.csi'), type: 'csi' }  // alternative CSI: file.csi
        ];

        for (const candidate of indexCandidates) {
            if (await this.fileExists(candidate.path)) {
                this.indexPath = candidate.path;
                this.indexType = candidate.type;
                this.hasIndex = true;
                console.log(`✅ Auto-detected ${this.indexType.toUpperCase()} index:`, this.indexPath);
                await this.getIndexSize();
                return;
            }
        }

        if (!this.hasIndex) {
            console.warn('⚠️  No index file found. Checked locations:');
            indexCandidates.forEach(candidate => {
                console.warn(`   - ${candidate.path} (${candidate.type.toUpperCase()})`);
            });
            console.warn('   💡 Consider creating an index with: samtools index file.bam');

            if (options.requireIndex) {
                throw new Error('Index file is required but not found. Please create an index file first.');
            }
        }
    }

    /**
     * Check if file exists (works in both Node.js and browser environments)
     * @private
     */
    async fileExists(filePath) {
        try {
            // In Electron renderer process, we can use Node.js fs
            const fs = require('fs');
            return fs.existsSync(filePath);
        } catch (error) {
            // Fallback for browser environment
            try {
                const response = await fetch(filePath, { method: 'HEAD' });
                return response.ok;
            } catch (fetchError) {
                return false;
            }
        }
    }

    /**
     * Get file size information
     * @private
     */
    async getFileSizeInfo() {
        try {
            const fs = require('fs');
            const stats = fs.statSync(this.filePath);
            this.fileSize = stats.size;
        } catch (error) {
            console.warn('⚠️ Could not get file size:', error.message);
            this.fileSize = 0;
        }
    }

    /**
     * Get index file size
     * @private
     */
    async getIndexSize() {
        if (!this.indexPath) return;
        
        try {
            const fs = require('fs');
            const stats = fs.statSync(this.indexPath);
            this.indexSize = stats.size;
        } catch (error) {
            console.warn('⚠️ Could not get index file size:', error.message);
            this.indexSize = 0;
        }
    }

    /**
     * Read BAM records for a specific genomic region using @gmod/bam directly
     * @param {string} chromosome - Chromosome name
     * @param {number} start - Start position (0-based)
     * @param {number} end - End position (0-based, exclusive)
     * @param {Object} settings - Optional settings including ignoreChromosome
     * @returns {Promise<Array>} Array of BAM records
     */
    async getRecordsForRange(chromosome, start, end, settings = {}) {
        const startTime = performance.now();
        
        try {
            if (!this.isInitialized || !this.bamFile) {
                throw new Error('BAM reader not initialized. Call initialize() first.');
            }

            // Validate parameters
            if (!chromosome || typeof chromosome !== 'string') {
                throw new Error('Invalid chromosome parameter');
            }

            if (typeof start !== 'number' || typeof end !== 'number') {
                throw new Error('Start and end positions must be numbers');
            }

            if (start < 0) {
                throw new Error('Start position cannot be negative');
            }

            if (end <= start) {
                throw new Error('End position must be greater than start position');
            }

            // Check if chromosome exists in references (only warn, don't fail)
            const referenceExists = this.references.some(ref => ref.name === chromosome);
            if (!referenceExists && this.references.length > 0) {
                console.warn(`🔍 BamReader: Chromosome '${chromosome}' not found in BAM references`);
                // List available chromosomes for debugging
                const availableChromosomes = this.references.slice(0, 5).map(ref => ref.name).join(', ');
                console.warn(`   Available chromosomes (first 5): ${availableChromosomes}${this.references.length > 5 ? '...' : ''}`);
            }

            console.log(`🔍 BamReader: Querying region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()} ${this.hasIndex ? '(indexed)' : '(sequential scan)'}`);

            let allRecords = [];

            if (settings.ignoreChromosome) {
                // When ignoring chromosome, get all reads from all references that overlap the position range
                console.log(`Fetching records from all chromosomes in position range ${start}-${end}`);
                
                for (const ref of this.references) {
                    try {
                        const records = await this.bamFile.getRecordsForRange(ref.name, start, end);
                        console.log(`Retrieved ${records.length} records from ${ref.name}`);
                        allRecords = allRecords.concat(records);
                    } catch (refError) {
                        console.warn(`Error querying reference ${ref.name}:`, refError.message);
                        // Continue with other references
                    }
                }
            } else {
                // Normal chromosome-specific query using @gmod/bam directly
                console.log(`Fetching records for range ${chromosome}:${start}-${end}`);
                allRecords = await this.bamFile.getRecordsForRange(chromosome, start, end);
            }

            console.log(`Retrieved ${allRecords.length} raw records from BAM file`);

            // Convert records to our internal format
            const reads = this.convertRecordsToReads(allRecords, chromosome);
            
            const queryTime = performance.now() - startTime;
            
            // Update performance statistics
            this.updatePerformanceStats(queryTime);
            
            console.log(`✅ BamReader: Retrieved ${reads.length.toLocaleString()} reads for region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()} in ${queryTime.toFixed(1)}ms`);

            return reads;

        } catch (error) {
            const queryTime = performance.now() - startTime;
            console.error(`❌ BamReader: Failed to get reads for region (${queryTime.toFixed(1)}ms):`, error);
            throw new Error(`Failed to read BAM region: ${error.message}`);
        }
    }

    /**
     * Convert @gmod/bam records to our internal format
     * @private
     */
    convertRecordsToReads(records, chromosome) {
        const reads = [];
        
        for (let i = 0; i < records.length; i++) {
            try {
                const record = records[i];
                
                const read = {
                    id: record.name || record.qname || `read_${i}`,
                    chromosome: record.refName || chromosome,
                    start: record.start,
                    end: record.end,
                    strand: (record.strand === 1 || record.strand === '+') ? '+' : '-',
                    mappingQuality: record.mq || record.mapq || 0,
                    cigar: record.CIGAR || record.cigar || '',
                    sequence: record.seq || '',
                    quality: record.qual || '',
                    flags: record.flags || 0,
                    templateLength: record.template_length || record.tlen || 0,
                    tags: record.tags || {}
                };
                
                reads.push(read);
            } catch (recordError) {
                console.warn(`Error processing record ${i}:`, recordError.message);
                // Continue processing other records
            }
        }
        
        return reads;
    }

    /**
     * Alias for getRecordsForRange to match @gmod/bam API
     */
    async getRecordsForRegion(chromosome, start, end, settings = {}) {
        return this.getRecordsForRange(chromosome, start, end, settings);
    }

    /**
     * Get BAM file header
     * @returns {Object} BAM file header
     */
    getHeader() {
        return this.header;
    }

    /**
     * Get available chromosomes/references
     * @returns {Array} Array of reference objects with name and length
     */
    getReferences() {
        return this.references;
    }

    /**
     * Get reference names only
     * @returns {Array<string>} Array of chromosome/reference names
     */
    getReferenceNames() {
        return this.references.map(ref => ref.name);
    }

    /**
     * Check if a chromosome/reference exists
     * @param {string} chromosome - Chromosome name to check
     * @returns {boolean} Whether the chromosome exists
     */
    hasReference(chromosome) {
        return this.references.some(ref => ref.name === chromosome);
    }

    /**
     * Get reference info by name
     * @param {string} chromosome - Chromosome name
     * @returns {Object|null} Reference object or null if not found
     */
    getReference(chromosome) {
        return this.references.find(ref => ref.name === chromosome) || null;
    }

    /**
     * Get BAM file statistics including index information
     * @returns {Object} File statistics
     */
    getStats() {
        return {
            totalReads: this.totalReads,
            fileSize: this.fileSize,
            indexSize: this.indexSize,
            references: this.references.length,
            isInitialized: this.isInitialized,
            hasIndex: this.hasIndex,
            indexType: this.indexType,
            indexPath: this.indexPath,
            performanceStats: { ...this.performanceStats }
        };
    }

    /**
     * Get detailed file information
     * @returns {Object} Detailed file information
     */
    getFileInfo() {
        return {
            bamFile: {
                path: this.filePath,
                size: this.fileSize,
                formattedSize: this.getFormattedFileSize()
            },
            indexFile: this.hasIndex ? {
                path: this.indexPath,
                type: this.indexType,
                size: this.indexSize,
                formattedSize: this.getFormattedIndexSize()
            } : null,
            references: this.references.map(ref => ({
                name: ref.name,
                length: ref.length,
                formattedLength: ref.length ? ref.length.toLocaleString() + ' bp' : 'Unknown'
            })),
            performance: {
                ...this.performanceStats,
                averageQueryTime: this.performanceStats.averageQueryTime.toFixed(2) + 'ms',
                indexUsageRatio: this.performanceStats.queryCount > 0 ? 
                    ((this.performanceStats.queriesWithIndex / this.performanceStats.queryCount) * 100).toFixed(1) + '%' : '0%'
            }
        };
    }

    /**
     * Check if BAM reader is initialized and ready
     * @returns {boolean} Initialization status
     */
    isReady() {
        return this.isInitialized && this.bamFile !== null;
    }

    /**
     * Check if index is available
     * @returns {boolean} Index availability
     */
    isIndexed() {
        return this.hasIndex;
    }

    /**
     * Reset BAM reader state
     */
    reset() {
        this.filePath = null;
        this.indexPath = null;
        this.bamFile = null;
        this.isInitialized = false;
        this.hasIndex = false;
        this.indexType = null;
        this.header = null;
        this.references = [];
        this.totalReads = 0;
        this.fileSize = 0;
        this.indexSize = 0;
        this.performanceStats = {
            queriesWithIndex: 0,
            queriesWithoutIndex: 0,
            averageQueryTime: 0,
            totalQueryTime: 0,
            queryCount: 0
        };
    }

    /**
     * Update performance statistics
     * @private
     */
    updatePerformanceStats(queryTime) {
        this.performanceStats.queryCount++;
        this.performanceStats.totalQueryTime += queryTime;
        this.performanceStats.averageQueryTime = this.performanceStats.totalQueryTime / this.performanceStats.queryCount;
        
        if (this.hasIndex) {
            this.performanceStats.queriesWithIndex++;
        } else {
            this.performanceStats.queriesWithoutIndex++;
        }
    }

    /**
     * Get human-readable file size
     * @returns {string} Formatted file size
     */
    getFormattedFileSize() {
        return this.formatBytes(this.fileSize);
    }

    /**
     * Get human-readable index file size
     * @returns {string} Formatted index file size
     */
    getFormattedIndexSize() {
        return this.formatBytes(this.indexSize);
    }

    /**
     * Format bytes to human-readable string
     * @private
     * @param {number} bytes - Bytes to format
     * @returns {string} Formatted string
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Stream reads for large regions using @gmod/bam
     * @param {string} chromosome - Chromosome name
     * @param {number} start - Start position
     * @param {number} end - End position
     * @param {number} chunkSize - Chunk size for streaming
     */
    async *streamReadsForRegion(chromosome, start, end, chunkSize = 10000) {
        // For now, just return all reads in one chunk
        // Future enhancement: implement chunked reading for very large regions
        const reads = await this.getRecordsForRange(chromosome, start, end);
        
        // Split into chunks
        for (let i = 0; i < reads.length; i += chunkSize) {
            yield reads.slice(i, i + chunkSize);
        }
    }

    /**
     * Get performance report
     * @returns {string} Formatted performance report
     */
    getPerformanceReport() {
        const stats = this.performanceStats;
        const indexUsage = stats.queryCount > 0 ? (stats.queriesWithIndex / stats.queryCount * 100).toFixed(1) : 0;
        
        return `
📊 BAM Reader Performance Report (Direct @gmod/bam API)
=====================================================
Total Queries: ${stats.queryCount}
Average Query Time: ${stats.averageQueryTime.toFixed(2)}ms
Total Query Time: ${(stats.totalQueryTime / 1000).toFixed(2)}s

Index Usage:
- Queries with index: ${stats.queriesWithIndex} (${indexUsage}%)
- Queries without index: ${stats.queriesWithoutIndex}

File Information:
- BAM file: ${this.getFormattedFileSize()}
- Index file: ${this.hasIndex ? this.getFormattedIndexSize() : 'Not available'}
- References: ${this.references.length}
- Implementation: Direct @gmod/bam API calls
        `.trim();
    }
}

// Export for Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BamReader;
} else if (typeof window !== 'undefined') {
    window.BamReader = BamReader;
} 