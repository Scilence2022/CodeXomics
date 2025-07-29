// Test script to check CrewAI initialization
// Run this in the browser console

console.log('=== CrewAI System Test ===');

// Check if ChatManager exists
if (typeof window.chatManager !== 'undefined') {
    console.log('✅ ChatManager found');
    
    // Check which multi-agent system is being used
    console.log('MultiAgentSystem type:', window.chatManager.multiAgentSystem?.constructor?.name);
    console.log('CrewAI System available:', window.chatManager.crewAISystem !== null);
    console.log('Agent system enabled:', window.chatManager.agentSystemEnabled);
    console.log('Use CrewAI flag:', window.chatManager.useCrewAI);
    console.log('Settings:', window.chatManager.agentSystemSettings);
    
    // Test if the getAgentForTool method exists and works
    if (window.chatManager.multiAgentSystem) {
        console.log('Testing getAgentForTool method...');
        try {
            const agentInfo = window.chatManager.multiAgentSystem.getAgentForTool('search_features');
            console.log('Agent info for search_features:', agentInfo);
        } catch (error) {
            console.error('Error testing getAgentForTool:', error);
        }
    }
    
    // Check if CrewAI classes are available globally
    console.log('Global CrewAI classes:');
    console.log('- CrewAgent:', typeof CrewAgent !== 'undefined');
    console.log('- Crew:', typeof Crew !== 'undefined');
    console.log('- CrewAIMultiAgentSystem:', typeof CrewAIMultiAgentSystem !== 'undefined');
    console.log('- GenomicsDataAnalyst:', typeof GenomicsDataAnalyst !== 'undefined');
    
    // Get system status
    const status = window.chatManager.getAgentSystemStatus();
    console.log('Agent system status:', status);
    
} else {
    console.log('❌ ChatManager not found');
}

console.log('=== Test Complete ===');