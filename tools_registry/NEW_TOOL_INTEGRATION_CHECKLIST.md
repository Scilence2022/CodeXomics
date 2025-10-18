# New Tool Integration Checklist

## Overview

This checklist ensures that new tools are properly integrated into GenomeAIStudio and can be discovered and executed by the LLM system.

**⚠️ CRITICAL:** Missing any of these steps will cause tool execution failures, even if the YAML definition is correct!

## Complete Integration Checklist

### ✅ Step 1: YAML Tool Definition

**File:** `/tools_registry/{category}/{tool_name}.yaml`

**Requirements:**
- [ ] Complete tool specification with all required fields:
  - `name`: Tool name (snake_case)
  - `version`: Semantic version (e.g., "1.0.0")
  - `description`: Clear, concise description
  - `category`: Valid category (see `/tools_registry/tool_categories.yaml`)
  - `keywords`: Search keywords for tool discovery
  - `priority`: Priority level (1-5)
  - `parameters`: Complete parameter specification
  - `sample_usages`: At least 2-3 usage examples
  - `returns`: Return value documentation
  - `error_handling`: Error scenarios and solutions

- [ ] **YAML Syntax Validation:**
  - Quote all strings containing colons (`:`)
  - Use multi-line format for enums and arrays
  - No tab characters (spaces only)
  - Consistent 2-space indentation
  - Test parsing: `node tools_registry/test_yaml_parsing.js`

**Common Issues:**
```yaml
# ❌ INCORRECT - Unquoted string with colon
description: Type of features to analyze (default: CDS)

# ✅ CORRECT - Quoted or rephrased
description: "Type of features to analyze (default CDS)"
```

---

### ✅ Step 2: ChatManager Implementation

**File:** `/src/renderer/modules/ChatManager.js`

**Requirements:**

#### 2A. Tool Method Implementation ⭐ MOST IMPORTANT
```javascript
/**
 * Tool description
 */
async yourToolName(params) {
    const { param1, param2 } = params;
    
    // Implementation
    
    return {
        success: true,
        // ... results
    };
}
```

#### 2B. executeToolByName() Switch Case ⭐⭐ CRITICAL - MOST COMMONLY FORGOTTEN!
**Location:** ~line 9300-10100

```javascript
case 'your_tool_name':
    console.log('🔧 [ChatManager] Executing your_tool_name via executeToolByName');
    result = await this.yourToolName(parameters);
    break;
```

**How to Find the Right Location:**
1. Search for `async executeToolByName(toolName, parameters)`
2. Find the main `switch (toolName)` statement
3. Add your case alphabetically or by category
4. **DO NOT** add it only to response formatting sections!

#### 2C. Response Formatting (Optional but Recommended)
**Location:** `formatToolResultForDisplay()` method ~line 7300-7500

```javascript
case 'your_tool_name':
    if (result.result) {
        return `Formatted response for ${result.result.data}`;
    }
    return "Tool completed successfully.";
```

**Verification:**
```bash
# Search for your tool in all switch statements
grep -n "case 'your_tool_name':" src/renderer/modules/ChatManager.js
# Should find at least 2 locations (executeToolByName + formatToolResultForDisplay)
```

---

### ✅ Step 3: FunctionCallsOrganizer Registration

**File:** `/src/renderer/modules/FunctionCallsOrganizer.js`

**Location:** `functionCategories` object, find appropriate category

**Example:**
```javascript
dataManipulation: {
    priority: 3,
    description: "Data creation, editing, and export operations",
    functions: [
        'create_annotation',
        'export_data',
        'your_tool_name'  // ADD HERE
    ]
},
```

**Available Categories:**
- `browserActions` (priority 1)
- `dataRetrieval` (priority 2)
- `sequenceAnalysis` (priority 3)
- `advancedAnalysis` (priority 4)
- `blastSearch` (priority 5)
- `dataManipulation` (priority 3)
- `proteinStructure` (priority 5)
- `databaseIntegration` (priority 3)
- `dataExport` (priority 3)

---

### ✅ Step 4: Built-in Tools Integration

**File:** `/tools_registry/builtin_tools_integration.js`

**Location:** `initializeBuiltInToolsMapping()` method

**Example:**
```javascript
this.builtInToolsMap.set('your_tool_name', {
    method: 'yourToolName',      // ChatManager method name (camelCase)
    category: 'data_management', // Tool category
    type: 'built-in',
    priority: 2
});
```

**Verification:**
```javascript
// Check if tool is registered
const integration = new BuiltInToolsIntegration();
console.log(integration.isBuiltInTool('your_tool_name')); // Should be true
```

---

### ✅ Step 5: Testing & Verification

#### 5A. YAML Parsing Test
```bash
cd tools_registry
node test_yaml_parsing.js
```

**Expected Output:**
```
✅ YAML parsed successfully!
Tool details:
  Name: your_tool_name
  Category: data_management
```

#### 5B. Integration Verification
```bash
cd tools_registry
node verify_codon_analysis_enhancement.js
```

**Expected Output:**
```
Total Tests: 19
✅ Passed: 19
Success Rate: 100.00%
```

#### 5C. Manual Browser Testing

1. **Start the application:**
   ```bash
   npm start
   ```

2. **Open Developer Console** (Cmd+Option+I / Ctrl+Shift+I)

3. **Test tool loading:**
   - Check console for: `🔍 [Dynamic Tools] Category {category} has X tools`
   - Your tool should be counted
   - No "Failed to load tool" errors

4. **Test tool execution:**
   - Send query to LLM that should trigger your tool
   - Monitor console for:
     ```
     🔧 [ChatManager] Executing your_tool_name via executeToolByName
     ```
   - **If you see "Unknown tool: your_tool_name"**, you forgot Step 2B!

5. **Test tool response:**
   - Verify results are displayed correctly in chat
   - Check for formatting issues

---

## Common Errors & Solutions

### Error: "Unknown tool: your_tool_name"

**Cause:** Tool not registered in [executeToolByName()](file:///Users/song/Github-Repos/GenomeAIStudio/src/renderer/modules/ChatManager.js#L9297-L10127) switch statement

**Solution:**
1. Open `src/renderer/modules/ChatManager.js`
2. Find `async executeToolByName(toolName, parameters)`
3. Find the main `switch (toolName)` block
4. Add:
   ```javascript
   case 'your_tool_name':
       result = await this.yourToolName(parameters);
       break;
   ```

### Error: "YAMLException: bad indentation"

**Cause:** YAML syntax error (usually unquoted strings with colons)

**Solution:**
- Quote all description strings containing colons
- Use `|` for multi-line strings
- Verify with: `node tools_registry/test_yaml_parsing.js`

### Error: Tool not showing in LLM prompt

**Cause:** Not registered in `builtin_tools_integration.js`

**Solution:**
- Add to `builtInToolsMap` in `builtin_tools_integration.js`
- Verify category and priority are correct

### Error: Tool not executing via SmartExecutor

**Cause:** Not registered in `FunctionCallsOrganizer`

**Solution:**
- Add tool name to appropriate category in `FunctionCallsOrganizer.js`
- Tool must be in at least one category to be discoverable

---

## Quick Reference: Files to Modify

For a new tool called `analyze_protein_function`:

1. **Create:**
   - `/tools_registry/protein/analyze_protein_function.yaml`

2. **Modify:**
   - `/src/renderer/modules/ChatManager.js` (3 locations!)
     - Add method: `async analyzeProteinFunction(params)`
     - Add switch case in `executeToolByName()`
     - Add formatting in `formatToolResultForDisplay()`
   
   - `/src/renderer/modules/FunctionCallsOrganizer.js`
     - Add `'analyze_protein_function'` to category
   
   - `/tools_registry/builtin_tools_integration.js`
     - Add `builtInToolsMap.set('analyze_protein_function', ...)`

3. **Test:**
   - `node tools_registry/test_yaml_parsing.js`
   - `node tools_registry/verify_codon_analysis_enhancement.js`
   - Manual browser testing

---

## Automated Verification Script

Create this test for your new tool:

```javascript
// test_new_tool.js
const ChatManager = require('./src/renderer/modules/ChatManager.js');
const FunctionCallsOrganizer = require('./src/renderer/modules/FunctionCallsOrganizer.js');

// Test 1: Method exists
const chatManager = new ChatManager();
console.assert(
    typeof chatManager.yourToolName === 'function',
    '❌ Tool method not found in ChatManager'
);

// Test 2: Registered in organizer
const organizer = new FunctionCallsOrganizer(chatManager);
const category = organizer.getFunctionCategory('your_tool_name');
console.assert(
    category !== null,
    '❌ Tool not registered in FunctionCallsOrganizer'
);

console.log('✅ All tool integration checks passed!');
```

---

## Post-Integration Checklist

After implementing a new tool, verify:

- [ ] YAML file parses without errors
- [ ] Tool method implemented in ChatManager
- [ ] Switch case added to executeToolByName()
- [ ] Registered in FunctionCallsOrganizer
- [ ] Registered in builtin_tools_integration.js
- [ ] Response formatting implemented
- [ ] Manual browser test passes
- [ ] No console errors when loading
- [ ] Tool executes successfully
- [ ] Results display correctly

---

## Getting Help

If tool integration fails:

1. **Check console errors** in browser DevTools
2. **Search for tool name** in all files:
   ```bash
   grep -r "your_tool_name" src/renderer/modules/
   grep -r "your_tool_name" tools_registry/
   ```
3. **Compare with working tool** (e.g., `codon_usage_analysis`)
4. **Run verification scripts** to identify missing components

---

**Last Updated:** 2025-10-18  
**Maintained By:** GenomeAIStudio Development Team
