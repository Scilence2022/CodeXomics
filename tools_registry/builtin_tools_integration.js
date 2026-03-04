/**
 * Built-in Tools Integration Module
 * Bridges ChatManager's built-in tools with the dynamic registry system
 * Provides seamless integration between native and dynamic tool execution
 */

const path = require('path');
const fs = require('fs').promises;

class BuiltInToolsIntegration {
  constructor() {
    this.builtInToolsMap = new Map();
    this.registryPath = __dirname;
    this.initializeBuiltInToolsMapping();
  }

  /**
   * Initialize the mapping between built-in tools and their registry definitions
   */
  initializeBuiltInToolsMapping() {
    // Map registry tool names to ChatManager built-in methods
    this.builtInToolsMap.set('load_genome_file', {
      method: 'loadGenomeFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_annotation_file', {
      method: 'loadAnnotationFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_variant_file', {
      method: 'loadVariantFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_reads_file', {
      method: 'loadReadsFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_wig_tracks', {
      method: 'loadWigTracks',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('load_operon_file', {
      method: 'loadOperonFile',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_loaded_files_list', {
      method: 'getLoadedFilesList',
      category: 'file_loading',
      type: 'built-in',
      priority: 1,
    });

    // Additional built-in tools can be added here
    this.builtInToolsMap.set('navigate_to_position', {
      method: 'navigateToPosition',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('open_new_tab', {
      method: 'openNewTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('switch_to_tab', {
      method: 'switchToTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('close_tab', {
      method: 'closeTab',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_current_state', {
      method: 'getCurrentState',
      category: 'navigation',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('get_sequence', {
      method: 'getSequence',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('compute_gc', {
      method: 'calculateGCContent',
      category: 'sequence',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('set_working_directory', {
      method: 'setWorkingDirectory',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - UniProt
    this.builtInToolsMap.set('search_uniprot_database', {
      method: 'searchUniProtDatabase',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('advanced_uniprot_search', {
      method: 'advancedUniProtSearch',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_uniprot_entry', {
      method: 'getUniProtEntry',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - InterPro
    this.builtInToolsMap.set('analyze_interpro_domains', {
      method: 'analyzeInterProDomains',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - AlphaFold
    this.builtInToolsMap.set('search_alphafold_by_gene', {
      method: 'searchAlphaFoldByGene',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('fetch_alphafold_structure', {
      method: 'fetchAlphaFoldStructure',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('open_alphafold_viewer', {
      method: 'openAlphaFoldViewer',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    // Database tools - PDB
    this.builtInToolsMap.set('search_pdb_structures', {
      method: 'searchPDBStructures',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('search_protein_by_gene', {
      method: 'searchProteinByGene',
      category: 'protein',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('search_interpro_entry', {
      method: 'searchInterProEntry',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('get_interpro_entry_details', {
      method: 'getInterProEntryDetails',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    // Data management tools - Codon usage analysis
    this.builtInToolsMap.set('codon_usage_analysis', {
      method: 'codonUsageAnalysis',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('genome_codon_usage_analysis', {
      method: 'genomeCodonUsageAnalysis',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    // BLAST Tools Integration
    // Legacy blast_search tool (maps to blastSearch)
    this.builtInToolsMap.set('blast_search', {
      method: 'blastSearch',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_online', {
      method: 'blastSearchOnline',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_local', {
      method: 'blastSearchLocal',
      category: 'external_apis',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('blast_search_batch', {
      method: 'blastSearchBatch',
      category: 'external_apis',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_database', {
      method: 'blastCreateDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_list_databases', {
      method: 'blastListDatabases',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_database_info', {
      method: 'blastDatabaseInfo',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_delete_database', {
      method: 'blastDeleteDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_db_from_genome', {
      method: 'blastCreateDbFromGenome',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_protein_db_from_genome', {
      method: 'blastCreateProteinDbFromGenome',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_filter_results', {
      method: 'blastFilterResults',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_export_results', {
      method: 'blastExportResults',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_detect_sequence_type', {
      method: 'blastDetectSequenceType',
      category: 'data_management',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_validate_database', {
      method: 'blastValidateDatabase',
      category: 'database',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_get_installation_status', {
      method: 'blastGetInstallationStatus',
      category: 'system',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('blast_create_quick_db_for_current_genome', {
      method: 'blastCreateQuickDbForCurrentGenome',
      category: 'database',
      type: 'built-in',
      priority: 1,
    });

    // Utility Tools
    this.builtInToolsMap.set('download_internet_file', {
      method: 'downloadInternetFile',
      category: 'utility',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('view_markdown_file', {
      method: 'viewMarkdownFile',
      category: 'utility',
      type: 'built-in',
      priority: 2,
    });

    // System Tools - List Available Tools
    this.builtInToolsMap.set('list_available_tools', {
      method: 'listAvailableTools',
      category: 'system',
      type: 'built-in',
      priority: 1,
    });

    // Primer Design Tools
    this.builtInToolsMap.set('design_pcr_primers', {
      method: 'designPCRPrimers',
      category: 'primer',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('design_qpcr_primers', {
      method: 'designqPCRPrimers',
      category: 'primer',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('design_primers_for_gene', {
      method: 'designPrimersForGene',
      category: 'primer',
      type: 'built-in',
      priority: 1,
    });

    this.builtInToolsMap.set('analyze_primer_structure', {
      method: 'analyzePrimerStructure',
      category: 'primer',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('analyze_primer_pair', {
      method: 'analyzePrimerPair',
      category: 'primer',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('calculate_tm', {
      method: 'calculateTm',
      category: 'primer',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('validate_primer', {
      method: 'validatePrimer',
      category: 'primer',
      type: 'built-in',
      priority: 2,
    });

    this.builtInToolsMap.set('export_primers', {
      method: 'exportPrimers',
      category: 'primer',
      type: 'built-in',
      priority: 3,
    });

    this.builtInToolsMap.set('add_primer_to_track', {
      method: 'addPrimerToTrack',
      category: 'primer',
      type: 'built-in',
      priority: 2,
    });

    console.log(`✅ Built-in Tools Integration: Mapped ${this.builtInToolsMap.size} built-in tools`);
  }

  /**
   * Check if a tool is built-in
   */
  isBuiltInTool(toolName) {
    return this.builtInToolsMap.has(toolName);
  }

  /**
   * Get built-in tool information
   */
  getBuiltInToolInfo(toolName) {
    return this.builtInToolsMap.get(toolName);
  }

  /**
   * Execute a built-in tool via ChatManager
   */
  async executeBuiltInTool(toolName, parameters, chatManagerInstance) {
    if (!this.isBuiltInTool(toolName)) {
      throw new Error(`Tool ${toolName} is not a built-in tool`);
    }

    if (!chatManagerInstance) {
      throw new Error('ChatManager instance not provided for built-in tool execution');
    }

    const toolInfo = this.getBuiltInToolInfo(toolName);
    const methodName = toolInfo.method;

    console.log(`🔧 [Built-in Tools] Executing built-in tool: ${toolName} -> ${methodName}`);

    try {
      // Check if the method exists on the ChatManager instance
      if (typeof chatManagerInstance[methodName] !== 'function') {
        throw new Error(`Method ${methodName} not found on ChatManager instance`);
      }

      // Execute the built-in method
      const startTime = Date.now();
      const result = await chatManagerInstance[methodName](parameters);
      const executionTime = Date.now() - startTime;

      console.log(`✅ [Built-in Tools] Tool ${toolName} executed successfully in ${executionTime}ms`);

      return {
        success: true,
        tool: toolName,
        method: methodName,
        result: result,
        executionTime: executionTime,
        timestamp: new Date().toISOString(),
        type: 'built-in',
      };
    } catch (error) {
      console.error(`❌ [Built-in Tools] Tool ${toolName} execution failed:`, error);
      throw new Error(`Built-in tool execution failed: ${error.message}`);
    }
  }

  /**
   * Get all built-in tools for a specific category
   */
  getBuiltInToolsByCategory(category) {
    const tools = [];
    for (const [toolName, toolInfo] of this.builtInToolsMap.entries()) {
      if (toolInfo.category === category) {
        tools.push({
          name: toolName,
          ...toolInfo,
        });
      }
    }
    return tools;
  }

  /**
   * Get enhanced file loading intent detection patterns
   */
  getFileLoadingIntentPatterns() {
    return {
      // Direct file path patterns
      file_path:
        /[\w\-\.\\\/]+\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)$/i,

      // Quoted file paths
      quoted_path: /"[^"]*\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)"/i,

      // Load commands with file types
      load_genome: /(load|open|import)\s+(genome|fasta|genbank|gbk|gb)\s+(file)?/i,
      load_annotation: /(load|open|import)\s+(annotation|gff|bed|gtf)\s+(file)?/i,
      load_variant: /(load|open|import)\s+(variant|vcf|mutation)\s+(file)?/i,
      load_reads: /(load|open|import)\s+(reads|sam|bam|alignment)\s+(file)?/i,
      load_wig: /(load|open|import)\s+(wig|wiggle|bigwig|bedgraph|track)\s+(file)?/i,
      load_operon: /(load|open|import)\s+(operon|operons|regulatory)\s+(file)?/i,

      // Generic file loading
      load_file: /(load|open|import)\s+(file|data)/i,

      // File extensions in context
      has_extension: /\.(fasta|fa|genbank|gbk|gb|gff|gff3|bed|gtf|vcf|sam|bam|wig|bigwig|bedgraph|json|csv|txt)/i,
    };
  }

  /**
   * Analyze query for built-in tool relevance with enhanced file loading detection
   */
  analyzeBuiltInToolRelevance(query) {
    const queryLower = query.toLowerCase();
    const patterns = this.getFileLoadingIntentPatterns();
    const relevantTools = [];

    // Check for system management patterns (working directory, etc.)
    if (
      /\b(set|change|working|directory|folder|path|cd|current)\b/i.test(query) &&
      (/\b(working\s+directory|current\s+directory|set\s+directory|change\s+directory)\b/i.test(query) ||
        /\b(working\s+dir|current\s+dir|set\s+working|change\s+working)\b/i.test(query))
    ) {
      relevantTools.push({
        name: 'set_working_directory',
        confidence: 0.9,
        reason: 'Working directory management keywords detected',
      });
    }

    // Check for file loading patterns
    for (const [patternName, regex] of Object.entries(patterns)) {
      if (regex.test(query)) {
        console.log(`🎯 [Built-in Tools] File loading pattern detected: ${patternName}`);

        // Add relevant file loading tools based on pattern
        if (patternName.includes('genome') || queryLower.includes('fasta') || queryLower.includes('genbank')) {
          relevantTools.push({
            name: 'load_genome_file',
            confidence: 0.95,
            reason: `Genome file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('annotation') || queryLower.includes('gff') || queryLower.includes('bed')) {
          relevantTools.push({
            name: 'load_annotation_file',
            confidence: 0.95,
            reason: `Annotation file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('variant') || queryLower.includes('vcf')) {
          relevantTools.push({
            name: 'load_variant_file',
            confidence: 0.95,
            reason: `Variant file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('reads') || queryLower.includes('sam') || queryLower.includes('bam')) {
          relevantTools.push({
            name: 'load_reads_file',
            confidence: 0.95,
            reason: `Reads file pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('wig') || queryLower.includes('track')) {
          relevantTools.push({
            name: 'load_wig_tracks',
            confidence: 0.95,
            reason: `WIG track pattern detected: ${patternName}`,
          });
        }

        if (patternName.includes('operon') || queryLower.includes('regulatory')) {
          relevantTools.push({
            name: 'load_operon_file',
            confidence: 0.95,
            reason: `Operon file pattern detected: ${patternName}`,
          });
        }

        // Generic file loading - add all file loading tools with lower confidence
        if (patternName === 'load_file' || patternName === 'file_path') {
          const fileLoadingTools = this.getBuiltInToolsByCategory('file_loading');
          for (const tool of fileLoadingTools) {
            if (!relevantTools.some(t => t.name === tool.name)) {
              relevantTools.push({
                name: tool.name,
                confidence: 0.7,
                reason: `Generic file loading pattern detected: ${patternName}`,
              });
            }
          }
        }

        break; // Use first matching pattern for primary detection
      }
    }

    // Check for navigation patterns
    if (/\b(navigate|go\s+to|jump|position|location)\b/i.test(query)) {
      relevantTools.push({
        name: 'navigate_to_position',
        confidence: 0.8,
        reason: 'Navigation keywords detected',
      });
    }

    // Check for annotation and function search patterns (for search_features tool)
    if (/\b(annotation|function|features|search)\b/i.test(query)) {
      // Note: search_features is not a built-in tool but we boost its detection
      // by marking it as highly relevant when annotation/function keywords are present
      relevantTools.push({
        name: 'search_features',
        confidence: 0.95,
        reason: 'Annotation/function search keywords detected - register search_features tool',
        is_external: true, // Mark as external tool for special handling
        category: 'navigation',
      });
    }

    // Check for tab management patterns
    if (
      /\b(switch|change|activate|select|goto)\s+(tab|window)\b/i.test(query) ||
      /\b(tab\s+(switch|change|activate|select))\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'switch_to_tab',
        confidence: 0.85,
        reason: 'Tab switching keywords detected',
      });
    }

    // Check for new tab patterns
    if (/\b(open|new|create)\s+(tab|window)\b/i.test(query) || /\b(new\s+tab)\b/i.test(query)) {
      relevantTools.push({
        name: 'open_new_tab',
        confidence: 0.85,
        reason: 'New tab keywords detected',
      });
    }

    // Check for close tab patterns
    if (
      /\b(close|remove|delete|dismiss)\s+(tab|window)\b/i.test(query) ||
      /\b(tab\s+(close|remove|delete|dismiss))\b/i.test(query)
    ) {
      relevantTools.push({
        name: 'close_tab',
        confidence: 0.85,
        reason: 'Close tab keywords detected',
      });
    }

    // Check for sequence analysis patterns
    if (/\b(sequence|gc|content|analyze)\b/i.test(query)) {
      relevantTools.push({
        name: 'get_sequence',
        confidence: 0.7,
        reason: 'Sequence analysis keywords detected',
      });

      if (/\b(gc|content)\b/i.test(query)) {
        relevantTools.push({
          name: 'compute_gc',
          confidence: 0.8,
          reason: 'GC content keywords detected',
        });
      }
    }

    // Check for database search patterns - UniProt
    if (/\b(uniprot|protein\s+database|search\s+protein|protein\s+search)\b/i.test(query)) {
      if (/\b(advanced|multiple|complex)\b/i.test(query)) {
        relevantTools.push({
          name: 'advanced_uniprot_search',
          confidence: 0.9,
          reason: 'Advanced UniProt search keywords detected',
        });
      } else if (/\b(get|retrieve|fetch|entry|id)\b/i.test(query)) {
        relevantTools.push({
          name: 'get_uniprot_entry',
          confidence: 0.9,
          reason: 'UniProt entry retrieval keywords detected',
        });
      } else {
        relevantTools.push({
          name: 'search_uniprot_database',
          confidence: 0.85,
          reason: 'UniProt database search keywords detected',
        });
      }
    }

    // Check for database search patterns - InterPro
    if (/\b(interpro|domain|family|families|functional\s+site)\b/i.test(query)) {
      if (
        /\b(analyze|analysis|predict|domain\s+analysis)\b/i.test(query) ||
        /\b(protein\s+domain|domain\s+architecture)\b/i.test(query)
      ) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.95,
          reason: 'InterPro domain analysis keywords detected',
        });
      } else if (/\b(get|retrieve|fetch|entry|details)\b/i.test(query)) {
        relevantTools.push({
          name: 'get_interpro_entry_details',
          confidence: 0.9,
          reason: 'InterPro entry details keywords detected',
        });
      } else if (/\b(search|find|lookup)\b/i.test(query)) {
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.85,
          reason: 'InterPro search keywords detected',
        });
      } else {
        // Generic domain mention - suggest search
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.75,
          reason: 'Domain-related keywords detected, suggesting InterPro search',
        });
      }
    }

    // Check for protein/domain analysis patterns (generic)
    if (
      /\b(protein|domain|pfam|smart|prosite)\b/i.test(query) &&
      /\b(analyze|analysis|identify|predict|find)\b/i.test(query)
    ) {
      // Add InterPro domain analysis if not already added
      if (!relevantTools.some(t => t.name === 'analyze_interpro_domains')) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.8,
          reason: 'Generic protein domain analysis keywords detected',
        });
      }
    }

    // Check for specific domain names or "has/have domains" patterns
    if (/\b(kinase|phosphatase|transferase|helicase|protease)\b/i.test(query) && /\b(domain|domains)\b/i.test(query)) {
      if (!relevantTools.some(t => t.name === 'search_interpro_entry')) {
        relevantTools.push({
          name: 'search_interpro_entry',
          confidence: 0.85,
          reason: 'Specific domain type search detected',
        });
      }
    }

    // Check for "what domains" or "which domains" patterns
    if (/\b(what|which|show|list)\b/i.test(query) && /\b(domain|domains)\b/i.test(query)) {
      if (!relevantTools.some(t => t.name === 'analyze_interpro_domains')) {
        relevantTools.push({
          name: 'analyze_interpro_domains',
          confidence: 0.85,
          reason: 'Domain query pattern detected',
        });
      }
    }

    return relevantTools;
  }

  /**
   * Get built-in tools statistics
   */
  getBuiltInToolsStats() {
    const stats = {
      total_builtin_tools: this.builtInToolsMap.size,
      categories: {},
    };

    for (const [toolName, toolInfo] of this.builtInToolsMap.entries()) {
      if (!stats.categories[toolInfo.category]) {
        stats.categories[toolInfo.category] = {
          count: 0,
          tools: [],
        };
      }
      stats.categories[toolInfo.category].count++;
      stats.categories[toolInfo.category].tools.push(toolName);
    }

    return stats;
  }

  /**
   * Generate non-dynamic system prompt with built-in tools emphasis
   */
  generateNonDynamicSystemPrompt(context = {}) {
    const fileLoadingTools = this.getBuiltInToolsByCategory('file_loading');
    const navigationTools = this.getBuiltInToolsByCategory('navigation');
    const sequenceTools = this.getBuiltInToolsByCategory('sequence');
    const databaseTools = this.getBuiltInToolsByCategory('database');
    const systemTools = this.getBuiltInToolsByCategory('system');

    return `# CodeXomics - Built-in Tools System (Non-Dynamic Mode)

You are an advanced AI assistant for CodeXomics with access to high-performance built-in tools.

## 🧬 Current Context
- **Network Status**: ${context.hasNetwork ? 'Connected' : 'Offline'}
- **Authentication**: ${context.hasAuth ? 'Authenticated' : 'Not authenticated'}
- **Loaded Files**: ${context.loadedFiles || 0} files
- **Current Position**: ${context.currentPosition || 'None'}

## 🔧 Built-in File Loading Tools (Highest Priority)

${fileLoadingTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**File Loading Instructions:**
- Use load_genome_file for FASTA/GenBank genome files (.fasta, .fa, .genbank, .gbk, .gb)
- Use load_annotation_file for annotation files (.gff, .gff3, .bed, .gtf)
- Use load_variant_file for variant files (.vcf)
- Use load_reads_file for read alignment files (.sam, .bam)
- Use load_wig_tracks for track files (.wig, .bigwig, .bedgraph)
- Use load_operon_file for operon/regulatory files (.json, .csv, .txt)

## 🧭 Built-in Navigation & Tab Management Tools

${navigationTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**Tab Management Instructions:**
- Use open_new_tab to create new analysis tabs for parallel workflows
- Use switch_to_tab to navigate between existing tabs by ID, name, or index
- Use close_tab to close tabs by ID, name, or index (cannot close the last remaining tab)
- Use navigate_to_position to move within the current tab to specific genomic locations

## 🧬 Built-in Sequence Analysis Tools

${sequenceTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

## 🗄️ Built-in Database Integration Tools

${databaseTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

**Database Tools Instructions:**
- **UniProt Tools**: Search and retrieve protein information from UniProt database
  - search_uniprot_database: Basic protein/gene searches
  - advanced_uniprot_search: Complex multi-field searches
  - get_uniprot_entry: Get detailed entry by UniProt ID

- **InterPro Tools**: Analyze protein domains and functional sites
  - analyze_interpro_domains: Analyze domains by **sequence**, UniProt ID, or gene name
  - search_interpro_entry: Search InterPro database for domain families
  - get_interpro_entry_details: Get detailed InterPro entry information

**Important**: analyze_interpro_domains supports three input methods:
  1. Direct sequence: Provide protein amino acid sequence
  2. Gene name: Provide gene name + organism (auto-resolves sequence)
  3. UniProt ID: Provide UniProt accession ID (auto-resolves sequence)

## ⚙️ Built-in System Tools

${systemTools.map(tool => `- **${tool.name}**: Built-in ${tool.category} tool`).join('\n')}

## 🎯 Tool Usage Guidelines

1. **File Loading Priority**: Always use built-in file loading tools for importing data
2. **Database Access**: Use built-in database tools for protein/domain analysis
3. **Direct Execution**: Built-in tools execute directly without external dependencies
4. **Performance**: Built-in tools are optimized for speed and reliability
5. **Error Handling**: Built-in tools provide comprehensive error messages

## ⚡ Response Format

For built-in tools, respond with JSON:
${'```'}json
{"tool_name": "tool_name", "parameters": {"param1": "value1"}}
${'```'}

## 📊 Built-in Tools Advantages

- **Speed**: Direct execution without network overhead
- **Reliability**: No external dependencies
- **Integration**: Deep integration with genome browser
- **Optimization**: Specifically optimized for genomic data
- **Flexibility**: Multiple input methods for database tools

Remember: Built-in tools are your primary toolkit for file operations, database access, and core functionality. Use them for the best performance and reliability.`;
  }
}

module.exports = BuiltInToolsIntegration;
