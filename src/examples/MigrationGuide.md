# Migration Guide: Improved Function Calling System

## Overview

This guide demonstrates how to migrate the existing GenomeExplorer codebase to use the improved function calling patterns. The migration is designed to be gradual and non-breaking.

## Phase 1: Core Infrastructure Setup

### 1. Initialize the Context System

```javascript
// src/core/GenomeBrowserCore.js
class GenomeBrowserCore {
    constructor() {
        // Initialize improved context
        this.context = new GenomeContext({
            enableLogging: true,
            enablePerformanceTracking: true
        });
        
        // Register core services
        this.setupCoreServices();
        
        // Initialize command registry
        this.commandRegistry = new CommandRegistry();
        this.context.registerService('commandRegistry', this.commandRegistry);
    }
    
    setupCoreServices() {
        // Event bus is already initialized in GenomeContext
        const eventBus = this.context.getService('eventBus');
        
        // Cache manager is already initialized
        const cacheManager = this.context.getService('cacheManager');
        
        // Task queue is already initialized
        const taskQueue = this.context.getService('taskQueue');
        
        console.log('🚀 [GenomeBrowserCore] Core services initialized');
    }
}
```

### 2. Wrapper for Backward Compatibility

```javascript
// src/adapters/LegacyAdapter.js
class LegacyAdapter {
    constructor(modernContext, legacyGenomeBrowser) {
        this.context = modernContext;
        this.legacy = legacyGenomeBrowser;
        
        this.setupCompatibilityLayer();
    }
    
    setupCompatibilityLayer() {
        // Map legacy calls to modern commands
        this.legacy.setCursorPosition = async (position) => {
            const result = await this.context.execute('sequence:setCursor', { position });
            if (!result.success) {
                throw new Error(result.error.message);
            }
            return result.data;
        };
        
        // Provide legacy event system compatibility
        this.legacy.on = (event, callback) => {
            return this.context.getService('eventBus').on(event, callback);
        };
        
        // Map legacy state access
        this.legacy.getCurrentSequence = () => {
            return this.context.getState('sequence:current');
        };
    }
}
```

## Phase 2: Gradual Migration Pattern

### Before: Legacy Function Call

```javascript
// Old pattern in SequenceUtils.js
class SequenceUtils {
    setCursorPosition(position) {
        this.cursorPosition = position;
        
        // Direct DOM manipulation
        this.cursor.element.style.left = left + 'px';
        this.cursor.element.style.top = top + 'px';
        
        // Direct method calls
        this.genomeBrowser.actionManager.setCursorPosition(position);
        this.updateCursorStatus(position);
        
        // No error handling
        // No validation
        // No caching
        // No events
    }
}
```

### After: Improved Function Call

```javascript
// New pattern with Result, Command, and Context
class ImprovedSequenceUtils {
    async setCursorPosition(position, options = {}) {
        // Input validation happens in command
        // Error handling with Result pattern
        // Caching and performance tracking
        // Event emission
        // Hooks for extensibility
        
        return await this.context.execute('sequence:setCursor', {
            position,
            chromosome: options.chromosome,
            source: options.source
        });
    }
}
```

## Phase 3: Step-by-Step Migration

### Step 1: Migrate ActionManager

```javascript
// Before: Direct method calls
class ActionManager {
    handlePasteSequence() {
        if (this.cursorPosition > 0) {
            // Direct operations
            const target = `${chromosome}:${this.cursorPosition}`;
            this.addAction(PASTE_SEQUENCE, target, description, metadata);
        }
    }
}

// After: Command-based approach
class ImprovedActionManager {
    constructor(context) {
        this.context = context;
        this.registerCommands();
    }
    
    registerCommands() {
        const pasteCommand = new Command(
            'action:paste',
            this.pasteHandler.bind(this),
            {
                description: 'Paste sequence at cursor position',
                inputSchema: {
                    cursorPosition: { type: 'number', required: false },
                    chromosome: { type: 'string', required: false }
                },
                hooks: {
                    before: [this.validatePasteOperation.bind(this)],
                    after: [this.notifyPasteComplete.bind(this)]
                }
            }
        );
        
        this.context.getService('commandRegistry').register(pasteCommand);
    }
    
    async handlePasteSequence(options = {}) {
        return await this.context.execute('action:paste', {
            cursorPosition: options.cursorPosition || this.getCursorPosition(),
            chromosome: options.chromosome || this.getCurrentChromosome()
        });
    }
}
```

### Step 2: Migrate Event Handling

```javascript
// Before: Direct DOM events
this.sequenceContent.addEventListener('mousedown', this.handleMouseDown.bind(this));

// After: Event bus with middleware
this.context.getService('eventBus').on('sequence:click', (eventData) => {
    // Handle with proper error boundaries
    this.handleSequenceClick(eventData.data);
}, {
    filter: (eventData) => eventData.data.position >= 0,
    throttle: 100 // Prevent excessive clicks
});
```

### Step 3: Migrate State Management

```javascript
// Before: Direct property access
this.cursorPosition = position;
this.genomeBrowser.currentSequence = sequence;

// After: Reactive state management
this.context.setState('cursor:position', position, {
    source: 'user',
    timestamp: Date.now()
});

this.context.setState('sequence:current', sequence, {
    chromosome: this.currentChromosome,
    length: sequence.length
});

// Subscribe to changes
this.context.subscribe('cursor:position', (change) => {
    this.repositionCursor(change.newValue);
});
```

## Phase 4: Advanced Patterns

### Error Handling with Result Pattern

```javascript
// Chain operations safely
const result = await this.setCursorPosition(100)
    .then(r => r.flatMapAsync(pos => this.renderSequence(pos.data.chromosome)))
    .then(r => r.map(rendered => ({ ...rendered, timestamp: Date.now() })))
    .catch(error => Result.error(error));

if (result.isSuccess()) {
    console.log('Operation completed:', result.getData());
} else {
    console.error('Operation failed:', result.getError().message);
    this.showUserFriendlyError(result.getError());
}
```

### Batch Operations

```javascript
// Execute multiple operations atomically
const operations = [
    { type: 'setCursor', params: { position: 100 } },
    { type: 'render', params: { chromosome: 'chr1', viewStart: 0, viewEnd: 1000 } },
    { type: 'setColor', params: { color: '#ff0000' } }
];

const results = await this.context.batch(operations);
console.log('Batch completed:', results);
```

### Performance Monitoring

```javascript
// Commands automatically track performance
const metrics = this.context.getPerformanceMetrics();
console.log('Average command execution time:', metrics.averageUpdateTime);

// Set up performance alerts
this.context.getService('eventBus').on('performance:slow', (eventData) => {
    if (eventData.data.duration > 100) {
        console.warn('Slow operation detected:', eventData.data);
        this.optimizePerformance(eventData.data);
    }
});
```

## Phase 5: Testing Strategy

### Unit Testing with Mocks

```javascript
// Test commands in isolation
describe('setCursorPosition command', () => {
    let context, command;
    
    beforeEach(() => {
        context = new GenomeContext({ enableLogging: false });
        command = new Command('test:setCursor', setCursorHandler);
    });
    
    test('should set cursor position successfully', async () => {
        const result = await command.execute(context, { position: 100 });
        
        expect(result.success).toBe(true);
        expect(result.data.position).toBe(100);
        expect(context.getState('cursor:position')).toBe(100);
    });
    
    test('should handle invalid position', async () => {
        const result = await command.execute(context, { position: -1 });
        
        expect(result.success).toBe(false);
        expect(result.error.code).toBe('VALIDATION_ERROR');
    });
});
```

### Integration Testing

```javascript
// Test full workflows
describe('cursor workflow', () => {
    test('should handle click to position cursor', async () => {
        const sequenceUtils = new ImprovedSequenceUtils(context);
        
        // Simulate click event
        const clickResult = await sequenceUtils.handleSequenceClick({
            position: 150,
            chromosome: 'chr1'
        });
        
        expect(clickResult.isSuccess()).toBe(true);
        
        // Verify cursor is positioned
        const cursorPos = context.getState('cursor:position');
        expect(cursorPos).toBe(150);
        
        // Verify events were emitted
        const events = context.getService('eventBus').getHistory('cursor:positioned');
        expect(events).toHaveLength(1);
        expect(events[0].data.position).toBe(150);
    });
});
```

## Benefits of Migration

### Before Migration Issues
- ❌ No standardized error handling
- ❌ Tight coupling between modules
- ❌ Inconsistent function signatures
- ❌ No input validation
- ❌ Manual cache management
- ❌ Poor performance tracking
- ❌ Difficult to test

### After Migration Benefits
- ✅ Consistent error handling with Result pattern
- ✅ Loose coupling through event bus and DI
- ✅ Standardized command interface
- ✅ Automatic input/output validation
- ✅ Intelligent caching system
- ✅ Comprehensive performance monitoring
- ✅ Easy unit and integration testing
- ✅ Extensible through hooks and middleware
- ✅ Better debugging and logging
- ✅ Type-safe operations

## Migration Timeline

### Week 1-2: Infrastructure
- ✅ Implement core classes (GenomeContext, EventBus, Result, Command)
- ✅ Create backward compatibility adapters
- ✅ Set up basic command registry

### Week 3-4: Gradual Migration
- 🔄 Migrate ActionManager to command pattern
- 🔄 Refactor SequenceUtils event handling
- 🔄 Implement reactive state management

### Week 5-6: Advanced Features
- ⏳ Add performance monitoring
- ⏳ Implement batch operations
- ⏳ Create comprehensive error handling

### Week 7-8: Polish and Testing
- ⏳ Add comprehensive test suite
- ⏳ Performance optimization
- ⏳ Documentation and training

This migration approach ensures a smooth transition while immediately providing benefits in maintainability, performance, and developer experience.