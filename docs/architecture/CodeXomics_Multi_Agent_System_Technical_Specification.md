# CodeXomics Multi-Agent System: Comprehensive Technical Specification

## Executive Summary

This document provides an in-depth technical analysis of the CodeXomics project's multi-agent system, with specific focus on ChatBox integration, intelligent agents, and multi-agent coordination. The system represents a sophisticated biological data analysis platform built on an event-driven, priority-based multi-agent architecture that enables intelligent function execution optimization and real-time response to genomic data analysis requests.

---

## 1. Technical Architecture of the Multi-Agent System

### 1.1 System Overview

The CodeXomics multi-agent system follows a sophisticated event-driven architecture with centralized coordination and distributed agent execution. Based on deep code analysis, the system consists of **7 specialized agents** working in coordination:

- **NavigationAgent**: Browser navigation and genomic coordinate management
- **AnalysisAgent**: Sequence analysis and computational biology operations
- **DataAgent**: Data retrieval, storage, and export/import operations
- **CoordinatorAgent**: Task coordination, workflow management, and result integration
- **DeepResearchAgent**: Advanced research capabilities via Deep Research MCP server
- **ExternalAgent**: External API and service integration
- **PluginAgent**: Plugin system management and execution

The system is designed around several core architectural principles:

- **Event-Driven Communication**: All agents communicate through EventTarget-based event system
- **Tool Mapping Architecture**: Each agent registers its capabilities through a sophisticated tool mapping system
- **Resource-Aware Processing**: Dynamic resource allocation and monitoring across CPU, memory, network, and cache
- **Performance-Based Learning**: Agents collect execution metrics and optimize future performance
- **Priority-Based Execution**: Functions are categorized and executed based on strategic priority analysis

### 1.2 Core System Components

#### 1.2.1 MultiAgentSystem.js (Central Orchestrator)

The primary coordinator managing agent lifecycle, communication, and resource allocation:

```javascript
class MultiAgentSystem {
  constructor(chatManager, app) {
    this.chatManager = chatManager;
    this.app = app;
    this.agents = new Map();
    this.registeredAgents = new Set();
    this.resourceManager = new ResourceManager();
  }

  // Agent registration system
  registerAgent(agent) {
    if (agent instanceof AgentBase) {
      this.agents.set(agent.name, agent);
      this.registeredAgents.add(agent.name);
      console.log(`Agent registered: ${agent.name}`);
    }
  }
}
```

**Key Responsibilities:**

- Agent registration and lifecycle management (7 core agents)
- Communication protocols and event coordination
- Resource allocation and monitoring
- Task distribution and load balancing
- Performance analytics and optimization

**Registered Agents:**

- NavigationAgent (genomic coordinate navigation)
- AnalysisAgent (sequence analysis and computational biology)
- DataAgent (data management and storage)
- CoordinatorAgent (task coordination and workflow management)
- DeepResearchAgent (advanced research via MCP server)
- ExternalAgent (external API integration)
- PluginAgent (plugin system management)

#### 1.2.2 AgentBase.js (Base Agent Framework)

Provides the foundation class for all specialized agents with sophisticated tool mapping:

```javascript
class AgentBase {
  constructor(multiAgentSystem, name, capabilities = []) {
    this.multiAgentSystem = multiAgentSystem;
    this.name = name;
    this.capabilities = capabilities;

    // Event system
    this.eventTarget = new EventTarget();
    this.eventHandlers = new Map();

    // State management
    this.isActive = false;
    this.currentTasks = new Map();
    this.taskQueue = [];

    // Resource management
    this.resourceUsage = {
      cpu: 0,
      memory: 0,
      network: 0,
      cache: 0,
    };

    // Performance tracking
    this.performanceMetrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
    };

    // Tool mapping system
    this.toolMapping = new Map();
    this.learningData = new Map();
    this.optimizationRules = new Map();
  }
}
```

**Core Features:**

- Sophisticated event handling with EventTarget
- Tool mapping registration system for function execution
- Resource usage tracking and management
- Performance metrics collection and learning
- Task queue and execution state management
- Learning data accumulation for optimization

#### 1.2.3 SmartExecutor.js (Intelligent Execution Optimizer)

Analyzes function calls and creates optimized execution strategies with comprehensive metrics:

```javascript
class SmartExecutor {
  constructor(chatManager, organizer) {
    this.chatManager = chatManager;
    this.organizer = organizer;
    this.executionMetrics = {
      totalExecutions: 0,
      averageExecutionTime: 0,
      successRate: 0,
      categoryStats: new Map(),
    };
  }

  async smartExecute(userMessage, tools) {
    // 1. Normalize tool requests
    const toolRequests = this.normalizeToolRequests(tools);

    // 2. Analyze and create execution plan
    const optimization = await this.organizer.optimizeExecution(userMessage, toolRequests);

    // 3. Execute with strategy (parallel/sequential)
    const results = await this.executeWithStrategy(toolRequests, optimization.strategy);

    // 4. Generate comprehensive execution report
    return this.generateExecutionReport(results, optimization);
  }
}
```

**Key Capabilities:**

- Tool request normalization and validation
- Strategy-based execution planning (parallel vs sequential)
- Comprehensive performance metrics tracking
- Real-time feedback and optimization suggestions
- Category-specific execution statistics
- Error handling and fallback strategies

#### 1.2.4 FunctionCallsOrganizer.js (Execution Strategy Engine)

Manages function categorization and execution strategy optimization based on **10 core function categories**:

```javascript
class FunctionCallsOrganizer {
    constructor(chatManager) {
        this.functionCategories = {
            browserActions: {
                priority: 1,
                functions: ['navigate_to_position', 'get_current_state', 'scroll_left', ...]
            },
            dataRetrieval: {
                priority: 2,
                functions: ['get_sequence_data', 'get_gene_data', 'search_genes', ...]
            },
            sequenceAnalysis: {
                priority: 3,
                functions: ['get_sequence', 'translate_sequence', 'calculate_gc_content', ...]
            },
            sequenceAnalysis: { priority: 4, functions: [...] },
            externalAPI: { priority: 5, functions: [...] },
            pluginSystem: { priority: 6, functions: [...] },
            deepResearch: { priority: 7, functions: [...] },
            dataExport: { priority: 8, functions: [...] },
            systemControl: { priority: 9, functions: [...] },
            general: { priority: 10, functions: [...] }
        };
    }
}
```

**Category System (10 Categories):**

1. **browserActions**: Genomic coordinate navigation, browser state management
2. **dataRetrieval**: Sequence data, gene information, annotation retrieval
3. **sequenceAnalysis**: Sequence processing, translation, analysis
4. **sequenceAnalysis**: Advanced sequence operations
5. **externalAPI**: External service integration
6. **pluginSystem**: Plugin-based genomic analysis
7. **deepResearch**: Advanced research capabilities
8. **dataExport**: Data export and formatting
9. **systemControl**: System configuration and control
10. **general**: General-purpose functions

**Strategy Analysis Features:**

- Keyword-based request categorization
- Priority-based execution planning
- Parallel execution detection for independent functions
- Dependency analysis for sequential execution
- Performance optimization recommendations

### 1.3 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    MultiAgentSystem                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐       │
│  │ Agent        │  │ Resource     │  │ Task            │       │
│  │ Registry     │  │ Manager      │  │ Distribution    │       │
│  │ (7 Agents)   │  │              │  │                 │       │
│  └──────────────┘  └──────────────┘  └─────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
┌────────▼─────┐    ┌─────────▼──────┐    ┌──────▼─────────────┐
│ SmartExecutor│    │ FunctionCalls  │    │ Memory System      │
│ (Optimizer)  │    │ Organizer      │    │ (Multi-layer)      │
│              │    │ (10 Categories)│    │                    │
└─────────────┘    └────────────────┘    └────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────┐
    │           Agent Hierarchy               │
    │  ┌─────────────┐  ┌─────────────────┐   │
    │  │ Navigation  │  │ Analysis        │   │
    │  │ Agent       │  │ Agent           │   │
    │  └─────────────┘  └─────────────────┘   │
    │  ┌─────────────┐  ┌─────────────────┐   │
    │  │ Data        │  │ Coordinator     │   │
    │  │ Agent       │  │ Agent           │   │
    │  └─────────────┘  └─────────────────┘   │
    │  ┌─────────────┐  ┌─────────────────┐   │
    │  │ DeepResearch│  │ External        │   │
    │  │ Agent       │  │ Agent           │   │
    │  └─────────────┘  └─────────────────┘   │
    │              ┌─────────────────┐         │
    │              │ Plugin Agent    │         │
    │              └─────────────────┘         │
    └─────────────────────────────────────────┘
```

### 1.4 Data Flow Architecture

1. **User Request Processing**: ChatBox receives user input and extracts function calls
2. **Tool Mapping Resolution**: AgentBase instances resolve requests through registered tool mappings
3. **Strategy Analysis**: FunctionCallsOrganizer categorizes requests into 10 core function categories
4. **Agent Selection**: MultiAgentSystem identifies suitable agents based on tool mapping and capabilities
5. **Resource Allocation**: ResourceManager allocates system resources based on agent requirements
6. **Parallel/Sequential Execution**: SmartExecutor orchestrates execution based on strategy analysis
7. **Performance Tracking**: Agents collect metrics and update learning data for future optimization
8. **Result Integration**: Results are collected, validated, and integrated
9. **Memory Storage**: Processed results are stored in appropriate memory layers for future reference

### 1.5 Key Architectural Insights

**Tool Mapping Architecture**: Each agent registers its functions through a sophisticated tool mapping system that allows for dynamic function resolution and execution.

**Event-Driven Communication**: Agents communicate through EventTarget-based events, enabling loose coupling and scalable communication patterns.

**Performance Learning**: All agents collect execution metrics and update learning data for adaptive optimization of future requests.

**Resource-Aware Execution**: The system monitors CPU, memory, network, and cache usage to make intelligent execution decisions.

**Priority-Based Categorization**: Functions are automatically categorized into 10 priority levels for optimized execution planning.

### 2. Detailed Breakdown of All Functional Modules

### 2.1 Core Management Modules

#### 2.1.1 MultiAgentSettingsManager.js

**Purpose**: Comprehensive configuration management for LLM providers and system settings

**Key Features**:

- Support for 6 LLM providers (OpenAI, Anthropic, Google, DeepSeek, OpenRouter, SiliconFlow)
- Dynamic model selection with 50+ available models for 2024-2025
- Real-time configuration validation and API key management
- Settings persistence and synchronization

**Architecture**:

```javascript
class MultiAgentSettingsManager {
  constructor(configManager) {
    this.llmProviders = {
      openai: {
        models: {
          'gpt-4o': 'GPT-4o (Latest)',
          'gpt-4o-mini': 'GPT-4o-mini (Fast)',
          'gpt-4-turbo': 'GPT-4-turbo (Latest)',
          'gpt-3.5-turbo': 'GPT-3.5-turbo (Fast)',
        },
      },
      anthropic: {
        models: {
          'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet (Latest)',
          'claude-3-opus-20240229': 'Claude 3 Opus (Most Capable)',
          'claude-3-haiku-20240307': 'Claude 3 Haiku (Fast)',
        },
      },
      google: {
        models: {
          'gemini-2.0-flash-exp': 'Gemini 2.0 Flash (Latest)',
          'gemini-1.5-pro': 'Gemini 1.5 Pro (Latest)',
          'gemini-1.5-flash': 'Gemini 1.5 Flash (Latest)',
        },
      },
      deepseek: {
        models: {
          'deepseek-chat': 'DeepSeek Chat (Latest)',
          'deepseek-coder': 'DeepSeek Coder (Code Focused)',
        },
      },
      openrouter: {
        models: {
          // Access to 100+ models from multiple providers
        },
      },
      siliconflow: {
        models: {
          // Additional model options
        },
      },
    };
  }
}
```

#### 2.1.2 MemorySystem.js

**Purpose**: Multi-layer memory architecture supporting short, medium, and long-term storage

**Memory Layers**:

- **Short-term Memory**: Recent interactions (last 50 executions) with LRU eviction
- **Medium-term Memory**: Session-based context retention
- **Long-term Memory**: Persistent knowledge base
- **Semantic Memory**: Vector-based similarity matching with fuzzy search

**Key Methods**:

```javascript
class ShortTermMemory {
  store(key, data, context) {
    // Store with LRU eviction policy
  }

  retrieve(key) {
    // Fast retrieval with automatic cleanup
  }

  fuzzySearch(query, threshold) {
    // Similarity-based search with scoring
  }
}
```

### 2.2 Non-Multi-Agent Mode Support System

#### 2.2.1 System Mode Management Overview

CodeXomics系统采用智能双模式架构，默认运行在非Multi-Agent模式下，确保系统的稳定性和可用性。系统通过`agentSystemEnabled`开关实现模式间的无缝切换。

#### 2.2.2 ChatManager.js - 模式控制核心

```javascript
// 模式状态管理
this.agentSystemEnabled = false; // 默认非Multi-Agent模式

// 模式配置获取
const agentSystemEnabled = this.chatBoxSettingsManager.getSetting('agentSystemEnabled', false);

// 执行模式切换
const multiAgentEnabled = this.configManager.get('multiAgentSettings.multiAgentSystemEnabled', false);
```

**核心功能：**

- **智能模式检测**：自动检测并维护当前运行模式状态
- **直接工具执行**：当agent系统禁用时，提供直接的工具执行路径
- **Legacy连接支持**：提供向后兼容的MCP服务器连接方式
- **优雅降级机制**：在多Agent系统不可用时自动切换到传统模式

#### 2.2.3 ChatBoxSettingsManager.js - 用户界面设置

```javascript
// 默认设置包含非Multi-Agent模式配置
agentSystemEnabled: false,           // 禁用多Agent系统
agentAutoOptimize: true,             // 启用自动优化
agentShowInfo: true,                 // 显示Agent信息
agentMemoryEnabled: true,            // Agent内存系统
agentCacheEnabled: true,             // Agent缓存系统

// 模型选择设置（非Multi-Agent模式专用）
chatboxModelType: 'auto',            // 自动模型选择
chatboxLLMProvider: 'auto',          // 自动提供商选择
chatboxLLMModel: 'auto',             // 自动模型选择
chatboxLLMTemperature: 0.7,          // 响应创造性
chatboxLLMMaxTokens: 4000,           // 最大令牌数
chatboxLLMTimeout: 30,               // 请求超时
chatboxLLMUseSystemPrompt: true,     // 启用系统提示
chatboxLLMEnableFunctionCalling: true // 启用函数调用
```

**非Multi-Agent模式特性：**

- **单实例管理**：简化了用户界面配置和会话管理
- **直接LLM调用**：绕过Agent系统，直接与LLM提供商交互
- **快速响应**：减少了中间层的处理延迟
- **资源优化**：降低了系统资源消耗

#### 2.2.4 TrackRenderer.js - Legacy模式回退

```javascript
// Legacy模式处理逻辑
if (vcfFiles.length === 0) {
    // Fallback to legacy mode
    return this.createLegacyVariantTrack(chromosome);
}

// Legacy变体轨道创建
createLegacyVariantTrack(chromosome) {
    const { track, trackContent } = this.createTrackBase('variants', chromosome);

    // 检查变体数据可用性
    if (!this.genomeBrowser.currentVariants ||
        Object.keys(this.genomeBrowser.currentVariants).length === 0) {
        // 显示无数据消息
        const noDataMsg = this.createNoDataMessage(
            'No VCF file loaded. Load a VCF file to see variants.',
            'no-variants-message'
        );
        trackContent.appendChild(noDataMsg);
        return track;
    }

    // 获取并过滤变体
    const variants = this.genomeBrowser.currentVariants[chromosome] || [];
    const visibleVariants = this.filterFeaturesByViewport(variants, viewport);

    // 渲染变体元素
    if (visibleVariants.length > 0) {
        this.renderVariantElements(trackContent, visibleVariants, viewport);
    }

    return track;
}
```

**Legacy模式特性：**

- **向后兼容**：确保旧版本数据格式的完整支持
- **稳定渲染**：提供可靠的基因组数据可视化
- **错误恢复**：在高级功能失败时提供基础功能保障
- **性能优化**：legacy模式下的渲染性能优化

#### 2.2.5 BlastManager.js - 直接命令执行

```javascript
// 直接命令执行机制
async checkBlastInstallation() {
    try {
        // First try direct command execution
        const command = 'blastn -version';
        const result = await this.runCommand(command);

        // 解析版本信息
        const versionMatch = result.match(/blastn: ([\d.]+)/);
        if (versionMatch) {
            const installedVersion = versionMatch[1];
            this.config.installedBlastVersion = installedVersion;
            return true;
        }
    } catch (error) {
        // 启动回退检测机制
        return await this.tryFallbackBlastDetection();
    }
}

// 回退检测机制
async tryFallbackBlastDetection() {
    const commonPaths = [
        '/usr/local/bin/blastn',        // Unix系统安装
        '/usr/bin/blastn',              // 系统安装
        '/opt/homebrew/bin/blastn',     // Homebrew (Apple Silicon)
        '/opt/blast+/bin/blastn',       // 自定义安装
        'C:\\Program Files\\NCBI\\blast+\\bin\\blastn.exe' // Windows默认
    ];

    for (const blastPath of commonPaths) {
        try {
            const command = `"${blastPath}" -version`;
            const result = await this.runCommand(command);
            // 处理成功检测...
        } catch (error) {
            // 继续尝试下一个路径
            continue;
        }
    }
}
```

**直接执行特性：**

- **即时命令执行**：绕过复杂的配置和抽象层
- **智能路径检测**：自动发现系统中的BLAST+安装
- **环境变量管理**：自动设置BLASTDB等关键环境变量
- **错误恢复**：多层次的fallback机制确保可用性

#### 2.2.6 ActionManager.js - 安全执行复制

```javascript
// 已弃用的直接执行方法（仅用于兼容）
executeAction() {
    console.warn('DEPRECATED: Direct action execution without execution copy. ' +
                 'This method modifies data directly and should be avoided. ' +
                 'Use executeActionOnCopy() instead for safe execution.');
    // 直接数据修改逻辑（已弃用）
}

// 推荐的安全执行方法
executeActionOnCopy(action) {
    try {
        // 创建执行副本以保护原始数据
        const actionCopy = this.createSafeActionCopy(action);

        // 在副本上执行操作
        const result = this.executeActionSafely(actionCopy);

        // 应用成功的结果
        this.applyActionResult(result);

        return result;
    } catch (error) {
        console.error('Action execution failed:', error);
        throw error;
    }
}

// 位置调整逻辑
adjustPendingActionPositionsOnCopy(actions, modifications) {
    modifications.forEach(mod => {
        const { type, position, length, newContent } = mod;

        actions.forEach(action => {
            if (action.position >= position) {
                switch (type) {
                    case 'insertion':
                        action.position += newContent.length;
                        break;
                    case 'deletion':
                        // 标记已删除区域的目标操作
                        if (action.position >= position + length) {
                            action.position -= length;
                        }
                        break;
                    case 'replacement':
                        const netChange = newContent.length - length;
                        if (action.position >= position + length) {
                            action.position += netChange;
                        }
                        break;
                }
            }
        });
    });
}
```

**安全执行特性：**

- **数据保护**：通过副本执行防止原始数据损坏
- **位置管理**：智能处理操作位置的动态调整
- **事务性执行**：确保操作的一致性和原子性
- **错误隔离**：执行失败不影响系统其他部分

### 2.2 Specialized Agent Modules (7 Agents)

#### 2.2.1 NavigationAgent.js

**Purpose**: Browser navigation and UI state management for genomic data visualization

**Capabilities**:

- Genomic coordinate navigation (chromosome, start, end)
- Gene jumping operations
- View manipulation (zoom in/out, scroll)
- Track management and visibility control
- Bookmark management and state persistence

**Key Functions**:

```javascript
navigate_to_position(chromosome, start, end);
jump_to_gene(geneName);
(zoom_in(factor), zoom_out(factor));
(scroll_left(amount), scroll_right(amount));
toggle_track(trackName, visible);
get_current_state();
bookmark_position(name);
load_bookmark(bookmarkId);
```

#### 2.2.2 AnalysisAgent.js

**Purpose**: Sequence analysis and computational biology functions

**Analysis Categories**:

- **Sequence Operations**: Translation, reverse complement, GC content
- **Statistical Analysis**: Entropy, melting temperature, molecular weight
- **Predictive Analysis**: Promoter, RBS, terminator prediction
- **Comparative Analysis**: Region comparison, similarity search
- **Restriction Analysis**: Site finding, virtual digestion

**Key Methods**:

```javascript
get_sequence(chromosome, start, end);
translate_sequence(sequence, frame);
calculate_gc_content(sequence);
reverse_complement(sequence);
predict_promoter(sequence);
find_restriction_sites(sequence);
```

#### 2.2.3 DataAgent.js

**Purpose**: Data retrieval and manipulation operations

**Data Operations**:

- Genomic data extraction and retrieval
- Feature searching and filtering
- File loading and parsing
- Data export operations
- Cross-referencing operations

**Key Functions**:

```javascript
get_sequence_data(chromosome, start, end);
get_gene_data(geneName);
search_genes(searchTerm);
load_genome_file(filePath);
export_data(format, data);
get_annotations(region);
```

#### 2.2.4 CoordinatorAgent.js

**Purpose**: Task coordination and workflow management

**Coordination Functions**:

- Task decomposition and assignment
- Result integration and aggregation
- Load balancing across agents
- Error recovery and fallback handling
- Workflow optimization and monitoring

#### 2.2.5 DeepResearchAgent.js

**Purpose**: Advanced research capabilities and complex analysis workflows

**Research Functions**:

- Multi-step analysis pipelines
- Cross-platform data integration
- Advanced statistical analysis
- Hypothesis testing workflows
- Literature integration and research session management
- MCP server connection management

**Key Capabilities**:

```javascript
start_research_session(topic, parameters);
integrate_multiple_sources(dataSources);
generate_research_report(analysis);
connect_mcp_server(serverConfig);
manage_research_workflow(workflow);
```

#### 2.2.6 ExternalAgent.js

**Purpose**: External API integration and third-party service access

**Integration Types**:

- BLAST search services
- UniProt database access
- AlphaFold structure retrieval
- Phylogenetic analysis services
- Cloud-based computational platforms
- Third-party genomic analysis tools

#### 2.2.7 PluginAgent.js

**Purpose**: Plugin system integration and dynamic function loading

**Plugin Categories**:

- Genomic analysis plugins
- Phylogenetic analysis plugins
- Machine learning plugins
- Network analysis plugins
- Custom analysis tools
- Plugin system V2 with enhanced capabilities

### 2.3 Utility and Support Modules

#### 2.3.1 SmartExecutor.js

**Function**: Intelligent execution optimization and performance monitoring

**Optimization Strategies**:

- Priority-based execution ordering
- Parallel vs sequential execution decisions based on function analysis
- Resource-aware scheduling with automatic fallback
- Performance-based adaptation using learning data
- Tool normalization and request optimization

**Key Capabilities**:

```javascript
async smartExecute(userMessage, tools) {
    // 1. Normalize tool requests
    const toolRequests = this.normalizeToolRequests(tools);

    // 2. Analyze and create execution plan
    const optimization = await this.organizer.optimizeExecution(userMessage, toolRequests);

    // 3. Execute with strategy (parallel/sequential)
    const results = await this.executeWithStrategy(toolRequests, optimization.strategy);

    // 4. Generate comprehensive execution report
    return this.generateExecutionReport(results, optimization);
}
```

#### 2.3.2 FunctionCallsOrganizer.js

**Function**: Function categorization and execution strategy formulation

**Function Categories** (10 core categories):

1. **browserActions** (Priority 1): Immediate UI responses and navigation
2. **dataRetrieval** (Priority 2): Quick data access and retrieval
3. **sequenceAnalysis** (Priority 3): Basic computational sequence analysis
4. **advancedAnalysis** (Priority 4): Advanced sequence operations and complex analysis
5. **externalAPI** (Priority 5): Network-dependent operations and third-party services
6. **pluginSystem** (Priority 6): Plugin-based functions and dynamic loading
7. **deepResearch** (Priority 7): Research capabilities and literature integration
8. **dataExport** (Priority 8): File operations, export, and formatting
9. **systemControl** (Priority 9): System configuration and management
10. **general** (Priority 10): General-purpose and utility functions

**Specific Functions by Category**:

```javascript
functionCategories = {
  browserActions: {
    priority: 1,
    functions: [
      'navigate_to_position',
      'jump_to_gene',
      'zoom_in',
      'zoom_out',
      'scroll_left',
      'scroll_right',
      'toggle_track',
      'get_current_state',
      'bookmark_position',
      'load_bookmark',
    ],
  },
  dataRetrieval: {
    priority: 2,
    functions: [
      'get_sequence_data',
      'get_gene_data',
      'search_genes',
      'load_genome_file',
      'get_annotations',
      'get_track_data',
    ],
  },
  sequenceAnalysis: {
    priority: 3,
    functions: [
      'get_sequence',
      'translate_sequence',
      'calculate_gc_content',
      'reverse_complement',
      'basic_sequence_stats',
    ],
  },
  advancedAnalysis: {
    priority: 4,
    functions: ['predict_promoter', 'find_restriction_sites', 'melting_temperature', 'molecular_weight_calc'],
  },
  externalAPI: {
    priority: 5,
    functions: ['blast_search', 'uniprot_lookup', 'alphafold_retrieval', 'phylogenetic_analysis', 'ncbi_search'],
  },
  pluginSystem: {
    priority: 6,
    functions: [
      'load_plugin',
      'execute_plugin',
      'plugin_visualization',
      'custom_analysis_tool',
      'dynamic_function_call',
    ],
  },
  deepResearch: {
    priority: 7,
    functions: [
      'start_research_session',
      'integrate_multiple_sources',
      'generate_research_report',
      'literature_integration',
    ],
  },
  dataExport: {
    priority: 8,
    functions: ['export_data', 'save_results', 'format_output', 'generate_report', 'download_file'],
  },
  systemControl: {
    priority: 9,
    functions: ['configure_settings', 'manage_memory', 'clear_cache', 'system_status', 'resource_monitoring'],
  },
  general: {
    priority: 10,
    functions: ['help', 'info', 'version', 'status_check', 'utility_function', 'debug_operation'],
  },
};
```

**Strategy Analysis Features**:

- **Keyword-based Request Categorization**: Automatic function classification based on user input analysis
- **Priority-based Execution Planning**: Execution ordering based on function priority levels
- **Parallel Execution Detection**: Identifies independent functions that can run concurrently
- **Dependency Analysis**: Determines sequential execution requirements for dependent functions
- **Performance Optimization**: Recommendations based on historical execution data
- **Execution Strategy Reporting**: Detailed metrics and optimization suggestions

**Function-to-Category Mapping System**:

```javascript
// Dynamic function-to-category mapping with fallback strategies
functionToCategory = new Map([
  // Browser Actions
  ['navigate_to_position', 'browserActions'],
  ['jump_to_gene', 'browserActions'],
  ['zoom_in', 'browserActions'],
  ['scroll_left', 'browserActions'],

  // Data Retrieval
  ['get_sequence_data', 'dataRetrieval'],
  ['load_genome_file', 'dataRetrieval'],
  ['search_genes', 'dataRetrieval'],

  // Sequence Analysis
  ['get_sequence', 'sequenceAnalysis'],
  ['translate_sequence', 'sequenceAnalysis'],
  ['calculate_gc_content', 'sequenceAnalysis'],

  // Advanced Analysis
  ['predict_promoter', 'advancedAnalysis'],
  ['find_restriction_sites', 'advancedAnalysis'],

  // External APIs
  ['blast_search', 'externalAPI'],
  ['uniprot_lookup', 'externalAPI'],
  ['alphafold_retrieval', 'externalAPI'],

  // Plugin System
  ['load_plugin', 'pluginSystem'],
  ['execute_plugin', 'pluginSystem'],

  // Deep Research
  ['start_research_session', 'deepResearch'],
  ['integrate_multiple_sources', 'deepResearch'],

  // Data Export
  ['export_data', 'dataExport'],
  ['save_results', 'dataExport'],

  // System Control
  ['configure_settings', 'systemControl'],
  ['manage_memory', 'systemControl'],

  // General
  ['help', 'general'],
  ['info', 'general'],
  ['status_check', 'general'],
]);

// Fuzzy matching for unknown functions
function categorizeUnknownFunction(functionName) {
  const keywords = {
    browserActions: ['navigate', 'jump', 'zoom', 'scroll', 'track', 'view'],
    dataRetrieval: ['get_', 'load_', 'search_', 'fetch_', 'retrieve'],
    sequenceAnalysis: ['sequence', 'translate', 'gc_', 'complement'],
    advancedAnalysis: ['predict', 'analyze_', 'restriction', 'melting'],
    externalAPI: ['blast', 'uniprot', 'alphafold', 'ncbi', 'external'],
    pluginSystem: ['plugin', 'dynamic_', 'custom_'],
    deepResearch: ['research', 'literature', 'integrate_'],
    dataExport: ['export', 'save_', 'download', 'format_'],
    systemControl: ['configure', 'settings', 'memory', 'cache', 'status'],
    general: ['help', 'info', 'version', 'utility', 'debug'],
  };

  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(keyword => functionName.includes(keyword))) {
      return category;
    }
  }

  return 'general'; // Default fallback
}
```

### 2.4 Non-Multi-Agent Mode Specialized Components

#### 2.4.1 MicrobeGenomicsFunctions.js - 轻量级基因组学功能包装器

**Purpose**: 简化非Multi-Agent模式下的基础基因组学分析操作，提供轻量级的功能入口

**核心功能分类**:

- **导航功能**: 基因组浏览器基本操作
- **分析功能**: 序列分析和计算生物学
- **统计功能**: DNA序列统计分析

**关键方法实现**:

```javascript
// 导航功能
navigateTo(position) {
    // 轻量级导航实现，支持基本位置跳转
    if (this.isUnifiedModuleAvailable()) {
        return this.unifiedModule.navigateTo(position);
    }
    // 降级到legacy实现
    return this.legacyNavigateTo(position);
}

jumpToGene(geneName) {
    // 快速基因跳转功能
    try {
        return this.unifiedModule.jumpToGene(geneName);
    } catch (error) {
        // 优雅降级处理
        return this.fallbackGeneSearch(geneName);
    }
}

// 序列分析功能
translateDNA(sequence, frame = 0) {
    // 统一模块检查
    if (this.isUnifiedModuleAvailable()) {
        return this.unifiedModule.translateDNA(sequence, frame);
    }

    // 基础密码子表实现
    const standardCodonTable = {
        'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
        'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
        // ... 完整密码子表
    };

    let protein = '';
    for (let i = frame; i < sequence.length - 2; i += 3) {
        const codon = sequence.substring(i, i + 3);
        protein += standardCodonTable[codon] || 'X';
    }
    return protein;
}

findORFs(sequence) {
    // 6个阅读框的ORF查找
    const orfs = [];
    const startCodon = 'ATG';
    const stopCodons = ['TAA', 'TAG', 'TGA'];

    for (let frame = 0; frame < 3; frame++) {
        // 正向阅读框
        this.scanReadingFrame(sequence, frame, true, orfs);
        // 反向阅读框
        this.scanReadingFrame(sequence, frame, false, orfs);
    }

    return orfs;
}

// 统计功能
calculateEntropy(sequence) {
    // Shannon熵计算
    const frequency = {};
    for (let i = 0; i < sequence.length; i++) {
        const base = sequence[i];
        frequency[base] = (frequency[base] || 0) + 1;
    }

    let entropy = 0;
    const total = sequence.length;
    for (const base in frequency) {
        const p = frequency[base] / total;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

calcRegionGC(chromosome, start, end) {
    // 基因组区域GC含量计算
    const sequence = this.getSequence(chromosome, start, end);
    let gcCount = 0;

    for (const base of sequence) {
        if (base === 'G' || base === 'C') {
            gcCount++;
        }
    }

    return (gcCount / sequence.length) * 100;
}

calculateMeltingTemp(sequence) {
    // DNA熔解温度估算（简化模型）
    const gcContent = this.calculateGCContent(sequence);
    const length = sequence.length;

    // Wallace规则 + GC含量修正
    let tm = 2 * (sequence.match(/[AT]/g) || []).length +
             4 * (sequence.match(/[GC]/g) || []).length;

    // 长序列修正
    if (length > 14) {
        tm = 64.9 + 41 * (gcContent - 16.4) / length;
    }

    return tm;
}
```

**非Multi-Agent模式特性**:

- **轻量级实现**: 避免复杂的代理协调和通信开销
- **即时响应**: 直接执行操作，减少中间层处理
- **内存效率**: 单实例模式降低内存占用
- **稳定可靠**: 降级机制确保基础功能始终可用

#### 2.4.2 BenchmarkManager.js - LLM基准测试管理

**Purpose**: 管理和执行LLM提供商性能基准测试，支持多模型评估和比较

**基准测试套件**:

```javascript
// 测试套件初始化
async initializeBenchmark() {
    try {
        // 加载测试套件
        this.automaticSimpleSuite = new AutomaticSimpleSuite();
        this.automaticComplexSuite = new AutomaticComplexSuite();
        this.manualSuite = new ManualSuite();

        // 创建框架和UI
        this.framework = new LLMBenchmarkFramework();
        this.benchmarkUI = new BenchmarkUI();

        // 注册套件
        this.framework.registerSuite('automaticSimple', this.automaticSimpleSuite);
        this.framework.registerSuite('automaticComplex', this.automaticComplexSuite);
        this.framework.registerSuite('manual', this.manualSuite);

        return true;
    } catch (error) {
        console.error('Benchmark initialization failed:', error);
        return false;
    }
}

// 直接执行模式
async runDirectBenchmark(modelConfig) {
    // 非Multi-Agent模式下的直接基准测试
    const testSuite = this.selectOptimalTestSuite(modelConfig);

    try {
        // 直接LLM调用，绕过Agent系统
        const result = await this.framework.runDirectTest(modelConfig, testSuite);

        // 即时结果处理
        this.handleBenchmarkResult(result);

        return result;
    } catch (error) {
        // 降级到基础测试
        return this.runFallbackBenchmark(modelConfig);
    }
}
```

**基准测试流程**:

- **测试套件选择**: 根据模型类型和配置自动选择最合适的测试套件
- **直接执行模式**: 在非Multi-Agent模式下提供直接的基准测试执行
- **实时结果监控**: 实时显示测试进度和结果
- **性能指标分析**: 多维度性能评估和比较

**关键特性**:

- **模型兼容性**: 支持50+个不同模型的性能测试
- **标准化评估**: 一致的评估标准和指标
- **性能比较**: 多模型横向对比分析
- **结果可视化**: 直观的结果展示和报告生成

#### 2.4.3 NavigationManager.js - 传统导航管理

**Purpose**: 提供传统的基因组导航功能，兼容早期版本的数据格式

**Legacy导航支持**:

```javascript
// Legacy轨道处理
async loadTrack(trackData) {
    // Fallback for tracks without fileId (legacy reads tracks)
    if (!trackData.fileId) {
        return this.loadLegacyTrack(trackData);
    }

    // 优先使用现代轨道系统
    return await this.loadModernTrack(trackData);
}

loadLegacyTrack(trackData) {
    // 传统轨道数据处理
    const legacyData = this.parseLegacyFormat(trackData);
    return this.renderLegacyTrack(legacyData);
}

// 导航状态管理
getNavigationState() {
    // 返回当前导航状态
    return {
        chromosome: this.currentChromosome,
        position: this.currentPosition,
        zoom: this.currentZoom,
        visibleTracks: this.getVisibleTracks()
    };
}
```

**兼容性特性**:

- **格式兼容**: 支持多种旧版本数据格式
- **数据降级**: 自动处理格式不兼容的情况
- **性能优化**: 传统模式的性能优化处理
- **错误恢复**: 导航错误的自动恢复机制

### 2.5 双模式架构优势

#### 2.5.1 性能对比分析

| 特性           | Multi-Agent模式      | 非Multi-Agent模式    |
| -------------- | -------------------- | -------------------- |
| **响应速度**   | 中等（代理协调延迟） | 快速（直接执行）     |
| **资源消耗**   | 高（多个代理实例）   | 低（单实例）         |
| **功能复杂度** | 高（智能协作）       | 中（直接操作）       |
| **错误恢复**   | 强（多层代理保护）   | 基础（直接fallback） |
| **学习能力**   | 强（记忆系统）       | 弱（无记忆）         |
| **扩展性**     | 高（模块化代理）     | 中（功能固定）       |

#### 2.5.2 使用场景建议

**推荐使用Multi-Agent模式的场景**:

- 复杂的多步骤分析工作流
- 需要智能协作的综合性任务
- 长期项目研究和知识积累
- 高精度要求的科学分析

**推荐使用非Multi-Agent模式的场景**:

- 快速数据查询和基础分析
- 资源受限环境下的操作
- 稳定的生产环境使用
- 用户培训和演示场景

#### 2.5.3 模式切换机制

```javascript
class ModeManager {
  async switchMode(targetMode) {
    const currentMode = this.getCurrentMode();

    if (currentMode === targetMode) {
      return; // 已是目标模式
    }

    // 保存当前状态
    const state = this.captureCurrentState();

    // 优雅关闭当前模式
    await this.gracefulShutdown(currentMode);

    // 初始化目标模式
    await this.gracefulStartup(targetMode, state);

    // 验证切换成功
    if (this.getCurrentMode() === targetMode) {
      console.log(`Successfully switched to ${targetMode} mode`);
      return true;
    }

    return false;
  }
}
```

## 3. 系统架构详细设计

### 3.1 核心管理模块详解

#### 3.1.1 ConfigurationManager.js - 配置管理核心

**Configuration Hierarchy**:

1. **System Defaults** (系统默认配置)
2. **User Preferences** (用户偏好设置)
3. **Session Configurations** (会话特定配置)
4. **Runtime Overrides** (运行时覆盖配置)

**Configuration Schema**:

```javascript
const configSchema = {
  mode: {
    type: 'string',
    enum: ['multi-agent', 'single-agent', 'legacy'],
    default: 'single-agent',
    description: '系统运行模式',
  },
  agents: {
    enabled: { type: 'boolean', default: false },
    maxConcurrent: { type: 'number', default: 5 },
    memorySize: { type: 'string', default: '100MB' },
  },
  llm: {
    provider: { type: 'string', default: 'auto' },
    model: { type: 'string', default: 'gpt-3.5-turbo' },
    temperature: { type: 'number', default: 0.7, min: 0, max: 2 },
  },
};
```

#### 3.1.2 MemorySystem.js - 高级内存架构

**Memory Hierarchy Implementation**:

```javascript
class MultiLayerMemorySystem {
  constructor() {
    this.shortTerm = new ShortTermMemory({
      maxEntries: 1000,
      ttl: 3600000, // 1小时
      evictionPolicy: 'LRU',
    });

    this.mediumTerm = new MediumTermMemory({
      maxEntries: 500,
      ttl: 86400000, // 24小时
      compressionEnabled: true,
    });

    this.longTerm = new LongTermMemory({
      maxEntries: 100,
      persistent: true,
      vectorSearchEnabled: true,
    });
  }
}
```

## 4. 技术实现细节

### 4.1 代理间通信机制

#### 4.1.1 事件驱动通信

**事件系统架构**:

```javascript
class AgentCommunicationBus {
  constructor() {
    this.eventEmitter = new EventEmitter();
    this.messageQueue = new MessageQueue();
    this.subscriptionManager = new SubscriptionManager();
  }

  // 发布事件
  publish(eventType, data, sourceAgent) {
    const event = {
      id: generateUniqueId(),
      type: eventType,
      data: data,
      source: sourceAgent,
      timestamp: Date.now(),
    };

    this.messageQueue.enqueue(event);
    this.eventEmitter.emit(eventType, event);
  }

  // 订阅事件
  subscribe(eventType, callback, targetAgent) {
    const subscription = {
      eventType,
      callback,
      targetAgent,
      filters: this.createEventFilters(targetAgent),
    };

    return this.subscriptionManager.add(subscription);
  }
}
```

### 4.2 性能监控和优化

#### 4.2.1 实时性能监控

**性能指标收集**:

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.alerts = new AlertManager();
  }

  recordAgentPerformance(agentId, operation, duration, success) {
    const metric = {
      agentId,
      operation,
      duration,
      success,
      timestamp: Date.now(),
    };

    this.updateMetrics(metric);
    this.checkThresholds(agentId, operation, duration);
  }

  generatePerformanceReport() {
    return {
      averageResponseTime: this.calculateAverageResponseTime(),
      successRate: this.calculateSuccessRate(),
      resourceUtilization: this.getResourceUtilization(),
      agentHealth: this.getAgentHealthStatus(),
    };
  }
}
```
