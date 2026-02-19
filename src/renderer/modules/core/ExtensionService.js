/**
 * ExtensionService - Unified extension management service
 *
 * This is the main entry point that integrates all core VS Code-inspired components:
 * - Extension Host for sandboxed execution
 * - Extension Context for lifecycle management
 * - Contribution Registry for extension contributions
 * - Activation Events for lazy loading
 * - Command Registry for command management
 *
 * Designed to be the bridge between the new architecture and PluginManagerV2.
 */

/**
 * ExtensionDescriptor - Describes a registered extension
 */
class ExtensionDescriptor {
  /**
   * @param {Object} options
   */
  constructor(options) {
    this.id = options.id;
    this.manifest = options.manifest;
    this.context = options.context || null;
    this.exports = null;
    this.isActive = false;
    this.activationTime = null;
    this.error = null;
  }

  /**
   * Mark as activated
   * @param {Object} exports - Extension exports
   */
  activate(exports) {
    this.exports = exports || {};
    this.isActive = true;
    this.activationTime = Date.now();
    this.error = null;
  }

  /**
   * Mark as deactivated
   */
  deactivate() {
    this.exports = null;
    this.isActive = false;
  }

  /**
   * Mark as failed
   * @param {Error} error
   */
  fail(error) {
    this.error = error.message;
    this.isActive = false;
  }
}

/**
 * ExtensionService - Main extension service
 */
class ExtensionService {
  /**
   * @param {Object} options - Service options
   */
  constructor(options = {}) {
    this._options = {
      enableLazyActivation: true,
      enableContributions: true,
      enableCommands: true,
      storageBackend: options.storageBackend || null,
      ...options,
    };

    // Core components
    this._extensionHost = new ExtensionHost({
      kind: ExtensionHostKind.LocalWebWorker,
      enableSandbox: true,
      enableResourceMonitoring: true,
    });

    this._contextFactory = new ExtensionContextFactory(this._options.storageBackend);
    this._contributionRegistry = new ContributionRegistry();
    this._activationService = new ActivationEventsService();
    this._commandRegistry = new CommandRegistry();
    this._manifestParser = new ManifestParser();

    // Extension tracking
    /** @type {Map<string, ExtensionDescriptor>} */
    this._extensions = new Map();

    // Event emitter
    this._eventEmitter = new EventTarget();

    // State
    this._isInitialized = false;
    this._initializationPromise = null;

    // Setup activation handler
    this._activationService.setActivationHandler(this._handleActivation.bind(this));

    console.log('ExtensionService created');
  }

  /**
   * Initialize the extension service
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this._initializationPromise) {
      return this._initializationPromise;
    }

    this._initializationPromise = this._performInitialization();
    return this._initializationPromise;
  }

  /**
   * Perform initialization
   * @private
   */
  async _performInitialization() {
    console.log('Initializing ExtensionService...');

    try {
      // Start extension host
      await this._extensionHost.start();
      console.log('Extension host started');

      // Register built-in commands
      this._registerBuiltinCommands();

      this._isInitialized = true;
      this._emitEvent('initialized', {});

      console.log('ExtensionService initialized successfully');
    } catch (error) {
      console.error('ExtensionService initialization failed:', error);
      throw error;
    }
  }

  /**
   * Register built-in commands
   * @private
   */
  _registerBuiltinCommands() {
    // Extension management commands
    this._commandRegistry.registerCommand(
      'extension.list',
      () => {
        return this.getExtensions();
      },
      {
        title: 'List Extensions',
        category: 'Extensions',
        isInternal: false,
      }
    );

    this._commandRegistry.registerCommand(
      'extension.activate',
      async extensionId => {
        await this.activateExtension(extensionId);
      },
      {
        title: 'Activate Extension',
        category: 'Extensions',
        isInternal: false,
      }
    );

    this._commandRegistry.registerCommand(
      'extension.deactivate',
      async extensionId => {
        await this.deactivateExtension(extensionId);
      },
      {
        title: 'Deactivate Extension',
        category: 'Extensions',
        isInternal: false,
      }
    );

    this._commandRegistry.registerCommand(
      'extension.reload',
      async extensionId => {
        await this.reloadExtension(extensionId);
      },
      {
        title: 'Reload Extension',
        category: 'Extensions',
        isInternal: false,
      }
    );
  }

  /**
   * Register an extension from manifest
   * @param {Object} manifestData - Extension manifest
   * @param {Object} extensionModule - Extension module with activate/deactivate
   * @returns {Promise<ExtensionDescriptor>}
   */
  async registerExtension(manifestData, extensionModule = null) {
    // Parse and validate manifest
    const manifest = this._manifestParser.parse(manifestData);

    if (!manifest.isValid && manifest.validationErrors.length > 0) {
      const errors = manifest.validationErrors.map(e => e.message).join(', ');
      throw new Error(`Invalid extension manifest: ${errors}`);
    }

    const extensionId = manifest.id;

    if (this._extensions.has(extensionId)) {
      throw new Error(`Extension ${extensionId} is already registered`);
    }

    console.log(`Registering extension: ${extensionId}`);

    // Create extension context
    const context = this._contextFactory.create(manifest, {
      extensionPath: `/extensions/${extensionId}`,
      extensionMode: ExtensionMode.Production,
    });

    // Create extension descriptor
    const descriptor = new ExtensionDescriptor({
      id: extensionId,
      manifest,
      context,
    });

    // Store extension module if provided
    if (extensionModule) {
      descriptor._module = extensionModule;
    }

    // Register with tracking
    this._extensions.set(extensionId, descriptor);

    // Register with extension host
    await this._extensionHost.registerExtension(
      {
        id: extensionId,
        ...manifest.raw,
        activate: extensionModule?.activate,
        deactivate: extensionModule?.deactivate,
      },
      context
    );

    // Register activation events
    this._activationService.registerExtension(extensionId, manifest);

    // Register contributions
    if (this._options.enableContributions && manifest.contributes) {
      this._contributionRegistry.registerContributions(extensionId, manifest.contributes);

      // Register contributed commands
      if (manifest.contributes.commands) {
        this._registerContributedCommands(extensionId, manifest.contributes.commands);
      }
    }

    this._emitEvent('extensionRegistered', { extensionId, manifest: manifest.toJSON() });
    console.log(`Extension registered: ${extensionId}`);

    return descriptor;
  }

  /**
   * Register contributed commands
   * @private
   * @param {string} extensionId
   * @param {Array} commands
   */
  _registerContributedCommands(extensionId, commands) {
    for (const cmd of commands) {
      // Create placeholder handler that will be replaced when extension activates
      this._commandRegistry.registerCommand(
        cmd.command,
        async (...args) => {
          // Ensure extension is activated
          await this.activateExtension(extensionId);

          // Get the actual handler from extension exports
          const descriptor = this._extensions.get(extensionId);
          if (descriptor?.exports?.commands?.[cmd.command]) {
            return descriptor.exports.commands[cmd.command](...args);
          }

          throw new Error(`Command handler not found: ${cmd.command}`);
        },
        {
          ...cmd,
          extensionId,
        }
      );
    }
  }

  /**
   * Handle activation request
   * @private
   * @param {string} extensionId
   * @param {string} trigger
   * @param {string} event
   */
  async _handleActivation(extensionId, trigger, event) {
    const descriptor = this._extensions.get(extensionId);

    if (!descriptor) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    if (descriptor.isActive) {
      return descriptor.exports;
    }

    console.log(`Activating extension: ${extensionId} (trigger: ${trigger})`);

    try {
      // Activate in extension host
      const exports = await this._extensionHost.activateExtension(extensionId, trigger);

      // Update descriptor
      descriptor.activate(exports);

      // Mark context as activated
      descriptor.context?.markActivated();

      this._emitEvent('extensionActivated', {
        extensionId,
        trigger,
        event,
      });

      return exports;
    } catch (error) {
      descriptor.fail(error);
      this._emitEvent('extensionActivationFailed', {
        extensionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Activate an extension explicitly
   * @param {string} extensionId
   * @returns {Promise<Object>}
   */
  async activateExtension(extensionId) {
    return this._activationService.activateExtension(extensionId);
  }

  /**
   * Deactivate an extension
   * @param {string} extensionId
   * @returns {Promise<void>}
   */
  async deactivateExtension(extensionId) {
    const descriptor = this._extensions.get(extensionId);

    if (!descriptor) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    if (!descriptor.isActive) {
      return;
    }

    console.log(`Deactivating extension: ${extensionId}`);

    // Deactivate in extension host
    await this._extensionHost.deactivateExtension(extensionId);

    // Update descriptor
    descriptor.deactivate();

    // Dispose context
    if (descriptor.context) {
      await descriptor.context.dispose();
    }

    // Unregister commands from this extension
    this._commandRegistry.unregisterExtensionCommands(extensionId);

    this._emitEvent('extensionDeactivated', { extensionId });
  }

  /**
   * Unregister an extension
   * @param {string} extensionId
   * @returns {Promise<void>}
   */
  async unregisterExtension(extensionId) {
    // Deactivate first if active
    const descriptor = this._extensions.get(extensionId);

    if (descriptor?.isActive) {
      await this.deactivateExtension(extensionId);
    }

    // Unregister from activation service
    this._activationService.unregisterExtension(extensionId);

    // Unregister contributions
    this._contributionRegistry.unregisterContributions(extensionId);

    // Dispose context
    await this._contextFactory.dispose(extensionId);

    // Remove from tracking
    this._extensions.delete(extensionId);

    this._emitEvent('extensionUnregistered', { extensionId });
    console.log(`Extension unregistered: ${extensionId}`);
  }

  /**
   * Reload an extension
   * @param {string} extensionId
   * @returns {Promise<void>}
   */
  async reloadExtension(extensionId) {
    const descriptor = this._extensions.get(extensionId);

    if (!descriptor) {
      throw new Error(`Extension not found: ${extensionId}`);
    }

    console.log(`Reloading extension: ${extensionId}`);

    // Store manifest and module
    const manifest = descriptor.manifest.raw;
    const module = descriptor._module;

    // Unregister
    await this.unregisterExtension(extensionId);

    // Re-register
    await this.registerExtension(manifest, module);

    // Re-activate if was active
    if (descriptor.isActive) {
      await this.activateExtension(extensionId);
    }
  }

  /**
   * Trigger an activation event
   * @param {string} event
   * @returns {Promise<void>}
   */
  async triggerActivationEvent(event) {
    await this._activationService.triggerEvent(event);
  }

  /**
   * Run startup activation
   * @returns {Promise<void>}
   */
  async activateStartupExtensions() {
    await this._activationService.activateStartupExtensions();
  }

  /**
   * Execute a command
   * @param {string} commandId
   * @param {...any} args
   * @returns {Promise<any>}
   */
  async executeCommand(commandId, ...args) {
    // Trigger activation event for this command
    await this.triggerActivationEvent(`onCommand:${commandId}`);

    return this._commandRegistry.executeCommand(commandId, ...args);
  }

  /**
   * Register a command
   * @param {string} commandId
   * @param {Function} handler
   * @param {Object} options
   * @returns {Object}
   */
  registerCommand(commandId, handler, options = {}) {
    return this._commandRegistry.registerCommand(commandId, handler, options);
  }

  /**
   * Get all registered extensions
   * @returns {Object[]}
   */
  getExtensions() {
    const extensions = [];

    for (const descriptor of this._extensions.values()) {
      extensions.push({
        id: descriptor.id,
        name: descriptor.manifest.displayName,
        version: descriptor.manifest.version,
        publisher: descriptor.manifest.publisher,
        description: descriptor.manifest.description,
        isActive: descriptor.isActive,
        activationTime: descriptor.activationTime,
        error: descriptor.error,
      });
    }

    return extensions;
  }

  /**
   * Get extension by ID
   * @param {string} extensionId
   * @returns {Object | undefined}
   */
  getExtension(extensionId) {
    const descriptor = this._extensions.get(extensionId);

    if (!descriptor) {
      return undefined;
    }

    return {
      id: descriptor.id,
      isActive: descriptor.isActive,
      exports: descriptor.exports,
      manifest: descriptor.manifest,
    };
  }

  /**
   * Get all contributed functions (for AI tools)
   * @returns {Object[]}
   */
  getContributedFunctions() {
    return this._contributionRegistry.getAllFunctions();
  }

  /**
   * Get all contributed commands
   * @returns {Object[]}
   */
  getContributedCommands() {
    return this._contributionRegistry.getAllCommands();
  }

  /**
   * Get all contributed visualizations
   * @returns {Object[]}
   */
  getContributedVisualizations() {
    return this._contributionRegistry.getAllVisualizations();
  }

  /**
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    const activeCount = Array.from(this._extensions.values()).filter(d => d.isActive).length;

    return {
      extensions: {
        total: this._extensions.size,
        active: activeCount,
        inactive: this._extensions.size - activeCount,
      },
      contributions: this._contributionRegistry.getStats(),
      commands: this._commandRegistry.getStats(),
      activation: this._activationService.getStats(),
      host: this._extensionHost.getStats(),
    };
  }

  /**
   * Get the command registry
   * @returns {CommandRegistry}
   */
  get commands() {
    return this._commandRegistry;
  }

  /**
   * Get the contribution registry
   * @returns {ContributionRegistry}
   */
  get contributions() {
    return this._contributionRegistry;
  }

  /**
   * Get the activation service
   * @returns {ActivationEventsService}
   */
  get activation() {
    return this._activationService;
  }

  /**
   * Get the extension host
   * @returns {ExtensionHost}
   */
  get host() {
    return this._extensionHost;
  }

  /**
   * Emit an event
   * @private
   */
  _emitEvent(eventType, data) {
    const event = new CustomEvent('extensionService', {
      detail: { type: eventType, data, timestamp: Date.now() },
    });

    this._eventEmitter.dispatchEvent(event);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  /**
   * Add event listener
   * @param {string} eventType
   * @param {Function} callback
   * @returns {Object}
   */
  on(eventType, callback) {
    const handler = event => {
      if (event.detail.type === eventType) {
        callback(event.detail.data);
      }
    };

    this._eventEmitter.addEventListener('extensionService', handler);

    return {
      dispose: () => {
        this._eventEmitter.removeEventListener('extensionService', handler);
      },
    };
  }

  /**
   * Dispose the service
   * @returns {Promise<void>}
   */
  async dispose() {
    console.log('Disposing ExtensionService...');

    // Deactivate all extensions
    for (const extensionId of this._extensions.keys()) {
      try {
        await this.deactivateExtension(extensionId);
      } catch (error) {
        console.error(`Error deactivating ${extensionId}:`, error);
      }
    }

    // Dispose components
    await this._extensionHost.dispose();
    await this._contextFactory.disposeAll();
    this._contributionRegistry.dispose();
    this._commandRegistry.dispose();
    this._activationService.dispose();

    this._extensions.clear();
    this._isInitialized = false;

    console.log('ExtensionService disposed');
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtensionService,
    ExtensionDescriptor,
  };
} else if (typeof window !== 'undefined') {
  window.ExtensionService = ExtensionService;
  window.ExtensionDescriptor = ExtensionDescriptor;
}
