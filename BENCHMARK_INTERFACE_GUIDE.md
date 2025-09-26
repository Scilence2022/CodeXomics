# Comprehensive Benchmark Interface Guide

## How to Open the Testing Interface

The Genome AI Studio now includes a comprehensive benchmark testing interface for evaluating LLM instruction following capabilities. Here's how to access it:

### Method 1: Through Benchmark & Debug Tools (Recommended)
1. **Open the application** - Run `npm start` in the GenomeAIStudio directory
2. **Access Benchmark & Debug Tools** - Click the "Benchmark & Debug Tools" button in the top menu bar
3. **Launch Benchmark** - In the Benchmark & Debug Tools modal, click "Open Benchmark" under "LLM Benchmark Suite"
4. **Start Testing** - The benchmark interface will open in full-screen mode

### Method 2: Direct Access (Developer)
- Open browser console and run: `window.genomeBrowser.openBenchmarkInterface()`

## Interface Overview

The benchmark interface provides a comprehensive testing environment with the following sections:

### 🧪 Header Section
- **Title**: LLM Instruction Following Benchmark
- **Close Button**: Red X button in the top-right corner to exit the interface
- **Subtitle**: Description of the testing purpose

### ⚙️ Configuration Section
The configuration panel includes:

#### Test Suites Selection
Choose from 8 available test suites:
- ✂️ **Basic Operations** - Simple navigation and basic functions
- 📝 **Edit Operations** - File and data editing capabilities  
- 🔧 **Basic Functions** - Core function calling tests
- 📊 **Parameter Handling** - Parameter validation and processing
- ⚡ **Performance Tests** - Speed and efficiency measurements
- 🔬 **Complex Analysis** - Advanced genomic analysis tasks
- 🔌 **Plugin Integration** - External tool integration tests
- 🛡️ **Error Recovery** - Error handling and recovery tests

#### Options Panel
Configure benchmark behavior:
- 📊 **Generate Report** - Create detailed test reports
- 📈 **Include Charts** - Add visual charts to results
- 📋 **Include Raw Data** - Include detailed raw test data
- 🤖 **Include LLM Interaction Details** - Capture AI conversation logs
- 🛑 **Stop on Error** - Halt testing on first failure
- 📝 **Verbose Logging** - Enable detailed console logging

#### Settings Panel
- **Test Timeout**: 15 seconds to 5 minutes per test
- **Concurrency**: Sequential or parallel test execution (1-3 parallel tests)

## Manual Test Interaction System

### Automatic vs Manual Tests
The benchmark framework includes both:
- **Automatic Tests**: Evaluated by comparing tool calls and parameters
- **Manual Tests**: Require human verification and scoring

### Manual Test Dialog Features
When a manual test is encountered, an interactive dialog appears with:

#### Test Information
- **Test Name** and **Category** badges
- **Complexity Level** (Simple/Complex) indicator
- **Detailed Instructions** for the human tester

#### Expected Results Panel
- **Expected Tool Name** to be called
- **Expected Parameters** in JSON format
- Clear specifications for verification

#### Interactive Verification Checklist
- **Checkbox items** for step-by-step verification
- **Hover effects** and **completion tracking**
- **Color coding** for completed items

#### Manual Scoring System
- **Score Dropdown**: Full Score, Good, Partial, Minimal, or Failed
- **Point values** based on test complexity:
  - Simple tests: 5 points maximum
  - Complex tests: 10 points maximum

#### Test Actions
Three action buttons:
- **✅ Pass**: Mark test as successful
- **❌ Fail**: Mark test as failed  
- **⏭️ Skip**: Skip test (neutral result)

### Manual Test Categories
Manual tests are included in:
1. **Navigation Tasks** - UI navigation verification
2. **Analysis Tasks** - Result validation and accuracy
3. **Data Loading** - File loading and parsing verification
4. **Search Functions** - Search result validation
5. **External Database** - External service integration checks
6. **Workflow Tests** - Multi-step process verification

## Running Tests

### Starting a Benchmark
1. **Select Test Suites** - Check desired test categories
2. **Configure Options** - Set report and logging preferences
3. **Set Timeout** - Choose appropriate timeout for tests
4. **Click "Start Benchmark"** - Begin test execution

### During Test Execution
- **Progress Bar** shows completion percentage
- **Real-time Statistics** display current progress
- **Manual Test Dialogs** appear for interactive tests
- **Console Logging** provides detailed execution information

### Completing Manual Tests
1. **Read Instructions** carefully in the dialog
2. **Perform Required Actions** as specified
3. **Check Verification Items** in the checklist
4. **Select Appropriate Score** from dropdown
5. **Click Pass/Fail/Skip** to continue

## Results and Export

### Results Display
After completion, view:
- **Summary Statistics**: Overall success rates and timing
- **Detailed Results**: Per-test outcomes and scores
- **Performance Metrics**: Response times and efficiency

### Export Options
Multiple export formats available:
- **📊 Export Results**: JSON format with complete test data
- **🤖 Export LLM Interactions**: Detailed AI conversation logs
- **📈 Charts and Graphs**: Visual performance analytics

## Technical Architecture

### Framework Components
- **ComprehensiveBenchmarkSuite.js**: 22 test cases across 6 categories
- **BenchmarkUI.js**: Interactive user interface with manual test dialogs
- **LLMBenchmarkFramework.js**: Core testing engine
- **BenchmarkManager.js**: Coordination and management

### Test Classification System
Each test includes:
- **Category**: navigation, analysis, data_loading, search, external_database, workflow
- **Complexity**: simple (5 pts) or complex (10 pts)
- **Evaluation**: automatic or manual
- **Timeout**: Custom timeout per test type

### Event System
- **manualTestRequired**: Triggered when manual interaction needed
- **manualTestCompleted**: Fired when user completes manual test
- **Automatic Event Handling**: Seamless integration with test flow

## Troubleshooting

### Common Issues
1. **Interface Not Opening**: Check console for error messages
2. **Manual Tests Not Responding**: Verify window.benchmarkUI is available
3. **Timeout Errors**: Increase test timeout in settings
4. **Export Failures**: Check browser download settings

### Debug Information
Enable verbose logging to see:
- Test execution details
- LLM interaction logs  
- Performance metrics
- Error stack traces

## Best Practices

### Test Selection
- **Start with Basic Operations** for initial validation
- **Add Complex Analysis** for thorough evaluation
- **Include Manual Tests** for comprehensive coverage

### Manual Test Guidelines
1. **Read instructions completely** before proceeding
2. **Verify each checklist item** carefully
3. **Use appropriate scoring** based on actual results
4. **Document issues** in test notes if provided

### Performance Optimization
- **Use Sequential Mode** for accuracy
- **Enable Parallel Mode** for speed (with caution)
- **Set appropriate timeouts** based on test complexity
- **Monitor memory usage** during long test runs

## Support and Feedback

For issues or improvements:
1. Check browser console for detailed error logs
2. Verify all benchmark modules are loaded correctly
3. Report bugs with specific test cases and error messages
4. Suggest new test scenarios based on actual usage patterns

---

The comprehensive benchmark interface provides a robust testing environment for evaluating AI agent performance in genomic analysis tasks, with sophisticated manual test interaction capabilities and detailed reporting features. Access it through **Benchmark & Debug Tools** in the options menu for the best experience.