/**
 * SharedAnalyzerBase - Base class for bioinformatics analyzer tools
 * Provides common functionality for KEGG, GO, and InterPro analyzers
 * Includes deep integration with ChatBox LLM for result interpretation
 */
class SharedAnalyzerBase {
    constructor(toolName, toolConfig = {}) {
        this.toolName = toolName;
        this.config = {
            primaryColor: toolConfig.primaryColor || '#4a90e2',
            secondaryColor: toolConfig.secondaryColor || '#7bb3f0',
            icon: toolConfig.icon || 'fa-microscope',
            ...toolConfig
        };
        
        this.currentResults = null;
        this.analysisHistory = [];
        this.llmIntegrationEnabled = true;
        
        // IPC communication for ChatBox integration
        const { ipcRenderer } = require('electron');
        this.ipcRenderer = ipcRenderer;
        
        this.initializeIPCHandlers();
    }

    /**
     * Initialize IPC handlers for ChatBox communication
     */
    initializeIPCHandlers() {
        // Receive analysis data from ChatBox
        this.ipcRenderer.on('load-analysis-data', (event, data) => {
            console.log(`[${this.toolName}] Received analysis data from ChatBox:`, data);
            this.loadAnalysisData(data);
        });
        
        // Receive LLM interpretation results
        this.ipcRenderer.on('llm-interpretation-result', (event, result) => {
            console.log(`[${this.toolName}] Received LLM interpretation:`, result);
            this.displayLLMInterpretation(result);
        });
        
        // Handle window ready event
        this.ipcRenderer.on('window-ready', () => {
            console.log(`[${this.toolName}] Window ready, requesting pending data...`);
            this.ipcRenderer.send('request-pending-data', this.toolName);
        });
    }

    /**
     * Load analysis data from ChatBox or external source
     */
    loadAnalysisData(data) {
        if (!data) return;
        
        this.currentResults = data;
        this.analysisHistory.push({
            timestamp: new Date().toISOString(),
            data: data,
            source: data.source || 'chatbox'
        });
        
        // Display the data
        this.displayResults(data);
        
        // If data includes original query, offer to get LLM interpretation
        if (data.originalQuery && this.llmIntegrationEnabled) {
            this.offerLLMInterpretation(data);
        }
    }

    /**
     * Offer to get LLM interpretation of results
     */
    offerLLMInterpretation(data) {
        const interpretBtn = document.getElementById('llmInterpretBtn');
        if (interpretBtn) {
            interpretBtn.style.display = 'block';
            interpretBtn.onclick = () => this.requestLLMInterpretation(data);
        }
    }

    /**
     * Request LLM interpretation of current results
     */
    async requestLLMInterpretation(data = null) {
        const analysisData = data || this.currentResults;
        if (!analysisData) {
            this.showStatus('No analysis data available for interpretation', 'warning');
            return;
        }
        
        this.showStatus('Requesting AI interpretation...', 'info');
        
        // Send to ChatBox for LLM analysis
        this.ipcRenderer.send('request-llm-interpretation', {
            toolName: this.toolName,
            data: analysisData,
            context: this.buildInterpretationContext(analysisData)
        });
    }

    /**
     * Build context for LLM interpretation
     */
    buildInterpretationContext(data) {
        return {
            toolType: this.toolName,
            analysisType: data.analysisType || 'unknown',
            resultCount: this.getResultCount(data),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Display LLM interpretation in the results panel
     */
    displayLLMInterpretation(result) {
        const container = document.getElementById('llmInterpretationPanel');
        if (!container) return;
        
        container.style.display = 'block';
        container.innerHTML = `
            <div class="llm-interpretation-header">
                <i class="fas fa-brain"></i>
                <h3>AI Interpretation</h3>
                <button class="close-btn" onclick="this.parentElement.parentElement.style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="llm-interpretation-content">
                ${this.formatLLMResponse(result)}
            </div>
            <div class="llm-interpretation-actions">
                <button class="btn btn-secondary" onclick="window.analyzer.requestMoreDetails()">
                    <i class="fas fa-plus-circle"></i>
                    Request More Details
                </button>
                <button class="btn btn-secondary" onclick="window.analyzer.exportWithInterpretation()">
                    <i class="fas fa-file-export"></i>
                    Export with Interpretation
                </button>
            </div>
        `;
        
        this.showStatus('AI interpretation received', 'success');
    }

    /**
     * Format LLM response for display
     */
    formatLLMResponse(result) {
        if (typeof result === 'string') {
            return `<div class="interpretation-text">${this.markdownToHTML(result)}</div>`;
        }
        
        if (result.interpretation) {
            return `<div class="interpretation-text">${this.markdownToHTML(result.interpretation)}</div>`;
        }
        
        return `<div class="interpretation-text">${JSON.stringify(result, null, 2)}</div>`;
    }

    /**
     * Simple markdown to HTML conversion
     */
    markdownToHTML(text) {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    /**
     * Send analysis request to ChatBox
     */
    sendToChatBox(query, data = null) {
        console.log(`[${this.toolName}] Sending analysis request to ChatBox:`, query);
        
        this.ipcRenderer.send('analyze-in-chatbox', {
            toolName: this.toolName,
            query: query,
            data: data || this.currentResults,
            timestamp: new Date().toISOString()
        });
        
        this.showStatus('Analysis request sent to ChatBox', 'success');
    }

    /**
     * Request more details from LLM
     */
    requestMoreDetails() {
        if (!this.currentResults) {
            this.showStatus('No current results to analyze', 'warning');
            return;
        }
        
        const query = this.buildDetailedQuery(this.currentResults);
        this.sendToChatBox(query, this.currentResults);
    }

    /**
     * Build detailed query for LLM
     * To be overridden by subclasses
     */
    buildDetailedQuery(data) {
        return `Please provide more detailed analysis of these ${this.toolName} results.`;
    }

    /**
     * Export results with LLM interpretation
     */
    async exportWithInterpretation() {
        if (!this.currentResults) {
            this.showStatus('No results to export', 'warning');
            return;
        }
        
        const exportData = {
            tool: this.toolName,
            timestamp: new Date().toISOString(),
            results: this.currentResults,
            llmInterpretation: this.getCurrentLLMInterpretation(),
            analysisHistory: this.analysisHistory
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.toolName.toLowerCase()}-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showStatus('Results exported successfully', 'success');
    }

    /**
     * Get current LLM interpretation
     */
    getCurrentLLMInterpretation() {
        const panel = document.getElementById('llmInterpretationPanel');
        if (!panel || panel.style.display === 'none') return null;
        
        const content = panel.querySelector('.llm-interpretation-content');
        return content ? content.textContent : null;
    }

    /**
     * Get result count - to be overridden by subclasses
     */
    getResultCount(data) {
        return 0;
    }

    /**
     * Display results - to be overridden by subclasses
     */
    displayResults(data) {
        console.log(`[${this.toolName}] displayResults not implemented in subclass`);
    }

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        const statusArea = document.getElementById('statusArea');
        if (!statusArea) return;
        
        const iconMap = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        statusArea.innerHTML = `
            <div class="status-message status-${type}">
                <i class="fas fa-${iconMap[type]}"></i>
                ${message}
            </div>
        `;
        
        setTimeout(() => {
            if (statusArea.innerHTML.includes(message)) {
                statusArea.innerHTML = '';
            }
        }, 5000);
    }

    /**
     * Show loading indicator
     */
    showLoading(show, message = 'Processing...') {
        const loader = document.getElementById('loadingIndicator');
        if (!loader) return;
        
        if (show) {
            loader.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i>
                </div>
                <div class="loading-message">${message}</div>
            `;
            loader.style.display = 'flex';
        } else {
            loader.style.display = 'none';
        }
    }

    /**
     * Utility: delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in tool implementations
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedAnalyzerBase;
}
