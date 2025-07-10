/**
 * Usage Example - Demonstrates how to use the improved function calling system
 * This example shows the complete integration process and basic usage patterns
 */

/**
 * Example: Complete Integration of Improved Function Calling System
 */
class GenomeExplorerExample {
    constructor() {
        this.legacyGenomeBrowser = this.createLegacyGenomeBrowser();
        this.modernBootstrapper = null;
        this.context = null;
        this.isInitialized = false;
    }
    
    /**
     * Initialize the improved function calling system
     */
    async initialize() {
        console.log('🚀 [GenomeExplorerExample] Initializing improved function calling system...');
        
        try {
            // Step 1: Create and initialize the bootstrapper
            this.modernBootstrapper = new ModernBootstrapper();
            
            // Step 2: Initialize modern infrastructure with legacy compatibility
            const initResult = await this.modernBootstrapper.initialize(this.legacyGenomeBrowser);
            
            if (!initResult.success) {
                throw new Error('Failed to initialize modern infrastructure');
            }
            
            this.context = initResult.context;
            console.log('✅ Modern infrastructure initialized');
            
            // Step 3: Start gradual migration
            const migrationResult = await this.modernBootstrapper.startMigration();
            
            if (!migrationResult.success) {
                throw new Error('Failed to complete migration');
            }
            
            console.log('✅ Migration completed successfully');
            console.log('📊 Migration metrics:', migrationResult);
            
            this.isInitialized = true;
            return true;
            
        } catch (error) {
            console.error('🚨 [GenomeExplorerExample] Initialization failed:', error);
            return false;
        }
    }
    
    /**
     * Example 1: Basic cursor positioning using modern patterns
     */
    async demonstrateCursorPositioning() {
        console.log('\n📍 [Example 1] Demonstrating cursor positioning...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Modern approach: Using command pattern with validation and error handling
            const result = await this.context.execute('sequence:setCursor', {
                position: 150,
                chromosome: 'chr1',
                animate: true
            });
            
            if (result.success) {
                console.log('✅ Cursor positioned successfully:', result.data);
                
                // Get current cursor state
                const cursorState = this.context.getState('sequence:cursor');
                console.log('📊 Current cursor state:', cursorState);
                
            } else {
                console.error('❌ Failed to position cursor:', result.error);
            }
            
        } catch (error) {
            console.error('🚨 Cursor positioning error:', error);
        }
    }
    
    /**
     * Example 2: Sequence editing workflow
     */
    async demonstrateSequenceEditing() {
        console.log('\n✂️ [Example 2] Demonstrating sequence editing workflow...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Step 1: Set a test sequence
            this.context.setState('sequence:current', 'ATCGATCGATCGATCG', {
                source: 'example',
                chromosome: 'chr1'
            });
            
            console.log('📄 Test sequence set');
            
            // Step 2: Copy a portion of the sequence
            const copyResult = await this.context.execute('action:copy', {
                start: 0,
                end: 4,
                chromosome: 'chr1'
            });
            
            if (copyResult.success) {
                console.log('✅ Sequence copied:', copyResult.data);
            }
            
            // Step 3: Set cursor position for paste
            await this.context.execute('sequence:setCursor', {
                position: 8
            });
            
            // Step 4: Paste the copied sequence
            const pasteResult = await this.context.execute('action:paste', {
                position: 8
            });
            
            if (pasteResult.success) {
                console.log('✅ Paste action queued:', pasteResult.data);
            }
            
            // Step 5: Execute all queued actions
            const executeResult = await this.context.execute('action:executeAll', {});
            
            if (executeResult.success) {
                console.log('✅ All actions executed:', executeResult.data);
                
                // Get the modified sequence
                const modifiedSequence = this.context.getState('sequence:current');
                console.log('📄 Modified sequence:', modifiedSequence);
            }
            
        } catch (error) {
            console.error('🚨 Sequence editing error:', error);
        }
    }
    
    /**
     * Example 3: Event-driven updates
     */
    async demonstrateEventDrivenUpdates() {
        console.log('\n🔄 [Example 3] Demonstrating event-driven updates...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            const eventBus = this.context.getService('eventBus');
            
            // Subscribe to cursor position changes
            eventBus.on('sequence:cursor-changed', (eventData) => {
                console.log('📍 Cursor position changed:', eventData.data);
            });
            
            // Subscribe to sequence changes
            this.context.subscribe('sequence:current', (change) => {
                console.log('📄 Sequence changed:', {
                    oldLength: change.oldValue?.length || 0,
                    newLength: change.newValue?.length || 0
                });
            });
            
            // Subscribe to action queue changes
            this.context.subscribe('actions:queue', (change) => {
                console.log('📋 Action queue changed:', {
                    queueLength: change.newValue?.length || 0
                });
            });
            
            // Trigger some events
            await this.context.execute('sequence:setCursor', { position: 200 });
            await this.context.execute('sequence:setCursorColor', { color: '#ff0000' });
            
            console.log('✅ Event subscriptions active');
            
        } catch (error) {
            console.error('🚨 Event handling error:', error);
        }
    }
    
    /**
     * Example 4: Performance monitoring and metrics
     */
    async demonstratePerformanceMonitoring() {
        console.log('\n📊 [Example 4] Demonstrating performance monitoring...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Perform multiple operations to generate metrics
            const operations = 50;
            console.log(`🔄 Performing ${operations} operations...`);
            
            const startTime = performance.now();
            
            for (let i = 0; i < operations; i++) {
                await this.context.execute('sequence:setCursor', { position: i * 5 });
            }
            
            const endTime = performance.now();
            console.log(`✅ Operations completed in ${(endTime - startTime).toFixed(2)}ms`);
            
            // Get performance metrics
            const contextMetrics = this.context.getPerformanceMetrics();
            console.log('📊 Context metrics:', contextMetrics);
            
            // Get command-specific metrics
            const commandRegistry = this.context.getService('commandRegistry');
            const setCursorCommand = commandRegistry.get('sequence:setCursor');
            
            if (setCursorCommand) {
                const commandStats = setCursorCommand.getStats();
                console.log('📈 SetCursor command stats:', commandStats);
            }
            
            // Get cache metrics
            const cacheManager = this.context.getService('cacheManager');
            const cacheStats = cacheManager.getStats();
            console.log('💾 Cache stats:', cacheStats);
            
        } catch (error) {
            console.error('🚨 Performance monitoring error:', error);
        }
    }
    
    /**
     * Example 5: Error handling and recovery
     */
    async demonstrateErrorHandling() {
        console.log('\n🚨 [Example 5] Demonstrating error handling...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Test invalid operations
            console.log('🔍 Testing invalid cursor position...');
            const invalidResult = await this.context.execute('sequence:setCursor', {
                position: -1
            });
            
            if (!invalidResult.success) {
                console.log('✅ Invalid operation properly rejected:', invalidResult.error.message);
            }
            
            // Test missing parameters
            console.log('🔍 Testing missing parameters...');
            const missingParamResult = await this.context.execute('sequence:setCursorColor', {});
            
            if (!missingParamResult.success) {
                console.log('✅ Missing parameters properly rejected:', missingParamResult.error.message);
            }
            
            // Test Result pattern for safe chaining
            console.log('🔍 Testing Result pattern...');
            const modernSequenceUtils = this.context.getService('modernSequenceUtils');
            
            if (modernSequenceUtils) {
                const result = await modernSequenceUtils.setCursorPosition(-5);
                
                if (result === null) {
                    console.log('✅ Result pattern handled error gracefully');
                }
            }
            
        } catch (error) {
            console.error('🚨 Error handling test failed:', error);
        }
    }
    
    /**
     * Example 6: Legacy compatibility
     */
    async demonstrateLegacyCompatibility() {
        console.log('\n🔄 [Example 6] Demonstrating legacy compatibility...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Use legacy API - should work transparently
            console.log('🔍 Testing legacy ActionManager API...');
            const legacyResult = await this.legacyGenomeBrowser.actionManager.setCursorPosition(300);
            console.log('✅ Legacy API call succeeded:', legacyResult);
            
            // Use legacy SequenceUtils API
            console.log('🔍 Testing legacy SequenceUtils API...');
            const legacySeqResult = await this.legacyGenomeBrowser.sequenceUtils.setCursorColor('#00ff00');
            console.log('✅ Legacy sequence API call succeeded:', legacySeqResult);
            
            // Check that state is synchronized
            const modernCursorState = this.context.getState('sequence:cursor');
            console.log('📊 Modern cursor state after legacy calls:', modernCursorState);
            
        } catch (error) {
            console.error('🚨 Legacy compatibility error:', error);
        }
    }
    
    /**
     * Example 7: Batch operations
     */
    async demonstrateBatchOperations() {
        console.log('\n📦 [Example 7] Demonstrating batch operations...');
        
        if (!this.isInitialized) {
            console.error('System not initialized');
            return;
        }
        
        try {
            // Create batch operations
            const batchOperations = [
                { type: 'setCursor', params: { position: 100 } },
                { type: 'setColor', params: { color: '#0000ff' } },
                { type: 'setCursor', params: { position: 200 } }
            ];
            
            console.log('🔄 Executing batch operations...');
            
            const modernSequenceUtils = this.context.getService('modernSequenceUtils');
            
            if (modernSequenceUtils) {
                const batchResult = await modernSequenceUtils.batchUpdate(batchOperations);
                
                if (batchResult.isSuccess()) {
                    console.log('✅ Batch operations completed:', batchResult.getData());
                } else {
                    console.log('❌ Batch operations failed:', batchResult.getError());
                }
            }
            
        } catch (error) {
            console.error('🚨 Batch operations error:', error);
        }
    }
    
    /**
     * Run all examples
     */
    async runAllExamples() {
        console.log('🎯 [GenomeExplorerExample] Running all usage examples...');
        
        // Initialize the system
        const initialized = await this.initialize();
        
        if (!initialized) {
            console.error('❌ Failed to initialize system');
            return;
        }
        
        // Run all examples
        await this.demonstrateCursorPositioning();
        await this.demonstrateSequenceEditing();
        await this.demonstrateEventDrivenUpdates();
        await this.demonstratePerformanceMonitoring();
        await this.demonstrateErrorHandling();
        await this.demonstrateLegacyCompatibility();
        await this.demonstrateBatchOperations();
        
        console.log('\n🎉 All examples completed successfully!');
        
        // Get final system status
        const migrationStatus = this.modernBootstrapper.getMigrationStatus();
        console.log('📊 Final migration status:', migrationStatus);
    }
    
    /**
     * Create a mock legacy GenomeBrowser for demonstration
     */
    createLegacyGenomeBrowser() {
        return {
            actionManager: {
                setCursorPosition: function(position) {
                    console.log(`Legacy ActionManager: setCursorPosition(${position})`);
                    return { position, timestamp: Date.now() };
                },
                handlePasteSequence: function(options) {
                    console.log('Legacy ActionManager: handlePasteSequence', options);
                    return { success: true };
                },
                handleDeleteSequence: function(options) {
                    console.log('Legacy ActionManager: handleDeleteSequence', options);
                    return { success: true };
                }
            },
            sequenceUtils: {
                setCursorPosition: function(position, options) {
                    console.log(`Legacy SequenceUtils: setCursorPosition(${position})`, options);
                    return { position, options };
                },
                setCursorColor: function(color) {
                    console.log(`Legacy SequenceUtils: setCursorColor(${color})`);
                    return { color };
                },
                handleSequenceClick: function(event, position) {
                    console.log(`Legacy SequenceUtils: handleSequenceClick(${position})`);
                    return { position, event };
                }
            },
            // Mock properties
            currentSequence: 'ATCGATCGATCGATCG',
            currentChromosome: 'chr1',
            cursorPosition: 0,
            
            // Mock event system
            addEventListener: function(event, callback) {
                console.log(`Legacy: addEventListener(${event})`);
            },
            
            // Mock methods that might be called
            updateDisplay: function() {
                console.log('Legacy: updateDisplay()');
            }
        };
    }
    
    /**
     * Clean up resources
     */
    async destroy() {
        if (this.modernBootstrapper) {
            this.modernBootstrapper.destroy();
        }
        
        console.log('🧹 [GenomeExplorerExample] Cleaned up resources');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GenomeExplorerExample;
} else if (typeof window !== 'undefined') {
    window.GenomeExplorerExample = GenomeExplorerExample;
}

// Auto-run example if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    (async () => {
        const example = new GenomeExplorerExample();
        await example.runAllExamples();
        await example.destroy();
    })();
}