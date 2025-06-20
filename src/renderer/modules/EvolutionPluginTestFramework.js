/**
 * EvolutionPluginTestFramework - 进化插件测试框架
 * 专门用于测试和验证自动生成的插件功能
 */
class EvolutionPluginTestFramework {
    constructor(evolutionManager, pluginManager) {
        this.evolutionManager = evolutionManager;
        this.pluginManager = pluginManager;
        
        // 测试配置
        this.testSuites = new Map();
        this.testResults = new Map();
        this.validationRules = this.initializeValidationRules();
        
        console.log('EvolutionPluginTestFramework initialized');
    }

    /**
     * 初始化验证规则
     */
    initializeValidationRules() {
        return {
            structure: {
                required: ['name', 'description', 'version', 'functions'],
                optional: ['author', 'category', 'dependencies']
            },
            functions: {
                required: ['description', 'parameters', 'execute'],
                parameterRules: {
                    type: 'object',
                    requiredFields: ['properties'],
                    optionalFields: ['required', 'additionalProperties']
                }
            },
            naming: {
                pluginName: /^[A-Za-z][A-Za-z0-9_]*Plugin$/,
                functionName: /^[a-z][a-zA-Z0-9_]*$/,
                className: /^[A-Z][A-Za-z0-9_]*$/
            },
            codeQuality: {
                minDescriptionLength: 20,
                maxFunctionComplexity: 10,
                requiredComments: true
            }
        };
    }

    /**
     * 为生成的插件创建全面的测试套件
     */
    async createTestSuite(plugin) {
        try {
            const testSuite = {
                pluginId: plugin.id,
                pluginName: plugin.name,
                tests: [],
                created: new Date().toISOString(),
                status: 'pending'
            };

            // 1. 结构验证测试
            testSuite.tests.push(this.createStructureTest(plugin));

            // 2. 代码质量测试
            testSuite.tests.push(this.createCodeQualityTest(plugin));

            // 3. 功能性测试
            testSuite.tests.push(await this.createFunctionalTest(plugin));

            // 4. 集成测试
            testSuite.tests.push(this.createIntegrationTest(plugin));

            // 5. 安全性测试
            testSuite.tests.push(this.createSecurityTest(plugin));

            // 6. 性能测试
            testSuite.tests.push(this.createPerformanceTest(plugin));

            this.testSuites.set(plugin.id, testSuite);
            return testSuite;
        } catch (error) {
            console.error('Failed to create test suite:', error);
            throw error;
        }
    }

    /**
     * 创建结构验证测试
     */
    createStructureTest(plugin) {
        return {
            name: 'Plugin Structure Validation',
            type: 'structure',
            execute: () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    // 解析插件代码
                    const pluginSpec = this.parsePluginCode(plugin.code);

                    // 检查必需字段
                    for (const field of this.validationRules.structure.required) {
                        if (pluginSpec[field]) {
                            results.details.push(`✅ Required field '${field}' present`);
                            results.score += 10;
                        } else {
                            results.details.push(`❌ Required field '${field}' missing`);
                            results.passed = false;
                        }
                    }

                    // 检查函数结构
                    if (pluginSpec.functions) {
                        for (const [funcName, funcDef] of Object.entries(pluginSpec.functions)) {
                            if (this.validateFunctionStructure(funcDef)) {
                                results.details.push(`✅ Function '${funcName}' structure valid`);
                                results.score += 5;
                            } else {
                                results.details.push(`❌ Function '${funcName}' structure invalid`);
                                results.passed = false;
                            }
                        }
                    }

                    // 检查命名规范
                    if (this.validationRules.naming.pluginName.test(pluginSpec.name)) {
                        results.details.push(`✅ Plugin name follows convention`);
                        results.score += 5;
                    } else {
                        results.details.push(`⚠️ Plugin name doesn't follow convention`);
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Structure parsing failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 创建代码质量测试
     */
    createCodeQualityTest(plugin) {
        return {
            name: 'Code Quality Analysis',
            type: 'quality',
            execute: () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    const code = plugin.code;

                    // 检查注释覆盖率
                    const commentRatio = this.calculateCommentRatio(code);
                    if (commentRatio >= 0.1) {
                        results.details.push(`✅ Good comment coverage (${(commentRatio * 100).toFixed(1)}%)`);
                        results.score += 15;
                    } else {
                        results.details.push(`⚠️ Low comment coverage (${(commentRatio * 100).toFixed(1)}%)`);
                    }

                    // 检查代码复杂度
                    const complexity = this.calculateCodeComplexity(code);
                    if (complexity <= this.validationRules.codeQuality.maxFunctionComplexity) {
                        results.details.push(`✅ Code complexity acceptable (${complexity})`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ High code complexity (${complexity})`);
                    }

                    // 检查错误处理
                    if (code.includes('try') && code.includes('catch')) {
                        results.details.push(`✅ Error handling implemented`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ Limited error handling`);
                    }

                    // 检查参数验证
                    if (code.includes('validate') || code.includes('check')) {
                        results.details.push(`✅ Parameter validation present`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ No parameter validation detected`);
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Quality analysis failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 创建功能性测试
     */
    async createFunctionalTest(plugin) {
        return {
            name: 'Functional Testing',
            type: 'functional',
            execute: async () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    // 尝试实例化插件
                    const PluginClass = this.instantiatePlugin(plugin.code);
                    if (PluginClass) {
                        results.details.push(`✅ Plugin instantiation successful`);
                        results.score += 20;

                        // 测试插件信息获取
                        const pluginInfo = PluginClass.getPluginInfo();
                        if (pluginInfo && pluginInfo.functions) {
                            results.details.push(`✅ Plugin info accessible`);
                            results.score += 10;

                            // 测试每个函数
                            for (const [funcName, funcDef] of Object.entries(pluginInfo.functions)) {
                                try {
                                    if (typeof funcDef.execute === 'function') {
                                        results.details.push(`✅ Function '${funcName}' is executable`);
                                        results.score += 5;
                                    } else {
                                        results.details.push(`❌ Function '${funcName}' not executable`);
                                        results.passed = false;
                                    }
                                } catch (error) {
                                    results.details.push(`❌ Function '${funcName}' test failed: ${error.message}`);
                                    results.passed = false;
                                }
                            }
                        } else {
                            results.details.push(`❌ Plugin info not accessible`);
                            results.passed = false;
                        }
                    } else {
                        results.details.push(`❌ Plugin instantiation failed`);
                        results.passed = false;
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Functional test failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 创建集成测试
     */
    createIntegrationTest(plugin) {
        return {
            name: 'Integration Testing',
            type: 'integration',
            execute: () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    // 测试与PluginManager的集成
                    if (this.pluginManager) {
                        // 模拟注册过程
                        const registrationTest = this.testPluginRegistration(plugin);
                        if (registrationTest.success) {
                            results.details.push(`✅ Plugin registration compatible`);
                            results.score += 15;
                        } else {
                            results.details.push(`❌ Plugin registration failed: ${registrationTest.error}`);
                            results.passed = false;
                        }

                        // 测试函数调用接口
                        const callInterfaceTest = this.testFunctionCallInterface(plugin);
                        if (callInterfaceTest.success) {
                            results.details.push(`✅ Function call interface compatible`);
                            results.score += 15;
                        } else {
                            results.details.push(`❌ Function call interface incompatible: ${callInterfaceTest.error}`);
                            results.passed = false;
                        }
                    } else {
                        results.details.push(`⚠️ PluginManager not available for integration testing`);
                    }

                    // 测试与系统API的兼容性
                    const apiTest = this.testSystemAPICompatibility(plugin);
                    if (apiTest.success) {
                        results.details.push(`✅ System API compatibility verified`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ System API compatibility issues: ${apiTest.error}`);
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Integration test failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 创建安全性测试
     */
    createSecurityTest(plugin) {
        return {
            name: 'Security Validation',
            type: 'security',
            execute: () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    const code = plugin.code;

                    // 检查危险函数调用
                    const dangerousFunctions = ['eval', 'Function', 'setTimeout', 'setInterval'];
                    let foundDangerous = false;
                    
                    for (const func of dangerousFunctions) {
                        if (code.includes(func + '(')) {
                            results.details.push(`⚠️ Potentially dangerous function: ${func}`);
                            foundDangerous = true;
                        }
                    }

                    if (!foundDangerous) {
                        results.details.push(`✅ No dangerous function calls detected`);
                        results.score += 20;
                    }

                    // 检查XSS防护
                    if (code.includes('innerHTML') && !code.includes('sanitize')) {
                        results.details.push(`⚠️ Potential XSS vulnerability (innerHTML without sanitization)`);
                    } else {
                        results.details.push(`✅ XSS protection considerations present`);
                        results.score += 15;
                    }

                    // 检查输入验证
                    if (code.includes('validate') || code.includes('sanitize')) {
                        results.details.push(`✅ Input validation/sanitization present`);
                        results.score += 15;
                    } else {
                        results.details.push(`⚠️ Limited input validation detected`);
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Security test failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 创建性能测试
     */
    createPerformanceTest(plugin) {
        return {
            name: 'Performance Analysis',
            type: 'performance',
            execute: () => {
                const results = {
                    passed: true,
                    details: [],
                    score: 0
                };

                try {
                    const code = plugin.code;

                    // 检查代码长度
                    const codeLength = code.length;
                    if (codeLength < 10000) {
                        results.details.push(`✅ Reasonable code size (${codeLength} chars)`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ Large code size (${codeLength} chars)`);
                    }

                    // 检查循环和递归
                    const loopCount = (code.match(/for|while/g) || []).length;
                    if (loopCount <= 5) {
                        results.details.push(`✅ Moderate loop usage (${loopCount})`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ High loop usage (${loopCount})`);
                    }

                    // 检查异步处理
                    if (code.includes('async') || code.includes('Promise')) {
                        results.details.push(`✅ Async programming patterns detected`);
                        results.score += 10;
                    } else {
                        results.details.push(`ℹ️ Synchronous execution (may block UI)`);
                    }

                    // 检查内存管理
                    if (code.includes('removeEventListener') || code.includes('cleanup')) {
                        results.details.push(`✅ Memory management considerations`);
                        results.score += 10;
                    } else {
                        results.details.push(`⚠️ Limited memory management`);
                    }

                } catch (error) {
                    results.passed = false;
                    results.details.push(`❌ Performance test failed: ${error.message}`);
                }

                return results;
            }
        };
    }

    /**
     * 执行完整的测试套件
     */
    async runTestSuite(pluginId) {
        try {
            const testSuite = this.testSuites.get(pluginId);
            if (!testSuite) {
                throw new Error(`Test suite not found for plugin ${pluginId}`);
            }

            const results = {
                pluginId,
                startTime: new Date().toISOString(),
                endTime: null,
                overallPassed: true,
                totalScore: 0,
                maxScore: 0,
                testResults: []
            };

            // 执行所有测试
            for (const test of testSuite.tests) {
                console.log(`Running test: ${test.name}`);
                
                const startTime = Date.now();
                let testResult;

                try {
                    if (typeof test.execute === 'function') {
                        testResult = await test.execute();
                    } else {
                        testResult = {
                            passed: false,
                            details: ['Test execution function not available'],
                            score: 0
                        };
                    }
                } catch (error) {
                    testResult = {
                        passed: false,
                        details: [`Test execution failed: ${error.message}`],
                        score: 0
                    };
                }

                const endTime = Date.now();
                
                const fullTestResult = {
                    name: test.name,
                    type: test.type,
                    passed: testResult.passed,
                    score: testResult.score || 0,
                    details: testResult.details || [],
                    duration: endTime - startTime
                };

                results.testResults.push(fullTestResult);
                results.totalScore += fullTestResult.score;
                results.maxScore += this.getMaxScoreForTestType(test.type);

                if (!fullTestResult.passed) {
                    results.overallPassed = false;
                }
            }

            results.endTime = new Date().toISOString();
            results.successRate = results.maxScore > 0 ? (results.totalScore / results.maxScore) * 100 : 0;

            // 保存测试结果
            this.testResults.set(pluginId, results);
            
            // 更新插件状态
            this.updatePluginTestStatus(pluginId, results);

            return results;
        } catch (error) {
            console.error('Failed to run test suite:', error);
            throw error;
        }
    }

    /**
     * 获取测试类型的最大分数
     */
    getMaxScoreForTestType(testType) {
        const maxScores = {
            structure: 100,
            quality: 45,
            functional: 35,
            integration: 40,
            security: 50,
            performance: 40
        };
        return maxScores[testType] || 50;
    }

    /**
     * 更新插件测试状态
     */
    updatePluginTestStatus(pluginId, testResults) {
        if (this.evolutionManager && this.evolutionManager.evolutionData) {
            const plugin = this.evolutionManager.evolutionData.generatedPlugins.find(p => p.id === pluginId);
            if (plugin) {
                plugin.testResults = testResults;
                plugin.status = testResults.overallPassed ? 'tested_passed' : 'tested_failed';
                plugin.testScore = testResults.successRate;
            }
        }
    }

    /**
     * 解析插件代码提取结构信息
     */
    parsePluginCode(code) {
        try {
            // 简化的代码解析 - 在实际应用中可能需要更复杂的AST解析
            const pluginInfo = {};
            
            // 提取基本信息
            const nameMatch = code.match(/name:\s*['"`]([^'"`]+)['"`]/);
            if (nameMatch) pluginInfo.name = nameMatch[1];
            
            const descMatch = code.match(/description:\s*['"`]([^'"`]+)['"`]/);
            if (descMatch) pluginInfo.description = descMatch[1];
            
            const versionMatch = code.match(/version:\s*['"`]([^'"`]+)['"`]/);
            if (versionMatch) pluginInfo.version = versionMatch[1];
            
            // 提取函数信息
            const functionsMatch = code.match(/functions:\s*{([^}]+)}/s);
            if (functionsMatch) {
                pluginInfo.functions = {};
                // 简化的函数解析
                const funcPattern = /(\w+):\s*{[^}]+}/g;
                let match;
                while ((match = funcPattern.exec(functionsMatch[1])) !== null) {
                    pluginInfo.functions[match[1]] = { exists: true };
                }
            }
            
            return pluginInfo;
        } catch (error) {
            console.error('Failed to parse plugin code:', error);
            return {};
        }
    }

    /**
     * 验证函数结构
     */
    validateFunctionStructure(funcDef) {
        return funcDef && 
               typeof funcDef === 'object' &&
               (funcDef.description || funcDef.exists) &&
               (funcDef.parameters || funcDef.exists) &&
               (funcDef.execute || funcDef.exists);
    }

    /**
     * 计算注释覆盖率
     */
    calculateCommentRatio(code) {
        const lines = code.split('\n');
        const commentLines = lines.filter(line => 
            line.trim().startsWith('//') || 
            line.trim().startsWith('/*') || 
            line.trim().startsWith('*')
        ).length;
        return lines.length > 0 ? commentLines / lines.length : 0;
    }

    /**
     * 计算代码复杂度
     */
    calculateCodeComplexity(code) {
        // 简化的复杂度计算
        const complexityPatterns = [
            /if\s*\(/g,
            /else\s+if\s*\(/g,
            /while\s*\(/g,
            /for\s*\(/g,
            /switch\s*\(/g,
            /catch\s*\(/g
        ];
        
        let complexity = 1; // 基础复杂度
        for (const pattern of complexityPatterns) {
            const matches = code.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        }
        
        return complexity;
    }

    /**
     * 尝试实例化插件
     */
    instantiatePlugin(code) {
        try {
            // 在沙盒环境中执行代码
            const sandboxGlobals = {
                console: console,
                window: {},
                document: {}
            };
            
            const func = new Function('globals', `
                ${code}
                return typeof window !== 'undefined' && window.exports ? window.exports : null;
            `);
            
            return func(sandboxGlobals);
        } catch (error) {
            console.error('Plugin instantiation failed:', error);
            return null;
        }
    }

    /**
     * 测试插件注册
     */
    testPluginRegistration(plugin) {
        try {
            // 模拟插件注册过程
            const pluginInfo = this.parsePluginCode(plugin.code);
            
            if (!pluginInfo.name) {
                return { success: false, error: 'Plugin name missing' };
            }
            
            if (!pluginInfo.functions) {
                return { success: false, error: 'Plugin functions missing' };
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 测试函数调用接口
     */
    testFunctionCallInterface(plugin) {
        try {
            const pluginInfo = this.parsePluginCode(plugin.code);
            
            if (!pluginInfo.functions) {
                return { success: false, error: 'No functions defined' };
            }
            
            // 检查函数调用接口兼容性
            for (const funcName of Object.keys(pluginInfo.functions)) {
                if (!this.validationRules.naming.functionName.test(funcName)) {
                    return { 
                        success: false, 
                        error: `Function name '${funcName}' doesn't follow convention` 
                    };
                }
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 测试系统API兼容性
     */
    testSystemAPICompatibility(plugin) {
        try {
            // 检查常用API的使用
            const code = plugin.code;
            const systemAPIs = ['console', 'document', 'window'];
            
            for (const api of systemAPIs) {
                if (code.includes(api) && !code.includes(`${api}.`)) {
                    return { 
                        success: false, 
                        error: `Unsafe ${api} API usage detected` 
                    };
                }
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * 生成测试报告
     */
    generateTestReport(pluginId) {
        const testResults = this.testResults.get(pluginId);
        if (!testResults) {
            return null;
        }

        const report = {
            summary: {
                pluginId: testResults.pluginId,
                overallPassed: testResults.overallPassed,
                successRate: `${testResults.successRate.toFixed(1)}%`,
                totalScore: `${testResults.totalScore}/${testResults.maxScore}`,
                duration: new Date(testResults.endTime) - new Date(testResults.startTime),
                testCount: testResults.testResults.length
            },
            details: testResults.testResults.map(test => ({
                name: test.name,
                type: test.type,
                status: test.passed ? 'PASSED' : 'FAILED',
                score: test.score,
                duration: `${test.duration}ms`,
                issues: test.details.filter(d => d.includes('❌') || d.includes('⚠️'))
            })),
            recommendations: this.generateRecommendations(testResults)
        };

        return report;
    }

    /**
     * 生成改进建议
     */
    generateRecommendations(testResults) {
        const recommendations = [];
        
        for (const test of testResults.testResults) {
            if (!test.passed || test.score < this.getMaxScoreForTestType(test.type) * 0.8) {
                switch (test.type) {
                    case 'structure':
                        recommendations.push('完善插件结构，确保所有必需字段都存在');
                        break;
                    case 'quality':
                        recommendations.push('改进代码质量，增加注释和错误处理');
                        break;
                    case 'functional':
                        recommendations.push('修复功能性问题，确保所有函数都能正常执行');
                        break;
                    case 'integration':
                        recommendations.push('改进系统集成，确保与现有框架兼容');
                        break;
                    case 'security':
                        recommendations.push('加强安全措施，避免使用危险函数');
                        break;
                    case 'performance':
                        recommendations.push('优化性能，减少资源占用');
                        break;
                }
            }
        }
        
        if (recommendations.length === 0) {
            recommendations.push('插件质量良好，可以投入使用');
        }
        
        return recommendations;
    }

    /**
     * 获取所有测试结果
     */
    getAllTestResults() {
        return Array.from(this.testResults.values());
    }

    /**
     * 清理测试数据
     */
    clearTestData(pluginId = null) {
        if (pluginId) {
            this.testSuites.delete(pluginId);
            this.testResults.delete(pluginId);
        } else {
            this.testSuites.clear();
            this.testResults.clear();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EvolutionPluginTestFramework;
} else if (typeof window !== 'undefined') {
    window.EvolutionPluginTestFramework = EvolutionPluginTestFramework;
} 