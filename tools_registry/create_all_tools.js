/**
 * Script to create all remaining tool definition files
 * This script generates YAML files for all tools based on the existing MCP tools
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

class ToolDefinitionCreator {
    constructor() {
        this.registryPath = __dirname;
        this.toolDefinitions = this.getAllToolDefinitions();
    }

    /**
     * Get all tool definitions based on existing MCP tools
     */
    getAllToolDefinitions() {
        return {
            // Navigation Tools
            'open_new_tab': {
                category: 'navigation',
                description: 'Open a new tab window for parallel genome analysis',
                keywords: ['new', 'tab', 'window', 'parallel', 'analysis'],
                priority: 1
            },
            'search_features': {
                category: 'navigation',
                description: 'Search for genomic features by name or type',
                keywords: ['search', 'features', 'genomic', 'find'],
                priority: 1
            },
            'get_current_state': {
                category: 'navigation',
                description: 'Get current state of the Genome AI Studio browser',
                keywords: ['current', 'state', 'browser', 'status'],
                priority: 1
            },
            'jump_to_gene': {
                category: 'navigation',
                description: 'Jump directly to a gene location by name',
                keywords: ['jump', 'gene', 'location', 'navigate'],
                priority: 1
            },
            'get_genome_info': {
                category: 'navigation',
                description: 'Get comprehensive information about the loaded genome',
                keywords: ['genome', 'info', 'information', 'details'],
                priority: 1
            },
            'toggle_track': {
                category: 'navigation',
                description: 'Show or hide a specific track in the browser',
                keywords: ['toggle', 'track', 'show', 'hide', 'visible'],
                priority: 2
            },

            // Sequence Analysis Tools
            'translate_dna': {
                category: 'sequence',
                description: 'Translate DNA sequence to protein (amino acid sequence)',
                keywords: ['translate', 'dna', 'protein', 'amino', 'acid'],
                priority: 1
            },
            'reverse_complement': {
                category: 'sequence',
                description: 'Get reverse complement of DNA sequence',
                keywords: ['reverse', 'complement', 'dna', 'sequence'],
                priority: 1
            },
            'find_orfs': {
                category: 'sequence',
                description: 'Find Open Reading Frames (ORFs) in DNA sequence',
                keywords: ['find', 'orfs', 'reading', 'frames', 'genes'],
                priority: 1
            },
            'search_sequence_motif': {
                category: 'sequence',
                description: 'Search for sequence motifs in the genome',
                keywords: ['search', 'motif', 'pattern', 'sequence'],
                priority: 1
            },
            'predict_promoter': {
                category: 'sequence',
                description: 'Predict promoter regions in DNA sequence',
                keywords: ['predict', 'promoter', 'regions', 'dna'],
                priority: 2
            },
            'get_coding_sequence': {
                category: 'sequence',
                description: 'Get the coding sequence (DNA) for a specific gene',
                keywords: ['coding', 'sequence', 'gene', 'dna'],
                priority: 1
            },

            // Protein Structure Tools
            'fetch_protein_structure': {
                category: 'protein',
                description: 'Fetch protein 3D structure from PDB database',
                keywords: ['fetch', 'protein', 'structure', 'pdb', '3d'],
                priority: 1
            },
            'open_protein_viewer': {
                category: 'protein',
                description: 'Open 3D protein structure viewer in a separate window',
                keywords: ['open', 'viewer', '3d', 'protein', 'structure'],
                priority: 1
            },
            'search_pdb_structures': {
                category: 'protein',
                description: 'Search PDB database for experimental protein structures by gene name',
                keywords: ['search', 'pdb', 'experimental', 'structures', 'gene'],
                priority: 1
            },
            'search_protein_by_gene': {
                category: 'protein',
                description: 'DEPRECATED: Use search_pdb_structures instead. Search for protein structures associated with a gene',
                keywords: ['search', 'protein', 'gene', 'structure', 'deprecated'],
                priority: 2  // Lower priority for deprecated tool
            },
            'fetch_alphafold_structure': {
                category: 'protein',
                description: 'Fetch AlphaFold protein structure by UniProt ID',
                keywords: ['fetch', 'alphafold', 'structure', 'uniprot'],
                priority: 1
            },
            'open_alphafold_viewer': {
                category: 'protein',
                description: 'Open AlphaFold 3D structure viewer with enhanced features',
                keywords: ['open', 'alphafold', 'viewer', '3d', 'structure'],
                priority: 1
            },

            // Database Integration Tools
            'search_uniprot_database': {
                category: 'database',
                description: 'Search UniProt database with various search types',
                keywords: ['search', 'uniprot', 'database', 'protein'],
                priority: 1
            },
            'advanced_uniprot_search': {
                category: 'database',
                description: 'Advanced UniProt search with multiple query fields',
                keywords: ['advanced', 'uniprot', 'search', 'multiple'],
                priority: 2
            },
            'get_uniprot_entry': {
                category: 'database',
                description: 'Get detailed information for a specific UniProt entry',
                keywords: ['get', 'uniprot', 'entry', 'details'],
                priority: 1
            },
            'analyze_interpro_domains': {
                category: 'database',
                description: 'Analyze protein domains using InterPro database',
                keywords: ['analyze', 'interpro', 'domains', 'protein'],
                priority: 1
            },
            'search_interpro_entry': {
                category: 'database',
                description: 'Search InterPro database for specific entries',
                keywords: ['search', 'interpro', 'entry', 'database'],
                priority: 2
            },
            'get_interpro_entry_details': {
                category: 'database',
                description: 'Get detailed information for a specific InterPro entry',
                keywords: ['get', 'interpro', 'entry', 'details'],
                priority: 2
            },

            // AI Analysis Tools
            'evo2_predict_function': {
                category: 'ai_analysis',
                description: 'Predict gene function from DNA sequence using Evo2',
                keywords: ['predict', 'function', 'dna', 'sequence', 'evo2'],
                priority: 1
            },
            'evo2_design_crispr': {
                category: 'ai_analysis',
                description: 'Design CRISPR-Cas molecular complexes using Evo2',
                keywords: ['design', 'crispr', 'cas', 'molecular', 'evo2'],
                priority: 1
            },
            'evo2_optimize_sequence': {
                category: 'ai_analysis',
                description: 'Optimize DNA sequences for specific properties using Evo2',
                keywords: ['optimize', 'sequence', 'dna', 'properties', 'evo2'],
                priority: 2
            },
            'evo2_analyze_essentiality': {
                category: 'ai_analysis',
                description: 'Analyze gene essentiality at nucleotide resolution using Evo2',
                keywords: ['analyze', 'essentiality', 'gene', 'nucleotide', 'evo2'],
                priority: 2
            },

            // Data Management Tools
            'create_annotation': {
                category: 'data_management',
                description: 'Create a new user-defined annotation',
                keywords: ['create', 'annotation', 'user', 'defined'],
                priority: 2
            },
            'analyze_region': {
                category: 'data_management',
                description: 'Analyze a genomic region and return features',
                keywords: ['analyze', 'region', 'genomic', 'features'],
                priority: 1
            },
            'export_data': {
                category: 'data_management',
                description: 'Export sequence or annotation data',
                keywords: ['export', 'data', 'sequence', 'annotation'],
                priority: 2
            },
            'codon_usage_analysis': {
                category: 'data_management',
                description: 'Analyze codon usage patterns in DNA coding sequence',
                keywords: ['codon', 'usage', 'analysis', 'dna', 'coding'],
                priority: 2
            },

            // Pathway Tools
            'show_metabolic_pathway': {
                category: 'pathway',
                description: 'Display metabolic pathway visualization',
                keywords: ['show', 'metabolic', 'pathway', 'visualization'],
                priority: 2
            },
            'find_pathway_genes': {
                category: 'pathway',
                description: 'Find genes associated with a specific metabolic pathway',
                keywords: ['find', 'pathway', 'genes', 'metabolic'],
                priority: 2
            },

            // Sequence Editing Tools
            'cut_sequence': {
                category: 'sequence_editing',
                description: 'Cut a sequence region (copy to clipboard and mark for deletion)',
                keywords: ['cut', 'sequence', 'clipboard', 'delete'],
                priority: 1
            },
            'paste_sequence': {
                category: 'sequence_editing',
                description: 'Paste sequence from clipboard at specified position',
                keywords: ['paste', 'sequence', 'clipboard', 'position'],
                priority: 1
            },
            'delete_sequence': {
                category: 'sequence_editing',
                description: 'Delete a sequence region',
                keywords: ['delete', 'sequence', 'region'],
                priority: 1
            },
            'insert_sequence': {
                category: 'sequence_editing',
                description: 'Insert a DNA sequence at specified position',
                keywords: ['insert', 'sequence', 'dna', 'position'],
                priority: 1
            },
            'replace_sequence': {
                category: 'sequence_editing',
                description: 'Replace sequence in specified region with new sequence',
                keywords: ['replace', 'sequence', 'region', 'new'],
                priority: 1
            },
            'get_action_list': {
                category: 'sequence_editing',
                description: 'Get current list of pending and completed sequence actions',
                keywords: ['get', 'action', 'list', 'pending', 'completed'],
                priority: 2
            },
            'execute_actions': {
                category: 'sequence_editing',
                description: 'Execute all pending sequence actions',
                keywords: ['execute', 'actions', 'pending', 'sequence'],
                priority: 1
            },
            'clear_actions': {
                category: 'sequence_editing',
                description: 'Clear actions from the queue',
                keywords: ['clear', 'actions', 'queue'],
                priority: 2
            },
            'undo_last_action': {
                category: 'sequence_editing',
                description: 'Attempt to undo the last completed action',
                keywords: ['undo', 'last', 'action', 'completed'],
                priority: 2
            },

            // Plugin Management Tools
            'get_plugin_info': {
                category: 'plugin_management',
                description: 'Get detailed information about a specific plugin',
                keywords: ['get', 'plugin', 'info', 'information'],
                priority: 2
            },
            'install_plugin': {
                category: 'plugin_management',
                description: 'Install a new plugin from marketplace or local source',
                keywords: ['install', 'plugin', 'marketplace', 'local'],
                priority: 2
            },
            'uninstall_plugin': {
                category: 'plugin_management',
                description: 'Uninstall a plugin from the system',
                keywords: ['uninstall', 'plugin', 'remove'],
                priority: 2
            },
            'enable_plugin': {
                category: 'plugin_management',
                description: 'Enable a disabled plugin',
                keywords: ['enable', 'plugin', 'activate'],
                priority: 2
            },
            'disable_plugin': {
                category: 'plugin_management',
                description: 'Disable an enabled plugin',
                keywords: ['disable', 'plugin', 'deactivate'],
                priority: 2
            },
            'execute_plugin': {
                category: 'plugin_management',
                description: 'Execute a plugin function with parameters',
                keywords: ['execute', 'plugin', 'function', 'parameters'],
                priority: 1
            },
            'call_plugin_function': {
                category: 'plugin_management',
                description: 'Call a specific function within a plugin',
                keywords: ['call', 'plugin', 'function', 'specific'],
                priority: 1
            },
            'get_plugin_functions': {
                category: 'plugin_management',
                description: 'Get list of available functions for a plugin',
                keywords: ['get', 'plugin', 'functions', 'available'],
                priority: 2
            },
            'create_plugin': {
                category: 'plugin_management',
                description: 'Create a new plugin from template or code',
                keywords: ['create', 'plugin', 'template', 'code'],
                priority: 3
            },
            'validate_plugin': {
                category: 'plugin_management',
                description: 'Validate a plugin for compatibility and errors',
                keywords: ['validate', 'plugin', 'compatibility', 'errors'],
                priority: 3
            },
            'search_plugins': {
                category: 'plugin_management',
                description: 'Search for plugins in the marketplace',
                keywords: ['search', 'plugins', 'marketplace'],
                priority: 2
            },

            // Coordination Tools
            'decompose_task': {
                category: 'coordination',
                description: 'Decompose a complex task into subtasks',
                keywords: ['decompose', 'task', 'subtasks', 'complex'],
                priority: 2
            },
            'integrate_results': {
                category: 'coordination',
                description: 'Integrate results from multiple subtasks',
                keywords: ['integrate', 'results', 'subtasks', 'multiple'],
                priority: 2
            },
            'create_workflow': {
                category: 'coordination',
                description: 'Create a workflow for complex analysis',
                keywords: ['create', 'workflow', 'analysis', 'complex'],
                priority: 2
            },
            'execute_workflow': {
                category: 'coordination',
                description: 'Execute a predefined workflow',
                keywords: ['execute', 'workflow', 'predefined'],
                priority: 2
            },
            'assign_task_to_agent': {
                category: 'coordination',
                description: 'Assign a subtask to a specific agent',
                keywords: ['assign', 'task', 'agent', 'subtask'],
                priority: 2
            },
            'get_agent_status': {
                category: 'coordination',
                description: 'Get status of a specific agent',
                keywords: ['get', 'agent', 'status'],
                priority: 2
            },
            'balance_load': {
                category: 'coordination',
                description: 'Balance workload across available agents',
                keywords: ['balance', 'load', 'workload', 'agents'],
                priority: 2
            },
            'handle_error': {
                category: 'coordination',
                description: 'Handle errors in task execution',
                keywords: ['handle', 'error', 'execution', 'task'],
                priority: 2
            },
            'retry_failed_task': {
                category: 'coordination',
                description: 'Retry a failed task with different parameters',
                keywords: ['retry', 'failed', 'task', 'parameters'],
                priority: 2
            },
            'fallback_strategy': {
                category: 'coordination',
                description: 'Implement fallback strategy for failed tasks',
                keywords: ['fallback', 'strategy', 'failed', 'tasks'],
                priority: 2
            },
            'optimize_execution': {
                category: 'coordination',
                description: 'Optimize execution strategy for better performance',
                keywords: ['optimize', 'execution', 'performance', 'strategy'],
                priority: 2
            },
            'cache_strategy': {
                category: 'coordination',
                description: 'Implement caching strategy for repeated operations',
                keywords: ['cache', 'strategy', 'repeated', 'operations'],
                priority: 2
            },
            'parallel_execution': {
                category: 'coordination',
                description: 'Execute multiple tasks in parallel',
                keywords: ['parallel', 'execution', 'multiple', 'tasks'],
                priority: 2
            },
            'get_workflow_status': {
                category: 'coordination',
                description: 'Get current status of a workflow execution',
                keywords: ['get', 'workflow', 'status', 'execution'],
                priority: 2
            },

            // File Operations Tools
            'load_genome_file': {
                category: 'file_operations',
                description: 'Load genome files in FASTA or GenBank format directly by file path',
                keywords: ['load', 'genome', 'fasta', 'genbank', 'sequence'],
                priority: 1
            },
            'load_annotation_file': {
                category: 'file_operations',
                description: 'Load annotation files in GFF or BED format directly by file path',
                keywords: ['load', 'annotation', 'gff', 'bed', 'features'],
                priority: 1
            },
            'load_variant_file': {
                category: 'file_operations',
                description: 'Load variant files in VCF format directly by file path',
                keywords: ['load', 'variant', 'vcf', 'mutation', 'snp'],
                priority: 1
            },
            'load_reads_file': {
                category: 'file_operations',
                description: 'Load alignment files in SAM or BAM format directly by file path',
                keywords: ['load', 'reads', 'sam', 'bam', 'alignment'],
                priority: 1
            },
            'load_wig_tracks': {
                category: 'file_operations',
                description: 'Load WIG track files (multiple files supported) directly by file paths',
                keywords: ['load', 'wig', 'tracks', 'multiple', 'coverage'],
                priority: 1
            },
            'load_operon_file': {
                category: 'file_operations',
                description: 'Load operon files in JSON, CSV, or TXT format directly by file path',
                keywords: ['load', 'operon', 'json', 'csv', 'txt'],
                priority: 1
            },
            'export_fasta_sequence': {
                category: 'file_operations',
                description: 'Export genome sequences in FASTA format to specified file path',
                keywords: ['export', 'fasta', 'sequence', 'genome'],
                priority: 1
            },
            'export_genbank_format': {
                category: 'file_operations',
                description: 'Export genome data in GenBank format to specified file path',
                keywords: ['export', 'genbank', 'gbk', 'annotations'],
                priority: 1
            },
            'export_cds_fasta': {
                category: 'file_operations',
                description: 'Export coding sequences (CDS) in FASTA format to specified file path',
                keywords: ['export', 'cds', 'fasta', 'coding', 'sequences'],
                priority: 1
            },
            'export_protein_fasta': {
                category: 'file_operations',
                description: 'Export protein sequences translated from CDS in FASTA format to specified file path',
                keywords: ['export', 'protein', 'fasta', 'translation', 'amino'],
                priority: 1
            },
            'export_gff_annotations': {
                category: 'file_operations',
                description: 'Export feature annotations in GFF format to specified file path',
                keywords: ['export', 'gff', 'annotations', 'features'],
                priority: 1
            },
            'export_bed_format': {
                category: 'file_operations',
                description: 'Export feature annotations in BED format to specified file path',
                keywords: ['export', 'bed', 'annotations', 'features', 'track'],
                priority: 1
            },
            'export_current_view_fasta': {
                category: 'file_operations',
                description: 'Export current visible region as FASTA sequence to specified file path',
                keywords: ['export', 'current', 'view', 'fasta', 'region'],
                priority: 1
            },
            'configure_export_settings': {
                category: 'file_operations',
                description: 'Configure export settings and preferences for all export operations',
                keywords: ['configure', 'export', 'settings', 'preferences'],
                priority: 1
            },

            // External API Tools
            'blast_sequence': {
                category: 'external_apis',
                description: 'Perform BLAST search on a DNA sequence',
                keywords: ['blast', 'sequence', 'dna', 'search'],
                priority: 1
            },
            'blast_protein': {
                category: 'external_apis',
                description: 'Perform BLAST search on a protein sequence',
                keywords: ['blast', 'protein', 'sequence', 'search'],
                priority: 1
            },
            'uniprot_search': {
                category: 'external_apis',
                description: 'Search UniProt database for protein information',
                keywords: ['uniprot', 'search', 'protein', 'database'],
                priority: 1
            },
            'uniprot_get_protein': {
                category: 'external_apis',
                description: 'Get detailed protein information from UniProt',
                keywords: ['uniprot', 'get', 'protein', 'information'],
                priority: 1
            },
            'uniprot_get_annotation': {
                category: 'external_apis',
                description: 'Get protein annotations from UniProt',
                keywords: ['uniprot', 'get', 'annotation', 'protein'],
                priority: 2
            },
            'alphafold_search': {
                category: 'external_apis',
                description: 'Search AlphaFold database for protein structures',
                keywords: ['alphafold', 'search', 'protein', 'structure'],
                priority: 1
            },
            'alphafold_get_structure': {
                category: 'external_apis',
                description: 'Get protein structure from AlphaFold',
                keywords: ['alphafold', 'get', 'structure', 'protein'],
                priority: 1
            },
            'evo2_design': {
                category: 'external_apis',
                description: 'Design sequences using Evo2 AI model',
                keywords: ['evo2', 'design', 'sequences', 'ai'],
                priority: 1
            },
            'evo2_optimize': {
                category: 'external_apis',
                description: 'Optimize sequences using Evo2 AI model',
                keywords: ['evo2', 'optimize', 'sequences', 'ai'],
                priority: 2
            },
            'interpro_search': {
                category: 'external_apis',
                description: 'Search InterPro database for protein domains',
                keywords: ['interpro', 'search', 'protein', 'domains'],
                priority: 2
            },
            'kegg_search': {
                category: 'external_apis',
                description: 'Search KEGG database for pathway information',
                keywords: ['kegg', 'search', 'pathway', 'information'],
                priority: 2
            }
        };
    }

    /**
     * Create all tool definition files
     */
    async createAllTools() {
        console.log('🚀 Creating all tool definition files...');
        
        let created = 0;
        let skipped = 0;
        
        for (const [toolName, toolInfo] of Object.entries(this.toolDefinitions)) {
            try {
                const categoryPath = path.join(this.registryPath, toolInfo.category);
                const toolPath = path.join(categoryPath, `${toolName}.yaml`);
                
                // Check if file already exists
                try {
                    await fs.access(toolPath);
                    console.log(`⏭️  Skipping ${toolName} (already exists)`);
                    skipped++;
                    continue;
                } catch (error) {
                    // File doesn't exist, create it
                }
                
                // Create category directory if it doesn't exist
                await fs.mkdir(categoryPath, { recursive: true });
                
                // Generate tool definition
                const toolDefinition = this.generateToolDefinition(toolName, toolInfo);
                
                // Write YAML file
                const yamlContent = yaml.dump(toolDefinition, {
                    indent: 2,
                    lineWidth: 120,
                    noRefs: true
                });
                
                await fs.writeFile(toolPath, yamlContent, 'utf8');
                console.log(`✅ Created ${toolName}.yaml`);
                created++;
                
            } catch (error) {
                console.error(`❌ Failed to create ${toolName}:`, error.message);
            }
        }
        
        console.log(`\n📊 Summary:`);
        console.log(`   Created: ${created} tools`);
        console.log(`   Skipped: ${skipped} tools`);
        console.log(`   Total: ${Object.keys(this.toolDefinitions).length} tools`);
    }

    /**
     * Generate tool definition YAML structure
     */
    generateToolDefinition(toolName, toolInfo) {
        return {
            name: toolName,
            version: "1.0.0",
            description: toolInfo.description,
            category: toolInfo.category,
            keywords: toolInfo.keywords,
            priority: toolInfo.priority,
            
            execution: {
                type: this.getExecutionType(toolInfo.category),
                timeout: this.getTimeout(toolInfo.category),
                retries: 2,
                requires_auth: this.requiresAuth(toolInfo.category),
                requires_data: this.requiresData(toolInfo.category),
                requires_network: this.requiresNetwork(toolInfo.category)
            },
            
            parameters: {
                type: "object",
                properties: this.generateParameters(toolName, toolInfo.category),
                required: this.getRequiredParameters(toolName, toolInfo.category)
            },
            
            sample_usages: this.generateSampleUsages(toolName, toolInfo),
            
            relationships: {
                depends_on: [],
                conflicts_with: [],
                enhances: [],
                alternatives: [],
                prerequisites: [],
                follow_up: []
            },
            
            metadata: {
                usage_count: 0,
                success_rate: 0.0,
                avg_execution_time: 0,
                last_used: null,
                tags: this.generateTags(toolInfo),
                complexity: this.getComplexity(toolInfo.priority),
                usage_pattern: this.getUsagePattern(toolInfo.priority)
            },
            
            error_handling: this.generateErrorHandling(toolInfo.category),
            
            returns: this.generateReturns(toolInfo.category)
        };
    }

    /**
     * Get execution type based on category
     */
    getExecutionType(category) {
        const serverCategories = ['protein', 'database', 'ai_analysis', 'external_apis'];
        return serverCategories.includes(category) ? 'server' : 'client';
    }

    /**
     * Get timeout based on category
     */
    getTimeout(category) {
        const timeouts = {
            'ai_analysis': 120000,
            'external_apis': 120000,
            'database': 30000,
            'protein': 30000,
            'coordination': 60000,
            'default': 15000
        };
        return timeouts[category] || timeouts.default;
    }

    /**
     * Check if category requires authentication
     */
    requiresAuth(category) {
        return ['ai_analysis', 'external_apis'].includes(category);
    }

    /**
     * Check if category requires data
     */
    requiresData(category) {
        return ['navigation', 'sequence', 'sequence_editing'].includes(category);
    }

    /**
     * Check if category requires network
     */
    requiresNetwork(category) {
        return ['database', 'ai_analysis', 'external_apis', 'plugin_management'].includes(category);
    }

    /**
     * Generate parameters based on tool name and category
     */
    generateParameters(toolName, category) {
        const commonParams = {
            clientId: {
                type: "string",
                description: "Browser client ID for multi-window support",
                default: "default"
            }
        };

        // Add category-specific parameters
        const categoryParams = {
            'navigation': {
                chromosome: {
                    type: "string",
                    description: "Chromosome name",
                    examples: ["chr1", "NC_000913.3", "U00096"]
                },
                start: {
                    type: "number",
                    description: "Start position (1-based coordinate)",
                    minimum: 1
                },
                end: {
                    type: "number",
                    description: "End position (1-based coordinate)",
                    minimum: 1
                }
            },
            'sequence': {
                sequence: {
                    type: "string",
                    description: "DNA sequence to analyze",
                    examples: ["ATGCGCTATCG", "ATGAAATAG"]
                }
            },
            'protein': {
                geneName: {
                    type: "string",
                    description: "Gene name to search for",
                    examples: ["p53", "lacZ", "dnaA"]
                },
                organism: {
                    type: "string",
                    description: "Organism name",
                    default: "Homo sapiens"
                }
            },
            'database': {
                query: {
                    type: "string",
                    description: "Search query term"
                },
                searchType: {
                    type: "string",
                    description: "Type of search",
                    enum: ["protein_name", "gene_name", "uniprot_id"]
                }
            },
            'ai_analysis': {
                sequence: {
                    type: "string",
                    description: "DNA sequence for analysis"
                },
                maxTokens: {
                    type: "number",
                    description: "Maximum length of generated sequence",
                    default: 1000
                }
            },
            'sequence_editing': {
                chromosome: {
                    type: "string",
                    description: "Chromosome identifier"
                },
                start: {
                    type: "number",
                    description: "Start position (1-based coordinate)",
                    minimum: 1
                },
                end: {
                    type: "number",
                    description: "End position (1-based coordinate)",
                    minimum: 1
                }
            },
            'plugin_management': {
                pluginId: {
                    type: "string",
                    description: "Plugin identifier"
                },
                status: {
                    type: "string",
                    description: "Plugin status filter",
                    enum: ["all", "installed", "enabled", "disabled"]
                }
            },
            'coordination': {
                task: {
                    type: "string",
                    description: "Task description"
                },
                priority: {
                    type: "string",
                    description: "Task priority",
                    enum: ["low", "normal", "high", "urgent"],
                    default: "normal"
                }
            },
            'external_apis': {
                sequence: {
                    type: "string",
                    description: "Query sequence"
                },
                blastType: {
                    type: "string",
                    description: "Type of BLAST search",
                    enum: ["blastn", "blastp", "blastx", "tblastn", "tblastx"]
                },
                database: {
                    type: "string",
                    description: "Target database",
                    default: "nr"
                }
            }
        };

        return { ...commonParams, ...(categoryParams[category] || {}) };
    }

    /**
     * Get required parameters based on tool name
     */
    getRequiredParameters(toolName, category) {
        const required = {
            'navigation': ['chromosome'],
            'sequence': ['sequence'],
            'protein': ['geneName'],
            'database': ['query'],
            'ai_analysis': ['sequence'],
            'sequence_editing': ['chromosome', 'start', 'end'],
            'plugin_management': [],
            'coordination': ['task'],
            'external_apis': ['sequence', 'blastType', 'database']
        };

        return required[category] || [];
    }

    /**
     * Generate sample usages
     */
    generateSampleUsages(toolName, toolInfo) {
        return [
            {
                user_query: `Use ${toolName} to analyze genomic data`,
                tool_call: `${toolName}(parameter1='value1', parameter2='value2')`,
                thought: `User wants to use ${toolName} for ${toolInfo.description.toLowerCase()}`,
                expected_result: `Result from ${toolName} analysis`
            }
        ];
    }

    /**
     * Generate tags based on tool info
     */
    generateTags(toolInfo) {
        const tags = [toolInfo.category];
        if (toolInfo.priority === 1) tags.push('core', 'essential');
        if (toolInfo.priority === 2) tags.push('important');
        if (toolInfo.priority === 3) tags.push('optional');
        return tags;
    }

    /**
     * Get complexity based on priority
     */
    getComplexity(priority) {
        const complexities = { 1: 'simple', 2: 'moderate', 3: 'complex' };
        return complexities[priority] || 'moderate';
    }

    /**
     * Get usage pattern based on priority
     */
    getUsagePattern(priority) {
        const patterns = { 1: 'frequent', 2: 'common', 3: 'occasional' };
        return patterns[priority] || 'common';
    }

    /**
     * Generate error handling
     */
    generateErrorHandling(category) {
        const errorHandling = {
            'navigation': {
                invalid_chromosome: "Returns error if chromosome not found",
                invalid_position: "Returns error if position is invalid"
            },
            'sequence': {
                invalid_sequence: "Returns error if sequence is invalid",
                empty_sequence: "Returns error if sequence is empty"
            },
            'protein': {
                gene_not_found: "Returns error if gene not found",
                structure_not_found: "Returns error if structure not found"
            },
            'database': {
                network_error: "Returns error if database is unavailable",
                query_error: "Returns error if query is invalid"
            },
            'ai_analysis': {
                api_error: "Returns error if AI service is unavailable",
                generation_failed: "Returns error if generation fails"
            },
            'sequence_editing': {
                invalid_region: "Returns error if region is invalid",
                clipboard_error: "Returns error if clipboard operation fails"
            },
            'plugin_management': {
                plugin_not_found: "Returns error if plugin not found",
                installation_failed: "Returns error if installation fails"
            },
            'coordination': {
                task_decomposition_failed: "Returns error if task cannot be decomposed",
                agent_unavailable: "Returns error if required agent is unavailable"
            },
            'external_apis': {
                api_error: "Returns error if external API is unavailable",
                network_timeout: "Returns error if request times out"
            }
        };

        return errorHandling[category] || {};
    }

    /**
     * Generate returns specification
     */
    generateReturns(category) {
        const returns = {
            'navigation': {
                success: "boolean - Whether operation was successful",
                message: "string - Status message or error description",
                position: "object - New browser position information"
            },
            'sequence': {
                success: "boolean - Whether analysis was successful",
                result: "object - Analysis results",
                sequence: "string - Processed sequence"
            },
            'protein': {
                success: "boolean - Whether search was successful",
                structures: "array - List of protein structures found",
                confidence: "number - Confidence score"
            },
            'database': {
                success: "boolean - Whether search was successful",
                results: "array - List of database entries found",
                count: "number - Number of results"
            },
            'ai_analysis': {
                success: "boolean - Whether analysis was successful",
                generated_sequence: "string - Generated DNA sequence",
                confidence_scores: "array - Confidence scores for each position"
            },
            'sequence_editing': {
                success: "boolean - Whether operation was successful",
                action_id: "string - Unique identifier for this action",
                sequence_length: "number - Length of processed sequence"
            },
            'plugin_management': {
                success: "boolean - Whether operation was successful",
                plugins: "array - List of plugins",
                count: "number - Number of plugins"
            },
            'coordination': {
                success: "boolean - Whether coordination was successful",
                task_id: "string - Unique identifier for this task",
                results: "object - Integrated results from all subtasks"
            },
            'external_apis': {
                success: "boolean - Whether API call was successful",
                results: "array - List of API results",
                execution_time: "number - API call execution time"
            }
        };

        return returns[category] || {
            success: "boolean - Whether operation was successful",
            result: "object - Operation result"
        };
    }
}

// Run the script if called directly
if (require.main === module) {
    const creator = new ToolDefinitionCreator();
    creator.createAllTools().then(() => {
        console.log('🎉 All tool definition files created successfully!');
    }).catch(error => {
        console.error('❌ Failed to create tool definitions:', error);
        process.exit(1);
    });
}

module.exports = ToolDefinitionCreator;
