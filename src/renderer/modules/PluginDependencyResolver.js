/**
 * PluginDependencyResolver - Advanced dependency resolution system for plugins
 * Handles complex dependency graphs, version conflicts, and installation ordering
 */
class PluginDependencyResolver {
    constructor(marketplace) {
        this.marketplace = marketplace;
        
        // Dependency resolution state
        this.dependencyGraph = new Map();
        this.resolvedDependencies = new Map();
        this.versionConstraints = new Map();
        
        // Resolution statistics
        this.stats = {
            totalResolutions: 0,
            complexResolutions: 0,
            conflictResolutions: 0,
            circularDependencies: 0
        };
        
        console.log('🔗 PluginDependencyResolver initialized');
    }

    /**
     * Create installation plan with resolved dependencies
     */
    async createInstallPlan(plugin) {
        try {
            console.log(`📋 Creating install plan for ${plugin.id} v${plugin.version}...`);
            
            // Reset resolution state
            this.clearResolutionState();
            
            // Build dependency tree
            const dependencyTree = await this.buildDependencyTree(plugin);
            console.log(`🌳 Dependency tree built: ${dependencyTree.totalDependencies} dependencies`);
            
            // Check for circular dependencies
            this.detectCircularDependencies(dependencyTree);
            
            // Resolve version conflicts
            const resolvedVersions = this.resolveVersionConflicts(dependencyTree);
            console.log(`📊 Version conflicts resolved: ${resolvedVersions.size} plugins`);
            
            // Create installation order
            const installOrder = this.calculateInstallOrder(dependencyTree, resolvedVersions);
            console.log(`📦 Install order calculated: ${installOrder.length} plugins`);
            
            // Build install plan
            const installPlan = await this.buildInstallPlan(installOrder, resolvedVersions);
            
            this.stats.totalResolutions++;
            if (dependencyTree.totalDependencies > 5) {
                this.stats.complexResolutions++;
            }
            
            console.log(`✅ Install plan created for ${plugin.id}`);
            return installPlan;
            
        } catch (error) {
            console.error(`❌ Failed to create install plan for ${plugin.id}:`, error);
            throw error;
        }
    }

    /**
     * Build complete dependency tree
     */
    async buildDependencyTree(rootPlugin, visited = new Set(), depth = 0) {
        const MAX_DEPTH = 10; // Prevent infinite recursion
        
        if (depth > MAX_DEPTH) {
            throw new Error(`Dependency tree too deep (>${MAX_DEPTH} levels). Possible circular dependency.`);
        }
        
        if (visited.has(rootPlugin.id)) {
            return { plugin: rootPlugin, dependencies: [], totalDependencies: 0 };
        }
        
        visited.add(rootPlugin.id);
        console.log(`${'  '.repeat(depth)}🔍 Analyzing dependencies for ${rootPlugin.id} v${rootPlugin.version}`);
        
        const dependencies = [];
        let totalDependencies = 0;
        
        if (rootPlugin.dependencies && rootPlugin.dependencies.length > 0) {
            for (const dep of rootPlugin.dependencies) {
                try {
                    console.log(`${'  '.repeat(depth + 1)}📦 Resolving dependency: ${dep.id} ${dep.version}`);
                    
                    // Find compatible version of dependency
                    const dependencyPlugin = await this.findCompatiblePlugin(dep);
                    
                    if (!dependencyPlugin) {
                        throw new Error(`Dependency ${dep.id} ${dep.version} not found in marketplace`);
                    }
                    
                    // Recursively build dependency tree
                    const depTree = await this.buildDependencyTree(
                        dependencyPlugin, 
                        new Set(visited), 
                        depth + 1
                    );
                    
                    dependencies.push({
                        id: dep.id,
                        constraint: dep.version,
                        plugin: dependencyPlugin,
                        tree: depTree
                    });
                    
                    totalDependencies += 1 + depTree.totalDependencies;
                    
                } catch (error) {
                    console.error(`❌ Failed to resolve dependency ${dep.id}:`, error);
                    throw new Error(`Dependency resolution failed for ${dep.id}: ${error.message}`);
                }
            }
        }
        
        return {
            plugin: rootPlugin,
            dependencies,
            totalDependencies,
            depth
        };
    }

    /**
     * Find compatible plugin version for dependency
     */
    async findCompatiblePlugin(dependency) {
        console.log(`🔍 Finding compatible version for ${dependency.id} ${dependency.version}`);
        
        // Parse version constraint
        const constraint = this.parseVersionConstraint(dependency.version);
        
        // Search for plugin in marketplace
        const searchResults = await this.marketplace.searchPlugins(dependency.id);
        
        // Find exact match first
        let compatiblePlugin = searchResults.find(plugin => plugin.id === dependency.id);
        
        if (!compatiblePlugin) {
            throw new Error(`Plugin ${dependency.id} not found`);
        }
        
        // Check version compatibility
        if (!this.isVersionCompatible(compatiblePlugin.version, constraint)) {
            // Try to find a compatible version
            const allVersions = await this.getAllVersionsForPlugin(dependency.id);
            const compatibleVersion = this.findBestCompatibleVersion(allVersions, constraint);
            
            if (!compatibleVersion) {
                throw new Error(`No compatible version found for ${dependency.id} ${dependency.version}`);
            }
            
            // Get the specific compatible version
            compatiblePlugin = await this.marketplace.findPluginInSource('official', dependency.id);
            compatiblePlugin.version = compatibleVersion;
        }
        
        console.log(`✅ Found compatible version: ${compatiblePlugin.id} v${compatiblePlugin.version}`);
        return compatiblePlugin;
    }

    /**
     * Parse version constraint string
     */
    parseVersionConstraint(versionStr) {
        // Support formats: ">=1.0.0", "^1.0.0", "~1.0.0", "1.0.0", "*"
        
        if (versionStr === '*') {
            return { operator: '*', version: null };
        }
        
        const operators = ['>=', '<=', '>', '<', '^', '~', '='];
        
        for (const op of operators) {
            if (versionStr.startsWith(op)) {
                return {
                    operator: op,
                    version: versionStr.substring(op.length).trim()
                };
            }
        }
        
        // Default to exact match
        return {
            operator: '=',
            version: versionStr
        };
    }

    /**
     * Check if version satisfies constraint
     */
    isVersionCompatible(version, constraint) {
        if (constraint.operator === '*') {
            return true;
        }
        
        const compareResult = this.compareVersions(version, constraint.version);
        
        switch (constraint.operator) {
            case '>=':
                return compareResult >= 0;
            case '<=':
                return compareResult <= 0;
            case '>':
                return compareResult > 0;
            case '<':
                return compareResult < 0;
            case '=':
                return compareResult === 0;
            case '^':
                return this.isCaretCompatible(version, constraint.version);
            case '~':
                return this.isTildeCompatible(version, constraint.version);
            default:
                return compareResult === 0;
        }
    }

    /**
     * Check caret compatibility (^1.2.3 allows >=1.2.3 <2.0.0)
     */
    isCaretCompatible(version, constraintVersion) {
        const vParts = version.split('.').map(Number);
        const cParts = constraintVersion.split('.').map(Number);
        
        // Major version must match
        if (vParts[0] !== cParts[0]) {
            return false;
        }
        
        // Version must be >= constraint
        return this.compareVersions(version, constraintVersion) >= 0;
    }

    /**
     * Check tilde compatibility (~1.2.3 allows >=1.2.3 <1.3.0)
     */
    isTildeCompatible(version, constraintVersion) {
        const vParts = version.split('.').map(Number);
        const cParts = constraintVersion.split('.').map(Number);
        
        // Major and minor versions must match
        if (vParts[0] !== cParts[0] || vParts[1] !== cParts[1]) {
            return false;
        }
        
        // Patch version must be >= constraint
        return vParts[2] >= cParts[2];
    }

    /**
     * Compare two version strings
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1 = v1Parts[i] || 0;
            const v2 = v2Parts[i] || 0;
            
            if (v1 > v2) return 1;
            if (v1 < v2) return -1;
        }
        
        return 0;
    }

    /**
     * Get all available versions for a plugin
     */
    async getAllVersionsForPlugin(pluginId) {
        // Simulate getting all versions from marketplace
        const mockVersions = {
            'sequence-utils': ['1.0.0', '1.1.0', '1.2.0', '2.0.0'],
            'math-libs': ['2.0.0', '2.1.0', '2.2.0'],
            'ml-core': ['3.0.0', '3.1.0', '3.2.0'],
            'protein-utils': ['1.2.0', '1.3.0', '1.4.0'],
            'graph-libs': ['2.5.0', '2.6.0', '2.7.0'],
            'visualization-engine': ['1.8.0', '1.9.0', '2.0.0']
        };
        
        return mockVersions[pluginId] || [];
    }

    /**
     * Find best compatible version
     */
    findBestCompatibleVersion(versions, constraint) {
        const compatibleVersions = versions.filter(version => 
            this.isVersionCompatible(version, constraint)
        );
        
        if (compatibleVersions.length === 0) {
            return null;
        }
        
        // Return the highest compatible version
        return compatibleVersions.sort((a, b) => this.compareVersions(b, a))[0];
    }

    /**
     * Detect circular dependencies
     */
    detectCircularDependencies(dependencyTree) {
        const visiting = new Set();
        const visited = new Set();
        
        const detectCycle = (node, path = []) => {
            if (visiting.has(node.plugin.id)) {
                const cycle = path.slice(path.indexOf(node.plugin.id));
                this.stats.circularDependencies++;
                throw new Error(`Circular dependency detected: ${cycle.join(' -> ')} -> ${node.plugin.id}`);
            }
            
            if (visited.has(node.plugin.id)) {
                return;
            }
            
            visiting.add(node.plugin.id);
            path.push(node.plugin.id);
            
            for (const dep of node.dependencies) {
                detectCycle(dep.tree, [...path]);
            }
            
            visiting.delete(node.plugin.id);
            visited.add(node.plugin.id);
        };
        
        detectCycle(dependencyTree);
        console.log('✅ No circular dependencies detected');
    }

    /**
     * Resolve version conflicts in dependency tree
     */
    resolveVersionConflicts(dependencyTree) {
        const pluginVersions = new Map();
        
        // Collect all version requirements
        const collectVersions = (node) => {
            const pluginId = node.plugin.id;
            
            if (!pluginVersions.has(pluginId)) {
                pluginVersions.set(pluginId, []);
            }
            
            pluginVersions.get(pluginId).push({
                version: node.plugin.version,
                requiredBy: node.plugin.id,
                constraint: node.plugin.version
            });
            
            for (const dep of node.dependencies) {
                collectVersions(dep.tree);
            }
        };
        
        collectVersions(dependencyTree);
        
        // Resolve conflicts
        const resolvedVersions = new Map();
        
        for (const [pluginId, versionRequirements] of pluginVersions) {
            if (versionRequirements.length === 1) {
                // No conflict
                resolvedVersions.set(pluginId, versionRequirements[0].version);
            } else {
                // Multiple version requirements - resolve conflict
                console.log(`⚠️ Version conflict for ${pluginId}: ${versionRequirements.map(v => v.version).join(', ')}`);
                
                const resolvedVersion = this.resolveVersionConflict(pluginId, versionRequirements);
                resolvedVersions.set(pluginId, resolvedVersion);
                
                this.stats.conflictResolutions++;
            }
        }
        
        return resolvedVersions;
    }

    /**
     * Resolve version conflict for a single plugin
     */
    resolveVersionConflict(pluginId, versionRequirements) {
        // Strategy: Find the highest version that satisfies all constraints
        
        const allVersions = [...new Set(versionRequirements.map(req => req.version))];
        const sortedVersions = allVersions.sort((a, b) => this.compareVersions(b, a));
        
        for (const candidateVersion of sortedVersions) {
            let satisfiesAll = true;
            
            for (const requirement of versionRequirements) {
                const constraint = this.parseVersionConstraint(requirement.constraint);
                if (!this.isVersionCompatible(candidateVersion, constraint)) {
                    satisfiesAll = false;
                    break;
                }
            }
            
            if (satisfiesAll) {
                console.log(`✅ Resolved ${pluginId} to version ${candidateVersion}`);
                return candidateVersion;
            }
        }
        
        // If no version satisfies all constraints, use the highest version
        const highestVersion = sortedVersions[0];
        console.warn(`⚠️ No version of ${pluginId} satisfies all constraints. Using ${highestVersion}`);
        
        return highestVersion;
    }

    /**
     * Calculate installation order using topological sort
     */
    calculateInstallOrder(dependencyTree, resolvedVersions) {
        const installOrder = [];
        const visited = new Set();
        const visiting = new Set();
        
        const visit = (node) => {
            if (visited.has(node.plugin.id)) {
                return;
            }
            
            if (visiting.has(node.plugin.id)) {
                throw new Error(`Circular dependency in install order for ${node.plugin.id}`);
            }
            
            visiting.add(node.plugin.id);
            
            // Visit all dependencies first
            for (const dep of node.dependencies) {
                visit(dep.tree);
            }
            
            visiting.delete(node.plugin.id);
            visited.add(node.plugin.id);
            
            // Add to install order if not already present
            if (!installOrder.find(p => p.id === node.plugin.id)) {
                installOrder.push({
                    id: node.plugin.id,
                    version: resolvedVersions.get(node.plugin.id) || node.plugin.version,
                    isDependency: node.plugin.id !== dependencyTree.plugin.id
                });
            }
        };
        
        visit(dependencyTree);
        
        console.log(`📦 Install order: ${installOrder.map(p => `${p.id}@${p.version}`).join(' -> ')}`);
        return installOrder;
    }

    /**
     * Build final install plan
     */
    async buildInstallPlan(installOrder, resolvedVersions) {
        const plugins = [];
        
        for (const item of installOrder) {
            // Get plugin details with resolved version
            let plugin = await this.marketplace.findPlugin(item.id);
            
            if (!plugin) {
                throw new Error(`Plugin ${item.id} not found for installation`);
            }
            
            // Update with resolved version
            plugin.version = item.version;
            plugin.isDependency = item.isDependency;
            
            plugins.push(plugin);
        }
        
        return {
            plugins,
            resolvedVersions: Object.fromEntries(resolvedVersions),
            totalPlugins: plugins.length,
            dependencies: plugins.filter(p => p.isDependency).length,
            createdAt: new Date()
        };
    }

    /**
     * Clear resolution state
     */
    clearResolutionState() {
        this.dependencyGraph.clear();
        this.resolvedDependencies.clear();
        this.versionConstraints.clear();
    }

    /**
     * Get dependency resolution statistics
     */
    getResolutionStats() {
        return {
            ...this.stats,
            averageComplexity: this.stats.totalResolutions > 0 
                ? this.stats.complexResolutions / this.stats.totalResolutions 
                : 0,
            conflictRate: this.stats.totalResolutions > 0 
                ? this.stats.conflictResolutions / this.stats.totalResolutions 
                : 0
        };
    }

    /**
     * Validate install plan compatibility
     */
    validateInstallPlan(installPlan) {
        console.log(`🔍 Validating install plan for ${installPlan.plugins.length} plugins...`);
        
        const issues = [];
        
        // Check for version conflicts
        const versionMap = new Map();
        for (const plugin of installPlan.plugins) {
            if (versionMap.has(plugin.id)) {
                const existingVersion = versionMap.get(plugin.id);
                if (existingVersion !== plugin.version) {
                    issues.push({
                        type: 'version_conflict',
                        plugin: plugin.id,
                        versions: [existingVersion, plugin.version],
                        severity: 'high'
                    });
                }
            } else {
                versionMap.set(plugin.id, plugin.version);
            }
        }
        
        // Check for missing dependencies
        for (const plugin of installPlan.plugins) {
            if (plugin.dependencies) {
                for (const dep of plugin.dependencies) {
                    const depInPlan = installPlan.plugins.find(p => p.id === dep.id);
                    if (!depInPlan) {
                        issues.push({
                            type: 'missing_dependency',
                            plugin: plugin.id,
                            dependency: dep.id,
                            severity: 'high'
                        });
                    } else {
                        // Check version compatibility
                        const constraint = this.parseVersionConstraint(dep.version);
                        if (!this.isVersionCompatible(depInPlan.version, constraint)) {
                            issues.push({
                                type: 'incompatible_dependency',
                                plugin: plugin.id,
                                dependency: dep.id,
                                required: dep.version,
                                provided: depInPlan.version,
                                severity: 'medium'
                            });
                        }
                    }
                }
            }
        }
        
        if (issues.length > 0) {
            console.warn(`⚠️ Install plan validation found ${issues.length} issues`);
            const highSeverityIssues = issues.filter(i => i.severity === 'high');
            if (highSeverityIssues.length > 0) {
                throw new Error(`Install plan validation failed: ${highSeverityIssues.length} critical issues found`);
            }
        } else {
            console.log('✅ Install plan validation passed');
        }
        
        return { valid: true, issues };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginDependencyResolver;
} else if (typeof window !== 'undefined') {
    window.PluginDependencyResolver = PluginDependencyResolver;
} 