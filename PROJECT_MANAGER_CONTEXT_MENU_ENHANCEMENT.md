# Project Manager 右键菜单增强和 Add Files 复制选项修复

## 📋 修复概述

本次更新解决了两个主要问题：
1. **Add Files 按钮缺少复制选项对话框**
2. **左侧项目列表缺少管理功能**

## 🎯 主要修复内容

### 1. Add Files 复制选项修复

**问题描述：**
- 点击 Add Files 按钮时，直接跳过复制选项对话框
- 用户无法选择是否将文件复制到项目数据文件夹

**修复方案：**
- 注释掉 `ProjectManager` 的直接调用逻辑
- 确保始终显示复制选项模态框
- 用户可选择：
  - ✅ **复制文件到项目数据文件夹**（推荐，默认选中）
  - ⚠️ **引用原始位置文件**

**修复位置：**
```javascript
// src/project-manager.html 第 1065-1070 行
// 注释掉ProjectManager的直接调用，始终显示复制选项
// if (this.projectManager) {
//     console.log('✅ Using ProjectManager core logic for adding files');
//     return await this.projectManager.addFiles();
// }
```

### 2. 项目列表右键菜单功能

**新增项目操作：**
- 🏷️ **重命名项目** - 修改项目名称
- 📋 **复制项目** - 创建项目副本
- 📤 **导出项目** - 导出为 XML (.prj.GAI) 格式
- ℹ️ **项目属性** - 查看项目详细信息
- 🗑️ **删除项目** - 删除项目（带确认对话框）

**新增文件夹操作：**
- 📁 **添加文件** - 向指定文件夹添加文件
- 📂 **新建子文件夹** - 在当前文件夹下创建子文件夹
- ✏️ **重命名文件夹** - 修改文件夹名称
- 🔍 **在资源管理器中打开** - 打开系统文件管理器
- 🗑️ **删除文件夹** - 删除文件夹及其所有内容

## 🔧 技术实现细节

### CSS 样式增强

```css
/* 操作按钮样式 */
.tree-actions {
    position: absolute;
    right: 5px;
    top: 50%;
    transform: translateY(-50%);
    opacity: 0;
    transition: opacity 0.2s;
}

.tree-item:hover .tree-actions {
    opacity: 1;
}

/* 右键菜单样式 */
.context-menu {
    position: absolute;
    background: white;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    min-width: 180px;
    display: none;
}
```

### JavaScript 功能实现

**右键菜单管理：**
```javascript
// 显示项目右键菜单
showProjectContextMenu(event, projectId) {
    event.preventDefault();
    this.currentContextProjectId = projectId;
    const menu = document.getElementById('projectContextMenu');
    this.showContextMenu(menu, event);
}

// 智能菜单定位
showContextMenu(menu, event) {
    menu.style.display = 'block';
    menu.style.left = (event.clientX + 10) + 'px';
    menu.style.top = (event.clientY + 10) + 'px';

    // 确保菜单在视窗内
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        menu.style.left = (event.clientX - rect.width) + 'px';
    }
    if (rect.bottom > window.innerHeight) {
        menu.style.top = (event.clientY - rect.height) + 'px';
    }
}
```

**核心功能方法：**
- `renameProject()` - 项目重命名
- `duplicateProject()` - 项目复制
- `exportProjectAs()` - 项目导出
- `deleteProject()` - 项目删除
- `createSubfolder()` - 创建子文件夹
- `deleteFolder()` - 删除文件夹

### IPC 通信增强

**新增 main.js IPC 处理器：**
```javascript
// 在资源管理器中打开文件夹
ipcMain.handle('openFolderInExplorer', async (event, folderPath) => {
    try {
        const { shell } = require('electron');
        
        if (!fs.existsSync(folderPath)) {
            return { success: false, error: 'Folder does not exist' };
        }
        
        await shell.openPath(folderPath);
        return { success: true, message: 'Folder opened in explorer' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

**preload.js API 暴露：**
```javascript
openFolderInExplorer: (folderPath) => ipcRenderer.invoke('openFolderInExplorer', folderPath),
```

## 🎨 用户界面改进

### 视觉效果
- 鼠标悬停时显示操作按钮（⋯）
- 右键菜单带有图标和清晰的文字说明
- 危险操作（删除）使用红色主题
- 平滑的 CSS 过渡动画

### 交互体验
- 右键菜单智能定位，避免超出视窗
- 点击其他区域自动隐藏菜单
- 所有操作都有成功/错误通知反馈
- 删除操作有确认对话框保护

## 📁 修改文件列表

### 主要修改文件
1. **`src/project-manager.html`** - 主要功能实现
   - 添加右键菜单 HTML 结构
   - 增强 CSS 样式
   - 实现 30+ 新功能方法

2. **`src/main.js`** - 后端支持
   - 添加 `openFolderInExplorer` IPC 处理器

3. **`src/preload.js`** - API 暴露
   - 添加 `openFolderInExplorer` API

### 测试文件
- **`test-project-context-menu.html`** - 功能测试页面

## 🧪 测试指南

### 测试步骤
1. 启动 GenomeExplorer 应用
2. 打开 Project Manager（File → Project Manager）
3. 创建或选择一个项目

### Add Files 复制选项测试
1. 点击 "Add Files" 按钮
2. 验证弹出复制选项对话框
3. 测试两个选项：
   - "复制文件到项目数据文件夹"（默认）
   - "引用原始位置文件"

### 右键菜单功能测试
1. 右键点击项目名称 → 测试项目操作菜单
2. 右键点击文件夹 → 测试文件夹操作菜单
3. 悬停测试 → 查看操作按钮（⋯）
4. 功能测试：
   - 重命名项目/文件夹
   - 复制项目
   - 创建子文件夹
   - 删除操作（验证确认对话框）
   - 在资源管理器中打开

## ✅ 验证标准

### 功能完整性
- [ ] Add Files 显示复制选项对话框
- [ ] 项目右键菜单所有功能正常
- [ ] 文件夹右键菜单所有功能正常
- [ ] 操作按钮悬停效果正常
- [ ] 菜单智能定位正常

### 用户体验
- [ ] 操作反馈通知正常
- [ ] 确认对话框保护正常
- [ ] UI 动画过渡流畅
- [ ] 跨平台兼容性（macOS, Windows, Linux）

### 错误处理
- [ ] 无效操作有错误提示
- [ ] 文件不存在时的错误处理
- [ ] 权限不足时的错误处理

## 🎉 总结

本次更新显著提升了 Project Manager 的用户体验：

1. **修复了 Add Files 复制选项缺失问题**，确保用户可以选择文件处理方式
2. **新增了完整的项目和文件夹管理功能**，支持重命名、复制、删除等操作
3. **改进了用户界面**，添加了直观的右键菜单和操作按钮
4. **增强了系统集成**，支持在资源管理器中打开文件夹

这些改进使 GenomeExplorer 的项目管理功能更加完善和用户友好。 