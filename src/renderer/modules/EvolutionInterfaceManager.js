/**
 * EvolutionInterfaceManager - 进化界面管理器
 * 为对话进化系统提供用户界面，包括对话历史查看、缺失功能管理、插件生成等
 */
class EvolutionInterfaceManager {
    constructor(evolutionManager, configManager) {
        this.evolutionManager = evolutionManager;
        this.configManager = configManager;
        
        // UI状态
        this.currentTab = 'conversations';
        this.selectedItems = new Set();
        this.isEvolutionRunning = false;
        
        // 界面元素
        this.modal = null;
        this.contentContainer = null;
        
        console.log('EvolutionInterfaceManager initialized');
    }

    /**
     * 打开进化界面
     */
    openEvolutionInterface() {
        console.log('🧬 EvolutionInterfaceManager: Opening Evolution Interface...');
        
        try {
            // 移除任何现有的模态框
            const existingModal = document.getElementById('evolutionModal');
            if (existingModal) {
                console.log('♻️ Removing existing modal');
                existingModal.remove();
            }
            
            this.createEvolutionModal();
            console.log('✅ Modal created successfully');
            
            this.renderCurrentTab();
            console.log('✅ Tab rendered successfully');
            
            if (this.modal) {
                // 强制显示模态框
                this.modal.style.display = 'block';
                this.modal.style.visibility = 'visible';
                this.modal.style.opacity = '1';
                console.log('✅ Modal displayed with forced styles');
                
                // 强制重绘
                this.modal.offsetHeight;
                
                // 检查模态框是否正确显示
                setTimeout(() => {
                    const modalRect = this.modal.getBoundingClientRect();
                    console.log('📏 Modal dimensions:', modalRect);
                    console.log('📊 Modal computed styles:', {
                        display: getComputedStyle(this.modal).display,
                        visibility: getComputedStyle(this.modal).visibility,
                        opacity: getComputedStyle(this.modal).opacity,
                        zIndex: getComputedStyle(this.modal).zIndex
                    });
                    
                    const content = this.modal.querySelector('.evolution-modal-content');
                    if (content) {
                        const contentRect = content.getBoundingClientRect();
                        console.log('📏 Content dimensions:', contentRect);
                    } else {
                        console.error('❌ Modal content not found');
                    }
                }, 100);
            } else {
                console.error('❌ Modal not created');
            }
            
            // 添加键盘事件监听
            document.addEventListener('keydown', this.handleKeydown.bind(this));
        } catch (error) {
            console.error('❌ Failed to open evolution interface:', error);
            console.error('Error details:', error.stack);
        }
    }

    /**
     * 创建进化界面模态框
     */
    createEvolutionModal() {
        console.log('🏗️ Creating evolution modal...');
        
        if (this.modal) {
            console.log('♻️ Removing existing modal');
            this.modal.remove();
        }

        this.modal = document.createElement('div');
        this.modal.id = 'evolutionModal';
        this.modal.className = 'evolution-modal';
        
        console.log('📦 Modal element created:', this.modal);
        this.modal.innerHTML = `
            <div class="evolution-modal-content">
                <div class="evolution-header">
                    <h2>🧬 对话进化系统</h2>
                    <button class="close-btn" onclick="evolutionInterfaceManager.closeEvolutionInterface()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="evolution-tabs">
                    <button class="tab-btn ${this.currentTab === 'conversations' ? 'active' : ''}" 
                            onclick="evolutionInterfaceManager.switchTab('conversations')">
                        <i class="fas fa-comments"></i> 对话历史
                    </button>
                    <button class="tab-btn ${this.currentTab === 'missing' ? 'active' : ''}" 
                            onclick="evolutionInterfaceManager.switchTab('missing')">
                        <i class="fas fa-exclamation-triangle"></i> 缺失功能
                    </button>
                    <button class="tab-btn ${this.currentTab === 'plugins' ? 'active' : ''}" 
                            onclick="evolutionInterfaceManager.switchTab('plugins')">
                        <i class="fas fa-puzzle-piece"></i> 生成插件
                    </button>
                    <button class="tab-btn ${this.currentTab === 'evolution' ? 'active' : ''}" 
                            onclick="evolutionInterfaceManager.switchTab('evolution')">
                        <i class="fas fa-dna"></i> 进化过程
                    </button>
                    <button class="tab-btn ${this.currentTab === 'reports' ? 'active' : ''}" 
                            onclick="evolutionInterfaceManager.switchTab('reports')">
                        <i class="fas fa-chart-line"></i> 进化报告
                    </button>
                </div>
                
                <div class="evolution-toolbar">
                    <div class="toolbar-left">
                        <button class="btn btn-primary" onclick="evolutionInterfaceManager.startEvolution()" 
                                ${this.isEvolutionRunning ? 'disabled' : ''}>
                            <i class="fas fa-play"></i> 开始进化
                        </button>
                        <button class="btn btn-secondary" onclick="evolutionInterfaceManager.refreshData()">
                            <i class="fas fa-refresh"></i> 刷新数据
                        </button>
                    </div>
                    <div class="toolbar-right">
                        <span class="evolution-stats" id="evolutionStats">
                            载入中...
                        </span>
                    </div>
                </div>
                
                <div class="evolution-content" id="evolutionContent">
                    <!-- 内容将在这里动态加载 -->
                </div>
            </div>
        `;

        console.log('📝 Modal HTML content set');
        
        document.body.appendChild(this.modal);
        console.log('🌐 Modal appended to body');
        
        this.contentContainer = document.getElementById('evolutionContent');
        console.log('📋 Content container:', this.contentContainer);
        
        // 添加样式
        this.addEvolutionStyles();
        console.log('🎨 Styles added');
        
        // 更新统计信息
        this.updateEvolutionStats();
        console.log('📊 Stats updated');
    }

    /**
     * 添加进化界面样式
     */
    addEvolutionStyles() {
        if (document.getElementById('evolutionStyles')) return;

        const styles = document.createElement('style');
        styles.id = 'evolutionStyles';
        styles.textContent = `
            .evolution-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                z-index: 99999;
                display: block;
            }

            .evolution-modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 90%;
                max-width: 1200px;
                height: 85%;
                background: #1e1e1e;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                color: #e0e0e0;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
                min-height: 500px;
                min-width: 700px;
            }

            .evolution-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px 24px;
                border-bottom: 1px solid #333;
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                border-radius: 12px 12px 0 0;
            }

            .evolution-header h2 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                color: #fff;
            }

            .close-btn {
                background: none;
                border: none;
                color: #fff;
                font-size: 24px;
                cursor: pointer;
                padding: 8px;
                border-radius: 6px;
                transition: background-color 0.2s;
            }

            .close-btn:hover {
                background: rgba(255, 255, 255, 0.1);
            }

            .evolution-tabs {
                display: flex;
                background: #2a2a2a;
                border-bottom: 1px solid #333;
                padding: 0 24px;
            }

            .tab-btn {
                background: none;
                border: none;
                color: #888;
                padding: 16px 20px;
                cursor: pointer;
                font-size: 14px;
                border-bottom: 3px solid transparent;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .tab-btn:hover {
                color: #bbb;
                background: rgba(255, 255, 255, 0.05);
            }

            .tab-btn.active {
                color: #4a9eff;
                border-bottom-color: #4a9eff;
                background: rgba(74, 158, 255, 0.1);
            }

            .evolution-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 24px;
                background: #252525;
                border-bottom: 1px solid #333;
            }

            .toolbar-left {
                display: flex;
                gap: 12px;
            }

            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s;
            }

            .btn-primary {
                background: #4a9eff;
                color: white;
            }

            .btn-primary:hover:not(:disabled) {
                background: #357abd;
            }

            .btn-primary:disabled {
                background: #555;
                cursor: not-allowed;
            }

            .btn-secondary {
                background: #666;
                color: white;
            }

            .btn-secondary:hover {
                background: #777;
            }

            .evolution-stats {
                font-size: 13px;
                color: #aaa;
            }

            .evolution-content {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }

            .conversation-list {
                display: grid;
                gap: 16px;
            }

            .conversation-item {
                background: #2a2a2a;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .conversation-item:hover {
                border-color: #4a9eff;
                background: #2f2f2f;
            }

            .conversation-item.selected {
                border-color: #4a9eff;
                background: rgba(74, 158, 255, 0.1);
            }

            .conversation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .conversation-id {
                font-size: 12px;
                color: #888;
                font-family: monospace;
            }

            .conversation-stats {
                display: flex;
                gap: 16px;
                font-size: 13px;
                color: #aaa;
            }

            .missing-function-item {
                background: #2a2a2a;
                border: 1px solid #333;
                border-left: 4px solid #ff6b6b;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }

            .missing-function-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .priority-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
            }

            .priority-high {
                background: #ff4757;
                color: white;
            }

            .priority-medium {
                background: #ffa502;
                color: white;
            }

            .priority-low {
                background: #2ed573;
                color: white;
            }

            .plugin-item {
                background: #2a2a2a;
                border: 1px solid #333;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
            }

            .plugin-status {
                display: inline-block;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 600;
                margin-left: 8px;
            }

            .status-generated {
                background: #3742fa;
                color: white;
            }

            .status-tested {
                background: #2ed573;
                color: white;
            }

            .status-failed {
                background: #ff4757;
                color: white;
            }

            .evolution-process {
                background: #2a2a2a;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 16px;
            }

            .progress-bar {
                width: 100%;
                height: 8px;
                background: #333;
                border-radius: 4px;
                overflow: hidden;
                margin: 12px 0;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #4a9eff, #0984e3);
                transition: width 0.3s ease;
            }

            .report-section {
                background: #2a2a2a;
                border-radius: 8px;
                padding: 20px;
                margin-bottom: 16px;
            }

            .report-section h3 {
                margin: 0 0 16px 0;
                color: #4a9eff;
                font-size: 18px;
            }

            .metrics-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 20px;
            }

            .metric-item {
                background: #333;
                padding: 16px;
                border-radius: 6px;
                text-align: center;
            }

            .metric-value {
                font-size: 24px;
                font-weight: 600;
                color: #4a9eff;
                margin-bottom: 4px;
            }

            .metric-label {
                font-size: 12px;
                color: #aaa;
                text-transform: uppercase;
            }

            .empty-state {
                text-align: center;
                padding: 60px 20px;
                color: #666;
            }

            .empty-state i {
                font-size: 48px;
                margin-bottom: 16px;
                color: #444;
            }

            .selection-toolbar {
                background: #333;
                padding: 12px 16px;
                border-radius: 6px;
                margin-bottom: 16px;
                display: none;
                align-items: center;
                gap: 12px;
            }

            .selection-toolbar.visible {
                display: flex;
            }

            .evolution-log {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 6px;
                padding: 16px;
                font-family: monospace;
                font-size: 13px;
                max-height: 300px;
                overflow-y: auto;
                white-space: pre-wrap;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * 切换标签页
     */
    switchTab(tabName) {
        this.currentTab = tabName;
        
        // 更新标签页样式
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[onclick*="'${tabName}'"]`).classList.add('active');
        
        // 渲染内容
        this.renderCurrentTab();
    }

    /**
     * 渲染当前标签页内容
     */
    renderCurrentTab() {
        switch (this.currentTab) {
            case 'conversations':
                this.renderConversationsTab();
                break;
            case 'missing':
                this.renderMissingFunctionsTab();
                break;
            case 'plugins':
                this.renderPluginsTab();
                break;
            case 'evolution':
                this.renderEvolutionTab();
                break;
            case 'reports':
                this.renderReportsTab();
                break;
        }
    }

    /**
     * 渲染对话历史标签页
     */
    renderConversationsTab() {
        const conversations = this.evolutionManager.evolutionData.conversations;
        
        if (conversations.length === 0) {
            this.contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comments"></i>
                    <h3>暂无对话记录</h3>
                    <p>开始使用ChatBox与系统对话后，对话记录将在这里显示</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="selection-toolbar" id="selectionToolbar">
                <span id="selectionCount">已选择 0 个对话</span>
                <button class="btn btn-secondary" onclick="evolutionInterfaceManager.analyzeSelectedConversations()">
                    <i class="fas fa-search"></i> 分析选中对话
                </button>
                <button class="btn btn-secondary" onclick="evolutionInterfaceManager.exportSelectedConversations()">
                    <i class="fas fa-download"></i> 导出选中对话
                </button>
            </div>
            <div class="conversation-list">
        `;

        // 按时间倒序排列
        const sortedConversations = [...conversations].sort((a, b) => 
            new Date(b.startTime) - new Date(a.startTime)
        );

        for (const conv of sortedConversations) {
            const duration = this.evolutionManager.calculateDuration(conv.startTime, conv.endTime);
            const successRate = conv.stats.successCount / Math.max(conv.stats.messageCount, 1);
            
            html += `
                <div class="conversation-item" data-id="${conv.id}" onclick="evolutionInterfaceManager.toggleConversationSelection('${conv.id}')">
                    <div class="conversation-header">
                        <span class="conversation-id">${conv.id}</span>
                        <span class="conversation-status ${conv.completed ? 'completed' : 'active'}">
                            ${conv.completed ? '已完成' : '进行中'}
                        </span>
                    </div>
                    <div class="conversation-stats">
                        <span><i class="fas fa-clock"></i> ${duration || '进行中'}</span>
                        <span><i class="fas fa-comments"></i> ${conv.stats.messageCount} 消息</span>
                        <span><i class="fas fa-exclamation-triangle"></i> ${conv.stats.errorCount} 错误</span>
                        <span><i class="fas fa-chart-line"></i> ${(successRate * 100).toFixed(1)}% 成功率</span>
                    </div>
                    <div class="conversation-summary">
                        ${conv.analysis?.conversationSummary || '尚未分析'}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        this.contentContainer.innerHTML = html;
    }

    /**
     * 渲染缺失功能标签页
     */
    renderMissingFunctionsTab() {
        const missingFunctions = this.evolutionManager.evolutionData.missingFunctions;
        
        if (missingFunctions.length === 0) {
            this.contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>暂无缺失功能</h3>
                    <p>系统尚未检测到缺失的功能需求</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="selection-toolbar" id="selectionToolbar">
                <span id="selectionCount">已选择 0 个功能</span>
                <button class="btn btn-primary" onclick="evolutionInterfaceManager.generatePluginsForSelected()">
                    <i class="fas fa-magic"></i> 为选中功能生成插件
                </button>
                <button class="btn btn-secondary" onclick="evolutionInterfaceManager.markAsResolved()">
                    <i class="fas fa-check"></i> 标记为已解决
                </button>
            </div>
        `;

        // 按优先级和出现次数排序
        const sortedFunctions = [...missingFunctions].sort((a, b) => 
            (b.priority + b.occurrences) - (a.priority + a.occurrences)
        );

        for (const func of sortedFunctions) {
            const priorityClass = func.priority >= 8 ? 'high' : func.priority >= 6 ? 'medium' : 'low';
            const priorityText = func.priority >= 8 ? '高' : func.priority >= 6 ? '中' : '低';
            
            html += `
                <div class="missing-function-item" data-id="${func.id}" onclick="evolutionInterfaceManager.toggleFunctionSelection('${func.id}')">
                    <div class="missing-function-header">
                        <div>
                            <span class="priority-badge priority-${priorityClass}">${priorityText}优先级</span>
                            <span class="occurrences">出现 ${func.occurrences} 次</span>
                        </div>
                        <span class="last-occurrence">${new Date(func.lastOccurrence).toLocaleDateString()}</span>
                    </div>
                    <h4>${func.description}</h4>
                    <p><strong>用户意图:</strong> ${func.userIntent}</p>
                    <details>
                        <summary>建议实现方案</summary>
                        <pre class="implementation-suggestion">${func.suggestedImplementation}</pre>
                    </details>
                </div>
            `;
        }

        this.contentContainer.innerHTML = html;
    }

    /**
     * 渲染插件标签页
     */
    renderPluginsTab() {
        const plugins = this.evolutionManager.evolutionData.generatedPlugins;
        
        if (plugins.length === 0) {
            this.contentContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-puzzle-piece"></i>
                    <h3>暂无生成的插件</h3>
                    <p>系统尚未自动生成任何插件</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="selection-toolbar" id="selectionToolbar">
                <span id="selectionCount">已选择 0 个插件</span>
                <button class="btn btn-primary" onclick="evolutionInterfaceManager.installSelectedPlugins()">
                    <i class="fas fa-download"></i> 安装选中插件
                </button>
                <button class="btn btn-secondary" onclick="evolutionInterfaceManager.testSelectedPlugins()">
                    <i class="fas fa-vial"></i> 测试选中插件
                </button>
                <button class="btn btn-secondary" onclick="evolutionInterfaceManager.exportSelectedPlugins()">
                    <i class="fas fa-code"></i> 导出代码
                </button>
            </div>
        `;

        // 按生成时间倒序排列
        const sortedPlugins = [...plugins].sort((a, b) => 
            new Date(b.generatedAt) - new Date(a.generatedAt)
        );

        for (const plugin of sortedPlugins) {
            const statusClass = plugin.status === 'tested' ? 'tested' : 
                               plugin.status === 'failed' ? 'failed' : 'generated';
            const statusText = plugin.status === 'tested' ? '已测试' : 
                              plugin.status === 'failed' ? '测试失败' : '已生成';
            
            html += `
                <div class="plugin-item" data-id="${plugin.id}" onclick="evolutionInterfaceManager.togglePluginSelection('${plugin.id}')">
                    <div class="plugin-header">
                        <h4>${plugin.name}</h4>
                        <span class="plugin-status status-${statusClass}">${statusText}</span>
                    </div>
                    <p>${plugin.description}</p>
                    <div class="plugin-meta">
                        <span><i class="fas fa-clock"></i> ${new Date(plugin.generatedAt).toLocaleString()}</span>
                        <span><i class="fas fa-cog"></i> ${plugin.specification.functions.length} 个函数</span>
                        ${plugin.testResults ? `<span><i class="fas fa-vial"></i> ${plugin.testResults.tests.length} 个测试</span>` : ''}
                    </div>
                    <details>
                        <summary>查看规格说明</summary>
                        <pre>${JSON.stringify(plugin.specification, null, 2)}</pre>
                    </details>
                    ${plugin.testResults ? `
                        <details>
                            <summary>测试结果 ${plugin.testResults.success ? '✅' : '❌'}</summary>
                            <pre>${JSON.stringify(plugin.testResults, null, 2)}</pre>
                        </details>
                    ` : ''}
                </div>
            `;
        }

        this.contentContainer.innerHTML = html;
    }

    /**
     * 渲染进化过程标签页
     */
    renderEvolutionTab() {
        const history = this.evolutionManager.evolutionData.evolutionHistory;
        
        let html = `
            <div class="evolution-process">
                <h3>
                    <i class="fas fa-dna"></i> 进化控制面板
                </h3>
                <p>通过AI分析对话历史和缺失功能，自动生成所需的插件来改进系统能力。</p>
                
                <div class="evolution-controls">
                    <button class="btn btn-primary" onclick="evolutionInterfaceManager.startEvolution()" 
                            ${this.isEvolutionRunning ? 'disabled' : ''}>
                        <i class="fas fa-play"></i> 开始自动进化
                    </button>
                    <button class="btn btn-secondary" onclick="evolutionInterfaceManager.generateEvolutionReport()">
                        <i class="fas fa-chart-line"></i> 生成进化报告
                    </button>
                </div>
                
                ${this.isEvolutionRunning ? `
                    <div class="progress-container">
                        <h4>进化进度</h4>
                        <div class="progress-bar">
                            <div class="progress-fill" id="evolutionProgress" style="width: 0%"></div>
                        </div>
                        <div class="evolution-log" id="evolutionLog">
                            正在初始化进化过程...
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        if (history.length > 0) {
            html += `
                <div class="evolution-history">
                    <h3><i class="fas fa-history"></i> 进化历史</h3>
            `;

            for (const record of history.reverse()) {
                html += `
                    <div class="evolution-record">
                        <div class="record-header">
                            <span class="record-time">${new Date(record.timestamp).toLocaleString()}</span>
                            <span class="record-stats">
                                处理 ${record.processedFunctions} 个功能，生成 ${record.generatedPlugins} 个插件
                            </span>
                        </div>
                        <details>
                            <summary>查看详细结果</summary>
                            <pre>${JSON.stringify(record, null, 2)}</pre>
                        </details>
                    </div>
                `;
            }

            html += '</div>';
        }

        this.contentContainer.innerHTML = html;
    }

    /**
     * 渲染报告标签页
     */
    renderReportsTab() {
        const report = this.evolutionManager.generateEvolutionReport();
        
        let html = `
            <div class="report-section">
                <h3><i class="fas fa-chart-line"></i> 进化统计报告</h3>
                
                <div class="metrics-grid">
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.totalConversations}</div>
                        <div class="metric-label">总对话数</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.completedConversations}</div>
                        <div class="metric-label">完成对话</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.missingFunctions}</div>
                        <div class="metric-label">缺失功能</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.generatedPlugins}</div>
                        <div class="metric-label">生成插件</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.successfulPlugins}</div>
                        <div class="metric-label">成功插件</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${report.summary.lastEvolutionDate ? new Date(report.summary.lastEvolutionDate).toLocaleDateString() : '未进化'}</div>
                        <div class="metric-label">上次进化</div>
                    </div>
                </div>
            </div>
            
            <div class="report-section">
                <h3><i class="fas fa-exclamation-triangle"></i> 高优先级缺失功能</h3>
                ${report.topMissingFunctions.length > 0 ? `
                    <div class="missing-functions-list">
                        ${report.topMissingFunctions.slice(0, 5).map(func => `
                            <div class="function-summary">
                                <strong>${func.description}</strong>
                                <span class="priority-info">优先级: ${func.priority}, 出现次数: ${func.occurrences}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>当前没有高优先级的缺失功能</p>'}
            </div>
            
            <div class="report-section">
                <h3><i class="fas fa-puzzle-piece"></i> 生成插件状态</h3>
                ${report.generatedPlugins.length > 0 ? `
                    <div class="plugins-list">
                        ${report.generatedPlugins.map(plugin => `
                            <div class="plugin-summary">
                                <strong>${plugin.name}</strong>
                                <span class="plugin-status status-${plugin.status}">${plugin.status === 'tested' ? '已测试' : plugin.status === 'failed' ? '测试失败' : '已生成'}</span>
                                <span class="generation-time">${new Date(plugin.generatedAt).toLocaleDateString()}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>尚未生成任何插件</p>'}
            </div>
            
            <div class="report-section">
                <h3><i class="fas fa-comments"></i> 最近对话情况</h3>
                ${report.recentConversations.length > 0 ? `
                    <div class="conversations-summary">
                        ${report.recentConversations.map(conv => `
                            <div class="conversation-summary">
                                <span class="conv-id">${conv.id.substring(0, 8)}...</span>
                                <span class="conv-duration">${conv.duration}</span>
                                <span class="conv-messages">${conv.messageCount} 消息</span>
                                <span class="conv-success">${(conv.successRate * 100).toFixed(1)}% 成功率</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>暂无对话记录</p>'}
            </div>
        `;

        this.contentContainer.innerHTML = html;
    }

    /**
     * 开始进化过程
     */
    async startEvolution() {
        if (this.isEvolutionRunning) return;

        this.isEvolutionRunning = true;
        this.updateToolbarState();

        try {
            // 如果当前在进化标签页，显示进度
            if (this.currentTab === 'evolution') {
                this.renderEvolutionTab();
                this.updateEvolutionProgress(0, '开始分析缺失功能...');
            }

            // 执行进化过程
            const result = await this.evolutionManager.startEvolutionProcess();

            // 显示结果
            this.showEvolutionResult(result);

        } catch (error) {
            console.error('Evolution process failed:', error);
            this.showError('进化过程失败: ' + error.message);
        } finally {
            this.isEvolutionRunning = false;
            this.updateToolbarState();
            this.updateEvolutionStats();
        }
    }

    /**
     * 更新进化进度
     */
    updateEvolutionProgress(percentage, message) {
        const progressBar = document.getElementById('evolutionProgress');
        const logElement = document.getElementById('evolutionLog');

        if (progressBar) {
            progressBar.style.width = percentage + '%';
        }

        if (logElement) {
            logElement.textContent += '\n' + new Date().toLocaleTimeString() + ': ' + message;
            logElement.scrollTop = logElement.scrollHeight;
        }
    }

    /**
     * 显示进化结果
     */
    showEvolutionResult(result) {
        const message = `
进化完成！
• 处理了 ${result.processedFunctions} 个缺失功能
• 生成了 ${result.generatedPlugins} 个新插件
• 成功率: ${result.results.filter(r => r.success).length}/${result.results.length}
        `;

        alert(message);
        
        // 刷新当前标签页
        this.renderCurrentTab();
    }

    /**
     * 显示错误信息
     */
    showError(message) {
        alert('错误: ' + message);
    }

    /**
     * 更新工具栏状态
     */
    updateToolbarState() {
        const startBtn = document.querySelector('[onclick*="startEvolution"]');
        if (startBtn) {
            startBtn.disabled = this.isEvolutionRunning;
            startBtn.innerHTML = this.isEvolutionRunning ? 
                '<i class="fas fa-spinner fa-spin"></i> 进化中...' : 
                '<i class="fas fa-play"></i> 开始进化';
        }
    }

    /**
     * 更新进化统计信息
     */
    updateEvolutionStats() {
        console.log('📊 Updating evolution stats...');
        const statsElement = document.getElementById('evolutionStats');
        console.log('📊 Stats element:', statsElement);
        
        if (statsElement) {
            if (this.evolutionManager) {
                try {
                    const stats = this.evolutionManager.getEvolutionStats();
                    console.log('📊 Stats data:', stats);
                    statsElement.textContent = `对话: ${stats.completedConversations}/${stats.totalConversations} | 缺失功能: ${stats.missingFunctions} | 生成插件: ${stats.successfulPlugins}/${stats.generatedPlugins}`;
                } catch (error) {
                    console.error('❌ Failed to get stats:', error);
                    statsElement.textContent = '统计信息加载失败';
                }
            } else {
                console.log('⚠️ Evolution manager not available');
                statsElement.textContent = '系统初始化中...';
            }
        } else {
            console.error('❌ Stats element not found');
        }
    }

    /**
     * 刷新数据
     */
    async refreshData() {
        await this.evolutionManager.loadEvolutionData();
        this.renderCurrentTab();
        this.updateEvolutionStats();
    }

    /**
     * 切换对话选择
     */
    toggleConversationSelection(conversationId) {
        if (this.selectedItems.has(conversationId)) {
            this.selectedItems.delete(conversationId);
        } else {
            this.selectedItems.add(conversationId);
        }
        
        this.updateSelectionUI();
    }

    /**
     * 切换功能选择
     */
    toggleFunctionSelection(functionId) {
        if (this.selectedItems.has(functionId)) {
            this.selectedItems.delete(functionId);
        } else {
            this.selectedItems.add(functionId);
        }
        
        this.updateSelectionUI();
    }

    /**
     * 切换插件选择
     */
    togglePluginSelection(pluginId) {
        if (this.selectedItems.has(pluginId)) {
            this.selectedItems.delete(pluginId);
        } else {
            this.selectedItems.add(pluginId);
        }
        
        this.updateSelectionUI();
    }

    /**
     * 更新选择界面
     */
    updateSelectionUI() {
        const toolbar = document.getElementById('selectionToolbar');
        const countElement = document.getElementById('selectionCount');
        
        if (toolbar && countElement) {
            const count = this.selectedItems.size;
            toolbar.classList.toggle('visible', count > 0);
            
            const itemType = this.currentTab === 'conversations' ? '个对话' : 
                            this.currentTab === 'missing' ? '个功能' : '个插件';
            countElement.textContent = `已选择 ${count} ${itemType}`;
        }

        // 更新选中项样式
        document.querySelectorAll('.conversation-item, .missing-function-item, .plugin-item').forEach(item => {
            const id = item.dataset.id;
            item.classList.toggle('selected', this.selectedItems.has(id));
        });
    }

    /**
     * 处理键盘事件
     */
    handleKeydown(event) {
        if (event.key === 'Escape') {
            this.closeEvolutionInterface();
        }
    }

    /**
     * 关闭进化界面
     */
    closeEvolutionInterface() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.removeEventListener('keydown', this.handleKeydown.bind(this));
        }
    }

    /**
     * 生成进化报告
     */
    generateEvolutionReport() {
        // 切换到报告标签页
        this.switchTab('reports');
    }

    /**
     * 为选中功能生成插件
     */
    async generatePluginsForSelected() {
        if (this.selectedItems.size === 0) {
            alert('请先选择要生成插件的功能');
            return;
        }

        const selectedFunctions = this.evolutionManager.evolutionData.missingFunctions
            .filter(func => this.selectedItems.has(func.id));

        try {
            for (const func of selectedFunctions) {
                await this.evolutionManager.generatePluginForMissingFunction(func);
            }
            
            alert(`成功为 ${selectedFunctions.length} 个功能生成插件`);
            this.refreshData();
            this.selectedItems.clear();
            this.updateSelectionUI();
        } catch (error) {
            this.showError('生成插件失败: ' + error.message);
        }
    }

    /**
     * 分析选中对话
     */
    async analyzeSelectedConversations() {
        if (this.selectedItems.size === 0) {
            alert('请先选择要分析的对话');
            return;
        }

        // TODO: 实现对话分析逻辑
        alert('对话分析功能正在开发中');
    }

    /**
     * 导出选中内容
     */
    exportSelectedConversations() {
        // TODO: 实现导出逻辑
        alert('导出功能正在开发中');
    }

    /**
     * 安装选中插件
     */
    installSelectedPlugins() {
        // TODO: 实现插件安装逻辑
        alert('插件安装功能正在开发中');
    }

    /**
     * 测试选中插件
     */
    testSelectedPlugins() {
        // TODO: 实现插件测试逻辑
        alert('插件测试功能正在开发中');
    }

    /**
     * 导出选中插件代码
     */
    exportSelectedPlugins() {
        // TODO: 实现代码导出逻辑
        alert('代码导出功能正在开发中');
    }

    /**
     * 标记功能为已解决
     */
    markAsResolved() {
        // TODO: 实现标记逻辑
        alert('标记功能正在开发中');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EvolutionInterfaceManager;
} else if (typeof window !== 'undefined') {
    window.EvolutionInterfaceManager = EvolutionInterfaceManager;
} 