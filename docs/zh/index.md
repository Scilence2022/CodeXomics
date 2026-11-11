# CodeXomics 中文入门

## AI 原生基因组浏览器

CodeXomics 是一个跨平台 Electron 基因组工作台。你可以加载基因组数据，用 ChatBox 直接提问，让 AI 代理驱动视图、调用真实生物信息学工具并返回可复核的结果。

当前源码版本为 `0.723.0`，应用内显示为 `v0.723`。源码中尚未随安装包发布的改动见[变更记录](https://github.com/Scilence2022/CodeXomics/blob/main/CHANGELOG.md#unreleased)。

- [下载最新版本](https://github.com/Scilence2022/CodeXomics/releases)
- [查看 GitHub 源码](https://github.com/Scilence2022/CodeXomics)
- [中文产品介绍页](../landing/index-zh.html)
- [English documentation](../index.md)

## 安装与首次启动

### 下载发行版

从 [GitHub Releases](https://github.com/Scilence2022/CodeXomics/releases) 下载适合 macOS、Windows 或 Linux 的安装包并启动应用。

### 从源码安装

源码构建需要 Node.js 22.x（至少 22.12）和 npm 10 或更高版本。

```bash
git clone https://github.com/Scilence2022/CodeXomics.git
cd CodeXomics
npm install
npm start
```

首次启动后可按以下步骤打开基因组并启用 ChatBox。

1. 打开 **File → Load File → Genome File** 加载基因组，或用 **File → Open Project** 打开 `.prj.GAI` 项目。
2. 按 <kbd>⌘,</kbd>（Windows/Linux 为 <kbd>Ctrl+,</kbd>）打开 **Settings → Model Providers**，保存服务商配置，在 **Default Model** 选项卡选择默认模型。所有设置都集中在这个窗口里，左侧可按类别浏览或直接搜索。
3. 在 ChatBox 中提出一个具体问题，让助手导航、可视化或分析当前数据。

完整的英文步骤见 [Getting Started Guide](../user-guides/GETTING_STARTED.md)。

## 支持的数据格式

CodeXomics 可加载核苷酸 FASTA 和 GenBank（含 `.gz`），并叠加 GFF/GTF、BED、VCF、SAM/BAM 和 WIG/BigWig 数据。加载 BAM 前先打开对应的参考基因组，并将 `.bai` 或 `.csi` 索引放在 BAM 文件旁。KGML 可在通路查看器中打开。完整列表见[数据格式表](../user-guides/GETTING_STARTED.md#load-data)。

## 配置 AI provider

支持 OpenAI、Anthropic、Google、DeepSeek、SiliconFlow、OpenRouter、MiniMax（全球及中国）、Zhongkeyu 和兼容 OpenAI API 的 **Custom Endpoint**。保存服务商配置后，可以用 ChatBox 输入框旁的模型选择器为当前会话切换模型。

API key 仅应填写在本机应用的配置中，不要提交到源码仓库。provider 的详细字段和故障排查请参阅英文 [LLM Configuration Guide](../user-guides/GETTING_STARTED.md) 与 [Troubleshooting Guide](../user-guides/TROUBLESHOOTING_GUIDE.md)。

## ChatBox 示例

加载基因组后，可以直接用自然语言提出请求。

```text
查找所有 DNA polymerase 基因，并跳转到第一个结果。
计算当前选中区域的 GC 含量。
围绕 lacZ 设计引物，并在序列轨道上显示。
查询当前蛋白的 AlphaFold 结构。
为当前基因组创建本地 BLAST 数据库。
用 EcoRI 做虚拟酶切，并模拟琼脂糖凝胶电泳。
```

助手会根据请求选择工具，更新当前视图，并在 ChatBox 中返回结果。复杂任务可以由多个专用 agent 协作完成。更多操作见英文 [User Guide](../user-guides/USER_GUIDE.md)。

## MCP Server

如果客户端需要操作已加载的基因组，请同时启动 Electron 和带认证的 MCP 服务。

```bash
export CODEXOMICS_MCP_MASTER_KEY='replace-with-at-least-16-random-characters'
npm run start-with-mcp
```

在客户端使用 `http://127.0.0.1:3002/mcp`，并发送 `Authorization: Bearer <key>`。默认的工具模式按密钥权限提供工具。若要让 ChatBox 处理自然语言任务，请启动 agent 模式。

```bash
CODEXOMICS_MCP_MODE=agent npm run start-with-mcp
```

Agent 模式提供 `codexomics_chat`、`list_genome_windows` 和 `switch_active_window`。配置示例和协议细节见 [MCP Server Guide](../user-guides/MCP_SERVER_GUIDE.md)。

## 英文详细指南

- [Getting Started](../user-guides/GETTING_STARTED.md)
- [User Guide](../user-guides/USER_GUIDE.md)
- [MCP Server Guide](../user-guides/MCP_SERVER_GUIDE.md)
- [BLAST Guide](../reference/BLAST_GUIDE.md)
- [Developer Guide](../developer-guides/DEVELOPER_GUIDE.md)
- [Benchmark Testing](../user-guides/USER_GUIDE.md#benchmark-testing)
- [Release Notes v0.723.0](../release-notes/RELEASE_NOTES_v0.723.md)
