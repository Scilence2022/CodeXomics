# 独立菜单系统实现 - GenomeExplorer

## 📋 概述

本文档描述了为 GenomeExplorer 生物信息学工具实现的真正独立菜单系统。每个工具窗口现在都具有完全独立的菜单，支持动态切换和平台特定的优化。

## 🎯 主要特性

### 1. 真正的独立菜单
- ✅ 每个工具窗口都有独立的菜单模板
- ✅ 使用 `Menu.setApplicationMenu()` 动态切换应用菜单
- ✅ 窗口获得焦点时自动切换对应菜单
- ✅ 窗口关闭时自动清理菜单资源

### 2. 平台兼容性
- ✅ **macOS**: 包含品牌菜单 (GenomeExplorer)，Hide/Show All 功能
- ✅ **Windows/Linux**: 传统菜单布局，包含 Exit 选项
- ✅ 自动适配不同平台的快捷键规范

### 3. 完整的菜单功能
- ✅ **文件菜单**: 新建分析、打开数据、保存结果、导出数据
- ✅ **编辑菜单**: 复制、粘贴、剪切、全选、查找
- ✅ **视图菜单**: 重新加载、开发者工具、缩放、全屏
- ✅ **分析菜单**: 运行分析、停止分析、加载示例、重置参数
- ✅ **选项菜单**: 首选项、分析设置、输出格式、高级选项
- ✅ **窗口菜单**: 最小化、关闭、返回主窗口
- ✅ **帮助菜单**: 关于、用户指南、文档、报告问题

### 4. 智能事件处理
- ✅ 每个工具都有通用的 `ToolMenuHandler` 类
- ✅ 支持键盘快捷键和菜单点击
- ✅ 自动检测目标元素（输入框、结果区域等）
- ✅ 智能的复制/粘贴逻辑

## 🏗️ 架构设计

### 核心组件

```
GenomeExplorer 独立菜单系统
├── 主窗口菜单 (createMenu)
│   ├── 品牌菜单 (仅 macOS)
│   ├── 文件、编辑、视图菜单
│   ├── 工具、选项、插件菜单
│   └── 窗口、帮助菜单
├── 工具窗口菜单 (createToolWindowMenu)
│   ├── 品牌菜单 (仅 macOS)
│   ├── 文件、编辑、视图菜单
│   ├── 分析、选项菜单
│   └── 窗口、帮助菜单
├── 菜单管理器
│   ├── toolMenuTemplates (Map)
│   ├── currentActiveWindow
│   └── 自动切换逻辑
└── 事件处理器
    ├── ToolMenuHandler (通用类)
    ├── IPC 事件监听
    └── 快捷键处理
```

### 文件结构

```
src/
├── main.js                           # 主进程 - 菜单定义和窗口管理
├── bioinformatics-tools/
│   ├── tool-menu-handler.js          # 通用菜单事件处理器
│   ├── interpro-analyzer.html        # InterPro 工具 (使用独立菜单)
│   ├── kegg-analyzer.html            # KEGG 工具 (使用独立菜单)
│   ├── go-analyzer.html              # GO 工具 (使用独立菜单)
│   ├── uniprot-search.html           # UniProt 工具 (使用独立菜单)
│   ├── ncbi-browser.html             # NCBI 工具 (使用独立菜单)
│   ├── ensembl-browser.html          # Ensembl 工具 (使用独立菜单)
│   ├── string-networks.html          # STRING 工具 (使用独立菜单)
│   ├── david-analyzer.html           # DAVID 工具 (使用独立菜单)
│   ├── reactome-browser.html         # Reactome 工具 (使用独立菜单)
│   └── pdb-viewer.html               # PDB 工具 (使用独立菜单)
└── test-independent-menu-system.html # 测试页面
```

## 🔧 实现细节

### 1. 菜单模板存储

```javascript
// 存储各个工具窗口的菜单模板
let toolMenuTemplates = new Map();
let currentActiveWindow = null;

function createToolWindowMenu(toolWindow, toolName) {
  // 创建平台特定的菜单模板
  const template = [...];
  
  // 存储工具窗口的菜单模板
  toolMenuTemplates.set(toolWindow.id, { template, toolName });
  
  // 创建菜单
  const menu = Menu.buildFromTemplate(template);
  
  // 设置窗口聚焦时切换菜单
  toolWindow.on('focus', () => {
    currentActiveWindow = toolWindow;
    Menu.setApplicationMenu(menu);
  });
}
```

### 2. 动态菜单切换

```javascript
// 窗口聚焦时自动切换菜单
toolWindow.on('focus', () => {
  currentActiveWindow = toolWindow;
  Menu.setApplicationMenu(menu);
  console.log(`Switched to ${toolName} menu`);
});

// 主窗口获得焦点时切换回主菜单
mainWindow.on('focus', () => {
  if (currentActiveWindow !== mainWindow) {
    currentActiveWindow = mainWindow;
    createMenu(); // 重新创建并设置主窗口菜单
  }
});
```

### 3. 平台适配

```javascript
// macOS 品牌菜单
...(process.platform === 'darwin' ? [{
  label: 'GenomeExplorer',
  submenu: [
    { label: `About ${toolName}` },
    { label: 'Preferences', accelerator: 'Cmd+,' },
    { label: 'Hide GenomeExplorer', role: 'hide' },
    { label: 'Quit GenomeExplorer', accelerator: 'Cmd+Q' }
  ]
}] : []),

// Windows/Linux Exit 菜单
...(process.platform !== 'darwin' ? [
  { label: 'Exit', accelerator: 'Ctrl+Q' }
] : [])
```

### 4. 事件处理系统

```javascript
class ToolMenuHandler {
  constructor(toolName, toolInstance = null) {
    this.toolName = toolName;
    this.toolInstance = toolInstance;
    this.setupMenuEventListeners();
    this.setupKeyboardShortcuts();
  }

  setupMenuEventListeners() {
    // 监听主进程发送的菜单事件
    const { ipcRenderer } = require('electron');
    ipcRenderer.on('tool-menu-action', (event, action, data) => {
      this.handleMenuAction(action, data);
    });
  }

  handleMenuAction(action, data) {
    switch (action) {
      case 'copy': this.copySelectedText(); break;
      case 'paste': this.pasteFromClipboard(); break;
      case 'run-analysis': this.runAnalysis(); break;
      // ... 更多动作
    }
  }
}
```

## 📱 支持的工具

所有 10 个生物信息学工具都已集成独立菜单系统：

1. **🧬 InterPro Domain Analysis** - 蛋白质域分析
2. **🔬 KEGG Pathway Analysis** - 代谢通路分析  
3. **🌳 Gene Ontology Analyzer** - 基因本体分析
4. **🗄️ UniProt Database Search** - 蛋白质数据库搜索
5. **🌐 NCBI Database Browser** - NCBI 数据库浏览
6. **🧪 Ensembl Genome Browser** - Ensembl 基因组浏览
7. **🕸️ STRING Protein Networks** - 蛋白质相互作用网络
8. **📊 DAVID Functional Analysis** - 功能富集分析
9. **🔗 Reactome Pathway Browser** - Reactome 通路浏览
10. **🏗️ PDB Structure Viewer** - 蛋白质结构查看

## ⌨️ 快捷键支持

### 通用快捷键
- **Ctrl/Cmd + C**: 复制选中文本
- **Ctrl/Cmd + V**: 粘贴到输入框
- **Ctrl/Cmd + X**: 剪切选中文本  
- **Ctrl/Cmd + A**: 全选
- **Ctrl/Cmd + F**: 查找
- **F3**: 查找下一个

### 分析功能
- **Ctrl/Cmd + R**: 运行分析
- **Ctrl/Cmd + S**: 保存结果
- **Ctrl/Cmd + E**: 导出数据
- **Ctrl/Cmd + L**: 加载示例数据
- **F5**: 刷新数据

### 窗口管理
- **Ctrl/Cmd + W**: 关闭窗口
- **Ctrl/Cmd + M**: 最小化
- **Ctrl/Cmd + Shift + M**: 返回主窗口
- **F1**: 用户指南

### macOS 特有
- **Cmd + H**: 隐藏应用
- **Cmd + Shift + H**: 隐藏其他应用
- **Cmd + Q**: 退出应用

## 🧪 测试验证

### 测试页面
使用 `test-independent-menu-system.html` 进行功能测试：

1. **窗口打开测试** - 验证各工具窗口的独立菜单
2. **菜单切换测试** - 验证窗口聚焦时的菜单切换
3. **快捷键测试** - 验证所有快捷键功能
4. **菜单事件测试** - 验证菜单项的事件处理
5. **平台兼容性测试** - 验证 macOS/Windows/Linux 的差异

### 验证点
- ✅ 每个工具窗口显示独立菜单
- ✅ 窗口切换时菜单正确切换
- ✅ 快捷键在对应窗口中正常工作
- ✅ 菜单事件正确路由到对应工具
- ✅ macOS 显示品牌菜单，Windows/Linux 显示 Exit
- ✅ 复制/粘贴功能不与主窗口冲突

## 🔄 升级过程

### 从共享菜单到独立菜单

**之前的问题:**
- 所有工具窗口共享主窗口菜单
- 复制/粘贴事件冲突
- 无法为不同工具定制菜单功能
- macOS 菜单体验不佳

**现在的解决方案:**
- 每个工具窗口有独立菜单模板
- 动态菜单切换，无事件冲突
- 工具特定的菜单项和功能
- 平台原生的菜单体验

## 📝 使用指南

### 开发者

#### 为新工具添加独立菜单

1. **引入菜单处理器**
```html
<script src="tool-menu-handler.js"></script>
```

2. **初始化菜单处理器**
```javascript
class MyToolAnalyzer {
  constructor() {
    // 初始化工具逻辑
    this.setupUI();
    
    // 初始化菜单处理器
    this.menuHandler = new ToolMenuHandler('My Tool Name', this);
  }
}
```

3. **在主进程中创建窗口**
```javascript
function createMyToolWindow() {
  const toolWindow = new BrowserWindow({...});
  
  toolWindow.once('ready-to-show', () => {
    toolWindow.show();
    // 设置独立菜单
    createToolWindowMenu(toolWindow, 'My Tool Name');
  });
}
```

### 用户

#### 菜单使用
1. 打开任意生物信息学工具
2. 观察顶部菜单栏变化为工具特定菜单
3. 使用菜单项或快捷键执行功能
4. 切换到其他窗口，菜单自动切换

#### 常用操作
- 使用 **Ctrl/Cmd + C/V** 进行复制粘贴
- 使用 **Ctrl/Cmd + R** 运行分析
- 使用 **F5** 刷新数据
- 使用 **Ctrl/Cmd + W** 关闭工具窗口

## 🚀 性能优化

### 菜单缓存
- 菜单模板存储在 `Map` 中，避免重复创建
- 窗口关闭时自动清理缓存
- 动态切换使用已缓存的菜单对象

### 事件处理优化
- 使用事件委托减少监听器数量
- 快捷键检查目标元素避免冲突
- IPC 事件异步处理

### 内存管理
- 窗口关闭时自动移除菜单模板
- 清理事件监听器防止内存泄漏
- 使用弱引用避免循环引用

## 🔧 故障排除

### 常见问题

1. **菜单未切换**
   - 检查窗口是否正确获得焦点
   - 查看控制台是否有菜单切换日志

2. **快捷键不工作**
   - 确认工具已初始化 `ToolMenuHandler`
   - 检查快捷键是否与系统冲突

3. **复制粘贴异常**
   - 验证是否有焦点检查逻辑
   - 确认目标元素选择器正确

### 调试技巧
- 打开开发者工具查看控制台日志
- 使用测试页面验证各项功能
- 检查 IPC 事件是否正确发送和接收

## 📋 总结

GenomeExplorer 的独立菜单系统提供了：

- **🎯 真正独立**: 每个工具窗口都有自己的菜单
- **🔄 动态切换**: 窗口聚焦时自动切换菜单  
- **🖥️ 平台原生**: macOS 和 Windows/Linux 的原生菜单体验
- **⌨️ 完整快捷键**: 支持所有常用快捷键组合
- **🛠️ 易于扩展**: 新工具可轻松集成独立菜单
- **🧪 全面测试**: 包含完整的测试验证系统

这个系统解决了之前共享菜单的所有问题，为用户提供了一致、直观的菜单体验，同时为开发者提供了灵活的菜单定制能力。 