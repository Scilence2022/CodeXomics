/**
 * ValidationError - Custom error for validation failures
 */
class ValidationError extends Error {
    constructor(message, field = null) {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
    }
}

/**
 * Validator - Input validation utility
 * Validates user inputs before API calls
 */
class Validator {
    /**
     * Validate search form inputs
     */
    static validateSearch(searchTerm, database, options = {}) {
        const errors = [];

        // Validate search term
        if (!searchTerm || !searchTerm.trim()) {
            errors.push(new ValidationError('Search term is required', 'searchTerm'));
        } else if (searchTerm.trim().length < 2) {
            errors.push(new ValidationError('Search term must be at least 2 characters', 'searchTerm'));
        } else if (searchTerm.length > 500) {
            errors.push(new ValidationError('Search term is too long (max 500 characters)', 'searchTerm'));
        }

        // Validate database
        const validDatabases = ['nucleotide', 'protein', 'assembly', 'genome', 'sra', 'pubmed'];
        if (database && !validDatabases.includes(database)) {
            errors.push(new ValidationError(`Invalid database: ${database}. Must be one of: ${validDatabases.join(', ')}`, 'database'));
        }

        // Validate sequence length filters
        if (options.minLength !== undefined && options.minLength !== null) {
            const minLength = parseInt(options.minLength);
            if (isNaN(minLength) || minLength < 0) {
                errors.push(new ValidationError('Minimum length must be a positive number', 'minLength'));
            }
        }

        if (options.maxLength !== undefined && options.maxLength !== null) {
            const maxLength = parseInt(options.maxLength);
            if (isNaN(maxLength) || maxLength < 0) {
                errors.push(new ValidationError('Maximum length must be a positive number', 'maxLength'));
            }

            if (options.minLength && maxLength < parseInt(options.minLength)) {
                errors.push(new ValidationError('Maximum length must be greater than minimum length', 'maxLength'));
            }
        }

        // Validate results limit
        if (options.resultsLimit !== undefined) {
            const limit = parseInt(options.resultsLimit);
            if (isNaN(limit) || limit < 1 || limit > 1000) {
                errors.push(new ValidationError('Results limit must be between 1 and 1000', 'resultsLimit'));
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate download inputs
     */
    static validateDownload(outputDirectory, selectedFiles) {
        const errors = [];

        // Validate output directory
        if (!outputDirectory || !outputDirectory.trim()) {
            errors.push(new ValidationError('Output directory is required', 'outputDirectory'));
        }

        // Validate file selection
        if (!selectedFiles || selectedFiles.length === 0) {
            errors.push(new ValidationError('At least one file must be selected for download', 'selectedFiles'));
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Sanitize user input to prevent injection
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') {
            return input;
        }

        // Remove potentially dangerous characters
        return input
            .trim()
            .replace(/[<>]/g, '') // Remove HTML brackets
            .replace(/[;|&$]/g, ''); // Remove shell special characters
    }

    /**
     * Validate file format
     */
    static validateFileFormat(format, database) {
        const formatsByDatabase = {
            'nucleotide': ['fasta', 'genbank', 'embl', 'gff'],
            'protein': ['fasta', 'genbank'],
            'assembly': ['fasta', 'genbank', 'gff'],
            'genome': ['fasta'],
            'sra': ['sra'],
            'pubmed': ['medline', 'xml']
        };

        const validFormats = formatsByDatabase[database] || ['fasta'];

        if (!validFormats.includes(format)) {
            throw new ValidationError(
                `Invalid format '${format}' for database '${database}'. Valid formats: ${validFormats.join(', ')}`,
                'fileFormat'
            );
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Validator, ValidationError };
} else {
    window.Validator = Validator;
    window.ValidationError = ValidationError;
}
