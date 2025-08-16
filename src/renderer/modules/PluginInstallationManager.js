/**
 * PluginInstallationManager - 插件自动安装管理器
 * 负责插件的安装、注册、激活和版本管理
 */
class PluginInstallationManager {
    constructor(app) {
        this.app = app;
        this.pluginManagerV2 = app.pluginManagerV2 || window.pluginManagerV2;
        this.configManager = app.configManager;
        
        // 安装配置
        this.installConfig = {
            autoActivate: true,
            backupOriginals: true,
            validateBeforeInstall: true,
            allowOverwrite: false,
            sandboxMode: true
        };
        
        // 安装状态追踪
        this.installations = new Map();
        this.installationHistory = [];
        this.activeInstallations = new Set();
        
        // 文件系统管理
        this.pluginsDirectory = '/plugins/';
        this.backupDirectory = '/plugins/.backup/';
        this.tempDirectory = '/plugins/.temp/';
        
        console.log('PluginInstallationManager initialized');
    }

    async initialize() {
        // 创建必要的目录结构
        await this.createDirectoryStructure();
        
        // 检查现有插件
        await this.scanExistingPlugins();
        
        // 初始化版本管理
        await this.initializeVersionManagement();
        
        console.log('✅ PluginInstallationManager ready');
    }

    /**
     * 安装插件
     */
    async installPlugin(codeGeneration, analysis) {
        try {
            console.log('📦 Starting plugin installation...');
            
            const installation = {
                installationId: this.generateInstallationId(),
                timestamp: Date.now(),
                startTime: performance.now(),
                
                // 安装信息
                pluginInfo: codeGeneration.pluginInfo,
                codeGeneration,
                analysis,
                
                // 安装状态
                status: 'preparing',
                progress: 0,
                steps: [],
                
                // 安装结果
                installedFiles: [],
                registeredFunctions: [],
                errors: [],
                warnings: [],
                
                // 回滚信息
                backupInfo: null,
                rollbackAvailable: false
            };
            
            this.installations.set(installation.installationId, installation);
            this.activeInstallations.add(installation.installationId);
            
            // 第1步：准备安装 (10%)
            installation.status = 'preparing';
            await this.prepareInstallation(installation);
            installation.progress = 10;
            this.updateInstallationProgress(installation);
            
            // 第2步：验证插件 (25%)
            if (this.installConfig.validateBeforeInstall) {
                installation.status = 'validating';
                await this.validateForInstallation(installation);
                installation.progress = 25;
                this.updateInstallationProgress(installation);
            }
            
            // 第3步：备份现有文件 (40%)
            if (this.installConfig.backupOriginals) {
                installation.status = 'backing_up';
                await this.createBackup(installation);
                installation.progress = 40;
                this.updateInstallationProgress(installation);
            }
            
            // 第4步：安装文件 (60%)
            installation.status = 'installing';
            await this.installPluginFiles(installation);
            installation.progress = 60;
            this.updateInstallationProgress(installation);
            
            // 第5步：注册插件 (80%)
            installation.status = 'registering';
            await this.registerPlugin(installation);
            installation.progress = 80;
            this.updateInstallationProgress(installation);
            
            // 第6步：激活插件 (100%)
            if (this.installConfig.autoActivate) {
                installation.status = 'activating';
                await this.activatePlugin(installation);
                installation.progress = 100;
                this.updateInstallationProgress(installation);
            }
            
            // 完成安装
            installation.status = 'completed';
            installation.endTime = performance.now();
            installation.duration = installation.endTime - installation.startTime;
            
            this.activeInstallations.delete(installation.installationId);
            this.installationHistory.push(installation);
            
            console.log(`✅ Plugin installed successfully in ${installation.duration.toFixed(2)}ms`);
            
            return {
                success: true,
                installation,
                pluginInfo: installation.pluginInfo,
                installedAt: installation.timestamp,
                installationId: installation.installationId
            };
            
        } catch (error) {
            console.error('❌ Plugin installation failed:', error);
            
            if (installation) {
                installation.status = 'failed';
                installation.error = error.message;
                installation.endTime = performance.now();
                
                // 尝试回滚
                await this.attemptRollback(installation);
                
                this.activeInstallations.delete(installation.installationId);
            }
            
            throw error;
        }
    }

    /**
     * 准备安装
     */
    async prepareInstallation(installation) {
        const pluginInfo = installation.pluginInfo;
        
        // 检查插件ID冲突
        if (await this.pluginExists(pluginInfo.id)) {
            if (!this.installConfig.allowOverwrite) {
                throw new Error(`Plugin ${pluginInfo.id} already exists. Set allowOverwrite to true to replace it.`);
            }
            installation.warnings.push('Existing plugin will be overwritten');
        }
        
        // 检查依赖
        const dependencyCheck = await this.checkDependencies(pluginInfo.dependencies);
        if (!dependencyCheck.satisfied) {
            throw new Error(`Missing dependencies: ${dependencyCheck.missing.join(', ')}`);
        }
        
        // 创建临时目录
        installation.tempPath = `${this.tempDirectory}${pluginInfo.id}/`;
        await this.createDirectory(installation.tempPath);
        
        installation.steps.push({
            step: 'preparation',
            completed: Date.now(),
            success: true
        });
    }

    /**
     * 验证安装前的插件
     */
    async validateForInstallation(installation) {
        const validation = {
            codeValid: false,
            structureValid: false,
            permissionsValid: false,
            securityPassed: false,
            issues: []
        };
        
        try {
            // 代码语法验证
            new Function(installation.codeGeneration.mainCode);
            validation.codeValid = true;
        } catch (error) {
            validation.issues.push(`Code syntax error: ${error.message}`);
        }
        
        // 插件结构验证
        const structureCheck = this.validatePluginStructure(installation.codeGeneration);
        validation.structureValid = structureCheck.valid;
        if (!structureCheck.valid) {
            validation.issues.push(...structureCheck.issues);
        }
        
        // 权限验证
        const permissionCheck = await this.validatePermissions(installation.pluginInfo.permissions);
        validation.permissionsValid = permissionCheck.valid;
        if (!permissionCheck.valid) {
            validation.issues.push(...permissionCheck.issues);
        }
        
        // 安全检查
        const securityCheck = await this.performSecurityCheck(installation.codeGeneration.mainCode);
        validation.securityPassed = securityCheck.safe;
        if (!securityCheck.safe) {
            validation.issues.push(...securityCheck.issues);
        }
        
        if (validation.issues.length > 0) {
            throw new Error(`Validation failed: ${validation.issues.join('; ')}`);
        }
        
        installation.validationResults = validation;
        installation.steps.push({
            step: 'validation',
            completed: Date.now(),
            success: true,
            details: validation
        });
    }

    /**
     * 创建备份
     */
    async createBackup(installation) {
        const pluginId = installation.pluginInfo.id;
        const existingPlugin = await this.findExistingPlugin(pluginId);
        
        if (existingPlugin) {
            const backupId = `${pluginId}_backup_${Date.now()}`;
            const backupPath = `${this.backupDirectory}${backupId}/`;
            
            await this.createDirectory(backupPath);
            
            // 备份现有插件文件
            const backupFiles = await this.copyPluginFiles(existingPlugin.path, backupPath);
            
            installation.backupInfo = {
                backupId,
                backupPath,
                originalPath: existingPlugin.path,
                backedUpFiles: backupFiles,
                timestamp: Date.now()
            };
            
            installation.rollbackAvailable = true;
            
            installation.steps.push({
                step: 'backup',
                completed: Date.now(),
                success: true,
                details: { backupId, fileCount: backupFiles.length }
            });
        }
    }

    /**
     * 安装插件文件
     */
    async installPluginFiles(installation) {
        const pluginId = installation.pluginInfo.id;
        const installPath = `${this.pluginsDirectory}${pluginId}/`;
        
        // 创建插件目录
        await this.createDirectory(installPath);
        
        const files = installation.codeGeneration.files || this.generateFileStructure(installation.codeGeneration);
        const installedFiles = [];
        
        for (const [filename, content] of Object.entries(files)) {
            try {
                const filePath = `${installPath}${filename}`;
                await this.writeFile(filePath, content);
                installedFiles.push({
                    filename,
                    path: filePath,
                    size: content.length,
                    timestamp: Date.now()
                });
            } catch (error) {
                installation.errors.push(`Failed to install ${filename}: ${error.message}`);
            }
        }
        
        installation.installedFiles = installedFiles;
        installation.installPath = installPath;
        
        installation.steps.push({
            step: 'file_installation',
            completed: Date.now(),
            success: installation.errors.length === 0,
            details: { fileCount: installedFiles.length, path: installPath }
        });
        
        if (installation.errors.length > 0) {
            throw new Error(`File installation failed: ${installation.errors.join('; ')}`);
        }
    }

    /**
     * 注册插件
     */
    async registerPlugin(installation) {
        const pluginInfo = installation.pluginInfo;
        
        try {
            // 加载插件代码
            const PluginClass = await this.loadPluginClass(installation);
            
            // 创建插件实例进行测试
            const testInstance = new PluginClass(this.createMockApp(), this.createMockAPI());
            await testInstance.initialize();
            
            // 在插件管理器中注册
            if (this.pluginManagerV2) {
                const pluginDefinition = {
                    type: pluginInfo.type,
                    name: pluginInfo.name,
                    description: pluginInfo.description,
                    version: pluginInfo.version,
                    author: pluginInfo.author,
                    category: pluginInfo.category,
                    functions: this.extractFunctionDefinitions(installation),
                    permissions: pluginInfo.permissions,
                    dependencies: pluginInfo.dependencies,
                    enabled: true,
                    installPath: installation.installPath,
                    installationId: installation.installationId
                };
                
                await this.pluginManagerV2.registerPlugin(pluginInfo.id, pluginDefinition);
                
                installation.registeredFunctions = Object.keys(pluginDefinition.functions || {});
            }
            
            // 更新插件注册表
            await this.updatePluginRegistry(pluginInfo.id, {
                ...pluginInfo,
                installPath: installation.installPath,
                installedAt: installation.timestamp,
                status: 'installed'
            });
            
            installation.steps.push({
                step: 'registration',
                completed: Date.now(),
                success: true,
                details: { functionsRegistered: installation.registeredFunctions.length }
            });
            
        } catch (error) {
            installation.errors.push(`Registration failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * 激活插件
     */
    async activatePlugin(installation) {
        try {
            const pluginId = installation.pluginInfo.id;
            
            // 在插件管理器中激活
            if (this.pluginManagerV2) {
                const plugin = this.pluginManagerV2.getPlugin(pluginId);
                if (plugin) {
                    plugin.enabled = true;
                    
                    // 初始化插件
                    const PluginClass = await this.loadPluginClass(installation);
                    const pluginInstance = new PluginClass(this.app, this.createPluginAPI());
                    await pluginInstance.initialize();
                    
                    // 存储插件实例引用
                    installation.pluginInstance = pluginInstance;
                }
            }
            
            // 更新状态
            await this.updatePluginStatus(pluginId, 'active');
            
            installation.steps.push({
                step: 'activation',
                completed: Date.now(),
                success: true
            });
            
            console.log(`✅ Plugin ${pluginId} activated successfully`);
            
        } catch (error) {
            installation.warnings.push(`Activation failed: ${error.message}`);
            // 激活失败不应该导致整个安装失败
        }
    }

    /**
     * 卸载插件
     */
    async uninstallPlugin(pluginId) {
        try {
            console.log(`🗑️ Uninstalling plugin: ${pluginId}`);
            
            const plugin = await this.findExistingPlugin(pluginId);
            if (!plugin) {
                throw new Error(`Plugin ${pluginId} not found`);
            }
            
            // 停用插件
            await this.deactivatePlugin(pluginId);
            
            // 从插件管理器中注销
            if (this.pluginManagerV2) {
                // 这里需要添加注销功能到PluginManagerV2
                console.log(`Unregistering plugin ${pluginId} from PluginManagerV2`);
            }
            
            // 删除插件文件
            await this.removePluginFiles(plugin.path);
            
            // 更新注册表
            await this.removeFromPluginRegistry(pluginId);
            
            console.log(`✅ Plugin ${pluginId} uninstalled successfully`);
            
            return {
                success: true,
                pluginId,
                uninstalledAt: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Failed to uninstall plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * 回滚安装
     */
    async attemptRollback(installation) {
        if (!installation.rollbackAvailable || !installation.backupInfo) {
            console.log('No rollback information available');
            return false;
        }
        
        try {
            console.log('🔄 Attempting installation rollback...');
            
            const backupInfo = installation.backupInfo;
            
            // 删除已安装的文件
            if (installation.installPath) {
                await this.removeDirectory(installation.installPath);
            }
            
            // 恢复备份文件
            await this.restoreFromBackup(backupInfo);
            
            console.log('✅ Installation rollback completed');
            return true;
            
        } catch (error) {
            console.error('❌ Rollback failed:', error);
            return false;
        }
    }

    /**
     * 版本管理
     */
    async updatePlugin(pluginId, newVersion) {
        try {
            console.log(`🔄 Updating plugin ${pluginId} to version ${newVersion.version}`);
            
            const existingPlugin = await this.findExistingPlugin(pluginId);
            if (!existingPlugin) {
                throw new Error(`Plugin ${pluginId} not found`);
            }
            
            // 创建更新备份
            const backupResult = await this.createUpdateBackup(existingPlugin);
            
            // 安装新版本
            const updateResult = await this.installPlugin(newVersion.codeGeneration, newVersion.analysis);
            
            // 记录更新历史
            await this.recordUpdate(pluginId, {
                fromVersion: existingPlugin.version,
                toVersion: newVersion.version,
                updatedAt: Date.now(),
                backupId: backupResult.backupId,
                installationId: updateResult.installationId
            });
            
            return updateResult;
            
        } catch (error) {
            console.error(`❌ Plugin update failed:`, error);
            throw error;
        }
    }

    /**
     * 辅助方法
     */
    generateFileStructure(codeGeneration) {
        const files = {};
        
        files['plugin.js'] = codeGeneration.mainCode;
        
        if (codeGeneration.manifestFile) {
            files['manifest.json'] = codeGeneration.manifestFile;
        }
        
        if (codeGeneration.packageJson) {
            files['package.json'] = codeGeneration.packageJson;
        }
        
        // 添加测试文件
        if (codeGeneration.testFiles) {
            Object.keys(codeGeneration.testFiles).forEach(filename => {
                files[`tests/${filename}`] = codeGeneration.testFiles[filename];
            });
        }
        
        // 添加文档文件
        if (codeGeneration.documentationFiles) {
            Object.keys(codeGeneration.documentationFiles).forEach(filename => {
                files[filename] = codeGeneration.documentationFiles[filename];
            });
        }
        
        return files;
    }

    async loadPluginClass(installation) {
        // 在实际环境中加载插件代码
        const code = installation.codeGeneration.mainCode;
        const className = this.extractClassName(code);
        
        // 创建安全的执行环境
        const sandbox = this.createPluginSandbox();
        const func = new Function(...Object.keys(sandbox), code + `\nreturn ${className};`);
        
        return func(...Object.values(sandbox));
    }

    createPluginSandbox() {
        return {
            console: console,
            setTimeout: setTimeout,
            setInterval: setInterval,
            clearTimeout: clearTimeout,
            clearInterval: clearInterval,
            Promise: Promise,
            Date: Date,
            Math: Math,
            JSON: JSON,
            Object: Object,
            Array: Array,
            String: String,
            Number: Number,
            Boolean: Boolean,
            RegExp: RegExp,
            Error: Error
        };
    }

    extractClassName(code) {
        const match = code.match(/class\s+(\w+)/);
        return match ? match[1] : 'UnknownPlugin';
    }

    extractFunctionDefinitions(installation) {
        const functions = {};
        const pluginInfo = installation.pluginInfo;
        
        if (pluginInfo.functions) {
            pluginInfo.functions.forEach(func => {
                functions[func.suggestedName || func.pattern] = {
                    description: `${func.pattern} functionality`,
                    parameters: {
                        type: 'object',
                        properties: {},
                        required: []
                    },
                    execute: `this.${func.suggestedName || func.pattern}.bind(this)`
                };
            });
        }
        
        return functions;
    }

    createMockApp() {
        return {
            fileManager: {
                readFile: async () => 'mock content',
                writeFile: async () => true,
                exists: async () => true
            },
            trackRenderer: {
                addTrack: () => ({ id: 'mock-track' }),
                removeTrack: () => true
            }
        };
    }

    createMockAPI() {
        return {
            ui: {
                addMenuItem: () => ({ id: 'mock-menu' }),
                createPanel: () => ({
                    show: () => true,
                    hide: () => true
                })
            },
            data: {
                getCurrentGenome: () => ({ name: 'test-genome' }),
                getSelectedRegion: () => ({ chromosome: 'chr1', start: 1000, end: 2000 })
            },
            ai: {
                registerFunction: () => true
            }
        };
    }

    createPluginAPI() {
        // 返回实际的插件API
        return {
            ui: this.app.uiManager || {},
            data: this.app.dataManager || {},
            ai: this.app.aiManager || {}
        };
    }

    async pluginExists(pluginId) {
        // 检查插件是否已存在
        return this.pluginManagerV2?.getPlugin(pluginId) !== null;
    }

    async checkDependencies(dependencies = []) {
        const missing = [];
        const satisfied = [];
        
        for (const dep of dependencies) {
            // 在实际实现中检查依赖是否可用
            if (this.isDependencyAvailable(dep)) {
                satisfied.push(dep);
            } else {
                missing.push(dep);
            }
        }
        
        return {
            satisfied: missing.length === 0,
            missing,
            satisfied
        };
    }

    isDependencyAvailable(dependency) {
        // 简化实现，实际应该检查具体的依赖
        const commonDependencies = ['d3', 'lodash', 'moment'];
        return commonDependencies.includes(dependency);
    }

    validatePluginStructure(codeGeneration) {
        const code = codeGeneration.mainCode;
        const issues = [];
        
        // 检查必需的元素
        const required = ['class', 'constructor', 'initialize'];
        required.forEach(element => {
            if (!code.includes(element)) {
                issues.push(`Missing required element: ${element}`);
            }
        });
        
        return {
            valid: issues.length === 0,
            issues
        };
    }

    async validatePermissions(permissions = []) {
        // 验证权限请求是否合理
        const validPermissions = [
            'file-access', 'network-access', 'genome-data', 
            'ui-modification', 'system-integration'
        ];
        
        const invalid = permissions.filter(p => !validPermissions.includes(p));
        
        return {
            valid: invalid.length === 0,
            issues: invalid.map(p => `Invalid permission: ${p}`)
        };
    }

    async performSecurityCheck(code) {
        const issues = [];
        
        // 简单的安全检查
        const dangerousPatterns = [
            { pattern: /eval\s*\(/g, message: 'eval() usage detected' },
            { pattern: /Function\s*\(/g, message: 'Function constructor usage detected' },
            { pattern: /document\.write/g, message: 'document.write usage detected' }
        ];
        
        dangerousPatterns.forEach(({ pattern, message }) => {
            if (pattern.test(code)) {
                issues.push(message);
            }
        });
        
        return {
            safe: issues.length === 0,
            issues
        };
    }

    // 文件系统操作方法（简化实现）
    async createDirectory(path) {
        console.log(`Creating directory: ${path}`);
        return true;
    }

    async removeDirectory(path) {
        console.log(`Removing directory: ${path}`);
        return true;
    }

    async writeFile(path, content) {
        console.log(`Writing file: ${path} (${content.length} bytes)`);
        return true;
    }

    async readFile(path) {
        console.log(`Reading file: ${path}`);
        return 'file content';
    }

    async copyPluginFiles(sourcePath, destPath) {
        console.log(`Copying files from ${sourcePath} to ${destPath}`);
        return ['plugin.js', 'manifest.json', 'package.json'];
    }

    async removePluginFiles(path) {
        console.log(`Removing plugin files at: ${path}`);
        return true;
    }

    async findExistingPlugin(pluginId) {
        // 查找现有插件
        if (this.pluginManagerV2) {
            const plugin = this.pluginManagerV2.getPlugin(pluginId);
            if (plugin) {
                return {
                    id: pluginId,
                    version: plugin.version,
                    path: plugin.installPath || `${this.pluginsDirectory}${pluginId}/`
                };
            }
        }
        return null;
    }

    async updatePluginRegistry(pluginId, pluginInfo) {
        console.log(`Updating plugin registry for: ${pluginId}`);
        return true;
    }

    async removeFromPluginRegistry(pluginId) {
        console.log(`Removing from plugin registry: ${pluginId}`);
        return true;
    }

    async updatePluginStatus(pluginId, status) {
        console.log(`Updating plugin status: ${pluginId} -> ${status}`);
        return true;
    }

    async deactivatePlugin(pluginId) {
        console.log(`Deactivating plugin: ${pluginId}`);
        
        if (this.pluginManagerV2) {
            const plugin = this.pluginManagerV2.getPlugin(pluginId);
            if (plugin) {
                plugin.enabled = false;
            }
        }
        
        return true;
    }

    async createDirectoryStructure() {
        const directories = [
            this.pluginsDirectory,
            this.backupDirectory,
            this.tempDirectory
        ];
        
        for (const dir of directories) {
            await this.createDirectory(dir);
        }
    }

    async scanExistingPlugins() {
        console.log('Scanning existing plugins...');
        // 在实际实现中扫描插件目录
        return [];
    }

    async initializeVersionManagement() {
        console.log('Initializing version management...');
        return true;
    }

    generateInstallationId() {
        return `install-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    }

    updateInstallationProgress(installation) {
        console.log(`Installation progress: ${installation.progress}% (${installation.status})`);
    }

    getStats() {
        return {
            activeInstallations: this.activeInstallations.size,
            totalInstallations: this.installations.size,
            installationHistory: this.installationHistory.length,
            pluginsDirectory: this.pluginsDirectory
        };
    }

    async destroy() {
        this.installations.clear();
        this.installationHistory = [];
        this.activeInstallations.clear();
        console.log('✅ PluginInstallationManager destroyed');
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginInstallationManager;
} else if (typeof window !== 'undefined') {
    window.PluginInstallationManager = PluginInstallationManager;
}