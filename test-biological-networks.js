/**
 * Comprehensive Test Suite for Biological Networks Plugin
 * Tests all network analysis functions and visualizations
 */

console.log('🧬 Testing Biological Networks Plugin System...\n');

// Load the plugin modules
const BiologicalNetworksPlugin = require('./src/renderer/modules/BiologicalNetworksPlugin');
const BiologicalNetworkViz = require('./src/renderer/modules/BiologicalNetworkViz');

// Mock app and config manager for testing
const mockApp = {
    genomeBrowser: null,
    dataManager: null
};

const mockConfigManager = {
    get: (key) => null,
    set: (key, value) => true
};

// Test data
const testProteins = ['BRCA1', 'TP53', 'EGFR', 'MYC', 'PIK3CA', 'KRAS', 'AKT1', 'PTEN', 'RB1', 'CDKN2A'];
const testGenes = ['GATA1', 'TAL1', 'LMO2', 'RUNX1', 'FLI1', 'ERG', 'ETS1', 'SPI1', 'MYB', 'KLF1'];

// ===== TEST FUNCTIONS =====

async function testProteinInteractionNetwork() {
    console.log('🔬 Testing Protein Interaction Network Analysis...');
    
    try {
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        const result = await plugin.buildProteinInteractionNetwork({
            proteins: testProteins,
            confidenceThreshold: 0.6,
            interactionDatabase: 'string'
        });
        
        // Validate result structure
        console.log('  ✓ Network construction completed');
        console.log(`  ✓ Network contains ${result.network.nodes.length} nodes`);
        console.log(`  ✓ Network contains ${result.network.edges.length} edges`);
        console.log(`  ✓ Network density: ${result.metrics.density.toFixed(3)}`);
        console.log(`  ✓ Average degree: ${result.metrics.averageDegree.toFixed(2)}`);
        
        // Validate data types
        if (result.type !== 'protein-interaction-network') {
            throw new Error('Invalid result type');
        }
        
        if (!Array.isArray(result.proteins) || result.proteins.length !== testProteins.length) {
            throw new Error('Invalid proteins array');
        }
        
        if (!result.network || !result.network.nodes || !result.network.edges) {
            throw new Error('Invalid network structure');
        }
        
        console.log('  ✅ Protein interaction network test PASSED\n');
        return result;
        
    } catch (error) {
        console.error('  ❌ Protein interaction network test FAILED:', error.message);
        throw error;
    }
}

async function testGeneRegulatoryNetwork() {
    console.log('🧬 Testing Gene Regulatory Network Analysis...');
    
    try {
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        const result = await plugin.buildGeneRegulatoryNetwork({
            genes: testGenes,
            regulationTypes: ['activation', 'repression'],
            tissueType: 'hematopoietic',
            evidenceLevel: 'high'
        });
        
        console.log('  ✓ Gene regulatory network construction completed');
        console.log(`  ✓ Network contains ${result.network.nodes.length} nodes`);
        console.log(`  ✓ Network contains ${result.network.edges.length} edges`);
        console.log(`  ✓ Identified ${result.modules.length} regulatory modules`);
        
        // Validate regulatory modules
        if (!Array.isArray(result.modules)) {
            throw new Error('Invalid modules structure');
        }
        
        result.modules.forEach((module, index) => {
            if (!module.regulator || !Array.isArray(module.targets)) {
                throw new Error(`Invalid module ${index} structure`);
            }
        });
        
        console.log('  ✅ Gene regulatory network test PASSED\n');
        return result;
        
    } catch (error) {
        console.error('  ❌ Gene regulatory network test FAILED:', error.message);
        throw error;
    }
}

async function testNetworkCentralityAnalysis() {
    console.log('📊 Testing Network Centrality Analysis...');
    
    try {
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        // First create a network
        const networkData = await plugin.buildProteinInteractionNetwork({
            proteins: testProteins.slice(0, 6),
            confidenceThreshold: 0.5
        });
        
        // Analyze centrality
        const result = await plugin.analyzeNetworkCentrality({
            networkData: networkData,
            centralityTypes: ['degree', 'betweenness', 'closeness']
        });
        
        console.log('  ✓ Centrality analysis completed');
        console.log(`  ✓ Analyzed ${Object.keys(result.centralities).length} centrality measures`);
        
        // Validate centralities
        ['degree', 'betweenness', 'closeness'].forEach(type => {
            if (!result.centralities[type]) {
                throw new Error(`Missing ${type} centrality`);
            }
            
            const centralityValues = Object.values(result.centralities[type]);
            if (centralityValues.length === 0) {
                throw new Error(`Empty ${type} centrality values`);
            }
            
            console.log(`  ✓ ${type} centrality: ${centralityValues.length} values`);
        });
        
        // Validate hubs
        if (!result.hubs || typeof result.hubs !== 'object') {
            throw new Error('Invalid hubs structure');
        }
        
        Object.keys(result.hubs).forEach(centralityType => {
            const hubs = result.hubs[centralityType];
            if (!Array.isArray(hubs)) {
                throw new Error(`Invalid ${centralityType} hubs array`);
            }
            console.log(`  ✓ Identified ${hubs.length} ${centralityType} hubs`);
        });
        
        console.log('  ✅ Network centrality analysis test PASSED\n');
        return result;
        
    } catch (error) {
        console.error('  ❌ Network centrality analysis test FAILED:', error.message);
        throw error;
    }
}

async function testCommunityDetection() {
    console.log('🎯 Testing Community Detection...');
    
    try {
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        // Create a larger network for community detection
        const networkData = await plugin.buildProteinInteractionNetwork({
            proteins: testProteins,
            confidenceThreshold: 0.4
        });
        
        // Detect communities
        const result = await plugin.detectNetworkCommunities({
            networkData: networkData,
            algorithm: 'louvain',
            resolution: 1.0,
            minCommunitySize: 2
        });
        
        console.log('  ✓ Community detection completed');
        console.log(`  ✓ Detected ${result.communities.length} communities`);
        console.log(`  ✓ Modularity: ${result.statistics.modularity.toFixed(3)}`);
        
        // Validate communities
        if (!Array.isArray(result.communities)) {
            throw new Error('Invalid communities structure');
        }
        
        result.communities.forEach((community, index) => {
            if (!community.nodes || !Array.isArray(community.nodes) || community.nodes.length < 2) {
                throw new Error(`Invalid community ${index}: insufficient nodes`);
            }
            console.log(`  ✓ Community ${index}: ${community.nodes.length} nodes`);
        });
        
        // Validate statistics
        if (typeof result.statistics.modularity !== 'number') {
            throw new Error('Invalid modularity value');
        }
        
        console.log('  ✅ Community detection test PASSED\n');
        return result;
        
    } catch (error) {
        console.error('  ❌ Community detection test FAILED:', error.message);
        throw error;
    }
}

async function testNetworkVisualization() {
    console.log('📈 Testing Network Visualization...');
    
    try {
        // Create mock DOM container
        const mockContainer = {
            innerHTML: '',
            style: {},
            appendChild: (child) => {},
            children: []
        };
        
        // Test protein interaction network visualization
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        const networkData = await plugin.buildProteinInteractionNetwork({
            proteins: testProteins.slice(0, 5),
            confidenceThreshold: 0.6
        });
        
        const vizResult = await BiologicalNetworkViz.renderPPINetwork(
            networkData, 
            mockContainer, 
            { width: 600, height: 400 }
        );
        
        console.log('  ✓ PPI network visualization completed');
        console.log(`  ✓ Visualization type: ${vizResult.type}`);
        
        // Validate visualization result
        if (vizResult.type !== 'ppi-network') {
            throw new Error('Invalid visualization type');
        }
        
        if (!vizResult.data || !vizResult.element) {
            throw new Error('Invalid visualization result structure');
        }
        
        console.log('  ✅ Network visualization test PASSED\n');
        return vizResult;
        
    } catch (error) {
        console.error('  ❌ Network visualization test FAILED:', error.message);
        throw error;
    }
}

async function testCentralityDashboard() {
    console.log('📊 Testing Centrality Dashboard...');
    
    try {
        const mockContainer = {
            innerHTML: '',
            style: {},
            appendChild: (child) => {},
            children: []
        };
        
        // Create centrality data
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        const networkData = await plugin.buildProteinInteractionNetwork({
            proteins: testProteins.slice(0, 6),
            confidenceThreshold: 0.5
        });
        
        const centralityData = await plugin.analyzeNetworkCentrality({
            networkData: networkData,
            centralityTypes: ['degree', 'betweenness', 'closeness']
        });
        
        // Render dashboard
        const dashboardResult = await BiologicalNetworkViz.renderCentralityDashboard(
            centralityData,
            mockContainer,
            { width: 800, height: 600 }
        );
        
        console.log('  ✓ Centrality dashboard rendered');
        console.log(`  ✓ Dashboard type: ${dashboardResult.type}`);
        
        // Validate dashboard
        if (dashboardResult.type !== 'centrality-dashboard') {
            throw new Error('Invalid dashboard type');
        }
        
        console.log('  ✅ Centrality dashboard test PASSED\n');
        return dashboardResult;
        
    } catch (error) {
        console.error('  ❌ Centrality dashboard test FAILED:', error.message);
        throw error;
    }
}

async function testPluginIntegration() {
    console.log('🔗 Testing Plugin Integration...');
    
    try {
        // Test plugin metadata
        const metadata = BiologicalNetworksPlugin.metadata;
        
        if (!metadata.name || !metadata.description || !metadata.version) {
            throw new Error('Invalid plugin metadata');
        }
        
        console.log(`  ✓ Plugin name: ${metadata.name}`);
        console.log(`  ✓ Plugin version: ${metadata.version}`);
        console.log(`  ✓ Plugin category: ${metadata.category}`);
        
        // Test plugin initialization
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        if (!plugin.app || !plugin.configManager) {
            throw new Error('Plugin initialization failed');
        }
        
        console.log('  ✓ Plugin initialization successful');
        
        // Test function availability
        const requiredFunctions = [
            'buildProteinInteractionNetwork',
            'buildGeneRegulatoryNetwork',
            'analyzeNetworkCentrality',
            'detectNetworkCommunities'
        ];
        
        requiredFunctions.forEach(funcName => {
            if (typeof plugin[funcName] !== 'function') {
                throw new Error(`Missing function: ${funcName}`);
            }
            console.log(`  ✓ Function available: ${funcName}`);
        });
        
        console.log('  ✅ Plugin integration test PASSED\n');
        return true;
        
    } catch (error) {
        console.error('  ❌ Plugin integration test FAILED:', error.message);
        throw error;
    }
}

async function runPerformanceTest() {
    console.log('⚡ Running Performance Tests...');
    
    try {
        const plugin = BiologicalNetworksPlugin.init(mockApp, mockConfigManager);
        
        // Test with different network sizes
        const sizes = [5, 10, 15];
        
        for (const size of sizes) {
            const startTime = Date.now();
            
            const networkData = await plugin.buildProteinInteractionNetwork({
                proteins: testProteins.slice(0, size),
                confidenceThreshold: 0.5
            });
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            console.log(`  ✓ Network size ${size}: ${duration}ms (${networkData.network.nodes.length} nodes, ${networkData.network.edges.length} edges)`);
            
            // Performance threshold check (should complete within reasonable time)
            if (duration > 5000) {
                console.warn(`  ⚠️  Performance warning: ${size} nodes took ${duration}ms`);
            }
        }
        
        console.log('  ✅ Performance tests PASSED\n');
        
    } catch (error) {
        console.error('  ❌ Performance tests FAILED:', error.message);
        throw error;
    }
}

// ===== RUN ALL TESTS =====

async function runAllTests() {
    console.log('🚀 Starting Biological Networks Plugin Test Suite\n');
    console.log('=' + '='.repeat(60) + '\n');
    
    const startTime = Date.now();
    let passedTests = 0;
    let totalTests = 0;
    
    const tests = [
        { name: 'Plugin Integration', func: testPluginIntegration },
        { name: 'Protein Interaction Network', func: testProteinInteractionNetwork },
        { name: 'Gene Regulatory Network', func: testGeneRegulatoryNetwork },
        { name: 'Network Centrality Analysis', func: testNetworkCentralityAnalysis },
        { name: 'Community Detection', func: testCommunityDetection },
        { name: 'Network Visualization', func: testNetworkVisualization },
        { name: 'Centrality Dashboard', func: testCentralityDashboard },
        { name: 'Performance Tests', func: runPerformanceTest }
    ];
    
    for (const test of tests) {
        totalTests++;
        try {
            await test.func();
            passedTests++;
        } catch (error) {
            console.error(`\n❌ ${test.name} failed:`, error.message);
        }
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    console.log('=' + '='.repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('=' + '='.repeat(60));
    console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
    console.log(`⏱️  Total time: ${totalDuration}ms`);
    console.log(`📊 Success rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    
    if (passedTests === totalTests) {
        console.log('\n🎉 ALL TESTS PASSED! Biological Networks Plugin is ready for production.');
    } else {
        console.log(`\n⚠️  ${totalTests - passedTests} test(s) failed. Please review and fix issues.`);
        process.exit(1);
    }
}

// Run the test suite
runAllTests().catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
}); 