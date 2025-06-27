/**
 * PluginSubmissionUI - User interface for plugin submission
 * Provides forms and workflows for submitting plugins to the marketplace
 */
class PluginSubmissionUI {
    constructor(marketplaceConfig, pluginManager) {
        this.marketplaceConfig = marketplaceConfig;
        this.pluginManager = pluginManager;
        this.currentSubmission = null;
        
        console.log('📤 PluginSubmissionUI initialized');
    }

    showSubmissionDialog() {
        const existing = document.querySelector('.plugin-submission-modal');
        if (existing) existing.remove();
        
        const modal = this.createSubmissionModal();
        document.body.appendChild(modal);
        
        return modal;
    }

    createSubmissionModal() {
        const modal = document.createElement('div');
        modal.className = 'plugin-submission-modal';
        modal.innerHTML = `
            <div class="plugin-submission-overlay">
                <div class="plugin-submission-dialog">
                    <div class="plugin-submission-header">
                        <h2>📤 Submit Plugin to Marketplace</h2>
                        <button class="plugin-submission-close">&times;</button>
                    </div>
                    
                    <div class="plugin-submission-content">
                        <form id="plugin-submission-form" class="submission-form">
                            <div class="form-step active" id="step-1">
                                <h3>Plugin Information</h3>
                                
                                <div class="form-group">
                                    <label for="plugin-name">Plugin Name *</label>
                                    <input type="text" id="plugin-name" name="name" required 
                                           placeholder="e.g., Advanced Sequence Analyzer">
                                </div>
                                
                                <div class="form-group">
                                    <label for="plugin-description">Description *</label>
                                    <textarea id="plugin-description" name="description" required rows="4"
                                              placeholder="Describe what your plugin does..."></textarea>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="plugin-version">Version *</label>
                                        <input type="text" id="plugin-version" name="version" required 
                                               placeholder="1.0.0">
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="plugin-author">Author *</label>
                                        <input type="text" id="plugin-author" name="author" required 
                                               placeholder="Your name">
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label for="plugin-category">Category *</label>
                                        <select id="plugin-category" name="category" required>
                                            <option value="">Select a category</option>
                                            <option value="variant-analysis">Variant Analysis</option>
                                            <option value="network-analysis">Network Analysis</option>
                                            <option value="rna-analysis">RNA Analysis</option>
                                            <option value="phylogenetics">Phylogenetics</option>
                                            <option value="sequence-analysis">Sequence Analysis</option>
                                            <option value="protein-analysis">Protein Analysis</option>
                                            <option value="visualization">Visualization</option>
                                            <option value="statistical-analysis">Statistical Analysis</option>
                                        </select>
                                    </div>
                                    
                                    <div class="form-group">
                                        <label for="plugin-type">Type *</label>
                                        <select id="plugin-type" name="type" required>
                                            <option value="">Select a type</option>
                                            <option value="function">Function Plugin</option>
                                            <option value="visualization">Visualization Plugin</option>
                                            <option value="data-source">Data Source Plugin</option>
                                            <option value="utility">Utility Plugin</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label for="plugin-tags">Tags</label>
                                    <input type="text" id="plugin-tags" name="tags" 
                                           placeholder="genomics, analysis, tool (comma-separated)">
                                </div>

                                <div class="form-group">
                                    <label>Plugin Files *</label>
                                    <div class="file-upload-area" id="file-upload-area">
                                        <div class="upload-placeholder">
                                            <div class="upload-icon">📁</div>
                                            <p>Click to select files or drag and drop</p>
                                            <small>Supported: .zip, .tar.gz, .js, .json, .md (Max: 50MB)</small>
                                        </div>
                                        <input type="file" id="plugin-files" name="files" multiple 
                                               accept=".zip,.tar.gz,.js,.json,.md" style="display: none;">
                                    </div>
                                    <div id="uploaded-files-list" class="uploaded-files-list"></div>
                                </div>

                                <div class="form-group">
                                    <label for="submitter-email">Your Email (optional)</label>
                                    <input type="email" id="submitter-email" name="submitterEmail" 
                                           placeholder="your.email@example.com">
                                    <small>For submission status updates</small>
                                </div>
                                
                                <div class="agreement-section">
                                    <label class="checkbox-label">
                                        <input type="checkbox" id="terms-agreement" required>
                                        I agree that my plugin follows the submission guidelines
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>
                    
                    <div class="plugin-submission-footer">
                        <button id="submit-plugin-btn" class="submission-btn success">Submit Plugin</button>
                        <button id="cancel-submission-btn" class="submission-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        this.addSubmissionStyles();
        this.attachSubmissionEventHandlers(modal);
        
        return modal;
    }

    addSubmissionStyles() {
        if (document.getElementById('plugin-submission-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'plugin-submission-styles';
        styles.textContent = `
            .plugin-submission-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 10000; font-family: 'Segoe UI', sans-serif;
            }
            .plugin-submission-overlay {
                background: rgba(0, 0, 0, 0.7); width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
                overflow-y: auto; padding: 20px;
            }
            .plugin-submission-dialog {
                background: white; border-radius: 12px; width: 100%; max-width: 800px;
                max-height: 90vh; display: flex; flex-direction: column;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            }
            .plugin-submission-header {
                padding: 20px; border-bottom: 1px solid #e0e0e0;
                display: flex; justify-content: space-between; align-items: center;
                background: linear-gradient(135deg, #4a90e2, #357abd); color: white;
                border-radius: 12px 12px 0 0;
            }
            .plugin-submission-header h2 { margin: 0; }
            .plugin-submission-close {
                background: none; border: none; color: white; font-size: 24px;
                cursor: pointer; padding: 5px; border-radius: 50%; width: 35px; height: 35px;
            }
            .plugin-submission-close:hover { background: rgba(255,255,255,0.2); }
            .plugin-submission-content { flex: 1; overflow-y: auto; padding: 20px; }
            .submission-form { max-width: 100%; }
            .form-step h3 {
                color: #333; margin-bottom: 20px; border-bottom: 2px solid #4a90e2; padding-bottom: 10px;
            }
            .form-group { margin-bottom: 20px; }
            .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .form-group label { display: block; margin-bottom: 5px; font-weight: 500; color: #333; }
            .form-group input, .form-group select, .form-group textarea {
                width: 100%; padding: 10px 12px; border: 1px solid #ddd; border-radius: 6px;
                font-size: 14px; transition: border-color 0.2s;
            }
            .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
                outline: none; border-color: #4a90e2; box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
            }
            .form-group small { display: block; margin-top: 5px; color: #666; font-size: 12px; }
            .checkbox-label {
                display: flex !important; align-items: center; gap: 8px; font-weight: normal !important;
                margin-bottom: 0 !important;
            }
            .checkbox-label input[type="checkbox"] { width: auto !important; margin: 0; }
            .file-upload-area {
                border: 2px dashed #ddd; border-radius: 8px; padding: 40px 20px; text-align: center;
                cursor: pointer; transition: all 0.2s; background: #f9f9f9;
            }
            .file-upload-area:hover { border-color: #4a90e2; background: #f0f8ff; }
            .file-upload-area.dragover { border-color: #28a745; background: #f0fff4; }
            .upload-placeholder { pointer-events: none; }
            .upload-icon { font-size: 48px; margin-bottom: 10px; }
            .uploaded-files-list { margin-top: 15px; }
            .uploaded-file-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 10px; border: 1px solid #e0e0e0; border-radius: 6px;
                margin-bottom: 8px; background: #f8f9fa;
            }
            .file-info { display: flex; align-items: center; gap: 10px; }
            .file-icon { font-size: 20px; }
            .file-details { display: flex; flex-direction: column; }
            .file-name { font-weight: 500; color: #333; }
            .file-size { font-size: 12px; color: #666; }
            .remove-file-btn {
                background: #dc3545; color: white; border: none; border-radius: 4px;
                padding: 5px 10px; cursor: pointer; font-size: 12px;
            }
            .remove-file-btn:hover { background: #c82333; }
            .agreement-section {
                background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px;
                padding: 15px; margin-top: 20px;
            }
            .plugin-submission-footer {
                padding: 20px; border-top: 1px solid #e0e0e0; display: flex;
                justify-content: flex-end; gap: 10px; background: #f8f9fa;
            }
            .submission-btn {
                padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: white;
                cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s;
            }
            .submission-btn:disabled { opacity: 0.6; cursor: not-allowed; }
            .submission-btn.success { background: #28a745; color: white; border-color: #28a745; }
            .submission-btn:not(:disabled):hover {
                transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }
            .submission-btn.success:hover { background: #218838; }
            @media (max-width: 768px) {
                .form-row { grid-template-columns: 1fr; }
                .plugin-submission-footer { flex-direction: column; gap: 10px; }
            }
        `;
        
        document.head.appendChild(styles);
    }

    attachSubmissionEventHandlers(modal) {
        modal.querySelector('.plugin-submission-close').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
                modal.remove();
            }
        });
        
        modal.querySelector('#cancel-submission-btn').addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? All progress will be lost.')) {
                modal.remove();
            }
        });
        
        this.setupFileUpload(modal);
        
        modal.querySelector('#submit-plugin-btn').addEventListener('click', () => {
            this.submitPlugin(modal);
        });
    }

    setupFileUpload(modal) {
        const fileUploadArea = modal.querySelector('#file-upload-area');
        const fileInput = modal.querySelector('#plugin-files');
        const uploadedFilesList = modal.querySelector('#uploaded-files-list');
        
        let uploadedFiles = [];
        
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.addFiles(files, uploadedFiles, uploadedFilesList);
        });
        
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.addFiles(files, uploadedFiles, uploadedFilesList);
        });
        
        modal.uploadedFiles = uploadedFiles;
    }

    addFiles(files, uploadedFiles, uploadedFilesList) {
        files.forEach(file => {
            if (file.size > 50 * 1024 * 1024) {
                alert(`File "${file.name}" is too large. Maximum size is 50MB.`);
                return;
            }
            
            if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                alert(`File "${file.name}" is already added.`);
                return;
            }
            
            uploadedFiles.push(file);
            this.renderUploadedFiles(uploadedFiles, uploadedFilesList);
        });
    }

    renderUploadedFiles(uploadedFiles, uploadedFilesList) {
        uploadedFilesList.innerHTML = uploadedFiles.map((file, index) => `
            <div class="uploaded-file-item">
                <div class="file-info">
                    <div class="file-icon">${this.getFileIcon(file.name)}</div>
                    <div class="file-details">
                        <div class="file-name">${file.name}</div>
                        <div class="file-size">${this.formatFileSize(file.size)}</div>
                    </div>
                </div>
                <button class="remove-file-btn" onclick="this.parentElement.remove(); window.removeUploadedFile(${index})">
                    Remove
                </button>
            </div>
        `).join('');
        
        window.removeUploadedFile = (index) => {
            uploadedFiles.splice(index, 1);
            this.renderUploadedFiles(uploadedFiles, uploadedFilesList);
        };
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const icons = {
            'zip': '📦', 'gz': '📦', 'js': '📄', 'json': '📋', 'md': '📝', 'txt': '📄'
        };
        return icons[ext] || '📄';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async submitPlugin(modal) {
        try {
            const form = modal.querySelector('#plugin-submission-form');
            const formData = new FormData(form);
            
            // Validation
            const requiredFields = ['name', 'description', 'version', 'author', 'category', 'type'];
            const missing = requiredFields.filter(field => !formData.get(field));
            
            if (missing.length > 0) {
                alert(`Please fill in required fields: ${missing.join(', ')}`);
                return;
            }
            
            const uploadedFiles = modal.uploadedFiles || [];
            if (uploadedFiles.length === 0) {
                alert('Please upload at least one plugin file.');
                return;
            }
            
            const termsCheckbox = modal.querySelector('#terms-agreement');
            if (!termsCheckbox.checked) {
                alert('Please agree to the submission guidelines.');
                return;
            }
            
            const submitBtn = modal.querySelector('#submit-plugin-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
            
            // Parse tags
            const tags = formData.get('tags') ? 
                formData.get('tags').split(',').map(t => t.trim()).filter(t => t) : [];
            
            // Create metadata object
            const metadata = {
                name: formData.get('name'),
                description: formData.get('description'),
                version: formData.get('version'),
                author: formData.get('author'),
                category: formData.get('category'),
                type: formData.get('type'),
                tags: tags,
                keywords: tags
            };
            
            // Get marketplace server URL
            const sources = this.marketplaceConfig.getEnabledSources();
            const marketplaceSource = sources.find(s => s.url.includes('localhost'));
            
            if (!marketplaceSource) {
                throw new Error('No marketplace server available for submission');
            }
            
            // Prepare submission form data
            const submissionData = new FormData();
            submissionData.append('metadata', JSON.stringify(metadata));
            submissionData.append('submitterEmail', formData.get('submitterEmail') || '');
            
            uploadedFiles.forEach(file => {
                submissionData.append('files', file);
            });
            
            // Submit to marketplace server
            const response = await fetch(`${marketplaceSource.url}/plugins/submit`, {
                method: 'POST',
                body: submissionData
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.showSubmissionSuccess(result.data, modal);
            } else {
                throw new Error(result.message || 'Submission failed');
            }
            
        } catch (error) {
            console.error('❌ Plugin submission failed:', error);
            alert('Submission failed: ' + error.message);
            
            const submitBtn = modal.querySelector('#submit-plugin-btn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Plugin';
        }
    }

    showSubmissionSuccess(submissionData, modal) {
        const successModal = document.createElement('div');
        successModal.className = 'plugin-submission-modal';
        successModal.innerHTML = `
            <div class="plugin-submission-overlay">
                <div class="plugin-submission-dialog" style="max-width: 500px;">
                    <div class="plugin-submission-header" style="background: linear-gradient(135deg, #28a745, #20c997);">
                        <h2>✅ Submission Successful!</h2>
                    </div>
                    
                    <div class="plugin-submission-content">
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 48px; margin-bottom: 20px;">🎉</div>
                            <h3>Your plugin has been submitted!</h3>
                            <p>Submission ID: <strong>${submissionData.submissionId}</strong></p>
                            <p>Plugin ID: <strong>${submissionData.pluginId}</strong></p>
                            <p>Status: <strong>Pending Review</strong></p>
                            
                            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: left;">
                                <h4>What's next?</h4>
                                <ul style="margin: 10px 0; padding-left: 20px;">
                                    <li>Your plugin will be reviewed within 24-48 hours</li>
                                    <li>You'll receive email updates if you provided an email</li>
                                    <li>Once approved, it will be available in the marketplace</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <div class="plugin-submission-footer">
                        <button class="submission-btn success" onclick="this.closest('.plugin-submission-modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        modal.remove();
        document.body.appendChild(successModal);
        
        console.log('✅ Plugin submitted successfully:', submissionData);
    }
}

if (typeof window !== 'undefined') {
    window.PluginSubmissionUI = PluginSubmissionUI;
} 