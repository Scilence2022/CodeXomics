/**
 * BamReader - Enhanced BAM file parser using @gmod/bam library
 * Directly uses @gmod/bam API for optimal performance and compatibility
 */

// In Electron renderer process, we can use require() for Node.js modules
let BamFile, LocalFile;

try {
    // Import @gmod/bam in Electron renderer process
    const bamModule = require('@gmod/bam');
    BamFile = bamModule.BamFile;
    
    // Import generic-filehandle2 if needed
    try {
        const fileHandleModule = require('generic-filehandle2');
        LocalFile = fileHandleModule.LocalFile;
    } catch (fileHandleError) {
        console.warn('generic-filehandle2 not available, using built-in file handling');
    }
} catch (error) {
    console.error('Failed to import @gmod/bam:', error);
    throw new Error('@gmod/bam library is required but not available. Please ensure it is installed.');
}

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

            // Check if BamFile is available
            if (!BamFile) {
                throw new Error('@gmod/bam BamFile class is not available. Please ensure @gmod/bam is properly installed.');
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
            try {
            this.header = await this.bamFile.getHeader();
                console.log('✅ BAM header read successfully');
                console.log('🔍 Header content:', {
                    hasReferences: !!this.header.references,
                    referencesCount: this.header.references ? this.header.references.length : 0,
                    headerKeys: Object.keys(this.header || {}),
                    firstFewRefs: this.header.references ? this.header.references.slice(0, 3).map(r => ({ name: r.name, length: r.length })) : []
                });
                
            this.references = this.header.references || [];
                
                if (this.references.length === 0) {
                    console.error('❌ CRITICAL ISSUE: BAM file has no references in header!');
                    console.error('This could indicate:');
                    console.error('  1. Corrupted BAM file');
                    console.error('  2. Incomplete BAM file');
                    console.error('  3. BAM file created without proper header');
                    console.error('  4. Issue with @gmod/bam library');
                    console.error('Raw header object:', this.header);
                    
                    // Try to get more information about the file
                    try {
                        const fs = require('fs');
                        const stats = fs.statSync(this.filePath);
                        console.error(`File size: ${stats.size} bytes`);
                        
                        // Read first few bytes to check BAM magic
                        const buffer = Buffer.alloc(4);
                        const fd = fs.openSync(this.filePath, 'r');
                        fs.readSync(fd, buffer, 0, 4, 0);
                        fs.closeSync(fd);
                        
                        const magic = buffer.toString('ascii');
                        console.error(`File magic: "${magic}" (should be "BAM\\1" for BAM files)`);
                        
                        if (magic !== 'BAM\u0001') {
                            console.error('❌ File does not appear to be a valid BAM file!');
                        }
                    } catch (fileCheckError) {
                        console.error('Could not perform file validation:', fileCheckError.message);
                    }
                }
                
            } catch (headerError) {
                console.error('❌ Failed to read BAM header:', headerError);
                console.error('Header error details:', {
                    message: headerError.message,
                    stack: headerError.stack,
                    filePath: this.filePath,
                    hasIndex: this.hasIndex,
                    indexPath: this.indexPath
                });
                throw new Error(`Failed to read BAM header: ${headerError.message}`);
            }
            
            // Get file size information
            await this.getFileSizeInfo();

            this.isInitialized = true;

            console.log('✅ BamReader: Successfully initialized BAM file (direct @gmod/bam API)');
            console.log(`  📊 References: ${this.references.length}`);
            if (this.references.length > 0) {
                console.log(`  📋 Sample references:`, this.references.slice(0, 5).map(ref => `${ref.name} (${ref.length}bp)`));
            }
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
            
            // Final validation
            if (this.references.length === 0) {
                console.warn('⚠️ WARNING: BAM file initialized but has no references. This may cause issues with read queries.');
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
            console.log(`🔍 [BamReader] === BAM QUERY DEBUG START ===`);
            console.log(`🔍 [BamReader] Query parameters:`, {
                chromosome,
                start,
                end,
                settings,
                isInitialized: this.isInitialized,
                hasIndex: this.hasIndex,
                indexType: this.indexType,
                bamFilePath: this.filePath
            });
            
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

            // Log available references for debugging
            console.log(`🔍 [BamReader] Available references (${this.references.length}):`, 
                this.references.slice(0, 10).map(ref => `${ref.name} (${ref.length}bp)`));

            // Check if chromosome exists in references (only warn, don't fail)
            const referenceExists = this.references.some(ref => ref.name === chromosome);
            if (!referenceExists && this.references.length > 0) {
                console.warn(`⚠️ [BamReader] Chromosome '${chromosome}' not found in BAM references`);
                // List available chromosomes for debugging
                const availableChromosomes = this.references.slice(0, 5).map(ref => ref.name).join(', ');
                console.warn(`   Available chromosomes (first 5): ${availableChromosomes}${this.references.length > 5 ? '...' : ''}`);
                
                // If chromosome doesn't exist and we're not ignoring chromosome, this might be the issue
                if (!settings.ignoreChromosome) {
                    console.error(`❌ [BamReader] POTENTIAL ISSUE: Chromosome '${chromosome}' not found and ignoreChromosome is false`);
                }
            } else {
                console.log(`✅ [BamReader] Chromosome '${chromosome}' found in references`);
            }

            console.log(`🔍 [BamReader] Querying region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()} ${this.hasIndex ? '(indexed)' : '(sequential scan)'}`);

            let allRecords = [];

            if (settings.ignoreChromosome) {
                console.log(`🔍 [BamReader] IGNORE CHROMOSOME MODE: Fetching records from all chromosomes in position range ${start}-${end}`);
                
                for (const ref of this.references) {
                    try {
                        console.log(`🔍 [BamReader] Querying reference: ${ref.name}`);
                        const records = await this.bamFile.getRecordsForRange(ref.name, start, end);
                        console.log(`🔍 [BamReader] Retrieved ${records.length} records from ${ref.name}`);
                        allRecords = allRecords.concat(records);
                        
                        // Log sample records for debugging
                        if (records.length > 0) {
                            const sampleRecord = records[0];
                            console.log(`🔍 [BamReader] Sample record from ${ref.name}:`, {
                                name: sampleRecord.name || sampleRecord.qname,
                                refName: sampleRecord.refName,
                                start: sampleRecord.start,
                                end: sampleRecord.end,
                                mappingQuality: sampleRecord.mq || sampleRecord.mapq,
                                flags: sampleRecord.flags
                            });
                        }
                    } catch (refError) {
                        console.warn(`⚠️ [BamReader] Error querying reference ${ref.name}:`, refError.message);
                        // Continue with other references
                    }
                }
            } else {
                // Normal chromosome-specific query using @gmod/bam directly
                console.log(`🔍 [BamReader] NORMAL MODE: Fetching records for range ${chromosome}:${start}-${end}`);
                try {
                allRecords = await this.bamFile.getRecordsForRange(chromosome, start, end);
                    console.log(`🔍 [BamReader] Direct query returned ${allRecords.length} records`);
                    
                    // Log sample records for debugging
                    if (allRecords.length > 0) {
                        const sampleRecord = allRecords[0];
                        console.log(`🔍 [BamReader] Sample record:`, {
                            name: sampleRecord.name || sampleRecord.qname,
                            refName: sampleRecord.refName,
                            start: sampleRecord.start,
                            end: sampleRecord.end,
                            mappingQuality: sampleRecord.mq || sampleRecord.mapq,
                            flags: sampleRecord.flags,
                            strand: sampleRecord.strand
                        });
                    }
                } catch (queryError) {
                    console.error(`❌ [BamReader] Error in direct query:`, queryError);
                    throw queryError;
                }
            }

            console.log(`🔍 [BamReader] Retrieved ${allRecords.length} raw records from BAM file`);

            // Warn if we got an unexpectedly large number of records for a small region
            const regionSize = end - start;
            const recordsPerBp = allRecords.length / regionSize;
            if (recordsPerBp > 100) {
                console.warn(`⚠️ [BamReader] Very high read density: ${recordsPerBp.toFixed(1)} reads/bp for region ${chromosome}:${start}-${end}`);
                console.warn(`   This might indicate an issue with the BAM file or query region`);
                console.warn(`   Consider using a more specific region or checking the BAM file integrity`);
            }
            
            // Apply early sampling for extremely large datasets to prevent stack overflow
            const EXTREME_DATASET_THRESHOLD = 200000; // 200k records threshold
            const EARLY_SAMPLE_SIZE = 100000; // Sample down to 100k records
            
            if (allRecords.length > EXTREME_DATASET_THRESHOLD) {
                console.warn(`⚠️ [BamReader] Extremely large dataset detected (${allRecords.length} records)`);
                console.warn(`   Applying early random sampling to prevent memory/stack overflow`);
                console.warn(`   Sampling ${EARLY_SAMPLE_SIZE} records from ${allRecords.length} for processing`);
                
                // Apply position-aware stratified sampling to reduce bias
                console.log(`🎯 [BamReader] Applying position-aware stratified sampling...`);
                
                // First, analyze position distribution
                const positions = allRecords.map(r => r.start).sort((a, b) => a - b);
                const minPos = positions[0];
                const maxPos = positions[positions.length - 1];
                const positionRange = maxPos - minPos;
                
                console.log(`📊 [BamReader] Position range: ${minPos}-${maxPos} (span: ${positionRange})`);
                
                // Divide into position-based strata for more uniform sampling
                const NUM_STRATA = 100; // Divide region into 100 strata
                const strataSize = Math.ceil(positionRange / NUM_STRATA);
                const strata = new Array(NUM_STRATA).fill(null).map(() => []);
                
                // Assign records to strata based on position
                for (const record of allRecords) {
                    const strataIndex = Math.min(
                        Math.floor((record.start - minPos) / strataSize),
                        NUM_STRATA - 1
                    );
                    strata[strataIndex].push(record);
                }
                
                // Calculate target samples per stratum
                const sampledRecords = [];
                const targetPerStratum = Math.ceil(EARLY_SAMPLE_SIZE / NUM_STRATA);
                
                for (let s = 0; s < NUM_STRATA; s++) {
                    const stratumRecords = strata[s];
                    if (stratumRecords.length === 0) continue;
                    
                    // Sample from this stratum
                    const sampleCount = Math.min(targetPerStratum, stratumRecords.length);
                    
                    // Use Fisher-Yates shuffle for small arrays (more uniform than reservoir)
                    const shuffled = [...stratumRecords];
                    for (let i = 0; i < sampleCount; i++) {
                        const j = i + Math.floor(Math.random() * (shuffled.length - i));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }
                    
                    sampledRecords.push(...shuffled.slice(0, sampleCount));
                    
                    // Stop if we've reached our target
                    if (sampledRecords.length >= EARLY_SAMPLE_SIZE) break;
                }
                
                // If we have fewer samples than target, fill with remaining records
                if (sampledRecords.length < EARLY_SAMPLE_SIZE) {
                    const remaining = allRecords.filter(r => !sampledRecords.includes(r));
                    const needed = EARLY_SAMPLE_SIZE - sampledRecords.length;
                    
                    // Shuffle remaining records and take what we need
                    for (let i = 0; i < Math.min(needed, remaining.length); i++) {
                        const j = i + Math.floor(Math.random() * (remaining.length - i));
                        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
                    }
                    
                    sampledRecords.push(...remaining.slice(0, needed));
                }
                
                // Final shuffle to remove any ordering bias
                for (let i = 0; i < sampledRecords.length; i++) {
                    const j = i + Math.floor(Math.random() * (sampledRecords.length - i));
                    [sampledRecords[i], sampledRecords[j]] = [sampledRecords[j], sampledRecords[i]];
                }
                
                // Replace original array with sampled records
                allRecords = sampledRecords.slice(0, EARLY_SAMPLE_SIZE);
                
                // Verify position coverage
                const sampledPositions = allRecords.map(r => r.start).sort((a, b) => a - b);
                const sampledMinPos = sampledPositions[0];
                const sampledMaxPos = sampledPositions[sampledPositions.length - 1];
                const coverageRatio = (sampledMaxPos - sampledMinPos) / positionRange;
                
                console.log(`✅ [BamReader] Stratified sampling complete: ${allRecords.length} records selected`);
                console.log(`📊 [BamReader] Position coverage: ${(coverageRatio * 100).toFixed(1)}% (${sampledMinPos}-${sampledMaxPos})`);
                
                console.log(`✅ [BamReader] Early sampling complete: ${allRecords.length} records selected`);
                console.log(`   Note: Additional sampling may be applied by ReadsManager if configured`);
            } else if (allRecords.length > 100000) {
                console.log(`ℹ️ [BamReader] Large dataset detected (${allRecords.length} records)`);
                console.log(`   Random sampling will be applied by ReadsManager if enabled`);
            }

            // Log detailed statistics about the raw records using memory-efficient approach
            if (allRecords.length > 0) {
                // Calculate statistics in a single pass to avoid stack overflow with large datasets
                let minMQ = Infinity;
                let maxMQ = -Infinity;
                let totalMQ = 0;
                let unmappedCount = 0;
                let secondaryCount = 0;
                let supplementaryCount = 0;
                
                // Process records in chunks to avoid memory issues with very large datasets
                const STATS_CHUNK_SIZE = 10000;
                for (let i = 0; i < allRecords.length; i += STATS_CHUNK_SIZE) {
                    const chunk = allRecords.slice(i, i + STATS_CHUNK_SIZE);
                    
                    for (const record of chunk) {
                        // Mapping quality stats
                        const mq = record.mq || record.mapq || 0;
                        minMQ = Math.min(minMQ, mq);
                        maxMQ = Math.max(maxMQ, mq);
                        totalMQ += mq;
                        
                        // Flag statistics
                        if ((record.flags & 4) !== 0) unmappedCount++;
                        if ((record.flags & 256) !== 0) secondaryCount++;
                        if ((record.flags & 2048) !== 0) supplementaryCount++;
                    }
                    
                    // Log progress for very large datasets
                    if (allRecords.length > 100000 && (i / STATS_CHUNK_SIZE) % 50 === 0) {
                        console.log(`📊 [BamReader] Processing statistics: ${i + chunk.length}/${allRecords.length} records (${((i + chunk.length) / allRecords.length * 100).toFixed(1)}%)`);
                    }
                }
                
                const avgMQ = totalMQ / allRecords.length;
                
                console.log(`🔍 [BamReader] Raw records mapping quality stats:`, {
                    min: minMQ === Infinity ? 0 : minMQ,
                    max: maxMQ === -Infinity ? 0 : maxMQ,
                    average: avgMQ.toFixed(1),
                    count: allRecords.length
                });
                
                console.log(`🔍 [BamReader] Unmapped reads: ${unmappedCount}/${allRecords.length}`);
                console.log(`🔍 [BamReader] Secondary alignments: ${secondaryCount}/${allRecords.length}`);
                console.log(`🔍 [BamReader] Supplementary alignments: ${supplementaryCount}/${allRecords.length}`);
            }

            // Convert records to our internal format with memory-efficient chunked processing
            console.log(`🔍 [BamReader] Converting ${allRecords.length} records to internal format...`);
            
            // For very large datasets, use chunked processing to avoid stack overflow
            const CHUNK_SIZE = 5000; // Reduced chunk size for better memory management
            let reads = [];
            
            if (allRecords.length > CHUNK_SIZE) {
                console.log(`🔍 [BamReader] Large dataset detected (${allRecords.length} records), using memory-efficient chunked processing...`);
                
                // Pre-allocate array capacity to avoid repeated reallocation
                reads = new Array();
                
                for (let i = 0; i < allRecords.length; i += CHUNK_SIZE) {
                    const chunkEnd = Math.min(i + CHUNK_SIZE, allRecords.length);
                    const chunk = allRecords.slice(i, chunkEnd);
                    const chunkReads = this.convertRecordsToReads(chunk, chromosome, settings, i);
                    
                    // Use push.apply for better performance than concat
                    reads.push(...chunkReads);
                    
                    // Log progress every 10 chunks for large datasets
                    if ((i / CHUNK_SIZE) % 10 === 0) {
                        console.log(`🔍 [BamReader] Processed ${chunkEnd}/${allRecords.length} records (${((chunkEnd) / allRecords.length * 100).toFixed(1)}%)`);
                    }
                    
                    // Force garbage collection hint for very large datasets
                    if (allRecords.length > 100000 && (i / CHUNK_SIZE) % 20 === 0) {
                        // Small delay to allow garbage collection
                        await new Promise(resolve => setTimeout(resolve, 1));
                    }
                }
                
                console.log(`✅ [BamReader] Chunked processing complete: ${reads.length} reads from ${allRecords.length} records`);
            } else {
                reads = this.convertRecordsToReads(allRecords, chromosome, settings);
            }
            
            const queryTime = performance.now() - startTime;
            
            // Update performance statistics
            this.updatePerformanceStats(queryTime);
            
            console.log(`✅ [BamReader] Retrieved ${reads.length.toLocaleString()} reads for region ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()} in ${queryTime.toFixed(1)}ms`);
            console.log(`🔍 [BamReader] === BAM QUERY DEBUG END ===`);

            return reads;

        } catch (error) {
            const queryTime = performance.now() - startTime;
            console.error(`❌ [BamReader] Failed to get reads for region (${queryTime.toFixed(1)}ms):`, error);
            console.error(`❌ [BamReader] Error stack:`, error.stack);
            throw new Error(`Failed to read BAM region: ${error.message}`);
        }
    }

    /**
     * Convert @gmod/bam records to our internal format
     * @private
     * @param {Array} records - Array of BAM records
     * @param {string} chromosome - Chromosome name
     * @param {Object} settings - Conversion settings
     * @param {number} offset - Offset for record numbering (for chunked processing)
     */
    convertRecordsToReads(records, chromosome, settings = {}, offset = 0) {
        const reads = [];
        let filteredCount = 0;
        let unmappedCount = 0;
        let secondaryCount = 0;
        let supplementaryCount = 0;
        let lowQualityCount = 0;
        
        console.log(`🔍 [BamReader] === RECORD CONVERSION DEBUG START ===`);
        console.log(`🔍 [BamReader] Converting ${records.length} records with settings:`, settings);
        
        for (let i = 0; i < records.length; i++) {
            try {
                const record = records[i];
                
                // Debug the first few records in detail
                if (i < 3) {
                    console.log(`🔍 [BamReader] Record ${i} details:`, {
                        name: record.name || record.qname,
                        refName: record.refName,
                    start: record.start,
                    end: record.end,
                        flags: record.flags,
                        mappingQuality: record.mq || record.mapq,
                        strand: record.strand,
                        cigar: record.CIGAR || record.cigar,
                        seq: record.seq ? record.seq.substring(0, 20) + '...' : 'N/A'
                    });
                }
                
                // Get mapping quality first
                const mappingQuality = record.mq || record.mapq || 0;
                
                // Check for unmapped reads (flag 4)
                if ((record.flags & 4) !== 0) {
                    unmappedCount++;
                    if (i < 5) {
                        console.log(`🔍 [BamReader] Found unmapped read: ${record.name || record.qname}`);
                    }
                    // Skip unmapped reads unless explicitly requested
                    if (!settings.showUnmapped) {
                        continue;
                    }
                }
                
                // Check for secondary alignments (flag 256)
                if ((record.flags & 256) !== 0) {
                    secondaryCount++;
                    if (i < 5) {
                        console.log(`🔍 [BamReader] Found secondary alignment: ${record.name || record.qname}`);
                    }
                    // Skip secondary alignments if not requested
                    if (settings.showSecondary === false) {
                        continue;
                    }
                }
                
                // Check for supplementary alignments (flag 2048)
                if ((record.flags & 2048) !== 0) {
                    supplementaryCount++;
                    if (i < 5) {
                        console.log(`🔍 [BamReader] Found supplementary alignment: ${record.name || record.qname}`);
                    }
                    // Skip supplementary alignments if not requested
                    if (settings.showSupplementary === false) {
                        continue;
                    }
                }
                
                // Check mapping quality filtering
                const minMappingQuality = settings.minMappingQuality || 0;
                if (mappingQuality < minMappingQuality) {
                    lowQualityCount++;
                    if (i < 5) {  // Log first few low quality reads
                        console.log(`🔍 [BamReader] Filtering low mapping quality read: ${record.name || record.qname} (MQ=${mappingQuality} < ${minMappingQuality})`);
                    }
                    continue;
                }
                
                // Count low quality reads for statistics (but don't filter them if minMappingQuality is 0)
                if (mappingQuality < 1) {
                    lowQualityCount++;
                }
                
                const read = {
                    id: record.name || record.qname || `read_${offset + i}`,
                    chromosome: record.refName || chromosome,
                    start: record.start + 1,  // Convert from 0-based to 1-based coordinates
                    end: record.end + 1,      // Convert from 0-based to 1-based coordinates
                    strand: (record.strand === 1 || record.strand === '+') ? '+' : '-',
                    mappingQuality: mappingQuality,
                    cigar: record.CIGAR || record.cigar || '',
                    sequence: record.seq || '',
                    quality: record.qual || '',
                    flags: record.flags || 0,
                    templateLength: record.template_length || record.tlen || 0,
                    tags: record.tags || {},
                    // Parse mutations from CIGAR and sequence
                    mutations: this.parseMutations(record)
                };
                
                reads.push(read);
            } catch (recordError) {
                console.warn(`⚠️ [BamReader] Error processing record ${i}:`, recordError.message);
                filteredCount++;
                // Continue processing other records
            }
        }
        
        const totalFiltered = records.length - reads.length;
        
        console.log(`🔍 [BamReader] Conversion summary:`, {
            totalRecords: records.length,
            convertedReads: reads.length,
            totalFiltered: totalFiltered,
            unmappedFound: unmappedCount,
            secondaryAlignments: secondaryCount,
            supplementaryAlignments: supplementaryCount,
            lowQualityReads: lowQualityCount,
            conversionErrors: filteredCount,
            filterSettings: {
                minMappingQuality: settings.minMappingQuality || 0,
                showUnmapped: settings.showUnmapped || false,
                showSecondary: settings.showSecondary !== false,
                showSupplementary: settings.showSupplementary !== false
            }
        });
        
        // Log sample of final converted reads
        if (reads.length > 0) {
            console.log(`🔍 [BamReader] Sample converted reads (first 3):`, 
                reads.slice(0, 3).map(read => ({
                    id: read.id,
                    chromosome: read.chromosome,
                    position: `${read.start}-${read.end}`,
                    strand: read.strand,
                    mappingQuality: read.mappingQuality
                }))
            );
        }
        
        console.log(`🔍 [BamReader] === RECORD CONVERSION DEBUG END ===`);
        
        return reads;
    }

    /**
     * Parse mutations from BAM record using CIGAR string and MD tag
     * @param {Object} record - BAM record
     * @returns {Array} Array of mutation objects
     */
    parseMutations(record) {
        const mutations = [];
        
        try {
            const cigar = record.CIGAR || record.cigar || '';
            const sequence = record.seq || '';
            const mdTag = record.tags?.MD || record.MD || '';
            
            if (!cigar || !sequence) {
                return mutations;
            }
            
            // Parse CIGAR string to find insertions and deletions
            const cigarOps = this.parseCigarString(cigar);
            let refPos = record.start; // 0-based reference position
            let seqPos = 0; // 0-based sequence position
            
            for (const op of cigarOps) {
                const { operation, length } = op;
                
                switch (operation) {
                    case 'M': // Match/mismatch
                    case '=': // Exact match
                    case 'X': // Mismatch
                        // For mismatches, we need MD tag to identify specific positions
                        if (operation === 'X' || (operation === 'M' && mdTag)) {
                            const mismatches = this.parseMismatchesFromMD(mdTag, refPos, seqPos, length, sequence);
                            mutations.push(...mismatches);
                        }
                        refPos += length;
                        seqPos += length;
                        break;
                        
                    case 'I': // Insertion
                        mutations.push({
                            type: 'insertion',
                            position: refPos + 1, // Convert to 1-based
                            length: length,
                            sequence: sequence.substring(seqPos, seqPos + length),
                            refSequence: '',
                            color: '#FF6B6B' // Red for insertions
                        });
                        seqPos += length;
                        // refPos doesn't advance for insertions
                        break;
                        
                    case 'D': // Deletion
                        mutations.push({
                            type: 'deletion',
                            position: refPos + 1, // Convert to 1-based
                            length: length,
                            sequence: '',
                            refSequence: 'N'.repeat(length), // Placeholder
                            color: '#4ECDC4' // Cyan for deletions
                        });
                        refPos += length;
                        // seqPos doesn't advance for deletions
                        break;
                        
                    case 'N': // Skipped region (intron)
                        refPos += length;
                        break;
                        
                    case 'S': // Soft clipping
                    case 'H': // Hard clipping
                        if (operation === 'S') {
                            seqPos += length;
                        }
                        break;
                        
                    case 'P': // Padding
                        // No position changes
                        break;
                }
            }
            
        } catch (error) {
            console.warn('⚠️ [BamReader] Error parsing mutations:', error.message);
        }
        
        return mutations;
    }
    
    /**
     * Parse CIGAR string into operations
     * @param {string} cigar - CIGAR string
     * @returns {Array} Array of {operation, length} objects
     */
    parseCigarString(cigar) {
        const operations = [];
        const cigarRegex = /(\d+)([MIDNSHPX=])/g;
        let match;
        
        while ((match = cigarRegex.exec(cigar)) !== null) {
            operations.push({
                length: parseInt(match[1]),
                operation: match[2]
            });
        }
        
        return operations;
    }
    
    /**
     * Parse mismatches from MD tag
     * @param {string} mdTag - MD tag value
     * @param {number} refPos - Current reference position
     * @param {number} seqPos - Current sequence position
     * @param {number} length - Length of the match region
     * @param {string} sequence - Read sequence
     * @returns {Array} Array of mismatch mutations
     */
    parseMismatchesFromMD(mdTag, refPos, seqPos, length, sequence) {
        const mismatches = [];
        
        if (!mdTag) return mismatches;
        
        try {
            // Parse MD tag format: numbers and letters
            // Example: "10A5^AC6" means 10 matches, A->?, 5 matches, deletion AC, 6 matches
            const mdRegex = /(\d+)|([A-Z]+)|\^([A-Z]+)/g;
            let match;
            let currentRefPos = refPos;
            let currentSeqPos = seqPos;
            
            while ((match = mdRegex.exec(mdTag)) !== null) {
                if (match[1]) {
                    // Number: advance positions
                    const advance = parseInt(match[1]);
                    currentRefPos += advance;
                    currentSeqPos += advance;
                } else if (match[2]) {
                    // Mismatch: each character is a mismatch
                    for (let i = 0; i < match[2].length; i++) {
                        if (currentSeqPos < sequence.length) {
                            mismatches.push({
                                type: 'mismatch',
                                position: currentRefPos + 1, // Convert to 1-based
                                length: 1,
                                sequence: sequence[currentSeqPos],
                                refSequence: match[2][i],
                                color: '#FFD93D' // Yellow for mismatches
                            });
                        }
                        currentRefPos++;
                        currentSeqPos++;
                    }
                } else if (match[3]) {
                    // Deletion (^): reference bases that are deleted
                    // This is handled in CIGAR parsing, skip here
                    currentRefPos += match[3].length;
                }
            }
        } catch (error) {
            console.warn('⚠️ [BamReader] Error parsing MD tag:', error.message);
        }
        
        return mismatches;
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