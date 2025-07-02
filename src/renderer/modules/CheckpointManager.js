/**
 * CheckpointManager - Manages system state checkpoints for rollback functionality
 * Handles creation, storage, restoration, and management of application checkpoints
 */
class CheckpointManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.checkpoints = [];
        this.nextCheckpointId = 1;
        this.maxCheckpoints = 50; // Maximum number of checkpoints to keep
        this.autoSaveInterval = 300000; // Auto-save every 5 minutes
        this.autoSaveTimer = null;
        
        // Checkpoint types
        this.CHECKPOINT_TYPES = {
            MANUAL: 'manual',
            AUTO: 'auto',
            BEFORE_ACTION: 'before_action',
            MILESTONE: 'milestone'
        };
        
        this.initializeEventListeners();
        this.loadCheckpointsFromStorage();
        this.startAutoSave();
        
        console.log('✅ CheckpointManager initialized');
    }
    
    /**
     * Initialize event listeners for checkpoint UI
     */
    initializeEventListeners() {
        // Wait for DOM to be ready
        const setupListeners = () => {
            console.log('🎯 Setting up CheckpointManager event listeners...');
            
            // Modal checkpoint creation button
            const createCheckpointBtnModal = document.getElementById('createCheckpointBtnModal');
            if (createCheckpointBtnModal) {
                createCheckpointBtnModal.addEventListener('click', () => {
                    this.createManualCheckpointFromModal();
                });
                console.log('✅ Modal checkpoint creation listener added');
            }
            
            // Checkpoint name input - Enter key
            const checkpointNameInput = document.getElementById('checkpointNameInput');
            if (checkpointNameInput) {
                checkpointNameInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.createManualCheckpointFromModal();
                    }
                });
                console.log('✅ Checkpoint name input listener added');
            }
        };
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setupListeners);
        } else {
            setupListeners();
        }
    }
    
    /**
     * Create a manual checkpoint with user-provided name
     */
    async createManualCheckpoint() {
        try {
            const name = await this.promptForCheckpointName();
            if (!name) return null;
            
            const checkpointId = await this.createCheckpoint(name, this.CHECKPOINT_TYPES.MANUAL);
            this.genomeBrowser.showNotification(`Checkpoint "${name}" created successfully`, 'success');
            return checkpointId;
        } catch (error) {
            console.error('❌ Error creating manual checkpoint:', error);
            this.genomeBrowser.showNotification('Failed to create checkpoint', 'error');
            return null;
        }
    }
    
    /**
     * Create checkpoint from modal input
     */
    async createManualCheckpointFromModal() {
        const nameInput = document.getElementById('checkpointNameInput');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            this.genomeBrowser.showNotification('Please enter a checkpoint name', 'warning');
            return;
        }
        
        try {
            const checkpointId = await this.createCheckpoint(name, this.CHECKPOINT_TYPES.MANUAL);
            this.genomeBrowser.showNotification(`Checkpoint "${name}" created successfully`, 'success');
            nameInput.value = ''; // Clear input
            this.updateCheckpointListUI();
            return checkpointId;
        } catch (error) {
            console.error('❌ Error creating checkpoint from modal:', error);
            this.genomeBrowser.showNotification('Failed to create checkpoint', 'error');
        }
    }
    
    /**
     * Create a new checkpoint
     */
    async createCheckpoint(name, type = this.CHECKPOINT_TYPES.MANUAL, metadata = {}) {
        try {
            // Generate unique name if not provided
            if (!name) {
                name = this.generateCheckpointName(type);
            }
            
            // Capture current system state
            const state = await this.captureSystemState();
            
            // Create checkpoint object
            const checkpoint = {
                id: this.nextCheckpointId++,
                name: name,
                type: type,
                timestamp: new Date(),
                state: state,
                metadata: metadata,
                size: this.calculateStateSize(state)
            };
            
            // Add to checkpoints array
            this.checkpoints.push(checkpoint);
            
            // Maintain maximum checkpoint limit
            this.enforceCheckpointLimit();
            
            // Save to storage
            await this.saveCheckpointsToStorage();
            
            // Update UI
            this.updateCheckpointListUI();
            
            console.log(`✅ Checkpoint created: ${name} (ID: ${checkpoint.id})`);
            return checkpoint.id;
            
        } catch (error) {
            console.error('❌ Error creating checkpoint:', error);
            throw error;
        }
    }
    
    /**
     * Capture current system state
     */
    async captureSystemState() {
        const state = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            
            // Genome Browser State
            genomeBrowser: {
                currentFile: this.genomeBrowser.currentFile,
                currentChromosome: this.genomeBrowser.currentChromosome,
                currentPosition: this.genomeBrowser.currentPosition,
                zoomLevel: this.genomeBrowser.zoomLevel,
                viewStart: this.genomeBrowser.viewStart,
                viewEnd: this.genomeBrowser.viewEnd,
                loadedFiles: this.genomeBrowser.loadedFiles ? [...this.genomeBrowser.loadedFiles] : [],
                selectedFeatures: this.genomeBrowser.selectedFeatures ? [...this.genomeBrowser.selectedFeatures] : []
            },
            
            // Action Manager State
            actionManager: window.actionManager ? window.actionManager.getState() : null,
            
            // UI State
            ui: {
                activeModal: this.getActiveModal(),
                panelStates: this.capturePanelStates(),
                trackSettings: this.captureTrackSettings(),
                viewMode: this.captureViewMode()
            },
            
            // File Manager State
            fileManager: this.captureFileManagerState(),
            
            // Plugin States
            plugins: this.capturePluginStates(),
            
            // Settings
            settings: this.captureSettings()
        };
        
        return state;
    }
    
    /**
     * Capture panel states
     */
    capturePanelStates() {
        const panels = [
            'fileInfoSection',
            'navigationSection', 
            'statisticsSection',
            'tracksSection',
            'featuresSection'
        ];
        
        const states = {};
        panels.forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                states[panelId] = {
                    visible: !panel.classList.contains('hidden'),
                    collapsed: panel.classList.contains('collapsed')
                };
            }
        });
        
        return states;
    }
    
    /**
     * Capture track settings
     */
    captureTrackSettings() {
        if (this.genomeBrowser.trackSettings) {
            return JSON.parse(JSON.stringify(this.genomeBrowser.trackSettings));
        }
        return null;
    }
    
    /**
     * Capture view mode
     */
    captureViewMode() {
        return {
            sequenceMode: this.genomeBrowser.sequenceMode || 'nucleotide',
            displayMode: this.genomeBrowser.displayMode || 'normal'
        };
    }
    
    /**
     * Capture file manager state
     */
    captureFileManagerState() {
        if (this.genomeBrowser.fileManager) {
            return {
                recentFiles: this.genomeBrowser.fileManager.recentFiles ? [...this.genomeBrowser.fileManager.recentFiles] : [],
                fileHistory: this.genomeBrowser.fileManager.fileHistory ? [...this.genomeBrowser.fileManager.fileHistory] : []
            };
        }
        return null;
    }
    
    /**
     * Capture plugin states
     */
    capturePluginStates() {
        const pluginStates = {};
        
        // Capture active plugins
        if (window.pluginManager) {
            pluginStates.activePlugins = window.pluginManager.getActivePlugins ? 
                window.pluginManager.getActivePlugins() : [];
        }
        
        return pluginStates;
    }
    
    /**
     * Capture settings
     */
    captureSettings() {
        const settings = {};
        
        // Capture various settings
        if (window.configManager) {
            settings.config = window.configManager.getConfig ? window.configManager.getConfig() : {};
        }
        
        return settings;
    }
    
    /**
     * Get currently active modal
     */
    getActiveModal() {
        const modals = document.querySelectorAll('.modal.show');
        return modals.length > 0 ? modals[0].id : null;
    }
    
    /**
     * Rollback to a specific checkpoint
     */
    async rollbackToCheckpoint(checkpointId) {
        try {
            const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
            if (!checkpoint) {
                throw new Error(`Checkpoint with ID ${checkpointId} not found`);
            }
            
            // Show confirmation dialog
            const confirmed = await this.confirmRollback(checkpoint);
            if (!confirmed) return false;
            
            // Create backup checkpoint before rollback
            await this.createCheckpoint('Before Rollback', this.CHECKPOINT_TYPES.AUTO, {
                rollbackTo: checkpointId,
                rollbackName: checkpoint.name
            });
            
            // Restore state
            await this.restoreSystemState(checkpoint.state);
            
            this.genomeBrowser.showNotification(`Rolled back to checkpoint: ${checkpoint.name}`, 'success');
            console.log(`✅ Rolled back to checkpoint: ${checkpoint.name}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error rolling back to checkpoint:', error);
            this.genomeBrowser.showNotification('Failed to rollback to checkpoint', 'error');
            return false;
        }
    }
    
    /**
     * Restore system state from checkpoint
     */
    async restoreSystemState(state) {
        try {
            // Restore Genome Browser state
            if (state.genomeBrowser) {
                await this.restoreGenomeBrowserState(state.genomeBrowser);
            }
            
            // Restore Action Manager state
            if (state.actionManager && window.actionManager) {
                window.actionManager.restoreState(state.actionManager);
            }
            
            // Restore UI state
            if (state.ui) {
                this.restoreUIState(state.ui);
            }
            
            // Restore file manager state
            if (state.fileManager && this.genomeBrowser.fileManager) {
                this.restoreFileManagerState(state.fileManager);
            }
            
            console.log('✅ System state restored successfully');
            
        } catch (error) {
            console.error('❌ Error restoring system state:', error);
            throw error;
        }
    }
    
    /**
     * Restore genome browser state
     */
    async restoreGenomeBrowserState(genomeBrowserState) {
        // Restore current file if different
        if (genomeBrowserState.currentFile && genomeBrowserState.currentFile !== this.genomeBrowser.currentFile) {
            // This would need to trigger file loading
            console.log('📁 File restoration needed:', genomeBrowserState.currentFile);
        }
        
        // Restore position and zoom
        if (genomeBrowserState.currentChromosome) {
            this.genomeBrowser.currentChromosome = genomeBrowserState.currentChromosome;
        }
        
        if (genomeBrowserState.currentPosition) {
            this.genomeBrowser.currentPosition = genomeBrowserState.currentPosition;
        }
        
        if (genomeBrowserState.zoomLevel) {
            this.genomeBrowser.zoomLevel = genomeBrowserState.zoomLevel;
        }
        
        if (genomeBrowserState.viewStart && genomeBrowserState.viewEnd) {
            this.genomeBrowser.viewStart = genomeBrowserState.viewStart;
            this.genomeBrowser.viewEnd = genomeBrowserState.viewEnd;
        }
        
        // Trigger view refresh
        if (this.genomeBrowser.displayGenomeView) {
            this.genomeBrowser.displayGenomeView();
        }
    }
    
    /**
     * Restore UI state
     */
    restoreUIState(uiState) {
        // Restore panel states
        if (uiState.panelStates) {
            Object.keys(uiState.panelStates).forEach(panelId => {
                const panel = document.getElementById(panelId);
                const state = uiState.panelStates[panelId];
                
                if (panel && state) {
                    if (state.visible) {
                        panel.classList.remove('hidden');
                    } else {
                        panel.classList.add('hidden');
                    }
                    
                    if (state.collapsed) {
                        panel.classList.add('collapsed');
                    } else {
                        panel.classList.remove('collapsed');
                    }
                }
            });
        }
        
        // Restore track settings
        if (uiState.trackSettings) {
            this.genomeBrowser.trackSettings = uiState.trackSettings;
        }
        
        // Restore view mode
        if (uiState.viewMode) {
            if (uiState.viewMode.sequenceMode) {
                this.genomeBrowser.sequenceMode = uiState.viewMode.sequenceMode;
            }
            if (uiState.viewMode.displayMode) {
                this.genomeBrowser.displayMode = uiState.viewMode.displayMode;
            }
        }
    }
    
    /**
     * Restore file manager state
     */
    restoreFileManagerState(fileManagerState) {
        if (fileManagerState.recentFiles) {
            this.genomeBrowser.fileManager.recentFiles = [...fileManagerState.recentFiles];
        }
        
        if (fileManagerState.fileHistory) {
            this.genomeBrowser.fileManager.fileHistory = [...fileManagerState.fileHistory];
        }
    }
    
    /**
     * Show checkpoint list dialog
     */
    showCheckpointList() {
        this.updateCheckpointListUI();
        
        // Show the action list modal which contains checkpoint management
        const modal = document.getElementById('actionListModal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * Update checkpoint list UI
     */
    updateCheckpointListUI() {
        const content = document.getElementById('checkpointListContent');
        if (!content) return;
        
        if (this.checkpoints.length === 0) {
            content.innerHTML = `
                <div class="empty-checkpoints-message">
                    <i class="fas fa-bookmark"></i>
                    <p>No checkpoints created</p>
                    <small>Create checkpoints to save current state</small>
                </div>
            `;
            return;
        }
        
        // Sort checkpoints by timestamp (newest first)
        const sortedCheckpoints = [...this.checkpoints].sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        
        content.innerHTML = sortedCheckpoints.map(checkpoint => 
            this.renderCheckpointItem(checkpoint)
        ).join('');
        
        // Add event listeners
        sortedCheckpoints.forEach(checkpoint => {
            const rollbackBtn = document.getElementById(`rollback-${checkpoint.id}`);
            const deleteBtn = document.getElementById(`delete-${checkpoint.id}`);
            const infoBtn = document.getElementById(`info-${checkpoint.id}`);
            
            rollbackBtn?.addEventListener('click', () => this.rollbackToCheckpoint(checkpoint.id));
            deleteBtn?.addEventListener('click', () => this.deleteCheckpoint(checkpoint.id));
            infoBtn?.addEventListener('click', () => this.showCheckpointInfo(checkpoint.id));
        });
    }
    
    /**
     * Render single checkpoint item
     */
    renderCheckpointItem(checkpoint) {
        const typeIcon = this.getCheckpointTypeIcon(checkpoint.type);
        const timeAgo = this.getTimeAgo(checkpoint.timestamp);
        const sizeFormatted = this.formatSize(checkpoint.size);
        
        return `
            <div class="checkpoint-item" data-checkpoint-id="${checkpoint.id}">
                <div class="checkpoint-info">
                    <div class="checkpoint-name">
                        <i class="fas ${typeIcon}"></i>
                        ${checkpoint.name}
                    </div>
                    <div class="checkpoint-time">
                        ${timeAgo} • ${sizeFormatted}
                    </div>
                </div>
                <div class="checkpoint-controls-item">
                    <button id="rollback-${checkpoint.id}" class="btn btn-sm btn-primary" title="Rollback">
                        <i class="fas fa-undo"></i>
                    </button>
                    <button id="info-${checkpoint.id}" class="btn btn-sm btn-secondary" title="Info">
                        <i class="fas fa-info"></i>
                    </button>
                    <button id="delete-${checkpoint.id}" class="btn btn-sm btn-warning" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    /**
     * Get checkpoint type icon
     */
    getCheckpointTypeIcon(type) {
        const icons = {
            [this.CHECKPOINT_TYPES.MANUAL]: 'fa-bookmark',
            [this.CHECKPOINT_TYPES.AUTO]: 'fa-clock',
            [this.CHECKPOINT_TYPES.BEFORE_ACTION]: 'fa-shield-alt',
            [this.CHECKPOINT_TYPES.MILESTONE]: 'fa-flag'
        };
        return icons[type] || 'fa-bookmark';
    }
    
    /**
     * Get time ago string
     */
    getTimeAgo(timestamp) {
        const now = new Date();
        const checkpointTime = new Date(timestamp);
        const diffMs = now - checkpointTime;
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return checkpointTime.toLocaleDateString();
    }
    
    /**
     * Format size in bytes
     */
    formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    /**
     * Delete checkpoint
     */
    async deleteCheckpoint(checkpointId) {
        try {
            const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
            if (!checkpoint) return;
            
            const confirmed = await this.showDeleteConfirmModal(checkpoint.name);
            if (!confirmed) return;
            
            this.checkpoints = this.checkpoints.filter(cp => cp.id !== checkpointId);
            await this.saveCheckpointsToStorage();
            this.updateCheckpointListUI();
            
            this.genomeBrowser.showNotification(`Checkpoint "${checkpoint.name}" deleted`, 'success');
            
        } catch (error) {
            console.error('❌ Error deleting checkpoint:', error);
            this.genomeBrowser.showNotification('Failed to delete checkpoint', 'error');
        }
    }
    
    /**
     * Show delete confirmation modal
     */
    async showDeleteConfirmModal(checkpointName) {
        return new Promise((resolve) => {
            this.showConfirmModal(
                'Delete Checkpoint',
                `Are you sure you want to delete checkpoint "${checkpointName}"?\n\nThis action cannot be undone.`,
                resolve
            );
        });
    }
    
    /**
     * Show checkpoint information dialog
     */
    showCheckpointInfo(checkpointId) {
        const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
        if (!checkpoint) return;
        
        const info = `
            <strong>Checkpoint Information</strong><br><br>
            <strong>Name:</strong> ${checkpoint.name}<br>
            <strong>Type:</strong> ${checkpoint.type}<br>
            <strong>Created:</strong> ${checkpoint.timestamp.toLocaleString()}<br>
            <strong>Size:</strong> ${this.formatSize(checkpoint.size)}<br>
            <strong>ID:</strong> ${checkpoint.id}<br><br>
            <strong>State Summary:</strong><br>
            • File: ${checkpoint.state.genomeBrowser?.currentFile || 'None'}<br>
            • Chromosome: ${checkpoint.state.genomeBrowser?.currentChromosome || 'None'}<br>
            • Position: ${checkpoint.state.genomeBrowser?.currentPosition || 'None'}<br>
            • Actions: ${checkpoint.state.actionManager?.actions?.length || 0}<br>
        `;
        
        // Create and show info modal
        this.showInfoModal('Checkpoint Information', info);
    }
    
    /**
     * Show info modal
     */
    showInfoModal(title, content) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('checkpointInfoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'checkpointInfoModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3 id="checkpointInfoTitle">${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="checkpointInfoContent">${content}</div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn modal-close">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            // Add close event listeners
            modal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => modal.classList.remove('show'));
            });
        } else {
            document.getElementById('checkpointInfoTitle').textContent = title;
            document.getElementById('checkpointInfoContent').innerHTML = content;
        }
        
        modal.classList.add('show');
    }
    
    /**
     * Generate checkpoint name
     */
    generateCheckpointName(type) {
        const timestamp = new Date();
        const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const prefixes = {
            [this.CHECKPOINT_TYPES.MANUAL]: 'Manual',
            [this.CHECKPOINT_TYPES.AUTO]: 'Auto',
            [this.CHECKPOINT_TYPES.BEFORE_ACTION]: 'Before Action',
            [this.CHECKPOINT_TYPES.MILESTONE]: 'Milestone'
        };
        
        const prefix = prefixes[type] || 'Checkpoint';
        return `${prefix} ${timeString}`;
    }
    
    /**
     * Calculate state size
     */
    calculateStateSize(state) {
        try {
            return new Blob([JSON.stringify(state)]).size;
        } catch (error) {
            return 0;
        }
    }
    
    /**
     * Enforce checkpoint limit
     */
    enforceCheckpointLimit() {
        if (this.checkpoints.length > this.maxCheckpoints) {
            // Remove oldest auto checkpoints first
            const autoCheckpoints = this.checkpoints
                .filter(cp => cp.type === this.CHECKPOINT_TYPES.AUTO)
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            const toRemove = this.checkpoints.length - this.maxCheckpoints;
            const removed = autoCheckpoints.slice(0, Math.min(toRemove, autoCheckpoints.length));
            
            removed.forEach(cp => {
                const index = this.checkpoints.findIndex(checkpoint => checkpoint.id === cp.id);
                if (index > -1) {
                    this.checkpoints.splice(index, 1);
                }
            });
            
            // If still over limit, remove oldest checkpoints
            if (this.checkpoints.length > this.maxCheckpoints) {
                this.checkpoints.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                this.checkpoints = this.checkpoints.slice(this.checkpoints.length - this.maxCheckpoints);
            }
        }
    }
    
    /**
     * Prompt for checkpoint name using custom modal
     */
    async promptForCheckpointName() {
        return new Promise((resolve) => {
            this.showNamePromptModal(resolve);
        });
    }
    
    /**
     * Show custom name prompt modal
     */
    showNamePromptModal(callback) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('checkpointNamePromptModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'checkpointNamePromptModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 400px;">
                    <div class="modal-header">
                        <h3>Create Checkpoint</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="checkpointNamePromptInput">Checkpoint Name:</label>
                            <input type="text" id="checkpointNamePromptInput" class="form-control" 
                                   placeholder="Enter checkpoint name..." 
                                   value="${this.generateCheckpointName(this.CHECKPOINT_TYPES.MANUAL)}">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="checkpointNamePromptConfirm" class="btn btn-primary">Create</button>
                        <button class="btn modal-close">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            // Update the default value
            const input = modal.querySelector('#checkpointNamePromptInput');
            if (input) {
                input.value = this.generateCheckpointName(this.CHECKPOINT_TYPES.MANUAL);
            }
        }
        
        // Set up event listeners
        const confirmBtn = modal.querySelector('#checkpointNamePromptConfirm');
        const input = modal.querySelector('#checkpointNamePromptInput');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        const handleConfirm = () => {
            const name = input.value.trim();
            modal.classList.remove('show');
            callback(name || null);
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            callback(null);
        };
        
        // Remove existing listeners
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        const newConfirmBtn = modal.querySelector('#checkpointNamePromptConfirm');
        
        newConfirmBtn.addEventListener('click', handleConfirm);
        
        closeButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', handleCancel);
        });
        
        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            }
        });
        
        // Show modal and focus input
        modal.classList.add('show');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    }
    
    /**
     * Confirm rollback action using custom modal
     */
    async confirmRollback(checkpoint) {
        return new Promise((resolve) => {
            this.showConfirmModal(
                'Confirm Rollback',
                `Are you sure you want to rollback to checkpoint "${checkpoint.name}"?\n\nThis will restore the system state from ${checkpoint.timestamp.toLocaleString()}.\n\nCurrent state will be automatically saved as a backup.`,
                resolve
            );
        });
    }
    
    /**
     * Show custom confirmation modal
     */
    showConfirmModal(title, message, callback) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('checkpointConfirmModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'checkpointConfirmModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h3 id="checkpointConfirmTitle">${title}</h3>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="checkpointConfirmMessage" style="white-space: pre-line; line-height: 1.5;">
                            ${message}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button id="checkpointConfirmYes" class="btn btn-primary">Yes, Rollback</button>
                        <button class="btn btn-secondary modal-close">Cancel</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        } else {
            // Update content
            modal.querySelector('#checkpointConfirmTitle').textContent = title;
            modal.querySelector('#checkpointConfirmMessage').textContent = message;
        }
        
        // Set up event listeners
        const confirmBtn = modal.querySelector('#checkpointConfirmYes');
        const closeButtons = modal.querySelectorAll('.modal-close');
        
        const handleConfirm = () => {
            modal.classList.remove('show');
            callback(true);
        };
        
        const handleCancel = () => {
            modal.classList.remove('show');
            callback(false);
        };
        
        // Remove existing listeners
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        const newConfirmBtn = modal.querySelector('#checkpointConfirmYes');
        
        newConfirmBtn.addEventListener('click', handleConfirm);
        
        closeButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
        
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', handleCancel);
        });
        
        // Show modal
        modal.classList.add('show');
    }
    
    /**
     * Start auto-save timer
     */
    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setInterval(() => {
            this.createAutoCheckpoint();
        }, this.autoSaveInterval);
        
        console.log('🕐 Auto-save timer started (5 minutes interval)');
    }
    
    /**
     * Create auto checkpoint
     */
    async createAutoCheckpoint() {
        try {
            // Only create auto checkpoint if there are significant changes
            if (this.shouldCreateAutoCheckpoint()) {
                await this.createCheckpoint(
                    this.generateCheckpointName(this.CHECKPOINT_TYPES.AUTO),
                    this.CHECKPOINT_TYPES.AUTO
                );
                console.log('🕐 Auto checkpoint created');
            }
        } catch (error) {
            console.error('❌ Error creating auto checkpoint:', error);
        }
    }
    
    /**
     * Check if auto checkpoint should be created
     */
    shouldCreateAutoCheckpoint() {
        // Don't create if no checkpoints exist
        if (this.checkpoints.length === 0) return true;
        
        // Don't create if last checkpoint was recent (less than 4 minutes ago)
        const lastCheckpoint = this.checkpoints[this.checkpoints.length - 1];
        const timeSinceLastCheckpoint = Date.now() - new Date(lastCheckpoint.timestamp).getTime();
        if (timeSinceLastCheckpoint < 240000) return false; // 4 minutes
        
        // Create if there are pending actions
        if (window.actionManager && window.actionManager.actions.length > 0) return true;
        
        // Create if file has been loaded/changed
        if (this.genomeBrowser.currentFile) return true;
        
        return false;
    }
    
    /**
     * Save checkpoints to localStorage
     */
    async saveCheckpointsToStorage() {
        try {
            const data = {
                checkpoints: this.checkpoints,
                nextCheckpointId: this.nextCheckpointId,
                lastSaved: new Date().toISOString()
            };
            
            localStorage.setItem('genomeai_checkpoints', JSON.stringify(data));
            console.log(`💾 Saved ${this.checkpoints.length} checkpoints to storage`);
            
        } catch (error) {
            console.error('❌ Error saving checkpoints to storage:', error);
        }
    }
    
    /**
     * Load checkpoints from localStorage
     */
    loadCheckpointsFromStorage() {
        try {
            const stored = localStorage.getItem('genomeai_checkpoints');
            if (stored) {
                const data = JSON.parse(stored);
                
                // Restore checkpoints with proper date objects
                this.checkpoints = data.checkpoints.map(cp => ({
                    ...cp,
                    timestamp: new Date(cp.timestamp)
                }));
                
                this.nextCheckpointId = data.nextCheckpointId || 1;
                
                console.log(`📂 Loaded ${this.checkpoints.length} checkpoints from storage`);
            }
        } catch (error) {
            console.error('❌ Error loading checkpoints from storage:', error);
            this.checkpoints = [];
            this.nextCheckpointId = 1;
        }
    }
    
    /**
     * Export checkpoints to file
     */
    async exportCheckpoints() {
        try {
            const data = {
                exported: new Date().toISOString(),
                version: '1.0.0',
                checkpoints: this.checkpoints,
                metadata: {
                    count: this.checkpoints.length,
                    totalSize: this.checkpoints.reduce((sum, cp) => sum + (cp.size || 0), 0)
                }
            };
            
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `genomeai_checkpoints_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.genomeBrowser.showNotification('Checkpoints exported successfully', 'success');
            
        } catch (error) {
            console.error('❌ Error exporting checkpoints:', error);
            this.genomeBrowser.showNotification('Failed to export checkpoints', 'error');
        }
    }
    
    /**
     * Import checkpoints from file
     */
    async importCheckpoints(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.checkpoints || !Array.isArray(data.checkpoints)) {
                throw new Error('Invalid checkpoint file format');
            }
            
            // Restore checkpoints
            const importedCheckpoints = data.checkpoints.map(cp => ({
                ...cp,
                id: this.nextCheckpointId++, // Assign new IDs
                timestamp: new Date(cp.timestamp)
            }));
            
            this.checkpoints.push(...importedCheckpoints);
            this.enforceCheckpointLimit();
            
            await this.saveCheckpointsToStorage();
            this.updateCheckpointListUI();
            
            this.genomeBrowser.showNotification(`Imported ${importedCheckpoints.length} checkpoints`, 'success');
            
        } catch (error) {
            console.error('❌ Error importing checkpoints:', error);
            this.genomeBrowser.showNotification('Failed to import checkpoints', 'error');
        }
    }
    
    /**
     * Clear all checkpoints
     */
    async clearAllCheckpoints() {
        const confirmed = await this.showClearAllConfirmModal();
        if (!confirmed) return;
        
        this.checkpoints = [];
        await this.saveCheckpointsToStorage();
        this.updateCheckpointListUI();
        
        this.genomeBrowser.showNotification('All checkpoints cleared', 'success');
    }
    
    /**
     * Show clear all confirmation modal
     */
    async showClearAllConfirmModal() {
        return new Promise((resolve) => {
            this.showConfirmModal(
                'Clear All Checkpoints',
                `Are you sure you want to delete ALL checkpoints?\n\nThis will permanently remove ${this.checkpoints.length} checkpoint(s).\n\nThis action cannot be undone.`,
                resolve
            );
        });
    }
    
    /**
     * Get checkpoint statistics
     */
    getCheckpointStats() {
        const stats = {
            total: this.checkpoints.length,
            manual: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.MANUAL).length,
            auto: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.AUTO).length,
            beforeAction: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.BEFORE_ACTION).length,
            milestone: this.checkpoints.filter(cp => cp.type === this.CHECKPOINT_TYPES.MILESTONE).length,
            totalSize: this.checkpoints.reduce((sum, cp) => sum + (cp.size || 0), 0),
            oldestDate: this.checkpoints.length > 0 ? 
                Math.min(...this.checkpoints.map(cp => new Date(cp.timestamp).getTime())) : null,
            newestDate: this.checkpoints.length > 0 ? 
                Math.max(...this.checkpoints.map(cp => new Date(cp.timestamp).getTime())) : null
        };
        
        return stats;
    }
    
    /**
     * Cleanup resources
     */
    destroy() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
        
        console.log('🧹 CheckpointManager destroyed');
    }
} 