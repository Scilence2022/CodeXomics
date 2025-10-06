#!/usr/bin/env node

/**
 * Test script to verify fixed dynamic tool selection
 */

const ToolsRegistryManager = require('../../tools_registry/registry_manager.js');

async function testDynamicToolSelection() {
    console.log('🧪 Testing Dynamic Tool Selection After Fix\n');
    
    try {
        const registryManager = new ToolsRegistryManager();
        await registryManager.initializeRegistry();
        
        // Test the problematic query
        const userQuery = 'load genome file "/Users/song/Documents/Genome-AI-Studio-Projects/test_data/ECOLI.gbk"';
        
        console.log('📝 Testing query:', userQuery);
        console.log();
        
        // Mock context
        const context = {
            hasData: false,
            hasNetwork: true,
            hasAuth: true,
            currentCategory: null,
            loadedGenome: null,
            activeTracks: [],
            currentPosition: null
        };
        
        // Get relevant tools
        const tools = await registryManager.getRelevantTools(userQuery, context, 5);
        
        console.log('✅ Selected tools:');
        tools.forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name}`);
            console.log(`   📝 Description: ${tool.description}`);
            console.log(`   🏷️  Category: ${tool.category}`);
            console.log(`   🔑 Keywords: ${tool.keywords?.join(', ') || 'none'}`);
            console.log();
        });
        
        // Check if load_genome_file is included
        const hasLoadGenomeTool = tools.some(tool => tool.name === 'load_genome_file');
        
        if (hasLoadGenomeTool) {
            console.log('🎉 SUCCESS: load_genome_file tool is correctly selected!');
        } else {
            console.log('❌ FAILED: load_genome_file tool is NOT selected');
            console.log('Available file operations tools:');
            const allTools = await registryManager.getAllTools();
            const fileOpsTools = allTools.filter(tool => tool.category === 'file_operations');
            fileOpsTools.forEach(tool => {
                console.log(`   - ${tool.name}: ${tool.keywords?.join(', ')}`);
            });
        }
        
        // Test intent analysis specifically
        console.log('\n🔍 Intent Analysis Details:');
        const intent = await registryManager.analyzeUserIntent(userQuery);
        console.log('Primary intent:', intent.primary);
        console.log('All detected intents:', intent.all.map(i => `${i.intent} (${i.confidence.toFixed(2)})`).join(', '));
        
        // Test candidate tools
        console.log('\n🎯 Candidate Tools Selection:');
        const candidates = await registryManager.getCandidateTools(intent, context);
        console.log(`Found ${candidates.length} candidate tools`);
        candidates.slice(0, 10).forEach((tool, index) => {
            console.log(`${index + 1}. ${tool.name} (${tool.category})`);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testDynamicToolSelection();