/**
 * UniProt Search Extension - Protein database search integration for GenomeExplorer
 * Refactored to use the new VS Code-inspired extension architecture
 */

// Extension manifest following the standardized format
const extensionManifest = {
    id: 'genome-explorer.uniprot-search',
    name: 'UniProt Database Search',
    version: '2.0.0',
    publisher: 'GenomeExplorerTeam',
    description: 'Comprehensive protein database search using UniProt REST API for gene, protein, and functional analysis',
    main: './extension.js',
    categories: ['database-search', 'protein-analysis'],
    keywords: ['uniprot', 'protein', 'database', 'search', 'genomics'],
    activationEvents: [
        'onCommand:uniprot.search',
        'onCommand:uniprot.searchByGene',
        'onCommand:uniprot.searchByProtein',
        'onCommand:uniprot.getProteinById',
        'onCommand:uniprot.searchByFunction'
    ],
    contributes: {
        commands: [
            {
                command: 'uniprot.search',
                title: 'Search UniProt Database',
                category: 'UniProt'
            },
            {
                command: 'uniprot.searchByGene',
                title: 'Search by Gene Name',
                category: 'UniProt'
            },
            {
                command: 'uniprot.searchByProtein',
                title: 'Search by Protein Name',
                category: 'UniProt'
            },
            {
                command: 'uniprot.getProteinById',
                title: 'Get Protein by ID',
                category: 'UniProt'
            },
            {
                command: 'uniprot.searchByFunction',
                title: 'Search by Function',
                category: 'UniProt'
            }
        ]
    },
    permissions: ['network.request', 'export.data'],
    engines: {
        'genome-explorer': '^2.0.0'
    }
};

/**
 * UniProtSearchExtension - Core extension implementation
 */
class UniProtSearchExtension {
    constructor() {
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
        
        // Extension context and subscriptions
        this.context = null;
        this.subscriptions = [];
        this.api = null;
        
        console.log('UniProtSearchExtension constructor called');
    }
    
    /**
     * Activate the extension
     */
    async activate(context) {
        this.context = context;
        this.api = context.api;
        
        console.log('🚀 Activating UniProt Search Extension...');
        
        // Register commands
        this.registerCommands();
        
        // Register event listeners
        this.setupEventListeners();
        
        console.log('✅ UniProt Search Extension activated');
        
        return {
            // API exposed by the extension
            search: this.searchUniProt.bind(this),
            searchByGene: this.searchByGene.bind(this),
            searchByProtein: this.searchByProtein.bind(this),
            getProteinById: this.getProteinById.bind(this),
            searchByFunction: this.searchByFunction.bind(this)
        };
    }
    
    /**
     * Deactivate the extension and clean up resources
     */
    async deactivate() {
        console.log('⏹️ Deactivating UniProt Search Extension...');
        
        // Dispose all subscriptions
        for (const subscription of this.subscriptions) {
            if (typeof subscription.dispose === 'function') {
                subscription.dispose();
            }
        }
        this.subscriptions = [];
        
        console.log('✅ UniProt Search Extension deactivated');
    }
    
    /**
     * Register extension commands
     */
    registerCommands() {
        // Register the search command
        this.subscriptions.push(
            this.context.registerCommand('uniprot.search', (args) => this.searchUniProt(args))
        );
        
        // Register gene search command
        this.subscriptions.push(
            this.context.registerCommand('uniprot.searchByGene', (args) => this.searchByGene(args))
        );
        
        // Register protein search command
        this.subscriptions.push(
            this.context.registerCommand('uniprot.searchByProtein', (args) => this.searchByProtein(args))
        );
        
        // Register protein by ID command
        this.subscriptions.push(
            this.context.registerCommand('uniprot.getProteinById', (args) => this.getProteinById(args))
        );
        
        // Register function search command
        this.subscriptions.push(
            this.context.registerCommand('uniprot.searchByFunction', (args) => this.searchByFunction(args))
        );
        
        console.log('🔧 Registered UniProt extension commands');
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Add any event listeners needed here
        console.log('📡 Setup event listeners for UniProt extension');
    }
    
    /**
     * Search UniProt database with comprehensive parameters
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
            
            // Build search query
            const searchQuery = this.buildSearchQuery(query, searchType, organism, reviewedOnly, minLength, maxLength);
            
            // Perform API search
            let results = await this.performAPISearch(searchQuery, maxResults, includeSequence, includeFunction);
            
            // Format results for return
            const formattedResults = this.formatSearchResults(results);
            
            // Return structured response
            return {
                success: true,
                resultCount: formattedResults.length,
                query: query,
                searchType: searchType,
                organism: organism,
                results: formattedResults,
                summary: this.generateSearchSummary(formattedResults, query),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ UniProt search failed:', error);
            return {
                success: false,
                error: error.message,
                query: params.query,
                timestamp: new Date().toISOString()
            };
        }
    }
    
    /**
     * Search proteins by gene name - optimized for gene queries
     */
    async searchByGene(params) {
        console.log('🧬 searchByGene called with params:', params);
        
        const { geneName, organism = null, reviewedOnly = true, maxResults = 10 } = params;
        
        return await this.searchUniProt({
            query: geneName,
            searchType: 'gene_name',
            organism: organism,
            reviewedOnly: reviewedOnly,
            maxResults: maxResults
        });
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
            
            // Make API request
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`UniProt API request failed: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.results || [];
            
        } catch (error) {
            console.error('🌐 API Request failed:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('UniProt API request timed out');
            }
            
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Network error: Unable to connect to UniProt API. Please check your internet connection.');
            }
            
            if (error.message.includes('CORS')) {
                throw new Error('CORS error: Unable to access UniProt API due to browser security restrictions.');
            }
            
            throw error;
        }
    }
    
    /**
     * Format search results for consumption
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
                metadata: {
                    source: 'UniProt',
                    retrievedAt: new Date().toISOString(),
                    confidence: entry.reviewed ? 'high' : 'medium'
                }
            };
        });
    }
    
    /**
     * Generate search summary
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
}

// Extension exports
let extensionInstance = null;

/**
 * Activate the extension
 */
export async function activate(context) {
    if (!extensionInstance) {
        extensionInstance = new UniProtSearchExtension();
    }
    
    return extensionInstance.activate(context);
}

/**
 * Deactivate the extension
 */
export async function deactivate() {
    if (extensionInstance) {
        await extensionInstance.deactivate();
        extensionInstance = null;
    }
}

/**
 * Get extension manifest
 */
export function getManifest() {
    return extensionManifest;
}
