// @ts-check
/**
 * LLMInteractionService - LLM interaction and message processing extracted from ChatManager
 */
class LLMInteractionService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message) return;

    // Exit history browsing mode when sending message
    if (this.chatManager.messageHistory.isBrowsing) {
      this.chatManager.exitHistoryBrowsing();
    }

    // 检查是否正在处理中
    if (this.chatManager.conversationState.isProcessing) {
      this.chatManager.showNotification('Conversation in progress, please wait or click abort button', 'warning');
      return;
    }

    // 初始化对话状态
    this.chatManager.startConversation();

    // Add user message to chat
    this.chatManager.services.messaging.addMessageToChat(message, 'user');
    chatInput.value = '';
    chatInput.style.height = 'auto';

    // Show typing indicator and thinking process
    this.chatManager.showThinkingProcess && this.chatManager.addThinkingMessage('Analyzing your question...');
    this.chatManager.services.messaging.showTypingIndicator();

    try {
      // Send to LLM via MCP or direct API
      const response = await this.sendToLLM(message);
      this.chatManager.services.messaging.removeTypingIndicator();
      this.chatManager.services.messaging.addMessageToChat(response, 'assistant');
    } catch (error) {
      this.chatManager.services.messaging.removeTypingIndicator();
      if (error.name === 'AbortError') {
        this.chatManager.services.messaging.addMessageToChat('Conversation aborted by user.', 'assistant', false, 'warning');
      } else {
        this.chatManager.services.messaging.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
        console.error('Chat error:', error);
      }
    } finally {
      // 结束对话状态
      this.chatManager.endConversation();
    }
  }

  /**
   * Programmatically send a message to the chat (for API calls from other modules)
   */
  async sendMessageProgrammatically(message) {
    if (!message || !message.trim()) {
      console.warn('No message provided to sendMessageProgrammatically');
      return;
    }

    const trimmedMessage = message.trim();

    // 检查是否正在处理中
    if (this.chatManager.conversationState.isProcessing) {
      this.chatManager.showNotification('Conversation in progress, please wait or click abort button', 'warning');
      return;
    }

    // 初始化对话状态
    this.chatManager.startConversation();

    // Add user message to chat
    this.chatManager.services.messaging.addMessageToChat(trimmedMessage, 'user');

    // Show typing indicator and thinking process
    this.chatManager.showThinkingProcess && this.chatManager.addThinkingMessage('Analyzing your question...');
    this.chatManager.services.messaging.showTypingIndicator();

    try {
      // Send to LLM via MCP or direct API
      const response = await this.sendToLLM(trimmedMessage);
      this.chatManager.services.messaging.removeTypingIndicator();
      this.chatManager.services.messaging.addMessageToChat(response, 'assistant');
    } catch (error) {
      this.chatManager.services.messaging.removeTypingIndicator();
      if (error.name === 'AbortError') {
        this.chatManager.services.messaging.addMessageToChat('Conversation aborted by user.', 'assistant', false, 'warning');
      } else {
        this.chatManager.services.messaging.addMessageToChat('Sorry, I encountered an error. Please try again.', 'assistant', true);
        console.error('Error in sendMessageProgrammatically:', error);
      }
    } finally {
      this.chatManager.endConversation();
    }
  }

  async sendToLLM(message, options = {}) {
    // Set current message for Dynamic Tools Registry
    this.chatManager.currentMessage = message;

    // Check if LLM is configured
    if (!this.chatManager.llmConfigManager.isConfigured()) {
      return 'I need to be configured first. Please go to Options → Configure LLMs to set up your preferred AI provider (OpenAI, Anthropic, Google, or Custom Endpoint).';
    }

    // Initialize execution tracking for benchmark integration
    const executionData = {
      functionCalls: [],
      toolResults: [],
      rounds: 0,
      startTime: Date.now(),
      endTime: null,
      totalExecutionTime: 0,
    };

    // Store execution data for benchmark access
    this.chatManager.lastExecutionData = executionData;

    console.log('=== ChatManager.sendToLLM DEBUG START ===');
    console.log('User message:', message);

    // 设置AbortController
    this.chatManager.conversationState.abortController = new AbortController();
    console.log('AbortController initialized:', !!this.chatManager.conversationState.abortController);

    try {
      // Check if multi-agent system is enabled
      const multiAgentEnabled = this.chatManager.configManager.get('multiAgentSettings.multiAgentSystemEnabled', false);
      const showAgentInfo = this.chatManager.configManager.get('multiAgentSettings.multiAgentShowInfo', true);

      if (multiAgentEnabled) {
        // Add multi-agent system activation message
        this.chatManager.addMultiAgentActivationMessage();

        if (showAgentInfo) {
          this.chatManager.addThinkingMessage(
            `🤖 **Multi-Agent System Activated**\n\n` +
            `🔄 **Agent Coordination Mode**: Enabled\n` +
            `📊 **Available Agents**: 8 specialized agents\n` +
            `🧠 **Decision Process**: Intelligent agent selection and coordination\n` +
            `⚡ **Performance**: Optimized execution with caching\n\n` +
            `*Multi-agent system will now coordinate tool execution across specialized agents...*`
          );
        }
      }

      // Get maximum function call rounds from configuration
      const maxRounds = this.chatManager.configManager.get('llm.functionCallRounds', 10);
      const enableEarlyCompletion = this.chatManager.configManager.get('llm.enableEarlyCompletion', true);
      console.log('🔧 Maximum function call rounds from config:', maxRounds);
      console.log('🔧 Early completion enabled:', enableEarlyCompletion);
      console.log('🔧 LLM config raw value:', this.chatManager.configManager.get('llm.functionCallRounds'));

      // 显示详细的思考过程
      this.chatManager.showThinkingProcess &&
        this.chatManager.addThinkingMessage(
          `🔄 <strong>Starting request processing</strong> (max rounds: ${maxRounds})<br>` +
          `📝 <strong>User Query:</strong> ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`
        );

      // Get current studio context
      const context = this.getCurrentContext();
      console.log('Context for LLM:', context);

      // Display context information
      if (this.chatManager.showThinkingProcess && context) {
        const contextInfo = [];
        if (context.currentFile) contextInfo.push(`📄 Current file: ${context.currentFile}`);
        if (context.selectedFeatures && context.selectedFeatures.length > 0) {
          contextInfo.push(`🎯 Selected features: ${context.selectedFeatures.length}`);
        }
        if (context.genomeLoaded) contextInfo.push(`🧬 Genome loaded: Yes`);
        if (contextInfo.length > 0) {
          this.chatManager.updateThinkingMessage(
            `<br>📊 <strong>Current Context:</strong><br>&nbsp;&nbsp;${contextInfo.join('<br>&nbsp;&nbsp;')}`
          );
        }
      }

      // Get memory context for conversation
      let memoryContext = null;
      try {
        memoryContext = await this.chatManager.getMemoryContext(message, 'general_chat');
        if (memoryContext) {
          console.log('🧠 Retrieved memory context for conversation');
          this.chatManager.showThinkingProcess &&
            this.chatManager.updateThinkingMessage(
              `<br>🧠 Memory context retrieved: ${Object.keys(memoryContext).length} memory items`
            );
        }
      } catch (error) {
        console.warn('🧠 Failed to retrieve memory context:', error);
      }

      // Build initial conversation history including the new message
      let conversationHistory = await this.buildConversationHistory(message);
      console.log('Initial conversation history length:', conversationHistory.length);

      let currentRound = 0;
      let finalResponse = null;
      let taskCompleted = false;
      let executedTools = new Set(); // Track executed tools to prevent re-execution

      // Iterative function calling loop
      while (currentRound < maxRounds && !taskCompleted) {
        // 检查是否被中止
        if (this.chatManager.conversationState.abortController && this.chatManager.conversationState.abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        // 防御性检查：如果abortController为null，重新初始化
        if (!this.chatManager.conversationState.abortController) {
          console.warn('AbortController is null during processing, reinitializing...');
          this.chatManager.conversationState.abortController = new AbortController();
        }

        currentRound++;
        console.log(`=== FUNCTION CALL ROUND ${currentRound}/${maxRounds} ===`);

        // 更新思考过程 - 添加更详细的信息
        if (this.chatManager.showThinkingProcess) {
          this.chatManager.updateThinkingMessage(`<br><br>🤖 <strong>Round ${currentRound}/${maxRounds}</strong>`);
          this.chatManager.updateThinkingMessage(`📤 Sending request to LLM...`);
          this.chatManager.updateThinkingMessage(`📚 Conversation history: ${conversationHistory.length} messages`);
        }

        // Send conversation history to configured LLM
        console.log('Sending to LLM...');
        const response = await this.chatManager.llmConfigManager.sendMessageWithHistory(
          conversationHistory,
          context,
          memoryContext
        );

        // 检查响应是否被中止
        if (this.chatManager.conversationState.abortController && this.chatManager.conversationState.abortController.signal.aborted) {
          throw new Error('AbortError');
        }

        console.log('=== LLM Raw Response ===');
        console.log('Response type:', typeof response);
        console.log('Response length:', response ? response.length : 'null');
        console.log('Response is null:', response === null);
        console.log('Response is undefined:', response === undefined);
        console.log('Response is empty string:', response === '');
        console.log('Full response:', response);
        console.log('JSON.stringify response:', JSON.stringify(response));
        console.log('========================');

        // 显示LLM的思考过程（如果响应包含思考标签）
        if (this.chatManager.showThinkingProcess) {
          this.chatManager.updateThinkingMessage(`✅ Response received (${response ? response.length : 0} chars)`);
          this.chatManager.displayLLMThinking(response);
        }

        // CRITICAL FIX: Check for tool calls FIRST, before task completion
        // This prevents early completion from skipping tool execution
        const toolCall = this.chatManager.parseToolCall(response);

        // Also check for multiple tool calls in response
        const multipleToolCalls = this.chatManager.parseMultipleToolCalls(response);

        // Determine which tools to execute
        let toolsToExecute = multipleToolCalls.length > 0 ? multipleToolCalls : toolCall ? [toolCall] : [];

        // Display tool detection information
        if (this.chatManager.showThinkingProcess) {
          if (toolsToExecute.length > 0) {
            this.chatManager.updateThinkingMessage(
              `🔍 Detected ${toolsToExecute.length} tool call(s): ${toolsToExecute.map(t => t.tool_name).join(', ')}`
            );
          } else {
            this.chatManager.updateThinkingMessage(`💬 No tool calls detected - conversational response`);
          }
        }

        // Apply intelligent tool execution policies instead of simple re-executable sets
        const toolsBeforeFilter = toolsToExecute.length;
        toolsToExecute = toolsToExecute.filter(tool => {
          const shouldAllow = this.chatManager.shouldAllowToolExecution(tool, conversationHistory, currentRound, []);
          if (!shouldAllow) {
            console.log(`🚫 [Policy] Blocking execution of: ${tool.tool_name}`);
            this.chatManager.showThinkingProcess && this.chatManager.updateThinkingMessage(`🚫 Policy blocked: ${tool.tool_name}`);
            return false;
          }
          console.log(`✅ [Policy] Allowing execution of: ${tool.tool_name}`);
          return true;
        });

        if (this.chatManager.showThinkingProcess && toolsBeforeFilter > toolsToExecute.length) {
          this.chatManager.updateThinkingMessage(
            `⚠️ Filtered ${toolsBeforeFilter - toolsToExecute.length} tool(s) by execution policy`
          );
        }

        // CRITICAL FIX: If current response has no tools, check previous assistant messages
        // in conversation history for unexecuted tool calls
        // This covers both empty responses and task completion responses
        if (toolsToExecute.length === 0) {
          console.log('=== CHECKING PREVIOUS ROUNDS FOR UNEXECUTED TOOL CALLS ===');
          console.log('Current conversation history length:', conversationHistory.length);
          console.log('Current response has no tools, looking for previous tool calls...');

          // Log the entire conversation history for debugging
          conversationHistory.forEach((msg, index) => {
            console.log(
              `History[${index}] Role: ${msg.role}, Content length: ${msg.content ? msg.content.length : 'null'}`
            );
            if (msg.content && msg.content.length < 200) {
              console.log(`History[${index}] Content preview:`, msg.content);
            }
          });

          // Look for tool results in history to mark as executed
          conversationHistory.forEach(msg => {
            if (msg.role === 'system' && msg.content && msg.content.includes('executed successfully')) {
              // Extract tool name from result message
              const toolMatch = msg.content.match(/(\w+) executed successfully/);
              if (toolMatch) {
                executedTools.add(toolMatch[1]);
              }
            }
          });

          console.log('Already executed tools:', Array.from(executedTools));

          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const msg = conversationHistory[i];
            console.log(`Examining message ${i}: role=${msg.role}, has_content=${!!msg.content}`);
            if (msg.role === 'assistant' && msg.content) {
              console.log(`Checking assistant message ${i} for tool calls:`, msg.content);
              const previousToolCall = this.chatManager.parseToolCall(msg.content);
              console.log(`Parse result for message ${i}:`, previousToolCall);
              if (previousToolCall) {
                const shouldAllow = this.chatManager.shouldAllowToolExecution(
                  previousToolCall,
                  conversationHistory,
                  currentRound,
                  []
                );
                if (shouldAllow) {
                  console.log('✅ [Policy] Found allowed tool call from previous round:', previousToolCall);
                  toolsToExecute = [previousToolCall];
                  break;
                } else {
                  console.log(`🚫 [Policy] Tool not allowed for re-execution: ${previousToolCall.tool_name}`);
                }
              } else {
                console.log(`❌ No tool call found in message ${i}`);
              }
            } else {
              console.log(`Skipping message ${i}: role=${msg.role}, has_content=${!!msg.content}`);
            }
          }
          console.log('Final toolsToExecute after history check:', toolsToExecute);
          console.log('=== END PREVIOUS ROUNDS CHECK ===');
        }

        // Check for task completion signals if early completion is enabled
        // BUT ONLY if there are NO tool calls to execute
        if (enableEarlyCompletion && toolsToExecute.length === 0) {
          const completionResult = this.chatManager.checkTaskCompletion(response);
          if (completionResult.isCompleted) {
            console.log('=== TASK COMPLETION DETECTED (NO TOOL CALLS) ===');
            console.log('Completion reason:', completionResult.reason);
            console.log('Completion confidence:', completionResult.confidence);
            console.log('================================================');

            taskCompleted = true;
            finalResponse = completionResult.summary || response;
            this.chatManager.showNotification(
              `Task completed early (Round ${currentRound}/${maxRounds}): ${completionResult.reason}`,
              'success'
            );
            break;
          }
        } else if (toolsToExecute.length > 0) {
          console.log('=== TOOL CALLS FOUND - SKIPPING EARLY COMPLETION CHECK ===');
          console.log('Tool calls take priority over completion detection');
          console.log('=========================================================');
        }

        if (toolsToExecute.length > 0) {
          console.log(`=== ${toolsToExecute.length} TOOL CALL(S) DETECTED ===`);
          console.log(
            'Tools to execute:',
            toolsToExecute.map(t => t.tool_name)
          );
          console.log('==========================');

          // Show thinking process for tool execution
          if (this.chatManager.showThinkingProcess) {
            this.chatManager.updateThinkingMessage(`<br><br>⚡ <strong>Preparing tool execution...</strong>`);
            this.chatManager.updateThinkingMessage(`🛠️ Tools to execute: ${toolsToExecute.map(t => t.tool_name).join(', ')}`);
          }

          // 显示工具调用信息
          this.chatManager.showToolCalls && (await this.chatManager.addToolCallMessage(toolsToExecute));

          try {
            console.log('Executing tool(s)...');

            // Show execution start in thinking process
            if (this.chatManager.showThinkingProcess) {
              this.chatManager.updateThinkingMessage(`🚀 Starting execution...`);
            }

            // 检查是否被中止
            if (this.chatManager.conversationState.abortController && this.chatManager.conversationState.abortController.signal.aborted) {
              throw new Error('AbortError');
            }

            let toolResults;

            // Use Smart Executor if available and enabled
            if (this.chatManager.smartExecutor && this.chatManager.isSmartExecutionEnabled) {
              console.log('🚀 Using Smart Executor for optimized execution');
              const smartResult = await this.chatManager.smartExecutor.smartExecute(message, toolsToExecute);

              if (smartResult.success) {
                toolResults = smartResult.results;

                // Provide comprehensive feedback
                if (smartResult.report) {
                  const { summary, categorySummary } = smartResult.report;

                  // Show quick feedback for different categories
                  for (const category of categorySummary) {
                    if (category.successful > 0) {
                      let icon, message;
                      switch (category.name) {
                        case 'browserActions':
                          icon = '✓';
                          message = 'Browser actions completed';
                          break;
                        case 'dataRetrieval':
                          icon = '📊';
                          message = 'Data retrieved';
                          break;
                        case 'sequenceAnalysis':
                          icon = '🧬';
                          message = 'Analysis completed';
                          break;
                        case 'blastSearch':
                          icon = '🔍';
                          message = 'BLAST search completed';
                          break;
                        default:
                          icon = '✓';
                          message = 'Operations completed';
                      }
                      this.chatManager.showNotification(
                        `${icon} ${message} (${category.successful}/${category.successful + category.failed})`,
                        'success'
                      );
                    }
                  }

                  console.log('Smart execution summary:', summary);
                  console.log('Execution time:', smartResult.executionTime, 'ms');
                }
              } else {
                console.warn('Smart execution failed, falling back to standard execution:', smartResult.error);
                // Fallback to sequential execution
                toolResults = [];
                for (const tool of toolsToExecute) {
                  try {
                    const result = await this.chatManager.executeToolByName(tool.tool_name, tool.parameters);
                    toolResults.push({
                      tool: tool.tool_name,
                      parameters: tool.parameters,
                      success: true,
                      result: result,
                      error: null,
                    });
                  } catch (error) {
                    toolResults.push({
                      tool: tool.tool_name,
                      parameters: tool.parameters,
                      success: false,
                      result: null,
                      error: error.message,
                    });
                  }
                }
              }
            } else {
              // Standard sequential execution
              toolResults = [];
              for (const tool of toolsToExecute) {
                try {
                  const result = await this.chatManager.executeToolByName(tool.tool_name, tool.parameters);
                  toolResults.push({
                    tool: tool.tool_name,
                    parameters: tool.parameters,
                    success: true,
                    result: result,
                    error: null,
                  });
                } catch (error) {
                  toolResults.push({
                    tool: tool.tool_name,
                    parameters: tool.parameters,
                    success: false,
                    result: null,
                    error: error.message,
                  });
                }
              }
            }

            console.log('Tool execution completed. Results:', toolResults);

            // Show execution results in thinking process
            if (this.chatManager.showThinkingProcess) {
              const successCount = toolResults.filter(r => r.success).length;
              const failCount = toolResults.filter(r => !r.success).length;
              this.chatManager.updateThinkingMessage(`✅ Execution completed: ${successCount} successful, ${failCount} failed`);

              // Show details for each tool
              toolResults.forEach(result => {
                if (result.success) {
                  this.chatManager.updateThinkingMessage(`&nbsp;&nbsp;✅ ${result.tool}: Success`);
                } else {
                  this.chatManager.updateThinkingMessage(`&nbsp;&nbsp;❌ ${result.tool}: Failed - ${result.error}`);
                }
              });
            }

            // BENCHMARK INTEGRATION: Track function calls and results for benchmark access
            if (this.chatManager.lastExecutionData) {
              // Track function calls
              toolsToExecute.forEach(tool => {
                this.chatManager.lastExecutionData.functionCalls.push({
                  tool_name: tool.tool_name,
                  parameters: tool.parameters,
                  round: currentRound,
                  timestamp: new Date().toISOString(),
                });
              });

              // Track tool results
              this.chatManager.lastExecutionData.toolResults.push(...toolResults);
              this.chatManager.lastExecutionData.rounds = currentRound;
            }

            // Track executed tools to prevent infinite loops
            // Be more selective about which tools to track for re-execution prevention
            const nonReExecutableTools = new Set([
              'blast_search',
              'fetch_protein_structure',
              'get_uniprot_entry',
              'create_annotation',
              'export_data',
              'delete_feature',
            ]);

            // File loading tools should be tracked when they succeed to prevent re-execution with same parameters
            const fileLoadingTools = new Set([
              'load_genome_file',
              'load_annotation_file',
              'load_variant_file',
              'load_reads_file',
              'load_wig_tracks',
              'load_operon_file',
            ]);

            toolsToExecute.forEach(tool => {
              const toolKey = `${tool.tool_name}:${JSON.stringify(tool.parameters)}`;

              // Track non-re-executable tools and successful file loading operations
              if (nonReExecutableTools.has(tool.tool_name)) {
                executedTools.add(toolKey);
                console.log(`🔒 Tracking execution for non-re-executable tool: ${tool.tool_name}`);
              } else if (fileLoadingTools.has(tool.tool_name)) {
                // Only track file loading tools if they succeed
                const result = toolResults.find(r => r.tool === tool.tool_name);
                if (result && result.success) {
                  executedTools.add(toolKey);
                  console.log(`🔒 Tracking successful file loading execution: ${tool.tool_name}`);
                } else {
                  console.log(`🔄 Not tracking failed file loading execution: ${tool.tool_name}`);
                }
              } else {
                console.log(`🔄 Not tracking execution for re-executable tool: ${tool.tool_name}`);
              }
            });

            // 显示工具执行结果
            this.chatManager.showToolCalls && this.chatManager.addToolResultMessage(toolResults);

            // Add the tool calls and results to conversation history for next round
            conversationHistory.push({
              role: 'assistant',
              content: JSON.stringify(
                toolsToExecute.length === 1
                  ? { tool_name: toolsToExecute[0].tool_name, parameters: toolsToExecute[0].parameters }
                  : toolsToExecute.map(t => ({ tool_name: t.tool_name, parameters: t.parameters }))
              ),
            });

            // Process results
            const successfulResults = toolResults.filter(r => r.success);
            const failedResults = toolResults.filter(r => !r.success);

            if (successfulResults.length > 0) {
              // Add successful tool results to conversation with SYSTEM role to prevent re-execution
              // IMPORTANT: Sanitize results before sending to LLM to prevent context overflow
              const successMessages = successfulResults.map(result => {
                const sanitizedResult = this.sanitizeResultForLLM(result.result, result.tool);
                const sanitizedStr = JSON.stringify(sanitizedResult) || 'null';
                // Log warning if sanitized result is still large (helps identify tools needing better sanitization)
                if (sanitizedStr.length > 10000) {
                  console.warn(
                    `⚠️ [Context Overflow Risk] Sanitized result for "${result.tool}" is still large: ` +
                    `${(sanitizedStr.length / 1024).toFixed(1)}KB. Consider adding tool-specific sanitization rules.`
                  );
                }
                return `${result.tool} executed successfully: ${sanitizedStr}`;
              });
              conversationHistory.push({
                role: 'system',
                content: `Tool execution completed: ${successMessages.join('; ')}`,
              });

              // ENHANCED: Check for simple task completion after successful tool execution
              const shouldTerminateEarly = this.chatManager.shouldTerminateAfterToolExecution(
                toolsToExecute,
                successfulResults,
                message
              );
              if (shouldTerminateEarly) {
                console.log('=== EARLY TERMINATION AFTER SUCCESSFUL TOOL EXECUTION ===');
                console.log('Simple task completed successfully, terminating early');
                console.log('=========================================================');

                taskCompleted = true;
                // Generate a simple completion response based on the tool results
                finalResponse = this.chatManager.generateCompletionResponseFromToolResults(successfulResults, toolsToExecute);
                break;
              }

              console.log(
                `${successfulResults.length} tool(s) executed successfully. Continuing to round ${currentRound + 1} to check for follow-up actions.`
              );
            }

            if (failedResults.length > 0) {
              // Add failed tool results to conversation with SYSTEM role
              const errorMessages = failedResults.map(
                result => `${result.tool} failed: ${result.error || 'Unknown error'}`
              );
              conversationHistory.push({
                role: 'system',
                content: `Tool execution errors: ${errorMessages.join('; ')}`,
              });
              console.log(`${failedResults.length} tool(s) failed:`, failedResults);

              // CRITICAL FIX: If ALL tools failed, terminate to prevent infinite retry
              if (successfulResults.length === 0) {
                console.log('=== ALL TOOLS FAILED - TERMINATING TO PREVENT INFINITE RETRY ===');
                console.log(
                  'Failed tools:',
                  failedResults.map(r => r.tool)
                );
                console.log(
                  'Errors:',
                  failedResults.map(r => r.error)
                );
                console.log('This prevents infinite retry loops when tools consistently fail');
                console.log('================================================================');

                taskCompleted = true;

                // Generate more informative error response based on the specific tool
                if (failedResults.length === 1 && failedResults[0].tool === 'get_genome_info') {
                  finalResponse =
                    `ℹ️ **Unable to retrieve genome information**\n\n` +
                    `The genome information tool is currently unavailable. This might be because:\n` +
                    `- No genome file is currently loaded\n` +
                    `- The genome browser is not initialized\n` +
                    `- The requested data is not available\n\n` +
                    `Please try loading a genome file first or check if the genome browser is properly initialized.`;
                } else {
                  finalResponse =
                    `❌ **Tool Execution Failed**\n\n` +
                    `The following tool(s) could not be executed:\n` +
                    failedResults.map(r => `- **${r.tool}**: ${r.error || 'Unknown error'}`).join('\n') +
                    `\n\nPlease check your system configuration or try a different approach.`;
                }
                break;
              }
            }
          } catch (error) {
            console.error('=== TOOL EXECUTION EXCEPTION ===');
            console.error('Error:', error);
            console.error('Stack:', error.stack);
            console.error('================================');

            // Add error to conversation and continue
            conversationHistory.push({
              role: 'system',
              content: `Tool execution error: ${error.message}`,
            });
          }
        } else {
          console.log('=== NO TOOL CALL DETECTED ===');
          console.log('Received conversational response, ending function call loop');
          console.log('===============================');

          // No tool call detected - this is our final response
          finalResponse = response;
          break;
        }
      }

      // If we've exhausted all rounds and still haven't got a final response
      if (!finalResponse) {
        console.log('=== MAX ROUNDS REACHED ===');
        console.log('Requesting final summary from LLM...');

        // Ask LLM for a final summary
        conversationHistory.push({
          role: 'user',
          content: 'Please provide a final summary of the actions taken and results achieved.',
        });

        finalResponse = await this.chatManager.llmConfigManager.sendMessageWithHistory(conversationHistory, context, memoryContext);
        console.log('Final summary response:', finalResponse);
      }

      // BENCHMARK INTEGRATION: Complete execution data tracking
      if (this.chatManager.lastExecutionData) {
        this.chatManager.lastExecutionData.endTime = Date.now();
        this.chatManager.lastExecutionData.totalExecutionTime = this.chatManager.lastExecutionData.endTime - this.chatManager.lastExecutionData.startTime;
        this.chatManager.lastExecutionData.finalResponse =
          finalResponse || 'I completed the requested actions. Please let me know if you need anything else.';
        console.log('📊 Execution data for benchmark:', this.chatManager.lastExecutionData);
      }

      console.log('=== ChatManager.sendToLLM DEBUG END (SUCCESS) ===');
      return finalResponse || 'I completed the requested actions. Please let me know if you need anything else.';
    } catch (error) {
      console.error('=== LLM COMMUNICATION ERROR ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('==============================');

      let errorMessage;

      // Provide specific error messages based on error type
      if (error.message.includes('HTTP 503') || error.message.includes('Service Unavailable')) {
        errorMessage =
          `🚫 **Service Temporarily Unavailable**\n\n` +
          `The LLM service is currently experiencing high load or maintenance. ` +
          `The system automatically retried your request, but the service remains unavailable.\n\n` +
          `**Suggestions:**\n` +
          `• Wait a few minutes and try again\n` +
          `• Switch to a different LLM provider in Options → Configure LLMs\n` +
          `• Check the service status page for your LLM provider`;
      } else if (error.message.includes('HTTP 429') || error.message.includes('Too Many Requests')) {
        errorMessage =
          `⏱️ **Rate Limit Exceeded**\n\n` +
          `You've exceeded the API rate limit for your LLM provider. ` +
          `The system will automatically retry, but you may need to wait.\n\n` +
          `**Suggestions:**\n` +
          `• Wait a few minutes before sending another message\n` +
          `• Consider upgrading your API plan for higher limits\n` +
          `• Switch to a different LLM provider temporarily`;
      } else if (error.message.includes('HTTP 401') || error.message.includes('Unauthorized')) {
        errorMessage =
          `🔐 **Authentication Error**\n\n` +
          `Your API key appears to be invalid or expired.\n\n` +
          `**Please:**\n` +
          `• Go to Options → Configure LLMs\n` +
          `• Check and update your API key\n` +
          `• Test the connection before saving`;
      } else if (error.message.includes('HTTP 404') || error.message.includes('Not Found')) {
        errorMessage =
          `🔍 **Model Not Found**\n\n` +
          `The requested model is not available or doesn't exist.\n\n` +
          `**Please:**\n` +
          `• Go to Options → Configure LLMs\n` +
          `• Select a different model\n` +
          `• Check your provider's available models`;
      } else if (
        error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('connection')
      ) {
        errorMessage =
          `🌐 **Network Connection Error**\n\n` +
          `Unable to connect to the LLM service. This could be due to:\n\n` +
          `• Internet connectivity issues\n` +
          `• Firewall blocking the connection\n` +
          `• Service endpoint temporarily down\n\n` +
          `**Please check your internet connection and try again.**`;
      } else {
        errorMessage =
          `❌ **Unexpected Error**\n\n` +
          `${error.message}\n\n` +
          `**Troubleshooting:**\n` +
          `• Check your LLM configuration in Options → Configure LLMs\n` +
          `• Try switching to a different LLM provider\n` +
          `• Check the browser console for more details`;
      }

      console.log('=== ChatManager.sendToLLM DEBUG END (LLM ERROR) ===');
      return errorMessage;
    }
  }

  /**
   * Sanitize tool result for LLM context
   * Removes or truncates large data arrays to prevent context overflow
   * @param {Object} result - The tool execution result
   * @param {string} toolName - Name of the tool that generated the result
   * @returns {Object} Sanitized result suitable for LLM context
   */
  sanitizeResultForLLM(result, toolName) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    // Create a shallow copy to avoid modifying the original
    const sanitized = { ...result };

    // ─── Tool-specific sanitization rules ───────────────────────────────

    switch (toolName) {
      case 'fetch_alphafold_structure':
      case 'fetch_protein_structure':
        // These tools may return large PDB/structure data that must NEVER
        // be included in LLM context (100KB–1MB per structure).
        // Layer 1 (ProteinService) should already exclude pdbData via _dataRef,
        // but this is a defense-in-depth safety net.
        if (sanitized.pdbData || sanitized.pdb_data) {
          const dataField = sanitized.pdbData ? 'pdbData' : 'pdb_data';
          const dataLength = (sanitized[dataField] || '').length;
          delete sanitized[dataField];
          sanitized._pdbDataOmitted = {
            length: dataLength,
            note: 'Full PDB data omitted to prevent context overflow. Use downloadUrl or _dataRef to access.',
          };
        }
        break;

      case 'genome_codon_usage_analysis':
        // Keep summary statistics but remove large gene list
        if (sanitized.analyzedGenes && Array.isArray(sanitized.analyzedGenes)) {
          const geneCount = sanitized.analyzedGenes.length;
          const sampleSize = 5;
          sanitized.analyzedGenes = {
            totalCount: geneCount,
            note: `Full list omitted (${geneCount} genes analyzed)`,
            sample: sanitized.analyzedGenes.slice(0, sampleSize).map(g => ({
              name: g.name,
              length: g.length,
              chromosome: g.chromosome,
            })),
          };
        }
        // Truncate codonPreferences to top amino acids only
        if (sanitized.codonPreferences && typeof sanitized.codonPreferences === 'object') {
          const aaEntries = Object.entries(sanitized.codonPreferences)
            .filter(([aa]) => aa !== '*')
            .sort(([, a], [, b]) => (b.totalCount || 0) - (a.totalCount || 0))
            .slice(0, 10); // Keep only top 10 amino acids
          sanitized.codonPreferences = {
            note: `Showing top 10 amino acids by usage`,
            data: Object.fromEntries(aaEntries),
          };
        }
        break;

      case 'codon_usage_analysis':
        // Keep only top codons for summary
        if (sanitized.codonUsage && Array.isArray(sanitized.codonUsage)) {
          sanitized.codonUsage = sanitized.codonUsage.slice(0, 15); // Top 15 codons
        }
        break;

      case 'search_features':
      case 'find_gene_by_name':
      case 'get_gene_details':
        // Limit gene/feature results to reasonable number
        if (sanitized.genes && Array.isArray(sanitized.genes)) {
          const totalGenes = sanitized.genes.length;
          if (totalGenes > 10) {
            sanitized.genes = sanitized.genes.slice(0, 10);
            sanitized.note = `Showing first 10 of ${totalGenes} results`;
          }
        }
        if (sanitized.features && Array.isArray(sanitized.features)) {
          const totalFeatures = sanitized.features.length;
          if (totalFeatures > 10) {
            sanitized.features = sanitized.features.slice(0, 10);
            sanitized.note = `Showing first 10 of ${totalFeatures} results`;
          }
        }
        break;

      case 'find_restriction_sites':
        // Limit array results
        if (sanitized.sites && Array.isArray(sanitized.sites)) {
          const totalSites = sanitized.sites.length;
          if (totalSites > 20) {
            sanitized.sites = sanitized.sites.slice(0, 20);
            sanitized.note = `Showing first 20 of ${totalSites} sites`;
          }
        }
        break;

      case 'get_track_settings_schema': {
        // Schema is large (~14KB). Compact each track to name + setting keys with
        // type and default only — removes verbose descriptions to fit context budget.
        if (sanitized.schema && typeof sanitized.schema === 'object') {
          const compact = {};
          for (const [trackType, trackDef] of Object.entries(sanitized.schema)) {
            if (!trackDef || typeof trackDef !== 'object') continue;
            compact[trackType] = { description: trackDef.description, settings: {} };
            const settings = trackDef.settings || {};
            for (const [key, meta] of Object.entries(settings)) {
              compact[trackType].settings[key] = {
                type: meta.type,
                default: meta.default,
                ...(meta.enum ? { enum: meta.enum } : {}),
              };
            }
          }
          sanitized.schema = compact;
          sanitized._schemaNormalized = 'Descriptions stripped to reduce context size. Use get_track_settings for live values.';
        }
        break;
      }

      case 'get_all_track_settings': {
        // Keep only the most useful fields per track; skip deep nested objects.
        if (sanitized.settings && typeof sanitized.settings === 'object') {
          const KEY_FIELDS = ['height', 'renderingMode', 'layoutMode', 'colorMode', 'fontSize',
            'maxRows', 'showCoverage', 'showIndicators', 'contentColor', 'lineWidth',
            'defaultTrackHeight', 'trackSpacing', 'resultHeight', 'resultSpacing',
            'showRuler', 'adaptiveHeight', 'error', '_note'];
          const compact = {};
          for (const [trackType, trackSettings] of Object.entries(sanitized.settings)) {
            if (!trackSettings || typeof trackSettings !== 'object') {
              compact[trackType] = trackSettings;
              continue;
            }
            compact[trackType] = {};
            for (const field of KEY_FIELDS) {
              if (field in trackSettings) compact[trackType][field] = trackSettings[field];
            }
          }
          sanitized.settings = compact;
          sanitized._settingsNormalized = 'Only key fields shown. Use get_track_settings with a specific track_type for full details.';
        }
        break;
      }
    }

    // ─── General sanitization for any result ─────────────────────────────

    // Truncate known sequence-like string fields
    const sequenceFields = ['sequence', 'codingSequence', 'proteinSequence', 'coding_sequence', 'protein_sequence'];
    for (const field of sequenceFields) {
      if (sanitized[field] && typeof sanitized[field] === 'string' && sanitized[field].length > 1000) {
        const originalLength = sanitized[field].length;
        sanitized[field] =
          sanitized[field].substring(0, 500) +
          '...[truncated]...' +
          sanitized[field].substring(sanitized[field].length - 500);
        sanitized[`${field}Length`] = originalLength;
      }
    }

    // Remove pdbData/pdb_data from ANY tool result (defense-in-depth)
    for (const pdbField of ['pdbData', 'pdb_data']) {
      if (sanitized[pdbField] && typeof sanitized[pdbField] === 'string') {
        const len = sanitized[pdbField].length;
        delete sanitized[pdbField];
        if (!sanitized._pdbDataOmitted) {
          sanitized._pdbDataOmitted = {
            length: len,
            note: 'PDB data omitted to prevent context overflow.',
          };
        }
      }
    }

    // General large-string guard: truncate any string field > 5000 chars
    const LARGE_STRING_THRESHOLD = 5000;
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > LARGE_STRING_THRESHOLD) {
        const originalLength = sanitized[key].length;
        sanitized[key] =
          sanitized[key].substring(0, 2000) +
          `\n...[truncated ${originalLength - 4000} chars]...\n` +
          sanitized[key].substring(sanitized[key].length - 2000);
        sanitized[`_${key}_originalLength`] = originalLength;
      }
    });

    // Limit any large arrays not caught by specific rules
    Object.keys(sanitized).forEach(key => {
      if (Array.isArray(sanitized[key]) && sanitized[key].length > 50) {
        const originalLength = sanitized[key].length;
        sanitized[key] = sanitized[key].slice(0, 50);
        sanitized[`${key}_truncated`] = `Array truncated from ${originalLength} to 50 items`;
      }
    });

    // ─── Total size budget check ─────────────────────────────────────────
    // After all field-level sanitization, check if the total serialized size
    // exceeds the budget. If so, aggressively truncate the largest string fields.
    const MAX_RESULT_SIZE_BYTES = 50 * 1024; // 50KB budget per tool result
    try {
      let serialized = JSON.stringify(sanitized);
      if (serialized.length > MAX_RESULT_SIZE_BYTES) {
        console.warn(
          `[sanitizeResultForLLM] Result for "${toolName}" exceeds ${MAX_RESULT_SIZE_BYTES / 1024}KB budget ` +
          `(${(serialized.length / 1024).toFixed(1)}KB). Applying aggressive truncation.`
        );

        // Find all string fields sorted by length (largest first)
        const stringFields = Object.keys(sanitized)
          .filter(k => typeof sanitized[k] === 'string' && sanitized[k].length > 200)
          .sort((a, b) => sanitized[b].length - sanitized[a].length);

        for (const field of stringFields) {
          if (serialized.length <= MAX_RESULT_SIZE_BYTES) break;
          const originalLength = sanitized[field].length;
          sanitized[field] = sanitized[field].substring(0, 200) +
            `\n...[aggressively truncated from ${originalLength} chars to fit context budget]...\n`;
          sanitized[`_${field}_originalLength`] = originalLength;
          serialized = JSON.stringify(sanitized);
        }

        // If still over budget after string truncation, convert large objects to summaries
        if (serialized.length > MAX_RESULT_SIZE_BYTES) {
          const objectFields = Object.keys(sanitized)
            .filter(k => typeof sanitized[k] === 'object' && sanitized[k] !== null)
            .sort((a, b) => JSON.stringify(sanitized[b]).length - JSON.stringify(sanitized[a]).length);

          for (const field of objectFields) {
            if (serialized.length <= MAX_RESULT_SIZE_BYTES) break;
            const fieldSize = JSON.stringify(sanitized[field]).length;
            if (fieldSize > 500) {
              sanitized[field] = { _truncated: true, originalSize: fieldSize, note: 'Object truncated to fit context budget' };
              serialized = JSON.stringify(sanitized);
            }
          }
        }
      }
    } catch (e) {
      console.error('[sanitizeResultForLLM] Error during size budget check:', e);
    }

    return sanitized;
  }

  async buildConversationHistory(newMessage) {
    const history = [];

    // Add system context message
    const systemMessage = await this.buildSystemMessage();
    history.push({ role: 'system', content: systemMessage });

    // If context mode is enabled (current message only), skip conversation history
    if (this.chatManager.contextModeEnabled) {
      console.log('Context mode enabled: sending only current message');
      // Add only the new user message
      history.push({ role: 'user', content: newMessage });
      return history;
    }

    // Get conversation memory setting
    const conversationMemory = this.chatManager.configManager.get('llm.conversationMemory', 10);

    // Get chat history and find the current conversation (after last separator)
    const chatHistory = this.chatManager.configManager.getChatHistory();
    let currentConversationMessages = [];

    // Find messages after the last conversation separator
    for (let i = chatHistory.length - 1; i >= 0; i--) {
      const msg = chatHistory[i];
      if (msg.sender === 'system' && msg.message === '--- CONVERSATION_SEPARATOR ---') {
        break; // Stop at the last separator
      }
      currentConversationMessages.unshift(msg); // Add to beginning to maintain order
    }

    // If no separator found, use the full recent history
    if (currentConversationMessages.length === 0) {
      currentConversationMessages = chatHistory.slice(-conversationMemory * 2);
    }

    // Add conversation messages to history (exclude system messages and separators)
    for (const msg of currentConversationMessages.slice(-conversationMemory * 2)) {
      if (msg.sender === 'user') {
        history.push({ role: 'user', content: msg.message });
      } else if (msg.sender === 'assistant') {
        history.push({ role: 'assistant', content: msg.message });
      }
      // Skip system messages and separators
    }

    // Add the new user message
    history.push({ role: 'user', content: newMessage });

    return history;
  }

  async buildSystemMessage() {
    // [MCP Integration] Check for specific MCP server prompts first
    if (this.chatManager.mcpServerManager && this.chatManager.mcpServerManager.serverPrompts) {
      for (const [serverId, prompts] of this.chatManager.mcpServerManager.serverPrompts) {
        // Look for Deep Gene Research Assistant prompt
        const deepGenePrompt = prompts.find(
          p =>
            p.name === 'Deep Gene Research Assistant' ||
            p.name === 'deep-gene-research-assistant' ||
            p.name === 'deep_gene_research_assistant'
        );

        if (deepGenePrompt) {
          console.log(`🤖 Found MCP system prompt from server ${serverId}: ${deepGenePrompt.name}`);
          try {
            // Fetch the full prompt content
            const promptResult = await this.chatManager.mcpServerManager.getPrompt(serverId, deepGenePrompt.name);

            if (promptResult && promptResult.messages && promptResult.messages.length > 0) {
              console.log(`✅ Using MCP system prompt:`, promptResult.description || deepGenePrompt.name);

              // Extract text content from messages
              // MCP prompts return a list of messages (role + content)
              // We'll combine all system/user/assistant messages into one system instruction for now,
              // or just extract the content if it's primarily a system prompt.
              // For simplicity and compatibility with current single-string system prompt, we join text parts.

              let promptText = '';

              for (const msg of promptResult.messages) {
                if (msg.content) {
                  if (typeof msg.content === 'string') {
                    promptText += msg.content + '\n\n';
                  } else if (msg.content.text) {
                    promptText += msg.content.text + '\n\n';
                  } else if (msg.content.type === 'text' && msg.content.text) {
                    promptText += msg.content.text + '\n\n';
                  }
                }
              }

              if (promptText.trim()) {
                // Append standard tool context if needed, or rely on the prompt to ask for tools?
                // Usually MCP prompts are standalone system instructions.
                // But we still need our tools available.

                const useOptimizedPrompt = this.chatManager.configManager.get(
                  'chatboxSettings.useOptimizedPrompt',
                  this.chatManager.configManager.get('llm.useOptimizedPrompt', true)
                );
                const toolContext = useOptimizedPrompt ? this.chatManager.getOptimizedToolContext() : this.chatManager.getCompleteToolContext();

                return `${promptText}\n\n${toolContext}`;
              }
            }
          } catch (error) {
            console.error(`❌ Failed to get/apply prompt '${deepGenePrompt.name}':`, error);
            // Fallback to standard logic if prompt fetching fails
          }
        }
      }
    }

    // Get user-defined system prompt
    // Check chatboxSettings.customSystemPrompt first, then llm.systemPrompt for backward compatibility
    const userSystemPrompt = this.chatManager.configManager.get('chatboxSettings.customSystemPrompt', '') ||
      this.chatManager.configManager.get('llm.systemPrompt', '');

    // Get system message format preference (optimized or complete)
    // Check both chatboxSettings and llm settings for backward compatibility
    const useOptimizedPrompt = this.chatManager.configManager.get(
      'chatboxSettings.useOptimizedPrompt',
      this.chatManager.configManager.get('llm.useOptimizedPrompt', true)
    );

    // Get system prompt section configuration
    const sectionConfig = this.chatManager.getSystemPromptSectionConfig();

    // Get current user query for memory retrieval
    const currentUserQuery = this.chatManager.getLastUserQuery() || '';

    // If user has defined a custom system prompt, use it with variable substitution
    if (userSystemPrompt && userSystemPrompt.trim()) {
      const processedPrompt = this.chatManager.processSystemPromptVariables(userSystemPrompt);
      // Choose context based on optimization setting
      const toolContext = useOptimizedPrompt ? this.chatManager.getOptimizedToolContext() : this.chatManager.getCompleteToolContext();

      // Add memory context if enabled in section config
      let memorySection = '';
      if (sectionConfig.toggles.memoryContext) {
        const memoryContext = await this.chatManager.getMemoryContext(currentUserQuery);
        memorySection = memoryContext ? `\n\n[Memory Context]\n${memoryContext}` : '';
      }

      return `${processedPrompt}\n\n${toolContext}${memorySection}`;
    }

    // Check if Dynamic Tools Registry is enabled in settings
    const dynamicToolsRegistryEnabled = this.chatManager.configManager.get('chatboxSettings.enableDynamicToolsRegistry', true);
    console.log('🔧 [buildSystemMessage] Dynamic Tools Registry enabled in settings:', dynamicToolsRegistryEnabled);

    // Try to use Dynamic Tools Registry if available and enabled
    console.log('🔧 [buildSystemMessage] Checking Dynamic Tools Registry...');
    console.log('🔧 [buildSystemMessage] dynamicToolsEnabled:', this.chatManager.dynamicToolsEnabled);
    console.log('🔧 [buildSystemMessage] dynamicTools:', this.chatManager.dynamicTools);

    if (dynamicToolsRegistryEnabled && this.chatManager.dynamicToolsEnabled && this.chatManager.dynamicTools) {
      try {
        console.log('🔧 [buildSystemMessage] Using Dynamic Tools Registry...');
        const context = this.chatManager.getCurrentContextForDynamicTools();
        const lastUserQuery = this.chatManager.getLastUserQuery();
        console.log('🔧 [buildSystemMessage] Context:', context);
        console.log('🔧 [buildSystemMessage] Last user query:', lastUserQuery);

        const promptData = await this.chatManager.dynamicTools.generateDynamicSystemPrompt(lastUserQuery, context);
        console.log('🔧 [buildSystemMessage] Generated prompt data:', promptData);

        // Apply section configuration filtering to dynamic prompt
        const filteredPrompt = this.applySystemPromptSectionConfig(promptData.systemPrompt, sectionConfig, currentUserQuery);
        return filteredPrompt;
      } catch (error) {
        console.warn('Dynamic Tools Registry failed, falling back to standard system message:', error);
        console.error('Dynamic Tools Registry error details:', error.message, error.stack);
      }
    } else {
      if (!dynamicToolsRegistryEnabled) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry disabled in settings, using fallback');
      } else if (!this.chatManager.dynamicToolsEnabled) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry not initialized, using fallback');
      } else if (!this.chatManager.dynamicTools) {
        console.log('🔧 [buildSystemMessage] Dynamic Tools Registry not available, using fallback');
      }
    }

    // For default system message, use optimized version by default
    // Apply section configuration
    const baseMessage = useOptimizedPrompt ? this.chatManager.getOptimizedSystemMessage() : this.chatManager.getBaseSystemMessage();

    // Add memory context if enabled in section config
    let memorySection = '';
    if (sectionConfig.toggles.memoryContext) {
      const memoryContext = await this.chatManager.getMemoryContext(currentUserQuery);
      memorySection = memoryContext ? `\n\n[Memory Context]\n${memoryContext}` : '';
    }

    return `${baseMessage}${memorySection}`;
  }

  /**
   * Apply section configuration to a dynamically generated system prompt.
   * Filters out disabled sections and reorders them based on user configuration.
   * @param {string} prompt - The original system prompt
   * @param {object} sectionConfig - Section configuration with toggles and order
   * @param {string} userQuery - Current user query for memory context
   * @returns {Promise<string>} - Filtered and reordered system prompt
   */
  async applySystemPromptSectionConfig(prompt, sectionConfig, userQuery) {
    const { order, toggles } = sectionConfig;

    // Parse the dynamic prompt into sections by markdown headers
    const sections = this.chatManager.parseSystemPromptSections(prompt);

    // Filter and reorder sections based on configuration
    const orderedSections = [];
    for (const sectionKey of order) {
      if (!toggles[sectionKey]) continue; // Skip disabled sections

      const sectionContent = this.chatManager.mapSectionKeyToContent(sectionKey, sections);
      if (sectionContent) {
        orderedSections.push(sectionContent);
      }
    }

    // Add any sections from the original prompt that weren't mapped
    for (const [header, content] of Object.entries(sections)) {
      const isMapped = this.chatManager.mapHeaderToSectionKey(header);
      if (!isMapped || !toggles[isMapped]) continue;
      // Already included above
    }

    // Add memory context if enabled
    if (toggles.memoryContext) {
      const memoryContext = await this.chatManager.getMemoryContext(userQuery);
      if (memoryContext) {
        orderedSections.push(`## Memory Context\n\n${memoryContext}`);
      }
    }

    return orderedSections.join('\n\n');
  }

  getCurrentContext() {
    // Build comprehensive context for the LLM

    // Collect all available tools from different sources
    const localTools = [
      // Core Navigation & State
      'navigate_to_position',
      'get_current_state',
      'get_current_region',
      'jump_to_gene',
      'select_gene',
      'select_sequence_region',
      'open_new_tab',
      'scroll_left',
      'scroll_right',
      'zoom_in',
      'zoom_out',
      'zoom_to_gene',
      'bookmark_position',
      'get_bookmarks',
      'save_view_state',

      // Search & Discovery
      'search_features',
      'find_gene_by_name',
      'search_by_position',
      'search_motif',
      'search_pattern',
      'search_sequence_motif',
      'search_intergenic_regions',
      'get_nearby_features',
      'find_intergenic_regions',

      // Sequence Analysis
      'get_sequence',
      'translate_sequence',
      'translate_dna',
      'calculate_gc_content',
      'compute_gc',
      'calc_region_gc',
      'reverse_complement',
      'sequence_statistics',
      'codon_usage_analysis',
      'analyze_codon_usage',
      'calculate_entropy',
      'calculate_melting_temp',
      'calculate_molecular_weight',

      // Advanced Analysis
      'analyze_region',
      'compare_regions',
      'find_similar_sequences',
      'find_restriction_sites',
      'virtual_digest',
      'predict_promoter',
      'predict_rbs',
      'predict_terminator',
      'get_upstream_region',
      'get_downstream_region',

      // Annotation & Features
      'get_gene_details',
      'get_operons',
      'create_annotation',
      'add_annotation',
      'edit_annotation',
      'delete_annotation',
      'batch_create_annotations',
      'merge_annotations',

      // Track Management
      'toggle_track',
      'get_track_status',
      'add_track',
      'add_variant',

      // Data Export/Import
      'export_data',
      'export_region_features',
      'get_file_info',
      'get_chromosome_list',
      'get_genome_info',

      // BLAST & External Analysis
      'blast_search',
      'blast_sequence_from_region',
      'get_blast_databases',
      'batch_blast_search',
      'advanced_blast_search',
      'local_blast_database_info',

      // Protein Structure
      'open_protein_viewer',
      'fetch_protein_structure',
      'search_pdb_structures',
      'search_alphafold_structures',
      'get_pdb_details',

      // Metabolic Pathways
      'show_metabolic_pathway',
      'find_pathway_genes',

      // Action Manager - Sequence Editing
      'copy_sequence',
      'cut_sequence',
      'paste_sequence',
      'delete_sequence',
      'delete_gene',
      'insert_sequence',
      'replace_sequence',
      'get_action_list',
      'execute_actions',
      'clear_actions',
      'get_clipboard_content',

      // System & File Management
      'set_working_directory',
      'list_available_tools',
      'download_internet_file',
      'toggle_settings_modal',
    ];

    // Add plugin functions if available
    const pluginTools = [];
    if (this.chatManager.pluginFunctionCallsIntegrator) {
      try {
        const pluginFunctions = Array.from(this.chatManager.pluginFunctionCallsIntegrator.pluginFunctionMap.keys());
        pluginTools.push(...pluginFunctions);
      } catch (error) {
        // Silently handle error
      }
    }

    // Add MCP tools if available
    const mcpTools = [];
    if (this.chatManager.mcpServerManager) {
      try {
        const allMcpTools = this.chatManager.mcpServerManager.getAllAvailableTools();
        mcpTools.push(...allMcpTools.map(tool => tool.name));
      } catch (error) {
        // Silently handle error
      }
    }

    // Combine all tools and remove duplicates
    const allAvailableTools = [...new Set([...localTools, ...pluginTools, ...mcpTools])];

    const context = {
      genomeBrowser: {
        currentState: this.chatManager.getCurrentState(),
        availableTools: allAvailableTools,
        toolSources: {
          local: localTools.length,
          plugins: pluginTools.length,
          mcp: mcpTools.length,
          total: allAvailableTools.length,
        },
      },
    };

    return context;
  }

  /**
   * Extract Deep Gene Research report from various MCP response formats
   * Handles: content arrays, direct report fields, raw text, and other structures
   * @param {*} resultData - The raw result data from MCP tool execution
   * @returns {Object} Normalized structure with report, geneSymbol, steps, and statistics
   */
  extractDeepGeneResearchReport(resultData) {
    let report = '';
    let geneSymbol = 'Unknown';
    let stepsCount = 0;
    let statistics = { totalCitations: 0, processedPapers: 0 };
    let images = [];
    let sources = [];

    try {
      // First pass: extract the primary content/data object
      let parsedData = resultData;

      // Handle: string input
      if (typeof resultData === 'string') {
        try {
          parsedData = JSON.parse(resultData);
        } catch (e) {
          // It's a raw string, use it as report for now
          report = resultData;
        }
      }

      // Handle: standard MCP "content" array
      if (parsedData.content && Array.isArray(parsedData.content)) {
        // Combine text parts
        const textContent = parsedData.content
          .filter(item => item.type === 'text' && item.text)
          .map(item => item.text)
          .join('\n\n');

        // Extract images and resources
        parsedData.content.forEach(item => {
          if (item.type === 'image' && item.data) images.push(item);
          if (item.type === 'resource' && item.resource) sources.push(item.resource);
        });

        // Check if the extracted text is actually a JSON string (Nested JSON case)
        if (textContent.trim().startsWith('{')) {
          try {
            const innerJson = JSON.parse(textContent);
            parsedData = innerJson; // Switch to using the inner JSON object
          } catch (e) {
            report = textContent; // Use text as report if not valid JSON
          }
        } else {
          report = textContent;
        }
      }
      // Handle: "result" wrapper (e.g., JSON-RPC style)
      else if (parsedData.result) {
        if (parsedData.result.content && Array.isArray(parsedData.result.content)) {
          // Similar logic for result.content
          const textContent = parsedData.result.content
            .filter(item => item.type === 'text' && item.text)
            .map(item => item.text)
            .join('\n\n');

          if (textContent.trim().startsWith('{')) {
            try {
              parsedData = JSON.parse(textContent);
            } catch (e) {
              report = textContent;
            }
          } else {
            report = textContent;
          }
        } else {
          parsedData = parsedData.result;
        }
      }
      // Handle: "text" field wrapper
      else if (parsedData.text) {
        if (parsedData.text.trim().startsWith('{')) {
          try {
            parsedData = JSON.parse(parsedData.text);
          } catch (e) {
            report = parsedData.text;
          }
        } else {
          report = parsedData.text;
        }
      }

      // --- Phase 2: Extract Data from the Resolved Object (parsedData) ---

      // 1. Extract Gene Symbol
      if (
        parsedData.workflow &&
        parsedData.workflow.geneIdentification &&
        parsedData.workflow.geneIdentification.geneSymbol
      ) {
        geneSymbol = parsedData.workflow.geneIdentification.geneSymbol;
      } else if (parsedData.metadata && parsedData.metadata.geneSymbol) {
        geneSymbol = parsedData.metadata.geneSymbol;
      } else if (parsedData.geneSymbol) {
        geneSymbol = parsedData.geneSymbol;
      } else if (parsedData.searchResults && parsedData.searchResults[0] && parsedData.searchResults[0].symbol) {
        geneSymbol = parsedData.searchResults[0].symbol;
      }

      // Fallback: Regex extraction if still unknown and we have text content
      // Ensure report is a string before regex operations
      if (geneSymbol === 'Unknown' && report && typeof report === 'string') {
        const patterns = [
          /gene[:\s]+\*?\*?([A-Za-z][A-Za-z0-9_-]{1,20})\*?\*?/i,
          /\*\*([A-Za-z][A-Za-z0-9_-]{1,20})\*\*\s+gene/i,
          /analysis\s+of\s+(?:the\s+)?([A-Za-z][A-Za-z0-9_-]{1,20})\s+gene/i,
        ];
        for (const pattern of patterns) {
          const match = report.match(pattern);
          if (match && match[1]) {
            // Validate to ensure it's not a common word like "repression"
            // Simple heuristic: exact match or reasonable gene format
            if (match[1].length <= 10) {
              geneSymbol = match[1];
              break;
            }
          }
        }
      }

      // 2. Extract/Construct Report Content
      if (parsedData.report) {
        report = parsedData.report;
      } else if (!report) {
        // If we don't have a direct report string yet, construct one from available fields
        let builtReport = '';

        if (geneSymbol !== 'Unknown') {
          builtReport += `# Deep Gene Research: ${geneSymbol}\n\n`;
        }

        if (parsedData.researchPlan) {
          builtReport += `## Research Plan\n\n${parsedData.researchPlan}\n\n`;
        }

        if (parsedData.researchGoal) {
          builtReport += `## Research Goal\n\n${parsedData.researchGoal}\n\n`;
        }

        if (parsedData.workflow) {
          builtReport += `## Workflow Configuration\n\n`;
          if (parsedData.workflow.organism) builtReport += `- **Organism**: ${parsedData.workflow.organism}\n`;
          if (parsedData.workflow.specificAspects && parsedData.workflow.specificAspects.length) {
            builtReport += `- **Focus Aspects**: ${parsedData.workflow.specificAspects.join(', ')}\n`;
          }
          builtReport += '\n';
        }

        if (parsedData.searchTasks && Array.isArray(parsedData.searchTasks)) {
          builtReport += `## Search Tasks\n\n`;
          parsedData.searchTasks.forEach((task, idx) => {
            builtReport += `${idx + 1}. ${task.query || task}\n`;
          });
          builtReport += '\n';
        }

        // If we constructed something meaningful, use it
        if (builtReport.length > 50) {
          report = builtReport;
        } else if (typeof parsedData === 'object') {
          // Ultima ratio: dump the object as markdown code block
          report = '## Raw Data Output\n\n```json\n' + JSON.stringify(parsedData, null, 2) + '\n```';
        }
      }

      // 3. Extract Statistics
      if (parsedData.statistics) {
        statistics.totalCitations = parsedData.statistics.totalCitations || parsedData.statistics.citations || 0;
        statistics.processedPapers = parsedData.statistics.processedPapers || parsedData.statistics.papers || 0;
      } else if (report && typeof report === 'string') {
        const doiMatches = report.match(/DOI:\s*[0-9.\/a-zA-Z-]+/gi);
        const pmidMatches = report.match(/PMID:\s*[0-9]+/gi);
        statistics.totalCitations = (doiMatches ? doiMatches.length : 0) + (pmidMatches ? pmidMatches.length : 0);
      }

      // 4. Extract Steps Count
      if (parsedData.workflow && parsedData.workflow.steps) {
        stepsCount = parsedData.workflow.steps.length;
      } else if (parsedData.steps) {
        stepsCount = Array.isArray(parsedData.steps) ? parsedData.steps.length : parsedData.steps;
      } else if (parsedData.searchTasks) {
        stepsCount = parsedData.searchTasks.length;
      }

      // 5. Extract Sources
      if (parsedData.sources) sources = sources.concat(parsedData.sources);
      if (parsedData.references) sources = sources.concat(parsedData.references);
    } catch (error) {
      console.error('Error extracting Deep Gene Research report:', error);
      // Emergency fallback
      if (!report && typeof resultData === 'string') report = resultData;
      else if (!report) report = JSON.stringify(resultData, null, 2);
    }

    return { report, geneSymbol, stepsCount, statistics, images, sources };
  }

  /**
   * 格式化工具结果数据显示
   */
  formatToolResultData(data) {
    if (!data) return 'No data available';

    try {
      // 如果是字符串，尝试解析为JSON
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // 如果不是JSON，直接显示字符串
          return `<pre>${this.escapeHtml(data)}</pre>`;
        }
      }

      // 如果是数组
      if (Array.isArray(data)) {
        if (data.length === 0) {
          return '<em>Empty array</em>';
        }

        // 如果数组元素是对象，创建表格
        if (typeof data[0] === 'object' && data[0] !== null) {
          return this.formatArrayAsTable(data);
        } else {
          return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
        }
      }

      // 如果是对象
      if (typeof data === 'object' && data !== null) {
        return this.formatObjectAsKeyValue(data);
      }

      // 其他类型直接显示
      return `<pre>${String(data)}</pre>`;
    } catch (error) {
      console.warn('Error formatting tool result data:', error);
      return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
  }

  /**
   * 将数组格式化为表格
   */
  formatArrayAsTable(array) {
    if (array.length === 0) return '<em>Empty array</em>';

    const sample = array[0];
    const keys = Object.keys(sample);

    let table = '<table style="width: 100%; border-collapse: collapse; margin: 4px 0;">';

    // 表头
    table += '<thead><tr>';
    keys.forEach(key => {
      table += `<th style="border: 1px solid #ddd; padding: 4px 8px; background: #f0f0f0; text-align: left;">${this.escapeHtml(key)}</th>`;
    });
    table += '</tr></thead>';

    // 表体
    table += '<tbody>';
    array.slice(0, 100).forEach(item => {
      // 限制显示前100行
      table += '<tr>';
      keys.forEach(key => {
        const value = item[key];
        const displayValue = value !== null && value !== undefined ? String(value) : '';
        table += `<td style="border: 1px solid #ddd; padding: 4px 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${this.escapeHtml(displayValue)}">${this.escapeHtml(displayValue)}</td>`;
      });
      table += '</tr>';
    });
    table += '</tbody>';
    table += '</table>';

    if (array.length > 100) {
      table += `<div style="margin-top: 8px; color: #666; font-size: 0.8em;">... and ${array.length - 100} more items</div>`;
    }

    return table;
  }

  /**
   * 将对象格式化为键值对
   */
  formatObjectAsKeyValue(obj) {
    let html = '<div style="font-family: monospace;">';

    for (const [key, value] of Object.entries(obj)) {
      html += '<div style="margin: 4px 0; padding: 2px 0; border-bottom: 1px solid #eee;">';
      html += `<strong style="color: #2196F3;">${this.escapeHtml(key)}:</strong> `;

      if (value === null || value === undefined) {
        html += '<em style="color: #999;">null</em>';
      } else if (typeof value === 'object') {
        // 递归处理嵌套对象，但限制深度
        html += '<br><div style="margin-left: 16px; font-size: 0.9em;">';
        if (Array.isArray(value)) {
          html += `<em>Array(${value.length})</em>: `;
          if (value.length <= 5) {
            html += JSON.stringify(value);
          } else {
            html += `[${value
              .slice(0, 3)
              .map(v => JSON.stringify(v))
              .join(', ')}, ... ${value.length - 3} more]`;
          }
        } else {
          const keys = Object.keys(value);
          html += `<em>Object(${keys.length} keys)</em>: {${keys.slice(0, 3).join(', ')}${keys.length > 3 ? ', ...' : ''}}`;
        }
        html += '</div>';
      } else if (typeof value === 'string' && value.length > 100) {
        // 长字符串截断显示
        html += `<span title="${this.escapeHtml(value)}">${this.escapeHtml(value.substring(0, 100))}...</span>`;
      } else {
        html += this.escapeHtml(String(value));
      }

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * HTML转义
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

window.LLMInteractionService = LLMInteractionService;
