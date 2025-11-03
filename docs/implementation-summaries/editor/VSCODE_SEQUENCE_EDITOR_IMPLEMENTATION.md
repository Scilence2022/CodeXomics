# VS Code-Style Sequence Editor Implementation

## 概述

为了改进CodeXomics中的序列可视化体验，我们实现了一个类似VS Code的序列编辑器，提供流畅的文本可视化和操作功能。

## 🚀 主要特性

### 1. 虚拟滚动 (Virtual Scrolling)
- **高性能渲染**：只渲染可见区域的序列行，支持数百万碱基的流畅显示
- **内存优化**：显著降低大序列的内存占用
- **平滑滚动**：类似VS Code的丝滑滚动体验

### 2. 语法高亮 (Syntax Highlighting)
- **碱基着色**：A(红色)、T(蓝色)、G(绿色)、C(橙色)、N(灰色)
- **特征高亮**：基因、CDS、RNA等注释特征的背景高亮
- **VS Code主题**：深色主题，护眼且专业

### 3. 文本选择与导航
- **鼠标操作**：点击定位光标，拖拽选择文本
- **键盘导航**：方向键、Home/End、Page Up/Down
- **快速跳转**：Ctrl+Home/End跳转到序列开始/结束

### 4. 键盘快捷键
```
Ctrl+A / Cmd+A    - 全选序列
Ctrl+C / Cmd+C    - 复制选中序列
Ctrl+F / Cmd+F    - 搜索序列
Ctrl+G / Cmd+G    - 跳转到指定位置
Home / End        - 行首/行尾
Ctrl+Home/End     - 序列开始/结束
Page Up/Down      - 翻页
Arrow Keys        - 光标移动
```

### 5. 搜索功能
- **模式匹配**：支持DNA序列搜索
- **结果高亮**：所有匹配结果高亮显示
- **当前匹配**：当前匹配项特殊标记
- **大小写选项**：可选择大小写敏感

### 6. 位置标尺
- **基准标记**：每10个碱基显示小标记
- **位置标签**：每50个碱基显示位置数字
- **动态更新**：随滚动位置动态更新

### 7. 可视化增强
- **行号显示**：左侧显示行号
- **光标闪烁**：VS Code风格的光标动画
- **选择高亮**：选中区域的蓝色高亮
- **滚动条**：可拖拽的自定义滚动条

## 🏗️ 技术实现

### 核心类：VSCodeSequenceEditor

```javascript
class VSCodeSequenceEditor {
    constructor(container, genomeBrowser)
    updateSequence(chromosome, sequence, start, end, annotations)
    render()
    // ... 其他方法
}
```

### 关键方法

#### 渲染优化
```javascript
renderSequence() {
    // 只渲染可见行 + 缓冲区
    const startLine = Math.floor(this.scrollTop / this.lineHeight);
    const endLine = Math.min(startLine + this.visibleLines + this.renderBuffer, this.totalLines);
    
    // 虚拟滚动实现
    for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
        const line = this.renderSequenceLine(lineIndex);
        this.sequenceContent.appendChild(line);
    }
}
```

#### 事件处理
```javascript
handleMouseDown(e) {
    this.isMouseDown = true;
    const position = this.getPositionFromMouseEvent(e);
    this.setCursorPosition(position);
    this.selectionStart = position;
}

handleKeyDown(e) {
    // 处理键盘快捷键和导航
    const shortcut = (e.ctrlKey ? 'Ctrl+' : '') + e.key;
    if (this.shortcuts[shortcut]) {
        this.shortcuts[shortcut]();
    }
}
```

### 集成方式

#### 1. 模块加载
在`index.html`中添加：
```html
<script src="modules/VSCodeSequenceEditor.js"></script>
```

#### 2. SequenceUtils集成
```javascript
displayVSCodeSequence(chromosome, sequence, start, end) {
    const container = document.getElementById('sequenceContent');
    const annotations = this.genomeBrowser.currentAnnotations[chromosome] || [];
    
    if (!this.vscodeEditor) {
        this.vscodeEditor = new VSCodeSequenceEditor(container, this.genomeBrowser);
    }
    
    this.vscodeEditor.updateSequence(chromosome, sequence, start, end, annotations);
}
```

## 🎨 样式设计

### VS Code主题色彩
```css
.vscode-sequence-editor {
    background: #1e1e1e;      /* 深色背景 */
    color: #d4d4d4;           /* 浅色文字 */
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
}

.line-numbers {
    background: #252526;       /* 行号背景 */
    color: #858585;           /* 行号颜色 */
}

.editor-cursor {
    background: #ffffff;       /* 白色光标 */
    animation: blink 1s infinite;
}
```

### 碱基着色方案
```css
.base-a { color: #f92672; }  /* 红色 - A */
.base-t { color: #66d9ef; }  /* 蓝色 - T */
.base-g { color: #a6e22e; }  /* 绿色 - G */
.base-c { color: #fd971f; }  /* 橙色 - C */
.base-n { color: #75715e; }  /* 灰色 - N */
```

### 特征高亮
```css
.feature-gene { background: rgba(102, 217, 239, 0.2); }
.feature-cds { background: rgba(166, 226, 46, 0.2); }
.feature-rna { background: rgba(249, 38, 114, 0.2); }
.feature-promoter { background: rgba(253, 151, 31, 0.2); }
```

## 📊 性能优化

### 1. 虚拟滚动
- 只渲染可见区域 + 5行缓冲区
- 大幅减少DOM元素数量
- 支持百万级碱基序列

### 2. 事件节流
- 滚动事件使用requestAnimationFrame
- 鼠标移动事件防抖处理
- 键盘事件优化响应

### 3. 内存管理
- 及时清理不可见的DOM元素
- 缓存计算结果
- 避免内存泄漏

## 🧪 测试验证

### 测试文件：test-vscode-sequence-editor.html

包含以下测试功能：
- 加载示例序列（5000碱基）
- 导航功能测试
- 文本选择测试
- 搜索功能测试
- 特征注释测试
- 导出功能测试

### 使用方法
```bash
# 在浏览器中打开测试文件
open test-vscode-sequence-editor.html

# 或通过HTTP服务器访问
python -m http.server 8000
# 访问 http://localhost:8000/test-vscode-sequence-editor.html
```

## 🔧 配置选项

### 编辑器参数
```javascript
const editor = new VSCodeSequenceEditor(container, genomeBrowser);

// 可配置参数
editor.basesPerLine = 80;        // 每行碱基数
editor.lineHeight = 20;          // 行高
editor.charWidth = 8;            // 字符宽度
editor.virtualScrolling = true;  // 启用虚拟滚动
editor.renderBuffer = 5;         // 渲染缓冲区行数
```

### 主题自定义
可通过CSS变量自定义主题：
```css
:root {
    --editor-bg: #1e1e1e;
    --editor-text: #d4d4d4;
    --line-number-bg: #252526;
    --cursor-color: #ffffff;
    --selection-bg: rgba(38, 79, 120, 0.4);
}
```

## 🚀 未来增强

### 计划功能
1. **多序列对比**：并排显示多条序列
2. **折叠功能**：可折叠的基因区域
3. **小地图**：序列缩略图导航
4. **注释编辑**：直接在编辑器中编辑注释
5. **正则搜索**：支持正则表达式搜索
6. **主题切换**：明亮/深色主题切换

### 性能优化
1. **Web Workers**：后台处理大序列
2. **增量渲染**：只更新变化的部分
3. **缓存策略**：智能缓存渲染结果

## 📝 总结

新的VS Code风格序列编辑器显著改善了CodeXomics的序列可视化体验：

✅ **性能提升**：虚拟滚动支持大序列流畅操作
✅ **用户体验**：熟悉的VS Code操作方式
✅ **视觉优化**：专业的语法高亮和主题
✅ **功能完整**：搜索、选择、导航等完整功能
✅ **可扩展性**：模块化设计便于功能扩展

这个实现为基因组序列分析提供了现代化、高效的可视化工具，大大提升了用户的工作效率。 