/**
 * LLMReasoningProfiles - which models expose a thinking control, and how the
 * ChatBox thinking level maps onto each provider's request.
 *
 * The ChatBox stores one provider-neutral level (`chatboxReasoningEffort`):
 *   default — send nothing; the model's own default applies
 *   off     — ask for no thinking, where the model allows that
 *   low / medium / high — ask for that much thinking
 *
 * Providers spell this in very different ways, and some models refuse some
 * levels outright, so a level a model does not support is ignored rather than
 * sent. Everything here is pure: callers pass a payload and get it back
 * adjusted, which keeps the request paths in LLMConfigManager single.
 */

const REASONING_LEVELS = ['default', 'off', 'low', 'medium', 'high'];
const THINKING_LEVELS = ['low', 'medium', 'high'];

/**
 * Output-token floor while thinking is on. Thinking tokens count against the
 * output limit on every provider here, and the ChatBox default (4000) leaves
 * almost nothing for the answer once a model has reasoned. Kept at or under
 * 16384 so it stays within the output cap of the smaller hosted models.
 */
const THINKING_OUTPUT_FLOOR = { low: 8192, medium: 12288, high: 16384 };

/** Token budgets for providers that size thinking in tokens rather than levels. */
const THINKING_BUDGET = { low: 2048, medium: 4096, high: 8192 };

/** Room left for the visible answer and tool call above a thinking budget. */
const ANSWER_HEADROOM_TOKENS = 4096;

class LLMReasoningProfiles {
  static get LEVELS() {
    return [...REASONING_LEVELS];
  }

  static normalizeLevel(level) {
    const value = String(level || '')
      .trim()
      .toLowerCase();
    return REASONING_LEVELS.includes(value) ? value : 'default';
  }

  static isThinkingLevel(level) {
    return THINKING_LEVELS.includes(level);
  }

  /**
   * Parse a Claude model id. The API uses dashes ("claude-sonnet-4-6"), older
   * ids carry a date suffix, and saved configurations or OpenRouter slugs may
   * use dots ("claude-sonnet-4.6").
   * @returns {{family: string, version: number}|null}
   */
  static parseClaudeModel(model) {
    const id = String(model || '')
      .toLowerCase()
      .replace(/\./g, '-');
    if (/claude-3-7-sonnet/.test(id)) return { family: 'sonnet', version: 3.7 };
    const match = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:-(\d{1,2}))?(?!\d)/.exec(id);
    if (!match) return null;
    const minor = match[3] ? Number(match[3]) : 0;
    return { family: match[1], version: Number(match[2]) + minor / 10 };
  }

  /**
   * Claude thinking rules, by model generation:
   * - 4.6 and later take adaptive thinking with an effort level. Whether
   *   thinking can be turned off, and how, differs per model; on 4.7 and later
   *   sampling parameters are rejected (Sonnet / Haiku 5.5 reject non-default
   *   values), so temperature is never sent there.
   * - Earlier thinking models (3.7 Sonnet, the 4.0–4.5 line, Haiku 4.5) take
   *   an explicit token budget.
   */
  static getAnthropicProfile(model) {
    const parsed = LLMReasoningProfiles.parseClaudeModel(model);
    if (!parsed) return null;
    const { family, version } = parsed;

    if (family === 'fable' || family === 'mythos') {
      return { style: 'adaptive', offMode: null, temperature: false, display: true };
    }
    if (version >= 4.6) {
      let offMode = null;
      if (family === 'opus') {
        if (version < 4.9) offMode = 'omit';
        else if (version < 5.5) offMode = 'disabled';
      } else if (family === 'sonnet') {
        if (version < 5) offMode = 'omit';
        else if (version < 5.5) offMode = 'disabled';
        else if (version < 6) offMode = 'between_tools';
      } else if (family === 'haiku' && version < 6) {
        offMode = 'disabled';
      }
      return {
        style: 'adaptive',
        offMode,
        temperature: version < 4.7,
        // The display field arrived with the models that default it to "omitted".
        display: version >= 4.7,
      };
    }
    if (version >= 3.7) {
      return { style: 'budget', offMode: 'omit', temperature: true, display: false };
    }
    return null;
  }

  static getGoogleProfile(model) {
    const id = String(model || '').toLowerCase();
    const match = /gemini-(\d+)(?:\.(\d+))?/.exec(id);
    if (!match) return null;
    const version = Number(match[1]) + (match[2] ? Number(match[2]) / 10 : 0);
    const isFlash = /flash/.test(id);
    if (version >= 3) return { style: 'level', canTurnOff: isFlash };
    if (version >= 2.5) return { style: 'budget', canTurnOff: isFlash };
    return null;
  }

  static isOpenAIReasoningModel(model) {
    const id = String(model || '')
      .toLowerCase()
      .replace(/^openai\//, '');
    if (!/^(o\d|gpt-5)/.test(id)) return false;
    return !/(instant|chat-latest|realtime|audio|transcribe|tts|search|whisper|translate)/.test(id);
  }

  static isSiliconFlowHybridModel(model) {
    const id = String(model || '').toLowerCase();
    if (/qwen3/.test(id)) return !/(instruct|thinking|coder|embedding|reranker|-vl)/.test(id);
    return /deepseek-v3\.[12]|deepseek-v4|glm-4\.[5-9]|glm-[5-9]/.test(id);
  }

  static getOpenAIProfile(providerKey, model) {
    if (!LLMReasoningProfiles.isOpenAIReasoningModel(model)) return null;
    return {
      provider: providerKey,
      style: 'openai-effort',
      levels: [...THINKING_LEVELS],
      note: 'Reasoning models always think; the level sets the reasoning effort.',
    };
  }

  /**
   * DeepSeek's thinking mode: `thinking: {type}` turns it on or off and
   * `reasoning_effort` sets its depth (measured on deepseek-v4.1-flash: low,
   * medium and high used about 600, 880 and 2100 reasoning tokens on the same
   * problem). deepseek-reasoner always thinks, so it has no Off.
   */
  static getDeepSeekProfile(providerKey, model) {
    const id = String(model || '').toLowerCase();
    if (!/deepseek/.test(id)) return null;
    const alwaysThinks = /reasoner/.test(id);
    return {
      provider: providerKey,
      style: 'deepseek',
      levels: alwaysThinks ? [...THINKING_LEVELS] : ['off', ...THINKING_LEVELS],
      note: alwaysThinks
        ? 'This model always thinks; the level sets the reasoning effort.'
        : 'Off turns thinking off; low, medium and high set the reasoning effort.',
    };
  }

  /**
   * What thinking control a model offers, or null when it has none the app can
   * set (fixed-thinking models such as deepseek-reasoner or MiniMax M2, local
   * endpoints, non-reasoning models).
   * @returns {{provider: string, style: string, levels: string[], note: string, [key: string]: any}|null}
   */
  static getProfile(providerKey, model) {
    switch (providerKey) {
      case 'anthropic': {
        const profile = LLMReasoningProfiles.getAnthropicProfile(model);
        if (!profile) return null;
        return {
          provider: providerKey,
          ...profile,
          levels: profile.offMode ? ['off', ...THINKING_LEVELS] : [...THINKING_LEVELS],
          note: profile.offMode ? '' : 'This model always thinks; the level sets how much.',
        };
      }
      case 'google': {
        const profile = LLMReasoningProfiles.getGoogleProfile(model);
        if (!profile) return null;
        return {
          provider: providerKey,
          ...profile,
          levels: profile.canTurnOff ? ['off', ...THINKING_LEVELS] : [...THINKING_LEVELS],
          note: profile.canTurnOff ? '' : 'This model always thinks; the level sets how much.',
        };
      }
      case 'openai':
        return LLMReasoningProfiles.getOpenAIProfile(providerKey, model);
      case 'zhongkeyu':
        // A relay serving several model families with the OpenAI request shape;
        // it forwards each family's own thinking parameters (verified for
        // DeepSeek V4: `thinking` and `reasoning_effort` both take effect).
        return (
          LLMReasoningProfiles.getDeepSeekProfile(providerKey, model) ||
          LLMReasoningProfiles.getOpenAIProfile(providerKey, model)
        );
      case 'openrouter':
        return {
          provider: providerKey,
          style: 'openrouter',
          levels: ['off', ...THINKING_LEVELS],
          note: 'OpenRouter applies this to models that support reasoning and ignores it elsewhere.',
        };
      case 'deepseek':
        return LLMReasoningProfiles.getDeepSeekProfile(providerKey, model);
      case 'siliconflow':
        if (!LLMReasoningProfiles.isSiliconFlowHybridModel(model)) return null;
        return {
          provider: providerKey,
          style: 'siliconflow',
          levels: ['off', ...THINKING_LEVELS],
          note: '',
        };
      default:
        return null;
    }
  }

  /**
   * The level a request should actually apply: the stored level when the model
   * supports it, otherwise 'default' (send nothing).
   */
  static resolveLevel(providerKey, model, level) {
    const normalized = LLMReasoningProfiles.normalizeLevel(level);
    if (normalized === 'default') return 'default';
    const profile = LLMReasoningProfiles.getProfile(providerKey, model);
    return profile && profile.levels.includes(normalized) ? normalized : 'default';
  }

  /** Output tokens a request needs at this level, given the configured limit. */
  static getOutputTokens(providerKey, model, level, baseTokens) {
    const base = Number.isFinite(baseTokens) ? baseTokens : 0;
    const resolved = LLMReasoningProfiles.resolveLevel(providerKey, model, level);
    if (!LLMReasoningProfiles.isThinkingLevel(resolved)) return base;
    let floor = THINKING_OUTPUT_FLOOR[resolved];
    const profile = LLMReasoningProfiles.getProfile(providerKey, model);
    if (profile?.style === 'budget' || profile?.style === 'siliconflow') {
      floor = Math.max(floor, THINKING_BUDGET[resolved] + ANSWER_HEADROOM_TOKENS);
    }
    return Math.max(base, floor);
  }

  /**
   * Adjust an OpenAI /chat/completions payload in place.
   * @returns {string} the level applied
   */
  static applyToOpenAICompatiblePayload(providerKey, payload, level) {
    const model = payload?.model;
    const resolved = LLMReasoningProfiles.resolveLevel(providerKey, model, level);
    if (resolved === 'default') return resolved;
    const profile = LLMReasoningProfiles.getProfile(providerKey, model);
    const thinking = LLMReasoningProfiles.isThinkingLevel(resolved);
    const outputTokens = LLMReasoningProfiles.getOutputTokens(providerKey, model, resolved, payload.max_tokens);

    switch (profile.style) {
      case 'openai-effort':
        payload.reasoning_effort = resolved;
        if (providerKey === 'openai') {
          // OpenAI reasoning models take max_completion_tokens (which covers the
          // reasoning tokens) and reject a non-default temperature.
          payload.max_completion_tokens = outputTokens;
          delete payload.max_tokens;
          delete payload.temperature;
          return resolved;
        }
        break;
      case 'openrouter':
        payload.reasoning = thinking ? { effort: resolved } : { enabled: false };
        break;
      case 'deepseek':
        payload.thinking = { type: thinking ? 'enabled' : 'disabled' };
        if (thinking) payload.reasoning_effort = resolved;
        break;
      case 'siliconflow':
        payload.enable_thinking = thinking;
        if (thinking) payload.thinking_budget = THINKING_BUDGET[resolved];
        break;
      default:
        return 'default';
    }
    if (thinking) payload.max_tokens = outputTokens;
    return resolved;
  }

  /**
   * Adjust an Anthropic Messages payload in place. Also drops temperature on the
   * models that reject sampling parameters, whatever the level.
   * @param {object} payload
   * @param {string} level
   * @returns {string} the level applied
   */
  static applyToAnthropicPayload(payload, level) {
    const profile = LLMReasoningProfiles.getAnthropicProfile(payload?.model);
    if (!profile) return 'default';
    if (!profile.temperature) delete payload.temperature;

    const resolved = LLMReasoningProfiles.resolveLevel('anthropic', payload.model, level);
    if (resolved === 'default') return resolved;

    if (resolved === 'off') {
      if (profile.offMode === 'disabled' || profile.offMode === 'between_tools') {
        payload.thinking = { type: profile.offMode };
      }
      return resolved;
    }

    // Thinking allows only automatic tool choice.
    const toolChoice = payload.tool_choice?.type;
    if (toolChoice && toolChoice !== 'auto' && toolChoice !== 'none') return 'default';

    if (profile.style === 'budget') {
      // A budget-thinking request continuing a tool loop must open the last
      // assistant turn with its thinking block. A turn produced without one
      // (thinking was off, another provider answered, the replay was dropped)
      // cannot be continued with thinking on, so this round runs without it.
      if (LLMReasoningProfiles.continuesToolTurnWithoutThinking(payload.messages)) return 'default';
      payload.thinking = { type: 'enabled', budget_tokens: THINKING_BUDGET[resolved] };
    } else {
      payload.thinking = profile.display ? { type: 'adaptive', display: 'summarized' } : { type: 'adaptive' };
      payload.output_config = { ...(payload.output_config || {}), effort: resolved };
    }
    delete payload.temperature;
    payload.max_tokens = LLMReasoningProfiles.getOutputTokens('anthropic', payload.model, resolved, payload.max_tokens);
    return resolved;
  }

  /**
   * True when the Anthropic messages end in tool results answering an
   * assistant turn that carries no thinking block.
   */
  static continuesToolTurnWithoutThinking(messages = []) {
    const last = messages[messages.length - 1];
    const lastContent = Array.isArray(last?.content) ? last.content : [];
    if (last?.role !== 'user' || !lastContent.some(block => block?.type === 'tool_result')) return false;
    for (let index = messages.length - 2; index >= 0; index--) {
      const message = messages[index];
      if (message?.role !== 'assistant') continue;
      const blocks = Array.isArray(message.content) ? message.content : [];
      return !blocks.some(block => block?.type === 'thinking' || block?.type === 'redacted_thinking');
    }
    return false;
  }

  /**
   * Adjust a Gemini generateContent payload in place.
   * @returns {string} the level applied
   */
  static applyToGooglePayload(payload, model, level) {
    const profile = LLMReasoningProfiles.getGoogleProfile(model);
    const resolved = LLMReasoningProfiles.resolveLevel('google', model, level);
    if (!profile || resolved === 'default') return 'default';

    const generationConfig = payload.generationConfig || (payload.generationConfig = {});
    if (resolved === 'off') {
      generationConfig.thinkingConfig =
        profile.style === 'level' ? { thinkingLevel: 'minimal' } : { thinkingBudget: 0 };
      return resolved;
    }
    generationConfig.thinkingConfig =
      profile.style === 'level'
        ? { thinkingLevel: resolved, includeThoughts: true }
        : { thinkingBudget: THINKING_BUDGET[resolved], includeThoughts: true };
    generationConfig.maxOutputTokens = LLMReasoningProfiles.getOutputTokens(
      'google',
      model,
      resolved,
      generationConfig.maxOutputTokens
    );
    return resolved;
  }
}

if (typeof window !== 'undefined') {
  window.LLMReasoningProfiles = LLMReasoningProfiles;
}

if (typeof globalThis !== 'undefined') {
  globalThis.LLMReasoningProfiles = LLMReasoningProfiles;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LLMReasoningProfiles;
}
