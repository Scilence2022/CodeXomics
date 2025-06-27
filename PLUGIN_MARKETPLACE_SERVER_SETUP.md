# GenomeExplorer Plugin Marketplace Server

## 概述

这是一个简单而功能完整的插件市场服务器，为 GenomeExplorer 提供真实的插件数据服务，替代之前的模拟数据。

## 🎯 功能特性

### 核心功能
- **RESTful API**: 完整的插件搜索和获取 API
- **插件管理**: 支持插件列表、详情、下载统计
- **分类系统**: 按类型、作者、标签分类
- **搜索功能**: 智能搜索和过滤
- **统计数据**: 下载统计、评分、使用情况

### API 端点
```
GET  /api/v1/plugins      - 搜索插件
GET  /api/v1/plugins/:id  - 获取插件详情
POST /api/v1/plugins/:id/download - 记录下载
GET  /api/v1/categories   - 获取分类列表
GET  /api/v1/stats        - 获取市场统计
GET  /api/v1/health       - 健康检查
```

## 🚀 快速启动

### 方法 1: 使用启动脚本（推荐）
```bash
./start-marketplace-server.sh
```

### 方法 2: 手动启动
```bash
# 1. 复制 package.json
cp marketplace-server-package.json package.json

# 2. 安装依赖
npm install

# 3. 启动服务器
node plugin-marketplace-server.js
```

## 📊 当前插件数据

服务器默认包含以下示例插件：

### 1. **Genomic Variant Caller** 
- **类型**: Function Plugin
- **分类**: variant-analysis
- **版本**: 2.4.1
- **作者**: BioinformaticsTeam
- **描述**: 基于机器学习增强的高级基因组变异调用工具

### 2. **Protein Interaction Network Visualizer**
- **类型**: Visualization Plugin  
- **分类**: network-analysis
- **版本**: 1.8.3
- **作者**: NetworkBioLab
- **描述**: 交互式蛋白质-蛋白质相互作用网络分析可视化

### 3. **RNA-Seq Differential Expression Analyzer**
- **类型**: Function Plugin
- **分类**: rna-analysis  
- **版本**: 3.1.0
- **作者**: RNASeqGroup
- **描述**: 综合 RNA-Seq 数据分析与统计检验

### 4. **Advanced Phylogenetic Tree Builder**
- **类型**: Function Plugin
- **分类**: phylogenetics
- **版本**: 2.7.2  
- **作者**: PhyloLab
- **描述**: 最大似然法和贝叶斯系统发育推断

## 🔧 配置说明

### 服务器配置
- **端口**: 3001 (可通过环境变量 PORT 修改)
- **数据目录**: `marketplace-data/`
- **元数据文件**: `marketplace-data/metadata.json`

### GenomeExplorer 集成
插件市场会自动检测 localhost:3001 服务器：

```javascript
// 数据源配置
defaultSources = [
    {
        id: 'localhost',
        name: 'Local Development Server',
        url: 'http://localhost:3001/api/v1',
        priority: 0,
        trusted: true,
        enabled: true  // 默认启用
    }
    // ... 其他源
];
```

## 📡 API 使用示例

### 搜索插件
```bash
curl "http://localhost:3001/api/v1/plugins?query=protein&type=function"
```

### 获取插件详情
```bash
curl "http://localhost:3001/api/v1/plugins/protein-interaction-network"
```

### 获取统计数据
```bash
curl "http://localhost:3001/api/v1/stats"
```

### 健康检查
```bash
curl "http://localhost:3001/api/v1/health"
```

## 🛡️ 安全特性

### 插件验证
- **校验和验证**: 每个插件包含 SHA256 校验和
- **数字签名**: 验证插件来源
- **恶意软件扫描**: 定期安全扫描
- **兼容性检查**: GenomeExplorer 版本兼容性

### API 安全
- **CORS 支持**: 跨域请求处理
- **错误处理**: 详细的错误信息
- **超时控制**: 防止长时间请求
- **输入验证**: 参数验证和清理

## 🔄 工作流程

### 1. 启动流程
```
1. 检查依赖 → 2. 加载元数据 → 3. 初始化路由 → 4. 启动服务器
```

### 2. 请求处理
```
请求 → 参数验证 → 数据查询 → 结果处理 → 响应返回
```

### 3. GenomeExplorer 集成
```
插件市场 → API 调用 → 数据处理 → UI 显示 → 用户交互
```

## 📈 监控和日志

### 服务器日志
- **启动日志**: 服务器初始化信息
- **API 日志**: 请求和响应记录
- **错误日志**: 详细错误信息
- **性能日志**: 响应时间统计

### 控制台输出示例
```
🚀 GenomeExplorer Plugin Marketplace Server
📡 Server running on http://localhost:3001
📚 API Documentation: http://localhost:3001/api/v1/health
🔍 Plugin Search: http://localhost:3001/api/v1/plugins
📊 Statistics: http://localhost:3001/api/v1/stats
```

## 🔧 故障排除

### 常见问题

#### 1. 端口 3001 被占用
```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或使用其他端口
PORT=3002 node plugin-marketplace-server.js
```

#### 2. 依赖安装失败
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### 3. API 调用失败
- 检查服务器是否运行
- 验证 URL 格式
- 查看浏览器控制台错误
- 检查网络连接

## 🚀 扩展开发

### 添加新插件
编辑 `plugin-marketplace-server.js` 中的 `initializeSamplePlugins()` 方法，添加新的插件数据。

### 自定义 API
可以添加新的路由处理器来扩展 API 功能。

### 数据持久化
当前使用 JSON 文件存储，可以扩展为使用数据库（如 SQLite、MongoDB）。

## 📋 下一步计划

1. **真实插件包管理**: 支持实际的插件文件上传和下载
2. **用户认证**: 添加用户注册和认证系统
3. **插件评分**: 用户评分和评论系统
4. **版本管理**: 插件版本历史和更新管理
5. **分布式部署**: 支持多服务器集群部署

---

**🎉 现在您可以享受真实的插件市场体验了！**

启动服务器后，GenomeExplorer 的插件市场将显示来自服务器的真实数据，而不再是模拟数据。 