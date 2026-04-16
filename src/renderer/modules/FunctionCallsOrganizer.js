/**
 * FunctionCallsOrganizer - 组织和优化function calls的执行策略
 * 按照功能类型分类执行，优化ChatBox响应速度和准确性
 * Enhanced with dynamic plugin tools integration
 */
class FunctionCallsOrganizer {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;

    // Track dynamically registered plugin tools
    this.dynamicPluginTools = new Map();

    // 功能分类定义
    this.functionCategories = {
      // 类别1: 浏览器行为类 - 高优先级，立即执行
      browserActions: {
        priority: 1,
        description: 'Browser behavior and visual interface actions',
        functions: [
          'navigate_to_position',
          'zoom_to_gene',
          'zoom_in',
          'zoom_out',
          'scroll_left',
          'scroll_right',
          'toggle_track',
          'get_current_state',
          'get_track_status',
          'bookmark_position',
          'get_bookmarks',
          'save_view_state',
          'navigate_to',
          'jump_to_gene',
          'get_current_region',
          'open_new_tab',
          'switch_to_tab',
          'set_working_directory',
        ],
      },

      // 类别2: 数据检索类 - 中等优先级，快速执行
      dataRetrieval: {
        priority: 2,
        description: 'Data retrieval and basic information queries',
        functions: [
          'get_sequence',
          'get_gene_details',
          'get_chromosome_list',
          'search_features',
          'search_gene_by_name',
          'search_by_position',
          'get_nearby_features',
          'get_operons',
          'get_file_info',
          'get_genome_info', // CRITICAL FIX: Added missing tool
          'search_pattern',
          'search_motif',
          'search_sequence_motif',
          'get_coding_sequence',
          // File loading tools - CRITICAL FIX
          'load_genome_file',
          'load_annotation_file',
          'load_variant_file',
          'load_reads_file',
          'load_wig_tracks',
          'load_operon_file',
          'get_loaded_files_list',
        ],
      },

      // 类别3: 序列分析类 - 中等优先级，可能需要计算时间
      sequenceAnalysis: {
        priority: 3,
        description: 'Sequence analysis and computational tools',
        functions: [
          'translate_sequence',
          'calculate_gc_content',
          'reverse_complement',
          'translate_dna',
          'calculate_entropy',
          'calc_region_gc',
          'compute_gc',
          'sequence_statistics',
          'codon_usage_analysis',
          'analyze_codon_usage',
          'amino_acid_composition',
          'calculate_melting_temp',
          'calculate_molecular_weight',
        ],
      },

      // 类别4: 高级分析类 - 低优先级，计算密集型
      advancedAnalysis: {
        priority: 4,
        description: 'Advanced analysis and prediction tools',
        functions: [
          'analyze_region',
          'find_intergenic_regions',
          'search_intergenic_regions',
          'find_restriction_sites',
          'virtual_digest',
          'predict_promoter',
          'predict_rbs',
          'predict_terminator',
          'compare_regions',
          'find_similar_sequences',
        ],
      },

      // 类别5: BLAST搜索类 - 低优先级，网络依赖型
      blastSearch: {
        priority: 5,
        description: 'BLAST searches and similarity analysis',
        functions: [
          'blast_search',
          'blast_sequence_from_region',
          'get_blast_databases',
          'batch_blast_search',
          'advanced_blast_search',
          'local_blast_database_info',
        ],
      },

      // 类别6: 数据操作类 - 变动优先级，根据操作类型决定
      dataManipulation: {
        priority: 3,
        description: 'Data creation, editing, and export operations',
        functions: [
          'create_annotation',
          'edit_annotation',
          'delete_annotation',
          'add_annotation',
          'batch_create_annotations',
          'merge_annotations',
          'export_data',
          'export_region_features',
          'add_track',
          'add_variant',
          'delete_sequence',
          'insert_sequence',
          'replace_sequence',
          'copy_sequence',
          'cut_sequence',
          'paste_sequence',
          'get_action_list',
          'execute_actions',
          'clear_actions',
          'get_clipboard_content',
          'codon_usage_analysis',
          'genome_codon_usage_analysis',
        ],
      },

      // 类别7: 蛋白质结构类 - 低优先级，外部依赖型
      proteinStructure: {
        priority: 5,
        description: 'Protein structure visualization and analysis',
        functions: [
          'open_protein_viewer',
          'fetch_protein_structure',
          'search_pdb_structures', // New preferred name
          'search_alphafold_structures',

          'fetch_alphafold_structure',
          'get_pdb_details',
        ],
      },

      // 类别8: 插件系统V2 - 功能插件（快速执行）
      pluginFunctions: {
        priority: 3,
        description: 'Plugin Manager V2 - Function plugins for analysis',
        functions: [
          // Genomic Analysis Plugin V2
          'genomic-analysis.analyzeGCContent',
          'genomic-analysis.findMotifs',
          'genomic-analysis.calculateDiversity',
          'genomic-analysis.compareRegions',

          // Phylogenetic Analysis Plugin V2
          'phylogenetic-analysis.buildPhylogeneticTree',
          'phylogenetic-analysis.calculateEvolutionaryDistance',

          // Machine Learning Analysis Plugin V2
          'ml-analysis.predictGeneFunction',
          'ml-analysis.classifySequence',
        ],
      },

      // 类别9: 插件系统V2 - 实用工具插件（高优先级）
      pluginUtilities: {
        priority: 2,
        description: 'Plugin Manager V2 - Utility plugins for common tasks',
        functions: ['sequence-utils.reverseComplement', 'sequence-utils.translateSequence'],
      },

      // 类别10: 插件系统V2 - 可视化插件（低优先级）
      pluginVisualizations: {
        priority: 5,
        description: 'Plugin Manager V2 - Visualization plugins',
        functions: [
          // Visualization plugins are dynamically registered
          // Base tools registered here, dynamic tools added via registerPluginTools()
          'protein-interaction-network.visualize',
          'protein-interaction-network.renderNetwork',
        ],
      },

      // 类别11: 生物网络分析（保持向后兼容）
      pluginNetworkAnalysis: {
        priority: 4,
        description: 'Legacy biological network analysis functions',
        functions: [
          'biological-networks.buildProteinInteractionNetwork',
          'biological-networks.buildGeneRegulatoryNetwork',
          'biological-networks.analyzeNetworkCentrality',
          'biological-networks.detectNetworkCommunities',
        ],
      },

      // 类别12: 数据库集成类 - 中等优先级，网络依赖型
      databaseIntegration: {
        priority: 3,
        description: 'Database integration and external API access',
        functions: [
          'search_uniprot_database',
          'advanced_uniprot_search',
          'get_uniprot_entry',
          'analyze_interpro_domains',
          'search_interpro_entry',
          'get_interpro_entry_details',
        ],
      },

      // 类别13: 数据导出类 - 中等优先级，文件操作型
      dataExport: {
        priority: 3,
        description: 'Data export and file generation operations',
        functions: [
          'export_fasta_sequence',
          'export_genbank_format',
          'export_cds_fasta',
          'export_protein_fasta',
          'export_gff_annotations',
          'export_bed_format',
          'export_current_view_fasta',
        ],
      },

      // 类别14: 插件管理类 - 中等优先级，系统管理型
      pluginManagement: {
        priority: 3,
        description: 'Plugin management and execution operations',
        functions: [
          'get_plugin_info',
          'install_plugin',
          'uninstall_plugin',
          'enable_plugin',
          'disable_plugin',
          'execute_plugin',
          'call_plugin_function',
          'get_plugin_functions',
          'create_plugin',
          'validate_plugin',
          'search_plugins',
        ],
      },

      // 类别15: 协调管理类 - 中等优先级，任务协调型
      coordination: {
        priority: 3,
        description: 'Task coordination and workflow management',
        functions: [
          'decompose_task',
          'integrate_results',
          'create_workflow',
          'execute_workflow',
          'assign_task_to_agent',
          'get_agent_status',
          'balance_load',
          'handle_error',
          'retry_failed_task',
          'fallback_strategy',
          'optimize_execution',
          'cache_strategy',
          'parallel_execution',
          'get_workflow_status',
        ],
      },

      // 类别16: 外部API类 - 低优先级，网络依赖型
      externalApis: {
        priority: 5,
        description: 'External API calls and third-party integrations',
        functions: ['blast_sequence', 'uniprot_search', 'alphafold_search', 'alphafold_get_structure', 'evo2_design'],
      },

      // 类别17: 基准测试管理类 - 中等优先级，UI管理型
      benchmarkManagement: {
        priority: 3,
        description: 'LLM benchmark execution, control, and results management',
        functions: [
          'open_benchmark',
          'start_benchmark',
          'stop_benchmark',
          'pause_benchmark',
          'resume_benchmark',
          'get_benchmark_results',
          'get_benchmark_status',
          'export_benchmark_results',
        ],
      },
    };

    // 功能映射表
    this.functionToCategory = this.buildFunctionMapping();
  }

  /**
   * 构建功能到类别的映射表
   */
  buildFunctionMapping() {
    const mapping = new Map();
    for (const [categoryName, category] of Object.entries(this.functionCategories)) {
      for (const functionName of category.functions) {
        mapping.set(functionName, categoryName);
      }
    }
    return mapping;
  }

  /**
   * 根据用户请求分析需要的功能类型组合
   * @param {string} userMessage - 用户消息
   * @param {Array} requestedTools - 请求的工具列表
   * @returns {Object} 分析结果
   */
  analyzeRequestStrategy(userMessage, requestedTools = []) {
    const strategy = {
      categories: new Set(),
      priorityGroups: new Map(),
      executionPlan: [],
      estimatedTime: 0,
    };

    // 分析用户消息中的关键词
    const messageKeywords = this.extractKeywords(userMessage.toLowerCase());

    console.log('📊 [FunctionCallsOrganizer] analyzeRequestStrategy:', {
      userMessage,
      requestedTools,
      messageKeywords,
    });

    // 分析请求的工具
    for (const tool of requestedTools) {
      const category = this.functionToCategory.get(tool);
      console.log(`🔍 [FunctionCallsOrganizer] Tool: ${tool}, Category: ${category}`);

      if (category) {
        strategy.categories.add(category);

        const categoryInfo = this.functionCategories[category];
        if (!strategy.priorityGroups.has(categoryInfo.priority)) {
          strategy.priorityGroups.set(categoryInfo.priority, []);
        }
        strategy.priorityGroups.get(categoryInfo.priority).push({
          tool: tool,
          category: category,
        });
      } else {
        console.warn(`⚠️ [FunctionCallsOrganizer] Tool '${tool}' not found in category mapping`);
      }
    }

    // 基于关键词推断可能需要的功能类型
    const inferredCategories = this.inferCategoriesFromKeywords(messageKeywords);
    for (const category of inferredCategories) {
      strategy.categories.add(category);
    }

    // 构建执行计划
    strategy.executionPlan = this.buildExecutionPlan(strategy.priorityGroups);
    strategy.estimatedTime = this.estimateExecutionTime(strategy.executionPlan);

    return strategy;
  }

  /**
   * 提取消息中的关键词
   */
  extractKeywords(message) {
    const keywords = {
      navigation: [
        'navigate',
        'go to',
        'jump to',
        'zoom',
        'scroll',
        'move to',
        'position',
        'switch',
        'tab',
        'change tab',
        'open tab',
        'directory',
        'folder',
        'working',
        'set',
        'cd',
      ],
      search: ['search', 'find', 'look for', 'locate', 'get'],
      analysis: ['analyze', 'calculate', 'compute', 'predict', 'statistics'],
      blast: ['blast', 'similarity', 'homology', 'compare with database'],
      visualization: ['show', 'display', 'toggle', 'hide', 'visible', 'track'],
      sequence: ['sequence', 'dna', 'rna', 'protein', 'translate', 'gc content'],
      annotation: ['annotate', 'add', 'edit', 'delete', 'modify', 'create'],
    };

    const found = {};
    for (const [type, words] of Object.entries(keywords)) {
      found[type] = words.some(word => message.includes(word));
    }

    return found;
  }

  /**
   * 基于关键词推断功能类别
   */
  inferCategoriesFromKeywords(keywords) {
    const categories = [];

    if (keywords.navigation || keywords.visualization) {
      categories.push('browserActions');
    }

    if (keywords.search) {
      categories.push('dataRetrieval');
    }

    if (keywords.sequence || keywords.analysis) {
      categories.push('sequenceAnalysis');
    }

    if (keywords.blast) {
      categories.push('blastSearch');
    }

    if (keywords.annotation) {
      categories.push('dataManipulation');
    }

    return categories;
  }

  /**
   * 构建执行计划
   */
  buildExecutionPlan(priorityGroups) {
    const plan = [];

    // 按优先级排序
    const sortedPriorities = Array.from(priorityGroups.keys()).sort((a, b) => a - b);

    for (const priority of sortedPriorities) {
      const group = priorityGroups.get(priority);
      plan.push({
        priority: priority,
        phase: this.getPhaseName(priority),
        tools: group,
        parallelizable: this.isParallelizable(priority, group),
        estimatedTime: this.estimatePhaseTime(priority, group.length),
      });
    }

    return plan;
  }

  /**
   * 获取阶段名称
   */
  getPhaseName(priority) {
    const phases = {
      1: 'Immediate Browser Actions',
      2: 'Data Retrieval',
      3: 'Sequence Analysis',
      4: 'Advanced Analysis',
      5: 'External Services',
    };
    return phases[priority] || 'Unknown Phase';
  }

  /**
   * 判断是否可以并行执行
   */
  isParallelizable(priority, tools = []) {
    // 浏览器行为通常需要顺序执行
    if (priority === 1) return false;

    // File loading tools should be executed sequentially for proper dependency order
    const fileLoadingTools = [
      'load_genome_file',
      'load_annotation_file',
      'load_variant_file',
      'load_reads_file',
      'load_wig_tracks',
      'load_operon_file',
    ];

    // Extract tool names from the tools array (tools may be objects with .tool property)
    const toolNames = tools.map(t => (typeof t === 'string' ? t : t.tool || t.tool_name || t));

    // Check if any of the tools are file loading tools
    const hasFileLoadingTools = toolNames.some(toolName => fileLoadingTools.includes(toolName));
    if (hasFileLoadingTools) {
      console.log('🔄 File loading tools detected - forcing sequential execution');
      console.log('Tool names detected:', toolNames);
      return false;
    }

    // 其他类型可以并行执行
    return true;
  }

  /**
   * 估算阶段执行时间（毫秒）
   */
  estimatePhaseTime(priority, toolCount) {
    const baseTime = {
      1: 100, // 浏览器行为 - 很快
      2: 200, // 数据检索 - 快
      3: 500, // 序列分析 - 中等
      4: 1000, // 高级分析 - 慢
      5: 2000, // 外部服务 - 很慢
    };

    return (baseTime[priority] || 500) * toolCount;
  }

  /**
   * 估算总执行时间
   */
  estimateExecutionTime(executionPlan) {
    return executionPlan.reduce((total, phase) => {
      return total + (phase.parallelizable ? phase.estimatedTime / 2 : phase.estimatedTime);
    }, 0);
  }

  /**
   * 优化执行策略的主入口方法
   * @param {string} userMessage - 用户消息
   * @param {Array} requestedTools - 请求的工具
   * @returns {Object} 优化的执行策略
   */
  async optimizeExecution(userMessage, requestedTools) {
    // 分析请求策略
    const strategy = this.analyzeRequestStrategy(userMessage, requestedTools);

    // 生成执行报告
    const report = this.generateExecutionReport(strategy);

    // 返回优化建议
    return {
      strategy: strategy,
      report: report,
      recommendations: this.generateRecommendations(strategy),
    };
  }

  /**
   * 生成执行报告
   */
  generateExecutionReport(strategy) {
    return {
      totalCategories: strategy.categories.size,
      totalPhases: strategy.executionPlan.length,
      estimatedTime: `${Math.round((strategy.estimatedTime / 1000) * 10) / 10}s`,
      phases: strategy.executionPlan.map(phase => ({
        name: phase.phase,
        priority: phase.priority,
        toolCount: phase.tools.length,
        parallel: phase.parallelizable,
        time: `${Math.round((phase.estimatedTime / 1000) * 10) / 10}s`,
      })),
    };
  }

  /**
   * 生成优化建议
   */
  generateRecommendations(strategy) {
    const recommendations = [];

    // 检查是否有浏览器行为需要优先执行
    if (strategy.categories.has('browserActions')) {
      recommendations.push({
        type: 'priority',
        message: 'Browser actions will be executed first for immediate visual feedback',
      });
    }

    // 检查是否有耗时操作
    if (strategy.categories.has('blastSearch') || strategy.categories.has('advancedAnalysis')) {
      recommendations.push({
        type: 'performance',
        message: 'Time-consuming operations detected. Consider running in background',
      });
    }

    // 检查是否可以并行执行
    const parallelPhases = strategy.executionPlan.filter(p => p.parallelizable);
    if (parallelPhases.length > 1) {
      recommendations.push({
        type: 'optimization',
        message: `${parallelPhases.length} phases can be executed in parallel to improve speed`,
      });
    }

    return recommendations;
  }

  /**
   * 按类别获取功能列表
   */
  getFunctionsByCategory(categoryName) {
    return this.functionCategories[categoryName]?.functions || [];
  }

  /**
   * 获取功能的类别信息
   */
  getFunctionCategory(functionName) {
    // 首先检查传统功能映射
    const categoryName = this.functionToCategory.get(functionName);
    if (categoryName) {
      return {
        name: categoryName,
        ...this.functionCategories[categoryName],
      };
    }

    // 检查是否为插件功能（包含点号的函数名）
    if (functionName.includes('.')) {
      const [pluginId] = functionName.split('.');

      // 根据插件ID确定分类
      switch (pluginId) {
        case 'genomic-analysis':
          return {
            name: 'pluginGenomicAnalysis',
            ...this.functionCategories.pluginGenomicAnalysis,
          };
        case 'phylogenetic-analysis':
          return {
            name: 'pluginPhylogenetic',
            ...this.functionCategories.pluginPhylogenetic,
          };
        case 'biological-networks':
          return {
            name: 'pluginNetworkAnalysis',
            ...this.functionCategories.pluginNetworkAnalysis,
          };
        case 'ml-analysis':
          return {
            name: 'pluginMachineLearning',
            ...this.functionCategories.pluginMachineLearning,
          };
        default:
          // 未知插件，返回默认分类
          return {
            name: 'pluginGeneral',
            priority: 3,
            description: 'General plugin functions',
            functions: [],
          };
      }
    }

    return null;
  }

  /**
   * 获取所有类别的统计信息
   */
  getCategoryStatistics() {
    const stats = {};
    for (const [name, category] of Object.entries(this.functionCategories)) {
      stats[name] = {
        description: category.description,
        priority: category.priority,
        functionCount: category.functions.length,
        functions: category.functions,
      };
    }
    return stats;
  }

  /**
   * Register plugin tools dynamically from PluginManagerV2
   * Called when plugins are installed/activated
   * @param {PluginManagerV2} pluginManager - The plugin manager instance
   */
  registerPluginTools(pluginManager) {
    if (!pluginManager) {
      console.warn('⚠️ [FunctionCallsOrganizer] No plugin manager provided');
      return;
    }

    try {
      console.log('🔌 [FunctionCallsOrganizer] Registering plugin tools...');

      // Clear existing dynamic tools
      this.dynamicPluginTools.clear();

      // Get visualization plugins
      const visualizations = pluginManager.getAvailableVisualizations ? pluginManager.getAvailableVisualizations() : [];

      for (const viz of visualizations) {
        const toolName = `${viz.id}.visualize`;
        const renderName = `${viz.id}.renderNetwork`;

        this.dynamicPluginTools.set(toolName, {
          type: 'visualization',
          pluginId: viz.id,
          name: viz.name,
          category: 'pluginVisualizations',
        });

        this.dynamicPluginTools.set(renderName, {
          type: 'visualization',
          pluginId: viz.id,
          name: viz.name,
          category: 'pluginVisualizations',
        });

        // Add to function category if not already present
        if (!this.functionCategories.pluginVisualizations.functions.includes(toolName)) {
          this.functionCategories.pluginVisualizations.functions.push(toolName);
        }
        if (!this.functionCategories.pluginVisualizations.functions.includes(renderName)) {
          this.functionCategories.pluginVisualizations.functions.push(renderName);
        }
      }

      // Get function plugins
      const functionPlugins = pluginManager.getAllFunctions ? pluginManager.getAllFunctions() : [];

      for (const func of functionPlugins) {
        const toolName = `${func.pluginId}.${func.name}`;

        this.dynamicPluginTools.set(toolName, {
          type: 'function',
          pluginId: func.pluginId,
          name: func.name,
          category: 'pluginFunctions',
        });

        // Add to function category if not already present
        if (!this.functionCategories.pluginFunctions.functions.includes(toolName)) {
          this.functionCategories.pluginFunctions.functions.push(toolName);
        }
      }

      // Rebuild function mapping
      this.functionToCategory = this.buildFunctionMapping();

      console.log(`✅ [FunctionCallsOrganizer] Registered ${this.dynamicPluginTools.size} plugin tools`);
      console.log('   - Visualization tools:', this.functionCategories.pluginVisualizations.functions.length);
      console.log('   - Function tools:', this.functionCategories.pluginFunctions.functions.length);
    } catch (error) {
      console.error('❌ [FunctionCallsOrganizer] Error registering plugin tools:', error);
    }
  }

  /**
   * Check if a tool is a dynamically registered plugin tool
   * @param {string} toolName - Tool name to check
   * @returns {boolean}
   */
  isPluginTool(toolName) {
    return this.dynamicPluginTools.has(toolName) || toolName.includes('.');
  }

  /**
   * Get plugin tool information
   * @param {string} toolName - Tool name
   * @returns {Object|null}
   */
  getPluginToolInfo(toolName) {
    return this.dynamicPluginTools.get(toolName) || null;
  }

  /**
   * Get all registered plugin tools
   * @returns {Array}
   */
  getAllPluginTools() {
    return Array.from(this.dynamicPluginTools.entries()).map(([name, info]) => ({
      name,
      ...info,
    }));
  }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FunctionCallsOrganizer;
} else if (typeof window !== 'undefined') {
  window.FunctionCallsOrganizer = FunctionCallsOrganizer;
}
