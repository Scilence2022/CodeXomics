/**
 * CommandRegistry - Centralized command registration and execution
 *
 * Modeled after VS Code's commands namespace, this provides:
 * - Command registration with handlers
 * - Command execution with arguments
 * - Command palette integration
 * - Keybinding support
 * - Context-aware command enablement
 *
 * @see https://code.visualstudio.com/api/references/vscode-api#commands
 */

/**
 * CommandDefinition - Full definition of a command
 */
class CommandDefinition {
  /**
   * @param {Object} options - Command options
   */
  constructor(options) {
    this.id = options.id;
    this.handler = options.handler;
    this.title = options.title || '';
    this.category = options.category || '';
    this.description = options.description || '';
    this.icon = options.icon || null;
    this.keybinding = options.keybinding || null;
    this.enablement = options.enablement || null;
    this.extensionId = options.extensionId || null;
    this.isInternal = options.isInternal || false;

    // Execution tracking
    this.executionCount = 0;
    this.lastExecuted = null;
    this.totalExecutionTime = 0;
  }

  /**
   * Record an execution
   * @param {number} duration
   */
  recordExecution(duration) {
    this.executionCount++;
    this.lastExecuted = Date.now();
    this.totalExecutionTime += duration;
  }

  /**
   * Get average execution time
   * @returns {number}
   */
  get averageExecutionTime() {
    return this.executionCount > 0 ? this.totalExecutionTime / this.executionCount : 0;
  }
}

/**
 * CommandRegistry - Main command registry class
 */
class CommandRegistry {
  constructor() {
    /** @type {Map<string, CommandDefinition>} */
    this._commands = new Map();

    /** @type {Map<string, Set<string>>} */
    this._commandsByExtension = new Map();

    /** @type {Map<string, Set<string>>} */
    this._commandsByCategory = new Map();

    // Context for command enablement
    this._context = new Map();

    // Event emitter
    this._eventEmitter = new EventTarget();

    // Statistics
    this._stats = {
      totalRegistrations: 0,
      totalExecutions: 0,
      failedExecutions: 0,
    };

    console.log('CommandRegistry initialized');
  }

  /**
   * Register a command
   * @param {string} commandId - Unique command ID
   * @param {Function} handler - Command handler function
   * @param {Object} options - Additional options
   * @returns {Disposable}
   */
  registerCommand(commandId, handler, options = {}) {
    if (this._commands.has(commandId)) {
      console.warn(`Command ${commandId} is already registered, replacing...`);
      this.unregisterCommand(commandId);
    }

    const definition = new CommandDefinition({
      id: commandId,
      handler,
      ...options,
    });

    this._commands.set(commandId, definition);
    this._stats.totalRegistrations++;

    // Track by extension
    if (options.extensionId) {
      if (!this._commandsByExtension.has(options.extensionId)) {
        this._commandsByExtension.set(options.extensionId, new Set());
      }
      this._commandsByExtension.get(options.extensionId).add(commandId);
    }

    // Track by category
    if (options.category) {
      if (!this._commandsByCategory.has(options.category)) {
        this._commandsByCategory.set(options.category, new Set());
      }
      this._commandsByCategory.get(options.category).add(commandId);
    }

    this._emitEvent('commandRegistered', {
      commandId,
      extensionId: options.extensionId,
    });

    console.log(`Command registered: ${commandId}`);

    // Return disposable
    return {
      dispose: () => this.unregisterCommand(commandId),
    };
  }

  /**
   * Register a text editor command (requires active editor)
   * @param {string} commandId - Unique command ID
   * @param {Function} handler - Handler receives (editor, edit, ...args)
   * @param {Object} options - Additional options
   * @returns {Disposable}
   */
  registerTextEditorCommand(commandId, handler, options = {}) {
    const wrappedHandler = async (...args) => {
      // Get active editor context
      const editor = this._getActiveEditor();

      if (!editor) {
        throw new Error('No active text editor');
      }

      // Create edit builder (simplified)
      const editBuilder = this._createEditBuilder(editor);

      return await handler(editor, editBuilder, ...args);
    };

    return this.registerCommand(commandId, wrappedHandler, {
      ...options,
      requiresEditor: true,
    });
  }

  /**
   * Get active editor (stub - should be connected to actual editor)
   * @private
   * @returns {Object | null}
   */
  _getActiveEditor() {
    if (typeof window !== 'undefined' && window.activeEditor) {
      return window.activeEditor;
    }
    return null;
  }

  /**
   * Create edit builder (stub)
   * @private
   * @param {Object} editor
   * @returns {Object}
   */
  _createEditBuilder(editor) {
    return {
      insert: (position, text) => {
        console.log(`Insert at ${position}: ${text}`);
      },
      delete: range => {
        console.log(`Delete range: ${range}`);
      },
      replace: (range, text) => {
        console.log(`Replace range: ${range} with: ${text}`);
      },
    };
  }

  /**
   * Unregister a command
   * @param {string} commandId
   * @returns {boolean}
   */
  unregisterCommand(commandId) {
    const definition = this._commands.get(commandId);

    if (!definition) {
      return false;
    }

    this._commands.delete(commandId);

    // Remove from extension tracking
    if (definition.extensionId) {
      const extCommands = this._commandsByExtension.get(definition.extensionId);
      if (extCommands) {
        extCommands.delete(commandId);
        if (extCommands.size === 0) {
          this._commandsByExtension.delete(definition.extensionId);
        }
      }
    }

    // Remove from category tracking
    if (definition.category) {
      const catCommands = this._commandsByCategory.get(definition.category);
      if (catCommands) {
        catCommands.delete(commandId);
        if (catCommands.size === 0) {
          this._commandsByCategory.delete(definition.category);
        }
      }
    }

    this._emitEvent('commandUnregistered', { commandId });
    console.log(`Command unregistered: ${commandId}`);

    return true;
  }

  /**
   * Execute a command
   * @param {string} commandId - Command to execute
   * @param {...any} args - Arguments to pass to handler
   * @returns {Promise<any>}
   */
  async executeCommand(commandId, ...args) {
    const definition = this._commands.get(commandId);

    if (!definition) {
      throw new Error(`Command not found: ${commandId}`);
    }

    // Check enablement
    if (definition.enablement && !this._evaluateEnablement(definition.enablement)) {
      throw new Error(`Command ${commandId} is not enabled in current context`);
    }

    const startTime = performance.now();

    try {
      this._stats.totalExecutions++;

      const result = await Promise.resolve(definition.handler(...args));

      const duration = performance.now() - startTime;
      definition.recordExecution(duration);

      this._emitEvent('commandExecuted', {
        commandId,
        duration,
        success: true,
      });

      return result;
    } catch (error) {
      this._stats.failedExecutions++;

      this._emitEvent('commandExecuted', {
        commandId,
        duration: performance.now() - startTime,
        success: false,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Get all registered command IDs
   * @param {boolean} filterInternal - Filter out internal commands (starting with _)
   * @returns {string[]}
   */
  getCommands(filterInternal = true) {
    const commands = Array.from(this._commands.keys());

    if (filterInternal) {
      return commands.filter(cmd => !cmd.startsWith('_'));
    }

    return commands;
  }

  /**
   * Get command definition
   * @param {string} commandId
   * @returns {CommandDefinition | undefined}
   */
  getCommand(commandId) {
    return this._commands.get(commandId);
  }

  /**
   * Check if a command exists
   * @param {string} commandId
   * @returns {boolean}
   */
  hasCommand(commandId) {
    return this._commands.has(commandId);
  }

  /**
   * Get commands by extension
   * @param {string} extensionId
   * @returns {string[]}
   */
  getCommandsByExtension(extensionId) {
    const commands = this._commandsByExtension.get(extensionId);
    return commands ? Array.from(commands) : [];
  }

  /**
   * Get commands by category
   * @param {string} category
   * @returns {string[]}
   */
  getCommandsByCategory(category) {
    const commands = this._commandsByCategory.get(category);
    return commands ? Array.from(commands) : [];
  }

  /**
   * Get all categories
   * @returns {string[]}
   */
  getCategories() {
    return Array.from(this._commandsByCategory.keys());
  }

  /**
   * Get commands for command palette
   * @returns {Object[]}
   */
  getCommandPaletteItems() {
    const items = [];

    for (const definition of this._commands.values()) {
      if (definition.isInternal) {
        continue;
      }

      // Check enablement
      const enabled = !definition.enablement || this._evaluateEnablement(definition.enablement);

      items.push({
        id: definition.id,
        label: definition.category ? `${definition.category}: ${definition.title}` : definition.title,
        description: definition.description,
        enabled,
        keybinding: definition.keybinding,
      });
    }

    // Sort by category and title
    items.sort((a, b) => a.label.localeCompare(b.label));

    return items;
  }

  /**
   * Set context value for command enablement
   * @param {string} key - Context key
   * @param {any} value - Context value
   */
  setContext(key, value) {
    if (value === undefined) {
      this._context.delete(key);
    } else {
      this._context.set(key, value);
    }

    this._emitEvent('contextChanged', { key, value });
  }

  /**
   * Get context value
   * @param {string} key
   * @returns {any}
   */
  getContext(key) {
    return this._context.get(key);
  }

  /**
   * Evaluate enablement expression
   * @private
   * @param {string} expression
   * @returns {boolean}
   */
  _evaluateEnablement(expression) {
    // Simple expression evaluator for context conditions
    // Supports: key, !key, key == value, key != value, && and ||

    try {
      // Replace context variables with actual values
      let expr = expression;

      for (const [key, value] of this._context) {
        const regex = new RegExp(`\\b${key}\\b`, 'g');
        expr = expr.replace(regex, JSON.stringify(value));
      }

      // Handle undefined context keys as false
      expr = expr.replace(/\b[a-zA-Z][a-zA-Z0-9_.]*\b/g, match => {
        // Skip known literals
        if (['true', 'false', 'null', 'undefined'].includes(match)) {
          return match;
        }
        return 'false';
      });

      // Evaluate
      // eslint-disable-next-line no-new-func -- intentional: evaluates a sanitized when-clause enablement expression
      return new Function(`return ${expr}`)();
    } catch (error) {
      console.warn(`Failed to evaluate enablement: ${expression}`, error);
      return true; // Default to enabled on error
    }
  }

  /**
   * Unregister all commands from an extension
   * @param {string} extensionId
   */
  unregisterExtensionCommands(extensionId) {
    const commands = this.getCommandsByExtension(extensionId);

    for (const commandId of commands) {
      this.unregisterCommand(commandId);
    }
  }

  /**
   * Get registry statistics
   * @returns {Object}
   */
  getStats() {
    return {
      ...this._stats,
      registeredCommands: this._commands.size,
      categories: this._commandsByCategory.size,
      extensions: this._commandsByExtension.size,
    };
  }

  /**
   * Emit an event
   * @private
   */
  _emitEvent(eventType, data) {
    const event = new CustomEvent('commandRegistry', {
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

    this._eventEmitter.addEventListener('commandRegistry', handler);

    return {
      dispose: () => {
        this._eventEmitter.removeEventListener('commandRegistry', handler);
      },
    };
  }

  /**
   * Clear all commands
   */
  clear() {
    this._commands.clear();
    this._commandsByExtension.clear();
    this._commandsByCategory.clear();
    this._context.clear();
  }

  /**
   * Dispose the registry
   */
  dispose() {
    this.clear();
  }
}

/**
 * CommandPalette - UI for command selection (simplified)
 */
class CommandPalette {
  /**
   * @param {CommandRegistry} registry
   */
  constructor(registry) {
    this._registry = registry;
    this._isOpen = false;
    this._filter = '';
    this._selectedIndex = 0;
  }

  /**
   * Open the command palette
   */
  open() {
    this._isOpen = true;
    this._filter = '';
    this._selectedIndex = 0;

    console.log('Command palette opened');
  }

  /**
   * Close the command palette
   */
  close() {
    this._isOpen = false;
    console.log('Command palette closed');
  }

  /**
   * Filter commands
   * @param {string} filter
   * @returns {Object[]}
   */
  filter(filter) {
    this._filter = filter.toLowerCase();

    const items = this._registry.getCommandPaletteItems();

    if (!this._filter) {
      return items;
    }

    return items.filter(
      item =>
        item.label.toLowerCase().includes(this._filter) ||
        (item.description && item.description.toLowerCase().includes(this._filter))
    );
  }

  /**
   * Execute selected command
   * @param {string} commandId
   */
  async execute(commandId) {
    this.close();
    await this._registry.executeCommand(commandId);
  }

  /**
   * Get current state
   * @returns {Object}
   */
  getState() {
    return {
      isOpen: this._isOpen,
      filter: this._filter,
      selectedIndex: this._selectedIndex,
      items: this.filter(this._filter),
    };
  }
}

/**
 * KeybindingRegistry - Manages keyboard shortcuts
 */
class KeybindingRegistry {
  /**
   * @param {CommandRegistry} commandRegistry
   */
  constructor(commandRegistry) {
    this._commandRegistry = commandRegistry;
    /** @type {Map<string, string>} */
    this._keybindings = new Map();
    this._isListening = false;
  }

  /**
   * Register a keybinding
   * @param {string} key - Key combination (e.g., "ctrl+shift+p")
   * @param {string} commandId - Command to execute
   * @param {Object} options - Options
   * @returns {Object}
   */
  register(key, commandId, options = {}) {
    const normalizedKey = this._normalizeKey(key);

    if (this._keybindings.has(normalizedKey)) {
      console.warn(`Keybinding ${key} is already registered, replacing...`);
    }

    this._keybindings.set(normalizedKey, commandId);

    // Update command definition
    const command = this._commandRegistry.getCommand(commandId);
    if (command) {
      command.keybinding = key;
    }

    return {
      dispose: () => this.unregister(key),
    };
  }

  /**
   * Unregister a keybinding
   * @param {string} key
   */
  unregister(key) {
    const normalizedKey = this._normalizeKey(key);
    this._keybindings.delete(normalizedKey);
  }

  /**
   * Normalize key combination
   * @private
   * @param {string} key
   * @returns {string}
   */
  _normalizeKey(key) {
    return key.toLowerCase().replace(/\s+/g, '').split('+').sort().join('+');
  }

  /**
   * Handle key event
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  handleKeyEvent(event) {
    const key = this._eventToKey(event);
    const normalizedKey = this._normalizeKey(key);

    const commandId = this._keybindings.get(normalizedKey);

    if (commandId) {
      event.preventDefault();
      this._commandRegistry.executeCommand(commandId).catch(console.error);
      return true;
    }

    return false;
  }

  /**
   * Convert key event to key string
   * @private
   * @param {KeyboardEvent} event
   * @returns {string}
   */
  _eventToKey(event) {
    const parts = [];

    if (event.ctrlKey || event.metaKey) parts.push('ctrl');
    if (event.altKey) parts.push('alt');
    if (event.shiftKey) parts.push('shift');

    const key = event.key.toLowerCase();
    if (!['control', 'alt', 'shift', 'meta'].includes(key)) {
      parts.push(key);
    }

    return parts.join('+');
  }

  /**
   * Start listening for keyboard events
   */
  startListening() {
    if (this._isListening) return;

    this._isListening = true;
    this._keyHandler = event => this.handleKeyEvent(event);

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this._keyHandler);
    }
  }

  /**
   * Stop listening for keyboard events
   */
  stopListening() {
    this._isListening = false;

    if (typeof window !== 'undefined' && this._keyHandler) {
      window.removeEventListener('keydown', this._keyHandler);
    }
  }

  /**
   * Get all keybindings
   * @returns {Object[]}
   */
  getKeybindings() {
    const bindings = [];

    for (const [key, commandId] of this._keybindings) {
      bindings.push({
        key,
        commandId,
        command: this._commandRegistry.getCommand(commandId),
      });
    }

    return bindings;
  }

  /**
   * Dispose
   */
  dispose() {
    this.stopListening();
    this._keybindings.clear();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CommandRegistry,
    CommandDefinition,
    CommandPalette,
    KeybindingRegistry,
  };
} else if (typeof window !== 'undefined') {
  window.CommandRegistry = CommandRegistry;
  window.CommandDefinition = CommandDefinition;
  window.CommandPalette = CommandPalette;
  window.KeybindingRegistry = KeybindingRegistry;
}
