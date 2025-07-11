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
        
        // Try to setup listeners immediately, and also retry after a delay
        setupListeners();
        setTimeout(setupListeners, 1000);
        
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
    handleCopySequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
            this.createActionFromSelection('copy', selectionInfo);
        } else {
            this.showSequenceSelectionModal('copy');
        }
    }
    
    /**
     * Handle cut sequence action
     */
    handleCutSequence() {
        // Try to create action directly from current selections
        const selectionInfo = this.getActiveSelection();
        if (selectionInfo && selectionInfo.hasSelection) {
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
        
        // If we have a cursor position, use it for paste
        if (this.cursorPosition > 0) {
            const chromosome = this.genomeBrowser.currentChromosome;
            if (chromosome) {
                // Paste at cursor position
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
                    `Paste ${this.clipboard.sequence?.length || 0} bp at cursor position ${this.cursorPosition}`,
                    metadata
                );
                
                this.genomeBrowser.showNotification(`Paste action queued at cursor position ${this.cursorPosition}`, 'success');
                return;
            }
        }
        
        // Fallback to modal selection if no cursor position
        this.showSequenceSelectionModal('paste');
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
                    this.addAction(
                        this.ACTION_TYPES.COPY_SEQUENCE,
                        target,
                        `Copy ${end - start + 1} bp from ${target}`,
                        metadata
                    );
                    break;
                    
                case 'cut':
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
        
        this.isExecuting = true;
        this.showExecutionProgress(0, pendingActions.length);
        
        try {
            for (let i = 0; i < pendingActions.length; i++) {
                const action = pendingActions[i];
                await this.executeAction(action);
                this.showExecutionProgress(i + 1, pendingActions.length);
                this.updateActionListUI();
                
                // Small delay between actions
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.genomeBrowser.showNotification('All actions executed successfully', 'success');
            
        } catch (error) {
            console.error('Error executing actions:', error);
            this.genomeBrowser.showNotification('Error executing actions', 'error');
        } finally {
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
        
        this.clipboard = {
            type: 'copy',
            sequence: sequence,
            source: action.target,
            timestamp: new Date(),
            comprehensiveData: comprehensiveData
        };
        
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
        
        this.clipboard = {
            type: 'cut',
            sequence: sequence,
            source: action.target,
            timestamp: new Date()
        };
        
        // Mark the region as cut (would need actual genome editing implementation)
        // For now, we'll just store the clipboard data
        
        return {
            operation: 'cut',
            sequenceLength: sequence.length,
            source: action.target
        };
    }
    
    /**
     * Execute paste sequence action
     */
    async executePasteSequence(action) {
        const { chromosome, start, end } = action.metadata;
        const clipboardData = action.metadata.clipboardData;
        
        if (!clipboardData) {
            throw new Error('No clipboard data available for pasting');
        }
        
        // For demonstration, we'll simulate the paste operation
        // In a real implementation, this would modify the genome sequence
        
        return {
            operation: 'paste',
            sequenceLength: clipboardData.sequence.length,
            target: action.target,
            source: clipboardData.source
        };
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
        
        // In a real implementation, this would remove the sequence from the genome
        // For now, we'll simulate the deletion
        
        return {
            operation: 'delete',
            sequenceLength: end - start + 1,
            target: action.target,
            chromosome: chromosome,
            deletedRegion: { start, end }
        };
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