// Benchmark Interface Verification Script
// Run this in the browser console to verify the benchmark interface setup

console.log('🧪 Starting Benchmark Interface Verification...');

// Check if benchmark classes are available
const classChecks = [
    'BenchmarkUI',
    'BenchmarkManager', 
    'LLMBenchmarkFramework',
    'ComprehensiveBenchmarkSuite'
];

console.log('📦 Checking benchmark classes...');
classChecks.forEach(className => {
    if (window[className]) {
        console.log(`✅ ${className} - Available`);
    } else {
        console.log(`❌ ${className} - Missing`);
    }
});

// Check if benchmark manager is initialized
console.log('🔧 Checking benchmark manager...');
if (window.genomeBrowser && typeof window.genomeBrowser.initializeBenchmarkSystemOnDemand === 'function') {
    console.log('✅ initializeBenchmarkSystemOnDemand method - Available');
} else {
    console.log('❌ initializeBenchmarkSystemOnDemand method - Missing');
}

// Check if debug tools button exists
console.log('🔍 Checking benchmark & debug tools access...');
const debugBtn = document.getElementById('debugToolsBtn');
if (debugBtn) {
    console.log('✅ Benchmark & Debug Tools button - Available');
} else {
    console.log('❌ Benchmark & Debug Tools button - Missing');
}

// Test interface opening (dry run)
console.log('🧪 Testing benchmark interface opening...');
try {
    if (window.genomeBrowser && window.genomeBrowser.openBenchmarkInterface) {
        console.log('✅ openBenchmarkInterface method - Available');
        console.log('💡 You can open the interface by clicking Benchmark & Debug Tools → Open Benchmark');
    } else {
        console.log('❌ openBenchmarkInterface method - Missing');
    }
} catch (error) {
    console.log('⚠️ Error accessing openBenchmarkInterface:', error.message);
}

// Check comprehensive test suite
console.log('📋 Checking comprehensive test suite...');
if (window.ComprehensiveBenchmarkSuite) {
    try {
        const suite = new ComprehensiveBenchmarkSuite();
        const tests = suite.getTests();
        console.log(`✅ ComprehensiveBenchmarkSuite - ${tests.length} tests loaded`);
        
        // Count by category
        const categories = {};
        const evaluationTypes = {};
        const complexityTypes = {};
        
        tests.forEach(test => {
            categories[test.category] = (categories[test.category] || 0) + 1;
            evaluationTypes[test.evaluation] = (evaluationTypes[test.evaluation] || 0) + 1;
            complexityTypes[test.complexity] = (complexityTypes[test.complexity] || 0) + 1;
        });
        
        console.log('📊 Test Categories:', categories);
        console.log('🤖 Evaluation Types:', evaluationTypes);
        console.log('⚡ Complexity Types:', complexityTypes);
        
    } catch (error) {
        console.log('❌ Error initializing ComprehensiveBenchmarkSuite:', error.message);
    }
} else {
    console.log('❌ ComprehensiveBenchmarkSuite - Not available');
}

console.log('');
console.log('🎯 VERIFICATION SUMMARY:');
console.log('=========================');
console.log('To open the benchmark interface:');
console.log('1. Click the "Benchmark & Debug Tools" button in the top menu');
console.log('2. In the modal, click "Open Benchmark" under LLM Benchmark Suite');
console.log('3. The full-screen benchmark interface will open');
console.log('4. Configure your tests and click "Start Benchmark"');
console.log('5. Manual tests will show interactive dialogs for user verification');
console.log('');
console.log('✅ Verification complete!');