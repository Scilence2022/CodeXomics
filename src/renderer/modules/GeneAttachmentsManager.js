// @ts-check
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
      allowedExtensions: [
        'pdf',
        'md',
        'txt',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'svg',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'csv',
        'json',
        'html',
      ],
      storageLocation: 'project', // 'project' or 'app'
    };

    this.ready = this.init();
  }

  getPathModule() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }
    return {
      basename: filePath =>
        String(filePath || '')
          .replace(/\\/g, '/')
          .split('/')
          .filter(Boolean)
          .pop() || '',
      dirname: filePath => {
        const normalized = String(filePath || '').replace(/\\/g, '/');
        const index = normalized.lastIndexOf('/');
        return index <= 0 ? (index === 0 ? '/' : '.') : normalized.slice(0, index);
      },
      extname: filePath => {
        const base =
          String(filePath || '')
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean)
            .pop() || '';
        const index = base.lastIndexOf('.');
        return index > 0 ? base.slice(index) : '';
      },
      join: (...parts) =>
        parts
          .filter(part => part !== undefined && part !== null && part !== '')
          .join('/')
          .replace(/\/+/g, '/'),
    };
  }

  async getFileInfo(filePath) {
    if (typeof window !== 'undefined' && window.electronAPI?.getSelectedFileInfo) {
      const result = await window.electronAPI.getSelectedFileInfo(filePath);
      if (result?.success) {
        return result.info;
      }
    }
    return null;
  }

  async fileExists(filePath) {
    if (typeof window !== 'undefined' && window.electronAPI?.checkFileExists) {
      const result = await window.electronAPI.checkFileExists(filePath);
      return !!result?.exists;
    }
    return false;
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
    const firstValue = value => {
      const candidate = Array.isArray(value) ? value[0] : value;
      return candidate === undefined || candidate === null ? '' : String(candidate).trim();
    };
    const locusTag = firstValue(gene.qualifiers?.locus_tag);
    const geneName = firstValue(gene.qualifiers?.gene);
    const product = firstValue(gene.qualifiers?.product);

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
      const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
      if (currentFilePath) {
        const path = this.getPathModule();
        const projectDir = path.dirname(currentFilePath);
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
            const path = this.getPathModule();
            const safeGeneId = geneId.replace(/[^a-zA-Z0-9_-]/g, '_');
            basePath = path.join(basePath, safeGeneId);
          }
          return basePath;
        }
      }

      const path = this.getPathModule();
      let attachmentsDir = path.join('/', 'gene_attachments');
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
    return [...(this.attachments.get(geneId) || [])].sort((left, right) => {
      const leftGenerated = left.kind === 'dgr-research-report' ? 1 : 0;
      const rightGenerated = right.kind === 'dgr-research-report' ? 1 : 0;
      if (leftGenerated !== rightGenerated) return rightGenerated - leftGenerated;
      if (leftGenerated) return String(right.addedDate || '').localeCompare(String(left.addedDate || ''));
      return 0;
    });
  }

  _supportsGeneratedResearchFeature(type) {
    return new Set([
      'CDS',
      'GENE',
      'MRNA',
      'TRNA',
      'RRNA',
      'NCRNA',
      'TMRNA',
      'MISC_RNA',
      'PRECURSOR_RNA',
      'MIRNA',
      'SNRNA',
      'SNORNA',
      'ANTISENSE_RNA',
      'GUIDE_RNA',
      'TELOMERASE_RNA',
      'RNASE_P_RNA',
      'RNASE_MRP_RNA',
      'PSEUDOGENE',
    ]).has(String(type || '').toUpperCase());
  }

  /**
   * Register a main-process archived DGR report as a durable gene attachment.
   * The report itself remains outside the renderer; only bounded metadata is
   * kept in the genome sidecar.
   */
  async registerGeneratedAttachment(geneId, descriptor, target) {
    await this.ready;
    const normalizedGeneId = String(geneId || '').trim();
    if (!normalizedGeneId) throw new Error('A gene identifier is required for a generated report attachment');
    if (!this._supportsGeneratedResearchFeature(target?.featureType)) {
      throw new Error('Deep Gene Research reports require a supported gene annotation feature');
    }
    const genomePath =
      this.genomeBrowser?.loadedGenomePath ||
      this.genomeBrowser?.fileManager?.currentFile?.path ||
      this.genomeBrowser?.currentFile?.path ||
      null;
    if (!genomePath || !this.sidecarManager) {
      throw new Error(
        'Save the genome before archiving a generated DGR report so its attachment remains genome-scoped'
      );
    }
    const taskId = String(descriptor?.taskId || '').trim();
    const sha256 = String(descriptor?.sha256 || '').toLowerCase();
    const proposalSha256 = String(descriptor?.proposalSha256 || '').toLowerCase();
    const storedPath = String(descriptor?.storedPath || '');
    const filename = String(descriptor?.fileName || '');
    const size = Number(descriptor?.size);
    if (!taskId || taskId.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(taskId)) {
      throw new Error('Generated DGR attachment has an invalid task identifier');
    }
    if (!/^[a-f0-9]{64}$/.test(sha256) || !storedPath || !filename.toLowerCase().endsWith('.json')) {
      throw new Error('Generated DGR attachment is missing verified JSON artifact metadata');
    }
    if (
      !/^[a-f0-9]{64}$/.test(proposalSha256) ||
      descriptor?.citationValidation?.schema !== 'codexomics.dgr-citation-validation.v1' ||
      descriptor.citationValidation.verified !== true
    ) {
      throw new Error('Generated DGR attachment is missing verified proposal and citation provenance');
    }
    const currentAnnotationValidation = descriptor?.currentAnnotationValidation;
    const validVerifiedSnapshot =
      currentAnnotationValidation?.verified === true &&
      /^[a-f0-9]{64}$/.test(String(currentAnnotationValidation.snapshotSha256 || '').toLowerCase());
    const validLegacySnapshot =
      currentAnnotationValidation?.verified === false &&
      currentAnnotationValidation?.required === false &&
      currentAnnotationValidation?.snapshotSha256 === null;
    if (
      currentAnnotationValidation?.schema !== 'codexomics.dgr-current-annotation-validation.v1' ||
      (!validVerifiedSnapshot && !validLegacySnapshot) ||
      String(currentAnnotationValidation.targetFeatureHash || '') !== String(target.featureHash || '')
    ) {
      throw new Error('Generated DGR attachment is missing a valid current-annotation verification receipt');
    }
    if (!Number.isSafeInteger(size) || size < 1 || size > 16 * 1024 * 1024) {
      throw new Error('Generated DGR attachment exceeds the supported report size');
    }
    const attachmentId = `dgr:${taskId}`;
    for (const [existingGeneId, existingAttachments] of this.attachments) {
      const existing = existingAttachments.find(item => item.id === attachmentId);
      if (!existing) continue;
      if (
        existingGeneId !== normalizedGeneId ||
        existing.sha256 !== sha256 ||
        existing.storedPath !== storedPath ||
        JSON.stringify(existing.currentAnnotationValidation) !== JSON.stringify(currentAnnotationValidation)
      ) {
        throw new Error(`DGR task ${taskId} is already attached with different target or content`);
      }
      return existing;
    }

    const summaryCount = value =>
      Number.isSafeInteger(Number(value)) ? Math.max(0, Math.min(100000, Number(value))) : 0;
    const summary =
      descriptor.summary && typeof descriptor.summary === 'object'
        ? {
            title: String(descriptor.summary.title || '').slice(0, 512),
            sourceCount: summaryCount(descriptor.summary.sourceCount),
            confidence: Number.isFinite(Number(descriptor.summary.confidence))
              ? Math.max(0, Math.min(1, Number(descriptor.summary.confidence)))
              : null,
            literatureCount: summaryCount(descriptor.summary.literatureCount),
            directLiteratureCount: summaryCount(descriptor.summary.directLiteratureCount),
            geneLinkedContextCount: summaryCount(descriptor.summary.geneLinkedContextCount),
            citationBoundFactCount: summaryCount(descriptor.summary.citationBoundFactCount),
            fullTextSourceCount: summaryCount(descriptor.summary.fullTextSourceCount),
            fullTextFindingCount: summaryCount(descriptor.summary.fullTextFindingCount),
          }
        : {
            title: '',
            sourceCount: 0,
            confidence: null,
            literatureCount: 0,
            directLiteratureCount: 0,
            geneLinkedContextCount: 0,
            citationBoundFactCount: 0,
            fullTextSourceCount: 0,
            fullTextFindingCount: 0,
          };
    const attachment = {
      id: attachmentId,
      kind: 'dgr-research-report',
      geneId: normalizedGeneId,
      filename,
      storedFilename: filename,
      storedPath,
      originalPath: null,
      extension: 'json',
      mimeType: 'application/json',
      size,
      sizeFormatted: this.formatFileSize(size),
      addedDate: descriptor.storedAt || new Date().toISOString(),
      description: summary.title || 'Full Deep Gene Research report',
      taskId,
      sha256,
      proposalSha256,
      source: 'deep-gene-research',
      integrity: 'sha256',
      citationValidation: {
        schema: 'codexomics.dgr-citation-validation.v1',
        verified: true,
        factCount: summaryCount(descriptor.citationValidation.factCount),
        pubMedSourceCount: summaryCount(descriptor.citationValidation.pubMedSourceCount),
        verifiedPubMedSourceCount: summaryCount(descriptor.citationValidation.verifiedPubMedSourceCount),
        fullTextSourceCount: summaryCount(descriptor.citationValidation.fullTextSourceCount),
        verifiedFullTextSourceCount: summaryCount(descriptor.citationValidation.verifiedFullTextSourceCount),
      },
      currentAnnotationValidation: {
        schema: 'codexomics.dgr-current-annotation-validation.v1',
        verified: currentAnnotationValidation.verified === true,
        required: currentAnnotationValidation.required === true,
        snapshotSha256: validVerifiedSnapshot ? String(currentAnnotationValidation.snapshotSha256).toLowerCase() : null,
        targetFeatureHash: String(currentAnnotationValidation.targetFeatureHash),
      },
      target: {
        workspaceId: target.workspaceId,
        genomeId: target.genomeId,
        annotationRevision: target.annotationRevision,
        featureId: target.featureId,
        featureHash: target.featureHash,
        chromosome: target.chromosome,
        locusTag: target.locusTag || null,
        geneSymbol: target.geneSymbol || null,
        proteinId: target.proteinId || null,
        featureType: target.featureType,
      },
      summary,
    };
    if (!this.attachments.has(normalizedGeneId)) this.attachments.set(normalizedGeneId, []);
    const geneAttachments = this.attachments.get(normalizedGeneId);
    geneAttachments.push(attachment);
    try {
      await this.saveAttachmentMetadata({ durable: true, throwOnError: true });
    } catch (error) {
      geneAttachments.pop();
      if (geneAttachments.length === 0) this.attachments.delete(normalizedGeneId);
      throw error;
    }
    const selectedGeneId = this.getGeneIdentifier(this.genomeBrowser?.selectedGene?.gene);
    if (selectedGeneId === normalizedGeneId && typeof this.genomeBrowser?.refreshGeneAttachments === 'function') {
      this.genomeBrowser.refreshGeneAttachments(normalizedGeneId);
    }
    return attachment;
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

        if (window.electronAPI?.selectMultipleFiles) {
          result = await window.electronAPI.selectMultipleFiles();
        } else if (window.electronAPI?.selectAttachmentFiles) {
          result = await window.electronAPI.selectAttachmentFiles({
            title: 'Select Attachment Files',
            filters: [
              { name: 'All Supported Files', extensions: this.settings.allowedExtensions },
              { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile', 'multiSelections'],
          });
        } else if (window.ipcRenderer?.invoke) {
          result = await window.ipcRenderer.invoke('selectMultipleFiles');
        } else {
          console.error('No file selection method available!');
          this.showNotification('File selection not available', 'error');
          return null;
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
   * Register a user PDF as a content-addressed input to Deep Gene Research.
   * Repeated workflows reuse the same genome-scoped attachment by SHA-256.
   */
  async registerResearchSourceAttachment(geneId, sourcePath, document) {
    await this.ready;
    const sha256 = String(document?.sha256 || '').trim().toLowerCase();
    const documentId = String(document?.documentId || '').trim();
    if (!geneId || !/^[a-f0-9]{64}$/.test(sha256) || documentId !== `sha256:${sha256}`) {
      throw new Error('DGR research source attachment requires verified document metadata');
    }
    const existing = (this.attachments.get(geneId) || []).find(
      attachment => attachment.kind === 'dgr-research-source' && attachment.sha256 === sha256
    );
    if (existing) return existing;

    const attachment = await this.processAndStoreFile(geneId, sourcePath);
    if (!attachment) throw new Error(`Could not store research PDF ${document?.name || sourcePath}`);
    Object.assign(attachment, {
      kind: 'dgr-research-source',
      sha256,
      dgrDocumentId: documentId,
      mimeType: 'application/pdf',
      description: 'User-provided full-text source for Deep Gene Research',
      researchSource: {
        schema: 'codexomics.dgr-research-source.v1',
        documentId,
        uploadedAt: String(document.uploadedAt || new Date().toISOString()),
        size: Number(document.size || attachment.size || 0),
      },
    });
    try {
      await this.saveAttachmentMetadata({ durable: true, throwOnError: true });
    } catch (error) {
      const geneAttachments = this.attachments.get(geneId) || [];
      const index = geneAttachments.findIndex(item => item.id === attachment.id);
      if (index >= 0) geneAttachments.splice(index, 1);
      if (geneAttachments.length === 0) this.attachments.delete(geneId);
      throw error;
    }
    return attachment;
  }

  async markResearchSourceAttachment(geneId, attachmentId, document) {
    await this.ready;
    const attachment = (this.attachments.get(geneId) || []).find(item => item.id === attachmentId);
    if (!attachment || attachment.extension !== 'pdf') {
      throw new Error(`Research source attachment ${attachmentId} is not a PDF for ${geneId}`);
    }
    const sha256 = String(document?.sha256 || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sha256) || document?.documentId !== `sha256:${sha256}`) {
      throw new Error('Research source attachment metadata failed content-address verification');
    }
    const previous = { ...attachment };
    Object.assign(attachment, {
      kind: 'dgr-research-source',
      sha256,
      dgrDocumentId: document.documentId,
      mimeType: 'application/pdf',
      description: 'User-provided full-text source for Deep Gene Research',
      researchSource: {
        schema: 'codexomics.dgr-research-source.v1',
        documentId: document.documentId,
        uploadedAt: String(document.uploadedAt || new Date().toISOString()),
        size: Number(document.size || attachment.size || 0),
      },
    });
    try {
      await this.saveAttachmentMetadata({ durable: true, throwOnError: true });
    } catch (error) {
      for (const key of Object.keys(attachment)) delete attachment[key];
      Object.assign(attachment, previous);
      throw error;
    }
    return attachment;
  }

  /**
   * Process and store a file as an attachment
   */
  async processAndStoreFile(geneId, sourcePath) {
    try {
      const path = this.getPathModule();

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
        const fileInfo = await this.getFileInfo(sourcePath);
        fileSize = fileInfo?.size || 0;

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

      // Generate unique filename to avoid conflicts
      const attachmentId = this.generateAttachmentId();
      const storedFilename = `${attachmentId}_${filename}`;
      const storedPath = path.join(storagePath, storedFilename);

      // Copy file to storage location
      if (!window.electronAPI?.copyAttachmentFile) {
        throw new Error('Main-process attachment copy API is unavailable');
      }
      const copyResult = await window.electronAPI.copyAttachmentFile(sourcePath, storagePath, storedFilename);
      if (!copyResult?.success) {
        throw new Error(copyResult?.error || `Failed to copy attachment: ${filename}`);
      }

      // Create attachment metadata
      const attachment = {
        id: attachmentId,
        geneId: geneId,
        filename: filename,
        storedFilename: storedFilename,
        storedPath: copyResult.targetPath || storedPath,
        originalPath: sourcePath,
        extension: ext,
        mimeType: this.getMimeType(ext),
        size: copyResult.size || fileSize,
        sizeFormatted: this.formatFileSize(copyResult.size || fileSize),
        addedDate: new Date().toISOString(),
        description: '',
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
        if (window.electronAPI?.deleteAttachmentFile) {
          await window.electronAPI.deleteAttachmentFile(attachment.storedPath);
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

      if (!(await this.fileExists(attachment.storedPath))) {
        this.showNotification('Attachment file not found', 'error');
        return false;
      }

      if (attachment.kind === 'dgr-research-report') {
        if (!window.electronAPI?.openDgrJsonViewer) {
          throw new Error('The secure DGR JSON viewer is unavailable');
        }
        const viewerResult = await window.electronAPI.openDgrJsonViewer({
          storedPath: attachment.storedPath,
          expectedSha256: attachment.sha256,
          title: attachment.summary?.title || attachment.filename,
        });
        if (!viewerResult?.success) {
          throw new Error(viewerResult?.error || `Failed to open DGR report: ${attachment.filename}`);
        }
        return true;
      }

      // For markdown files, optionally use the built-in markdown viewer
      if (attachment.extension === 'md' && window.electronAPI && window.electronAPI.openMarkdownViewer) {
        try {
          await window.electronAPI.openMarkdownViewer({
            filePath: attachment.storedPath,
            title: attachment.filename,
          });
          return true;
        } catch (e) {
          console.warn('Markdown viewer failed, falling back to system default:', e);
        }
      }

      if (!window.electronAPI?.openAttachmentFile) {
        throw new Error('Main-process attachment open API is unavailable');
      }
      const openResult = await window.electronAPI.openAttachmentFile(attachment.storedPath);
      if (!openResult?.success) {
        throw new Error(openResult?.error || `Failed to open attachment: ${attachment.filename}`);
      }
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
  async saveAttachmentMetadata(options = {}) {
    try {
      // Convert Map to plain object for storage
      const metadata = {};
      for (const [geneId, attachments] of this.attachments) {
        metadata[geneId] = attachments;
      }

      // Use sidecar manager if available and file is loaded
      const currentFilePath = this.genomeBrowser?.fileManager?.currentFile?.path;
      if (this.sidecarManager && currentFilePath) {
        if (options.durable && typeof this.sidecarManager.setAndForceSave === 'function') {
          await this.sidecarManager.setAndForceSave(currentFilePath, 'geneAttachments', metadata);
        } else {
          await this.sidecarManager.set(currentFilePath, 'geneAttachments', metadata);
        }
        console.log('💾 Saved attachment metadata to sidecar file');
      } else if (this.configManager) {
        // Fallback to ConfigManager (legacy behavior)
        this.configManager.set('geneAttachments.metadata', metadata);
        console.log('💾 Saved attachment metadata to config (fallback)');
      } else {
        throw new Error('No attachment metadata store is available');
      }
      return true;
    } catch (error) {
      console.error('Error saving attachment metadata:', error);
      if (options.throwOnError) throw error;
      return false;
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
        metadata = (await this.sidecarManager.get(currentFilePath, 'geneAttachments')) || {};
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
          const validAttachments = [];
          for (const att of attachments) {
            if (await this.fileExists(att.storedPath)) {
              validAttachments.push(att);
            }
          }

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
    this.ready = this.loadAttachmentMetadata();
    await this.ready;
  }

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  escapeInlineJsString(value) {
    return String(value ?? '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
      .replace(/</g, '\\x3c')
      .replace(/>/g, '\\x3e');
  }

  renderAttachmentsList(geneId) {
    const attachments = this.getAttachmentsForGene(geneId);
    if (attachments.length === 0) {
      return `
                <div class="gene-attachments-empty">
                    <i class="fas fa-file-upload"></i>
                    <p>No attachments yet</p>
                    <small>Click "Add" to attach files to this gene</small>
                </div>
            `;
    }
    const escapedGeneId = this.escapeInlineJsString(geneId);
    return attachments
      .map(attachment => {
        const icon = this.getFileIcon(attachment.extension);
        const escapedId = this.escapeInlineJsString(attachment.id);
        const filename = this.escapeHtml(attachment.filename);
        const reportBadge =
          attachment.kind === 'dgr-research-report'
            ? '<span class="gene-attachment-generated-badge">DGR full report</span>'
            : attachment.kind === 'dgr-research-source'
              ? '<span class="gene-attachment-generated-badge">DGR source PDF</span>'
              : '';
        const sourceCount =
          attachment.kind === 'dgr-research-report' && attachment.summary?.sourceCount
            ? ` • ${this.escapeHtml(attachment.summary.sourceCount)} sources`
            : '';
        const literatureCount =
          attachment.kind === 'dgr-research-report' && attachment.summary?.literatureCount
            ? ` • ${this.escapeHtml(attachment.summary.literatureCount)} papers`
            : '';
        const findingCount =
          attachment.kind === 'dgr-research-report' && attachment.summary?.citationBoundFactCount
            ? ` • ${this.escapeHtml(attachment.summary.citationBoundFactCount)} cited findings`
            : '';
        const fullTextCount =
          attachment.kind === 'dgr-research-report' && attachment.summary?.fullTextSourceCount
            ? ` • ${this.escapeHtml(attachment.summary.fullTextSourceCount)} full texts`
            : '';
        return `
                    <div class="gene-attachment-item" data-attachment-id="${this.escapeHtml(attachment.id)}">
                        <div class="gene-attachment-icon">
                            <i class="${icon}"></i>
                        </div>
                        <div class="gene-attachment-info">
                            <div class="gene-attachment-name" title="${filename}">
                                ${filename} ${reportBadge}
                            </div>
                            <div class="gene-attachment-meta">
                                ${this.escapeHtml(attachment.sizeFormatted)} • ${this.escapeHtml(this.formatDate(attachment.addedDate))}${sourceCount}${literatureCount}${findingCount}${fullTextCount}
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
      })
      .join('');
  }

  /**
   * Render attachments section HTML for a gene
   */
  renderAttachmentsSection(geneId) {
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
    html += this.renderAttachmentsList(geneId);

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
      pdf: 'fas fa-file-pdf',
      md: 'fas fa-file-alt',
      txt: 'fas fa-file-alt',
      doc: 'fas fa-file-word',
      docx: 'fas fa-file-word',
      xls: 'fas fa-file-excel',
      xlsx: 'fas fa-file-excel',
      csv: 'fas fa-file-csv',
      json: 'fas fa-file-code',
      html: 'fas fa-file-code',
      png: 'fas fa-file-image',
      jpg: 'fas fa-file-image',
      jpeg: 'fas fa-file-image',
      gif: 'fas fa-file-image',
      svg: 'fas fa-file-image',
    };

    return iconMap[extension?.toLowerCase()] || 'fas fa-file';
  }

  /**
   * Get MIME type for file extension
   */
  getMimeType(extension) {
    const mimeTypes = {
      pdf: 'application/pdf',
      md: 'text/markdown',
      txt: 'text/plain',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
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
        day: 'numeric',
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
    for (const [, attachments] of this.attachments) {
      for (const attachment of attachments) {
        try {
          if (window.electronAPI?.deleteAttachmentFile) {
            await window.electronAPI.deleteAttachmentFile(attachment.storedPath);
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
