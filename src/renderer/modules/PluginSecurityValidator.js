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
      ...options,
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
      codeIssuesFound: 0,
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
          severity: 'critical',
        },
        {
          pattern: /Function\s*\(/gi,
          description: 'Dynamic function creation',
          severity: 'critical',
        },
        {
          pattern: /document\.write/gi,
          description: 'DOM injection via document.write',
          severity: 'critical',
        },
        {
          pattern: /innerHTML\s*=/gi,
          description: 'Potential XSS via innerHTML',
          severity: 'critical',
        },
      ],

      // Medium risk patterns
      high: [
        {
          pattern: /require\s*\(/gi,
          description: 'Node.js module loading',
          severity: 'high',
        },
        {
          pattern: /import\s*\(/gi,
          description: 'Dynamic module import',
          severity: 'high',
        },
        {
          pattern: /fetch\s*\(/gi,
          description: 'Network request',
          severity: 'high',
        },
        {
          pattern: /XMLHttpRequest/gi,
          description: 'Network request',
          severity: 'high',
        },
      ],

      // Low risk patterns
      medium: [
        {
          pattern: /localStorage/gi,
          description: 'Local storage access',
          severity: 'medium',
        },
        {
          pattern: /sessionStorage/gi,
          description: 'Session storage access',
          severity: 'medium',
        },
        {
          pattern: /location\./gi,
          description: 'URL manipulation',
          severity: 'medium',
        },
        {
          pattern: /window\./gi,
          description: 'Global window access',
          severity: 'medium',
        },
      ],
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
              issues: result.issues,
            });
          }
        } catch (error) {
          console.error(`❌ Security validation failed for ${plugin.id}:`, error);
          securityIssues.push({
            pluginId: plugin.id,
            reason: 'Validation error',
            severity: 'critical',
            error: error.message,
          });
        }
      }

      // Check for plan-level security issues
      const planIssues = await this.validatePlanSecurity(installPlan, validationResults);
      securityIssues.push(...planIssues);

      // Determine overall approval
      const criticalIssues = securityIssues.filter(i => i.severity === 'critical');
      const rejectedPlugins = validationResults.filter(result => !result.approved);
      const approved = criticalIssues.length === 0 && rejectedPlugins.length === 0;

      if (!approved) {
        this.stats.blockedPlugins += new Set(securityIssues.map(issue => issue.pluginId)).size;
        throw new Error(
          `Security validation failed: ${rejectedPlugins.length} rejected plugins, ${criticalIssues.length} critical issues`
        );
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
          warnings: warnings.length,
        },
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
    const evidence = plugin.packageEvidence;
    if (
      !evidence ||
      !/^[a-f0-9]{64}$/.test(evidence.sha256 || '') ||
      evidence.manifest?.id !== plugin.id ||
      evidence.manifest?.version !== plugin.version ||
      !Array.isArray(evidence.files)
    ) {
      throw new Error('Inspected plugin package contents are required for validation');
    }
    const cacheKey = `${plugin.id}@${plugin.version}:${evidence.sha256}`;
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
      timestamp: new Date(),
      packageSha256: evidence.sha256,
      scope: 'static_source_and_declared_permissions',
      dependencyVulnerabilityScan: 'not_performed',
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
          severity: 'high',
        });
      }

      // 2. Static analysis of the actual downloaded package
      const codeAnalysis = await this.analyzePluginCode(plugin);
      validationResult.issues.push(...codeAnalysis.issues);
      validationResult.riskScore += codeAnalysis.riskScore;

      // 3. Permission validation
      const permissionAnalysis = this.validatePermissions(plugin);
      validationResult.issues.push(...permissionAnalysis.issues);
      validationResult.riskScore += permissionAnalysis.riskScore;

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
        validationResult.reason = 'Static source and declared permission checks passed';

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

      console.log(
        `🔒 Security validation for ${plugin.id}: ${validationResult.approved ? 'APPROVED' : 'REJECTED'} (risk: ${validationResult.riskScore})`
      );
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
      source: sourceId,
    };
  }

  /**
   * Analyze plugin code for security issues
   */
  async analyzePluginCode(plugin) {
    const issues = [];
    let riskScore = 0;
    for (const file of plugin.packageEvidence.files) {
      for (const patterns of Object.values(this.securityPatterns)) {
        for (const rule of patterns) {
          const matches = [...file.content.matchAll(new RegExp(rule.pattern.source, rule.pattern.flags))];
          if (!matches.length) continue;
          issues.push({
            type: 'code_pattern',
            file: file.name,
            pattern: rule.pattern.source,
            description: rule.description,
            severity: rule.severity,
            matches: matches.length,
            line: file.content.slice(0, matches[0].index).split('\n').length,
          });
          riskScore += rule.severity === 'critical' ? 40 : rule.severity === 'high' ? 20 : 10;
        }
      }
    }
    return { issues, riskScore };
  }

  /**
   * Validate plugin permissions
   */
  validatePermissions(plugin) {
    console.log(`🔑 Validating permissions for ${plugin.id}...`);

    const issues = [];
    let riskScore = 0;

    const permissions = plugin.packageEvidence.manifest.permissions || [];
    const requestedPermissions = Array.isArray(permissions) ? permissions : Object.keys(permissions);

    for (const permission of requestedPermissions) {
      const name = typeof permission === 'string' ? permission : permission.name;
      const analysis = this.analyzePermission({ name });

      if (analysis.severity === 'critical') {
        issues.push({
          type: 'dangerous_permission',
          permission: name,
          description: analysis.description,
          severity: 'critical',
          reason: analysis.reason,
        });
        riskScore += 30;
      } else if (analysis.severity === 'high') {
        issues.push({
          type: 'risky_permission',
          permission: name,
          description: analysis.description,
          severity: 'high',
          reason: analysis.reason,
        });
        riskScore += 15;
      }
    }

    return { issues, riskScore };
  }

  /**
   * Analyze individual permission
   */
  analyzePermission(permission) {
    const permissionRules = {
      eval: {
        severity: 'critical',
        description: 'Dynamic code execution',
        reason: 'Can execute arbitrary code',
      },
      require: {
        severity: 'critical',
        description: 'System module access',
        reason: 'Can access system modules and files',
      },
      fetch: {
        severity: 'high',
        description: 'Network access',
        reason: 'Can make external network requests',
      },
      localStorage: {
        severity: 'medium',
        description: 'Local storage access',
        reason: 'Can store data locally',
      },
      console: {
        severity: 'low',
        description: 'Console access',
        reason: 'Can log to console',
      },
    };

    return (
      permissionRules[permission.name] || {
        severity: 'low',
        description: 'Unknown permission',
        reason: 'Permission not in security database',
      }
    );
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
        totalRisk: totalRisk,
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
      securityReports: this.securityReports.size,
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
        official: 0,
        community: 10,
        local: 5,
        unknown: 30,
      },
    };
  }

  /**
   * Assess overall risk of plugin
   */
  assessRisk(validationResult) {
    let totalScore = validationResult.riskScore;

    // Source risk
    const sourceRisk = this.riskFactors.source[validationResult.source] ?? 30;
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
        base: validationResult.riskScore,
      },
    };
  }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginSecurityValidator;
} else if (typeof window !== 'undefined') {
  window.PluginSecurityValidator = PluginSecurityValidator;
}
