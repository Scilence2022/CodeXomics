/**
 * Primer ChatManager Integration
 * Loads PrimerDesigner and PrimerToolSchemas into the browser environment
 * and creates the PrimerFunctionTools instance for backward compatibility.
 *
 * Actual tool execution is handled by PrimerService (ToolExecutionService PRIORITY 2),
 * which calls PrimerDesigner directly — no ChatManager prototype methods needed.
 */

// This script initializes the primer subsystem
(function () {
  'use strict';

  console.log('🧬 [Primer Integration] Loading Primer ChatManager integration...');

  /**
   * Initialize Primer Function Tools for ChatManager
   * Should be called during ChatManager initialization
   */
  async function initializePrimerFunctionTools() {
    try {
      // Load PrimerDesigner dependency first
      await this.loadScript('modules/PrimerDesigner.js');

      // Load shared schemas
      await this.loadScript('modules/PrimerToolSchemas.js');

      // Load PrimerFunctionTools module (for backward compat / getAvailableTools)
      await this.loadScript('modules/PrimerFunctionTools.js');

      // Load PrimerService into the service layer
      await this.loadScript('modules/chat/services/PrimerService.js');

      if (typeof window.PrimerFunctionTools === 'undefined') {
        console.error('❌ [Primer Integration] PrimerFunctionTools class not loaded');
        return false;
      }

      // Create PrimerFunctionTools instance (used by getAvailableTools / tool listing)
      this.primerFunctionTools = new window.PrimerFunctionTools(this.app);

      console.log('✅ [Primer Integration] PrimerFunctionTools initialized');
      console.log(`📋 [Primer Integration] Available tools: ${this.primerFunctionTools.getAvailableTools().length}`);

      return true;
    } catch (error) {
      console.error('❌ [Primer Integration] Failed to initialize PrimerFunctionTools:', error);
      return false;
    }
  }

  // Extend ChatManager prototype with initialization only
  // Tool execution is handled by PrimerService (ToolExecutionService PRIORITY 2)
  if (typeof window.ChatManager !== 'undefined') {
    window.ChatManager.prototype.initializePrimerFunctionTools = initializePrimerFunctionTools;

    console.log('✅ [Primer Integration] ChatManager extended with Primer initialization');
  } else {
    console.warn('⚠️ [Primer Integration] ChatManager not available globally');
  }
})();
