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
                this.showToast('文本已复制到剪贴板');
            }
        } else {
            // 如果没有选中文本，复制结果区域的内容
            const resultsContainer = this.findResultsContainer();
            if (resultsContainer) {
                const textContent = resultsContainer.innerText || resultsContainer.textContent;
                if (typeof require !== 'undefined') {
                    const { clipboard } = require('electron');
                    clipboard.writeText(textContent);
                    this.showToast('分析结果已复制到剪贴板');
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
                this.showToast('数据已粘贴到输入框');
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
                this.showToast('文本已剪切到剪贴板');
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
        const searchTerm = prompt('请输入要查找的文本:');
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
                        { name: '文本文件', extensions: ['txt'] },
                        { name: 'CSV文件', extensions: ['csv'] },
                        { name: 'JSON文件', extensions: ['json'] },
                        { name: '所有文件', extensions: ['*'] }
                    ]
                }).then(result => {
                    if (!result.canceled) {
                        fs.writeFileSync(result.filePath, resultsContent);
                        this.showToast('结果已保存');
                    }
                });
            } catch (error) {
                this.showToast('保存失败: ' + error.message);
            }
        } else {
            this.showToast('没有可保存的结果');
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
            this.showToast('数据已导出');
        } else {
            this.showToast('没有可导出的数据');
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
                    this.showToast('文件已加载');
                }
            } catch (error) {
                this.showToast('文件加载失败: ' + error.message);
            }
        }
    }

    // === 分析操作 ===
    loadSample() {
        if (this.toolInstance && this.toolInstance.loadExample) {
            this.toolInstance.loadExample();
        } else {
            this.showToast('该工具不支持示例数据');
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
                this.showToast('找不到分析功能');
            }
        }
    }

    stopAnalysis() {
        if (this.toolInstance && this.toolInstance.stopAnalysis) {
            this.toolInstance.stopAnalysis();
        } else {
            this.showToast('停止分析功能不可用');
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
                    resultsContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">结果已清除</div>';
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
        if (confirm('确定要重置所有参数吗？')) {
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
            this.showToast('参数已重置');
        }
    }

    // === 设置和帮助 ===
    showPreferences() {
        alert(`${this.toolName} 偏好设置\n\n偏好设置功能正在开发中...\n\n您可以通过修改工具参数来自定义分析行为。`);
    }

    showAnalysisSettings() {
        alert(`${this.toolName} 分析设置\n\n分析设置功能正在开发中...\n\n请使用工具界面上的参数控件来调整分析设置。`);
    }

    showOutputFormat() {
        alert(`${this.toolName} 输出格式\n\n支持的输出格式:\n- 文本文件 (.txt)\n- CSV文件 (.csv)\n- JSON文件 (.json)\n\n使用 "保存结果" 或 "导出数据" 来选择格式。`);
    }

    showAdvancedOptions() {
        alert(`${this.toolName} 高级选项\n\n高级选项功能正在开发中...\n\n请使用工具界面上的高级参数控件。`);
    }

    showAbout(toolName) {
        const name = toolName || this.toolName;
        alert(`关于 ${name}\n\n这是Genome AI Studio生物信息学工具套件的一部分。\n\n版本: 0.2.0\n开发者: Genome AI Studio Team\n\n${name}提供专业的生物信息学分析功能，帮助研究人员进行基因组数据分析。`);
    }

    showUserGuide() {
        const helpText = `${this.toolName} 用户指南

基本操作:
1. 输入或导入数据
2. 设置分析参数
3. 运行分析
4. 查看结果
5. 保存或导出数据

快捷键:
- Ctrl/Cmd+N: 新建分析
- Ctrl/Cmd+O: 打开文件
- Ctrl/Cmd+S: 保存结果
- Ctrl/Cmd+E: 导出数据
- Ctrl/Cmd+C: 复制
- Ctrl/Cmd+V: 粘贴
- Ctrl/Cmd+F: 查找
- Ctrl/Cmd+L: 加载示例数据
- Ctrl/Cmd+R: 运行分析
- F1: 显示帮助
- F5: 刷新

需要更多帮助？请查看工具文档或联系技术支持。`;

        alert(helpText);
    }

    showDocumentation() {
        alert(`${this.toolName} 文档\n\n在线文档功能正在开发中...\n\n您可以:\n1. 使用F1键查看快速帮助\n2. 查看工具界面上的提示信息\n3. 联系技术支持获取详细说明`);
    }

    showOnlineResources() {
        if (typeof require !== 'undefined') {
            const { shell } = require('electron');
            shell.openExternal('https://github.com/Scilence2022/GenomeAIStudio');
        } else {
            alert('在线资源:\n\n- GitHub项目页面\n- 用户手册\n- 示例数据\n- 视频教程\n\n请访问项目官网获取更多资源。');
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