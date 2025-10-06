#!/usr/bin/env node

/**
 * Test script to verify translate_dna tool selection for translation queries
 */

const ToolsRegistryManager = require('../../tools_registry/registry_manager.js');

async function testTranslateToolSelection() {
    console.log('🧪 Testing translate_dna Tool Selection for Translation Queries\n');
    
    try {
        const registryManager = new ToolsRegistryManager();
        await registryManager.initializeRegistry();
        
        // Test translation queries that should select translate_dna
        const translationQueries = [
            'Translate DNA sequence ATGCGATCGTAGC to protein',
            'translate dna to amino acid',
            'translate this sequence to protein',
            'get protein sequence from dna',
            'dna translation',
            'convert dna to amino acids'
        ];
        
        for (const query of translationQueries) {
            console.log(`🔍 Testing query: "${query}"`);
            
            const context = {
                hasData: true,
                hasNetwork: true,
                hasAuth: true,
                currentCategory: 'sequence',
                loadedGenome: null,
                activeTracks: [],
                currentPosition: null
            };
            
            // Get relevant tools
            const relevantTools = await registryManager.getRelevantTools(query, context, 10);
            
            console.log(`   📊 Selected ${relevantTools.length} tools:`);
            relevantTools.slice(0, 5).forEach((tool, index) => {
                console.log(`   ${index + 1}. ${tool.name} (${tool.category}) - ${tool.description}`);
                if (tool.keywords) {
                    console.log(`      Keywords: ${tool.keywords.join(', ')}`);
                }
            });
            
            // Check if translate_dna is in the top 3
            const translateToolIndex = relevantTools.slice(0, 3).findIndex(tool => tool.name === 'translate_dna');
            
            if (translateToolIndex >= 0) {
                console.log(`   ✅ SUCCESS! translate_dna is ranked #${translateToolIndex + 1} in top 3 tools`);
            } else {
                console.log(`   ❌ FAILED! translate_dna is NOT in top 3 tools`);
                // Show what tools were selected instead
                console.log('   Top 3 tools selected instead:');
                relevantTools.slice(0, 3).forEach((tool, index) => {
                    console.log(`     ${index + 1}. ${tool.name} (${tool.category})`);
                });
            }
            
            // Show intent analysis
            const intent = await registryManager.analyzeUserIntent(query);
            console.log(`   🎯 Intent analysis: Primary="${intent.primary}", All=[${intent.all.map(i => i.intent).join(', ')}]`);
            
            console.log(''); // Empty line for readability
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
testTranslateToolSelection();