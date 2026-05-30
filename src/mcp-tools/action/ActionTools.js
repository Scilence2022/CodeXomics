/**
 * ActionTools Module
 * Provides sequence editing and action management tools for MCP Server
 */

class ActionTools {
  constructor(server) {
    this.server = server;
    this.tools = this.defineTools();
  }

  defineTools() {
    return {
      copy_sequence: {
        name: 'copy_sequence',
        description: 'Copy a sequence region to clipboard for later use',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            start: {
              type: 'number',
              description: 'Start position (1-based genomic coordinate)',
            },
            end: {
              type: 'number',
              description: 'End position (1-based genomic coordinate)',
            },
            strand: {
              type: 'string',
              enum: ['+', '-'],
              description: 'Strand direction (+ for forward, - for reverse)',
              default: '+',
            },
          },
          required: ['chromosome', 'start', 'end'],
        },
      },

      cut_sequence: {
        name: 'cut_sequence',
        description: 'Cut a sequence region (copy to clipboard and mark for deletion)',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            start: {
              type: 'number',
              description: 'Start position (1-based genomic coordinate)',
            },
            end: {
              type: 'number',
              description: 'End position (1-based genomic coordinate)',
            },
            strand: {
              type: 'string',
              enum: ['+', '-'],
              description: 'Strand direction (+ for forward, - for reverse)',
              default: '+',
            },
          },
          required: ['chromosome', 'start', 'end'],
        },
      },

      paste_sequence: {
        name: 'paste_sequence',
        description: 'Paste sequence from clipboard at specified position',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            position: {
              type: 'number',
              description: 'Insert position (1-based genomic coordinate)',
            },
            start: {
              type: 'number',
              description: 'Alias for position. Use position instead.',
            },
          },
          required: ['chromosome', 'position'],
        },
      },

      delete_sequence: {
        name: 'delete_sequence',
        description: 'Delete a sequence region',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            start: {
              type: 'number',
              description: 'Start position (1-based genomic coordinate)',
            },
            end: {
              type: 'number',
              description: 'End position (1-based genomic coordinate)',
            },
            strand: {
              type: 'string',
              enum: ['+', '-'],
              description: 'Strand direction (+ for forward, - for reverse)',
              default: '+',
            },
          },
          required: ['chromosome', 'start', 'end'],
        },
      },

      insert_sequence: {
        name: 'insert_sequence',
        description: 'Insert a DNA sequence at specified position without user confirmation',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            position: {
              type: 'number',
              description: 'Insert position (1-based genomic coordinate)',
            },
            start: {
              type: 'number',
              description: 'Alias for position (1-based genomic coordinate). Use position instead.',
            },
            sequence: {
              type: 'string',
              description: 'DNA sequence to insert (A, T, C, G, N allowed)',
            },
            newSequence: {
              type: 'string',
              description: 'Alias for sequence parameter. Use sequence instead.',
            },
          },
          required: ['chromosome', 'position', 'sequence'],
        },
      },

      replace_sequence: {
        name: 'replace_sequence',
        description: 'Replace sequence in specified region with new sequence',
        parameters: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Chromosome identifier (e.g., "chr1", "chromosome1")',
            },
            start: {
              type: 'number',
              description: 'Start position (1-based genomic coordinate)',
            },
            end: {
              type: 'number',
              description: 'End position (1-based genomic coordinate)',
            },
            sequence: {
              type: 'string',
              description: 'Replacement DNA sequence (A, T, C, G, N allowed). Preferred parameter name.',
            },
            newSequence: {
              type: 'string',
              description: 'Alias for sequence.',
            },
            strand: {
              type: 'string',
              enum: ['+', '-'],
              description:
                'Target strand. If "-", provide the replacement sequence in reverse-strand/read orientation; execute_actions writes its reverse complement to the genomic forward sequence.',
              default: '+',
            },
          },
          required: ['chromosome', 'start', 'end', 'sequence'],
        },
      },

      get_action_list: {
        name: 'get_action_list',
        description:
          'Get the current sequence-editing Action queue. Actions are queued genome edit operations, not checklist Tasks.',
        parameters: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
              default: 'default',
            },
            status: {
              type: 'string',
              enum: ['all', 'pending', 'executing', 'completed', 'failed'],
              description: 'Filter actions by status',
              default: 'all',
            },
          },
          required: [],
        },
      },

      show_action_list: {
        name: 'show_action_list',
        description: 'Open the Action List Manager interface for queued sequence-editing Actions.',
        parameters: {
          type: 'object',
          properties: {
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
              default: 'default',
            },
          },
          required: [],
        },
      },

      execute_actions: {
        name: 'execute_actions',
        description:
          'Execute all pending sequence actions and generate a modified GenBank file. When auto_save is true, saves the file directly without showing a save dialog (essential for LLM/automated workflows).',
        parameters: {
          type: 'object',
          properties: {
            auto_save: {
              type: 'boolean',
              description:
                'When true, automatically save the generated GenBank file without showing a save dialog prompt. Essential for LLM/automated workflows where interactive dialogs would block execution. Default is false, but LLMs should always set this to true.',
              default: false,
            },
            filename: {
              type: 'string',
              description:
                'Output file path for the generated GenBank file. Supports absolute paths (e.g., "/Users/user/output/modified_genome.gbk") or relative paths (resolved against CWD). Only effective when auto_save is true.',
            },
            confirm: {
              type: 'boolean',
              description:
                'Confirm execution without additional user prompt (auto-resolves conflicts). Implied when auto_save is true.',
              default: false,
            },
          },
        },
      },

      clear_actions: {
        name: 'clear_actions',
        description:
          'Clear sequence-editing Actions from the queue. Actions are queued genome edit operations, not checklist Tasks.',
        parameters: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'executing', 'completed', 'failed', 'all'],
              description: 'Clear actions by status',
              default: 'all',
            },
            forced: {
              type: 'boolean',
              description: 'Whether to force clear, skip confirmation prompt',
              default: false,
            },
          },
        },
      },

      get_clipboard_content: {
        name: 'get_clipboard_content',
        description: 'Get current clipboard content information',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    };
  }

  getTools() {
    return this.tools;
  }

  async executeClientTool(toolName, parameters, clientId) {
    console.log(`🔧 [ActionTools] Executing client tool: ${toolName}`, parameters);

    try {
      // Send request to client and wait for response
      const response = await this.server.executeToolOnClient(`action_${toolName}`, parameters, clientId);

      console.log(`✅ [ActionTools] Tool ${toolName} executed successfully`);
      return response;
    } catch (error) {
      console.error(`❌ [ActionTools] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  // Direct execution methods for server-side processing
  async copy_sequence(params, clientId) {
    return await this.executeClientTool('copy_sequence', params, clientId);
  }

  async cut_sequence(params, clientId) {
    return await this.executeClientTool('cut_sequence', params, clientId);
  }

  async paste_sequence(params, clientId) {
    return await this.executeClientTool('paste_sequence', params, clientId);
  }

  async delete_sequence(params, clientId) {
    return await this.executeClientTool('delete_sequence', params, clientId);
  }

  async insert_sequence(params, clientId) {
    return await this.executeClientTool('insert_sequence', params, clientId);
  }

  async replace_sequence(params, clientId) {
    return await this.executeClientTool('replace_sequence', params, clientId);
  }

  async get_action_list(params, clientId) {
    return await this.executeClientTool('get_action_list', params, clientId);
  }

  async show_action_list(params, clientId) {
    return await this.executeClientTool('show_action_list', params, clientId);
  }

  async execute_actions(params, clientId) {
    return await this.executeClientTool('execute_actions', params, clientId);
  }

  async clear_actions(params, clientId) {
    return await this.executeClientTool('clear_actions', params, clientId);
  }

  async get_clipboard_content(params, clientId) {
    return await this.executeClientTool('get_clipboard_content', params, clientId);
  }
}

module.exports = ActionTools;
