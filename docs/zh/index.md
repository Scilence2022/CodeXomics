# CodeXomics 中文入门

## AI 原生基因组浏览器

CodeXomics 是一个跨平台 Electron 基因组工作台。你可以加载基因组数据，用 ChatBox 直接提问，让 AI 代理驱动视图、调用真实生物信息学工具并返回可复核的结果。

当前版本：**0.722.0**（应用内显示为 `v0.722`）。

- [下载最新版本](https://github.com/Scilence2022/CodeXomics/releases)
- [查看 GitHub 源码](https://github.com/Scilence2022/CodeXomics)
- [中文产品介绍页](../landing/index-zh.html)
- [English documentation](../index.md)

## 安装与首次启动

### 下载发行版

从 [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases) 下载适合 macOS、Windows 或 Linux 的安装包并启动应用。

### 从源码安装

源码构建需要 Node.js 20 或 22，以及 npm 10 或更高版本：

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
npm start
```

首次启动后：

1. 打开 `Options -> Configure LLMs`，配置一个 AI provider。
2. 使用 `File -> Load File` 加载基因组，或用 `File -> Open Project` 打开 `.prj.GAI` 项目。
3. 在 ChatBox 中提出一个具体问题，让助手导航、可视化或分析当前数据。

完整的英文步骤见 [Getting Started Guide](../user-guides/GETTING_STARTED.md)。

## 支持的数据格式

CodeXomics 支持 FASTA、GenBank、GFF/GTF、BED、VCF、SAM/BAM、WIG、KGML，以及 `.prj.GAI` 项目文件。你还可以在同一工作区叠加 reads、variants、定量轨道和自定义注释。

## 配置 AI provider

在 `Options -> Configure LLMs` 中选择并保存 provider。支持 OpenAI、Anthropic、Google、DeepSeek、SiliconFlow、OpenRouter，以及 OpenAI-compatible 的本地 LLM endpoint。按 provider 填写 API key、base URL（如需要）和模型，然后测试连接并保存。

API key 仅应填写在本机应用的配置中，不要提交到源码仓库。provider 的详细字段和故障排查请参阅英文 [LLM Configuration Guide](../user-guides/GETTING_STARTED.md) 与 [Troubleshooting Guide](../user-guides/TROUBLESHOOTING_GUIDE.md)。

## ChatBox 示例

加载基因组后，可以直接用自然语言请求：

```text
查找所有 DNA polymerase 基因，并跳转到第一个结果。
计算当前选中区域的 GC 含量。
围绕 lacZ 设计引物，并在序列轨道上显示。
查询当前蛋白的 AlphaFold 结构。
为当前基因组创建本地 BLAST 数据库。
```

助手会根据请求选择工具，更新当前视图，并在 ChatBox 中返回结果。复杂任务可以由多个专用 agent 协作完成。更多操作见英文 [User Guide](../user-guides/USER_GUIDE.md)。

## MCP Server

CodeXomics 可以作为 MCP server，为兼容 MCP 的客户端提供工具或 agent 模式。启动命令：

```bash
npm run mcp-server
# agent 模式
npm run mcp-server -- --mode=agent
```

默认地址：

- HTTP/SSE：`http://localhost:3002`
- WebSocket：`ws://localhost:3003`

工具模式提供完整 MCP 工具列表；agent 模式提供 `codexomics_chat`、`list_genome_windows` 和 `switch_active_window`。配置示例和协议细节见英文 [MCP Server Integration Guide](../user-guides/MCP_SERVER_GUIDE.md)。

## 英文详细指南

- [Getting Started](../user-guides/GETTING_STARTED.md)
- [User Guide](../user-guides/USER_GUIDE.md)
- [MCP Server Guide](../user-guides/MCP_SERVER_GUIDE.md)
- [BLAST Guide](../reference/BLAST_GUIDE.md)
- [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md)
- [Release Notes v0.722.0](../release-notes/RELEASE_NOTES_v0.722.md)
