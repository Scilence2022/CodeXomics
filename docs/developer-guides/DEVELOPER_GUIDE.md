# CodeXomics Developer Guide

## Table of Contents

1. [Development Setup](#development-setup)
2. [Project Architecture](#project-architecture)
3. [Core Systems](#core-systems)
4. [Plugin Development](#plugin-development)
5. [Tool Registry](#tool-registry)
6. [Testing](#testing)
7. [Contributing](#contributing)
8. [Release Process](#release-process)

---

## Development Setup

### Prerequisites

- **Node.js** >= 16.x
- **npm** >= 8.x
- **Git**
- Code editor (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics

# Install dependencies
npm install

# Run in development mode
npm start

# Run with MCP server (for advanced development)
npm run start-with-mcp
```

### Development Commands

```bash
# Start application
npm start                    # Normal mode
npm run dev                  # Development mode with debug

# Building
npm run build               # Build for current platform
npm run build:mac           # macOS
npm run build:win           # Windows
npm run build:linux         # Linux
npm run build:all           # All platforms

# Version management
npm run version-sync        # Sync versions across files
npm run version-validate    # Validate version consistency

# MCP server
npm run mcp-server          # Start MCP server
npm run codexomics-mcp-server   # Start CodeXomics MCP server
```

### Project Structure

```
CodeXomics/
├── src/
│   ├── main.js                    # Electron main process
│   ├── preload.js                 # Preload script
│   ├── version.js                 # Unified version management
│   ├── renderer/                  # Browser application
│   │   ├── index.html            # Main HTML
│   │   ├── renderer-modular.js   # Main application logic
│   │   ├── modules/              # Core modules
│   │   │   ├── ChatManager.js           # AI chat system
│   │   │   ├── FileManager.js           # File operations
│   │   │   ├── TrackRenderer.js         # Visualization engine
│   │   │   ├── NavigationManager.js     # Search & navigation
│   │   │   ├── ProjectManager.js        # Project management
│   │   │   ├── PluginManager.js         # Plugin system
│   │   │   ├── ExternalToolsManager.js  # External tools
│   │   │   ├── MultiAgentSettingsManager.js  # Multi-agent config
│   │   │   └── LLMConfigManager.js      # LLM configuration
│   │   └── styles/               # CSS files
│   ├── bioinformatics-tools/     # Specialized tools
│   │   ├── kgml-viewer.html      # KGML pathway viewer
│   │   ├── string-networks.html  # STRING networks
│   │   └── ...
│   ├── tests/                    # Test files
│   └── temp/                     # Temporary files
├── tools_registry/               # Dynamic tool registry
│   ├── registry_manager.js       # Core registry management
│   ├── system_integration.js     # System integration
│   ├── tool_categories.yaml      # Tool categorization
│   └── [category_dirs]/          # Tool definitions
├── docs/                         # Documentation
│   ├── user-guides/              # User documentation
│   ├── developer-guides/         # Developer documentation
│   ├── api-docs/                 # API reference
│   ├── fix-summaries/            # Implementation summaries
│   └── release-notes/            # Release notes
├── build/                        # Build resources
├── assets/                       # Static assets
├── scripts/                      # Build/utility scripts
├── package.json                  # NPM configuration
├── README.md                     # Main readme
├── CHANGELOG.md                  # Version changelog
└── PROJECT_RULES.md              # Development guidelines
```

---

## Project Architecture

### Electron Architecture

CodeXomics uses Electron's multi-process architecture:

**Main Process** (`src/main.js`)
- Creates browser windows
- Handles system-level operations
- Manages IPC (Inter-Process Communication)
- Controls external tool windows
- Manages file system access

**Renderer Process** (`src/renderer/`)
- User interface
- Genome visualization
- AI chat interface
- Tool interactions

**Preload Script** (`src/preload.js`)
- Bridge between main and renderer
- Exposes safe APIs to renderer
- Handles IPC communication

### Core Module System

**Modular Design:**
Each major feature is encapsulated in its own module:

```javascript
// Example module structure
class ModuleName {
    constructor() {
        this.initializeComponent();
    }
    
    initializeComponent() {
        // Setup code
    }
    
    // Public methods
    publicMethod() {
        // Implementation
    }
    
    // Private methods
    _privateMethod() {
        // Implementation
    }
}
```

**Key Modules:**

1. **ChatManager** - AI conversation handling
2. **FileManager** - File I/O operations
3. **TrackRenderer** - SVG-based visualization
4. **NavigationManager** - Genome navigation
5. **ProjectManager** - Project lifecycle
6. **PluginManager** - Plugin system
7. **ExternalToolsManager** - External tool integration
8. **LLMConfigManager** - LLM configuration
9. **MultiAgentSettingsManager** - Multi-agent coordination

---

## Core Systems

### Version Management System

CodeXomics uses a centralized version system in `src/version.js`:

```javascript
// src/version.js
const VERSION_MAJOR = 0;
const VERSION_MINOR = 522;
const VERSION_PATCH = 0;
const VERSION_PRERELEASE = 'beta';

const VERSION_INFO = {
    version: `${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}`,
    fullVersion: VERSION_PRERELEASE 
        ? `${VERSION_STRING}-${VERSION_PRERELEASE}` 
        : VERSION_STRING,
    displayVersion: VERSION_PRERELEASE 
        ? `v${VERSION_MAJOR}.${VERSION_MINOR}${VERSION_PRERELEASE}` 
        : `v${VERSION_MAJOR}.${VERSION_MINOR}`,
    // ... more properties
};
```

**Version Update Workflow:**

1. Update `package.json` and `src/version.js`
2. Run `npm run version-sync` to synchronize
3. Run `npm run version-validate` to verify
4. Commit changes

### AI Chat System

**Architecture:**

```
User Query
    ↓
ChatManager
    ↓
Multi-Agent Coordinator
    ↓
[Worker Agents]
    ↓
Tool Registry
    ↓
Tool Execution
    ↓
Result Aggregation
    ↓
Response to User
```

**Key Components:**

1. **ChatManager** - Handles user interactions
2. **Multi-Agent System** - Coordinates multiple AI agents
3. **Tool Registry** - Dynamic tool selection
4. **Function Calling** - Executes tools based on AI decisions

**Adding Chat Features:**

```javascript
// In ChatManager.js
class ChatManager {
    async handleUserMessage(message) {
        // 1. Pre-process message
        const processed = this.preprocessMessage(message);
        
        // 2. Get AI response
        const response = await this.getAIResponse(processed);
        
        // 3. Execute tool calls if needed
        const results = await this.executeToolCalls(response.toolCalls);
        
        // 4. Post-process and display
        this.displayResponse(results);
    }
}
```

### External Tools System

**Tool Configuration:**

```javascript
// src/renderer/modules/ExternalToolsManager.js
const builtinTools = {
    progenfixer: {
        name: 'ProGenFixer',
        url: 'https://progenfixer.biodesign.ac.cn',
        icon: 'fas fa-wrench',
        accelerator: 'CmdOrCtrl+Shift+P'
    },
    // ... more tools
};
```

**Adding New External Tool:**

1. **Add to ExternalToolsManager.js:**
```javascript
newtool: {
    name: 'New Tool',
    url: 'https://example.com',
    icon: 'fas fa-icon',
    accelerator: 'CmdOrCtrl+Shift+N'
}
```

2. **Add window creator in main.js:**
```javascript
function createNewToolWindow() {
    const window = new BrowserWindow({
        width: 1400,
        height: 900,
        title: 'New Tool',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    window.loadURL('https://example.com');
    return window;
}
```

3. **Add IPC handler:**
```javascript
ipcMain.on('open-newtool-window', () => {
    if (!newToolWindow || newToolWindow.isDestroyed()) {
        newToolWindow = createNewToolWindow();
    } else {
        newToolWindow.focus();
    }
});
```

4. **Add to menu:**
```javascript
{
    label: 'New Tool',
    accelerator: 'CmdOrCtrl+Shift+N',
    click: () => {
        mainWindow.webContents.send('open-newtool-window');
    }
}
```

### LLM Configuration System

**Multi-Location Synchronization:**

LLM models are configured in multiple locations:

1. **LLMConfigManager.js** - Main configuration logic
2. **index.html** - UI dropdowns
3. **MultiAgentSettingsManager.js** - Multi-agent settings
4. **ConfigManager.js** - Configuration persistence

**Important:** When adding new models, update ALL locations to maintain sync.

**Adding New LLM Provider:**

```javascript
// In LLMConfigManager.js
const availableModels = [
    // ... existing models
    {
        provider: 'newprovider',
        name: 'New Model Name',
        id: 'provider/model-id',
        supportsStreaming: true
    }
];

// In index.html
<optgroup label="🆕 New Provider">
    <option value="provider/model-id">New Model Name</option>
</optgroup>
```

---

## Plugin Development

### Plugin Structure

```javascript
// Example plugin template
const MyPlugin = {
    // Plugin metadata
    id: 'my-plugin',
    name: 'My Plugin',
    version: '1.0.0',
    description: 'Plugin description',
    author: 'Your Name',
    
    // Plugin functions (callable by AI)
    functions: {
        myFunction: {
            name: 'myFunction',
            description: 'Function description',
            parameters: {
                type: 'object',
                properties: {
                    param1: {
                        type: 'string',
                        description: 'Parameter description'
                    }
                },
                required: ['param1']
            },
            execute: async (params) => {
                // Function implementation
                return { result: 'success' };
            }
        }
    },
    
    // Plugin lifecycle
    initialize: async () => {
        console.log('Plugin initialized');
    },
    
    cleanup: async () => {
        console.log('Plugin cleaned up');
    }
};

// Register plugin
if (typeof window !== 'undefined' && window.PluginManager) {
    window.PluginManager.registerPlugin(MyPlugin);
}
```

### Plugin API

**Available APIs:**

```javascript
// Access genome data
const genomeData = window.GenomeData;

// Access file manager
const fileManager = window.FileManager;

// Access navigation
const navManager = window.NavigationManager;

// Access visualization
const trackRenderer = window.TrackRenderer;

// Display notifications
window.showNotification('Message', 'success');

// Open modal dialogs
window.openModal(title, content, options);
```

### Testing Plugins

```bash
# Place plugin in src/renderer/modules/Plugins/
# Restart application
# Plugin will auto-register

# Test with AI:
"Use my-plugin to analyze this sequence"
```

---

## Tool Registry

### Dynamic Tool Registry System

Located in `tools_registry/`, the tool registry provides intelligent tool selection for AI.

**Structure:**

```
tools_registry/
├── registry_manager.js           # Core management
├── system_integration.js         # Integration layer
├── tool_categories.yaml          # Metadata
└── [categories]/
    ├── navigation/               # Navigation tools
    ├── sequence/                 # Sequence analysis
    ├── protein/                  # Protein tools
    ├── database/                 # Database queries
    └── ...                       # More categories
```

### Adding New Tools

**1. Create tool definition:**

```javascript
// tools_registry/my_category/my_tool.js
module.exports = {
    name: 'myTool',
    category: 'my_category',
    description: 'Tool description',
    parameters: {
        type: 'object',
        properties: {
            param1: { type: 'string', description: 'Parameter 1' }
        },
        required: ['param1']
    },
    execute: async (params) => {
        // Implementation
        return { result: 'success' };
    }
};
```

**2. Update tool_categories.yaml:**

```yaml
categories:
  my_category:
    name: "My Category"
    description: "Category description"
    icon: "fas fa-icon"
    tools:
      - myTool
```

**3. Register in registry_manager.js:**

The tool will be automatically discovered and registered.

---

## Testing

### Test Structure

```
src/tests/
├── benchmark/                    # Benchmark tests
│   ├── AutomaticComplexSuite.js
│   ├── AutomaticSimpleSuite.js
│   ├── ManualSuite.js
│   └── test-data/
├── unit-tests/                   # Unit tests
├── integration-tests/            # Integration tests
└── fix-validation-tests/         # Bug fix verification
```

### Benchmark Tests

**Test Categories:**

1. **Navigation** - Browser navigation, position jumping
2. **Analysis** - Sequence analysis, GC content
3. **Data Loading** - File parsing, data validation
4. **Search** - Gene search, feature queries
5. **External DB** - API integration
6. **Workflows** - Multi-step processes

**Creating New Test:**

```javascript
// In appropriate suite file
const newTest = {
    id: 'test_unique_id',
    name: 'Test Name',
    category: 'category_name',
    type: 'automatic',  // or 'manual'
    complexity: 'simple',  // or 'complex'
    timeout: 30000,
    
    execute: async (llmClient, context) => {
        // Test implementation
        const result = await llmClient.sendMessage(
            "Test prompt",
            context
        );
        
        // Validation
        const success = validateResult(result);
        
        return {
            success,
            message: 'Test result message',
            details: { /* test details */ }
        };
    }
};
```

**Running Tests:**

```javascript
// In benchmark interface
BenchmarkManager.runTest(testId, config);
```

### Unit Testing

Create unit tests for individual modules:

```javascript
// Example unit test
describe('FileManager', () => {
    it('should load FASTA file', async () => {
        const data = await FileManager.loadFile('test.fasta');
        expect(data).toBeDefined();
        expect(data.sequence).toHaveLength(greaterThan(0));
    });
});
```

---

## Contributing

### Development Workflow

1. **Fork the repository**
2. **Create feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make changes following guidelines:**
   - Follow existing code style
   - Add JSDoc comments
   - Update relevant documentation
   - Add tests if applicable

4. **Test changes:**
   ```bash
   npm start  # Manual testing
   # Run benchmark tests if relevant
   ```

5. **Commit with conventional commits:**
   ```bash
   git commit -m "feat: add amazing feature"
   git commit -m "fix: resolve issue with X"
   git commit -m "docs: update readme"
   ```

6. **Push and create PR:**
   ```bash
   git push origin feature/amazing-feature
   # Create PR on GitHub
   ```

### Code Style Guidelines

**JavaScript:**
- Use ES6+ features
- 4-space indentation
- Semicolons required
- camelCase for variables/functions
- PascalCase for classes
- Descriptive variable names

**HTML:**
- Semantic HTML5
- Proper indentation
- Accessibility attributes

**CSS:**
- BEM naming convention
- Mobile-first approach
- CSS variables for theming

### Documentation Guidelines

**Code Documentation:**
```javascript
/**
 * Function description
 * @param {string} param1 - Parameter description
 * @param {Object} options - Options object
 * @param {boolean} options.flag - Option description
 * @returns {Promise<Object>} Return value description
 * @throws {Error} Error conditions
 */
async function myFunction(param1, options = {}) {
    // Implementation
}
```

**Markdown Documentation:**
- Clear headings
- Code examples
- Screenshots for UI features
- Links to related docs

### Pull Request Guidelines

**PR Title Format:**
```
type(scope): brief description

Examples:
feat(chat): add multi-agent coordination
fix(renderer): resolve track rendering issue  
docs(readme): update installation instructions
```

**PR Description:**
- What changes were made
- Why changes were necessary
- How to test changes
- Related issues/PRs
- Breaking changes (if any)

---

## Release Process

### Version Update Workflow

1. **Update version numbers:**
   ```javascript
   // src/version.js
   const VERSION_MINOR = 523;  // Increment
   const VERSION_PRERELEASE = null;  // or 'beta'
   ```

   ```json
   // package.json
   {
     "version": "0.523.0"
   }
   ```

2. **Synchronize versions:**
   ```bash
   npm run version-sync
   npm run version-validate
   ```

3. **Update CHANGELOG.md:**
   - Add new version section
   - List features, fixes, improvements
   - Link to PRs and issues

4. **Create release notes:**
   - Copy from docs/release-notes/template
   - Fill in version-specific information
   - Include upgrade instructions if needed

### Building Release

```bash
# Build for all platforms
npm run build:all

# Artifacts will be in dist/
# Upload to GitHub releases
```

### Creating GitHub Release

1. **Create and push tag:**
   ```bash
   git tag -a v0.523 -m "Release v0.523"
   git push origin v0.523
   ```

2. **Create release on GitHub:**
   - Go to Releases → Draft new release
   - Select tag
   - Add release notes
   - Upload build artifacts
   - Mark as pre-release if beta

3. **Announce release:**
   - GitHub Discussions
   - Update README badges
   - Social media (if applicable)

---

## Best Practices

### Performance

- Minimize DOM manipulations
- Use requestAnimationFrame for animations
- Lazy load large datasets
- Implement virtual scrolling for large lists
- Cache expensive computations

### Security

- Never expose API keys in code
- Validate all user inputs
- Sanitize HTML content
- Use CSP (Content Security Policy)
- Keep dependencies updated

### Debugging

**Enable Developer Tools:**
```javascript
// In main.js
mainWindow.webContents.openDevTools();
```

**Logging:**
```javascript
// Use consistent logging
console.log('[ModuleName]', 'Message', data);
console.error('[ModuleName]', 'Error:', error);
```

**Debugging AI:**
- Enable "Show Thinking" in ChatBox
- Check conversation evolution logs
- Review tool call parameters
- Examine benchmark test results

---

## Resources

### Internal Documentation
- [User Guide](../user-guides/USER_GUIDE.md)
- [API Reference](../api-docs/)
- [Fix Summaries](../fix-summaries/)
- [Project Rules](../../PROJECT_RULES.md)

### External Resources
- [Electron Documentation](https://www.electronjs.org/docs)
- [D3.js Documentation](https://d3js.org/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic Claude API](https://docs.anthropic.com/)

### Community
- [GitHub Issues](https://github.com/Scilence2022/CodeXomics/issues)
- [GitHub Discussions](https://github.com/Scilence2022/CodeXomics/discussions)
- [Contributing Guidelines](../../CONTRIBUTING.md)

---

**Happy Coding! 🚀**

CodeXomics Development Team
