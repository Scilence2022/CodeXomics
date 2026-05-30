// @ts-check
/**
 * IntentParserService - Extracted from ChatManager
 *
 * Parses LLM text responses to extract tool call JSON objects.
 * Handles mixed content (text + JSON), markdown code fences,
 * and DeepSeek-style <think> tags.
 *
 * Parsing strategy (ordered by robustness):
 * 1. Strip <think> tags, code fences, whitespace
 * 2. Try direct JSON.parse on entire cleaned response
 * 3. Brace-counting extraction of ALL balanced {...} blocks
 * 4. Validate each candidate for tool_name + parameters
 */
class IntentParserService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  /**
   * Clean LLM response by stripping think tags, code fences, and whitespace.
   * @param {string} response
   * @returns {string}
   */
  _cleanResponse(response) {
    let clean = response.trim();

    // Strip DeepSeek-style <think>...</think> tags
    // Match both complete tags and unclosed <think> (some models omit </think>)
    const thinkRegex = /<think>[\s\S]*?<\/think>/g;
    clean = clean.replace(thinkRegex, '').trim();

    // Handle unclosed <think> tag (model returned <think> but no </think>)
    if (clean.includes('<think>')) {
      const thinkStart = clean.lastIndexOf('<think>');
      const afterThink = clean.substring(thinkStart + 7).trim();
      // If there's a </think> after this <think>, the regex above should have caught it
      // This handles the case where </think> is missing — assume rest of response is thinking
      // and look for content after a blank line or the JSON start
      const jsonStart = afterThink.indexOf('{');
      if (jsonStart !== -1) {
        clean = afterThink.substring(jsonStart).trim();
      } else {
        clean = afterThink;
      }
    }

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    clean = clean.replace(/```json\s*/gi, '').replace(/\s*```/g, '');
    clean = clean.replace(/```\s*/g, '').trim();

    return clean;
  }

  /**
   * Extract all balanced JSON objects from a string using brace counting.
   * Each candidate is a substring from a '{' to its matching '}'.
   * @param {string} text
   * @returns {string[]} Array of JSON candidate strings
   */
  _extractBalancedJsonBlocks(text) {
    const blocks = [];
    let index = 0;

    while (index < text.length) {
      const start = text.indexOf('{', index);
      if (start === -1) break;

      let braceCount = 0;
      let end = start;
      let inString = false;
      let escapeNext = false;

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

        if (!inString) {
          if (ch === '{') braceCount++;
          if (ch === '}') braceCount--;
          if (braceCount === 0) {
            end = i;
            break;
          }
        }
      }

      if (braceCount === 0) {
        const candidate = text.substring(start, end + 1);
        blocks.push(candidate);
        index = end + 1;
      } else {
        index = start + 1;
      }
    }

    return blocks;
  }

  /**
   * Fix known malformed parameters (e.g., set_working_directory path issues).
   * @param {object} parsed
   * @returns {object}
   */
  _fixMalformedParameters(parsed) {
    if (parsed.tool_name === 'set_working_directory' && typeof parsed.parameters === 'object') {
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
    return parsed;
  }

  /**
   * Validate that a parsed object is a valid tool call.
   * @param {any} obj
   * @returns {boolean}
   */
  _isValidToolCall(obj) {
    return obj && typeof obj === 'object' && typeof obj.tool_name === 'string' && obj.parameters !== undefined;
  }

  parseToolCall(response) {
    if (response === null || response === undefined) {
      return null;
    }

    try {
      const cleanResponse = this._cleanResponse(response);

      if (!cleanResponse) {
        return null;
      }

      // Strategy 1: Try direct JSON.parse on entire cleaned response (fastest path)
      try {
        const parsed = JSON.parse(cleanResponse);
        if (this._isValidToolCall(parsed)) {
          return this._fixMalformedParameters(parsed);
        }
      } catch (e) {
        // Not pure JSON — continue to extraction
      }

      // Strategy 2: Extract ALL balanced {...} blocks and validate each
      const blocks = this._extractBalancedJsonBlocks(cleanResponse);
      for (const block of blocks) {
        try {
          const parsed = JSON.parse(block);
          if (this._isValidToolCall(parsed)) {
            return this._fixMalformedParameters(parsed);
          }
        } catch (e) {
          // Not valid JSON — skip
        }
      }

      return null;
    } catch (error) {
      console.error('=== parseToolCall ERROR ===');
      console.error('Error:', error);
      console.error('Stack:', error.stack);
      console.error('=======================');
      return null;
    }
  }

  parseMultipleToolCalls(response) {
    const toolCalls = [];

    try {
      const cleanResponse = this._cleanResponse(response);

      if (!cleanResponse) {
        return toolCalls;
      }

      // Clean up residual 'json' text between objects
      let normalized = cleanResponse
        .replace(/}\s*json\s*{/g, '}\n{')
        .replace(/^json\s*/, '')
        .replace(/\s*json\s*$/, '')
        .replace(/}\s*json\s*/g, '}\n')
        .replace(/\s*json\s*{/g, '\n{');

      // Try to parse as array first
      if (normalized.startsWith('[')) {
        try {
          const parsedArray = JSON.parse(normalized);
          if (Array.isArray(parsedArray)) {
            const validTools = parsedArray.filter(item => this._isValidToolCall(item));
            if (validTools.length > 0) {
              return validTools.map(t => this._fixMalformedParameters(t));
            }
          }
        } catch (e) {
          // Continue to extraction
        }
      }

      // Extract all balanced JSON blocks using brace counting
      const blocks = this._extractBalancedJsonBlocks(normalized);
      for (const block of blocks) {
        try {
          const parsed = JSON.parse(block);
          if (this._isValidToolCall(parsed)) {
            toolCalls.push(this._fixMalformedParameters(parsed));
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    } catch (error) {
      // Continue with empty toolCalls array
    }

    return toolCalls;
  }
}

window.IntentParserService = IntentParserService;
