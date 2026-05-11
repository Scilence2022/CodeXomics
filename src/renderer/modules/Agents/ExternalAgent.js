/**
 * ExternalAgent - 外部智能体
 * 专门处理外部API调用相关的函数
 */
class ExternalAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'external', [
      'external_api',
      'blast_search',
      'uniprot_search',
      'alphafold_search',
      'evo2_design',
    ]);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.apiManager = null;
  }

  /**
   * 执行具体初始化逻辑
   */
  async performInitialization() {
    // 确保应用已初始化
    if (!this.app) {
      throw new Error('Application reference not available');
    }

    // 获取API管理器
    this.apiManager = this.app.apiManager || null;
    if (!this.apiManager) {
      console.warn('⚠️ ExternalAgent: APIManager not available, some tools will rely on ChatManager fallback');
    }

    console.log(`🌐 ExternalAgent: External API tools initialized`);
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters);
        return result;
      } catch (error) {
        console.warn(`ExternalAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`);
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    // Check toolMapping for local implementations
    if (this.toolMapping.has(functionName)) {
      const toolFunction = this.toolMapping.get(functionName);
      return await toolFunction(parameters, context);
    }

    throw new Error(`ExternalAgent: Function ${functionName} not implemented locally and ChatManager unavailable`);
  }

  /**
   * 注册工具映射
   */
  registerToolMapping() {
    // BLAST搜索工具 - builtInToolsMap-aligned names
    this.toolMapping.set('blast_search', this.blastSearch.bind(this));
    this.toolMapping.set('blast_search_online', this.blastSearch.bind(this));
    this.toolMapping.set('blast_search_local', this.blastSearch.bind(this));
    this.toolMapping.set('blast_search_batch', this.blastSearch.bind(this));
    this.toolMapping.set('blast_sequence', this.blastSequence.bind(this));
    this.toolMapping.set('blast_protein', this.blastProtein.bind(this));
    this.toolMapping.set('blast_sequence_from_region', this.blastSearch.bind(this));
    this.toolMapping.set('blast_create_database', this._delegateToChatManager.bind(this, 'blastCreateDatabase'));
    this.toolMapping.set('blast_list_databases', this._delegateToChatManager.bind(this, 'blastListDatabases'));
    this.toolMapping.set('blast_delete_database', this._delegateToChatManager.bind(this, 'blastDeleteDatabase'));
    this.toolMapping.set('blast_create_db_from_genome', this._delegateToChatManager.bind(this, 'blastCreateDbFromGenome'));
    this.toolMapping.set('blast_create_protein_db_from_genome', this._delegateToChatManager.bind(this, 'blastCreateProteinDbFromGenome'));
    this.toolMapping.set('blast_create_quick_db_for_current_genome', this._delegateToChatManager.bind(this, 'blastCreateQuickDbForCurrentGenome'));
    this.toolMapping.set('blast_filter_results', this._delegateToChatManager.bind(this, 'blastFilterResults'));
    this.toolMapping.set('blast_export_results', this._delegateToChatManager.bind(this, 'blastExportResults'));
    this.toolMapping.set('blast_detect_sequence_type', this._delegateToChatManager.bind(this, 'blastDetectSequenceType'));
    this.toolMapping.set('blast_validate_database', this._delegateToChatManager.bind(this, 'blastValidateDatabase'));
    this.toolMapping.set('blast_get_installation_status', this._delegateToChatManager.bind(this, 'blastGetInstallationStatus'));

    // UniProt搜索工具 - builtInToolsMap-aligned names
    this.toolMapping.set('search_uniprot_database', this.uniprotSearch.bind(this));
    this.toolMapping.set('uniprot_search', this.uniprotSearch.bind(this)); // legacy alias
    this.toolMapping.set('advanced_uniprot_search', this.advancedUniprotSearch.bind(this));
    this.toolMapping.set('get_uniprot_entry', this.uniprotGetProtein.bind(this));
    this.toolMapping.set('uniprot_get_protein', this.uniprotGetProtein.bind(this)); // legacy alias
    this.toolMapping.set('uniprot_get_annotation', this.uniprotGetAnnotation.bind(this));

    // AlphaFold搜索工具 - builtInToolsMap-aligned names
    this.toolMapping.set('fetch_alphafold_structure', this.alphafoldGetStructure.bind(this));
    this.toolMapping.set('search_alphafold_structures', this.alphafoldSearch.bind(this));
    this.toolMapping.set('alphafold_search', this.alphafoldSearch.bind(this)); // legacy alias
    this.toolMapping.set('alphafold_get_structure', this.alphafoldGetStructure.bind(this)); // legacy alias
    this.toolMapping.set('search_alphafold_by_sequence', this.alphafoldSearchBySequence.bind(this));

    // PDB搜索工具 - builtInToolsMap-aligned names
    this.toolMapping.set('search_pdb_structures', this.searchPdbStructures.bind(this));
    this.toolMapping.set('fetch_protein_structure', this.fetchProteinStructure.bind(this));

    // InterPro搜索工具 - builtInToolsMap-aligned names
    this.toolMapping.set('analyze_interpro_domains', this.interproSearch.bind(this));
    this.toolMapping.set('search_interpro_entry', this.interproSearch.bind(this)); // alias
    this.toolMapping.set('get_interpro_entry_details', this.interproGetDomain.bind(this));
    this.toolMapping.set('interpro_search', this.interproSearch.bind(this)); // legacy alias
    this.toolMapping.set('interpro_get_domain', this.interproGetDomain.bind(this)); // legacy alias

    // KEGG搜索工具
    this.toolMapping.set('kegg_search', this.keggSearch.bind(this));
    this.toolMapping.set('kegg_get_pathway', this.keggGetPathway.bind(this));

    // Evo2设计工具
    this.toolMapping.set('evo2_design', this.evo2Design.bind(this));
    this.toolMapping.set('evo2_optimize', this.evo2Optimize.bind(this));

    console.log(`🌐 ExternalAgent: Registered ${this.toolMapping.size} external API tools`);
  }

  async _delegateToChatManager(methodName, parameters) {
    if (this.chatManager && typeof this.chatManager[methodName] === 'function') {
      return await this.chatManager[methodName](parameters);
    }
    if (this.chatManager && this.chatManager.services && this.chatManager.services.blast && typeof this.chatManager.services.blast[methodName] === 'function') {
      return await this.chatManager.services.blast[methodName](parameters);
    }
    throw new Error(`BLAST method '${methodName}' not available`);
  }

  /**
   * BLAST搜索
   */
  async blastSearch(parameters, strategy) {
    try {
      const { sequence, database = 'nr', evalue = 1e-5, maxResults = 10 } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const blastResults = await this.apiManager.blastSearch(sequence, database, evalue, maxResults);

      return {
        success: true,
        results: blastResults.map(result => ({
          id: result.id,
          description: result.description,
          score: result.score,
          evalue: result.evalue,
          identity: result.identity,
          alignment: result.alignment,
        })),
        count: blastResults.length,
        database,
        query: sequence,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * BLAST序列搜索
   */
  async blastSequence(parameters, strategy) {
    return await this.blastSearch(parameters, strategy);
  }

  /**
   * BLAST蛋白质搜索
   */
  async blastProtein(parameters, strategy) {
    const { protein, ...otherParams } = parameters;
    return await this.blastSearch({ sequence: protein, ...otherParams }, strategy);
  }

  /**
   * UniProt搜索
   */
  async uniprotSearch(parameters, strategy) {
    try {
      const { query, format = 'json', maxResults = 10 } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const uniprotResults = await this.apiManager.uniprotSearch(query, format, maxResults);

      return {
        success: true,
        results: uniprotResults.map(result => ({
          id: result.id,
          name: result.name,
          organism: result.organism,
          length: result.length,
          function: result.function,
          keywords: result.keywords,
        })),
        count: uniprotResults.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 高级UniProt搜索
   */
  async advancedUniprotSearch(parameters, strategy) {
    return await this.uniprotSearch(parameters, strategy);
  }

  /**
   * 获取UniProt蛋白质信息
   */
  async uniprotGetProtein(parameters, strategy) {
    try {
      const { id } = parameters;

      if (!id) {
        throw new Error('Protein ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const protein = await this.apiManager.uniprotGetProtein(id);

      return {
        success: true,
        protein: {
          id: protein.id,
          name: protein.name,
          organism: protein.organism,
          sequence: protein.sequence,
          length: protein.length,
          function: protein.function,
          keywords: protein.keywords,
          features: protein.features,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取UniProt注释信息
   */
  async uniprotGetAnnotation(parameters, strategy) {
    try {
      const { id } = parameters;

      if (!id) {
        throw new Error('Protein ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const annotation = await this.apiManager.uniprotGetAnnotation(id);

      return {
        success: true,
        annotation: {
          id: annotation.id,
          goTerms: annotation.goTerms,
          pathways: annotation.pathways,
          domains: annotation.domains,
          interactions: annotation.interactions,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * AlphaFold搜索
   */
  async alphafoldSearch(parameters, strategy) {
    try {
      const { protein } = parameters;

      if (!protein) {
        throw new Error('Protein sequence or ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const alphafoldResults = await this.apiManager.alphafoldSearch(protein);

      return {
        success: true,
        results: alphafoldResults.map(result => ({
          id: result.id,
          name: result.name,
          confidence: result.confidence,
          plddt: result.plddt,
          structureUrl: result.structureUrl,
        })),
        count: alphafoldResults.length,
        query: protein,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * AlphaFold按序列搜索
   */
  async alphafoldSearchBySequence(parameters, strategy) {
    return await this.alphafoldSearch(parameters, strategy);
  }

  /**
   * 获取AlphaFold结构
   */
  async alphafoldGetStructure(parameters, strategy) {
    try {
      const { id, format = 'pdb' } = parameters;

      if (!id) {
        throw new Error('Structure ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const structure = await this.apiManager.alphafoldGetStructure(id, format);

      return {
        success: true,
        structure: {
          id: structure.id,
          format: structure.format,
          data: structure.data,
          metadata: structure.metadata,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索PDB结构
   */
  async searchPdbStructures(parameters, strategy) {
    try {
      const { query, maxResults = 10 } = parameters;
      if (!query) throw new Error('Search query is required');
      if (!this.apiManager) throw new Error('APIManager not available');
      const results = await this.apiManager.searchPdbStructures(query, maxResults);
      return { success: true, results, count: results.length, query };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取蛋白质结构
   */
  async fetchProteinStructure(parameters, strategy) {
    try {
      const { id, format = 'pdb' } = parameters;
      if (!id) throw new Error('Structure ID is required');
      if (!this.apiManager) throw new Error('APIManager not available');
      const structure = await this.apiManager.fetchProteinStructure(id, format);
      return { success: true, structure };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Evo2设计
   */
  async evo2Design(parameters, strategy) {
    try {
      const { sequence, target, constraints = {} } = parameters;

      if (!sequence || !target) {
        throw new Error('Sequence and target are required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const designResult = await this.apiManager.evo2Design(sequence, target, constraints);

      return {
        success: true,
        design: {
          originalSequence: designResult.originalSequence,
          designedSequence: designResult.designedSequence,
          mutations: designResult.mutations,
          score: designResult.score,
          confidence: designResult.confidence,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Evo2优化
   */
  async evo2Optimize(parameters, strategy) {
    try {
      const { sequence, objective, constraints = {} } = parameters;

      if (!sequence || !objective) {
        throw new Error('Sequence and objective are required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const optimizationResult = await this.apiManager.evo2Optimize(sequence, objective, constraints);

      return {
        success: true,
        optimization: {
          originalSequence: optimizationResult.originalSequence,
          optimizedSequence: optimizationResult.optimizedSequence,
          mutations: optimizationResult.mutations,
          objectiveValue: optimizationResult.objectiveValue,
          iterations: optimizationResult.iterations,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * InterPro搜索
   */
  async interproSearch(parameters, strategy) {
    try {
      const { query, maxResults = 10 } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const interproResults = await this.apiManager.interproSearch(query, maxResults);

      return {
        success: true,
        results: interproResults.map(result => ({
          id: result.id,
          name: result.name,
          type: result.type,
          description: result.description,
          memberDatabases: result.memberDatabases,
        })),
        count: interproResults.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取InterPro域信息
   */
  async interproGetDomain(parameters, strategy) {
    try {
      const { id } = parameters;

      if (!id) {
        throw new Error('Domain ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const domain = await this.apiManager.interproGetDomain(id);

      return {
        success: true,
        domain: {
          id: domain.id,
          name: domain.name,
          type: domain.type,
          description: domain.description,
          memberDatabases: domain.memberDatabases,
          structure: domain.structure,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * KEGG搜索
   */
  async keggSearch(parameters, strategy) {
    try {
      const { query, database = 'pathway', maxResults = 10 } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const keggResults = await this.apiManager.keggSearch(query, database, maxResults);

      return {
        success: true,
        results: keggResults.map(result => ({
          id: result.id,
          name: result.name,
          description: result.description,
          type: result.type,
          organism: result.organism,
        })),
        count: keggResults.length,
        query,
        database,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取KEGG通路信息
   */
  async keggGetPathway(parameters, strategy) {
    try {
      const { id } = parameters;

      if (!id) {
        throw new Error('Pathway ID is required');
      }

      if (!this.apiManager) {
        throw new Error('APIManager not available');
      }

      const pathway = await this.apiManager.keggGetPathway(id);

      return {
        success: true,
        pathway: {
          id: pathway.id,
          name: pathway.name,
          description: pathway.description,
          genes: pathway.genes,
          compounds: pathway.compounds,
          reactions: pathway.reactions,
          map: pathway.map,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 导出智能体
window.ExternalAgent = ExternalAgent;
