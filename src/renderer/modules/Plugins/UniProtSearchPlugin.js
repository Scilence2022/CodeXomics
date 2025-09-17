/**
 * UniProtSearchPlugin - Protein database search integration for GenomeExplorer
 * Provides comprehensive UniProt database search functionality for ChatBox LLM integration
 * Enables natural language protein queries with structured results
 */
class UniProtSearchPlugin {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        this.initialized = false;
        
        // UniProt API configuration
        this.apiBaseUrl = 'https://rest.uniprot.org';
        this.defaultParams = {
            maxResults: 25,
            includeSequence: true,
            includeFeatures: true,
            reviewedOnly: false,
            timeout: 30000
        };
        
        // Organism mapping for common species
        this.organismMap = {
            'human': '9606',
            'homo sapiens': '9606',
            'mouse': '10090',
            'mus musculus': '10090',
            'ecoli': '83333',
            'e. coli': '83333',
            'escherichia coli': '83333',
            'corynebacterium glutamicum': '196627',
            'yeast': '559292',
            'saccharomyces cerevisiae': '559292',
            'fly': '7227',
            'drosophila melanogaster': '7227',
            'worm': '6239',
            'caenorhabditis elegans': '6239',
            'arabidopsis': '3702',
            'arabidopsis thaliana': '3702'
        };
        
        console.log('UniProtSearchPlugin constructor called');
    }

    /**
     * Initialize the plugin
     */
    static init(app, configManager) {
        return new UniProtSearchPlugin(app, configManager);
    }

    /**
     * Search UniProt database with comprehensive parameters
     * Main function for ChatBox LLM integration
     */
    async searchUniProt(params) {
        try {
            console.log('🔍 UniProt search initiated with params:', params);
            
            // Validate required parameters
            if (!params.query) {
                throw new Error('Search query is required');
            }
            
            // Extract and process parameters
            const {
                query,
                searchType = 'auto',
                organism = null,
                reviewedOnly = false,
                minLength = null,
                maxLength = null,
                maxResults = this.defaultParams.maxResults,
                includeSequence = true,
                includeFunction = true
            } = params;
            
            console.log(`🔍 Processing search: query="${query}", type="${searchType}", organism="${organism}"`);
            
            // Build search query
            const searchQuery = this.buildSearchQuery(query, searchType, organism, reviewedOnly, minLength, maxLength);
            console.log(`🔍 Built UniProt query: ${searchQuery}`);
            
            // Perform API search
            console.log('🌐 Making UniProt API request...');
            let results = await this.performAPISearch(searchQuery, maxResults, includeSequence, includeFunction);
            console.log(`🌐 UniProt API returned ${results.length} raw results`);
            
            // If no results and searchType is auto or gene_name, try alternative searches
            if (results.length === 0 && (searchType === 'auto' || searchType === 'gene_name')) {
                console.log('🔍 No results found, trying alternative search strategies...');
                
                // Try without reviewed filter
                if (reviewedOnly) {
                    console.log('🔍 Trying search without reviewed filter...');
                    const altQuery = this.buildSearchQuery(query, searchType, organism, false, minLength, maxLength);
                    const altResults = await this.performAPISearch(altQuery, maxResults, includeSequence, includeFunction);
                    console.log(`🔍 Alternative search returned ${altResults.length} results`);
                    if (altResults.length > 0) {
                        results = altResults;
                    }
                }
                
                // Try general search if still no results
                if (results.length === 0) {
                    console.log('🔍 Trying general search...');
                    const generalQuery = this.buildSearchQuery(query, 'keyword', organism, false, minLength, maxLength);
                    const generalResults = await this.performAPISearch(generalQuery, maxResults, includeSequence, includeFunction);
                    console.log(`🔍 General search returned ${generalResults.length} results`);
                    if (generalResults.length > 0) {
                        results = generalResults;
                    }
                }
            }
            
            // Process and format results
            const formattedResults = this.formatSearchResults(results);
            console.log(`✅ Formatted ${formattedResults.length} results for ChatBox`);
            
            // Return structured response for ChatBox
            const response = {
                success: true,
                resultCount: formattedResults.length,
                query: query,
                searchType: searchType,
                organism: organism,
                results: formattedResults,
                summary: this.generateSearchSummary(formattedResults, query),
                timestamp: new Date().toISOString()
            };
            
            console.log('✅ UniProt search completed successfully:', response);
            return response;
            
        } catch (error) {
            console.error('❌ UniProt search failed:', error);
            const errorResponse = {
                success: false,
                error: error.message,
                query: params.query,
                timestamp: new Date().toISOString()
            };
            console.log('❌ Returning error response:', errorResponse);
            return errorResponse;
        }
    }

    /**
     * Search proteins by gene name - optimized for gene queries
     */
    async searchByGene(params) {
        console.log('🧬 searchByGene called with params:', params);
        
        const { geneName, organism = null, reviewedOnly = true, maxResults = 10 } = params;
        
        console.log(`🧬 Searching gene: "${geneName}" in organism: "${organism || 'any'}", reviewed: ${reviewedOnly}`);
        
        const result = await this.searchUniProt({
            query: geneName,
            searchType: 'gene_name',
            organism: organism,
            reviewedOnly: reviewedOnly,
            maxResults: maxResults
        });
        
        console.log('🧬 searchByGene result:', result);
        return result;
    }

    /**
     * Search proteins by protein name - optimized for protein queries
     */
    async searchByProtein(params) {
        const { proteinName, organism = null, reviewedOnly = true, maxResults = 10 } = params;
        
        return await this.searchUniProt({
            query: proteinName,
            searchType: 'protein_name',
            organism: organism,
            reviewedOnly: reviewedOnly,
            maxResults: maxResults
        });
    }

    /**
     * Get protein details by UniProt ID
     */
    async getProteinById(params) {
        const { uniprotId, includeSequence = true, includeFeatures = true } = params;
        
        return await this.searchUniProt({
            query: uniprotId,
            searchType: 'uniprot_id',
            maxResults: 1,
            includeSequence: includeSequence,
            includeFunction: includeFeatures
        });
    }

    /**
     * Search proteins by functional keywords
     */
    async searchByFunction(params) {
        const { keywords, organism = null, reviewedOnly = false, maxResults = 25 } = params;
        
        return await this.searchUniProt({
            query: keywords,
            searchType: 'keyword',
            organism: organism,
            reviewedOnly: reviewedOnly,
            maxResults: maxResults
        });
    }

    /**
     * Build UniProt search query from parameters
     */
    buildSearchQuery(query, searchType, organism, reviewedOnly, minLength, maxLength) {
        let searchParts = [];
        
        // Add main query based on search type
        switch (searchType) {
            case 'protein_name':
                searchParts.push(`protein_name:${query}`);
                break;
            case 'gene_name':
                searchParts.push(`gene:${query}`);
                break;
            case 'uniprot_id':
                searchParts.push(`accession:${query}`);
                break;
            case 'keyword':
                searchParts.push(`keyword:${query}`);
                break;
            case 'organism':
                searchParts.push(`organism_name:${query}`);
                break;
            case 'auto':
            default:
                // Auto-detect search type based on query pattern
                if (/^[A-Z0-9]{6,10}$/.test(query)) {
                    searchParts.push(`accession:${query}`);
                } else if (query.length < 10 && /^[A-Z0-9_-]+$/i.test(query)) {
                    searchParts.push(`gene:${query}`);
                } else {
                    searchParts.push(query);
                }
        }
        
        // Add organism filter
        if (organism) {
            const organismId = this.resolveOrganism(organism);
            if (organismId) {
                const organismMap = {
                    '9606': 'Homo sapiens',
                    '10090': 'Mus musculus',
                    '83333': 'Escherichia coli',
                    '196627': 'Corynebacterium glutamicum',
                    '559292': 'Saccharomyces cerevisiae',
                    '7227': 'Drosophila melanogaster',
                    '6239': 'Caenorhabditis elegans',
                    '3702': 'Arabidopsis thaliana'
                };
                const organismName = organismMap[organismId] || organism;
                searchParts.push(`organism_name:"${organismName}"`);
            }
        }
        
        // Add reviewed filter
        if (reviewedOnly) {
            searchParts.push('reviewed:true');
        }
        
        // Add length filters
        if (minLength) {
            searchParts.push(`length:[${minLength} TO *]`);
        }
        if (maxLength) {
            searchParts.push(`length:[* TO ${maxLength}]`);
        }
        
        return searchParts.join(' AND ');
    }

    /**
     * Resolve organism name to taxonomy ID
     */
    resolveOrganism(organism) {
        const normalizedOrganism = organism.toLowerCase();
        return this.organismMap[normalizedOrganism] || null;
    }

    /**
     * Perform UniProt API search
     */
    async performAPISearch(searchQuery, maxResults, includeSequence, includeFunction) {
        try {
            // Build field list
            let fields = ['accession', 'id', 'gene_names', 'organism_name', 'protein_name', 'length', 'mass', 'reviewed'];
            
            if (includeSequence) {
                fields.push('sequence');
            }
            
            if (includeFunction) {
                fields.push('cc_function', 'ft_domain');
            }
            
            // Construct API URL
            const apiUrl = `${this.apiBaseUrl}/uniprotkb/search?query=${encodeURIComponent(searchQuery)}&format=json&size=${maxResults}&fields=${fields.join(',')}`;
            
            console.log('🌐 UniProt API URL:', apiUrl);
            console.log('🌐 Search query:', searchQuery);
            console.log('🌐 Max results:', maxResults);
            console.log('🌐 Fields requested:', fields);
            
            // Make API request with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.defaultParams.timeout);
            
            console.log('🌐 Making fetch request...');
            const response = await fetch(apiUrl, {
                signal: controller.signal,
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            console.log(`🌐 Response status: ${response.status} ${response.statusText}`);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('🌐 API Error Response:', errorText);
                throw new Error(`UniProt API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('🌐 API Response data:', data);
            console.log(`🌐 Results count: ${data.results ? data.results.length : 0}`);
            
            return data.results || [];
            
            } catch (error) {
                console.error('🌐 API Request failed:', error);
                
                if (error.name === 'AbortError') {
                    throw new Error('UniProt API request timed out');
                }
                
                // Handle network errors
                if (error.message.includes('Failed to fetch')) {
                    throw new Error('Network error: Unable to connect to UniProt API. Please check your internet connection.');
                }
                
                // Handle CORS errors
                if (error.message.includes('CORS')) {
                    throw new Error('CORS error: Unable to access UniProt API due to browser security restrictions.');
                }
                
                throw error;
            }
    }

    /**
     * Format search results for ChatBox consumption
     */
    formatSearchResults(apiResults) {
        return apiResults.map(entry => {
            // Extract gene names
            const geneNames = entry.genes || [];
            const primaryGene = geneNames.length > 0 ? geneNames[0] : null;
            const geneName = primaryGene?.geneName?.value || primaryGene?.geneName || 'Unknown';
            
            // Extract protein name
            let proteinName = 'Unknown protein';
            if (entry.proteinDescription?.recommendedName?.fullName?.value) {
                proteinName = entry.proteinDescription.recommendedName.fullName.value;
            } else if (entry.proteinDescription?.submissionNames?.[0]?.fullName?.value) {
                proteinName = entry.proteinDescription.submissionNames[0].fullName.value;
            }
            
            // Extract function
            let functionText = null;
            const functionComment = entry.comments?.find(c => c.commentType === 'FUNCTION');
            if (functionComment?.texts?.[0]?.value) {
                functionText = functionComment.texts[0].value;
            }
            
            // Extract features
            const features = (entry.features || []).slice(0, 5).map(f => ({
                type: f.type,
                location: { 
                    start: f.location?.start?.value || f.location?.start, 
                    end: f.location?.end?.value || f.location?.end 
                },
                description: f.description || f.type
            }));
            
            return {
                uniprotId: entry.primaryAccession || entry.accession,
                proteinName: proteinName,
                geneName: geneName,
                organism: entry.organism?.scientificName || 'Unknown organism',
                length: entry.sequence?.length || 0,
                mass: entry.sequence?.molWeight || 0,
                reviewed: entry.entryType === 'UniProtKB reviewed (Swiss-Prot)' || entry.reviewed === true,
                function: functionText,
                sequence: entry.sequence?.value || null,
                features: features,
                url: `https://www.uniprot.org/uniprotkb/${entry.primaryAccession || entry.accession}`,
                
                // Additional metadata for ChatBox
                metadata: {
                    source: 'UniProt',
                    retrievedAt: new Date().toISOString(),
                    confidence: entry.reviewed ? 'high' : 'medium'
                }
            };
        });
    }

    /**
     * Generate search summary for ChatBox
     */
    generateSearchSummary(results, query) {
        if (results.length === 0) {
            return `No proteins found for query "${query}". Try adjusting search terms or filters.`;
        }
        
        const reviewedCount = results.filter(r => r.reviewed).length;
        const organismCounts = {};
        results.forEach(r => {
            organismCounts[r.organism] = (organismCounts[r.organism] || 0) + 1;
        });
        
        const topOrganisms = Object.entries(organismCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([org, count]) => `${org} (${count})`)
            .join(', ');
        
        return `Found ${results.length} protein(s) for "${query}". ${reviewedCount} reviewed entries. Top organisms: ${topOrganisms}.`;
    }

    /**
     * Get ChatBox prompt information for this plugin
     */
    getChatBoxPromptInfo() {
        return {
            name: 'UniProt Database Search',
            description: 'Comprehensive protein database search using UniProt REST API for gene, protein, and functional analysis',
            version: '1.0.0',
            category: 'database-search',
            priority: 'high',
            
            functions: [
                {
                    name: 'searchUniProt',
                    description: 'Search UniProt database with automatic query type detection',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: { type: 'string', description: 'Search query (gene name, protein name, UniProt ID, or keywords)' },
                            searchType: { type: 'string', enum: ['auto', 'gene_name', 'protein_name', 'uniprot_id', 'keyword'], default: 'auto' },
                            organism: { type: 'string', description: 'Organism filter (scientific or common name)' },
                            reviewedOnly: { type: 'boolean', default: false, description: 'Only return reviewed entries' },
                            maxResults: { type: 'integer', default: 25, maximum: 100 }
                        },
                        required: ['query']
                    },
                    examples: [
                        {
                            description: 'Search for TP53 gene in human',
                            parameters: { query: 'TP53', organism: 'human', reviewedOnly: true },
                            userQuery: 'search TP53 in UniProt database'
                        },
                        {
                            description: 'General protein search',
                            parameters: { query: 'insulin', searchType: 'auto', maxResults: 10 },
                            userQuery: 'find insulin proteins'
                        }
                    ]
                },
                {
                    name: 'searchByGene',
                    description: 'Search proteins by gene name (optimized for gene queries)',
                    parameters: {
                        type: 'object',
                        properties: {
                            geneName: { type: 'string', description: 'Gene name or symbol (e.g., TP53, INS, lysC)' },
                            organism: { type: 'string', description: 'Organism filter (e.g., human, mouse, ecoli, corynebacterium glutamicum)' },
                            reviewedOnly: { type: 'boolean', default: true },
                            maxResults: { type: 'integer', default: 10 }
                        },
                        required: ['geneName']
                    },
                    examples: [
                        {
                            description: 'Search lysC gene (NOT PDB)',
                            parameters: { geneName: 'lysC', reviewedOnly: true },
                            userQuery: 'search lysC in UniProt database, NOT pdb'
                        },
                        {
                            description: 'Find TP53 in human',
                            parameters: { geneName: 'TP53', organism: 'human', reviewedOnly: true },
                            userQuery: 'find TP53 protein information'
                        },
                        {
                            description: 'Search gene in C. glutamicum',
                            parameters: { geneName: 'dnaA', organism: 'Corynebacterium glutamicum' },
                            userQuery: 'find dnaA gene in Corynebacterium glutamicum'
                        }
                    ]
                },
                {
                    name: 'searchByProtein',
                    description: 'Search proteins by protein name (optimized for protein queries)',
                    parameters: {
                        type: 'object',
                        properties: {
                            proteinName: { type: 'string', description: 'Protein name (e.g., insulin, p53, hemoglobin)' },
                            organism: { type: 'string', description: 'Organism filter' },
                            reviewedOnly: { type: 'boolean', default: true },
                            maxResults: { type: 'integer', default: 10 }
                        },
                        required: ['proteinName']
                    },
                    examples: [
                        {
                            description: 'Search insulin proteins',
                            parameters: { proteinName: 'insulin', organism: 'human' },
                            userQuery: 'search insulin proteins in human UniProt'
                        },
                        {
                            description: 'Find hemoglobin proteins',
                            parameters: { proteinName: 'hemoglobin', reviewedOnly: true },
                            userQuery: 'find hemoglobin proteins'
                        }
                    ]
                },
                {
                    name: 'getProteinById',
                    description: 'Get detailed protein information by UniProt accession ID',
                    parameters: {
                        type: 'object',
                        properties: {
                            uniprotId: { type: 'string', description: 'UniProt accession ID (e.g., P04637, P01308)' },
                            includeSequence: { type: 'boolean', default: true },
                            includeFeatures: { type: 'boolean', default: true }
                        },
                        required: ['uniprotId']
                    },
                    examples: [
                        {
                            description: 'Get p53 protein details',
                            parameters: { uniprotId: 'P04637', includeSequence: true },
                            userQuery: 'get UniProt details for P04637'
                        },
                        {
                            description: 'Get insulin protein info',
                            parameters: { uniprotId: 'P01308', includeFeatures: true },
                            userQuery: 'show protein P01308 information'
                        }
                    ]
                },
                {
                    name: 'searchByFunction',
                    description: 'Search proteins by functional keywords or GO terms',
                    parameters: {
                        type: 'object',
                        properties: {
                            keywords: { type: 'string', description: 'Functional keywords (e.g., kinase, transcription factor, membrane)' },
                            organism: { type: 'string', description: 'Organism filter' },
                            maxResults: { type: 'integer', default: 25 }
                        },
                        required: ['keywords']
                    },
                    examples: [
                        {
                            description: 'Find kinase proteins in mouse',
                            parameters: { keywords: 'kinase', organism: 'mouse', maxResults: 15 },
                            userQuery: 'find kinase proteins in mouse'
                        },
                        {
                            description: 'Search transcription factors',
                            parameters: { keywords: 'transcription factor', maxResults: 20 },
                            userQuery: 'search transcription factor proteins'
                        }
                    ]
                }
            ],
            
            // Additional prompt information
            usage: {
                primaryUseCase: 'Protein database searches and protein information retrieval',
                commonQueries: [
                    'search [gene] in UniProt',
                    'find [protein] proteins',
                    'get protein [ID] details',
                    'search [function] proteins in [organism]'
                ],
                disambiguation: {
                    'UniProt vs PDB': 'Use UniProt tools for protein sequences and annotations, PDB tools for 3D structures',
                    'Gene vs Protein search': 'Use searchByGene for gene symbols, searchByProtein for protein names'
                }
            },
            
            organisms: {
                supported: [
                    { name: 'human', scientificName: 'Homo sapiens', taxonomyId: '9606' },
                    { name: 'mouse', scientificName: 'Mus musculus', taxonomyId: '10090' },
                    { name: 'ecoli', scientificName: 'Escherichia coli', taxonomyId: '83333' },
                    { name: 'corynebacterium glutamicum', scientificName: 'Corynebacterium glutamicum', taxonomyId: '196627' },
                    { name: 'yeast', scientificName: 'Saccharomyces cerevisiae', taxonomyId: '559292' },
                    { name: 'fly', scientificName: 'Drosophila melanogaster', taxonomyId: '7227' },
                    { name: 'worm', scientificName: 'Caenorhabditis elegans', taxonomyId: '6239' },
                    { name: 'arabidopsis', scientificName: 'Arabidopsis thaliana', taxonomyId: '3702' }
                ],
                customSupport: true,
                customInstructions: 'Use scientific names for custom organisms (e.g., "Bacillus subtilis", "Streptococcus pneumoniae")'
            }
        };
    }

    /**
     * Get plugin metadata for registration
     */
    static getPluginMetadata() {
        return {
            type: 'function',
            name: 'UniProt Database Search',
            description: 'Comprehensive protein database search using UniProt REST API',
            version: '1.0.0',
            author: 'GenomeExplorer Team',
            category: 'database-search',
            priority: 'high',
            
            functions: {
                searchUniProt: {
                    description: 'Search UniProt database for proteins with comprehensive filtering options',
                    parameters: {
                        type: 'object',
                        properties: {
                            query: {
                                type: 'string',
                                description: 'Search query (gene name, protein name, UniProt ID, or keywords)'
                            },
                            searchType: {
                                type: 'string',
                                enum: ['auto', 'gene_name', 'protein_name', 'uniprot_id', 'keyword', 'organism'],
                                default: 'auto',
                                description: 'Type of search to perform'
                            },
                            organism: {
                                type: 'string',
                                description: 'Organism filter (scientific name, common name, or taxonomy ID)'
                            },
                            reviewedOnly: {
                                type: 'boolean',
                                default: false,
                                description: 'Only return reviewed (Swiss-Prot) entries'
                            },
                            minLength: {
                                type: 'integer',
                                description: 'Minimum protein sequence length'
                            },
                            maxLength: {
                                type: 'integer',
                                description: 'Maximum protein sequence length'
                            },
                            maxResults: {
                                type: 'integer',
                                default: 25,
                                maximum: 100,
                                description: 'Maximum number of results to return'
                            },
                            includeSequence: {
                                type: 'boolean',
                                default: true,
                                description: 'Include protein sequences in results'
                            },
                            includeFunction: {
                                type: 'boolean',
                                default: true,
                                description: 'Include functional annotations in results'
                            }
                        },
                        required: ['query']
                    },
                    executor: 'searchUniProt'
                },
                
                searchByGene: {
                    description: 'Search proteins by gene name (optimized for gene queries)',
                    parameters: {
                        type: 'object',
                        properties: {
                            geneName: {
                                type: 'string',
                                description: 'Gene name or symbol (e.g., TP53, INS, BRCA1)'
                            },
                            organism: {
                                type: 'string',
                                description: 'Organism filter (e.g., human, mouse, ecoli)'
                            },
                            reviewedOnly: {
                                type: 'boolean',
                                default: true,
                                description: 'Only return reviewed entries'
                            },
                            maxResults: {
                                type: 'integer',
                                default: 10,
                                description: 'Maximum number of results'
                            }
                        },
                        required: ['geneName']
                    },
                    executor: 'searchByGene'
                },
                
                searchByProtein: {
                    description: 'Search proteins by protein name (optimized for protein queries)',
                    parameters: {
                        type: 'object',
                        properties: {
                            proteinName: {
                                type: 'string',
                                description: 'Protein name (e.g., insulin, p53, hemoglobin)'
                            },
                            organism: {
                                type: 'string',
                                description: 'Organism filter'
                            },
                            reviewedOnly: {
                                type: 'boolean',
                                default: true,
                                description: 'Only return reviewed entries'
                            },
                            maxResults: {
                                type: 'integer',
                                default: 10,
                                description: 'Maximum number of results'
                            }
                        },
                        required: ['proteinName']
                    },
                    executor: 'searchByProtein'
                },
                
                getProteinById: {
                    description: 'Get detailed protein information by UniProt ID',
                    parameters: {
                        type: 'object',
                        properties: {
                            uniprotId: {
                                type: 'string',
                                description: 'UniProt accession ID (e.g., P04637, P01308)'
                            },
                            includeSequence: {
                                type: 'boolean',
                                default: true,
                                description: 'Include protein sequence'
                            },
                            includeFeatures: {
                                type: 'boolean',
                                default: true,
                                description: 'Include protein features and domains'
                            }
                        },
                        required: ['uniprotId']
                    },
                    executor: 'getProteinById'
                },
                
                searchByFunction: {
                    description: 'Search proteins by functional keywords or GO terms',
                    parameters: {
                        type: 'object',
                        properties: {
                            keywords: {
                                type: 'string',
                                description: 'Functional keywords (e.g., kinase, transcription factor, membrane)'
                            },
                            organism: {
                                type: 'string',
                                description: 'Organism filter'
                            },
                            reviewedOnly: {
                                type: 'boolean',
                                default: false,
                                description: 'Only return reviewed entries'
                            },
                            maxResults: {
                                type: 'integer',
                                default: 25,
                                description: 'Maximum number of results'
                            }
                        },
                        required: ['keywords']
                    },
                    executor: 'searchByFunction'
                }
            }
        };
    }
}

// Export for module system
export default UniProtSearchPlugin;
