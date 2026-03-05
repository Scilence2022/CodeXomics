/**
 * ToolExecutionManager - Handles tool calling, execution, and result formatting
 */

class ToolExecutionManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.configManager = chatManager.configManager;
    this.app = chatManager.app;
  }

  async sendToLLM(message, options = {}) {
    const { 
      model = null, 
      temperature = 0.7, 
      maxTokens = 4000,
      systemPrompt = null 
    } = options;

    try {
      // Build conversation history
      const conversationHistory = await this.buildConversationHistory(message);
      
      // Build system message
      const systemMessage = systemPrompt || await this.buildSystemMessage();

      // Get available tools
      const tools = await this.getAvailableTools();

      // Prepare request
      const request = {
        model: model || this.chatManager.llmConfigManager?.getCurrentModel(),
        messages: [
          { role: 'system', content: systemMessage },
          ...conversationHistory
        ],
        temperature,
        max_tokens: maxTokens,
        tools: tools.length > 0 ? tools : undefined,
      };

      // Send request to LLM
      const response = await this.sendLLMRequest(request);

      // Handle tool calls if present
      if (response.tool_calls && response.tool_calls.length > 0) {
        return await this.handleToolCalls(response, message);
      }

      // Return regular response
      return response.content;

    } catch (error) {
      console.error('Error in sendToLLM:', error);
      throw error;
    }
  }

  async buildConversationHistory(newMessage) {
    const history = [];

    if (this.chatManager.contextModeEnabled) {
      // Current message only mode
      history.push({ role: 'user', content: newMessage });
    } else {
      // Full conversation mode
      const chatHistory = this.chatManager.chatHistory.slice(-10); // Last 10 messages
      
      for (const msg of chatHistory) {
        if (msg.role === 'user' || msg.sender === 'user') {
          history.push({ role: 'user', content: msg.content || msg.message });
        } else if (msg.role === 'assistant' || msg.sender === 'assistant') {
          history.push({ role: 'assistant', content: msg.content || msg.message });
        }
      }

      // Add new message
      history.push({ role: 'user', content: newMessage });
    }

    return history;
  }

  async buildSystemMessage() {
    const context = this.chatManager.getCurrentContext();
    
    let systemPrompt = `You are CodeXomics AI, an intelligent assistant for genomics data analysis. 
You have access to various tools for analyzing genome data, searching genes, and performing molecular biology calculations.

Current Context:
- Chromosome: ${context.currentChromosome || 'None selected'}
- Position: ${context.currentPosition || 'None'}
- Has Sequence Data: ${context.hasSequence ? 'Yes' : 'No'}
- Has Annotations: ${context.hasAnnotations ? 'Yes' : 'No'}
- Loaded Files: ${context.loadedFiles.length}

When appropriate, use the available tools to help answer user questions. Always explain your reasoning and provide clear, actionable results.`;

    return systemPrompt;
  }

  async getAvailableTools() {
    const tools = [];

    // Add genomics tools
    tools.push(...this.getGenomicsTools());

    // Add navigation tools
    tools.push(...this.getNavigationTools());

    // Add analysis tools
    tools.push(...this.getAnalysisTools());

    return tools;
  }

  getGenomicsTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_sequence',
          description: 'Get DNA sequence for a specific region',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string', description: 'Chromosome name' },
              start: { type: 'integer', description: 'Start position' },
              end: { type: 'integer', description: 'End position' }
            },
            required: ['chromosome', 'start', 'end']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_gene',
          description: 'Search for genes by name',
          parameters: {
            type: 'object',
            properties: {
              gene_name: { type: 'string', description: 'Gene name to search for' }
            },
            required: ['gene_name']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'calculate_gc_content',
          description: 'Calculate GC content for a region',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              start: { type: 'integer' },
              end: { type: 'integer' }
            },
            required: ['chromosome', 'start', 'end']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'find_orfs',
          description: 'Find open reading frames',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              start: { type: 'integer' },
              end: { type: 'integer' },
              min_length: { type: 'integer', default: 300 }
            },
            required: ['chromosome', 'start', 'end']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_motif',
          description: 'Search for sequence motifs',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              pattern: { type: 'string', description: 'Sequence pattern to search for' }
            },
            required: ['chromosome', 'pattern']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'find_restriction_sites',
          description: 'Find restriction enzyme sites',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              enzyme: { type: 'string', description: 'Enzyme name (e.g., EcoRI, BamHI)' }
            },
            required: ['chromosome', 'enzyme']
          }
        }
      }
    ];
  }

  getNavigationTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'navigate_to_position',
          description: 'Navigate to a specific genomic position',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              position: { type: 'integer' }
            },
            required: ['chromosome', 'position']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'zoom_in',
          description: 'Zoom in on current view'
        }
      },
      {
        type: 'function',
        function: {
          name: 'zoom_out',
          description: 'Zoom out on current view'
        }
      }
    ];
  }

  getAnalysisTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'analyze_region',
          description: 'Analyze a genomic region for features',
          parameters: {
            type: 'object',
            properties: {
              chromosome: { type: 'string' },
              start: { type: 'integer' },
              end: { type: 'integer' }
            },
            required: ['chromosome', 'start', 'end']
          }
        }
      }
    ];
  }

  async sendLLMRequest(request) {
    // This would integrate with the actual LLM API
    // For now, return a mock response
    console.log('LLM Request:', request);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      content: 'I understand your request. Let me analyze the genome data for you.',
      tool_calls: null
    };
  }

  async handleToolCalls(response, originalMessage) {
    const toolCalls = response.tool_calls;
    const results = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeToolByName(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      );
      results.push({ tool: toolCall.function.name, result });
    }

    // Format results and return
    return this.formatToolResults(results);
  }

  async executeToolByName(toolName, parameters) {
    console.log(`Executing tool: ${toolName}`, parameters);

    // Delegate to appropriate manager based on tool type
    switch (toolName) {
      case 'navigate_to_position':
        return this.chatManager.genomicsManager.navigateToPosition(parameters);
      
      case 'search_gene':
        return this.chatManager.genomicsManager.searchGeneByName(parameters);
      
      case 'get_sequence':
        return this.chatManager.genomicsManager.getSequence(parameters);
      
      case 'analyze_region':
        return this.chatManager.genomicsManager.analyzeRegion(parameters);
      
      case 'calculate_gc_content':
        return this.chatManager.genomicsManager.calculateGCContent(parameters);
      
      case 'find_orfs':
        return this.chatManager.genomicsManager.findOpenReadingFrames(parameters);
      
      case 'search_motif':
        return this.chatManager.genomicsManager.searchMotif(parameters);
      
      case 'find_restriction_sites':
        return this.chatManager.genomicsManager.findRestrictionSites(parameters);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  parseToolCall(response) {
    if (!response) return null;

    // Check for tool call format
    const toolCallMatch = response.match(/```tool\n([\s\S]*?)\n```/);
    if (toolCallMatch) {
      try {
        return JSON.parse(toolCallMatch[1]);
      } catch (e) {
        console.error('Failed to parse tool call:', e);
      }
    }

    // Check for inline JSON tool call
    const jsonMatch = response.match(/\{\s*"tool"\s*:\s*"([^"]+)"\s*,\s*"parameters"\s*:/);
    if (jsonMatch) {
      try {
        // Extract the full JSON object
        const start = response.indexOf('{', jsonMatch.index);
        let braceCount = 0;
        let end = start;
        for (let i = start; i < response.length; i++) {
          if (response[i] === '{') braceCount++;
          if (response[i] === '}') braceCount--;
          if (braceCount === 0) {
            end = i + 1;
            break;
          }
        }
        return JSON.parse(response.substring(start, end));
      } catch (e) {
        console.error('Failed to parse inline tool call:', e);
      }
    }

    return null;
  }

  parseMultipleToolCalls(response) {
    const toolCalls = [];
    
    // Find all tool call blocks
    const regex = /```tool\n([\s\S]*?)\n```/g;
    let match;
    
    while ((match = regex.exec(response)) !== null) {
      try {
        toolCalls.push(JSON.parse(match[1]));
      } catch (e) {
        console.error('Failed to parse tool call:', e);
      }
    }

    return toolCalls;
  }

  formatToolResult(toolName, parameters, result) {
    let formatted = `**Tool: ${toolName}**\n\n`;
    
    if (typeof result === 'object') {
      formatted += '```json\n' + JSON.stringify(result, null, 2) + '\n```';
    } else {
      formatted += String(result);
    }

    return formatted;
  }

  formatToolResults(results) {
    if (results.length === 0) {
      return 'No tool results to display.';
    }

    if (results.length === 1) {
      const { tool, result } = results[0];
      return this.formatToolResult(tool, {}, result);
    }

    let formatted = '**Multiple Tool Results:**\n\n';
    results.forEach(({ tool, result }, index) => {
      formatted += `${index + 1}. **${tool}**\n`;
      if (typeof result === 'object') {
        formatted += '```json\n' + JSON.stringify(result, null, 2) + '\n```\n\n';
      } else {
        formatted += `${result}\n\n`;
      }
    });

    return formatted;
  }

  showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    if (!messagesContainer) return;

    const indicator = document.createElement('div');
    indicator.id = 'typingIndicator';
    indicator.className = 'message assistant-message typing-indicator';
    indicator.innerHTML = `
      <div class="message-content">
        <i class="fas fa-robot message-icon"></i>
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;

    messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) {
      indicator.remove();
    }
  }

  clearThinkingHistory() {
    const thinkingDivs = document.querySelectorAll('.thinking-message');
    thinkingDivs.forEach(div => div.remove());
  }

  toggleThinkingHistory() {
    const thinkingDivs = document.querySelectorAll('.thinking-message');
    const isVisible = thinkingDivs.length > 0 && thinkingDivs[0].style.display !== 'none';
    
    thinkingDivs.forEach(div => {
      div.style.display = isVisible ? 'none' : 'block';
    });
  }

  showSuggestions() {
    const suggestions = [
      'Navigate to position 100000 on chromosome 1',
      'Search for DNA polymerase genes',
      'Calculate GC content of current view',
      'Find EcoRI restriction sites',
      'Show gene annotations near position 50000'
    ];

    const message = '**Try asking:**\n' + suggestions.map(s => `• ${s}`).join('\n');
    this.chatManager.addMessageToChat(message, 'assistant');
  }

  scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolExecutionManager;
}
