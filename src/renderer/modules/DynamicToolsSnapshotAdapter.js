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
  'then',
  'using',
  'make',
  'perform',
  'current',
]);

const RETRIEVAL_ACTION_ALIASES = {
  load: ['open', 'import', 'read'],
  open: ['load', 'view'],
  find: ['search', 'locate', 'lookup'],
  search: ['find', 'locate', 'lookup'],
  navigate: ['jump', 'goto', 'position'],
  jump: ['navigate', 'goto', 'position'],
  calculate: ['compute', 'analyze', 'analysis'],
  compute: ['calculate', 'analyze', 'analysis'],
  analyze: ['analysis', 'calculate', 'compute', 'inspect'],
  show: ['display', 'view', 'list'],
  hide: ['toggle', 'disable'],
  delete: ['remove', 'clear', 'uninstall'],
  remove: ['delete', 'clear'],
  save: ['export', 'write', 'download'],
  export: ['save', 'write', 'download'],
  create: ['add', 'design', 'build'],
  add: ['create', 'insert'],
  translate: ['translation', 'protein'],
  blast: ['alignment', 'similarity'],
};

/** Contiguous runs of CJK ideographs, hiragana, katakana and Hangul. */
const CJK_RUN_PATTERN = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]+/g;

/**
 * Bridge from Chinese query vocabulary to the English terms the tool registry
 * is written in. Retrieval scores tool name/keyword/description/category
 * tokens, all of which are English, so a Chinese query needs its verbs and
 * nouns mapped across before scoring — tokenizing it correctly is necessary but
 * not sufficient.
 */
const CJK_RETRIEVAL_LEXICON = {
  // actions
  打开: ['open', 'load'],
  加载: ['load', 'open', 'import'],
  载入: ['load', 'open'],
  导入: ['import', 'load'],
  读取: ['read', 'load'],
  查找: ['find', 'search', 'locate'],
  搜索: ['search', 'find', 'locate'],
  寻找: ['find', 'search'],
  定位: ['locate', 'navigate', 'position'],
  跳转: ['jump', 'navigate', 'goto'],
  导航: ['navigate', 'jump'],
  移动: ['pan', 'move', 'scroll'],
  放大: ['zoom', 'in'],
  缩小: ['zoom', 'out'],
  显示: ['show', 'display'],
  展示: ['show', 'display'],
  隐藏: ['hide', 'toggle'],
  切换: ['toggle', 'switch'],
  选择: ['select', 'choose'],
  选中: ['select'],
  高亮: ['highlight'],
  删除: ['delete', 'remove', 'clear'],
  移除: ['remove', 'delete'],
  清除: ['clear', 'remove'],
  保存: ['save', 'export', 'write'],
  导出: ['export', 'save', 'download'],
  下载: ['download', 'save'],
  创建: ['create', 'add'],
  新建: ['create', 'new'],
  添加: ['add', 'create'],
  设计: ['design', 'create'],
  计算: ['calculate', 'compute'],
  分析: ['analyze', 'analysis'],
  统计: ['statistics', 'count', 'analysis'],
  翻译: ['translate', 'translation', 'protein'],
  比对: ['blast', 'alignment', 'align'],
  注释: ['annotation', 'annotate'],
  编辑: ['edit', 'modify'],
  修改: ['modify', 'edit', 'update'],
  截图: ['screenshot', 'capture'],
  列出: ['list', 'show'],
  查询: ['query', 'search', 'get'],
  获取: ['get', 'fetch', 'retrieve'],
  // objects
  基因: ['gene'],
  基因组: ['genome'],
  序列: ['sequence'],
  染色体: ['chromosome'],
  位置: ['position', 'location'],
  坐标: ['coordinate', 'position'],
  区域: ['region', 'range'],
  特征: ['feature'],
  轨道: ['track'],
  标签: ['tab', 'label'],
  窗口: ['window'],
  文件: ['file'],
  引物: ['primer'],
  蛋白: ['protein'],
  结构: ['structure'],
  密码子: ['codon'],
  变异: ['variant', 'mutation'],
  突变: ['mutation', 'variant'],
  读段: ['reads', 'alignment'],
  操纵子: ['operon'],
  酶切: ['restriction', 'digest'],
  内切酶: ['restriction', 'enzyme'],
  通路: ['pathway'],
  书签: ['bookmark'],
  主题: ['theme'],
  任务: ['task'],
  插件: ['plugin'],
  数据库: ['database'],
  文献: ['literature', 'reference'],
  报告: ['report'],
  图谱: ['plot', 'map'],
};

/**
 * Renderer-side adapter for main-process tool registry snapshots.
 *
 * This keeps ChatManager compatible with the old SystemIntegration API shape
 * while preventing renderer-side filesystem access to tools_registry/.
 */
class DynamicToolsSnapshotAdapter {
  constructor(snapshot, chatManager) {
    this.chatManager = chatManager;
    const rawTools = Array.isArray(snapshot?.tools) ? snapshot.tools : Object.values(snapshot?.toolsByName || {});
    const uniqueTools = this.mergeDuplicateToolDefinitions(rawTools);
    this.snapshot = {
      ...snapshot,
      tools: uniqueTools,
      builtInTools: Array.isArray(snapshot?.builtInTools) ? snapshot.builtInTools : [],
      categories: snapshot?.categories || { categories: {} },
      counts: { ...(snapshot?.counts || {}), tools: uniqueTools.length },
      diagnostics: snapshot?.diagnostics || [],
    };

    this.toolsByName = new Map(
      this.snapshot.tools.map(tool => [this.getToolName(tool), tool]).filter(([name]) => name)
    );
    this.retrievalIndex = this.buildRetrievalIndex(this.snapshot.tools);
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
      mcpToolsLoaded: 0,
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

  mergeDuplicateToolDefinitions(tools) {
    const grouped = new Map();
    for (const tool of Array.isArray(tools) ? tools : []) {
      const name = this.getToolName(tool);
      if (!name) continue;
      if (!grouped.has(name)) grouped.set(name, []);
      grouped.get(name).push(tool);
    }

    const score = tool => {
      const schema = this.normalizeToolSchema(tool);
      return (
        Object.keys(schema?.properties || {}).length * 100 +
        (Array.isArray(schema?.required) ? schema.required.length * 10 : 0) +
        (Array.isArray(tool?.sample_usages) ? tool.sample_usages.length : 0) +
        String(tool?.description || '').length / 1000
      );
    };
    const dedupeObjects = values => {
      const seen = new Set();
      return values.filter(value => {
        const key = JSON.stringify(value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    return [...grouped.values()].map(definitions => {
      if (definitions.length === 1) return definitions[0];
      const preferred = [...definitions].sort((left, right) => score(right) - score(left))[0];
      const schemas = definitions.map(tool => this.normalizeToolSchema(tool));
      const mergedProperties = Object.assign({}, ...schemas.map(schema => schema?.properties || {}));
      Object.assign(mergedProperties, this.normalizeToolSchema(preferred)?.properties || {});
      const mergedRequired = [
        ...new Set(schemas.flatMap(schema => (Array.isArray(schema?.required) ? schema.required : []))),
      ];
      return {
        ...definitions.reduce((merged, tool) => ({ ...merged, ...tool }), {}),
        ...preferred,
        keywords: [...new Set(definitions.flatMap(tool => tool?.keywords || []))],
        sample_usages: dedupeObjects(definitions.flatMap(tool => tool?.sample_usages || [])),
        parameters: {
          ...this.normalizeToolSchema(preferred),
          type: 'object',
          properties: mergedProperties,
          required: mergedRequired,
        },
        duplicateSources: definitions.map(tool => tool.sourceFile || tool.source || tool.name),
      };
    });
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

  normalizeToolSchema(tool) {
    return (
      tool?.parameters ||
      tool?.inputSchema ||
      tool?.input_schema ||
      tool?.schema || {
        type: 'object',
        properties: {},
        required: [],
      }
    );
  }

  /**
   * Split text into retrieval tokens.
   *
   * Two things beyond the plain ASCII split:
   *
   * - The camelCase split is what lets `jumpToGene` match "jump gene", but it
   *   also chops a trailing-capital gene symbol (`lysC` -> `lys`). The unsplit
   *   form is kept alongside so both spellings match.
   * - CJK text survives. Splitting on `[^a-z0-9]+` dropped it entirely, so a
   *   Chinese query produced zero tokens, scored no tool above threshold, and
   *   fell back to the ten generic tools — out of 216 — for every request. The
   *   app ships a zh-CN locale, so that was a silent capability cliff for half
   *   its users.
   */
  tokenizeSearchText(value) {
    const raw = String(value || '');
    const tokens = [];

    const latin = raw
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/);
    for (const token of latin) {
      const trimmed = token.trim();
      if (trimmed.length > 2 && !DYNAMIC_TOOL_STOP_WORDS.has(trimmed)) tokens.push(trimmed);
    }

    // Unsplit words, so `lysC` also contributes `lysc`.
    for (const token of raw.toLowerCase().split(/[^a-z0-9]+/)) {
      const trimmed = token.trim();
      if (trimmed.length > 2 && !DYNAMIC_TOOL_STOP_WORDS.has(trimmed)) tokens.push(trimmed);
    }

    // CJK has no word delimiters: index each run plus its 2- and 3-character
    // n-grams, so terms like "基因" and "基因组" inside a longer run match.
    for (const run of raw.match(CJK_RUN_PATTERN) || []) {
      if (run.length >= 2) tokens.push(run);
      for (const width of [2, 3]) {
        for (let index = 0; index + width <= run.length; index += 1) {
          tokens.push(run.slice(index, index + width));
        }
      }
    }

    return [...new Set(tokens)];
  }

  expandSearchTerms(tokens) {
    const expanded = new Set(tokens);
    for (const token of tokens) {
      for (const alias of RETRIEVAL_ACTION_ALIASES[token] || []) expanded.add(alias);
      // The tool registry is written in English. Without this bridge a Chinese
      // query can be tokenized correctly and still match nothing.
      for (const alias of CJK_RETRIEVAL_LEXICON[token] || []) expanded.add(alias);
      if (token.endsWith('s') && token.length > 3) expanded.add(token.slice(0, -1));
      if (token.endsWith('ing') && token.length > 5) expanded.add(token.slice(0, -3));
    }
    return [...expanded];
  }

  getToolSearchFields(tool) {
    const schema = this.normalizeToolSchema(tool);
    const parameterNames = Object.keys(schema?.properties || {});
    const keywordText = Array.isArray(tool?.keywords) ? tool.keywords.join(' ') : '';
    return {
      name: this.tokenizeSearchText(tool?.name),
      keywords: this.tokenizeSearchText(keywordText),
      description: this.tokenizeSearchText(tool?.description),
      category: this.tokenizeSearchText(`${tool?.category || ''} ${tool?.subcategory || ''}`),
      parameters: this.tokenizeSearchText(parameterNames.join(' ')),
    };
  }

  buildRetrievalIndex(tools) {
    const documents = new Map();
    const documentFrequency = new Map();
    const validTools = (Array.isArray(tools) ? tools : []).filter(tool => tool?.name);

    for (const tool of validTools) {
      const fields = this.getToolSearchFields(tool);
      documents.set(tool.name, fields);
      const uniqueTokens = new Set(Object.values(fields).flat());
      for (const token of uniqueTokens) {
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      }
    }

    return {
      documents,
      documentFrequency,
      documentCount: Math.max(validTools.length, 1),
    };
  }

  getInverseDocumentFrequency(token) {
    const frequency = this.retrievalIndex?.documentFrequency?.get(token) || 0;
    const count = this.retrievalIndex?.documentCount || 1;
    return Math.log(1 + (count + 1) / (frequency + 1));
  }

  splitRetrievalClauses(query) {
    const text = String(query || '').trim();
    if (!text) return [];
    const clauses = text
      .split(/(?:\b(?:and\s+then|then|after\s+that|next|finally)\b|[;\n])/i)
      .map(clause => clause.trim())
      .filter(Boolean);
    return clauses.length > 1 ? clauses : [text];
  }

  normalizeMcpTool(tool) {
    const name = this.getToolName(tool) || String(tool?.tool_name || tool?.id || '');
    if (!name) return null;

    const serverName = tool.serverName || tool.server_name || 'MCP Server';
    const serverCategory = tool.serverCategory || tool.server_category || tool.category || 'general';
    const category = String(serverCategory).startsWith('mcp_') ? serverCategory : `mcp_${serverCategory}`;
    const schema = this.normalizeToolSchema(tool);
    const keywordParts = [
      name,
      name.replace(/[_-]+/g, ' '),
      serverName,
      serverCategory,
      ...(Array.isArray(tool.keywords) ? tool.keywords : []),
    ]
      .map(value => String(value || '').trim())
      .filter(Boolean);

    return {
      ...tool,
      name,
      description: tool.description || `${serverName} MCP tool`,
      category,
      source: 'mcp',
      execution_type: 'mcp',
      parameters: schema,
      inputSchema: schema,
      serverId: tool.serverId || tool.server_id,
      serverName,
      serverCategory,
      priority: Number.isFinite(tool.priority) ? tool.priority : 1,
      keywords: [...new Set(keywordParts)],
    };
  }

  collectMcpTools() {
    const manager = this.chatManager?.mcpServerManager;
    if (!manager || typeof manager.getAllAvailableTools !== 'function') {
      this.integrationStatus.mcpToolsLoaded = 0;
      return [];
    }

    try {
      const tools = manager
        .getAllAvailableTools()
        .map(tool => this.normalizeMcpTool(tool))
        .filter(Boolean);
      const toolsWithFallbacks = this.mergeToolsByName([...tools, ...this.collectKnownMcpFallbackTools(tools)]);
      this.integrationStatus.mcpToolsLoaded = toolsWithFallbacks.length;
      return toolsWithFallbacks;
    } catch (error) {
      console.warn('[DynamicToolsSnapshotAdapter] Failed to collect MCP tools:', error.message);
      const fallbackTools = this.collectKnownMcpFallbackTools();
      this.integrationStatus.mcpToolsLoaded = fallbackTools.length;
      return fallbackTools;
    }
  }

  collectKnownMcpFallbackTools(existingTools = []) {
    const manager = this.chatManager?.mcpServerManager;
    if (!manager) return [];

    const existingNames = new Set(existingTools.map(tool => this.getToolName(tool)).filter(Boolean));
    const existingServerIds = new Set(
      existingTools.map(tool => String(tool?.serverId || tool?.server_id || '')).filter(Boolean)
    );
    const fallbackDefinitions = {
      'deep-gene-research': {
        name: 'deep-gene-research',
        description:
          'Perform Deep Gene Research for a gene and return research task status, final report URLs, detailed research data, and annotation proposals.',
        inputSchema: {
          type: 'object',
          properties: {
            geneSymbol: {
              type: 'string',
              description: 'Gene symbol, locus tag, or identifier to research.',
            },
            organism: {
              type: 'string',
              description: 'Organism name, for example Escherichia coli.',
            },
            includeCodeXomicsAnnotationProposal: {
              type: 'boolean',
              description: 'Whether to request a conservative CodeXomics annotationProposal.',
              default: true,
            },
          },
          required: ['geneSymbol', 'organism'],
        },
      },
    };

    const serverStatuses =
      typeof manager.getServerStatus === 'function'
        ? manager.getServerStatus()
        : Array.from(manager.activeServers || []).map(serverId => ({
            id: serverId,
            connected: true,
            ...(manager.servers?.get(serverId) || {}),
          }));

    return serverStatuses
      .filter(
        server =>
          server?.connected &&
          fallbackDefinitions[server.id] &&
          !existingNames.has(server.id) &&
          !existingServerIds.has(server.id)
      )
      .map(server =>
        this.normalizeMcpTool({
          ...fallbackDefinitions[server.id],
          serverId: server.id,
          serverName: server.name || fallbackDefinitions[server.id].name,
          serverCategory: server.category || 'research',
          protocol: server.protocol || 'streamable-http',
        })
      )
      .filter(Boolean);
  }

  mergeToolsByName(tools) {
    const merged = [];
    const seen = new Set();
    for (const tool of tools) {
      const name = this.getToolName(tool);
      if (!name || seen.has(name)) continue;
      seen.add(name);
      merged.push(tool);
    }
    return merged;
  }

  scoreTool(tool, query, context = {}) {
    const text = String(query || '').toLowerCase();
    const fields = [tool.name, tool.description, tool.category, ...(Array.isArray(tool.keywords) ? tool.keywords : [])]
      .join(' ')
      .toLowerCase();

    const terms = this.expandSearchTerms(this.tokenizeSearchText(text));

    let score = 0;
    const toolName = String(tool.name || '').toLowerCase();
    if (text.includes(toolName)) score += 8;

    const normalizedToolName = toolName.replace(/[^a-z0-9]+/g, ' ').trim();
    if (normalizedToolName && text.includes(normalizedToolName)) score += 6;

    // Match name parts against the *expanded* terms. This is the strongest
    // relevance signal in the function, and comparing it against raw tokens
    // meant a translated term ("基因组" -> "genome") could never earn it.
    const nameParts = toolName.split(/[^a-z0-9]+/).filter(part => part.length > 2);
    const matchedNameParts = nameParts.filter(part => terms.includes(part));
    score += matchedNameParts.length * 4;
    if (nameParts[0] && matchedNameParts.includes(nameParts[0])) score += 6;
    if (nameParts.length > 0 && nameParts.every(part => matchedNameParts.includes(part))) {
      score += 12;
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

    const indexedFields = this.retrievalIndex?.documents?.get(tool.name) || this.getToolSearchFields(tool);
    const fieldWeights = {
      name: 3.2,
      keywords: 2.4,
      parameters: 1.5,
      category: 0.9,
      description: 0.7,
    };
    for (const term of terms) {
      const idf = this.getInverseDocumentFrequency(term);
      for (const [fieldName, tokens] of Object.entries(indexedFields)) {
        if (tokens.includes(term)) score += idf * fieldWeights[fieldName];
      }
    }

    const normalizedQuery = this.tokenizeSearchText(text).join(' ');
    for (const keyword of tool.keywords || []) {
      const phrase = this.tokenizeSearchText(keyword).join(' ');
      if (phrase && normalizedQuery.includes(phrase)) score += 4;
    }

    if (tool.execution?.requires_data && context.hasData === false) score -= 1.5;
    if (tool.execution?.requires_network && context.hasNetwork === false) score -= 1.5;

    if (
      toolName === 'blast_sequence_from_region' &&
      (text.includes('blast_sequence_from_region') ||
        (/\bblast\b/.test(text) &&
          /\b(region|range|coordinates?|current region|genomic region|chromosome)\b/.test(text) &&
          /\b(start|end|from|to|\d+)\b/.test(text)))
    ) {
      score += 10;
    }

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

  rankRelevantTools(query, context = {}) {
    const allowCoordination = this.isAgentSystemEnabled(context);
    const validTools = this.mergeToolsByName([...this.snapshot.tools, ...this.collectMcpTools()]).filter(tool => {
      if (!tool || !tool.name) return false;
      if (tool.category === 'coordination' && !allowCoordination) return false;
      return true;
    });
    const clauses = this.splitRetrievalClauses(query);
    const hasEvidence = tool => {
      const queryText = String(query || '').toLowerCase();
      const queryTerms = this.expandSearchTerms(this.tokenizeSearchText(queryText));
      const fields = this.retrievalIndex?.documents?.get(tool.name) || this.getToolSearchFields(tool);
      const allFieldTokens = new Set(Object.values(fields).flat());
      const matchedTerms = queryTerms.filter(term => allFieldTokens.has(term));
      const toolName = String(tool.name || '').toLowerCase();
      const normalizedName = this.tokenizeSearchText(toolName).join(' ');
      const directNameMatch =
        queryText.includes(toolName) || (normalizedName.length > 2 && queryText.includes(normalizedName));
      const keywordPhraseMatch = (tool.keywords || []).some(keyword => {
        const phrase = this.tokenizeSearchText(keyword).join(' ');
        return phrase.length > 2 && this.tokenizeSearchText(queryText).join(' ').includes(phrase);
      });
      const matchedNameTerms = fields.name.filter(term => queryTerms.includes(term));
      return (
        directNameMatch ||
        keywordPhraseMatch ||
        matchedTerms.length >= 2 ||
        (matchedNameTerms.length > 0 && matchedNameTerms.length === fields.name.length)
      );
    };
    const ranked = validTools
      .map(tool => {
        const globalScore = this.scoreTool(tool, query, context);
        const clauseScores = clauses.map(clause => this.scoreTool(tool, clause, context));
        const bestClauseScore = clauseScores.length > 0 ? Math.max(...clauseScores) : 0;
        const matchedClauses = clauseScores.filter(score => score > 0.6).length;
        return {
          tool,
          score: globalScore + bestClauseScore * 0.35 + matchedClauses * 0.15,
          globalScore,
          clauseScores,
        };
      })
      .filter(entry => entry.score > 0.6 && hasEvidence(entry.tool))
      .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));

    return { ranked, clauses };
  }

  selectRelevantTools(query, context = {}, limit = Infinity) {
    const retrieval = this.rankRelevantTools(query, context);
    let scoredTools = retrieval.ranked;

    const originalQueryText = String(query || '');
    const queryText = originalQueryText.toLowerCase();
    const fallbackGeneSelectionIntent = (() => {
      const explicitSelection =
        /\b(?:select|highlight|choose|pick|activate)\s+(?:the\s+)?(?:[A-Za-z][A-Za-z0-9_.-]*\s+gene|gene(?:\s+(?:named|called))?\s+[A-Za-z][A-Za-z0-9_.-]*)\b/i.test(
          originalQueryText
        ) ||
        /\b(?:select|highlight|choose|pick|activate)\s+(?:the\s+)?(?:active|current|selected)?\s*gene\b/i.test(
          originalQueryText
        );
      if (explicitSelection && !/\b(?:all|every|multiple)\b/i.test(originalQueryText)) return true;
      const shorthandMatch = originalQueryText.match(
        /\b(?:select|highlight|choose|pick|activate)\s+(?:the\s+)?([A-Za-z][A-Za-z0-9_.-]*)\b/i
      );
      if (!shorthandMatch) return false;
      const hasNonGeneTarget =
        /\b(?:all|every|multiple|primers?|themes?|styles?|modes?|models?|providers?|options?|items?|tabs?|tracks?|files?|regions?|sequences?|annotations?|features?|chromosomes?|positions?|colou?rs?|accents?|presets?|dna|rna|proteins?)\b/i.test(
          originalQueryText
        );
      return !hasNonGeneTarget && /[A-Z0-9]/.test(shorthandMatch[1].substring(1));
    })();
    const hasGeneSelectionIntent =
      typeof this.chatManager?.isGeneSelectionRequest === 'function'
        ? this.chatManager.isGeneSelectionRequest(originalQueryText)
        : fallbackGeneSelectionIntent;
    const isDirectGeneSelection =
      hasGeneSelectionIntent && !/\b(find|search|locate|look\s+for|jump|navigate|zoom|centre|center)\b/.test(queryText);
    if (isDirectGeneSelection && scoredTools.some(entry => entry.tool.name === 'select_gene')) {
      scoredTools = scoredTools.filter(
        entry => !['find_gene_by_name', 'jump_to_gene', 'zoom_to_gene'].includes(entry.tool.name)
      );
    }

    const isNonGeneSelection =
      /\b(?:select|choose|use|switch\s+to)\b[\s\S]*?\b(?:genes?|primers?|themes?|styles?|modes?|models?|providers?|options?|items?|tabs?|tracks?|files?|regions?|sequences?|annotations?|features?|chromosomes?|positions?|colou?rs?|accents?|presets?)\b/.test(
        queryText
      ) ||
      /\b(?:themes?|styles?|modes?|models?|providers?|colou?rs?|accents?|presets?)\b[\s\S]*?\b(?:select|choose|use|switch)\b/.test(
        queryText
      );
    if (isNonGeneSelection && !isDirectGeneSelection) {
      scoredTools = scoredTools.filter(
        entry => !['select_gene', 'find_gene_by_name', 'jump_to_gene', 'zoom_to_gene'].includes(entry.tool.name)
      );
    }

    const selected = [];
    const selectedNames = new Set();

    // Multi-step requests need at least one candidate from every clause before
    // the global ranking fills the remaining budget. This avoids a dominant
    // first action crowding later workflow steps out of a small-model prompt.
    if (retrieval.clauses.length > 1 && Number.isFinite(limit)) {
      for (let clauseIndex = 0; clauseIndex < retrieval.clauses.length; clauseIndex++) {
        const clauseCandidates = scoredTools
          .filter(entry => (entry.clauseScores[clauseIndex] || 0) > 0.6)
          .sort((a, b) => (b.clauseScores[clauseIndex] || 0) - (a.clauseScores[clauseIndex] || 0));
        for (const entry of clauseCandidates.slice(0, 2)) {
          if (selectedNames.has(entry.tool.name) || selected.length >= limit) continue;
          selected.push(entry.tool);
          selectedNames.add(entry.tool.name);
        }
      }
    }

    for (const entry of scoredTools) {
      if (selectedNames.has(entry.tool.name) || selected.length >= limit) continue;
      selected.push(entry.tool);
      selectedNames.add(entry.tool.name);
    }

    // Fallback tools keep a completely unmatched prompt usable. They must not
    // pad a strong, unambiguous result set with competing capabilities.
    if (selected.length === 0) {
      for (const name of this.getFallbackToolNames()) {
        if (selected.length >= 10) break;
        const fallbackTool = this.toolsByName.get(name);
        if (fallbackTool && !selected.some(tool => tool.name === name)) {
          selected.push(fallbackTool);
        }
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

  sanitizeNativeSchema(schema, isRoot = false) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return { type: 'object', properties: {}, required: [], additionalProperties: false };
    }
    const allowed = new Set([
      'type',
      'description',
      'properties',
      'required',
      'items',
      'enum',
      'const',
      'oneOf',
      'anyOf',
      'allOf',
      'minimum',
      'maximum',
      'exclusiveMinimum',
      'exclusiveMaximum',
      'minLength',
      'maxLength',
      'minItems',
      'maxItems',
      'pattern',
      'additionalProperties',
    ]);
    const sanitized = {};
    const inlineRequiredProperties = [];
    for (const [key, value] of Object.entries(schema)) {
      if (!allowed.has(key)) continue;
      if (key === 'properties' && value && typeof value === 'object') {
        sanitized.properties = Object.fromEntries(
          Object.entries(value).map(([name, propertySchema]) => {
            if (propertySchema?.required === true) inlineRequiredProperties.push(name);
            const normalizedProperty = this.sanitizeNativeSchema(propertySchema, false);
            // Some legacy registry schemas put `required: true|false` on a
            // property. JSON Schema and native tool APIs require an array on
            // the containing object, and Ollama rejects the boolean form.
            if (typeof normalizedProperty.required === 'boolean') delete normalizedProperty.required;
            return [name, normalizedProperty];
          })
        );
      } else if (key === 'items') {
        sanitized.items = this.sanitizeNativeSchema(value, false);
      } else if (['oneOf', 'anyOf', 'allOf'].includes(key) && Array.isArray(value)) {
        sanitized[key] = value.map(item => this.sanitizeNativeSchema(item, false));
      } else {
        sanitized[key] = value;
      }
    }
    if (!sanitized.type && sanitized.properties) sanitized.type = 'object';
    if (sanitized.type === 'object') {
      sanitized.properties = sanitized.properties || {};
      sanitized.required = [
        ...new Set([...(Array.isArray(sanitized.required) ? sanitized.required : []), ...inlineRequiredProperties]),
      ];
      if (sanitized.additionalProperties === undefined) {
        sanitized.additionalProperties = isRoot || Object.keys(sanitized.properties).length > 0 ? false : true;
      }
    }
    return sanitized;
  }

  toNativeFunctionTool(tool) {
    const name = this.getToolName(tool);
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(name)) return null;
    const parameters = this.sanitizeNativeSchema(this.normalizeToolSchema(tool), true);
    const propertyNames = Object.keys(parameters.properties || {});
    const requiredNames = new Set(parameters.required || []);
    const strictCompatible =
      parameters.additionalProperties === false && propertyNames.every(propertyName => requiredNames.has(propertyName));
    return {
      type: 'function',
      function: {
        name,
        description: String(tool?.description || `${name} CodeXomics tool`).slice(0, 1024),
        parameters,
        strict: strictCompatible,
      },
    };
  }

  validateSchemaValue(value, schema, path = '$') {
    if (!schema || typeof schema !== 'object') return [];
    const errors = [];
    const compositionKeyword = Array.isArray(schema.oneOf) ? 'oneOf' : Array.isArray(schema.anyOf) ? 'anyOf' : null;
    const schemas = compositionKeyword ? schema[compositionKeyword] : null;
    if (schemas) {
      // JSON Schema composition keywords are evaluated together with their sibling
      // constraints. The old validator returned here after checking only the branch,
      // which silently skipped parent properties, enums, required fields and
      // additionalProperties. That allowed schema-invalid benchmark and training calls
      // to be labelled valid whenever an anyOf/oneOf branch happened to match.
      const baseSchema = { ...schema };
      delete baseSchema.oneOf;
      delete baseSchema.anyOf;
      errors.push(...this.validateSchemaValue(value, baseSchema, path));
      const alternatives = schemas.map(candidate => this.validateSchemaValue(value, candidate, path));
      const matchingAlternatives = alternatives.filter(candidateErrors => candidateErrors.length === 0).length;
      if (compositionKeyword === 'oneOf' && matchingAlternatives !== 1) {
        errors.push(`${path} must match exactly one allowed schema (matched ${matchingAlternatives})`);
      } else if (compositionKeyword === 'anyOf' && matchingAlternatives === 0) {
        errors.push(`${path} does not match any allowed schema`);
      }
      return errors;
    }

    if (Array.isArray(schema.allOf)) {
      for (const candidate of schema.allOf) errors.push(...this.validateSchemaValue(value, candidate, path));
    }
    const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    const matchesType = type =>
      (type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) ||
      (type === 'array' && Array.isArray(value)) ||
      (type === 'string' && typeof value === 'string') ||
      (type === 'number' && typeof value === 'number' && Number.isFinite(value)) ||
      (type === 'integer' && Number.isInteger(value)) ||
      (type === 'boolean' && typeof value === 'boolean') ||
      (type === 'null' && value === null);
    const typeMatches = types.length === 0 || types.some(matchesType);
    if (!typeMatches) return [`${path} must be ${types.join(' or ')}`];

    if (Array.isArray(schema.enum) && !schema.enum.some(candidate => Object.is(candidate, value))) {
      errors.push(`${path} must be one of ${schema.enum.join(', ')}`);
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'const') && !Object.is(schema.const, value)) {
      errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
    }
    if (typeof value === 'number') {
      if (Number.isFinite(schema.minimum) && value < schema.minimum) errors.push(`${path} is below minimum`);
      if (Number.isFinite(schema.maximum) && value > schema.maximum) errors.push(`${path} is above maximum`);
    }
    if (typeof value === 'string') {
      if (Number.isFinite(schema.minLength) && value.length < schema.minLength) errors.push(`${path} is too short`);
      if (Number.isFinite(schema.maxLength) && value.length > schema.maxLength) errors.push(`${path} is too long`);
      if (schema.pattern) {
        try {
          if (!new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match required pattern`);
        } catch (error) {
          errors.push(`${path} has an invalid registry pattern`);
        }
      }
    }
    if (Array.isArray(value)) {
      if (Number.isFinite(schema.minItems) && value.length < schema.minItems) errors.push(`${path} has too few items`);
      if (Number.isFinite(schema.maxItems) && value.length > schema.maxItems) errors.push(`${path} has too many items`);
      value.forEach((item, index) => errors.push(...this.validateSchemaValue(item, schema.items, `${path}[${index}]`)));
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const properties = schema.properties || {};
      for (const required of schema.required || []) {
        if (!Object.prototype.hasOwnProperty.call(value, required)) errors.push(`${path}.${required} is required`);
      }
      for (const [key, propertyValue] of Object.entries(value)) {
        if (properties[key]) {
          errors.push(...this.validateSchemaValue(propertyValue, properties[key], `${path}.${key}`));
        } else if (schema.additionalProperties === false) {
          errors.push(`${path}.${key} is not allowed`);
        } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
          errors.push(...this.validateSchemaValue(propertyValue, schema.additionalProperties, `${path}.${key}`));
        }
      }
    }
    return errors;
  }

  validateToolCall(toolName, parameters) {
    const tool =
      this.toolsByName.get(toolName) || this.collectMcpTools().find(candidate => candidate.name === toolName);
    if (!tool) return { valid: false, errors: [`Unknown tool: ${toolName}`] };
    if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
      return { valid: false, errors: ['Tool parameters must be a JSON object'] };
    }
    const schema = this.sanitizeNativeSchema(this.normalizeToolSchema(tool), true);
    const errors = this.validateSchemaValue(parameters, schema);
    return { valid: errors.length === 0, errors, schema };
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

  splitSampleArguments(source) {
    const argumentsList = [];
    let current = '';
    let quote = null;
    let escaped = false;
    let depth = 0;

    for (const char of source) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      if (char === '\\' && quote) {
        current += char;
        escaped = true;
        continue;
      }
      if (quote) {
        current += char;
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        current += char;
        continue;
      }
      if (char === '{' || char === '[' || char === '(') depth += 1;
      if (char === '}' || char === ']' || char === ')') depth -= 1;
      if (char === ',' && depth === 0) {
        argumentsList.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) argumentsList.push(current.trim());
    return argumentsList;
  }

  parseSampleLiteral(source) {
    const value = String(source || '').trim();
    if (!value) return '';
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
      return value.substring(1, value.length - 1).replace(/\\(['"\\])/g, '$1');
    }
    if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === 'true';
    if (/^(?:null|none)$/i.test(value)) return null;
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return Number(value);

    if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
      try {
        const jsonCompatible = value
          .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner) =>
            JSON.stringify(inner.replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
          )
          .replace(/\bTrue\b/g, 'true')
          .replace(/\bFalse\b/g, 'false')
          .replace(/\bNone\b/g, 'null');
        return JSON.parse(jsonCompatible);
      } catch (error) {
        return undefined;
      }
    }

    return value;
  }

  buildCanonicalSampleCall(tool, sample) {
    const rawCall = sample?.tool_call;
    if (!rawCall) return null;

    if (typeof rawCall === 'object') {
      const name = rawCall.tool_name || rawCall.name || tool.name;
      let parameters = rawCall.parameters ?? rawCall.arguments ?? {};
      if (typeof parameters === 'string') {
        try {
          parameters = JSON.parse(parameters);
        } catch (error) {
          return null;
        }
      }
      if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) return null;
      return { tool_name: name, parameters };
    }

    const callText = String(rawCall).trim();
    try {
      const parsed = JSON.parse(callText);
      return this.buildCanonicalSampleCall(tool, { tool_call: parsed });
    } catch (error) {
      // Most registry samples use function-like notation; parse it without eval.
    }

    const match = callText.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/);
    if (!match) return null;
    const parameters = {};
    for (const argument of this.splitSampleArguments(match[2])) {
      const equalsIndex = argument.indexOf('=');
      if (equalsIndex <= 0) return null;
      const name = argument.substring(0, equalsIndex).trim();
      const value = this.parseSampleLiteral(argument.substring(equalsIndex + 1));
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || value === undefined) return null;
      parameters[name] = value;
    }

    return { tool_name: tool.name || match[1], parameters };
  }

  formatSampleUsages(tools) {
    const usages = [];
    for (const tool of tools) {
      const sample = Array.isArray(tool.sample_usages) ? tool.sample_usages[0] : null;
      if (!sample) continue;
      // YAML samples historically used JSON, Python-like calls, and provider-native
      // shapes. Render one canonical protocol so the response contract is unambiguous.
      const parsedCall = this.buildCanonicalSampleCall(tool, sample);
      if (!parsedCall) continue;
      const canonicalCall = JSON.stringify(parsedCall);
      usages.push(`- ${tool.name}: "${sample.user_query}" -> ${canonicalCall}`);
      if (usages.length >= 8) break;
    }
    return usages.length > 0 ? usages.join('\n') : '- Use JSON tool calls with the exact tool name and parameters.';
  }

  /**
   * Render the loaded sequence names for the prompt's Current Context.
   *
   * Without them the model has nothing to copy a `chromosome` argument from and
   * falls back on whatever placeholder appears in the tool examples ("chr1"),
   * which never matches a real assembly (E. coli K-12 is "U00096").
   */
  formatChromosomeNames(genomeContext = {}, limit = 25) {
    const names = Array.isArray(genomeContext.availableChromosomes)
      ? genomeContext.availableChromosomes.filter(Boolean)
      : [];
    if (names.length === 0) {
      return genomeContext.currentChromosome || 'None (no genome loaded)';
    }
    const shown = names.slice(0, limit).join(', ');
    return names.length > limit ? `${shown} (+${names.length - limit} more)` : shown;
  }

  buildPrompt(tools, context = {}) {
    const builtInTools = tools.filter(tool => tool.isBuiltIn || this.builtInTools.builtInToolsMap.has(tool.name));
    const pluginTools = tools.filter(tool => tool.source === 'plugin');
    const mcpTools = tools.filter(tool => tool.source === 'mcp');
    const extendedTools = tools.filter(
      tool => !builtInTools.includes(tool) && tool.source !== 'plugin' && tool.source !== 'mcp'
    );
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

    const mcpDescriptions =
      mcpTools.length > 0
        ? `\n## MCP Server Tools\n\n${mcpTools
            .map(
              tool =>
                `- **${tool.name}** (${tool.serverName || 'MCP Server'}): ${
                  tool.description || 'MCP server tool'
                }\n  Parameters: ${this.formatParameterList(tool)}`
            )
            .join('\n')}`
        : '';

    const currentPosition = genomeContext.currentPosition
      ? `${genomeContext.currentPosition.start}-${genomeContext.currentPosition.end}`
      : 'None';
    const availableChromosomes = this.formatChromosomeNames(genomeContext);
    const introLine = [
      'You are an advanced AI assistant for CodeXomics,',
      `equipped with ${tools.length} dynamically selected tools based on the user's query.`,
    ].join(' ');
    const activeToolsLine = [
      `${tools.length} tools available`,
      `(${builtInTools.length} directly available,`,
      `${extendedTools.length} extended,`,
      `${pluginTools.length} plugin,`,
      `${mcpTools.length} MCP)`,
    ].join(' ');

    return `# CodeXomics - Enhanced Dynamic Tools System

${introLine}

## Current Context
- Current Chromosome: ${genomeContext.currentChromosome || 'None'}
- Loaded Chromosome/Contig Names: ${availableChromosomes}
- Current Position: ${currentPosition}
- Visible Tracks: ${visibleTracks}
- Loaded Files: ${loadedFiles} files
- Sequence Length: ${genomeContext.sequenceLength || 'Unknown'}
- Network Status: ${context.hasNetwork ? 'Connected' : 'Offline'}
- Authentication: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- Active Tools: ${activeToolsLine}

A \`chromosome\` argument must be copied verbatim from the loaded names above (or from an earlier tool
result). Never invent, translate, or normalize a name: "chr1" is not a valid name unless it is listed,
and names in tool examples are illustrations, not values to reuse. When the user names no chromosome,
omit the parameter or reuse the current chromosome above.

Coordinates are 1-based base pairs. Expand the user's shorthand before calling a tool: "2M"/"2Mb" is
2000000, "500k"/"500kb" is 500000, "1,000,000" is 1000000. Never pass through the leading digits alone.

## Directly Available Tools

These tools execute inside CodeXomics and should be preferred for local browser operations.

${builtInDescriptions}

## Extended Tools

These tools provide additional registry capabilities and may require network access or external services.

${extendedDescriptions}
${pluginDescriptions}
${mcpDescriptions}

## Tool Usage Examples

${this.formatSampleUsages(tools)}

## Tool Selection Guidelines

1. Prefer directly available built-in tools when they satisfy the request.
2. Use file loading tools for importing genome, annotation, variant, reads, WIG, and operon files.
3. Return multiple tool calls together only when they are independent and all arguments are already known.
4. For sequential or dependent steps, return only the next call, inspect its result, and then choose the following call.
5. Consider current genome state, loaded data, network status, and authentication.
6. Use MCP Server Tools when a connected MCP server exposes the requested external capability.
7. Take chromosome/contig names from Current Context or a prior tool result — never from a tool example
   and never invented. Omit the parameter to use whatever chromosome is currently displayed.
8. Convert coordinate shorthand to base pairs before calling ("2M" -> 2000000, "500kb" -> 500000).

## Response Format

For a single tool call, respond with only a JSON object:
\`\`\`json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
\`\`\`

For multiple independent tool calls, respond with one JSON array of canonical tool-call objects. Never include explanatory prose around tool-call JSON.

## Tool Categories & Relationships

- File Loading Tools: import genomic data files.
- Navigation Tools: move and zoom the genome browser.
- Sequence Tools: retrieve and analyze DNA/RNA sequence.
- Database Tools: query biological databases.
- Editing Tools: mutate sequence data through ActionManager-backed actions.
- Plugin Tools: invoke installed plugin functions with plugin-id.function-name.
- MCP Server Tools: invoke tools discovered from connected MCP servers by exact tool name.
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
    return this.mergeToolsByName([...this.snapshot.tools, ...this.collectMcpTools(), ...this.collectPluginTools()]);
  }

  async getToolsByCategory(categoryName) {
    const tools = await this.getAllTools();
    return tools.filter(tool => tool.category === categoryName && tool.name);
  }

  async searchTools(keywords, limit = 10) {
    const tools = await this.getAllTools();
    return tools
      .map(tool => ({ tool, score: this.scoreTool(tool, keywords, {}) }))
      .filter(entry => entry.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => entry.tool);
  }

  async getRegistryStats() {
    const allTools = await this.getAllTools();
    const mcpTools = this.collectMcpTools();
    const pluginTools = this.collectPluginTools();
    return {
      total_tools: allTools.length,
      total_categories: this.snapshot.counts.categories || 0,
      builtin_tools: this.builtInTools.builtInToolsMap.size,
      plugin_tools: pluginTools.length,
      mcp_tools: mcpTools.length,
      user_tools: this.snapshot.counts.userTools || 0,
      unique_tools: allTools.length,
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
    const nativeTools = selectedTools.map(tool => this.toNativeFunctionTool(tool)).filter(Boolean);
    return {
      systemPrompt: this.buildPrompt(selectedTools, context),
      toolsUsed: selectedTools.map(tool => tool.name),
      toolDefinitions: selectedTools,
      nativeTools,
      toolCount: selectedTools.length,
      builtInToolsIncluded: selectedTools.filter(
        tool => tool.isBuiltIn || this.builtInTools.builtInToolsMap.has(tool.name)
      ).length,
      registryToolsIncluded: selectedTools.filter(
        tool => !tool.isBuiltIn && tool.source !== 'plugin' && tool.source !== 'mcp'
      ).length,
      pluginToolsIncluded: selectedTools.filter(tool => tool.source === 'plugin').length,
      mcpToolsIncluded: selectedTools.filter(tool => tool.source === 'mcp').length,
      generationTime: Date.now(),
      registryHash: this.snapshot.registryHash,
    };
  }

  async generateNonDynamicSystemPrompt(context = {}) {
    const allowCoordination = this.isAgentSystemEnabled(context);
    const allTools = await this.getAllTools();
    const tools = allTools.filter(tool => allowCoordination || tool.category !== 'coordination');
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
