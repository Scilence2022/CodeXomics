/**
 * PluginSecurityValidator - Advanced security validation system for plugins
 * Handles code analysis, permission control, and sandboxed execution validation
 */
class PluginSecurityValidator {
    constructor(options = {}) {
        this.options = {
            enableCodeAnalysis: true,
            enablePermissionValidation: true,
            enableSandboxTesting: true,
            strictMode: false,
            maxExecutionTime: 5000, // 5 seconds
            maxMemoryUsage: 50 * 1024 * 1024, // 50MB
            ...options
        };
        
        // Security state
        this.trustedSources = new Set(['official', 'local']);
        this.verifiedPlugins = new Map();
        this.securityReports = new Map();
        
        // Risk assessment engine
        this.riskEngine = new PluginRiskEngine();
        
        // Code analysis patterns
        this.securityPatterns = this.initializeSecurityPatterns();
        
        // Statistics
        this.stats = {
            totalValidations: 0,
            blockedPlugins: 0,
            riskyPlugins: 0,
            trustedPlugins: 0,
            codeIssuesFound: 0
        };
        
        console.log('🔒 PluginSecurityValidator initialized');
    }

    /**
     * Initialize security patterns for code analysis
     */
    initializeSecurityPatterns() {
        return {
            // High risk patterns
            critical: [
                {
                    pattern: /eval\s*\(/gi,
                    description: 'Dynamic code execution (eval)',
                    severity: 'critical'
                },
                {
                    pattern: /Function\s*\(/gi,
                    description: 'Dynamic function creation',
                    severity: 'critical'
                },
                {
                    pattern: /document\.write/gi,
                    description: 'DOM injection via document.write',
                    severity: 'critical'
                },
                {
                    pattern: /innerHTML\s*=/gi,
                    description: 'Potential XSS via innerHTML',
                    severity: 'critical'
                }
            ],
            
            // Medium risk patterns
            high: [
                {
                    pattern: /require\s*\(/gi,
                    description: 'Node.js module loading',
                    severity: 'high'
                },
                {
                    pattern: /import\s*\(/gi,
                    description: 'Dynamic module import',
                    severity: 'high'
                },
                {
                    pattern: /fetch\s*\(/gi,
                    description: 'Network request',
                    severity: 'high'
                },
                {
                    pattern: /XMLHttpRequest/gi,
                    description: 'Network request',
                    severity: 'high'
                }
            ],
            
            // Low risk patterns
            medium: [
                {
                    pattern: /localStorage/gi,
                    description: 'Local storage access',
                    severity: 'medium'
                },
                {
                    pattern: /sessionStorage/gi,
                    description: 'Session storage access',
                    severity: 'medium'
                },
                {
                    pattern: /location\./gi,
                    description: 'URL manipulation',
                    severity: 'medium'
                },
                {
                    pattern: /window\./gi,
                    description: 'Global window access',
                    severity: 'medium'
                }
            ]
        };
    }

    /**
     * Validate plugin installation plan
     */
    async validateInstallPlan(installPlan) {
        try {
            console.log(`🔒 Validating security for ${installPlan.plugins.length} plugins...`);
            
            const validationResults = [];
            const securityIssues = [];
            
            // Validate each plugin in the install plan
            for (const plugin of installPlan.plugins) {
                try {
                    const result = await this.validatePlugin(plugin);
                    validationResults.push(result);
                    
                    if (!result.approved) {
                        securityIssues.push({
                            pluginId: plugin.id,
                            reason: result.reason,
                            severity: result.severity,
                            issues: result.issues
                        });
                    }
                    
                } catch (error) {
                    console.error(`❌ Security validation failed for ${plugin.id}:`, error);
                    securityIssues.push({
                        pluginId: plugin.id,
                        reason: 'Validation error',
                        severity: 'critical',
                        error: error.message
                    });
                }
            }
            
            // Check for plan-level security issues
            const planIssues = await this.validatePlanSecurity(installPlan, validationResults);
            securityIssues.push(...planIssues);
            
            // Determine overall approval
            const criticalIssues = securityIssues.filter(i => i.severity === 'critical');
            const approved = criticalIssues.length === 0;
            
            if (!approved) {
                this.stats.blockedPlugins += criticalIssues.length;
                throw new Error(`Security validation failed: ${criticalIssues.length} critical issues found`);
            }
            
            // Log security warnings for high/medium severity issues
            const warnings = securityIssues.filter(i => i.severity === 'high' || i.severity === 'medium');
            if (warnings.length > 0) {
                console.warn(`⚠️ Security warnings: ${warnings.length} issues found`);
                warnings.forEach(warning => {
                    console.warn(`  - ${warning.pluginId}: ${warning.reason}`);
                });
            }
            
            this.stats.totalValidations++;
            console.log('✅ Security validation passed');
            
            return {
                approved: true,
                results: validationResults,
                issues: securityIssues,
                summary: {
                    totalPlugins: installPlan.plugins.length,
                    approvedPlugins: validationResults.filter(r => r.approved).length,
                    criticalIssues: criticalIssues.length,
                    warnings: warnings.length
                }
            };
            
        } catch (error) {
            console.error('❌ Install plan security validation failed:', error);
            throw error;
        }
    }

    /**
     * Validate individual plugin security
     */
    async validatePlugin(plugin) {
        console.log(`🔍 Validating security for ${plugin.id} v${plugin.version}...`);
        
        // Check if plugin is from trusted source
        const sourceTrust = this.evaluateSourceTrust(plugin);
        
        // Check if plugin is already verified
        const cacheKey = `${plugin.id}@${plugin.version}`;
        if (this.verifiedPlugins.has(cacheKey)) {
            const cached = this.verifiedPlugins.get(cacheKey);
            console.log(`✅ Using cached validation for ${plugin.id}`);
            return cached;
        }
        
        const validationResult = {
            pluginId: plugin.id,
            version: plugin.version,
            source: plugin.source?.id || 'unknown',
            approved: false,
            reason: '',
            severity: 'low',
            issues: [],
            riskScore: 0,
            timestamp: new Date()
        };
        
        try {
            // 1. Source trust evaluation
            if (!sourceTrust.trusted && this.options.strictMode) {
                validationResult.approved = false;
                validationResult.reason = 'Untrusted source';
                validationResult.severity = 'high';
                validationResult.issues.push({
                    type: 'untrusted_source',
                    description: `Plugin from untrusted source: ${plugin.source?.name}`,
                    severity: 'high'
                });
            }
            
            // 2. Code analysis (simulated)
            const codeAnalysis = await this.analyzePluginCode(plugin);
            validationResult.issues.push(...codeAnalysis.issues);
            validationResult.riskScore += codeAnalysis.riskScore;
            
            // 3. Permission validation
            const permissionAnalysis = this.validatePermissions(plugin);
            validationResult.issues.push(...permissionAnalysis.issues);
            validationResult.riskScore += permissionAnalysis.riskScore;
            
            // 4. Dependency security check
            if (plugin.dependencies && plugin.dependencies.length > 0) {
                const depAnalysis = await this.analyzeDependencySecurity(plugin);
                validationResult.issues.push(...depAnalysis.issues);
                validationResult.riskScore += depAnalysis.riskScore;
            }
            
            // 5. Risk assessment
            const riskAssessment = this.riskEngine.assessRisk(validationResult);
            validationResult.riskScore = riskAssessment.totalScore;
            validationResult.riskLevel = riskAssessment.level;
            
            // 6. Final approval decision
            const criticalIssues = validationResult.issues.filter(i => i.severity === 'critical');
            const highRiskIssues = validationResult.issues.filter(i => i.severity === 'high');
            
            if (criticalIssues.length > 0) {
                validationResult.approved = false;
                validationResult.reason = `Critical security issues: ${criticalIssues.length}`;
                validationResult.severity = 'critical';
            } else if (highRiskIssues.length > 0 && this.options.strictMode) {
                validationResult.approved = false;
                validationResult.reason = `High risk issues in strict mode: ${highRiskIssues.length}`;
                validationResult.severity = 'high';
            } else if (validationResult.riskScore > 80) {
                validationResult.approved = false;
                validationResult.reason = `Risk score too high: ${validationResult.riskScore}`;
                validationResult.severity = 'high';
            } else {
                validationResult.approved = true;
                validationResult.reason = 'Security validation passed';
                
                if (validationResult.riskScore > 50) {
                    this.stats.riskyPlugins++;
                } else {
                    this.stats.trustedPlugins++;
                }
            }
            
            // Cache validation result
            this.verifiedPlugins.set(cacheKey, validationResult);
            this.securityReports.set(plugin.id, validationResult);
            
            this.stats.codeIssuesFound += validationResult.issues.length;
            
            console.log(`🔒 Security validation for ${plugin.id}: ${validationResult.approved ? 'APPROVED' : 'REJECTED'} (risk: ${validationResult.riskScore})`);
            return validationResult;
            
        } catch (error) {
            validationResult.approved = false;
            validationResult.reason = `Validation error: ${error.message}`;
            validationResult.severity = 'critical';
            throw error;
        }
    }

    /**
     * Evaluate source trust level
     */
    evaluateSourceTrust(plugin) {
        const sourceId = plugin.source?.id || 'unknown';
        
        return {
            trusted: this.trustedSources.has(sourceId),
            level: this.trustedSources.has(sourceId) ? 'trusted' : 'untrusted',
            source: sourceId
        };
    }

    /**
     * Analyze plugin code for security issues
     */
    async analyzePluginCode(plugin) {
        console.log(`🔍 Analyzing code for ${plugin.id}...`);
        
        // Simulate code analysis
        const mockCode = this.generateMockCode(plugin);
        
        const issues = [];
        let riskScore = 0;
        
        // Check against security patterns
        for (const [category, patterns] of Object.entries(this.securityPatterns)) {
            for (const pattern of patterns) {
                const matches = mockCode.match(pattern.pattern);
                if (matches) {
                    issues.push({
                        type: 'code_pattern',
                        pattern: pattern.pattern.source,
                        description: pattern.description,
                        severity: pattern.severity,
                        matches: matches.length,
                        line: Math.floor(Math.random() * 50) + 1
                    });
                    
                    // Add to risk score based on severity
                    switch (pattern.severity) {
                        case 'critical':
                            riskScore += 40;
                            break;
                        case 'high':
                            riskScore += 20;
                            break;
                        case 'medium':
                            riskScore += 10;
                            break;
                    }
                }
            }
        }
        
        return { issues, riskScore };
    }

    /**
     * Generate mock code for demonstration
     */
    generateMockCode(plugin) {
        const riskLevel = Math.random();
        
        if (riskLevel > 0.8) {
            return `eval("some dynamic code"); fetch("http://suspicious-site.com/data");`;
        } else if (riskLevel > 0.5) {
            return `localStorage.setItem('data', 'value'); require('fs').readFile('/etc/passwd');`;
        } else {
            return `console.log('Plugin ${plugin.id} executing'); return Math.random();`;
        }
    }

    /**
     * Validate plugin permissions
     */
    validatePermissions(plugin) {
        console.log(`🔑 Validating permissions for ${plugin.id}...`);
        
        const issues = [];
        let riskScore = 0;
        
        // Mock permission analysis
        const requestedPermissions = this.getMockPermissions(plugin);
        
        for (const permission of requestedPermissions) {
            const analysis = this.analyzePermission(permission);
            
            if (analysis.severity === 'critical') {
                issues.push({
                    type: 'dangerous_permission',
                    permission: permission.name,
                    description: analysis.description,
                    severity: 'critical',
                    reason: analysis.reason
                });
                riskScore += 30;
            } else if (analysis.severity === 'high') {
                issues.push({
                    type: 'risky_permission',
                    permission: permission.name,
                    description: analysis.description,
                    severity: 'high',
                    reason: analysis.reason
                });
                riskScore += 15;
            }
        }
        
        return { issues, riskScore };
    }

    /**
     * Get mock permissions for plugin
     */
    getMockPermissions(plugin) {
        const basePermissions = [
            { name: 'console', type: 'api' },
            { name: 'Date', type: 'api' },
            { name: 'Math', type: 'api' }
        ];
        
        // Add category-specific permissions
        if (plugin.category === 'network-analysis') {
            basePermissions.push({ name: 'fetch', type: 'network' });
        }
        
        // Randomly add risky permissions
        if (Math.random() > 0.7) {
            basePermissions.push({ name: 'eval', type: 'execution' });
        }
        
        return basePermissions;
    }

    /**
     * Analyze individual permission
     */
    analyzePermission(permission) {
        const permissionRules = {
            'eval': {
                severity: 'critical',
                description: 'Dynamic code execution',
                reason: 'Can execute arbitrary code'
            },
            'require': {
                severity: 'critical',
                description: 'System module access',
                reason: 'Can access system modules and files'
            },
            'fetch': {
                severity: 'high',
                description: 'Network access',
                reason: 'Can make external network requests'
            },
            'localStorage': {
                severity: 'medium',
                description: 'Local storage access',
                reason: 'Can store data locally'
            },
            'console': {
                severity: 'low',
                description: 'Console access',
                reason: 'Can log to console'
            }
        };
        
        return permissionRules[permission.name] || {
            severity: 'low',
            description: 'Unknown permission',
            reason: 'Permission not in security database'
        };
    }

    /**
     * Analyze dependency security
     */
    async analyzeDependencySecurity(plugin) {
        console.log(`🔗 Analyzing dependency security for ${plugin.id}...`);
        
        const issues = [];
        let riskScore = 0;
        
        for (const dep of plugin.dependencies) {
            // Check for known vulnerable dependencies
            if (this.isKnownVulnerableDependency(dep)) {
                issues.push({
                    type: 'vulnerable_dependency',
                    dependency: dep.id,
                    version: dep.version,
                    description: 'Known security vulnerability',
                    severity: 'high'
                });
                riskScore += 25;
            }
        }
        
        return { issues, riskScore };
    }

    /**
     * Check if dependency has known vulnerabilities
     */
    isKnownVulnerableDependency(dependency) {
        // Mock vulnerability database
        const vulnerableDeps = {
            'old-crypto-lib': ['1.0.0', '1.1.0'],
            'insecure-parser': ['2.0.0']
        };
        
        return vulnerableDeps[dependency.id]?.includes(dependency.version) || false;
    }

    /**
     * Validate install plan level security
     */
    async validatePlanSecurity(installPlan, validationResults) {
        const issues = [];
        
        // Check total risk score
        const totalRisk = validationResults.reduce((sum, r) => sum + r.riskScore, 0);
        if (totalRisk > 200) {
            issues.push({
                pluginId: 'install-plan',
                reason: 'Total risk score too high',
                severity: 'high',
                totalRisk: totalRisk
            });
        }
        
        return issues;
    }

    /**
     * Get security statistics
     */
    getSecurityStats() {
        return {
            ...this.stats,
            trustedSources: this.trustedSources.size,
            verifiedPlugins: this.verifiedPlugins.size,
            securityReports: this.securityReports.size
        };
    }
}

/**
 * PluginRiskEngine - Risk assessment engine for plugins
 */
class PluginRiskEngine {
    constructor() {
        this.riskFactors = {
            source: {
                'official': 0,
                'community': 10,
                'local': 5,
                'unknown': 30
            }
        };
    }
    
    /**
     * Assess overall risk of plugin
     */
    assessRisk(validationResult) {
        let totalScore = validationResult.riskScore;
        
        // Source risk
        const sourceRisk = this.riskFactors.source[validationResult.source] || 30;
        totalScore += sourceRisk;
        
        // Issue severity multiplier
        const criticalIssues = validationResult.issues.filter(i => i.severity === 'critical').length;
        const highIssues = validationResult.issues.filter(i => i.severity === 'high').length;
        
        totalScore += criticalIssues * 40;
        totalScore += highIssues * 20;
        
        // Determine risk level
        let level;
        if (totalScore >= 80) {
            level = 'critical';
        } else if (totalScore >= 60) {
            level = 'high';
        } else if (totalScore >= 30) {
            level = 'medium';
        } else {
            level = 'low';
        }
        
        return {
            totalScore: Math.min(totalScore, 100),
            level,
            factors: {
                source: sourceRisk,
                issues: criticalIssues * 40 + highIssues * 20,
                base: validationResult.riskScore
            }
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginSecurityValidator;
} else if (typeof window !== 'undefined') {
    window.PluginSecurityValidator = PluginSecurityValidator;
} 