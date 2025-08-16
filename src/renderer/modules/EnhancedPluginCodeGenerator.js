/**
 * EnhancedPluginCodeGenerator - 增强的插件代码生成器
 * 基于需求分析结果生成高质量的插件代码，支持多种插件类型和复杂功能
 */
class EnhancedPluginCodeGenerator {
    constructor(app, options = {}) {
        this.app = app;
        this.llmConfigManager = app.llmConfigManager;
        this.options = {
            useTypeScript: false,
            includeTests: true,
            includeDocumentation: true,
            enableLLMEnhancement: true,
            codeStyle: 'standard',
            ...options
        };
        
        // 代码模板和生成器
        this.templates = this.initializeTemplates();
        this.generators = this.initializeGenerators();
        this.validators = this.initializeValidators();
        
        // 生成历史和统计
        this.generationHistory = [];
        this.templateCache = new Map();
        
        console.log('EnhancedPluginCodeGenerator initialized');
    }

    async initialize() {
        await this.loadTemplates();
        await this.setupGenerators();
        console.log('✅ EnhancedPluginCodeGenerator ready');
    }

    /**
     * 根据需求分析生成插件
     */
    async generatePlugin(analysis) {
        try {
            console.log('⚡ Generating plugin from analysis:', analysis.analysisId);
            
            const generation = {
                generationId: this.generateId(),
                analysisId: analysis.analysisId,
                timestamp: Date.now(),
                startTime: performance.now(),
                
                // 生成配置
                pluginInfo: this.extractPluginInfo(analysis),
                codeStructure: {},
                generatedFiles: {},
                
                // 生成结果
                mainCode: '',
                manifestFile: '',
                packageJson: '',
                testFiles: {},
                documentationFiles: {},
                
                // 元数据
                metrics: {},
                quality: {},
                warnings: [],
                suggestions: []
            };
            
            // 第1步：生成插件结构
            await this.generatePluginStructure(generation, analysis);
            
            // 第2步：生成主要代码文件
            await this.generateMainCode(generation, analysis);
            
            // 第3步：生成配置文件
            await this.generateConfigFiles(generation, analysis);
            
            // 第4步：生成测试文件
            if (this.options.includeTests) {
                await this.generateTestFiles(generation, analysis);
            }
            
            // 第5步：生成文档
            if (this.options.includeDocumentation) {
                await this.generateDocumentation(generation, analysis);
            }
            
            // 第6步：使用LLM增强代码
            if (this.options.enableLLMEnhancement && this.llmConfigManager?.isConfigured()) {
                await this.enhanceWithLLM(generation, analysis);
            }
            
            // 第7步：代码验证和优化
            await this.validateAndOptimize(generation);
            
            // 记录生成统计
            generation.endTime = performance.now();
            generation.duration = generation.endTime - generation.startTime;
            this.generationHistory.push(generation);
            
            console.log(`✅ Plugin generated in ${generation.duration.toFixed(2)}ms`);
            
            return {
                success: true,
                generation,
                pluginInfo: generation.pluginInfo,
                files: this.packageGeneratedFiles(generation)
            };
            
        } catch (error) {
            console.error('❌ Plugin generation failed:', error);
            throw error;
        }
    }

    /**
     * 修改已生成的插件
     */
    async modifyPlugin(previousGeneration, userFeedback) {
        try {
            console.log('🔄 Modifying plugin based on feedback...');
            
            const modification = {
                ...previousGeneration,
                modificationId: this.generateId(),
                parentId: previousGeneration.generationId,
                modificationHistory: previousGeneration.modificationHistory || [],
                lastModified: Date.now()
            };
            
            // 记录修改历史
            modification.modificationHistory.push({
                feedback: userFeedback,
                timestamp: Date.now(),
                previousState: { ...previousGeneration }
            });
            
            // 处理用户反馈
            await this.processModificationFeedback(modification, userFeedback);
            
            // 重新生成受影响的部分
            await this.regenerateModifiedParts(modification);
            
            console.log('✅ Plugin modification completed');
            return modification;
            
        } catch (error) {
            console.error('❌ Plugin modification failed:', error);
            throw error;
        }
    }

    /**
     * 提取插件信息
     */
    extractPluginInfo(analysis) {
        return {
            id: this.generatePluginId(analysis),
            name: this.generatePluginName(analysis),
            description: analysis.originalRequirement,
            version: '1.0.0',
            author: 'Auto Generated',
            license: 'MIT',
            
            // 分类信息
            type: analysis.pluginType,
            category: analysis.category,
            domain: analysis.domain,
            
            // 技术信息
            functions: analysis.requiredFunctions,
            permissions: analysis.requiredPermissions || [],
            dependencies: analysis.dependencies || [],
            
            // 元数据
            complexity: analysis.complexity,
            estimatedTime: analysis.estimatedTime,
            tags: this.generateTags(analysis)
        };
    }

    /**
     * 生成插件结构
     */
    async generatePluginStructure(generation, analysis) {
        const structure = {
            root: {
                'plugin.js': 'Main plugin file',
                'manifest.json': 'Plugin manifest',
                'package.json': 'Package configuration',
                'README.md': 'Documentation'
            },
            tests: {},
            docs: {},
            assets: {
                'icon.png': 'Plugin icon',
                'screenshots': 'Screenshot folder'
            }
        };
        
        // 根据插件类型调整结构
        switch (analysis.pluginType) {
            case 'visualization':
                structure.root['styles.css'] = 'Visualization styles';
                structure.assets['templates'] = 'HTML templates';
                break;
                
            case 'utility':
                structure.root['utils.js'] = 'Utility functions';
                break;
                
            case 'function':
                structure.root['executors.js'] = 'Function executors';
                break;
        }
        
        // 添加测试结构
        if (this.options.includeTests) {
            structure.tests = {
                'unit': 'Unit test folder',
                'integration': 'Integration test folder',
                'fixtures': 'Test data folder'
            };
        }
        
        generation.codeStructure = structure;
    }

    /**
     * 生成主要代码
     */
    async generateMainCode(generation, analysis) {
        const template = this.selectTemplate(analysis);
        let code = template.mainCode;
        
        // 替换基本变量
        code = this.replaceTemplateVariables(code, {
            PLUGIN_NAME: generation.pluginInfo.name,
            PLUGIN_ID: generation.pluginInfo.id,
            PLUGIN_DESCRIPTION: generation.pluginInfo.description,
            PLUGIN_VERSION: generation.pluginInfo.version,
            PLUGIN_TYPE: generation.pluginInfo.type,
            CLASS_NAME: this.generateClassName(generation.pluginInfo.name)
        });
        
        // 生成具体功能
        const functions = await this.generateFunctions(analysis);
        const initialization = await this.generateInitialization(analysis);
        const eventHandlers = await this.generateEventHandlers(analysis);
        
        // 组装完整代码
        code = code
            .replace('{{FUNCTIONS}}', functions)
            .replace('{{INITIALIZATION}}', initialization)
            .replace('{{EVENT_HANDLERS}}', eventHandlers);
        
        generation.mainCode = code;
    }

    /**
     * 生成函数代码
     */
    async generateFunctions(analysis) {
        const functions = [];
        
        for (const funcReq of analysis.requiredFunctions) {
            const funcCode = await this.generateSingleFunction(funcReq, analysis);
            functions.push(funcCode);
        }
        
        return functions.join('\n\n');
    }

    /**
     * 生成单个函数
     */
    async generateSingleFunction(funcRequirement, analysis) {
        const template = this.templates.functions[analysis.domain] || this.templates.functions.general;
        
        let funcCode = template.implementation;
        
        // 基于功能类型生成具体实现
        const implementation = await this.generateFunctionImplementation(funcRequirement, analysis);
        
        funcCode = this.replaceTemplateVariables(funcCode, {
            FUNCTION_NAME: funcRequirement.suggestedName || funcRequirement.pattern,
            FUNCTION_DESCRIPTION: `Implements ${funcRequirement.pattern} functionality`,
            FUNCTION_IMPLEMENTATION: implementation,
            PARAMETERS: this.generateParameters(funcRequirement),
            VALIDATION: this.generateParameterValidation(funcRequirement)
        });
        
        return funcCode;
    }

    /**
     * 生成函数实现
     */
    async generateFunctionImplementation(funcRequirement, analysis) {
        const implementations = {
            genomics: {
                analyze: `
                // Genomic analysis implementation
                const sequence = params.sequence || '';
                const results = {
                    length: sequence.length,
                    gcContent: this.calculateGCContent(sequence),
                    composition: this.analyzeComposition(sequence),
                    features: await this.findSequenceFeatures(sequence)
                };
                
                return {
                    success: true,
                    data: results,
                    metadata: {
                        analysisType: 'genomic',
                        timestamp: new Date().toISOString()
                    }
                };`,
                
                calculate: `
                // Genomic calculation implementation
                const region = params.region || {};
                const calculations = {
                    coordinates: this.validateCoordinates(region),
                    statistics: await this.calculateRegionStats(region),
                    annotations: await this.getRegionAnnotations(region)
                };
                
                return {
                    success: true,
                    data: calculations,
                    region: region
                };`
            },
            
            visualization: {
                render: `
                // Visualization rendering implementation
                const data = params.data || [];
                const options = params.options || {};
                
                const visualization = {
                    element: await this.createVisualization(data, options),
                    metadata: this.generateVisualizationMetadata(data, options),
                    exportOptions: this.getExportOptions()
                };
                
                return {
                    success: true,
                    visualization: visualization,
                    interactive: true
                };`,
                
                export: `
                // Export implementation
                const format = params.format || 'png';
                const data = params.data || null;
                
                const exported = await this.exportVisualization(data, format);
                
                return {
                    success: true,
                    exported: exported,
                    format: format,
                    size: exported.size
                };`
            }
        };
        
        const domainImpls = implementations[analysis.domain] || implementations.genomics;
        const funcType = funcRequirement.type || 'analyze';
        
        return domainImpls[funcType] || domainImpls.analyze || `
        // Default implementation for ${funcRequirement.pattern}
        const result = await this.processRequest(params);
        
        return {
            success: true,
            data: result,
            function: '${funcRequirement.pattern}',
            timestamp: new Date().toISOString()
        };`;
    }

    /**
     * 生成配置文件
     */
    async generateConfigFiles(generation, analysis) {
        // 生成 manifest.json
        generation.manifestFile = JSON.stringify({
            id: generation.pluginInfo.id,
            name: generation.pluginInfo.name,
            version: generation.pluginInfo.version,
            description: generation.pluginInfo.description,
            author: generation.pluginInfo.author,
            license: generation.pluginInfo.license,
            main: 'plugin.js',
            type: generation.pluginInfo.type,
            category: generation.pluginInfo.category,
            permissions: generation.pluginInfo.permissions,
            dependencies: generation.pluginInfo.dependencies,
            engines: {
                genomeExplorer: '>=0.3.0'
            },
            keywords: generation.pluginInfo.tags,
            aiIntegration: {
                enabled: true,
                functions: generation.pluginInfo.functions.map(f => f.suggestedName)
            }
        }, null, 2);
        
        // 生成 package.json
        generation.packageJson = JSON.stringify({
            name: generation.pluginInfo.id,
            version: generation.pluginInfo.version,
            description: generation.pluginInfo.description,
            main: 'plugin.js',
            scripts: {
                test: 'jest',
                lint: 'eslint .',
                build: 'webpack --mode production'
            },
            dependencies: this.generateDependencies(analysis),
            devDependencies: {
                jest: '^29.0.0',
                eslint: '^8.0.0',
                webpack: '^5.0.0'
            },
            author: generation.pluginInfo.author,
            license: generation.pluginInfo.license
        }, null, 2);
    }

    /**
     * 生成测试文件
     */
    async generateTestFiles(generation, analysis) {
        const testFiles = {};
        
        // 主测试文件
        testFiles['plugin.test.js'] = this.generateMainTestFile(generation, analysis);
        
        // 功能测试文件
        for (const func of analysis.requiredFunctions) {
            testFiles[`${func.suggestedName}.test.js`] = this.generateFunctionTestFile(func, generation);
        }
        
        // 集成测试文件
        testFiles['integration.test.js'] = this.generateIntegrationTestFile(generation, analysis);
        
        generation.testFiles = testFiles;
    }

    /**
     * 生成主测试文件
     */
    generateMainTestFile(generation, analysis) {
        return `
/**
 * Main test file for ${generation.pluginInfo.name}
 */
const ${this.generateClassName(generation.pluginInfo.name)} = require('../plugin.js');

describe('${generation.pluginInfo.name}', () => {
    let plugin;
    let mockApp;
    let mockAPI;

    beforeEach(() => {
        mockApp = {
            fileManager: { /* mock file manager */ },
            trackRenderer: { /* mock track renderer */ }
        };
        
        mockAPI = {
            ui: { /* mock UI API */ },
            data: { /* mock data API */ },
            ai: { /* mock AI API */ }
        };
        
        plugin = new ${this.generateClassName(generation.pluginInfo.name)}(mockApp, mockAPI);
    });

    test('should initialize correctly', async () => {
        await plugin.initialize();
        expect(plugin.initialized).toBe(true);
    });

    test('should have correct plugin info', () => {
        const info = plugin.getPluginInfo();
        expect(info.name).toBe('${generation.pluginInfo.name}');
        expect(info.version).toBe('${generation.pluginInfo.version}');
        expect(info.type).toBe('${generation.pluginInfo.type}');
    });

    ${analysis.requiredFunctions.map(func => `
    test('should have ${func.suggestedName} function', () => {
        expect(typeof plugin.${func.suggestedName}).toBe('function');
    });`).join('\n')}

    afterEach(() => {
        if (plugin.destroy) {
            plugin.destroy();
        }
    });
});`;
    }

    /**
     * 生成文档
     */
    async generateDocumentation(generation, analysis) {
        const docs = {};
        
        // README.md
        docs['README.md'] = this.generateReadme(generation, analysis);
        
        // API.md
        docs['API.md'] = this.generateAPIDocumentation(generation, analysis);
        
        // CHANGELOG.md
        docs['CHANGELOG.md'] = this.generateChangelog(generation);
        
        generation.documentationFiles = docs;
    }

    /**
     * 生成README
     */
    generateReadme(generation, analysis) {
        return `
# ${generation.pluginInfo.name}

${generation.pluginInfo.description}

## Features

${analysis.requiredFunctions.map(func => `- ${func.pattern}: ${func.suggestedName}`).join('\n')}

## Installation

\`\`\`bash
# Install via Plugin Marketplace
# Or manually copy files to plugins directory
\`\`\`

## Usage

\`\`\`javascript
// Example usage
const result = await plugin.${analysis.requiredFunctions[0]?.suggestedName || 'mainFunction'}({
    // parameters
});
\`\`\`

## API Reference

See [API.md](./API.md) for detailed API documentation.

## License

${generation.pluginInfo.license}
`;
    }

    /**
     * 使用LLM增强代码
     */
    async enhanceWithLLM(generation, analysis) {
        try {
            const prompt = `作为JavaScript和生物信息学专家，请优化以下自动生成的插件代码：

插件信息：
${JSON.stringify(generation.pluginInfo, null, 2)}

需求分析：
${JSON.stringify(analysis, null, 2)}

当前代码：
\`\`\`javascript
${generation.mainCode}
\`\`\`

请提供优化建议和改进的代码：
1. 改进算法和逻辑
2. 增强错误处理
3. 添加性能优化
4. 完善文档注释
5. 确保代码质量和可维护性

请返回优化后的完整代码。`;

            const response = await this.llmConfigManager.sendMessageWithHistory([
                { role: 'user', content: prompt }
            ]);

            // 提取优化后的代码
            const codeMatch = response.match(/```javascript\n([\s\S]*?)\n```/);
            if (codeMatch) {
                generation.mainCode = codeMatch[1];
                generation.llmEnhanced = true;
                generation.llmSuggestions = response;
            }

        } catch (error) {
            console.warn('LLM code enhancement failed:', error);
            generation.warnings.push('LLM enhancement unavailable');
        }
    }

    /**
     * 验证和优化代码
     */
    async validateAndOptimize(generation) {
        const validation = {
            syntaxValid: false,
            structureValid: false,
            performanceOptimized: false,
            securityChecked: false,
            issues: [],
            suggestions: []
        };
        
        try {
            // 语法验证
            new Function(generation.mainCode);
            validation.syntaxValid = true;
        } catch (error) {
            validation.issues.push(`Syntax error: ${error.message}`);
        }
        
        // 结构验证
        const requiredElements = ['class', 'constructor', 'initialize'];
        const missingElements = requiredElements.filter(element => 
            !generation.mainCode.includes(element)
        );
        
        if (missingElements.length === 0) {
            validation.structureValid = true;
        } else {
            validation.issues.push(`Missing elements: ${missingElements.join(', ')}`);
        }
        
        // 性能检查
        if (generation.mainCode.includes('await') && generation.mainCode.includes('Promise.all')) {
            validation.performanceOptimized = true;
        }
        
        // 安全检查
        const securityIssues = this.checkSecurity(generation.mainCode);
        if (securityIssues.length === 0) {
            validation.securityChecked = true;
        } else {
            validation.issues.push(...securityIssues);
        }
        
        generation.quality = validation;
    }

    /**
     * 安全检查
     */
    checkSecurity(code) {
        const issues = [];
        const securityPatterns = [
            { pattern: /eval\s*\(/g, message: 'Avoid using eval()' },
            { pattern: /innerHTML\s*=/g, message: 'Be careful with innerHTML, prefer textContent' },
            { pattern: /document\.write/g, message: 'Avoid document.write' }
        ];
        
        securityPatterns.forEach(({ pattern, message }) => {
            if (pattern.test(code)) {
                issues.push(message);
            }
        });
        
        return issues;
    }

    /**
     * 打包生成的文件
     */
    packageGeneratedFiles(generation) {
        const files = {
            'plugin.js': generation.mainCode,
            'manifest.json': generation.manifestFile,
            'package.json': generation.packageJson
        };
        
        // 添加测试文件
        if (generation.testFiles) {
            Object.keys(generation.testFiles).forEach(filename => {
                files[`tests/${filename}`] = generation.testFiles[filename];
            });
        }
        
        // 添加文档文件
        if (generation.documentationFiles) {
            Object.keys(generation.documentationFiles).forEach(filename => {
                files[filename] = generation.documentationFiles[filename];
            });
        }
        
        return files;
    }

    /**
     * 辅助方法
     */
    generateId() {
        return `gen-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    generatePluginId(analysis) {
        const domain = analysis.domain || 'general';
        const intent = analysis.intent || 'function';
        const timestamp = Date.now().toString(36);
        
        return `${domain}-${intent}-${timestamp}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }

    generatePluginName(analysis) {
        const domain = analysis.domain || 'General';
        const intent = analysis.intent || 'Function';
        
        return `${domain.charAt(0).toUpperCase() + domain.slice(1)} ${intent.charAt(0).toUpperCase() + intent.slice(1)} Plugin`;
    }

    generateClassName(pluginName) {
        return pluginName
            .replace(/[^a-zA-Z0-9\s]/g, '')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('') + 'Plugin';
    }

    generateTags(analysis) {
        const tags = [analysis.domain, analysis.intent, analysis.pluginType];
        if (analysis.complexity === 'high') tags.push('advanced');
        return tags.filter(Boolean);
    }

    generateDependencies(analysis) {
        const deps = {};
        
        analysis.dependencies?.forEach(dep => {
            switch (dep) {
                case 'd3':
                    deps['d3'] = '^7.0.0';
                    break;
                case 'bioinformatics-js':
                    deps['bioinformatics-js'] = '^1.0.0';
                    break;
                case 'ml-js':
                    deps['ml-matrix'] = '^6.0.0';
                    break;
            }
        });
        
        return deps;
    }

    replaceTemplateVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }

    selectTemplate(analysis) {
        const templateKey = `${analysis.domain}-${analysis.pluginType}`;
        return this.templates.main[templateKey] || this.templates.main.default;
    }

    /**
     * 初始化方法
     */
    initializeTemplates() {
        return {
            main: {
                default: {
                    mainCode: `
/**
 * {{PLUGIN_NAME}} - {{PLUGIN_DESCRIPTION}}
 * Auto-generated plugin for GenomeExplorer
 * @version {{PLUGIN_VERSION}}
 */
class {{CLASS_NAME}} {
    constructor(app, api) {
        this.app = app;
        this.api = api;
        this.name = '{{PLUGIN_NAME}}';
        this.version = '{{PLUGIN_VERSION}}';
        this.type = '{{PLUGIN_TYPE}}';
        this.initialized = false;
    }

    async initialize() {
        try {
            {{INITIALIZATION}}
            this.registerFunctions();
            this.setupEventHandlers();
            this.initialized = true;
            console.log(\`\${this.name} initialized successfully\`);
        } catch (error) {
            console.error(\`Failed to initialize \${this.name}:\`, error);
            throw error;
        }
    }

    registerFunctions() {
        {{FUNCTIONS}}
    }

    setupEventHandlers() {
        {{EVENT_HANDLERS}}
    }

    getPluginInfo() {
        return {
            name: this.name,
            version: this.version,
            type: this.type,
            initialized: this.initialized
        };
    }

    async destroy() {
        this.initialized = false;
        console.log(\`\${this.name} destroyed\`);
    }
}

// Export plugin
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {{CLASS_NAME}};
} else if (typeof window !== 'undefined') {
    window.{{CLASS_NAME}} = {{CLASS_NAME}};
}`
                }
            },
            functions: {
                general: {
                    implementation: `
    async {{FUNCTION_NAME}}(params) {
        try {
            // Parameter validation
            {{VALIDATION}}
            
            // Function implementation
            {{FUNCTION_IMPLEMENTATION}}
            
        } catch (error) {
            console.error('{{FUNCTION_NAME}} error:', error);
            return {
                success: false,
                error: error.message,
                function: '{{FUNCTION_NAME}}',
                timestamp: new Date().toISOString()
            };
        }
    }`
                }
            }
        };
    }

    initializeGenerators() {
        return {
            function: new Map(),
            visualization: new Map(),
            utility: new Map()
        };
    }

    initializeValidators() {
        return {
            syntax: [],
            structure: [],
            security: [],
            performance: []
        };
    }

    async loadTemplates() {
        // 加载预定义模板
        console.log('📋 Templates loaded');
    }

    async setupGenerators() {
        // 设置代码生成器
        console.log('⚡ Generators configured');
    }

    getStats() {
        return {
            totalGenerations: this.generationHistory.length,
            averageGenerationTime: this.getAverageGenerationTime(),
            successRate: this.getSuccessRate(),
            templateCacheSize: this.templateCache.size
        };
    }

    getAverageGenerationTime() {
        if (this.generationHistory.length === 0) return 0;
        const total = this.generationHistory.reduce((sum, gen) => sum + (gen.duration || 0), 0);
        return total / this.generationHistory.length;
    }

    getSuccessRate() {
        if (this.generationHistory.length === 0) return 100;
        const successful = this.generationHistory.filter(gen => gen.success !== false).length;
        return (successful / this.generationHistory.length) * 100;
    }

    async destroy() {
        this.generationHistory = [];
        this.templateCache.clear();
        console.log('✅ EnhancedPluginCodeGenerator destroyed');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedPluginCodeGenerator;
} else if (typeof window !== 'undefined') {
    window.EnhancedPluginCodeGenerator = EnhancedPluginCodeGenerator;
}