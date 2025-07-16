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
            'evo2_design'
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
        this.apiManager = this.app.apiManager;
        if (!this.apiManager) {
            throw new Error('APIManager not available');
        }
        
        console.log(`🌐 ExternalAgent: External API tools initialized`);
    }
    
    /**
     * 注册工具映射
     */
    registerToolMapping() {
        // BLAST搜索工具
        this.toolMapping.set('blast_search', this.blastSearch.bind(this));
        this.toolMapping.set('blast_sequence', this.blastSequence.bind(this));
        this.toolMapping.set('blast_protein', this.blastProtein.bind(this));
        
        // UniProt搜索工具
        this.toolMapping.set('uniprot_search', this.uniprotSearch.bind(this));
        this.toolMapping.set('uniprot_get_protein', this.uniprotGetProtein.bind(this));
        this.toolMapping.set('uniprot_get_annotation', this.uniprotGetAnnotation.bind(this));
        
        // AlphaFold搜索工具
        this.toolMapping.set('alphafold_search', this.alphafoldSearch.bind(this));
        this.toolMapping.set('alphafold_get_structure', this.alphafoldGetStructure.bind(this));
        
        // Evo2设计工具
        this.toolMapping.set('evo2_design', this.evo2Design.bind(this));
        this.toolMapping.set('evo2_optimize', this.evo2Optimize.bind(this));
        
        // InterPro搜索工具
        this.toolMapping.set('interpro_search', this.interproSearch.bind(this));
        this.toolMapping.set('interpro_get_domain', this.interproGetDomain.bind(this));
        
        // KEGG搜索工具
        this.toolMapping.set('kegg_search', this.keggSearch.bind(this));
        this.toolMapping.set('kegg_get_pathway', this.keggGetPathway.bind(this));
        
        console.log(`🌐 ExternalAgent: Registered ${this.toolMapping.size} external API tools`);
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
            
            const blastResults = await this.apiManager.blastSearch(sequence, database, evalue, maxResults);
            
            return {
                success: true,
                results: blastResults.map(result => ({
                    id: result.id,
                    description: result.description,
                    score: result.score,
                    evalue: result.evalue,
                    identity: result.identity,
                    alignment: result.alignment
                })),
                count: blastResults.length,
                database,
                query: sequence
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const uniprotResults = await this.apiManager.uniprotSearch(query, format, maxResults);
            
            return {
                success: true,
                results: uniprotResults.map(result => ({
                    id: result.id,
                    name: result.name,
                    organism: result.organism,
                    length: result.length,
                    function: result.function,
                    keywords: result.keywords
                })),
                count: uniprotResults.length,
                query
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
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
                    features: protein.features
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const annotation = await this.apiManager.uniprotGetAnnotation(id);
            
            return {
                success: true,
                annotation: {
                    id: annotation.id,
                    goTerms: annotation.goTerms,
                    pathways: annotation.pathways,
                    domains: annotation.domains,
                    interactions: annotation.interactions
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const alphafoldResults = await this.apiManager.alphafoldSearch(protein);
            
            return {
                success: true,
                results: alphafoldResults.map(result => ({
                    id: result.id,
                    name: result.name,
                    confidence: result.confidence,
                    plddt: result.plddt,
                    structureUrl: result.structureUrl
                })),
                count: alphafoldResults.length,
                query: protein
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
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
            
            const structure = await this.apiManager.alphafoldGetStructure(id, format);
            
            return {
                success: true,
                structure: {
                    id: structure.id,
                    format: structure.format,
                    data: structure.data,
                    metadata: structure.metadata
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
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
            
            const designResult = await this.apiManager.evo2Design(sequence, target, constraints);
            
            return {
                success: true,
                design: {
                    originalSequence: designResult.originalSequence,
                    designedSequence: designResult.designedSequence,
                    mutations: designResult.mutations,
                    score: designResult.score,
                    confidence: designResult.confidence
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const optimizationResult = await this.apiManager.evo2Optimize(sequence, objective, constraints);
            
            return {
                success: true,
                optimization: {
                    originalSequence: optimizationResult.originalSequence,
                    optimizedSequence: optimizationResult.optimizedSequence,
                    mutations: optimizationResult.mutations,
                    objectiveValue: optimizationResult.objectiveValue,
                    iterations: optimizationResult.iterations
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const interproResults = await this.apiManager.interproSearch(query, maxResults);
            
            return {
                success: true,
                results: interproResults.map(result => ({
                    id: result.id,
                    name: result.name,
                    type: result.type,
                    description: result.description,
                    memberDatabases: result.memberDatabases
                })),
                count: interproResults.length,
                query
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const domain = await this.apiManager.interproGetDomain(id);
            
            return {
                success: true,
                domain: {
                    id: domain.id,
                    name: domain.name,
                    type: domain.type,
                    description: domain.description,
                    memberDatabases: domain.memberDatabases,
                    structure: domain.structure
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const keggResults = await this.apiManager.keggSearch(query, database, maxResults);
            
            return {
                success: true,
                results: keggResults.map(result => ({
                    id: result.id,
                    name: result.name,
                    description: result.description,
                    type: result.type,
                    organism: result.organism
                })),
                count: keggResults.length,
                query,
                database
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
                    map: pathway.map
                }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出智能体
window.ExternalAgent = ExternalAgent; 