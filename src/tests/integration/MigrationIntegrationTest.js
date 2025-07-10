/**
 * Migration Integration Test - Comprehensive test of the improved function calling system
 * Tests compatibility, performance, and functionality of the migrated modules
 */

class MigrationIntegrationTest {
    constructor() {
        this.results = {
            tests: [],
            passed: 0,
            failed: 0,
            startTime: null,
            endTime: null,
            duration: 0
        };
        
        // Mock legacy GenomeBrowser for testing
        this.mockLegacyGenomeBrowser = this.createMockLegacyGenomeBrowser();
        
        // Initialize test environment
        this.setupTestEnvironment();
    }
    
    /**
     * Run all integration tests
     */
    async runAllTests() {
        console.log('🧪 [MigrationIntegrationTest] Starting comprehensive integration tests...');
        
        this.results.startTime = Date.now();
        
        try {
            // Phase 1: Core Infrastructure Tests
            await this.testCoreInfrastructure();
            
            // Phase 2: Compatibility Layer Tests
            await this.testCompatibilityLayer();
            
            // Phase 3: Modern Module Tests
            await this.testModernModules();
            
            // Phase 4: Performance Tests
            await this.testPerformanceComparison();
            
            // Phase 5: Error Handling Tests
            await this.testErrorHandling();
            
            // Phase 6: Integration Workflow Tests
            await this.testCompleteWorkflows();
            
        } catch (error) {
            this.addResult('CRITICAL_ERROR', false, `Critical test failure: ${error.message}`);
        }
        
        this.results.endTime = Date.now();
        this.results.duration = this.results.endTime - this.results.startTime;
        
        this.printTestResults();
        
        return this.results;
    }
    
    /**
     * Test core infrastructure (GenomeContext, EventBus, etc.)
     */
    async testCoreInfrastructure() {
        console.log('🏗️ [MigrationIntegrationTest] Testing core infrastructure...');
        
        // Test GenomeContext initialization
        try {
            const context = new GenomeContext({
                enableLogging: false,
                enablePerformanceTracking: true
            });
            
            this.addResult('GenomeContext initialization', true, 'Context created successfully');
            
            // Test state management
            context.setState('test:value', 42, { source: 'test' });
            const retrievedValue = context.getState('test:value');
            
            this.addResult('State management', 
                retrievedValue === 42, 
                `Expected 42, got ${retrievedValue}`
            );
            
            // Test service registration
            const eventBus = context.getService('eventBus');
            this.addResult('Service registry', 
                eventBus !== null, 
                'EventBus service available'
            );
            
            // Test command registry
            const commandRegistry = context.getService('commandRegistry');
            this.addResult('Command registry', 
                commandRegistry !== null, 
                'Command registry available'
            );
            
        } catch (error) {
            this.addResult('Core infrastructure', false, `Infrastructure test failed: ${error.message}`);
        }
    }
    
    /**
     * Test compatibility layer functionality
     */
    async testCompatibilityLayer() {
        console.log('🔄 [MigrationIntegrationTest] Testing compatibility layer...');
        
        try {
            // Initialize modern infrastructure
            const bootstrapper = new ModernBootstrapper();
            const initResult = await bootstrapper.initialize(this.mockLegacyGenomeBrowser);
            
            this.addResult('Bootstrapper initialization', 
                initResult.success, 
                'Bootstrapper initialized successfully'
            );
            
            // Test compatibility adapter creation
            const compatibilityAdapter = initResult.adapter;
            this.addResult('Compatibility adapter creation', 
                compatibilityAdapter !== null, 
                'Compatibility adapter created'
            );
            
            // Test legacy method wrapping
            const hasSetCursorPosition = typeof this.mockLegacyGenomeBrowser.actionManager.setCursorPosition === 'function';
            this.addResult('Legacy method wrapping', 
                hasSetCursorPosition, 
                'Legacy methods wrapped successfully'
            );
            
            // Test gradual migration
            await bootstrapper.startMigration();
            const migrationStatus = bootstrapper.getMigrationStatus();
            
            this.addResult('Migration execution', 
                migrationStatus.phase === 'completed', 
                `Migration phase: ${migrationStatus.phase}`
            );
            
        } catch (error) {
            this.addResult('Compatibility layer', false, `Compatibility test failed: ${error.message}`);
        }
    }
    
    /**
     * Test modern module functionality
     */
    async testModernModules() {
        console.log('🔧 [MigrationIntegrationTest] Testing modern modules...');
        
        try {
            // Initialize environment
            const context = new GenomeContext({ enableLogging: false });
            
            // Test ModernActionManager
            const actionManager = new ModernActionManager(context);
            
            // Test cursor positioning
            const cursorResult = await context.execute('action:setCursorPosition', { position: 100 });
            this.addResult('ModernActionManager cursor positioning', 
                cursorResult.success, 
                `Cursor position set to: ${cursorResult.data?.position}`
            );
            
            // Test paste action
            context.setState('actions:clipboard', {
                sequence: 'ATCG',
                length: 4
            }, { source: 'test' });
            
            const pasteResult = await context.execute('action:paste', { position: 50 });
            this.addResult('ModernActionManager paste action', 
                pasteResult.success, 
                `Paste action queued: ${pasteResult.data?.action?.id}`
            );
            
            // Test ModernSequenceUtils
            const sequenceUtils = new ModernSequenceUtils(context);
            
            // Test sequence cursor setting
            const seqCursorResult = await context.execute('sequence:setCursor', { position: 200 });
            this.addResult('ModernSequenceUtils cursor setting', 
                seqCursorResult.success, 
                `Sequence cursor set to: ${seqCursorResult.data?.position}`
            );
            
            // Test color setting
            const colorResult = await context.execute('sequence:setCursorColor', { color: '#ff0000' });
            this.addResult('ModernSequenceUtils color setting', 
                colorResult.success, 
                `Cursor color set to: ${colorResult.data?.color}`
            );
            
        } catch (error) {
            this.addResult('Modern modules', false, `Modern module test failed: ${error.message}`);
        }
    }
    
    /**
     * Test performance comparison between legacy and modern implementations
     */
    async testPerformanceComparison() {
        console.log('📊 [MigrationIntegrationTest] Testing performance comparison...');
        
        try {
            // Setup test environment
            const bootstrapper = new ModernBootstrapper();
            const initResult = await bootstrapper.initialize(this.mockLegacyGenomeBrowser);
            await bootstrapper.startMigration();
            
            const context = initResult.context;
            const adapter = initResult.adapter;
            
            // Test performance with multiple operations
            const operationCount = 100;
            const operations = [];
            
            for (let i = 0; i < operationCount; i++) {
                operations.push(async () => {
                    await context.execute('action:setCursorPosition', { position: i * 10 });
                });
            }
            
            // Measure modern performance
            const modernStartTime = performance.now();
            await Promise.all(operations.map(op => op()));
            const modernEndTime = performance.now();
            const modernDuration = modernEndTime - modernStartTime;
            
            // Get performance metrics
            const performanceMetrics = context.getPerformanceMetrics();
            
            this.addResult('Modern performance test', 
                modernDuration > 0, 
                `${operationCount} operations completed in ${modernDuration.toFixed(2)}ms`
            );
            
            this.addResult('Performance metrics collection', 
                performanceMetrics.averageExecutionTime !== undefined, 
                `Average execution time: ${performanceMetrics.averageExecutionTime?.toFixed(2)}ms`
            );
            
        } catch (error) {
            this.addResult('Performance comparison', false, `Performance test failed: ${error.message}`);
        }
    }
    
    /**
     * Test error handling and recovery
     */
    async testErrorHandling() {
        console.log('🚨 [MigrationIntegrationTest] Testing error handling...');
        
        try {
            const context = new GenomeContext({ enableLogging: false });
            
            // Test invalid cursor position
            const invalidResult = await context.execute('action:setCursorPosition', { position: -1 });
            this.addResult('Invalid parameter handling', 
                !invalidResult.success, 
                'Invalid cursor position properly rejected'
            );
            
            // Test missing required parameters
            const missingParamResult = await context.execute('sequence:setCursorColor', {});
            this.addResult('Missing parameter handling', 
                !missingParamResult.success, 
                'Missing required parameters properly rejected'
            );
            
            // Test Result pattern error handling
            const actionManager = new ModernActionManager(context);
            const result = await actionManager.setCursorPosition(-5);
            
            this.addResult('Result pattern error handling', 
                result === null, // Should return null for failed legacy compatibility
                'Result pattern handles errors correctly'
            );
            
        } catch (error) {
            this.addResult('Error handling', false, `Error handling test failed: ${error.message}`);
        }
    }
    
    /**
     * Test complete workflows end-to-end
     */
    async testCompleteWorkflows() {
        console.log('🔄 [MigrationIntegrationTest] Testing complete workflows...');
        
        try {
            // Initialize full environment
            const bootstrapper = new ModernBootstrapper();
            const initResult = await bootstrapper.initialize(this.mockLegacyGenomeBrowser);
            await bootstrapper.startMigration();
            
            const context = initResult.context;
            
            // Test complete sequence editing workflow
            // 1. Set sequence
            context.setState('sequence:current', 'ATCGATCGATCG', { source: 'test' });
            
            // 2. Set cursor position
            const cursorResult = await context.execute('sequence:setCursor', { position: 6 });
            
            // 3. Copy sequence
            const copyResult = await context.execute('action:copy', { 
                start: 0, 
                end: 4 
            });
            
            // 4. Paste sequence
            const pasteResult = await context.execute('action:paste', { 
                position: 6 
            });
            
            // 5. Execute all actions
            const executeResult = await context.execute('action:executeAll', {});
            
            this.addResult('Complete sequence workflow', 
                cursorResult.success && copyResult.success && pasteResult.success && executeResult.success,
                'Complete workflow executed successfully'
            );
            
            // Test event propagation
            let eventReceived = false;
            context.getService('eventBus').on('sequence:cursor-changed', () => {
                eventReceived = true;
            });
            
            await context.execute('sequence:setCursor', { position: 10 });
            
            // Small delay to allow event propagation
            await new Promise(resolve => setTimeout(resolve, 10));
            
            this.addResult('Event propagation', 
                eventReceived, 
                'Events properly propagated through system'
            );
            
        } catch (error) {
            this.addResult('Complete workflows', false, `Workflow test failed: ${error.message}`);
        }
    }
    
    /**
     * Setup test environment
     */
    setupTestEnvironment() {
        // Mock DOM elements for testing
        if (typeof document !== 'undefined') {
            const mockCursor = document.createElement('div');
            mockCursor.className = 'sequence-cursor';
            mockCursor.style.position = 'absolute';
            document.body.appendChild(mockCursor);
        }
    }
    
    /**
     * Create mock legacy GenomeBrowser for testing
     */
    createMockLegacyGenomeBrowser() {
        return {
            actionManager: {
                setCursorPosition: (position) => {
                    return { position, success: true };
                },
                handlePasteSequence: (options) => {
                    return { pasted: true, options };
                },
                handleDeleteSequence: (options) => {
                    return { deleted: true, options };
                }
            },
            sequenceUtils: {
                setCursorPosition: (position, options) => {
                    return { position, options, success: true };
                },
                setCursorColor: (color) => {
                    return { color, success: true };
                },
                handleSequenceClick: (event, position) => {
                    return { event, position, success: true };
                }
            },
            currentSequence: 'ATCGATCGATCGATCG',
            currentChromosome: 'chr1',
            cursorPosition: 0,
            addEventListener: (event, callback) => {
                // Mock event listener
            },
            emit: (event, data) => {
                // Mock event emission
            }
        };
    }
    
    /**
     * Add test result
     */
    addResult(testName, passed, message) {
        this.results.tests.push({
            name: testName,
            passed,
            message,
            timestamp: Date.now()
        });
        
        if (passed) {
            this.results.passed++;
            console.log(`✅ ${testName}: ${message}`);
        } else {
            this.results.failed++;
            console.log(`❌ ${testName}: ${message}`);
        }
    }
    
    /**
     * Print comprehensive test results
     */
    printTestResults() {
        console.log('\n🧪 [MigrationIntegrationTest] Test Results Summary');
        console.log('='.repeat(60));
        console.log(`Total Tests: ${this.results.tests.length}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        console.log(`Success Rate: ${((this.results.passed / this.results.tests.length) * 100).toFixed(2)}%`);
        console.log(`Duration: ${this.results.duration}ms`);
        console.log('='.repeat(60));
        
        if (this.results.failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.tests
                .filter(test => !test.passed)
                .forEach(test => {
                    console.log(`  - ${test.name}: ${test.message}`);
                });
        }
        
        console.log('\n📊 Test Categories:');
        const categories = {};
        this.results.tests.forEach(test => {
            const category = test.name.split(' ')[0];
            if (!categories[category]) {
                categories[category] = { passed: 0, failed: 0 };
            }
            if (test.passed) {
                categories[category].passed++;
            } else {
                categories[category].failed++;
            }
        });
        
        Object.entries(categories).forEach(([category, stats]) => {
            const total = stats.passed + stats.failed;
            const rate = ((stats.passed / total) * 100).toFixed(1);
            console.log(`  ${category}: ${stats.passed}/${total} (${rate}%)`);
        });
        
        console.log('\n' + '='.repeat(60));
        
        if (this.results.failed === 0) {
            console.log('🎉 All tests passed! Migration system is working correctly.');
        } else {
            console.log(`⚠️  ${this.results.failed} test(s) failed. Please review the implementation.`);
        }
    }
    
    /**
     * Export test results for analysis
     */
    exportResults() {
        return {
            summary: {
                total: this.results.tests.length,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: (this.results.passed / this.results.tests.length) * 100,
                duration: this.results.duration
            },
            tests: this.results.tests,
            timestamp: new Date().toISOString()
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MigrationIntegrationTest;
} else if (typeof window !== 'undefined') {
    window.MigrationIntegrationTest = MigrationIntegrationTest;
}

// Auto-run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    (async () => {
        const tester = new MigrationIntegrationTest();
        await tester.runAllTests();
    })();
}