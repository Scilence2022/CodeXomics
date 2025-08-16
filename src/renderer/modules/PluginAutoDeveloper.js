/**
 * PluginAutoDeveloper - 插件自动开发核心系统
 * 集成需求分析、代码生成、调试测试和自动安装的完整插件开发流程
 */
class PluginAutoDeveloper {
    constructor(app, options = {}) {
        this.app = app;
        this.options = {
            enableLLMEnhancement: true,
            enableAutoTesting: true,
            enableAutoInstallation: true,
            debugMode: false,
            ...options
        };
        
        // 核心组件
        this.requirementAnalyzer = null;
        this.codeGenerator = null;
        this.debugTools = null;
        this.testManager = null;
        this.installationManager = null;
        this.chatBoxIntegration = null;
        
        // 系统状态
        this.isInitialized = false;
        this.activeProjects = new Map();
        this.developmentHistory = [];
        
        // 事件系统
        this.eventBus = new EventTarget();
        
        console.log('PluginAutoDeveloper initializing...');
        this.initialize();
    }

    /**
     * 初始化插件自动开发系统
     */
    async initialize() {
        try {
            console.log('🔧 Initializing PluginAutoDeveloper...');
            
            // 初始化需求分析器
            this.requirementAnalyzer = new PluginRequirementAnalyzer(this.app);
            await this.requirementAnalyzer.initialize();
            
            // 初始化增强代码生成器
            this.codeGenerator = new EnhancedPluginCodeGenerator(this.app, this.options);
            await this.codeGenerator.initialize();
            
            // 初始化调试工具
            this.debugTools = new PluginDebugTools(this.app);
            await this.debugTools.initialize();
            
            // 初始化测试管理器
            this.testManager = new PluginTestManager(this.app);
            await this.testManager.initialize();
            
            // 初始化安装管理器
            this.installationManager = new PluginInstallationManager(this.app);
            await this.installationManager.initialize();
            
            // 初始化ChatBox集成
            this.chatBoxIntegration = new PluginDevelopmentChatBoxIntegration(this);
            await this.chatBoxIntegration.initialize();
            
            // 设置事件监听
            this.setupEventListeners();
            
            // 设置全局引用
            if (typeof window !== 'undefined') {
                window.pluginAutoDeveloper = this;
            }
            
            this.isInitialized = true;
            this.emitEvent('system-initialized', { timestamp: Date.now() });
            
            console.log('🚀 PluginAutoDeveloper initialization complete');
            
        } catch (error) {
            console.error('❌ PluginAutoDeveloper initialization failed:', error);
            throw error;
        }
    }

    /**
     * 主要开发流程：从ChatBox需求到完成的插件
     */
    async developPluginFromChat(userRequirement) {
        try {
            console.log('🔄 Starting plugin development from chat requirement...');
            
            const projectId = this.generateProjectId();
            const project = {
                id: projectId,
                userRequirement,
                status: 'analyzing',
                startTime: Date.now(),
                phases: [],
                results: {}
            };
            
            this.activeProjects.set(projectId, project);
            this.emitEvent('development-started', { projectId, userRequirement });
            
            // 阶段1：需求分析
            project.status = 'analyzing';
            console.log('📊 Phase 1: Analyzing requirements...');
            const analysis = await this.requirementAnalyzer.analyzeRequirement(userRequirement);
            project.results.analysis = analysis;
            project.phases.push({ phase: 'analysis', completed: Date.now(), result: analysis });
            this.emitEvent('phase-completed', { projectId, phase: 'analysis', result: analysis });
            
            // 阶段2：代码生成
            project.status = 'generating';
            console.log('⚡ Phase 2: Generating plugin code...');
            const codeResult = await this.codeGenerator.generatePlugin(analysis);
            project.results.code = codeResult;
            project.phases.push({ phase: 'generation', completed: Date.now(), result: codeResult });
            this.emitEvent('phase-completed', { projectId, phase: 'generation', result: codeResult });
            
            // 阶段3：调试和验证
            project.status = 'debugging';
            console.log('🐛 Phase 3: Debugging and validation...');
            const debugResult = await this.debugTools.validateAndDebug(codeResult);
            project.results.debug = debugResult;
            project.phases.push({ phase: 'debugging', completed: Date.now(), result: debugResult });
            this.emitEvent('phase-completed', { projectId, phase: 'debugging', result: debugResult });
            
            // 阶段4：自动测试
            if (this.options.enableAutoTesting) {
                project.status = 'testing';
                console.log('🧪 Phase 4: Running automated tests...');
                const testResult = await this.testManager.runAutomatedTests(codeResult, analysis);
                project.results.test = testResult;
                project.phases.push({ phase: 'testing', completed: Date.now(), result: testResult });
                this.emitEvent('phase-completed', { projectId, phase: 'testing', result: testResult });
            }
            
            // 阶段5：自动安装
            if (this.options.enableAutoInstallation) {
                project.status = 'installing';
                console.log('📦 Phase 5: Installing plugin...');
                const installResult = await this.installationManager.installPlugin(codeResult, analysis);
                project.results.installation = installResult;
                project.phases.push({ phase: 'installation', completed: Date.now(), result: installResult });
                this.emitEvent('phase-completed', { projectId, phase: 'installation', result: installResult });
            }
            
            // 完成开发
            project.status = 'completed';
            project.endTime = Date.now();
            project.duration = project.endTime - project.startTime;
            
            this.developmentHistory.push(project);
            this.emitEvent('development-completed', { projectId, project });
            
            console.log(`✅ Plugin development completed in ${project.duration}ms`);
            
            return {
                success: true,
                projectId,
                project,
                plugin: project.results.installation?.pluginInfo || project.results.code?.pluginInfo
            };
            
        } catch (error) {
            console.error('❌ Plugin development failed:', error);
            
            if (project) {
                project.status = 'failed';
                project.error = error.message;
                project.endTime = Date.now();
                this.emitEvent('development-failed', { projectId, error: error.message });
            }
            
            throw error;
        }
    }

    /**
     * 交互式开发流程：分步骤与用户确认
     */
    async startInteractiveDevelopment(userRequirement) {
        try {
            const projectId = this.generateProjectId();
            const project = {
                id: projectId,
                userRequirement,
                status: 'interactive',
                mode: 'interactive',
                startTime: Date.now(),
                currentStep: 'analysis',
                userApprovals: [],
                results: {}
            };
            
            this.activeProjects.set(projectId, project);
            
            // 步骤1：需求分析并等待用户确认
            const analysis = await this.requirementAnalyzer.analyzeRequirement(userRequirement);
            project.results.analysis = analysis;
            
            // 返回分析结果给ChatBox，等待用户确认
            return {
                projectId,
                step: 'analysis',
                analysis,
                requiresApproval: true,
                message: '我已经分析了你的需求，请确认以下分析结果是否正确：',
                nextActions: ['approve', 'modify', 'cancel']
            };
            
        } catch (error) {
            console.error('❌ Interactive development failed to start:', error);
            throw error;
        }
    }

    /**
     * 处理交互式开发的用户反馈
     */
    async handleInteractiveApproval(projectId, action, feedback = null) {
        const project = this.activeProjects.get(projectId);
        if (!project || project.mode !== 'interactive') {
            throw new Error('Invalid interactive project');
        }
        
        project.userApprovals.push({
            step: project.currentStep,
            action,
            feedback,
            timestamp: Date.now()
        });
        
        switch (action) {
            case 'approve':
                return await this.proceedToNextStep(project);
            case 'modify':
                return await this.modifyCurrentStep(project, feedback);
            case 'cancel':
                return await this.cancelDevelopment(project);
            default:
                throw new Error('Invalid action');
        }
    }

    /**
     * 进入下一步开发阶段
     */
    async proceedToNextStep(project) {
        switch (project.currentStep) {
            case 'analysis':
                // 生成代码
                project.currentStep = 'generation';
                const codeResult = await this.codeGenerator.generatePlugin(project.results.analysis);
                project.results.code = codeResult;
                
                return {
                    projectId: project.id,
                    step: 'generation',
                    code: codeResult,
                    requiresApproval: true,
                    message: '我已经生成了插件代码，请审查代码是否符合你的需求：',
                    nextActions: ['approve', 'modify', 'regenerate', 'cancel']
                };
                
            case 'generation':
                // 调试和测试
                project.currentStep = 'testing';
                const debugResult = await this.debugTools.validateAndDebug(project.results.code);
                const testResult = await this.testManager.runAutomatedTests(project.results.code, project.results.analysis);
                
                project.results.debug = debugResult;
                project.results.test = testResult;
                
                return {
                    projectId: project.id,
                    step: 'testing',
                    debug: debugResult,
                    test: testResult,
                    requiresApproval: true,
                    message: '代码验证和测试完成，请确认是否安装插件：',
                    nextActions: ['approve', 'debug_more', 'cancel']
                };
                
            case 'testing':
                // 安装插件
                project.currentStep = 'installation';
                const installResult = await this.installationManager.installPlugin(project.results.code, project.results.analysis);
                project.results.installation = installResult;
                
                project.status = 'completed';
                project.endTime = Date.now();
                
                return {
                    projectId: project.id,
                    step: 'completed',
                    installation: installResult,
                    requiresApproval: false,
                    message: '插件已成功安装并可以使用！',
                    nextActions: ['test_plugin', 'view_code', 'done']
                };
                
            default:
                throw new Error('Unknown development step');
        }
    }

    /**
     * 修改当前步骤
     */
    async modifyCurrentStep(project, feedback) {
        switch (project.currentStep) {
            case 'analysis':
                // 重新分析需求
                const modifiedAnalysis = await this.requirementAnalyzer.modifyAnalysis(project.results.analysis, feedback);
                project.results.analysis = modifiedAnalysis;
                
                return {
                    projectId: project.id,
                    step: 'analysis',
                    analysis: modifiedAnalysis,
                    requiresApproval: true,
                    message: '我已经根据你的反馈修改了需求分析：',
                    nextActions: ['approve', 'modify', 'cancel']
                };
                
            case 'generation':
                // 重新生成代码
                const modifiedCode = await this.codeGenerator.modifyPlugin(project.results.code, feedback);
                project.results.code = modifiedCode;
                
                return {
                    projectId: project.id,
                    step: 'generation',
                    code: modifiedCode,
                    requiresApproval: true,
                    message: '我已经根据你的反馈修改了代码：',
                    nextActions: ['approve', 'modify', 'regenerate', 'cancel']
                };
                
            default:
                throw new Error('Cannot modify current step');
        }
    }

    /**
     * 取消开发
     */
    async cancelDevelopment(project) {
        project.status = 'cancelled';
        project.endTime = Date.now();
        
        this.activeProjects.delete(project.id);
        this.emitEvent('development-cancelled', { projectId: project.id });
        
        return {
            projectId: project.id,
            step: 'cancelled',
            message: '插件开发已取消。',
            requiresApproval: false
        };
    }

    /**
     * 获取开发状态
     */
    getDevelopmentStatus(projectId) {
        const project = this.activeProjects.get(projectId);
        if (!project) {
            // 检查历史记录
            const historical = this.developmentHistory.find(p => p.id === projectId);
            return historical || null;
        }
        return project;
    }

    /**
     * 获取所有活跃项目
     */
    getActiveProjects() {
        return Array.from(this.activeProjects.values());
    }

    /**
     * 获取开发历史
     */
    getDevelopmentHistory() {
        return this.developmentHistory;
    }

    /**
     * 生成项目ID
     */
    generateProjectId() {
        return `plugin-dev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听系统事件
        if (typeof window !== 'undefined') {
            window.addEventListener('plugin-development-event', (event) => {
                this.handleSystemEvent(event.detail);
            });
        }
    }

    /**
     * 处理系统事件
     */
    handleSystemEvent(eventData) {
        console.log('🔔 Plugin development event:', eventData);
        // 可以在这里添加事件处理逻辑
    }

    /**
     * 发出事件
     */
    emitEvent(eventType, data) {
        const event = new CustomEvent('plugin-development-event', {
            detail: { type: eventType, data, timestamp: Date.now() }
        });
        
        this.eventBus.dispatchEvent(event);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
        }
        
        if (this.options.debugMode) {
            console.log(`🔔 Plugin development event: ${eventType}`, data);
        }
    }

    /**
     * 添加事件监听器
     */
    on(eventType, callback) {
        this.eventBus.addEventListener('plugin-development-event', (event) => {
            if (event.detail.type === eventType) {
                callback(event.detail.data);
            }
        });
    }

    /**
     * 获取系统统计信息
     */
    getSystemStats() {
        return {
            activeProjects: this.activeProjects.size,
            completedProjects: this.developmentHistory.filter(p => p.status === 'completed').length,
            failedProjects: this.developmentHistory.filter(p => p.status === 'failed').length,
            totalProjects: this.developmentHistory.length,
            averageDevTime: this.calculateAverageDevTime(),
            successRate: this.calculateSuccessRate(),
            components: {
                requirementAnalyzer: this.requirementAnalyzer?.getStats() || null,
                codeGenerator: this.codeGenerator?.getStats() || null,
                debugTools: this.debugTools?.getStats() || null,
                testManager: this.testManager?.getStats() || null,
                installationManager: this.installationManager?.getStats() || null
            }
        };
    }

    /**
     * 计算平均开发时间
     */
    calculateAverageDevTime() {
        const completed = this.developmentHistory.filter(p => p.status === 'completed' && p.duration);
        if (completed.length === 0) return 0;
        
        const total = completed.reduce((sum, p) => sum + p.duration, 0);
        return total / completed.length;
    }

    /**
     * 计算成功率
     */
    calculateSuccessRate() {
        if (this.developmentHistory.length === 0) return 0;
        
        const successful = this.developmentHistory.filter(p => p.status === 'completed').length;
        return (successful / this.developmentHistory.length) * 100;
    }

    /**
     * 清理和销毁
     */
    async destroy() {
        console.log('🧹 Destroying PluginAutoDeveloper...');
        
        // 销毁所有组件
        if (this.requirementAnalyzer) await this.requirementAnalyzer.destroy();
        if (this.codeGenerator) await this.codeGenerator.destroy();
        if (this.debugTools) await this.debugTools.destroy();
        if (this.testManager) await this.testManager.destroy();
        if (this.installationManager) await this.installationManager.destroy();
        if (this.chatBoxIntegration) await this.chatBoxIntegration.destroy();
        
        // 清理数据
        this.activeProjects.clear();
        this.developmentHistory = [];
        
        this.emitEvent('system-destroyed', { timestamp: Date.now() });
        console.log('✅ PluginAutoDeveloper destroyed');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginAutoDeveloper;
} else if (typeof window !== 'undefined') {
    window.PluginAutoDeveloper = PluginAutoDeveloper;
}