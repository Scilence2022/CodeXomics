# Direct MCP Server 与 Genome AI Studio 集成启动指南

## 🎯 **目标**

让 Direct MCP Server 能够与 Genome AI Studio 直接交互，通过 Claude Desktop 提供 40+ 基因组学工具。

## 📋 **系统架构**

```
Claude Desktop → Direct MCP Server → Genome AI Studio
                (stdio transport)     (HTTP 3000, WS 3001)
                (HTTP 3002, WS 3003)
```

## 🚀 **启动步骤**

### 步骤 1: 启动 Genome AI Studio

```bash
# 在 GenomeExplorer 目录下
npm start
```

**等待直到看到 Electron 应用窗口打开**

### 步骤 2: 启动 Direct MCP Server

```bash
# 使用专用启动脚本
node start-direct-integration.js
```

**预期输出**:
```
🚀 Starting Direct MCP Server for Genome AI Studio...
📡 HTTP Server: http://localhost:3002
🔌 WebSocket: ws://localhost:3003
🎯 Claude MCP: stdio transport
✅ Ready for Claude Desktop integration
```

### 步骤 3: 验证服务状态

```bash
# 检查 Direct MCP Server 健康状态
curl -s http://localhost:3002/health

# 检查 Genome AI Studio 健康状态
curl -s http://localhost:3000/health
```

**预期响应**:
```json
{"status":"healthy","clients":0}
```

## 🔧 **Claude Desktop 配置**

### 添加 MCP 服务器配置

在 Claude Desktop 设置中添加以下配置：

```json
{
  "mcpServers": {
    "genome-ai-studio": {
      "command": "node",
      "args": ["/Users/song/Github-Repos/GenomeExplorer/start-direct-integration.js"],
      "env": {}
    }
  }
}
```

### 重启 Claude Desktop

配置完成后重启 Claude Desktop 应用。

## 🧪 **测试集成**

### 1. 验证工具可用性

在 Claude Desktop 中尝试使用工具：

```
请列出可用的基因组学工具
```

### 2. 测试简单工具

尝试使用 `compute_gc` 工具：

```
请计算序列 "ATCGATCGATCG" 的 GC 含量
```

### 3. 测试导航工具

尝试使用 `navigate_to_position` 工具：

```
请导航到染色体 chr1 的位置 1000-2000
```

## 📊 **端口配置**

| 服务 | HTTP 端口 | WebSocket 端口 | 用途 |
|------|-----------|----------------|------|
| **Genome AI Studio** | 3000 | 3001 | 主应用后端 |
| **Direct MCP Server** | 3002 | 3003 | Claude Desktop 集成 |

## 🔍 **故障排除**

### 问题 1: 端口冲突

**症状**: `Port(s) already in use` 错误

**解决方案**:
```bash
# 检查端口使用情况
lsof -i :3000 -i :3001 -i :3002 -i :3003

# 停止冲突的进程
pkill -f "start-claude-mcp-server"
```

### 问题 2: Genome AI Studio 未启动

**症状**: Direct MCP Server 无法连接到 Genome AI Studio

**解决方案**:
1. 确保 Genome AI Studio 已启动
2. 检查 `http://localhost:3000/health` 是否响应
3. 重启 Direct MCP Server

### 问题 3: Claude Desktop 无法连接

**症状**: Claude Desktop 报告 "no provided tools"

**解决方案**:
1. 检查 MCP 配置路径是否正确
2. 重启 Claude Desktop
3. 验证 Direct MCP Server 正在运行

### 问题 4: 工具执行失败

**症状**: 工具调用返回错误

**解决方案**:
1. 确保 Genome AI Studio 窗口已打开
2. 检查 WebSocket 连接状态
3. 验证工具参数格式

## 🛠️ **开发模式**

### 使用调试版本

如果需要详细的启动信息，可以使用：

```bash
# 原始版本（带详细输出）
node start-claude-mcp-server.js

# 直接集成版本（静默模式）
node start-claude-mcp-server-direct.js

# 专用启动脚本（推荐）
node start-direct-integration.js
```

### 日志查看

```bash
# 查看 Direct MCP Server 日志
ps aux | grep "start-direct-integration"

# 检查端口状态
netstat -an | grep 300
```

## 📈 **性能监控**

### 健康检查

```bash
# Direct MCP Server
curl -s http://localhost:3002/health

# Genome AI Studio
curl -s http://localhost:3000/health
```

### 连接状态

```bash
# 检查 WebSocket 连接
lsof -i :3003
```

## 🎯 **最佳实践**

### 1. **启动顺序**
1. 先启动 Genome AI Studio
2. 等待应用完全加载
3. 启动 Direct MCP Server
4. 配置 Claude Desktop

### 2. **端口管理**
- Genome AI Studio: 3000/3001
- Direct MCP Server: 3002/3003
- 避免端口冲突

### 3. **错误处理**
- 检查所有服务健康状态
- 验证网络连接
- 查看错误日志

### 4. **性能优化**
- 使用专用启动脚本
- 避免不必要的输出
- 保持服务稳定运行

## ✅ **验证清单**

启动完成后，请验证：

- [ ] Genome AI Studio 应用窗口已打开
- [ ] Direct MCP Server 正在运行 (端口 3002/3003)
- [ ] Claude Desktop 配置已添加
- [ ] 工具列表在 Claude Desktop 中可见
- [ ] 简单工具测试成功
- [ ] 导航工具测试成功

## 🏆 **成功标志**

当您看到以下情况时，集成已成功：

1. **Genome AI Studio**: 应用窗口正常显示
2. **Direct MCP Server**: 启动信息显示成功
3. **Claude Desktop**: 能够列出和使用基因组学工具
4. **工具执行**: 能够成功调用工具并获得结果

## 📞 **支持**

如果遇到问题：

1. 检查本指南的故障排除部分
2. 验证所有服务状态
3. 查看相关日志信息
4. 重启相关服务

---

**现在您可以享受 Direct MCP Server 与 Genome AI Studio 的完整集成！** 