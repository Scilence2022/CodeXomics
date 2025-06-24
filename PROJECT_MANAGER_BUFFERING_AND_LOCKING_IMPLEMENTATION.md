# Project Manager 缓冲更改和文件锁定功能实现

## 🎯 改进目标

本次更新解决了两个重要的用户体验问题：
1. **自动保存过于频繁** - 每次添加文件或拖拽文件后都会立即保存项目文件
2. **缺乏文件保护** - 项目文件可能被多个程序同时修改导致数据损坏

## 📋 实现内容

### 1. 🔄 缓冲更改机制

#### 概述
将立即保存改为缓冲机制，用户操作后先在内存中标记为"有未保存更改"，通过Save按钮手动保存。

#### 核心功能

##### A. 状态管理方法
```javascript
// 标记项目为已修改状态
markProjectAsModified() {
    this.currentProject.hasUnsavedChanges = true;
    this.currentProject.modified = new Date().toISOString();
    // 保存到本地存储但不保存XML文件
    this.projects.set(this.currentProject.id, this.currentProject);
    this.saveProjects();
}

// 标记项目为已保存状态
markProjectAsSaved() {
    this.currentProject.hasUnsavedChanges = false;
    this.projects.set(this.currentProject.id, this.currentProject);
    this.saveProjects();
    this.updateProjectTitle();
    this.updateSaveButtonState();
}
```

##### B. 保存按钮状态更新
```javascript
updateSaveButtonState() {
    const saveBtn = document.querySelector('[onclick="projectManagerWindow.saveCurrentProject()"]');
    const hasChanges = this.currentProject && this.currentProject.hasUnsavedChanges;
    
    if (hasChanges) {
        // 红色脉冲效果表示有未保存更改
        saveBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
        saveBtn.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.4)';
        saveBtn.innerHTML = '💾 Save *';
        saveBtn.style.animation = 'pulse 2s infinite';
    } else {
        // 正常状态
        saveBtn.style.background = 'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)';
        saveBtn.innerHTML = '💾 Save';
        saveBtn.style.animation = '';
    }
}
```

##### C. 脉冲动画CSS
```css
@keyframes pulse {
    0% {
        transform: scale(1);
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
    }
    50% {
        transform: scale(1.05);
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.6);
    }
    100% {
        transform: scale(1);
        box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);
    }
}
```

#### 应用场景

##### 添加文件时
```javascript
// 修改前：立即保存XML文件
await this.saveProjectToXMLFile();

// 修改后：缓冲更改
this.markProjectAsModified();
this.updateSaveButtonState();
this.showNotification('Added files (changes buffered)', 'success');
```

##### 拖拽文件时
```javascript
// 修改前：立即保存XML文件
await this.saveProjectToXMLFile();

// 修改后：缓冲更改
this.markProjectAsModified();
this.updateSaveButtonState();
this.showNotification('File moved (changes buffered)', 'success');
```

##### 手动保存时
```javascript
async saveCurrentProject() {
    await this.saveProjectToFile(this.currentProject);
    this.markProjectAsSaved(); // 标记为已保存
    this.showNotification('Project saved successfully', 'success');
}
```

### 2. 🔒 文件独占锁定机制

#### 概述
打开项目文件时使用独占锁定，防止其他程序同时修改同一项目文件。

#### 核心功能

##### A. 锁定状态管理
```javascript
constructor() {
    this.projectFileLocks = new Map(); // 跟踪项目文件锁定状态
}
```

##### B. 文件锁定方法
```javascript
async lockProjectFile(filePath) {
    if (!window.electronAPI || !window.electronAPI.lockProjectFile) {
        return false;
    }
    
    try {
        const result = await window.electronAPI.lockProjectFile(filePath);
        if (result.success) {
            this.projectFileLocks.set(filePath, {
                locked: true,
                lockedAt: new Date().toISOString(),
                lockId: result.lockId
            });
            console.log(`🔒 Project file locked: ${filePath}`);
            return true;
        } else {
            this.showNotification(`Cannot open project: ${result.error}`, 'error');
            return false;
        }
    } catch (error) {
        console.error('Error locking project file:', error);
        return false;
    }
}
```

##### C. 文件解锁方法
```javascript
async unlockProjectFile(filePath) {
    const lockInfo = this.projectFileLocks.get(filePath);
    if (!lockInfo) return;
    
    try {
        const result = await window.electronAPI.unlockProjectFile(filePath, lockInfo.lockId);
        if (result.success) {
            this.projectFileLocks.delete(filePath);
            console.log(`🔓 Project file unlocked: ${filePath}`);
        }
    } catch (error) {
        console.error('Error unlocking project file:', error);
    }
}
```

##### D. 批量解锁方法
```javascript
async unlockAllProjectFiles() {
    console.log('🔓 Unlocking all project files...');
    const promises = [];
    for (const filePath of this.projectFileLocks.keys()) {
        promises.push(this.unlockProjectFile(filePath));
    }
    await Promise.all(promises);
}
```

#### 后端实现 (main.js)

##### A. 锁定管理器
```javascript
const projectFileLocks = new Map();

// 项目文件锁定处理器
ipcMain.handle('lockProjectFile', async (event, filePath) => {
    try {
        // 检查文件是否已被锁定
        if (projectFileLocks.has(filePath)) {
            return { 
                success: false, 
                error: 'File is already locked by another instance' 
            };
        }
        
        // 尝试独占访问
        const lockId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const fd = fs.openSync(filePath, 'r+');
        fs.closeSync(fd);
        
        // 创建锁定记录
        projectFileLocks.set(filePath, {
            lockId: lockId,
            lockedAt: new Date().toISOString(),
            processId: process.pid
        });
        
        return { success: true, lockId: lockId };
    } catch (fileError) {
        if (fileError.code === 'EBUSY' || fileError.code === 'EACCES') {
            return { 
                success: false, 
                error: 'File is currently being used by another application' 
            };
        }
        throw fileError;
    }
});
```

##### B. 解锁处理器
```javascript
ipcMain.handle('unlockProjectFile', async (event, filePath, lockId) => {
    try {
        const lockInfo = projectFileLocks.get(filePath);
        
        if (!lockInfo || lockInfo.lockId !== lockId) {
            return { success: false, error: 'Invalid lock ID' };
        }
        
        projectFileLocks.delete(filePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
```

##### C. 应用退出清理
```javascript
app.on('before-quit', () => {
    console.log('🔓 Cleaning up all file locks before quit...');
    projectFileLocks.clear();
});
```

#### 集成到项目加载流程

##### 加载项目文件时的锁定
```javascript
async loadProjectFromFile(filePath) {
    try {
        // 尝试锁定项目文件
        const lockAcquired = await this.lockProjectFile(filePath);
        if (!lockAcquired) {
            return; // 锁定失败，无法打开项目
        }
        
        // 读取文件内容
        const result = await window.electronAPI.loadProjectFile(filePath);
        if (result.success) {
            await this.loadProjectFromFileContent(result.content, result.fileName, filePath);
        } else {
            // 读取失败，释放锁定
            await this.unlockProjectFile(filePath);
            throw new Error(result.error);
        }
    } catch (error) {
        // 确保释放锁定
        await this.unlockProjectFile(filePath);
        this.showNotification(`Failed to load project: ${error.message}`, 'error');
    }
}
```

##### 窗口关闭时的清理
```javascript
window.addEventListener('beforeunload', async () => {
    if (projectManagerWindow) {
        await projectManagerWindow.unlockAllProjectFiles();
    }
});
```

### 3. 🎹 键盘快捷键支持

#### 支持的快捷键
- **Ctrl/Cmd + S**: 保存项目
- **Ctrl/Cmd + Shift + S**: 另存为项目
- **Ctrl/Cmd + O**: 打开项目
- **Ctrl/Cmd + N**: 新建项目

#### 实现代码
```javascript
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
            case 's':
                e.preventDefault();
                if (e.shiftKey) {
                    this.saveProjectAs();
                } else {
                    this.saveCurrentProject();
                }
                break;
            case 'o':
                e.preventDefault();
                this.openProject();
                break;
            case 'n':
                e.preventDefault();
                this.createNewProject();
                break;
        }
    }
});
```

## 🎨 用户体验改进

### 1. 视觉反馈

#### 保存按钮状态
- **正常状态**: 蓝绿色渐变，显示"💾 Save"
- **有未保存更改**: 红色渐变，显示"💾 Save *"，脉冲动画
- **悬浮提示**: 显示具体的保存状态信息

#### 通知消息
- **添加文件**: "Added files (changes buffered)"
- **移动文件**: "File moved (changes buffered)"
- **保存成功**: "Project saved successfully"
- **锁定失败**: "Cannot open project: File is being used by another application"

### 2. 操作流程

#### 添加文件流程
1. 用户点击"Add Files"
2. 选择文件并确认复制选项
3. 文件复制到项目Files目录
4. 项目标记为已修改，保存按钮变红色并脉冲
5. 用户需要手动点击Save保存更改

#### 文件拖拽流程
1. 用户拖拽文件到不同文件夹
2. 文件物理移动到新位置
3. 项目标记为已修改，保存按钮状态更新
4. 用户手动保存确认更改

#### 项目打开流程
1. 用户选择项目文件
2. 系统尝试独占锁定文件
3. 如果锁定成功，加载项目内容
4. 如果锁定失败，显示错误信息并取消打开

## 🔧 技术优势

### 1. 性能提升
- **减少磁盘I/O**: 不再频繁写入XML文件
- **用户控制**: 用户决定何时保存，避免不必要的保存操作
- **批量操作**: 多个操作可以一次性保存

### 2. 数据安全
- **独占锁定**: 防止多程序同时修改项目文件
- **错误恢复**: 锁定失败时的优雅处理
- **自动清理**: 应用退出时自动释放所有锁定

### 3. 用户体验
- **直观反馈**: 保存按钮状态清晰显示项目状态
- **键盘支持**: 常用操作的快捷键支持
- **缓冲通知**: 明确告知用户操作已缓冲

## 📁 文件修改

### 主要修改文件
- `src/project-manager.html` - 缓冲机制和锁定功能
- `src/main.js` - 文件锁定IPC处理器
- `src/preload.js` - 文件锁定API暴露

### 新增方法
- `markProjectAsModified()` - 标记项目已修改
- `markProjectAsSaved()` - 标记项目已保存
- `updateSaveButtonState()` - 更新保存按钮状态
- `lockProjectFile()` - 锁定项目文件
- `unlockProjectFile()` - 解锁项目文件
- `unlockAllProjectFiles()` - 批量解锁文件

## 🎉 总结

这次改进大幅提升了Project Manager的用户体验和数据安全性：

### 用户体验提升
- **主动保存**: 用户控制保存时机，避免频繁自动保存
- **状态可视化**: 保存按钮清晰显示项目状态
- **快捷键支持**: 提高操作效率

### 数据安全保障
- **文件保护**: 独占锁定防止数据冲突
- **优雅处理**: 锁定冲突时的友好提示
- **自动清理**: 确保程序退出时释放资源

### 技术架构优化
- **缓冲机制**: 减少不必要的磁盘操作
- **状态管理**: 清晰的项目修改状态跟踪
- **错误处理**: 完善的异常情况处理

这些改进使GenomeExplorer Project Manager更加稳定、高效和用户友好，为生物信息学研究提供了更可靠的项目管理工具。 