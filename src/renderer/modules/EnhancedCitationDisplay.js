/**
 * EnhancedCitationDisplay - Enhanced citation display with literature information
 */
class EnhancedCitationDisplay {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.literatureAPI = new LiteratureAPIService();
        this.displayMode = 'pmid'; // 'pmid', 'summary', 'detailed'
        this.isLoading = false;
        this.literatureData = new Map();
    }

    /**
     * Initialize the enhanced citation display
     */
    init() {
        console.log('EnhancedCitationDisplay.init() called');
        // Add CSS styles for enhanced citation display
        this.addEnhancedCitationStyles();
        console.log('EnhancedCitationDisplay initialization completed');
    }

    /**
     * Add CSS styles for enhanced citation display
     */
    addEnhancedCitationStyles() {
        if (document.getElementById('enhanced-citation-styles')) {
            console.log('Enhanced citation styles already loaded');
            return;
        }

        console.log('Adding enhanced citation styles...');
        const style = document.createElement('style');
        style.id = 'enhanced-citation-styles';
        style.textContent = `
            /* Enhanced Citation Display Styles - Direct Test */
            /* Enhanced Citation Display Styles */
            .enhanced-citations {
                background: #f8f9fa;
                border-radius: 6px;
                padding: 12px;
                margin-top: 16px;
                border: 1px solid #dee2e6;
            }

            .enhanced-citations h4 {
                font-size: 14px;
                font-weight: 600;
                color: #212529;
                margin-bottom: 12px;
                border-bottom: 1px solid #dee2e6;
                padding-bottom: 6px;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .citation-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }

            .view-mode-toggle {
                display: flex;
                background: #e9ecef;
                border-radius: 6px;
                padding: 2px;
                border: 1px solid #dee2e6;
            }

            .view-mode-btn {
                padding: 4px 8px;
                font-size: 11px;
                border: none;
                background: transparent;
                color: #6c757d;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .view-mode-btn.active {
                background: #007bff;
                color: white;
            }

            .view-mode-btn:hover:not(.active) {
                background: #f8f9fa;
                color: #212529;
            }

            .refresh-btn {
                padding: 4px 8px;
                font-size: 11px;
                border: 1px solid #dee2e6;
                background: white;
                color: #212529;
                cursor: pointer;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .refresh-btn:hover {
                background: #f8f9fa;
                border-color: #007bff;
            }

            .refresh-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .citation-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 400px;
                overflow-y: auto;
            }

            .citation-item {
                display: flex;
                align-items: flex-start;
                gap: 8px;
                padding: 8px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                background: white;
                transition: all 0.2s ease;
            }

            .citation-item:hover {
                border-color: #007bff;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }

            .citation-number {
                font-size: 11px;
                font-weight: 600;
                color: #007bff;
                background: rgba(0, 123, 255, 0.1);
                padding: 3px 6px;
                border-radius: 3px;
                min-width: 20px;
                text-align: center;
                flex-shrink: 0;
            }

            .citation-content {
                flex: 1;
                min-width: 0;
            }

            .citation-pmid {
                font-size: 11px;
                color: #6c757d;
                margin-bottom: 4px;
            }

            .citation-title {
                font-size: 12px;
                font-weight: 500;
                color: #212529;
                margin-bottom: 4px;
                line-height: 1.3;
            }

            .citation-authors {
                font-size: 11px;
                color: #6c757d;
                margin-bottom: 2px;
            }

            .citation-journal {
                font-size: 11px;
                color: #6c757d;
                font-style: italic;
            }

            .citation-abstract {
                font-size: 11px;
                color: #212529;
                line-height: 1.4;
                margin-top: 6px;
                max-height: 60px;
                overflow: hidden;
                position: relative;
            }

            .citation-abstract.expanded {
                max-height: none;
            }

            .citation-abstract::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 20px;
                background: linear-gradient(transparent, white);
                pointer-events: none;
            }

            .citation-abstract.expanded::after {
                display: none;
            }

            .expand-abstract-btn {
                font-size: 10px;
                color: #007bff;
                cursor: pointer;
                text-decoration: underline;
                margin-top: 4px;
                display: inline-block;
            }

            .citation-keywords {
                margin-top: 6px;
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
            }

            .keyword-tag {
                font-size: 9px;
                background: #e9ecef;
                color: #6c757d;
                padding: 2px 4px;
                border-radius: 3px;
                border: 1px solid #dee2e6;
            }

            .citation-links {
                margin-top: 6px;
                display: flex;
                gap: 8px;
            }

            .citation-link {
                font-size: 10px;
                color: #007bff;
                text-decoration: none;
                padding: 2px 6px;
                border: 1px solid #007bff;
                border-radius: 3px;
                transition: all 0.2s ease;
            }

            .citation-link:hover {
                background: #007bff;
                color: white;
            }

            .loading-indicator {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                color: #6c757d;
                font-size: 12px;
            }

            .loading-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid #dee2e6;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-right: 8px;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .error-message {
                color: #dc3545;
                font-size: 11px;
                margin-top: 4px;
                padding: 4px 6px;
                background: rgba(220, 53, 69, 0.1);
                border-radius: 3px;
                border: 1px solid rgba(220, 53, 69, 0.2);
            }

            .no-citations {
                text-align: center;
                color: #6c757d;
                font-size: 12px;
                padding: 20px;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Generate enhanced citation list HTML
     * @param {Array} citations - Array of citation objects
     * @returns {string} HTML for the enhanced citation list
     */
    generateEnhancedCitationList(citations) {
        console.log('EnhancedCitationDisplay.generateEnhancedCitationList called with:', citations);
        
        if (!citations || citations.length === 0) {
            console.log('No citations provided, returning empty state');
            return `
                <div class="enhanced-citations">
                    <h4>References</h4>
                    <div class="no-citations">No references found</div>
                </div>
            `;
        }

        const sortedCitations = citations.sort((a, b) => a.number - b.number);
        console.log('Sorted citations:', sortedCitations);

        let html = `
            <div class="enhanced-citations">
                <h4>
                    References
                    <div class="citation-controls">
                        <div class="view-mode-toggle">
                            <button class="view-mode-btn ${this.displayMode === 'pmid' ? 'active' : ''}" 
                                    onclick="window.enhancedCitationDisplay.setDisplayMode('pmid')" 
                                    title="Show PMID list only">
                                PMID
                            </button>
                            <button class="view-mode-btn ${this.displayMode === 'summary' ? 'active' : ''}" 
                                    onclick="window.enhancedCitationDisplay.setDisplayMode('summary')" 
                                    title="Show summary information">
                                Summary
                            </button>
                            <button class="view-mode-btn ${this.displayMode === 'detailed' ? 'active' : ''}" 
                                    onclick="window.enhancedCitationDisplay.setDisplayMode('detailed')" 
                                    title="Show detailed information">
                                Detailed
                            </button>
                        </div>
                        <button class="refresh-btn" 
                                onclick="window.enhancedCitationDisplay.refreshLiteratureData()" 
                                ${this.isLoading ? 'disabled' : ''}
                                title="Refresh literature data">
                            <i class="fas fa-sync-alt ${this.isLoading ? 'fa-spin' : ''}"></i>
                        </button>
                    </div>
                </h4>
                <div class="citation-list">
        `;

        if (this.isLoading) {
            html += `
                <div class="loading-indicator">
                    <div class="loading-spinner"></div>
                    Loading literature information...
                </div>
            `;
        } else {
            sortedCitations.forEach(citation => {
                html += this.generateCitationItem(citation);
            });
        }

        html += `
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Generate HTML for a single citation item
     * @param {Object} citation - Citation object
     * @returns {string} HTML for the citation item
     */
    generateCitationItem(citation) {
        const literatureInfo = this.literatureData.get(citation.id);
        const hasLiteratureData = literatureInfo && !literatureInfo.error;

        let content = '';
        
        if (this.displayMode === 'pmid') {
            content = this.generatePMIDContent(citation);
        } else if (this.displayMode === 'summary') {
            content = this.generateSummaryContent(citation, literatureInfo);
        } else if (this.displayMode === 'detailed') {
            content = this.generateDetailedContent(citation, literatureInfo);
        }

        return `
            <div class="citation-item">
                <span class="citation-number">${citation.number}</span>
                <div class="citation-content">
                    ${content}
                </div>
            </div>
        `;
    }

    /**
     * Generate PMID-only content
     * @param {Object} citation - Citation object
     * @returns {string} HTML content
     */
    generatePMIDContent(citation) {
        return `
            <div class="citation-pmid">PMID: ${citation.id}</div>
            <div class="citation-links">
                <a href="${citation.url}" target="_blank" class="citation-link">View on PubMed</a>
            </div>
        `;
    }

    /**
     * Generate summary content
     * @param {Object} citation - Citation object
     * @param {Object} literatureInfo - Literature information
     * @returns {string} HTML content
     */
    generateSummaryContent(citation, literatureInfo) {
        if (!literatureInfo || literatureInfo.error) {
            return `
                <div class="citation-pmid">PMID: ${citation.id}</div>
                <div class="citation-title">Unable to load literature information</div>
                <div class="citation-links">
                    <a href="${citation.url}" target="_blank" class="citation-link">View on PubMed</a>
                </div>
            `;
        }

        const authors = literatureInfo.authors.length > 0 
            ? (literatureInfo.authors.length > 3 
                ? `${literatureInfo.authors[0].lastName} et al.` 
                : literatureInfo.authors.map(a => a.lastName).join(', '))
            : 'Unknown authors';

        return `
            <div class="citation-pmid">PMID: ${citation.id}</div>
            <div class="citation-title">${literatureInfo.title}</div>
            <div class="citation-authors">${authors}</div>
            <div class="citation-journal">${literatureInfo.journal.citation}</div>
            <div class="citation-links">
                <a href="${citation.url}" target="_blank" class="citation-link">PubMed</a>
                ${literatureInfo.doi ? `<a href="https://doi.org/${literatureInfo.doi}" target="_blank" class="citation-link">DOI</a>` : ''}
            </div>
        `;
    }

    /**
     * Generate detailed content
     * @param {Object} citation - Citation object
     * @param {Object} literatureInfo - Literature information
     * @returns {string} HTML content
     */
    generateDetailedContent(citation, literatureInfo) {
        if (!literatureInfo || literatureInfo.error) {
            return `
                <div class="citation-pmid">PMID: ${citation.id}</div>
                <div class="citation-title">Unable to load literature information</div>
                ${literatureInfo?.error ? `<div class="error-message">Error: ${literatureInfo.error}</div>` : ''}
                <div class="citation-links">
                    <a href="${citation.url}" target="_blank" class="citation-link">View on PubMed</a>
                </div>
            `;
        }

        const authors = literatureInfo.authors.length > 0 
            ? literatureInfo.authors.map(a => a.fullName || `${a.initials} ${a.lastName}`).join(', ')
            : 'Unknown authors';

        const abstract = literatureInfo.abstract && literatureInfo.abstract !== 'No abstract available'
            ? literatureInfo.abstract
            : 'No abstract available';

        const keywords = literatureInfo.keywords && literatureInfo.keywords.length > 0
            ? literatureInfo.keywords.slice(0, 5) // Show only first 5 keywords
            : [];

        return `
            <div class="citation-pmid">PMID: ${citation.id}</div>
            <div class="citation-title">${literatureInfo.title}</div>
            <div class="citation-authors">${authors}</div>
            <div class="citation-journal">${literatureInfo.journal.citation}</div>
            <div class="citation-abstract" id="abstract-${citation.id}">
                ${abstract}
                ${abstract.length > 200 ? `<span class="expand-abstract-btn" onclick="window.enhancedCitationDisplay.toggleAbstract('${citation.id}')">Show more</span>` : ''}
            </div>
            ${keywords.length > 0 ? `
                <div class="citation-keywords">
                    ${keywords.map(keyword => `<span class="keyword-tag">${keyword}</span>`).join('')}
                </div>
            ` : ''}
            <div class="citation-links">
                <a href="${citation.url}" target="_blank" class="citation-link">PubMed</a>
                ${literatureInfo.doi ? `<a href="https://doi.org/${literatureInfo.doi}" target="_blank" class="citation-link">DOI</a>` : ''}
            </div>
        `;
    }

    /**
     * Set display mode
     * @param {string} mode - Display mode ('pmid', 'summary', 'detailed')
     */
    setDisplayMode(mode) {
        this.displayMode = mode;
        this.refreshDisplay();
    }

    /**
     * Toggle abstract expansion
     * @param {string} citationId - Citation ID
     */
    toggleAbstract(citationId) {
        const abstractElement = document.getElementById(`abstract-${citationId}`);
        if (abstractElement) {
            abstractElement.classList.toggle('expanded');
            const expandBtn = abstractElement.querySelector('.expand-abstract-btn');
            if (expandBtn) {
                expandBtn.textContent = abstractElement.classList.contains('expanded') ? 'Show less' : 'Show more';
            }
        }
    }

    /**
     * Refresh literature data for all citations
     */
    async refreshLiteratureData() {
        if (this.isLoading) return;

        const citations = Array.from(this.genomeBrowser.citationCollector.values());
        if (citations.length === 0) return;

        this.isLoading = true;
        this.refreshDisplay();

        try {
            const pmids = citations.map(c => c.id);
            const literatureResults = await this.literatureAPI.fetchMultipleLiteratureInfo(pmids);
            
            // Update literature data map
            this.literatureData.clear();
            literatureResults.forEach(result => {
                this.literatureData.set(result.pmid, result);
            });

            console.log(`Loaded literature data for ${literatureResults.length} citations`);
        } catch (error) {
            console.error('Error refreshing literature data:', error);
        } finally {
            this.isLoading = false;
            this.refreshDisplay();
        }
    }

    /**
     * Refresh the display
     */
    refreshDisplay() {
        if (this.genomeBrowser && this.genomeBrowser.citationCollector) {
            const citations = Array.from(this.genomeBrowser.citationCollector.values());
            const enhancedHtml = this.generateEnhancedCitationList(citations);
            
            // Replace the existing citation list
            const geneDetailsContent = document.getElementById('geneDetailsContent');
            if (geneDetailsContent) {
                const existingCitations = geneDetailsContent.querySelector('.gene-citations, .enhanced-citations');
                if (existingCitations) {
                    existingCitations.outerHTML = enhancedHtml;
                } else {
                    // If no existing citations, add to the end
                    geneDetailsContent.insertAdjacentHTML('beforeend', enhancedHtml);
                }
            }
        }
    }

    /**
     * Load literature data for citations if not already loaded
     */
    async loadLiteratureDataIfNeeded() {
        const citations = Array.from(this.genomeBrowser.citationCollector.values());
        if (citations.length === 0) return;

        // Check if we need to load any literature data
        const needsLoading = citations.some(c => !this.literatureData.has(c.id));
        if (!needsLoading) return;

        // Load data in background
        this.refreshLiteratureData();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedCitationDisplay;
} else if (typeof window !== 'undefined') {
    window.EnhancedCitationDisplay = EnhancedCitationDisplay;
}
