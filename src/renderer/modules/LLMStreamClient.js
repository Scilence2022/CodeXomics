/**
 * LLMStreamClient
 *
 * Protocol layer for Server-Sent Events (SSE) streaming from LLM providers.
 *
 * Design contract: every accumulator in this module reassembles the *exact same
 * response shape the provider would have returned without `stream: true`. The
 * caller then feeds that object into the existing normalize*Response() methods
 * on LLMConfigManager, so streaming does not introduce a second response
 * contract and tool-call handling stays on one code path.
 *
 * Visible text is surfaced incrementally through the `onToken` callback, and
 * reasoning/chain-of-thought through `onReasoningToken`, while the full object
 * is being reassembled. The two sinks are kept separate because the caller
 * renders them in different places: answer text in the message bubble,
 * reasoning in the thinking panel.
 */
class LLMStreamClient {
  /**
   * Incremental SSE parser.
   *
   * Chunk boundaries from the network do not align with event boundaries, so
   * bytes are buffered until a blank line terminates an event. Returns a
   * `{ push, flush }` pair; both yield an array of `{ event, data }` records
   * where `data` is the raw (still unparsed) payload string.
   */
  static createSSEParser() {
    let buffer = '';

    const drain = (text, requireTerminator) => {
      buffer += text;
      const events = [];

      // Normalize CRLF/CR so a single '\n\n' scan finds every event boundary.
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      let separatorIndex;
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const parsed = LLMStreamClient.parseSSEBlock(rawEvent);
        if (parsed) events.push(parsed);
      }

      // On flush, a trailing event without its blank-line terminator is still
      // valid data — some providers close the socket without it.
      if (!requireTerminator && buffer.trim()) {
        const parsed = LLMStreamClient.parseSSEBlock(buffer);
        if (parsed) events.push(parsed);
        buffer = '';
      }

      return events;
    };

    return {
      push: text => drain(text, true),
      flush: () => drain('', false),
    };
  }

  /**
   * Parse one SSE block into `{ event, data }`. Multiple `data:` lines in a
   * single block are joined with newlines per the SSE specification.
   */
  static parseSSEBlock(rawEvent) {
    const dataLines = [];
    let eventName = null;

    for (const line of rawEvent.split('\n')) {
      if (!line || line.startsWith(':')) continue; // blank or comment/keep-alive
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }

    if (!dataLines.length && !eventName) return null;
    return { event: eventName, data: dataLines.join('\n') };
  }

  /**
   * Read a fetch Response body as SSE, invoking `onEvent({ event, data })` for
   * each complete event. Honors an AbortSignal by cancelling the reader.
   */
  static async readEventStream(response, onEvent, signal = null) {
    if (!response.body || typeof response.body.getReader !== 'function') {
      throw new Error('Streaming is not supported for this response (no readable body)');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = LLMStreamClient.createSSEParser();

    const abortHandler = () => {
      reader.cancel().catch(() => {});
    };
    if (signal) {
      if (signal.aborted) {
        await reader.cancel().catch(() => {});
        throw LLMStreamClient.createAbortError();
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          onEvent(event);
        }

        if (signal && signal.aborted) {
          throw LLMStreamClient.createAbortError();
        }
      }

      for (const event of parser.flush()) {
        onEvent(event);
      }
    } finally {
      if (signal) signal.removeEventListener('abort', abortHandler);
      reader.releaseLock?.();
    }
  }

  static createAbortError() {
    const error = new Error('AbortError');
    error.name = 'AbortError';
    return error;
  }

  /** `[DONE]` is OpenAI's stream terminator and is not JSON. */
  static isTerminator(data) {
    return data.trim() === '[DONE]';
  }

  static safeParse(data) {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /**
   * Reassemble an OpenAI Chat Completions stream into a non-streaming
   * `{ choices: [{ message, finish_reason }] }` envelope.
   *
   * Covers every OpenAI-compatible provider (OpenAI, DeepSeek, SiliconFlow,
   * OpenRouter, MiniMax, local runtimes).
   */
  static async streamOpenAICompatible(response, { onToken = null, onReasoningToken = null, signal = null } = {}) {
    let content = '';
    let reasoning = '';
    let role = 'assistant';
    let finishReason = null;
    let sawAnyChunk = false;
    // Keyed by the `index` field so out-of-order fragments still land correctly.
    const toolCalls = new Map();

    LLMStreamClient.readEventStreamSyncGuard(response);

    await LLMStreamClient.readEventStream(
      response,
      ({ data }) => {
        if (!data || LLMStreamClient.isTerminator(data)) return;
        const parsed = LLMStreamClient.safeParse(data);
        if (!parsed) return;

        if (parsed.error) {
          throw new Error(`Provider stream error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
        }

        const choice = parsed.choices?.[0];
        if (!choice) return;
        sawAnyChunk = true;

        const delta = choice.delta || {};
        if (delta.role) role = delta.role;

        if (typeof delta.content === 'string' && delta.content) {
          content += delta.content;
          if (onToken) onToken(delta.content);
        }

        // Reasoning models expose their chain-of-thought under varying keys.
        const reasoningDelta = delta.reasoning_content ?? delta.reasoning;
        if (typeof reasoningDelta === 'string' && reasoningDelta) {
          reasoning += reasoningDelta;
          if (onReasoningToken) onReasoningToken(reasoningDelta);
        }

        if (Array.isArray(delta.tool_calls)) {
          for (const fragment of delta.tool_calls) {
            const index = fragment.index ?? 0;
            if (!toolCalls.has(index)) {
              toolCalls.set(index, { id: '', type: 'function', function: { name: '', arguments: '' } });
            }
            const call = toolCalls.get(index);
            if (fragment.id) call.id = fragment.id;
            if (fragment.type) call.type = fragment.type;
            if (fragment.function?.name) call.function.name += fragment.function.name;
            if (typeof fragment.function?.arguments === 'string') {
              call.function.arguments += fragment.function.arguments;
            }
          }
        }

        if (choice.finish_reason) finishReason = choice.finish_reason;
      },
      signal
    );

    if (!sawAnyChunk) {
      throw new Error('Stream produced no usable chunks');
    }

    const message = { role, content: content || null };
    if (reasoning) message.reasoning_content = reasoning;
    if (toolCalls.size) {
      message.tool_calls = [...toolCalls.entries()].sort((a, b) => a[0] - b[0]).map(([, call]) => call);
    }

    return { choices: [{ message, finish_reason: finishReason }] };
  }

  /**
   * Reassemble an Anthropic Messages stream into a non-streaming
   * `{ content: [...blocks], stop_reason }` envelope.
   */
  static async streamAnthropic(response, { onToken = null, onReasoningToken = null, signal = null } = {}) {
    const blocks = new Map(); // index -> block being built
    const partialJson = new Map(); // index -> accumulated tool input JSON
    let envelope = { type: 'message', role: 'assistant', content: [] };
    let stopReason = null;
    let sawAnyChunk = false;

    await LLMStreamClient.readEventStream(
      response,
      ({ event, data }) => {
        if (!data) return;
        const parsed = LLMStreamClient.safeParse(data);
        if (!parsed) return;

        const type = event || parsed.type;

        switch (type) {
          case 'message_start':
            if (parsed.message) {
              envelope = { ...parsed.message, content: [] };
            }
            sawAnyChunk = true;
            break;

          case 'content_block_start': {
            const index = parsed.index ?? 0;
            blocks.set(index, { ...(parsed.content_block || {}) });
            if (parsed.content_block?.type === 'tool_use') partialJson.set(index, '');
            sawAnyChunk = true;
            break;
          }

          case 'content_block_delta': {
            const index = parsed.index ?? 0;
            const delta = parsed.delta || {};
            const block = blocks.get(index) || {};
            sawAnyChunk = true;

            if (delta.type === 'text_delta' && typeof delta.text === 'string') {
              block.type = block.type || 'text';
              block.text = (block.text || '') + delta.text;
              if (onToken) onToken(delta.text);
            } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
              block.type = block.type || 'thinking';
              block.thinking = (block.thinking || '') + delta.thinking;
              if (onReasoningToken && delta.thinking) onReasoningToken(delta.thinking);
            } else if (delta.type === 'signature_delta' && typeof delta.signature === 'string') {
              block.signature = (block.signature || '') + delta.signature;
            } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
              partialJson.set(index, (partialJson.get(index) || '') + delta.partial_json);
            }

            blocks.set(index, block);
            break;
          }

          case 'content_block_stop': {
            const index = parsed.index ?? 0;
            const block = blocks.get(index);
            if (block?.type === 'tool_use') {
              const raw = partialJson.get(index) || '';
              // An empty argument object legitimately streams as no deltas.
              block.input = raw.trim() ? (LLMStreamClient.safeParse(raw) ?? {}) : {};
              blocks.set(index, block);
            }
            break;
          }

          case 'message_delta':
            if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
            if (parsed.usage) envelope.usage = { ...(envelope.usage || {}), ...parsed.usage };
            break;

          case 'error':
            throw new Error(
              `Provider stream error: ${parsed.error?.message || JSON.stringify(parsed.error || parsed)}`
            );

          default:
            break; // ping, message_stop, and future event types need no handling
        }
      },
      signal
    );

    if (!sawAnyChunk) {
      throw new Error('Stream produced no usable chunks');
    }

    envelope.content = [...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, block]) => block);
    envelope.stop_reason = stopReason;
    return envelope;
  }

  /**
   * Reassemble a Gemini `streamGenerateContent?alt=sse` stream into a
   * non-streaming `{ candidates: [...] }` envelope.
   *
   * Gemini streams whole `parts` rather than fragments, so text parts are
   * concatenated while functionCall parts are appended verbatim.
   */
  static async streamGoogle(response, { onToken = null, onReasoningToken = null, signal = null } = {}) {
    let visibleText = '';
    let thoughtText = '';
    const functionCallParts = [];
    let finishReason = null;
    let usageMetadata = null;
    let sawAnyChunk = false;

    await LLMStreamClient.readEventStream(
      response,
      ({ data }) => {
        if (!data || LLMStreamClient.isTerminator(data)) return;
        const parsed = LLMStreamClient.safeParse(data);
        if (!parsed) return;

        if (parsed.error) {
          throw new Error(`Provider stream error: ${parsed.error.message || JSON.stringify(parsed.error)}`);
        }

        const candidate = parsed.candidates?.[0];
        if (parsed.usageMetadata) usageMetadata = parsed.usageMetadata;
        if (!candidate) return;
        sawAnyChunk = true;

        if (candidate.finishReason) finishReason = candidate.finishReason;

        for (const part of candidate.content?.parts || []) {
          if (part?.functionCall) {
            functionCallParts.push(part);
          } else if (typeof part?.text === 'string') {
            if (part.thought === true) {
              thoughtText += part.text;
              if (onReasoningToken && part.text) onReasoningToken(part.text);
            } else {
              visibleText += part.text;
              if (onToken) onToken(part.text);
            }
          }
        }
      },
      signal
    );

    if (!sawAnyChunk) {
      throw new Error('Stream produced no usable chunks');
    }

    const parts = [];
    if (thoughtText) parts.push({ text: thoughtText, thought: true });
    if (visibleText) parts.push({ text: visibleText });
    parts.push(...functionCallParts);

    const envelope = {
      candidates: [
        {
          content: { parts, role: 'model' },
          finishReason,
        },
      ],
    };
    if (usageMetadata) envelope.usageMetadata = usageMetadata;
    return envelope;
  }

  /**
   * Providers occasionally answer a streaming request with a plain JSON body
   * (for example when a gateway rejects `stream: true`). Detect that up front so
   * the caller can fall back instead of failing on an unparsable stream.
   */
  static isEventStream(response) {
    const contentType = response?.headers?.get?.('content-type') || '';
    return contentType.toLowerCase().includes('text/event-stream');
  }

  /** Reserved hook: validates the body is readable before consuming it. */
  static readEventStreamSyncGuard(response) {
    if (!response?.body) {
      throw new Error('Streaming is not supported for this response (no readable body)');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMStreamClient;
}
