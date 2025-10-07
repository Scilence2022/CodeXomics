# Benchmark Working Directory Integration Guide

## 🎯 How Benchmarks Should Use the Working Directory Tool

### 1. **Critical Test Order - System Setup First**

Every benchmark suite should start with working directory setup as the **FIRST TEST** before any data loading:

```javascript
// ✅ CORRECT ORDER - System setup FIRST
{
    id: 'system_auto_01',
    name: 'Set Working Directory to Test Data',
    category: 'system_setup',
    complexity: 'simple',
    evaluation: 'automatic',
    instruction: `Set working directory to test data directory: ${testDataPath}`,
    expectedResult: {
        tool_name: 'set_working_directory',
        parameters: {
            directory_path: testDataPath
        }
    },
    priority: 'highest' // Executes BEFORE all other tests
},
// Then data loading tests...
{
    id: 'load_auto_01', 
    name: 'Load Genome File',
    // ... file loading after directory is set
}
```

### 2. **Benchmark Framework Integration**

#### AutomaticSimpleSuite Example
```javascript
constructor() {
    this.suiteName = 'Automatic Simple Tests (25)'; // Updated count
    this.description = 'Simple tests with automatic evaluation - Basic genomic analysis operations and system setup';
}

initializeTests() {
    return [
        // SYSTEM SETUP TASKS - FIRST (HIGHEST PRIORITY)
        {
            id: 'system_auto_01',
            name: 'Set Working Directory to Test Data',
            instruction: `Set working directory to test data directory: ${this.getDefaultDirectory()}`,
            expectedResult: {
                tool_name: 'set_working_directory',
                parameters: {
                    directory_path: this.getDefaultDirectory()
                }
            },
            maxScore: 10, // High score - critical for other tests
            evaluator: this.evaluateWorkingDirectoryCall.bind(this)
        },
        {
            id: 'system_auto_02', 
            name: 'Set Working Directory with Home Directory Flag',
            instruction: 'Set working directory to user home directory using the home directory flag.',
            expectedResult: {
                tool_name: 'set_working_directory',
                parameters: {
                    use_home_directory: true
                }
            }
        },
        // DATA LOADING TASKS - AFTER system setup
        {
            id: 'load_auto_01',
            name: 'Load Genome File Path',
            // ... continues with file loading
        }
    ];
}
```

### 3. **Test Data Directory Configuration**

Each benchmark should provide configuration for test data location:

```javascript
class YourBenchmarkSuite {
    constructor() {
        this.defaultDirectory = null; // Set by framework
    }
    
    setConfiguration(config) {
        if (config && config.defaultDirectory) {
            this.defaultDirectory = config.defaultDirectory;
            console.log(`📁 Default directory set to: ${this.defaultDirectory}`);
            // Regenerate tests with updated paths
            this.tests = this.initializeTests();
        }
    }
    
    getDefaultDirectory() {
        return this.defaultDirectory || '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/';
    }
    
    buildFilePath(filename) {
        const defaultDir = this.getDefaultDirectory();
        const normalizedDir = defaultDir.endsWith('/') ? defaultDir : defaultDir + '/';
        return normalizedDir + filename;
    }
}
```

### 4. **Evaluation Logic**

Comprehensive evaluator for working directory calls:

```javascript
async evaluateWorkingDirectoryCall(actualResult, expectedResult, testResult) {
    let score = 0;
    let bonusScore = 0;
    const feedback = [];
    
    // Check correct tool (60% of score)
    if (actualResult?.tool_name === expectedResult.tool_name) {
        score += Math.round(testResult.maxScore * 0.6);
        feedback.push(`✅ Correct tool: ${actualResult.tool_name}`);
        
        // Parameter validation (40% of score)
        const actualParams = actualResult.parameters;
        const expectedParams = expectedResult.parameters;
        
        if (expectedParams.directory_path && actualParams?.directory_path === expectedParams.directory_path) {
            score += Math.round(testResult.maxScore * 0.4);
            bonusScore += Math.round(testResult.bonusScore * 0.5);
            feedback.push(`✅ Correct directory path: ${actualParams.directory_path}`);
        }
        
        if (expectedParams.use_home_directory && actualParams?.use_home_directory === expectedParams.use_home_directory) {
            score += Math.round(testResult.maxScore * 0.4);
            bonusScore += Math.round(testResult.bonusScore * 0.5);
            feedback.push(`✅ Correct home directory flag: ${actualParams.use_home_directory}`);
        }
        
        // Bonus for advanced parameters
        if (actualParams?.create_if_missing !== undefined) {
            bonusScore += Math.round(testResult.bonusScore * 0.25);
            feedback.push(`🎯 Bonus: Included create_if_missing parameter`);
        }
    }
    
    return {
        ...testResult,
        score: Math.min(score + bonusScore, testResult.maxScore + testResult.bonusScore),
        feedback: feedback.join('\\n'),
        passed: score > 0
    };
}
```

### 5. **Consistent Behavior Across Modes**

#### Before (Problematic)
```
[ChatManager] Benchmark mode detected - simulating reads file dialog
❌ Different behavior in benchmark vs normal mode
❌ Tool detection recording inconsistent  
❌ File operations not actually executed
```

#### After (Fixed)
```javascript
// All modes now execute identical behavior:
async loadGenomeFile(parameters) {
    // Removed benchmark mode simulation
    // Always executes actual file loading
    console.log('📋 [ChatManager] TOOL EXECUTED: load_genome_file - File loaded', {
        tool_name: 'load_genome_file',
        parameters: parameters,
        benchmark_mode: this.isBenchmarkMode(), // For logging only
        timestamp: new Date().toISOString()
    });
}
```

### 6. **Tool Detection Recording Integration**

Every working directory test integrates with Song's tool detection analysis:

```javascript
// Records tool detection for analysis
this.recordToolDetection(
    testResult.testName, 
    expectedResult.tool_name, 
    actualResult?.tool_name, 
    actualResult, 
    expectedResult, 
    finalScore > 0
);

// Enables analysis commands:
// window.songBenchmarkDebug.detectedTools.filter(t => t.expectedTool === 'set_working_directory')
```

## 🚀 Usage Examples in Benchmarks

### Example 1: Test Data Setup
```javascript
{
    instruction: "Set working directory to /Users/song/test-data for genomic analysis",
    expectedResult: {
        tool_name: 'set_working_directory',
        parameters: {
            directory_path: '/Users/song/test-data'
        }
    }
}
```

### Example 2: Home Directory Reset
```javascript  
{
    instruction: "Reset working directory to user home directory",
    expectedResult: {
        tool_name: 'set_working_directory', 
        parameters: {
            use_home_directory: true
        }
    }
}
```

### Example 3: Project Directory with Creation
```javascript
{
    instruction: "Set working directory to /Users/song/new-project and create if missing",
    expectedResult: {
        tool_name: 'set_working_directory',
        parameters: {
            directory_path: '/Users/song/new-project',
            create_if_missing: true
        }
    }
}
```

## 🎯 Key Benefits for Benchmarks

1. **🔄 Consistent Behavior**: All modes (benchmark/normal) execute identically
2. **📁 Directory Management**: Tests can set up proper working directories  
3. **🧪 Test Isolation**: Each test suite can have its own directory context
4. **📊 Proper Logging**: Tool detection recording works consistently
5. **🔧 File Operations**: Relative paths work correctly after directory setup
6. **⚡ High Priority**: System setup executes before data loading

## ⚠️ Critical Requirements

1. **Test Order**: Working directory setup MUST be first test in suite
2. **Path Validation**: Always use absolute paths for cross-platform compatibility
3. **Error Handling**: Include fallback directories in case of permission issues
4. **Evaluation**: Use comprehensive evaluator that checks parameters correctly  
5. **Integration**: Record tool detection for Song's analysis system

This implementation ensures that benchmarks can properly set up their testing environment with consistent, reliable working directory management across all execution modes.