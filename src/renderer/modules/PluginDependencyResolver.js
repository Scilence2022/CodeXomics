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
      circularDependencies: 0,
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
      this.validateInstallPlan(installPlan);

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
          const depTree = await this.buildDependencyTree(dependencyPlugin, new Set(visited), depth + 1);

          dependencies.push({
            id: dep.id,
            constraint: dep.version,
            plugin: dependencyPlugin,
            tree: depTree,
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
      depth,
    };
  }

  /**
   * Find compatible plugin version for dependency
   */
  async findCompatiblePlugin(dependency) {
    console.log(`🔍 Finding compatible version for ${dependency.id} ${dependency.version}`);

    const constraint = this.parseVersionConstraint(dependency.version);
    const results = await this.marketplace.searchPlugins(dependency.id);
    const candidates = results.filter(
      plugin => plugin.id === dependency.id && this.isVersionCompatible(plugin.version, constraint)
    );
    candidates.sort((a, b) => this.compareVersions(b.version, a.version));
    if (!candidates.length) {
      throw new Error(`No available compatible package for ${dependency.id} ${dependency.version}`);
    }
    return candidates[0];
  }

  getVersionUtils() {
    return typeof module !== 'undefined' && module.exports
      ? require('./PluginVersionUtils')
      : window.PluginVersionUtils;
  }

  parseVersionConstraint(range) {
    if (typeof range !== 'string' || !this.getVersionUtils().validRange(range)) {
      throw new Error(`Invalid version constraint: ${range}`);
    }
    return { range };
  }

  isVersionCompatible(version, constraint) {
    const range =
      constraint.range || (constraint.operator === '*' ? '*' : `${constraint.operator}${constraint.version}`);
    return this.getVersionUtils().satisfies(version, range);
  }

  isCaretCompatible(version, constraintVersion) {
    return this.getVersionUtils().satisfies(version, `^${constraintVersion}`);
  }

  isTildeCompatible(version, constraintVersion) {
    return this.getVersionUtils().satisfies(version, `~${constraintVersion}`);
  }

  /**
   * Compare two version strings
   */
  compareVersions(version1, version2) {
    const utils =
      typeof module !== 'undefined' && module.exports ? require('./PluginVersionUtils') : window.PluginVersionUtils;
    return utils.compare(version1, version2);
  }

  /**
   * Get all available versions for a plugin
   */
  async getAllVersionsForPlugin(pluginId) {
    const packages = await this.marketplace.searchPlugins(pluginId);
    return [...new Set(packages.filter(plugin => plugin.id === pluginId).map(plugin => plugin.version))];
  }

  /**
   * Find best compatible version
   */
  findBestCompatibleVersion(versions, constraint) {
    const compatibleVersions = versions.filter(version => this.isVersionCompatible(version, constraint));

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
    const collectVersions = (node, constraint = node.plugin.version, requiredBy = node.plugin.id) => {
      const pluginId = node.plugin.id;

      if (!pluginVersions.has(pluginId)) {
        pluginVersions.set(pluginId, []);
      }

      pluginVersions.get(pluginId).push({
        version: node.plugin.version,
        requiredBy,
        constraint,
      });

      this.resolvedDependencies.set(`${pluginId}@${node.plugin.version}`, node.plugin);
      for (const dep of node.dependencies) {
        collectVersions(dep.tree, dep.constraint, node.plugin.id);
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

    throw new Error(`No available version of ${pluginId} satisfies all constraints`);
  }

  /**
   * Calculate installation order using topological sort
   */
  calculateInstallOrder(dependencyTree, resolvedVersions) {
    const installOrder = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = node => {
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
          isDependency: node.plugin.id !== dependencyTree.plugin.id,
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
      const plugin = this.resolvedDependencies.get(`${item.id}@${item.version}`);

      if (!plugin) {
        throw new Error(`Plugin ${item.id} not found for installation`);
      }

      plugins.push({ ...plugin, isDependency: item.isDependency });
    }

    return {
      plugins,
      resolvedVersions: Object.fromEntries(resolvedVersions),
      totalPlugins: plugins.length,
      dependencies: plugins.filter(p => p.isDependency).length,
      createdAt: new Date(),
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
      averageComplexity:
        this.stats.totalResolutions > 0 ? this.stats.complexResolutions / this.stats.totalResolutions : 0,
      conflictRate: this.stats.totalResolutions > 0 ? this.stats.conflictResolutions / this.stats.totalResolutions : 0,
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
            severity: 'high',
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
              severity: 'high',
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
                severity: 'medium',
              });
            }
          }
        }
      }
    }

    if (issues.length > 0) {
      console.warn(`⚠️ Install plan validation found ${issues.length} issues`);
      const highSeverityIssues = issues;
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
