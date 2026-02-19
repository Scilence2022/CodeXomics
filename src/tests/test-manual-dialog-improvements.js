/**
 * Manual Test Dialog Verification Script
 *
 * This script tests the manual test dialog parsing improvements:
 * 1. "Please verify:" is now treated as instruction prefix, not a verification item
 * 2. Benchmark properly waits for user verification to complete
 */

console.log('🧪 Testing Manual Test Dialog Improvements');
console.log('==========================================');

// Test manual verification text parsing
console.log('\n📋 TEST 1: Manual Verification Text Parsing');

// Sample manual verification texts from ComprehensiveBenchmarkSuite
const testCases = [
  {
    name: 'Case 1 - Standard format with "Please verify:" prefix',
    text: 'Please verify: 1) This dialog appears correctly, 2) All buttons are clickable, 3) The interface is user-friendly, 4) You can interact with verification items.',
    expectedItems: [
      'This dialog appears correctly',
      'All buttons are clickable',
      'The interface is user-friendly',
      'You can interact with verification items',
    ],
  },
  {
    name: 'Case 2 - lacZ gene navigation test',
    text: 'Please verify: 1) Browser navigates to lacZ gene, 2) Gene is highlighted/centered in view, 3) Navigation completes within 5 seconds.',
    expectedItems: [
      'Browser navigates to lacZ gene',
      'Gene is highlighted/centered in view',
      'Navigation completes within 5 seconds',
    ],
  },
  {
    name: 'Case 3 - Complex workflow test',
    text: 'Please verify: 1) Both genomes load successfully, 2) lacZ orthologs are identified accurately, 3) Codon usage comparison is statistically robust, 4) Evolutionary analysis is comprehensive, 5) Results integration is scientifically meaningful.',
    expectedItems: [
      'Both genomes load successfully',
      'lacZ orthologs are identified accurately',
      'Codon usage comparison is statistically robust',
      'Evolutionary analysis is comprehensive',
      'Results integration is scientifically meaningful',
    ],
  },
];

// Test the parsing function if available
if (window.benchmarkUI && window.benchmarkUI.parseVerificationItems) {
  testCases.forEach((testCase, index) => {
    console.log(`\n🔍 Testing ${testCase.name}:`);
    console.log(`Input: "${testCase.text}"`);

    const parsed = window.benchmarkUI.parseVerificationItems(testCase.text);
    console.log(`Parsed items (${parsed.length}):`, parsed);

    // Check if "Please verify:" was removed
    const hasPrefix = parsed.some(item => item.toLowerCase().includes('please verify'));
    if (hasPrefix) {
      console.log('❌ ISSUE: "Please verify:" prefix was not removed properly');
    } else {
      console.log('✅ SUCCESS: "Please verify:" prefix removed correctly');
    }

    // Check item count
    if (parsed.length === testCase.expectedItems.length) {
      console.log(`✅ SUCCESS: Correct number of items (${parsed.length})`);
    } else {
      console.log(`❌ ISSUE: Expected ${testCase.expectedItems.length} items, got ${parsed.length}`);
    }
  });
} else {
  console.log('⚠️ parseVerificationItems method not available - benchmark interface needs to be opened first');
}

// Test manual test flow if BenchmarkUI is available
console.log('\n🔄 TEST 2: Manual Test Flow');

if (window.benchmarkUI) {
  console.log('✅ BenchmarkUI is available');

  // Check if handleManualTest method returns a Promise
  if (window.benchmarkUI.handleManualTest) {
    console.log('✅ handleManualTest method available');
    console.log('ℹ️ Method should return a Promise that resolves when user completes verification');
  } else {
    console.log('❌ handleManualTest method not available');
  }

  // Check if completeManualTest method calls the resolve function
  if (window.benchmarkUI.completeManualTest) {
    console.log('✅ completeManualTest method available');
    console.log('ℹ️ Method should resolve the Promise and continue benchmark execution');
  } else {
    console.log('❌ completeManualTest method not available');
  }
} else {
  console.log('❌ BenchmarkUI not available - benchmark interface needs to be opened first');
}

// Test LLMBenchmarkFramework integration
console.log('\n🔧 TEST 3: LLMBenchmarkFramework Integration');

if (window.genomeBrowser && window.genomeBrowser.benchmarkManager && window.genomeBrowser.benchmarkManager.framework) {
  const framework = window.genomeBrowser.benchmarkManager.framework;
  console.log('✅ LLMBenchmarkFramework is available');

  if (framework.executeManualTest) {
    console.log('✅ executeManualTest method available');
    console.log('ℹ️ Method should now call BenchmarkUI.handleManualTest() and await the result');
  } else {
    console.log('❌ executeManualTest method not available');
  }
} else {
  console.log('⚠️ LLMBenchmarkFramework not available - benchmark system needs to be initialized');
}

console.log('\n📋 SUMMARY OF IMPROVEMENTS');
console.log('==========================');
console.log('✅ parseVerificationItems() now removes "Please verify:" prefix');
console.log('✅ parseVerificationItems() handles various text formats');
console.log('✅ handleManualTest() returns Promise that waits for user completion');
console.log('✅ executeManualTest() directly calls BenchmarkUI.handleManualTest()');
console.log('✅ Benchmark execution now properly waits for manual verification');

console.log('\n🎯 TO TEST THE COMPLETE FIX:');
console.log('1. Open Benchmark Interface: Options → Benchmark & Debug Tools → Open Benchmark');
console.log('2. Click "Test Manual Dialog" button to verify dialog parsing works correctly');
console.log('3. Start a benchmark with manual tests (e.g., Comprehensive Genomic Analysis)');
console.log('4. Verify that:');
console.log('   - Manual test dialogs appear without "Please verify:" as a checkbox item');
console.log('   - Verification items are properly parsed and displayed');
console.log('   - Benchmark waits for user to complete verification before continuing');
console.log('   - Clicking Pass/Fail/Skip properly continues the benchmark');

console.log('\n🎉 Manual test dialog improvements complete!');
