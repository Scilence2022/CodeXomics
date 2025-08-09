# Claude Desktop 连接指南

## 概述

Genome AI Studio 与 Claude MCP Server 构成一个有机整体：
- **内部**：使用高效的 RPC 机制进行通信
- **对外**：提供标准 MCP 接口，供外部 Chat 工具（如 Claude Desktop）连接

这种设计既保证了内部通信的高效性，又提供了标准化的外部接口。

## 🚀 启动步骤

### 1. 启动 Genome AI Studio

```bash
# 在项目根目录
npm start
```

### 2. 启动内置 MCP Server

在 Genome AI Studio 界面中：
- 点击界面上方的 **"Start"** 按钮
- 等待看到 "Unified Claude MCP Server started successfully" 通知

启动成功后，控制台会显示：
```
🧬 Unified Claude MCP Server started
📡 HTTP Server: http://localhost:3002
🔧 IPC Communication: true
🌐 MCP SSE Endpoint: http://localhost:3002/sse
📋 Claude Desktop Connection: Add custom connector with URL above
```

## 🔌 Claude Desktop 连接配置

### 方法：使用 Custom Connector

1. **打开 Claude Desktop 设置**
   - 点击 Claude Desktop 右上角的设置图标
   - 选择 "Settings"

2. **添加自定义连接器**
   - 在设置界面找到 "MCP Servers" 或 "Custom Connectors"
   - 点击 "Add custom connector" 或类似按钮

3. **配置连接信息**
   ```
   Name: Genome AI Studio
   URL: http://localhost:3002/sse
   ```

4. **保存并连接**
   - 保存配置
   - Claude Desktop 会自动连接到 Genome AI Studio

## ✅ 验证连接

连接成功后，在 Claude Desktop 中：

1. **检查可用工具**
   - 输入：`What tools are available?`
   - 应该能看到 40+ 个基因组分析工具

2. **测试基本功能**
   - 输入：`ping`
   - 应该返回服务器状态信息

3. **测试基因搜索**
   - 输入：`Search for gene lysC`
   - 应该返回基因搜索结果

## 🛠️ 可用工具类别

连接成功后，Claude Desktop 可以使用以下工具：

### 导航工具
- `navigateToPosition` - 导航到特定基因组位置
- `searchFeatures` - 搜索基因组特征
- `jumpToGene` - 跳转到特定基因
- `searchGeneByName` - 按名称搜索基因

### 状态管理
- `getCurrentState` - 获取当前状态
- `getGenomeInfo` - 获取基因组信息

### 轨道控制
- `toggleTrack` - 显示/隐藏轨道

### 序列分析
- `getCodingSequence` - 获取编码序列
- `getSequenceRegion` - 获取序列区域

### 更多工具
- 蛋白质结构分析
- 数据库集成
- AI 驱动的序列分析
- 代谢途径分析

## 🚨 故障排除

### 连接失败
1. **确保 Genome AI Studio 正在运行**
   ```bash
   # 检查进程
   ps aux | grep electron
   ```

2. **确保 MCP Server 已启动**
   - 检查 Genome AI Studio 界面上的 Start 按钮状态
   - 应该显示 "Stop" 而不是 "Start"

3. **检查端口占用**
   ```bash
   # 检查端口 3002 是否被占用
   lsof -i :3002
   ```

4. **检查防火墙设置**
   - 确保本地端口 3002 没有被防火墙阻止

### 工具调用失败
1. **检查 Genome AI Studio 连接状态**
   - 在 Claude Desktop 中输入：`ping`
   - 检查返回的状态信息

2. **重启服务**
   - 在 Genome AI Studio 中点击 "Stop" 然后 "Start"
   - 重新连接 Claude Desktop

## 🔄 重新连接

如果需要重新连接：

1. **停止 MCP Server**
   - 在 Genome AI Studio 中点击 "Stop" 按钮

2. **重新启动**
   - 点击 "Start" 按钮
   - 等待启动完成

3. **Claude Desktop 会自动重连**
   - 不需要重新配置连接器

## 📝 使用示例

连接成功后，您可以在 Claude Desktop 中使用自然语言与 Genome AI Studio 交互：

```
用户: "在基因组中搜索 lysC 基因"
Claude: [使用 searchGeneByName 工具搜索 lysC]

用户: "导航到染色体 1 的位置 1000-2000"
Claude: [使用 navigateToPosition 工具导航]

用户: "显示基因轨道"
Claude: [使用 toggleTrack 工具显示基因轨道]
```

## 🛡️ 安全注意事项

- MCP Server 只监听本地地址 (localhost)
- 不会暴露给外部网络
- 只有本机的 Claude Desktop 可以连接
- 所有通信都在本地进行，确保数据安全

---

通过这种方式，Claude Desktop 可以直接与 Genome AI Studio 通信，实现强大的 AI 驱动基因组分析功能！