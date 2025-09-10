/**
 * LiteratureAPIService - Handles fetching literature information from PubMed API
 */
class LiteratureAPIService {
    constructor() {
        this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
        this.cache = new Map();
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
        this.requestDelay = 100; // 100ms delay between requests to respect rate limits
        this.maxRetries = 3;
    }

    /**
     * Get cache key for a PMID
     * @param {string} pmid - PubMed ID
     * @returns {string} Cache key
     */
    getCacheKey(pmid) {
        return `pmid_${pmid}`;
    }

    /**
     * Check if cached data is still valid
     * @param {Object} cachedData - Cached data object
     * @returns {boolean} True if data is still valid
     */
    isCacheValid(cachedData) {
        if (!cachedData || !cachedData.timestamp) return false;
        return (Date.now() - cachedData.timestamp) < this.cacheExpiry;
    }

    /**
     * Get cached data for a PMID
     * @param {string} pmid - PubMed ID
     * @returns {Object|null} Cached data or null
     */
    getCachedData(pmid) {
        const key = this.getCacheKey(pmid);
        const cached = this.cache.get(key);
        return this.isCacheValid(cached) ? cached.data : null;
    }

    /**
     * Cache data for a PMID
     * @param {string} pmid - PubMed ID
     * @param {Object} data - Data to cache
     */
    setCachedData(pmid, data) {
        const key = this.getCacheKey(pmid);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Make HTTP request with retry logic
     * @param {string} url - URL to request
     * @param {number} retryCount - Current retry count
     * @returns {Promise<Object>} Response data
     */
    async makeRequest(url, retryCount = 0) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.warn(`Request failed, retrying... (${retryCount + 1}/${this.maxRetries})`);
                await this.sleep(1000 * (retryCount + 1)); // Exponential backoff
                return this.makeRequest(url, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Parse XML response from PubMed API
     * @param {string} xmlText - XML response text
     * @returns {Object} Parsed article data
     */
    parsePubMedXML(xmlText) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            const article = xmlDoc.querySelector('PubmedArticle');
            if (!article) {
                throw new Error('No article found in response');
            }

            const medlineCitation = article.querySelector('MedlineCitation');
            const articleData = article.querySelector('Article');
            const pubmedData = article.querySelector('PubmedData');

            // Extract basic information
            const pmid = medlineCitation?.querySelector('PMID')?.textContent || 'Unknown';
            const title = articleData?.querySelector('ArticleTitle')?.textContent || 'No title available';
            const abstract = articleData?.querySelector('AbstractText')?.textContent || 'No abstract available';
            
            // Extract authors
            const authorList = articleData?.querySelector('AuthorList');
            const authors = [];
            if (authorList) {
                const authorElements = authorList.querySelectorAll('Author');
                authorElements.forEach(author => {
                    const lastName = author.querySelector('LastName')?.textContent || '';
                    const foreName = author.querySelector('ForeName')?.textContent || '';
                    const initials = author.querySelector('Initials')?.textContent || '';
                    if (lastName) {
                        authors.push({
                            lastName,
                            foreName,
                            initials,
                            fullName: foreName ? `${foreName} ${lastName}` : `${initials} ${lastName}`
                        });
                    }
                });
            }

            // Extract journal information
            const journal = articleData?.querySelector('Journal');
            const journalTitle = journal?.querySelector('Title')?.textContent || 'Unknown Journal';
            const journalIssue = journal?.querySelector('JournalIssue');
            const pubDate = journalIssue?.querySelector('PubDate');
            const year = pubDate?.querySelector('Year')?.textContent || 'Unknown';
            const month = pubDate?.querySelector('Month')?.textContent || '';
            const day = pubDate?.querySelector('Day')?.textContent || '';
            
            // Extract volume and issue
            const volume = journalIssue?.querySelector('Volume')?.textContent || '';
            const issue = journalIssue?.querySelector('Issue')?.textContent || '';
            
            // Extract pages
            const pagination = articleData?.querySelector('Pagination');
            const startPage = pagination?.querySelector('StartPage')?.textContent || '';
            const endPage = pagination?.querySelector('EndPage')?.textContent || '';
            const pages = startPage ? (endPage ? `${startPage}-${endPage}` : startPage) : '';

            // Extract DOI
            const doi = pubmedData?.querySelector('ArticleIdList')?.querySelector('ArticleId[IdType="doi"]')?.textContent || '';

            // Extract keywords
            const keywordList = medlineCitation?.querySelector('KeywordList');
            const keywords = [];
            if (keywordList) {
                const keywordElements = keywordList.querySelectorAll('Keyword');
                keywordElements.forEach(keyword => {
                    const text = keyword.textContent?.trim();
                    if (text) keywords.push(text);
                });
            }

            // Extract MeSH terms
            const meshHeadingList = medlineCitation?.querySelector('MeshHeadingList');
            const meshTerms = [];
            if (meshHeadingList) {
                const meshElements = meshHeadingList.querySelectorAll('MeshHeading');
                meshElements.forEach(mesh => {
                    const descriptor = mesh.querySelector('DescriptorName');
                    if (descriptor) {
                        meshTerms.push(descriptor.textContent);
                    }
                });
            }

            // Format publication date
            let publicationDate = year;
            if (month) {
                const monthNames = {
                    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
                    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
                    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
                };
                const monthName = monthNames[month] || month;
                publicationDate = day ? `${monthName} ${day}, ${year}` : `${monthName} ${year}`;
            }

            // Format journal citation
            let journalCitation = journalTitle;
            if (year) journalCitation += ` (${year})`;
            if (volume) journalCitation += `, ${volume}`;
            if (issue) journalCitation += `(${issue})`;
            if (pages) journalCitation += `, ${pages}`;

            return {
                pmid,
                title: title.replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
                abstract: abstract.replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
                authors,
                journal: {
                    title: journalTitle,
                    year,
                    month,
                    day,
                    volume,
                    issue,
                    pages,
                    citation: journalCitation
                },
                publicationDate,
                doi,
                keywords,
                meshTerms,
                url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                summary: this.generateSummary(title, authors, journalTitle, year)
            };

        } catch (error) {
            console.error('Error parsing PubMed XML:', error);
            throw new Error(`Failed to parse PubMed response: ${error.message}`);
        }
    }

    /**
     * Generate a summary string for the article
     * @param {string} title - Article title
     * @param {Array} authors - Author list
     * @param {string} journal - Journal title
     * @param {string} year - Publication year
     * @returns {string} Summary string
     */
    generateSummary(title, authors, journal, year) {
        const firstAuthor = authors.length > 0 ? authors[0].lastName : 'Unknown';
        const authorCount = authors.length;
        const authorString = authorCount > 1 ? `${firstAuthor} et al.` : firstAuthor;
        
        return `${authorString} (${year}). ${title}. ${journal}.`;
    }

    /**
     * Fetch literature information for a single PMID
     * @param {string} pmid - PubMed ID
     * @returns {Promise<Object>} Literature information
     */
    async fetchLiteratureInfo(pmid) {
        // Check cache first
        const cached = this.getCachedData(pmid);
        if (cached) {
            console.log(`Using cached data for PMID ${pmid}`);
            return cached;
        }

        try {
            console.log(`Fetching literature info for PMID ${pmid}`);
            
            // Add delay to respect rate limits
            await this.sleep(this.requestDelay);

            // Fetch article details
            const efetchUrl = `${this.baseUrl}efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml&rettype=abstract`;
            const xmlResponse = await this.makeRequest(efetchUrl);
            
            const literatureInfo = this.parsePubMedXML(xmlResponse);
            
            // Cache the result
            this.setCachedData(pmid, literatureInfo);
            
            return literatureInfo;

        } catch (error) {
            console.error(`Error fetching literature info for PMID ${pmid}:`, error);
            
            // Return fallback data
            return {
                pmid,
                title: 'Unable to fetch title',
                abstract: 'Unable to fetch abstract',
                authors: [],
                journal: {
                    title: 'Unknown Journal',
                    year: 'Unknown',
                    citation: 'Unknown Journal'
                },
                publicationDate: 'Unknown',
                doi: '',
                keywords: [],
                meshTerms: [],
                url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                summary: `PMID:${pmid} - Unable to fetch details`,
                error: error.message
            };
        }
    }

    /**
     * Fetch literature information for multiple PMIDs
     * @param {Array<string>} pmids - Array of PubMed IDs
     * @returns {Promise<Array<Object>>} Array of literature information
     */
    async fetchMultipleLiteratureInfo(pmids) {
        if (!Array.isArray(pmids) || pmids.length === 0) {
            return [];
        }

        console.log(`Fetching literature info for ${pmids.length} PMIDs`);
        
        const results = [];
        const batchSize = 10; // Process in batches to avoid overwhelming the API
        
        for (let i = 0; i < pmids.length; i += batchSize) {
            const batch = pmids.slice(i, i + batchSize);
            const batchPromises = batch.map(pmid => this.fetchLiteratureInfo(pmid));
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error);
                // Add error entries for failed batch
                batch.forEach(pmid => {
                    results.push({
                        pmid,
                        title: 'Error fetching data',
                        abstract: 'Unable to fetch abstract',
                        authors: [],
                        journal: { title: 'Unknown Journal', year: 'Unknown', citation: 'Unknown Journal' },
                        publicationDate: 'Unknown',
                        doi: '',
                        keywords: [],
                        meshTerms: [],
                        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
                        summary: `PMID:${pmid} - Error fetching data`,
                        error: error.message
                    });
                });
            }
        }

        return results;
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Literature API cache cleared');
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys())
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LiteratureAPIService;
} else if (typeof window !== 'undefined') {
    window.LiteratureAPIService = LiteratureAPIService;
}
