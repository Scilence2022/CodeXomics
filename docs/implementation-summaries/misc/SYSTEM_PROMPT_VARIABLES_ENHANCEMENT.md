# System Prompt Variables Enhancement

## 概述

GenomeExplorer系统现在支持更详细和全面的自定义系统提示词变量，特别增强了 `{current_state}` 和新增了 `{all_tools}` 变量。

## 增强的变量

### 1. `{current_state}` - 详细当前状态

**之前**: 简单的染色体和位置信息
```
Chromosome: chr1, Position: 1000-2000
```

**现在**: 全面的基因组浏览器状态信息
```
GENOME BROWSER CURRENT STATE:

NAVIGATION & POSITION:
- Current Chromosome: chr1
- Current Position: 1000-2000
- Position Range: 1,001 bp
- Sequence Length: 4,641,652 bp

DATA STATUS:
- Loaded Files: 2 file(s)
- Annotations Count: 4321
- User-defined Features: 5
- Visible Tracks: genes, annotations, gc_content

SYSTEM STATUS:
- MCP Servers Connected: 1 (GenomeExplorer-MCP)
- Plugin System: Active
- MicrobeGenomics Functions: Available

TOOL AVAILABILITY:
- Total Tools: 74
- Local Tools: 62
- Plugin Tools: 9
- MCP Tools: 23
```

### 2. `{all_tools}` - 全面工具文档 (新增)

这是一个全新的变量，提供完整的工具系统文档：

```
COMPREHENSIVE TOOLS DOCUMENTATION:

TOOL STATISTICS:
- Total Available Tools: 74
- Local/Built-in Tools: 62
- Plugin Tools: 9
- MCP Server Tools: 23

MCP SERVER TOOLS:
Connected Servers: 1
- GenomeExplorer-MCP (genomics): 23 tools

MCP Tools by Category:
NAVIGATION:
  - navigate_to_position: Navigate to specific chromosome position
  - jump_to_gene: Navigate to specific gene

SEARCH:
  - search_features: Search for genomic features
  - search_gene_by_name: Find genes by name

... (完整的工具列表和文档)

MICROBE GENOMICS FUNCTIONS:
SEQUENCE_ANALYSIS (Sequence analysis and manipulation):
  - analyzeSequence: Use as "analyze_sequence"
  - calculateGC: Use as "calculate_gc"
  - translateDNA: Use as "translate_dna"

... (完整的微生物基因组学功能)

PLUGIN SYSTEM TOOLS:
Total Plugin Functions: 9
Available Plugins: BiologicalNetworksPlugin, ComparativeGenomicsPlugin, MetabolicPathwaysPlugin
Function Categories: network-analysis, comparative-genomics, metabolic-analysis

... (完整的插件工具信息)

CORE LOCAL TOOLS:
Navigation & State:
  - navigate_to_position: Navigate to specific chromosome position
  - get_current_state: Get current browser state
  - jump_to_gene: Navigate to specific gene

... (所有本地工具的详细文档和使用示例)
```

### 3. `{microbe_functions}` - 增强的微生物基因组学功能信息

**之前**: 简单的可用性状态
```
Available
```

**现在**: 详细的功能分类和示例
```
MicrobeGenomics Functions: Available with 4 categories

CATEGORIES:
- sequence_analysis: Sequence analysis and manipulation (8 functions)
- gene_analysis: Gene-related analysis functions (6 functions)
- structural_analysis: Structural genomics analysis (4 functions)
- comparative_analysis: Comparative genomics tools (3 functions)

USAGE EXAMPLES:
1. Analyze gene regulatory regions
2. Calculate sequence composition metrics
3. Predict protein-coding regions
4. Compare genomic sequences
```

## 完整的可用变量列表

### 基本信息变量
- `{genome_info}` - 基因组基本信息
- `{current_chromosome}` - 当前染色体
- `{current_position}` - 当前位置范围
- `{loaded_files}` - 已加载文件摘要
- `{visible_tracks}` - 可见轨道列表
- `{annotations_count}` - 注释数量
- `{sequence_length}` - 序列长度
- `{user_features_count}` - 用户定义特征数量

### 工具系统变量
- `{all_tools}` - **[新增]** 全面的工具文档
- `{available_tools}` - 可用工具列表 (逗号分隔)
- `{all_available_tools}` - 可用工具列表 (每行一个)
- `{total_tools}` - 工具总数
- `{local_tools}` - 本地工具数量
- `{plugin_tools}` - 插件工具数量
- `{mcp_tools}` - MCP工具数量

### 系统状态变量
- `{current_state}` - **[增强]** 详细的当前状态
- `{mcp_servers}` - MCP服务器状态
- `{plugin_functions}` - 插件功能摘要
- `{microbe_functions}` - **[增强]** 微生物基因组学功能详情

### 时间变量
- `{timestamp}` - ISO时间戳
- `{date}` - 本地日期
- `{time}` - 本地时间

## 使用示例

### 自定义系统提示词示例

```
你是一个基因组分析助手。以下是当前系统状态：

{current_state}

你可以使用以下工具：
{all_tools}

请根据用户的请求使用合适的工具进行分析。总共有 {total_tools} 个工具可用，包括 {local_tools} 个本地工具、{plugin_tools} 个插件工具和 {mcp_tools} 个MCP工具。

微生物基因组学功能状态：
{microbe_functions}
```

### 处理后的结果

系统会自动将所有 `{variable_name}` 格式的变量替换为对应的详细内容，提供完整的上下文信息。

## 技术实现

### 核心方法

1. **`processSystemPromptVariables(systemPrompt)`** - 主要的变量处理方法
2. **`getDetailedCurrentState(context)`** - 生成详细状态信息
3. **`getAllToolsDetailed(context)`** - 生成全面工具文档
4. **`getMicrobeGenomicsFunctionsDetailed()`** - 生成微生物基因组学功能详情

### 数据来源

- **当前状态**: `getCurrentContext()` 方法获取的完整上下文
- **工具信息**: MCP服务器、插件系统、本地工具的综合信息
- **系统状态**: 各个管理器的实时状态信息

## 优势

1. **完整性**: 提供所有可用工具的详细文档
2. **实时性**: 反映当前系统的真实状态
3. **结构化**: 信息按类别组织，易于理解
4. **示例丰富**: 包含大量使用示例
5. **向后兼容**: 保持现有变量的功能

## 测试验证

系统已经过测试验证，确保：
- 所有变量正确替换
- 内容格式正确
- 信息准确完整
- 错误处理得当

这些增强大大提升了自定义系统提示词的功能性和实用性，使LLM能够获得完整的系统上下文和工具信息。 