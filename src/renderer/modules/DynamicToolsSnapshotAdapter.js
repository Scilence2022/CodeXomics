// @ts-check
const DYNAMIC_TOOL_STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'this',
  'that',
  'from',
  'into',
  'please',
  'can',
  'could',
  'would',
  'should',
  'tell',
  'show',
  'about',
  'your',
]);

/**
 * Renderer-side adapter for main-process tool registry snapshots.
 *
 * This keeps ChatManager compatible with the old SystemIntegration API shape
 * while preventing renderer-side filesystem access to tools_registry/.
 */
class DynamicToolsSnapshotAdapter {
  constructor(snapshot, chatManager) {
    this.chatManager = chatManager;
    this.snapshot = {
      ...snapshot,
      tools: Array.isArray(snapshot?.tools) ? snapshot.tools : Object.values(snapshot?.toolsByName || {}),
      builtInTools: Array.isArray(snapshot?.builtInTools) ? snapshot.builtInTools : [],
      categories: snapshot?.categories || { categories: {} },
      counts: snapshot?.counts || {},
      diagnostics: snapshot?.diagnostics || [],
    };

    this.toolsByName = new Map(
      this.snapshot.tools.map(tool => [this.getToolName(tool), tool]).filter(([name]) => name)
    );
    this.usageStats = new Map();
    this.pluginManager = null;
    this.pluginToolsCache = null;
    this.builtInTools = this.createBuiltInToolsFacade();
    this.integrationStatus = {
      initialized: true,
      lastUpdate: Date.now(),
      toolsLoaded: this.snapshot.counts.tools || this.snapshot.tools.length,
      categoriesLoaded: this.snapshot.counts.categories || 0,
      builtInToolsLoaded: this.snapshot.counts.builtInTools || this.builtInTools.builtInToolsMap.size,
      pluginToolsLoaded: 0,
      registryHash: this.snapshot.registryHash,
      diagnostics: this.snapshot.diagnostics,
    };
    this.pluginBridge = {
      invalidateCache: () => this.invalidatePluginCache(),
      getAllPluginTools: () => this.collectPluginTools(),
      getRelevantPluginTools: (query, maxTools = 10) => this.getRelevantPluginTools(query, maxTools),
      generatePluginToolsPromptSection: query => this.generatePluginToolsPromptSection(query),
    };
  }

  getToolName(tool) {
    return String(tool?.name || '');
  }

  createBuiltInToolsFacade() {
    const builtInToolsMap = new Map(
      this.snapshot.builtInTools.map(tool => {
        const registryTool = this.toolsByName.get(tool.name) || {};
        return [
          tool.name,
          {
            ...tool,
            description: registryTool.description || tool.description,
            parameters: registryTool.parameters || tool.parameters,
            keywords: registryTool.keywords || tool.keywords || [],
            method: tool.method || registryTool.implementation?.method,
            category: tool.category || registryTool.category || 'uncategorized',
            priority: tool.priority || registryTool.priority || 1,
          },
        ];
      })
    );

    return {
      builtInToolsMap,
      isBuiltInTool: toolName => builtInToolsMap.has(toolName),
      getBuiltInToolInfo: toolName => builtInToolsMap.get(toolName),
      getBuiltInToolsByCategory: category =>
        Array.from(builtInToolsMap.entries())
          .filter(([, info]) => info.category === category)
          .map(([name, info]) => ({ name, ...info })),
      getBuiltInToolsStats: () => this.getBuiltInToolsStats(),
      analyzeBuiltInToolRelevance: query => this.analyzeBuiltInToolRelevance(query),
      executeBuiltInTool: (toolName, parameters, chatManagerInstance = this.chatManager) =>
        this.executeBuiltInTool(toolName, parameters, chatManagerInstance),
    };
  }

  async initialize() {
    return true;
  }

  setPluginManager(pluginManager) {
    this.pluginManager = pluginManager;
    this.pluginToolsCache = null;
    this.integrationStatus.pluginToolsLoaded = this.collectPluginTools().length;
  }

  invalidatePluginCache() {
    this.pluginToolsCache = null;
  }

  isAgentSystemEnabled(context = {}) {
    if (typeof context.agentSystemEnabled === 'boolean') {
      return context.agentSystemEnabled;
    }
    return !!this.chatManager?.agentSystemEnabled;
  }

  collectPluginTools() {
    if (this.pluginToolsCache) return this.pluginToolsCache;
    if (!this.pluginManager || !this.pluginManager.pluginRegistry) {
      this.pluginToolsCache = [];
      return this.pluginToolsCache;
    }

    const pluginTools = [];
    try {
      for (const [type, registry] of Object.entries(this.pluginManager.pluginRegistry)) {
        if (!(registry instanceof Map)) continue;
        for (const [pluginId, plugin] of registry) {
          if (!plugin || plugin.enabled === false) continue;

          if ((type === 'function' || type === 'utility') && plugin.functions) {
            for (const [functionName, functionDefinition] of Object.entries(plugin.functions)) {
              pluginTools.push({
                name: `${pluginId}.${functionName}`,
                description: functionDefinition.description || `${pluginId} ${functionName} plugin function`,
                category: `plugin_${type}`,
                source: 'plugin',
                execution_type: 'plugin',
                parameters: functionDefinition.parameters || {
                  type: 'object',
                  properties: {},
                  required: [],
                },
                priority: type === 'utility' ? 2 : 3,
              });
            }
          }

          if (type === 'visualization' && plugin._commandHandlers instanceof Map) {
            for (const [commandId] of plugin._commandHandlers) {
              const commandName = String(commandId).split('.').pop();
              pluginTools.push({
                name: `${pluginId}.${commandName}`,
                description: `${plugin.name || pluginId} command: ${commandName}`,
                category: 'plugin_visualization',
                source: 'plugin',
                execution_type: 'plugin',
                parameters: { type: 'object', properties: {}, required: [] },
                priority: 4,
              });
            }
          }
        }
      }
    } catch (error) {
      this.snapshot.diagnostics.push({
        severity: 'warning',
        message: 'Failed to collect plugin tools in renderer adapter',
        error: error.message,
      });
    }

    this.pluginToolsCache = pluginTools;
    return this.pluginToolsCache;
  }

  scoreTool(tool, query, context = {}) {
    const text = String(query || '').toLowerCase();
    const fields = [tool.name, tool.description, tool.category, ...(Array.isArray(tool.keywords) ? tool.keywords : [])]
      .join(' ')
      .toLowerCase();

    const terms = text
      .split(/[^a-z0-9_]+/)
      .map(term => term.trim())
      .filter(term => term.length > 2 && !DYNAMIC_TOOL_STOP_WORDS.has(term));

    let score = 0;
    const toolName = String(tool.name || '').toLowerCase();
    if (text.includes(toolName)) score += 8;

    const nameParts = toolName.split('_').filter(part => part.length > 2);
    if (nameParts.length > 0 && nameParts.every(part => text.includes(part))) {
      score += 4;
    }

    for (const keyword of tool.keywords || []) {
      const normalizedKeyword = String(keyword || '').toLowerCase();
      if (normalizedKeyword.length > 1 && text.includes(normalizedKeyword)) {
        score += 3;
      }
    }

    for (const term of terms) {
      // A single broad word such as "sequence" appears in many genomic tools.
      // Treat free-text field matches as weak evidence; two matching terms are
      // enough to pass selection, while exact names and keywords remain strong.
      if (fields.includes(term)) score += 0.35;
    }

    if (tool.execution?.requires_data && context.hasData === false) score -= 1.5;
    if (tool.execution?.requires_network && context.hasNetwork === false) score -= 1.5;

    // Built-in status and registry priority are ranking preferences, not relevance
    // evidence. Applying them to unmatched tools makes every built-in exceed the
    // selection threshold, so unrelated prompts receive the full registry.
    if (score > 0) {
      if (tool.isBuiltIn || this.builtInTools.builtInToolsMap.has(tool.name)) score += 0.1;
      const priority = Number.isFinite(tool.priority) ? tool.priority : 5;
      score += Math.max(0, 6 - priority) * 0.02;
    }
    return score;
  }

  selectRelevantTools(query, context = {}, limit = Infinity) {
    const allowCoordination = this.isAgentSystemEnabled(context);
    const validTools = this.snapshot.tools.filter(tool => {
      if (!tool || !tool.name) return false;
      if (tool.category === 'coordination' && !allowCoordination) return false;
      return true;
    });

    const selected = validTools
      .map(tool => ({ tool, score: this.scoreTool(tool, query, context) }))
      .filter(entry => entry.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .map(entry => entry.tool);

    for (const name of this.getFallbackToolNames()) {
      if (selected.length >= 10) break;
      const fallbackTool = this.toolsByName.get(name);
      if (fallbackTool && !selected.some(tool => tool.name === name)) {
        selected.push(fallbackTool);
      }
    }

    const pluginTools = this.getRelevantPluginTools(query, 10, context);
    const deduped = [];
    const seen = new Set();
    for (const tool of [...selected, ...pluginTools]) {
      if (seen.has(tool.name)) continue;
      seen.add(tool.name);
      deduped.push(tool);
      if (deduped.length >= limit) break;
    }
    return deduped;
  }

  getFallbackToolNames() {
    return [
      'load_genome_file',
      'load_annotation_file',
      'navigate_to_position',
      'get_current_state',
      'find_gene_by_name',
      'get_sequence',
      'compute_gc',
      'list_available_tools',
    ];
  }

  getRelevantPluginTools(query, maxTools = 10, context = {}) {
    return this.collectPluginTools()
      .map(tool => ({ tool, score: this.scoreTool(tool, query, context) }))
      .filter(entry => entry.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTools)
      .map(entry => entry.tool);
  }

  generatePluginToolsPromptSection(query) {
    const pluginTools = this.getRelevantPluginTools(query, 10);
    if (pluginTools.length === 0) return '';
    return `\n## Plugin Tools\n\n${pluginTools
      .map(tool => `- **${tool.name}**: ${tool.description || 'Plugin tool'}`)
      .join('\n')}`;
  }

  formatParameterList(tool) {
    const properties = tool?.parameters?.properties || {};
    const entries = Object.entries(properties).slice(0, 8);
    if (entries.length === 0) return 'No parameters';
    return entries
      .map(([name, param]) => {
        const type = param?.type || 'any';
        const description = param?.description ? ` - ${param.description}` : '';
        return `${name}: ${type}${description}`;
      })
      .join(', ');
  }

  formatSampleUsages(tools) {
    const usages = [];
    for (const tool of tools) {
      const sample = Array.isArray(tool.sample_usages) ? tool.sample_usages[0] : null;
      if (!sample) continue;
      usages.push(`- ${tool.name}: "${sample.user_query}" -> ${sample.tool_call}`);
      if (usages.length >= 8) break;
    }
    return usages.length > 0 ? usages.join('\n') : '- Use JSON tool calls with the exact tool name and parameters.';
  }

  buildPrompt(tools, context = {}) {
    const builtInTools = tools.filter(tool => tool.isBuiltIn || this.builtInTools.builtInToolsMap.has(tool.name));
    const pluginTools = tools.filter(tool => tool.source === 'plugin');
    const extendedTools = tools.filter(tool => !builtInTools.includes(tool) && tool.source !== 'plugin');
    const genomeContext = context.genomeBrowser || {};
    const visibleTracks = Array.isArray(genomeContext.visibleTracks) ? genomeContext.visibleTracks.join(', ') : 'None';
    const loadedFiles = Array.isArray(genomeContext.loadedFiles) ? genomeContext.loadedFiles.length : 0;

    const builtInDescriptions =
      builtInTools
        .map(
          tool =>
            `- **${tool.name}**: ${
              tool.description || 'Built-in CodeXomics tool'
            }\n  Parameters: ${this.formatParameterList(tool)}`
        )
        .join('\n') || 'No built-in tools selected for this query.';

    const extendedDescriptions =
      extendedTools
        .map(
          tool =>
            `- **${tool.name}**: ${
              tool.description || 'Registry tool'
            }\n  Parameters: ${this.formatParameterList(tool)}`
        )
        .join('\n') || 'No extended tools selected for this query.';

    const pluginDescriptions =
      pluginTools.length > 0
        ? `\n## Plugin Tools\n\n${pluginTools
            .map(tool => `- **${tool.name}**: ${tool.description || 'Plugin tool'}`)
            .join('\n')}`
        : '';

    const currentPosition = genomeContext.currentPosition
      ? `${genomeContext.currentPosition.start}-${genomeContext.currentPosition.end}`
      : 'None';
    const introLine = [
      'You are an advanced AI assistant for CodeXomics,',
      `equipped with ${tools.length} dynamically selected tools based on the user's query.`,
    ].join(' ');
    const activeToolsLine = [
      `${tools.length} tools available`,
      `(${builtInTools.length} directly available,`,
      `${extendedTools.length} extended,`,
      `${pluginTools.length} plugin)`,
    ].join(' ');

    return `# CodeXomics - Enhanced Dynamic Tools System

${introLine}

## Current Context
- Current Chromosome: ${genomeContext.currentChromosome || 'None'}
- Current Position: ${currentPosition}
- Visible Tracks: ${visibleTracks}
- Loaded Files: ${loadedFiles} files
- Sequence Length: ${genomeContext.sequenceLength || 'Unknown'}
- Network Status: ${context.hasNetwork ? 'Connected' : 'Offline'}
- Authentication: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- Active Tools: ${activeToolsLine}

## Directly Available Tools

These tools execute inside CodeXomics and should be preferred for local browser operations.

${builtInDescriptions}

## Extended Tools

These tools provide additional registry capabilities and may require network access or external services.

${extendedDescriptions}
${pluginDescriptions}

## Tool Usage Examples

${this.formatSampleUsages(tools)}

## Tool Selection Guidelines

1. Prefer directly available built-in tools when they satisfy the request.
2. Use file loading tools for importing genome, annotation, variant, reads, WIG, and operon files.
3. Combine multiple JSON tool calls when the user asks for sequential operations.
4. Check tool results before continuing dependent steps.
5. Consider current genome state, loaded data, network status, and authentication.

## Response Format

For a single tool call, respond with only a JSON object:
\`\`\`json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
\`\`\`

For multiple sequential tool calls, respond with multiple JSON objects, each in its own code block.

## Tool Categories & Relationships

- File Loading Tools: import genomic data files.
- Navigation Tools: move and zoom the genome browser.
- Sequence Tools: retrieve and analyze DNA/RNA sequence.
- Database Tools: query biological databases.
- Editing Tools: mutate sequence data through ActionManager-backed actions.
- Plugin Tools: invoke installed plugin functions with plugin-id.function-name.
`;
  }

  getBuiltInToolsStats() {
    const stats = {
      total_builtin_tools: this.builtInTools.builtInToolsMap.size,
      categories: {},
    };
    for (const [toolName, toolInfo] of this.builtInTools.builtInToolsMap.entries()) {
      const category = toolInfo.category || 'uncategorized';
      if (!stats.categories[category]) {
        stats.categories[category] = { count: 0, tools: [] };
      }
      stats.categories[category].count += 1;
      stats.categories[category].tools.push(toolName);
    }
    return stats;
  }

  analyzeBuiltInToolRelevance(query) {
    return Array.from(this.builtInTools.builtInToolsMap.entries())
      .map(([name, info]) => {
        const registryTool = this.toolsByName.get(name) || info;
        const confidence = Math.min(1, this.scoreTool({ ...registryTool, isBuiltIn: true }, query, {}) / 8);
        return {
          name,
          confidence,
          reason: confidence > 0 ? 'Matched registry keywords or description' : 'No strong match',
          category: info.category,
          is_external: false,
        };
      })
      .filter(entry => entry.confidence >= 0.2)
      .sort((a, b) => b.confidence - a.confidence);
  }

  async executeBuiltInTool(toolName, parameters, chatManagerInstance) {
    const toolInfo = this.builtInTools.builtInToolsMap.get(toolName);
    if (!toolInfo) {
      throw new Error(`Tool ${toolName} is not a built-in tool`);
    }
    const methodName = toolInfo.method;
    if (!methodName || typeof chatManagerInstance[methodName] !== 'function') {
      throw new Error(`Method ${methodName || 'unknown'} not found on ChatManager instance`);
    }
    const startedAt = Date.now();
    const result = await chatManagerInstance[methodName](parameters);
    return {
      success: true,
      tool: toolName,
      method: methodName,
      result,
      executionTime: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
      type: 'built-in',
    };
  }

  async getAllTools() {
    return this.snapshot.tools;
  }

  async getToolsByCategory(categoryName) {
    return this.snapshot.tools.filter(tool => tool.category === categoryName && tool.name);
  }

  async searchTools(keywords, limit = 10) {
    return this.snapshot.tools
      .map(tool => ({ tool, score: this.scoreTool(tool, keywords, {}) }))
      .filter(entry => entry.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => entry.tool);
  }

  async getRegistryStats() {
    return {
      total_tools: this.snapshot.counts.tools || this.snapshot.tools.length,
      total_categories: this.snapshot.counts.categories || 0,
      builtin_tools: this.builtInTools.builtInToolsMap.size,
      user_tools: this.snapshot.counts.userTools || 0,
      unique_tools: this.snapshot.counts.uniqueTools || this.toolsByName.size,
      diagnostics: this.snapshot.diagnostics,
      registry_hash: this.snapshot.registryHash,
      categories: Object.entries(this.snapshot.categories.categories || {}).map(([name, info]) => ({
        name,
        tools_count: info.tools_count,
        priority: info.priority,
      })),
    };
  }

  getToolUsageStats() {
    const stats = {};
    for (const [toolName, data] of this.usageStats.entries()) {
      stats[toolName] = {
        usage_count: data.count,
        success_rate: data.successCount / data.count,
        avg_execution_time: data.totalTime / data.count,
      };
    }
    return stats;
  }

  trackToolUsage(toolName, success, executionTime) {
    const stats = this.usageStats.get(toolName) || {
      count: 0,
      successCount: 0,
      totalTime: 0,
    };
    stats.count += 1;
    if (success) stats.successCount += 1;
    stats.totalTime += executionTime || 0;
    this.usageStats.set(toolName, stats);
  }

  getIntegrationStatus() {
    return {
      ...this.integrationStatus,
      uptime: Date.now() - this.integrationStatus.lastUpdate,
    };
  }

  async generateDynamicSystemPrompt(userQuery, context = {}, options = {}) {
    const selectedTools = this.selectRelevantTools(userQuery, context, options.selectionLimit);
    return {
      systemPrompt: this.buildPrompt(selectedTools, context),
      toolsUsed: selectedTools.map(tool => tool.name),
      toolCount: selectedTools.length,
      builtInToolsIncluded: selectedTools.filter(
        tool => tool.isBuiltIn || this.builtInTools.builtInToolsMap.has(tool.name)
      ).length,
      registryToolsIncluded: selectedTools.filter(tool => !tool.isBuiltIn && tool.source !== 'plugin').length,
      pluginToolsIncluded: selectedTools.filter(tool => tool.source === 'plugin').length,
      generationTime: Date.now(),
      registryHash: this.snapshot.registryHash,
    };
  }

  async generateNonDynamicSystemPrompt(context = {}) {
    const allowCoordination = this.isAgentSystemEnabled(context);
    const tools = this.snapshot.tools.filter(tool => allowCoordination || tool.category !== 'coordination');
    return {
      systemPrompt: this.buildPrompt(tools, context),
      toolsUsed: tools.map(tool => tool.name),
      toolCount: tools.length,
      generationTime: Date.now(),
      mode: 'snapshot-comprehensive',
    };
  }
}

if (typeof window !== 'undefined') {
  window.DynamicToolsSnapshotAdapter = DynamicToolsSnapshotAdapter;
}

if (typeof module !== 'undefined') {
  module.exports = DynamicToolsSnapshotAdapter;
}
