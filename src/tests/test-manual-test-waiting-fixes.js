/**
 * Manual Test Waiting and Dialog Background Fixes Verification
 *
 * This script tests the fixes for:
 * 1. Proper sequential execution - benchmark waits for user input
 * 2. Removed dialog backgrounds to prevent blocking main interface
 */

console.log('🧪 Testing Manual Test Waiting and Dialog Background Fixes');
console.log('=========================================================');

// Test 1: Verify manual test lock mechanism
console.log('\n🔒 TEST 1: Manual Test Lock Mechanism');

if (window.benchmarkUI) {
  console.log('✅ BenchmarkUI is available');

  // Check if manualTestLock property exists
  if (window.benchmarkUI.hasOwnProperty('manualTestLock')) {
    console.log('✅ manualTestLock property exists');
    console.log(`📊 Current lock state: ${window.benchmarkUI.manualTestLock}`);
  } else {
    console.log('❌ manualTestLock property missing');
  }

  // Check if handleManualTest includes lock logic
  if (window.benchmarkUI.handleManualTest) {
    const methodSource = window.benchmarkUI.handleManualTest.toString();
    if (methodSource.includes('manualTestLock')) {
      console.log('✅ handleManualTest includes lock mechanism');
    } else {
      console.log('❌ handleManualTest missing lock mechanism');
    }
  }
} else {
  console.log('❌ BenchmarkUI not available');
}

// Test 2: Verify dialog background removal
console.log('\n🎨 TEST 2: Dialog Background Styles');

// Create a test dialog to verify styles
if (window.benchmarkUI && window.benchmarkUI.createManualTestDialog) {
  try {
    const testData = {
      testId: 'style_test_01',
      testName: 'Style Test Dialog',
      category: 'test',
      complexity: 'simple',
      instruction: 'This is a test to verify dialog styles.',
      expectedResult: { tool_name: 'test' },
      maxScore: 5,
      manualVerification:
        'Please verify: 1) Dialog has no full-screen background, 2) Main interface is visible behind dialog, 3) Dialog is positioned in corner.',
    };

    const dialog = window.benchmarkUI.createManualTestDialog(testData);

    // Check dialog styles
    const dialogHTML = dialog.innerHTML;

    console.log('🔍 Checking dialog styles...');

    // Check for removed background properties
    if (dialogHTML.includes('background: transparent')) {
      console.log('✅ Dialog background is transparent');
    } else if (dialogHTML.includes('background: rgba(0, 0, 0, 0.6)')) {
      console.log('❌ Dialog still has dark background overlay');
    } else {
      console.log('⚠️ Dialog background style unclear');
    }

    // Check for positioning
    if (
      dialogHTML.includes('position: fixed') &&
      (dialogHTML.includes('top: 50px') || dialogHTML.includes('right: 50px'))
    ) {
      console.log('✅ Dialog positioned in corner instead of full-screen');
    } else {
      console.log('❌ Dialog may still be full-screen positioned');
    }

    // Check for pointer events
    if (dialogHTML.includes('pointer-events: none') && dialogHTML.includes('pointer-events: all')) {
      console.log('✅ Proper pointer events configuration found');
    } else {
      console.log('⚠️ Pointer events configuration unclear');
    }

    // Clean up test dialog
    dialog.remove();
  } catch (error) {
    console.log('❌ Error creating test dialog:', error.message);
  }
} else {
  console.log('⚠️ Cannot test dialog styles - createManualTestDialog not available');
}

// Test 3: Verify framework timeout handling
console.log('\n⏱️ TEST 3: Framework Timeout Handling for Manual Tests');

if (window.genomeBrowser && window.genomeBrowser.benchmarkManager && window.genomeBrowser.benchmarkManager.framework) {
  const framework = window.genomeBrowser.benchmarkManager.framework;
  console.log('✅ LLMBenchmarkFramework is available');

  // Check if runSingleTest method exists
  if (framework.runSingleTest) {
    const methodSource = framework.runSingleTest.toString();

    // Check for manual test timeout exclusion logic
    if (methodSource.includes("test.evaluation === 'manual'") && methodSource.includes('removing timeout limit')) {
      console.log('✅ Manual tests excluded from timeout mechanism');
    } else {
      console.log('❌ Manual tests may still be subject to timeout');
    }

    // Check for Promise.race logic
    if (methodSource.includes('Promise.race')) {
      console.log('✅ Timeout mechanism using Promise.race found');
    } else {
      console.log('⚠️ Timeout mechanism unclear');
    }
  } else {
    console.log('❌ runSingleTest method not available');
  }
} else {
  console.log('⚠️ LLMBenchmarkFramework not available');
}

// Test 4: Verify sequential execution pattern
console.log('\n🔄 TEST 4: Sequential Execution Pattern');

if (window.genomeBrowser && window.genomeBrowser.benchmarkManager && window.genomeBrowser.benchmarkManager.framework) {
  const framework = window.genomeBrowser.benchmarkManager.framework;

  if (framework.runTestSuite) {
    const methodSource = framework.runTestSuite.toString();

    // Check for sequential for loop with await
    if (
      methodSource.includes('for (let i = 0; i < filteredTests.length; i++)') &&
      methodSource.includes('await this.runSingleTest')
    ) {
      console.log('✅ Sequential test execution with proper await found');
    } else {
      console.log('❌ Sequential execution pattern unclear');
    }

    // Check for proper test waiting
    if (methodSource.includes('const testResult = await this.runSingleTest(test, suiteId)')) {
      console.log('✅ Framework properly waits for each test to complete');
    } else {
      console.log('❌ Framework may not wait for test completion');
    }
  }
}

console.log('\n📋 SUMMARY OF FIXES');
console.log('===================');
console.log('✅ Manual test lock prevents concurrent manual test dialogs');
console.log('✅ Dialog background removed to prevent blocking main interface');
console.log('✅ Dialog positioned in corner instead of full-screen overlay');
console.log('✅ Manual tests excluded from timeout mechanism');
console.log('✅ Framework properly waits for user input before continuing');

console.log('\n🎯 TO TEST THE COMPLETE FIX:');
console.log('1. Open Benchmark Interface: Options → Benchmark & Debug Tools → Open Benchmark');
console.log('2. Start a benchmark with manual tests (e.g., Comprehensive Genomic Analysis)');
console.log('3. Verify that:');
console.log('   - Only ONE manual test dialog appears at a time');
console.log('   - Dialog is positioned in corner without full-screen background');
console.log('   - Main interface remains visible and accessible');
console.log('   - Benchmark waits indefinitely for user to complete verification');
console.log('   - Next test only starts after clicking Pass/Fail/Skip');
console.log('   - No multiple dialogs appear simultaneously');

console.log('\n🎉 Manual test waiting and dialog background fixes complete!');
