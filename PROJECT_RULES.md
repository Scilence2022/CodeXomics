# GenomeExplorer Project Rules

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Rules](#architecture-rules)
3. [Code Standards](#code-standards)
4. [Module Development](#module-development)
5. [Plugin Development](#plugin-development)
6. [Testing Requirements](#testing-requirements)
7. [Documentation Standards](#documentation-standards)
8. [Git Workflow](#git-workflow)
9. [Performance Guidelines](#performance-guidelines)
10. [Security Requirements](#security-requirements)

## 🎯 Project Overview

**GenomeExplorer** is a cross-platform Electron-based genome analysis studio with AI-powered natural language interaction. The project emphasizes modular architecture, plugin extensibility, and seamless user experience.

### Core Principles
- **Modularity First**: Each feature should be a separate, self-contained module
- **AI Integration**: Natural language interaction for genomic analysis
- **Performance**: Efficient handling of large genomic datasets
- **Extensibility**: Plugin-based architecture for custom functionality
- **User Experience**: Intuitive interface with comprehensive error handling

## 🏗️ Architecture Rules

### 1. **Modular Architecture**
- **MUST** follow the established modular pattern in `src/renderer/modules/`
- **MUST** use dependency injection for module communication
- **MUST** implement proper initialization order with async/await
- **MUST** maintain clear API boundaries between modules

#### Module Structure Requirements:
```javascript
class ModuleName {
    constructor(app, configManager) {
        this.app = app;
        this.config = configManager;
        this.initialized = false;
    }
    
    async initialize() {
        // Initialization logic
        this.initialized = true;
    }
    
    // Module-specific methods
}
```

### 2. **File Organization**
```
src/
├── main.js                    # Electron main process
├── preload.js                 # Preload script
├── mcp-server.js             # MCP server implementation
└── renderer/
    ├── index.html            # Main UI
    ├── styles.css            # Global styles
    ├── renderer-modular.js   # Application controller
    └── modules/              # Modular components
        ├── Core modules (FileManager, TrackRenderer, etc.)
        ├── AI modules (ChatManager, LLMConfigManager, etc.)
        └── Plugins/          # Plugin implementations
```

### 3. **Plugin System Architecture**
- **MUST** use the established plugin interface
- **MUST** register plugins through PluginManager
- **MUST** follow the function calling schema for LLM integration
- **MUST** implement proper error handling and validation

## 💻 Code Standards

### 1. **JavaScript Standards**
- **MUST** use ES6+ syntax and features
- **MUST** use async/await for asynchronous operations
- **MUST** implement proper error handling with try-catch blocks
- **MUST** use consistent naming conventions:
  - Classes: `PascalCase`
  - Methods/Variables: `camelCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - Files: `PascalCase.js`

### 2. **Error Handling Requirements**
```javascript
// REQUIRED pattern for all async operations
try {
    const result = await someAsyncOperation();
    return result;
} catch (error) {
    console.error(`Error in ${operation}:`, error);
    this.showUserError(`Failed to ${operation}: ${error.message}`);
    return null;
}
```

### 3. **Configuration Management**
- **MUST** use ConfigManager for all configuration
- **MUST** implement default values for all configuration options
- **MUST** validate configuration on load
- **MUST** provide user-friendly error messages for invalid config

### 4. **Memory Management**
- **MUST** clean up event listeners in destruction methods
- **MUST** properly dispose of large objects and DOM elements
- **MUST** use efficient algorithms for large genomic datasets
- **MUST** implement progressive loading for large files

## 🔧 Module Development

### 1. **Core Module Requirements**
- **MUST** extend the base module pattern
- **MUST** implement proper lifecycle methods (initialize, destroy)
- **MUST** use centralized configuration through ConfigManager
- **MUST** emit events for important state changes

### 2. **Module Communication**
- **MUST** use the established event system for inter-module communication
- **MUST NOT** directly access other module internals
- **MUST** use proper dependency injection
- **MUST** handle module dependencies gracefully

### 3. **UI Module Standards**
- **MUST** use consistent CSS classes and styling
- **MUST** implement responsive design principles
- **MUST** provide keyboard accessibility
- **MUST** include proper ARIA labels for screen readers

### 4. **Data Processing Modules**
- **MUST** validate input data before processing
- **MUST** provide progress feedback for long operations
- **MUST** implement efficient algorithms for large datasets
- **MUST** handle malformed data gracefully

## 🔌 Plugin Development

### 1. **Plugin Interface Requirements**
```javascript
const plugin = {
    name: 'PluginName',
    version: '1.0.0',
    description: 'Plugin description',
    author: 'Author name',
    functions: {
        functionName: {
            description: 'Function description',
            parameters: {/* JSON schema */},
            execute: async (params) => {/* implementation */}
        }
    }
};
```

### 2. **Function Calling Standards**
- **MUST** use standardized parameter validation
- **MUST** return consistent response format
- **MUST** provide clear error messages
- **MUST** implement proper logging

### 3. **LLM Integration Requirements**
- **MUST** provide clear function descriptions for AI understanding
- **MUST** use JSON schema for parameter validation
- **MUST** follow the established naming convention: `category.functionName`
- **MUST** implement the critical function selection rules:

```javascript
// CRITICAL FUNCTION SELECTION RULES:
// For text-based searches: ALWAYS use 'search_features'
// For position-based searches: ONLY use 'get_nearby_features'
```

### 4. **Visualization Plugins**
- **MUST** use SVG for scalable graphics
- **MUST** implement responsive design
- **MUST** provide interactive tooltips
- **MUST** support data export functionality

## 🧪 Testing Requirements

### 1. **Testing Strategy**
- **MUST** test critical AI function calling behavior
- **MUST** test file parsing with various formats
- **MUST** test plugin functionality independently
- **MUST** verify cross-platform compatibility

### 2. **Testing Files**
- Function tests: `test-plugin-system.js`
- Integration tests: `test-plugin-integration.html`
- Specific feature tests: `test-biological-networks.js`

### 3. **Testing Standards**
- **MUST** test error conditions and edge cases
- **MUST** validate large file handling
- **MUST** test AI integration thoroughly
- **MUST** include performance benchmarks

## 📚 Documentation Standards

### 1. **Code Documentation**
- **MUST** document all public methods with JSDoc
- **MUST** include parameter types and descriptions
- **MUST** provide usage examples for complex functions
- **MUST** document error conditions and return values

### 2. **Module Documentation**
- **MUST** maintain README.md in modules directory
- **MUST** document module dependencies and initialization
- **MUST** provide integration examples
- **MUST** keep implementation summaries updated

### 3. **Plugin Documentation**
- **MUST** document plugin interface and requirements
- **MUST** provide development examples
- **MUST** maintain function calling schemas
- **MUST** document visualization capabilities

## 🔄 Git Workflow

### 1. **Branch Strategy**
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/*`: Individual feature development
- `bugfix/*`: Bug fixes
- `hotfix/*`: Critical production fixes

### 2. **Commit Standards**
- **MUST** use descriptive commit messages
- **MUST** reference issues/PRs when applicable
- **MUST** use conventional commit format:
  ```
  type(scope): description
  
  Examples:
  feat(chat): add improved search function calling
  fix(ui): resolve search results panel display
  docs(readme): update installation instructions
  ```

### 3. **Pull Request Requirements**
- **MUST** include comprehensive description
- **MUST** reference related issues
- **MUST** include testing information
- **MUST** update documentation when needed

## ⚡ Performance Guidelines

### 1. **File Processing**
- **MUST** implement progressive loading for files >10MB
- **MUST** use streaming for large genomic datasets
- **MUST** provide progress indicators for long operations
- **MUST** implement memory-efficient parsing

### 2. **Visualization Performance**
- **MUST** use SVG for scalable graphics
- **MUST** implement viewport-based rendering
- **MUST** optimize redraw operations
- **MUST** use hardware acceleration when available

### 3. **AI Integration Performance**
- **MUST** implement request throttling
- **MUST** cache frequently used results
- **MUST** provide fallback for offline operation
- **MUST** optimize system prompts for efficiency

## 🔒 Security Requirements

### 1. **Data Security**
- **MUST** validate all user inputs
- **MUST** sanitize file content before processing
- **MUST** implement secure file handling
- **MUST** protect API keys and sensitive configuration

### 2. **Plugin Security**
- **MUST** run plugins in sandboxed environment
- **MUST** validate plugin code before execution
- **MUST** limit plugin access to necessary resources
- **MUST** implement plugin permission system

### 3. **AI Integration Security**
- **MUST** secure API key storage
- **MUST** validate LLM responses
- **MUST** implement rate limiting
- **MUST** protect against prompt injection

## 📋 Development Checklist

Before submitting code, ensure:
- [ ] Follows modular architecture patterns
- [ ] Implements proper error handling
- [ ] Includes comprehensive documentation
- [ ] Tests critical functionality
- [ ] Validates performance impact
- [ ] Maintains security standards
- [ ] Updates relevant documentation
- [ ] Follows naming conventions
- [ ] Implements accessibility features
- [ ] Provides user feedback mechanisms

## 🚀 Deployment Rules

### 1. **Build Requirements**
- **MUST** test builds on all target platforms
- **MUST** validate all dependencies
- **MUST** include proper signing/notarization
- **MUST** verify installation packages

### 2. **Release Process**
- **MUST** update version numbers consistently
- **MUST** create comprehensive release notes
- **MUST** tag releases properly
- **MUST** update documentation for users

---

*These rules are living guidelines that should evolve with the project. When making significant architectural changes, update this document accordingly.* 