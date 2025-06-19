# Custom System Prompt Tool Integration Fix

## 问题描述

当用户在LLM配置中设置Custom System Prompt时，系统只提供简化的工具信息，而不是完整的74个工具上下文。这导致：

### 修复前的问题：
1. **工具信息不完整**：自定义提示词只能看到简化的工具列表
2. **功能受限**：缺少MCP服务器、MicrobeGenomicsFunctions、插件系统的详细信息
3. **用户体验不一致**：默认系统消息与自定义提示词的工具可见性不同

### 对比分析：

**默认系统消息（无自定义提示词）**：
```
Connected MCP Servers: 1
- Genome AI Studio (genomics): 23 tools

MCP Tools by Category:
GENOMICS:
  - navigate_to_position (Genome AI Studio): Navigate to a specific genomic position
  - search_features (Genome AI Studio): Search for genes or features by name or sequence
  ...23个详细的MCP工具...

Available Tools Summary:
- Total Available Tools: 74
- Local Tools: 74
- Plugin Tools: 0
- MCP Tools: 23

All Available Tools:
- navigate_to_position
- get_current_state
...74个完整工具列表...

MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
NAVIGATION (Functions to move around the genome and change view):
  - navigateTo: Use as "navigateto"
  - jumpToGene: Use as "jumptogene"
...详细的微生物基因组学功能说明...

PLUGIN SYSTEM FUNCTIONS:
Available Plugin Functions:
- genomic-analysis.analyzeGCContent
- phylogenetic-analysis.buildPhylogeneticTree
...完整的插件功能列表...
```

**修复前的自定义提示词**：
```
AVAILABLE TOOLS SUMMARY:
- Total Available Tools: 74
- Local Tools: 74
- Plugin Tools: 0
- MCP Tools: 23

KEY TOOLS BY CATEGORY:
Navigation & State: navigate_to_position, get_current_state, jump_to_gene, zoom_to_gene
Search & Discovery: search_features, search_gene_by_name, search_sequence_motif
...仅显示工具类别概要...
```

## 修复方案

### 1. 创建 `getCompleteToolContext()` 方法

新方法包含与默认系统消息相同的完整工具上下文：

```javascript
getCompleteToolContext() {
    const context = this.getCurrentContext();
    
    // 获取MCP服务器信息
    const mcpServers = this.mcpServerManager.getServerStatus();
    const connectedServers = mcpServers.filter(s => s.connected);
    
    // 获取MicrobeGenomicsFunctions信息
    let microbeGenomicsInfo = '';
    if (this.MicrobeFns) {
        const categories = this.MicrobeFns.getFunctionCategories();
        const examples = this.MicrobeFns.getUsageExamples();
        // 构建完整的微生物基因组学功能说明
    }
    
    // 获取插件系统信息
    const pluginSystemInfo = this.getPluginSystemInfo();
    
    return `完整的工具上下文信息...`;
}
```

### 2. 修改 `buildSystemMessage()` 方法

```javascript
buildSystemMessage() {
    const userSystemPrompt = this.configManager.get('llm.systemPrompt', '');
    
    if (userSystemPrompt && userSystemPrompt.trim()) {
        const processedPrompt = this.processSystemPromptVariables(userSystemPrompt);
        // 使用完整的工具上下文，而不是简化版本
        return `${processedPrompt}\n\n${this.getCompleteToolContext()}`;
    }
    
    return this.getBaseSystemMessage();
}
```

### 3. 增强变量替换功能

添加新的变量供自定义提示词使用：

```javascript
const variables = {
    // 原有变量
    genome_info: this.getGenomeInfoSummary(),
    current_state: this.getCurrentStateSummary(context),
    
    // 新增工具相关变量
    total_tools: context.genomeBrowser.toolSources.total,
    local_tools: context.genomeBrowser.toolSources.local,
    plugin_tools: context.genomeBrowser.toolSources.plugins,
    mcp_tools: context.genomeBrowser.toolSources.mcp,
    all_available_tools: context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n'),
    microbe_functions: this.MicrobeFns ? 'Available' : 'Not Available',
    
    // 其他变量
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    time: new Date().toLocaleTimeString()
};
```

## 修复效果

### 修复后的自定义提示词现在包含：

1. **完整的基因组浏览器状态**：
   ```
   Current Genome AI Studio State:
   - Current chromosome: COLI-K12
   - Current position: {"start":0,"end":10000}
   - Visible tracks: None
   - Loaded files: 0 files
   - Sequence length: 0
   - Annotations count: undefined
   - User-defined features: 0
   ```

2. **详细的MCP服务器信息**：
   ```
   Connected MCP Servers: 1
   - Genome AI Studio (genomics): 23 tools

   MCP Tools by Category:
   GENOMICS:
     - navigate_to_position (Genome AI Studio): Navigate to a specific genomic position
     - search_features (Genome AI Studio): Search for genes or features by name or sequence
     ...23个完整的MCP工具描述...
   ```

3. **完整的工具统计**：
   ```
   Available Tools Summary:
   - Total Available Tools: 74
   - Local Tools: 74
   - Plugin Tools: 0
   - MCP Tools: 23

   All Available Tools:
   - navigate_to_position
   - get_current_state
   - get_current_region
   ...74个完整工具列表...
   ```

4. **详细的MicrobeGenomicsFunctions**：
   ```
   MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
   NAVIGATION (Functions to move around the genome and change view):
     - navigateTo: Use as "navigateto"
     - jumpToGene: Use as "jumptogene"
     - getCurrentRegion: Use as "getcurrentregion"
   ...完整的功能分类和使用说明...
   ```

5. **插件系统功能**：
   ```
   PLUGIN SYSTEM FUNCTIONS:
   Available Plugin Functions:
   - genomic-analysis.analyzeGCContent: Analyze GC content in genomic regions
   - phylogenetic-analysis.buildPhylogeneticTree: Build phylogenetic tree from sequences
   ...完整的插件功能列表...
   ```

6. **详细的工具使用示例**：
   - 基础工具示例
   - MicrobeGenomicsFunctions示例
   - BLAST搜索示例
   - 蛋白质结构工具示例
   - 代谢途径分析示例

## 用户可用的变量

用户现在可以在自定义系统提示词中使用以下变量：

```
{genome_info} - 基因组信息概要
{current_state} - 当前浏览器状态
{current_chromosome} - 当前染色体
{total_tools} - 总工具数量 (74)
{local_tools} - 本地工具数量
{plugin_tools} - 插件工具数量  
{mcp_tools} - MCP工具数量
{all_available_tools} - 所有可用工具的完整列表
{microbe_functions} - 微生物基因组学功能状态
{timestamp} - 当前时间戳
{date} - 当前日期
{time} - 当前时间
```

### 示例自定义提示词：

```
你是一个专业的基因组分析助手。当前系统状态：
- 染色体：{current_chromosome}
- 可用工具总数：{total_tools}个
- MCP工具：{mcp_tools}个
- 微生物功能：{microbe_functions}

请根据用户需求选择最合适的工具进行分析。
```

## 技术优势

### 1. 一致性保证
- 自定义提示词与默认系统消息具有相同的工具可见性
- 确保用户无论使用哪种配置都能访问所有功能

### 2. 灵活性增强
- 用户可以自定义交互风格，同时保持完整的工具功能
- 支持变量替换，便于动态内容生成

### 3. 功能完整性
- 包含所有74个工具的详细信息
- 提供完整的使用示例和最佳实践

### 4. 开发者友好
- 模块化设计，便于维护和扩展
- 清晰的方法分离（getCompleteToolContext vs getEssentialToolInformation）

## 验证结果

修复后，"display 3D structure of 1TUP"请求现在可以在自定义系统提示词下正确执行：

```json
{"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
```

系统将自动：
1. 识别蛋白质结构显示需求
2. 从74个可用工具中选择`open_protein_viewer`
3. 正确传递PDB ID参数
4. 执行3D结构显示功能

## 总结

这次修复确保了GenomeExplorer在任何配置下都能提供一致、完整的工具访问能力，显著提升了用户体验和系统的可用性。用户现在可以自由自定义交互风格，而不必担心功能受限。 