/**
 * Primer ChatManager Integration
 * Integrates PrimerFunctionTools with ChatManager for AI-driven Primer operations
 * This module provides wrapper methods that ChatManager can call directly
 */

// This script extends ChatManager with Primer functionality
(function () {
    'use strict';

    console.log('🧬 [Primer Integration] Loading Primer ChatManager integration...');

    /**
     * Initialize Primer Function Tools for ChatManager
     * Should be called during ChatManager initialization
     */
    async function initializePrimerFunctionTools() {
        try {
            // Load PrimerDesigner dependency first
            await this.loadScript('modules/PrimerDesigner.js');

            // Load shared schemas
            await this.loadScript('modules/PrimerToolSchemas.js');

            // Load PrimerFunctionTools module
            await this.loadScript('modules/PrimerFunctionTools.js');

            if (typeof window.PrimerFunctionTools === 'undefined') {
                console.error('❌ [Primer Integration] PrimerFunctionTools class not loaded');
                return false;
            }

            // Create PrimerFunctionTools instance
            this.primerFunctionTools = new window.PrimerFunctionTools(this.app);

            console.log('✅ [Primer Integration] PrimerFunctionTools initialized');
            console.log(`📋 [Primer Integration] Available tools: ${this.primerFunctionTools.getAvailableTools().length}`);

            return true;
        } catch (error) {
            console.error('❌ [Primer Integration] Failed to initialize PrimerFunctionTools:', error);
            return false;
        }
    }

    /**
     * Calculate Primer Properties - Wrapper method
     */
    async function primerCalculateProperties(parameters) {
        if (!this.primerFunctionTools) {
            throw new Error('Primer Function Tools not initialized');
        }
        return await this.primerFunctionTools.executeTool('calculate_primer_properties', parameters);
    }

    /**
     * Design Primers - Wrapper method
     */
    async function primerDesign(parameters) {
        if (!this.primerFunctionTools) {
            throw new Error('Primer Function Tools not initialized');
        }

        // First, verify we have a sequence. If we don't, but we have a geneName or range, we fetch it first
        if (!parameters.targetSequence) {
            if (parameters.geneName) {
                // Look up gene and get sequence
                try {
                    const seqData = await this.MicrobeFns.getCodingSequence(parameters.geneName);
                    if (seqData && seqData.dnaSequence) {
                        parameters.targetSequence = seqData.dnaSequence;
                    } else {
                        throw new Error(`Could not find sequence for gene ${parameters.geneName}`);
                    }
                } catch (e) {
                    throw new Error(`Failed to lookup sequence for gene ${parameters.geneName}: ${e.message}`);
                }
            } else if (parameters.chromosome && parameters.start && parameters.end) {
                // Look up sequence by region
                const seq = await this.getSequence({
                    chromosome: parameters.chromosome,
                    start: parameters.start,
                    end: parameters.end
                });
                if (seq && seq.sequence) {
                    parameters.targetSequence = seq.sequence;
                } else {
                    throw new Error('Failed to retrieve sequence for the specified genomic region');
                }
            } else {
                throw new Error('targetSequence is required if no geneName or region is specified');
            }
        }

        return await this.primerFunctionTools.executeTool('design_primers', parameters);
    }

    /**
     * Find Primer Binding Sites - Wrapper method
     */
    async function primerFindBindingSites(parameters) {
        if (!this.primerFunctionTools) {
            throw new Error('Primer Function Tools not initialized');
        }

        // If no template provided but we have a chromosome name, use current genome slice
        if (!parameters.templateSequence) {
            if (parameters.chromosome) {
                try {
                    const seqData = await this.getSequence({
                        chromosome: parameters.chromosome,
                        start: parameters.start || 1,
                        end: parameters.end // The getSequence tool handles omitting end nicely
                    });

                    if (seqData && seqData.sequence) {
                        parameters.templateSequence = seqData.sequence;
                        // Add an offset so coordinates map back correctly
                        parameters.sequenceOffset = parameters.start || 1;
                    }
                } catch (e) {
                    throw new Error('Failed to load chromosome sequence as template');
                }
            } else {
                const state = this.getCurrentState();
                if (state && state.currentChromosome) {
                    // Default to searching the current view region + 5000bp padding if possible
                    const padding = 5000;
                    const seqStart = Math.max(1, (state.viewingRegion?.start || 1) - padding);
                    const seqEnd = (state.viewingRegion?.end || seqStart + 10000) + padding;

                    const seqData = await this.getSequence({
                        chromosome: state.currentChromosome,
                        start: seqStart,
                        end: seqEnd
                    });
                    if (seqData && seqData.sequence) {
                        parameters.templateSequence = seqData.sequence;
                        parameters.sequenceOffset = seqStart;
                    } else {
                        throw new Error('No template sequence provided and could not retrieve current region automatically');
                    }
                } else {
                    throw new Error('templateSequence is required since no genomic region is currently loaded');
                }
            }
        }

        const result = await this.primerFunctionTools.executeTool('find_primer_binding_sites', parameters);

        // Remap coordinates back to genome coordinates if we pulled from a specific locus using offset
        if (result && result.sites && result.sites.length > 0 && parameters.sequenceOffset) {
            result.sites.forEach(site => {
                site.start += (parameters.sequenceOffset - 1);
                site.end += (parameters.sequenceOffset - 1);
            });
        }

        return result;
    }

    /**
     * Add Primer Annotation - Interactive wrapper
     * This bridges the Primer Designer outputs to the visual annotation system
     */
    async function primerAddAnnotation(parameters) {
        if (!parameters.chromosome || !parameters.start || !parameters.end || !parameters.name) {
            throw new Error('Missing required fields for annotation: chromosome, start, end, name');
        }
        // Forward primer usually top strand (+), reverse is bottom strand (-)
        const strand = parameters.strand === '-' ? -1 : 1;

        return await this.createAnnotation({
            type: 'primer',
            name: parameters.name,
            chromosome: parameters.chromosome,
            start: parseInt(parameters.start),
            end: parseInt(parameters.end),
            strand: strand,
            description: parameters.description || `Tm: ${parameters.tm || '?'}, GC: ${parameters.gcContent || '?'}%`
        });
    }

    // Extend ChatManager prototype with Primer methods
    if (typeof window.ChatManager !== 'undefined') {
        window.ChatManager.prototype.initializePrimerFunctionTools = initializePrimerFunctionTools;
        window.ChatManager.prototype.primerCalculateProperties = primerCalculateProperties;
        window.ChatManager.prototype.primerDesign = primerDesign;
        window.ChatManager.prototype.primerFindBindingSites = primerFindBindingSites;
        window.ChatManager.prototype.primerAddAnnotation = primerAddAnnotation;

        console.log('✅ [Primer Integration] ChatManager extended with Primer function tools');
    } else {
        console.warn('⚠️ [Primer Integration] ChatManager not available globally, methods not added');
    }
})();
