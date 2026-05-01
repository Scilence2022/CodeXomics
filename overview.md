# Canvas 渲染模式闪烁修复

## 问题 1：切换浏览位置时的闪烁

### 根因
Canvas 渲染器在构造函数中立即调用 `setupCanvas()` + `render()`，但此时容器（`unifiedContainer`）还未被添加到页面 DOM 中。`getBoundingClientRect()` 返回 0，fallback 到 800px。容器挂载后 ResizeObserver 触发正确宽度渲染，造成"先缩小再正常"的闪烁。

SVG 模式无此问题，因为 SVG 使用 `width: 100%` + `viewBox` + `preserveAspectRatio="none"`，浏览器自动拉伸适配。

### 修复
- 用 `requestAnimationFrame` 延迟首次 `setupCanvas()` + `render()` 到下一帧
- Canvas 初始 `opacity: 0`，渲染完成后淡入到 `opacity: 1`
- 改进 `setupCanvas()` 宽度获取策略（父链查找 → 窗口宽度估算，替代硬编码 800px fallback）
- 修复 `ctx.scale()` 累积 bug（改用 `ctx.setTransform()`）

---

## 问题 2：点击选择基因后的闪烁

### 根因
Canvas 模式下点击基因 → `showGeneDetails()` → `selectGene()` → `highlightSelectedGene()`。

`highlightSelectedGene()` 用 4 种 DOM 查询方法查找 SVG/DOM 基因元素来添加 `.selected` 类。但 **Canvas 模式下根本没有 SVG/DOM 基因元素**（基因是在 `<canvas>` 上绘制的），所以全部查找不到。

当找不到元素时（第 5016 行），代码走到 `refreshGeneTrackIfNeeded()` → `setTimeout(() => displayGenomeView(), 100)` → **完全重建所有 track** → 闪烁。

Canvas 渲染器本身已有选中高亮逻辑（`renderGene()` 中检查 `this.genomeBrowser.selectedGene` 并绘制 shadow/glow 效果），不需要 DOM 查询。

### 修复
1. **`highlightSelectedGene()` 添加 Canvas 模式分支**：检测 `renderingMode === 'canvas'`，直接调用 `canvasRenderer.render()` 触发重绘（Canvas 渲染器的 `render()` 方法已内含选中高亮逻辑），然后 `return` 跳过 SVG/DOM 查询
2. **`clearGeneSelection()` 添加 Canvas 渲染器重绘**：清除选中后触发 Canvas 渲染器重绘以移除高亮
3. **SVG fallback 中的 `refreshGeneTrackIfNeeded()` 添加保护**：当 `renderingMode === 'canvas'` 时不触发全量重绘（Canvas 模式下没有 SVG 元素是正常的，不是渲染异常）

---

## 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| `CanvasGenesRenderer.js` | 延迟渲染、opacity 淡入、改进宽度获取、setTransform 防 scale 累积、destroy 清理 rAF |
| `CanvasSequenceRenderer.js` | 同上（预防性修复） |
| `CanvasReadsRenderer.js` | 同上（预防性修复） |
| `TrackRenderer.js` | 存储 CanvasGenesRenderer 到 canvasRenderers Map、清理旧实例 |
| `renderer-modular.js` | `highlightSelectedGene()` Canvas 模式分支、`clearGeneSelection()` Canvas 重绘、SVG fallback 保护 |
