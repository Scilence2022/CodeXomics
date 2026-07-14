/**
 * AgentChatTools - MCP tool for agent-mode interaction
 * Allows external MCP clients to send prompts to CodeXomics's AI agent
 * for autonomous execution. Supports single-agent and multi-agent modes.
 *
 * In agent mode (CODEXOMICS_MCP_MODE=agent), this is the PRIMARY tool
 * exposed to MCP clients. All other tools are hidden and the agent
 * autonomously decides which internal tools to call.
 *
 * In tools mode (default), this is an optional tool that MCP clients
 * can use for complex multi-step tasks instead of calling individual tools.
 */

class AgentChatTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    const isAgentMode = this.server && this.server.mode === 'agent';

    const baseDescription =
      'Send a natural language prompt to the CodeXomics AI agent for autonomous execution. ' +
      'The agent will analyze the request, plan appropriate tool calls, and execute them. ' +
      'By default uses single-agent mode (fast). Set activate_multi_agent=true to enable multi-agent coordination for complex tasks.';

    const agentModeDescription =
      'PRIMARY INTERFACE: Send any bioinformatics request as a natural language prompt. ' +
      'The CodeXomics AI agent will autonomously analyze your request, select and execute ' +
      'the appropriate tools, and return comprehensive results. ' +
      'This is the main way to interact with CodeXomics in agent mode. ' +
      'You can request any bioinformatics operation: genome navigation, sequence analysis, ' +
      'protein structure prediction, database searches, BLAST, annotation management, and more. ' +
      'Progress notifications will be sent during execution. ' +
      'Set activate_multi_agent=true for complex tasks requiring coordination between multiple specialists.';

    return {
      codexomics_chat: {
        name: 'codexomics_chat',
        description: isAgentMode ? agentModeDescription : baseDescription,
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

  async executeClientTool(toolName, parameters, clientId, executionContext = null) {
    return await this.server.executeToolOnClient('codexomics_chat', parameters, clientId, executionContext);
  }
}

module.exports = AgentChatTools;
