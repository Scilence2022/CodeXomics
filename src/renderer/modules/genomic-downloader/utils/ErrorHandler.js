/**
 * ErrorHandler - Centralized error handling with user-friendly messages
 * Converts technical errors into actionable feedback for users
 */
class ErrorHandler {
    /**
     * Handle error and return user-friendly information
     * @param {Error} error - The error object
     * @param {Object} context - Context information (searchTerm, database, etc.)
     * @returns {Object} User-friendly error information
     */
    static handle(error, context = {}) {
        const errorInfo = {
            message: this.getUserFriendlyMessage(error, context),
            suggestion: this.getSuggestion(error, context),
            canRetry: this.isRetryable(error),
            technicalDetails: error.message,
            type: this.getErrorType(error)
        };

        // Log for debugging
        console.error('[ErrorHandler]', {
            error: error,
            context: context,
            errorInfo: errorInfo
        });

        return errorInfo;
    }

    /**
     * Get user-friendly error message
     */
    static getUserFriendlyMessage(error, context) {
        // Network errors
        if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
            return 'Unable to connect to the database. Please check your internet connection.';
        }

        // HTTP status errors
        if (error.status) {
            switch (error.status) {
                case 429:
                    return 'Too many requests. The database is rate-limiting our requests. Please wait a moment.';
                case 404:
                    if (context.searchTerm) {
                        return `No results found for "${context.searchTerm}".`;
                    }
                    return 'The requested resource was not found.';
                case 500:
                case 502:
                case 503:
                    return 'The database server is experiencing issues. Please try again later.';
                case 400:
                    return 'Invalid search query. Please check your search terms and filters.';
                default:
                    return `Server error (${error.status}). Please try again.`;
            }
        }

        // Timeout errors
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            return 'The request took too long to complete. The database might be slow. Please try again.';
        }

        // Validation errors
        if (error.name === 'ValidationError') {
            return error.message; // Already user-friendly
        }

        // Parse errors
        if (error.name === 'SyntaxError' || error.message.includes('JSON')) {
            return 'Received invalid data from the server. This is likely a temporary issue.';
        }

        // Default fallback
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.';
    }

    /**
     * Get contextual suggestion for fixing the error
     */
    static getSuggestion(error, context) {
        // No results found suggestions
        if (error.status === 404 && context.searchTerm) {
            // Numeric search in genome database
            if (context.database === 'genome' && /^\d+$/.test(context.searchTerm)) {
                return '💡 Tip: Try searching by organism name instead of a number (e.g., "Escherichia coli" instead of "1655").';
            }

            // Numeric search in general
            if (/^\d+$/.test(context.searchTerm)) {
                return '💡 Tip: If searching for a strain number, try the full organism name (e.g., "Escherichia coli K-12 MG1655").';
            }

            // Generic search suggestions
            return '💡 Try: (1) Use broader search terms, (2) Check spelling, (3) Switch database type, or (4) Remove filters.';
        }

        // Rate limiting
        if (error.status === 429) {
            return '⏱️ Tip: Wait 10-30 seconds before searching again. Consider using an NCBI API key for higher limits.';
        }

        // Server errors
        if (error.status >= 500) {
            return '🔄 Tip: This is a temporary server issue. Wait a few minutes and try again.';
        }

        // Network errors
        if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
            return '🌐 Tip: Check your internet connection and firewall settings. Some networks block access to scientific databases.';
        }

        // Timeout
        if (error.name === 'TimeoutError') {
            return '⏱️ Tip: Try reducing the number of results or narrowing your search with filters.';
        }

        return null;
    }

    /**
     * Determine if error is retryable
     */
    static isRetryable(error) {
        // Network errors - retryable
        if (error.name === 'NetworkError' || error.message.includes('Failed to fetch')) {
            return true;
        }

        // Timeout - retryable
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
            return true;
        }

        // Server errors (5xx) - retryable
        if (error.status >= 500 && error.status < 600) {
            return true;
        }

        // Rate limiting (429) - retryable after wait
        if (error.status === 429) {
            return true;
        }

        // Client errors (4xx except 429) - not retryable
        if (error.status >= 400 && error.status < 500) {
            return false;
        }

        // Unknown errors - conservative, allow retry
        return true;
    }

    /**
     * Get error type for UI formatting
     */
    static getErrorType(error) {
        if (error.status === 404) return 'not-found';
        if (error.status === 429) return 'rate-limit';
        if (error.status >= 500) return 'server-error';
        if (error.name === 'NetworkError') return 'network-error';
        if (error.name === 'ValidationError') return 'validation-error';
        return 'unknown-error';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
} else {
    window.ErrorHandler = ErrorHandler;
}
