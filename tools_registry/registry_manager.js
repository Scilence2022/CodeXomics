/**
 * CodeXomics Tools Registry Manager
 * Implements dynamic tool retrieval and injection system
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ToolsRegistryManager {
  constructor() {
    this.registryPath = __dirname;
    this.toolsCache = new Map();
    this.categoriesCache = null;
    this.lastCacheUpdate = 0;
    this.cacheTimeout = 300000; // 5 minutes

    // Tool usage tracking
    this.usageStats = new Map();
    this.userContext = new Map();

    // Initialize
    this.initializeRegistry();
  }

  /**
   * Initialize the tools registry
   */
  async initializeRegistry() {
    try {
      await this.loadCategories();
      await this.preloadCriticalTools();
      await this.scanAndCacheResidentTools();
      console.log('✅ Tools Registry Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Tools Registry Manager:', error);
    }
  }

  /**
   * Scan all tools in the registry and cache the names of resident tools
   */
  async scanAndCacheResidentTools() {
    this.residentToolNames = new Set();
    try {
      const allTools = await this.getAllTools();
      for (const tool of allTools) {
        if (tool && tool.resident === true) {
          this.residentToolNames.add(tool.name);
          // Preload resident tools in cache to make getToolDefinition super fast
          if (!this.toolsCache.has(tool.name)) {
            this.toolsCache.set(tool.name, {
              definition: tool,
              timestamp: Date.now(),
            });
          }
        }
      }
      console.log(
        `🔍 [Dynamic Tools] Cached ${this.residentToolNames.size} resident tools:`,
        Array.from(this.residentToolNames)
      );
    } catch (error) {
      console.error('Failed to scan and cache resident tools:', error);
    }
  }

  /**
   * Load tool categories metadata
   */
  async loadCategories() {
    try {
      const categoriesPath = path.join(this.registryPath, 'tool_categories.yaml');
      const categoriesData = await fs.readFile(categoriesPath, 'utf8');
      this.categoriesCache = yaml.load(categoriesData);
    } catch (error) {
      console.error('Failed to load tool categories:', error);
      this.categoriesCache = { categories: {} };
    }
  }

  /**
   * Preload critical tools for faster access
   */
  async preloadCriticalTools() {
    const criticalTools = [
      'navigate_to_position',
      'get_current_state',
      'find_gene_by_name',
      'get_sequence',
      'compute_gc',
      'calc_region_gc',
    ];

    for (const toolName of criticalTools) {
      try {
        await this.getToolDefinition(toolName);
      } catch (error) {
        console.warn(`Failed to preload critical tool ${toolName}:`, error);
      }
    }
  }

  /**
   * Get tool definition by name
   */
  async getToolDefinition(toolName) {
    // Check cache first
    if (this.toolsCache.has(toolName)) {
      const cached = this.toolsCache.get(toolName);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.definition;
      }
    }

    // Load from file
    try {
      const toolPath = await this.findToolFile(toolName);
      const toolData = await fs.readFile(toolPath, 'utf8');
      const definition = yaml.load(toolData);

      // Cache the definition
      this.toolsCache.set(toolName, {
        definition,
        timestamp: Date.now(),
      });

      return definition;
    } catch (error) {
      console.error(`Failed to load tool definition for ${toolName}:`, error);
      throw new Error(`Tool not found: ${toolName}`);
    }
  }

  /**
   * Find tool file in the registry (supports subdirectories)
   */
  async findToolFile(toolName) {
    const categories = this.categoriesCache?.categories || {};

    for (const categoryName of Object.keys(categories)) {
      const categoryPath = path.join(this.registryPath, categoryName);

      try {
        // Search recursively in the category directory
        const yamlFiles = await this.findYamlFilesRecursively(categoryPath);
        const matchingFile = yamlFiles.find(file => path.basename(file, '.yaml') === toolName);

        if (matchingFile) {
          await fs.access(matchingFile);
          return matchingFile;
        }
      } catch (error) {
        // Tool not found in this category, continue searching
        continue;
      }
    }

    throw new Error(`Tool file not found: ${toolName}.yaml`);
  }

  /**
   * Get tools by category (supports subdirectories)
   */
  async getToolsByCategory(categoryName) {
    try {
      const categoryPath = path.join(this.registryPath, categoryName);
      const tools = [];

      // Recursively search for YAML files in category directory
      const yamlFiles = await this.findYamlFilesRecursively(categoryPath);

      for (const yamlFile of yamlFiles) {
        const toolName = path.basename(yamlFile, '.yaml');
        try {
          const toolData = await fs.readFile(yamlFile, 'utf8');
          const definition = yaml.load(toolData);

          // FIX: Skip undefined/null definitions from invalid YAML files
          if (definition && typeof definition === 'object') {
            tools.push(definition);
          } else {
            console.warn(`Skipping invalid tool definition in ${yamlFile}: definition is ${typeof definition}`);
          }
        } catch (error) {
          console.warn(`Failed to load tool ${toolName}:`, error);
        }
      }

      return tools;
    } catch (error) {
      console.error(`Failed to load tools for category ${categoryName}:`, error);
      return [];
    }
  }

  /**
   * Recursively find YAML files in a directory
   */
  async findYamlFilesRecursively(dirPath) {
    const yamlFiles = [];

    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const fullPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          // Recursively search subdirectories
          const subYamlFiles = await this.findYamlFilesRecursively(fullPath);
          yamlFiles.push(...subYamlFiles);
        } else if (item.isFile() && item.name.endsWith('.yaml')) {
          yamlFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dirPath}:`, error);
    }

    return yamlFiles;
  }

  /**
   * Get all available tools
   */
  async getAllTools() {
    const allTools = [];
    const categories = this.categoriesCache?.categories || {};
    console.log('🔍 [Dynamic Tools] Available categories:', Object.keys(categories));

    for (const categoryName of Object.keys(categories)) {
      const categoryTools = await this.getToolsByCategory(categoryName);
      console.log('🔍 [Dynamic Tools] Category', categoryName, 'has', categoryTools.length, 'tools');
      allTools.push(...categoryTools);
    }

    console.log('🔍 [Dynamic Tools] Total tools loaded:', allTools.length);
    return allTools;
  }

  /**
   * Dynamic tool retrieval based on user intent
   */
  async getRelevantTools(userQuery, context = {}) {
    try {
      console.log('🔍 [Dynamic Tools] Analyzing query:', userQuery);
      console.log('🔍 [Dynamic Tools] Context:', context);

      // Analyze user intent
      const intent = await this.analyzeUserIntent(userQuery);
      console.log('🔍 [Dynamic Tools] Detected intent:', intent);

      // Get candidate tools
      const candidateTools = await this.getCandidateTools(intent, context);
      console.log('🔍 [Dynamic Tools] Candidate tools count:', candidateTools.length);

      // Score and rank tools
      const scoredTools = await this.scoreTools(candidateTools, intent, context);
      console.log('🔍 [Dynamic Tools] Scored tools count:', scoredTools.length);

      // Debug: Show top scored tools
      console.log('🔍 [Dynamic Tools] Top scored tools:');
      scoredTools.slice(0, 5).forEach((tool, index) => {
        console.log(`  ${index + 1}. ${tool.tool.name} (score: ${tool.score})`);
      });

      // Return top relevant tools
      const relevantTools = scoredTools
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Top 10 most relevant tools
        .map(item => item.tool);

      // Append resident tools if not already present
      if (this.residentToolNames) {
        for (const toolName of this.residentToolNames) {
          if (!relevantTools.some(t => t.name === toolName)) {
            try {
              const residentToolDef = await this.getToolDefinition(toolName);
              relevantTools.push(residentToolDef);
              console.log(`🔍 [Dynamic Tools] Added resident tool to prompt: ${toolName}`);
            } catch (err) {
              console.warn(`Failed to append resident tool ${toolName}:`, err);
            }
          }
        }
      }

      console.log('🔍 [Dynamic Tools] Final relevant tools count:', relevantTools.length);
      return relevantTools;
    } catch (error) {
      console.error('Failed to get relevant tools:', error);
      return await this.getFallbackTools();
    }
  }

  /**
   * Analyze user intent from query with enhanced file loading detection and multi-step support
   */
  async analyzeUserIntent(userQuery) {
    const query = userQuery.toLowerCase();
    console.log('🔍 [Dynamic Tools] Analyzing intent for query:', query);

    // Enhanced intent keywords mapping with comprehensive file loading patterns
    const intentKeywords = {
      file_loading: [
        'load',
        'open',
        'import',
        'read',
        'load file',
        'open file',
        'import file',
        'genome file',
        'annotation file',
        'variant file',
        'reads file',
        'wig file',
        'operon file',
        'fasta',
        'genbank',
        'gbk',
        'gb',
        'gff',
        'gff3',
        'bed',
        'gtf',
        'vcf',
        'sam',
        'bam',
        'wig',
        'bigwig',
        'bedgraph',
        'load genome',
        'load annotation',
        'load variant',
        'load reads',
        'load wig',
        'load operon',
        'import genome',
        'import annotation',
        'import variant',
        'import reads',
        'open genome',
        'open annotation',
        'open variant',
        'open reads',
      ],
      system: [
        'set',
        'change',
        'working directory',
        'current directory',
        'working dir',
        'current dir',
        'directory',
        'folder',
        'path',
        'cd',
        'change directory',
        'set directory',
        'set working directory',
        'change working directory',
        'working',
        'current',
        'set working',
        'change working',
        'set current',
        'change current',
        'chatbox',
        'chat box',
        'dock chatbox',
        'undock chatbox',
        'float chatbox',
        'minimize chatbox',
        'restore chatbox',
        'sidebar',
        'sidebar panel',
        'sidebar section',
        'tracks panel',
        'features panel',
        'statistics panel',
        'top banner',
        'banner',
        'show chatbox',
        'hide chatbox',
        'toggle chatbox',
        'expand sidebar',
        'collapse sidebar',
        'toggle sidebar',
        'show banner',
        'hide banner',
        'toggle banner',
      ],
      file_operations: [
        'export',
        'save',
        'download',
        'write',
        'output',
        'extract',
        'convert',
        'export file',
        'save file',
        'download file',
        'export data',
        'save data',
        'screenshot',
        'screen shot',
        'capture screenshot',
        'take screenshot',
        'save screenshot',
        'export screenshot',
        'track screenshot',
        'tracks screenshot',
        'application screenshot',
        'open image',
        'view image',
        'show image',
        'preview image',
        'export fasta',
        'export genbank',
        'export gff',
        'export bed',
        'export protein',
        'export sequences',
        'export annotations',
        'export features',
        'export current view',
        'save fasta',
        'save genbank',
        'download sequences',
        'extract data',
      ],
      navigation: [
        'navigate',
        'go to',
        'jump',
        'position',
        'location',
        'move',
        'go',
        'navigate to',
        'bookmark',
        'bookmarks',
        'saved region',
        'pinned region',
        'highlight',
        'mark',
        'restore',
        'saved view',
        'view state',
        'restore view',
        'load view',
      ],
      zoom: [
        'zoom',
        'zoom in',
        'zoom out',
        'magnify',
        'scale',
        'focus',
        'enlarge',
        'reduce',
        'view',
        'detail',
        'context',
      ],
      search: ['search', 'find', 'look for', 'query', 'locate', 'annotation', 'function', 'features'],
      analysis: ['analyze', 'calculate', 'compute', 'measure', 'count', 'analysis'],
      sequence: [
        'sequence',
        'dna',
        'rna',
        'protein',
        'amino acid',
        'translate',
        'translation',
        'reverse complement',
        'gc content',
        'codon',
        'orf',
        'frame',
      ],
      structure: ['structure', '3d', 'pdb', 'alphafold', 'protein structure'],
      database: ['database', 'uniprot', 'interpro', 'lookup', 'entry'],
      editing: [
        'edit',
        'modify',
        'change',
        'replace',
        'insert',
        'delete',
        'copy',
        'cut',
        'paste',
        'clipboard',
        'merge',
        'apply',
        'integrate',
        'research report',
        'gene research report',
        'deep gene research',
        'reject annotation proposal',
        'decline changeset',
        'dismiss change set',
        'structural annotation',
        'annotation coordinates',
        'feature coordinates',
        'batch create annotations',
        'create multiple annotations',
      ],
      pathway: ['pathway', 'metabolic', 'kegg', 'reaction', 'enzyme'],
      blast: ['blast', 'similarity', 'align', 'match', 'homolog'],
      plugin: ['plugin', 'install', 'enable', 'disable', 'marketplace'],
      primer_design: [
        'primer',
        'design primer',
        'pcr',
        'binding site',
        'melting temperature',
        'tm ',
        'oligo',
        'amplicon',
      ],
      sequence_metrics: [
        'entropy',
        'molecular weight',
        'molar mass',
        'complexity',
        'information content',
        'dalton',
        'mw ',
      ],
      benchmark: [
        'benchmark',
        'benchmarks',
        'benchmark run',
        'benchmark results',
        'benchmark status',
        'llm benchmark',
        'performance test',
        'test suite',
      ],
      task_management: [
        'task',
        'tasks',
        'todo',
        'todos',
        'add task',
        'update task',
        'create task',
        'list tasks',
        'clear tasks',
        'complete task',
        'pending task',
      ],
    };

    const detectedIntents = [];

    // Enhanced file loading detection with specific patterns
    const fileLoadingPatterns = {
      direct_path: /\/?(?:[\w.-]+\/)*[\w.-]+\.[a-z]{2,5}/i, // File path patterns
      genome_loading: /(load|open|import)\s+(genome|fasta|genbank|gbk|gb)/i,
      annotation_loading: /(load|open|import)\s+(annotation|gff|bed|gtf)/i,
      variant_loading: /(load|open|import)\s+(variant|vcf|mutation)/i,
      reads_loading: /(load|open|import)\s+(reads|sam|bam|alignment)/i,
      wig_loading: /(load|open|import)\s+(wig|wiggle|bigwig|bedgraph|track)/i,
      operon_loading: /(load|open|import)\s+(operon|operons|regulatory)/i,
      file_extension: /\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)$/i,
    };

    // Check for file loading patterns first (highest priority)
    let fileLoadingDetected = false;
    for (const [patternType, regex] of Object.entries(fileLoadingPatterns)) {
      if (regex.test(query)) {
        detectedIntents.push({
          intent: 'file_loading',
          confidence: 0.9,
          keywords: [patternType],
          pattern: patternType,
          priority: 'high',
        });
        fileLoadingDetected = true;
        console.log('🔍 [Dynamic Tools] File loading pattern detected:', patternType, 'in query');
        break; // Use first matching pattern
      }
    }

    // Standard intent keyword matching (with file_loading having highest priority)
    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      // Skip file_loading in standard matching if already detected by patterns
      if (intent === 'file_loading' && fileLoadingDetected) {
        continue;
      }

      const matches = keywords.filter(keyword => {
        // Handle multi-word keywords like "go to"
        if (keyword.includes(' ')) {
          return query.includes(keyword);
        } else {
          return query.includes(keyword);
        }
      });

      if (matches.length > 0) {
        const confidence = matches.length / keywords.length;
        // Boost confidence for file_loading intent
        const adjustedConfidence = intent === 'file_loading' ? Math.min(confidence + 0.2, 1.0) : confidence;

        detectedIntents.push({
          intent,
          confidence: adjustedConfidence,
          keywords: matches,
        });
        console.log(
          '🔍 [Dynamic Tools] Intent detected:',
          intent,
          'matches:',
          matches,
          'confidence:',
          adjustedConfidence
        );
      }
    }

    // Special handling for annotation and function keywords to register search_features tool
    if (query.includes('annotation') || query.includes('function')) {
      if (!detectedIntents.some(intent => intent.intent === 'search')) {
        detectedIntents.push({
          intent: 'search',
          confidence: 0.9,
          keywords: ['annotation', 'function', 'search_features'],
          tool_hint: 'search_features', // Special hint for tool registration
        });
        console.log(
          '🔍 [Dynamic Tools] Annotation/Function pattern detected, adding search intent with search_features hint'
        );
      } else {
        // Enhance existing search intent for annotation/function
        const searchIntent = detectedIntents.find(intent => intent.intent === 'search');
        if (searchIntent) {
          searchIntent.confidence = Math.min(searchIntent.confidence + 0.2, 1.0);
          searchIntent.keywords = [...new Set([...searchIntent.keywords, 'annotation', 'function', 'search_features'])];
          searchIntent.tool_hint = 'search_features';
          console.log('🔍 [Dynamic Tools] Enhanced existing search intent with annotation/function keywords');
        }
      }
    }

    // Special handling for position/coordinate patterns
    if (query.match(/\d+-\d+/) || query.match(/\d+:\d+/) || query.match(/position\s+\d+/)) {
      if (!detectedIntents.some(intent => intent.intent === 'navigation')) {
        detectedIntents.push({
          intent: 'navigation',
          confidence: 0.8,
          keywords: ['position', 'coordinates'],
        });
        console.log('🔍 [Dynamic Tools] Position pattern detected, adding navigation intent');
      }
    }

    const result = {
      primary: detectedIntents.sort((a, b) => b.confidence - a.confidence)[0]?.intent || 'general',
      all: detectedIntents,
      query: userQuery,
    };

    console.log('🔍 [Dynamic Tools] Final intent analysis:', result);
    return result;
  }

  /**
   * Get candidate tools based on intent
   */
  async getCandidateTools(intent, context) {
    const allTools = await this.getAllTools();

    // FIX: Filter out any undefined/null tools before processing
    let validTools = allTools.filter(tool => tool && typeof tool === 'object' && tool.name);

    // Filter out coordination tools if agentSystemEnabled is false/not enabled
    const isAgentSystemEnabled = ctx => {
      if (ctx && typeof ctx.agentSystemEnabled === 'boolean') {
        return ctx.agentSystemEnabled;
      }
      if (typeof window !== 'undefined' && window.genomeBrowser?.chatManager) {
        return !!window.genomeBrowser.chatManager.agentSystemEnabled;
      }
      return false; // Default to false
    };

    if (!isAgentSystemEnabled(context)) {
      const beforeCount = validTools.length;
      validTools = validTools.filter(tool => tool.category !== 'coordination');
      const filteredCount = beforeCount - validTools.length;
      if (filteredCount > 0) {
        console.log(
          `🔍 [Dynamic Tools] Excluded ${filteredCount} coordination tools because agentSystemEnabled is false`
        );
      }
    }

    if (validTools.length < allTools.length) {
      console.warn(`🔍 [Dynamic Tools] Filtered out ${allTools.length - validTools.length} invalid tool(s)`);
    }

    console.log('🔍 [Dynamic Tools] Valid tools available:', validTools.length);

    // Extract query keywords for direct matching
    const queryKeywords = intent.query
      .toLowerCase()
      .split(/\s+/)
      .filter(
        word => word.length > 2 && !['the', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'by', 'step'].includes(word)
      );
    console.log('🔍 [Dynamic Tools] Query keywords:', queryKeywords);

    // Get intent keywords for ALL detected intents, not just primary
    const allIntentKeywords = new Set();

    // Add primary intent keywords
    const primaryIntentKeywords = this.getIntentKeywords(intent.primary);
    primaryIntentKeywords.forEach(keyword => allIntentKeywords.add(keyword));
    console.log('🔍 [Dynamic Tools] Primary intent keywords:', primaryIntentKeywords);

    // Add keywords from all detected intents
    for (const detectedIntent of intent.all) {
      const intentKeywords = this.getIntentKeywords(detectedIntent.intent);
      intentKeywords.forEach(keyword => allIntentKeywords.add(keyword));
      console.log('🔍 [Dynamic Tools] Added keywords for intent:', detectedIntent.intent, 'keywords:', intentKeywords);
    }

    const combinedIntentKeywords = Array.from(allIntentKeywords);
    console.log('🔍 [Dynamic Tools] Combined intent keywords:', combinedIntentKeywords);

    const intentFiltered = validTools.filter(tool => {
      const toolKeywords = tool.keywords || [];

      // Check intent keyword matches (using combined keywords from all intents)
      const intentMatches = combinedIntentKeywords.some(keyword =>
        toolKeywords.some(toolKeyword => toolKeyword.toLowerCase().includes(keyword.toLowerCase()))
      );

      // Check direct query keyword matches (higher priority)
      const queryMatches = queryKeywords.some(queryKeyword =>
        toolKeywords.some(toolKeyword => toolKeyword.toLowerCase().includes(queryKeyword.toLowerCase()))
      );

      const matches = intentMatches || queryMatches;
      if (matches) {
        console.log(
          '🔍 [Dynamic Tools] Tool matched by intent:',
          tool.name,
          'keywords:',
          toolKeywords,
          'query matches:',
          queryMatches,
          'intent matches:',
          intentMatches
        );
      }
      return matches;
    });
    console.log('🔍 [Dynamic Tools] Intent filtered tools count:', intentFiltered.length);

    // Filter by context with intelligent sequence tool handling
    const contextFiltered = intentFiltered.filter(tool => {
      // Check if tool requires specific context
      if (tool.execution?.requires_auth && !context.hasAuth) {
        console.log('🔍 [Dynamic Tools] Tool filtered out (requires auth):', tool.name);
        return false;
      }

      if (tool.execution?.requires_data) {
        // Enhanced data availability check
        const hasDataAvailable =
          context.hasData || context.loadedFiles > 0 || context.loadedGenome || context.genomeBrowser?.hasData;

        if (!hasDataAvailable) {
          // BENCHMARK FIX: Allow sequence analysis tools even without genome data
          // if the query contains sequence data directly
          const isSequenceTool =
            tool.category === 'sequence' && ['translate_dna', 'reverse_complement', 'compute_gc'].includes(tool.name);
          const queryContainsSequence = /[ATCGN]{6,}/i.test(intent.query);

          if (isSequenceTool && queryContainsSequence) {
            console.log('🔍 [Dynamic Tools] Allowing sequence tool with inline sequence data:', tool.name);
          } else {
            console.log(
              '🔍 [Dynamic Tools] Tool filtered out (requires data):',
              tool.name,
              'hasData:',
              hasDataAvailable
            );
            return false;
          }
        } else {
          console.log('🔍 [Dynamic Tools] Tool allowed (data available):', tool.name, 'hasData:', hasDataAvailable);
        }
      }

      if (tool.execution?.requires_network && !context.hasNetwork) {
        console.log('🔍 [Dynamic Tools] Tool filtered out (requires network):', tool.name);
        return false;
      }

      return true;
    });
    console.log('🔍 [Dynamic Tools] Context filtered tools count:', contextFiltered.length);

    return contextFiltered;
  }

  /**
   * Get keywords for specific intent with enhanced file loading support
   */
  getIntentKeywords(intent) {
    const intentKeywordMap = {
      file_loading: [
        'load',
        'open',
        'import',
        'read',
        'file',
        'genome',
        'annotation',
        'variant',
        'reads',
        'wig',
        'operon',
        'fasta',
        'genbank',
        'gff',
        'bed',
        'vcf',
        'sam',
        'bam',
      ],
      system: [
        'set',
        'change',
        'working',
        'directory',
        'folder',
        'path',
        'cd',
        'current',
        'working directory',
        'current directory',
        'set directory',
        'change directory',
        'set working directory',
        'change working directory',
        'chatbox',
        'chat box',
        'dock chatbox',
        'undock chatbox',
        'float chatbox',
        'minimize chatbox',
        'restore chatbox',
        'sidebar',
        'sidebar panel',
        'sidebar section',
        'tracks panel',
        'features panel',
        'statistics panel',
        'top banner',
        'banner',
        'show chatbox',
        'hide chatbox',
        'toggle chatbox',
        'expand sidebar',
        'collapse sidebar',
        'toggle sidebar',
        'show banner',
        'hide banner',
        'toggle banner',
      ],
      file_operations: [
        'export',
        'save',
        'download',
        'write',
        'output',
        'extract',
        'convert',
        'fasta',
        'genbank',
        'gff',
        'bed',
        'protein',
        'sequences',
        'annotations',
        'screenshot',
        'screen shot',
        'capture',
        'snapshot',
        'image',
        'png',
        'jpeg',
        'jpg',
        'open image',
        'view image',
        'show image',
        'preview image',
      ],
      navigation: [
        'navigate',
        'position',
        'location',
        'jump',
        'go',
        'go to',
        'navigate to',
        'coordinates',
        'open',
        'new',
        'tab',
        'window',
        'browser',
        'switch',
        'switch to',
        'change',
        'activate',
        'select',
        'goto',
        'change tab',
        'select tab',
        'switch tab',
        'tab switching',
        'tab navigation',
        'tab management',
        'bookmark',
        'bookmarks',
        'saved region',
        'pinned region',
        'highlight',
        'mark',
        'highlighted region',
        'clear highlights',
        'restore',
        'saved view',
        'view state',
        'restore view',
        'load view',
      ],
      zoom: [
        'zoom',
        'zoom in',
        'zoom out',
        'magnify',
        'scale',
        'focus',
        'enlarge',
        'reduce',
        'view',
        'detail',
        'context',
      ],
      search: ['search', 'find', 'query', 'lookup', 'annotation', 'function', 'features'],
      analysis: ['analyze', 'calculate', 'compute', 'measure'],
      sequence: [
        'sequence',
        'dna',
        'rna',
        'protein',
        'restriction',
        'enzyme',
        'digest',
        'cleavage',
        'recognition site',
        'gel',
        'electrophoresis',
        'agarose',
        'marker',
        'ladder',
      ],
      structure: ['structure', '3d', 'pdb', 'alphafold'],
      database: ['database', 'uniprot', 'interpro'],
      editing: [
        'edit',
        'modify',
        'change',
        'replace',
        'copy',
        'cut',
        'paste',
        'insert',
        'delete',
        'clipboard',
        'merge',
        'apply',
        'integrate',
        'research report',
        'gene research report',
        'deep gene research',
        'structural annotation',
        'annotation coordinates',
        'feature coordinates',
        'batch create annotations',
        'create multiple annotations',
      ],
      pathway: ['pathway', 'metabolic', 'kegg'],
      blast: ['blast', 'similarity', 'align'],
      plugin: ['plugin', 'install', 'enable'],
      primer_design: ['primer', 'design', 'pcr', 'binding', 'tm', 'oligo', 'amplicon', 'properties'],
      benchmark: [
        'benchmark',
        'benchmarks',
        'start',
        'stop',
        'pause',
        'resume',
        'results',
        'status',
        'export',
        'performance',
        'test suite',
        'llm',
      ],
      task_management: [
        'task',
        'tasks',
        'todo',
        'todos',
        'add',
        'update',
        'create',
        'list',
        'clear',
        'complete',
        'pending',
      ],
    };

    return intentKeywordMap[intent] || [];
  }

  /**
   * Score tools based on relevance
   */
  async scoreTools(tools, intent, context) {
    return tools
      .map(tool => {
        let score = 0;

        // Base score from priority
        score += (4 - (tool.priority || 3)) * 10;

        // Extract query keywords for direct matching
        const queryKeywords = intent.query
          .toLowerCase()
          .split(/\s+/)
          .filter(
            word => word.length > 2 && !['the', 'and', 'or', 'of', 'in', 'to', 'for', 'with', 'by'].includes(word)
          );

        // Direct query keyword matching score (higher priority)
        const toolKeywords = tool.keywords || [];
        const queryMatches = queryKeywords.filter(queryKeyword =>
          toolKeywords.some(toolKeyword => toolKeyword.toLowerCase().includes(queryKeyword.toLowerCase()))
        ).length;
        score += queryMatches * 25; // Higher weight for direct query matches

        // Intent matching score - check against all detected intents
        let totalIntentScore = 0;
        const primaryIntentKeywords = this.getIntentKeywords(intent.primary);
        const primaryMatches = primaryIntentKeywords.filter(keyword =>
          toolKeywords.some(toolKeyword => toolKeyword.toLowerCase().includes(keyword.toLowerCase()))
        ).length;
        totalIntentScore += primaryMatches * 15; // Primary intent gets full weight

        // Add scoring for all detected intents
        for (const detectedIntent of intent.all) {
          if (detectedIntent.intent !== intent.primary) {
            const intentKeywords = this.getIntentKeywords(detectedIntent.intent);
            const matches = intentKeywords.filter(keyword =>
              toolKeywords.some(toolKeyword => toolKeyword.toLowerCase().includes(keyword.toLowerCase()))
            ).length;
            totalIntentScore += matches * 10 * detectedIntent.confidence; // Secondary intents weighted by confidence
          }
        }
        score += totalIntentScore;

        // Special handling for file loading tools with high priority scoring
        if (tool.category === 'file_loading' && intent.primary === 'file_loading') {
          score += 100; // Very high bonus for file loading tools when file loading intent detected
          console.log('🔍 [Dynamic Tools] File loading tool bonus applied:', tool.name);

          // Additional bonus for specific file type matching
          const queryLower = intent.query.toLowerCase();
          if (
            tool.subcategory === 'genome_loading' &&
            (queryLower.includes('genome') || queryLower.includes('fasta') || queryLower.includes('genbank'))
          ) {
            score += 50;
          } else if (
            tool.subcategory === 'annotation_loading' &&
            (queryLower.includes('annotation') || queryLower.includes('gff') || queryLower.includes('bed'))
          ) {
            score += 50;
          } else if (
            tool.subcategory === 'variant_loading' &&
            (queryLower.includes('variant') || queryLower.includes('vcf'))
          ) {
            score += 50;
          } else if (
            tool.subcategory === 'reads_loading' &&
            (queryLower.includes('reads') || queryLower.includes('sam') || queryLower.includes('bam'))
          ) {
            score += 50;
          } else if (
            tool.subcategory === 'wig_loading' &&
            (queryLower.includes('wig') || queryLower.includes('track'))
          ) {
            score += 50;
          } else if (tool.subcategory === 'operon_loading' && queryLower.includes('operon')) {
            score += 50;
          }
        }

        // Special handling for file operations (export) tools with high priority scoring
        if (tool.category === 'file_operations' && intent.primary === 'file_operations') {
          score += 100; // Very high bonus for export tools when export intent detected
          console.log('🔍 [Dynamic Tools] File operations tool bonus applied:', tool.name);

          // Additional bonus for specific export type matching
          const queryLower = intent.query.toLowerCase();
          if (tool.name.includes('fasta') && (queryLower.includes('fasta') || queryLower.includes('sequence'))) {
            score += 50;
          } else if (
            tool.name.includes('genbank') &&
            (queryLower.includes('genbank') || queryLower.includes('genome'))
          ) {
            score += 50;
          } else if (tool.name.includes('gff') && (queryLower.includes('gff') || queryLower.includes('annotation'))) {
            score += 50;
          } else if (tool.name.includes('bed') && (queryLower.includes('bed') || queryLower.includes('feature'))) {
            score += 50;
          } else if (tool.name.includes('protein') && queryLower.includes('protein')) {
            score += 50;
          } else if (tool.name.includes('current_view') && queryLower.includes('current')) {
            score += 50;
          }
        }

        // Special bonus for search_features tool when annotation or function keywords are detected
        if (
          tool.name === 'search_features' &&
          (intent.query.toLowerCase().includes('annotation') || intent.query.toLowerCase().includes('function'))
        ) {
          score += 80; // High bonus for search_features with annotation/function keywords
          console.log('🔍 [Dynamic Tools] search_features annotation/function bonus applied:', tool.name);
        }

        // Special bonus for search tools with tool hints from intent analysis
        if (
          intent.all &&
          intent.all.some(
            detectedIntent => detectedIntent.tool_hint === tool.name && detectedIntent.intent === 'search'
          )
        ) {
          score += 100; // Very high bonus for tools with specific hints
          console.log('🔍 [Dynamic Tools] Tool hint bonus applied for search_features:', tool.name);
        }

        // Special bonus for zoom tools when zoom keywords are detected
        if (
          (tool.name === 'zoom_in' || tool.name === 'zoom_out') &&
          (intent.query.toLowerCase().includes('zoom') ||
            intent.query.toLowerCase().includes('magnify') ||
            intent.query.toLowerCase().includes('scale'))
        ) {
          score += 80; // High bonus for zoom tools with zoom keywords
          console.log('🔍 [Dynamic Tools] Zoom tool bonus applied:', tool.name);
        }

        // Special bonus for navigation tools when position patterns are detected
        if (tool.category === 'navigation' && (intent.query.match(/\d+-\d+/) || intent.query.match(/\d+:\d+/))) {
          score += 50; // High bonus for navigation tools with position patterns
          console.log('🔍 [Dynamic Tools] Navigation tool bonus applied for position pattern:', tool.name);
        }

        // Special bonus for "go to" queries with navigation tools
        if (tool.category === 'navigation' && intent.query.toLowerCase().includes('go')) {
          score += 30; // Bonus for "go" queries
          console.log('🔍 [Dynamic Tools] Navigation tool bonus applied for "go" query:', tool.name);
        }

        // Special bonus for BLAST directly against a loaded genomic region.
        if (
          tool.name === 'blast_sequence_from_region' &&
          (/\bblast_sequence_from_region\b/i.test(intent.query) ||
            (/\bblast\b/i.test(intent.query) &&
              /\b(region|range|coordinates?|current\s+region|genomic\s+region|chromosome)\b/i.test(intent.query) &&
              /\b(start|end|from|to|\d+)\b/i.test(intent.query)))
        ) {
          score += 120;
          console.log('🔍 [Dynamic Tools] Region BLAST bonus applied:', tool.name);
        }

        // Special bonus for "copy" operations with sequence editing tools
        if (tool.name === 'copy_sequence' && intent.query.toLowerCase().includes('copy')) {
          score += 100; // Very high bonus for copy_sequence when "copy" is in query
          console.log('🔍 [Dynamic Tools] Copy sequence bonus applied:', tool.name);
        }

        // Special bonus for editing tools when editing keywords are detected
        if (tool.category === 'sequence_editing' && intent.primary === 'editing') {
          score += 60; // High bonus for sequence editing tools
          console.log('🔍 [Dynamic Tools] Sequence editing tool bonus applied:', tool.name);

          // Additional specific operation bonuses
          const queryLower = intent.query.toLowerCase();
          if (tool.name.includes('copy') && queryLower.includes('copy')) {
            score += 40;
          } else if (tool.name.includes('paste') && queryLower.includes('paste')) {
            score += 40;
          } else if (tool.name.includes('cut') && queryLower.includes('cut')) {
            score += 40;
          } else if (tool.name.includes('delete') && queryLower.includes('delete')) {
            score += 40;
          } else if (tool.name.includes('insert') && queryLower.includes('insert')) {
            score += 40;
          } else if (tool.name.includes('replace') && queryLower.includes('replace')) {
            score += 40;
          }
        }

        // Usage frequency score
        const usageStats = this.usageStats.get(tool.name) || { count: 0, success_rate: 0 };
        score += Math.log(usageStats.count + 1) * 5;
        score += usageStats.success_rate * 10;

        // Context relevance score
        if (context.currentCategory && tool.category === context.currentCategory) {
          score += 20;
        }

        // Tool relationship score
        if (tool.relationships?.enhances) {
          score += 5;
        }

        return { tool, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get fallback tools when intent analysis fails
   */
  async getFallbackTools() {
    const fallbackToolNames = [
      'navigate_to_position',
      'get_current_state',
      'find_gene_by_name',
      'get_sequence',
      'compute_gc',
      'calc_region_gc',
    ];

    const tools = [];
    for (const toolName of fallbackToolNames) {
      try {
        const definition = await this.getToolDefinition(toolName);
        tools.push(definition);
      } catch (error) {
        console.warn(`Failed to load fallback tool ${toolName}:`, error);
      }
    }

    return tools;
  }

  /**
   * Generate system prompt with relevant tools
   */
  async generateSystemPrompt(userQuery, context = {}) {
    try {
      // Get relevant tools
      const relevantTools = await this.getRelevantTools(userQuery, context);

      // Generate tool descriptions
      const toolDescriptions = relevantTools
        .map(tool => {
          const params = Object.entries(tool.parameters?.properties || {})
            .map(([name, param]) => `${name}: ${param.type} - ${param.description}`)
            .join(', ');

          return `- **${tool.name}**: ${tool.description}\n  Parameters: ${params}`;
        })
        .join('\n');

      // Generate sample usages
      const sampleUsages = relevantTools
        .filter(tool => tool.sample_usages && tool.sample_usages.length > 0)
        .map(tool => {
          const sample = tool.sample_usages[0];
          return `- **${tool.name}**: "${sample.user_query}" → \`${sample.tool_call}\``;
        })
        .join('\n');

      return {
        tools: relevantTools,
        toolDescriptions,
        sampleUsages,
        totalTools: relevantTools.length,
      };
    } catch (error) {
      console.error('Failed to generate system prompt:', error);
      return {
        tools: [],
        toolDescriptions: '',
        sampleUsages: '',
        totalTools: 0,
      };
    }
  }

  /**
   * Track tool usage for optimization
   */
  trackToolUsage(toolName, success, executionTime) {
    const stats = this.usageStats.get(toolName) || {
      count: 0,
      success_count: 0,
      total_time: 0,
      success_rate: 0,
    };

    stats.count++;
    if (success) stats.success_count++;
    stats.total_time += executionTime;
    stats.success_rate = stats.success_count / stats.count;

    this.usageStats.set(toolName, stats);
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats() {
    const stats = {};
    for (const [toolName, data] of this.usageStats.entries()) {
      stats[toolName] = {
        usage_count: data.count,
        success_rate: data.success_rate,
        avg_execution_time: data.total_time / data.count,
      };
    }
    return stats;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.toolsCache.clear();
    this.categoriesCache = null;
    this.lastCacheUpdate = 0;
  }

  /**
   * Get registry statistics
   */
  async getRegistryStats() {
    const allTools = await this.getAllTools();
    const categories = this.categoriesCache?.categories || {};

    return {
      total_tools: allTools.length,
      total_categories: Object.keys(categories).length,
      cached_tools: this.toolsCache.size,
      usage_tracked: this.usageStats.size,
      categories: Object.entries(categories).map(([name, info]) => ({
        name,
        tools_count: info.tools_count,
        priority: info.priority,
      })),
    };
  }
}

module.exports = ToolsRegistryManager;
