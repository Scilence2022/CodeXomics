# GenomeExplorer 生物信息学工具套件

## 概述

GenomeExplorer 现已集成了一个完整的生物信息学工具套件，包含10个独立的专业分析工具，每个工具都以独立窗口形式运行，提供特定的生物信息学功能。

## 🧬 工具分类

### 1. 生物数据库工具 (Biological Databases)

#### KEGG通路分析工具 (KEGG Pathway Analysis)
- **功能**: 代谢通路富集分析
- **文件**: `src/bioinformatics-tools/kegg-analyzer.html`
- **特性**:
  - 基因列表输入和分析
  - 多物种支持
  - 通路富集统计
  - 交互式结果展示
  - 多格式数据导出

#### 基因本体论分析器 (Gene Ontology Analyzer)
- **功能**: GO功能注释和富集分析
- **文件**: `src/bioinformatics-tools/go-analyzer.html`
- **特性**:
  - 三大GO命名空间支持 (BP/MF/CC)
  - 富集分析和统计检验
  - 层次结构可视化
  - 命名空间比较分析

#### UniProt数据库搜索 (UniProt Database Search)
- **功能**: 蛋白质数据库查询和检索
- **文件**: `src/bioinformatics-tools/uniprot-search.html`
- **特性**:
  - 多种搜索类型 (蛋白名、基因名、ID等)
  - 高级过滤选项
  - 蛋白质详细信息展示
  - 序列下载和导出

#### NCBI数据库浏览器 (NCBI Database Browser)
- **功能**: NCBI多数据库集成查询
- **文件**: `src/bioinformatics-tools/ncbi-browser.html`
- **特性**:
  - 多数据库支持 (PubMed、Protein、Nucleotide等)
  - 统一搜索界面
  - 直接链接到NCBI原始数据

#### Ensembl基因组浏览器 (Ensembl Genome Browser)
- **功能**: 基因组数据和注释查询
- **文件**: `src/bioinformatics-tools/ensembl-browser.html`
- **特性**:
  - 多物种基因组支持
  - 基因结构信息
  - 转录本和外显子数据
  - 直接链接到Ensembl

### 2. 蛋白质分析工具 (Protein Analysis Tools)

#### InterPro结构域分析 (InterPro Domain Analysis)
- **功能**: 蛋白质结构域和家族分类
- **文件**: `src/bioinformatics-tools/interpro-analyzer.html`
- **特性**:
  - 蛋白质序列输入
  - 结构域预测和注释
  - 功能分类信息
  - E-value统计

#### STRING蛋白质网络 (STRING Protein Networks)
- **功能**: 蛋白质相互作用网络分析
- **文件**: `src/bioinformatics-tools/string-networks.html`
- **特性**:
  - 交互式网络可视化
  - 多种证据类型过滤
  - 网络统计分析
  - 置信度阈值控制

#### PDB结构查看器 (PDB Structure Viewer)
- **功能**: 蛋白质三维结构可视化
- **文件**: `src/bioinformatics-tools/pdb-viewer.html`
- **特性**:
  - PDB数据库搜索
  - 结构信息展示
  - 多种表示方式
  - 颜色方案选择

### 3. 功能分析工具 (Functional Analysis)

#### DAVID功能分析 (DAVID Functional Analysis)
- **功能**: 功能富集和注释聚类
- **文件**: `src/bioinformatics-tools/david-analyzer.html`
- **特性**:
  - 功能富集聚类
  - 多数据库整合
  - 富集评分计算
  - 注释分类

#### Reactome通路浏览器 (Reactome Pathway Browser)
- **功能**: 生物通路数据库浏览
- **文件**: `src/bioinformatics-tools/reactome-browser.html`
- **特性**:
  - 通路搜索和浏览
  - 反应级联展示
  - 多物种支持
  - 参与者信息

## 🚀 快速开始

### 通过菜单访问
1. 启动GenomeExplorer应用
2. 点击顶部菜单栏的 "Tools"
3. 选择相应的工具分类：
   - **Biological Databases** - 数据库查询工具
   - **Analysis Tools** - 分析和可视化工具
   - **Visualization Tools** - 数据可视化工具

### 直接文件访问
每个工具都可以作为独立的HTML文件运行：
```bash
# 在浏览器中打开任意工具
open src/bioinformatics-tools/kegg-analyzer.html
```

### 测试套件
使用专门的测试页面验证所有工具：
```bash
open test-bioinformatics-tools.html
```

## 🛠 技术实现

### 架构设计
- **独立窗口**: 每个工具运行在独立的Electron窗口中
- **模块化设计**: 每个工具自包含HTML/CSS/JavaScript
- **统一界面**: 所有工具遵循一致的设计语言
- **响应式布局**: 支持不同屏幕尺寸

### 技术栈
- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **可视化**: D3.js, Cytoscape.js, Plotly.js
- **图标**: Font Awesome 6
- **样式**: CSS自定义属性 (CSS Variables)
- **窗口管理**: Electron BrowserWindow API

### 代码结构
```
src/
├── main.js                    # 主进程，包含菜单和窗口创建函数
├── bioinformatics-tools/      # 生物信息学工具目录
│   ├── kegg-analyzer.html     # KEGG通路分析
│   ├── go-analyzer.html       # GO功能分析
│   ├── uniprot-search.html    # UniProt搜索
│   ├── ncbi-browser.html      # NCBI浏览器
│   ├── ensembl-browser.html   # Ensembl浏览器
│   ├── interpro-analyzer.html # InterPro分析
│   ├── string-networks.html   # STRING网络
│   ├── pdb-viewer.html        # PDB查看器
│   ├── david-analyzer.html    # DAVID分析
│   └── reactome-browser.html  # Reactome浏览器
└── test-bioinformatics-tools.html # 测试套件
```

## 📊 功能特性

### 通用特性
- **样本数据**: 每个工具都提供样本数据用于测试
- **帮助系统**: 内置使用帮助和说明
- **数据导出**: 支持多种格式的结果导出
- **错误处理**: 完善的错误提示和状态反馈
- **响应式设计**: 适配不同设备和屏幕尺寸

### 交互特性
- **实时搜索**: 即时搜索和结果过滤
- **可视化**: 丰富的图表和网络可视化
- **数据验证**: 输入数据格式验证
- **进度指示**: 分析过程的进度反馈
- **结果筛选**: 灵活的结果过滤和排序

## 🔧 定制和扩展

### 添加新工具
1. 在 `src/bioinformatics-tools/` 目录下创建新的HTML文件
2. 在 `src/main.js` 中添加窗口创建函数
3. 在菜单结构中添加新的菜单项
4. 更新测试套件以包含新工具

### 样式定制
每个工具使用CSS自定义属性，可以轻松定制：
```css
:root {
    --primary-color: #your-color;
    --secondary-color: #your-color;
    /* 其他颜色变量 */
}
```

### API集成
目前工具使用模拟数据，可以通过以下方式集成真实API：
1. 替换模拟函数为真实API调用
2. 添加适当的错误处理
3. 实现数据缓存机制
4. 添加API密钥管理

## 🧪 测试

### 自动化测试
运行测试套件：
```bash
# 打开测试页面
open test-bioinformatics-tools.html

# 或在应用中通过开发者工具运行
npm run test-tools
```

### 手动测试
每个工具都包含：
- **样本数据按钮**: 快速加载测试数据
- **示例分析**: 预配置的分析参数
- **错误场景**: 测试错误处理机制

## 📈 性能优化

### 已实现的优化
- **懒加载**: 工具仅在需要时加载
- **独立进程**: 每个工具运行在独立窗口中
- **内存管理**: 适当的资源清理
- **缓存机制**: 查询结果的本地缓存

### 建议的改进
- **数据流式处理**: 对于大数据集的流式处理
- **Web Workers**: CPU密集型任务的后台处理
- **虚拟滚动**: 大列表的性能优化
- **预加载**: 常用数据的预加载

## 🤝 贡献指南

### 代码标准
- 使用ES6+语法
- 遵循统一的命名约定
- 添加适当的注释和文档
- 确保响应式设计

### 提交规范
- 每个新工具作为独立的提交
- 包含完整的测试用例
- 更新相关文档
- 确保与现有工具的一致性

## 📄 许可证
本项目遵循GenomeExplorer的许可证条款。

## 🆘 支持
如果您在使用这些工具时遇到问题，请：
1. 查看内置帮助文档
2. 运行测试套件诊断问题
3. 查看浏览器开发者控制台的错误信息
4. 提交问题报告

---

**总结**: GenomeExplorer现在包含了一个完整的生物信息学工具生态系统，涵盖了从数据库查询到高级分析的各个方面。每个工具都经过精心设计，提供专业级的功能和用户体验。 