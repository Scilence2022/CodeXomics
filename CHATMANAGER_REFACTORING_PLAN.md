# ChatManager.js Refactoring Plan

## Executive Summary

**Current State:** 21,479 lines, 360+ methods, severe God Class anti-pattern  
**Goal:** Modular architecture with single-responsibility services  
**Estimated Effort:** 4-6 weeks (phased approach)  
**Risk Level:** High (core application component)

---

## Phase 1: Foundation & Service Extraction (Week 1-2)

### 1.1 Create Service Architecture

Create directory structure:
```
src/renderer/modules/chat/
├── ChatManager.js (coordinator - target: ~500 lines)
├── services/
│   ├── LLMService.js
│   ├── ToolExecutionService.js
│   ├── UIService.js
│   ├── FileOperationService.js
│   ├── GenomeNavigationService.js
│   └── ProteinStructureService.js
├── managers/
│   ├── ChatHistoryManager.js
│   └── MCPConnectionManager.js
├── utils/
│   ├── FileLoader.js
│   ├── ExportFormatter.js
│   └── MessageFormatter.js
└── constants/
    ├── ToolNames.js
    └── DOMSelectors.js
```

### 1.2 Extract Constants First (Low Risk)

**File:** `src/renderer/modules/chat/constants/`

```javascript
// ToolNames.js
export const TOOL_NAMES = {
  NAVIGATION: {
    NAVIGATE_TO_POSITION: 'navigate_to_position',
    OPEN_NEW_TAB: 'open_new_tab',
    // ...
  },
  ANALYSIS: {
    CALCULATE_GC_CONTENT: 'calculate_gc_content',
    FIND_ORFS: 'find_orfs',
    // ...
  },
  // ...
};

// DOMSelectors.js
export const DOM_SELECTORS = {
  CHAT_PANEL: 'llmChatPanel',
  CHAT_HEADER: 'chatHeader',
  CHAT_MESSAGES: 'chatMessages',
  // ...
};

// DefaultSettings.js
export const DEFAULT_CHAT_SETTINGS = {
  showThinkingProcess: true,
  showToolCalls: true,
  maxHistoryMessages: 1000,
  // ...
};
```

### 1.3 Extract Utility Functions

**File:** `src/renderer/modules/chat/utils/FileLoader.js`

Consolidate all file loading methods into a generic loader:

```javascript
export class FileLoader {
  constructor(fileManager) {
    this.fileManager = fileManager;
  }

  async loadFile(options) {
    const { filePath, fileType, showDialog, validateFn, loadFn } = options;
    
    if (filePath && !showDialog) {
      if (!this.fileManager) {
        throw new Error('FileManager not available');
      }
      
      const fs = this.getFs();
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      if (validateFn && !validateFn(filePath)) {
        throw new Error(`Invalid file format: ${filePath}`);
      }
      
      const result = await loadFn(filePath);
      return { success: true, result };
    } else {
      this.fileManager.openSpecificFileType(fileType);
      return { success: true, action: 'dialog_opened' };
    }
  }
  
  getFs() {
    if (typeof require !== 'undefined') {
      return require('fs');
    }
    throw new Error('File system not available');
  }
}
```

**File:** `src/renderer/modules/chat/utils/ExportFormatter.js`

```javascript
export class ExportFormatter {
  formatFasta(sequence, header) {
    return `>${header}\n${this.chunkString(sequence, 60)}`;
  }
  
  formatGenBank(features, sequence) {
    // GenBank formatting logic
  }
  
  formatGFF(features) {
    // GFF formatting logic
  }
  
  chunkString(str, size) {
    return str.match(new RegExp(`.{1,${size}}`, 'g')).join('\n');
  }
}
```

---

## Phase 2: Core Service Extraction (Week 2-4)

### 2.1 LLMService

**Responsibility:** All LLM communication and message formatting

**Methods to extract:**
- `sendToLLM()` (714 lines - needs breakdown)
- `buildConversationHistory()`
- `buildSystemMessage()`
- `sanitizeResultForLLM()`
- `formatToolResult()`
- `processSystemPromptVariables()`

**Interface:**
```javascript
export class LLMService {
  constructor(configManager, memorySystem) {
    this.configManager = configManager;
    this.memorySystem = memorySystem;
  }
  
  async sendMessage(message, options) {
    // Main LLM communication
  }
  
  buildSystemMessage(context) {
    // Build system prompt
  }
  
  buildConversationHistory(messages, options) {
    // Format history for LLM
  }
  
  formatToolResult(result) {
    // Format tool results for LLM consumption
  }
}
```

### 2.2 ToolExecutionService

**Responsibility:** Tool routing, execution, and result handling

**Methods to extract:**
- `executeToolByName()` (902 lines - critical to break down)
- `executeLocalTool()`
- `executeGenomicsTool()`
- `executePluginTool()`
- `executeMCPTool()`
- `parseToolCall()`
- `parseMultipleToolCalls()`

**Architecture:**
```javascript
export class ToolExecutionService {
  constructor(deps) {
    this.toolRegistry = new Map();
    this.executors = {
      local: new LocalToolExecutor(),
      genomics: new GenomicsToolExecutor(),
      plugin: new PluginToolExecutor(),
      mcp: new MCPToolExecutor(),
    };
  }
  
  registerTool(name, executor, category) {
    this.toolRegistry.set(name, { executor, category });
  }
  
  async executeTool(toolName, params, context) {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    return await tool.executor.execute(toolName, params, context);
  }
  
  parseToolCall(response) {
    // Parse LLM tool calls
  }
}
```

### 2.3 UIService

**Responsibility:** All UI rendering, DOM manipulation, and user interactions

**Methods to extract:**
- `createChatInterface()`
- `addMessageToChat()`
- `showTypingIndicator()`
- `toggleChatVisibility()`
- `dockChat()` / `undockChat()`
- `setupChatDragging()`
- `setupChatResizing()`

**Interface:**
```javascript
export class UIService {
  constructor(configManager) {
    this.configManager = configManager;
    this.elements = new Map();
  }
  
  createChatInterface(container) {
    // Build UI
  }
  
  addMessage(message, type) {
    // Add message to chat
  }
  
  dock() {
    // Dock chat panel
  }
  
  undock() {
    // Undock chat panel
  }
  
  // Event emitters for UI events
  on(event, callback) {
    // Subscribe to UI events
  }
}
```

### 2.4 FileOperationService

**Responsibility:** File loading, saving, and export operations

**Methods to extract:**
- All `loadXxxFile()` methods
- All `exportXxxFormat()` methods
- `downloadInternetFile()`
- `setWorkingDirectory()`

**Interface:**
```javascript
export class FileOperationService {
  constructor(fileManager, fileLoader) {
    this.fileManager = fileManager;
    this.fileLoader = fileLoader;
    this.exportFormatter = new ExportFormatter();
  }
  
  async loadGenomeFile(filePath) {
    return this.fileLoader.loadFile({
      filePath,
      fileType: 'fasta',
      validateFn: (path) => path.match(/\.(fasta|fa|fna)$/i),
      loadFn: (path) => this.fileManager.loadGenomeFile(path)
    });
  }
  
  async exportFasta(sequence, filename) {
    const content = this.exportFormatter.formatFasta(sequence, filename);
    return this.saveFile(content, filename);
  }
}
```

### 2.5 GenomeNavigationService

**Responsibility:** Genome browser navigation and search

**Methods to extract:**
- `navigateToPosition()`
- `searchGeneByName()`
- `performIntelligentGeneSearch()`
- `getSequence()`
- `zoomIn()` / `zoomOut()`
- `panLeft()` / `panRight()`

### 2.6 ProteinStructureService

**Responsibility:** Protein structure fetching and visualization

**Methods to extract:**
- `fetchProteinStructure()`
- `searchPDBStructures()`
- `searchAlphaFoldByGene()`
- `fetchAlphaFoldStructure()`

---

## Phase 3: Manager Extraction (Week 4-5)

### 3.1 ChatHistoryManager

**Responsibility:** Chat history persistence and retrieval

**Methods to extract:**
- `loadChatHistory()`
- `displayChatHistory()`
- `exportChatHistory()`
- `groupMessagesIntoConversations()`

### 3.2 MCPConnectionManager

**Responsibility:** MCP server connections and communication

**Methods to extract:**
- `checkAndSetupMCPConnection()`
- `setupMCPConnection()`
- `disconnectMCP()`
- `sendToMCP()`
- `handleMCPMessage()`

---

## Phase 4: Refactored ChatManager (Week 5-6)

### 4.1 New ChatManager Structure

**Target:** ~500 lines, coordinator pattern

```javascript
import { LLMService } from './services/LLMService.js';
import { ToolExecutionService } from './services/ToolExecutionService.js';
import { UIService } from './services/UIService.js';
import { FileOperationService } from './services/FileOperationService.js';
import { GenomeNavigationService } from './services/GenomeNavigationService.js';
import { ProteinStructureService } from './services/ProteinStructureService.js';
import { ChatHistoryManager } from './managers/ChatHistoryManager.js';
import { MCPConnectionManager } from './managers/MCPConnectionManager.js';

export class ChatManager {
  constructor(app, configManager) {
    this.app = app;
    this.configManager = configManager;
    
    // Initialize services
    this.services = this.initializeServices();
    
    // Initialize managers
    this.managers = this.initializeManagers();
    
    // Setup event coordination
    this.setupEventCoordination();
    
    // Load initial state
    this.loadInitialState();
  }
  
  initializeServices() {
    return {
      llm: new LLMService(this.configManager, this.services?.memory),
      tools: new ToolExecutionService({
        configManager: this.configManager,
        app: this.app
      }),
      ui: new UIService(this.configManager),
      files: new FileOperationService(
        this.app?.fileManager,
        new FileLoader(this.app?.fileManager)
      ),
      navigation: new GenomeNavigationService(this.app),
      protein: new ProteinStructureService()
    };
  }
  
  initializeManagers() {
    return {
      history: new ChatHistoryManager(this.configManager),
      mcp: new MCPConnectionManager(this.configManager)
    };
  }
  
  setupEventCoordination() {
    // Coordinate events between services
    this.services.ui.on('messageSent', (message) => {
      this.handleUserMessage(message);
    });
    
    this.services.ui.on('toolCallRequested', (toolCall) => {
      this.handleToolCall(toolCall);
    });
  }
  
  async handleUserMessage(message) {
    // Coordinator logic
    const history = await this.managers.history.getRecentHistory();
    const systemMessage = this.services.llm.buildSystemMessage();
    
    const response = await this.services.llm.sendMessage(message, {
      history,
      systemMessage
    });
    
    await this.handleLLMResponse(response);
  }
  
  async handleToolCall(toolCall) {
    try {
      const result = await this.services.tools.executeTool(
        toolCall.name,
        toolCall.params,
        { app: this.app }
      );
      
      this.services.ui.addToolResult(result);
      
      return result;
    } catch (error) {
      this.services.ui.showError(error.message);
      throw error;
    }
  }
  
  async handleLLMResponse(response) {
    // Parse and handle LLM response
    const toolCalls = this.services.tools.parseToolCalls(response);
    
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        await this.handleToolCall(toolCall);
      }
    }
    
    this.services.ui.addMessage(response.content, 'assistant');
  }
}
```

---

## Phase 5: Testing & Validation (Week 6)

### 5.1 Testing Strategy

1. **Unit Tests:** Each service in isolation
2. **Integration Tests:** Service interactions
3. **E2E Tests:** Full chat workflows
4. **Regression Tests:** Feature parity validation

### 5.2 Migration Strategy

1. **Parallel Implementation:** Run old and new side-by-side
2. **Feature Flags:** Toggle between implementations
3. **Gradual Rollout:** Enable for specific users/features
4. **Rollback Plan:** Quick revert capability

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking Changes | Comprehensive test suite, feature flags |
| Lost Functionality | Checklist validation for each method |
| Performance Issues | Benchmark before/after |
| Merge Conflicts | Small, focused PRs |
| Team Disruption | Clear documentation, pair programming |

---

## Success Metrics

- [ ] ChatManager.js under 1,000 lines
- [ ] All services under 500 lines each
- [ ] 80%+ unit test coverage
- [ ] Zero regression in core features
- [ ] Improved build times
- [ ] Reduced bundle size

---

## Next Steps

1. **Review and approve plan**
2. **Set up feature branch**
3. **Begin Phase 1 (Constants & Utils)**
4. **Establish testing framework**
5. **Schedule code reviews**
