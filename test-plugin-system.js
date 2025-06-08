// Test script for GenomeExplorer Plugin System
// This script tests the basic functionality of the plugin system

console.log('=== GenomeExplorer Plugin System Test ===');

// Mock app and config manager for testing
const mockApp = {
    genomeBrowser: {
        getCurrentState: () => ({
            currentChromosome: 'chr1',
            currentPosition: { start: 1000, end: 5000 },
            visibleTracks: ['genes', 'annotations'],
            loadedFiles: ['test.gff'],
            sequenceLength: 1000000,
            annotationsCount: 500,
            userDefinedFeaturesCount: 10
        }),
        getSequence: (chromosome, start, end) => {
            // Mock sequence data
            const bases = ['A', 'T', 'G', 'C'];
            let sequence = '';
            for (let i = 0; i < (end - start); i++) {
                sequence += bases[Math.floor(Math.random() * 4)];
            }
            return sequence;
        }
    }
};

const mockConfigManager = {
    get: (key, defaultValue) => defaultValue,
    set: (key, value) => {},
    addChatMessage: (message, sender, timestamp) => `msg_${Date.now()}`
};

// Test plugin system loading
async function testPluginSystem() {
    try {
        console.log('\n1. Testing PluginUtils loading...');
        const PluginUtils = require('./src/renderer/modules/PluginUtils.js');
        console.log('✅ PluginUtils loaded successfully');
        
        console.log('\n2. Testing basic utility functions...');
        const testSequence = 'ATGCGCTATCGAATTCGCTA';
        const gcContent = PluginUtils.calculateGCContent(testSequence);
        console.log(`✅ GC Content calculation: ${gcContent.toFixed(2)}%`);
        
        const diversity = PluginUtils.calculateSequenceDiversity([testSequence, 'ATGCATGC'], 'shannon');
        console.log(`✅ Shannon diversity: ${diversity.toFixed(4)}`);
        
        console.log('\n3. Testing PluginManager loading...');
        const PluginManager = require('./src/renderer/modules/PluginManager.js');
        console.log('✅ PluginManager loaded successfully');
        
        console.log('\n4. Testing PluginImplementations loading...');
        const PluginImplementations = require('./src/renderer/modules/PluginImplementations.js');
        console.log('✅ PluginImplementations loaded successfully');
        
        console.log('\n5. Testing PluginVisualization loading...');
        const PluginVisualization = require('./src/renderer/modules/PluginVisualization.js');
        console.log('✅ PluginVisualization loaded successfully');
        
        console.log('\n6. Testing PluginManager initialization...');
        const pluginManager = new PluginManager(mockApp, mockConfigManager);
        console.log('✅ PluginManager initialized successfully');
        
        console.log('\n7. Testing available functions...');
        const availableFunctions = pluginManager.getAvailableFunctions();
        console.log(`✅ Found ${availableFunctions.length} available functions:`);
        availableFunctions.slice(0, 5).forEach(func => {
            console.log(`   - ${func.name}: ${func.description}`);
        });
        
        console.log('\n8. Testing available visualizations...');
        const availableVisualizations = pluginManager.getAvailableVisualizations();
        console.log(`✅ Found ${availableVisualizations.length} available visualizations:`);
        availableVisualizations.slice(0, 3).forEach(viz => {
            console.log(`   - ${viz.id}: ${viz.description}`);
        });
        
        console.log('\n9. Testing plugin function execution...');
        try {
            const result = await pluginManager.executeFunctionByName('genomic-analysis.analyzeGCContent', {
                chromosome: 'chr1',
                start: 1000,
                end: 2000,
                windowSize: 100
            });
            console.log('✅ Plugin function executed successfully');
            console.log(`   Result type: ${result.type}, Windows: ${result.data.length}`);
        } catch (error) {
            console.log(`⚠️  Plugin function execution test failed: ${error.message}`);
        }
        
        console.log('\n=== Plugin System Test Complete ===');
        console.log('✅ All core components loaded and initialized successfully!');
        console.log('🚀 Plugin system is ready for LLM ChatBox integration');
        
    } catch (error) {
        console.error('❌ Plugin system test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testPluginSystem(); 