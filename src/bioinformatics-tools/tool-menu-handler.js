// 工具窗口菜单事件处理器 - 通用版本
class ToolMenuHandler {
    constructor(toolName, toolInstance = null) {
        this.toolName = toolName;
        this.toolInstance = toolInstance;
        this.setupMenuEventListeners();
        this.setupKeyboardShortcuts();
    }

    setupMenuEventListeners() {
        // 监听主进程发送的菜单事件
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            
            ipcRenderer.on('tool-menu-action', (event, action, data) => {
                this.handleMenuAction(action, data);
            });
        }
    }

    setupKeyboardShortcuts() {
        // 设置快捷键处理
        document.addEventListener('keydown', (event) => {
            // Copy: Ctrl+C / Cmd+C
            if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
                if (!event.target.matches('input, textarea')) {
                    event.preventDefault();
                    this.handleMenuAction('copy');
                }
            }
            
            // Paste: Ctrl+V / Cmd+V
            if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
                if (event.target.matches('input, textarea')) {
                    // 让默认粘贴行为发生
                    return;
                }
                event.preventDefault();
                this.handleMenuAction('paste');
            }
            
            // Cut: Ctrl+X / Cmd+X
            if ((event.ctrlKey || event.metaKey) && event.key === 'x') {
                if (!event.target.matches('input, textarea')) {
                    event.preventDefault();
                    this.handleMenuAction('cut');
                }
            }
            
            // Select All: Ctrl+A / Cmd+A
            if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
                if (!event.target.matches('input, textarea')) {
                    event.preventDefault();
                    this.handleMenuAction('select-all');
                }
            }
            
            // Find: Ctrl+F / Cmd+F
            if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
                event.preventDefault();
                this.handleMenuAction('find');
            }

            // Save: Ctrl+S / Cmd+S
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                this.handleMenuAction('save-results');
            }

            // Load Sample: Ctrl+L / Cmd+L
            if ((event.ctrlKey || event.metaKey) && event.key === 'l') {
                event.preventDefault();
                this.handleMenuAction('load-sample');
            }

            // Run Analysis: Ctrl+R / Cmd+R
            if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
                event.preventDefault();
                this.handleMenuAction('run-analysis');
            }

            // Export: Ctrl+E / Cmd+E
            if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
                event.preventDefault();
                this.handleMenuAction('export-data');
            }

            // New: Ctrl+N / Cmd+N
            if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
                event.preventDefault();
                this.handleMenuAction('new-analysis');
            }

            // Help: F1
            if (event.key === 'F1') {
                event.preventDefault();
                this.handleMenuAction('user-guide');
            }

            // Refresh: F5
            if (event.key === 'F5') {
                event.preventDefault();
                this.handleMenuAction('refresh-data');
            }
        });
    }

    handleMenuAction(action, data) {
        switch (action) {
            case 'copy':
                this.copySelectedText();
                break;
            case 'paste':
                this.pasteFromClipboard();
                break;
            case 'cut':
                this.cutSelectedText();
                break;
            case 'select-all':
                this.selectAllText();
                break;
            case 'find':
                this.showFindDialog();
                break;
            case 'find-next':
                this.findNext();
                break;
            case 'new-analysis':
                this.newAnalysis();
                break;
            case 'save-results':
                this.saveResults();
                break;
            case 'export-data':
                this.exportData();
                break;
            case 'load-sample':
                this.loadSample();
                break;
            case 'run-analysis':
                this.runAnalysis();
                break;
            case 'stop-analysis':
                this.stopAnalysis();
                break;
            case 'clear-results':
                this.clearResults();
                break;
            case 'refresh-data':
                this.refreshData();
                break;
            case 'reset-parameters':
                this.resetParameters();
                break;
            case 'preferences':
                this.showPreferences();
                break;
            case 'analysis-settings':
                this.showAnalysisSettings();
                break;
            case 'output-format':
                this.showOutputFormat();
                break;
            case 'advanced-options':
                this.showAdvancedOptions();
                break;
            case 'about':
                this.showAbout(data);
                break;
            case 'user-guide':
                this.showUserGuide();
                break;
            case 'documentation':
                this.showDocumentation();
                break;
            case 'online-resources':
                this.showOnlineResources();
                break;
            case 'contact-support':
                this.showContactSupport();
                break;
            case 'open-file':
                this.openFile(data);
                break;
            default:
                console.log('未处理的菜单动作:', action);
        }
    }

    // === 基本编辑功能 ===
    copySelectedText() {
        const selection = window.getSelection();
        if (selection.toString()) {
            // 复制选中文本
            if (typeof require !== 'undefined') {
                const { clipboard } = require('electron');
                clipboard.writeText(selection.toString());
                this.showToast('Text copied to clipboard');
            }
        } else {
            // 如果没有选中文本，复制结果区域的内容
            const resultsContainer = this.findResultsContainer();
            if (resultsContainer) {
                const textContent = resultsContainer.innerText || resultsContainer.textContent;
                if (typeof require !== 'undefined') {
                    const { clipboard } = require('electron');
                    clipboard.writeText(textContent);
                    this.showToast('Analysis results copied to clipboard');
                }
            }
        }
    }

    pasteFromClipboard() {
        if (typeof require !== 'undefined') {
            const { clipboard } = require('electron');
            const clipboardText = clipboard.readText();
            
            // 尝试粘贴到主要输入框
            const inputElement = this.findMainInputElement();
            if (inputElement && document.activeElement !== inputElement) {
                inputElement.value = clipboardText;
                inputElement.focus();
                this.showToast('Data pasted to input field');
            }
        }
    }

    cutSelectedText() {
        const selection = window.getSelection();
        if (selection.toString()) {
            if (typeof require !== 'undefined') {
                const { clipboard } = require('electron');
                clipboard.writeText(selection.toString());
                
                // 如果是在可编辑元素中，删除选中的文本
                if (document.activeElement.matches('input, textarea')) {
                    document.execCommand('delete');
                }
                this.showToast('Text cut to clipboard');
            }
        }
    }

    selectAllText() {
        if (document.activeElement.matches('input, textarea')) {
            document.activeElement.select();
        } else {
            // 选择结果区域的所有内容
            const resultsContainer = this.findResultsContainer();
            if (resultsContainer) {
                const range = document.createRange();
                range.selectNodeContents(resultsContainer);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }

    // === 查找功能 ===
    showFindDialog() {
        // 简单的查找对话框
        const searchTerm = prompt('Enter text to search for:');
        if (searchTerm) {
            this.currentSearchTerm = searchTerm;
            this.findTextInPage(searchTerm);
        }
    }

    findTextInPage(searchTerm) {
        if (window.find && window.find(searchTerm)) {
            this.showToast(`找到: "${searchTerm}"`);
        } else {
            this.showToast(`未找到: "${searchTerm}"`);
        }
    }

    findNext() {
        if (this.currentSearchTerm) {
            this.findTextInPage(this.currentSearchTerm);
        } else {
            this.showFindDialog();
        }
    }

    // === 文件操作 ===
    newAnalysis() {
        if (confirm('确定要开始新的分析吗？这将清除当前的输入和结果。')) {
            const inputElement = this.findMainInputElement();
            if (inputElement) {
                inputElement.value = '';
            }
            this.clearResults();
            this.showToast('已准备新的分析');
        }
    }

    saveResults() {
        const resultsContainer = this.findResultsContainer();
        const resultsContent = resultsContainer ? resultsContainer.innerText : '';
        
        if (resultsContent && typeof require !== 'undefined') {
            try {
                const { dialog } = require('electron').remote || require('@electron/remote');
                const fs = require('fs');
                
                dialog.showSaveDialog({
                    filters: [
                        { name: 'Text Files', extensions: ['txt'] },
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'JSON Files', extensions: ['json'] },
                        { name: '所有文件', extensions: ['*'] }
                    ]
                }).then(result => {
                    if (!result.canceled) {
                        fs.writeFileSync(result.filePath, resultsContent);
                        this.showToast('Results saved successfully');
                    }
                });
            } catch (error) {
                this.showToast('Save failed: ' + error.message);
            }
        } else {
            this.showToast('No results to save');
        }
    }

    exportData() {
        // 尝试导出工具实例的数据
        let dataToExport = null;
        
        if (this.toolInstance && this.toolInstance.currentResults) {
            dataToExport = this.toolInstance.currentResults;
        } else if (this.toolInstance && this.toolInstance.currentPathways) {
            dataToExport = this.toolInstance.currentPathways;
        } else if (this.toolInstance && this.toolInstance.results) {
            dataToExport = this.toolInstance.results;
        }

        if (dataToExport) {
            const data = JSON.stringify(dataToExport, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.toolName.toLowerCase().replace(/\s+/g, '-')}-results.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully');
        } else {
            this.showToast('No data to export');
        }
    }

    openFile(filePath) {
        if (filePath && typeof require !== 'undefined') {
            const fs = require('fs');
            try {
                const content = fs.readFileSync(filePath, 'utf8');
                const inputElement = this.findMainInputElement();
                if (inputElement) {
                    inputElement.value = content;
                    this.showToast('File loaded successfully');
                }
            } catch (error) {
                this.showToast('File loading failed: ' + error.message);
            }
        }
    }

    // === 分析操作 ===
    loadSample() {
        if (this.toolInstance && this.toolInstance.loadExample) {
            this.toolInstance.loadExample();
        } else {
            this.showToast('This tool does not support sample data');
        }
    }

    runAnalysis() {
        if (this.toolInstance && this.toolInstance.analyzePathways) {
            this.toolInstance.analyzePathways();
        } else if (this.toolInstance && this.toolInstance.analyze) {
            this.toolInstance.analyze();
        } else if (this.toolInstance && this.toolInstance.search) {
            this.toolInstance.search();
        } else {
            // 尝试点击分析按钮
            const analyzeButton = document.querySelector('#analyzeBtn, .analyze-btn, .search-btn, .run-btn');
            if (analyzeButton) {
                analyzeButton.click();
            } else {
                this.showToast('Analysis function not found');
            }
        }
    }

    stopAnalysis() {
        if (this.toolInstance && this.toolInstance.stopAnalysis) {
            this.toolInstance.stopAnalysis();
        } else {
            this.showToast('Stop analysis function not available');
        }
    }

    clearResults() {
        if (this.toolInstance && this.toolInstance.clearResults) {
            this.toolInstance.clearResults();
        } else {
            // 尝试点击清除按钮
            const clearButton = document.querySelector('#clearBtn, .clear-btn');
            if (clearButton) {
                clearButton.click();
            } else {
                const resultsContainer = this.findResultsContainer();
                if (resultsContainer) {
                    resultsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">Results cleared</div>';
                }
            }
        }
    }

    refreshData() {
        if (this.toolInstance && this.toolInstance.refresh) {
            this.toolInstance.refresh();
        } else {
            window.location.reload();
        }
    }

    resetParameters() {
        if (confirm('Are you sure you want to reset all parameters?')) {
            // 重置所有输入字段到默认值
            const inputs = document.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.type === 'text' || input.type === 'email' || input.type === 'password' || input.tagName === 'TEXTAREA') {
                    input.value = '';
                } else if (input.type === 'checkbox' || input.type === 'radio') {
                    input.checked = input.defaultChecked;
                } else if (input.tagName === 'SELECT') {
                    input.selectedIndex = 0;
                } else if (input.type === 'number' || input.type === 'range') {
                    input.value = input.defaultValue || input.min || 0;
                }
            });
            this.showToast('Parameters reset successfully');
        }
    }

    // === 设置和帮助 ===
    showPreferences() {
        alert(`${this.toolName} Preferences\n\nPreferences functionality is under development...\n\nYou can customize analysis behavior by modifying tool parameters.`);
    }

    showAnalysisSettings() {
        alert(`${this.toolName} Analysis Settings\n\nAnalysis settings functionality is under development...\n\nPlease use the parameter controls on the tool interface to adjust analysis settings.`);
    }

    showOutputFormat() {
        alert(`${this.toolName} Output Format\n\nSupported output formats:\n- Text files (.txt)\n- CSV files (.csv)\n- JSON files (.json)\n\nUse "Save Results" or "Export Data" to select format.`);
    }

    showAdvancedOptions() {
        alert(`${this.toolName} Advanced Options\n\nAdvanced options functionality is under development...\n\nPlease use the advanced parameter controls on the tool interface.`);
    }

    showAbout(toolName) {
        const name = toolName || this.toolName;
        alert(`About ${name}\n\nThis is part of the Genome AI Studio bioinformatics toolkit.\n\nVersion: 0.2.0\nDeveloper: Genome AI Studio Team\n\n${name} provides professional bioinformatics analysis capabilities to help researchers analyze genomic data.`);
    }

    showUserGuide() {
        const helpText = `${this.toolName} User Guide

Basic Operations:
1. Input or import data
2. Set analysis parameters
3. Run analysis
4. View results
5. Save or export data

Keyboard Shortcuts:
- Ctrl/Cmd+N: New analysis
- Ctrl/Cmd+O: Open file
- Ctrl/Cmd+S: Save results
- Ctrl/Cmd+E: Export data
- Ctrl/Cmd+C: Copy
- Ctrl/Cmd+V: Paste
- Ctrl/Cmd+F: Find
- Ctrl/Cmd+L: Load sample data
- Ctrl/Cmd+R: Run analysis
- F1: Show help
- F5: Refresh

Need more help? Please check the tool documentation or contact technical support.`;

        alert(helpText);
    }

    showDocumentation() {
        alert(`${this.toolName} Documentation\n\nOnline documentation functionality is under development...\n\nYou can:\n1. Use F1 key to view quick help\n2. Check tooltip information on the tool interface\n3. Contact technical support for detailed instructions`);
    }

    showOnlineResources() {
        if (typeof require !== 'undefined') {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio');
        } else {
            alert('Online Resources:\n\n- GitHub project page\n- User manual\n- Sample data\n- Video tutorials\n\nPlease visit the project website for more resources.');
        }
    }

    showContactSupport() {
        alert(`联系 ${this.toolName} 技术支持\n\n支持方式:\n- 邮箱: support@genomeaistudio.com\n- GitHub Issues\n- 用户论坛\n\n请描述您遇到的问题，我们将尽快回复。`);
    }

    // === 辅助方法 ===
    findMainInputElement() {
        // 尝试找到主要的输入元素
        const candidates = [
            '#geneInput', '#dataInput', '#sequenceInput', '#queryInput', 
            '.main-input', '.gene-input', '.data-input',
            'textarea[id*="input"]', 'textarea[class*="input"]'
        ];
        
        for (let selector of candidates) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        
        // 如果找不到特定的，返回第一个textarea
        return document.querySelector('textarea');
    }

    findResultsContainer() {
        // 尝试找到结果容器
        const candidates = [
            '#results', '#keggResults', '#goResults', '#uniprotResults',
            '#analysisResults', '#searchResults', '.results-container',
            '.results-content', '.results-panel'
        ];
        
        for (let selector of candidates) {
            const element = document.querySelector(selector);
            if (element) return element;
        }
        
        return null;
    }

    showToast(message) {
        // 创建一个简单的提示消息
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: #333; color: white; padding: 10px 20px; 
            border-radius: 5px; z-index: 10000; font-size: 14px;
            opacity: 0; transition: opacity 0.3s;
            max-width: 300px; word-wrap: break-word;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.opacity = '1', 10);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
}

// 导出类以供其他脚本使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToolMenuHandler;
} else {
    window.ToolMenuHandler = ToolMenuHandler;
} 