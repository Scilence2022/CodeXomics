// @ts-check
/**
 * SettingsService - Settings modal and configuration management extracted from ChatManager
 */
class SettingsService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async toggleSettingsModal(parameters = {}) {
    const { modal_name: modalName, action = 'toggle' } = parameters;

    if (!modalName) {
      return {
        success: false,
        error: 'modal_name parameter is required. Supported: llm_config, chatbox_settings, general_settings, track_settings, mcp_settings, multi_agent_settings, tab_settings, search_settings, gene_detail_settings, external_tools, plugin_management, action_list, literature_settings',
      };
    }

    // Map modal names to their DOM IDs, open functions, and close functions
    const modalRegistry = {
      llm_config: {
        id: 'llmConfigModal',
        open: () => {
          if (window.llmConfigManager) {
            window.llmConfigManager.showConfigModal();
          } else {
            const modal = document.getElementById('llmConfigModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.llmConfigManager) {
            window.llmConfigManager.hideConfigModal();
          } else {
            const modal = document.getElementById('llmConfigModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      chatbox_settings: {
        id: 'chatboxSettingsModal',
        open: () => {
          if (window.chatBoxSettingsManager) {
            window.chatBoxSettingsManager.showSettingsModal();
          }
        },
        close: () => {
          const modal = document.getElementById('chatboxSettingsModal');
          if (modal) {
            modal.classList.remove('show');
            modal.style.display = 'none';
          }
        },
      },
      general_settings: {
        id: 'generalSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showGeneralSettingsModal) {
            window.genomeBrowser.showGeneralSettingsModal();
          } else {
            const modal = document.getElementById('generalSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('generalSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      track_settings: {
        id: 'trackSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.trackRenderer && window.genomeBrowser.trackRenderer.openTrackSettings) {
            window.genomeBrowser.trackRenderer.openTrackSettings('genes');
          }
        },
        close: () => {
          const modal = document.getElementById('trackSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      mcp_settings: {
        id: 'mcpSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showMCPSettingsModal) {
            window.genomeBrowser.showMCPSettingsModal();
          } else {
            const modal = document.getElementById('mcpSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('mcpSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      multi_agent_settings: {
        id: 'multiAgentSettingsModal',
        open: () => {
          if (window.multiAgentSettingsManager) {
            window.multiAgentSettingsManager.showModal();
          } else {
            const modal = document.getElementById('multiAgentSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.multiAgentSettingsManager) {
            window.multiAgentSettingsManager.hideModal();
          } else {
            const modal = document.getElementById('multiAgentSettingsModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      tab_settings: {
        id: 'tabSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.tabManager && window.genomeBrowser.tabManager.openTabSettingsModal) {
            window.genomeBrowser.tabManager.openTabSettingsModal();
          } else {
            const modal = document.getElementById('tabSettingsModal');
            if (modal) modal.style.display = 'flex';
          }
        },
        close: () => {
          if (window.genomeBrowser && window.genomeBrowser.tabManager && window.genomeBrowser.tabManager.closeTabSettingsModal) {
            window.genomeBrowser.tabManager.closeTabSettingsModal();
          } else {
            const modal = document.getElementById('tabSettingsModal');
            if (modal) modal.style.display = 'none';
          }
        },
      },
      search_settings: {
        id: 'searchSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.navigationManager && window.genomeBrowser.navigationManager.showSearchSettingsModal) {
            window.genomeBrowser.navigationManager.showSearchSettingsModal();
          } else {
            const modal = document.getElementById('searchSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('searchSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      gene_detail_settings: {
        id: 'geneDetailSettingsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showGeneDetailSettings) {
            window.genomeBrowser.showGeneDetailSettings();
          } else {
            const modal = document.getElementById('geneDetailSettingsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('geneDetailSettingsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      external_tools: {
        id: 'externalToolsModal',
        open: () => {
          if (window.genomeBrowser && window.genomeBrowser.showExternalToolsModal) {
            window.genomeBrowser.showExternalToolsModal();
          } else {
            const modal = document.getElementById('externalToolsModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          const modal = document.getElementById('externalToolsModal');
          if (modal) modal.classList.remove('show');
        },
      },
      plugin_management: {
        id: 'pluginManagementModal',
        open: () => {
          if (window.pluginManagementUI && window.pluginManagementUI.showPluginModal) {
            window.pluginManagementUI.showPluginModal();
          } else {
            const modal = document.getElementById('pluginManagementModal');
            if (modal) {
              modal.style.display = '';
              if (window.modalDragManager) {
                window.modalDragManager.resetPosition('#pluginManagementModal');
              }
              modal.classList.add('show');
            }
          }
        },
        close: () => {
          if (window.pluginManagementUI && window.pluginManagementUI.hidePluginModal) {
            window.pluginManagementUI.hidePluginModal();
          } else {
            const modal = document.getElementById('pluginManagementModal');
            if (modal) {
              modal.classList.remove('show');
              modal.style.display = '';
            }
          }
        },
      },
      action_list: {
        id: 'actionListModal',
        open: () => {
          if (window.actionManager && window.actionManager.showActionList) {
            window.actionManager.showActionList();
          } else {
            const modal = document.getElementById('actionListModal');
            if (modal) modal.classList.add('show');
          }
        },
        close: () => {
          if (window.actionManager && window.actionManager.closeActionList) {
            window.actionManager.closeActionList();
          } else {
            const modal = document.getElementById('actionListModal');
            if (modal) modal.classList.remove('show');
          }
        },
      },
      literature_settings: {
        id: 'literatureSettingsModal',
        open: () => {
          if (window.literatureSettings && window.literatureSettings.showModal) {
            window.literatureSettings.showModal();
          }
        },
        close: () => {
          if (window.literatureSettings && window.literatureSettings.closeModal) {
            window.literatureSettings.closeModal();
          } else {
            const modal = document.getElementById('literatureSettingsModal');
            if (modal) modal.remove();
          }
        },
      },
    };

    const entry = modalRegistry[modalName];
    if (!entry) {
      return {
        success: false,
        error: `Unknown modal: '${modalName}'. Supported: ${Object.keys(modalRegistry).join(', ')}`,
      };
    }

    try {
      // Determine current state and action to perform
      const modal = document.getElementById(entry.id);
      const isOpen = modal ? modal.classList.contains('show') || modal.style.display === 'flex' || modal.style.display === 'block' : false;

      let effectiveAction = action;
      if (action === 'toggle') {
        effectiveAction = isOpen ? 'close' : 'open';
      }

      if (effectiveAction === 'open') {
        entry.open();
        return {
          success: true,
          message: `Opened ${modalName} settings modal`,
          modal_name: modalName,
          new_state: 'open',
        };
      } else if (effectiveAction === 'close') {
        entry.close();
        return {
          success: true,
          message: `Closed ${modalName} settings modal`,
          modal_name: modalName,
          new_state: 'closed',
        };
      } else {
        return {
          success: false,
          error: `Invalid action: '${action}'. Use 'open', 'close', or 'toggle'.`,
        };
      }
    } catch (error) {
      console.error(`[SettingsService] toggleSettingsModal error:`, error);
      return {
        success: false,
        error: error.message,
        modal_name: modalName,
      };
    }
  }

  /**
   * Switch UI style / theme
   * Changes the application's visual style preset and/or dark/light mode
   */
  async switchUiStyle(parameters = {}) {
    const { style_name: styleName, dark_mode: darkMode } = parameters;
    const themeManager = window.themeManager;
    const generalSettingsManager = window.generalSettingsManager;

    if (!themeManager) {
      return {
        success: false,
        error: 'ThemeManager is not available',
      };
    }

    const availableStyles = themeManager.getAvailableStyles().map(s => s.id);
    const results = [];

    try {
      // Apply style preset if specified
      if (styleName) {
        if (!availableStyles.includes(styleName)) {
          return {
            success: false,
            error: `Unknown style: '${styleName}'`,
            available_styles: availableStyles,
            message: `Available styles: ${availableStyles.join(', ')}`,
          };
        }
        await themeManager.switchStyle(styleName);
        results.push(`Style switched to '${styleName}'`);

        // Also sync GeneralSettingsManager
        if (generalSettingsManager) {
          generalSettingsManager.settings.uiStyle = styleName;
          const preset = themeManager.stylePresets[styleName];
          if (preset) {
            generalSettingsManager.settings.accentColor = preset.variables['--primary-color'];
          }
        }
      }

      // Apply dark/light mode if specified
      if (darkMode) {
        let targetIsDark;
        if (darkMode === 'dark') {
          targetIsDark = true;
        } else if (darkMode === 'light') {
          targetIsDark = false;
        } else if (darkMode === 'toggle') {
          targetIsDark = !themeManager.isDarkMode();
        }

        if (targetIsDark !== undefined) {
          const themeMode = targetIsDark ? 'dark' : 'light';
          if (generalSettingsManager) {
            generalSettingsManager.settings.themeMode = themeMode;
            generalSettingsManager.applyTheme(themeMode);
          } else {
            themeManager.applyDarkModeOverrides(targetIsDark);
          }
          results.push(`Dark mode ${targetIsDark ? 'enabled' : 'disabled'}`);
        }
      }

      // If neither specified, just return current state
      if (!styleName && !darkMode) {
        const currentStyle = themeManager.getCurrentStyle();
        const isDark = themeManager.isDarkMode();
        return {
          success: true,
          message: `Current UI style: '${currentStyle}' (${isDark ? 'dark' : 'light'} mode)`,
          style_name: currentStyle,
          dark_mode: isDark,
          available_styles: availableStyles,
        };
      }

      return {
        success: true,
        message: results.join('. ') || 'UI style updated',
        style_name: themeManager.getCurrentStyle(),
        dark_mode: themeManager.isDarkMode(),
      };
    } catch (error) {
      console.error(`[SettingsService] switchUiStyle error:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  showConfigOptions() {
    const options = [
      'Export chat history as JSON',
      'Export chat history as TXT',
      'Export chat history as CSV',
      'Clear all chat history',
      'Export all configurations',
      'Show config summary',
      'Debug storage info',
      'Test MicrobeGenomics integration',
      'Test tool execution',
    ];

    const optionsHTML = options
      .map(
        (option, index) =>
          `<button class="suggestion-btn" onclick="chatManager.services.settings.handleConfigOption(${index})">${option}</button>`
      )
      .join('');

    this.chatManager.services.messaging.addMessageToChat(
      `<div class="config-options-container">
                <p><i class="fas fa-cog"></i> Configuration Options:</p>
                ${optionsHTML}
            </div>`,
      'assistant'
    );
  }

  async handleConfigOption(optionIndex) {
    try {
      switch (optionIndex) {
        case 0: // Export JSON
          await this.chatManager.services.messaging.exportChatHistory('json');
          this.chatManager.services.messaging.addMessageToChat('✅ Chat history exported as JSON', 'assistant');
          break;
        case 1: // Export TXT
          await this.chatManager.services.messaging.exportChatHistory('txt');
          this.chatManager.services.messaging.addMessageToChat('✅ Chat history exported as TXT', 'assistant');
          break;
        case 2: // Export CSV
          await this.chatManager.services.messaging.exportChatHistory('csv');
          this.chatManager.services.messaging.addMessageToChat('✅ Chat history exported as CSV', 'assistant');
          break;
        case 3: // Clear history
          this.chatManager.services.messaging.clearChat();
          this.chatManager.services.messaging.addMessageToChat('🗑️ Chat history cleared', 'assistant');
          break;
        case 4: // Export all config
          await this.chatManager.configManager.exportConfig();
          this.chatManager.services.messaging.addMessageToChat('✅ All configurations exported', 'assistant');
          break;
        case 5: // Show summary
          const summary = this.chatManager.configManager.getConfigSummary();
          this.chatManager.services.messaging.addMessageToChat(
            `📊 **Configuration Summary:**\n` +
            `• Version: ${summary.version}\n` +
            `• LLM Provider: ${summary.llmProvider || 'None'}\n` +
            `• Enabled Providers: ${summary.llmProvidersEnabled.join(', ') || 'None'}\n` +
            `• Theme: ${summary.theme}\n` +
            `• Chat History: ${summary.chatHistoryLength} messages\n` +
            `• Recent Files: ${summary.recentFilesCount}\n` +
            `• Debug Mode: ${summary.debugMode ? 'On' : 'Off'}`,
            'assistant'
          );
          break;
        case 6: // Debug storage info
          const storageInfo = this.chatManager.configManager.getStorageInfo();
          this.chatManager.services.messaging.addMessageToChat(
            `🔧 **Storage Debug Info:**\n` +
            `• Is Electron: ${storageInfo.isElectron}\n` +
            `• Using Files: ${storageInfo.usingFiles}\n` +
            `• Using localStorage: ${storageInfo.usingLocalStorage}\n` +
            `• Is Initialized: ${storageInfo.isInitialized}\n` +
            `• Config Path: ${storageInfo.configPath ? 'Available' : 'None'}\n` +
            `• Storage Method: ${storageInfo.usingFiles ? 'File-based' : 'localStorage'}`,
            'assistant'
          );
          break;
        case 7: // Test MicrobeGenomics integration
          const integrationResult = this.chatManager.testMicrobeGenomicsIntegration();
          this.chatManager.services.messaging.addMessageToChat(
            `🧬 **MicrobeGenomics Integration Test:**\n` +
            `• Integration: ${integrationResult.success ? '✅ Success' : '❌ Failed'}\n` +
            `• Functions Available: ${integrationResult.totalFunctions || 0}\n` +
            `• Categories Available: ${integrationResult.categoriesAvailable ? '✅' : '❌'}\n` +
            `• Examples Available: ${integrationResult.examplesAvailable ? '✅' : '❌'}\n` +
            `• Function Test: ${integrationResult.functionCallTest?.success ? '✅ Passed' : '❌ Failed'}\n` +
            (integrationResult.error ? `• Error: ${integrationResult.error}` : ''),
            'assistant'
          );
          break;
        case 8: // Test tool execution
          const executionResult = await this.chatManager.testToolExecution();
          this.chatManager.services.messaging.addMessageToChat(
            `🔧 **Tool Execution Test:**\n` +
            `• Status: ${executionResult.success ? '✅ All tests passed' : '❌ Tests failed'}\n` +
            `• GC Calculation: ${executionResult.tests?.gc ? '✅ Working' : '❌ Failed'}\n` +
            `• Reverse Complement: ${executionResult.tests?.reverseComplement ? '✅ Working' : '❌ Failed'}\n` +
            `• Navigation: ${executionResult.tests?.currentRegion ? '✅ Working' : '❌ Failed'}\n` +
            (executionResult.error ? `• Error: ${executionResult.error}` : ''),
            'assistant'
          );
          break;
      }
    } catch (error) {
      this.chatManager.services.messaging.addMessageToChat(`❌ Error: ${error.message}`, 'assistant', true);
    }
  }

  /**
   * Start a new chat conversation
   */
  startNewChat() {
    console.log('Starting new chat...');

    // Original ChatBox functionality
    this.chatManager.services.messaging.clearChat();
    this.chatManager.conversationState.contextModeEnabled = false;

    // Add conversation separator for ChatBox history
    if (this.chatManager.configManager) {
      this.chatManager.configManager.addChatMessage('--- CONVERSATION_SEPARATOR ---', 'system');
    }

    this.showNotification('New conversation started', 'success');
  }

  /**
   * Show a temporary notification to the user
   */
  showNotification(message, type = 'info') {
    // Remove any existing notification
    const existingNotification = document.getElementById('chatNotification');
    if (existingNotification) {
      existingNotification.remove();
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'chatNotification';
    notification.className = `chat-notification ${type}`;
    notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

    // Add to chat panel
    const chatPanel = document.getElementById('llmChatPanel');
    if (chatPanel) {
      chatPanel.appendChild(notification);

      // Auto-remove after 3 seconds
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 3000);
    }
  }

  /**
   * Test function to verify chat functionality
   */
  testChatFunctionality() {
    console.log('=== Testing Chat Functionality ===');

    // Test 1: Check if UI elements exist
    const chatInput = document.getElementById('chatInput');
    const newChatBtn = document.getElementById('newChatBtn');

    console.log('UI Elements Check:');
    console.log('- Chat Input:', chatInput ? '✅' : '❌');
    console.log('- New Chat Button:', newChatBtn ? '✅' : '❌');

    // Test 2: Check chat history loading
    const history = this.chatManager.configManager.getChatHistory();
    console.log('Chat History:', history.length, 'messages');

    // Test 3: Show notification
    this.showNotification('🧪 Chat functionality test completed', 'success');

    return {
      uiElements: {
        chatInput: !!chatInput,
        newChatBtn: !!newChatBtn,
      },
      historyCount: history.length,
      testCompleted: true,
    };
  }
}
window.SettingsService = SettingsService;
