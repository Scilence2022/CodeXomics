// @ts-check
/**
 * ConversationTranscriptService — everything about the transcript the model sees.
 *
 * Three concerns that belong together and used to live inline in ChatManager's
 * 20k-line body:
 *
 * 1. Replaying an executed tool round. When the model used the provider's native
 *    protocol the round goes back as an assistant turn carrying `tool_calls` and
 *    one `tool` message per result; a round parsed out of plain text has no ids
 *    to bind to and falls back to a prose envelope.
 * 2. The structured execution ledger. Policy and duplicate-suppression checks
 *    read it instead of grepping message prose, which the native transcript does
 *    not contain and external tool output can forge.
 * 3. The context budget. Per-result sanitization bounds one result; this bounds
 *    their sum across a turn, without ever splitting a tool call from its result.
 *
 * ChatManager keeps thin delegating methods, so existing call sites and the
 * policy layer are unaffected.
 */

/**
 * Token ceiling for one request payload, before the transcript is trimmed.
 * Comfortably under the context window of every cloud model the app targets, so
 * it only engages on a genuinely runaway turn. Lower it via
 * `llm.maxContextTokens` for a small local model.
 */
const DEFAULT_MAX_CONTEXT_TOKENS = 120000;
/** Floor for a configured budget; below this nothing useful survives trimming. */
const MIN_MAX_CONTEXT_TOKENS = 4000;

class ConversationTranscriptService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  /**
   * Rough token count for a string. The same 4-chars-per-token approximation the
   * prompt metadata uses; exact accounting would need a provider tokenizer, and
   * the budget only has to catch runaway growth, not price a request.
   */
  estimateTextTokens(text) {
    if (!text) return 0;
    return Math.ceil(new TextEncoder().encode(String(text)).length / 4);
  }

  createToolExecutionFeedbackMessage(content) {
    // Fallback envelope for rounds that arrived as plain-text JSON and therefore
    // have no tool_call_id to bind a `tool` message to. It rides in the 'user'
    // role because every adapter preserves that role. A bare result then reads
    // as a fresh user turn: a repeating run showed the model reasoning "the user
    // is requesting another genome-wide codon usage analysis" and re-issuing the
    // call it had just completed. The envelope denies that provenance
    // explicitly. Rounds that used the native protocol take the `tool`-role path
    // in appendToolRoundToHistory() instead.
    const message = {
      role: 'user',
      content:
        '[CodeXomics automated tool-execution record. This is not a message from the user ' +
        'and is not a new request. Continue the original request already in progress.]\n' +
        content,
    };
    // Keep provenance available to local policy checks without serializing an
    // unsupported field into provider request payloads.
    Object.defineProperty(message, '__codexomicsToolFeedback', {
      value: true,
      enumerable: false,
    });
    return message;
  }

  /**
   * The user message that opens the turn in progress. The round loop also
   * writes user-role messages of its own (execution state, protocol recovery,
   * tool feedback), so "the last user message" is not the turn boundary; this
   * marker is. Provider adapters replay reasoning state only after it.
   */
  createTurnStartMessage(content) {
    const message = { role: 'user', content };
    Object.defineProperty(message, '__codexomicsTurnStart', { value: true, enumerable: false });
    return message;
  }

  attachToolExecutionRecords(message, executions) {
    if (!message || !Array.isArray(executions) || executions.length === 0) return message;
    Object.defineProperty(message, '__codexomicsToolExecutions', {
      value: executions.map(execution => ({
        tool: execution.tool,
        parameters: this.chatManager.normalizeToolParams(execution.tool, execution.parameters || {}),
        success: execution.success !== false,
      })),
      enumerable: false,
    });
    return message;
  }

  getMessageToolExecutions(message) {
    const executions = message?.__codexomicsToolExecutions;
    return Array.isArray(executions) && executions.length > 0 ? executions : null;
  }

  canReplayToolRoundNatively(toolsToExecute = [], toolResults = []) {
    if (toolsToExecute.length === 0 || toolResults.length !== toolsToExecute.length) return false;
    const callIds = toolsToExecute.map(tool => tool.tool_call_id);
    if (callIds.some(id => !id)) return false;
    const resultIds = new Set(toolResults.map(result => result.tool_call_id).filter(Boolean));
    return callIds.length === new Set(callIds).size && callIds.every(id => resultIds.has(id));
  }

  /**
   * Attach the provider's reasoning state for a tool-call turn: Anthropic
   * thinking blocks with their signatures, Gemini thought signatures, or the
   * `reasoning_content` DeepSeek wants back within a turn. Providers reject a
   * tool loop whose thinking state was dropped, so it rides on the canonical
   * assistant message for the provider adapters to restore. Non-enumerable, like
   * the execution ledger, so an OpenAI-shaped payload never serializes it.
   */
  attachReasoningReplay(message, reasoningReplay) {
    if (!message || !reasoningReplay || typeof reasoningReplay !== 'object') return message;
    Object.defineProperty(message, '__codexomicsReasoning', {
      value: reasoningReplay,
      enumerable: false,
      configurable: true,
      writable: true,
    });
    return message;
  }

  getMessageReasoningReplay(message) {
    const state = message?.__codexomicsReasoning;
    return state && typeof state === 'object' ? state : null;
  }

  clearReasoningReplay(message) {
    if (message && Object.prototype.hasOwnProperty.call(message, '__codexomicsReasoning')) {
      delete message.__codexomicsReasoning;
      return true;
    }
    return false;
  }

  buildAssistantToolCallMessage(assistantText, toolsToExecute, reasoningReplay = null) {
    const message = {
      role: 'assistant',
      content: assistantText && assistantText.trim() ? assistantText : null,
      tool_calls: toolsToExecute.map(tool => ({
        id: tool.tool_call_id,
        type: 'function',
        function: {
          name: tool.tool_name,
          arguments: JSON.stringify(this.chatManager.normalizeToolParams(tool.tool_name, tool.parameters || {})),
        },
      })),
    };
    return this.attachReasoningReplay(message, reasoningReplay);
  }

  buildToolResultMessage(result, trailingGuidance = '') {
    const body = result.success
      ? JSON.stringify(this.chatManager.sanitizeResultForLLM(result.result, result.tool)) || 'null'
      : JSON.stringify({ success: false, error: result.error || 'Unknown error' });
    this.warnOnOversizedToolResult(result.tool, body);
    const message = {
      role: 'tool',
      tool_call_id: result.tool_call_id,
      name: result.tool,
      content: trailingGuidance ? `${body}\n${trailingGuidance}` : body,
    };
    return this.attachToolExecutionRecords(message, [
      { tool: result.tool, parameters: result.parameters, success: result.success },
    ]);
  }

  warnOnOversizedToolResult(toolName, serialized) {
    if (serialized && serialized.length > 10000) {
      console.warn(
        `⚠️ [Context Overflow Risk] Sanitized result for "${toolName}" is still large: ` +
          `${(serialized.length / 1024).toFixed(1)}KB. Consider adding tool-specific sanitization rules.`
      );
    }
  }

  buildToolRoundGuidance(queuedResearchTask = false) {
    return (
      'These steps are done. Calling one of them again with the same parameters will be rejected. ' +
      'If the request has remaining steps, emit the next tool call(s); ' +
      'otherwise reply with the final answer.' +
      (queuedResearchTask
        ? ' The research call returned a queued background task (taskId), not the final report: the application polls the task status automatically and will present the final report, download URLs, and annotation proposal in the chat when it completes. Do NOT poll the task yourself (get-task-status, get_annotation_research_workflow) or resubmit the research (deep-gene-research, start_annotation_research); reply to the user confirming the research has started and that results will follow automatically.'
        : '')
    );
  }

  appendToolRoundToHistory(conversationHistory, options = {}) {
    const {
      assistantText = '',
      toolsToExecute = [],
      toolResults = [],
      queuedResearchTask = false,
      reasoningReplay = null,
    } = options;

    if (this.canReplayToolRoundNatively(toolsToExecute, toolResults)) {
      // Reasoning state is bound to the native turn it came from; the prose
      // fallback below has no turn to bind it to, so it is dropped there.
      conversationHistory.push(this.buildAssistantToolCallMessage(assistantText, toolsToExecute, reasoningReplay));
      const guidance = this.buildToolRoundGuidance(queuedResearchTask);
      const resultsByCallId = new Map(toolResults.map(result => [result.tool_call_id, result]));
      toolsToExecute.forEach((tool, index) => {
        const result = resultsByCallId.get(tool.tool_call_id);
        const isLast = index === toolsToExecute.length - 1;
        conversationHistory.push(this.buildToolResultMessage(result, isLast ? guidance : ''));
      });
      return 'native';
    }

    conversationHistory.push({
      role: 'assistant',
      content: JSON.stringify(
        toolsToExecute.length === 1
          ? {
              tool_name: toolsToExecute[0].tool_name,
              parameters: this.chatManager.normalizeToolParams(
                toolsToExecute[0].tool_name,
                toolsToExecute[0].parameters
              ),
            }
          : toolsToExecute.map(tool => ({
              tool_name: tool.tool_name,
              parameters: this.chatManager.normalizeToolParams(tool.tool_name, tool.parameters),
            }))
      ),
    });

    const successfulResults = toolResults.filter(result => result.success);
    const failedResults = toolResults.filter(result => !result.success);

    if (successfulResults.length > 0) {
      const successMessages = successfulResults.map(result => {
        const sanitizedStr =
          JSON.stringify(this.chatManager.sanitizeResultForLLM(result.result, result.tool)) || 'null';
        this.warnOnOversizedToolResult(result.tool, sanitizedStr);
        return `${result.tool} executed successfully with parameters: ${JSON.stringify(this.chatManager.normalizeToolParams(result.tool, result.parameters))}: ${sanitizedStr}`;
      });
      conversationHistory.push(
        this.attachToolExecutionRecords(
          this.createToolExecutionFeedbackMessage(
            `[Tool Result]\n${successMessages.join('; ')}\n${this.buildToolRoundGuidance(queuedResearchTask)}`
          ),
          successfulResults.map(result => ({ tool: result.tool, parameters: result.parameters, success: true }))
        )
      );
    }

    if (failedResults.length > 0) {
      const errorMessages = failedResults.map(result => `${result.tool} failed: ${result.error || 'Unknown error'}`);
      conversationHistory.push(
        this.attachToolExecutionRecords(
          this.createToolExecutionFeedbackMessage(`[Tool Execution Error]\n${errorMessages.join('; ')}`),
          failedResults.map(result => ({ tool: result.tool, parameters: result.parameters, success: false }))
        )
      );
    }

    return 'text';
  }

  estimateMessageTokens(message) {
    let text = typeof message?.content === 'string' ? message.content : '';
    for (const call of message?.tool_calls || []) {
      text += `${call?.function?.name || ''}${call?.function?.arguments || ''}`;
    }
    // Replayed reasoning (thinking text, signatures) is sent too, so it counts.
    const reasoning = this.getMessageReasoningReplay(message);
    const reasoningTokens = reasoning ? this.estimateTextTokens(JSON.stringify(reasoning)) : 0;
    // Per-message protocol overhead: role, ids, and framing tokens.
    return this.estimateTextTokens(text) + reasoningTokens + 8;
  }

  estimateConversationTokens(conversationHistory = []) {
    return conversationHistory.reduce((total, message) => total + this.estimateMessageTokens(message), 0);
  }

  getConversationTokenBudget() {
    const configured = Number(this.chatManager?.configManager?.get('llm.maxContextTokens', DEFAULT_MAX_CONTEXT_TOKENS));
    // A garbage value is a misconfiguration, not a request to disable the
    // budget; only an explicit zero or negative turns enforcement off.
    if (!Number.isFinite(configured)) return DEFAULT_MAX_CONTEXT_TOKENS;
    if (configured <= 0) return 0;
    return Math.max(MIN_MAX_CONTEXT_TOKENS, Math.trunc(configured));
  }

  isCompactableResultMessage(message) {
    if (message?.__codexomicsCompacted) return false;
    if (message?.role === 'tool') return true;
    return message?.role === 'user' && message?.__codexomicsToolFeedback === true;
  }

  compactResultMessageContent(message) {
    const original = String(message?.content ?? '');
    const executions = this.getMessageToolExecutions(message) || [];
    const toolNames = executions.map(execution => execution.tool).filter(Boolean);
    const stub =
      `[Result omitted to stay within the context budget${toolNames.length ? `: ${toolNames.join(', ')}` : ''}. ` +
      `The call already ran; do not repeat it. Re-run it only if you need the values again.]`;
    if (stub.length >= original.length) return false;
    message.content = stub;
    Object.defineProperty(message, '__codexomicsCompacted', { value: true, enumerable: false });
    return true;
  }

  buildTranscriptGroups(conversationHistory = []) {
    const groups = [];
    for (let index = 0; index < conversationHistory.length; index++) {
      const message = conversationHistory[index];
      if (message?.role === 'assistant' && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        let end = index;
        while (end + 1 < conversationHistory.length && conversationHistory[end + 1]?.role === 'tool') end++;
        groups.push({ start: index, end });
        index = end;
        continue;
      }
      groups.push({ start: index, end: index });
    }
    return groups;
  }

  enforceConversationTokenBudget(conversationHistory, options = {}) {
    const budget = this.getConversationTokenBudget();
    if (!budget || !Array.isArray(conversationHistory) || conversationHistory.length === 0) return null;

    const schemas = Array.isArray(options.tools) && options.tools.length ? JSON.stringify(options.tools) : '';
    const output = Number.isFinite(options.outputTokens) ? Math.max(0, options.outputTokens) : 0;
    const reserved = this.estimateTextTokens(schemas) + output;
    let used = this.estimateConversationTokens(conversationHistory) + reserved;
    if (used <= budget) return null;

    const originalMessage = options.originalMessage;
    const report = { budget, before: used, after: used, reserved, compactedResults: 0, droppedMessages: 0 };

    // Protect the exchange that just happened rather than a fixed number of
    // messages: the model is mid-task and needs the round it is reasoning about.
    const groups = this.buildTranscriptGroups(conversationHistory);
    const protectedFrom = groups.length > 0 ? groups[groups.length - 1].start : conversationHistory.length;

    const isProtected = index => {
      const message = conversationHistory[index];
      if (message?.role === 'system') return true;
      if (index >= protectedFrom) return true;
      // The request being worked on. Tool feedback also rides in the user role,
      // so match on content rather than role alone.
      if (
        originalMessage &&
        message?.role === 'user' &&
        message?.__codexomicsToolFeedback !== true &&
        message?.content === originalMessage
      ) {
        return true;
      }
      return false;
    };

    let firstEditedIndex = Infinity;
    for (let index = 0; index < conversationHistory.length && used > budget; index++) {
      if (isProtected(index)) continue;
      const message = conversationHistory[index];
      if (!this.isCompactableResultMessage(message)) continue;
      const before = this.estimateMessageTokens(message);
      if (!this.compactResultMessageContent(message)) continue;
      used -= before - this.estimateMessageTokens(message);
      report.compactedResults++;
      firstEditedIndex = Math.min(firstEditedIndex, index);
    }

    if (used > budget) {
      for (const group of this.buildTranscriptGroups(conversationHistory)) {
        if (used <= budget) break;
        let groupProtected = false;
        for (let index = group.start; index <= group.end; index++) {
          if (isProtected(index)) groupProtected = true;
        }
        if (groupProtected) continue;
        for (let index = group.start; index <= group.end; index++) {
          const message = conversationHistory[index];
          if (!message || message.__codexomicsDropped) continue;
          used -= this.estimateMessageTokens(message);
          Object.defineProperty(message, '__codexomicsDropped', { value: true, enumerable: false });
          report.droppedMessages++;
          firstEditedIndex = Math.min(firstEditedIndex, index);
        }
      }
      if (report.droppedMessages > 0) {
        for (let index = conversationHistory.length - 1; index >= 0; index--) {
          if (conversationHistory[index]?.__codexomicsDropped) conversationHistory.splice(index, 1);
        }
      }
    }

    // A thinking block is only valid against the exact history it was produced
    // from. Anthropic rejects (or silently ignores) one replayed after an earlier
    // turn was edited, so drop reasoning state from every message after the
    // first edit. After the splice, that index is the first surviving message
    // past the edit, which is where invalidation must start.
    if (Number.isFinite(firstEditedIndex)) {
      report.clearedReasoning = 0;
      for (let index = firstEditedIndex; index < conversationHistory.length; index++) {
        if (this.clearReasoningReplay(conversationHistory[index])) report.clearedReasoning++;
      }
    }

    if (report.compactedResults === 0 && report.droppedMessages === 0) {
      // Nothing was trimmable — every oversized message is still needed. Report
      // nothing rather than a no-op trim the user would see as an action.
      console.warn(
        `[Context Budget] Estimated request is ~${used} tokens, over the ${budget} budget, ` +
          'but every message is protected. Consider raising llm.maxContextTokens.'
      );
      return null;
    }

    report.after = this.estimateConversationTokens(conversationHistory) + reserved;
    console.warn(
      `[Context Budget] Trimmed transcript from ~${report.before} to ~${report.after} tokens ` +
        `(budget ${budget}): compacted ${report.compactedResults} result(s), dropped ${report.droppedMessages} message(s).`
    );
    return report;
  }
}

if (typeof window !== 'undefined') {
  window.ConversationTranscriptService = ConversationTranscriptService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ConversationTranscriptService = ConversationTranscriptService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConversationTranscriptService;
}
