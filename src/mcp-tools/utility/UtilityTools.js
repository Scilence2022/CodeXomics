/**
 * UtilityTools Module
 * Provides utility tools for file operations including downloading and viewing files
 */

class UtilityTools {
  constructor(server) {
    this.server = server;
    this.tools = this.defineTools();
  }

  defineTools() {
    return {
      download_internet_file: {
        name: 'download_internet_file',
        description:
          'Download a file from the internet (URL) to a local path. Useful for downloading data files, reports, or any web-accessible resources.',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the file to download (e.g., https://example.com/file.txt)',
            },
            destinationPath: {
              type: 'string',
              description:
                'Local directory path where the file should be saved. If not provided, saves to the current workspace downloads folder.',
            },
            filename: {
              type: 'string',
              description:
                'Filename to save the downloaded file as. If not provided, the filename is extracted from the URL.',
            },
          },
          required: ['url'],
        },
      },

      view_markdown_file: {
        name: 'view_markdown_file',
        description:
          'Open and view a markdown (.md) file in a dedicated viewer window with proper rendering. Use this to display markdown reports, documentation, or any .md files.',
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Absolute path to the markdown file to view',
            },
            title: {
              type: 'string',
              description: 'Custom window title for the viewer. If not provided, uses the filename.',
            },
          },
          required: ['filePath'],
        },
      },

      toggle_settings_modal: {
        name: 'toggle_settings_modal',
        description:
          "Open or close application settings modals/panels. Use this when users ask to open, close, show, hide, or toggle any settings interface such as LLM configuration, ChatBox settings, General settings, Track settings, MCP server settings, Multi-Agent settings, etc. Supported modal_name values: 'llm_config', 'chatbox_settings', 'general_settings', 'track_settings', 'mcp_settings', 'multi_agent_settings', 'tab_settings', 'search_settings', 'gene_detail_settings', 'external_tools', 'plugin_management', 'action_list', 'literature_settings'.",
        parameters: {
          type: 'object',
          properties: {
            modal_name: {
              type: 'string',
              description:
                "The settings modal to toggle. Supported values: 'llm_config', 'chatbox_settings', 'general_settings', 'track_settings', 'mcp_settings', 'multi_agent_settings', 'tab_settings', 'search_settings', 'gene_detail_settings', 'external_tools', 'plugin_management', 'action_list', 'literature_settings'",
              enum: [
                'llm_config',
                'chatbox_settings',
                'general_settings',
                'track_settings',
                'mcp_settings',
                'multi_agent_settings',
                'tab_settings',
                'search_settings',
                'gene_detail_settings',
                'external_tools',
                'plugin_management',
                'action_list',
                'literature_settings',
              ],
            },
            action: {
              type: 'string',
              description:
                "Action to perform: 'open' to show the modal, 'close' to hide it, 'toggle' to switch its current state (default).",
              enum: ['open', 'close', 'toggle'],
              default: 'toggle',
            },
          },
          required: ['modal_name'],
        },
      },

      toggle_chatbox: {
        name: 'toggle_chatbox',
        description:
          'Show, hide, or toggle the main ChatBox panel. This controls the ChatBox itself, not its settings modal.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: "Use 'show', 'hide', or 'toggle' (default).",
              enum: ['show', 'hide', 'toggle'],
              default: 'toggle',
            },
          },
          required: [],
        },
      },

      toggle_sidebar: {
        name: 'toggle_sidebar',
        description: 'Expand, collapse, or toggle the main genome browser Sidebar.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: "Use 'expand', 'collapse', or 'toggle' (default).",
              enum: ['expand', 'collapse', 'toggle'],
              default: 'toggle',
            },
          },
          required: [],
        },
      },

      toggle_top_banner: {
        name: 'toggle_top_banner',
        description: 'Expand, collapse, or toggle the top banner area.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: "Use 'expand', 'collapse', or 'toggle' (default).",
              enum: ['expand', 'collapse', 'toggle'],
              default: 'toggle',
            },
          },
          required: [],
        },
      },
    };
  }

  getTools() {
    return this.tools;
  }

  async executeClientTool(toolName, parameters, clientId) {
    console.log(`🔧 [UtilityTools] Executing client tool: ${toolName}`, parameters);

    try {
      // Send request to client and wait for response
      const response = await this.server.executeToolOnClient(`utility_${toolName}`, parameters, clientId);

      console.log(`✅ [UtilityTools] Tool ${toolName} executed successfully`);
      return response;
    } catch (error) {
      console.error(`❌ [UtilityTools] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  // Tool execution methods
  async download_internet_file(params, clientId) {
    return await this.executeClientTool('download_internet_file', params, clientId);
  }

  async view_markdown_file(params, clientId) {
    return await this.executeClientTool('view_markdown_file', params, clientId);
  }

  async toggle_settings_modal(params, clientId) {
    return await this.executeClientTool('toggle_settings_modal', params, clientId);
  }

  async toggle_chatbox(params, clientId) {
    return await this.executeClientTool('toggle_chatbox', params, clientId);
  }

  async toggle_sidebar(params, clientId) {
    return await this.executeClientTool('toggle_sidebar', params, clientId);
  }

  async toggle_top_banner(params, clientId) {
    return await this.executeClientTool('toggle_top_banner', params, clientId);
  }
}

module.exports = UtilityTools;
