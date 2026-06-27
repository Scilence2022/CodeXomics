/**
 * PluginAgent - plugin agent
 * Specializes in managing plugin-system-related functions
 */
class PluginAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'plugin', ['plugin_management', 'plugin_execution', 'plugin_development']);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.pluginManager = null;
  }

  /**
   * Run the concrete initialization logic
   */
  async performInitialization() {
    // Ensure the app is initialized
    if (!this.app) {
      throw new Error('Application reference not available');
    }

    // Get the plugin manager
    this.pluginManager = this.app.pluginManager || null;
    if (!this.pluginManager) {
      console.warn('⚠️ PluginAgent: PluginManager not available, some tools will rely on ChatManager fallback');
    }

    console.log(`🔌 PluginAgent: Plugin management tools initialized`);
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters, { bypassAgent: true });
        return result;
      } catch (error) {
        console.warn(
          `🔌 PluginAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`
        );
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    if (this.toolMapping.has(functionName)) {
      const toolFunction = this.toolMapping.get(functionName);
      return await toolFunction(parameters, context);
    }

    throw new Error(`PluginAgent: Function ${functionName} not implemented locally and ChatManager unavailable`);
  }

  /**
   * Register the tool mappings
   */
  registerToolMapping() {
    // Plugin management tools
    this.toolMapping.set('list_plugins', this.listPlugins.bind(this));
    this.toolMapping.set('get_plugin_info', this.getPluginInfo.bind(this));
    this.toolMapping.set('install_plugin', this.installPlugin.bind(this));
    this.toolMapping.set('uninstall_plugin', this.uninstallPlugin.bind(this));
    this.toolMapping.set('enable_plugin', this.enablePlugin.bind(this));
    this.toolMapping.set('disable_plugin', this.disablePlugin.bind(this));

    // Plugin execution tools
    this.toolMapping.set('execute_plugin', this.executePlugin.bind(this));
    this.toolMapping.set('call_plugin_function', this.callPluginFunction.bind(this));
    this.toolMapping.set('get_plugin_functions', this.getPluginFunctions.bind(this));

    // Plugin development tools
    this.toolMapping.set('create_plugin', this.createPlugin.bind(this));
    this.toolMapping.set('validate_plugin', this.validatePlugin.bind(this));
    this.toolMapping.set('test_plugin', this.testPlugin.bind(this));

    // Plugin marketplace tools
    this.toolMapping.set('search_plugins', this.searchPlugins.bind(this));
    this.toolMapping.set('get_plugin_marketplace', this.getPluginMarketplace.bind(this));
    this.toolMapping.set('update_plugin', this.updatePlugin.bind(this));

    console.log(`🔌 PluginAgent: Registered ${this.toolMapping.size} plugin tools`);
  }

  /**
   * List plugins
   */
  async listPlugins(parameters, strategy) {
    try {
      const { status = 'all' } = parameters;

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const plugins = await this.pluginManager.listPlugins(status);

      return {
        success: true,
        plugins: plugins.map(plugin => ({
          id: plugin.id,
          name: plugin.name,
          version: plugin.version,
          description: plugin.description,
          status: plugin.status,
          enabled: plugin.enabled,
          functions: plugin.functions?.length || 0,
        })),
        count: plugins.length,
        status,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get plugin information
   */
  async getPluginInfo(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const pluginInfo = await this.pluginManager.getPluginInfo(pluginId);

      if (!pluginInfo) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      return {
        success: true,
        plugin: {
          id: pluginInfo.id,
          name: pluginInfo.name,
          version: pluginInfo.version,
          description: pluginInfo.description,
          author: pluginInfo.author,
          license: pluginInfo.license,
          status: pluginInfo.status,
          enabled: pluginInfo.enabled,
          functions: pluginInfo.functions,
          dependencies: pluginInfo.dependencies,
          metadata: pluginInfo.metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(parameters, strategy) {
    try {
      const { pluginId, source = 'marketplace' } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const result = await this.pluginManager.installPlugin(pluginId, source);

      return {
        success: true,
        message: `Plugin ${pluginId} installed successfully`,
        plugin: {
          id: result.id,
          name: result.name,
          version: result.version,
          status: result.status,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      await this.pluginManager.uninstallPlugin(pluginId);

      return {
        success: true,
        message: `Plugin ${pluginId} uninstalled successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      await this.pluginManager.enablePlugin(pluginId);

      return {
        success: true,
        message: `Plugin ${pluginId} enabled successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      await this.pluginManager.disablePlugin(pluginId);

      return {
        success: true,
        message: `Plugin ${pluginId} disabled successfully`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute a plugin
   */
  async executePlugin(parameters, strategy) {
    try {
      const { pluginId, functionName, parameters: funcParams = {} } = parameters;

      if (!pluginId || !functionName) {
        throw new Error('Plugin ID and function name are required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const result = await this.pluginManager.executePluginFunction(pluginId, functionName, funcParams);

      return {
        success: true,
        result: result,
        pluginId,
        functionName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Call a plugin function
   */
  async callPluginFunction(parameters, strategy) {
    return await this.executePlugin(parameters, strategy);
  }

  /**
   * Get plugin functions
   */
  async getPluginFunctions(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const functions = await this.pluginManager.getPluginFunctions(pluginId);

      return {
        success: true,
        functions: functions.map(func => ({
          name: func.name,
          description: func.description,
          parameters: func.parameters,
          returnType: func.returnType,
          examples: func.examples,
        })),
        count: functions.length,
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a plugin
   */
  async createPlugin(parameters, strategy) {
    try {
      const { name, description, author, functions = [] } = parameters;

      if (!name || !description || !author) {
        throw new Error('Name, description, and author are required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const pluginTemplate = {
        name,
        description,
        author,
        version: '1.0.0',
        functions,
        metadata: {
          created: new Date().toISOString(),
          type: 'custom',
        },
      };

      const pluginId = await this.pluginManager.createPlugin(pluginTemplate);

      return {
        success: true,
        message: `Plugin ${name} created successfully`,
        pluginId,
        template: pluginTemplate,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate a plugin
   */
  async validatePlugin(parameters, strategy) {
    try {
      const { pluginId } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const validationResult = await this.pluginManager.validatePlugin(pluginId);

      return {
        success: true,
        validation: {
          isValid: validationResult.isValid,
          errors: validationResult.errors,
          warnings: validationResult.warnings,
          suggestions: validationResult.suggestions,
        },
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Test a plugin
   */
  async testPlugin(parameters, strategy) {
    try {
      const { pluginId, testCases = [] } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const testResults = await this.pluginManager.testPlugin(pluginId, testCases);

      return {
        success: true,
        testResults: {
          passed: testResults.passed,
          failed: testResults.failed,
          total: testResults.total,
          details: testResults.details,
        },
        pluginId,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search plugins
   */
  async searchPlugins(parameters, strategy) {
    try {
      const { query, category = 'all', maxResults = 20 } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const searchResults = await this.pluginManager.searchPlugins(query, category, maxResults);

      return {
        success: true,
        results: searchResults.map(plugin => ({
          id: plugin.id,
          name: plugin.name,
          description: plugin.description,
          category: plugin.category,
          rating: plugin.rating,
          downloads: plugin.downloads,
          version: plugin.version,
        })),
        count: searchResults.length,
        query,
        category,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get the plugin marketplace
   */
  async getPluginMarketplace(parameters, strategy) {
    try {
      const { category = 'all', sortBy = 'popularity', page = 1, pageSize = 20 } = parameters;

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const marketplace = await this.pluginManager.getMarketplace(category, sortBy, page, pageSize);

      return {
        success: true,
        marketplace: {
          plugins: marketplace.plugins.map(plugin => ({
            id: plugin.id,
            name: plugin.name,
            description: plugin.description,
            category: plugin.category,
            rating: plugin.rating,
            downloads: plugin.downloads,
            version: plugin.version,
            price: plugin.price,
          })),
          total: marketplace.total,
          page: marketplace.page,
          pageSize: marketplace.pageSize,
          categories: marketplace.categories,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a plugin
   */
  async updatePlugin(parameters, strategy) {
    try {
      const { pluginId, version } = parameters;

      if (!pluginId) {
        throw new Error('Plugin ID is required');
      }

      if (!this.pluginManager) {
        throw new Error('PluginManager not available');
      }

      const updateResult = await this.pluginManager.updatePlugin(pluginId, version);

      return {
        success: true,
        message: `Plugin ${pluginId} updated successfully`,
        update: {
          fromVersion: updateResult.fromVersion,
          toVersion: updateResult.toVersion,
          changes: updateResult.changes,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export the agent
window.PluginAgent = PluginAgent;
