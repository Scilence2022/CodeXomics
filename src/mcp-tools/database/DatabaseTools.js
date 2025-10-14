/**
 * Database Tools Module
 * Handles UniProt and InterPro database searches and analysis
 */

const https = require('https');

class DatabaseTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            search_uniprot_database: {
                name: 'search_uniprot_database',
                description: 'Search UniProt database with various search types and filters',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query term' },
                        searchType: { 
                            type: 'string', 
                            description: 'Type of search: protein_name, gene_name, uniprot_id, organism, keyword, annotation, or sequence',
                            enum: ['protein_name', 'gene_name', 'uniprot_id', 'organism', 'keyword', 'annotation', 'sequence']
                        },
                        organism: { type: 'string', description: 'Organism filter (taxon ID or scientific name)' },
                        reviewedOnly: { type: 'boolean', description: 'Only return reviewed (SwissProt) entries' },
                        minLength: { type: 'number', description: 'Minimum protein sequence length' },
                        maxLength: { type: 'number', description: 'Maximum protein sequence length' },
                        limit: { type: 'number', description: 'Maximum number of results to return', default: 50 },
                        includeSequence: { type: 'boolean', description: 'Include protein sequences in results', default: true },
                        includeFeatures: { type: 'boolean', description: 'Include protein features in results', default: true }
                    },
                    required: ['query', 'searchType']
                }
            },

            advanced_uniprot_search: {
                name: 'advanced_uniprot_search',
                description: 'Advanced UniProt search with multiple query fields',
                parameters: {
                    type: 'object',
                    properties: {
                        proteinName: { type: 'string', description: 'Protein name query' },
                        geneName: { type: 'string', description: 'Gene name query' },
                        organism: { type: 'string', description: 'Organism filter' },
                        keywords: { type: 'array', items: { type: 'string' }, description: 'Keyword filters' },
                        subcellularLocation: { type: 'string', description: 'Subcellular location filter' },
                        function: { type: 'string', description: 'Protein function filter' },
                        reviewedOnly: { type: 'boolean', description: 'Only reviewed entries' },
                        limit: { type: 'number', description: 'Maximum results', default: 25 }
                    },
                    required: []
                }
            },

            get_uniprot_entry: {
                name: 'get_uniprot_entry',
                description: 'Get detailed information for a specific UniProt entry',
                parameters: {
                    type: 'object',
                    properties: {
                        uniprotId: { type: 'string', description: 'UniProt accession ID' },
                        includeSequence: { type: 'boolean', description: 'Include protein sequence', default: true },
                        includeFeatures: { type: 'boolean', description: 'Include protein features', default: true },
                        includeCrossRefs: { type: 'boolean', description: 'Include cross-references', default: false }
                    },
                    required: ['uniprotId']
                }
            },

            analyze_interpro_domains: {
                name: 'analyze_interpro_domains',
                description: 'Analyze protein domains, families, and functional sites using InterPro database. Enhanced with multiple input methods and comprehensive analysis options.',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'Protein amino acid sequence to analyze (single-letter code)' },
                        uniprot_id: { type: 'string', description: 'UniProt accession ID as alternative input' },
                        geneName: { type: 'string', description: 'Gene name as alternative input' },
                        organism: { type: 'string', description: 'Organism name for gene name resolution', default: 'Homo sapiens' },
                        applications: { 
                            type: 'array', 
                            items: { type: 'string' },
                            description: 'InterPro member databases to search',
                            default: ['Pfam', 'SMART', 'PROSITE', 'PANTHER', 'Gene3D']
                        },
                        analysis_type: {
                            type: 'string',
                            enum: ['domains', 'families', 'sites', 'repeats', 'complete'],
                            description: 'Type of InterPro analysis to perform',
                            default: 'complete'
                        },
                        include_superfamilies: { type: 'boolean', description: 'Include protein superfamily classifications', default: true },
                        confidence_threshold: { type: 'number', description: 'Minimum confidence score (0.0-1.0)', default: 0.5 },
                        output_format: {
                            type: 'string',
                            enum: ['summary', 'detailed', 'graphical', 'json'],
                            description: 'Format for analysis output',
                            default: 'detailed'
                        },
                        goterms: { type: 'boolean', description: 'Include Gene Ontology terms', default: true },
                        pathways: { type: 'boolean', description: 'Include pathway information', default: true },
                        include_match_sequence: { type: 'boolean', description: 'Include matched sequence regions', default: true },
                        email_notification: { type: 'string', description: 'Email for job completion notification' },
                        priority: {
                            type: 'string',
                            enum: ['low', 'normal', 'high'],
                            description: 'Job priority level',
                            default: 'normal'
                        }
                    },
                    required: []
                }
            },

            search_interpro_entry: {
                name: 'search_interpro_entry',
                description: 'Search InterPro database for domain families, functional sites, and protein signatures. Enhanced with batch processing and advanced filtering.',
                parameters: {
                    type: 'object',
                    properties: {
                        search_term: { type: 'string', description: 'Single search term for InterPro entries' },
                        search_terms: { 
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Multiple search terms for batch processing'
                        },
                        search_type: { 
                            type: 'string', 
                            description: 'Type of search: name, description, keyword, signature, go_term, literature, or all',
                            enum: ['name', 'description', 'keyword', 'signature', 'go_term', 'literature', 'all'],
                            default: 'all'
                        },
                        entry_type: {
                            type: 'string',
                            enum: ['domain', 'family', 'repeat', 'site', 'homologous_superfamily', 'conserved_site', 'binding_site', 'active_site', 'all'],
                            description: 'Filter by InterPro entry type',
                            default: 'all'
                        },
                        database_source: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Filter by member databases',
                            default: []
                        },
                        max_results: { type: 'number', description: 'Maximum results per search term', default: 50 },
                        min_protein_count: { type: 'number', description: 'Minimum proteins containing entry', default: 0 },
                        sort_by: {
                            type: 'string',
                            enum: ['relevance', 'name', 'type', 'protein_count', 'creation_date', 'update_date'],
                            description: 'Sort order for results',
                            default: 'relevance'
                        },
                        include_statistics: { type: 'boolean', description: 'Include search statistics', default: true },
                        include_cross_references: { type: 'boolean', description: 'Include cross-references', default: false },
                        organism_filter: { type: 'string', description: 'Filter by organism' },
                        taxonomy_filter: {
                            type: 'array',
                            items: { type: 'number' },
                            description: 'Filter by taxonomy IDs',
                            default: []
                        },
                        confidence_level: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'all'],
                            description: 'Confidence level filter',
                            default: 'all'
                        },
                        fuzzy_matching: { type: 'boolean', description: 'Enable fuzzy string matching', default: false }
                    },
                    oneOf: [
                        { required: ['search_term'] },
                        { required: ['search_terms'] }
                    ]
                }
            },

            get_interpro_entry_details: {
                name: 'get_interpro_entry_details',
                description: 'Get detailed information for a specific InterPro entry',
                parameters: {
                    type: 'object',
                    properties: {
                        interproId: { type: 'string', description: 'InterPro entry ID (e.g., IPR000001)' },
                        includeProteins: { type: 'boolean', description: 'Include associated proteins', default: true },
                        includeStructures: { type: 'boolean', description: 'Include structure information', default: true },
                        includeTaxonomy: { type: 'boolean', description: 'Include taxonomic distribution', default: false }
                    },
                    required: ['interproId']
                }
            }
        };
    }

    async searchUniProtDatabase(parameters) {
        return await this.server.searchUniProtDatabase(parameters);
    }

    async advancedUniProtSearch(parameters) {
        return await this.server.advancedUniProtSearch(parameters);
    }

    async getUniProtEntry(parameters) {
        return await this.server.getUniProtEntry(parameters);
    }

    async analyzeInterProDomains(parameters) {
        return await this.server.analyzeInterProDomains(parameters);
    }

    async searchInterProEntry(parameters) {
        return await this.server.searchInterProEntry(parameters);
    }

    async getInterProEntryDetails(parameters) {
        return await this.server.getInterProEntryDetails(parameters);
    }

    async searchUniProtBySequence(sequence, limit = 50) {
        return await this.server.searchUniProtBySequence(sequence, limit);
    }

    async submitInterProJob(sequence, applications) {
        return await this.server.submitInterProJob(sequence, applications);
    }

    async waitForInterProResults(jobId, maxWaitTime = 300000) {
        return await this.server.waitForInterProResults(jobId, maxWaitTime);
    }

    async processInterProResults(results, sequence, includeGoTerms, includePathways, includeMatchSequence) {
        return await this.server.processInterProResults(results, sequence, includeGoTerms, includePathways, includeMatchSequence);
    }

    async simulateInterProAnalysis(sequence, applications) {
        return await this.server.simulateInterProAnalysis(sequence, applications);
    }

    formatInterProEntry(entry, includeProteins = false, includeStructures = false) {
        return this.server.formatInterProEntry(entry, includeProteins, includeStructures);
    }

    extractProteinName(entry) {
        return this.server.extractProteinName(entry);
    }

    extractAlternativeNames(entry) {
        return this.server.extractAlternativeNames(entry);
    }

    extractGeneNames(entry) {
        return this.server.extractGeneNames(entry);
    }

    extractProteinFunction(entry) {
        return this.server.extractProteinFunction(entry);
    }

    extractSubcellularLocation(entry) {
        return this.server.extractSubcellularLocation(entry);
    }

    extractPathways(entry) {
        return this.server.extractPathways(entry);
    }

    extractProteinFeatures(entry) {
        return this.server.extractProteinFeatures(entry);
    }

    extractKeywords(entry) {
        return this.server.extractKeywords(entry);
    }

    extractGOTerms(entry) {
        return this.server.extractGOTerms(entry);
    }

    extractCrossReferences(entry) {
        return this.server.extractCrossReferences(entry);
    }

    calculateSequenceSimilarity(seq1, seq2) {
        return this.server.calculateSequenceSimilarity(seq1, seq2);
    }

    classifyDomainType(signature) {
        return this.server.classifyDomainType(signature);
    }

    calculateDomainCoverage(matches, sequenceLength) {
        return this.server.calculateDomainCoverage(matches, sequenceLength);
    }

    makeHTTPSRequest(options, postData = null) {
        return this.server.makeHTTPSRequest(options, postData);
    }
}

module.exports = DatabaseTools; 