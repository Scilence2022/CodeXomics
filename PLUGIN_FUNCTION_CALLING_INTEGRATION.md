# Plugin System与Function Calling集成文档

## 概述

GenomeExplorer的插件系统已完全集成到ChatBox LLM的function calling机制中，确保所有插件功能都可以被AI助手通过标准的JSON工具调用格式正确调用和执行。

## 🏗️ 系统架构

```
用户聊天输入 → ChatManager → LLM → Function Calls → PluginFunctionCallsIntegrator → PluginManager → 插件功能执行 → 结果返回
```

### 核心组件

1. **PluginManager** - 核心插件管理器，注册和执行插件功能
2. **PluginFunctionCallsIntegrator** - 插件功能调用集成器，确保LLM调用兼容性
3. **FunctionCallsOrganizer** - 功能分类和智能执行优化
4. **SmartExecutor** - 智能执行器，按优先级和类型优化执行
5. **ChatManager** - 聊天管理器，处理LLM通信和工具执行

## 🔌 可用插件功能

### 1. 基因组分析插件 (genomic-analysis)
**优先级**: 3 (序列分析类)

- `genomic-analysis.analyzeGCContent` - 分析基因组区域的GC含量
- `genomic-analysis.findMotifs` - 查找序列模体
- `genomic-analysis.calculateDiversity` - 计算序列多样性指标
- `genomic-analysis.compareRegions` - 比较多个基因组区域

### 2. 系统发育分析插件 (phylogenetic-analysis)
**优先级**: 4 (高级分析类)

- `phylogenetic-analysis.buildPhylogeneticTree` - 构建系统发育树
- `phylogenetic-analysis.calculateEvolutionaryDistance` - 计算进化距离

### 3. 生物网络分析插件 (biological-networks)
**优先级**: 4 (高级分析类)

- `biological-networks.buildProteinInteractionNetwork` - 构建蛋白质相互作用网络
- `biological-networks.buildGeneRegulatoryNetwork` - 构建基因调控网络
- `biological-networks.analyzeNetworkCentrality` - 分析网络中心性
- `biological-networks.detectNetworkCommunities` - 检测网络社区

### 4. 机器学习分析插件 (ml-analysis)
**优先级**: 4 (高级分析类)

- `ml-analysis.predictGeneFunction` - 预测基因功能
- `ml-analysis.classifySequence` - 序列分类
- `ml-analysis.clusterSequences` - 序列聚类

## 📋 LLM Function Calling示例

### 基因组分析示例

```json
{
    "tool_name": "genomic-analysis.analyzeGCContent",
    "parameters": {
        "chromosome": "chr1",
        "start": 1000,
        "end": 5000,
        "windowSize": 1000
    }
}
```

### 系统发育分析示例

```json
{
    "tool_name": "phylogenetic-analysis.buildPhylogeneticTree",
    "parameters": {
        "sequences": [
            {"id": "seq1", "sequence": "ATGCGCTATCG", "name": "Sequence 1"},
            {"id": "seq2", "sequence": "ATGAAAGAATT", "name": "Sequence 2"}
        ],
        "method": "nj",
        "distanceMetric": "hamming"
    }
}
```

### 机器学习分析示例

```json
{
    "tool_name": "ml-analysis.predictGeneFunction",
    "parameters": {
        "sequence": "ATGCGCTATCGATGAAAGAATT",
        "model": "cnn",
        "threshold": 0.7
    }
}
```

### 生物网络分析示例

```json
{
    "tool_name": "biological-networks.buildProteinInteractionNetwork",
    "parameters": {
        "proteins": ["TP53", "MDM2", "ATM", "CHEK2"],
        "confidenceThreshold": 0.7,
        "interactionDatabase": "string"
    }
}
```

## 🚀 智能执行优化

插件功能已完全集成到智能执行系统中，具有以下特性：

### 功能分类
- **类别8**: 插件系统 - 基因组分析插件 (优先级3)
- **类别9**: 插件系统 - 系统发育分析插件 (优先级4)
- **类别10**: 插件系统 - 生物网络分析插件 (优先级4)
- **类别11**: 插件系统 - 机器学习分析插件 (优先级4)

### 执行策略
1. **浏览器行为** (优先级1) → 立即执行，提供即时视觉反馈
2. **数据检索** (优先级2) → 快速执行，支持并行处理
3. **序列分析+基因组分析插件** (优先级3) → 中等优先级，可并行执行
4. **高级分析+插件功能** (优先级4) → 低优先级，计算密集型，可并行执行
5. **外部服务** (优先级5) → 最低优先级，网络依赖型

## 🔧 技术实现

### 1. 插件功能识别
```javascript
// 在ChatManager.executeToolByName中
if (this.pluginFunctionCallsIntegrator && 
    this.pluginFunctionCallsIntegrator.isPluginFunction(toolName)) {
    const result = await this.pluginFunctionCallsIntegrator.executePluginFunction(toolName, parameters);
    return result;
}
```

### 2. 智能分类
```javascript
// 在FunctionCallsOrganizer.getFunctionCategory中
if (functionName.includes('.')) {
    const [pluginId, ] = functionName.split('.');
    // 根据pluginId返回相应的分类信息
}
```

### 3. 安全执行
```javascript
// 插件功能在沙盒环境中执行
const context = {
    Math, Date, JSON, console,
    app: this.createSafeAppInterface(),
    MicrobeFns: window.MicrobeFns  // 访问MicrobeGenomicsFunctions
};
return await func.call(context, parameters);
```

## 📊 系统统计

当前插件系统包含：
- **4个主要插件** (基因组分析、系统发育、生物网络、机器学习)
- **15+个插件功能** 可通过LLM调用
- **4个功能分类** 集成到智能执行系统
- **完整的参数验证** 和错误处理机制

## 🎯 使用最佳实践

### 1. LLM提示词建议
```
当用户需要进行高级基因组分析时，优先使用插件系统功能：
- 基因组分析：使用genomic-analysis插件
- 系统发育分析：使用phylogenetic-analysis插件  
- 机器学习预测：使用ml-analysis插件
- 网络分析：使用biological-networks插件
```

### 2. 参数格式要求
- 所有插件功能参数必须符合JSON Schema规范
- 必需参数必须提供，可选参数使用默认值
- 数组和对象参数按照规定格式传递

### 3. 错误处理
- 插件执行失败时会回退到传统function调用
- 提供详细的错误信息和调试日志
- 支持参数验证和类型检查

## 🧪 测试验证

可以通过以下文件测试插件系统集成：

1. **test/plugin-function-calling-test.html** - 完整的插件功能调用集成测试
2. **test/smart-execution-demo.html** - 智能执行系统演示（包含插件功能）
3. **test-plugin-integration.html** - 基础插件系统测试

## ✅ 集成验证清单

- [x] PluginManager正确注册所有插件功能
- [x] PluginFunctionCallsIntegrator识别和执行插件功能
- [x] FunctionCallsOrganizer正确分类插件功能
- [x] SmartExecutor按优先级优化插件功能执行
- [x] ChatManager正确路由插件功能调用
- [x] LLM系统信息包含完整的插件功能描述
- [x] 参数验证和错误处理机制完善
- [x] 插件功能在沙盒环境中安全执行
- [x] 可视化系统自动渲染插件分析结果

## 🔮 未来扩展

系统架构支持以下扩展：

1. **动态插件加载** - 运行时加载新插件
2. **插件配置管理** - 用户自定义插件参数
3. **插件性能监控** - 执行时间和成功率统计
4. **插件依赖管理** - 处理插件间的依赖关系
5. **插件版本控制** - 支持插件升级和兼容性检查

---

**结论**: GenomeExplorer的插件系统已与ChatBox LLM完全集成，提供了强大、安全、高效的function calling机制，支持复杂的生物信息学分析工作流程。 