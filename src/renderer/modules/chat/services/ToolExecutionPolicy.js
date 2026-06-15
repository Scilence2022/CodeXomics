// @ts-check
/**
 * ToolExecutionPolicy applies hardcoded AI tool execution rules.
 */
class ToolExecutionPolicy {
  constructor(options = {}) {
    const CapabilityPolicyClass =
      options.CapabilityPolicyClass ||
      (typeof window !== 'undefined' && window.ToolCapabilityPolicy) ||
      (typeof globalThis !== 'undefined' && globalThis.ToolCapabilityPolicy);

    if (!CapabilityPolicyClass) {
      throw new Error('ToolCapabilityPolicy is required before ToolExecutionPolicy');
    }

    this.chatManager = options.chatManager || null;
    this.normalizeToolParams =
      typeof options.normalizeToolParams === 'function'
        ? options.normalizeToolParams
        : (toolName, parameters = {}) => this.defaultNormalizeToolParams(toolName, parameters);
    this.getDocument =
      typeof options.getDocument === 'function'
        ? options.getDocument
        : () => (typeof document !== 'undefined' ? document : null);
    this.capabilityPolicy = options.capabilityPolicy || new CapabilityPolicyClass();
  }

  defaultNormalizeParams(params) {
    if (!params || typeof params !== 'object') return {};
    const sorted = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        const val = params[key];
        if (val !== undefined) {
          sorted[key] = val && typeof val === 'object' ? this.defaultNormalizeParams(val) : val;
        }
      });

    if (sorted.primerSequence && (!sorted.sequence || sorted.sequence === sorted.primerSequence)) {
      sorted.sequence = sorted.primerSequence;
      delete sorted.primerSequence;
    }

    return sorted;
  }

  defaultNormalizeToolParams(toolName, parameters = {}) {
    const normalized = this.defaultNormalizeParams(parameters);

    if (toolName === 'design_primers') {
      const hasResolvedTarget =
        normalized.geneName ||
        (normalized.chromosome && (normalized.start !== undefined || normalized.end !== undefined));
      if (hasResolvedTarget) {
        delete normalized.targetSequence;
        delete normalized.targetMetadata;
      }
    }

    if (toolName === 'find_primer_binding_sites') {
      const hasTemplateContext = normalized.chromosome || normalized.sequence || normalized.primerSequence;
      if (hasTemplateContext) {
        delete normalized.templateSequence;
      }
    }

    return normalized;
  }

  getToolKey(tool) {
    if (this.chatManager && typeof this.chatManager.getToolExecutionKey === 'function') {
      return this.chatManager.getToolExecutionKey(tool.tool_name, tool.parameters);
    }

    return `${tool.tool_name}:${JSON.stringify(this.normalizeToolParams(tool.tool_name, tool.parameters))}`;
  }

  hasViewStateChangedSinceLastExecution(toolName, conversationHistory) {
    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return false;
    }

    let lastExecIdx = -1;
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'system' && msg.content && msg.content.includes(`${toolName} executed successfully`)) {
        lastExecIdx = i;
        break;
      }
    }

    if (lastExecIdx === -1) {
      return false;
    }

    const viewChangingTools = [
      'navigate_to_position',
      'jump_to_gene',
      'jump_to_feature',
      'focus_on_gene',
      'scroll_left',
      'scroll_right',
      'pan_left',
      'pan_right',
      'zoom_in',
      'zoom_out',
      'switch_to_tab',
      'open_new_tab',
      'load_genome_file',
      'load_annotation_file',
      'toggle_track',
      'toggle_annotation_track',
      'set_track_settings',
      'set_all_track_settings',
    ];

    for (let i = lastExecIdx + 1; i < conversationHistory.length; i++) {
      const msg = conversationHistory[i];
      if (msg.role === 'system' && msg.content) {
        for (const viewTool of viewChangingTools) {
          if (msg.content.includes(`${viewTool} executed successfully`)) {
            console.log(
              `[Policy] View state changed since last execution of ${toolName} due to subsequent successful ${viewTool}`
            );
            return true;
          }
        }
      }
    }

    return false;
  }

  shouldAllowToolExecution(tool, conversationHistory = [], currentRound, toolResults = []) {
    const toolKey = this.getToolKey(tool);
    const toolName = tool.tool_name;
    const { name: applicablePolicyName, policy: applicablePolicy } = this.capabilityPolicy.getPolicyForTool(toolName);

    if (applicablePolicyName) {
      console.log(`[Policy] Applied ${applicablePolicyName} policy to ${toolName}`);
    }

    if (!this.shouldAllowWithinGlobalLimits(toolName, toolKey, applicablePolicyName, conversationHistory)) {
      return false;
    }

    if (!applicablePolicy) {
      console.log(`[Policy] Unknown tool, applying default once-per-round policy: ${toolName}`);
      const alreadyExecuted = this.chatManager.wasToolExecutedSuccessfully(toolKey, conversationHistory);
      return !alreadyExecuted;
    }

    return this.evaluatePolicyCondition(
      applicablePolicyName,
      applicablePolicy.policy,
      tool,
      toolKey,
      conversationHistory,
      toolResults,
      currentRound
    );
  }

  shouldAllowWithinGlobalLimits(toolName, toolKey, applicablePolicyName, conversationHistory) {
    const exemptedPolicies = [
      'scroll_operations',
      'zoom_operations',
      'system_utility',
      'repeatable_ui_operations',
      'co_scientist',
    ];
    if (exemptedPolicies.includes(applicablePolicyName)) {
      return true;
    }

    const chatboxSettings = this.chatManager.configManager.get('chatboxSettings') || {};
    const maxSameToolIdenticalParams =
      chatboxSettings.maxSameToolIdenticalParams ||
      this.chatManager.configManager.get('llm.maxSameToolIdenticalParams', 2);

    const identicalExecutionCount = this.chatManager.getToolExecutionCount(toolKey, conversationHistory);
    if (identicalExecutionCount >= maxSameToolIdenticalParams) {
      if (this.hasViewStateChangedSinceLastExecution(toolName, conversationHistory)) {
        console.log(
          `[Policy] View state has changed since last successful run. Bypassing identical execution limit for ${toolName}`
        );
      } else {
        console.log(
          `[Policy] Maximum identical tool execution limit reached (${maxSameToolIdenticalParams}): ${toolName}`
        );
        return false;
      }
    }

    const exemptedFromTotalLimit = [
      'scroll_operations',
      'zoom_operations',
      'search',
      'analysis',
      'state',
      'external_api',
      'primer_design',
      'feature_navigation',
      'position_navigation',
      'track_operations',
      'system_utility',
      'co_scientist',
    ];

    if (!exemptedFromTotalLimit.includes(applicablePolicyName)) {
      const maxSameToolDifferentParams =
        chatboxSettings.maxSameToolDifferentParams ||
        this.chatManager.configManager.get('llm.maxSameToolDifferentParams', 3);
      const totalExecutionCount = this.chatManager.getToolExecutionCountByName(toolName, conversationHistory);
      if (totalExecutionCount >= maxSameToolDifferentParams) {
        console.log(`[Policy] Maximum total tool execution limit reached (${maxSameToolDifferentParams}): ${toolName}`);
        return false;
      }
    }

    return true;
  }

  evaluatePolicyCondition(policyName, policyType, tool, toolKey, conversationHistory, toolResults, currentRound) {
    const toolName = tool.tool_name;

    if (policyType === 'always_allowed') {
      return true;
    }

    if (policyType === 'bounded_repeat') {
      const chatboxSettings = this.chatManager.configManager?.get('chatboxSettings', {}) || {};
      if (toolName === 'open_new_tab' && chatboxSettings.enableRepeatedOpenNewTab === false) {
        const alreadyPlanned = toolResults.some(r => r.tool === toolName);
        return !alreadyPlanned;
      }

      const configuredLimit = Number(chatboxSettings.maxRepeatedOpenNewTabCalls);
      const maxCallsPerRound = Number.isFinite(configuredLimit)
        ? Math.max(1, Math.min(Math.trunc(configuredLimit), 20))
        : 20;
      const plannedCalls = toolResults.filter(r => r.tool === toolName).length;
      if (plannedCalls >= maxCallsPerRound) {
        console.log(`[Policy] Maximum repeatable calls per round reached (${maxCallsPerRound}): ${toolName}`);
        return false;
      }
      return true;
    }

    if (policyName === 'file_operations') {
      const wasSuccessful = this.chatManager.wasToolExecutedSuccessfully(toolKey, conversationHistory);
      if (wasSuccessful) {
        console.log(`[Policy] File operation already succeeded with same parameters: ${toolName}`);
        return false;
      }
      return true;
    }

    if (policyType === 'once_per_round') {
      const executedInCurrentRound = toolResults.some(r => r.tool === toolName);
      if (executedInCurrentRound) {
        console.log(`[Policy] Operation already executed in current round: ${toolName}`);
        return false;
      }
      return true;
    }

    if (policyName === 'zoom_operations') {
      return this.allowIfNotRecent(toolName, conversationHistory, 5000, 'Zoom operation rate limited');
    }

    if (policyName === 'external_api') {
      return this.shouldAllowExternalApiOperation(toolName, toolKey, conversationHistory);
    }

    if (policyName === 'track_operations') {
      return this.shouldAllowTrackOperation(tool, conversationHistory);
    }

    if (policyName === 'state') {
      return this.shouldAllowStateQuery(toolName, toolKey, conversationHistory);
    }

    if (policyType === 'parameter_based') {
      return this.allowIfNoSuccessfulExistingExecution(toolName, toolKey, conversationHistory);
    }

    return true;
  }

  shouldAllowStateQuery(toolName, toolKey, conversationHistory) {
    const existingExecution = this.chatManager.findExistingExecution(toolKey, conversationHistory);
    if (!existingExecution || !existingExecution.success) {
      return true;
    }

    if (this.hasViewStateChangedSinceLastExecution(toolName, conversationHistory)) {
      console.log(`[Policy] State changed since last ${toolName}; allowing refreshed state query`);
      return true;
    }

    console.log(
      `[Policy] State query already succeeded with same parameters and no intervening state change: ${toolName}`
    );
    return false;
  }

  allowIfNoSuccessfulExistingExecution(toolName, toolKey, conversationHistory) {
    const existingExecution = this.chatManager.findExistingExecution(toolKey, conversationHistory);
    if (existingExecution && existingExecution.success) {
      console.log(`[Policy] ${toolName} already executed with same parameters`);
      return false;
    }
    return true;
  }

  allowIfNotRecent(toolName, conversationHistory, windowMs, message) {
    const recentExecution = this.chatManager.findRecentExecution(toolName, conversationHistory, windowMs);
    if (recentExecution) {
      console.log(`[Policy] ${message}: ${toolName}`);
      return false;
    }
    return true;
  }

  shouldAllowExternalApiOperation(toolName, toolKey, conversationHistory) {
    const existingExecution = this.chatManager.findExistingExecution(toolKey, conversationHistory);
    if (existingExecution && existingExecution.success) {
      console.log(`[Policy] External API call already succeeded with same parameters: ${toolName}`);
      return false;
    }

    return true;
  }

  normalizeTrackName(trackName) {
    if (!trackName) return '';
    const lower = String(trackName).toLowerCase();
    if (lower === 'action') return 'actions';
    if (lower === 'primer') return 'primers';
    return lower;
  }

  getTrackMapping() {
    return {
      genes: 'trackGenes',
      gc: 'trackGC',
      gc_content: 'trackGC',
      variants: 'trackVariants',
      reads: 'trackReads',
      proteins: 'trackProteins',
      primers: 'trackPrimers',
      primer: 'trackPrimers',
      wigtracks: 'trackWIG',
      wigTracks: 'trackWIG',
      sequence: 'trackSequence',
      actions: 'trackActions',
      action: 'trackActions',
      blast: 'trackBlast',
      blast_results: 'trackBlast',
    };
  }

  getTrackCheckbox(trackName) {
    const doc = this.getDocument();
    if (!doc || typeof doc.getElementById !== 'function' || !trackName) {
      return null;
    }

    const trackMapping = this.getTrackMapping();
    const checkboxId = trackMapping[String(trackName).toLowerCase()] || trackMapping[trackName];
    return checkboxId ? doc.getElementById(checkboxId) : null;
  }

  resolveRequestedVisibleState(trackName, action, visible, fallbackVisible) {
    if (visible !== undefined) {
      return visible;
    }

    if (action === 'show') {
      return true;
    }

    if (action === 'hide') {
      return false;
    }

    if (action === 'toggle') {
      if (fallbackVisible !== undefined) {
        return fallbackVisible;
      }

      const checkbox = this.getTrackCheckbox(trackName);
      return checkbox ? !checkbox.checked : undefined;
    }

    return undefined;
  }

  shouldAllowTrackOperation(tool, conversationHistory) {
    const currentTrack = tool.parameters?.trackName || tool.parameters?.track_name;
    const currentAction = tool.parameters?.action;
    const currentVisible = tool.parameters?.visible;
    const normalizedCurrentTrack = this.normalizeTrackName(currentTrack);
    const currentVisibleState = this.resolveRequestedVisibleState(currentTrack, currentAction, currentVisible);

    const now = Date.now();
    const timeWindowMs = 3000;

    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role !== 'assistant' || !msg.content) {
        continue;
      }

      const matchingTool = this.extractRecentTrackTool(msg.content);
      if (!matchingTool || !matchingTool.parameters) {
        continue;
      }

      const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;
      if (now - estimatedTimestamp >= timeWindowMs) {
        continue;
      }

      const recentTrack = matchingTool.parameters?.trackName || matchingTool.parameters?.track_name;
      const recentAction = matchingTool.parameters?.action;
      const recentVisible = matchingTool.parameters?.visible;
      const fallbackVisible = this.getToggleResultVisibleState(conversationHistory, i);
      const recentVisibleState = this.resolveRequestedVisibleState(
        recentTrack,
        recentAction,
        recentVisible,
        fallbackVisible
      );

      if (
        normalizedCurrentTrack === this.normalizeTrackName(recentTrack) &&
        currentVisibleState === recentVisibleState &&
        currentVisibleState !== undefined
      ) {
        console.log(
          `[Policy] Track toggle rate limited for same track with same action: ${currentTrack} (${currentAction || currentVisible})`
        );
        return false;
      }
    }

    return true;
  }

  extractRecentTrackTool(content) {
    try {
      const parsed = JSON.parse(content);
      if (
        (parsed.tool_name === 'toggle_track' || parsed.tool_name === 'toggle_annotation_track') &&
        parsed.parameters
      ) {
        return parsed;
      }
    } catch (error) {
      try {
        const multipleToolCalls = this.chatManager.parseMultipleToolCalls(content);
        return multipleToolCalls.find(
          tool => tool.tool_name === 'toggle_track' || tool.tool_name === 'toggle_annotation_track'
        );
      } catch (parseError) {
        return null;
      }
    }

    return null;
  }

  getToggleResultVisibleState(conversationHistory, assistantIndex) {
    if (assistantIndex + 1 >= conversationHistory.length || conversationHistory[assistantIndex + 1].role !== 'tool') {
      return undefined;
    }

    try {
      const toolResult = JSON.parse(conversationHistory[assistantIndex + 1].content);
      if (toolResult && toolResult.visible !== undefined) {
        return toolResult.visible;
      }
    } catch (error) {
      return undefined;
    }

    return undefined;
  }
}

if (typeof window !== 'undefined') {
  window.ToolExecutionPolicy = ToolExecutionPolicy;
}

if (typeof globalThis !== 'undefined') {
  globalThis.ToolExecutionPolicy = ToolExecutionPolicy;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolExecutionPolicy;
}
