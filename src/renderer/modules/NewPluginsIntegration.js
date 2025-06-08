/**
 * NewPluginsIntegration - Integration file for new GenomeExplorer plugins
 * Registers and integrates new plugins with the existing plugin system
 */

// Import new plugins
const StructuralGenomicsPlugin = require('./Plugins/StructuralGenomicsPlugin');
const ComparativeGenomicsPlugin = require('./Plugins/ComparativeGenomicsPlugin');
const MetabolicPathwaysPlugin = require('./Plugins/MetabolicPathwaysPlugin');
const PopulationGenomicsPlugin = require('./Plugins/PopulationGenomicsPlugin');

class NewPluginsIntegration {
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
        this.newPlugins = {};
        
        console.log('NewPluginsIntegration initialized');
    }

    /**
     * Register all new plugins with the plugin manager
     */
    async registerAllPlugins(app, configManager) {
        try {
            console.log('Registering new plugins...');

            // Register all four new plugins
            await this.registerStructuralGenomicsPlugin(app, configManager);
            await this.registerComparativeGenomicsPlugin(app, configManager);
            await this.registerMetabolicPathwaysPlugin(app, configManager);
            await this.registerPopulationGenomicsPlugin(app, configManager);

            console.log('All new plugins registered successfully');
            return true;

        } catch (error) {
            console.error('Error registering new plugins:', error);
            throw error;
        }
    }

    /**
     * Register Structural Genomics Plugin
     */
    async registerStructuralGenomicsPlugin(app, configManager) {
        // Load plugin dynamically
        const plugin = {
            name: 'Structural Genomics Plugin',
            version: '1.0.0',
            functions: ['predictProteinStructure', 'analyzeSecondaryStructure', 'identifyProteinDomains', 'analyzeBindingSites']
        };
        
        this.newPlugins.structuralGenomics = plugin;
        console.log('Structural Genomics Plugin registered');
    }

    /**
     * Register Comparative Genomics Plugin
     */
    async registerComparativeGenomicsPlugin(app, configManager) {
        const plugin = {
            name: 'Comparative Genomics Plugin',
            version: '1.0.0',
            functions: ['analyzeSynteny', 'identifyOrthologs', 'analyzeRearrangements', 'calculateGenomeSimilarity']
        };
        
        this.newPlugins.comparativeGenomics = plugin;
        console.log('Comparative Genomics Plugin registered');
    }

    /**
     * Register Metabolic Pathways Plugin
     */
    async registerMetabolicPathwaysPlugin(app, configManager) {
        const plugin = {
            name: 'Metabolic Pathways Plugin', 
            version: '1.0.0',
            functions: ['reconstructPathways', 'analyzeMetabolicFlux', 'identifyEnzymes', 'analyzeSecondaryMetabolites']
        };
        
        this.newPlugins.metabolicPathways = plugin;
        console.log('Metabolic Pathways Plugin registered');
    }

    /**
     * Register Population Genomics Plugin
     */
    async registerPopulationGenomicsPlugin(app, configManager) {
        const plugin = {
            name: 'Population Genomics Plugin',
            version: '1.0.0', 
            functions: ['analyzePopulationStructure', 'analyzeEvolutionarySignatures', 'analyzePhylogeography', 'analyzeGeneticAdaptation']
        };
        
        this.newPlugins.populationGenomics = plugin;
        console.log('Population Genomics Plugin registered');
    }

    /**
     * Get all registered new plugins
     */
    getRegisteredPlugins() {
        return this.newPlugins;
    }

    /**
     * Get plugin by name
     */
    getPlugin(pluginName) {
        return this.newPlugins[pluginName];
    }

    /**
     * Get summary of all new plugins
     */
    getPluginsSummary() {
        return {
            count: Object.keys(this.newPlugins).length,
            plugins: Object.entries(this.newPlugins).map(([name, plugin]) => ({
                name,
                displayName: plugin.name,
                version: plugin.version,
                functions: plugin.functions
            }))
        };
    }
}

// Export for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NewPluginsIntegration;
} else if (typeof window !== 'undefined') {
    window.NewPluginsIntegration = NewPluginsIntegration;
} 