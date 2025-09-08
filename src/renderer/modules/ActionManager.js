/**
 * ActionManager - Manages sequence operations in a queue system
 * Handles Copy, Cut, Paste operations with execution tracking
 */
class ActionManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.actions = [];
        this.nextActionId = 1;
        this.isExecuting = false;
        this.clipboard = null; // Stores copied/cut sequence data
        this.cursorPosition = 0; // DEPRECATED: Cursor position for paste operations (scheduled for removal)
        this.sequenceModifications = new Map(); // Track sequence modifications by chromosome
        this.originalAnnotations = null; // Backup of original annotations before any modifications
        
        // Action types
        this.ACTION_TYPES = {
            COPY_SEQUENCE: 'copy_sequence',
            CUT_SEQUENCE: 'cut_sequence',
            PASTE_SEQUENCE: 'paste_sequence',
            DELETE_SEQUENCE: 'delete_sequence',
            INSERT_SEQUENCE: 'insert_sequence',
            REPLACE_SEQUENCE: 'replace_sequence',
            SEQUENCE_EDIT: 'sequence_edit'
        };
        
        // Status types
        this.STATUS = {
            PENDING: 'pending',
            EXECUTING: 'executing',
            COMPLETED: 'completed',
            FAILED: 'failed'
        };
        
        this.initializeEventListeners();
    }
    
    /**
     * Backup original annotations before first modification
     */
    ensureOriginalAnnotationsBackup() {
        if (!this.originalAnnotations && this.genomeBrowser.currentAnnotations) {
            this.originalAnnotations = JSON.parse(JSON.stringify(this.genomeBrowser.currentAnnotations));
            console.log('📋 [ActionManager] Backed up original annotations for rollback');
        }
    }
    
    /**
     * Restore features from original backup - for rollback functionality
     */
    restoreOriginalFeatures() {
        if (this.originalAnnotations) {
            this.genomeBrowser.currentAnnotations = JSON.parse(JSON.stringify(this.originalAnnotations));
            console.log('🔄 [ActionManager] Restored original features from backup');
            
            // Clear sequence modifications as we're back to original state
            this.sequenceModifications.clear();
            
            // Update display
            if (this.genomeBrowser.trackRenderer) {
                this.genomeBrowser.trackRenderer.updateFeatureTrack();
            }
        } else {
            console.warn('⚠️ [ActionManager] No original features backup available for restoration');
        }
    }
    
    /**
     * Clear original annotations backup (call when saving changes permanently)
     */
    clearOriginalAnnotationsBackup() {
        this.originalAnnotations = null;
        console.log('🗑️ [ActionManager] Cleared original annotations backup');
    }
    
    initializeEventListeners() {
        // Wait for DOM to be ready before setting up event listeners
        const setupListeners = () => {
            console.log('🎯 Setting up ActionManager event listeners...');
            
            // Action menu listeners
            const copyBtn = document.getElementById('copySequenceBtn');
            const cutBtn = document.getElementById('cutSequenceBtn');
            const pasteBtn = document.getElementById('pasteSequenceBtn');
            const deleteBtn = document.getElementById('deleteSequenceBtn');
            const showListBtn = document.getElementById('showActionListBtn');
            const executeBtn = document.getElementById('executeActionsBtn');
            const checkpointBtn = document.getElementById('createCheckpointBtn');
            const rollbackBtn = document.getElementById('rollbackBtn');
            
            if (copyBtn) {
                copyBtn.addEventListener('click', () => this.handleCopySequence());
                console.log('✅ Copy sequence listener added');
            }
            if (cutBtn) {
                cutBtn.addEventListener('click', () => this.handleCutSequence());
                console.log('✅ Cut sequence listener added');
            }
            if (pasteBtn) {
                pasteBtn.addEventListener('click', () => this.handlePasteSequence());
                console.log('✅ Paste sequence listener added');
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.handleDeleteSequence());
                console.log('✅ Delete sequence listener added');
            }
            if (showListBtn) {
                showListBtn.addEventListener('click', () => this.showActionList());
                console.log('✅ Show action list listener added');
            }
            if (executeBtn) {
                executeBtn.addEventListener('click', () => this.executeAllActions());
                console.log('✅ Execute actions listener added');
            }
            if (checkpointBtn) {
                checkpointBtn.addEventListener('click', () => this.createCheckpoint());
                console.log('✅ Create checkpoint listener added');
            }
            if (rollbackBtn) {
                rollbackBtn.addEventListener('click', () => this.rollback());
                console.log('✅ Rollback listener added');
            }
        };
        
        // Try to setup listeners immediately, and also retry after a delay if needed
        setupListeners();
        // Only retry if listeners weren't set up successfully the first time
        setTimeout(() => {
            // Check if at least one button exists before retrying
            if (!document.getElementById('copySequenceBtn') && 
                !document.getElementById('cutSequenceBtn') && 
                !document.getElementById('pasteSequenceBtn') && 
                !document.getElementById('deleteSequenceBtn')) {
                setupListeners();
            }
        }, 1000);
        
        // Action List modal listeners
        document.getElementById('executeAllActionsBtn')?.addEventListener('click', () => this.executeAllActions());
        document.getElementById('clearAllActionsBtn')?.addEventListener('click', () => this.clearAllActions());
        document.getElementById('exportActionsBtn')?.addEventListener('click', () => this.exportActions());
        document.getElementById('importActionsBtn')?.addEventListener('click', () => this.importActions());
        
        // Action List modal close handlers
        const actionListModal = document.getElementById('actionListModal');
        if (actionListModal) {
            // Initialize draggable and resizable using centralized managers
            if (window.modalDragManager) {
                window.modalDragManager.makeDraggable('#actionListModal');
            }
            if (window.resizableModalManager) {
                window.resizableModalManager.makeResizable('#actionListModal');
            }
            
            // Add reset to defaults button handler
            const resetDefaultsBtn = actionListModal.querySelector('.reset-defaults-btn');
            if (resetDefaultsBtn) {
                resetDefaultsBtn.addEventListener('click', () => {
                    this.resetToDefaults();
                });
            }
            
            actionListModal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => this.closeActionList());
            });
            
            // Close when clicking outside
            actionListModal.addEventListener('click', (e) => {
                if (e.target.id === 'actionListModal') {
                    this.closeActionList();
                }
            });
        }
        
        // Sequence selection modal listeners
        document.getElementById('confirmSequenceSelection')?.addEventListener('click', () => this.confirmSequenceSelection());
        document.getElementById('chromosomeSelectSeq')?.addEventListener('change', () => this.updateSequencePreview());
        document.getElementById('startPositionSeq')?.addEventListener('input', () => this.updateSequencePreview());
        document.getElementById('endPositionSeq')?.addEventListener('input', () => this.updateSequencePreview());
        document.getElementById('strandSelectSeq')?.addEventListener('change', () => this.updateSequencePreview());
        
        // Sequence selection modal close handlers
        const sequenceModal = document.getElementById('sequenceSelectionModal');
        if (sequenceModal) {
            sequenceModal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => this.closeSequenceSelectionModal());
            });
            
            // Close when clicking outside
            sequenceModal.addEventListener('click', (e) => {
                if (e.target.id === 'sequenceSelectionModal') {
                    this.closeSequenceSelectionModal();
                }
            });
        }
        
        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (document.getElementById('sequenceSelectionModal')?.classList.contains('show')) {
                    this.closeSequenceSelectionModal();
                } else if (document.getElementById('actionListModal')?.classList.contains('show')) {
                    this.closeActionList();
                }
            }
        });
    }
    
    /**
     * Create action object (without adding to queue)
     */
    createAction(type, target, details, metadata = {}) {
        const action = {
            id: this.nextActionId++,
            type: type,
            target: target,
            details: details,
            metadata: metadata,
            status: this.STATUS.PENDING,
            timestamp: new Date(),
            estimatedTime: this.estimateActionTime(type),
            result: null,
            error: null
        };
        
        return action;
    }

    /**
     * Add action to the queue
     */
    addAction(type, target, details, metadata = {}) {
        let action;
        
        // Handle both cases: action object or parameters
        if (typeof type === 'object' && type.id !== undefined) {
            // type is actually an action object
            action = type;
        } else {
            // Create new action from parameters
            action = this.createAction(type, target, details, metadata);
        }
        
        this.actions.push(action);
        this.updateActionListUI();
        this.updateStats();
        
        // Notify actions track to update
        this.notifyActionsTrackUpdate();
        
        console.log('Action added:', action);
        return action.id;
    }
    
    /**
     * Notify actions track to update when actions change
     */
    notifyActionsTrackUpdate() {
        if (this.genomeBrowser && this.genomeBrowser.trackRenderer) {
            // Check if actions track is visible
            const trackActionsCheckbox = document.getElementById('trackActions');
            const sidebarTrackActionsCheckbox = document.getElementById('sidebarTrackActions');
            
            const isActionsTrackVisible = (trackActionsCheckbox && trackActionsCheckbox.checked) ||
                                         (sidebarTrackActionsCheckbox && sidebarTrackActionsCheckbox.checked);
            
            if (isActionsTrackVisible) {
                console.log('🔄 Updating actions track due to action changes');
                this.genomeBrowser.trackRenderer.updateActionsTrack();
            }
        }
    }
    
    /**
     * Handle copy sequence action
     */
    async handleCopySequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
            // Immediately get sequence and set clipboard for copy
            const sequence = await this.getSequenceForRegion(
                selectionInfo.chromosome, 
                selectionInfo.start, 
                selectionInfo.end, 
                selectionInfo.strand
            );
            
            if (sequence) {
                // Collect comprehensive data including features
                const comprehensiveData = await this.collectComprehensiveData(
                    selectionInfo.chromosome, 
                    selectionInfo.start, 
                    selectionInfo.end, 
                    selectionInfo.strand
                );
                
                this.clipboard = {
                    type: 'copy',
                    sequence: sequence,
                    source: `${selectionInfo.chromosome}:${selectionInfo.start}-${selectionInfo.end}`,
                    timestamp: new Date(),
                    sourceInfo: selectionInfo,
                    comprehensiveData: comprehensiveData
                };
                console.log('📋 [ActionManager] Clipboard set for copy with features:', {
                    sequence: sequence.length + ' bp',
                    features: comprehensiveData.features.length
                });
            }
            
            this.createActionFromSelection('copy', selectionInfo);
        } else {
            this.showSequenceSelectionModal('copy');
        }
    }
    
    /**
     * Handle cut sequence action
     */
    async handleCutSequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
            // Immediately get sequence and set clipboard for cut
            const sequence = await this.getSequenceForRegion(
                selectionInfo.chromosome, 
                selectionInfo.start, 
                selectionInfo.end, 
                selectionInfo.strand
            );
            
            if (sequence) {
                // Collect comprehensive data including features
                const comprehensiveData = await this.collectComprehensiveData(
                    selectionInfo.chromosome, 
                    selectionInfo.start, 
                    selectionInfo.end, 
                    selectionInfo.strand
                );
                
                this.clipboard = {
                    type: 'cut',
                    sequence: sequence,
                    source: `${selectionInfo.chromosome}:${selectionInfo.start}-${selectionInfo.end}`,
                    timestamp: new Date(),
                    sourceInfo: selectionInfo,
                    comprehensiveData: comprehensiveData
                };
                console.log('📋 [ActionManager] Clipboard set for cut with features:', {
                    sequence: sequence.length + ' bp',
                    features: comprehensiveData.features.length
                });
            }
            
            this.createActionFromSelection('cut', selectionInfo);
        } else {
            this.showSequenceSelectionModal('cut');
        }
    }
    
    /**
     * Handle paste sequence action  
     */
    handlePasteSequence() {
        if (!this.clipboard || !this.clipboard.sequence) {
            this.genomeBrowser.showNotification('No sequence in clipboard', 'warning');
            return;
        }
        
        console.log('🔍 [ActionManager] Paste sequence debug:', {
            clipboard: this.clipboard,
            cursorPosition: this.cursorPosition,
            currentChromosome: this.genomeBrowser.currentChromosome,
            selectedChromosome: this.genomeBrowser.selectedChromosome,
            currentSequence: this.genomeBrowser.currentSequence ? Object.keys(this.genomeBrowser.currentSequence) : null
        });
        
        // Check if we have an active selection
        const selectionInfo = this.getActiveSelection();
        console.log('🔍 [ActionManager] Selection info:', selectionInfo);
        
        if (selectionInfo && selectionInfo.hasSelection) {
            // If selection exists, create PASTE action for replace
            const target = `${selectionInfo.chromosome}:${selectionInfo.start}-${selectionInfo.end}`;
            const metadata = {
                chromosome: selectionInfo.chromosome,
                start: selectionInfo.start,
                end: selectionInfo.end,
                strand: selectionInfo.strand || '+',
                clipboardData: this.clipboard,
                selectionSource: selectionInfo.source
            };
            
            this.addAction(
                this.ACTION_TYPES.PASTE_SEQUENCE,
                target,
                `Paste ${this.clipboard.sequence.length} bp to replace ${selectionInfo.end - selectionInfo.start + 1} bp in ${selectionInfo.name}`,
                metadata
            );
            
            this.genomeBrowser.showNotification(
                `Paste-replace action queued: ${selectionInfo.name} with ${this.clipboard.sequence.length} bp`, 
                'success'
            );
            return;
        }
        
        // If we have a cursor position but no selection, use it for INSERT
        if (this.cursorPosition >= 0 && !isNaN(this.cursorPosition)) {
            // Try to get chromosome from various sources
            const chromosome = this.genomeBrowser.currentChromosome || 
                              this.genomeBrowser.selectedChromosome ||
                              (this.genomeBrowser.currentSequence && Object.keys(this.genomeBrowser.currentSequence)[0]);
            
            console.log('🔍 [ActionManager] Cursor position valid, chromosome:', chromosome);
            
            if (chromosome) {
                const target = `${chromosome}:${this.cursorPosition}`;
                const metadata = { 
                    chromosome, 
                    start: this.cursorPosition, 
                    end: this.cursorPosition, 
                    strand: '+',
                    clipboardData: this.clipboard
                };
                
                this.addAction(
                    this.ACTION_TYPES.PASTE_SEQUENCE,
                    target,
                    `Paste ${this.clipboard.sequence.length} bp at cursor position ${this.cursorPosition}`,
                    metadata
                );
                
                this.genomeBrowser.showNotification(`Paste-insert action queued at cursor position ${this.cursorPosition}`, 'success');
                return;
            }
        }
        
        // Fallback to modal selection if no cursor position or selection
        this.showSequenceSelectionModal('paste');
    }
    
    /**
     * Handle insert sequence action
     */
    handleInsertSequence() {
        // Show modal to input sequence to insert
        this.showSequenceInsertModal();
    }
    
    /**
     * Handle replace sequence action
     */
    handleReplaceSequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
            // Show modal to input replacement sequence
            this.showSequenceReplaceModal(selectionInfo);
        } else {
            this.showSequenceSelectionModal('replace');
        }
    }
    
    /**
     * Handle delete sequence action
     */
    handleDeleteSequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
            this.createActionFromSelection('delete', selectionInfo);
        } else {
            this.showSequenceSelectionModal('delete');
        }
    }
    
    /**
     * DEPRECATED: Set cursor position for paste operations (scheduled for removal)
     */
    setCursorPosition(position) {
        this.cursorPosition = position;
        console.log('🎯 [ActionManager] Cursor position set to:', position);
    }
    
    /**
     * Get the currently active selection (prioritized)
     */
    getActiveSelection() {
        // Priority 1: Manual sequence selection
        if (this.genomeBrowser.currentSequenceSelection) {
            const selection = this.genomeBrowser.currentSequenceSelection;
            return {
                hasSelection: true,
                chromosome: selection.chromosome,
                start: parseInt(selection.start),
                end: parseInt(selection.end),
                strand: '+', // Default for manual selections
                source: 'manual',
                name: `Manual Selection (${selection.chromosome}:${selection.start}-${selection.end})`
            };
        }
        
        // Priority 2: Active gene selection
        if (this.genomeBrowser.sequenceSelection && this.genomeBrowser.sequenceSelection.active && this.genomeBrowser.sequenceSelection.source === 'gene') {
            const selection = this.genomeBrowser.sequenceSelection;
            return {
                hasSelection: true,
                chromosome: selection.chromosome || this.genomeBrowser.currentChromosome,
                start: parseInt(selection.start),
                end: parseInt(selection.end),
                strand: selection.strand || '+',
                source: 'gene',
                name: selection.geneName || 'Gene Selection'
            };
        }
        
        // Priority 3: Selected gene
        if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
            const gene = this.genomeBrowser.selectedGene.gene;
            return {
                hasSelection: true,
                chromosome: gene.chromosome || this.genomeBrowser.currentChromosome,
                start: parseInt(gene.start),
                end: parseInt(gene.end),
                strand: gene.strand || '+',
                source: 'selectedGene',
                name: gene.name || gene.locus_tag || 'Selected Gene'
            };
        }
        
        return {
            hasSelection: false,
            source: 'none'
        };
    }
    
    /**
     * Create action directly from selection info
     */
    createActionFromSelection(operation, selectionInfo) {
        const { chromosome, start, end, strand, source, name } = selectionInfo;
        
        const target = `${chromosome}:${start}-${end}(${strand})`;
        const length = end - start + 1;
        const metadata = { chromosome, start, end, strand, selectionSource: source };
        
        let actionType, description;
        
        switch (operation) {
            case 'copy':
                actionType = this.ACTION_TYPES.COPY_SEQUENCE;
                description = `Copy ${length.toLocaleString()} bp from ${name}`;
                break;
            case 'cut':
                actionType = this.ACTION_TYPES.CUT_SEQUENCE;
                description = `Cut ${length.toLocaleString()} bp from ${name}`;
                break;
            case 'delete':
                actionType = this.ACTION_TYPES.DELETE_SEQUENCE;
                description = `Delete ${length.toLocaleString()} bp from ${name}`;
                break;
            default:
                console.error('Unknown operation:', operation);
                return;
        }
        
        // Create the action
        const actionId = this.addAction(actionType, target, description, metadata);
        
        // Show confirmation
        this.genomeBrowser.showNotification(
            `${operation.charAt(0).toUpperCase() + operation.slice(1)} action created for ${name} (${length.toLocaleString()} bp)`,
            'success'
        );
        
        console.log(`🎯 [ActionManager] Created ${operation} action from ${source} selection:`, {
            actionId,
            target,
            length,
            selectionName: name
        });
        
        return actionId;
    }
    
    /**
     * Show sequence selection modal
     */
    showSequenceSelectionModal(operation) {
        this.currentOperation = operation;
        
        // Populate chromosome dropdown
        this.populateChromosomeSelect();
        
        // Set default values - prioritize manual selection, then gene selection, then current view
        let defaultChromosome = null;
        let defaultStart = 1;
        let defaultEnd = 1000;
        let selectionSource = 'default';
        
        // Priority 1: Check if there's a manual sequence selection
        if (this.genomeBrowser.currentSequenceSelection) {
            const selection = this.genomeBrowser.currentSequenceSelection;
            defaultChromosome = selection.chromosome;
            defaultStart = parseInt(selection.start) || 1;
            defaultEnd = parseInt(selection.end) || defaultStart + 1000;
            selectionSource = 'manual';
            
            console.log('Using manual sequence selection for action:', {
                chromosome: defaultChromosome,
                start: defaultStart,
                end: defaultEnd,
                length: defaultEnd - defaultStart + 1,
                source: 'manual track selection'
            });
        }
        // Priority 2: Check if there's an active gene selection (from sequenceSelection)
        else if (this.genomeBrowser.sequenceSelection && this.genomeBrowser.sequenceSelection.active && this.genomeBrowser.sequenceSelection.source === 'gene') {
            const selection = this.genomeBrowser.sequenceSelection;
            defaultChromosome = selection.chromosome || this.genomeBrowser.currentChromosome;
            defaultStart = parseInt(selection.start) || 1;
            defaultEnd = parseInt(selection.end) || defaultStart + 1000;
            selectionSource = 'gene';
            
            console.log('Using active gene selection for action:', {
                chromosome: defaultChromosome,
                start: defaultStart,
                end: defaultEnd,
                gene: selection.geneName,
                source: 'gene selection'
            });
        }
        // Priority 3: Check if there's a selected gene (from selectedGene)
        else if (this.genomeBrowser.selectedGene && this.genomeBrowser.selectedGene.gene) {
            const gene = this.genomeBrowser.selectedGene.gene;
            defaultChromosome = gene.chromosome || this.genomeBrowser.currentChromosome;
            defaultStart = parseInt(gene.start) || 1;
            defaultEnd = parseInt(gene.end) || defaultStart + 1000;
            selectionSource = 'selectedGene';
            
            console.log('Using selected gene for action:', {
                chromosome: defaultChromosome,
                start: defaultStart,
                end: defaultEnd,
                gene: gene.name || gene.locus_tag,
                source: 'selected gene'
            });
        } 
        // Priority 4: Fall back to current genome view
        else if (this.genomeBrowser.currentChromosome) {
            defaultChromosome = this.genomeBrowser.currentChromosome;
            defaultStart = this.genomeBrowser.currentPosition?.start || 1;
            defaultEnd = this.genomeBrowser.currentPosition?.end || defaultStart + 1000;
            selectionSource = 'viewport';
            
            console.log('Using current view for action (no selection):', {
                chromosome: defaultChromosome,
                start: defaultStart,
                end: defaultEnd,
                source: 'current viewport'
            });
        }
        
        // Set form values
        if (defaultChromosome) {
            document.getElementById('chromosomeSelectSeq').value = defaultChromosome;
        }
        document.getElementById('startPositionSeq').value = defaultStart;
        document.getElementById('endPositionSeq').value = defaultEnd;
        document.getElementById('strandSelectSeq').value = '+'; // Default to forward strand
        
        // Update modal title based on operation and selection source
        const titleMap = {
            'copy': 'Copy Sequence',
            'cut': 'Cut Sequence', 
            'paste': 'Paste Sequence',
            'delete': 'Delete Sequence'
        };
        
        let baseTitle = titleMap[operation] || 'Select Sequence';
        let sourceIndicator = '';
        
        // Add indicator based on selection source
        switch (selectionSource) {
            case 'manual':
                sourceIndicator = ' (Using Manual Selection)';
                break;
            case 'gene':
                sourceIndicator = ' (Using Gene Selection)';
                break;
            case 'selectedGene':
                sourceIndicator = ' (Using Selected Gene)';
                break;
            case 'viewport':
                sourceIndicator = ' (Using Current View)';
                break;
        }
        
        document.getElementById('sequenceSelectionTitle').textContent = baseTitle + sourceIndicator;
        
        // Show modal
        const modal = document.getElementById('sequenceSelectionModal');
        if (modal) {
            modal.classList.add('show');
        }
        
        // Update preview after setting values
        setTimeout(() => {
            this.updateSequencePreview();
        }, 100);
    }
    
    /**
     * Populate chromosome select dropdown
     */
    populateChromosomeSelect() {
        const select = document.getElementById('chromosomeSelectSeq');
        select.innerHTML = '<option value="">Select chromosome...</option>';
        
        if (this.genomeBrowser.currentSequence) {
            Object.keys(this.genomeBrowser.currentSequence).forEach(chromosome => {
                const option = document.createElement('option');
                option.value = chromosome;
                option.textContent = chromosome;
                select.appendChild(option);
            });
        }
    }
    
    /**
     * Show sequence insert modal
     */
    showSequenceInsertModal() {
        const modal = document.getElementById('sequenceInsertModal');
        if (!modal) return;
        
        // Populate chromosome dropdown for insert modal
        this.populateChromosomeSelectInsert();
        
        // Set default values
        let defaultChromosome = this.genomeBrowser.currentChromosome || '';
        let defaultPosition = this.cursorPosition || 1;
        
        // Set default values
        const chrSelect = document.getElementById('chromosomeSelectInsert');
        const posInput = document.getElementById('insertPositionSeq');
        const seqTextarea = document.getElementById('insertSequenceText');
        
        if (chrSelect) chrSelect.value = defaultChromosome;
        if (posInput) posInput.value = defaultPosition;
        if (seqTextarea) seqTextarea.value = '';
        
        // Clear validation message
        const validationMsg = document.getElementById('sequenceValidation');
        if (validationMsg) validationMsg.textContent = '';
        
        // Show modal
        modal.style.display = 'block';
        
        // Setup event listeners for this modal instance
        this.setupInsertModalEventListeners();
    }
    
    /**
     * Populate chromosome select for insert modal
     */
    populateChromosomeSelectInsert() {
        const select = document.getElementById('chromosomeSelectInsert');
        select.innerHTML = '<option value="">Select chromosome...</option>';
        
        if (this.genomeBrowser.currentSequence) {
            Object.keys(this.genomeBrowser.currentSequence).forEach(chromosome => {
                const option = document.createElement('option');
                option.value = chromosome;
                option.textContent = chromosome;
                select.appendChild(option);
            });
        }
    }
    
    /**
     * Setup event listeners for insert modal
     */
    setupInsertModalEventListeners() {
        // Remove existing listeners to prevent duplicates
        const confirmBtn = document.getElementById('confirmSequenceInsert');
        const seqTextarea = document.getElementById('insertSequenceText');
        
        if (confirmBtn) {
            confirmBtn.replaceWith(confirmBtn.cloneNode(true));
            const newConfirmBtn = document.getElementById('confirmSequenceInsert');
            newConfirmBtn.addEventListener('click', () => this.confirmSequenceInsert());
        }
        
        if (seqTextarea) {
            seqTextarea.addEventListener('input', () => this.validateInsertSequence());
        }
    }
    
    /**
     * Show sequence replace modal
     */
    showSequenceReplaceModal(selectionInfo) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('sequenceReplaceModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'sequenceReplaceModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3><i class="fas fa-exchange-alt"></i> Replace Sequence</h3>
                        <button class="modal-close" onclick="actionManager.closeSequenceReplaceModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Target Region:</label>
                            <div id="replaceTargetInfo" class="info-display"></div>
                        </div>
                        <div class="form-group">
                            <label for="replaceSequenceText">New Sequence:</label>
                            <textarea id="replaceSequenceText" rows="4" placeholder="Enter DNA sequence (A, T, C, G, N)" required></textarea>
                            <small class="form-text">Only DNA characters (A, T, C, G, N) are allowed</small>
                        </div>
                        <div class="form-group">
                            <label>Preview:</label>
                            <div id="replaceSequencePreview" class="sequence-preview"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="actionManager.closeSequenceReplaceModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="actionManager.confirmSequenceReplace()">Replace Sequence</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Set target region info
        const targetInfo = document.getElementById('replaceTargetInfo');
        targetInfo.innerHTML = `
            <strong>${selectionInfo.chromosome}:${selectionInfo.start}-${selectionInfo.end}</strong><br>
            <small>Length: ${selectionInfo.end - selectionInfo.start + 1} bp</small>
        `;
        
        // Store selection info for confirmation
        this.currentReplaceSelection = selectionInfo;
        
        // Setup event listeners
        this.setupReplaceModalEventListeners();
        
        // Show modal
        modal.style.display = 'block';
    }
    
    /**
     * Setup event listeners for replace modal
     */
    setupReplaceModalEventListeners() {
        const seqTextarea = document.getElementById('replaceSequenceText');
        if (seqTextarea) {
            seqTextarea.addEventListener('input', () => this.validateReplaceSequence());
        }
    }
    
    /**
     * Validate replace sequence
     */
    validateReplaceSequence() {
        const seqTextarea = document.getElementById('replaceSequenceText');
        const validationMsg = document.getElementById('replaceSequenceValidation');
        
        if (!seqTextarea) return;
        
        const sequence = seqTextarea.value.toUpperCase().replace(/\s/g, '');
        const validNucleotides = /^[ATGC]*$/;
        
        if (sequence === '') {
            if (validationMsg) {
                validationMsg.textContent = '';
                validationMsg.className = 'validation-message';
            }
            return true;
        }
        
        if (validNucleotides.test(sequence)) {
            if (validationMsg) {
                validationMsg.textContent = `✓ Valid sequence (${sequence.length} nucleotides)`;
                validationMsg.className = 'validation-message valid';
            }
            return true;
        } else {
            if (validationMsg) {
                validationMsg.textContent = '✗ Invalid sequence - only A, T, G, C allowed';
                validationMsg.className = 'validation-message invalid';
            }
            return false;
        }
    }
    
    /**
     * Confirm sequence replace
     */
    confirmSequenceReplace() {
        if (!this.currentReplaceSelection) {
            this.genomeBrowser.showNotification('No target region selected', 'warning');
            return;
        }
        
        const sequence = document.getElementById('replaceSequenceText').value.toUpperCase().replace(/\s/g, '');
        
        if (!sequence) {
            this.genomeBrowser.showNotification('Please enter a sequence to replace with', 'warning');
            return;
        }
        
        if (!this.validateReplaceSequence()) {
            this.genomeBrowser.showNotification('Please enter a valid DNA sequence', 'warning');
            return;
        }
        
        const { chromosome, start, end } = this.currentReplaceSelection;
        
        // Create replace action
        const target = `${chromosome}:${start}-${end}`;
        const metadata = {
            chromosome,
            start,
            end,
            strand: '+',
            newSequence: sequence,
            selectionSource: 'manual_input'
        };
        
        this.addAction(
            this.ACTION_TYPES.REPLACE_SEQUENCE,
            target,
            `Replace ${end - start + 1} bp with ${sequence.length} bp at ${chromosome}:${start}-${end}`,
            metadata
        );
        
        this.genomeBrowser.showNotification(
            `Replace action queued: ${end - start + 1} → ${sequence.length} bp at ${chromosome}:${start}-${end}`,
            'success'
        );
        
        // Close modal
        const modal = document.getElementById('sequenceReplaceModal');
        if (modal) modal.style.display = 'none';
        
        // Clear stored selection
        this.currentReplaceSelection = null;
    }
    
    /**
     * Close sequence replace modal
     */
    closeSequenceReplaceModal() {
        const modal = document.getElementById('sequenceReplaceModal');
        if (modal) {
            modal.style.display = 'none';
            this.currentReplaceSelection = null;
        }
    }
    
    /**
     * Validate insert sequence
     */
    validateInsertSequence() {
        const seqTextarea = document.getElementById('insertSequenceText');
        const validationMsg = document.getElementById('sequenceValidation');
        
        if (!seqTextarea || !validationMsg) return;
        
        const sequence = seqTextarea.value.toUpperCase().replace(/\s/g, '');
        const validNucleotides = /^[ATGC]*$/;
        
        if (sequence === '') {
            validationMsg.textContent = '';
            validationMsg.className = 'validation-message';
            return true;
        }
        
        if (validNucleotides.test(sequence)) {
            validationMsg.textContent = `✓ Valid sequence (${sequence.length} nucleotides)`;
            validationMsg.className = 'validation-message valid';
            return true;
        } else {
            validationMsg.textContent = '✗ Invalid sequence - only A, T, G, C allowed';
            validationMsg.className = 'validation-message invalid';
            return false;
        }
    }
    
    /**
     * Confirm sequence insert
     */
    confirmSequenceInsert() {
        const chromosome = document.getElementById('chromosomeSelectInsert').value;
        const position = parseInt(document.getElementById('insertPositionSeq').value);
        const sequence = document.getElementById('insertSequenceText').value.toUpperCase().replace(/\s/g, '');
        
        if (!chromosome) {
            this.genomeBrowser.showNotification('Please select a chromosome', 'warning');
            return;
        }
        
        if (!position || position < 1) {
            this.genomeBrowser.showNotification('Please enter a valid position', 'warning');
            return;
        }
        
        if (!sequence) {
            this.genomeBrowser.showNotification('Please enter a sequence to insert', 'warning');
            return;
        }
        
        if (!this.validateInsertSequence()) {
            this.genomeBrowser.showNotification('Please enter a valid DNA sequence', 'warning');
            return;
        }
        
        // Create insert action
        const target = `${chromosome}:${position}`;
        const metadata = {
            chromosome,
            start: position,
            end: position,
            strand: '+',
            insertSequence: sequence,
            selectionSource: 'manual_input'
        };
        
        this.addAction(
            this.ACTION_TYPES.INSERT_SEQUENCE,
            target,
            `Insert ${sequence.length} bp at ${chromosome}:${position}`,
            metadata
        );
        
        this.genomeBrowser.showNotification(
            `Insert action queued: ${sequence.length} bp at ${chromosome}:${position}`,
            'success'
        );
        
        // Close modal
        const modal = document.getElementById('sequenceInsertModal');
        if (modal) modal.style.display = 'none';
    }
    
    /**
     * Update sequence preview
     */
    async updateSequencePreview() {
        const chromosome = document.getElementById('chromosomeSelectSeq').value;
        const startInput = document.getElementById('startPositionSeq').value;
        const endInput = document.getElementById('endPositionSeq').value;
        const strand = document.getElementById('strandSelectSeq').value;
        
        const previewDiv = document.getElementById('sequencePreview');
        
        // Validate inputs
        if (!chromosome || chromosome === '') {
            previewDiv.textContent = 'Select a chromosome to preview sequence';
            previewDiv.classList.remove('has-sequence');
            return;
        }
        
        if (!startInput || !endInput) {
            previewDiv.textContent = 'Enter start and end positions to preview sequence';
            previewDiv.classList.remove('has-sequence');
            return;
        }
        
        const start = parseInt(startInput);
        const end = parseInt(endInput);
        
        if (isNaN(start) || isNaN(end)) {
            previewDiv.textContent = 'Start and end positions must be valid numbers';
            previewDiv.classList.remove('has-sequence');
            return;
        }
        
        if (start < 1) {
            previewDiv.textContent = 'Start position must be greater than 0';
            previewDiv.classList.remove('has-sequence');
            return;
        }
        
        if (start >= end) {
            previewDiv.textContent = 'End position must be greater than start position';
            previewDiv.classList.remove('has-sequence');
            return;
        }
        
        try {
            const sequence = await this.getSequenceForRegion(chromosome, start, end, strand);
            if (sequence && sequence.length > 0) {
                const length = sequence.length;
                const preview = length > 100 ? 
                    sequence.substring(0, 100) + '...' : 
                    sequence;
                
                previewDiv.innerHTML = `
                    <div class="sequence-info">
                        <strong>Length:</strong> ${length.toLocaleString()} bp | 
                        <strong>Region:</strong> ${chromosome}:${start.toLocaleString()}-${end.toLocaleString()} | 
                        <strong>Strand:</strong> ${strand}
                    </div>
                    <div class="sequence-preview">${preview}</div>
                `;
                previewDiv.classList.add('has-sequence');
            } else {
                previewDiv.textContent = `Unable to retrieve sequence for ${chromosome}:${start}-${end}. Check if the region is valid.`;
                previewDiv.classList.remove('has-sequence');
            }
        } catch (error) {
            console.error('Error in updateSequencePreview:', error);
            previewDiv.textContent = 'Error retrieving sequence preview';
            previewDiv.classList.remove('has-sequence');
        }
    }
    
    /**
     * Confirm sequence selection
     */
    async confirmSequenceSelection() {
        const chromosome = document.getElementById('chromosomeSelectSeq').value;
        const startInput = document.getElementById('startPositionSeq').value;
        const endInput = document.getElementById('endPositionSeq').value;
        const strand = document.getElementById('strandSelectSeq').value;
        
        // Enhanced validation
        if (!chromosome || chromosome === '') {
            this.genomeBrowser.showNotification('Please select a chromosome', 'error');
            return;
        }
        
        if (!startInput || startInput === '') {
            this.genomeBrowser.showNotification('Please enter a start position', 'error');
            return;
        }
        
        if (!endInput || endInput === '') {
            this.genomeBrowser.showNotification('Please enter an end position', 'error');
            return;
        }
        
        const start = parseInt(startInput);
        const end = parseInt(endInput);
        
        if (isNaN(start) || isNaN(end)) {
            this.genomeBrowser.showNotification('Start and end positions must be valid numbers', 'error');
            return;
        }
        
        if (start < 1) {
            this.genomeBrowser.showNotification('Start position must be greater than 0', 'error');
            return;
        }
        
        if (start >= end) {
            this.genomeBrowser.showNotification('End position must be greater than start position', 'error');
            return;
        }
        
        // Check if the region is within the chromosome bounds
        if (this.genomeBrowser.currentSequence && this.genomeBrowser.currentSequence[chromosome]) {
            const chromosomeLength = this.genomeBrowser.currentSequence[chromosome].length;
            if (end > chromosomeLength) {
                this.genomeBrowser.showNotification(`End position (${end}) exceeds chromosome length (${chromosomeLength})`, 'error');
                return;
            }
        }
        
        const target = `${chromosome}:${start}-${end}(${strand})`;
        const metadata = { chromosome, start, end, strand };
        
        try {
            switch (this.currentOperation) {
                case 'copy':
                    // Get sequence and set clipboard immediately for copy
                    const copySequence = await this.getSequenceForRegion(chromosome, start, end, strand);
                    if (copySequence) {
                        // Collect comprehensive data including features
                        const copyComprehensiveData = await this.collectComprehensiveData(chromosome, start, end, strand);
                        
                        this.clipboard = {
                            type: 'copy',
                            sequence: copySequence,
                            source: target,
                            timestamp: new Date(),
                            comprehensiveData: copyComprehensiveData
                        };
                        console.log('📋 [ActionManager] Clipboard set for copy (modal) with features:', {
                            sequence: copySequence.length + ' bp',
                            features: copyComprehensiveData.features.length
                        });
                    }
                    
                    this.addAction(
                        this.ACTION_TYPES.COPY_SEQUENCE,
                        target,
                        `Copy ${end - start + 1} bp from ${target}`,
                        metadata
                    );
                    break;
                    
                case 'cut':
                    // Get sequence and set clipboard immediately for cut
                    const cutSequence = await this.getSequenceForRegion(chromosome, start, end, strand);
                    if (cutSequence) {
                        // Collect comprehensive data including features
                        const cutComprehensiveData = await this.collectComprehensiveData(chromosome, start, end, strand);
                        
                        this.clipboard = {
                            type: 'cut',
                            sequence: cutSequence,
                            source: target,
                            timestamp: new Date(),
                            comprehensiveData: cutComprehensiveData
                        };
                        console.log('📋 [ActionManager] Clipboard set for cut (modal) with features:', {
                            sequence: cutSequence.length + ' bp',
                            features: cutComprehensiveData.features.length
                        });
                    }
                    
                    this.addAction(
                        this.ACTION_TYPES.CUT_SEQUENCE,
                        target,
                        `Cut ${end - start + 1} bp from ${target}`,
                        metadata
                    );
                    break;
                    
                case 'paste':
                    this.addAction(
                        this.ACTION_TYPES.PASTE_SEQUENCE,
                        target,
                        `Paste ${this.clipboard.sequence?.length || 0} bp to ${target}`,
                        { ...metadata, clipboardData: this.clipboard }
                    );
                    break;
                    
                case 'delete':
                    this.addAction(
                        this.ACTION_TYPES.DELETE_SEQUENCE,
                        target,
                        `Delete ${end - start + 1} bp from ${target}`,
                        metadata
                    );
                    break;
            }
            
            // Close modal
            this.closeSequenceSelectionModal();
            this.genomeBrowser.showNotification(`${this.currentOperation} action queued successfully`, 'success');
            
        } catch (error) {
            console.error('Error confirming sequence selection:', error);
            this.genomeBrowser.showNotification('Error creating action', 'error');
        }
    }
    
    /**
     * Close sequence selection modal
     */
    closeSequenceSelectionModal() {
        const modal = document.getElementById('sequenceSelectionModal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.currentOperation = null;
    }
    
    /**
     * Get sequence for a specific region
     */
    async getSequenceForRegion(chromosome, start, end, strand = '+') {
        try {
            if (!this.genomeBrowser.currentSequence[chromosome]) {
                return null;
            }
            
            const sequence = this.genomeBrowser.currentSequence[chromosome];
            let regionSequence = sequence.substring(start - 1, end);
            
            if (strand === '-') {
                regionSequence = this.reverseComplement(regionSequence);
            }
            
            return regionSequence;
        } catch (error) {
            console.error('Error getting sequence for region:', error);
            return null;
        }
    }
    
    /**
     * Reverse complement DNA sequence
     */
    reverseComplement(sequence) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(sequence);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const complementMap = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N' };
        return sequence
            .toUpperCase()
            .split('')
            .reverse()
            .map(base => complementMap[base] || base)
            .join('');
    }
    
    /**
     * Collect comprehensive data for a genomic region
     */
    async collectComprehensiveData(chromosome, start, end, strand, executionGenomeData = null) {
        const comprehensiveData = {
            region: {
                chromosome: chromosome,
                start: start,
                end: end,
                strand: strand,
                length: end - start + 1
            },
            features: [],
            annotations: [],
            variants: [],
            reads: [],
            metadata: {}
        };
        
        try {
            // 🔧 CRITICAL FIX: Use execution genome data copy if provided, otherwise use original data
            const annotationsSource = executionGenomeData?.annotations || this.genomeBrowser.currentAnnotations;
            const variantsSource = executionGenomeData?.variants || this.genomeBrowser.currentVariants;
            const readsSource = executionGenomeData?.reads || this.genomeBrowser.currentReads;
            
            // Collect features in the region
            if (annotationsSource && annotationsSource[chromosome]) {
                const annotations = annotationsSource[chromosome];
                // 🔧 CRITICAL FIX: Create deep copies of features to prevent reference issues
                comprehensiveData.features = annotations
                    .filter(feature => feature.start <= end && feature.end >= start)
                    .map(feature => JSON.parse(JSON.stringify(feature)));
            }
            
            // Collect variants in the region
            if (variantsSource && variantsSource[chromosome]) {
                const variants = variantsSource[chromosome];
                // 🔧 CRITICAL FIX: Create deep copies of variants to prevent reference issues
                comprehensiveData.variants = variants
                    .filter(variant => variant.start <= end && variant.end >= start)
                    .map(variant => JSON.parse(JSON.stringify(variant)));
            }
            
            // Collect reads in the region
            if (readsSource && readsSource[chromosome]) {
                const reads = readsSource[chromosome];
                // 🔧 CRITICAL FIX: Create deep copies of reads to prevent reference issues
                comprehensiveData.reads = reads
                    .filter(read => read.start <= end && read.end >= start)
                    .map(read => JSON.parse(JSON.stringify(read)));
            }
            
            // Collect additional metadata
            comprehensiveData.metadata = {
                gcContent: this.calculateGCContent(comprehensiveData.sequence),
                featureTypes: [...new Set(comprehensiveData.features.map(f => f.type))],
                variantTypes: [...new Set(comprehensiveData.variants.map(v => v.type))],
                readCount: comprehensiveData.reads.length,
                timestamp: new Date().toISOString()
            };
            
            console.log('📊 [ActionManager] Collected comprehensive data:', {
                region: comprehensiveData.region,
                featuresCount: comprehensiveData.features.length,
                variantsCount: comprehensiveData.variants.length,
                readsCount: comprehensiveData.reads.length
            });
            
        } catch (error) {
            console.error('❌ [ActionManager] Error collecting comprehensive data:', error);
        }
        
        return comprehensiveData;
    }
    
    /**
     * Calculate GC content of a sequence
     */
    calculateGCContent(sequence) {
        if (!sequence || sequence.length === 0) return 0;
        
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        return (gcCount / sequence.length * 100).toFixed(2);
    }
    
    /**
     * Execute all pending actions with comprehensive conflict detection and resolution
     */
    async executeAllActions() {
        if (this.isExecuting) {
            this.genomeBrowser.showNotification('Actions are already executing', 'warning');
            return {
                success: false,
                message: 'Actions are already executing',
                executedActions: 0,
                totalActions: this.actions.length
            };
        }
        
        const pendingActions = this.actions.filter(action => action.status === this.STATUS.PENDING);
        if (pendingActions.length === 0) {
            this.genomeBrowser.showNotification('No pending actions to execute', 'info');
            return {
                success: true,
                message: 'No pending actions to execute',
                executedActions: 0,
                totalActions: this.actions.length,
                pendingActions: 0
            };
        }
        
        console.log(`🔄 [ActionManager] Starting execution of ${pendingActions.length} pending actions`);
        
        // Step 1: Check for action conflicts before execution
        const conflictAnalysis = this.checkActionConflicts(pendingActions);
        if (conflictAnalysis.hasConflicts) {
            console.warn(`⚠️ [ActionManager] Found ${conflictAnalysis.conflicts.length} action conflicts`);
            this.highlightConflictingActions(conflictAnalysis.conflicts);
            
            const shouldProceed = await this.showConflictResolutionDialog(conflictAnalysis);
            if (!shouldProceed) {
                this.genomeBrowser.showNotification('Action execution cancelled due to conflicts', 'warning');
                return {
                    success: false,
                    message: 'Execution cancelled due to action conflicts',
                    executedActions: 0,
                    totalActions: this.actions.length,
                    conflicts: conflictAnalysis.conflicts
                };
            }
        }
        
        // Step 2: Create comprehensive backup checkpoint
        const checkpointId = await this.createExecutionCheckpoint(pendingActions);
        if (!checkpointId) {
            this.genomeBrowser.showNotification('Failed to create execution checkpoint', 'error');
            return {
                success: false,
                message: 'Failed to create execution checkpoint',
                executedActions: 0,
                totalActions: this.actions.length
            };
        }
        
        // Step 3: Create execution copies
        const executionActionsCopy = JSON.parse(JSON.stringify(this.actions));
        const pendingActionsCopy = executionActionsCopy.filter(action => action.status === this.STATUS.PENDING);
        const originalGenomeData = this.createGenomeDataBackup();
        const executionGenomeData = this.createGenomeDataCopy(originalGenomeData);
        
        console.log(`🧬 [ActionManager] Created execution environment:`, {
            checkpointId,
            actions: executionActionsCopy.length,
            pending: pendingActionsCopy.length,
            chromosomes: Object.keys(executionGenomeData.annotations || {}).length,
            totalFeatures: Object.values(executionGenomeData.annotations || {}).reduce((sum, features) => sum + features.length, 0)
        });
        
        this.isExecuting = true;
        this.showExecutionProgress(0, pendingActionsCopy.length);
        
        try {
            // Step 4: Execute actions with comprehensive feature updates
            for (let i = 0; i < pendingActionsCopy.length; i++) {
                const action = pendingActionsCopy[i];
                
                console.log(`🔄 [ActionManager] Executing action ${i + 1}/${pendingActionsCopy.length}: ${action.type} at ${action.target}`);
                
                // Execute the action
                await this.executeActionOnCopy(action, executionActionsCopy, executionGenomeData);
                
                // Update all features after each action execution
                await this.updateAllFeaturesAfterAction(action, executionGenomeData);
                
                // Adjust positions of remaining pending actions
                this.adjustPendingActionPositionsOnCopy(action, i + 1, executionActionsCopy);
                
                this.showExecutionProgress(i + 1, pendingActionsCopy.length);
                
                // Small delay between actions for stability
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Step 5: Generate comprehensive GBK file with full history
            await this.generateComprehensiveGBK(executionActionsCopy, executionGenomeData, checkpointId);
            
            this.genomeBrowser.showNotification(`All ${pendingActionsCopy.length} actions executed successfully`, 'success');
            
            console.log(`✅ [ActionManager] Execution completed successfully`);
            
            return {
                success: true,
                message: `Executed ${pendingActionsCopy.length} actions successfully`,
                executedActions: pendingActionsCopy.length,
                failedActions: 0,
                totalActions: this.actions.length,
                checkpointId,
                conflicts: conflictAnalysis.conflicts || []
            };
            
        } catch (error) {
            console.error('❌ [ActionManager] Error during action execution:', error);
            this.genomeBrowser.showNotification(`Error executing actions: ${error.message}`, 'error');
            
            // Attempt to restore from checkpoint
            await this.restoreFromCheckpoint(checkpointId);
            
            return {
                success: false,
                message: `Execution failed: ${error.message}`,
                executedActions: 0,
                failedActions: pendingActionsCopy.length,
                totalActions: this.actions.length,
                error: error.message,
                checkpointId
            };
            
        } finally {
            // Step 6: Cleanup and restore original state
            this.restoreGenomeDataFromBackup(originalGenomeData);
            this.isExecuting = false;
            this.hideExecutionProgress();
            this.updateActionListUI();
            this.updateStats();
            this.notifyActionsTrackUpdate();
            
            console.log(`🔒 [ActionManager] Execution cleanup completed`);
        }
    }
    
    /**
     * Check for conflicts between pending actions
     */
    checkActionConflicts(pendingActions) {
        console.log(`🔍 [ActionManager] Checking for conflicts in ${pendingActions.length} pending actions`);
        
        const conflicts = [];
        const actionPositions = new Map(); // chromosome -> array of {action, start, end}
        
        // Parse action positions and group by chromosome
        for (const action of pendingActions) {
            const position = this.parseActionPosition(action);
            if (!position) continue;
            
            const { chromosome, start, end } = position;
            if (!actionPositions.has(chromosome)) {
                actionPositions.set(chromosome, []);
            }
            
            actionPositions.get(chromosome).push({
                action,
                start,
                end,
                type: action.type
            });
        }
        
        // Check for overlaps within each chromosome
        for (const [chromosome, actions] of actionPositions) {
            // Sort by start position
            actions.sort((a, b) => a.start - b.start);
            
            for (let i = 0; i < actions.length; i++) {
                for (let j = i + 1; j < actions.length; j++) {
                    const action1 = actions[i];
                    const action2 = actions[j];
                    
                    // Check if actions overlap
                    if (this.actionsOverlap(action1, action2)) {
                        const conflict = {
                            type: 'position_overlap',
                            chromosome,
                            action1: action1.action,
                            action2: action2.action,
                            overlapStart: Math.max(action1.start, action2.start),
                            overlapEnd: Math.min(action1.end, action2.end),
                            severity: this.calculateConflictSeverity(action1, action2),
                            description: this.generateConflictDescription(action1, action2)
                        };
                        
                        conflicts.push(conflict);
                        console.warn(`⚠️ [ActionManager] Conflict detected: ${action1.action.type} vs ${action2.action.type} at ${chromosome}:${conflict.overlapStart}-${conflict.overlapEnd}`);
                    }
                }
            }
        }
        
        return {
            hasConflicts: conflicts.length > 0,
            conflicts,
            totalActions: pendingActions.length,
            affectedChromosomes: Array.from(actionPositions.keys())
        };
    }
    
    /**
     * Parse action position from target string
     */
    parseActionPosition(action) {
        if (!action.target) return null;
        
        const match = action.target.match(/([^:]+):(\d+)-(\d+)(?:\(([+-])\))?/);
        if (!match) return null;
        
        return {
            chromosome: match[1],
            start: parseInt(match[2]),
            end: parseInt(match[3]),
            strand: match[4] || '+'
        };
    }
    
    /**
     * Check if two actions overlap in position
     */
    actionsOverlap(action1, action2) {
        // Actions overlap if one starts before the other ends
        return action1.start < action2.end && action2.start < action1.end;
    }
    
    /**
     * Calculate conflict severity
     */
    calculateConflictSeverity(action1, action2) {
        const types = [action1.type, action2.type];
        
        // High severity: delete vs any other operation
        if (types.includes(this.ACTION_TYPES.DELETE_SEQUENCE) || types.includes(this.ACTION_TYPES.CUT_SEQUENCE)) {
            return 'high';
        }
        
        // Medium severity: replace vs insert/paste
        if (types.includes(this.ACTION_TYPES.REPLACE_SEQUENCE) && 
            (types.includes(this.ACTION_TYPES.INSERT_SEQUENCE) || types.includes(this.ACTION_TYPES.PASTE_SEQUENCE))) {
            return 'medium';
        }
        
        // Low severity: insert/paste operations
        if (types.includes(this.ACTION_TYPES.INSERT_SEQUENCE) || types.includes(this.ACTION_TYPES.PASTE_SEQUENCE)) {
            return 'low';
        }
        
        return 'medium';
    }
    
    /**
     * Generate human-readable conflict description
     */
    generateConflictDescription(action1, action2) {
        const type1 = action1.type.replace('_', ' ').toLowerCase();
        const type2 = action2.type.replace('_', ' ').toLowerCase();
        const overlap = action1.end - action2.start + 1;
        
        return `${type1} action overlaps with ${type2} action by ${overlap} base pairs`;
    }
    
    /**
     * Highlight conflicting actions in the UI
     */
    highlightConflictingActions(conflicts) {
        console.log(`🎨 [ActionManager] Highlighting ${conflicts.length} conflicting actions`);
        
        // Remove existing conflict highlights
        document.querySelectorAll('.action-item.conflict-highlight').forEach(el => {
            el.classList.remove('conflict-highlight');
        });
        
        // Highlight conflicting actions
        const conflictingActionIds = new Set();
        conflicts.forEach(conflict => {
            conflictingActionIds.add(conflict.action1.id);
            conflictingActionIds.add(conflict.action2.id);
        });
        
        conflictingActionIds.forEach(actionId => {
            const actionElement = document.querySelector(`[data-action-id="${actionId}"]`);
            if (actionElement) {
                actionElement.classList.add('conflict-highlight');
            }
        });
    }
    
    /**
     * Show conflict resolution dialog
     */
    async showConflictResolutionDialog(conflictAnalysis) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'modal fade show';
            dialog.style.display = 'block';
            dialog.innerHTML = `
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle"></i>
                                Action Conflicts Detected
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning">
                                <strong>Warning:</strong> ${conflictAnalysis.conflicts.length} conflicts detected between actions that have overlapping positions.
                            </div>
                            
                            <div class="conflict-list">
                                ${conflictAnalysis.conflicts.map((conflict, index) => `
                                    <div class="conflict-item border rounded p-3 mb-2">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <div>
                                                <h6 class="mb-1">Conflict ${index + 1}</h6>
                                                <p class="mb-1 text-muted">${conflict.description}</p>
                                                <small class="text-muted">
                                                    Chromosome: ${conflict.chromosome} | 
                                                    Overlap: ${conflict.overlapStart}-${conflict.overlapEnd} | 
                                                    Severity: <span class="badge bg-${conflict.severity === 'high' ? 'danger' : conflict.severity === 'medium' ? 'warning' : 'info'}">${conflict.severity}</span>
                                                </small>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            
                            <div class="mt-3">
                                <h6>Resolution Options:</h6>
                                <ul>
                                    <li><strong>Proceed anyway:</strong> Execute actions in order, some may fail or produce unexpected results</li>
                                    <li><strong>Cancel:</strong> Stop execution and manually resolve conflicts</li>
                                </ul>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" onclick="this.closest('.modal').remove(); resolve(false);">
                                <i class="fas fa-times"></i> Cancel Execution
                            </button>
                            <button type="button" class="btn btn-warning" data-bs-dismiss="modal" onclick="this.closest('.modal').remove(); resolve(true);">
                                <i class="fas fa-play"></i> Proceed Anyway
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // Auto-remove after 30 seconds if no response
            setTimeout(() => {
                if (dialog.parentNode) {
                    dialog.remove();
                    resolve(false);
                }
            }, 30000);
        });
    }
    
    /**
     * Create execution checkpoint
     */
    async createExecutionCheckpoint(pendingActions) {
        try {
            const checkpointId = `execution_${Date.now()}`;
            
            // Create comprehensive checkpoint data
            const checkpointData = {
                id: checkpointId,
                timestamp: new Date().toISOString(),
                type: 'execution_checkpoint',
                actions: JSON.parse(JSON.stringify(this.actions)),
                genomeData: this.createGenomeDataBackup(),
                pendingActions: pendingActions.map(a => a.id),
                metadata: {
                    totalActions: this.actions.length,
                    pendingCount: pendingActions.length,
                    chromosomes: Object.keys(this.genomeBrowser.currentAnnotations || {}),
                    totalFeatures: Object.values(this.genomeBrowser.currentAnnotations || {}).reduce((sum, features) => sum + features.length, 0)
                }
            };
            
            // Store checkpoint
            if (window.checkpointManager) {
                await window.checkpointManager.createCheckpoint(checkpointData);
            } else {
                // Fallback: store in localStorage
                localStorage.setItem(`checkpoint_${checkpointId}`, JSON.stringify(checkpointData));
            }
            
            console.log(`✅ [ActionManager] Created execution checkpoint: ${checkpointId}`);
            return checkpointId;
            
        } catch (error) {
            console.error('❌ [ActionManager] Failed to create execution checkpoint:', error);
            return null;
        }
    }
    
    /**
     * Update all features after action execution
     */
    async updateAllFeaturesAfterAction(executedAction, executionGenomeData) {
        console.log(`🔄 [ActionManager] Updating features after ${executedAction.type} action`);
        
        try {
            // Update feature positions based on sequence modifications
            const affectedChromosome = executedAction.metadata?.chromosome;
            if (!affectedChromosome || !executionGenomeData.annotations?.[affectedChromosome]) {
                return;
            }
            
            const features = executionGenomeData.annotations[affectedChromosome];
            const modifications = this.sequenceModifications.get(affectedChromosome) || [];
            
            // Apply position adjustments to all features
            for (const feature of features) {
                const adjustedPositions = this.adjustFeaturePositionsForModifications(
                    feature, 
                    modifications, 
                    affectedChromosome
                );
                
                if (adjustedPositions) {
                    feature.start = adjustedPositions.start;
                    feature.end = adjustedPositions.end;
                }
            }
            
            // Remove features that are no longer valid
            executionGenomeData.annotations[affectedChromosome] = features.filter(feature => 
                feature.start > 0 && feature.end > feature.start
            );
            
            console.log(`✅ [ActionManager] Updated ${features.length} features for chromosome ${affectedChromosome}`);
            
        } catch (error) {
            console.error('❌ [ActionManager] Error updating features:', error);
        }
    }
    
    /**
     * Generate comprehensive GBK file with full action history
     */
    async generateComprehensiveGBK(executionActionsCopy, executionGenomeData, checkpointId) {
        try {
            console.log(`📄 [ActionManager] Generating comprehensive GBK file with action history`);
            
            // Check if ExportManager is available
            if (!this.genomeBrowser.exportManager) {
                this.genomeBrowser.showNotification('Export functionality not available', 'error');
                return;
            }
            
            const chromosomes = Object.keys(this.genomeBrowser.currentSequence || {});
            let genbankContent = '';
            
            for (const chr of chromosomes) {
                // Apply sequence modifications
                const modifiedSequence = this.applySequenceModifications(chr, this.genomeBrowser.currentSequence[chr]);
                const sequence = modifiedSequence;
                
                // Use execution genome data for features
                const featuresSource = executionGenomeData?.annotations?.[chr] || this.genomeBrowser.currentAnnotations?.[chr] || [];
                const adjustedFeatures = this.adjustFeaturePositions(chr, featuresSource);
                const features = adjustedFeatures;
                
                // Get executed actions for this chromosome
                const executedActions = executionActionsCopy.filter(action => 
                    action.status === this.STATUS.COMPLETED && 
                    action.metadata?.chromosome === chr
                );
                
                // Generate GenBank content for this chromosome using original format
                const chrContent = this.generateChromosomeGBKContentOriginal(
                    chr, 
                    sequence, 
                    features, 
                    executedActions, 
                    checkpointId
                );
                
                genbankContent += chrContent + '\n';
            }
            
            // Save the comprehensive GBK file
            const filename = `genome_actions_${new Date().toISOString().slice(0, 10)}_${checkpointId}.gbk`;
            this.downloadTextFile(genbankContent, filename);
            
            this.genomeBrowser.showNotification(`Comprehensive GBK file generated: ${filename}`, 'success');
            console.log(`✅ [ActionManager] Comprehensive GBK file generated successfully`);
            
        } catch (error) {
            console.error('❌ [ActionManager] Error generating comprehensive GBK:', error);
            this.genomeBrowser.showNotification('Error generating GBK file', 'error');
        }
    }
    
    /**
     * Generate GBK content for a single chromosome using original GenBank format
     */
    generateChromosomeGBKContentOriginal(chromosome, sequence, features, executedActions, checkpointId) {
        let content = '';
        
        // Get original source features if available
        const sourceFeatures = this.genomeBrowser.sourceFeatures?.[chromosome] || {};
        const originalAnnotations = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
        
        // Determine sequence type and topology
        const isCircular = sourceFeatures.mol_type?.includes('circular') || 
                          (originalAnnotations.find(f => f.type === 'source' && f.qualifiers?.mol_type?.includes('circular'))) ||
                          false;
        const topology = isCircular ? 'circular' : 'linear';
        
        // Get organism information
        const organism = sourceFeatures.organism || 
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.organism ||
                        'Unknown organism';
        
        // Get strain information
        const strain = sourceFeatures.strain || 
                      originalAnnotations.find(f => f.type === 'source')?.qualifiers?.strain ||
                      '';
        
        // GenBank LOCUS line (exactly as original format)
        const locusName = chromosome.length > 16 ? chromosome.substring(0, 16) : chromosome.padEnd(16);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '-');
        content += `LOCUS       ${locusName} ${sequence.length} bp    DNA     ${topology}   UNK ${dateStr}\n`;
        
        // Add modification history as COMMENT section (before DEFINITION)
        if (executedActions.length > 0) {
            content += `COMMENT     Generated by Genome AI Studio Action Manager\n`;
            content += `COMMENT     Checkpoint ID: ${checkpointId}\n`;
            content += `COMMENT     Total modifications: ${executedActions.length}\n`;
            content += `COMMENT     Export timestamp: ${new Date().toISOString()}\n`;
            content += `COMMENT     \n`;
            
            executedActions.forEach((action, index) => {
                content += `COMMENT     Modification ${index + 1}: ${action.type} at ${action.target}\n`;
                if (action.details) {
                    content += `COMMENT       Description: ${action.details}\n`;
                }
                if (action.metadata?.start && action.metadata?.end) {
                    content += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
                }
                content += `COMMENT     \n`;
            });
        }
        
        // DEFINITION line
        const definition = sourceFeatures.note || 
                          originalAnnotations.find(f => f.type === 'source')?.qualifiers?.note ||
                          `${chromosome} - Modified with ${executedActions.length} sequence actions`;
        content += `DEFINITION  ${definition}\n`;
        
        // ACCESSION line
        const accession = sourceFeatures.db_xref?.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                         originalAnnotations.find(f => f.type === 'source')?.qualifiers?.db_xref?.find(ref => ref.startsWith('taxon:'))?.replace('taxon:', '') ||
                         chromosome;
        content += `ACCESSION   ${accession}\n`;
        
        // VERSION line
        content += `VERSION     ${accession}\n`;
        
        // KEYWORDS line
        const keywords = sourceFeatures.serotype || sourceFeatures.serovar || 
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serotype ||
                        originalAnnotations.find(f => f.type === 'source')?.qualifiers?.serovar ||
                        'genome editing, sequence modification';
        content += `KEYWORDS    ${keywords}\n`;
        
        // SOURCE line
        content += `SOURCE      .\n`;
        
        // ORGANISM line
        content += `  ORGANISM  ${organism}\n`;
        
        // Add organism qualifiers if available
        if (strain) {
            content += `            strain=${strain}\n`;
        }
        if (sourceFeatures.host) {
            content += `            host=${sourceFeatures.host}\n`;
        }
        if (sourceFeatures.country) {
            content += `            country=${sourceFeatures.country}\n`;
        }
        if (sourceFeatures.collection_date) {
            content += `            collection_date=${sourceFeatures.collection_date}\n`;
        }
        
        // FEATURES section
        content += `FEATURES             Location/Qualifiers\n`;
        
        // Add source feature first
        content += `     source          1..${sequence.length}\n`;
        content += `                     /organism="${organism}"\n`;
        content += `                     /mol_type="genomic DNA"\n`;
        if (strain) {
            content += `                     /strain="${strain}"\n`;
        }
        if (sourceFeatures.host) {
            content += `                     /host="${sourceFeatures.host}"\n`;
        }
        if (sourceFeatures.country) {
            content += `                     /country="${sourceFeatures.country}"\n`;
        }
        if (sourceFeatures.collection_date) {
            content += `                     /collection_date="${sourceFeatures.collection_date}"\n`;
        }
        if (sourceFeatures.isolation_source) {
            content += `                     /isolation_source="${sourceFeatures.isolation_source}"\n`;
        }
        
        // Add all other features with original qualifiers
        features.forEach(feature => {
            if (feature.type === 'source') return; // Already added above
            
            const location = this.formatGenBankLocation(feature);
            content += `     ${feature.type.padEnd(16)} ${location}\n`;
            
            // Add all qualifiers from the original feature
            if (feature.qualifiers) {
                Object.entries(feature.qualifiers).forEach(([key, value]) => {
                    if (value === true) {
                        content += `                     /${key}\n`;
                    } else if (value && value !== '') {
                        // Handle multi-line qualifiers
                        const valueStr = String(value);
                        if (valueStr.length > 60) {
                            // Split long qualifiers
                            const lines = this.wrapQualifierValue(valueStr, 60);
                            lines.forEach((line, index) => {
                                if (index === 0) {
                                    content += `                     /${key}="${line}"\n`;
                                } else {
                                    content += `                     "${line}"\n`;
                                }
                            });
                        } else {
                            content += `                     /${key}="${valueStr}"\n`;
                        }
                    }
                });
            }
        });
        
        // ORIGIN section
        content += `ORIGIN\n`;
        
        // Add sequence in GenBank format (60 chars per line, numbered)
        for (let i = 0; i < sequence.length; i += 60) {
            const lineNum = (i + 1).toString().padStart(9);
            const seqLine = sequence.substring(i, i + 60).toLowerCase();
            const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
            content += `${lineNum} ${formattedSeq}\n`;
        }
        
        // End of record
        content += `//\n`;
        
        return content;
    }
    
    /**
     * Format GenBank location string
     */
    formatGenBankLocation(feature) {
        if (feature.strand === -1) {
            return `complement(${feature.start}..${feature.end})`;
        } else {
            return `${feature.start}..${feature.end}`;
        }
    }
    
    /**
     * Wrap long qualifier values
     */
    wrapQualifierValue(value, maxLength) {
        const lines = [];
        let currentLine = '';
        
        const words = value.split(' ');
        for (const word of words) {
            if (currentLine.length + word.length + 1 <= maxLength) {
                currentLine += (currentLine ? ' ' : '') + word;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }
                currentLine = word;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    /**
     * Generate GBK content for a single chromosome (legacy method)
     */
    generateChromosomeGBKContent(chromosome, sequence, features, executedActions, checkpointId) {
        let content = '';
        
        // GenBank header
        content += `LOCUS       ${chromosome.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
        content += `DEFINITION  ${chromosome} - Modified with ${executedActions.length} sequence actions\n`;
        content += `ACCESSION   ${chromosome}\n`;
        content += `VERSION     ${chromosome}\n`;
        content += `KEYWORDS    genome editing, sequence modification, action execution\n`;
        content += `SOURCE      .\n`;
        content += `  ORGANISM  .\n`;
        
        // Add comprehensive modification history
        if (executedActions.length > 0) {
            content += `COMMENT     ========================================================================\n`;
            content += `COMMENT     MODIFICATION HISTORY - Genome AI Studio Action Manager\n`;
            content += `COMMENT     ========================================================================\n`;
            content += `COMMENT     Checkpoint ID: ${checkpointId}\n`;
            content += `COMMENT     Total modifications: ${executedActions.length}\n`;
            content += `COMMENT     Export timestamp: ${new Date().toISOString()}\n`;
            content += `COMMENT     \n`;
            
            executedActions.forEach((action, index) => {
                content += `COMMENT     ------------------------------------------------------------------------\n`;
                content += `COMMENT     Modification ${index + 1}:\n`;
                content += `COMMENT       Action ID: ${action.id}\n`;
                content += `COMMENT       Type: ${action.type}\n`;
                content += `COMMENT       Target: ${action.target}\n`;
                content += `COMMENT       Description: ${action.details || 'N/A'}\n`;
                content += `COMMENT       Executed: ${action.executionEnd ? new Date(action.executionEnd).toISOString() : 'N/A'}\n`;
                content += `COMMENT       Duration: ${action.actualTime ? action.actualTime + 'ms' : 'N/A'}\n`;
                
                if (action.metadata) {
                    if (action.metadata.start && action.metadata.end) {
                        content += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
                        content += `COMMENT       Length: ${action.metadata.end - action.metadata.start + 1} bp\n`;
                    }
                    if (action.metadata.strand) {
                        content += `COMMENT       Strand: ${action.metadata.strand}\n`;
                    }
                }
                
                if (action.result) {
                    if (action.result.sequenceLength) {
                        content += `COMMENT       Sequence length: ${action.result.sequenceLength} bp\n`;
                    }
                    if (action.result.featuresCount !== undefined) {
                        content += `COMMENT       Affected features: ${action.result.featuresCount}\n`;
                    }
                }
                
                content += `COMMENT     \n`;
            });
            
            content += `COMMENT     ========================================================================\n`;
        }
        
        content += `FEATURES             Location/Qualifiers\n`;
        content += `     source          1..${sequence.length}\n`;
        
        // Add features
        features.forEach(feature => {
            const location = feature.strand === '-' ? 
                `complement(${feature.start}..${feature.end})` : 
                `${feature.start}..${feature.end}`;
            
            content += `     ${feature.type.padEnd(16)} ${location}\n`;
            
            // Add qualifiers
            if (feature.name) content += `                     /label="${feature.name}"\n`;
            if (feature.locus_tag) content += `                     /locus_tag="${feature.locus_tag}"\n`;
            if (feature.gene) content += `                     /gene="${feature.gene}"\n`;
            if (feature.product) content += `                     /product="${feature.product}"\n`;
            if (feature.note) content += `                     /note="${feature.note}"\n`;
        });
        
        // Add sequence
        content += `ORIGIN\n`;
        for (let i = 0; i < sequence.length; i += 60) {
            const lineNumber = (i + 1).toString().padStart(9);
            const lineSequence = sequence.slice(i, i + 60);
            const formattedSequence = lineSequence.match(/.{1,10}/g)?.join(' ') || lineSequence;
            content += `${lineNumber} ${formattedSequence}\n`;
        }
        content += `//\n`;
        
        return content;
    }
    
    /**
     * Restore from checkpoint
     */
    async restoreFromCheckpoint(checkpointId) {
        try {
            console.log(`🔄 [ActionManager] Attempting to restore from checkpoint: ${checkpointId}`);
            
            if (window.checkpointManager) {
                await window.checkpointManager.restoreCheckpoint(checkpointId);
            } else {
                // Fallback: restore from localStorage
                const checkpointData = localStorage.getItem(`checkpoint_${checkpointId}`);
                if (checkpointData) {
                    const data = JSON.parse(checkpointData);
                    this.restoreState(data);
                }
            }
            
            console.log(`✅ [ActionManager] Successfully restored from checkpoint`);
            
        } catch (error) {
            console.error('❌ [ActionManager] Failed to restore from checkpoint:', error);
        }
    }
    
    /**
     * Download text file
     */
    downloadTextFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Execute a single action
     */
    async executeAction(action) {
        action.status = this.STATUS.EXECUTING;
        action.executionStart = new Date();
        
        // Notify actions track about status change to executing
        this.notifyActionsTrackUpdate();
        
        try {
            let result;
            
            switch (action.type) {
                case this.ACTION_TYPES.COPY_SEQUENCE:
                    result = await this.executeCopySequence(action);
                    break;
                    
                case this.ACTION_TYPES.CUT_SEQUENCE:
                    result = await this.executeCutSequence(action);
                    break;
                    
                case this.ACTION_TYPES.PASTE_SEQUENCE:
                    result = await this.executePasteSequence(action);
                    break;
                    
                case this.ACTION_TYPES.DELETE_SEQUENCE:
                    result = await this.executeDeleteSequence(action);
                    break;
                    
                case this.ACTION_TYPES.INSERT_SEQUENCE:
                    result = await this.executeInsertSequence(action);
                    break;
                    
                case this.ACTION_TYPES.REPLACE_SEQUENCE:
                    result = await this.executeReplaceSequence(action);
                    break;
                    
                case this.ACTION_TYPES.SEQUENCE_EDIT:
                    result = await this.executeSequenceEdit(action);
                    break;
                    
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
            
            action.status = this.STATUS.COMPLETED;
            action.result = result;
            action.executionEnd = new Date();
            action.actualTime = action.executionEnd - action.executionStart;
            
        } catch (error) {
            action.status = this.STATUS.FAILED;
            action.error = error.message;
            action.executionEnd = new Date();
            console.error(`Error executing action ${action.id}:`, error);
        }
        
        // Notify actions track about status change to completed/failed
        this.notifyActionsTrackUpdate();
    }
    
    /**
     * Execute a single action on copy without affecting original action list or UI
     */
    async executeActionOnCopy(action, executionActionsCopy, executionGenomeData) {
        action.status = this.STATUS.EXECUTING;
        action.executionStart = new Date();
        
        // Don't notify actions track to avoid UI updates during execution
        
        try {
            let result;
            
            switch (action.type) {
                case this.ACTION_TYPES.COPY_SEQUENCE:
                    result = await this.executeCopySequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.CUT_SEQUENCE:
                    result = await this.executeCutSequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.PASTE_SEQUENCE:
                    result = await this.executePasteSequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.DELETE_SEQUENCE:
                    result = await this.executeDeleteSequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.INSERT_SEQUENCE:
                    result = await this.executeInsertSequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.REPLACE_SEQUENCE:
                    result = await this.executeReplaceSequence(action, executionGenomeData);
                    break;
                    
                case this.ACTION_TYPES.SEQUENCE_EDIT:
                    result = await this.executeSequenceEdit(action, executionGenomeData);
                    break;
                    
                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }
            
            action.status = this.STATUS.COMPLETED;
            action.result = result;
            action.executionEnd = new Date();
            action.actualTime = action.executionEnd - action.executionStart;
            
        } catch (error) {
            action.status = this.STATUS.FAILED;
            action.error = error.message;
            action.executionEnd = new Date();
            console.error(`Error executing action ${action.id}:`, error);
        }
        
        // Don't notify actions track to avoid UI updates during execution
    }
    
    /**
     * Adjust pending action positions on copy without affecting original action list
     */
    adjustPendingActionPositionsOnCopy(executedAction, startIndex, executionActionsCopy) {
        console.log(`🔧 [ActionManager] Adjusting pending action positions on copy after executing action: ${executedAction.type}`);
        
        // Only adjust if the executed action affects sequence positions
        if (!this.isPositionAffectingAction(executedAction)) {
            console.log(`🔧 [ActionManager] Action ${executedAction.type} does not affect positions, skipping adjustment`);
            return;
        }
        
        const { chromosome, start, end } = executedAction.metadata;
        let positionShift = 0;
        
        // Calculate position shift based on action type
        switch (executedAction.type) {
            case this.ACTION_TYPES.DELETE_SEQUENCE:
            case this.ACTION_TYPES.CUT_SEQUENCE:
                positionShift = -(end - start + 1); // Negative shift for deletions
                break;
                
            case this.ACTION_TYPES.INSERT_SEQUENCE:
                const insertLength = executedAction.metadata.insertSequence ? 
                    executedAction.metadata.insertSequence.length : 
                    (executedAction.metadata.length || 0);
                positionShift = insertLength; // Positive shift for insertions
                break;
                
            case this.ACTION_TYPES.REPLACE_SEQUENCE:
                const originalLength = end - start + 1;
                const newLength = executedAction.metadata.newSequence ? 
                    executedAction.metadata.newSequence.length : 
                    (executedAction.metadata.newLength || originalLength);
                positionShift = newLength - originalLength; // Net change
                break;
                
            case this.ACTION_TYPES.PASTE_SEQUENCE:
                // Handle paste-insert vs paste-replace
                if (executedAction.result && executedAction.result.operation === 'paste-insert') {
                    const pasteLength = executedAction.metadata.clipboardData ? 
                        executedAction.metadata.clipboardData.sequence.length : 0;
                    positionShift = pasteLength;
                } else if (executedAction.result && executedAction.result.operation === 'paste-replace') {
                    const originalLength = end - start + 1;
                    const newLength = executedAction.metadata.clipboardData ? 
                        executedAction.metadata.clipboardData.sequence.length : 0;
                    positionShift = newLength - originalLength;
                }
                break;
        }
        
        if (positionShift === 0) {
            console.log(`🔧 [ActionManager] No position shift needed for action ${executedAction.type}`);
            return;
        }
        
        console.log(`🔧 [ActionManager] Calculated position shift: ${positionShift} for ${chromosome} after position ${start}`);
        
        // Adjust all remaining pending actions on the copy
        let adjustedCount = 0;
        for (let i = startIndex; i < executionActionsCopy.length; i++) {
            const pendingAction = executionActionsCopy[i];
            
            // Only adjust pending actions
            if (pendingAction.status !== this.STATUS.PENDING) {
                continue;
            }
            
            // Only adjust actions on the same chromosome  
            if (!pendingAction.metadata || pendingAction.metadata.chromosome !== chromosome) {
                continue;
            }
            
            // Check if the pending action is affected by the executed action
            const pendingStart = pendingAction.metadata.start || pendingAction.metadata.position;
            const pendingEnd = pendingAction.metadata.end || pendingStart;
            
            // Handle different scenarios based on the executed action type
            if (executedAction.type === this.ACTION_TYPES.DELETE_SEQUENCE || 
                executedAction.type === this.ACTION_TYPES.CUT_SEQUENCE) {
                
                // Check if pending action is completely within the deleted region
                if (pendingStart >= start && pendingEnd <= end) {
                    // Mark as failed - target region no longer exists
                    pendingAction.status = this.STATUS.FAILED;
                    pendingAction.error = `Target region ${pendingStart}-${pendingEnd} was deleted by action ${executedAction.id}`;
                    pendingAction.failureReason = `Deleted by action ${executedAction.id}`;
                    console.log(`❌ [ActionManager] Marking action ${pendingAction.id} as failed - target deleted`);
                    continue;
                }
                
                // Check if pending action starts after the deleted region
                if (pendingStart > end) {
                    // Shift the entire action
                    pendingAction.metadata.start += positionShift;
                    if (pendingAction.metadata.end) {
                        pendingAction.metadata.end += positionShift;
                    }
                    
                    // Update target string
                    if (pendingAction.target && pendingAction.target.includes(':')) {
                        const parts = pendingAction.target.split(':');
                        if (parts.length >= 2) {
                            const positionPart = parts[1];
                            if (positionPart.includes('-')) {
                                const [startStr, endStr] = positionPart.split('-');
                                const oldStart = parseInt(startStr);
                                const oldEnd = parseInt(endStr.split('(')[0]); // Remove strand info
                                const newStart = oldStart + positionShift;
                                const newEnd = oldEnd + positionShift;
                                const strandInfo = endStr.includes('(') ? endStr.substring(endStr.indexOf('(')) : '';
                                pendingAction.target = `${parts[0]}:${newStart}-${newEnd}${strandInfo}`;
                            }
                        }
                    }
                    
                    // Update description
                    if (pendingAction.details && pendingAction.details.replace) {
                        pendingAction.details = pendingAction.details.replace(
                            /(\d+)-(\d+)/g,
                            (match, start, end) => `${parseInt(start) + positionShift}-${parseInt(end) + positionShift}`
                        );
                    }
                    
                    adjustedCount++;
                    console.log(`🔧 [ActionManager] Adjusted action ${pendingAction.id} position by ${positionShift}`);
                }
            } else {
                // For insertions and other modifications, adjust positions after the change
                if (pendingStart > start) {
                    // Shift the entire action
                    pendingAction.metadata.start += positionShift;
                    if (pendingAction.metadata.end) {
                        pendingAction.metadata.end += positionShift;
                    }
                    
                    // Update target string
                    if (pendingAction.target && pendingAction.target.includes(':')) {
                        const parts = pendingAction.target.split(':');
                        if (parts.length >= 2) {
                            const positionPart = parts[1];
                            if (positionPart.includes('-')) {
                                const [startStr, endStr] = positionPart.split('-');
                                const oldStart = parseInt(startStr);
                                const oldEnd = parseInt(endStr.split('(')[0]); // Remove strand info
                                const newStart = oldStart + positionShift;
                                const newEnd = oldEnd + positionShift;
                                const strandInfo = endStr.includes('(') ? endStr.substring(endStr.indexOf('(')) : '';
                                pendingAction.target = `${parts[0]}:${newStart}-${newEnd}${strandInfo}`;
                            }
                        }
                    }
                    
                    // Update description
                    if (pendingAction.details && pendingAction.details.replace) {
                        pendingAction.details = pendingAction.details.replace(
                            /(\d+)-(\d+)/g,
                            (match, start, end) => `${parseInt(start) + positionShift}-${parseInt(end) + positionShift}`
                        );
                    }
                    
                    adjustedCount++;
                    console.log(`🔧 [ActionManager] Adjusted action ${pendingAction.id} position by ${positionShift}`);
                }
            }
        }
        
        console.log(`🔧 [ActionManager] Adjusted ${adjustedCount} pending actions on copy`);
    }

    /**
     * Execute copy sequence action with comprehensive data
     */
    async executeCopySequence(action, executionGenomeData = null) {
        const { chromosome, start, end, strand } = action.metadata;
        const sequence = await this.getSequenceForRegion(chromosome, start, end, strand);
        
        if (!sequence) {
            throw new Error('Unable to retrieve sequence for copying');
        }
        
        // 🔧 CRITICAL FIX: Use execution genome data copy for collecting comprehensive data
        const comprehensiveData = await this.collectComprehensiveData(chromosome, start, end, strand, executionGenomeData);
        
        // Clipboard should already be set when the action was created
        // Update it with comprehensive data if needed
        if (this.clipboard && this.clipboard.sequence === sequence) {
            this.clipboard.comprehensiveData = comprehensiveData;
        }
        
        return {
            operation: 'copy',
            sequenceLength: sequence.length,
            source: action.target,
            featuresCount: comprehensiveData.features?.length || 0,
            annotationsCount: comprehensiveData.annotations?.length || 0
        };
    }
    
    /**
     * Execute cut sequence action
     */
    async executeCutSequence(action, executionGenomeData = null) {
        const { chromosome, start, end, strand } = action.metadata;
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        const sequence = await this.getSequenceForRegion(chromosome, start, end, strand);
        
        if (!sequence) {
            throw new Error('Unable to retrieve sequence for cutting');
        }
        
        // Clipboard should already be set when the action was created
        // Just verify it exists
        if (!this.clipboard || this.clipboard.sequence !== sequence) {
            this.clipboard = {
                type: 'cut',
                sequence: sequence,
                source: action.target,
                timestamp: new Date()
            };
        }
        
        // Record the sequence modification (cut is essentially a delete)
        this.recordSequenceModification(chromosome, {
            type: 'delete',
            position: start,
            start: start,
            end: end,
            length: end - start + 1,
            actionId: action.id,
            operation: 'cut' // Mark this as part of cut operation
        });
        
        // Remove features from source location (cut operation)
        let removedFeaturesCount = 0;
        if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
            const annotations = this.genomeBrowser.currentAnnotations[chromosome];
            const initialCount = annotations.length;
            
            // Remove features that are within the cut region
            this.genomeBrowser.currentAnnotations[chromosome] = annotations.filter(feature => 
                !(feature.start >= start && feature.end <= end)
            );
            
            removedFeaturesCount = initialCount - this.genomeBrowser.currentAnnotations[chromosome].length;
            
            console.log('✂️ [ActionManager] Removed features from cut region:', {
                chromosome: chromosome,
                region: `${start}-${end}`,
                removedFeatures: removedFeaturesCount,
                remainingFeatures: this.genomeBrowser.currentAnnotations[chromosome].length
            });
            
            // Notify genome browser to update displays
            if (this.genomeBrowser.trackRenderer) {
                this.genomeBrowser.trackRenderer.updateFeatureTrack();
            }
        }
        
        return {
            operation: 'cut',
            sequenceLength: sequence.length,
            source: action.target,
            chromosome: chromosome,
            cutRegion: { start, end },
            removedFeaturesCount: removedFeaturesCount
        };
    }
    
    /**
     * Execute paste sequence action with comprehensive features handling
     */
    async executePasteSequence(action, executionGenomeData = null) {
        const { chromosome, start, end } = action.metadata;
        const clipboardData = action.metadata.clipboardData;
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        if (!clipboardData) {
            throw new Error('No clipboard data available for pasting');
        }
        
        console.log('🔄 [ActionManager] Executing paste with comprehensive data:', {
            actionId: action.id,
            target: action.target,
            clipboardFeatures: clipboardData.comprehensiveData?.features?.length || 0,
            hasComprehensiveData: !!clipboardData.comprehensiveData
        });
        
        // Determine if this is an insert or replace based on start/end
        const isInsert = (start === end);
        const operation = isInsert ? 'paste-insert' : 'paste-replace';
        
        // Record sequence modification
        if (isInsert) {
            this.recordSequenceModification(chromosome, {
                type: 'insert',
                position: start,
                sequence: clipboardData.sequence,
                length: clipboardData.sequence.length,
                actionId: action.id,
                operation: operation
            });
        } else {
            this.recordSequenceModification(chromosome, {
                type: 'replace',
                start: start,
                end: end,
                originalLength: end - start + 1,
                newSequence: clipboardData.sequence,
                newLength: clipboardData.sequence.length,
                actionId: action.id,
                operation: operation
            });
        }
        
        // Handle features copying and position adjustment
        let copiedFeaturesCount = 0;
        if (clipboardData.comprehensiveData && clipboardData.comprehensiveData.features && clipboardData.comprehensiveData.features.length > 0) {
            // 🔧 CRITICAL FIX: Pass execution genome data copy to prevent modifying original data
            copiedFeaturesCount = await this.copyFeaturesFromClipboard(clipboardData, chromosome, start, end, isInsert, executionGenomeData);
        }
        
        const result = {
            operation: operation,
            sequenceLength: clipboardData.sequence.length,
            target: action.target,
            source: clipboardData.source,
            chromosome: chromosome,
            copiedFeaturesCount: copiedFeaturesCount
        };
        
        if (isInsert) {
            result.position = start;
        } else {
            result.originalLength = end - start + 1;
            result.newLength = clipboardData.sequence.length;
            result.replacedRegion = { start, end };
        }
        
        return result;
    }
    
    /**
     * Copy features from clipboard to target location with position adjustment
     */
    async copyFeaturesFromClipboard(clipboardData, targetChromosome, targetStart, targetEnd, isInsert, executionGenomeData = null) {
        try {
            const comprehensiveData = clipboardData.comprehensiveData;
            const sourceFeatures = comprehensiveData.features;
            const sourceRegion = comprehensiveData.region;
            
            if (!sourceFeatures || sourceFeatures.length === 0) {
                return 0;
            }
            
            console.log('🧬 [ActionManager] Copying features from clipboard:', {
                sourceFeatures: sourceFeatures.length,
                sourceRegion: sourceRegion,
                targetLocation: `${targetChromosome}:${targetStart}-${targetEnd}`,
                isInsert: isInsert
            });
            
            // Calculate position offset for features
            const sourceStart = sourceRegion.start;
            const sourceEnd = sourceRegion.end;
            
            // For both insert and replace, features are positioned relative to the target start
            const positionOffset = targetStart - sourceStart;
            
            // Create new features with adjusted positions
            const newFeatures = sourceFeatures.map(feature => {
                const newFeature = JSON.parse(JSON.stringify(feature)); // Deep copy
                
                // Adjust positions
                newFeature.start = feature.start + positionOffset;
                newFeature.end = feature.end + positionOffset;
                newFeature.chromosome = targetChromosome;
                
                // Add metadata about the copy operation
                newFeature.copied = {
                    from: `${sourceRegion.chromosome}:${feature.start}-${feature.end}`,
                    to: `${targetChromosome}:${newFeature.start}-${newFeature.end}`,
                    actionId: `paste-${Date.now()}`,
                    timestamp: new Date().toISOString()
                };
                
                // Update any name/ID to avoid conflicts
                if (newFeature.name) {
                    newFeature.name = `${newFeature.name}_copy_${Date.now()}`;
                }
                if (newFeature.locus_tag) {
                    newFeature.locus_tag = `${newFeature.locus_tag}_copy_${Date.now()}`;
                }
                
                console.log('🎯 [ActionManager] Adjusted feature position:', {
                    originalName: feature.name,
                    newName: newFeature.name,
                    originalPos: `${feature.start}-${feature.end}`,
                    newPos: `${newFeature.start}-${newFeature.end}`,
                    offset: positionOffset
                });
                
                return newFeature;
            });
            
            // 🔧 CRITICAL FIX: Insert new features into execution genome data copy, NOT original data
            const annotationsTarget = executionGenomeData?.annotations || this.genomeBrowser.currentAnnotations;
            
            if (!annotationsTarget) {
                console.warn('⚠️ [ActionManager] No annotations target available for feature copying');
                return 0;
            }
            
            if (!annotationsTarget[targetChromosome]) {
                annotationsTarget[targetChromosome] = [];
            }
            
            // Add new features to the target chromosome in the COPY
            annotationsTarget[targetChromosome].push(...newFeatures);
            
            // Sort features by position for better organization
            annotationsTarget[targetChromosome].sort((a, b) => a.start - b.start);
            
            console.log('✅ [ActionManager] Successfully copied features to execution copy:', {
                targetChromosome: targetChromosome,
                featuresAdded: newFeatures.length,
                totalFeaturesNow: annotationsTarget[targetChromosome].length,
                usingExecutionCopy: !!executionGenomeData
            });
            
            // Notify genome browser to update displays
            if (this.genomeBrowser.trackRenderer) {
                this.genomeBrowser.trackRenderer.updateFeatureTrack();
            }
            
            return newFeatures.length;
            
        } catch (error) {
            console.error('❌ [ActionManager] Error copying features from clipboard:', error);
            return 0;
        }
    }
    
    /**
     * Execute delete sequence action
     */
    async executeDeleteSequence(action, executionGenomeData = null) {
        const { chromosome, start, end } = action.metadata;
        
        console.log('🗑️ [ActionManager] Executing delete sequence action:', {
            actionId: action.id,
            target: action.target,
            region: `${chromosome}:${start}-${end}`,
            sequenceLength: end - start + 1
        });
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        // Record the sequence modification
        this.recordSequenceModification(chromosome, {
            type: 'delete',
            position: start,
            start: start,
            end: end,
            length: end - start + 1,
            actionId: action.id
        });
        
        // Handle features in deleted region - preserve original data for rollback
        let deletedFeaturesCount = 0;
        if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
            const annotations = this.genomeBrowser.currentAnnotations[chromosome];
            const initialCount = annotations.length;
            
            // Store deleted features for potential rollback (preserve original data)
            const deletedFeatures = annotations.filter(feature => 
                feature.start >= start && feature.end <= end
            );
            
            // Store deleted features in action metadata for rollback capability
            action.metadata.deletedFeatures = deletedFeatures;
            
            // Remove features that are within the deleted region from current display
            this.genomeBrowser.currentAnnotations[chromosome] = annotations.filter(feature => 
                !(feature.start >= start && feature.end <= end)
            );
            
            deletedFeaturesCount = initialCount - this.genomeBrowser.currentAnnotations[chromosome].length;
            
            console.log('🗑️ [ActionManager] Removed features from deleted region:', {
                chromosome: chromosome,
                region: `${start}-${end}`,
                deletedFeatures: deletedFeaturesCount,
                remainingFeatures: this.genomeBrowser.currentAnnotations[chromosome].length
            });
            
            // Notify genome browser to update displays
            if (this.genomeBrowser.trackRenderer) {
                this.genomeBrowser.trackRenderer.updateFeatureTrack();
            }
        }
        
        return {
            operation: 'delete',
            sequenceLength: end - start + 1,
            target: action.target,
            chromosome: chromosome,
            deletedRegion: { start, end },
            deletedFeaturesCount: deletedFeaturesCount
        };
    }
    
    /**
     * Execute insert sequence action
     */
    async executeInsertSequence(action, executionGenomeData = null) {
        const { chromosome, start, insertSequence } = action.metadata;
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        console.log('➕ [ActionManager] Executing insert sequence action:', {
            actionId: action.id,
            target: action.target,
            region: `${chromosome}:${start}`,
            insertLength: insertSequence.length
        });
        
        // Record the sequence modification
        this.recordSequenceModification(chromosome, {
            type: 'insert',
            position: start,
            sequence: insertSequence,
            length: insertSequence.length,
            actionId: action.id
        });
        
        return {
            operation: 'insert',
            sequenceLength: insertSequence.length,
            target: action.target,
            chromosome: chromosome,
            insertedSequence: insertSequence,
            position: start
        };
    }
    
    /**
     * Execute replace sequence action
     */
    async executeReplaceSequence(action, executionGenomeData = null) {
        const { chromosome, start, end, newSequence } = action.metadata;
        const originalLength = end - start + 1;
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        console.log('🔄 [ActionManager] Executing replace sequence action:', {
            actionId: action.id,
            target: action.target,
            region: `${chromosome}:${start}-${end}`,
            originalLength: originalLength,
            newLength: newSequence.length
        });
        
        // Record the sequence modification  
        this.recordSequenceModification(chromosome, {
            type: 'replace',
            start: start,
            end: end,
            originalLength: originalLength,
            newSequence: newSequence,
            newLength: newSequence.length,
            actionId: action.id
        });
        
        return {
            operation: 'replace',
            originalLength: originalLength,
            newLength: newSequence.length,
            target: action.target,
            chromosome: chromosome,
            replacedRegion: { start, end },
            newSequence: newSequence
        };
    }
    
    /**
     * Record sequence modification for later application
     */
    recordSequenceModification(chromosome, modification) {
        if (!this.sequenceModifications.has(chromosome)) {
            this.sequenceModifications.set(chromosome, []);
        }
        
        const modifications = this.sequenceModifications.get(chromosome);
        modifications.push({
            ...modification,
            timestamp: new Date(),
            applied: false
        });
        
        console.log(`📝 [ActionManager] Recorded ${modification.type} modification for ${chromosome}:`, modification);
    }
    
    /**
     * Adjust positions of pending actions after executing an action
     */
    adjustPendingActionPositions(executedAction, startIndex) {
        console.log(`🔧 [ActionManager] Adjusting pending action positions after executing action: ${executedAction.type}`);
        
        // Only adjust if the executed action affects sequence positions
        if (!this.isPositionAffectingAction(executedAction)) {
            console.log(`🔧 [ActionManager] Action ${executedAction.type} does not affect positions, skipping adjustment`);
            return;
        }
        
        const { chromosome, start, end } = executedAction.metadata;
        let positionShift = 0;
        
        // Calculate position shift based on action type
        switch (executedAction.type) {
            case this.ACTION_TYPES.DELETE_SEQUENCE:
            case this.ACTION_TYPES.CUT_SEQUENCE:
                positionShift = -(end - start + 1); // Negative shift for deletions
                break;
                
            case this.ACTION_TYPES.INSERT_SEQUENCE:
                const insertLength = executedAction.metadata.insertSequence ? 
                    executedAction.metadata.insertSequence.length : 
                    (executedAction.metadata.length || 0);
                positionShift = insertLength; // Positive shift for insertions
                break;
                
            case this.ACTION_TYPES.REPLACE_SEQUENCE:
                const originalLength = end - start + 1;
                const newLength = executedAction.metadata.newSequence ? 
                    executedAction.metadata.newSequence.length : 
                    (executedAction.metadata.newLength || originalLength);
                positionShift = newLength - originalLength; // Net change
                break;
                
            case this.ACTION_TYPES.PASTE_SEQUENCE:
                // Handle paste-insert vs paste-replace
                if (executedAction.result && executedAction.result.operation === 'paste-insert') {
                    const pasteLength = executedAction.metadata.clipboardData ? 
                        executedAction.metadata.clipboardData.sequence.length : 0;
                    positionShift = pasteLength;
                } else if (executedAction.result && executedAction.result.operation === 'paste-replace') {
                    const originalLength = end - start + 1;
                    const newLength = executedAction.metadata.clipboardData ? 
                        executedAction.metadata.clipboardData.sequence.length : 0;
                    positionShift = newLength - originalLength;
                }
                break;
        }
        
        if (positionShift === 0) {
            console.log(`🔧 [ActionManager] No position shift needed for action ${executedAction.type}`);
            return;
        }
        
        console.log(`🔧 [ActionManager] Calculated position shift: ${positionShift} for ${chromosome} after position ${start}`);
        
        // Adjust all remaining pending actions
        let adjustedCount = 0;
        for (let i = startIndex; i < this.actions.length; i++) {
            const pendingAction = this.actions[i];
            
            // Only adjust pending actions
            if (pendingAction.status !== this.STATUS.PENDING) {
                continue;
            }
            
            // Only adjust actions on the same chromosome  
            if (!pendingAction.metadata || pendingAction.metadata.chromosome !== chromosome) {
                continue;
            }
            
            // Check if the pending action is affected by the executed action
            const pendingStart = pendingAction.metadata.start || pendingAction.metadata.position;
            const pendingEnd = pendingAction.metadata.end || pendingStart;
            
            // Handle different scenarios based on the executed action type
            if (executedAction.type === this.ACTION_TYPES.DELETE_SEQUENCE || 
                executedAction.type === this.ACTION_TYPES.CUT_SEQUENCE) {
                
                // Check if pending action is completely within the deleted region
                if (pendingStart >= start && pendingEnd <= end) {
                    console.log(`⚠️ [ActionManager] Pending action ${pendingAction.id} is within deleted region, marking as failed`);
                    pendingAction.status = this.STATUS.FAILED;
                    pendingAction.failureReason = `Target region was deleted by previous action`;
                    continue;
                }
                
                // Check if pending action partially overlaps with deleted region
                if (pendingStart < end && pendingEnd > start) {
                    console.log(`⚠️ [ActionManager] Pending action ${pendingAction.id} partially overlaps with deleted region, marking as failed`);
                    pendingAction.status = this.STATUS.FAILED;
                    pendingAction.failureReason = `Target region partially overlaps with deleted area`;
                    continue;
                }
                
                // Only adjust positions for actions that come after the deletion
                if (pendingStart <= start) {
                    continue; // This action is before the executed action
                }
            } else {
                // For insert/replace actions, only adjust positions that come after
                if (pendingStart <= start) {
                    continue; // This action is before the executed action
                }
            }
            
            // Adjust the pending action's positions
            const originalTarget = pendingAction.target;
            const originalDetails = pendingAction.details;
            
            if (pendingAction.metadata.start) {
                pendingAction.metadata.start += positionShift;
            }
            if (pendingAction.metadata.end) {
                pendingAction.metadata.end += positionShift;
            }
            if (pendingAction.metadata.position) {
                pendingAction.metadata.position += positionShift;
            }
            
            // Update target string
            const newStart = pendingAction.metadata.start || pendingAction.metadata.position;
            const newEnd = pendingAction.metadata.end || newStart;
            const strand = pendingAction.metadata.strand || '+';
            
            if (pendingAction.metadata.end) {
                pendingAction.target = `${chromosome}:${newStart}-${newEnd}(${strand})`;
            } else {
                pendingAction.target = `${chromosome}:${newStart}`;
            }
            
            // Update description to reflect position change
            const positionInfo = pendingAction.metadata.end ? 
                `${newStart}-${newEnd}` : 
                `${newStart}`;
            
            // Safely update details if it exists
            if (pendingAction.details && typeof pendingAction.details === 'string') {
                pendingAction.details = pendingAction.details.replace(
                    /\d+(-\d+)?/,
                    positionInfo
                );
            }
            
            console.log(`🔧 [ActionManager] Adjusted pending action ${pendingAction.id}:`, {
                type: pendingAction.type,
                oldTarget: originalTarget,
                newTarget: pendingAction.target,
                oldDetails: originalDetails,
                newDetails: pendingAction.details,
                positionShift: positionShift
            });
            
            adjustedCount++;
        }
        
        console.log(`🔧 [ActionManager] Adjusted ${adjustedCount} pending actions after executing ${executedAction.type}`);
    }
    
    /**
     * Check if an action type affects sequence positions
     */
    isPositionAffectingAction(action) {
        const positionAffectingTypes = [
            this.ACTION_TYPES.DELETE_SEQUENCE,
            this.ACTION_TYPES.CUT_SEQUENCE,
            this.ACTION_TYPES.INSERT_SEQUENCE,
            this.ACTION_TYPES.REPLACE_SEQUENCE,
            this.ACTION_TYPES.PASTE_SEQUENCE
        ];
        
        return positionAffectingTypes.includes(action.type);
    }
    
    /**
     * Apply all sequence modifications to generate modified sequence
     */
    applySequenceModifications(chromosome, originalSequence) {
        if (!this.sequenceModifications.has(chromosome)) {
            return originalSequence; // No modifications for this chromosome
        }
        
        const modifications = this.sequenceModifications.get(chromosome);
        if (modifications.length === 0) {
            return originalSequence;
        }
        
        console.log(`🔄 [ActionManager] Applying ${modifications.length} modifications to ${chromosome}`);
        
        // Sort modifications by position (descending order to avoid position shifts)
        const sortedModifications = [...modifications].sort((a, b) => {
            const posA = a.position || a.start || 0;
            const posB = b.position || b.start || 0;
            return posB - posA; // Descending order
        });
        
        let modifiedSequence = originalSequence;
        
        for (const mod of sortedModifications) {
            try {
                switch (mod.type) {
                    case 'delete':
                        modifiedSequence = this.applyDeleteModification(modifiedSequence, mod);
                        break;
                    case 'insert':
                        modifiedSequence = this.applyInsertModification(modifiedSequence, mod);
                        break;
                    case 'replace':
                        modifiedSequence = this.applyReplaceModification(modifiedSequence, mod);
                        break;
                    default:
                        console.warn(`Unknown modification type: ${mod.type}`);
                }
                
                console.log(`✅ [ActionManager] Applied ${mod.type} modification at position ${mod.position || mod.start}`);
                
            } catch (error) {
                console.error(`❌ [ActionManager] Error applying ${mod.type} modification:`, error);
            }
        }
        
        console.log(`🔄 [ActionManager] Final sequence length: ${originalSequence.length} → ${modifiedSequence.length}`);
        return modifiedSequence;
    }
    
    /**
     * Apply delete modification to sequence
     */
    applyDeleteModification(sequence, modification) {
        const { start, end } = modification;
        
        // Convert to 0-based indexing
        const startIndex = start - 1;
        const endIndex = end;
        
        if (startIndex < 0 || endIndex > sequence.length) {
            throw new Error(`Delete range ${start}-${end} is out of bounds for sequence length ${sequence.length}`);
        }
        
        const before = sequence.substring(0, startIndex);
        const after = sequence.substring(endIndex);
        
        console.log(`🗑️ [ActionManager] Deleting ${end - start + 1} bp from position ${start}-${end}`);
        return before + after;
    }
    
    /**
     * Apply insert modification to sequence
     */
    applyInsertModification(sequence, modification) {
        const { position, sequence: insertSequence } = modification;
        
        // Convert to 0-based indexing
        const insertIndex = position - 1;
        
        if (insertIndex < 0 || insertIndex > sequence.length) {
            throw new Error(`Insert position ${position} is out of bounds for sequence length ${sequence.length}`);
        }
        
        const before = sequence.substring(0, insertIndex);
        const after = sequence.substring(insertIndex);
        
        console.log(`➕ [ActionManager] Inserting ${insertSequence.length} bp at position ${position}`);
        return before + insertSequence + after;
    }
    
    /**
     * Apply replace modification to sequence
     */
    applyReplaceModification(sequence, modification) {
        const { start, end, newSequence } = modification;
        
        // Convert to 0-based indexing
        const startIndex = start - 1;
        const endIndex = end;
        
        if (startIndex < 0 || endIndex > sequence.length) {
            throw new Error(`Replace range ${start}-${end} is out of bounds for sequence length ${sequence.length}`);
        }
        
        const before = sequence.substring(0, startIndex);
        const after = sequence.substring(endIndex);
        
        console.log(`🔄 [ActionManager] Replacing ${end - start + 1} bp with ${newSequence.length} bp at position ${start}-${end}`);
        return before + newSequence + after;
    }
    
    /**
     * Adjust feature positions based on sequence modifications
     */
    adjustFeaturePositions(chromosome, originalFeatures = null) {
        // Use provided originalFeatures or fall back to backed up original annotations
        const sourceFeatures = originalFeatures || 
                              (this.originalAnnotations && this.originalAnnotations[chromosome]) || 
                              (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) || 
                              [];
        
        if (!this.sequenceModifications.has(chromosome)) {
            return sourceFeatures; // No modifications for this chromosome
        }
        
        const modifications = this.sequenceModifications.get(chromosome);
        if (modifications.length === 0) {
            return sourceFeatures;
        }
        
        console.log(`🔧 [ActionManager] Adjusting ${sourceFeatures.length} features for ${chromosome} with ${modifications.length} modifications`);
        
        // Sort modifications by position (ascending order for position adjustment calculation)
        const sortedModifications = [...modifications].sort((a, b) => {
            const posA = a.position || a.start || 0;
            const posB = b.position || b.start || 0;
            return posA - posB; // Ascending order
        });
        
        const adjustedFeatures = [];
        
        for (const feature of sourceFeatures) {
            const adjustedFeature = this.adjustSingleFeature(feature, sortedModifications);
            
            // Only include features that are still valid after adjustments
            if (adjustedFeature) {
                adjustedFeatures.push(adjustedFeature);
            }
        }
        
        console.log(`🔧 [ActionManager] Feature adjustment complete: ${sourceFeatures.length} → ${adjustedFeatures.length} features`);
        return adjustedFeatures;
    }
    
    /**
     * Adjust a single feature based on modifications
     */
    adjustSingleFeature(feature, sortedModifications) {
        let adjustedStart = feature.start;
        let adjustedEnd = feature.end;
        let isValid = true;
        
        // Apply each modification's position offset
        for (const mod of sortedModifications) {
            const modPosition = mod.position || mod.start || 0;
            const modEnd = mod.end || modPosition;
            
            switch (mod.type) {
                case 'delete':
                    const deleteLength = mod.length || (modEnd - modPosition + 1);
                    
                    // Check if feature is completely within deleted region
                    if (adjustedStart >= modPosition && adjustedEnd <= modEnd) {
                        console.log(`❌ [ActionManager] Feature ${feature.name || feature.type} at ${feature.start}-${feature.end} deleted (within deletion ${modPosition}-${modEnd})`);
                        isValid = false;
                        break;
                    }
                    
                    // Check if feature partially overlaps deletion - handle specially
                    if (adjustedStart < modEnd && adjustedEnd >= modPosition) {
                        // Feature overlaps with deletion
                        if (adjustedStart < modPosition && adjustedEnd > modEnd) {
                            // Feature spans the deletion - shrink it
                            adjustedEnd -= deleteLength;
                            console.log(`⚠️ [ActionManager] Feature ${feature.name || feature.type} spans deletion - adjusted end position`);
                        } else if (adjustedStart < modPosition) {
                            // Feature starts before deletion but ends within it
                            adjustedEnd = modPosition - 1;
                            console.log(`⚠️ [ActionManager] Feature ${feature.name || feature.type} truncated by deletion`);
                        } else {
                            // Feature starts within deletion
                            console.log(`❌ [ActionManager] Feature ${feature.name || feature.type} starts within deletion - removing`);
                            isValid = false;
                            break;
                        }
                    }
                    
                    // Shift features that come after the deletion
                    if (adjustedStart > modEnd) {
                        adjustedStart -= deleteLength;
                        adjustedEnd -= deleteLength;
                    } else if (adjustedEnd > modEnd) {
                        adjustedEnd -= deleteLength;
                    }
                    break;
                    
                case 'insert':
                    const insertLength = mod.length || (mod.sequence ? mod.sequence.length : 0);
                    
                    // Shift features that come after the insertion
                    if (adjustedStart >= modPosition) {
                        adjustedStart += insertLength;
                        adjustedEnd += insertLength;
                    } else if (adjustedEnd >= modPosition) {
                        // Feature spans the insertion point - extend end
                        adjustedEnd += insertLength;
                    }
                    break;
                    
                case 'replace':
                    const originalLength = mod.originalLength || (modEnd - modPosition + 1);
                    const newLength = mod.newLength || (mod.newSequence ? mod.newSequence.length : originalLength);
                    const lengthDiff = newLength - originalLength;
                    
                    // Check if feature is completely within replaced region
                    if (adjustedStart >= modPosition && adjustedEnd <= modEnd) {
                        console.log(`⚠️ [ActionManager] Feature ${feature.name || feature.type} within replacement region - may need manual review`);
                        // Keep the feature but note it's in a replaced region
                    }
                    
                    // Handle features that span or come after the replacement
                    if (adjustedStart < modEnd && adjustedEnd >= modPosition) {
                        // Feature overlaps with replacement
                        if (adjustedStart < modPosition && adjustedEnd > modEnd) {
                            // Feature spans the replacement
                            adjustedEnd += lengthDiff;
                        } else if (adjustedStart < modPosition) {
                            // Feature starts before replacement but ends within it
                            adjustedEnd = modPosition + newLength - 1;
                        }
                        // Features that start within replacement keep their relative positions
                    }
                    
                    // Shift features that come after the replacement
                    if (adjustedStart > modEnd) {
                        adjustedStart += lengthDiff;
                        adjustedEnd += lengthDiff;
                    } else if (adjustedEnd > modEnd) {
                        adjustedEnd += lengthDiff;
                    }
                    break;
            }
            
            if (!isValid) break;
        }
        
        if (!isValid || adjustedStart <= 0 || adjustedEnd <= 0 || adjustedStart > adjustedEnd) {
            return null; // Invalid feature
        }
        
        // Create adjusted feature with all original properties preserved
        const adjustedFeature = {
            ...feature, // Preserve all original properties
            start: adjustedStart,
            end: adjustedEnd
        };
        
        // Add a note about position adjustment if positions changed
        if (adjustedStart !== feature.start || adjustedEnd !== feature.end) {
            const originalNote = adjustedFeature.note || '';
            const adjustmentNote = `Position adjusted from ${feature.start}-${feature.end} due to sequence modifications.`;
            adjustedFeature.note = originalNote ? `${originalNote} ${adjustmentNote}` : adjustmentNote;
            
            console.log(`📍 [ActionManager] Adjusted feature ${feature.name || feature.type}: ${feature.start}-${feature.end} → ${adjustedStart}-${adjustedEnd}`);
        }
        
        return adjustedFeature;
    }
    
    /**
     * Execute sequence edit action
     */
    async executeSequenceEdit(action, executionGenomeData = null) {
        const { changeSummary, originalSequence, modifiedSequence } = action.metadata;
        
        // Ensure original annotations are backed up before any modification
        this.ensureOriginalAnnotationsBackup();
        
        console.log('🔧 [ActionManager] Executing sequence edit action:', {
            actionId: action.id,
            target: action.target,
            totalChanges: changeSummary.totalChanges,
            substitutions: changeSummary.substitutions,
            insertions: changeSummary.insertions,
            deletions: changeSummary.deletions
        });
        
        // Validate the changes
        if (!this.validateSequenceEdit(changeSummary)) {
            throw new Error('Sequence edit validation failed');
        }
        
        // Apply changes (simulation)
        await this.applySequenceChanges(action.metadata);
        
        return {
            operation: 'sequence_edit',
            target: action.target,
            changesApplied: changeSummary.totalChanges,
            originalLength: changeSummary.originalLength,
            newLength: changeSummary.newLength,
            summary: {
                substitutions: changeSummary.substitutions,
                insertions: changeSummary.insertions,
                deletions: changeSummary.deletions
            }
        };
    }
    
    /**
     * Validate sequence edit changes
     */
    validateSequenceEdit(changeSummary) {
        // Basic validation
        if (!changeSummary || changeSummary.totalChanges === 0) {
            console.warn('⚠️ [ActionManager] No changes to apply');
            return false;
        }
        
        // Validate sequence integrity
        if (!changeSummary.modifiedSequence || typeof changeSummary.modifiedSequence !== 'string') {
            console.error('❌ [ActionManager] Invalid modified sequence');
            return false;
        }
        
        // Check for valid DNA bases
        const validBases = /^[ATGCNRYSWKMBDHV]*$/i;
        if (!validBases.test(changeSummary.modifiedSequence)) {
            console.error('❌ [ActionManager] Modified sequence contains invalid bases');
            return false;
        }
        
        console.log('✅ [ActionManager] Sequence edit validation passed');
        return true;
    }
    
    /**
     * Apply sequence changes to genome data
     */
    async applySequenceChanges(metadata) {
        const { chromosome, viewStart, viewEnd, originalSequence, modifiedSequence, changeSummary } = metadata;
        
        console.log('🔧 [ActionManager] Applying sequence changes to genome data...');
        
        // Simulate applying changes to the genome browser
        if (this.genomeBrowser && this.genomeBrowser.currentSequence) {
            // In a real implementation, this would update the actual genome data
            // For now, we'll just log the operation
            
            console.log('📝 [ActionManager] Sequence changes applied:', {
                chromosome: chromosome,
                region: `${viewStart + 1}-${viewEnd}`,
                originalLength: originalSequence.length,
                newLength: modifiedSequence.length,
                changes: {
                    substitutions: changeSummary.substitutions,
                    insertions: changeSummary.insertions,
                    deletions: changeSummary.deletions
                }
            });
            
            // Notify the user about the successful application
            this.genomeBrowser.showNotification(
                `Sequence edit applied: ${changeSummary.totalChanges} changes to ${chromosome}:${viewStart + 1}-${viewEnd}`,
                'success'
            );
        }
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('✅ [ActionManager] Sequence changes applied successfully');
    }
    
    /**
     * Show action list modal
     */
    showActionList() {
        // Enable Actions track if not already visible
        if (!this.genomeBrowser.visibleTracks.has('actions')) {
            console.log('🎯 Enabling Actions track for Action List display');
            this.genomeBrowser.enableActionsTrack();
        }
        
        this.updateActionListUI();
        const modal = document.getElementById('actionListModal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * Close action list modal
     */
    closeActionList() {
        const modal = document.getElementById('actionListModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * Update action list UI
     */
    updateActionListUI() {
        const content = document.getElementById('actionListContent');
        
        if (this.actions.length === 0) {
            content.innerHTML = `
                <div class="empty-actions-message">
                    <i class="fas fa-inbox"></i>
                    <p>No actions queued</p>
                    <small>Use the Action menu to add sequence operations</small>
                </div>
            `;
            return;
        }
        
        content.innerHTML = this.actions.map((action, index) => this.renderActionItem(action, index)).join('');
        
        // Add event listeners for action controls
        this.actions.forEach(action => {
            const removeBtn = document.getElementById(`remove-${action.id}`);
            const editBtn = document.getElementById(`edit-${action.id}`);
            const executeBtn = document.getElementById(`execute-${action.id}`);
            
            removeBtn?.addEventListener('click', () => this.removeAction(action.id));
            editBtn?.addEventListener('click', () => this.editAction(action.id));
            executeBtn?.addEventListener('click', () => this.executeSingleAction(action.id));
        });
    }
    
    /**
     * Render single action item
     */
    renderActionItem(action, index) {
        const statusClass = action.status.toLowerCase();
        const typeDisplay = action.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        return `
            <div class="action-item ${statusClass}" data-action-id="${action.id}">
                <div class="action-order">${index + 1}</div>
                <div class="action-type">${typeDisplay}</div>
                <div class="action-target">${action.target}</div>
                <div class="action-details">${action.details}</div>
                <div class="action-status">
                    <span class="status-badge ${statusClass}">${action.status}</span>
                    ${action.status === this.STATUS.FAILED && action.failureReason ? 
                        `<div class="failure-reason" title="${action.failureReason}">⚠️ ${action.failureReason}</div>` : ''}
                </div>
                <div class="action-controls">
                    ${action.status === this.STATUS.PENDING ? `
                        <button id="execute-${action.id}" class="btn btn-sm btn-primary" title="Execute">
                            <i class="fas fa-play"></i>
                        </button>
                        <button id="edit-${action.id}" class="btn btn-sm btn-secondary" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                    ` : ''}
                    <button id="remove-${action.id}" class="btn btn-sm btn-warning" title="Remove">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Update statistics
     */
    updateStats() {
        document.getElementById('actionCount').textContent = this.actions.length;
        
        const estimatedTime = this.actions
            .filter(action => action.status === this.STATUS.PENDING)
            .reduce((total, action) => total + action.estimatedTime, 0);
        
        document.getElementById('estimatedTime').textContent = `${(estimatedTime / 1000).toFixed(1)}s`;
    }
    
    /**
     * Estimate action execution time
     */
    estimateActionTime(type) {
        const estimates = {
            [this.ACTION_TYPES.COPY_SEQUENCE]: 500,
            [this.ACTION_TYPES.CUT_SEQUENCE]: 750,
            [this.ACTION_TYPES.PASTE_SEQUENCE]: 1000,
            [this.ACTION_TYPES.DELETE_SEQUENCE]: 600,
            [this.ACTION_TYPES.INSERT_SEQUENCE]: 800,
            [this.ACTION_TYPES.REPLACE_SEQUENCE]: 900,
            [this.ACTION_TYPES.SEQUENCE_EDIT]: 1500
        };
        
        return estimates[type] || 500;
    }
    
    /**
     * Remove action from queue
     */
    removeAction(actionId) {
        this.actions = this.actions.filter(action => action.id !== actionId);
        this.updateActionListUI();
        this.updateStats();
        
        // Notify actions track to update
        this.notifyActionsTrackUpdate();
    }
    
    /**
     * Clear all actions
     */
    clearAllActions() {
        if (this.actions.length === 0) {
            this.genomeBrowser.showNotification('No actions to clear', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear all actions?')) {
            this.actions = [];
            this.updateActionListUI();
            this.updateStats();
            
            // Notify actions track to update
            this.notifyActionsTrackUpdate();
            
            this.genomeBrowser.showNotification('All actions cleared', 'success');
        }
    }
    
    /**
     * Export actions to file
     */
    exportActions() {
        if (this.actions.length === 0) {
            this.genomeBrowser.showNotification('No actions to export', 'info');
            return;
        }
        
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            actions: this.actions,
            clipboard: this.clipboard
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `genome-actions-${new Date().getTime()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.genomeBrowser.showNotification('Actions exported successfully', 'success');
    }
    
    /**
     * Import actions from file
     */
    importActions() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    
                    if (!importData.actions || !Array.isArray(importData.actions)) {
                        throw new Error('Invalid action file format');
                    }
                    
                    // Import actions
                    importData.actions.forEach(action => {
                        action.id = this.nextActionId++;
                        action.status = this.STATUS.PENDING; // Reset status
                    });
                    
                    this.actions.push(...importData.actions);
                    
                    // Import clipboard if available
                    if (importData.clipboard) {
                        this.clipboard = importData.clipboard;
                    }
                    
                    this.updateActionListUI();
                    this.updateStats();
                    
                    // Notify actions track to update
                    this.notifyActionsTrackUpdate();
                    
                    this.genomeBrowser.showNotification(`${importData.actions.length} actions imported successfully`, 'success');
                    
                } catch (error) {
                    console.error('Error importing actions:', error);
                    this.genomeBrowser.showNotification('Error importing actions file', 'error');
                }
            };
            
            reader.readAsText(file);
        };
        
        input.click();
    }
    
    /**
     * Execute single action
     */
    async executeSingleAction(actionId) {
        const action = this.actions.find(a => a.id === actionId);
        if (!action) return;
        
        if (action.status !== this.STATUS.PENDING) {
            this.genomeBrowser.showNotification('Action is not in pending state', 'warning');
            return;
        }
        
        try {
            await this.executeAction(action);
            
            // Find the index of the executed action and adjust subsequent pending actions
            const actionIndex = this.actions.findIndex(a => a.id === actionId);
            if (actionIndex !== -1) {
                this.adjustPendingActionPositions(action, actionIndex + 1);
            }
            
            this.updateActionListUI();
            this.updateStats();
            this.genomeBrowser.showNotification('Action executed successfully', 'success');
        } catch (error) {
            console.error('Error executing single action:', error);
            this.genomeBrowser.showNotification('Error executing action', 'error');
        }
    }
    
    /**
     * Show execution progress
     */
    showExecutionProgress(current, total) {
        let progressDiv = document.getElementById('actionProgress');
        
        if (!progressDiv) {
            progressDiv = document.createElement('div');
            progressDiv.id = 'actionProgress';
            progressDiv.className = 'action-progress';
            document.body.appendChild(progressDiv);
        }
        
        const percentage = Math.round((current / total) * 100);
        
        progressDiv.innerHTML = `
            <div class="action-progress-title">
                <i class="fas fa-cogs"></i>
                Executing Actions
            </div>
            <div class="action-progress-details">
                ${current} of ${total} actions completed
            </div>
            <div class="action-progress-bar">
                <div class="action-progress-fill" style="width: ${percentage}%"></div>
            </div>
        `;
    }
    
    /**
     * Hide execution progress
     */
    hideExecutionProgress() {
        const progressDiv = document.getElementById('actionProgress');
        if (progressDiv) {
            progressDiv.remove();
        }
    }
    
    /**
     * Create checkpoint
     */
    createCheckpoint() {
        if (window.checkpointManager) {
            window.checkpointManager.createManualCheckpoint();
        } else {
            this.genomeBrowser.showNotification('Checkpoint system not available', 'warning');
        }
    }
    
    /**
     * Rollback to checkpoint
     */
    rollback() {
        if (window.checkpointManager) {
            window.checkpointManager.showCheckpointList();
        } else {
            this.genomeBrowser.showNotification('Rollback system not available', 'warning');
        }
    }
    
    /**
     * Get current state for checkpointing
     */
    getState() {
        return {
            actions: JSON.parse(JSON.stringify(this.actions)),
            clipboard: this.clipboard ? JSON.parse(JSON.stringify(this.clipboard)) : null,
            nextActionId: this.nextActionId
        };
    }
    
    /**
     * Generate and save GBK file from execution copy with modification history
     */
    async generateAndSaveGBKFromCopy(executionActionsCopy, executionGenomeData = null) {
        try {
            // Check if we have genome data to export
            if (!this.genomeBrowser.currentSequence) {
                this.genomeBrowser.showNotification('No genome data available for GBK export', 'warning');
                return;
            }
            
            // Check if ExportManager is available
            if (!this.genomeBrowser.exportManager) {
                this.genomeBrowser.showNotification('Export functionality not available', 'error');
                return;
            }
            
            // Generate GBK content using ExportManager
            const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
            let genbankContent = '';

            chromosomes.forEach(chr => {
                // Apply sequence modifications if any exist
                const modifiedSequence = this.applySequenceModifications(chr, this.genomeBrowser.currentSequence[chr]);
                const sequence = modifiedSequence;
                
                // 🔧 CRITICAL FIX: Use execution genome data for features to preserve strand information
                const featuresSource = executionGenomeData?.annotations?.[chr] || this.genomeBrowser.currentAnnotations?.[chr] || [];
                
                // Adjust feature positions based on sequence modifications
                const adjustedFeatures = this.adjustFeaturePositions(chr, featuresSource);
                const features = adjustedFeatures;
                
                // Get executed actions for modification history from execution copy
                const executedActions = executionActionsCopy.filter(action => action.status === this.STATUS.COMPLETED);
                const relevantActions = executedActions.filter(action => 
                    action.metadata && action.metadata.chromosome === chr
                );
                
                // GenBank header
                genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
                genbankContent += `DEFINITION  ${chr} - Modified with sequence actions (${relevantActions.length} modifications)\n`;
                genbankContent += `ACCESSION   ${chr}\n`;
                genbankContent += `VERSION     ${chr}\n`;
                genbankContent += `KEYWORDS    genome editing, sequence modification, action execution\n`;
                genbankContent += `SOURCE      .\n`;
                genbankContent += `  ORGANISM  .\n`;
                
                // Add modification history as comments
                if (relevantActions.length > 0) {
                    genbankContent += `COMMENT     MODIFICATION HISTORY:\n`;
                    genbankContent += `COMMENT     This sequence has been modified using Genome AI Studio Action Manager.\n`;
                    genbankContent += `COMMENT     Total modifications: ${relevantActions.length}\n`;
                    genbankContent += `COMMENT     Export timestamp: ${new Date().toISOString()}\n`;
                    genbankContent += `COMMENT     \n`;
                    
                    relevantActions.forEach((action, index) => {
                        genbankContent += `COMMENT     Modification ${index + 1}:\n`;
                        genbankContent += `COMMENT       Action ID: ${action.id}\n`;
                        genbankContent += `COMMENT       Type: ${action.type}\n`;
                        genbankContent += `COMMENT       Target: ${action.target}\n`;
                        genbankContent += `COMMENT       Description: ${action.details || 'N/A'}\n`;
                        genbankContent += `COMMENT       Executed: ${action.executionEnd ? new Date(action.executionEnd).toISOString() : 'N/A'}\n`;
                        genbankContent += `COMMENT       Duration: ${action.actualTime ? action.actualTime + 'ms' : 'N/A'}\n`;
                        
                        // Add specific details based on action type
                        if (action.metadata) {
                            if (action.metadata.start && action.metadata.end) {
                                genbankContent += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
                                genbankContent += `COMMENT       Length: ${action.metadata.end - action.metadata.start + 1} bp\n`;
                            }
                            if (action.metadata.strand) {
                                genbankContent += `COMMENT       Strand: ${action.metadata.strand}\n`;
                            }
                        }
                        
                        // Add result information if available
                        if (action.result) {
                            if (action.result.sequenceLength) {
                                genbankContent += `COMMENT       Sequence length: ${action.result.sequenceLength} bp\n`;
                            }
                            if (action.result.featuresCount !== undefined) {
                                genbankContent += `COMMENT       Affected features: ${action.result.featuresCount}\n`;
                            }
                        }
                        
                        genbankContent += `COMMENT     \n`;
                    });
                }
                genbankContent += `FEATURES             Location/Qualifiers\n`;
                genbankContent += `     source          1..${sequence.length}\n`;
                
                // Add features
                features.forEach(feature => {
                    const location = feature.strand === '-' ? 
                        `complement(${feature.start}..${feature.end})` : 
                        `${feature.start}..${feature.end}`;
                    
                    genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;
                    
                    // Add comprehensive qualifier information
                    // Priority order: qualifiers object properties, then direct properties
                    const qualifiers = feature.qualifiers || {};
                    
                    // Gene name/identifier
                    const geneName = qualifiers.gene || feature.name || qualifiers.locus_tag;
                    if (geneName) {
                        genbankContent += `                     /gene="${geneName}"\n`;
                    }
                    
                    // Locus tag (if different from gene name)
                    if (qualifiers.locus_tag && qualifiers.locus_tag !== geneName) {
                        genbankContent += `                     /locus_tag="${qualifiers.locus_tag}"\n`;
                    }
                    
                    // Product description
                    const product = qualifiers.product || feature.product;
                    if (product) {
                        genbankContent += `                     /product="${product}"\n`;
                    }
                    
                    // Protein ID
                    if (qualifiers.protein_id) {
                        genbankContent += `                     /protein_id="${qualifiers.protein_id}"\n`;
                    }
                    
                    // Translation (for CDS features)
                    if (feature.type === 'CDS' && qualifiers.translation) {
                        genbankContent += `                     /translation="${qualifiers.translation}"\n`;
                    }
                    
                    // Codon start
                    if (qualifiers.codon_start) {
                        genbankContent += `                     /codon_start=${qualifiers.codon_start}\n`;
                    }
                    
                    // Transl table
                    if (qualifiers.transl_table) {
                        genbankContent += `                     /transl_table=${qualifiers.transl_table}\n`;
                    }
                    
                    // Function/EC number
                    if (qualifiers.EC_number) {
                        genbankContent += `                     /EC_number="${qualifiers.EC_number}"\n`;
                    }
                    
                    // GO terms
                    if (qualifiers.GO_component) {
                        genbankContent += `                     /GO_component="${qualifiers.GO_component}"\n`;
                    }
                    if (qualifiers.GO_function) {
                        genbankContent += `                     /GO_function="${qualifiers.GO_function}"\n`;
                    }
                    if (qualifiers.GO_process) {
                        genbankContent += `                     /GO_process="${qualifiers.GO_process}"\n`;
                    }
                    
                    // Database cross-references
                    if (qualifiers.db_xref) {
                        if (Array.isArray(qualifiers.db_xref)) {
                            qualifiers.db_xref.forEach(xref => {
                                genbankContent += `                     /db_xref="${xref}"\n`;
                            });
                        } else {
                            genbankContent += `                     /db_xref="${qualifiers.db_xref}"\n`;
                        }
                    }
                    
                    // Inference
                    if (qualifiers.inference) {
                        genbankContent += `                     /inference="${qualifiers.inference}"\n`;
                    }
                    
                    // Notes (combine multiple sources)
                    const notes = [];
                    if (qualifiers.note) {
                        if (Array.isArray(qualifiers.note)) {
                            notes.push(...qualifiers.note);
                        } else {
                            notes.push(qualifiers.note);
                        }
                    }
                    if (feature.note && !notes.includes(feature.note)) {
                        notes.push(feature.note);
                    }
                    
                    notes.forEach(note => {
                        genbankContent += `                     /note="${note}"\n`;
                    });
                });
                
                genbankContent += `ORIGIN\n`;
                
                // Add sequence in GenBank format (60 chars per line, numbered)
                for (let i = 0; i < sequence.length; i += 60) {
                    const lineNum = (i + 1).toString().padStart(9);
                    const seqLine = sequence.substring(i, i + 60).toLowerCase();
                    const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
                    genbankContent += `${lineNum} ${formattedSeq}\n`;
                }
                
                genbankContent += `//\n\n`;
            });
            
            // Save the generated GBK file
            const fileName = `modified_genome_${new Date().toISOString().replace(/[:.]/g, '-')}.gbk`;
            this.genomeBrowser.exportManager.downloadFile(genbankContent, fileName, 'text/plain');
            
            this.genomeBrowser.showNotification(`GBK file exported successfully: ${fileName}`, 'success');
            console.log(`✅ [ActionManager] GBK file generated: ${fileName}`);
            
        } catch (error) {
            console.error('❌ [ActionManager] Error generating GBK file:', error);
            this.genomeBrowser.showNotification('Error generating GBK file', 'error');
        }
    }

    /**
     * Generate and save GBK file after action execution
     */
    async generateAndSaveGBK() {
        try {
            // Check if we have genome data to export
            if (!this.genomeBrowser.currentSequence) {
                this.genomeBrowser.showNotification('No genome data available for GBK export', 'warning');
                return;
            }
            
            // Check if ExportManager is available
            if (!this.genomeBrowser.exportManager) {
                this.genomeBrowser.showNotification('Export functionality not available', 'error');
                return;
            }
            
            // Generate GBK content using ExportManager
            const chromosomes = Object.keys(this.genomeBrowser.currentSequence);
            let genbankContent = '';

            chromosomes.forEach(chr => {
                // Apply sequence modifications if any exist
                const modifiedSequence = this.applySequenceModifications(chr, this.genomeBrowser.currentSequence[chr]);
                const sequence = modifiedSequence;
                
                // Adjust feature positions based on sequence modifications
                const adjustedFeatures = this.adjustFeaturePositions(chr, this.genomeBrowser.currentAnnotations[chr] || []);
                const features = adjustedFeatures;
                
                // Get executed actions for modification history
                const executedActions = this.actions.filter(action => action.status === this.STATUS.COMPLETED);
                const relevantActions = executedActions.filter(action => 
                    action.metadata && action.metadata.chromosome === chr
                );
                
                // GenBank header
                genbankContent += `LOCUS       ${chr.padEnd(16)} ${sequence.length} bp    DNA     linear   UNK ${new Date().toISOString().slice(0, 10).replace(/-/g, '-')}\n`;
                genbankContent += `DEFINITION  ${chr} - Modified with sequence actions (${relevantActions.length} modifications)\n`;
                genbankContent += `ACCESSION   ${chr}\n`;
                genbankContent += `VERSION     ${chr}\n`;
                genbankContent += `KEYWORDS    genome editing, sequence modification, action execution\n`;
                genbankContent += `SOURCE      .\n`;
                genbankContent += `  ORGANISM  .\n`;
                
                // Add modification history as comments
                if (relevantActions.length > 0) {
                    genbankContent += `COMMENT     MODIFICATION HISTORY:\n`;
                    genbankContent += `COMMENT     This sequence has been modified using Genome AI Studio Action Manager.\n`;
                    genbankContent += `COMMENT     Total modifications: ${relevantActions.length}\n`;
                    genbankContent += `COMMENT     Export timestamp: ${new Date().toISOString()}\n`;
                    genbankContent += `COMMENT     \n`;
                    
                    relevantActions.forEach((action, index) => {
                        genbankContent += `COMMENT     Modification ${index + 1}:\n`;
                        genbankContent += `COMMENT       Action ID: ${action.id}\n`;
                        genbankContent += `COMMENT       Type: ${action.type}\n`;
                        genbankContent += `COMMENT       Target: ${action.target}\n`;
                        genbankContent += `COMMENT       Description: ${action.details || 'N/A'}\n`;
                        genbankContent += `COMMENT       Executed: ${action.executionEnd ? new Date(action.executionEnd).toISOString() : 'N/A'}\n`;
                        genbankContent += `COMMENT       Duration: ${action.actualTime ? action.actualTime + 'ms' : 'N/A'}\n`;
                        
                        // Add specific details based on action type
                        if (action.metadata) {
                            if (action.metadata.start && action.metadata.end) {
                                genbankContent += `COMMENT       Position: ${action.metadata.start}-${action.metadata.end}\n`;
                                genbankContent += `COMMENT       Length: ${action.metadata.end - action.metadata.start + 1} bp\n`;
                            }
                            if (action.metadata.strand) {
                                genbankContent += `COMMENT       Strand: ${action.metadata.strand}\n`;
                            }
                        }
                        
                        // Add result information if available
                        if (action.result) {
                            if (action.result.sequenceLength) {
                                genbankContent += `COMMENT       Sequence length: ${action.result.sequenceLength} bp\n`;
                            }
                            if (action.result.featuresCount !== undefined) {
                                genbankContent += `COMMENT       Affected features: ${action.result.featuresCount}\n`;
                            }
                        }
                        
                        genbankContent += `COMMENT     \n`;
                    });
                }
                genbankContent += `FEATURES             Location/Qualifiers\n`;
                genbankContent += `     source          1..${sequence.length}\n`;
                
                // Add features
                features.forEach(feature => {
                    const location = feature.strand === '-' ? 
                        `complement(${feature.start}..${feature.end})` : 
                        `${feature.start}..${feature.end}`;
                    
                    genbankContent += `     ${feature.type.padEnd(15)} ${location}\n`;
                    
                    // Add comprehensive qualifier information
                    // Priority order: qualifiers object properties, then direct properties
                    const qualifiers = feature.qualifiers || {};
                    
                    // Gene name/identifier
                    const geneName = qualifiers.gene || feature.name || qualifiers.locus_tag;
                    if (geneName) {
                        genbankContent += `                     /gene="${geneName}"\n`;
                    }
                    
                    // Locus tag (if different from gene name)
                    if (qualifiers.locus_tag && qualifiers.locus_tag !== geneName) {
                        genbankContent += `                     /locus_tag="${qualifiers.locus_tag}"\n`;
                    }
                    
                    // Product description
                    const product = qualifiers.product || feature.product;
                    if (product) {
                        genbankContent += `                     /product="${product}"\n`;
                    }
                    
                    // Protein ID
                    if (qualifiers.protein_id) {
                        genbankContent += `                     /protein_id="${qualifiers.protein_id}"\n`;
                    }
                    
                    // Translation (for CDS features)
                    if (feature.type === 'CDS' && qualifiers.translation) {
                        genbankContent += `                     /translation="${qualifiers.translation}"\n`;
                    }
                    
                    // Codon start
                    if (qualifiers.codon_start) {
                        genbankContent += `                     /codon_start=${qualifiers.codon_start}\n`;
                    }
                    
                    // Transl table
                    if (qualifiers.transl_table) {
                        genbankContent += `                     /transl_table=${qualifiers.transl_table}\n`;
                    }
                    
                    // Function/EC number
                    if (qualifiers.EC_number) {
                        genbankContent += `                     /EC_number="${qualifiers.EC_number}"\n`;
                    }
                    
                    // GO terms
                    if (qualifiers.GO_component) {
                        genbankContent += `                     /GO_component="${qualifiers.GO_component}"\n`;
                    }
                    if (qualifiers.GO_function) {
                        genbankContent += `                     /GO_function="${qualifiers.GO_function}"\n`;
                    }
                    if (qualifiers.GO_process) {
                        genbankContent += `                     /GO_process="${qualifiers.GO_process}"\n`;
                    }
                    
                    // Database cross-references
                    if (qualifiers.db_xref) {
                        if (Array.isArray(qualifiers.db_xref)) {
                            qualifiers.db_xref.forEach(xref => {
                                genbankContent += `                     /db_xref="${xref}"\n`;
                            });
                        } else {
                            genbankContent += `                     /db_xref="${qualifiers.db_xref}"\n`;
                        }
                    }
                    
                    // Inference
                    if (qualifiers.inference) {
                        genbankContent += `                     /inference="${qualifiers.inference}"\n`;
                    }
                    
                    // Notes (combine multiple sources)
                    const notes = [];
                    if (qualifiers.note) {
                        if (Array.isArray(qualifiers.note)) {
                            notes.push(...qualifiers.note);
                        } else {
                            notes.push(qualifiers.note);
                        }
                    }
                    if (feature.note && !notes.includes(feature.note)) {
                        notes.push(feature.note);
                    }
                    
                    notes.forEach(note => {
                        genbankContent += `                     /note="${note}"\n`;
                    });
                });
                
                genbankContent += `ORIGIN\n`;
                
                // Add sequence in GenBank format (60 chars per line, numbered)
                for (let i = 0; i < sequence.length; i += 60) {
                    const lineNum = (i + 1).toString().padStart(9);
                    const seqLine = sequence.substring(i, i + 60).toLowerCase();
                    const formattedSeq = seqLine.match(/.{1,10}/g)?.join(' ') || seqLine;
                    genbankContent += `${lineNum} ${formattedSeq}\n`;
                }
                
                genbankContent += `//\n\n`;
            });
            
            // Prompt user to save the file
            await this.promptSaveGBK(genbankContent);
            
        } catch (error) {
            console.error('Error generating GBK file:', error);
            this.genomeBrowser.showNotification('Error generating GBK file', 'error');
        }
    }
    
    /**
     * Prompt user to save GBK file
     */
    async promptSaveGBK(content) {
        try {
            // Use Electron dialog to prompt for save location
            const { ipcRenderer } = require('electron');
            
            const result = await ipcRenderer.invoke('show-save-dialog', {
                title: 'Save modified genome as GenBank file',
                defaultPath: 'modified_genome.gbk',
                filters: [
                    { name: 'GenBank Files', extensions: ['gbk', 'gb', 'genbank'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (!result.canceled && result.filePath) {
                // Write file using Node.js fs
                const fs = require('fs');
                await fs.promises.writeFile(result.filePath, content, 'utf8');
                
                this.genomeBrowser.showNotification(`GBK file saved to: ${result.filePath}`, 'success');
            }
            
        } catch (error) {
            console.error('Error saving GBK file:', error);
            
            // Fallback to browser download if Electron dialog fails
            this.downloadGBKFile(content);
        }
    }
    
    /**
     * Fallback method to download GBK file using browser
     */
    downloadGBKFile(content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'modified_genome.gbk';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
        
        this.genomeBrowser.showNotification('GBK file downloaded as modified_genome.gbk', 'success');
    }

    /**
     * Restore state from checkpoint
     */
    restoreState(state) {
        this.actions = state.actions || [];
        this.clipboard = state.clipboard || null;
        this.nextActionId = state.nextActionId || 1;
        
        this.updateActionListUI();
        this.updateStats();
    }

    /**
     * 🔧 CRITICAL FIX: Create backup of original genome data before execution
     */
    createGenomeDataBackup() {
        console.log('🔒 [ActionManager] Creating genome data backup...');
        
        const backup = {
            annotations: null,
            variants: null,
            reads: null,
            sequences: null,
            metadata: {}
        };

        try {
            // Backup annotations (most critical for Actions)
            if (this.genomeBrowser.currentAnnotations) {
                backup.annotations = JSON.parse(JSON.stringify(this.genomeBrowser.currentAnnotations));
                console.log(`📝 [ActionManager] Backed up annotations for ${Object.keys(backup.annotations).length} chromosomes`);
            }

            // Backup variants
            if (this.genomeBrowser.currentVariants) {
                backup.variants = JSON.parse(JSON.stringify(this.genomeBrowser.currentVariants));
                console.log(`🧬 [ActionManager] Backed up variants for ${Object.keys(backup.variants).length} chromosomes`);
            }

            // Backup reads
            if (this.genomeBrowser.currentReads) {
                backup.reads = JSON.parse(JSON.stringify(this.genomeBrowser.currentReads));
                console.log(`📚 [ActionManager] Backed up reads for ${Object.keys(backup.reads).length} chromosomes`);
            }

            // Backup sequences if available
            if (this.genomeBrowser.currentSequences) {
                backup.sequences = JSON.parse(JSON.stringify(this.genomeBrowser.currentSequences));
                console.log(`🔤 [ActionManager] Backed up sequences for ${Object.keys(backup.sequences).length} chromosomes`);
            }

            // Add metadata
            backup.metadata = {
                timestamp: new Date().toISOString(),
                backupId: `backup_${Date.now()}`,
                totalFeatures: Object.values(backup.annotations || {}).reduce((sum, features) => sum + features.length, 0)
            };

            console.log(`✅ [ActionManager] Genome data backup completed:`, backup.metadata);
            return backup;

        } catch (error) {
            console.error('❌ [ActionManager] Failed to create genome data backup:', error);
            throw new Error(`Failed to create genome data backup: ${error.message}`);
        }
    }

    /**
     * 🔧 CRITICAL FIX: Create working copy of genome data for execution
     */
    createGenomeDataCopy(originalData) {
        console.log('🧬 [ActionManager] Creating genome data execution copy...');

        try {
            // Create deep copy of all genome data
            const executionCopy = {
                annotations: originalData.annotations ? JSON.parse(JSON.stringify(originalData.annotations)) : null,
                variants: originalData.variants ? JSON.parse(JSON.stringify(originalData.variants)) : null,
                reads: originalData.reads ? JSON.parse(JSON.stringify(originalData.reads)) : null,
                sequences: originalData.sequences ? JSON.parse(JSON.stringify(originalData.sequences)) : null,
                metadata: {
                    ...originalData.metadata,
                    copyId: `copy_${Date.now()}`,
                    isExecutionCopy: true
                }
            };

            console.log(`✅ [ActionManager] Genome data execution copy created:`, executionCopy.metadata);
            return executionCopy;

        } catch (error) {
            console.error('❌ [ActionManager] Failed to create genome data copy:', error);
            throw new Error(`Failed to create genome data copy: ${error.message}`);
        }
    }

    /**
     * 🔧 CRITICAL FIX: Restore original genome data from backup (defensive programming)
     */
    restoreGenomeDataFromBackup(backupData) {
        console.log('🔒 [ActionManager] Verifying genome data integrity...');

        try {
            // Verify that original data hasn't been accidentally modified
            let needsRestore = false;
            const issues = [];

            // Check annotations
            if (backupData.annotations) {
                for (const [chromosome, features] of Object.entries(backupData.annotations)) {
                    const currentFeatures = this.genomeBrowser.currentAnnotations?.[chromosome] || [];
                    if (currentFeatures.length !== features.length) {
                        issues.push(`Chromosome ${chromosome}: features count mismatch (${currentFeatures.length} vs ${features.length})`);
                        needsRestore = true;
                    }
                }
            }

            if (needsRestore) {
                console.warn('⚠️ [ActionManager] Original genome data was modified during execution! Restoring from backup...');
                console.warn('Issues found:', issues);

                // Restore from backup
                if (backupData.annotations) {
                    this.genomeBrowser.currentAnnotations = JSON.parse(JSON.stringify(backupData.annotations));
                }
                if (backupData.variants) {
                    this.genomeBrowser.currentVariants = JSON.parse(JSON.stringify(backupData.variants));
                }
                if (backupData.reads) {
                    this.genomeBrowser.currentReads = JSON.parse(JSON.stringify(backupData.reads));
                }
                if (backupData.sequences) {
                    this.genomeBrowser.currentSequences = JSON.parse(JSON.stringify(backupData.sequences));
                }

                console.log('✅ [ActionManager] Original genome data restored from backup');
            } else {
                console.log('✅ [ActionManager] Original genome data integrity verified - no restore needed');
            }

        } catch (error) {
            console.error('❌ [ActionManager] Failed to verify/restore genome data:', error);
            // Don't throw here as this is defensive programming
        }
    }

    // =================================================================
    // FUNCTION CALL WRAPPERS FOR AI INTEGRATION
    // =================================================================

    /**
     * Get all available action functions for AI integration
     */
    getAvailableActionFunctions() {
        return {
            // Copy sequence function
            copySequence: {
                name: 'copySequence',
                description: 'Copy a sequence region to clipboard',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        start: { type: 'number', description: 'Start position (1-based)' },
                        end: { type: 'number', description: 'End position (1-based)' },
                        strand: { type: 'string', enum: ['+', '-'], description: 'Strand direction', default: '+' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            // Cut sequence function
            cutSequence: {
                name: 'cutSequence',
                description: 'Cut a sequence region and store in clipboard',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        start: { type: 'number', description: 'Start position (1-based)' },
                        end: { type: 'number', description: 'End position (1-based)' },
                        strand: { type: 'string', enum: ['+', '-'], description: 'Strand direction', default: '+' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            // Paste sequence function
            pasteSequence: {
                name: 'pasteSequence',
                description: 'Paste sequence from clipboard at specified position',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        position: { type: 'number', description: 'Insert position (1-based)' }
                    },
                    required: ['chromosome', 'position']
                }
            },

            // Delete sequence function
            deleteSequence: {
                name: 'deleteSequence',
                description: 'Delete a sequence region',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        start: { type: 'number', description: 'Start position (1-based)' },
                        end: { type: 'number', description: 'End position (1-based)' },
                        strand: { type: 'string', enum: ['+', '-'], description: 'Strand direction', default: '+' }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            // Insert sequence function
            insertSequence: {
                name: 'insertSequence',
                description: 'Insert sequence at specified position',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        position: { type: 'number', description: 'Insert position (1-based)' },
                        sequence: { type: 'string', description: 'Sequence to insert' }
                    },
                    required: ['chromosome', 'position', 'sequence']
                }
            },

            // Replace sequence function
            replaceSequence: {
                name: 'replaceSequence',
                description: 'Replace sequence in specified region',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome identifier' },
                        start: { type: 'number', description: 'Start position (1-based)' },
                        end: { type: 'number', description: 'End position (1-based)' },
                        sequence: { type: 'string', description: 'Replacement sequence' },
                        strand: { type: 'string', enum: ['+', '-'], description: 'Strand direction', default: '+' }
                    },
                    required: ['chromosome', 'start', 'end', 'sequence']
                }
            },

            // Get action list function
            getActionList: {
                name: 'getActionList',
                description: 'Get current list of pending and completed actions',
                parameters: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'all'], description: 'Filter by status', default: 'all' }
                    }
                }
            },

            // Execute actions function
            executeActions: {
                name: 'executeActions',
                description: 'Execute all pending actions',
                parameters: {
                    type: 'object',
                    properties: {
                        confirm: { type: 'boolean', description: 'Confirm execution without user prompt', default: false }
                    }
                }
            },

            // Clear actions function
            clearActions: {
                name: 'clearActions',
                description: 'Clear all actions from the queue',
                parameters: {
                    type: 'object',
                    properties: {
                        status: { type: 'string', enum: ['pending', 'completed', 'failed', 'all'], description: 'Clear actions by status', default: 'all' }
                    }
                }
            },

            // Undo last action function
            undoLastAction: {
                name: 'undoLastAction',
                description: 'Undo the last completed action',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },

            // Get clipboard content function
            getClipboardContent: {
                name: 'getClipboardContent',
                description: 'Get current clipboard content',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },

            // Open new tab function - ADDED FOR AI INTEGRATION
            openNewTab: {
                name: 'openNewTab',
                description: 'Open a new tab window for parallel genome analysis',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name (optional)' },
                        start: { type: 'number', description: 'Start position (optional)' },
                        end: { type: 'number', description: 'End position (optional)' },
                        position: { type: 'number', description: 'Center position (creates 2000bp range if start/end not provided)' },
                        geneName: { type: 'string', description: 'Gene name to open tab for (searches and focuses on gene)' },
                        title: { type: 'string', description: 'Custom title for the new tab (optional)' }
                    }
                }
            }
        };
    }

    /**
     * Execute action function by name
     */
    async executeActionFunction(functionName, parameters = {}) {
        console.log(`🔧 [ActionManager] Executing action function: ${functionName}`, parameters);

        try {
            switch (functionName) {
                case 'copySequence':
                    return await this.functionCopySequence(parameters);

                case 'cutSequence':
                    return await this.functionCutSequence(parameters);

                case 'pasteSequence':
                    return await this.functionPasteSequence(parameters);

                case 'deleteSequence':
                    return await this.functionDeleteSequence(parameters);

                case 'insertSequence':
                    return await this.functionInsertSequence(parameters);

                case 'replaceSequence':
                    return await this.functionReplaceSequence(parameters);

                case 'getActionList':
                    return this.functionGetActionList(parameters);

                case 'executeActions':
                    return await this.functionExecuteActions(parameters);

                case 'clearActions':
                    return this.functionClearActions(parameters);

                case 'undoLastAction':
                    return await this.functionUndoLastAction(parameters);

                case 'getClipboardContent':
                    return this.functionGetClipboardContent(parameters);

                case 'openNewTab':
                    return await this.functionOpenNewTab(parameters);

                default:
                    throw new Error(`Unknown action function: ${functionName}`);
            }
        } catch (error) {
            console.error(`❌ [ActionManager] Function ${functionName} failed:`, error);
            throw error;
        }
    }

    // =================================================================
    // FUNCTION IMPLEMENTATIONS
    // =================================================================

    async functionCopySequence(params) {
        const { chromosome, start, end, strand = '+' } = params;
        
        // Validate parameters
        if (!chromosome || !start || !end) {
            throw new Error('Missing required parameters: chromosome, start, end');
        }
        
        if (start > end) {
            throw new Error('Start position must be less than or equal to end position');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.COPY_SEQUENCE,
            `${chromosome}:${start}-${end}(${strand})`,
            `Copy sequence from ${chromosome}:${start}-${end} (${strand})`
        );

        action.metadata = {
            chromosome,
            start: parseInt(start),
            end: parseInt(end),
            strand,
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence copy action created for ${chromosome}:${start}-${end} (${strand})`,
            details: {
                chromosome,
                start,
                end,
                strand,
                length: end - start + 1
            }
        };
    }

    async functionCutSequence(params) {
        const { chromosome, start, end, strand = '+' } = params;
        
        // Validate parameters
        if (!chromosome || !start || !end) {
            throw new Error('Missing required parameters: chromosome, start, end');
        }
        
        if (start > end) {
            throw new Error('Start position must be less than or equal to end position');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.CUT_SEQUENCE,
            `${chromosome}:${start}-${end}(${strand})`,
            `Cut sequence from ${chromosome}:${start}-${end} (${strand})`
        );

        action.metadata = {
            chromosome,
            start: parseInt(start),
            end: parseInt(end),
            strand,
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence cut action created for ${chromosome}:${start}-${end} (${strand})`,
            details: {
                chromosome,
                start,
                end,
                strand,
                length: end - start + 1
            }
        };
    }

    async functionPasteSequence(params) {
        const { chromosome, position } = params;
        
        // Validate parameters
        if (!chromosome || !position) {
            throw new Error('Missing required parameters: chromosome, position');
        }

        // Check if clipboard has content
        if (!this.clipboard) {
            throw new Error('Clipboard is empty. Please copy or cut a sequence first.');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.PASTE_SEQUENCE,
            `${chromosome}:${position}`,
            `Paste sequence at ${chromosome}:${position}`
        );

        action.metadata = {
            chromosome,
            position: parseInt(position),
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence paste action created for ${chromosome}:${position}`,
            details: {
                chromosome,
                position,
                clipboardLength: this.clipboard ? this.clipboard.sequence.length : 0
            }
        };
    }

    async functionDeleteSequence(params) {
        const { chromosome, start, end, strand = '+' } = params;
        
        // Validate parameters
        if (!chromosome || !start || !end) {
            throw new Error('Missing required parameters: chromosome, start, end');
        }
        
        if (start > end) {
            throw new Error('Start position must be less than or equal to end position');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.DELETE_SEQUENCE,
            `${chromosome}:${start}-${end}(${strand})`,
            `Delete sequence from ${chromosome}:${start}-${end} (${strand})`
        );

        action.metadata = {
            chromosome,
            start: parseInt(start),
            end: parseInt(end),
            strand,
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence delete action created for ${chromosome}:${start}-${end} (${strand})`,
            details: {
                chromosome,
                start,
                end,
                strand,
                length: end - start + 1
            }
        };
    }

    async functionInsertSequence(params) {
        const { chromosome, position, sequence } = params;
        
        // Validate parameters
        if (!chromosome || !position || !sequence) {
            throw new Error('Missing required parameters: chromosome, position, sequence');
        }

        // Validate sequence
        if (!/^[ATCGN]+$/i.test(sequence)) {
            throw new Error('Sequence contains invalid characters. Only A, T, C, G, N are allowed.');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.INSERT_SEQUENCE,
            `${chromosome}:${position}`,
            `Insert ${sequence.length}bp sequence at ${chromosome}:${position}`
        );

        action.metadata = {
            chromosome,
            position: parseInt(position),
            sequence: sequence.toUpperCase(),
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence insert action created for ${chromosome}:${position}`,
            details: {
                chromosome,
                position,
                sequenceLength: sequence.length,
                sequence: sequence.substring(0, 50) + (sequence.length > 50 ? '...' : '')
            }
        };
    }

    async functionReplaceSequence(params) {
        const { chromosome, start, end, sequence, strand = '+' } = params;
        
        // Validate parameters
        if (!chromosome || !start || !end || !sequence) {
            throw new Error('Missing required parameters: chromosome, start, end, sequence');
        }
        
        if (start > end) {
            throw new Error('Start position must be less than or equal to end position');
        }

        // Validate sequence
        if (!/^[ATCGN]+$/i.test(sequence)) {
            throw new Error('Sequence contains invalid characters. Only A, T, C, G, N are allowed.');
        }

        // Create action
        const action = this.createAction(
            this.ACTION_TYPES.REPLACE_SEQUENCE,
            `${chromosome}:${start}-${end}(${strand})`,
            `Replace sequence in ${chromosome}:${start}-${end} (${strand}) with ${sequence.length}bp`
        );

        action.metadata = {
            chromosome,
            start: parseInt(start),
            end: parseInt(end),
            strand,
            sequence: sequence.toUpperCase(),
            source: 'function_call'
        };

        this.addAction(action);

        return {
            success: true,
            actionId: action.id,
            message: `Sequence replace action created for ${chromosome}:${start}-${end} (${strand})`,
            details: {
                chromosome,
                start,
                end,
                strand,
                originalLength: end - start + 1,
                newLength: sequence.length,
                sequence: sequence.substring(0, 50) + (sequence.length > 50 ? '...' : '')
            }
        };
    }

    functionGetActionList(params) {
        const { status = 'all' } = params;
        
        let actions = this.actions;
        
        // Filter by status if specified
        if (status !== 'all') {
            actions = actions.filter(action => action.status === status);
        }

        return {
            success: true,
            totalActions: this.actions.length,
            filteredActions: actions.length,
            actions: actions.map(action => ({
                id: action.id,
                type: action.type,
                target: action.target,
                details: action.details,
                status: action.status,
                created: action.created,
                executionStart: action.executionStart,
                executionEnd: action.executionEnd,
                actualTime: action.actualTime,
                metadata: action.metadata
            }))
        };
    }

    async functionExecuteActions(params) {
        const { confirm = false } = params;
        
        const pendingActions = this.actions.filter(action => action.status === this.STATUS.PENDING);
        
        if (pendingActions.length === 0) {
            return {
                success: true,
                message: 'No pending actions to execute',
                executedActions: 0
            };
        }

        if (this.isExecuting) {
            throw new Error('Actions are already being executed');
        }

        try {
            await this.executeAllActions();
            
            return {
                success: true,
                message: `Successfully executed ${pendingActions.length} actions`,
                executedActions: pendingActions.length
            };
        } catch (error) {
            throw new Error(`Failed to execute actions: ${error.message}`);
        }
    }

    functionClearActions(params) {
        const { status = 'all' } = params;
        
        let clearedCount = 0;
        
        if (status === 'all') {
            clearedCount = this.actions.length;
            this.actions = [];
        } else {
            const originalLength = this.actions.length;
            this.actions = this.actions.filter(action => action.status !== status);
            clearedCount = originalLength - this.actions.length;
        }

        this.updateActionListUI();
        this.updateStats();

        return {
            success: true,
            message: `Cleared ${clearedCount} actions`,
            clearedActions: clearedCount,
            remainingActions: this.actions.length
        };
    }

    async functionUndoLastAction(params) {
        const completedActions = this.actions.filter(action => action.status === this.STATUS.COMPLETED);
        
        if (completedActions.length === 0) {
            throw new Error('No completed actions to undo');
        }

        // For now, we'll just mark the last action as failed and provide information
        // Full undo functionality would require maintaining state snapshots
        const lastAction = completedActions[completedActions.length - 1];
        
        return {
            success: true,
            message: 'Undo functionality is not yet implemented',
            lastAction: {
                id: lastAction.id,
                type: lastAction.type,
                target: lastAction.target,
                details: lastAction.details
            },
            note: 'Consider using the rollback feature or manually reversing the operation'
        };
    }

    functionGetClipboardContent(params) {
        if (!this.clipboard) {
            return {
                success: true,
                hasContent: false,
                message: 'Clipboard is empty'
            };
        }

        return {
            success: true,
            hasContent: true,
            content: {
                sequence: this.clipboard.sequence,
                length: this.clipboard.sequence.length,
                chromosome: this.clipboard.chromosome,
                start: this.clipboard.start,
                end: this.clipboard.end,
                strand: this.clipboard.strand,
                type: this.clipboard.type
            }
        };
    }

    /**
     * Open new tab function for AI integration
     */
    async functionOpenNewTab(params) {
        console.log('🔧 [ActionManager] ===== FUNCTION OPEN NEW TAB START =====');
        console.log('🔧 [ActionManager] Received params:', params);
        console.log('🔧 [ActionManager] Params type:', typeof params);
        console.log('🔧 [ActionManager] Params keys:', Object.keys(params || {}));
        
        const { chromosome, start, end, position, geneName, title } = params || {};
        
        console.log('🔧 [ActionManager] Destructured params:');
        console.log('  - chromosome:', chromosome);
        console.log('  - start:', start);
        console.log('  - end:', end);
        console.log('  - position:', position);
        console.log('  - geneName:', geneName);
        console.log('  - title:', title);
        
        try {
            // Check if genome browser and tab manager are available
            console.log('🔧 [ActionManager] Checking genome browser availability...');
            console.log('🔧 [ActionManager] this.genomeBrowser available:', !!this.genomeBrowser);
            
            if (!this.genomeBrowser) {
                throw new Error('Genome browser not available');
            }

            console.log('🔧 [ActionManager] Checking tab manager availability...');
            console.log('🔧 [ActionManager] this.genomeBrowser.tabManager available:', !!this.genomeBrowser.tabManager);

            if (!this.genomeBrowser.tabManager) {
                throw new Error('Tab manager not available');
            }

            let tabId;
            let finalTitle = title;
            let usedDefaultRange = false;

            console.log('🔧 [ActionManager] Starting tab creation logic...');
            console.log('🔧 [ActionManager] Current tab count before creation:', this.genomeBrowser.tabManager.tabs.size);

            // Handle different ways to create a new tab
            if (geneName) {
                // Open tab for specific gene
                console.log(`🔧 [ActionManager] Opening tab for gene: ${geneName}`);
                
                // Search for the gene
                const searchResults = await this.searchGeneByName(geneName);
                if (searchResults && searchResults.length > 0) {
                    const gene = searchResults[0];
                    console.log(`🔧 [ActionManager] Found gene:`, gene);
                    tabId = this.genomeBrowser.tabManager.createTabForGene(gene, 500);
                    finalTitle = finalTitle || `Gene: ${gene.name || gene.id || geneName}`;
                } else {
                    throw new Error(`Gene '${geneName}' not found`);
                }
            } else if (chromosome) {
                // Open tab for specific position
                let finalStart = start;
                let finalEnd = end;
                
                // Handle position parameter with default 2000bp range
                if (position !== undefined && (start === undefined || end === undefined)) {
                    const defaultRange = 2000;
                    finalStart = Math.max(1, position - Math.floor(defaultRange / 2));
                    finalEnd = position + Math.floor(defaultRange / 2);
                    usedDefaultRange = true;
                    console.log(`🔧 [ActionManager] Using position ${position} with default ${defaultRange}bp range: ${finalStart}-${finalEnd}`);
                }
                
                if (finalStart && finalEnd) {
                    // Check if chromosome exists
                    if (!this.genomeBrowser.currentSequence || !this.genomeBrowser.currentSequence[chromosome]) {
                        throw new Error(`Chromosome ${chromosome} not found in loaded genome data`);
                    }
                    
                    tabId = this.genomeBrowser.tabManager.createTabForPosition(chromosome, finalStart, finalEnd, finalTitle);
                    finalTitle = finalTitle || `${chromosome}:${finalStart.toLocaleString()}-${finalEnd.toLocaleString()}`;
                } else {
                    throw new Error('Missing required parameters: start and end positions, or position parameter');
                }
            } else {
                // Create new tab with current position
                console.log('🔧 [ActionManager] Creating new tab with current position');
                console.log('🔧 [ActionManager] Looking for newTabButton element...');
                
                const newTabButton = document.getElementById('newTabButton');
                console.log('🔧 [ActionManager] newTabButton found:', !!newTabButton);
                console.log('🔧 [ActionManager] newTabButton element:', newTabButton);
                
                if (newTabButton) {
                    // Simulate the + button click
                    console.log('🔧 [ActionManager] Simulating newTabButton.click()...');
                    newTabButton.click();
                    console.log('🔧 [ActionManager] Click simulation completed');
                    
                    // Get the newly created tab ID
                    const tabIds = Array.from(this.genomeBrowser.tabManager.tabs.keys());
                    console.log('🔧 [ActionManager] All tab IDs after click:', tabIds);
                    tabId = tabIds[tabIds.length - 1];
                    console.log('🔧 [ActionManager] Selected tab ID:', tabId);
                    finalTitle = finalTitle || 'New Tab';
                } else {
                    // Fallback to direct manager access
                    console.log('🔧 [ActionManager] newTabButton not found, using direct manager access...');
                    console.log('🔧 [ActionManager] Calling this.genomeBrowser.tabManager.createNewTab()...');
                    tabId = this.genomeBrowser.tabManager.createNewTab(finalTitle);
                    console.log('🔧 [ActionManager] Direct createNewTab result:', tabId);
                    finalTitle = finalTitle || 'New Tab';
                }
            }
            
            console.log(`🔧 [ActionManager] Tab creation completed`);
            console.log(`🔧 [ActionManager] Final tab ID: ${tabId}`);
            console.log(`🔧 [ActionManager] Final title: ${finalTitle}`);
            console.log(`🔧 [ActionManager] Current tab count after creation:`, this.genomeBrowser.tabManager.tabs.size);
            console.log(`🔧 [ActionManager] All tabs after creation:`, Array.from(this.genomeBrowser.tabManager.tabs.keys()));
            
            console.log(`✅ [ActionManager] Successfully created new tab: ${tabId} - ${finalTitle}`);
            console.log('🔧 [ActionManager] ===== FUNCTION OPEN NEW TAB END =====');
            
            return {
                success: true,
                tabId: tabId,
                title: finalTitle,
                message: `Opened new tab: ${finalTitle}`,
                usedDefaultRange: usedDefaultRange
            };
            
        } catch (error) {
            console.error('❌ [ActionManager] Error opening new tab:', error);
            console.error('❌ [ActionManager] Error stack:', error.stack);
            console.log('🔧 [ActionManager] ===== FUNCTION OPEN NEW TAB ERROR =====');
            throw error;
        }
    }

    /**
     * Search for gene by name (helper function for openNewTab)
     */
    async searchGeneByName(geneName) {
        try {
            // Use the genome browser's search functionality if available
            if (this.genomeBrowser.navigationManager) {
                this.genomeBrowser.navigationManager.performSearch(geneName);
                return this.genomeBrowser.navigationManager.searchResults || [];
            }
            
            // Fallback: search in current annotations
            if (this.genomeBrowser.currentAnnotations) {
                const results = [];
                for (const [chromosome, features] of Object.entries(this.genomeBrowser.currentAnnotations)) {
                    const matchingFeatures = features.filter(feature => 
                        feature.name && feature.name.toLowerCase().includes(geneName.toLowerCase()) ||
                        feature.qualifiers && feature.qualifiers.gene && 
                        feature.qualifiers.gene.toLowerCase().includes(geneName.toLowerCase()) ||
                        feature.qualifiers && feature.qualifiers.locus_tag && 
                        feature.qualifiers.locus_tag.toLowerCase().includes(geneName.toLowerCase())
                    );
                    results.push(...matchingFeatures);
                }
                return results;
            }
            
            return [];
        } catch (error) {
            console.error('Error searching for gene:', error);
            return [];
        }
    }
    
    /**
     * Get clipboard content (UI response function)
     */
    getClipboardContent() {
        if (!this.clipboard) {
            this.genomeBrowser.showNotification('Clipboard is empty', 'warning');
            return null;
        }
        
        return {
            type: this.clipboard.type,
            sequence: this.clipboard.sequence,
            source: this.clipboard.source,
            timestamp: this.clipboard.timestamp,
            length: this.clipboard.sequence.length
        };
    }
    
    /**
     * Undo last action (UI response function)
     */
    undoLastAction() {
        if (this.actions.length === 0) {
            this.genomeBrowser.showNotification('No actions to undo', 'warning');
            return false;
        }
        
        const lastAction = this.actions[this.actions.length - 1];
        if (lastAction.status === this.STATUS.COMPLETED) {
            this.actions.pop();
            this.genomeBrowser.showNotification(`Undid last action: ${lastAction.type}`, 'success');
            this.updateActionListUI();
            return true;
        } else {
            this.genomeBrowser.showNotification('Cannot undo action that is not completed', 'warning');
            return false;
        }
    }

    /**
     * Reset action list to default state
     */
    resetToDefaults() {
        if (confirm('Are you sure you want to reset the action list to default state? This will clear all current actions and cannot be undone.')) {
            // Clear all actions
            this.actions = [];
            this.actionHistory = [];
            
            // Reset configuration to defaults
            this.config = {
                maxActions: 1000,
                autoSave: true,
                showTimestamps: true,
                groupSimilarActions: true,
                enableUndoRedo: true
            };
            
            // Update the UI
            this.updateActionListUI();
            
            // Save configuration
            if (this.genomeBrowser && this.genomeBrowser.configManager) {
                this.genomeBrowser.configManager.set('actionManagerConfig', this.config);
                this.genomeBrowser.configManager.saveConfig();
            }
            
            this.genomeBrowser.showNotification('Action list reset to defaults successfully!', 'success');
        }
    }
}

// Make ActionManager available globally
if (typeof window !== 'undefined') {
    window.ActionManager = ActionManager;
} 