# Circos Genome Plotter - GenomeExplorer

## 概述

Circos Genome Plotter 是 GenomeExplorer 的新增功能，提供了强大的基因组圈图可视化工具。它集成了 AI 驱动的参数控制系统，让用户可以通过自然语言命令动态调整图表参数。

## 主要特性

### 🎨 可视化功能
- **圆形基因组布局**：以圆形方式展示染色体或基因组
- **多轨道支持**：基因、GC含量、重复序列等多种数据轨道
- **交互式元素**：点击染色体和基因获取详细信息
- **链接可视化**：显示基因组间的联系（同源、重复、倒位等）
- **实时工具提示**：鼠标悬停显示详细信息

### 🤖 AI 参数控制
- **自然语言命令**：通过聊天界面调整参数
- **实时响应**：参数更改立即反映在图表上
- **智能建议**：AI 助手提供参数调整建议
- **命令历史**：保存和回顾之前的操作

### 📊 数据支持
- **多种格式**：支持 JSON、CSV、TSV 数据文件
- **示例数据**：内置人类基因组和大肠杆菌示例
- **自定义数据**：用户可上传自己的基因组数据
- **数据验证**：自动检查数据格式和完整性

## 使用方法

### 启动 Circos Plotter

1. 打开 GenomeExplorer 应用
2. 在菜单栏选择 `Tools` → `Circos Genome Plotter`
3. 或使用快捷键 `Ctrl+Shift+C` (macOS: `Cmd+Shift+C`)

### 基本操作

#### 加载数据
```
点击 "Load Data" 按钮上传文件
或
点击 "Load Example" 加载示例数据
```

支持的文件格式：
- `*.json` - 标准 JSON 格式
- `*.csv` - 逗号分隔值
- `*.tsv` - 制表符分隔值

#### 交互操作
- **点击染色体**：查看染色体信息
- **悬停基因**：显示基因详情
- **点击链接**：查看关联信息
- **拖拽缩放**：调整视图范围

### AI 命令系统

在右侧聊天面板中输入自然语言命令来控制图表：

#### 基本参数调整
```
"改变半径为 300"
"将染色体宽度设为 15"
"设置间隙为 5 度"
```

#### 颜色方案
```
"使用彩虹色彩"
"改为蓝色主题"
"应用 viridis 配色"
```

#### 显示选项
```
"隐藏标签"
"显示刻度"
"关闭基因轨道"
```

#### 导出功能
```
"导出 SVG"
"保存图表"
```

### 参数面板

右侧面板提供快速参数调整：

| 参数 | 范围 | 说明 |
|------|------|------|
| 绘图半径 | 150-400px | 控制圆形图表的大小 |
| 染色体宽度 | 5-20px | 染色体弧线的粗细 |
| 间隙角度 | 1-10° | 染色体间的间隔 |
| 显示标签 | 开/关 | 染色体名称标签 |
| 显示刻度 | 开/关 | 位置刻度标记 |
| 配色方案 | 6种 | 预设颜色主题 |

## 数据格式

### JSON 格式示例

```json
{
  "chromosomes": [
    {
      "name": "chr1",
      "length": 249250621,
      "color": "#1f77b4"
    }
  ],
  "genes": [
    {
      "chromosome": "chr1",
      "start": 1000,
      "end": 2000,
      "name": "GENE1",
      "type": "protein_coding",
      "value": 0.8
    }
  ],
  "links": [
    {
      "source": {
        "chromosome": "chr1",
        "start": 1000,
        "end": 2000
      },
      "target": {
        "chromosome": "chr2", 
        "start": 5000,
        "end": 6000
      },
      "value": 0.9
    }
  ]
}
```

### CSV 格式示例

```csv
chromosome,start,end,name,type,value
chr1,1000,2000,GENE1,protein_coding,0.8
chr1,3000,4000,GENE2,non_coding,0.6
chr2,1000,1500,GENE3,pseudogene,0.3
```

## AI 命令参考

### 参数调整命令

| 命令类型 | 示例命令 | 效果 |
|----------|----------|------|
| 半径调整 | "change radius to 300" | 设置图表半径为300px |
| 宽度调整 | "set chromosome width to 15" | 染色体宽度设为15px |
| 颜色更改 | "use rainbow colors" | 应用彩虹配色方案 |
| 标签控制 | "hide labels" | 隐藏染色体标签 |
| 刻度控制 | "show ticks" | 显示位置刻度 |
| 导出文件 | "export SVG" | 导出矢量图格式 |
| 重置参数 | "reset" | 恢复默认设置 |
| 帮助信息 | "help" | 显示命令列表 |

### 高级功能

#### 轨道管理
```
"添加 GC 含量轨道"
"显示重复序列"
"隐藏基因轨道"
```

#### 数据查询
```
"显示第1号染色体信息"
"查找基因 dnaK"
"统计蛋白编码基因数量"
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+C` | 打开 Circos Plotter |
| `Ctrl+O` | 加载数据文件 |
| `Ctrl+S` | 导出 SVG |
| `Ctrl+R` | 重置参数 |
| `F1` | 显示帮助 |

## 性能优化

### 大数据处理
- 基因显示限制：最多200个基因（性能考虑）
- 链接显示限制：最多20条链接
- 自动数据采样：超大数据集自动采样显示

### 渲染优化
- SVG 矢量图形：无损缩放
- 实时重绘：参数更改立即生效
- 内存管理：自动清理未使用的元素

## 故障排除

### 常见问题

**Q: 图表显示空白**
A: 检查数据格式是否正确，确保包含有效的染色体信息

**Q: AI 命令无响应**
A: 尝试使用更简单的命令，如 "help" 或 "reset"

**Q: 文件加载失败**
A: 确认文件格式为 JSON/CSV/TSV，检查数据结构

**Q: 导出文件过大**
A: 减少显示的基因和链接数量，或降低图表分辨率

### 调试模式

开发者工具（F12）中查看控制台输出：
```javascript
// 查看当前数据
console.log(circosPlotter.data);

// 查看参数设置
console.log(circosPlotter.radius, circosPlotter.colorScheme);
```

## 扩展开发

### 自定义轨道

```javascript
// 添加新轨道类型
circosPlotter.addTrack({
  name: "Custom Track",
  type: "scatter",
  data: customData,
  color: "#ff0000"
});
```

### 自定义颜色方案

```javascript
// 添加新配色
circosPlotter.colorSchemes.custom = [
  "#ff0000", "#00ff00", "#0000ff"
];
```

## 技术规格

- **图形库**：D3.js v7
- **文件处理**：PapaParse
- **输出格式**：SVG（可转换为 PNG/PDF）
- **支持浏览器**：Chrome 88+, Firefox 85+, Safari 14+
- **数据限制**：最大 100MB JSON 文件

## 更新日志

### v1.0.0 (2024-12-06)
- 🎉 初始发布
- ✨ 基本圆形基因组可视化
- 🤖 AI 参数控制系统
- 📊 多种数据格式支持
- 🎨 6种预设配色方案
- 💾 SVG 导出功能

## 反馈与支持

遇到问题或有改进建议？请通过以下方式联系：

- **GitHub Issues**: [项目仓库](https://github.com/Scilence2022/GenomeAIStudio)
- **Email**: songlf@tib.cas.cn
- **文档更新**: 查看项目 Wiki

---

**注意**: 这是 GenomeExplorer 的实验性功能，我们持续改进中。感谢您的使用和反馈！ 