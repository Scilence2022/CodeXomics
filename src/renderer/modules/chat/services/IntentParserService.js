// @ts-check
/**
 * IntentParserService - Extracted from ChatManager
 *
 * Normalizes assistant responses from text-only and native tool-calling APIs.
 * The public parseToolCall()/parseMultipleToolCalls() methods remain as
 * compatibility helpers; analyzeResponse() is the canonical parsing path.
 */
class IntentParserService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  /**
   * Remove complete reasoning blocks. Tool-looking JSON inside these blocks is
   * intentionally never considered executable protocol output.
   * @param {string} response
   * @returns {string}
   */
  _stripCompleteThinkBlocks(response) {
    return (
      response
        .replace(/<(think|analysis|reasoning)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
        // An unterminated reasoning block is incomplete protocol output. Never
        // mine executable-looking JSON from it; the outer loop can request a
        // clean continuation instead.
        .replace(/<(?:think|analysis|reasoning)\b[^>]*>[\s\S]*$/i, '')
    );
  }

  /**
   * Clean a text response for whole-value JSON parsing.
   * @param {string} response
   * @returns {string}
   */
  _cleanResponse(response) {
    if (typeof response !== 'string') {
      return '';
    }

    const clean = this._stripCompleteThinkBlocks(response).trim();

    return clean
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
  }

  /**
   * Extract all balanced JSON object/array values and their source ranges.
   * @param {string} text
   * @returns {Array<{text: string, start: number, end: number}>}
   */
  _extractBalancedJsonValues(text) {
    const values = [];
    let index = 0;

    while (index < text.length) {
      const objectStart = text.indexOf('{', index);
      const arrayStart = text.indexOf('[', index);
      const possibleStarts = [objectStart, arrayStart].filter(start => start !== -1);
      if (possibleStarts.length === 0) break;

      const start = Math.min(...possibleStarts);
      const stack = [];
      let inString = false;
      let escapeNext = false;
      let end = -1;

      for (let i = start; i < text.length; i++) {
        const ch = text[i];

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (ch === '\\' && inString) {
          escapeNext = true;
          continue;
        }

        if (ch === '"') {
          inString = !inString;
          continue;
        }

        if (inString) continue;

        if (ch === '{' || ch === '[') {
          stack.push(ch);
          continue;
        }

        if (ch === '}' || ch === ']') {
          const expectedOpen = ch === '}' ? '{' : '[';
          if (stack[stack.length - 1] !== expectedOpen) {
            break;
          }
          stack.pop();
          if (stack.length === 0) {
            end = i;
            break;
          }
        }
      }

      if (end !== -1) {
        values.push({ text: text.substring(start, end + 1), start, end });
        index = end + 1;
      } else {
        index = start + 1;
      }
    }

    return values;
  }

  /**
   * Extract all balanced JSON objects from a string using brace counting.
   * Kept for compatibility with existing callers and tests.
   * @param {string} text
   * @returns {string[]}
   */
  _extractBalancedJsonBlocks(text) {
    return this._extractBalancedJsonValues(text)
      .filter(candidate => candidate.text.startsWith('{'))
      .map(candidate => candidate.text);
  }

  /**
   * Fix known provider/model parameter drift.
   * @param {object} parsed
   * @returns {object}
   */
  _fixMalformedParameters(parsed) {
    if (!parsed || typeof parsed !== 'object' || !parsed.parameters || typeof parsed.parameters !== 'object') {
      return parsed;
    }

    if (parsed.tool_name === 'set_working_directory') {
      const paramKeys = Object.keys(parsed.parameters);
      if (
        paramKeys.length === 1 &&
        !paramKeys.includes('directory_path') &&
        !paramKeys.includes('use_home_directory')
      ) {
        const pathValue = paramKeys[0];
        if (pathValue.startsWith('/') || pathValue.startsWith('~') || pathValue.includes('\\')) {
          parsed.parameters = { directory_path: pathValue };
        }
      }
    }

    // The registry parameter is `name`, while some models infer gene_name or
    // geneName from the natural-language request (for example, lysC).
    if (parsed.tool_name === 'find_gene_by_name' && !Object.prototype.hasOwnProperty.call(parsed.parameters, 'name')) {
      const alias = Object.prototype.hasOwnProperty.call(parsed.parameters, 'gene_name')
        ? 'gene_name'
        : Object.prototype.hasOwnProperty.call(parsed.parameters, 'geneName')
          ? 'geneName'
          : null;
      if (alias) {
        parsed.parameters = { ...parsed.parameters, name: parsed.parameters[alias] };
        delete parsed.parameters[alias];
      }
    }

    const camelCaseGeneTools = ['select_gene', 'jump_to_gene', 'zoom_to_gene'];
    if (
      camelCaseGeneTools.includes(parsed.tool_name) &&
      !Object.prototype.hasOwnProperty.call(parsed.parameters, 'geneName')
    ) {
      const alias = Object.prototype.hasOwnProperty.call(parsed.parameters, 'gene_name')
        ? 'gene_name'
        : Object.prototype.hasOwnProperty.call(parsed.parameters, 'name')
          ? 'name'
          : null;
      if (alias) {
        parsed.parameters = { ...parsed.parameters, geneName: parsed.parameters[alias] };
        delete parsed.parameters[alias];
      }
    }

    return parsed;
  }

  /**
   * Validate the normalized internal tool-call contract.
   * @param {any} obj
   * @returns {boolean}
   */
  _isValidToolCall(obj) {
    return obj && typeof obj === 'object' && typeof obj.tool_name === 'string' && obj.parameters !== undefined;
  }

  /**
   * @param {any} value
   * @returns {boolean}
   */
  _hasOwn(value, key) {
    return value !== null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key);
  }

  /**
   * Detect objects which are intended to be tool calls, including malformed
   * calls that should be surfaced instead of treated as ordinary prose.
   * @param {any} candidate
   * @param {string} sourceHint
   * @returns {boolean}
   */
  _looksLikeToolCandidate(candidate, sourceHint) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;

    const type = typeof candidate.type === 'string' ? candidate.type.toLowerCase() : '';
    return (
      this._hasOwn(candidate, 'tool_name') ||
      this._hasOwn(candidate, 'function') ||
      type === 'function' ||
      type === 'function_call' ||
      type === 'tool_use' ||
      (this._hasOwn(candidate, 'name') && this._hasOwn(candidate, 'arguments')) ||
      (sourceHint === 'gemini' && this._hasOwn(candidate, 'name'))
    );
  }

  /**
   * Detect a tool-call candidate inside a text-decoded JSON value without
   * treating arbitrary data objects (for example { text, content }) as response
   * envelopes.
   * @param {any} value
   * @param {string} sourceHint
   * @returns {boolean}
   */
  _containsToolCandidate(value, sourceHint = 'plain') {
    if (!value || typeof value !== 'object') return false;
    if (Array.isArray(value)) {
      return value.some(item => this._containsToolCandidate(item, sourceHint));
    }
    if (this._looksLikeToolCandidate(value, sourceHint)) return true;

    return Object.entries(value).some(([key, child]) => {
      if (!child || typeof child !== 'object') return false;
      const childSource = key === 'functionCall' || key === 'parts' ? 'gemini' : sourceHint;
      return this._containsToolCandidate(child, childSource);
    });
  }

  /**
   * Text-decoded JSON is executable only when the top-level value itself is a
   * call (or an array made entirely of calls). This prevents arbitrary data
   * wrappers such as {example: {name, arguments}} from becoming executable.
   * @param {any} value
   * @param {string} sourceHint
   * @returns {boolean}
   */
  _isTopLevelTextToolPayload(value, sourceHint = 'plain') {
    if (Array.isArray(value)) {
      return value.length > 0 && value.every(item => this._looksLikeToolCandidate(item, sourceHint));
    }
    return this._looksLikeToolCandidate(value, sourceHint);
  }

  /**
   * Detect structured/native protocol fields before visiting any visible text.
   * When they exist, native calls are authoritative and JSON-looking prose is
   * left visible rather than mined as a second call channel.
   * @param {any} value
   * @param {WeakSet<object>} [seen]
   * @returns {boolean}
   */
  _hasStructuredToolProtocol(value, seen = new WeakSet()) {
    if (!value || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    if (Array.isArray(value)) return value.some(item => this._hasStructuredToolProtocol(item, seen));
    if (this._looksLikeToolCandidate(value, 'structured')) return true;
    if (
      this._hasOwn(value, 'tool_calls') ||
      this._hasOwn(value, 'function_call') ||
      this._hasOwn(value, 'functionCall')
    ) {
      return true;
    }
    return Object.values(value).some(child => this._hasStructuredToolProtocol(child, seen));
  }

  /**
   * Mixed prose plus executable JSON is accepted only as a tail-positioned
   * action announcement. Explanatory examples remain ordinary visible text.
   * @param {string} response
   * @param {{start: number, end: number}} range
   * @param {Array<{start: number, end: number}>} [toolCandidateRanges]
   * @returns {boolean}
   */
  _isTrustedEmbeddedToolCandidate(response, range, toolCandidateRanges = []) {
    if (
      /\b(?:do\s+not|don(?:'|’)t|never)\s+(?:execute|run|call|invoke|use)\b|\b(?:not\s+executable|for\s+reference\s+only|untrusted\s+payload)\b/i.test(
        response
      )
    ) {
      return false;
    }
    const explanatoryPreamble =
      /\b(?:for\s+example|e\.g\.|examples?|example\s+(?:call|payload|response)|sample\s+(?:call|payload|response)|could\s+emit|would\s+look\s+like|here\s+is\s+(?:a|the)\s+(?:tool\s+)?(?:call|example)|such\s+as)\b/i.test(
        response
      );
    if (explanatoryPreamble) return false;

    const trailing = response
      .substring(range.end + 1)
      .replace(/```/g, '')
      .replace(/^\s*json\s*/i, '')
      .trim();
    if (trailing === '' || toolCandidateRanges.length > 1) return true;

    const preamble = response
      .substring(0, range.start)
      .replace(/```(?:json)?\s*/gi, '')
      .trim();
    if (preamble === '') return true;

    const englishActionAnnouncement =
      /\b(?:i(?:'|’)ll|i\s+will|let\s+me|i(?:'|’)m\s+going\s+to|i\s+need\s+to|i\s+can\s+start\s+by|first,?\s+i)\b[\s\S]{0,240}\b(?:use|call|search|find|locate|select|navigate|open|load|fetch|run|calculate|analy[sz]e|check|retrieve|execute)/i.test(
        preamble
      );
    const chineseActionAnnouncement =
      /(我会|我将|让我|接下来|首先).{0,80}(使用|调用|搜索|查找|定位|选择|导航|打开|加载|运行|计算|分析|执行)/.test(
        preamble
      );
    return englishActionAnnouncement || chineseActionAnnouncement;
  }

  /**
   * Parse provider arguments into the object expected by local tool execution.
   * @param {any} rawArguments
   * @param {boolean} hasArguments
   * @returns {{valid: boolean, parameters?: object, reason?: string}}
   */
  _normalizeArguments(rawArguments, hasArguments) {
    if (!hasArguments) {
      return { valid: false, reason: 'Tool call is missing arguments' };
    }

    let parsedArguments = rawArguments;
    if (typeof rawArguments === 'string') {
      if (rawArguments.trim() === '') {
        parsedArguments = {};
      } else {
        try {
          parsedArguments = JSON.parse(rawArguments);
        } catch (error) {
          return { valid: false, reason: `Tool arguments are not valid JSON: ${error.message}` };
        }
      }
    }

    if (parsedArguments === null) {
      parsedArguments = {};
    }

    if (typeof parsedArguments !== 'object' || Array.isArray(parsedArguments)) {
      return { valid: false, reason: 'Tool arguments must decode to an object' };
    }

    return { valid: true, parameters: { ...parsedArguments } };
  }

  /**
   * Normalize one native or text-derived provider tool call.
   * @param {any} candidate
   * @param {string} sourceHint
   * @param {{id?: any, callId?: any}} [metadata]
   * @returns {{toolCall?: object, invalid?: object}}
   */
  _normalizeToolCall(candidate, sourceHint = 'structured', metadata = {}) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return {
        invalid: {
          source: sourceHint,
          reason: 'Tool-call candidate must be an object',
          candidate,
        },
      };
    }

    const type = typeof candidate.type === 'string' ? candidate.type.toLowerCase() : '';
    let name;
    let rawArguments;
    let hasArguments = false;
    let source = sourceHint;

    if (this._hasOwn(candidate, 'tool_name')) {
      name = candidate.tool_name;
      rawArguments = candidate.parameters;
      hasArguments = this._hasOwn(candidate, 'parameters');
      source = typeof candidate.source === 'string' ? candidate.source : 'internal';
    } else if (type === 'tool_use') {
      name = candidate.name;
      rawArguments = candidate.input;
      hasArguments = this._hasOwn(candidate, 'input');
      source = 'anthropic';
    } else if (candidate.function && typeof candidate.function === 'object') {
      name = candidate.function.name;
      rawArguments = candidate.function.arguments;
      hasArguments = this._hasOwn(candidate.function, 'arguments');
      source = 'openai';
    } else if (type === 'function') {
      name = candidate.name;
      rawArguments = candidate.arguments;
      hasArguments = this._hasOwn(candidate, 'arguments');
      source = 'openai';
    } else if (type === 'function_call') {
      name = candidate.name;
      rawArguments = candidate.arguments;
      hasArguments = this._hasOwn(candidate, 'arguments');
      source = 'openai-responses';
    } else {
      name = candidate.name;
      if (this._hasOwn(candidate, 'arguments')) {
        rawArguments = candidate.arguments;
        hasArguments = true;
      } else if (sourceHint === 'gemini' && this._hasOwn(candidate, 'args')) {
        rawArguments = candidate.args;
        hasArguments = true;
      } else if (sourceHint === 'gemini') {
        // Gemini omits args for zero-parameter function declarations.
        rawArguments = {};
        hasArguments = true;
      }
      source = ['openai', 'anthropic', 'gemini'].includes(sourceHint) ? sourceHint : 'plain';
    }

    if (typeof candidate.source === 'string') source = candidate.source;

    const id = candidate.id ?? candidate.call_id ?? candidate.tool_call_id ?? metadata.id ?? metadata.callId;
    if (typeof name !== 'string' || name.trim() === '') {
      return {
        invalid: {
          ...(id !== undefined ? { id } : {}),
          source,
          reason: 'Tool call is missing a valid name',
          candidate,
        },
      };
    }

    const normalizedArguments = this._normalizeArguments(rawArguments, hasArguments);
    if (!normalizedArguments.valid) {
      return {
        invalid: {
          ...(id !== undefined ? { id } : {}),
          source,
          tool_name: name,
          reason: normalizedArguments.reason,
          candidate,
        },
      };
    }

    const toolCall = this._fixMalformedParameters({
      tool_name: name,
      parameters: normalizedArguments.parameters,
      ...(id !== undefined ? { id } : {}),
      source,
    });
    return { toolCall };
  }

  /**
   * @param {any} candidate
   * @param {object} state
   * @param {string} sourceHint
   * @param {{id?: any, callId?: any}} [metadata]
   */
  _recordToolCandidate(candidate, state, sourceHint, metadata = {}) {
    state.protocolDetected = true;
    const normalized = this._normalizeToolCall(candidate, sourceHint, metadata);
    if (normalized.toolCall) {
      state.toolCalls.push(normalized.toolCall);
    } else if (normalized.invalid) {
      state.invalidToolCalls.push(normalized.invalid);
    }
  }

  /**
   * @param {object} state
   * @returns {object}
   */
  _responseStateSnapshot(state) {
    return {
      textCount: state.textParts.length,
      toolCount: state.toolCalls.length,
      invalidCount: state.invalidToolCalls.length,
      finishReason: state.finishReason,
      stopReason: state.stopReason,
      protocolDetected: state.protocolDetected,
    };
  }

  /**
   * @param {object} before
   * @param {object} state
   * @returns {boolean}
   */
  _responseStateChanged(before, state) {
    return (
      before.textCount !== state.textParts.length ||
      before.toolCount !== state.toolCalls.length ||
      before.invalidCount !== state.invalidToolCalls.length ||
      before.finishReason !== state.finishReason ||
      before.stopReason !== state.stopReason ||
      before.protocolDetected !== state.protocolDetected
    );
  }

  /**
   * Parse visible prose while retaining compatibility with JSON tool calls
   * embedded after conversational text.
   * @param {string} text
   * @param {object} state
   * @param {string} sourceHint
   */
  _analyzeTextContent(text, state, sourceHint) {
    for (const match of text.matchAll(/<(think|analysis|reasoning)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) {
      const reasoning = match[2].trim();
      if (reasoning) state.reasoningParts.push(reasoning);
    }
    const lowerText = text.toLowerCase();
    for (const tagName of ['think', 'analysis', 'reasoning']) {
      const lastStart = lowerText.lastIndexOf(`<${tagName}`);
      const lastEnd = lowerText.lastIndexOf(`</${tagName}`);
      if (lastStart > lastEnd) {
        const openingTagEnd = text.indexOf('>', lastStart);
        const unterminatedReasoning = openingTagEnd === -1 ? '' : text.substring(openingTagEnd + 1).trim();
        if (unterminatedReasoning) state.reasoningParts.push(unterminatedReasoning);
      }
    }

    const visibleResponse = this._stripCompleteThinkBlocks(text).trim();
    if (!visibleResponse) return;

    const cleanedResponse = this._cleanResponse(visibleResponse);
    if (state.allowTextToolCalls && cleanedResponse) {
      try {
        const parsed = JSON.parse(cleanedResponse);
        if (this._isTopLevelTextToolPayload(parsed, sourceHint)) {
          const before = this._responseStateSnapshot(state);
          this._collectResponseParts(parsed, state, sourceHint);
          if (this._responseStateChanged(before, state)) return;
        }
      } catch (error) {
        // Mixed prose or malformed JSON; continue with balanced-value extraction.
      }
    }

    const protocolRanges = [];
    const parsedToolCandidates = [];
    for (const value of state.allowTextToolCalls ? this._extractBalancedJsonValues(visibleResponse) : []) {
      try {
        const parsed = JSON.parse(value.text);
        if (this._isTopLevelTextToolPayload(parsed, sourceHint)) {
          parsedToolCandidates.push({ ...value, parsed });
        }
      } catch (error) {
        // A balanced substring is not necessarily valid JSON.
      }
    }

    for (const value of parsedToolCandidates) {
      try {
        if (!this._isTrustedEmbeddedToolCandidate(visibleResponse, value, parsedToolCandidates)) continue;
        const before = this._responseStateSnapshot(state);
        this._collectResponseParts(value.parsed, state, sourceHint);
        if (this._responseStateChanged(before, state)) {
          protocolRanges.push({ start: value.start, end: value.end });
        }
      } catch (error) {
        // A balanced substring is not necessarily valid JSON.
      }
    }

    let displayText = visibleResponse;
    if (protocolRanges.length > 0) {
      for (const range of protocolRanges.reverse()) {
        displayText = `${displayText.substring(0, range.start)}${displayText.substring(range.end + 1)}`;
      }
      displayText = displayText
        .replace(/```(?:json)?\s*/gi, '')
        .replace(/\s*```/g, '')
        .replace(/(^|\s)json(?=\s|$)/gi, '$1');
    }

    displayText = displayText.trim();
    if (displayText) state.textParts.push(displayText);
  }

  /**
   * Recursively visit provider response wrappers and content blocks.
   * @param {any} value
   * @param {object} state
   * @param {string} sourceHint
   */
  _collectResponseParts(value, state, sourceHint = 'structured') {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      this._analyzeTextContent(value, state, sourceHint);
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        this._collectResponseParts(item, state, sourceHint);
      }
      return;
    }

    if (typeof value !== 'object') return;
    if (state.seen.has(value)) return;
    state.seen.add(value);

    const blockType = typeof value.type === 'string' ? value.type.toLowerCase() : '';
    if (
      value.thought === true ||
      ['thinking', 'reasoning', 'analysis'].some(
        reasoningType =>
          blockType === reasoningType ||
          blockType.startsWith(`${reasoningType}.`) ||
          blockType.startsWith(`${reasoningType}_`) ||
          blockType.startsWith(`${reasoningType}-`)
      )
    ) {
      const reasoning = value.thinking || value.text || value.content || value.summary;
      if (typeof reasoning === 'string' && reasoning.trim()) {
        state.reasoningParts.push(reasoning.trim());
      }
      return;
    }

    if (state.finishReason === null) {
      state.finishReason = value.finish_reason ?? value.finishReason ?? null;
    }
    if (state.stopReason === null) {
      state.stopReason = value.stop_reason ?? value.stopReason ?? null;
    }

    if (this._looksLikeToolCandidate(value, sourceHint)) {
      this._recordToolCandidate(value, state, sourceHint);
      return;
    }

    const textKeys = new Set(['content', 'text', 'output_text', 'refusal', 'completion']);
    for (const [key, child] of Object.entries(value)) {
      if (['finish_reason', 'finishReason', 'stop_reason', 'stopReason'].includes(key)) continue;
      if (['reasoning', 'reasoning_content', 'reasoning_details', 'thinking', 'analysis'].includes(key)) continue;

      if (key === 'refusal' && child) {
        state.refusalDetected = true;
      }

      if (key === 'function_call') {
        state.protocolDetected = true;
        this._recordToolCandidate(child, state, 'openai', {
          id: value.id ?? value.tool_call_id,
        });
        continue;
      }

      if (key === 'functionCall') {
        state.protocolDetected = true;
        this._recordToolCandidate(child, state, 'gemini', { id: value.id });
        continue;
      }

      if (key === 'tool_calls') state.protocolDetected = true;

      let childSource = sourceHint;
      if (key === 'tool_calls') childSource = 'openai';
      if (key === 'output') childSource = 'openai-responses';
      if (key === 'candidates' || key === 'parts') childSource = 'gemini';
      if (value.type === 'message' && key === 'content' && sourceHint === 'structured') {
        childSource = 'anthropic';
      }

      if (typeof child === 'string') {
        if (textKeys.has(key)) this._analyzeTextContent(child, state, childSource);
      } else if (child && typeof child === 'object') {
        this._collectResponseParts(child, state, childSource);
      }
    }
  }

  /**
   * Analyze text or a provider-native response object in one pass.
   *
   * @param {any} response
   * @param {{allowTextToolCalls?: boolean}} [options]
   * @returns {{
   *   displayText: string,
   *   toolCalls: object[],
   *   invalidToolCalls: object[],
   *   invalidCandidates: object[],
   *   finishReason: any,
   *   stopReason: any,
   *   terminationReason: any,
   *   isEmpty: boolean,
   *   hasProtocolContent: boolean,
   *   isProtocolOnly: boolean
   * }}
   */
  analyzeResponse(response, options = {}) {
    const hasStructuredToolProtocol = this._hasStructuredToolProtocol(response);
    const state = {
      textParts: [],
      reasoningParts: [],
      toolCalls: [],
      invalidToolCalls: [],
      finishReason: null,
      stopReason: null,
      protocolDetected: false,
      refusalDetected: false,
      allowTextToolCalls: options.allowTextToolCalls !== false && !hasStructuredToolProtocol,
      seen: new WeakSet(),
    };

    try {
      this._collectResponseParts(response, state);
    } catch (error) {
      console.error('IntentParserService.analyzeResponse failed:', error);
    }

    const displayText = state.textParts
      .map(part => part.trim())
      .filter(Boolean)
      .join('\n\n')
      .trim();
    const reasoningText = Array.from(new Set(state.reasoningParts.map(part => part.trim()).filter(Boolean)))
      .join('\n\n')
      .trim();
    const hasProtocolContent = state.protocolDetected || state.finishReason !== null || state.stopReason !== null;
    const isEmpty = displayText === '' && state.toolCalls.length === 0 && state.invalidToolCalls.length === 0;

    return {
      displayText,
      reasoningText,
      toolCalls: state.toolCalls,
      invalidToolCalls: state.invalidToolCalls,
      invalidCandidates: state.invalidToolCalls,
      finishReason: state.finishReason,
      stopReason: state.stopReason,
      terminationReason: state.stopReason ?? state.finishReason,
      isRefusal: state.refusalDetected,
      isEmpty,
      hasProtocolContent,
      isProtocolOnly: displayText === '' && hasProtocolContent,
    };
  }

  /**
   * Return the first normalized tool call for legacy callers.
   * @param {any} response
   * @returns {object|null}
   */
  parseToolCall(response) {
    return this.analyzeResponse(response).toolCalls[0] || null;
  }

  /**
   * Return every normalized tool call for legacy callers.
   * @param {any} response
   * @returns {object[]}
   */
  parseMultipleToolCalls(response) {
    return this.analyzeResponse(response).toolCalls;
  }
}

window.IntentParserService = IntentParserService;
