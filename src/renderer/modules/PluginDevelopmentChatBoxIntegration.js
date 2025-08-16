/**
 * PluginDevelopmentChatBoxIntegration - ChatBox插件开发集成
 * 将插件自动开发功能无缝集成到ChatBox界面中
 */
class PluginDevelopmentChatBoxIntegration {
    constructor(pluginAutoDeveloper) {
        this.pluginAutoDeveloper = pluginAutoDeveloper;
        this.app = pluginAutoDeveloper.app;
        this.chatManager = this.app.chatManager;
        this.llmConfigManager = this.app.llmConfigManager;
        
        // 集成配置
        this.config = {
            enableAutoDetection: true,
            enableInteractiveMode: true,
            enableProgressUpdates: true,
            enableCodePreview: true,
            autoInstallOnCompletion: true,
            enableUserConfirmation: true
        };
        
        // 会话状态管理
        this.activeDevelopmentSessions = new Map();
        this.commandPatterns = this.initializeCommandPatterns();
        this.uiComponents = new Map();
        
        // ChatBox扩展功能
        this.chatFunctions = new Map();
        this.developmentCommands = new Map();
        
        console.log('PluginDevelopmentChatBoxIntegration initialized');
    }

    async initialize() {
        // 注册ChatBox函数
        await this.registerChatFunctions();
        
        // 设置消息监听
        await this.setupMessageHandlers();
        
        // 创建UI组件
        await this.createUIComponents();
        
        // 注册开发命令
        await this.registerDevelopmentCommands();
        
        console.log('✅ PluginDevelopmentChatBoxIntegration ready');
    }

    /**
     * 注册ChatBox函数
     */
    async registerChatFunctions() {
        // 插件开发请求处理函数
        this.chatFunctions.set('developPlugin', {
            name: 'developPlugin',
            description: '根据用户需求自动开发插件',
            parameters: {
                type: 'object',
                properties: {
                    requirement: {
                        type: 'string',
                        description: '插件开发需求描述'
                    },
                    mode: {
                        type: 'string',
                        enum: ['automatic', 'interactive'],
                        default: 'interactive',
                        description: '开发模式：自动或交互式'
                    },
                    skipConfirmation: {
                        type: 'boolean',
                        default: false,
                        description: '跳过用户确认步骤'
                    }
                },
                required: ['requirement']
            },
            execute: this.handleDevelopPluginRequest.bind(this)
        });

        // 插件开发状态查询函数
        this.chatFunctions.set('getPluginDevelopmentStatus', {
            name: 'getPluginDevelopmentStatus',
            description: '查询插件开发状态',
            parameters: {
                type: 'object',
                properties: {
                    projectId: {
                        type: 'string',
                        description: '项目ID，如不提供则返回所有活跃项目状态'
                    }
                }
            },
            execute: this.handleStatusQuery.bind(this)
        });

        // 插件安装确认函数
        this.chatFunctions.set('confirmPluginInstallation', {
            name: 'confirmPluginInstallation',
            description: '确认安装生成的插件',
            parameters: {
                type: 'object',
                properties: {
                    projectId: {
                        type: 'string',
                        description: '项目ID'
                    },
                    confirmed: {
                        type: 'boolean',
                        description: '是否确认安装'
                    }
                },
                required: ['projectId', 'confirmed']
            },
            execute: this.handleInstallationConfirmation.bind(this)
        });

        // 代码预览函数
        this.chatFunctions.set('previewPluginCode', {
            name: 'previewPluginCode',
            description: '预览生成的插件代码',
            parameters: {
                type: 'object',
                properties: {
                    projectId: {
                        type: 'string',
                        description: '项目ID'
                    },
                    fileType: {
                        type: 'string',
                        enum: ['main', 'manifest', 'package', 'test', 'docs'],
                        default: 'main',
                        description: '要预览的文件类型'
                    }
                },
                required: ['projectId']
            },
            execute: this.handleCodePreview.bind(this)
        });

        // 将函数注册到ChatBox
        if (this.chatManager && this.chatManager.registerFunction) {
            for (const [name, func] of this.chatFunctions) {
                await this.chatManager.registerFunction(func);
            }
        }
    }

    /**
     * 设置消息处理器
     */
    async setupMessageHandlers() {
        if (this.chatManager) {
            // 监听用户消息，自动检测插件开发请求
            this.chatManager.on('user-message', this.handleUserMessage.bind(this));
            
            // 监听系统事件
            this.chatManager.on('conversation-start', this.handleConversationStart.bind(this));
            this.chatManager.on('conversation-end', this.handleConversationEnd.bind(this));
        }

        // 监听插件开发事件
        this.pluginAutoDeveloper.on('development-started', this.handleDevelopmentStarted.bind(this));
        this.pluginAutoDeveloper.on('phase-completed', this.handlePhaseCompleted.bind(this));
        this.pluginAutoDeveloper.on('development-completed', this.handleDevelopmentCompleted.bind(this));
        this.pluginAutoDeveloper.on('development-failed', this.handleDevelopmentFailed.bind(this));
    }

    /**
     * 创建UI组件
     */
    async createUIComponents() {
        // 插件开发进度指示器
        const progressIndicator = this.createProgressIndicator();
        this.uiComponents.set('progressIndicator', progressIndicator);

        // 代码预览面板
        const codePreviewPanel = this.createCodePreviewPanel();
        this.uiComponents.set('codePreviewPanel', codePreviewPanel);

        // 交互式确认对话框
        const confirmationDialog = this.createConfirmationDialog();
        this.uiComponents.set('confirmationDialog', confirmationDialog);

        // 开发历史面板
        const historyPanel = this.createHistoryPanel();
        this.uiComponents.set('historyPanel', historyPanel);
    }

    /**
     * 注册开发命令
     */
    async registerDevelopmentCommands() {
        const commands = [
            {
                command: '/develop',
                description: '开始插件开发会话',
                handler: this.handleDevelopCommand.bind(this)
            },
            {
                command: '/dev-status',
                description: '查看开发状态',
                handler: this.handleStatusCommand.bind(this)
            },
            {
                command: '/install-plugin',
                description: '安装生成的插件',
                handler: this.handleInstallCommand.bind(this)
            },
            {
                command: '/preview-code',
                description: '预览插件代码',
                handler: this.handlePreviewCommand.bind(this)
            },
            {
                command: '/dev-history',
                description: '查看开发历史',
                handler: this.handleHistoryCommand.bind(this)
            }
        ];

        for (const cmd of commands) {
            this.developmentCommands.set(cmd.command, cmd);
            if (this.chatManager && this.chatManager.registerCommand) {
                await this.chatManager.registerCommand(cmd);
            }
        }
    }

    /**
     * 处理用户消息，自动检测插件开发需求
     */
    async handleUserMessage(messageData) {
        if (!this.config.enableAutoDetection) return;

        const message = messageData.content.toLowerCase();
        
        // 检测插件开发意图
        const developmentIntent = this.detectDevelopmentIntent(message);
        
        if (developmentIntent.detected) {
            const suggestion = {
                type: 'plugin-development',
                confidence: developmentIntent.confidence,
                suggestedAction: '开始插件开发',
                requirement: messageData.content,
                mode: developmentIntent.suggestedMode
            };

            // 向ChatBox发送开发建议
            await this.sendDevelopmentSuggestion(suggestion, messageData.conversationId);
        }
    }

    /**
     * 检测开发意图
     */
    detectDevelopmentIntent(message) {
        let confidence = 0;
        let suggestedMode = 'interactive';
        
        const patterns = {
            direct: [
                'create a plugin', 'develop a plugin', 'build a plugin', 'make a plugin',
                '创建插件', '开发插件', '制作插件', '生成插件'
            ],
            functional: [
                'i need a function', 'i want to analyze', 'help me with',
                '我需要一个功能', '我想分析', '帮我做', '实现一个'
            ],
            visualization: [
                'visualize', 'plot', 'chart', 'graph', 'display',
                '可视化', '绘图', '图表', '显示', '展示'
            ],
            analysis: [
                'analyze', 'calculate', 'process', 'compute',
                '分析', '计算', '处理', '统计'
            ]
        };

        // 检查直接开发请求
        for (const pattern of patterns.direct) {
            if (message.includes(pattern)) {
                confidence += 0.8;
                break;
            }
        }

        // 检查功能需求
        for (const pattern of patterns.functional) {
            if (message.includes(pattern)) {
                confidence += 0.6;
                break;
            }
        }

        // 检查可视化需求
        for (const pattern of patterns.visualization) {
            if (message.includes(pattern)) {
                confidence += 0.5;
                break;
            }
        }

        // 检查分析需求
        for (const pattern of patterns.analysis) {
            if (message.includes(pattern)) {
                confidence += 0.4;
                break;
            }
        }

        // 调整建议模式
        if (message.includes('automatically') || message.includes('just do it') || message.includes('自动')) {
            suggestedMode = 'automatic';
        }

        return {
            detected: confidence > 0.5,
            confidence,
            suggestedMode
        };
    }

    /**
     * 发送开发建议
     */
    async sendDevelopmentSuggestion(suggestion, conversationId) {
        const suggestionMessage = {
            type: 'system-suggestion',
            content: `🤖 我检测到你可能需要开发一个插件。\n\n` +
                    `**检测到的需求**: ${suggestion.requirement}\n` +
                    `**建议模式**: ${suggestion.mode === 'interactive' ? '交互式开发' : '自动开发'}\n` +
                    `**置信度**: ${(suggestion.confidence * 100).toFixed(1)}%\n\n` +
                    `是否要开始插件开发？你可以说"是的，开始开发"或使用命令 \`/develop\``,
            conversationId,
            timestamp: Date.now(),
            metadata: {
                suggestion,
                actionable: true,
                actions: [
                    {
                        label: '开始交互式开发',
                        action: 'start-interactive-development',
                        data: { requirement: suggestion.requirement, mode: 'interactive' }
                    },
                    {
                        label: '开始自动开发',
                        action: 'start-automatic-development',
                        data: { requirement: suggestion.requirement, mode: 'automatic' }
                    },
                    {
                        label: '不需要',
                        action: 'dismiss-suggestion'
                    }
                ]
            }
        };

        if (this.chatManager && this.chatManager.addSystemMessage) {
            await this.chatManager.addSystemMessage(suggestionMessage);
        }
    }

    /**
     * 处理插件开发请求
     */
    async handleDevelopPluginRequest(params) {
        try {
            const { requirement, mode = 'interactive', skipConfirmation = false } = params;
            
            let result;
            
            if (mode === 'automatic') {
                // 自动模式：直接开发
                result = await this.pluginAutoDeveloper.developPluginFromChat(requirement);
                
                return this.formatDevelopmentResult(result, 'automatic');
                
            } else {
                // 交互模式：分步骤进行
                result = await this.pluginAutoDeveloper.startInteractiveDevelopment(requirement);
                
                // 存储会话状态
                this.activeDevelopmentSessions.set(result.projectId, {
                    projectId: result.projectId,
                    mode: 'interactive',
                    currentStep: result.step,
                    startTime: Date.now(),
                    lastUpdate: Date.now()
                });
                
                return this.formatInteractiveResult(result);
            }
            
        } catch (error) {
            console.error('Plugin development request failed:', error);
            return {
                success: false,
                error: error.message,
                message: '插件开发失败，请检查需求描述并重试。'
            };
        }
    }

    /**
     * 处理状态查询
     */
    async handleStatusQuery(params) {
        const { projectId } = params;
        
        if (projectId) {
            // 查询特定项目状态
            const status = this.pluginAutoDeveloper.getDevelopmentStatus(projectId);
            if (status) {
                return this.formatProjectStatus(status);
            } else {
                return {
                    success: false,
                    message: `未找到项目 ${projectId}`
                };
            }
        } else {
            // 查询所有活跃项目
            const activeProjects = this.pluginAutoDeveloper.getActiveProjects();
            const stats = this.pluginAutoDeveloper.getSystemStats();
            
            return {
                success: true,
                activeProjects: activeProjects.length,
                totalProjects: stats.totalProjects,
                successRate: stats.successRate,
                projects: activeProjects.map(p => this.formatProjectSummary(p))
            };
        }
    }

    /**
     * 处理安装确认
     */
    async handleInstallationConfirmation(params) {
        const { projectId, confirmed } = params;
        
        try {
            if (confirmed) {
                const result = await this.pluginAutoDeveloper.handleInteractiveApproval(projectId, 'approve');
                return {
                    success: true,
                    message: '插件安装已确认，正在进行安装...',
                    result
                };
            } else {
                const result = await this.pluginAutoDeveloper.handleInteractiveApproval(projectId, 'cancel');
                return {
                    success: true,
                    message: '插件安装已取消',
                    result
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '处理安装确认时发生错误'
            };
        }
    }

    /**
     * 处理代码预览
     */
    async handleCodePreview(params) {
        const { projectId, fileType = 'main' } = params;
        
        try {
            const project = this.pluginAutoDeveloper.getDevelopmentStatus(projectId);
            if (!project) {
                return {
                    success: false,
                    message: `未找到项目 ${projectId}`
                };
            }
            
            let code = '';
            let filename = '';
            
            switch (fileType) {
                case 'main':
                    code = project.results?.code?.mainCode || '';
                    filename = 'plugin.js';
                    break;
                case 'manifest':
                    code = project.results?.code?.manifestFile || '';
                    filename = 'manifest.json';
                    break;
                case 'package':
                    code = project.results?.code?.packageJson || '';
                    filename = 'package.json';
                    break;
                case 'test':
                    const testFiles = project.results?.code?.testFiles || {};
                    code = Object.values(testFiles)[0] || '';
                    filename = Object.keys(testFiles)[0] || 'test.js';
                    break;
                case 'docs':
                    const docFiles = project.results?.code?.documentationFiles || {};
                    code = docFiles['README.md'] || '';
                    filename = 'README.md';
                    break;
            }
            
            if (!code) {
                return {
                    success: false,
                    message: `${fileType} 文件尚未生成或为空`
                };
            }
            
            // 显示代码预览面板
            this.showCodePreview(filename, code);
            
            return {
                success: true,
                filename,
                fileType,
                codeLength: code.length,
                preview: code.substring(0, 500) + (code.length > 500 ? '...' : ''),
                message: `正在显示 ${filename} 的预览`
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '代码预览失败'
            };
        }
    }

    /**
     * 事件处理器
     */
    async handleDevelopmentStarted(data) {
        if (this.config.enableProgressUpdates) {
            await this.sendProgressUpdate({
                type: 'started',
                projectId: data.projectId,
                message: '🚀 插件开发已开始...',
                progress: 0
            });
        }
    }

    async handlePhaseCompleted(data) {
        if (this.config.enableProgressUpdates) {
            const phaseMessages = {
                analysis: '📊 需求分析完成',
                generation: '⚡ 代码生成完成', 
                debugging: '🐛 调试验证完成',
                testing: '🧪 测试完成',
                installation: '📦 安装完成'
            };
            
            await this.sendProgressUpdate({
                type: 'phase-completed',
                projectId: data.projectId,
                phase: data.phase,
                message: phaseMessages[data.phase] || `${data.phase} 阶段完成`,
                progress: this.calculateProgress(data.phase)
            });
        }
    }

    async handleDevelopmentCompleted(data) {
        const completionMessage = {
            type: 'development-completed',
            content: `✅ **插件开发完成！**\n\n` +
                    `**项目ID**: ${data.projectId}\n` +
                    `**插件名称**: ${data.project.results?.code?.pluginInfo?.name || '未知'}\n` +
                    `**开发时间**: ${(data.project.duration / 1000).toFixed(1)}秒\n\n` +
                    `插件已成功生成并安装。你现在可以使用新的插件功能了！\n\n` +
                    `使用 \`/preview-code ${data.projectId}\` 查看代码，或 \`/dev-history\` 查看开发历史。`,
            timestamp: Date.now(),
            metadata: {
                projectId: data.projectId,
                development: data.project
            }
        };

        if (this.chatManager && this.chatManager.addSystemMessage) {
            await this.chatManager.addSystemMessage(completionMessage);
        }

        // 清理会话状态
        this.activeDevelopmentSessions.delete(data.projectId);
    }

    async handleDevelopmentFailed(data) {
        const errorMessage = {
            type: 'development-failed',
            content: `❌ **插件开发失败**\n\n` +
                    `**项目ID**: ${data.projectId}\n` +
                    `**错误**: ${data.error}\n\n` +
                    `请检查需求描述并重试，或联系技术支持获取帮助。`,
            timestamp: Date.now(),
            metadata: {
                projectId: data.projectId,
                error: data.error
            }
        };

        if (this.chatManager && this.chatManager.addSystemMessage) {
            await this.chatManager.addSystemMessage(errorMessage);
        }

        // 清理会话状态
        this.activeDevelopmentSessions.delete(data.projectId);
    }

    /**
     * 命令处理器
     */
    async handleDevelopCommand(args) {
        if (!args || args.length === 0) {
            return {
                success: false,
                message: '请提供插件开发需求，例如：/develop 创建一个基因序列分析插件'
            };
        }

        const requirement = args.join(' ');
        return await this.handleDevelopPluginRequest({ requirement });
    }

    async handleStatusCommand(args) {
        const projectId = args[0];
        return await this.handleStatusQuery({ projectId });
    }

    async handleInstallCommand(args) {
        if (!args || args.length === 0) {
            return {
                success: false,
                message: '请提供项目ID，例如：/install-plugin project-123'
            };
        }

        const projectId = args[0];
        return await this.handleInstallationConfirmation({ projectId, confirmed: true });
    }

    async handlePreviewCommand(args) {
        if (!args || args.length === 0) {
            return {
                success: false,
                message: '请提供项目ID，例如：/preview-code project-123'
            };
        }

        const projectId = args[0];
        const fileType = args[1] || 'main';
        return await this.handleCodePreview({ projectId, fileType });
    }

    async handleHistoryCommand(args) {
        const history = this.pluginAutoDeveloper.getDevelopmentHistory();
        const stats = this.pluginAutoDeveloper.getSystemStats();

        return {
            success: true,
            totalProjects: history.length,
            successfulProjects: history.filter(p => p.status === 'completed').length,
            failedProjects: history.filter(p => p.status === 'failed').length,
            averageTime: stats.averageDevTime,
            recentProjects: history.slice(-5).map(p => this.formatProjectSummary(p))
        };
    }

    /**
     * UI组件创建方法
     */
    createProgressIndicator() {
        return {
            show: (projectId, progress) => {
                console.log(`Progress for ${projectId}: ${progress}%`);
                // 在实际实现中创建进度条UI
            },
            hide: () => {
                console.log('Hiding progress indicator');
            }
        };
    }

    createCodePreviewPanel() {
        return {
            show: (filename, code) => {
                console.log(`Showing code preview for ${filename}`);
                // 在实际实现中创建代码预览面板
            },
            hide: () => {
                console.log('Hiding code preview panel');
            }
        };
    }

    createConfirmationDialog() {
        return {
            show: (message, options) => {
                console.log(`Showing confirmation: ${message}`);
                return Promise.resolve(true);
            }
        };
    }

    createHistoryPanel() {
        return {
            show: (history) => {
                console.log('Showing development history');
            },
            hide: () => {
                console.log('Hiding history panel');
            }
        };
    }

    /**
     * 辅助方法
     */
    initializeCommandPatterns() {
        return {
            develop: /^\/develop\s+(.+)$/i,
            status: /^\/dev-status(\s+(.+))?$/i,
            install: /^\/install-plugin\s+(.+)$/i,
            preview: /^\/preview-code\s+(.+)(\s+(main|manifest|package|test|docs))?$/i,
            history: /^\/dev-history$/i
        };
    }

    formatDevelopmentResult(result, mode) {
        return {
            success: result.success,
            mode,
            projectId: result.projectId,
            plugin: result.plugin,
            message: result.success ? 
                `🎉 插件开发成功完成！插件 "${result.plugin?.name}" 已自动安装并可以使用。` :
                '❌ 插件开发失败，请检查需求并重试。'
        };
    }

    formatInteractiveResult(result) {
        const stepMessages = {
            analysis: '我已经分析了你的需求。请查看分析结果并确认是否正确。',
            generation: '代码已生成。请审查代码是否符合你的需求。',
            testing: '代码验证和测试完成。是否安装这个插件？'
        };

        return {
            success: true,
            projectId: result.projectId,
            step: result.step,
            requiresApproval: result.requiresApproval,
            message: stepMessages[result.step] || `当前步骤：${result.step}`,
            data: result[result.step] || result.analysis,
            nextActions: result.nextActions
        };
    }

    formatProjectStatus(project) {
        return {
            success: true,
            projectId: project.id,
            status: project.status,
            progress: this.calculateProjectProgress(project),
            currentStep: project.currentStep,
            startTime: project.startTime,
            duration: project.endTime ? project.endTime - project.startTime : Date.now() - project.startTime,
            results: project.results ? Object.keys(project.results) : []
        };
    }

    formatProjectSummary(project) {
        return {
            id: project.id,
            status: project.status,
            requirement: project.userRequirement?.substring(0, 100) + '...',
            duration: project.duration,
            completed: project.endTime,
            pluginName: project.results?.code?.pluginInfo?.name
        };
    }

    calculateProgress(phase) {
        const phaseProgress = {
            analysis: 20,
            generation: 40,
            debugging: 60,
            testing: 80,
            installation: 100
        };
        return phaseProgress[phase] || 0;
    }

    calculateProjectProgress(project) {
        if (project.status === 'completed') return 100;
        if (project.status === 'failed') return 0;
        
        const phases = project.phases || [];
        return phases.length * 20; // 每个阶段20%
    }

    async sendProgressUpdate(update) {
        const message = {
            type: 'progress-update',
            content: `${update.message} (${update.progress || 0}%)`,
            timestamp: Date.now(),
            metadata: update
        };

        if (this.chatManager && this.chatManager.addSystemMessage) {
            await this.chatManager.addSystemMessage(message);
        }

        // 更新UI进度指示器
        const progressIndicator = this.uiComponents.get('progressIndicator');
        if (progressIndicator) {
            progressIndicator.show(update.projectId, update.progress);
        }
    }

    showCodePreview(filename, code) {
        const codePreviewPanel = this.uiComponents.get('codePreviewPanel');
        if (codePreviewPanel) {
            codePreviewPanel.show(filename, code);
        }
    }

    async handleConversationStart(conversationData) {
        // 会话开始时的初始化
        console.log('New conversation started, plugin development available');
    }

    async handleConversationEnd(conversationData) {
        // 清理该会话相关的开发状态
        for (const [sessionId, session] of this.activeDevelopmentSessions) {
            if (session.conversationId === conversationData.id) {
                this.activeDevelopmentSessions.delete(sessionId);
            }
        }
    }

    getStats() {
        return {
            activeSessions: this.activeDevelopmentSessions.size,
            registeredFunctions: this.chatFunctions.size,
            registeredCommands: this.developmentCommands.size,
            uiComponents: this.uiComponents.size
        };
    }

    async destroy() {
        this.activeDevelopmentSessions.clear();
        this.chatFunctions.clear();
        this.developmentCommands.clear();
        this.uiComponents.clear();
        
        console.log('✅ PluginDevelopmentChatBoxIntegration destroyed');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginDevelopmentChatBoxIntegration;
} else if (typeof window !== 'undefined') {
    window.PluginDevelopmentChatBoxIntegration = PluginDevelopmentChatBoxIntegration;
}