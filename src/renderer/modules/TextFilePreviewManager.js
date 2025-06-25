/**
 * TextFilePreviewManager - 处理文本文件预览和编辑功能
 * 支持头部/尾部预览、全文预览、简单编辑和文件管理
 */
class TextFilePreviewManager {
    constructor() {
        this.currentFile = null;
        this.originalContent = '';
        this.isEditing = false;
        this.hasUnsavedChanges = false;
        this.previewMode = 'full';
        this.encoding = 'utf-8';
        this.showLineNumbers = true;
        
        // 支持的文本文件类型
        this.textFileExtensions = [
            '.txt', '.log', '.md', '.csv', '.tsv', '.json', '.xml', '.html', '.css', '.js',
            '.py', '.r', '.sh', '.bat', '.sql', '.yaml', '.yml', '.ini', '.cfg', '.conf',
            '.fasta', '.fa', '.fas', '.fna', '.ffn', '.faa', '.frn',
            '.gff', '.gff3', '.gtf', '.bed', '.vcf', '.sam', '.psl', '.blast',
            '.newick', '.nwk', '.tree', '.phy', '.phylip', '.nexus', '.nex'
        ];
        
        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 预览模式切换
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('preview-mode-btn')) {
                this.switchPreviewMode(e.target.dataset.mode);
            }
        });

        // 预览选项变化
        const previewModeSelect = document.getElementById('previewMode');
        if (previewModeSelect) {
            previewModeSelect.addEventListener('change', () => {
                this.updatePreviewOptions();
                this.refreshPreview();
            });
        }

        const rangeInputs = document.querySelectorAll('#startLine, #endLine');
        rangeInputs.forEach(input => {
            input.addEventListener('change', () => this.refreshPreview());
        });

        const showLineNumbers = document.getElementById('showLineNumbers');
        if (showLineNumbers) {
            showLineNumbers.addEventListener('change', (e) => {
                this.showLineNumbers = e.target.checked;
                this.updateLineNumbers();
            });
        }

        const fileEncoding = document.getElementById('fileEncoding');
        if (fileEncoding) {
            fileEncoding.addEventListener('change', (e) => {
                this.encoding = e.target.value;
                this.refreshPreview();
            });
        }

        // 编辑器功能
        const fileTextarea = document.getElementById('fileTextarea');
        if (fileTextarea) {
            fileTextarea.addEventListener('input', () => {
                this.markAsChanged();
                this.updateCursorPosition();
            });

            fileTextarea.addEventListener('keydown', (e) => {
                this.handleEditorKeydown(e);
            });

            fileTextarea.addEventListener('click', () => {
                this.updateCursorPosition();
            });

            fileTextarea.addEventListener('keyup', () => {
                this.updateCursorPosition();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (this.isPreviewPanelOpen()) {
                this.handleKeyboardShortcuts(e);
            }
        });
    }

    /**
     * 检查文件是否为文本文件
     */
    isTextFile(fileName) {
        const ext = '.' + fileName.toLowerCase().split('.').pop();
        return this.textFileExtensions.includes(ext);
    }

    /**
     * 预览文件
     */
    async previewFile(file) {
        if (!this.isTextFile(file.name)) {
            this.showNotification('This file type is not supported for text preview', 'warning');
            return;
        }

        this.currentFile = file;
        this.isEditing = false;
        this.hasUnsavedChanges = false;

        try {
            // 显示预览面板
            this.showPreviewPanel();
            
            // 更新标题
            document.getElementById('previewFileName').textContent = file.name;
            
            // 加载文件内容
            await this.loadFileContent();
            
            // 切换到预览模式
            this.switchPreviewMode('preview');
            
        } catch (error) {
            console.error('Error previewing file:', error);
            this.showNotification(`Failed to preview file: ${error.message}`, 'error');
        }
    }

    /**
     * 编辑文件
     */
    async editFile(file) {
        if (!this.isTextFile(file.name)) {
            this.showNotification('This file type is not supported for editing', 'warning');
            return;
        }

        this.currentFile = file;
        this.isEditing = true;
        this.hasUnsavedChanges = false;

        try {
            // 显示预览面板
            this.showPreviewPanel();
            
            // 更新标题
            document.getElementById('previewFileName').textContent = file.name;
            
            // 加载文件内容
            await this.loadFileContent();
            
            // 切换到编辑模式
            this.switchPreviewMode('edit');
            
        } catch (error) {
            console.error('Error editing file:', error);
            this.showNotification(`Failed to edit file: ${error.message}`, 'error');
        }
    }

    /**
     * 加载文件内容
     */
    async loadFileContent() {
        if (!this.currentFile) return;

        try {
            // 显示加载状态
            this.updateEditorStatus('Loading...');

            let content = '';
            if (window.electronAPI && window.electronAPI.readTextFile) {
                const result = await window.electronAPI.readTextFile(this.currentFile.path, this.encoding);
                if (result.success) {
                    content = result.content;
                } else {
                    throw new Error(result.error);
                }
            } else {
                // 浏览器环境或文件API不可用时的备用方案
                content = 'Preview not available in browser environment';
            }

            this.originalContent = content;
            this.refreshPreview();
            this.updateEditorStatus('Ready');

        } catch (error) {
            console.error('Error loading file content:', error);
            this.updateEditorStatus('Error loading file');
            this.showNotification(`Failed to load file: ${error.message}`, 'error');
        }
    }

    /**
     * 切换预览模式
     */
    switchPreviewMode(mode) {
        const previewDiv = document.getElementById('textPreview');
        const editorDiv = document.getElementById('textEditor');
        const buttons = document.querySelectorAll('.preview-mode-btn');

        // 更新按钮状态
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'preview') {
            previewDiv.style.display = 'block';
            editorDiv.style.display = 'none';
            this.refreshPreview();
        } else if (mode === 'edit') {
            previewDiv.style.display = 'none';
            editorDiv.style.display = 'flex';
            this.loadContentToEditor();
        }
    }

    /**
     * 更新预览选项
     */
    updatePreviewOptions() {
        const previewMode = document.getElementById('previewMode').value;
        const rangeOption = document.getElementById('rangeOption');
        
        this.previewMode = previewMode;
        
        if (previewMode === 'range') {
            rangeOption.style.display = 'block';
        } else {
            rangeOption.style.display = 'none';
        }
    }

    /**
     * 刷新预览内容
     */
    refreshPreview() {
        if (!this.originalContent) return;

        const previewDiv = document.getElementById('textPreview');
        let displayContent = '';
        let lines = this.originalContent.split('\n');

        switch (this.previewMode) {
            case 'head':
                lines = lines.slice(0, 100);
                displayContent = lines.join('\n');
                break;
            case 'tail':
                lines = lines.slice(-100);
                displayContent = lines.join('\n');
                break;
            case 'range':
                const startLine = parseInt(document.getElementById('startLine').value) || 1;
                const endLine = parseInt(document.getElementById('endLine').value) || 100;
                lines = lines.slice(Math.max(0, startLine - 1), endLine);
                displayContent = lines.join('\n');
                break;
            default: // full
                displayContent = this.originalContent;
                break;
        }

        // HTML转义
        displayContent = this.escapeHtml(displayContent);
        
        // 应用语法高亮（简单版本）
        displayContent = this.applySyntaxHighlighting(displayContent);

        previewDiv.innerHTML = `<pre><code>${displayContent}</code></pre>`;
        
        // 更新行号
        this.updateLineNumbers();
    }

    /**
     * 加载内容到编辑器
     */
    loadContentToEditor() {
        const textarea = document.getElementById('fileTextarea');
        if (textarea) {
            textarea.value = this.originalContent;
            this.updateCursorPosition();
        }
    }

    /**
     * 更新行号显示
     */
    updateLineNumbers() {
        const previewDiv = document.getElementById('textPreview');
        const existingLineNumbers = previewDiv.querySelector('.line-numbers');
        
        if (existingLineNumbers) {
            existingLineNumbers.remove();
        }

        if (!this.showLineNumbers) {
            previewDiv.classList.remove('with-line-numbers');
            return;
        }

        previewDiv.classList.add('with-line-numbers');
        
        const pre = previewDiv.querySelector('pre');
        if (!pre) return;

        const content = pre.textContent;
        const lines = content.split('\n');
        const lineNumbers = lines.map((_, index) => index + 1).join('\n');

        const lineNumbersDiv = document.createElement('div');
        lineNumbersDiv.className = 'line-numbers';
        lineNumbersDiv.textContent = lineNumbers;

        previewDiv.appendChild(lineNumbersDiv);
    }

    /**
     * 标记文件已修改
     */
    markAsChanged() {
        this.hasUnsavedChanges = true;
        this.updateEditorStatus('Modified');
    }

    /**
     * 更新光标位置显示
     */
    updateCursorPosition() {
        const textarea = document.getElementById('fileTextarea');
        const cursorPositionSpan = document.getElementById('cursorPosition');
        
        if (textarea && cursorPositionSpan) {
            const lines = textarea.value.substring(0, textarea.selectionStart).split('\n');
            const line = lines.length;
            const column = lines[lines.length - 1].length + 1;
            cursorPositionSpan.textContent = `Line ${line}, Column ${column}`;
        }
    }

    /**
     * 更新编辑器状态
     */
    updateEditorStatus(status) {
        const statusSpan = document.getElementById('editorStatus');
        if (statusSpan) {
            statusSpan.textContent = status;
        }
    }

    /**
     * 保存文件更改
     */
    async saveFileChanges() {
        if (!this.currentFile || !this.hasUnsavedChanges) return;

        const textarea = document.getElementById('fileTextarea');
        if (!textarea) return;

        try {
            this.updateEditorStatus('Saving...');

            const newContent = textarea.value;
            
            if (window.electronAPI && window.electronAPI.writeTextFile) {
                const result = await window.electronAPI.writeTextFile(
                    this.currentFile.path, 
                    newContent, 
                    this.encoding
                );
                
                if (result.success) {
                    this.originalContent = newContent;
                    this.hasUnsavedChanges = false;
                    this.updateEditorStatus('Saved');
                    this.showNotification('File saved successfully', 'success');
                    
                    // 通知项目管理器更新文件信息
                    if (window.projectManagerWindow) {
                        window.projectManagerWindow.refreshFileInfo(this.currentFile.id);
                    }
                } else {
                    throw new Error(result.error);
                }
            } else {
                throw new Error('File writing not available in browser environment');
            }

        } catch (error) {
            console.error('Error saving file:', error);
            this.updateEditorStatus('Save failed');
            this.showNotification(`Failed to save file: ${error.message}`, 'error');
        }
    }

    /**
     * 撤销文件更改
     */
    revertFileChanges() {
        if (!this.hasUnsavedChanges) return;

        const textarea = document.getElementById('fileTextarea');
        if (textarea) {
            textarea.value = this.originalContent;
            this.hasUnsavedChanges = false;
            this.updateEditorStatus('Reverted');
            this.updateCursorPosition();
        }
    }

    /**
     * 处理编辑器键盘事件
     */
    handleEditorKeydown(e) {
        // Tab键处理
        if (e.key === 'Tab') {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            // 插入tab或空格
            const tabChar = '    '; // 4个空格
            textarea.value = textarea.value.substring(0, start) + tabChar + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + tabChar.length;
            
            this.markAsChanged();
        }
    }

    /**
     * 处理键盘快捷键
     */
    handleKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 's':
                    e.preventDefault();
                    this.saveFileChanges();
                    break;
                case 'z':
                    if (!e.shiftKey) {
                        e.preventDefault();
                        // 简单的撤销功能
                        this.revertFileChanges();
                    }
                    break;
                case 'f':
                    e.preventDefault();
                    // 搜索功能 (待实现)
                    break;
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.closePreviewPanel();
        }
    }

    /**
     * 显示预览面板
     */
    showPreviewPanel() {
        const panel = document.getElementById('filePreviewPanel');
        if (panel) {
            panel.style.display = 'flex';
        }
    }

    /**
     * 关闭预览面板
     */
    closePreviewPanel() {
        if (this.hasUnsavedChanges) {
            const confirmClose = confirm('You have unsaved changes. Are you sure you want to close?');
            if (!confirmClose) return;
        }

        const panel = document.getElementById('filePreviewPanel');
        if (panel) {
            panel.style.display = 'none';
        }

        this.currentFile = null;
        this.originalContent = '';
        this.isEditing = false;
        this.hasUnsavedChanges = false;
    }

    /**
     * 检查预览面板是否打开
     */
    isPreviewPanelOpen() {
        const panel = document.getElementById('filePreviewPanel');
        return panel && panel.style.display === 'flex';
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 应用简单的语法高亮
     */
    applySyntaxHighlighting(content) {
        if (!this.currentFile) return content;

        const ext = '.' + this.currentFile.name.toLowerCase().split('.').pop();
        
        // 简单的语法高亮规则
        switch (ext) {
            case '.json':
                return this.highlightJson(content);
            case '.fasta':
            case '.fa':
            case '.fas':
                return this.highlightFasta(content);
            case '.gff':
            case '.gff3':
            case '.gtf':
                return this.highlightGff(content);
            default:
                return content;
        }
    }

    /**
     * JSON语法高亮
     */
    highlightJson(content) {
        return content
            .replace(/("[\w\s]*")\s*:/g, '<span style="color: #d73a49;">$1</span>:')
            .replace(/:\s*(".*?")/g, ': <span style="color: #032f62;">$1</span>')
            .replace(/:\s*(\d+)/g, ': <span style="color: #005cc5;">$1</span>');
    }

    /**
     * FASTA序列高亮
     */
    highlightFasta(content) {
        return content
            .replace(/^>.*$/gm, '<span style="color: #d73a49; font-weight: bold;">$&</span>')
            .replace(/[ATCGN]/g, '<span style="color: #005cc5;">$&</span>');
    }

    /**
     * GFF格式高亮
     */
    highlightGff(content) {
        return content
            .replace(/^#.*$/gm, '<span style="color: #6a737d; font-style: italic;">$&</span>')
            .replace(/\t(gene|exon|CDS|mRNA)\t/g, '\t<span style="color: #d73a49; font-weight: bold;">$1</span>\t');
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        // 使用项目管理器的通知系统
        if (window.projectManagerWindow && window.projectManagerWindow.showNotification) {
            window.projectManagerWindow.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// 确保在全局范围内可用
if (typeof window !== 'undefined') {
    window.TextFilePreviewManager = TextFilePreviewManager;
} 