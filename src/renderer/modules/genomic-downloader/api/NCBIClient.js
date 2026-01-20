/**
 * NCBIClient - Client for NCBI APIs (E-utilities and Datasets API v2)
 * Extends BaseAPIClient with NCBI-specific functionality
 */
class NCBIClient extends (window.BaseAPIClient || require('./BaseAPIClient.js')) {
    constructor(config = {}) {
        super({
            baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
            name: 'NCBI',
            maxRequestsPerSecond: config.apiKey ? 10 : 3, // Higher limit with API key
            ...config
        });

        this.datasetsApiUrl = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha';

        // Database configurations
        this.databases = {
            nucleotide: { name: 'Nucleotide (GenBank)', supports: ['fasta', 'genbank', 'embl'] },
            protein: { name: 'Protein', supports: ['fasta', 'genbank'] },
            assembly: { name: 'Assembly (RefSeq)', supports: ['fasta', 'genbank', 'gff'] },
            genome: { name: 'Genome', supports: ['fasta'], deprecated: true }, // Deprecated
            sra: { name: 'SRA', supports: ['sra'] },
            pubmed: { name: 'PubMed', supports: ['medline', 'xml'] }
        };
    }

    /**
     * Search NCBI database
     * @param {string} searchTerm - Search term or query
     * @param {string} database - Database to search (nucleotide, protein, assembly, etc.)
     * @param {Object} options - Additional search options
     * @returns {Promise<Array>} Array of search results
     */
    async search(searchTerm, database = 'nucleotide', options = {}) {
        // Handle deprecated genome database
        if (database === 'genome') {
            console.warn('[NCBIClient] Genome database is deprecated, using Datasets API instead');
            return await this.searchGenomeDatasets(searchTerm, options);
        }

        // Build query with filters
        const query = this.buildQuery(searchTerm, options);
        const resultsLimit = options.resultsLimit || 25;

        // Step 1: Search for IDs
        const searchUrl = `${this.baseUrl}esearch.fcgi?${this.buildQueryString({
            db: database,
            term: query,
            retmax: resultsLimit,
            retmode: 'json'
        })}`;

        console.log(`[NCBIClient] Searching ${database}:`, query);

        const searchData = await this.fetch(searchUrl);

        if (!searchData.esearchresult?.idlist?.length) {
            console.log(`[NCBIClient] No results found`);
            return [];
        }

        // Step 2: Fetch summaries for IDs
        const ids = searchData.esearchresult.idlist.join(',');
        const summaryUrl = `${this.baseUrl}esummary.fcgi?${this.buildQueryString({
            db: database,
            id: ids,
            retmode: 'json'
        })}`;

        const summaryData = await this.fetch(summaryUrl);

        // Step 3: Process results
        const results = [];
        for (const id of searchData.esearchresult.idlist) {
            const summary = summaryData.result[id];
            if (summary) {
                results.push(this.processResult(summary, id, database));
            }
        }

        console.log(`[NCBIClient] Found ${results.length} results`);
        return results;
    }

    /**
     * Search genome data using Datasets API v2
     */
    async searchGenomeDatasets(searchTerm, options = {}) {
        const resultsLimit = options.resultsLimit || 25;

        // Build taxonomy query
        const searchUrl = `${this.datasetsApiUrl}/genome/taxon/${encodeURIComponent(searchTerm)}/dataset_report`;

        try {
            const data = await this.fetch(searchUrl, {
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!data.reports || data.reports.length === 0) {
                return [];
            }

            // Process Datasets API results
            return data.reports.slice(0, resultsLimit).map((report, index) => ({
                id: report.accession || `genome_${index}`,
                accession: report.accession,
                title: report.organism?.organism_name || report.assembly_info?.assembly_name || 'Unknown',
                organism: report.organism?.organism_name || 'Unknown',
                length: report.assembly_stats?.total_sequence_length || 0,
                description: this.formatGenomeDescription(report),
                database: 'genome-datasets',
                assemblyLevel: report.assembly_info?.assembly_level || 'Unknown',
                downloadUrl: this.getGenomeDownloadUrl(report.accession)
            }));
        } catch (error) {
            console.error('[NCBIClient] Datasets API search failed:', error);
            // Fallback to searching assembly database
            console.log('[NCBIClient] Falling back to assembly database search');
            return await this.search(searchTerm, 'assembly', options);
        }
    }

    /**
     * Build query with optional filters
     */
    buildQuery(searchTerm, options = {}) {
        let query = searchTerm;

        // Add organism filter
        if (options.organism) {
            query += ` AND "${options.organism}"[Organism]`;
        }

        // Add sequence length filter
        if (options.minLength && options.maxLength) {
            query += ` AND ${options.minLength}:${options.maxLength}[SLEN]`;
        }

        // Database-specific query optimization
        if (options.database === 'assembly') {
            // Optimize for assembly searches
            if (!query.includes('[Organism]') && !options.organism) {
                query = `"${searchTerm}"[Organism] OR ${searchTerm}[Infraspecific name] OR ${searchTerm}[Assembly name]`;
            }
            // Add RefSeq filter
            query += ' AND ("latest refseq"[Filter] OR "refseq"[Filter])';
        }

        // Handle numeric queries in nucleotide database
        if (options.database === 'nucleotide' && /^\d+$/.test(searchTerm.trim())) {
            // Search as accession, GI, or taxonomy ID
            query = `${searchTerm}[Accession] OR ${searchTerm}[GI] OR txid${searchTerm}[Organism]`;
        }

        return query;
    }

    /**
     * Process search result into standardized format
     */
    processResult(summary, id, database) {
        const baseResult = {
            id: id,
            accession: summary.caption || summary.accessionversion || id,
            title: summary.title || 'No title available',
            organism: summary.organism || 'Unknown',
            length: summary.slen || 0,
            description: summary.extra || '',
            database: database,
            downloadUrl: this.getDownloadUrl(id, database, 'fasta')
        };

        // Database-specific processing
        switch (database) {
            case 'assembly':
                return {
                    ...baseResult,
                    accession: summary.assemblyaccession || baseResult.accession,
                    title: summary.assemblyname || baseResult.title,
                    organism: summary.organism || summary.speciesname || 'Unknown',
                    length: summary.totallength || 0,
                    description: `Assembly: ${summary.assemblyaccession || 'Unknown'} | Status: ${summary.assemblystatus || 'Unknown'} | Level: ${summary.assemblylevel || 'Unknown'}`,
                    assemblyLevel: summary.assemblylevel || 'Unknown',
                    assemblyStatus: summary.assemblystatus || 'Unknown'
                };

            case 'protein':
                return {
                    ...baseResult,
                    description: `${summary.title || 'No description'} | Length: ${summary.slen || 0} aa`,
                    aaLength: summary.slen || 0
                };

            case 'sra':
                return {
                    ...baseResult,
                    title: summary.title || summary.runs || 'No title',
                    description: `SRA: ${summary.runs || 'Unknown'} | Platform: ${summary.platform || 'Unknown'}`,
                    platform: summary.platform || 'Unknown',
                    runs: summary.runs || 'Unknown'
                };

            case 'nucleotide':
            default:
                return {
                    ...baseResult,
                    description: `${summary.title || 'No description'} | GI: ${summary.gi || 'N/A'}`,
                    gi: summary.gi || null
                };
        }
    }

    /**
     * Get download URL for a specific format
     */
    getDownloadUrl(id, database, format = 'fasta') {
        const formatMap = {
            'fasta': 'fasta',
            'genbank': 'gb',
            'gff': 'gff3',
            'embl': 'embl'
        };

        const rettype = formatMap[format] || 'fasta';

        // Assembly database requires special handling
        if (database === 'assembly') {
            console.warn('[NCBIClient] Assembly downloads need FTP access');
            return `${this.baseUrl}esummary.fcgi?db=${database}&id=${id}&retmode=json`;
        }

        return `${this.baseUrl}efetch.fcgi?${this.buildQueryString({
            db: database,
            id: id,
            rettype: rettype,
            retmode: 'text'
        })}`;
    }

    /**
     * Get genome download URL from Datasets API
     */
    getGenomeDownloadUrl(accession) {
        return `${this.datasetsApiUrl}/genome/accession/${accession}/download?include_annotation_type=GENOME_FASTA`;
    }

    /**
     * Format genome description from Datasets API report
     */
    formatGenomeDescription(report) {
        const parts = [];

        if (report.assembly_info?.assembly_name) {
            parts.push(`Assembly: ${report.assembly_info.assembly_name}`);
        }

        if (report.assembly_info?.assembly_level) {
            parts.push(`Level: ${report.assembly_info.assembly_level}`);
        }

        if (report.assembly_stats?.total_sequence_length) {
            const sizeMb = (report.assembly_stats.total_sequence_length / 1000000).toFixed(2);
            parts.push(`Size: ${sizeMb} Mb`);
        }

        return parts.join(' | ') || 'Genome assembly';
    }

    /**
     * Fetch sequence data
     */
    async fetchSequence(id, database, format = 'fasta') {
        const url = this.getDownloadUrl(id, database, format);

        // Fetch as text instead of JSON
        await this.rateLimit.acquire();

        const response = await this.fetchWithTimeout(url, {
            headers: {
                'Accept': 'text/plain'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.text();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NCBIClient;
} else {
    window.NCBIClient = NCBIClient;
}
