/**
 * BamReader - BAM file parser using @gmod/bam library
 * Handles binary BAM files and provides an interface compatible with the existing SAM parsing system
 */

// BAM reading is handled through IPC calls to the main process

class BamReader {
    constructor() {
        this.filePath = null;
        this.isInitialized = false;
        this.header = null;
        this.references = [];
        this.totalReads = 0;
        this.fileSize = 0;
    }

    /**
     * Initialize BAM file reader
     * @param {string} filePath - Path to the BAM file
     * @returns {Promise<Object>} Initialization result
     */
    async initialize(filePath) {
        try {
            console.log('BamReader: Initializing with file:', filePath);
            
            if (!filePath || typeof filePath !== 'string') {
                throw new Error('Invalid file path provided');
            }

            // Call main process to initialize BAM file
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('bam-initialize', filePath);
            
            if (!result.success) {
                throw new Error(result.error);
            }

            // Store BAM file information
            this.filePath = filePath;
            this.header = result.header;
            this.references = result.references || [];
            this.totalReads = result.totalReads;
            this.fileSize = result.fileSize;
            this.isInitialized = true;

            console.log('BamReader: Successfully initialized BAM file');
            console.log(`  - References: ${this.references.length}`);
            console.log(`  - Total reads: ${this.totalReads}`);
            console.log(`  - File size: ${(this.fileSize / (1024 * 1024)).toFixed(2)} MB`);

            return {
                success: true,
                header: this.header,
                references: this.references,
                totalReads: this.totalReads,
                fileSize: this.fileSize
            };

        } catch (error) {
            console.error('BamReader: Initialization failed:', error);
            this.reset();
            throw new Error(`Failed to initialize BAM file: ${error.message}`);
        }
    }

    /**
     * Read BAM records for a specific genomic region
     * @param {string} chromosome - Chromosome name
     * @param {number} start - Start position (0-based)
     * @param {number} end - End position (0-based, exclusive)
     * @param {Object} settings - Optional settings including ignoreChromosome
     * @returns {Promise<Array>} Array of BAM records
     */
    async getReadsForRegion(chromosome, start, end, settings = {}) {
        try {
            if (!this.isInitialized) {
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

            // Check if chromosome exists in references
            const referenceExists = this.references.some(ref => ref.name === chromosome);
            if (!referenceExists && this.references.length > 0) {
                console.warn(`BamReader: Chromosome '${chromosome}' not found in BAM references`);
                // Don't throw error, just warn - some files might have different naming
            }

            console.log(`BamReader: Reading region ${chromosome}:${start}-${end} (ignoreChromosome: ${settings.ignoreChromosome})`);

            // Call main process to get reads
            const { ipcRenderer } = require('electron');
            const result = await ipcRenderer.invoke('bam-get-reads', {
                filePath: this.filePath,
                chromosome: chromosome,
                start: start,
                end: end,
                settings: settings
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            const reads = result.reads || [];
            console.log(`BamReader: Retrieved ${reads.length} reads for region ${chromosome}:${start}-${end} (ignoreChromosome: ${settings.ignoreChromosome})`);

            return reads;

        } catch (error) {
            console.error('BamReader: Failed to get reads for region:', error);
            throw new Error(`Failed to read BAM region: ${error.message}`);
        }
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
     * @returns {Array} Array of reference objects
     */
    getReferences() {
        return this.references;
    }

    /**
     * Get BAM file statistics
     * @returns {Object} File statistics
     */
    getStats() {
        return {
            totalReads: this.totalReads,
            fileSize: this.fileSize,
            references: this.references.length,
            isInitialized: this.isInitialized
        };
    }

    /**
     * Check if BAM reader is initialized
     * @returns {boolean} Initialization status
     */
    isReady() {
        return this.isInitialized;
    }

    /**
     * Reset BAM reader state
     */
    reset() {
        this.filePath = null;
        this.isInitialized = false;
        this.header = null;
        this.references = [];
        this.totalReads = 0;
        this.fileSize = 0;
    }

    /**
     * Get human-readable file size
     * @returns {string} Formatted file size
     */
    getFormattedFileSize() {
        if (this.fileSize === 0) return '0 B';
        
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = this.fileSize;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Stream reads for large regions (future enhancement)
     * Currently returns all reads at once
     */
    async *streamReadsForRegion(chromosome, start, end, chunkSize = 10000) {
        // For now, just return all reads in one chunk
        // Future enhancement: implement chunked reading for very large regions
        const reads = await this.getReadsForRegion(chromosome, start, end);
        
        // Split into chunks
        for (let i = 0; i < reads.length; i += chunkSize) {
            yield reads.slice(i, i + chunkSize);
        }
    }
}

// Export for Node.js and browser compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BamReader;
} else if (typeof window !== 'undefined') {
    window.BamReader = BamReader;
} 