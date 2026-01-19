/**
 * GeneAttachmentsManager - Manages file attachments for genes
 * Allows users to upload, view, and manage files (PDF, Markdown, images, etc.) for each gene
 */

class GeneAttachmentsManager {
    constructor(genomeBrowser, configManager, sidecarManager = null) {
        this.genomeBrowser = genomeBrowser;
        this.configManager = configManager;
        this.sidecarManager = sidecarManager;
        this.attachments = new Map(); // geneId -> [attachment objects]
        this.settings = {
            maxFileSizeMB: 50,
            allowedExtensions: ['pdf', 'md', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'json', 'html'],
            storageLocation: 'project' // 'project' or 'app'
        };

        this.init();
    }

    /**
     * Initialize the manager and load saved attachments
     */
    async init() {
        try {
            await this.loadAttachmentMetadata();
            console.log('🔗 GeneAttachmentsManager initialized');
        } catch (error) {
            console.error('Error initializing GeneAttachmentsManager:', error);
        }
    }

    /**
     * Generate a unique attachment ID
     */
    generateAttachmentId() {
        return `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get the gene identifier from a gene object
     */
    getGeneIdentifier(gene) {
        if (!gene) return null;

        // Use locus_tag, gene name, or create a position-based ID
        const locusTag = gene.qualifiers?.locus_tag;
        const geneName = gene.qualifiers?.gene;
        const product = gene.qualifiers?.product;

        if (locusTag) return locusTag;
        if (geneName) return geneName;
        if (product) return `${gene.type}_${gene.start}_${gene.end}`;

        return `${gene.type}_${gene.start}_${gene.end}`;
    }

    /**
     * Get the storage path for attachments
     */
    async getAttachmentsStoragePath(geneId = null) {
        try {
            // Try to get project-based storage first
            if (this.genomeBrowser.currentFilePath) {
                const path = require('path');
                const projectDir = path.dirname(this.genomeBrowser.currentFilePath);
                let attachmentsDir = path.join(projectDir, 'attachments');

                if (geneId) {
                    // Sanitize gene ID for filesystem
                    const safeGeneId = geneId.replace(/[^a-zA-Z0-9_-]/g, '_');
                    attachmentsDir = path.join(attachmentsDir, safeGeneId);
                }

                return attachmentsDir;
            }

            // Fallback to app config directory
            if (window.electronAPI && window.electronAPI.getAttachmentsStoragePath) {
                const result = await window.electronAPI.getAttachmentsStoragePath();
                if (result.success) {
                    let basePath = result.path;
                    if (geneId) {
                        const path = require('path');
                        const safeGeneId = geneId.replace(/[^a-zA-Z0-9_-]/g, '_');
                        basePath = path.join(basePath, safeGeneId);
                    }
                    return basePath;
                }
            }

            // Final fallback - use current working directory
            const path = require('path');
            let attachmentsDir = path.join(process.cwd(), 'gene_attachments');
            if (geneId) {
                const safeGeneId = geneId.replace(/[^a-zA-Z0-9_-]/g, '_');
                attachmentsDir = path.join(attachmentsDir, safeGeneId);
            }
            return attachmentsDir;

        } catch (error) {
            console.error('Error getting attachments storage path:', error);
            return null;
        }
    }

    /**
     * Get all attachments for a specific gene
     */
    getAttachmentsForGene(geneId) {
        if (!geneId) return [];
        return this.attachments.get(geneId) || [];
    }

    /**
     * Add an attachment to a gene
     * @param {string} geneId - The gene identifier
     * @param {Object} fileInfo - Object containing file information
     */
    async addAttachment(geneId, fileInfo = null) {
        if (!geneId) {
            this.showNotification('No gene selected', 'error');
            return null;
        }

        try {
            // If no fileInfo provided, open file selection dialog
            if (!fileInfo) {
                let result = null;

                // Use ipcRenderer directly for file selection (most reliable)
                try {
                    const { ipcRenderer } = require('electron');
                    console.log('📎 Using direct ipcRenderer for file selection');

                    // Use the existing 'selectMultipleFiles' IPC handler
                    result = await ipcRenderer.invoke('selectMultipleFiles');
                    console.log('File selection result:', result);
                } catch (ipcError) {
                    console.warn('Direct ipcRenderer failed, trying electronAPI fallback:', ipcError);

                    // Fallback to electronAPI if ipcRenderer is not available
                    if (window.electronAPI && window.electronAPI.selectMultipleFiles) {
                        result = await window.electronAPI.selectMultipleFiles();
                    } else if (window.electronAPI && window.electronAPI.selectAttachmentFiles) {
                        result = await window.electronAPI.selectAttachmentFiles({
                            title: 'Select Attachment Files',
                            filters: [
                                { name: 'All Supported Files', extensions: this.settings.allowedExtensions },
                                { name: 'All Files', extensions: ['*'] }
                            ],
                            properties: ['openFile', 'multiSelections']
                        });
                    } else {
                        console.error('No file selection method available!');
                        this.showNotification('File selection not available', 'error');
                        return null;
                    }
                }



                if (!result.success || !result.filePaths || result.filePaths.length === 0) {
                    console.log('File selection cancelled');
                    return null;
                }


                // Process each selected file
                const addedAttachments = [];
                for (const filePath of result.filePaths) {
                    const attachment = await this.processAndStoreFile(geneId, filePath);
                    if (attachment) {
                        addedAttachments.push(attachment);
                    }
                }

                if (addedAttachments.length > 0) {
                    await this.saveAttachmentMetadata();
                    this.showNotification(`Added ${addedAttachments.length} attachment(s)`, 'success');
                    return addedAttachments;
                }

                return null;
            } else {
                // Process provided file info
                const attachment = await this.processAndStoreFile(geneId, fileInfo.path);
                if (attachment) {
                    await this.saveAttachmentMetadata();
                    this.showNotification('Attachment added', 'success');
                    return attachment;
                }
                return null;
            }
        } catch (error) {
            console.error('Error adding attachment:', error);
            this.showNotification(`Failed to add attachment: ${error.message}`, 'error');
            return null;
        }
    }

    /**
     * Process and store a file as an attachment
     */
    async processAndStoreFile(geneId, sourcePath) {
        try {
            const path = require('path');
            const fs = require('fs');

            // Get file info
            const filename = path.basename(sourcePath);
            const ext = path.extname(filename).toLowerCase().replace('.', '');

            // Validate file extension
            if (!this.settings.allowedExtensions.includes(ext) && ext !== '') {
                console.warn(`File extension '${ext}' not in allowed list, but allowing anyway`);
            }

            // Get file stats
            let fileSize = 0;
            try {
                const stats = fs.statSync(sourcePath);
                fileSize = stats.size;

                // Check file size
                const maxSizeBytes = this.settings.maxFileSizeMB * 1024 * 1024;
                if (fileSize > maxSizeBytes) {
                    this.showNotification(`File too large (max ${this.settings.maxFileSizeMB}MB)`, 'error');
                    return null;
                }
            } catch (e) {
                console.warn('Could not get file stats:', e);
            }

            // Get storage path for this gene
            const storagePath = await this.getAttachmentsStoragePath(geneId);
            if (!storagePath) {
                throw new Error('Could not determine storage path');
            }

            // Ensure storage directory exists
            if (!fs.existsSync(storagePath)) {
                fs.mkdirSync(storagePath, { recursive: true });
            }

            // Generate unique filename to avoid conflicts
            const attachmentId = this.generateAttachmentId();
            const storedFilename = `${attachmentId}_${filename}`;
            const storedPath = path.join(storagePath, storedFilename);

            // Copy file to storage location
            fs.copyFileSync(sourcePath, storedPath);

            // Create attachment metadata
            const attachment = {
                id: attachmentId,
                geneId: geneId,
                filename: filename,
                storedFilename: storedFilename,
                storedPath: storedPath,
                originalPath: sourcePath,
                extension: ext,
                mimeType: this.getMimeType(ext),
                size: fileSize,
                sizeFormatted: this.formatFileSize(fileSize),
                addedDate: new Date().toISOString(),
                description: ''
            };

            // Add to attachments map
            if (!this.attachments.has(geneId)) {
                this.attachments.set(geneId, []);
            }
            this.attachments.get(geneId).push(attachment);

            console.log(`📎 Attachment added for gene ${geneId}:`, attachment.filename);
            return attachment;

        } catch (error) {
            console.error('Error processing file:', error);
            throw error;
        }
    }

    /**
     * Remove an attachment from a gene
     */
    async removeAttachment(geneId, attachmentId) {
        if (!geneId || !attachmentId) return false;

        try {
            const attachments = this.attachments.get(geneId);
            if (!attachments) return false;

            const attachmentIndex = attachments.findIndex(a => a.id === attachmentId);
            if (attachmentIndex === -1) return false;

            const attachment = attachments[attachmentIndex];

            // Delete the physical file
            try {
                const fs = require('fs');
                if (fs.existsSync(attachment.storedPath)) {
                    fs.unlinkSync(attachment.storedPath);
                    console.log(`🗑️ Deleted attachment file: ${attachment.storedPath}`);
                }
            } catch (e) {
                console.warn('Could not delete attachment file:', e);
            }

            // Remove from array
            attachments.splice(attachmentIndex, 1);

            // Save updated metadata
            await this.saveAttachmentMetadata();
            this.showNotification('Attachment removed', 'success');

            return true;

        } catch (error) {
            console.error('Error removing attachment:', error);
            this.showNotification(`Failed to remove attachment: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Open an attachment in the system's default application
     */
    async openAttachment(attachmentId, geneId) {
        try {
            const attachments = this.attachments.get(geneId);
            if (!attachments) {
                this.showNotification('Attachment not found', 'error');
                return false;
            }

            const attachment = attachments.find(a => a.id === attachmentId);
            if (!attachment) {
                this.showNotification('Attachment not found', 'error');
                return false;
            }

            // Check if file exists
            const fs = require('fs');
            if (!fs.existsSync(attachment.storedPath)) {
                this.showNotification('Attachment file not found', 'error');
                return false;
            }

            // For markdown files, optionally use the built-in markdown viewer
            if (attachment.extension === 'md' && window.electronAPI && window.electronAPI.openMarkdownViewer) {
                try {
                    await window.electronAPI.openMarkdownViewer({
                        filePath: attachment.storedPath,
                        title: attachment.filename
                    });
                    return true;
                } catch (e) {
                    console.warn('Markdown viewer failed, falling back to system default:', e);
                }
            }

            // Open with system default application
            const { shell } = require('electron');
            await shell.openPath(attachment.storedPath);
            return true;

        } catch (error) {
            console.error('Error opening attachment:', error);
            this.showNotification(`Failed to open attachment: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * Update attachment description
     */
    async updateAttachmentDescription(geneId, attachmentId, description) {
        const attachments = this.attachments.get(geneId);
        if (!attachments) return false;

        const attachment = attachments.find(a => a.id === attachmentId);
        if (!attachment) return false;

        attachment.description = description;
        await this.saveAttachmentMetadata();
        return true;
    }

    /**
     * Save attachment metadata to sidecar file (or fallback to ConfigManager)
     */
    async saveAttachmentMetadata() {
        try {
            // Convert Map to plain object for storage
            const metadata = {};
            for (const [geneId, attachments] of this.attachments) {
                metadata[geneId] = attachments;
            }

            // Use sidecar manager if available and file is loaded
            const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
            if (this.sidecarManager && currentFilePath) {
                await this.sidecarManager.set(currentFilePath, 'geneAttachments', metadata);
                console.log('💾 Saved attachment metadata to sidecar file');
            } else if (this.configManager) {
                // Fallback to ConfigManager (legacy behavior)
                this.configManager.set('geneAttachments.metadata', metadata);
                console.log('💾 Saved attachment metadata to config (fallback)');
            }
        } catch (error) {
            console.error('Error saving attachment metadata:', error);
        }
    }

    /**
     * Load attachment metadata from sidecar file (or fallback to ConfigManager)
     */
    async loadAttachmentMetadata() {
        try {
            let metadata = {};

            // Use sidecar manager if available and file is loaded
            const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
            if (this.sidecarManager && currentFilePath) {
                metadata = await this.sidecarManager.get(currentFilePath, 'geneAttachments') || {};
                console.log(`📂 Loading attachment metadata from sidecar file: ${currentFilePath}`);
            } else if (this.configManager) {
                // Fallback to ConfigManager (legacy behavior)
                metadata = this.configManager.get('geneAttachments.metadata', {});
                console.log('📂 Loading attachment metadata from config (fallback)');
            }

            // Convert plain object back to Map
            this.attachments.clear();
            for (const [geneId, attachments] of Object.entries(metadata)) {
                if (Array.isArray(attachments)) {
                    // Validate that files still exist
                    const validAttachments = attachments.filter(att => {
                        try {
                            const fs = require('fs');
                            return fs.existsSync(att.storedPath);
                        } catch (e) {
                            return false;
                        }
                    });

                    if (validAttachments.length > 0) {
                        this.attachments.set(geneId, validAttachments);
                    }

                    // Log if any attachments were removed due to missing files
                    const removedCount = attachments.length - validAttachments.length;
                    if (removedCount > 0) {
                        console.warn(`⚠️ Removed ${removedCount} attachments for gene ${geneId} (files not found)`);
                    }
                }
            }

            console.log(`📂 Loaded attachments for ${this.attachments.size} genes`);
        } catch (error) {
            console.error('Error loading attachment metadata:', error);
        }
    }

    /**
     * Reload attachments for the current file (call when file changes)
     */
    async reloadForFile() {
        await this.loadAttachmentMetadata();
    }

    /**
     * Render attachments section HTML for a gene
     */
    renderAttachmentsSection(geneId) {
        const attachments = this.getAttachmentsForGene(geneId);

        let html = `
            <div class="gene-attachments">
                <div class="gene-attachments-header">
                    <h4><i class="fas fa-paperclip"></i> Attachments</h4>
                    <button class="btn btn-sm gene-add-attachment-btn" 
                            onclick="window.genomeBrowser.addGeneAttachment()"
                            title="Add attachment files">
                        <i class="fas fa-plus"></i> Add
                    </button>
                </div>
                <div class="gene-attachments-list" id="geneAttachmentsList">
        `;

        if (attachments.length === 0) {
            html += `
                <div class="gene-attachments-empty">
                    <i class="fas fa-file-upload"></i>
                    <p>No attachments yet</p>
                    <small>Click "Add" to attach files to this gene</small>
                </div>
            `;
        } else {
            for (const attachment of attachments) {
                const icon = this.getFileIcon(attachment.extension);
                const escapedId = attachment.id.replace(/'/g, "\\'");
                const escapedGeneId = geneId.replace(/'/g, "\\'");

                html += `
                    <div class="gene-attachment-item" data-attachment-id="${attachment.id}">
                        <div class="gene-attachment-icon">
                            <i class="${icon}"></i>
                        </div>
                        <div class="gene-attachment-info">
                            <div class="gene-attachment-name" title="${attachment.filename}">
                                ${attachment.filename}
                            </div>
                            <div class="gene-attachment-meta">
                                ${attachment.sizeFormatted} • ${this.formatDate(attachment.addedDate)}
                            </div>
                        </div>
                        <div class="gene-attachment-actions">
                            <button class="gene-attachment-btn open-btn" 
                                    onclick="window.genomeBrowser.openGeneAttachment('${escapedId}', '${escapedGeneId}')"
                                    title="Open file">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                            <button class="gene-attachment-btn delete-btn" 
                                    onclick="window.genomeBrowser.removeGeneAttachment('${escapedId}', '${escapedGeneId}')"
                                    title="Remove attachment">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Get appropriate icon for file type
     */
    getFileIcon(extension) {
        const iconMap = {
            'pdf': 'fas fa-file-pdf',
            'md': 'fas fa-file-alt',
            'txt': 'fas fa-file-alt',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'csv': 'fas fa-file-csv',
            'json': 'fas fa-file-code',
            'html': 'fas fa-file-code',
            'png': 'fas fa-file-image',
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'gif': 'fas fa-file-image',
            'svg': 'fas fa-file-image'
        };

        return iconMap[extension?.toLowerCase()] || 'fas fa-file';
    }

    /**
     * Get MIME type for file extension
     */
    getMimeType(extension) {
        const mimeTypes = {
            'pdf': 'application/pdf',
            'md': 'text/markdown',
            'txt': 'text/plain',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'csv': 'text/csv',
            'json': 'application/json',
            'html': 'text/html',
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'svg': 'image/svg+xml'
        };

        return mimeTypes[extension?.toLowerCase()] || 'application/octet-stream';
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Format date for display
     */
    formatDate(isoString) {
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return 'Unknown date';
        }
    }

    /**
     * Show notification using genome browser's method
     */
    showNotification(message, type = 'info') {
        if (this.genomeBrowser && typeof this.genomeBrowser.showNotification === 'function') {
            this.genomeBrowser.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Get total attachment count across all genes
     */
    getTotalAttachmentCount() {
        let count = 0;
        for (const attachments of this.attachments.values()) {
            count += attachments.length;
        }
        return count;
    }

    /**
     * Clear all attachments (for testing/reset)
     */
    async clearAllAttachments() {
        // Delete all physical files
        for (const [geneId, attachments] of this.attachments) {
            for (const attachment of attachments) {
                try {
                    const fs = require('fs');
                    if (fs.existsSync(attachment.storedPath)) {
                        fs.unlinkSync(attachment.storedPath);
                    }
                } catch (e) {
                    console.warn('Could not delete file:', e);
                }
            }
        }

        this.attachments.clear();
        await this.saveAttachmentMetadata();
        console.log('🗑️ Cleared all attachments');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeneAttachmentsManager;
}

// Make available globally
if (typeof window !== 'undefined') {
    window.GeneAttachmentsManager = GeneAttachmentsManager;
}
