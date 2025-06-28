// Fix ConversationEvolution Connection Issue
// This script patches the syncCurrentConversationToEvolution method to add better connection handling

(function() {
    console.log('🔧 Applying ConversationEvolution connection fix...');
    
    // Wait for ChatManager to be available
    function waitForChatManager() {
        if (typeof window !== 'undefined' && window.chatManager) {
            applyFix();
        } else {
            setTimeout(waitForChatManager, 100);
        }
    }
    
    function applyFix() {
        console.log('🧬 Patching ChatManager.syncCurrentConversationToEvolution...');
        
        // Store original method
        const originalSync = window.chatManager.syncCurrentConversationToEvolution.bind(window.chatManager);
        
        // Replace with enhanced version
        window.chatManager.syncCurrentConversationToEvolution = function() {
            console.log('🧬 [DEBUG] Enhanced syncCurrentConversationToEvolution called');
            console.log('🧬 [DEBUG] this.evolutionManager:', !!this.evolutionManager);
            console.log('🧬 [DEBUG] this.currentConversationData:', !!this.currentConversationData);
            
            // If Evolution Manager is not connected, try to find it again
            if (!this.evolutionManager) {
                console.log('🧬 [DEBUG] Evolution Manager not connected, attempting to find it...');
                
                if (window.evolutionManager) {
                    this.evolutionManager = window.evolutionManager;
                    console.log('🧬 [DEBUG] Found Evolution Manager via window.evolutionManager');
                } else if (window.conversationEvolutionManager) {
                    this.evolutionManager = window.conversationEvolutionManager;
                    console.log('🧬 [DEBUG] Found Evolution Manager via window.conversationEvolutionManager');
                } else {
                    console.warn('🧬 [DEBUG] Evolution Manager still not available, sync will be skipped');
                    return;
                }
            }

            if (!this.currentConversationData) {
                console.warn('🧬 [DEBUG] No current conversation data available');
                return;
            }

            try {
                // Update end time
                this.currentConversationData.endTime = new Date().toISOString();
                
                console.log('🧬 [DEBUG] Conversation data to sync:', {
                    id: this.currentConversationData.id,
                    eventCount: this.currentConversationData.events.length,
                    lastEventType: this.currentConversationData.events.length > 0 ? 
                        this.currentConversationData.events[this.currentConversationData.events.length - 1].type : 'none'
                });
                
                // Send to Evolution Manager
                if (typeof this.evolutionManager.addConversationData === 'function') {
                    this.evolutionManager.addConversationData(this.currentConversationData);
                    console.log('🧬 [SUCCESS] Synced conversation data to Evolution storage');
                } else {
                    console.warn('🧬 [ERROR] Evolution Manager does not support addConversationData method');
                    console.log('🧬 [DEBUG] Available methods:', Object.getOwnPropertyNames(this.evolutionManager));
                }
            } catch (error) {
                console.error('❌ [ERROR] Failed to sync conversation to Evolution storage:', error);
            }
        }.bind(window.chatManager);
        
        // Force reconnection
        console.log('🔗 Forcing Evolution Manager reconnection...');
        
        if (window.conversationEvolutionManager) {
            window.conversationEvolutionManager.connectToChatBox();
        }
        
        if (window.chatManager.initializeEvolutionIntegration) {
            window.chatManager.initializeEvolutionIntegration();
        }
        
        // Test the connection
        setTimeout(() => {
            console.log('🧪 Testing Evolution connection...');
            
            if (window.chatManager.addToEvolutionData) {
                window.chatManager.addToEvolutionData({
                    type: 'connection_test',
                    content: 'Testing Evolution connection after fix',
                    metadata: { source: 'connection_fix', timestamp: new Date().toISOString() }
                });
                
                console.log('✅ Connection test event added');
            }
            
            // Force sync
            if (window.chatManager.syncCurrentConversationToEvolution) {
                window.chatManager.syncCurrentConversationToEvolution();
                console.log('🔄 Forced sync after connection fix');
            }
        }, 2000);
        
        console.log('✅ ConversationEvolution connection fix applied successfully');
    }
    
    // Start the fix process
    waitForChatManager();
})(); 