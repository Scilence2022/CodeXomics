/**
 * AgentChatTools - MCP tool for agent-mode interaction
 * Allows external MCP clients to send prompts to CodeXomics's AI agent
 * for autonomous execution. Supports single-agent and multi-agent modes.
 */

class AgentChatTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      codexomics_chat: {
        name: 'codexomics_chat',
        description:
          'Send a natural language prompt to the CodeXomics AI agent for autonomous execution. ' +
          'The agent will analyze the request, plan appropriate tool calls, and execute them. ' +
          'Use this for complex multi-step bioinformatics tasks instead of calling individual tools manually. ' +
          'By default uses single-agent mode (fast). Set activate_multi_agent=true to enable multi-agent coordination for complex tasks.',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description:
                'Natural language instruction for the CodeXomics agent (e.g., "Find all genes near position chr1:5000-10000 and BLAST their protein sequences")',
            },
            activate_multi_agent: {
              type: 'boolean',
              description:
                'Enable multi-agent coordination mode. Use for complex tasks requiring navigation + analysis + external search. Default: false (single-agent mode).',
              default: false,
            },
            context: {
              type: 'object',
              description: 'Optional execution context',
              properties: {
                genome_name: {
                  type: 'string',
                  description: 'Name of the currently loaded genome',
                },
                current_region: {
                  type: 'string',
                  description: 'Current viewing region (e.g., "chr1:1000-5000")',
                },
                window_id: {
                  type: 'string',
                  description: 'Target window ID for multi-window mode',
                },
              },
            },
          },
          required: ['prompt'],
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient('codexomics_chat', parameters, clientId);
  }
}

module.exports = AgentChatTools;
