// @ts-check
/**
 * ThinkingDisplayService - Thinking/agent display methods extracted from ChatManager
 */
class ThinkingDisplayService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  /**
   * 添加思考过程消息
   */
  addThinkingMessage(message) {
    // 检查是否启用思考过程显示
    if (!this.chatManager.showThinkingProcess) {
      // 即使不显示，也要为Evolution记录思考过程
      this.chatManager.addToEvolutionData({
        type: 'thinking_process',
        timestamp: new Date().toISOString(),
        content: message,
        visible: false,
        metadata: {
          source: 'ai_thinking',
          requestId: this.chatManager.conversationState.currentRequestId,
          step: 'initial_thinking',
        },
      });
      return;
    }

    // 只移除当前正在进行的思考过程（如果有的话）
    const currentRequestId = this.chatManager.conversationState.currentRequestId || Date.now();
    const existingThinking = document.getElementById(`thinkingProcess_${currentRequestId}`);
    if (existingThinking) {
      existingThinking.remove();
    }

    const messagesContainer = document.getElementById('chatMessages');
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message assistant-message thinking-process';
    const thinkingId = `thinkingProcess_${currentRequestId}`;
    thinkingDiv.id = thinkingId;
    thinkingDiv.innerHTML = `<div class="message-content"><div class="message-icon"><i class="fas fa-cog fa-spin"></i></div><div class="message-text thinking-text"><div class="thinking-header"><span>AI Thinking Process</span></div><div class="thinking-content">${message}</div></div></div>`;

    messagesContainer.appendChild(thinkingDiv);

    // Add to Evolution data structure
    this.chatManager.addToEvolutionData({
      type: 'thinking_process',
      timestamp: new Date().toISOString(),
      content: message,
      elementId: thinkingId,
      visible: true,
      metadata: {
        source: 'ai_thinking',
        requestId: this.chatManager.conversationState.currentRequestId,
        step: 'initial_thinking',
      },
    });

    // 根据设置决定是否自动滚动
    if (this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 添加多智能体系统激活消息
   */
  addMultiAgentActivationMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const activationDiv = document.createElement('div');
    activationDiv.className = 'message system-message multi-agent-activation';
    activationDiv.innerHTML = `
            <div class="message-content">
                <div class="multi-agent-banner">
                    <div class="multi-agent-icon">🤖</div>
                    <div class="multi-agent-content">
                        <div class="multi-agent-title">Multi-Agent System Activated</div>
                        <div class="multi-agent-subtitle">Intelligent agent coordination enabled</div>
                        <div class="multi-agent-features">
                            <span class="feature-tag">8 Specialized Agents</span>
                            <span class="feature-tag">Smart Coordination</span>
                            <span class="feature-tag">Performance Optimized</span>
                        </div>
                    </div>
                    <div class="multi-agent-status">
                        <span class="status-indicator active"></span>
                        <span class="status-text">Active</span>
                    </div>
                </div>
            </div>
        `;

    messagesContainer.appendChild(activationDiv);

    // Add to Evolution data
    this.chatManager.addToEvolutionData({
      type: 'multi_agent_activation',
      timestamp: new Date().toISOString(),
      content: 'Multi-Agent System Activated',
      visible: true,
      metadata: {
        source: 'multi_agent_system',
        requestId: this.chatManager.conversationState.currentRequestId,
        step: 'system_activation',
      },
    });

    if (this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 添加智能体决策消息
   */
  addAgentDecisionMessage(agentName, toolName, reasoning, parameters = {}) {
    const messagesContainer = document.getElementById('chatMessages');
    const decisionDiv = document.createElement('div');
    decisionDiv.className = 'message assistant-message agent-decision';
    decisionDiv.innerHTML = `
            <div class="message-content">
                <div class="agent-decision-content">
                    <div class="agent-header">
                        <div class="agent-icon">${this.getAgentIcon(agentName)}</div>
                        <div class="agent-info">
                            <div class="agent-name">${agentName}</div>
                            <div class="agent-action">Selected for: <strong>${toolName}</strong></div>
                        </div>
                        <div class="agent-status">
                            <span class="status-dot processing"></span>
                            <span class="status-text">Processing</span>
                        </div>
                    </div>
                    <div class="agent-reasoning">
                        <div class="reasoning-label">Decision Reasoning:</div>
                        <div class="reasoning-text">${reasoning}</div>
                    </div>
                    ${Object.keys(parameters).length > 0
        ? `
                        <div class="agent-parameters">
                            <div class="parameters-label">Parameters:</div>
                            <div class="parameters-content">
                                <pre><code>${JSON.stringify(parameters, null, 2)}</code></pre>
                            </div>
                        </div>
                    `
        : ''
      }
                </div>
            </div>
        `;

    messagesContainer.appendChild(decisionDiv);

    // Add to Evolution data
    this.chatManager.addToEvolutionData({
      type: 'agent_decision',
      timestamp: new Date().toISOString(),
      content: {
        agentName,
        toolName,
        reasoning,
        parameters,
      },
      visible: true,
      metadata: {
        source: 'multi_agent_system',
        requestId: this.chatManager.conversationState.currentRequestId,
        step: 'agent_selection',
        agentName,
        toolName,
      },
    });

    // Update status after a short delay to show completion
    setTimeout(() => {
      const statusDot = decisionDiv.querySelector('.status-dot');
      const statusText = decisionDiv.querySelector('.status-text');
      if (statusDot && statusText) {
        statusDot.className = 'status-dot completed';
        statusText.textContent = 'Completed';
      }
    }, 2000);

    if (this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 添加智能体执行结果消息
   */
  addAgentExecutionResult(agentName, toolName, result, executionTime) {
    const messagesContainer = document.getElementById('chatMessages');
    const resultDiv = document.createElement('div');
    resultDiv.className = 'message assistant-message agent-result';
    resultDiv.innerHTML = `
            <div class="message-content">
                <div class="agent-result-content">
                    <div class="agent-result-header">
                        <div class="agent-icon">${this.getAgentIcon(agentName)}</div>
                        <div class="agent-info">
                            <div class="agent-name">${agentName}</div>
                            <div class="agent-action">Executed: <strong>${toolName}</strong></div>
                            <div class="execution-time">⏱️ ${executionTime}ms</div>
                        </div>
                        <div class="agent-status">
                            <span class="status-dot completed"></span>
                            <span class="status-text">Success</span>
                        </div>
                    </div>
                    <div class="agent-result-data">
                        <div class="result-label">Execution Result:</div>
                        <div class="result-content">${this.formatAgentResult(result)}</div>
                    </div>
                </div>
            </div>
        `;

    messagesContainer.appendChild(resultDiv);

    // Add to Evolution data
    this.chatManager.addToEvolutionData({
      type: 'agent_execution_result',
      timestamp: new Date().toISOString(),
      content: {
        agentName,
        toolName,
        result,
        executionTime,
      },
      visible: true,
      metadata: {
        source: 'multi_agent_system',
        requestId: this.chatManager.conversationState.currentRequestId,
        step: 'execution_complete',
        agentName,
        toolName,
        executionTime,
      },
    });

    if (this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 获取智能体图标
   */
  getAgentIcon(agentName) {
    const agentIcons = {
      'Navigation Agent': '🧭',
      'Analysis Agent': '📊',
      'Data Agent': '💾',
      'Sequence Agent': '🧬',
      'Protein Agent': '⚛️',
      'Network Agent': '🌐',
      'External Agent': '🔗',
      'Plugin Agent': '🔌',
    };
    return agentIcons[agentName] || '🤖';
  }

  /**
   * 格式化智能体执行结果
   */
  formatAgentResult(result) {
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object') {
      return `<pre><code>${JSON.stringify(result, null, 2)}</code></pre>`;
    } else {
      return String(result);
    }
  }

  /**
   * 根据工具名称确定负责的智能体
   */
  getAgentForTool(toolName) {
    const toolAgentMap = {
      // Navigation Agent - 导航和定位相关
      navigate_to_position: 'Navigation Agent',
      open_new_tab: 'Navigation Agent',
      scroll_left: 'Navigation Agent',
      scroll_right: 'Navigation Agent',
      zoom_in: 'Navigation Agent',
      zoom_out: 'Navigation Agent',
      zoom_to_gene: 'Navigation Agent',
      bookmark_position: 'Navigation Agent',
      get_bookmarks: 'Navigation Agent',
      save_view_state: 'Navigation Agent',
      get_current_state: 'Navigation Agent',
      get_current_region: 'Navigation Agent',
      jump_to_gene: 'Navigation Agent',
      select_gene: 'Navigation Agent',
      select_sequence_region: 'Navigation Agent',

      // Analysis Agent - 数据分析和统计
      analyze_region: 'Analysis Agent',
      compare_regions: 'Analysis Agent',
      sequence_statistics: 'Analysis Agent',
      codon_usage_analysis: 'Analysis Agent',
      analyze_codon_usage: 'Analysis Agent',
      calculate_entropy: 'Analysis Agent',
      calculate_melting_temp: 'Analysis Agent',
      calculate_molecular_weight: 'Analysis Agent',
      predict_promoter: 'Analysis Agent',
      predict_rbs: 'Analysis Agent',
      predict_terminator: 'Analysis Agent',
      find_similar_sequences: 'Analysis Agent',

      // Data Agent - 数据管理和导出
      export_data: 'Data Agent',
      export_region_features: 'Data Agent',
      get_file_info: 'Data Agent',
      get_genome_info: 'Data Agent',
      get_chromosome_list: 'Data Agent',
      get_track_status: 'Data Agent',
      add_track: 'Data Agent',
      add_variant: 'Data Agent',

      // Sequence Agent - 序列分析
      get_sequence: 'Sequence Agent',
      translate_sequence: 'Sequence Agent',
      translate_dna: 'Sequence Agent',
      calculate_gc_content: 'Sequence Agent',
      compute_gc: 'Sequence Agent',
      calc_region_gc: 'Sequence Agent',
      reverse_complement: 'Sequence Agent',
      find_restriction_sites: 'Sequence Agent',
      virtual_digest: 'Sequence Agent',
      get_upstream_region: 'Sequence Agent',
      get_downstream_region: 'Sequence Agent',
      search_sequence_motif: 'Sequence Agent',

      // Protein Agent - 蛋白质相关
      open_protein_viewer: 'Protein Agent',
      fetch_protein_structure: 'Protein Agent',
      search_pdb_structures: 'Protein Agent',
      get_pdb_details: 'Protein Agent',
      amino_acid_composition: 'Protein Agent',

      // Network Agent - 网络和外部数据
      blast_search: 'Network Agent',
      blast_sequence_from_region: 'Network Agent',
      get_blast_databases: 'Network Agent',
      batch_blast_search: 'Network Agent',
      advanced_blast_search: 'Network Agent',
      local_blast_database_info: 'Network Agent',
      show_metabolic_pathway: 'Network Agent',
      find_pathway_genes: 'Network Agent',

      // External Agent - 外部工具和API
      search_features: 'External Agent',
      find_gene_by_name: 'External Agent',
      search_by_position: 'External Agent',
      search_motif: 'External Agent',
      search_pattern: 'External Agent',
      search_intergenic_regions: 'External Agent',
      get_nearby_features: 'External Agent',
      find_intergenic_regions: 'External Agent',

      // Plugin Agent - 插件功能
      get_gene_details: 'Plugin Agent',
      get_operons: 'Plugin Agent',
      create_annotation: 'Plugin Agent',
      add_annotation: 'Plugin Agent',
      edit_annotation: 'Plugin Agent',
      delete_annotation: 'Plugin Agent',
      batch_create_annotations: 'Plugin Agent',
      merge_annotations: 'Plugin Agent',
      toggle_track: 'Plugin Agent',
      toggle_annotation_track: 'Plugin Agent',
    };

    return toolAgentMap[toolName] || 'System Agent';
  }

  /**
   * 生成智能体决策推理
   */
  getAgentReasoning(toolName, parameters) {
    const agentName = this.getAgentForTool(toolName);

    const reasoningTemplates = {
      'Navigation Agent': `This tool requires navigation and positioning capabilities. ${agentName} specializes in spatial operations and view management, making it the optimal choice for coordinate-based tasks.`,
      'Analysis Agent': `This tool involves data analysis and statistical computation. ${agentName} is designed for analytical operations and pattern recognition, ensuring accurate and efficient processing.`,
      'Data Agent': `This tool handles data management and export operations. ${agentName} is optimized for file operations and data transformation, providing reliable data handling capabilities.`,
      'Sequence Agent': `This tool performs sequence analysis and manipulation. ${agentName} is specialized in DNA/RNA sequence processing and bioinformatics algorithms.`,
      'Protein Agent': `This tool deals with protein structure and function analysis. ${agentName} is designed for structural biology and protein-related computations.`,
      'Network Agent': `This tool requires external database access and network operations. ${agentName} is optimized for API calls and external data retrieval.`,
      'External Agent': `This tool involves search and discovery operations. ${agentName} is specialized in information retrieval and pattern matching across datasets.`,
      'Plugin Agent': `This tool utilizes plugin functionality and annotation systems. ${agentName} is designed to manage plugin integrations and annotation workflows.`,
      'System Agent': `This tool requires general system operations. ${agentName} provides standard execution capabilities for system-level tasks.`,
    };

    return reasoningTemplates[agentName] || reasoningTemplates['System Agent'];
  }

  /**
   * 更新思考过程消息
   */
  updateThinkingMessage(message) {
    // Add to Evolution data first (regardless of visibility)
    this.chatManager.addToEvolutionData({
      type: 'thinking_process',
      timestamp: new Date().toISOString(),
      content: message,
      visible: this.chatManager.showThinkingProcess,
      metadata: {
        source: 'ai_thinking',
        requestId: this.chatManager.conversationState.currentRequestId,
        step: 'update_thinking',
      },
    });

    // 检查是否启用思考过程显示
    if (!this.chatManager.showThinkingProcess) {
      return;
    }

    // 查找当前请求的思考过程消息
    const thinkingId = `thinkingProcess_${this.chatManager.conversationState.currentRequestId || Date.now()}`;
    let thinkingDiv = document.getElementById(thinkingId);

    // 如果没有找到，查找任何思考过程消息
    if (!thinkingDiv) {
      thinkingDiv = document.querySelector('.thinking-process');
    }

    if (thinkingDiv) {
      const thinkingContent = thinkingDiv.querySelector('.thinking-content');
      if (thinkingContent) {
        // Use innerHTML to properly render HTML tags and entities
        thinkingContent.innerHTML += '\n' + message;
      }
    } else {
      this.addThinkingMessage(message);
    }

    // 根据设置决定是否自动滚动
    const messagesContainer = document.getElementById('chatMessages');
    if (this.chatManager.autoScrollToBottom) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  /**
   * 显示LLM的思考过程
   */
  displayLLMThinking(response) {
    // 检查响应中是否包含思考标签
    const thinkingMatch = response.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkingMatch) {
      const thinkingContent = thinkingMatch[1].trim();
      // 格式化思考内容，使其更易读
      const formattedThinking = this.formatThinkingContent(thinkingContent);
      this.updateThinkingMessage(`💭 <strong>Model reasoning:</strong>`);
      this.updateThinkingMessage(`&nbsp;&nbsp;${formattedThinking.replace(/\n/g, '\n&nbsp;&nbsp;')}`);
    }

    // 检查是否有工具调用，并显示参数提取过程
    if (response.includes('tool_name') || response.includes('function_name')) {
      this.updateThinkingMessage(`🔧 Analyzing tool call structure...`);

      // Extract and display parameter information
      try {
        const toolCall = this.chatManager.parseToolCall(response);
        if (toolCall) {
          const paramCount = Object.keys(toolCall.parameters || {}).length;
          this.updateThinkingMessage(`&nbsp;&nbsp;✅ Tool identified: <strong>${toolCall.tool_name}</strong>`);
          this.updateThinkingMessage(`&nbsp;&nbsp;📊 Parameters extracted: ${paramCount} parameter(s)`);

          // Display parameter details
          if (paramCount > 0) {
            const paramKeys = Object.keys(toolCall.parameters);
            this.updateThinkingMessage(`&nbsp;&nbsp;🔑 Keys: ${paramKeys.join(', ')}`);
          }
        }
      } catch (e) {
        console.warn('Error analyzing tool call:', e);
      }
    } else if (response && response.length > 0) {
      // No tool call - this is a conversational response
      this.updateThinkingMessage(`💬 Conversational response generated`);
      if (response.length > 100) {
        this.updateThinkingMessage(`&nbsp;&nbsp;📝 Response preview: "${response.substring(0, 100)}..."`);
      }
    }
  }

  /**
   * 格式化思考内容，使其更易读
   */
  formatThinkingContent(thinkingContent) {
    // 清理和格式化思考内容
    let formatted = thinkingContent
      .replace(/\n\s*\n/g, '\n') // 移除多余的空行
      .trim();

    // 如果内容很长，进行适当的换行处理
    if (formatted.length > 200) {
      // 在句号、问号、感叹号后添加换行（如果后面不是换行符）
      formatted = formatted.replace(/([.!?])\s+(?=[A-Z])/g, '$1\n\n');
    }

    // 确保内容以适当的格式结束
    if (!formatted.endsWith('.') && !formatted.endsWith('!') && !formatted.endsWith('?')) {
      formatted += '...';
    }

    return formatted;
  }

  /**
   * 添加工具调用消息
   */
  async addToolCallMessage(toolsToExecute) {
    // Add to Evolution data first (always record tool calls)
    this.chatManager.addToEvolutionData({
      type: 'tool_calls',
      timestamp: new Date().toISOString(),
      content: toolsToExecute,
      visible: this.chatManager.showToolCalls,
      metadata: {
        source: 'tool_execution',
        requestId: this.chatManager.conversationState.currentRequestId,
        toolCount: toolsToExecute.length,
        toolNames: toolsToExecute.map(t => t.tool_name),
      },
    });

    // 检查是否启用工具调用显示
    if (!this.chatManager.showToolCalls) {
      return;
    }

    // 为每个工具获取来源信息
    const toolsWithSource = await Promise.all(
      toolsToExecute.map(async tool => {
        const source = await this.getToolSource(tool.tool_name);
        return { ...tool, source };
      })
    );

    const toolList = toolsWithSource
      .map(tool => {
        let toolDisplay = `• <strong>${tool.tool_name}</strong>`;

        // 显示智能体信息（如果启用）
        if (this.chatManager.agentSystemEnabled && this.chatManager.agentSystemSettings.showAgentInfo && this.chatManager.multiAgentSystem) {
          try {
            if (typeof this.chatManager.multiAgentSystem.getAgentForTool === 'function') {
              const agentInfo = this.chatManager.multiAgentSystem.getAgentForTool(tool.tool_name);
              if (agentInfo) {
                toolDisplay += ` <span class="agent-info" style="color: #4CAF50; font-size: 0.9em;"><i class="fas fa-robot"></i>[${agentInfo.name}]</span>`;
              }
            } else {
              console.warn('multiAgentSystem.getAgentForTool is not a function');
            }
          } catch (error) {
            console.error('Error getting agent info for tool:', tool.tool_name, error);
          }
        }

        // 显示来源信息（如果启用）
        if (this.chatManager.showToolCallSource && tool.source) {
          const sourceColor = this.getSourceColor(tool.source.type);
          toolDisplay += ` <span style="color: ${sourceColor}; font-size: 0.9em;">[${tool.source.display}]</span>`;
        }

        // 显示参数
        const paramsStr = JSON.stringify(tool.parameters, null, 2);
        toolDisplay += `<br>&nbsp;&nbsp;<em>Parameters:</em> <code style="font-size: 0.8em;">${paramsStr}</code>`;

        return toolDisplay;
      })
      .join('<br><br>');

    this.updateThinkingMessage(`⚡ Executing tool calls:<br><br>${toolList}`);
  }

  /**
   * 获取工具来源信息
   */
  async getToolSource(toolName) {
    try {
      // 检查是否是MCP服务器工具
      const allMCPTools = this.chatManager.mcpServerManager.getAllAvailableTools();
      const mcpTool = allMCPTools.find(t => t.name === toolName);

      if (mcpTool) {
        return {
          type: 'mcp',
          display: `MCP: ${mcpTool.serverName}`,
          serverId: mcpTool.serverId,
          serverName: mcpTool.serverName,
        };
      }

      // 检查是否是插件函数
      if (this.chatManager.pluginFunctionCallsIntegrator && this.chatManager.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
        return {
          type: 'plugin',
          display: 'Plugin Function',
          source: 'plugin-system',
        };
      }

      // 检查是否是内置本地函数 - 使用 FunctionCallsOrganizer 获取完整列表
      if (this.chatManager.smartExecutor && this.chatManager.smartExecutor.organizer) {
        const category = this.chatManager.smartExecutor.organizer.getFunctionCategory(toolName);
        if (category) {
          // Tool found in FunctionCallsOrganizer - it's a local/internal tool
          return {
            type: 'local',
            display: 'Internal Function',
            source: 'genome-ai-studio',
            category: category.name,
            priority: category.priority,
          };
        }
      }

      // Fallback: Check builtin_tools_integration for database and other built-in tools
      if (this.chatManager.builtInTools && this.chatManager.builtInTools.builtInToolsMap) {
        const builtInTool = this.chatManager.builtInTools.builtInToolsMap.get(toolName);
        if (builtInTool) {
          return {
            type: 'local',
            display: 'Built-in Tool',
            source: 'genome-ai-studio',
            category: builtInTool.category,
            priority: builtInTool.priority,
          };
        }
      }

      // 未知工具
      return {
        type: 'unknown',
        display: 'Unknown Source',
        source: 'unknown',
      };
    } catch (error) {
      console.warn(`Failed to get source for tool ${toolName}:`, error);
      return {
        type: 'error',
        display: 'Source Error',
        source: 'error',
      };
    }
  }

  /**
   * 获取不同来源类型的颜色
   */
  getSourceColor(sourceType) {
    const colors = {
      mcp: '#2196F3', // 蓝色 - MCP服务器
      plugin: '#FF9800', // 橙色 - 插件
      local: '#4CAF50', // 绿色 - 内置函数
      unknown: '#9E9E9E', // 灰色 - 未知
      error: '#F44336', // 红色 - 错误
    };

    return colors[sourceType] || colors['unknown'];
  }

  /**
   * 移除思考过程消息（保留原有方法用于特殊情况）
   */
  removeThinkingMessages() {
    // 移除所有思考过程消息
    const thinkingDivs = document.querySelectorAll('.thinking-process');
    thinkingDivs.forEach(thinkingDiv => {
      // 添加淡出动画
      thinkingDiv.style.transition = 'opacity 0.5s ease-out';
      thinkingDiv.style.opacity = '0';

      setTimeout(() => {
        if (thinkingDiv.parentNode) {
          thinkingDiv.parentNode.removeChild(thinkingDiv);
        }
      }, 500);
    });
  }
}

window.ThinkingDisplayService = ThinkingDisplayService;
