// @ts-check
/**
 * PluginIntegrationService — Extracted from ChatManager.js
 *
 * Manages the lifecycle of the PluginManagerV2 integration, connecting
 * the plugin system to the dynamic tools registry and multi-agent system.
 *
 * Usage:
 *   const pluginService = new PluginIntegrationService(chatManager);
 *   await pluginService.initialize();
 *
 * @class PluginIntegrationService
 */
class PluginIntegrationService {
  /**
   * @param {Object} chatManager - Reference to ChatManager instance
   */
  constructor(chatManager) {
    this.chatManager = chatManager;
  }

  /**
   * Initialize Plugin Manager V2 integration
   */
  async initialize() {
    console.log('📦 [PluginIntegrationService] Initializing plugin manager...');

    try {
      if (typeof PluginManagerV2 !== 'undefined') {
        this.chatManager.pluginManager = new PluginManagerV2(this.chatManager.app, this.chatManager.configManager);

        await this.chatManager.pluginManager.waitForInitialization();
        console.log('✅ PluginManagerV2 fully initialized');

        this._registerPluginEvents();
        this.connectToDynamicTools();
      }
    } catch (error) {
      console.error('❌ Failed to initialize PluginManagerV2:', error);
    }
  }

  /**
   * Register event listeners on the plugin manager
   * @private
   */
  _registerPluginEvents() {
    if (!this.chatManager.pluginManager) return;

    this.chatManager.pluginManager.on('system-initialized', () => {});
    this.chatManager.pluginManager.on('function-executed', () => {});
    this.chatManager.pluginManager.on('function-error', () => {});

    this.chatManager.pluginManager.on('plugin-registered', () => {
      this.onPluginStateChanged();
    });
  }

  /**
   * Wait for plugin manager to be fully initialized
   */
  async waitForReady() {
    if (this.chatManager._pluginManagerReady) {
      await this.chatManager._pluginManagerReady;
    }
    if (this.chatManager.pluginManager && this.chatManager.pluginManager.waitForInitialization) {
      await this.chatManager.pluginManager.waitForInitialization();
    }
  }

  /**
   * Connect PluginManager to Dynamic Tools after initialization
   */
  connectToDynamicTools() {
    if (!this.chatManager.pluginManager) {
      console.warn('⚠ PluginManager not initialized, cannot connect to Dynamic Tools');
      return;
    }

    if (typeof this.chatManager.connectPluginManagerToDynamicTools === 'function') {
      this.chatManager.connectPluginManagerToDynamicTools();
    }
  }

  /**
   * Handle plugin state changes — notify dynamic tools registry
   */
  onPluginStateChanged() {
    if (this.chatManager.onPluginStateChanged) {
      this.chatManager.onPluginStateChanged();
    }
  }
}

module.exports = PluginIntegrationService;
