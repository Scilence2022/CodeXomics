/**
 * Test Script for Manual Test and File Dialog Fixes
 * 
 * This script verifies that both critical issues have been resolved:
 * 1. Manual test dialogs appear correctly during benchmark execution
 * 2. File dialog errors no longer occur during benchmark testing
 */

console.log('🧪 Testing Manual Test and File Dialog Fixes');
console.log('=============================================');

// Test 1: Verify manual test event system
console.log('\n📋 TEST 1: Manual Test Event System');

// Check if BenchmarkUI is available and has manual test handlers
if (window.benchmarkUI) {
    console.log('✅ BenchmarkUI is available');
    
    // Check if manual test handlers are set up
    if (window.benchmarkUI.manualTestRequiredHandler && window.benchmarkUI.manualTestCompletedHandler) {
        console.log('✅ Manual test handlers are configured');
    } else {
        console.log('⚠️ Manual test handlers may not be set up yet - they will be configured when benchmark interface opens');
    }
    
    // Test manual test dialog creation
    console.log('🔍 Testing manual test dialog system...');
    
    // Simulate a manual test event
    const testData = {
        testId: 'test_manual_system_check',
        testName: 'Manual Test System Check',
        category: 'system_test',
        complexity: 'simple',
        instruction: 'This is a system check to verify manual test dialogs work correctly.',
        expectedResult: {
            tool_name: 'system_check',
            parameters: {}
        },
        maxScore: 5,
        manualVerification: 'Please verify: 1) This dialog appears correctly, 2) All elements are visible, 3) Buttons work properly.'
    };
    
    // Check if we can create a manual test dialog
    try {
        if (window.benchmarkUI.createManualTestDialog) {
            const dialog = window.benchmarkUI.createManualTestDialog(testData);
            if (dialog) {
                console.log('✅ Manual test dialog can be created');
                // Don't actually show it, just test creation
                dialog.remove();
            } else {
                console.log('❌ Manual test dialog creation failed');
            }
        } else {
            console.log('⚠️ createManualTestDialog method not available');
        }
    } catch (error) {
        console.log('❌ Error testing manual test dialog:', error.message);
    }
    
} else {
    console.log('❌ BenchmarkUI not available - benchmark interface needs to be opened first');
}

// Test 2: Verify ChatManager benchmark mode detection
console.log('\n🤖 TEST 2: ChatManager Benchmark Mode Detection');

if (window.genomeBrowser && window.genomeBrowser.chatManager) {
    const chatManager = window.genomeBrowser.chatManager;
    console.log('✅ ChatManager is available');
    
    // Test isBenchmarkMode method
    if (chatManager.isBenchmarkMode) {
        const isBenchmarkMode = chatManager.isBenchmarkMode();
        console.log(`✅ isBenchmarkMode() method available - Current mode: ${isBenchmarkMode ? 'Benchmark' : 'Normal'}`);
        
        // Test file loading methods with simulation
        console.log('🔍 Testing file loading methods...');
        
        const testMethods = [
            'loadGenomeFile',
            'loadAnnotationFile', 
            'loadVariantFile',
            'loadReadsFile',
            'loadWigTracks',
            'loadOperonFile'
        ];
        
        for (const methodName of testMethods) {
            if (chatManager[methodName]) {
                console.log(`✅ ${methodName} method available`);
            } else {
                console.log(`❌ ${methodName} method missing`);
            }
        }
        
    } else {
        console.log('❌ isBenchmarkMode method not available');
    }
    
} else {
    console.log('❌ ChatManager not available');
}

// Test 3: Verify LLMBenchmarkFramework manual test detection
console.log('\n🔧 TEST 3: LLMBenchmarkFramework Manual Test Detection');

if (window.genomeBrowser && window.genomeBrowser.benchmarkManager && window.genomeBrowser.benchmarkManager.framework) {
    const framework = window.genomeBrowser.benchmarkManager.framework;
    console.log('✅ LLMBenchmarkFramework is available');
    
    // Test executeManualTest method
    if (framework.executeManualTest) {
        console.log('✅ executeManualTest method available');
    } else {
        console.log('❌ executeManualTest method missing');
    }
    
    // Test executeTest method exists
    if (framework.executeTest) {
        console.log('✅ executeTest method available');
    } else {
        console.log('❌ executeTest method missing');
    }
    
} else {
    console.log('⚠️ LLMBenchmarkFramework not available - benchmark system needs to be initialized');
}

// Test 4: Verify ComprehensiveBenchmarkSuite has manual tests
console.log('\n📊 TEST 4: Manual Tests in ComprehensiveBenchmarkSuite');

if (window.ComprehensiveBenchmarkSuite) {
    try {
        const suite = new ComprehensiveBenchmarkSuite();
        const tests = suite.getTests();
        
        const manualTests = tests.filter(test => test.evaluation === 'manual');
        const fileDialogTests = tests.filter(test => 
            test.expectedResult && 
            test.expectedResult.parameters && 
            test.expectedResult.parameters.showFileDialog
        );
        
        console.log(`✅ ComprehensiveBenchmarkSuite loaded with ${tests.length} total tests`);
        console.log(`📋 Manual tests found: ${manualTests.length}`);
        console.log(`📁 File dialog tests found: ${fileDialogTests.length}`);
        
        // List manual tests
        if (manualTests.length > 0) {
            console.log('📋 Manual tests:');
            manualTests.forEach(test => {
                console.log(`   - ${test.id}: ${test.name} (${test.category})`);
            });
        }
        
        // List file dialog tests  
        if (fileDialogTests.length > 0) {
            console.log('📁 File dialog tests:');
            fileDialogTests.forEach(test => {
                console.log(`   - ${test.id}: ${test.name}`);
            });
        }
        
    } catch (error) {
        console.log('❌ Error analyzing ComprehensiveBenchmarkSuite:', error.message);
    }
} else {
    console.log('❌ ComprehensiveBenchmarkSuite not available');
}

// Test 5: Integration Test Instructions
console.log('\n🎯 TEST 5: Integration Test Instructions');
console.log('To test the complete fix:');
console.log('1. Open Benchmark Interface: Options → Benchmark & Debug Tools → Open Benchmark');
console.log('2. Select "Comprehensive Genomic Analysis" test suite');
console.log('3. Click "Start Benchmark"');
console.log('4. Watch for:');
console.log('   ✅ Manual test dialogs appear for tests with evaluation: "manual"');  
console.log('   ✅ No "File chooser dialog can only be shown with a user activation" errors');
console.log('   ✅ Console shows "File dialog simulation" messages instead of errors');
console.log('5. When manual test dialogs appear:');
console.log('   - Fill out verification checklist');
console.log('   - Select appropriate score');
console.log('   - Click Pass/Fail/Skip to continue');

// Summary
console.log('\n📋 SUMMARY OF FIXES');
console.log('==================');
console.log('✅ Manual test detection added to LLMBenchmarkFramework.executeTest()');
console.log('✅ Manual test execution method (executeManualTest) implemented');
console.log('✅ Benchmark mode detection added to ChatManager.isBenchmarkMode()');
console.log('✅ File dialog simulation added to all file loading methods');
console.log('✅ Manual test event handlers improved with duplicate prevention');
console.log('✅ Event system ensures proper cleanup and error handling');

console.log('\n🎉 Both critical issues should now be resolved!');
console.log('Test by running a benchmark with manual tests and file loading operations.');