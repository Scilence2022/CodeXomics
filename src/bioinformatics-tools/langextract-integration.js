/**
 * LangExtract Integration for Gene Function Information Extraction
 * 
 * This module provides integration with LangExtract for extracting
 * gene function information from research reports and scientific texts.
 */

class LangExtractIntegration {
    constructor() {
        this.isInitialized = false;
        this.extractionPatterns = this.initializeExtractionPatterns();
    }

    /**
     * Initialize LangExtract integration
     */
    async initialize() {
        try {
            // Check if LangExtract is available
            if (typeof window !== 'undefined' && window.LangExtract) {
                this.isInitialized = true;
                console.log('LangExtract integration initialized');
                return true;
            } else {
                // Fallback to pattern-based extraction
                console.log('LangExtract not available, using pattern-based extraction');
                this.isInitialized = true;
                return true;
            }
        } catch (error) {
            console.error('Error initializing LangExtract integration:', error);
            return false;
        }
    }

    /**
     * Initialize extraction patterns for gene function information
     */
    initializeExtractionPatterns() {
        return {
            // Gene function patterns
            function: [
                /catalyzes?\s+([^.]*?)(?:\.|$)/gi,
                /function[s]?\s+[is\s]*([^.]*?)(?:\.|$)/gi,
                /encodes?\s+([^.]*?)(?:\.|$)/gi,
                /responsible\s+for\s+([^.]*?)(?:\.|$)/gi,
                /involved\s+in\s+([^.]*?)(?:\.|$)/gi,
                /participates?\s+in\s+([^.]*?)(?:\.|$)/gi
            ],
            
            // Pathway patterns
            pathway: [
                /pathway[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /metabolic\s+pathway[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /biosynthetic\s+pathway[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /degradation\s+pathway[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi
            ],
            
            // Regulation patterns
            regulation: [
                /regulated\s+by\s+([^.]*?)(?:\.|$)/gi,
                /regulation[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /feedback\s+inhibition\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /allosteric\s+regulation\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /transcriptional\s+regulation\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi
            ],
            
            // Structure patterns
            structure: [
                /structure[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /homomer[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /heteromer[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /domain[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /subunit[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi
            ],
            
            // Cofactor patterns
            cofactors: [
                /cofactor[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /requires?\s+([^.]*?)(?:\.|$)/gi,
                /dependent\s+on\s+([^.]*?)(?:\.|$)/gi,
                /activated\s+by\s+([^.]*?)(?:\.|$)/gi
            ],
            
            // Substrate patterns
            substrates: [
                /substrate[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /binds?\s+([^.]*?)(?:\.|$)/gi,
                /interacts?\s+with\s+([^.]*?)(?:\.|$)/gi
            ],
            
            // Product patterns
            products: [
                /product[s]?\s*[:\-]?\s*([^.]*?)(?:\.|$)/gi,
                /produces?\s+([^.]*?)(?:\.|$)/gi,
                /generates?\s+([^.]*?)(?:\.|$)/gi,
                /yields?\s+([^.]*?)(?:\.|$)/gi
            ],
            
            // EC number patterns
            ecNumber: [
                /EC\s*[:\-]?\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/gi,
                /enzyme\s+commission\s+number[s]?\s*[:\-]?\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/gi
            ],
            
            // GO term patterns
            goTerms: [
                /GO\s*[:\-]?\s*([0-9]+)/gi,
                /gene\s+ontology\s*[:\-]?\s*([0-9]+)/gi,
                /GO:([0-9]+)/gi
            ],
            
            // Reference patterns
            references: [
                /PMID\s*[:\-]?\s*([0-9]+)/gi,
                /PubMed\s*[:\-]?\s*([0-9]+)/gi,
                /doi\s*[:\-]?\s*([0-9]+\.[0-9]+\/[^\\s]+)/gi,
                /DOI\s*[:\-]?\s*([0-9]+\.[0-9]+\/[^\\s]+)/gi
            ]
        };
    }

    /**
     * Extract gene function information from text using LangExtract or pattern matching
     * @param {string} text - The research report text
     * @param {Object} geneInfo - Information about the target gene
     * @returns {Promise<Object>} Extracted gene function information
     */
    async extractGeneFunctionInfo(text, geneInfo) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            let extractedInfo = {
                function: '',
                pathway: '',
                regulation: '',
                structure: '',
                cofactors: '',
                substrates: '',
                products: '',
                ecNumber: '',
                goTerms: [],
                references: [],
                confidence: 0.0,
                rawText: text
            };

            // Use LangExtract if available, otherwise use pattern matching
            if (window.LangExtract) {
                extractedInfo = await this.extractWithLangExtract(text, geneInfo);
            } else {
                extractedInfo = await this.extractWithPatterns(text, geneInfo);
            }

            // Calculate confidence score
            extractedInfo.confidence = this.calculateConfidenceScore(extractedInfo);

            return extractedInfo;

        } catch (error) {
            console.error('Error extracting gene function info:', error);
            throw new Error('Failed to extract gene function information: ' + error.message);
        }
    }

    /**
     * Extract information using LangExtract library
     * @param {string} text - The research report text
     * @param {Object} geneInfo - Information about the target gene
     * @returns {Promise<Object>} Extracted information
     */
    async extractWithLangExtract(text, geneInfo) {
        try {
            const extractedInfo = {
                function: '',
                pathway: '',
                regulation: '',
                structure: '',
                cofactors: '',
                substrates: '',
                products: '',
                ecNumber: '',
                goTerms: [],
                references: [],
                confidence: 0.0
            };

            // Use LangExtract to extract entities and relationships
            const entities = await window.LangExtract.extractEntities(text);
            const relationships = await window.LangExtract.extractRelationships(text);

            // Process entities for gene function information
            for (const entity of entities) {
                const type = entity.type.toLowerCase();
                const value = entity.text;

                switch (type) {
                    case 'function':
                    case 'biological_process':
                        extractedInfo.function = value;
                        break;
                    case 'pathway':
                    case 'metabolic_pathway':
                        extractedInfo.pathway = value;
                        break;
                    case 'regulation':
                    case 'regulatory':
                        extractedInfo.regulation = value;
                        break;
                    case 'structure':
                    case 'protein_structure':
                        extractedInfo.structure = value;
                        break;
                    case 'cofactor':
                        extractedInfo.cofactors = value;
                        break;
                    case 'substrate':
                        extractedInfo.substrates = value;
                        break;
                    case 'product':
                        extractedInfo.products = value;
                        break;
                    case 'ec_number':
                        extractedInfo.ecNumber = value;
                        break;
                    case 'go_term':
                        extractedInfo.goTerms.push(value);
                        break;
                    case 'reference':
                    case 'pmid':
                        extractedInfo.references.push(value);
                        break;
                }
            }

            // Process relationships for additional context
            for (const rel of relationships) {
                if (rel.subject.toLowerCase().includes(geneInfo.name.toLowerCase()) ||
                    rel.subject.toLowerCase().includes(geneInfo.locusTag.toLowerCase())) {
                    
                    if (rel.predicate.includes('catalyzes') || rel.predicate.includes('function')) {
                        extractedInfo.function = rel.object;
                    } else if (rel.predicate.includes('pathway')) {
                        extractedInfo.pathway = rel.object;
                    } else if (rel.predicate.includes('regulated')) {
                        extractedInfo.regulation = rel.object;
                    }
                }
            }

            return extractedInfo;

        } catch (error) {
            console.error('Error with LangExtract extraction:', error);
            // Fallback to pattern matching
            return await this.extractWithPatterns(text, geneInfo);
        }
    }

    /**
     * Extract information using pattern matching
     * @param {string} text - The research report text
     * @param {Object} geneInfo - Information about the target gene
     * @returns {Promise<Object>} Extracted information
     */
    async extractWithPatterns(text, geneInfo) {
        const extractedInfo = {
            function: '',
            pathway: '',
            regulation: '',
            structure: '',
            cofactors: '',
            substrates: '',
            products: '',
            ecNumber: '',
            goTerms: [],
            references: [],
            confidence: 0.0
        };

        // Extract each type of information using patterns
        for (const [type, patterns] of Object.entries(this.extractionPatterns)) {
            const matches = [];
            
            for (const pattern of patterns) {
                let match;
                while ((match = pattern.exec(text)) !== null) {
                    const value = match[1] ? match[1].trim() : match[0].trim();
                    if (value && !matches.includes(value)) {
                        matches.push(value);
                    }
                }
                pattern.lastIndex = 0; // Reset regex state
            }

            if (matches.length > 0) {
                if (type === 'goTerms' || type === 'references') {
                    extractedInfo[type] = matches;
                } else {
                    extractedInfo[type] = matches.join('; ');
                }
            }
        }

        return extractedInfo;
    }

    /**
     * Calculate confidence score for extracted information
     * @param {Object} extractedInfo - The extracted information
     * @returns {number} Confidence score between 0 and 1
     */
    calculateConfidenceScore(extractedInfo) {
        let score = 0;
        let totalFields = 0;

        const fields = ['function', 'pathway', 'regulation', 'structure', 'cofactors', 'substrates', 'products'];
        
        for (const field of fields) {
            totalFields++;
            if (extractedInfo[field] && extractedInfo[field].length > 0) {
                score += 1;
            }
        }

        // Bonus for EC number and GO terms
        if (extractedInfo.ecNumber && extractedInfo.ecNumber.length > 0) {
            score += 0.5;
        }
        if (extractedInfo.goTerms && extractedInfo.goTerms.length > 0) {
            score += 0.5;
        }
        if (extractedInfo.references && extractedInfo.references.length > 0) {
            score += 0.5;
        }

        totalFields += 1.5; // For EC, GO terms, and references

        return Math.min(score / totalFields, 1.0);
    }

    /**
     * Extract specific gene information from a research report
     * @param {string} reportText - The full research report text
     * @param {string} geneName - The target gene name
     * @returns {Promise<Object>} Gene-specific extracted information
     */
    async extractGeneSpecificInfo(reportText, geneName) {
        try {
            // First, find sections of text that mention the specific gene
            const geneSections = this.findGeneSections(reportText, geneName);
            
            if (geneSections.length === 0) {
                throw new Error(`No information found for gene ${geneName} in the research report`);
            }

            // Extract information from gene-specific sections
            const geneInfo = {
                name: geneName,
                locusTag: geneName.startsWith('b') ? geneName : null
            };

            const extractedInfo = await this.extractGeneFunctionInfo(geneSections.join(' '), geneInfo);
            
            // Add gene-specific context
            extractedInfo.geneName = geneName;
            extractedInfo.sectionsFound = geneSections.length;
            extractedInfo.totalSections = geneSections.length;

            return extractedInfo;

        } catch (error) {
            console.error('Error extracting gene-specific info:', error);
            throw error;
        }
    }

    /**
     * Find sections of text that mention the specific gene
     * @param {string} text - The full text
     * @param {string} geneName - The target gene name
     * @returns {Array<string>} Array of text sections mentioning the gene
     */
    findGeneSections(text, geneName) {
        const sections = [];
        const sentences = text.split(/[.!?]+/);
        
        for (const sentence of sentences) {
            if (sentence.toLowerCase().includes(geneName.toLowerCase())) {
                sections.push(sentence.trim());
            }
        }

        // If no sentences found, try paragraphs
        if (sections.length === 0) {
            const paragraphs = text.split(/\n\s*\n/);
            for (const paragraph of paragraphs) {
                if (paragraph.toLowerCase().includes(geneName.toLowerCase())) {
                    sections.push(paragraph.trim());
                }
            }
        }

        return sections;
    }

    /**
     * Validate extracted information
     * @param {Object} extractedInfo - The extracted information
     * @returns {Object} Validation results
     */
    validateExtractedInfo(extractedInfo) {
        const validation = {
            isValid: true,
            warnings: [],
            errors: []
        };

        // Check for required fields
        if (!extractedInfo.function || extractedInfo.function.length < 10) {
            validation.warnings.push('Gene function description is too short or missing');
        }

        // Validate EC number format
        if (extractedInfo.ecNumber) {
            const ecPattern = /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/;
            if (!ecPattern.test(extractedInfo.ecNumber)) {
                validation.warnings.push('EC number format appears invalid');
            }
        }

        // Validate GO terms
        if (extractedInfo.goTerms && extractedInfo.goTerms.length > 0) {
            const goPattern = /^GO:[0-9]+$/;
            const invalidGoTerms = extractedInfo.goTerms.filter(term => !goPattern.test(term));
            if (invalidGoTerms.length > 0) {
                validation.warnings.push(`Invalid GO term format: ${invalidGoTerms.join(', ')}`);
            }
        }

        // Check confidence score
        if (extractedInfo.confidence < 0.3) {
            validation.warnings.push('Low confidence score - extracted information may be incomplete');
        }

        return validation;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LangExtractIntegration;
} else if (typeof window !== 'undefined') {
    window.LangExtractIntegration = LangExtractIntegration;
}
