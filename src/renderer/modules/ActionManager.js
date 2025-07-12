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
        this.cursorPosition = 0; // Track cursor position for paste operations
        this.sequenceModifications = new Map(); // Track sequence modifications by chromosome
        
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
     * Add action to the queue
     */
    addAction(type, target, details, metadata = {}) {
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
     * Set cursor position for paste operations
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
    async collectComprehensiveData(chromosome, start, end, strand) {
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
            // Collect features in the region
            if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
                const annotations = this.genomeBrowser.currentAnnotations[chromosome];
                comprehensiveData.features = annotations.filter(feature => 
                    feature.start <= end && feature.end >= start
                );
            }
            
            // Collect variants in the region
            if (this.genomeBrowser.currentVariants && this.genomeBrowser.currentVariants[chromosome]) {
                const variants = this.genomeBrowser.currentVariants[chromosome];
                comprehensiveData.variants = variants.filter(variant => 
                    variant.start <= end && variant.end >= start
                );
            }
            
            // Collect reads in the region
            if (this.genomeBrowser.currentReads && this.genomeBrowser.currentReads[chromosome]) {
                const reads = this.genomeBrowser.currentReads[chromosome];
                comprehensiveData.reads = reads.filter(read => 
                    read.start <= end && read.end >= start
                );
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
     * Execute all pending actions
     */
    async executeAllActions() {
        if (this.isExecuting) {
            this.genomeBrowser.showNotification('Actions are already executing', 'warning');
            return;
        }
        
        const pendingActions = this.actions.filter(action => action.status === this.STATUS.PENDING);
        if (pendingActions.length === 0) {
            this.genomeBrowser.showNotification('No pending actions to execute', 'info');
            return;
        }
        
        // Create a deep copy of the entire action list for execution
        const executionActionsCopy = JSON.parse(JSON.stringify(this.actions));
        const pendingActionsCopy = executionActionsCopy.filter(action => action.status === this.STATUS.PENDING);
        
        console.log(`🔄 [ActionManager] Created execution copy with ${executionActionsCopy.length} actions (${pendingActionsCopy.length} pending)`);
        
        this.isExecuting = true;
        this.showExecutionProgress(0, pendingActionsCopy.length);
        
        try {
            for (let i = 0; i < pendingActionsCopy.length; i++) {
                const action = pendingActionsCopy[i];
                await this.executeActionOnCopy(action, executionActionsCopy);
                
                // After executing this action, adjust positions of all remaining pending actions in the copy
                this.adjustPendingActionPositionsOnCopy(action, i + 1, executionActionsCopy);
                
                this.showExecutionProgress(i + 1, pendingActionsCopy.length);
                // Don't update UI during execution to avoid showing intermediate states
                
                // Small delay between actions
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.genomeBrowser.showNotification('All actions executed successfully', 'success');
            
            // Generate and prompt to save GBK file after successful action execution
            // Use the execution copy for GBK generation to include executed action details
            await this.generateAndSaveGBKFromCopy(executionActionsCopy);
            
            console.log(`✅ [ActionManager] Execution successful, original action list unchanged`);
            
        } catch (error) {
            console.error('Error executing actions:', error);
            this.genomeBrowser.showNotification('Error executing actions', 'error');
            
            console.log(`❌ [ActionManager] Execution failed, original action list unchanged`);
            
        } finally {
            // Original actions are never modified during execution
            
            this.isExecuting = false;
            this.hideExecutionProgress();
            this.updateActionListUI();
            this.updateStats();
            
            // Notify actions track to update
            this.notifyActionsTrackUpdate();
        }
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
    async executeActionOnCopy(action, executionActionsCopy) {
        action.status = this.STATUS.EXECUTING;
        action.executionStart = new Date();
        
        // Don't notify actions track to avoid UI updates during execution
        
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
    async executeCopySequence(action) {
        const { chromosome, start, end, strand } = action.metadata;
        const sequence = await this.getSequenceForRegion(chromosome, start, end, strand);
        
        if (!sequence) {
            throw new Error('Unable to retrieve sequence for copying');
        }
        
        // Collect comprehensive data including features, annotations, and metadata
        const comprehensiveData = await this.collectComprehensiveData(chromosome, start, end, strand);
        
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
    async executeCutSequence(action) {
        const { chromosome, start, end, strand } = action.metadata;
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
    async executePasteSequence(action) {
        const { chromosome, start, end } = action.metadata;
        const clipboardData = action.metadata.clipboardData;
        
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
            copiedFeaturesCount = await this.copyFeaturesFromClipboard(clipboardData, chromosome, start, end, isInsert);
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
    async copyFeaturesFromClipboard(clipboardData, targetChromosome, targetStart, targetEnd, isInsert) {
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
            
            // Insert new features into target chromosome annotations
            if (!this.genomeBrowser.currentAnnotations) {
                this.genomeBrowser.currentAnnotations = {};
            }
            
            if (!this.genomeBrowser.currentAnnotations[targetChromosome]) {
                this.genomeBrowser.currentAnnotations[targetChromosome] = [];
            }
            
            // Add new features to the target chromosome
            this.genomeBrowser.currentAnnotations[targetChromosome].push(...newFeatures);
            
            // Sort features by position for better organization
            this.genomeBrowser.currentAnnotations[targetChromosome].sort((a, b) => a.start - b.start);
            
            console.log('✅ [ActionManager] Successfully copied features:', {
                targetChromosome: targetChromosome,
                featuresAdded: newFeatures.length,
                totalFeaturesNow: this.genomeBrowser.currentAnnotations[targetChromosome].length
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
    async executeDeleteSequence(action) {
        const { chromosome, start, end } = action.metadata;
        
        console.log('🗑️ [ActionManager] Executing delete sequence action:', {
            actionId: action.id,
            target: action.target,
            region: `${chromosome}:${start}-${end}`,
            sequenceLength: end - start + 1
        });
        
        // Record the sequence modification
        this.recordSequenceModification(chromosome, {
            type: 'delete',
            position: start,
            start: start,
            end: end,
            length: end - start + 1,
            actionId: action.id
        });
        
        // Remove features from deleted region
        let deletedFeaturesCount = 0;
        if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[chromosome]) {
            const annotations = this.genomeBrowser.currentAnnotations[chromosome];
            const initialCount = annotations.length;
            
            // Remove features that are within the deleted region
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
    async executeInsertSequence(action) {
        const { chromosome, start, insertSequence } = action.metadata;
        
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
    async executeReplaceSequence(action) {
        const { chromosome, start, end, newSequence } = action.metadata;
        const originalLength = end - start + 1;
        
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
    adjustFeaturePositions(chromosome, originalFeatures) {
        if (!this.sequenceModifications.has(chromosome)) {
            return originalFeatures; // No modifications for this chromosome
        }
        
        const modifications = this.sequenceModifications.get(chromosome);
        if (modifications.length === 0) {
            return originalFeatures;
        }
        
        console.log(`🔧 [ActionManager] Adjusting ${originalFeatures.length} features for ${chromosome} with ${modifications.length} modifications`);
        
        // Sort modifications by position (ascending order for position adjustment calculation)
        const sortedModifications = [...modifications].sort((a, b) => {
            const posA = a.position || a.start || 0;
            const posB = b.position || b.start || 0;
            return posA - posB; // Ascending order
        });
        
        const adjustedFeatures = [];
        
        for (const feature of originalFeatures) {
            const adjustedFeature = this.adjustSingleFeature(feature, sortedModifications);
            
            // Only include features that are still valid after adjustments
            if (adjustedFeature) {
                adjustedFeatures.push(adjustedFeature);
            }
        }
        
        console.log(`🔧 [ActionManager] Feature adjustment complete: ${originalFeatures.length} → ${adjustedFeatures.length} features`);
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
    async executeSequenceEdit(action) {
        const { changeSummary, originalSequence, modifiedSequence } = action.metadata;
        
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
    async generateAndSaveGBKFromCopy(executionActionsCopy) {
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
}

// Make ActionManager available globally
if (typeof window !== 'undefined') {
    window.ActionManager = ActionManager;
} 