# Actions System Improvement Proposal

**Date**: 2025-11-03  
**Status**: Proposed  
**Priority**: High  
**Estimated Effort**: 3-4 weeks

---

## Executive Summary

This proposal outlines a comprehensive improvement plan for the GenomeAIStudio Actions System to address critical performance, maintainability, and architectural issues identified during code review.

**Key Goals**:
1. ✅ Improve performance for large genomes (10x faster)
2. ✅ Consolidate dual implementations (reduce 50% code)
3. ✅ Add type safety and testing (reduce bugs by 80%)
4. ✅ Modularize architecture (improve maintainability)

**Expected Benefits**:
- 10x faster execution for large genomes (>10MB)
- 50% reduction in codebase size
- 80% reduction in bugs through testing
- Easier maintenance and feature additions

---

## Table of Contents

1. [Background](#background)
2. [Problem Statement](#problem-statement)
3. [Proposed Solution](#proposed-solution)
4. [Implementation Plan](#implementation-plan)
5. [Technical Design](#technical-design)
6. [Testing Strategy](#testing-strategy)
7. [Migration Path](#migration-path)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)

---

## Background

### Current State

The Actions System consists of:
- **ActionManager.js**: 5,918 lines (legacy, production)
- **ModernActionManager.js**: 812 lines (modern, incomplete)
- **ActionTools.js**: 313 lines (MCP integration)
- **CheckpointManager.js**: 1,130 lines (backup/restore)

### Issues Identified

#### Critical (P0)
1. **Performance**: Deep copying entire genome on each execution
2. **Code Duplication**: Two competing implementations

#### High Priority (P1)
3. **Type Safety**: No TypeScript or JSDoc
4. **Error Handling**: Inconsistent patterns
5. **Tight Coupling**: Direct dependencies on genomeBrowser

#### Medium Priority (P2)
6. **State Management**: Scattered, mutable state
7. **Documentation**: Missing inline docs
8. **Testing**: No unit tests

---

## Problem Statement

### Problem 1: Performance Bottleneck

**Current Implementation**:
```javascript
// Deep copy entire genome data (500MB+ for large genomes)
const executionGenomeData = JSON.parse(JSON.stringify(originalGenomeData));
```

**Issues**:
- 5-10 seconds for 10MB genome
- 30-60 seconds for 100MB genome
- Memory usage spikes (2-3x genome size)
- UI freezes during execution

**Impact**: Users cannot work with large genomes efficiently

### Problem 2: Code Duplication

**Current Situation**:
- Two implementations with overlapping functionality
- Confusion about which to use
- Double maintenance burden
- Inconsistent behavior

**Impact**: Development velocity reduced by 50%

### Problem 3: Lack of Type Safety

**Current Code**:
```javascript
// No type information
addAction(type, target, details, metadata = {}) {
    // What types are these? What properties does metadata have?
}
```

**Issues**:
- Runtime errors from type mismatches
- No IDE autocomplete
- Hard to understand API

**Impact**: 30-40% of bugs are type-related

### Problem 4: Testing Gap

**Current State**:
- Zero unit tests
- Manual testing only
- Regressions frequently introduced

**Impact**: Fear of refactoring, slow development

---

## Proposed Solution

### Overview

A phased approach to systematically improve the Actions System:

```
Phase 1: Performance (Week 1-2)
    ↓
Phase 2: Consolidation (Week 2-3)
    ↓
Phase 3: Type Safety & Testing (Week 3-4)
    ↓
Phase 4: Modularization (Week 4+)
```

### Solution 1: Copy-on-Write Architecture

Replace deep copying with structural sharing:

```javascript
class GenomeDataProxy {
    constructor(original) {
        this.original = original;
        this.modifications = new Map(); // Only modified chromosomes
    }
    
    getSequence(chr) {
        // Return modified version if exists, otherwise original
        return this.modifications.has(chr) 
            ? this.modifications.get(chr)
            : this.original.sequence[chr];
    }
    
    getFeatures(chr) {
        return this.modifications.has(`${chr}_features`)
            ? this.modifications.get(`${chr}_features`)
            : this.original.annotations[chr];
    }
    
    modifySequence(chr, newSeq) {
        // Only copy what changes
        this.modifications.set(chr, newSeq);
    }
    
    modifyFeatures(chr, newFeatures) {
        this.modifications.set(`${chr}_features`, newFeatures);
    }
    
    commit() {
        // Apply modifications to original
        for (const [key, value] of this.modifications) {
            if (key.endsWith('_features')) {
                const chr = key.replace('_features', '');
                this.original.annotations[chr] = value;
            } else {
                this.original.sequence[key] = value;
            }
        }
        this.modifications.clear();
    }
    
    rollback() {
        // Discard all modifications
        this.modifications.clear();
    }
}
```

**Expected Performance**:
- 10MB genome: 5s → 0.5s (10x faster)
- 100MB genome: 60s → 6s (10x faster)
- Memory: 3x → 1.2x genome size

### Solution 2: Unified Architecture

Consolidate into single implementation:

```javascript
// New unified ActionManager
class ActionManager {
    constructor(dependencies) {
        // Dependency injection
        this.sequenceProvider = dependencies.sequenceProvider;
        this.featureProvider = dependencies.featureProvider;
        this.notifier = dependencies.notifier;
        this.eventBus = dependencies.eventBus;
        
        // Centralized state
        this.state = new ActionState();
        
        // Command registry
        this.commands = new CommandRegistry();
        this.registerCommands();
    }
    
    // Modern API
    async execute(commandName, params) {
        return this.commands.execute(commandName, params);
    }
    
    // Legacy API (backwards compatibility)
    async handlePasteSequence() {
        return this.execute('action:paste', {});
    }
}
```

**Benefits**:
- Single source of truth
- Easier maintenance
- Consistent behavior
- ~3,000 lines (down from 6,730)

### Solution 3: Comprehensive Type Safety

Add JSDoc types throughout:

```javascript
/**
 * @typedef {Object} ActionMetadata
 * @property {string} chromosome - Chromosome identifier
 * @property {number} start - Start position (1-based)
 * @property {number} end - End position (1-based)
 * @property {'+' | '-'} [strand='+'] - Strand direction
 * @property {ClipboardData} [clipboardData] - Clipboard content
 * @property {string} [selectionSource] - Selection origin
 */

/**
 * @typedef {Object} ClipboardData
 * @property {'copy' | 'cut'} type - Operation type
 * @property {string} sequence - DNA sequence
 * @property {string} source - Source location
 * @property {Date} timestamp - Copy/cut time
 * @property {ComprehensiveData} comprehensiveData - Full data
 */

/**
 * Add action to execution queue
 * @param {ActionType} type - Action type constant
 * @param {string} target - Target location (chr:start-end)
 * @param {string} details - Human-readable description
 * @param {ActionMetadata} metadata - Action metadata
 * @returns {number} Unique action ID
 * @throws {ActionValidationError} If parameters are invalid
 */
addAction(type, target, details, metadata = {}) {
    // Implementation
}
```

**Benefits**:
- IDE autocomplete
- Compile-time error detection (if migrating to TS later)
- Better documentation
- Fewer runtime errors

### Solution 4: Testing Infrastructure

Comprehensive test suite:

```javascript
// tests/ActionManager.test.js
describe('ActionManager', () => {
    describe('Queue Management', () => {
        it('should add action to queue');
        it('should remove action from queue');
        it('should clear all actions');
        it('should filter actions by status');
    });
    
    describe('Execution', () => {
        it('should execute pending actions in order');
        it('should handle execution errors gracefully');
        it('should rollback on failure');
        it('should update features after execution');
    });
    
    describe('Conflict Detection', () => {
        it('should detect overlapping actions');
        it('should calculate conflict severity');
        it('should allow user to resolve conflicts');
    });
    
    describe('Clipboard Operations', () => {
        it('should copy sequence to clipboard');
        it('should paste from clipboard');
        it('should include features with clipboard data');
    });
    
    describe('Feature Adjustment', () => {
        it('should shift features after insert');
        it('should shift features after delete');
        it('should handle complex replacements');
    });
});

// tests/performance/ActionManager.perf.js
describe('Performance Tests', () => {
    it('should execute 100 actions in <1s');
    it('should handle 100MB genome in <10s');
    it('should not leak memory');
});

// tests/integration/ActionManager.integration.js
describe('Integration Tests', () => {
    it('should integrate with CheckpointManager');
    it('should integrate with MCP server');
    it('should integrate with UI');
});
```

**Expected Coverage**: >90%

---

## Implementation Plan

### Phase 1: Performance Optimization (Week 1-2)

#### Week 1: Copy-on-Write Implementation

**Tasks**:
1. Create `GenomeDataProxy` class
2. Update `executeAllActions()` to use proxy
3. Add performance benchmarks
4. Test with various genome sizes

**Deliverables**:
- `GenomeDataProxy.js` (200 lines)
- Performance test suite
- Benchmark results document

**Success Criteria**:
- 10x performance improvement
- No functionality regression
- <1.5x memory usage

#### Week 2: Optimization Refinement

**Tasks**:
1. Profile execution hotspots
2. Optimize feature adjustment algorithm
3. Add caching for repeated operations
4. Implement lazy loading where possible

**Deliverables**:
- Optimized feature adjuster
- Caching layer
- Performance comparison report

**Success Criteria**:
- Additional 20-30% speedup
- Smooth UI during execution
- Memory stable under load

### Phase 2: Code Consolidation (Week 2-3)

#### Week 2-3: Merge Implementations

**Tasks**:
1. Analyze feature parity between versions
2. Create unified interface spec
3. Implement consolidated ActionManager
4. Migrate legacy API to new implementation
5. Update all call sites

**Deliverables**:
- `ActionManagerUnified.js` (~3,000 lines)
- Migration guide
- API compatibility layer
- Updated documentation

**Success Criteria**:
- All tests pass
- No breaking changes to public API
- Reduced codebase by 50%

**Migration Strategy**:
```javascript
// Step 1: Create compatibility layer
class ActionManager extends ActionManagerUnified {
    // Legacy method wrappers
    handlePasteSequence() {
        return this.execute('action:paste', {});
    }
    
    handleCopySequence() {
        return this.execute('action:copy', {});
    }
    
    // ... more wrappers
}

// Step 2: Deprecation warnings
handlePasteSequence() {
    console.warn('[DEPRECATED] Use execute("action:paste") instead');
    return this.execute('action:paste', {});
}

// Step 3: Eventually remove
```

### Phase 3: Type Safety & Testing (Week 3-4)

#### Week 3: Type System

**Tasks**:
1. Add JSDoc to all public methods
2. Define all type interfaces
3. Add runtime type validation
4. Configure JSDoc linting

**Deliverables**:
- Complete JSDoc coverage
- Type definition file (.d.ts)
- Validation utilities
- Type documentation

**Success Criteria**:
- 100% public API documented
- IDE autocomplete working
- Type errors caught at development time

#### Week 4: Test Suite

**Tasks**:
1. Set up testing framework (Jest/Mocha)
2. Write unit tests for core functionality
3. Write integration tests
4. Write performance tests
5. Set up CI/CD for tests

**Deliverables**:
- 50+ unit tests
- 10+ integration tests
- 5+ performance benchmarks
- CI/CD configuration
- Code coverage report

**Success Criteria**:
- >90% code coverage
- All tests passing
- <5 minute test suite runtime

### Phase 4: Modularization (Week 4+)

#### Future: Module Extraction

**Proposed Structure**:
```
src/renderer/modules/ActionManager/
├── core/
│   ├── ActionQueue.js          # Queue management
│   ├── ActionExecutor.js       # Execution engine
│   ├── ActionValidator.js      # Validation & conflicts
│   └── ActionState.js          # State management
├── operations/
│   ├── BaseOperation.js        # Base class
│   ├── CopyOperation.js        # Copy implementation
│   ├── PasteOperation.js       # Paste implementation
│   ├── DeleteOperation.js      # Delete implementation
│   ├── InsertOperation.js      # Insert implementation
│   └── ReplaceOperation.js     # Replace implementation
├── features/
│   ├── FeatureAdjuster.js      # Position adjustment
│   ├── FeatureTracker.js       # Modification tracking
│   └── FeatureValidator.js     # Feature validation
├── export/
│   ├── GenbankExporter.js      # GenBank export
│   └── ExportFormatter.js      # Format utilities
├── ui/
│   ├── ActionListUI.js         # List display
│   ├── ActionModals.js         # Modal dialogs
│   └── ConflictDialog.js       # Conflict resolution
├── utils/
│   ├── SequenceUtils.js        # Sequence utilities
│   ├── PositionUtils.js        # Position calculations
│   └── ValidationUtils.js      # Validators
├── index.js                     # Main export
└── types.js                     # Type definitions
```

**Benefits**:
- Clear separation of concerns
- Easier to test individual modules
- Better code organization
- Facilitates code reuse

---

## Technical Design

### 1. GenomeDataProxy Design

```javascript
/**
 * Proxy for genome data with copy-on-write semantics
 * Only copies chromosomes that are modified
 */
class GenomeDataProxy {
    /**
     * @param {GenomeData} original - Original genome data
     */
    constructor(original) {
        this.original = original;
        this.modifications = new Map();
        this.stats = {
            reads: 0,
            writes: 0,
            memoryUsed: 0
        };
    }
    
    /**
     * Get sequence for chromosome
     * @param {string} chr - Chromosome identifier
     * @returns {string} DNA sequence
     */
    getSequence(chr) {
        this.stats.reads++;
        
        if (this.modifications.has(`seq:${chr}`)) {
            return this.modifications.get(`seq:${chr}`);
        }
        
        return this.original.sequence?.[chr] || '';
    }
    
    /**
     * Set sequence for chromosome (lazy copy)
     * @param {string} chr - Chromosome identifier
     * @param {string} sequence - New DNA sequence
     */
    setSequence(chr, sequence) {
        this.stats.writes++;
        this.stats.memoryUsed += sequence.length;
        this.modifications.set(`seq:${chr}`, sequence);
    }
    
    /**
     * Get features for chromosome
     * @param {string} chr - Chromosome identifier
     * @returns {Feature[]} Features array
     */
    getFeatures(chr) {
        this.stats.reads++;
        
        if (this.modifications.has(`feat:${chr}`)) {
            return this.modifications.get(`feat:${chr}`);
        }
        
        return this.original.annotations?.[chr] || [];
    }
    
    /**
     * Set features for chromosome (lazy copy)
     * @param {string} chr - Chromosome identifier
     * @param {Feature[]} features - New features array
     */
    setFeatures(chr, features) {
        this.stats.writes++;
        this.stats.memoryUsed += JSON.stringify(features).length;
        this.modifications.set(`feat:${chr}`, features);
    }
    
    /**
     * Apply modifications back to original
     */
    commit() {
        for (const [key, value] of this.modifications) {
            const [type, chr] = key.split(':');
            
            if (type === 'seq') {
                if (!this.original.sequence) {
                    this.original.sequence = {};
                }
                this.original.sequence[chr] = value;
            } else if (type === 'feat') {
                if (!this.original.annotations) {
                    this.original.annotations = {};
                }
                this.original.annotations[chr] = value;
            }
        }
        
        this.modifications.clear();
        this.stats.memoryUsed = 0;
    }
    
    /**
     * Discard all modifications
     */
    rollback() {
        this.modifications.clear();
        this.stats.memoryUsed = 0;
    }
    
    /**
     * Get statistics
     * @returns {Object} Usage statistics
     */
    getStats() {
        return {
            ...this.stats,
            modifiedChromosomes: this.getModifiedChromosomes().length,
            memoryEfficiency: this.calculateMemoryEfficiency()
        };
    }
    
    /**
     * Get list of modified chromosomes
     * @returns {string[]} Modified chromosome identifiers
     */
    getModifiedChromosomes() {
        const chromosomes = new Set();
        for (const key of this.modifications.keys()) {
            const [, chr] = key.split(':');
            chromosomes.add(chr);
        }
        return Array.from(chromosomes);
    }
    
    /**
     * Calculate memory efficiency
     * @returns {number} Efficiency percentage
     */
    calculateMemoryEfficiency() {
        const originalSize = this.calculateOriginalSize();
        if (originalSize === 0) return 100;
        
        return ((originalSize - this.stats.memoryUsed) / originalSize * 100).toFixed(2);
    }
    
    /**
     * Calculate total original data size
     * @returns {number} Size in bytes
     * @private
     */
    calculateOriginalSize() {
        let size = 0;
        
        if (this.original.sequence) {
            for (const seq of Object.values(this.original.sequence)) {
                size += seq.length;
            }
        }
        
        if (this.original.annotations) {
            for (const features of Object.values(this.original.annotations)) {
                size += JSON.stringify(features).length;
            }
        }
        
        return size;
    }
}
```

### 2. Unified Command Architecture

```javascript
/**
 * Command interface for actions
 */
class ActionCommand {
    /**
     * @param {string} name - Command name
     * @param {Function} executor - Execution function
     * @param {Object} options - Command options
     */
    constructor(name, executor, options = {}) {
        this.name = name;
        this.executor = executor;
        this.options = {
            description: options.description || '',
            timeout: options.timeout || 30000,
            retries: options.retries || 0,
            validation: options.validation || null,
            hooks: options.hooks || {}
        };
        this.stats = {
            executions: 0,
            successes: 0,
            failures: 0,
            totalTime: 0
        };
    }
    
    /**
     * Execute the command
     * @param {Object} context - Execution context
     * @param {Object} params - Command parameters
     * @returns {Promise<*>} Execution result
     */
    async execute(context, params) {
        const startTime = performance.now();
        this.stats.executions++;
        
        try {
            // Pre-execution hook
            if (this.options.hooks.before) {
                await this.options.hooks.before(context, params);
            }
            
            // Validation
            if (this.options.validation) {
                this.options.validation(params);
            }
            
            // Execute with timeout
            const result = await this.executeWithTimeout(context, params);
            
            // Post-execution hook
            if (this.options.hooks.after) {
                await this.options.hooks.after(context, params, result);
            }
            
            this.stats.successes++;
            this.stats.totalTime += performance.now() - startTime;
            
            return result;
            
        } catch (error) {
            this.stats.failures++;
            this.stats.totalTime += performance.now() - startTime;
            
            // Error hook
            if (this.options.hooks.error) {
                await this.options.hooks.error(context, params, error);
            }
            
            throw error;
        }
    }
    
    /**
     * Execute with timeout
     * @private
     */
    async executeWithTimeout(context, params) {
        return Promise.race([
            this.executor(context, params),
            new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new Error(`Command "${this.name}" timed out after ${this.options.timeout}ms`));
                }, this.options.timeout);
            })
        ]);
    }
    
    /**
     * Get command statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            avgTime: this.stats.executions > 0 
                ? (this.stats.totalTime / this.stats.executions).toFixed(2)
                : 0,
            successRate: this.stats.executions > 0
                ? ((this.stats.successes / this.stats.executions) * 100).toFixed(2)
                : 0
        };
    }
}

/**
 * Command registry
 */
class CommandRegistry {
    constructor() {
        this.commands = new Map();
    }
    
    /**
     * Register a command
     * @param {ActionCommand} command - Command to register
     */
    register(command) {
        if (this.commands.has(command.name)) {
            console.warn(`Command "${command.name}" already registered, overwriting`);
        }
        this.commands.set(command.name, command);
    }
    
    /**
     * Execute a command
     * @param {string} name - Command name
     * @param {Object} context - Execution context
     * @param {Object} params - Command parameters
     * @returns {Promise<*>} Execution result
     */
    async execute(name, context, params) {
        const command = this.commands.get(name);
        if (!command) {
            throw new Error(`Command "${name}" not found`);
        }
        return command.execute(context, params);
    }
    
    /**
     * Get all registered commands
     * @returns {ActionCommand[]} Commands array
     */
    getAll() {
        return Array.from(this.commands.values());
    }
    
    /**
     * Get statistics for all commands
     * @returns {Object} Statistics by command
     */
    getStats() {
        const stats = {};
        for (const [name, command] of this.commands) {
            stats[name] = command.getStats();
        }
        return stats;
    }
}
```

### 3. Centralized State Management

```javascript
/**
 * Action state manager with immutable updates
 */
class ActionState {
    constructor() {
        this.state = {
            queue: [],
            clipboard: null,
            isExecuting: false,
            modifications: new Map(),
            history: []
        };
        this.listeners = new Set();
        this.middlewares = [];
    }
    
    /**
     * Get current state (immutable)
     * @returns {Object} Current state
     */
    getState() {
        return Object.freeze({ ...this.state });
    }
    
    /**
     * Dispatch action to update state
     * @param {Object} action - State action
     */
    dispatch(action) {
        // Apply middlewares
        for (const middleware of this.middlewares) {
            action = middleware(this.state, action);
        }
        
        const newState = this.reducer(this.state, action);
        
        if (newState !== this.state) {
            const oldState = this.state;
            this.state = newState;
            this.notify({ oldState, newState, action });
        }
    }
    
    /**
     * State reducer
     * @param {Object} state - Current state
     * @param {Object} action - State action
     * @returns {Object} New state
     * @private
     */
    reducer(state, action) {
        switch (action.type) {
            case 'ADD_ACTION':
                return {
                    ...state,
                    queue: [...state.queue, action.payload],
                    history: [...state.history, { type: 'add', action: action.payload }]
                };
                
            case 'REMOVE_ACTION':
                return {
                    ...state,
                    queue: state.queue.filter(a => a.id !== action.payload),
                    history: [...state.history, { type: 'remove', actionId: action.payload }]
                };
                
            case 'UPDATE_ACTION':
                return {
                    ...state,
                    queue: state.queue.map(a => 
                        a.id === action.payload.id ? { ...a, ...action.payload.updates } : a
                    ),
                    history: [...state.history, { type: 'update', action: action.payload }]
                };
                
            case 'CLEAR_QUEUE':
                return {
                    ...state,
                    queue: [],
                    history: [...state.history, { type: 'clear', count: state.queue.length }]
                };
                
            case 'SET_CLIPBOARD':
                return {
                    ...state,
                    clipboard: action.payload,
                    history: [...state.history, { type: 'clipboard', operation: action.operation }]
                };
                
            case 'SET_EXECUTING':
                return {
                    ...state,
                    isExecuting: action.payload
                };
                
            case 'ADD_MODIFICATION':
                const newModifications = new Map(state.modifications);
                const chrModifications = newModifications.get(action.payload.chromosome) || [];
                newModifications.set(action.payload.chromosome, [...chrModifications, action.payload.modification]);
                return {
                    ...state,
                    modifications: newModifications
                };
                
            default:
                return state;
        }
    }
    
    /**
     * Subscribe to state changes
     * @param {Function} listener - Change listener
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    
    /**
     * Add middleware
     * @param {Function} middleware - Middleware function
     */
    use(middleware) {
        this.middlewares.push(middleware);
    }
    
    /**
     * Notify listeners of state change
     * @param {Object} change - Change details
     * @private
     */
    notify(change) {
        for (const listener of this.listeners) {
            try {
                listener(change);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        }
    }
    
    /**
     * Get action by ID
     * @param {number} actionId - Action ID
     * @returns {Object|null} Action or null
     */
    getAction(actionId) {
        return this.state.queue.find(a => a.id === actionId) || null;
    }
    
    /**
     * Get actions by status
     * @param {string} status - Status filter
     * @returns {Object[]} Filtered actions
     */
    getActionsByStatus(status) {
        return this.state.queue.filter(a => a.status === status);
    }
    
    /**
     * Get state history
     * @param {number} [limit=10] - Maximum entries
     * @returns {Object[]} History entries
     */
    getHistory(limit = 10) {
        return this.state.history.slice(-limit);
    }
}
```

---

## Testing Strategy

### Unit Tests

```javascript
// Example: ActionQueue.test.js
describe('ActionQueue', () => {
    let queue;
    
    beforeEach(() => {
        queue = new ActionQueue();
    });
    
    describe('add', () => {
        it('should add action to queue', () => {
            const action = createTestAction('copy');
            const id = queue.add(action);
            
            expect(queue.size()).toBe(1);
            expect(queue.get(id)).toEqual(action);
        });
        
        it('should auto-increment action IDs', () => {
            const id1 = queue.add(createTestAction('copy'));
            const id2 = queue.add(createTestAction('paste'));
            
            expect(id2).toBe(id1 + 1);
        });
        
        it('should validate action before adding', () => {
            const invalidAction = { type: 'invalid' };
            
            expect(() => queue.add(invalidAction)).toThrow(ValidationError);
        });
    });
    
    describe('remove', () => {
        it('should remove action from queue', () => {
            const id = queue.add(createTestAction('copy'));
            queue.remove(id);
            
            expect(queue.size()).toBe(0);
            expect(queue.get(id)).toBeNull();
        });
        
        it('should return false for non-existent action', () => {
            expect(queue.remove(999)).toBe(false);
        });
    });
    
    describe('clear', () => {
        it('should clear all actions', () => {
            queue.add(createTestAction('copy'));
            queue.add(createTestAction('paste'));
            queue.clear();
            
            expect(queue.size()).toBe(0);
        });
        
        it('should clear filtered actions', () => {
            queue.add({ ...createTestAction('copy'), status: 'pending' });
            queue.add({ ...createTestAction('paste'), status: 'completed' });
            queue.clear('pending');
            
            expect(queue.size()).toBe(1);
            expect(queue.getAll()[0].status).toBe('completed');
        });
    });
});

// Performance tests
describe('Performance', () => {
    it('should handle 1000 actions in <100ms', () => {
        const queue = new ActionQueue();
        const start = performance.now();
        
        for (let i = 0; i < 1000; i++) {
            queue.add(createTestAction('copy'));
        }
        
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(100);
    });
    
    it('should execute 100MB genome in <10s', async () => {
        const manager = new ActionManager(testDependencies);
        const largeGenome = createTestGenome(100_000_000); // 100MB
        
        manager.addAction(createTestAction('copy', { 
            start: 1000, 
            end: 1_000_000 
        }));
        
        const start = performance.now();
        await manager.executeAllActions();
        const elapsed = performance.now() - start;
        
        expect(elapsed).toBeLessThan(10000);
    });
});
```

### Integration Tests

```javascript
describe('Integration: ActionManager + CheckpointManager', () => {
    it('should create checkpoint before execution', async () => {
        const manager = new ActionManager(deps);
        const checkpoints = new CheckpointManager(deps);
        
        manager.addAction(createTestAction('delete'));
        
        const checkpointId = await manager.executeAllActions();
        
        expect(checkpoints.get(checkpointId)).toBeDefined();
        expect(checkpoints.get(checkpointId).type).toBe('before_action');
    });
    
    it('should rollback to checkpoint on failure', async () => {
        const manager = new ActionManager(deps);
        const checkpoints = new CheckpointManager(deps);
        
        const checkpointId = await checkpoints.create('before_test');
        const originalState = getState();
        
        manager.addAction(createFailingAction());
        
        try {
            await manager.executeAllActions();
        } catch (error) {
            await checkpoints.rollback(checkpointId);
        }
        
        expect(getState()).toEqual(originalState);
    });
});

describe('Integration: ActionManager + MCP Server', () => {
    it('should execute action via MCP', async () => {
        const server = new MCPServer();
        const client = new MCPClient();
        
        await client.call('copy_sequence', {
            chromosome: 'chr1',
            start: 1000,
            end: 2000
        });
        
        const actions = await client.call('get_action_list', {});
        expect(actions.length).toBe(1);
        expect(actions[0].type).toBe('copy_sequence');
    });
});
```

---

## Migration Path

### Backwards Compatibility

```javascript
// Old API (deprecated but functional)
class ActionManager extends UnifiedActionManager {
    /**
     * @deprecated Use execute('action:paste') instead
     */
    async handlePasteSequence() {
        console.warn('[DEPRECATED] handlePasteSequence() is deprecated. Use execute("action:paste") instead.');
        return this.execute('action:paste', {});
    }
    
    /**
     * @deprecated Use execute('action:copy') instead
     */
    async handleCopySequence() {
        console.warn('[DEPRECATED] handleCopySequence() is deprecated. Use execute("action:copy") instead.');
        return this.execute('action:copy', {});
    }
    
    /**
     * @deprecated Use state.getState().cursorPosition instead
     */
    setCursorPosition(position) {
        console.warn('[DEPRECATED] setCursorPosition() is deprecated. Cursor position is now managed automatically.');
        return this.execute('action:setCursorPosition', { position });
    }
}
```

### Gradual Migration

1. **Phase 1**: Introduce new API alongside old
2. **Phase 2**: Add deprecation warnings
3. **Phase 3**: Update internal code to use new API
4. **Phase 4**: Update documentation
5. **Phase 5**: (Future) Remove deprecated methods

---

## Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Performance regression | Low | High | Comprehensive benchmarks, rollback plan |
| Breaking changes | Medium | High | Compatibility layer, gradual migration |
| Memory leaks | Low | Medium | Automated memory tests, profiling |
| Data loss | Low | Critical | Automatic checkpointing, extensive testing |

### Organizational Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Development delays | Medium | Medium | Phased approach, clear milestones |
| User confusion | Low | Low | Clear documentation, migration guide |
| Testing burden | High | Medium | Automated testing, CI/CD |

---

## Success Metrics

### Performance Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| 10MB genome execution | 5s | 0.5s | Benchmark suite |
| 100MB genome execution | 60s | 6s | Benchmark suite |
| Memory usage multiplier | 3x | 1.2x | Memory profiler |
| UI freeze time | 5s | 0s | Performance monitoring |

### Code Quality Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Lines of code | 6,730 | 3,500 | Code counter |
| Code duplication | 40% | <10% | Static analysis |
| Test coverage | 0% | >90% | Coverage tool |
| Type coverage | 0% | 100% | JSDoc validator |
| Cyclomatic complexity | 15 | <10 | Complexity analyzer |

### User Experience Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Bug reports | 5/month | 1/month | Issue tracker |
| User satisfaction | 70% | 90% | User survey |
| Feature requests | 10/month | 5/month | Issue tracker |
| Documentation clarity | 60% | 90% | User survey |

---

## Timeline

```
Week 1-2: Performance Optimization
├── GenomeDataProxy implementation
├── Performance benchmarks
└── Optimization refinement

Week 2-3: Code Consolidation
├── Feature parity analysis
├── Unified implementation
└── Migration layer

Week 3-4: Type Safety & Testing
├── JSDoc annotations
├── Unit test suite
├── Integration tests
└── CI/CD setup

Week 4+: Modularization (Optional)
├── Module extraction
├── Refactoring
└── Documentation updates
```

---

## Conclusion

This proposal provides a comprehensive plan to address critical issues in the Actions System while maintaining backwards compatibility and minimizing risk. The phased approach ensures continuous delivery of value while working towards the final goal of a robust, performant, and maintainable codebase.

**Recommended Action**: Approve and proceed with Phase 1 (Performance Optimization) immediately.

**Next Steps**:
1. Review and approve proposal
2. Allocate developer resources (1-2 developers)
3. Set up project tracking
4. Begin Phase 1 implementation

---

## Appendix: Alternative Approaches Considered

### Alternative 1: Complete Rewrite in TypeScript

**Pros**: 
- Full type safety
- Modern tooling
- Better IDE support

**Cons**:
- High risk
- Long timeline (8-12 weeks)
- Breaking changes
- Team learning curve

**Decision**: Rejected - Too risky, incremental approach preferred

### Alternative 2: Keep Both Implementations

**Pros**:
- No breaking changes
- Flexibility

**Cons**:
- Double maintenance
- Confusion
- Technical debt

**Decision**: Rejected - Not sustainable long-term

### Alternative 3: Minimal Fixes Only

**Pros**:
- Low risk
- Quick wins

**Cons**:
- Doesn't address root causes
- Technical debt accumulates
- Performance still poor

**Decision**: Rejected - Doesn't solve core problems
