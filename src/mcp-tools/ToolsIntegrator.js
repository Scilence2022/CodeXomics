/**
 * Tools Integrator Module
 * Combines all tool modules into a unified interface
 */

const NavigationTools = require('./navigation/NavigationTools');
const SequenceTools = require('./sequence/SequenceTools');
const ProteinTools = require('./protein/ProteinTools');
const DatabaseTools = require('./database/DatabaseTools');
const Evo2Tools = require('./evo2/Evo2Tools');
const DataTools = require('./data/DataTools');
const PathwayTools = require('./pathway/PathwayTools');
const ActionTools = require('./action/ActionTools');

class ToolsIntegrator {
    constructor(server) {
        this.server = server;
        
        // Initialize all tool modules
        this.navigationTools = new NavigationTools(server);
        this.sequenceTools = new SequenceTools(server);
        this.proteinTools = new ProteinTools(server);
        this.databaseTools = new DatabaseTools(server);
        this.evo2Tools = new Evo2Tools(server);
        this.dataTools = new DataTools(server);
        this.pathwayTools = new PathwayTools(server);
        this.actionTools = new ActionTools(server);
        
        // Combine all tools
        this.allTools = this.combineAllTools();
    }

    combineAllTools() {
        return {
            ...this.navigationTools.getTools(),
            ...this.sequenceTools.getTools(),
            ...this.proteinTools.getTools(),
            ...this.databaseTools.getTools(),
            ...this.evo2Tools.getTools(),
            ...this.dataTools.getTools(),
            ...this.pathwayTools.getTools(),
            ...this.actionTools.getTools()
        };
    }

    getAvailableTools() {
        const tools = Object.values(this.allTools);
        
        // Convert 'parameters' to 'inputSchema' for MCP SDK compatibility
        return tools.map(tool => {
            if (tool.parameters && !tool.inputSchema) {
                return {
                    ...tool,
                    inputSchema: tool.parameters
                };
            }
            return tool;
        });
    }

    getToolByName(toolName) {
        return this.allTools[toolName];
    }

    async executeTool(toolName, parameters, clientId) {
        const tool = this.allTools[toolName];
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        // Route to appropriate tool module based on tool name
        try {
            // Navigation tools
            if (this.navigationTools.getTools()[toolName]) {
                return await this.navigationTools.executeClientTool(toolName, parameters, clientId);
            }
            
            // Sequence tools
            if (this.sequenceTools.getTools()[toolName]) {
                if (toolName === 'get_coding_sequence') {
                    return await this.sequenceTools.getCodingSequence(parameters, clientId);
                } else if (toolName === 'compute_gc') {
                    return { gcContent: this.sequenceTools.calculateGCContent(parameters.sequence) };
                } else if (toolName === 'translate_dna') {
                    return { protein: this.sequenceTools.translateDNA(parameters.dna, parameters.frame) };
                } else if (toolName === 'reverse_complement') {
                    return { reverseComplement: this.sequenceTools.reverseComplement(parameters.dna) };
                } else if (toolName === 'find_orfs') {
                    return { orfs: this.sequenceTools.findORFs(parameters.dna, parameters.minLength) };
                } else {
                    return await this.sequenceTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // Protein tools
            if (this.proteinTools.getTools()[toolName]) {
                switch (toolName) {
                    case 'fetch_protein_structure':
                        return await this.proteinTools.fetchProteinStructure(parameters);
                    case 'search_protein_by_gene':
                        return await this.proteinTools.searchProteinByGene(parameters);
                    case 'search_alphafold_by_gene':
                        return await this.proteinTools.searchAlphaFoldByGene(parameters);
                    case 'fetch_alphafold_structure':
                        return await this.proteinTools.fetchAlphaFoldStructure(parameters);
                    case 'search_alphafold_by_sequence':
                        return await this.proteinTools.searchAlphaFoldBySequence(parameters);
                    case 'open_alphafold_viewer':
                        return await this.proteinTools.openAlphaFoldViewer(parameters, clientId);
                    default:
                        return await this.proteinTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // Database tools
            if (this.databaseTools.getTools()[toolName]) {
                switch (toolName) {
                    case 'search_uniprot_database':
                        return await this.databaseTools.searchUniProtDatabase(parameters);
                    case 'advanced_uniprot_search':
                        return await this.databaseTools.advancedUniProtSearch(parameters);
                    case 'get_uniprot_entry':
                        return await this.databaseTools.getUniProtEntry(parameters);
                    case 'analyze_interpro_domains':
                        return await this.databaseTools.analyzeInterProDomains(parameters);
                    case 'search_interpro_entry':
                        return await this.databaseTools.searchInterProEntry(parameters);
                    case 'get_interpro_entry_details':
                        return await this.databaseTools.getInterProEntryDetails(parameters);
                    default:
                        return await this.databaseTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // EVO2 tools
            if (this.evo2Tools.getTools()[toolName]) {
                switch (toolName) {
                    case 'evo2_generate_sequence':
                        return await this.evo2Tools.evo2GenerateSequence(parameters);
                    case 'evo2_predict_function':
                        return await this.evo2Tools.evo2PredictFunction(parameters);
                    case 'evo2_design_crispr':
                        return await this.evo2Tools.evo2DesignCrispr(parameters);
                    case 'evo2_optimize_sequence':
                        return await this.evo2Tools.evo2OptimizeSequence(parameters);
                    case 'evo2_analyze_essentiality':
                        return await this.evo2Tools.evo2AnalyzeEssentiality(parameters);
                    default:
                        return await this.evo2Tools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // Data tools
            if (this.dataTools.getTools()[toolName]) {
                if (toolName === 'codon_usage_analysis') {
                    return await this.dataTools.analyzeCodonUsage(parameters);
                } else {
                    return await this.dataTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // Pathway tools
            if (this.pathwayTools.getTools()[toolName]) {
                switch (toolName) {
                    case 'show_metabolic_pathway':
                        return this.pathwayTools.generatePathwayVisualization(
                            parameters.pathwayName, 
                            parameters.highlightGenes || []
                        );
                    case 'find_pathway_genes':
                        return this.pathwayTools.findGenesInPathway(
                            parameters.pathwayName, 
                            parameters.includeRegulation || false
                        );
                    case 'blast_search':
                        return await this.pathwayTools.performBLASTSearch(
                            parameters.sequence,
                            parameters.blastType,
                            parameters.database,
                            parameters.evalue,
                            parameters.maxTargets
                        );
                    default:
                        return await this.pathwayTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            // Action tools
            if (this.actionTools.getTools()[toolName]) {
                switch (toolName) {
                    case 'copySequence':
                        return await this.actionTools.copySequence(parameters, clientId);
                    case 'cutSequence':
                        return await this.actionTools.cutSequence(parameters, clientId);
                    case 'pasteSequence':
                        return await this.actionTools.pasteSequence(parameters, clientId);
                    case 'deleteSequence':
                        return await this.actionTools.deleteSequence(parameters, clientId);
                    case 'insertSequence':
                        return await this.actionTools.insertSequence(parameters, clientId);
                    case 'replaceSequence':
                        return await this.actionTools.replaceSequence(parameters, clientId);
                    case 'getActionList':
                        return await this.actionTools.getActionList(parameters, clientId);
                    case 'executeActions':
                        return await this.actionTools.executeActions(parameters, clientId);
                    case 'clearActions':
                        return await this.actionTools.clearActions(parameters, clientId);
                    case 'getClipboardContent':
                        return await this.actionTools.getClipboardContent(parameters, clientId);
                    case 'undoLastAction':
                        return await this.actionTools.undoLastAction(parameters, clientId);
                    default:
                        return await this.actionTools.executeClientTool(toolName, parameters, clientId);
                }
            }
            
            throw new Error(`Tool execution handler not found for '${toolName}'`);
            
        } catch (error) {
            console.error(`Error executing tool '${toolName}':`, error);
            throw error;
        }
    }

    // Tool categorization for better organization
    getToolsByCategory() {
        return {
            navigation: {
                name: 'Navigation & State Management',
                description: 'Tools for genome navigation and browser state management',
                tools: Object.keys(this.navigationTools.getTools())
            },
            sequence: {
                name: 'Sequence Analysis',
                description: 'Tools for DNA/RNA sequence analysis and manipulation',
                tools: Object.keys(this.sequenceTools.getTools())
            },
            protein: {
                name: 'Protein Structure',
                description: 'Tools for protein structure analysis and visualization',
                tools: Object.keys(this.proteinTools.getTools())
            },
            database: {
                name: 'Database Integration',
                description: 'Tools for accessing biological databases',
                tools: Object.keys(this.databaseTools.getTools())
            },
            evo2: {
                name: 'AI-Powered Analysis (EVO2)',
                description: 'NVIDIA EVO2 AI tools for sequence generation and analysis',
                tools: Object.keys(this.evo2Tools.getTools())
            },
            data: {
                name: 'Data Management',
                description: 'Tools for data annotation, export, and analysis',
                tools: Object.keys(this.dataTools.getTools())
            },
            pathway: {
                name: 'Pathway & Search',
                description: 'Tools for metabolic pathway analysis and sequence search',
                tools: Object.keys(this.pathwayTools.getTools())
            }
        };
    }

    // Statistics about available tools
    getToolStatistics() {
        const categories = this.getToolsByCategory();
        const totalTools = Object.keys(this.allTools).length;
        
        return {
            totalTools: totalTools,
            categories: Object.keys(categories).length,
            toolsByCategory: Object.fromEntries(
                Object.entries(categories).map(([key, category]) => [
                    key, 
                    { name: category.name, count: category.tools.length }
                ])
            ),
            serverSideTools: [
                'fetch_protein_structure', 'search_protein_by_gene', 'search_alphafold_by_gene',
                'fetch_alphafold_structure', 'search_alphafold_by_sequence', 'search_uniprot_database',
                'advanced_uniprot_search', 'get_uniprot_entry', 'analyze_interpro_domains',
                'search_interpro_entry', 'get_interpro_entry_details', 'evo2_generate_sequence',
                'evo2_predict_function', 'evo2_design_crispr', 'evo2_optimize_sequence',
                'evo2_analyze_essentiality'
            ].length,
            clientSideTools: totalTools - [
                'fetch_protein_structure', 'search_protein_by_gene', 'search_alphafold_by_gene',
                'fetch_alphafold_structure', 'search_alphafold_by_sequence', 'search_uniprot_database',
                'advanced_uniprot_search', 'get_uniprot_entry', 'analyze_interpro_domains',
                'search_interpro_entry', 'get_interpro_entry_details', 'evo2_generate_sequence',
                'evo2_predict_function', 'evo2_design_crispr', 'evo2_optimize_sequence',
                'evo2_analyze_essentiality'
            ].length
        };
    }

    // Validate tool parameters
    validateToolParameters(toolName, parameters) {
        const tool = this.allTools[toolName];
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        const required = tool.parameters.required || [];
        const properties = tool.parameters.properties || {};

        // Check required parameters
        for (const param of required) {
            if (!(param in parameters)) {
                throw new Error(`Required parameter '${param}' missing for tool '${toolName}'`);
            }
        }

        // Basic type validation
        for (const [param, value] of Object.entries(parameters)) {
            if (properties[param]) {
                const expectedType = properties[param].type;
                const actualType = typeof value;
                
                if (expectedType === 'number' && actualType !== 'number') {
                    throw new Error(`Parameter '${param}' should be a number, got ${actualType}`);
                }
                if (expectedType === 'string' && actualType !== 'string') {
                    throw new Error(`Parameter '${param}' should be a string, got ${actualType}`);
                }
                if (expectedType === 'boolean' && actualType !== 'boolean') {
                    throw new Error(`Parameter '${param}' should be a boolean, got ${actualType}`);
                }
                if (expectedType === 'array' && !Array.isArray(value)) {
                    throw new Error(`Parameter '${param}' should be an array, got ${actualType}`);
                }
            }
        }

        return true;
    }

    // Get tool documentation
    getToolDocumentation(toolName) {
        const tool = this.allTools[toolName];
        if (!tool) {
            throw new Error(`Tool '${toolName}' not found`);
        }

        const categories = this.getToolsByCategory();
        let category = 'unknown';
        
        for (const [catKey, catData] of Object.entries(categories)) {
            if (catData.tools.includes(toolName)) {
                category = catData.name;
                break;
            }
        }

        return {
            name: tool.name,
            description: tool.description,
            category: category,
            parameters: tool.parameters,
            examples: this.getToolExamples(toolName)
        };
    }

    // Get example usage for tools
    getToolExamples(toolName) {
        const examples = {
            navigate_to_position: {
                description: 'Navigate to a specific genomic region',
                example: {
                    chromosome: 'chr1',
                    start: 1000,
                    end: 2000
                }
            },
            compute_gc: {
                description: 'Calculate GC content of a DNA sequence',
                example: {
                    sequence: 'ATCGATCGATCG'
                }
            },
            translate_dna: {
                description: 'Translate DNA to protein sequence',
                example: {
                    dna: 'ATGAAATAA',
                    frame: 0
                }
            },
            search_uniprot_database: {
                description: 'Search UniProt database for proteins',
                example: {
                    query: 'insulin',
                    searchType: 'protein_name',
                    limit: 10
                }
            },
            evo2_generate_sequence: {
                description: 'Generate DNA sequence using EVO2 AI',
                example: {
                    prompt: 'ATCG',
                    maxTokens: 100,
                    temperature: 1.0
                }
            }
        };

        return examples[toolName] || { description: 'No examples available', example: {} };
    }
}

module.exports = ToolsIntegrator; 