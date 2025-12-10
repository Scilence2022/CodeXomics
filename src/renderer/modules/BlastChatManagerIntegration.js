/**
 * BLAST ChatManager Integration
 * Integrates BlastFunctionTools with ChatManager for AI-driven BLAST operations
 * This module provides wrapper methods that ChatManager can call directly
 */

// This script extends ChatManager with BLAST functionality
(function() {
    'use strict';

    console.log('🔬 [BLAST Integration] Loading BLAST ChatManager integration...');

    /**
     * Initialize BLAST Function Tools for ChatManager
     * Should be called during ChatManager initialization
     */
    async function initializeBlastFunctionTools() {
        try {
            // Wait for BlastManager to be available
            if (!this.app || !this.app.blastManager) {
                console.warn('⚠️ [BLAST Integration] BlastManager not available on app, skipping initialization');
                return false;
            }

            // Load BlastFunctionTools module
            await this.loadScript('modules/BlastFunctionTools.js');

            if (typeof BlastFunctionTools === 'undefined') {
                console.error('❌ [BLAST Integration] BlastFunctionTools class not loaded');
                return false;
            }

            // Create BlastFunctionTools instance
            this.blastFunctionTools = new BlastFunctionTools(this.app.blastManager);

            console.log('✅ [BLAST Integration] BlastFunctionTools initialized');
            console.log(`📋 [BLAST Integration] Available tools: ${this.blastFunctionTools.getAvailableTools().length}`);

            return true;

        } catch (error) {
            console.error('❌ [BLAST Integration] Failed to initialize BlastFunctionTools:', error);
            return false;
        }
    }

    /**
     * BLAST Search Online - Wrapper method
     */
    async function blastSearchOnline(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_search_online', parameters);
    }

    /**
     * BLAST Search Local - Wrapper method
     */
    async function blastSearchLocal(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_search_local', parameters);
    }

    /**
     * BLAST Search Batch - Wrapper method
     */
    async function blastSearchBatch(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_search_batch', parameters);
    }

    /**
     * Create BLAST Database - Wrapper method
     */
    async function blastCreateDatabase(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_create_database', parameters);
    }

    /**
     * List BLAST Databases - Wrapper method
     */
    async function blastListDatabases(parameters = {}) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_list_databases', parameters);
    }

    /**
     * Get BLAST Database Info - Wrapper method
     */
    async function blastDatabaseInfo(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_database_info', parameters);
    }

    /**
     * Delete BLAST Database - Wrapper method
     */
    async function blastDeleteDatabase(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_delete_database', parameters);
    }

    /**
     * Create Database from Genome - Wrapper method
     */
    async function blastCreateDbFromGenome(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_create_db_from_genome', parameters);
    }

    /**
     * Create Protein Database from Genome - Wrapper method
     */
    async function blastCreateProteinDbFromGenome(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_create_protein_db_from_genome', parameters);
    }

    /**
     * Filter BLAST Results - Wrapper method
     */
    async function blastFilterResults(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_filter_results', parameters);
    }

    /**
     * Export BLAST Results - Wrapper method
     */
    async function blastExportResults(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_export_results', parameters);
    }

    /**
     * Detect Sequence Type - Wrapper method
     */
    async function blastDetectSequenceType(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_detect_sequence_type', parameters);
    }

    /**
     * Validate BLAST Database - Wrapper method
     */
    async function blastValidateDatabase(parameters) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_validate_database', parameters);
    }

    /**
     * Get BLAST Installation Status - Wrapper method
     */
    async function blastGetInstallationStatus(parameters = {}) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_get_installation_status', parameters);
    }

    /**
     * Create Quick BLAST Database for Current Genome - Wrapper method
     */
    async function blastCreateQuickDbForCurrentGenome(parameters = {}) {
        if (!this.blastFunctionTools) {
            throw new Error('BLAST Function Tools not initialized');
        }
        return await this.blastFunctionTools.executeTool('blast_create_quick_db_for_current_genome', parameters);
    }

    // Extend ChatManager prototype with BLAST methods
    if (typeof ChatManager !== 'undefined') {
        ChatManager.prototype.initializeBlastFunctionTools = initializeBlastFunctionTools;
        ChatManager.prototype.blastSearchOnline = blastSearchOnline;
        ChatManager.prototype.blastSearchLocal = blastSearchLocal;
        ChatManager.prototype.blastSearchBatch = blastSearchBatch;
        ChatManager.prototype.blastCreateDatabase = blastCreateDatabase;
        ChatManager.prototype.blastListDatabases = blastListDatabases;
        ChatManager.prototype.blastDatabaseInfo = blastDatabaseInfo;
        ChatManager.prototype.blastDeleteDatabase = blastDeleteDatabase;
        ChatManager.prototype.blastCreateDbFromGenome = blastCreateDbFromGenome;
        ChatManager.prototype.blastCreateProteinDbFromGenome = blastCreateProteinDbFromGenome;
        ChatManager.prototype.blastFilterResults = blastFilterResults;
        ChatManager.prototype.blastExportResults = blastExportResults;
        ChatManager.prototype.blastDetectSequenceType = blastDetectSequenceType;
        ChatManager.prototype.blastValidateDatabase = blastValidateDatabase;
        ChatManager.prototype.blastGetInstallationStatus = blastGetInstallationStatus;
        ChatManager.prototype.blastCreateQuickDbForCurrentGenome = blastCreateQuickDbForCurrentGenome;

        console.log('✅ [BLAST Integration] ChatManager extended with BLAST function tools');
    } else {
        console.warn('⚠️ [BLAST Integration] ChatManager not available, methods not added');
    }

})();
