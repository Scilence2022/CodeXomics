// @ts-check
/**
 * ServiceContainer — Lightweight Dependency Injection Container
 *
 * Replaces the window-global service locator pattern with explicit
 * dependency registration and resolution. Supports lazy initialization,
 * singleton caching, and dependency graph validation.
 *
 * Usage:
 *   const container = new ServiceContainer();
 *   container.register('themeManager', (c) => new ThemeManager(c.get('config')));
 *   container.register('config', () => new ConfigManager());
 *   const theme = container.get('themeManager'); // auto-resolves 'config' first
 *
 * On migration from window globals:
 *   // Before: window.chatManager = new ChatManager();
 *   // After:  container.register('chatManager', (c) => new ChatManager(
 *   //            c.get('configManager'), c.get('mcpServerManager')
 *   //          ));
 *
 * @class ServiceContainer
 */
class ServiceContainer {
  constructor() {
    /** @type {Map<string, {factory: Function, deps: string[], instance: any}>} */
    this._registry = new Map();

    /** @type {Set<string>} */
    this._instantiating = new Set(); // Cycle detection during resolution
  }

  /**
   * Register a service factory
   * @param {string} name - Service identifier
   * @param {Function} factory - Factory function (container) => instance
   * @param {string[]} [dependencies=[]] - Names of dependencies (for documentation)
   */
  register(name, factory, dependencies = []) {
    if (this._registry.has(name)) {
      console.warn(`[ServiceContainer] Service "${name}" is already registered — overwriting`);
    }
    this._registry.set(name, {
      factory,
      deps: dependencies,
      instance: undefined,
    });
    return this;
  }

  /**
   * Get a service instance (lazy initialization with singleton caching)
   * @param {string} name - Service identifier
   * @returns {*} The service instance
   * @throws {Error} If service is not registered or has circular dependency
   */
  get(name) {
    const entry = this._registry.get(name);
    if (!entry) {
      throw new Error(`[ServiceContainer] Service "${name}" is not registered. Available: ${this.list().join(', ')}`);
    }

    // Return cached singleton
    if (entry.instance !== undefined) {
      return entry.instance;
    }

    // Cycle detection
    if (this._instantiating.has(name)) {
      throw new Error(`[ServiceContainer] Circular dependency detected for "${name}"`);
    }

    this._instantiating.add(name);
    try {
      entry.instance = entry.factory(this);
      return entry.instance;
    } finally {
      this._instantiating.delete(name);
    }
  }

  /**
   * Check if a service is registered
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._registry.has(name);
  }

  /**
   * List all registered service names
   * @returns {string[]}
   */
  list() {
    return Array.from(this._registry.keys());
  }

  /**
   * Get dependency graph info for debugging
   * @returns {Array<{name: string, deps: string[], instantiated: boolean}>}
   */
  getDependencyGraph() {
    return Array.from(this._registry.entries()).map(([name, entry]) => ({
      name,
      deps: entry.deps,
      instantiated: entry.instance !== undefined,
    }));
  }

  /**
   * Eagerly initialize all registered services (useful for validation)
   * @returns {string[]} Names of successfully initialized services
   */
  initializeAll() {
    const results = [];
    for (const name of this._registry.keys()) {
      try {
        this.get(name);
        results.push(name);
      } catch (error) {
        console.error(`[ServiceContainer] Failed to initialize "${name}":`, error);
        throw error;
      }
    }
    return results;
  }

  /**
   * Reset all cached instances (for testing/hot-reload)
   */
  reset() {
    for (const [, entry] of this._registry) {
      entry.instance = undefined;
    }
  }

  /**
   * Remove a service registration
   * @param {string} name
   */
  unregister(name) {
    this._registry.delete(name);
  }
}

// Export as CommonJS module for use in both main and renderer processes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServiceContainer;
}

// Also expose on window for global access during migration period
if (typeof window !== 'undefined') {
  window.ServiceContainer = ServiceContainer;
}
