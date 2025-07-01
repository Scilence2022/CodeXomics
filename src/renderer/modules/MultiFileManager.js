/**
 * MultiFileManager - Manages multiple BAM/SAM and VCF files simultaneously
 * Provides file-specific track management, naming, and memory cleanup
 */
class MultiFileManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        
        // Multi-file storage
        this.bamFiles = new Map(); // fileId -> { reader, metadata, tracks }
        this.vcfFiles = new Map(); // fileId -> { data, metadata, tracks }
        
        // File counter for unique IDs
        this.fileCounter = 0;
        
        // Track visibility management
        this.trackVisibility = new Map(); // trackId -> boolean
        
        // File metadata storage
        this.fileMetadata = new Map(); // fileId -> { name, path, type, loadTime, size }
        
        console.log('MultiFileManager initialized');
    }

    /**
     * Generate unique file ID
     */
    generateFileId(type, baseName) {
        this.fileCounter++;
        return `${type}_${this.fileCounter}_${baseName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    /**
     * Add BAM/SAM file
     */
    async addBamFile(filePath, customName = null) {
        try {
            console.log(`Adding BAM file: ${filePath}`);
            
            // Create BAM reader
            const bamReader = new BamReader();
            await bamReader.initialize(filePath);
            
            // Generate file metadata
            const baseName = customName || this.extractFileName(filePath);
            const fileId = this.generateFileId('bam', baseName);
            
            const metadata = {
                id: fileId,
                name: baseName,
                originalName: baseName,
                path: filePath,
                type: 'bam',
                loadTime: new Date(),
                size: bamReader.fileSize,
                stats: bamReader.getStats(),
                isVisible: true
            };
            
            // Store BAM file data
            this.bamFiles.set(fileId, {
                reader: bamReader,
                metadata: metadata,
                trackId: `reads_${fileId}`
            });
            
            this.fileMetadata.set(fileId, metadata);
            
            console.log(`BAM file added successfully: ${fileId}`);
            return { fileId, metadata };
            
        } catch (error) {
            console.error('Error adding BAM file:', error);
            throw new Error(`Failed to add BAM file: ${error.message}`);
        }
    }

    /**
     * Add VCF file
     */
    async addVcfFile(filePath, fileData, customName = null) {
        try {
            console.log(`Adding VCF file: ${filePath}`);
            
            // Parse VCF data
            const variants = this.parseVcfData(fileData);
            
            // Generate file metadata
            const baseName = customName || this.extractFileName(filePath);
            const fileId = this.generateFileId('vcf', baseName);
            
            const variantCount = Object.values(variants).reduce((sum, chrVariants) => sum + chrVariants.length, 0);
            const chromosomes = Object.keys(variants);
            
            const metadata = {
                id: fileId,
                name: baseName,
                originalName: baseName,
                path: filePath,
                type: 'vcf',
                loadTime: new Date(),
                size: fileData.length,
                variantCount: variantCount,
                chromosomes: chromosomes,
                isVisible: true
            };
            
            // Store VCF file data
            this.vcfFiles.set(fileId, {
                data: variants,
                metadata: metadata,
                trackId: `variants_${fileId}`
            });
            
            this.fileMetadata.set(fileId, metadata);
            
            console.log(`VCF file added successfully: ${fileId}, ${variantCount} variants`);
            return { fileId, metadata };
            
        } catch (error) {
            console.error('Error adding VCF file:', error);
            throw new Error(`Failed to add VCF file: ${error.message}`);
        }
    }

    /**
     * Parse VCF file data
     */
    parseVcfData(fileData) {
        const lines = fileData.split('\n');
        const variants = {};
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip header lines and empty lines
            if (trimmed.startsWith('#') || !trimmed) continue;
            
            const fields = trimmed.split('\t');
            if (fields.length < 8) continue;
            
            const [chrom, pos, id, ref, alt, qual, filter, info] = fields;
            
            if (!variants[chrom]) {
                variants[chrom] = [];
            }
            
            const variant = {
                chromosome: chrom,
                start: parseInt(pos) - 1, // Convert to 0-based
                end: parseInt(pos) - 1 + ref.length,
                id: id === '.' ? null : id,
                ref: ref,
                alt: alt,
                quality: qual === '.' ? null : parseFloat(qual),
                filter: filter,
                info: info
            };
            
            variants[chrom].push(variant);
        }
        
        return variants;
    }

    /**
     * Extract filename from path
     */
    extractFileName(filePath) {
        return filePath.split(/[/\\]/).pop().replace(/\.[^/.]+$/, '');
    }

    /**
     * Rename file
     */
    renameFile(fileId, newName) {
        if (!newName || newName.trim() === '') {
            throw new Error('File name cannot be empty');
        }
        
        const metadata = this.fileMetadata.get(fileId);
        if (!metadata) {
            throw new Error(`File not found: ${fileId}`);
        }
        
        const oldName = metadata.name;
        metadata.name = newName.trim();
        
        // Update metadata in file collections
        if (this.bamFiles.has(fileId)) {
            this.bamFiles.get(fileId).metadata.name = newName.trim();
        }
        if (this.vcfFiles.has(fileId)) {
            this.vcfFiles.get(fileId).metadata.name = newName.trim();
        }
        
        console.log(`File renamed: ${oldName} -> ${newName}`);
        return metadata;
    }

    /**
     * Remove file and cleanup
     */
    async removeFile(fileId) {
        const metadata = this.fileMetadata.get(fileId);
        if (!metadata) {
            throw new Error(`File not found: ${fileId}`);
        }
        
        console.log(`Removing file: ${metadata.name} (${fileId})`);
        
        try {
            // Clean up based on file type
            if (metadata.type === 'bam') {
                const bamFile = this.bamFiles.get(fileId);
                if (bamFile) {
                    // Reset BAM reader to free resources
                    if (bamFile.reader && bamFile.reader.reset) {
                        bamFile.reader.reset();
                    }
                    this.bamFiles.delete(fileId);
                }
            } else if (metadata.type === 'vcf') {
                this.vcfFiles.delete(fileId);
            }
            
            // Remove from metadata
            this.fileMetadata.delete(fileId);
            
            // Remove track visibility state
            const trackId = metadata.type === 'bam' ? `reads_${fileId}` : `variants_${fileId}`;
            this.trackVisibility.delete(trackId);
            
            console.log(`File removed successfully: ${fileId}`);
            return true;
            
        } catch (error) {
            console.error('Error removing file:', error);
            throw new Error(`Failed to remove file: ${error.message}`);
        }
    }

    /**
     * Get all loaded files
     */
    getAllFiles() {
        const files = [];
        
        // Add BAM files
        for (const [fileId, bamFile] of this.bamFiles) {
            files.push({
                ...bamFile.metadata,
                trackId: bamFile.trackId
            });
        }
        
        // Add VCF files
        for (const [fileId, vcfFile] of this.vcfFiles) {
            files.push({
                ...vcfFile.metadata,
                trackId: vcfFile.trackId
            });
        }
        
        return files.sort((a, b) => a.loadTime - b.loadTime);
    }

    /**
     * Get BAM files for reads rendering
     */
    getBamFiles() {
        return Array.from(this.bamFiles.values());
    }

    /**
     * Get VCF files for variant rendering
     */
    getVcfFiles() {
        return Array.from(this.vcfFiles.values());
    }

    /**
     * Get file by ID
     */
    getFile(fileId) {
        if (this.bamFiles.has(fileId)) {
            return this.bamFiles.get(fileId);
        }
        if (this.vcfFiles.has(fileId)) {
            return this.vcfFiles.get(fileId);
        }
        return null;
    }

    /**
     * Check if file exists
     */
    hasFile(fileId) {
        return this.fileMetadata.has(fileId);
    }

    /**
     * Get file metadata
     */
    getFileMetadata(fileId) {
        return this.fileMetadata.get(fileId);
    }

    /**
     * Set track visibility
     */
    setTrackVisibility(trackId, visible) {
        this.trackVisibility.set(trackId, visible);
    }

    /**
     * Get track visibility
     */
    getTrackVisibility(trackId) {
        return this.trackVisibility.get(trackId) !== false; // Default to true
    }

    /**
     * Get summary statistics
     */
    getSummary() {
        const bamCount = this.bamFiles.size;
        const vcfCount = this.vcfFiles.size;
        const totalSize = Array.from(this.fileMetadata.values())
            .reduce((sum, meta) => sum + (meta.size || 0), 0);
        
        const variantCount = Array.from(this.vcfFiles.values())
            .reduce((sum, vcfFile) => sum + (vcfFile.metadata.variantCount || 0), 0);
        
        return {
            totalFiles: bamCount + vcfCount,
            bamFiles: bamCount,
            vcfFiles: vcfCount,
            totalSize: totalSize,
            totalVariants: variantCount,
            loadedFiles: this.getAllFiles()
        };
    }

    /**
     * Clear all files
     */
    async clearAll() {
        console.log('Clearing all files from MultiFileManager');
        
        // Remove all BAM files
        for (const fileId of this.bamFiles.keys()) {
            await this.removeFile(fileId);
        }
        
        // Remove all VCF files
        for (const fileId of this.vcfFiles.keys()) {
            await this.removeFile(fileId);
        }
        
        // Reset counters
        this.fileCounter = 0;
        
        console.log('All files cleared from MultiFileManager');
    }
} 