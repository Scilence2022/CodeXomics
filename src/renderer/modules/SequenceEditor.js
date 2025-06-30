/**
 * SequenceEditor - Advanced sequence editing capabilities
 * Integrates with VSCodeSequenceEditor to provide real text editing functionality
 * Tracks changes and submits editing actions to ActionManager
 */
class SequenceEditor {
    constructor(vscodeEditor, genomeBrowser) {
        this.vscodeEditor = vscodeEditor;
        this.genomeBrowser = genomeBrowser;
        
        // Editing state
        this.isEditMode = false;
        this.originalSequence = '';
        this.currentSequence = '';
        this.modifications = new Map(); // position -> {original, modified, type}
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 100;
        
        // Change tracking
        this.hasUnsavedChanges = false;
        this.autoSaveInterval = null;
        this.autoSaveDelay = 5000; // 5 seconds
        
        // Validation settings
        this.validBases = new Set(['A', 'T', 'G', 'C', 'N']);
        this.allowLowercase = true;
        this.allowAmbiguous = true;
        this.ambiguousBases = new Set(['R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V']);
        
        // UI elements
        this.editingToolbar = null;
        this.statusBar = null;
        
        this.initializeEditingSystem();
    }
    
    /**
     * Initialize the editing system
     */
    initializeEditingSystem() {
        console.log('🔧 [SequenceEditor] Initializing sequence editing system...');
        
        // Add editing capabilities to VSCode editor
        this.enhanceVSCodeEditor();
        
        // Create editing toolbar
        this.createEditingToolbar();
        
        // Create status bar
        this.createStatusBar();
        
        // Setup keyboard shortcuts
        this.setupEditingShortcuts();
        
        console.log('✅ [SequenceEditor] Sequence editing system initialized');
    }
    
    /**
     * Enhance VSCode editor with editing capabilities
     */
    enhanceVSCodeEditor() {
        if (!this.vscodeEditor || !this.vscodeEditor.sequenceContent) {
            console.warn('⚠️ [SequenceEditor] VSCode editor not ready for enhancement');
            return;
        }
        
        // Make sequence content editable when in edit mode
        const sequenceContent = this.vscodeEditor.sequenceContent;
        
        // Override the render method to support editing
        const originalRender = this.vscodeEditor.render.bind(this.vscodeEditor);
        this.vscodeEditor.render = () => {
            originalRender();
            if (this.isEditMode) {
                this.applyEditingEnhancements();
            }
        };
        
        // Override keyboard handling
        const originalKeyHandler = this.vscodeEditor.handleKeyDown.bind(this.vscodeEditor);
        this.vscodeEditor.handleKeyDown = (e) => {
            if (this.isEditMode) {
                if (this.handleEditingKeydown(e)) {
                    return; // Event handled by editing system
                }
            }
            originalKeyHandler(e);
        };
        
        console.log('✅ [SequenceEditor] VSCode editor enhanced with editing capabilities');
    }
    
    /**
     * Apply editing enhancements to rendered sequence
     */
    applyEditingEnhancements() {
        const sequenceLines = this.vscodeEditor.sequenceContent.querySelectorAll('.sequence-line');
        
        sequenceLines.forEach((line, lineIndex) => {
            const bases = line.querySelectorAll('.sequence-base');
            bases.forEach((base, baseIndex) => {
                const absolutePosition = lineIndex * this.vscodeEditor.basesPerLine + baseIndex;
                
                // Make base editable
                if (!base.hasAttribute('contenteditable')) {
                    base.setAttribute('contenteditable', 'true');
                    base.setAttribute('spellcheck', 'false');
                    
                    // Add event listeners
                    base.addEventListener('input', (e) => this.handleBaseEdit(e, absolutePosition));
                    base.addEventListener('keydown', (e) => this.handleBaseKeydown(e, absolutePosition));
                    base.addEventListener('paste', (e) => this.handleBasePaste(e, absolutePosition));
                    base.addEventListener('focus', (e) => this.handleBaseFocus(e, absolutePosition));
                    base.addEventListener('blur', (e) => this.handleBaseBlur(e, absolutePosition));
                }
                
                // Highlight modifications
                if (this.modifications.has(absolutePosition)) {
                    base.classList.add('sequence-modified');
                    const mod = this.modifications.get(absolutePosition);
                    base.title = `Original: ${mod.original} → Modified: ${mod.modified}`;
                }
            });
        });
    }
    
    /**
     * Handle individual base editing
     */
    handleBaseEdit(event, position) {
        const element = event.target;
        const newValue = element.textContent.toUpperCase();
        
        // Validate input
        if (!this.isValidBase(newValue)) {
            // Revert to previous value
            const currentBase = this.getCurrentBase(position);
            element.textContent = currentBase;
            this.showValidationError(`Invalid base: ${newValue}. Valid bases: ${Array.from(this.getValidBases()).join(', ')}`);
            return;
        }
        
        // Record the change
        this.recordBaseChange(position, newValue);
        
        // Update cursor position
        this.placeCursorAtEnd(element);
        
        // Trigger auto-save
        this.scheduleAutoSave();
    }
    
    /**
     * Handle keydown events for individual bases
     */
    handleBaseKeydown(event, position) {
        const key = event.key;
        
        switch (key) {
            case 'Enter':
                event.preventDefault();
                this.moveToNextEditableBase(position);
                break;
                
            case 'Tab':
                event.preventDefault();
                if (event.shiftKey) {
                    this.moveToPreviousEditableBase(position);
                } else {
                    this.moveToNextEditableBase(position);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this.revertBaseChange(position);
                event.target.blur();
                break;
                
            case 'Delete':
            case 'Backspace':
                event.preventDefault();
                this.deleteBase(position);
                break;
                
            default:
                // Allow only valid base characters
                if (key.length === 1 && !this.isValidBase(key.toUpperCase())) {
                    event.preventDefault();
                    this.showValidationError(`Invalid base: ${key}. Valid bases: ${Array.from(this.getValidBases()).join(', ')}`);
                }
                break;
        }
    }
    
    /**
     * Handle paste events for bases
     */
    handleBasePaste(event, position) {
        event.preventDefault();
        
        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        const cleanedSequence = this.cleanSequence(pastedText);
        
        if (!cleanedSequence) {
            this.showValidationError('Pasted text contains no valid DNA bases');
            return;
        }
        
        // Insert the cleaned sequence starting at the current position
        this.insertSequence(position, cleanedSequence);
    }
    
    /**
     * Record a base change for undo/redo functionality
     */
    recordBaseChange(position, newValue) {
        const originalBase = this.getOriginalBase(position);
        const previousValue = this.getCurrentBase(position);
        
        // Create undo entry
        const undoEntry = {
            type: 'base_edit',
            position: position,
            oldValue: previousValue,
            newValue: newValue,
            timestamp: Date.now()
        };
        
        this.undoStack.push(undoEntry);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo stack
        
        // Update current sequence
        const sequenceArray = Array.from(this.currentSequence);
        sequenceArray[position] = newValue;
        this.currentSequence = sequenceArray.join('');
        
        // Track modification
        if (newValue !== originalBase) {
            this.modifications.set(position, {
                original: originalBase,
                modified: newValue,
                type: 'substitution',
                timestamp: Date.now()
            });
        } else {
            this.modifications.delete(position);
        }
        
        this.hasUnsavedChanges = true;
        this.updateStatusBar();
        
        console.log(`🔧 [SequenceEditor] Base change recorded: position ${position}, ${previousValue} → ${newValue}`);
    }
    
    /**
     * Insert sequence at position
     */
    insertSequence(position, sequence) {
        const cleanedSequence = this.cleanSequence(sequence);
        if (!cleanedSequence) return;
        
        // Create undo entry
        const undoEntry = {
            type: 'insertion',
            position: position,
            sequence: cleanedSequence,
            timestamp: Date.now()
        };
        
        this.undoStack.push(undoEntry);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        
        // Update current sequence
        const before = this.currentSequence.substring(0, position);
        const after = this.currentSequence.substring(position);
        this.currentSequence = before + cleanedSequence + after;
        
        // Track modifications
        for (let i = 0; i < cleanedSequence.length; i++) {
            this.modifications.set(position + i, {
                original: '',
                modified: cleanedSequence[i],
                type: 'insertion',
                timestamp: Date.now()
            });
        }
        
        this.hasUnsavedChanges = true;
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        console.log(`🔧 [SequenceEditor] Sequence inserted: ${cleanedSequence.length} bases at position ${position}`);
    }
    
    /**
     * Delete base at position
     */
    deleteBase(position) {
        if (position >= this.currentSequence.length) return;
        
        const deletedBase = this.currentSequence[position];
        
        // Create undo entry
        const undoEntry = {
            type: 'deletion',
            position: position,
            deletedBase: deletedBase,
            timestamp: Date.now()
        };
        
        this.undoStack.push(undoEntry);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
        
        // Update current sequence
        const before = this.currentSequence.substring(0, position);
        const after = this.currentSequence.substring(position + 1);
        this.currentSequence = before + after;
        
        // Update modifications (shift positions)
        const newModifications = new Map();
        for (const [pos, mod] of this.modifications) {
            if (pos < position) {
                newModifications.set(pos, mod);
            } else if (pos > position) {
                newModifications.set(pos - 1, mod);
            }
            // Skip the deleted position
        }
        
        // Add deletion marker
        newModifications.set(position, {
            original: deletedBase,
            modified: '',
            type: 'deletion',
            timestamp: Date.now()
        });
        
        this.modifications = newModifications;
        this.hasUnsavedChanges = true;
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        console.log(`🔧 [SequenceEditor] Base deleted: ${deletedBase} at position ${position}`);
    }
    
    /**
     * Undo the last change
     */
    undo() {
        if (this.undoStack.length === 0) {
            this.genomeBrowser.showNotification('Nothing to undo', 'info');
            return;
        }
        
        const undoEntry = this.undoStack.pop();
        this.redoStack.push(undoEntry);
        
        switch (undoEntry.type) {
            case 'base_edit':
                this.applyBaseEdit(undoEntry.position, undoEntry.oldValue);
                break;
            case 'insertion':
                this.applyDeletion(undoEntry.position, undoEntry.sequence.length);
                break;
            case 'deletion':
                this.applyInsertion(undoEntry.position, undoEntry.deletedBase);
                break;
        }
        
        this.hasUnsavedChanges = true;
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        console.log(`🔧 [SequenceEditor] Undo applied: ${undoEntry.type}`);
    }
    
    /**
     * Redo the last undone change
     */
    redo() {
        if (this.redoStack.length === 0) {
            this.genomeBrowser.showNotification('Nothing to redo', 'info');
            return;
        }
        
        const redoEntry = this.redoStack.pop();
        this.undoStack.push(redoEntry);
        
        switch (redoEntry.type) {
            case 'base_edit':
                this.applyBaseEdit(redoEntry.position, redoEntry.newValue);
                break;
            case 'insertion':
                this.applyInsertion(redoEntry.position, redoEntry.sequence);
                break;
            case 'deletion':
                this.applyDeletion(redoEntry.position, 1);
                break;
        }
        
        this.hasUnsavedChanges = true;
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        console.log(`🔧 [SequenceEditor] Redo applied: ${redoEntry.type}`);
    }
    
    /**
     * Enable editing mode
     */
    enableEditMode() {
        if (this.isEditMode) return;
        
        console.log('🔧 [SequenceEditor] Enabling edit mode...');
        
        this.isEditMode = true;
        this.originalSequence = this.vscodeEditor.sequence;
        this.currentSequence = this.originalSequence;
        this.modifications.clear();
        this.undoStack = [];
        this.redoStack = [];
        this.hasUnsavedChanges = false;
        this.editingStartTime = Date.now();
        
        // Update UI
        this.showEditingToolbar();
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        // Add editing styles
        this.addEditingStyles();
        
        this.genomeBrowser.showNotification('Edit mode enabled. Click on bases to edit them.', 'info');
        console.log('✅ [SequenceEditor] Edit mode enabled');
    }
    
    /**
     * Disable editing mode
     */
    disableEditMode() {
        if (!this.isEditMode) return;
        
        console.log('🔧 [SequenceEditor] Disabling edit mode...');
        
        // Check for unsaved changes
        if (this.hasUnsavedChanges) {
            const result = confirm('You have unsaved changes. Do you want to save them before exiting edit mode?');
            if (result) {
                this.saveChanges();
            }
        }
        
        this.isEditMode = false;
        
        // Clean up
        this.hideEditingToolbar();
        this.removeEditingStyles();
        this.clearAutoSave();
        
        // Reset to original sequence if not saved
        if (!this.hasUnsavedChanges) {
            this.currentSequence = this.originalSequence;
            this.modifications.clear();
        }
        
        this.updateStatusBar();
        this.vscodeEditor.render();
        
        console.log('✅ [SequenceEditor] Edit mode disabled');
    }
    
    /**
     * Save changes and submit action to ActionManager
     */
    async saveChanges() {
        if (!this.hasUnsavedChanges || this.modifications.size === 0) {
            this.genomeBrowser.showNotification('No changes to save', 'info');
            return;
        }
        
        console.log('🔧 [SequenceEditor] Saving changes...');
        
        try {
            // Prepare change summary
            const changeSummary = this.generateChangeSummary();
            
            // Create action for ActionManager
            const actionId = await this.submitEditingAction(changeSummary);
            
            // Mark as saved
            this.hasUnsavedChanges = false;
            this.updateStatusBar();
            
            this.genomeBrowser.showNotification(`Changes saved successfully! Action #${actionId} queued.`, 'success');
            
            console.log(`✅ [SequenceEditor] Changes saved, action ID: ${actionId}`);
            
        } catch (error) {
            console.error('❌ [SequenceEditor] Error saving changes:', error);
            this.genomeBrowser.showNotification('Error saving changes: ' + error.message, 'error');
        }
    }
    
    /**
     * Generate a summary of changes
     */
    generateChangeSummary() {
        const summary = {
            totalChanges: this.modifications.size,
            substitutions: 0,
            insertions: 0,
            deletions: 0,
            changes: [],
            originalLength: this.originalSequence.length,
            newLength: this.currentSequence.length,
            originalSequence: this.originalSequence,
            modifiedSequence: this.currentSequence
        };
        
        for (const [position, modification] of this.modifications) {
            summary.changes.push({
                position: position,
                type: modification.type,
                original: modification.original,
                modified: modification.modified,
                timestamp: modification.timestamp
            });
            
            switch (modification.type) {
                case 'substitution':
                    summary.substitutions++;
                    break;
                case 'insertion':
                    summary.insertions++;
                    break;
                case 'deletion':
                    summary.deletions++;
                    break;
            }
        }
        
        return summary;
    }
    
    /**
     * Submit editing action to ActionManager
     */
    async submitEditingAction(changeSummary) {
        if (!window.actionManager) {
            throw new Error('ActionManager not available');
        }
        
        const target = `${this.vscodeEditor.chromosome}:${this.vscodeEditor.viewStart + 1}-${this.vscodeEditor.viewEnd}`;
        const details = `Sequence editing: ${changeSummary.substitutions} substitutions, ${changeSummary.insertions} insertions, ${changeSummary.deletions} deletions`;
        
        const metadata = {
            chromosome: this.vscodeEditor.chromosome,
            viewStart: this.vscodeEditor.viewStart,
            viewEnd: this.vscodeEditor.viewEnd,
            originalSequence: changeSummary.originalSequence,
            modifiedSequence: changeSummary.modifiedSequence,
            changeSummary: changeSummary,
            editingSession: {
                startTime: this.editingStartTime,
                endTime: Date.now(),
                undoSteps: this.undoStack.length,
                redoSteps: this.redoStack.length
            }
        };
        
        const actionId = window.actionManager.addAction(
            'sequence_edit',
            target,
            details,
            metadata
        );
        
        return actionId;
    }
    
    /**
     * Create editing toolbar
     */
    createEditingToolbar() {
        const toolbar = document.createElement('div');
        toolbar.id = 'sequenceEditingToolbar';
        toolbar.className = 'sequence-editing-toolbar';
        toolbar.style.display = 'none';
        
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <button id="saveChangesBtn" class="btn btn-sm btn-success" title="Save Changes (Ctrl+S)">
                    <i class="fas fa-save"></i> Save
                </button>
                <button id="discardChangesBtn" class="btn btn-sm btn-warning" title="Discard Changes">
                    <i class="fas fa-undo"></i> Discard
                </button>
            </div>
            
            <div class="toolbar-section">
                <button id="undoBtn" class="btn btn-sm btn-secondary" title="Undo (Ctrl+Z)">
                    <i class="fas fa-undo"></i>
                </button>
                <button id="redoBtn" class="btn btn-sm btn-secondary" title="Redo (Ctrl+Y)">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
            
            <div class="toolbar-section">
                <button id="findReplaceBtn" class="btn btn-sm btn-secondary" title="Find & Replace (Ctrl+H)">
                    <i class="fas fa-search"></i> Find/Replace
                </button>
                <button id="validateBtn" class="btn btn-sm btn-info" title="Validate Sequence">
                    <i class="fas fa-check-circle"></i> Validate
                </button>
            </div>
            
            <div class="toolbar-section">
                <button id="insertModeBtn" class="btn btn-sm btn-secondary" title="Toggle Insert Mode">
                    <i class="fas fa-i-cursor"></i> Insert
                </button>
                <button id="selectAllBtn" class="btn btn-sm btn-secondary" title="Select All (Ctrl+A)">
                    <i class="fas fa-select-all"></i>
                </button>
            </div>
        `;
        
        // Insert toolbar before sequence content
        const sequenceContainer = document.getElementById('sequenceContent');
        if (sequenceContainer && sequenceContainer.parentNode) {
            sequenceContainer.parentNode.insertBefore(toolbar, sequenceContainer);
        }
        
        this.editingToolbar = toolbar;
        this.setupToolbarEventListeners();
    }
    
    /**
     * Create status bar
     */
    createStatusBar() {
        const statusBar = document.createElement('div');
        statusBar.id = 'sequenceEditingStatusBar';
        statusBar.className = 'sequence-editing-status-bar';
        
        statusBar.innerHTML = `
            <div class="status-section">
                <span id="editModeStatus">Edit Mode: <span class="status-value">Disabled</span></span>
            </div>
            <div class="status-section">
                <span id="changeCount">Changes: <span class="status-value">0</span></span>
            </div>
            <div class="status-section">
                <span id="sequenceLength">Length: <span class="status-value">0</span></span>
            </div>
            <div class="status-section">
                <span id="cursorPosition">Position: <span class="status-value">0</span></span>
            </div>
            <div class="status-section">
                <span id="validationStatus">Valid: <span class="status-value">✓</span></span>
            </div>
        `;
        
        // Insert status bar after sequence content
        const sequenceContainer = document.getElementById('sequenceContent');
        if (sequenceContainer && sequenceContainer.parentNode) {
            sequenceContainer.parentNode.insertBefore(statusBar, sequenceContainer.nextSibling);
        }
        
        this.statusBar = statusBar;
    }
    
    /**
     * Setup toolbar event listeners
     */
    setupToolbarEventListeners() {
        if (!this.editingToolbar) return;
        
        // Save changes
        const saveBtn = this.editingToolbar.querySelector('#saveChangesBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveChanges());
        }
        
        // Discard changes
        const discardBtn = this.editingToolbar.querySelector('#discardChangesBtn');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => this.discardChanges());
        }
        
        // Undo/Redo
        const undoBtn = this.editingToolbar.querySelector('#undoBtn');
        if (undoBtn) {
            undoBtn.addEventListener('click', () => this.undo());
        }
        
        const redoBtn = this.editingToolbar.querySelector('#redoBtn');
        if (redoBtn) {
            redoBtn.addEventListener('click', () => this.redo());
        }
        
        // Find & Replace
        const findReplaceBtn = this.editingToolbar.querySelector('#findReplaceBtn');
        if (findReplaceBtn) {
            findReplaceBtn.addEventListener('click', () => this.showFindReplaceDialog());
        }
        
        // Validate
        const validateBtn = this.editingToolbar.querySelector('#validateBtn');
        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateSequence());
        }
        
        // Select All
        const selectAllBtn = this.editingToolbar.querySelector('#selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAllSequence());
        }
    }
    
    /**
     * Setup editing keyboard shortcuts
     */
    setupEditingShortcuts() {
        this.editingShortcuts = {
            'Ctrl+S': () => this.saveChanges(),
            'Cmd+S': () => this.saveChanges(),
            'Ctrl+Z': () => this.undo(),
            'Cmd+Z': () => this.undo(),
            'Ctrl+Y': () => this.redo(),
            'Cmd+Shift+Z': () => this.redo(),
            'Ctrl+H': () => this.showFindReplaceDialog(),
            'Cmd+H': () => this.showFindReplaceDialog(),
            'Ctrl+A': () => this.selectAllSequence(),
            'Cmd+A': () => this.selectAllSequence(),
            'Escape': () => this.disableEditMode()
        };
    }
    
    /**
     * Handle editing keydown events
     */
    handleEditingKeydown(event) {
        if (!this.isEditMode) return false;
        
        const key = event.key;
        const ctrl = event.ctrlKey || event.metaKey;
        const shift = event.shiftKey;
        
        // Build shortcut string
        let shortcut = '';
        if (ctrl) shortcut += event.metaKey ? 'Cmd+' : 'Ctrl+';
        if (shift) shortcut += 'Shift+';
        shortcut += key;
        
        // Check for editing shortcuts
        if (this.editingShortcuts[shortcut]) {
            event.preventDefault();
            this.editingShortcuts[shortcut]();
            return true;
        }
        
        return false;
    }
    
    // Utility methods
    isValidBase(base) {
        const upperBase = base.toUpperCase();
        return this.validBases.has(upperBase) || 
               (this.allowAmbiguous && this.ambiguousBases.has(upperBase));
    }
    
    getValidBases() {
        let validBases = new Set(this.validBases);
        if (this.allowAmbiguous) {
            validBases = new Set([...validBases, ...this.ambiguousBases]);
        }
        return validBases;
    }
    
    cleanSequence(sequence) {
        return sequence.toUpperCase()
                      .replace(/[^ATGCNRYSWKMBDHV]/g, '')
                      .split('')
                      .filter(base => this.isValidBase(base))
                      .join('');
    }
    
    getCurrentBase(position) {
        return position < this.currentSequence.length ? this.currentSequence[position] : '';
    }
    
    getOriginalBase(position) {
        return position < this.originalSequence.length ? this.originalSequence[position] : '';
    }
    
    showEditingToolbar() {
        if (this.editingToolbar) {
            this.editingToolbar.style.display = 'flex';
        }
    }
    
    hideEditingToolbar() {
        if (this.editingToolbar) {
            this.editingToolbar.style.display = 'none';
        }
    }
    
    updateStatusBar() {
        if (!this.statusBar) return;
        
        const editModeStatus = this.statusBar.querySelector('#editModeStatus .status-value');
        const changeCount = this.statusBar.querySelector('#changeCount .status-value');
        const sequenceLength = this.statusBar.querySelector('#sequenceLength .status-value');
        const validationStatus = this.statusBar.querySelector('#validationStatus .status-value');
        
        if (editModeStatus) {
            editModeStatus.textContent = this.isEditMode ? 'Enabled' : 'Disabled';
            editModeStatus.className = this.isEditMode ? 'status-value status-enabled' : 'status-value status-disabled';
        }
        
        if (changeCount) {
            changeCount.textContent = this.modifications.size;
            changeCount.className = this.modifications.size > 0 ? 'status-value status-modified' : 'status-value';
        }
        
        if (sequenceLength) {
            sequenceLength.textContent = this.currentSequence.length;
            const lengthChanged = this.currentSequence.length !== this.originalSequence.length;
            sequenceLength.className = lengthChanged ? 'status-value status-modified' : 'status-value';
        }
        
        if (validationStatus) {
            const isValid = this.validateCurrentSequence();
            validationStatus.textContent = isValid ? '✓' : '✗';
            validationStatus.className = isValid ? 'status-value status-valid' : 'status-value status-invalid';
        }
    }
    
    validateCurrentSequence() {
        for (const char of this.currentSequence) {
            if (!this.isValidBase(char)) {
                return false;
            }
        }
        return true;
    }
    
    addEditingStyles() {
        const style = document.createElement('style');
        style.id = 'sequenceEditingStyles';
        style.textContent = `
            .sequence-editing-toolbar {
                display: flex;
                gap: 15px;
                padding: 10px;
                background: #2d2d30;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
                margin-bottom: 10px;
                align-items: center;
            }
            
            .toolbar-section {
                display: flex;
                gap: 5px;
                align-items: center;
            }
            
            .sequence-editing-status-bar {
                display: flex;
                gap: 20px;
                padding: 8px 10px;
                background: #252526;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
                margin-top: 10px;
                font-size: 12px;
                color: #d4d4d4;
            }
            
            .status-section {
                display: flex;
                align-items: center;
            }
            
            .status-value {
                font-weight: bold;
                margin-left: 5px;
            }
            
            .status-enabled {
                color: #4CAF50 !important;
            }
            
            .status-disabled {
                color: #9E9E9E !important;
            }
            
            .status-modified {
                color: #FF9800 !important;
            }
            
            .status-valid {
                color: #4CAF50 !important;
            }
            
            .status-invalid {
                color: #F44336 !important;
            }
            
            .sequence-base[contenteditable="true"] {
                cursor: text;
                outline: none;
                border-radius: 2px;
                transition: background-color 0.2s;
            }
            
            .sequence-base[contenteditable="true"]:hover {
                background-color: rgba(255, 255, 255, 0.1);
            }
            
            .sequence-base[contenteditable="true"]:focus {
                background-color: rgba(38, 79, 120, 0.4);
                outline: 1px solid #007acc;
            }
            
            .sequence-modified {
                background-color: rgba(255, 193, 7, 0.3) !important;
                border-bottom: 2px solid #FFC107;
            }
            
            .sequence-inserted {
                background-color: rgba(76, 175, 80, 0.3) !important;
                border-bottom: 2px solid #4CAF50;
            }
            
            .sequence-deleted {
                background-color: rgba(244, 67, 54, 0.3) !important;
                border-bottom: 2px solid #F44336;
                text-decoration: line-through;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    removeEditingStyles() {
        const style = document.getElementById('sequenceEditingStyles');
        if (style) {
            style.remove();
        }
    }
    
    scheduleAutoSave() {
        this.clearAutoSave();
        this.autoSaveInterval = setTimeout(() => {
            if (this.hasUnsavedChanges) {
                console.log('🔧 [SequenceEditor] Auto-saving changes...');
                this.saveChanges();
            }
        }, this.autoSaveDelay);
    }
    
    clearAutoSave() {
        if (this.autoSaveInterval) {
            clearTimeout(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }
    
    // Additional helper methods
    discardChanges() {
        if (this.modifications.size === 0) {
            this.genomeBrowser.showNotification('No changes to discard', 'info');
            return;
        }
        
        const result = confirm('Are you sure you want to discard all changes? This cannot be undone.');
        if (result) {
            this.currentSequence = this.originalSequence;
            this.modifications.clear();
            this.undoStack = [];
            this.redoStack = [];
            this.hasUnsavedChanges = false;
            
            this.updateStatusBar();
            this.vscodeEditor.render();
            
            this.genomeBrowser.showNotification('All changes discarded', 'info');
        }
    }
    
    validateSequence() {
        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        // Check for invalid characters
        const invalidChars = [];
        for (let i = 0; i < this.currentSequence.length; i++) {
            const char = this.currentSequence[i];
            if (!this.isValidBase(char)) {
                invalidChars.push({ position: i, character: char });
            }
        }
        
        if (invalidChars.length > 0) {
            validation.isValid = false;
            validation.errors.push(`Invalid characters found: ${invalidChars.map(ic => `${ic.character} at position ${ic.position + 1}`).join(', ')}`);
        }
        
        // Check sequence length changes
        const lengthDiff = this.currentSequence.length - this.originalSequence.length;
        if (lengthDiff !== 0) {
            validation.warnings.push(`Sequence length changed by ${lengthDiff} bases (${this.originalSequence.length} → ${this.currentSequence.length})`);
        }
        
        // Show validation results
        this.showValidationResults(validation);
        
        return validation.isValid;
    }
    
    showValidationResults(validation) {
        let message = '';
        let type = 'success';
        
        if (validation.isValid) {
            message = 'Sequence validation passed ✓';
        } else {
            message = 'Sequence validation failed:\n' + validation.errors.join('\n');
            type = 'error';
        }
        
        if (validation.warnings.length > 0) {
            message += '\n\nWarnings:\n' + validation.warnings.join('\n');
        }
        
        this.genomeBrowser.showNotification(message, type);
    }
    
    selectAllSequence() {
        if (this.vscodeEditor) {
            this.vscodeEditor.selectAll();
        }
    }
    
    showFindReplaceDialog() {
        // Implementation for find/replace dialog
        console.log('🔧 [SequenceEditor] Find/Replace dialog not yet implemented');
        this.genomeBrowser.showNotification('Find/Replace feature coming soon!', 'info');
    }
    
    // Navigation helpers
    moveToNextEditableBase(currentPosition) {
        const nextPosition = currentPosition + 1;
        if (nextPosition < this.currentSequence.length) {
            this.focusBaseAtPosition(nextPosition);
        }
    }
    
    moveToPreviousEditableBase(currentPosition) {
        const prevPosition = currentPosition - 1;
        if (prevPosition >= 0) {
            this.focusBaseAtPosition(prevPosition);
        }
    }
    
    focusBaseAtPosition(position) {
        const lineIndex = Math.floor(position / this.vscodeEditor.basesPerLine);
        const baseIndex = position % this.vscodeEditor.basesPerLine;
        
        const sequenceLines = this.vscodeEditor.sequenceContent.querySelectorAll('.sequence-line');
        if (lineIndex < sequenceLines.length) {
            const bases = sequenceLines[lineIndex].querySelectorAll('.sequence-base');
            if (baseIndex < bases.length) {
                bases[baseIndex].focus();
            }
        }
    }
    
    placeCursorAtEnd(element) {
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(element);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    showValidationError(message) {
        this.genomeBrowser.showNotification(message, 'warning');
    }
    
    // Event handlers for base editing
    handleBaseFocus(event, position) {
        this.updateCursorPosition(position);
    }
    
    handleBaseBlur(event, position) {
        // Optional: perform validation when leaving a base
    }
    
    updateCursorPosition(position) {
        const cursorPos = this.statusBar?.querySelector('#cursorPosition .status-value');
        if (cursorPos) {
            cursorPos.textContent = position + 1; // 1-based position
        }
    }
    
    // Apply operations (used by undo/redo)
    applyBaseEdit(position, value) {
        const sequenceArray = Array.from(this.currentSequence);
        sequenceArray[position] = value;
        this.currentSequence = sequenceArray.join('');
        
        const originalBase = this.getOriginalBase(position);
        if (value !== originalBase) {
            this.modifications.set(position, {
                original: originalBase,
                modified: value,
                type: 'substitution',
                timestamp: Date.now()
            });
        } else {
            this.modifications.delete(position);
        }
    }
    
    applyInsertion(position, sequence) {
        const before = this.currentSequence.substring(0, position);
        const after = this.currentSequence.substring(position);
        this.currentSequence = before + sequence + after;
        
        for (let i = 0; i < sequence.length; i++) {
            this.modifications.set(position + i, {
                original: '',
                modified: sequence[i],
                type: 'insertion',
                timestamp: Date.now()
            });
        }
    }
    
    applyDeletion(position, length) {
        const before = this.currentSequence.substring(0, position);
        const after = this.currentSequence.substring(position + length);
        this.currentSequence = before + after;
        
        // Update modifications map for position shifts
        const newModifications = new Map();
        for (const [pos, mod] of this.modifications) {
            if (pos < position) {
                newModifications.set(pos, mod);
            } else if (pos >= position + length) {
                newModifications.set(pos - length, mod);
            }
        }
        this.modifications = newModifications;
    }
    
    revertBaseChange(position) {
        const originalBase = this.getOriginalBase(position);
        this.applyBaseEdit(position, originalBase);
        this.updateStatusBar();
        this.vscodeEditor.render();
    }
    
    destroy() {
        console.log('🔧 [SequenceEditor] Destroying sequence editor...');
        
        this.disableEditMode();
        this.clearAutoSave();
        
        // Remove UI elements
        if (this.editingToolbar) {
            this.editingToolbar.remove();
        }
        if (this.statusBar) {
            this.statusBar.remove();
        }
        
        this.removeEditingStyles();
        
        // Clear references
        this.vscodeEditor = null;
        this.genomeBrowser = null;
        this.modifications.clear();
        this.undoStack = [];
        this.redoStack = [];
        
        console.log('✅ [SequenceEditor] Sequence editor destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SequenceEditor;
} else if (typeof window !== 'undefined') {
    window.SequenceEditor = SequenceEditor;
} 