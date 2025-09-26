#!/usr/bin/env node

/**
 * Final verification test - simulate the complete ChatManager flow
 */

const ToolsRegistryManager = require('./tools_registry/registry_manager.js');

async function simulateCompleteFlow() {
    console.log('🎯 Final Verification: Complete ChatManager Flow Simulation\n');
    
    try {
        const registryManager = new ToolsRegistryManager();
        await registryManager.initializeRegistry();
        
        // Simulate the exact query from the user
        const userQuery = 'load genome file "/Users/song/Documents/Genome-AI-Studio-Projects/test_data/ECOLI.gbk"';
        
        // Mock context (matching ChatManager context)
        const context = {
            hasData: false,
            hasNetwork: true,
            hasAuth: true,
            currentCategory: null,
            loadedGenome: null,
            activeTracks: [],
            currentPosition: null
        };
        
        console.log('📋 Query:', userQuery);
        console.log('🎯 Context:', JSON.stringify(context, null, 2));
        console.log();
        
        // Get top 3 tools (simulating ChatManager's dynamic tool selection)
        const relevantTools = await registryManager.getRelevantTools(userQuery, context, 3);
        
        console.log('🏆 Top 3 Selected Tools:');
        relevantTools.slice(0, 3).forEach((tool, index) => {
            console.log(`${index + 1}. **${tool.name}**`);
            console.log(`   📝 ${tool.description}`);
            console.log(`   🏷️  Category: ${tool.category}`);
            console.log(`   ⭐ Priority: ${tool.priority}`);
            console.log(`   🔑 Keywords: ${tool.keywords?.join(', ') || 'none'}`);
            console.log();
        });
        
        // Check if load_genome_file is in the top 3
        const loadGenomeToolIndex = relevantTools.slice(0, 3).findIndex(tool => tool.name === 'load_genome_file');
        
        if (loadGenomeToolIndex >= 0) {
            console.log(`🎉 SUCCESS! load_genome_file is ranked #${loadGenomeToolIndex + 1} in top 3 tools`);
            console.log('✅ Dynamic tool selection is working correctly!');
            
            // Show the exact tool that would be available to the LLM
            const selectedTool = relevantTools[loadGenomeToolIndex];
            console.log('\n📋 Tool Definition that LLM will receive:');
            console.log('```yaml');
            console.log(`name: ${selectedTool.name}`);
            console.log(`description: ${selectedTool.description}`);
            console.log(`parameters:`);
            Object.entries(selectedTool.parameters?.properties || {}).forEach(([param, def]) => {
                console.log(`  ${param}: ${def.type} - ${def.description}`);
            });
            console.log('required:', selectedTool.parameters?.required || []);
            console.log('```');
        } else {
            console.log('❌ FAILED: load_genome_file is NOT in top 3 tools');
            console.log('This suggests the scoring algorithm needs adjustment.');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the simulation
simulateCompleteFlow();