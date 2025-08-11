# Genome AI Studio - Complete API Reference

## Overview

This document provides a comprehensive reference for all APIs available in Genome AI Studio v0.3 beta, including core modules, plugin system, and AI integration interfaces.

## 🔧 Core Module APIs

### FileManager API

**File**: `src/renderer/modules/FileManager.js`

#### File Loading Methods

```javascript
class FileManager {
  // Load genome file
  async loadGenomeFile(filePath, options = {}) {
    // Implementation
  }
  
  // Load annotation file
  async loadAnnotationFile(filePath, genomeId = null) {
    // Implementation
  }
  
  // Load variant file
  async loadVariantFile(filePath, genomeId = null) {
    // Implementation
  }
  
  // Load multiple files
  async loadMultipleFiles(filePaths, options = {}) {
    // Implementation
  }
}
```

**Parameters**:
- `filePath` (string): Path to file
- `options` (object): Loading options
- `genomeId` (string): Target genome identifier

**Returns**: Promise resolving to loaded data

#### File Export Methods

```javascript
// Export data in various formats
async exportAsFASTA(data, filePath) { }
async exportAsGenBank(data, filePath) { }
async exportAsGFF(data, filePath) { }
async exportAsBED(data, filePath) { }
async exportAsSVG(data, filePath) { }
```

### TrackRenderer API

**File**: `src/renderer/modules/TrackRenderer.js`

#### Track Management

```javascript
class TrackRenderer {
  // Add new track
  addTrack(type, data, options = {}) {
    // Implementation
  }
  
  // Remove track
  removeTrack(trackId) {
    // Implementation
  }
  
  // Update track data
  updateTrack(trackId, newData) {
    // Implementation
  }
  
  // Set track visibility
  setTrackVisibility(trackId, visible) {
    // Implementation
  }
  
  // Resize track
  resizeTrack(trackId, height) {
    // Implementation
  }
}
```

#### Rendering Control

```javascript
// Refresh view
refreshView(forceComplete = false) { }

// Zoom to region
zoomToRegion(start, end, animate = true) { }

// Pan to position
panToPosition(position, animate = true) { }

// Get current view
getCurrentView() {
  return {
    start: this.currentStart,
    end: this.currentEnd,
    zoom: this.currentZoom
  };
}
```

### ProjectManager API

**File**: `src/renderer/modules/ProjectManager.js`

#### Project Operations

```javascript
class ProjectManager {
  // Create new project
  async createProject(name, template = null) {
    // Implementation
  }
  
  // Save project
  async saveProject(projectData, filePath = null) {
    // Implementation
  }
  
  // Load project
  async loadProject(filePath) {
    // Implementation
  }
  
  // Export project
  async exportProject(projectId, format = 'prj.GAI') {
    // Implementation
  }
  
  // Get project info
  getProjectInfo(projectId) {
    // Implementation
  }
}
```

#### View Mode Management

```javascript
// Set view mode
setViewMode(mode) {
  // mode: 'grid' | 'list' | 'details'
}

// Get current view mode
getCurrentViewMode() {
  return this.currentViewMode;
}

// Switch to simple mode
toggleSimpleMode() {
  // Implementation
}
```

## 🔌 Plugin System API

### PluginManager API

**File**: `src/renderer/modules/PluginManager.js`

#### Plugin Lifecycle

```javascript
class PluginManager {
  // Register plugin
  registerPlugin(plugin) {
    // Implementation
  }
  
  // Load plugin from file
  async loadPlugin(pluginPath) {
    // Implementation
  }
  
  // Unload plugin
  unloadPlugin(pluginId) {
    // Implementation
  }
  
  // Get plugin info
  getPlugin(pluginId) {
    // Implementation
  }
  
  // List all plugins
  getAvailablePlugins() {
    // Implementation
  }
}
```

#### Function Execution

```javascript
// Execute plugin function
async executeFunction(pluginId, funcName, params = {}) {
  // Implementation
}

// Get available functions
getAvailableFunctions() {
  // Implementation
}

// Validate function call
validateFunctionCall(pluginId, funcName, params) {
  // Implementation
}
```

### Plugin Interface

**Required Plugin Structure**:

```javascript
const MyPlugin = {
  // Basic information
  id: 'my-plugin',
  name: 'My Plugin Name',
  version: '1.0.0',
  description: 'Plugin description',
  author: 'Author Name',
  
  // Plugin functions
  functions: {
    functionName: {
      description: 'Function description',
      parameters: {
        paramName: {
          type: 'string|number|boolean|object|array',
          required: true|false,
          description: 'Parameter description'
        }
      },
      required: ['paramName'],
      execute: async (params) => {
        // Function implementation
        return { result: 'success' };
      },
      examples: [
        {
          description: 'Example usage',
          parameters: { paramName: 'example value' }
        }
      ]
    }
  },
  
  // Lifecycle methods
  initialize: () => {
    // Called when plugin is loaded
  },
  
  cleanup: () => {
    // Called when plugin is unloaded
  }
};
```

### SmartExecutor API

**File**: `src/renderer/modules/SmartExecutor.js`

#### Execution Management

```javascript
class SmartExecutor {
  // Execute function with optimization
  async executeWithOptimization(pluginId, funcName, params) {
    // Implementation
  }
  
  // Batch execution
  async executeBatch(executions) {
    // Implementation
  }
  
  // Performance monitoring
  getPerformanceMetrics() {
    // Implementation
  }
}
```

## 🤖 AI Integration API

### ChatManager API

**File**: `src/renderer/modules/ChatManager.js`

#### Chat Operations

```javascript
class ChatManager {
  // Send message
  async sendMessage(message, options = {}) {
    // Implementation
  }
  
  // Get conversation history
  getConversationHistory() {
    // Implementation
  }
  
  // Clear conversation
  clearConversation() {
    // Implementation
  }
  
  // Export conversation
  exportConversation(format = 'json') {
    // Implementation
  }
}
```

#### AI Provider Management

```javascript
// Configure AI provider
async configureProvider(provider, config) {
  // Implementation
}

// Test connection
async testConnection(provider) {
  // Implementation
}

// Get available models
getAvailableModels(provider) {
  // Implementation
}
```

### ConversationEvolutionManager API

**File**: `src/renderer/modules/ConversationEvolutionManager.js`

#### Conversation Tracking

```javascript
class ConversationEvolutionManager {
  // Add conversation data
  addConversationData(data) {
    // Implementation
  }
  
  // Get evolution insights
  getEvolutionInsights() {
    // Implementation
  }
  
  // Analyze patterns
  analyzePatterns() {
    // Implementation
  }
  
  // Generate recommendations
  generateRecommendations() {
    // Implementation
  }
}
```

### PluginFunctionCallsIntegrator API

**File**: `src/renderer/modules/PluginFunctionCallsIntegrator.js`

#### AI-Plugin Integration

```javascript
class PluginFunctionCallsIntegrator {
  // Integrate function calls
  integrateFunctionCalls(pluginFunctions) {
    // Implementation
  }
  
  // Execute AI-requested function
  async executeAIFunction(call) {
    // Implementation
  }
  
  // Get function documentation
  getFunctionDocumentation() {
    // Implementation
  }
}
```

## 🧬 Bioinformatics Tools API

### ProteinStructureViewer API

**File**: `src/renderer/modules/ProteinStructureViewer.js`

#### Structure Operations

```javascript
class ProteinStructureViewer {
  // Search PDB
  async searchPDB(query, options = {}) {
    // Implementation
  }
  
  // Search AlphaFold
  async searchAlphaFold(query, options = {}) {
    // Implementation
  }
  
  // Load structure
  async loadStructure(structureId, source = 'pdb') {
    // Implementation
  }
  
  // Export structure
  exportStructure(format = 'pdb') {
    // Implementation
  }
}
```

### KGMLViewer API

**File**: `src/bioinformatics-tools/kgml-viewer.html`

#### Pathway Operations

```javascript
class KGMLViewer {
  // Load KGML file
  loadKGMLFile(filePath) {
    // Implementation
  }
  
  // Navigate to pathway
  navigateToPathway(pathwayId) {
    // Implementation
  }
  
  // Export visualization
  exportVisualization(format = 'svg') {
    // Implementation
  }
  
  // Get pathway statistics
  getPathwayStats() {
    // Implementation
  }
}
```

### BLAST Integration API

**File**: `src/blast-installer.html`

#### BLAST Operations

```javascript
class BLASTManager {
  // Run BLAST search
  async runBLAST(query, database, type = 'blastn') {
    // Implementation
  }
  
  // Configure databases
  configureDatabases(config) {
    // Implementation
  }
  
  // Get results
  getBLASTResults(searchId) {
    // Implementation
  }
  
  // Export results
  exportResults(format = 'xml') {
    // Implementation
  }
}
```

## 📊 Data Management API

### SequenceTools API

**File**: `src/renderer/modules/SequenceTools.js`

#### Sequence Analysis

```javascript
class SequenceTools {
  // Calculate GC content
  calculateGCContent(sequence) {
    // Implementation
  }
  
  // Translate DNA
  translateDNA(sequence, frame = 0) {
    // Implementation
  }
  
  // Reverse complement
  reverseComplement(sequence) {
    // Implementation
  }
  
  // Find ORFs
  findORFs(sequence, minLength = 300) {
    // Implementation
  }
  
  // Calculate melting temperature
  calculateMeltingTemp(sequence) {
    // Implementation
  }
}
```

### AnnotationManager API

**File**: `src/renderer/modules/AnnotationManager.js`

#### Annotation Operations

```javascript
class AnnotationManager {
  // Add annotation
  addAnnotation(annotation) {
    // Implementation
  }
  
  // Update annotation
  updateAnnotation(annotationId, updates) {
    // Implementation
  }
  
  // Delete annotation
  deleteAnnotation(annotationId) {
    // Implementation
  }
  
  // Search annotations
  searchAnnotations(query, filters = {}) {
    // Implementation
  }
  
  // Export annotations
  exportAnnotations(format = 'gff') {
    // Implementation
  }
}
```

## 🎨 Visualization API

### TrackRenderer Advanced API

**File**: `src/renderer/modules/TrackRenderer.js`

#### Custom Track Creation

```javascript
// Create custom track
createCustomTrack(config) {
  const track = {
    id: config.id,
    type: 'custom',
    data: config.data,
    renderer: config.renderer,
    style: config.style
  };
  
  this.tracks.set(config.id, track);
  this.renderTrack(track);
  return track;
}

// Custom track renderer
const customRenderer = {
  render: (track, container) => {
    // Custom rendering logic
  },
  
  update: (track, newData) => {
    // Update logic
  },
  
  cleanup: (track) => {
    // Cleanup logic
  }
};
```

#### SVG Manipulation

```javascript
// Create SVG element
createSVGElement(type, attributes = {}) {
  const element = document.createElementNS('http://www.w3.org/2000/svg', type);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

// Animate element
animateElement(element, properties, duration = 300) {
  element.style.transition = `all ${duration}ms ease-in-out`;
  Object.entries(properties).forEach(([property, value]) => {
    element.style[property] = value;
  });
}
```

## 🔒 Security API

### PluginSecurityValidator API

**File**: `src/renderer/modules/PluginSecurityValidator.js`

#### Security Validation

```javascript
class PluginSecurityValidator {
  // Validate plugin
  validatePlugin(plugin) {
    // Implementation
  }
  
  // Create sandbox
  createSandbox(plugin) {
    // Implementation
  }
  
  // Validate function call
  validateFunctionCall(pluginId, funcName, params) {
    // Implementation
  }
  
  // Security audit
  securityAudit(pluginId) {
    // Implementation
  }
}
```

## ⚡ Performance API

### PerformanceMonitor API

**File**: `src/renderer/modules/PerformanceMonitor.js`

#### Performance Tracking

```javascript
class PerformanceMonitor {
  // Start timing
  startTimer(name) {
    // Implementation
  }
  
  // End timing
  endTimer(name) {
    // Implementation
  }
  
  // Get metrics
  getMetrics() {
    return {
      renderTime: this.renderTime,
      memoryUsage: this.memoryUsage,
      pluginExecutionTime: this.pluginExecutionTime,
      userInteractionLatency: this.userInteractionLatency
    };
  }
  
  // Performance report
  generateReport() {
    // Implementation
  }
}
```

## 🔧 Configuration API

### SettingsManager API

**File**: `src/renderer/modules/SettingsManager.js`

#### Settings Management

```javascript
class SettingsManager {
  // Get setting
  getSetting(key, defaultValue = null) {
    // Implementation
  }
  
  // Set setting
  setSetting(key, value) {
    // Implementation
  }
  
  // Reset settings
  resetSettings() {
    // Implementation
  }
  
  // Export settings
  exportSettings() {
    // Implementation
  }
  
  // Import settings
  importSettings(settings) {
    // Implementation
  }
}
```

## 📱 Cross-Platform API

### PlatformManager API

**File**: `src/renderer/modules/PlatformManager.js`

#### Platform Operations

```javascript
class PlatformManager {
  // Get platform info
  getPlatformInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version
    };
  }
  
  // Platform-specific operations
  getAppDataPath() {
    // Implementation
  }
  
  // File path handling
  normalizePath(path) {
    // Implementation
  }
  
  // Platform-specific UI
  adaptUIForPlatform() {
    // Implementation
  }
}
```

## 🧪 Testing API

### TestFramework API

**File**: `src/renderer/modules/TestFramework.js`

#### Testing Operations

```javascript
class TestFramework {
  // Run tests
  async runTests(testSuite) {
    // Implementation
  }
  
  // Mock data
  createMockData(type, options = {}) {
    // Implementation
  }
  
  // Assertions
  assert(condition, message) {
    // Implementation
  }
  
  // Performance testing
  benchmarkFunction(func, iterations = 1000) {
    // Implementation
  }
}
```

## 📊 Event System API

### EventBus API

**File**: `src/renderer/modules/EventBus.js`

#### Event Management

```javascript
class EventBus {
  // Subscribe to event
  subscribe(event, callback) {
    // Implementation
  }
  
  // Unsubscribe from event
  unsubscribe(event, callback) {
    // Implementation
  }
  
  // Emit event
  emit(event, data) {
    // Implementation
  }
  
  // Get event listeners
  getEventListeners(event) {
    // Implementation
  }
}
```

## 🔄 IPC Communication API

### IPC Manager API

**File**: `src/preload.js`

#### IPC Operations

```javascript
// Send message to main process
window.electronAPI.sendMessage(channel, data);

// Receive message from main process
window.electronAPI.receiveMessage(channel, callback);

// Invoke main process function
window.electronAPI.invoke(channel, data);

// Available channels
const channels = {
  FILE_OPERATIONS: 'file-operations',
  PROJECT_MANAGEMENT: 'project-management',
  PLUGIN_OPERATIONS: 'plugin-operations',
  AI_INTEGRATION: 'ai-integration',
  SYSTEM_OPERATIONS: 'system-operations'
};
```

## 📝 Error Handling API

### ErrorManager API

**File**: `src/renderer/modules/ErrorManager.js`

#### Error Management

```javascript
class ErrorManager {
  // Handle error
  handleError(error, context = {}) {
    // Implementation
  }
  
  // Log error
  logError(error, level = 'error') {
    // Implementation
  }
  
  // Get error history
  getErrorHistory() {
    // Implementation
  }
  
  // Clear error history
  clearErrorHistory() {
    // Implementation
  }
}
```

## 🎯 Usage Examples

### Basic Plugin Development

```javascript
// Create simple plugin
const SimplePlugin = {
  id: 'simple-plugin',
  name: 'Simple Plugin',
  version: '1.0.0',
  description: 'A simple example plugin',
  author: 'Developer Name',
  
  functions: {
    hello: {
      description: 'Say hello',
      parameters: {
        name: { type: 'string', required: true }
      },
      required: ['name'],
      execute: async (params) => {
        return { message: `Hello, ${params.name}!` };
      }
    }
  },
  
  initialize: () => {
    console.log('SimplePlugin initialized');
  }
};

// Register plugin
window.pluginManager.registerPlugin(SimplePlugin);
```

### Advanced Function Integration

```javascript
// Complex plugin function
const advancedFunction = {
  description: 'Advanced genomic analysis',
  parameters: {
    sequence: { type: 'string', required: true },
    analysisType: { type: 'string', required: false },
    options: { type: 'object', required: false }
  },
  required: ['sequence'],
  execute: async (params) => {
    try {
      // Validate input
      if (params.sequence.length < 100) {
        throw new Error('Sequence too short');
      }
      
      // Perform analysis
      const result = await performAnalysis(params.sequence, params.analysisType);
      
      // Return formatted result
      return {
        success: true,
        result: result,
        metadata: {
          timestamp: new Date().toISOString(),
          analysisType: params.analysisType || 'default'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};
```

### AI Integration Example

```javascript
// AI-powered function
const aiFunction = {
  description: 'AI-powered sequence analysis',
  parameters: {
    sequence: { type: 'string', required: true },
    analysis: { type: 'string', required: true }
  },
  required: ['sequence', 'analysis'],
  execute: async (params) => {
    // Use AI to analyze sequence
    const aiResponse = await window.chatManager.sendMessage(
      `Analyze this sequence: ${params.sequence}. Focus on: ${params.analysis}`
    );
    
    return {
      analysis: aiResponse,
      sequence: params.sequence,
      timestamp: new Date().toISOString()
    };
  }
};
```

## 📚 Conclusion

This API reference provides comprehensive coverage of all available interfaces in Genome AI Studio. Key areas include:

- **Core Modules**: File management, visualization, project management
- **Plugin System**: Complete plugin development and management
- **AI Integration**: Natural language processing and function calling
- **Bioinformatics Tools**: Specialized analysis and visualization
- **Performance & Security**: Optimization and safety features

Developers can use these APIs to:
- Create custom plugins and tools
- Integrate with external systems
- Automate workflows
- Extend functionality
- Optimize performance

For detailed implementation examples and best practices, refer to the Plugin Development Guide and other documentation resources.
