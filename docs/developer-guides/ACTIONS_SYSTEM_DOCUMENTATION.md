# Actions System Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Action Types](#action-types)
5. [Workflow](#workflow)
6. [API Reference](#api-reference)
7. [Implementation Analysis](#implementation-analysis)
8. [Issues & Improvements](#issues--improvements)
9. [Best Practices](#best-practices)

---

## System Overview

The Actions System is a comprehensive sequence editing framework in GenomeAIStudio that provides **queue-based execution** of genomic sequence operations with features for:

- **Non-destructive editing**: Actions are queued before execution
- **Batch operations**: Multiple actions can be executed together
- **Feature tracking**: Automatic adjustment of genomic features after modifications
- **Clipboard support**: Copy/cut/paste operations with comprehensive data
- **MCP integration**: External tool access through Model Context Protocol
- **Conflict detection**: Identifies overlapping actions before execution

### Key Features
- ✅ Queue-based action management
- ✅ Clipboard system for sequence data
- ✅ Automatic feature position adjustment
- ✅ GenBank file generation with action history
- ✅ Multi-window support via MCP
- ✅ Comprehensive undo/rollback via CheckpointManager
- ✅ Conflict detection and resolution

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Actions System                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐        ┌──────────────────┐         │
│  │  ActionManager   │◄──────►│ CheckpointManager│         │
│  │  (Legacy)        │        │                  │         │
│  └────────┬─────────┘        └──────────────────┘         │
│           │                                                 │
│           │  Evolution                                      │
│           ▼                                                 │
│  ┌──────────────────┐        ┌──────────────────┐         │
│  │ModernActionMgr   │◄──────►│   ActionTools    │         │
│  │  (Command-based) │        │   (MCP Server)   │         │
│  └──────────────────┘        └──────────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────┐          │
│  │         Tool Registry (YAML)                │          │
│  │  • copy_sequence.yaml                       │          │
│  │  • paste_sequence.yaml                      │          │
│  │  • delete_sequence.yaml                     │          │
│  │  • insert_sequence.yaml                     │          │
│  │  • replace_sequence.yaml                    │          │
│  └─────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### File Structure

```
src/
├── renderer/modules/
│   ├── ActionManager.js              # Main implementation (5918 lines)
│   └── CheckpointManager.js          # State backup/restore (1130 lines)
├── mcp-tools/action/
│   └── ActionTools.js                # MCP server integration (313 lines)
└── temp/modern/
    └── ModernActionManager.js        # Modern command-based version (812 lines)

tools_registry/sequence_editing/
├── copy_sequence.yaml                # Copy action definition
├── cut_sequence.yaml                 # Cut action definition
├── paste_sequence.yaml               # Paste action definition
├── delete_sequence.yaml              # Delete action definition
├── insert_sequence.yaml              # Insert action definition
├── replace_sequence.yaml             # Replace action definition
├── execute_actions.yaml              # Execute queue definition
├── get_action_list.yaml              # List actions definition
├── clear_actions.yaml                # Clear queue definition
└── undo_last_action.yaml             # Undo definition
```

---

## Core Components

### 1. ActionManager (Legacy - Current Production)

**Location**: `src/renderer/modules/ActionManager.js`

**Responsibilities**:
- Queue management for sequence editing operations
- Clipboard operations (copy/cut/paste)
- Action execution with feature tracking
- GenBank file generation
- Conflict detection
- UI interaction

**Key Properties**:
```javascript
{
    actions: [],              // Action queue
    clipboard: null,          // Clipboard data
    cursorPosition: 0,        // DEPRECATED: Cursor position
    sequenceModifications: Map, // Track modifications per chromosome
    originalAnnotations: null,  // Backup for rollback
    isExecuting: false,       // Execution lock
    nextActionId: 1           // Auto-increment ID
}
```

**Action Types**:
```javascript
ACTION_TYPES = {
    COPY_SEQUENCE: 'copy_sequence',
    CUT_SEQUENCE: 'cut_sequence',
    PASTE_SEQUENCE: 'paste_sequence',
    DELETE_SEQUENCE: 'delete_sequence',
    INSERT_SEQUENCE: 'insert_sequence',
    REPLACE_SEQUENCE: 'replace_sequence',
    SEQUENCE_EDIT: 'sequence_edit'
}
```

**Status Types**:
```javascript
STATUS = {
    PENDING: 'pending',
    EXECUTING: 'executing',
    COMPLETED: 'completed',
    FAILED: 'failed'
}
```

### 2. ModernActionManager (Next Generation)

**Location**: `src/temp/modern/ModernActionManager.js`

**Key Improvements**:
- Command Pattern architecture
- Event-driven design with EventBus
- Reactive state management
- Better separation of concerns
- Cache management
- Validation hooks
- Performance metrics

**Command Registration**:
```javascript
Commands = {
    'action:setCursorPosition',  // Set cursor
    'action:paste',              // Paste sequence
    'action:delete',             // Delete sequence
    'action:copy',               // Copy sequence
    'action:executeAll'          // Execute queue
}
```

### 3. ActionTools (MCP Integration)

**Location**: `src/mcp-tools/action/ActionTools.js`

**Purpose**: Bridge between MCP server and client-side ActionManager

**Methods**:
- `copy_sequence()` - Copy to clipboard
- `cut_sequence()` - Cut to clipboard
- `paste_sequence()` - Paste from clipboard
- `delete_sequence()` - Delete region
- `insert_sequence()` - Insert sequence
- `replace_sequence()` - Replace region
- `get_action_list()` - List actions
- `execute_actions()` - Execute queue
- `clear_actions()` - Clear queue
- `get_clipboard_content()` - Get clipboard
- `undo_last_action()` - Undo action

### 4. CheckpointManager

**Location**: `src/renderer/modules/CheckpointManager.js`

**Purpose**: State backup and restoration for undo/rollback

**Checkpoint Types**:
```javascript
CHECKPOINT_TYPES = {
    MANUAL: 'manual',
    AUTO: 'auto',
    BEFORE_ACTION: 'before_action',
    MILESTONE: 'milestone'
}
```

---

## Action Types

### 1. COPY_SEQUENCE

**Description**: Copy a genomic region to clipboard for later use

**Parameters**:
```yaml
chromosome: string     # Chromosome identifier
start: number         # Start position (1-based)
end: number          # End position (1-based)
strand: string       # "+" or "-"
include_annotations: boolean  # Include features
```

**Behavior**:
- Extracts sequence from region
- Stores in clipboard with metadata
- Includes features if requested
- Calculates GC content
- Non-destructive operation

**Example**:
```javascript
actionManager.addAction(
    'copy_sequence',
    'chr1:1000-2000(+)',
    'Copy 1000 bp region',
    { chromosome: 'chr1', start: 1000, end: 2000, strand: '+' }
);
```

### 2. CUT_SEQUENCE

**Description**: Copy region and mark for deletion

**Parameters**: Same as COPY_SEQUENCE

**Behavior**:
- Copies sequence to clipboard
- Creates DELETE action automatically
- Two-phase operation (copy + delete)

### 3. PASTE_SEQUENCE

**Description**: Insert clipboard content at position

**Parameters**:
```yaml
chromosome: string
position: number     # Insert position
start: number       # Or replacement start
end: number        # Replacement end
```

**Behavior**:
- **Insert mode**: position specified
- **Replace mode**: start-end specified
- Adjusts downstream feature positions
- Updates sequence modifications map

### 4. DELETE_SEQUENCE

**Description**: Remove genomic region

**Parameters**:
```yaml
chromosome: string
start: number
end: number
strand: string
```

**Behavior**:
- Removes sequence from region
- Adjusts downstream features
- Tracks deleted features
- Updates modification history

### 5. INSERT_SEQUENCE

**Description**: Insert new sequence at position

**Parameters**:
```yaml
chromosome: string
position: number
sequence: string    # DNA sequence (ATGCN)
```

**Behavior**:
- Validates sequence (ATGCN only)
- Inserts at position
- Shifts downstream features
- Records in modification log

### 6. REPLACE_SEQUENCE

**Description**: Replace region with new sequence

**Parameters**:
```yaml
chromosome: string
start: number
end: number
sequence: string
strand: string
```

**Behavior**:
- Deletes original region
- Inserts new sequence
- May change region length
- Complex feature adjustments

---

## Workflow

### Action Lifecycle

```
┌─────────────┐
│   Create    │
│   Action    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Add to     │◄─── User Input / API Call
│   Queue     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validate   │
│  & Check    │
│  Conflicts  │
└──────┬──────┘
       │
       ├─── Conflicts? ──► User Decision
       │                       │
       ▼                       │
┌─────────────┐               │
│  Execute    │◄──────────────┘
│   Queue     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Update     │
│  Features   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Generate   │
│  GBK File   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Done      │
└─────────────┘
```

### Execution Process

1. **Pre-execution**:
   - Create genome data backup
   - Create execution copy
   - Detect conflicts
   - Show progress UI

2. **Execution Loop**:
   ```javascript
   for each pending action:
       - Execute on copy
       - Update features
       - Adjust remaining actions
       - Update progress
   ```

3. **Post-execution**:
   - Generate GBK file with history
   - Restore original state
   - Update UI
   - Clear queue

### Conflict Detection

**Conflict Types**:
- **Position Overlap**: Actions affect same region
- **High Severity**: Delete/Cut overlaps
- **Medium Severity**: Replace overlaps Insert/Paste
- **Low Severity**: Insert/Paste overlaps

**Resolution**:
- Manual review required
- User can proceed or cancel
- Actions highlighted in UI

---

## API Reference

### ActionManager Public Methods

#### Action Management

```javascript
// Create and add action
addAction(type, target, details, metadata) → actionId

// Create action without adding
createAction(type, target, details, metadata) → action

// Remove action from queue
removeAction(actionId) → boolean

// Clear all or filtered actions
clearAllActions(status = 'all') → void

// Get action by ID
getAction(actionId) → action
```

#### Execution

```javascript
// Execute all pending actions
executeAllActions() → Promise<result>

// Execute single action
executeSingleAction(actionId) → Promise<result>

// Check for conflicts
checkActionConflicts(pendingActions) → conflictAnalysis
```

#### Clipboard Operations

```javascript
// Handle copy
handleCopySequence() → Promise<void>

// Handle cut
handleCutSequence() → Promise<void>

// Handle paste
handlePasteSequence() → Promise<void>

// Handle delete
handleDeleteSequence() → Promise<void>

// Get clipboard content
getClipboardContent() → clipboardData
```

#### Selection & Position

```javascript
// Get active selection (prioritized)
getActiveSelection() → selectionInfo

// Set cursor position (DEPRECATED)
setCursorPosition(position) → void

// Get sequence for region
getSequenceForRegion(chr, start, end, strand) → Promise<sequence>
```

#### Feature Management

```javascript
// Collect comprehensive data
collectComprehensiveData(chr, start, end, strand) → Promise<data>

// Adjust feature positions
adjustFeaturePositions(chr, features) → features

// Update features after action
updateAllFeaturesAfterAction(action, genomeData) → Promise<void>
```

#### Export

```javascript
// Generate GBK file
generateComprehensiveGBK(actions, genomeData, execId) → Promise<void>

// Generate chromosome GBK
generateChromosomeGBKContentOriginal(chr, seq, features, actions, execId) → string
```

#### UI

```javascript
// Show action list
showActionList() → void

// Update action list UI
updateActionListUI() → void

// Show sequence selection modal
showSequenceSelectionModal(operation) → void
```

#### MCP Functions (AI/External Tool Integration)

```javascript
// Function execution
executeActionFunction(functionName, parameters) → Promise<result>

// Individual functions
functionCopySequence(params) → Promise<result>
functionCutSequence(params) → Promise<result>
functionPasteSequence(params) → Promise<result>
functionDeleteSequence(params) → Promise<result>
functionInsertSequence(params) → Promise<result>
functionReplaceSequence(params) → Promise<result>
functionGetActionList(params) → result
functionExecuteActions(params) → Promise<result>
functionClearActions(params) → result
functionUndoLastAction(params) → Promise<result>
functionGetClipboardContent(params) → result
functionOpenNewTab(params) → Promise<result>
functionSwitchToTab(params) → Promise<result>
```

### ModernActionManager Public Methods

```javascript
// Execute command
context.execute(commandName, params) → Promise<result>

// Available commands:
// - action:setCursorPosition
// - action:paste
// - action:delete
// - action:copy
// - action:executeAll

// Get status
getActionStatus() → status

// Get metrics
getMetrics() → metrics

// Cleanup
destroy() → void
```

---

## Implementation Analysis

### Strengths

#### 1. **Comprehensive Feature Tracking**
- ✅ Automatic feature position adjustment
- ✅ Deep copying to prevent reference issues
- ✅ Handles complex modifications (insert/delete/replace)

#### 2. **Robust Execution Model**
- ✅ Queue-based non-destructive editing
- ✅ Backup/restore mechanism
- ✅ Conflict detection
- ✅ Progress tracking

#### 3. **Rich Data Model**
- ✅ Comprehensive clipboard data (sequence + features + metadata)
- ✅ Detailed action history
- ✅ GenBank export with full provenance

#### 4. **MCP Integration**
- ✅ External tool access
- ✅ AI-friendly API
- ✅ Well-documented tool registry

#### 5. **Selection System**
- ✅ Prioritized selection sources (manual > gene > viewport)
- ✅ Multiple selection types supported
- ✅ Automatic detection

### Weaknesses & Issues

#### 1. **Code Duplication**
❌ **Problem**: Two implementations (ActionManager + ModernActionManager)
- Legacy `ActionManager.js`: 5918 lines
- Modern `ModernActionManager.js`: 812 lines
- Causes confusion about which to use
- Maintenance burden

**Impact**: Medium-High  
**Recommendation**: Choose one and deprecate the other

#### 2. **Deprecated Features**
❌ **Problem**: `cursorPosition` marked as deprecated but still used
```javascript
this.cursorPosition = 0; // DEPRECATED but still in use
setCursorPosition(position) // DEPRECATED but public API
```

**Impact**: Low-Medium  
**Recommendation**: Complete migration or formal removal

#### 3. **Large File Size**
❌ **Problem**: ActionManager.js is 5918 lines
- Hard to maintain
- Difficult to understand
- Many responsibilities mixed

**Impact**: Medium  
**Recommendation**: Split into modules:
- `ActionQueue.js`
- `ActionExecution.js`
- `ActionFeatures.js`
- `ActionExport.js`
- `ActionUI.js`

#### 4. **Inconsistent Error Handling**
❌ **Problem**: Mixed error handling strategies
```javascript
// Sometimes throws
throw new Error('...');

// Sometimes returns false
return false;

// Sometimes shows notification
this.showNotification('...', 'error');
```

**Impact**: Medium  
**Recommendation**: Standardize error handling pattern

#### 5. **Missing Type Safety**
❌ **Problem**: No TypeScript or JSDoc type annotations
- Hard to know parameter types
- Easy to make mistakes
- No IDE autocomplete support

**Impact**: Low-Medium  
**Recommendation**: Add comprehensive JSDoc comments

#### 6. **Tight Coupling**
❌ **Problem**: Direct dependencies on genomeBrowser
```javascript
this.genomeBrowser.showNotification(...)
this.genomeBrowser.currentSequence[...]
```

**Impact**: Medium  
**Recommendation**: Use dependency injection or event bus

#### 7. **State Management Issues**
❌ **Problem**: State scattered across multiple properties
- `this.actions`
- `this.clipboard`
- `this.cursorPosition`
- `this.sequenceModifications`
- `this.originalAnnotations`

**Impact**: Medium  
**Recommendation**: Centralize state in single object with immutable updates

#### 8. **Incomplete Modern Migration**
❌ **Problem**: ModernActionManager in `/temp/` folder
- Unclear production status
- Not fully integrated
- Missing features vs legacy

**Impact**: Low-Medium  
**Recommendation**: Complete migration or remove

#### 9. **Performance Concerns**
❌ **Problem**: Deep copying entire genome data
```javascript
const executionGenomeData = JSON.parse(JSON.stringify(originalGenomeData));
```
- Slow for large genomes
- High memory usage

**Impact**: Medium-High  
**Recommendation**: Use structural sharing or copy-on-write

#### 10. **Limited Testing**
❌ **Problem**: No visible unit tests
- Hard to refactor safely
- Bug-prone
- No regression detection

**Impact**: High  
**Recommendation**: Add comprehensive test suite

---

## Issues & Improvements

### Critical Issues (P0)

#### Issue 1: Performance - Deep Copying Large Genomes
**Problem**: Entire genome data copied on each execution
```javascript
const executionGenomeData = this.createGenomeDataCopy(originalGenomeData);
```

**Solution**:
```javascript
// Use structural sharing
class GenomeDataProxy {
    constructor(original) {
        this.original = original;
        this.modifications = new Map();
    }
    
    getSequence(chr) {
        return this.modifications.has(chr) 
            ? this.modifications.get(chr)
            : this.original.sequence[chr];
    }
    
    modifySequence(chr, newSeq) {
        this.modifications.set(chr, newSeq);
    }
}
```

#### Issue 2: Code Organization - Monolithic File
**Problem**: 5918 lines in single file

**Solution**: Split into modules
```
ActionManager/
├── core/
│   ├── ActionQueue.js       # Queue management
│   ├── ActionExecutor.js    # Execution logic
│   └── ActionValidator.js   # Validation & conflicts
├── operations/
│   ├── CopyOperation.js
│   ├── PasteOperation.js
│   └── DeleteOperation.js
├── features/
│   ├── FeatureAdjuster.js
│   └── FeatureTracker.js
├── export/
│   └── GenbankExporter.js
└── ui/
    ├── ActionListUI.js
    └── ActionModals.js
```

### High Priority Issues (P1)

#### Issue 3: Type Safety
**Problem**: No type annotations

**Solution**: Add comprehensive JSDoc
```javascript
/**
 * Add action to queue
 * @param {ActionType} type - Action type constant
 * @param {string} target - Target location (chr:start-end)
 * @param {string} details - Human-readable description
 * @param {ActionMetadata} metadata - Action metadata
 * @returns {number} Action ID
 */
addAction(type, target, details, metadata = {}) {
    // ...
}

/**
 * @typedef {Object} ActionMetadata
 * @property {string} chromosome - Chromosome identifier
 * @property {number} start - Start position (1-based)
 * @property {number} end - End position (1-based)
 * @property {string} [strand='+'] - Strand direction
 * @property {*} [clipboardData] - Clipboard content for paste
 */
```

#### Issue 4: Error Handling Consistency
**Problem**: Mixed error strategies

**Solution**: Standardize with error classes
```javascript
class ActionError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'ActionError';
        this.code = code;
        this.details = details;
    }
}

class ActionValidationError extends ActionError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
    }
}

// Usage
async executeAllActions() {
    try {
        // ...
    } catch (error) {
        if (error instanceof ActionValidationError) {
            this.showNotification(error.message, 'warning');
        } else if (error instanceof ActionError) {
            this.showNotification(error.message, 'error');
        } else {
            console.error('Unexpected error:', error);
            throw error;
        }
    }
}
```

#### Issue 5: Tight Coupling
**Problem**: Direct genomeBrowser dependencies

**Solution**: Dependency injection
```javascript
class ActionManager {
    constructor(dependencies) {
        this.notifier = dependencies.notifier;
        this.sequenceProvider = dependencies.sequenceProvider;
        this.featureProvider = dependencies.featureProvider;
        this.eventBus = dependencies.eventBus;
    }
    
    showNotification(message, type) {
        this.notifier.show(message, type);
    }
    
    getCurrentSequence(chr) {
        return this.sequenceProvider.getSequence(chr);
    }
}

// Usage
const actionManager = new ActionManager({
    notifier: genomeBrowser.notificationService,
    sequenceProvider: genomeBrowser.sequenceService,
    featureProvider: genomeBrowser.featureService,
    eventBus: genomeBrowser.eventBus
});
```

### Medium Priority Issues (P2)

#### Issue 6: State Management
**Problem**: Scattered state

**Solution**: Centralized state with reducer
```javascript
class ActionState {
    constructor() {
        this.state = {
            queue: [],
            clipboard: null,
            isExecuting: false,
            modifications: new Map(),
            originalAnnotations: null
        };
        this.listeners = new Set();
    }
    
    dispatch(action) {
        const newState = this.reducer(this.state, action);
        if (newState !== this.state) {
            this.state = newState;
            this.notify();
        }
    }
    
    reducer(state, action) {
        switch (action.type) {
            case 'ADD_ACTION':
                return {
                    ...state,
                    queue: [...state.queue, action.payload]
                };
            case 'SET_CLIPBOARD':
                return {
                    ...state,
                    clipboard: action.payload
                };
            // ... more cases
            default:
                return state;
        }
    }
    
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}
```

#### Issue 7: Missing Documentation
**Problem**: No inline documentation for complex methods

**Solution**: Add JSDoc for all public methods
```javascript
/**
 * Collect comprehensive genomic data for a region including sequence,
 * features, variants, and reads. Creates deep copies to prevent
 * reference issues during action execution.
 * 
 * @param {string} chromosome - Chromosome identifier
 * @param {number} start - Start position (1-based, inclusive)
 * @param {number} end - End position (1-based, inclusive)
 * @param {string} strand - Strand direction ('+' or '-')
 * @param {Object} [executionGenomeData=null] - Optional execution copy to use
 * @returns {Promise<ComprehensiveData>} Comprehensive region data
 * 
 * @typedef {Object} ComprehensiveData
 * @property {RegionInfo} region - Region metadata
 * @property {Feature[]} features - Overlapping features
 * @property {Variant[]} variants - Overlapping variants
 * @property {Read[]} reads - Overlapping reads
 * @property {Object} metadata - Calculated metadata (GC%, types, counts)
 * 
 * @example
 * const data = await collectComprehensiveData('chr1', 1000, 2000, '+');
 * console.log(`Found ${data.features.length} features`);
 */
async collectComprehensiveData(chromosome, start, end, strand, executionGenomeData = null) {
    // ...
}
```

#### Issue 8: Testing Infrastructure
**Problem**: No unit tests

**Solution**: Add comprehensive test suite
```javascript
// tests/ActionManager.test.js
describe('ActionManager', () => {
    let actionManager;
    let mockGenomeBrowser;
    
    beforeEach(() => {
        mockGenomeBrowser = createMockGenomeBrowser();
        actionManager = new ActionManager(mockGenomeBrowser);
    });
    
    describe('addAction', () => {
        it('should add action to queue', () => {
            const actionId = actionManager.addAction(
                'copy_sequence',
                'chr1:1000-2000(+)',
                'Test copy',
                { chromosome: 'chr1', start: 1000, end: 2000 }
            );
            
            expect(actionManager.actions).toHaveLength(1);
            expect(actionManager.actions[0].id).toBe(actionId);
        });
        
        it('should validate action parameters', () => {
            expect(() => {
                actionManager.addAction(
                    'copy_sequence',
                    'chr1:2000-1000(+)', // Invalid: start > end
                    'Invalid copy',
                    { chromosome: 'chr1', start: 2000, end: 1000 }
                );
            }).toThrow(ActionValidationError);
        });
    });
    
    describe('executeAllActions', () => {
        it('should execute pending actions in order', async () => {
            // ... test implementation
        });
        
        it('should detect conflicts', async () => {
            // ... test implementation
        });
        
        it('should rollback on error', async () => {
            // ... test implementation
        });
    });
});
```

### Low Priority Issues (P3)

#### Issue 9: UI/UX Improvements
**Suggestions**:
- Add keyboard shortcuts for common actions
- Drag-and-drop action reordering
- Action preview before execution
- Better conflict visualization
- Undo/redo with Ctrl+Z/Ctrl+Y

#### Issue 10: Advanced Features
**Suggestions**:
- Action templates (save common sequences)
- Batch action import from CSV/JSON
- Action scheduling (execute at specific time)
- Collaborative editing (multi-user)
- Cloud backup for actions

---

## Best Practices

### 1. Action Creation

```javascript
// ✅ GOOD: Use metadata for structured data
actionManager.addAction(
    actionManager.ACTION_TYPES.COPY_SEQUENCE,
    'chr1:1000-2000(+)',
    'Copy promoter region',
    {
        chromosome: 'chr1',
        start: 1000,
        end: 2000,
        strand: '+',
        feature: 'promoter',
        reason: 'analysis'
    }
);

// ❌ BAD: Unstructured details
actionManager.addAction(
    'copy',
    'somewhere',
    'copy some stuff',
    {}
);
```

### 2. Error Handling

```javascript
// ✅ GOOD: Try-catch with specific errors
try {
    await actionManager.executeAllActions();
} catch (error) {
    if (error instanceof ActionValidationError) {
        console.warn('Validation failed:', error.details);
        // Show user-friendly message
    } else {
        console.error('Unexpected error:', error);
        // Log to error tracking service
    }
}

// ❌ BAD: Silent failures
actionManager.executeAllActions().catch(() => {});
```

### 3. Feature Updates

```javascript
// ✅ GOOD: Use execution genome data copy
const executionGenomeData = this.createGenomeDataCopy(originalData);
await this.executeActionOnCopy(action, executionGenomeData);
await this.updateAllFeaturesAfterAction(action, executionGenomeData);

// ❌ BAD: Modify original data directly
this.genomeBrowser.currentAnnotations[chr] = modifiedFeatures;
```

### 4. State Management

```javascript
// ✅ GOOD: Immutable updates
this.actions = [...this.actions, newAction];

// ❌ BAD: Direct mutation
this.actions.push(newAction);
```

### 5. Clipboard Operations

```javascript
// ✅ GOOD: Include comprehensive data
this.clipboard = {
    type: 'copy',
    sequence: sequenceData,
    source: target,
    timestamp: new Date(),
    comprehensiveData: await this.collectComprehensiveData(...)
};

// ❌ BAD: Minimal clipboard data
this.clipboard = sequenceData;
```

### 6. UI Updates

```javascript
// ✅ GOOD: Batch UI updates
this.updateActionListUI();
this.updateStats();
this.notifyActionsTrackUpdate();

// ❌ BAD: Multiple redundant updates in loop
for (const action of actions) {
    this.updateUI(); // Called every iteration
}
```

---

## Migration Guide

### From Legacy to Modern ActionManager

If migrating to `ModernActionManager`:

#### 1. Update Initialization

```javascript
// OLD
const actionManager = new ActionManager(genomeBrowser);

// NEW
const context = new ApplicationContext();
const actionManager = new ModernActionManager(context);
```

#### 2. Update Method Calls

```javascript
// OLD
actionManager.handlePasteSequence();

// NEW
await context.execute('action:paste', { position: 1000 });
```

#### 3. Update Event Handling

```javascript
// OLD
actionManager.addEventListener('actionComplete', handler);

// NEW
context.getService('eventBus').on('action:queued', handler);
```

---

## Appendix

### A. Action Object Schema

```javascript
{
    id: number,              // Unique identifier
    type: string,            // ACTION_TYPES constant
    target: string,          // "chr:start-end(strand)"
    details: string,         // Human-readable description
    metadata: {              // Action-specific data
        chromosome: string,
        start: number,
        end: number,
        strand: string,
        ...                  // Type-specific fields
    },
    status: string,          // STATUS constant
    timestamp: Date,         // Creation time
    estimatedTime: number,   // Estimated execution time (ms)
    result: object | null,   // Execution result
    error: string | null,    // Error message if failed
    executionStart: Date,    // Execution start time
    executionEnd: Date,      // Execution end time
    actualTime: number       // Actual execution time (ms)
}
```

### B. Clipboard Data Schema

```javascript
{
    type: 'copy' | 'cut',           // Operation type
    sequence: string,                // DNA sequence
    source: string,                  // Source location
    timestamp: Date,                 // Copy/cut time
    sourceInfo: {                    // Source selection info
        chromosome: string,
        start: number,
        end: number,
        strand: string,
        source: string,              // 'manual' | 'gene' | 'selectedGene'
        name: string
    },
    comprehensiveData: {             // Full region data
        region: object,
        features: array,
        variants: array,
        reads: array,
        metadata: object
    }
}
```

### C. Conflict Analysis Schema

```javascript
{
    hasConflicts: boolean,
    conflicts: [
        {
            type: 'position_overlap',
            chromosome: string,
            action1: object,
            action2: object,
            overlapStart: number,
            overlapEnd: number,
            severity: 'high' | 'medium' | 'low',
            description: string
        }
    ],
    totalActions: number,
    affectedChromosomes: string[]
}
```

---

## Conclusion

The Actions System is a powerful and comprehensive framework for genomic sequence editing with strong features for:
- Non-destructive editing workflow
- Automatic feature tracking
- Conflict detection
- Export with provenance

**Major Strengths**: Rich feature set, robust execution model, MCP integration  
**Major Weaknesses**: Large codebase, dual implementations, performance concerns

**Recommended Priority**:
1. **P0**: Address performance issues (deep copying)
2. **P0**: Consolidate dual implementations
3. **P1**: Add type safety and documentation
4. **P1**: Implement testing infrastructure
5. **P2**: Refactor into modular architecture

With these improvements, the Actions System will be more maintainable, performant, and reliable for genomic sequence editing workflows.
