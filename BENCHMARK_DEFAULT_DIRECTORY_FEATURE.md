# Benchmark Default Directory Configuration Feature

## 概述 / Overview

在Benchmark界面中添加了文件载入和导出的默认目录地址设置功能，默认目录设置为 `~/song/Documents/Genome-AI-Studio-Projects/test_data/`。

Added a default directory configuration feature for file loading and export operations in the Benchmark interface, with the default directory set to `~/song/Documents/Genome-AI-Studio-Projects/test_data/`.

## 实现的功能 / Implemented Features

### 1. 默认目录设置字段 / Default Directory Setting Field
- 📁 在Settings配置面板中添加了"Default File Directory"字段
- 🔧 提供文本输入框用于手动输入目录路径
- 🗂️ 提供浏览按钮用于图形化选择目录

### 2. 目录浏览功能 / Directory Browse Functionality  
- 🖱️ 点击浏览按钮打开系统目录选择对话框
- 💻 支持Electron环境下的原生文件对话框
- 🔄 提供备用的手动输入提示框

### 3. 配置持久化 / Configuration Persistence
- 💾 自动保存目录设置到localStorage
- ⚙️ 集成到应用程序配置管理器(如果可用)
- 🔄 启动时自动加载保存的目录设置

### 4. 路径规范化 / Path Normalization
- 📂 自动在路径末尾添加斜杠(/)
- ✅ 确保路径格式的一致性
- 🔧 处理Windows和Unix风格的路径

## 代码修改详情 / Code Modification Details

### 修改的文件 / Modified Files
- `src/renderer/modules/BenchmarkUI.js` - 主要的界面和功能实现

### 新增的UI组件 / New UI Components

```html
<div>
    <label style="display: block; margin-bottom: 8px; color: #34495e; font-weight: 500;">📁 Default File Directory:</label>
    <div style="display: flex; gap: 8px; align-items: center;">
        <input type="text" id="defaultFileDirectory" 
               value="/Users/song/Documents/Genome-AI-Studio-Projects/test_data/" 
               style="flex: 1; padding: 8px 12px; border: 2px solid #e1e8ed; border-radius: 6px; font-size: 14px; background: white;"
               placeholder="Enter default directory path...">
        <button type="button" id="browseDirectoryBtn" 
                style="padding: 8px 12px; border: 2px solid #3498db; background: #3498db; color: white; border-radius: 6px; cursor: pointer; font-size: 12px;"
                title="Browse for directory">
            📁
        </button>
    </div>
    <small style="color: #6c757d; font-size: 12px; margin-top: 4px; display: block;">
        💡 Default directory for file loading and export operations
    </small>
</div>
```

### 新增的方法 / New Methods

#### 1. `browseDefaultDirectory()` - 目录浏览方法
- 使用Electron的dialog API打开目录选择对话框
- 提供备用的prompt输入方式
- 自动规范化路径格式

#### 2. `saveDefaultDirectory(directoryPath)` - 保存配置方法
- 保存到localStorage作为备用存储
- 集成到应用程序配置管理器
- 提供错误处理

#### 3. `loadDefaultDirectory()` - 加载配置方法  
- 从应用程序配置优先加载
- 备用localStorage存储
- 返回默认路径值

#### 4. `getDefaultDirectory()` - 获取当前设置方法
- 从UI字段获取当前值
- 备用从配置加载
- 确保返回有效路径

#### 5. `initializeDefaultDirectory()` - 初始化方法
- 设置字段的初始值
- 添加change事件监听器
- 自动保存用户更改

### 配置集成 / Configuration Integration

修改了 `getBenchmarkConfiguration()` 方法，添加了 `defaultDirectory` 字段：

```javascript
return {
    suites: selectedSuites,
    generateReport: document.getElementById('generateReport').checked,
    // ... other configuration options
    defaultDirectory: this.getDefaultDirectory(), // 新增默认目录配置
    onProgress: (progress, suiteId, suiteResult) => {
        this.updateMainWindowProgress(progress, suiteId, suiteResult);
    }
};
```

## 使用方法 / Usage

### 1. 设置默认目录 / Setting Default Directory
1. 打开Benchmark界面
2. 在Settings面板中找到"Default File Directory"字段  
3. 直接在文本框中输入路径，或点击📁按钮浏览选择
4. 路径会自动保存并在下次打开时恢复

### 2. 访问配置 / Accessing Configuration
```javascript
// 获取当前默认目录
const defaultDir = benchmarkUI.getDefaultDirectory();

// 获取完整benchmark配置
const config = benchmarkUI.getBenchmarkConfiguration();
console.log('Default directory:', config.defaultDirectory);
```

## 技术特性 / Technical Features

### 🔧 兼容性 / Compatibility
- ✅ 支持Electron环境的原生文件对话框
- ✅ 提供非Electron环境的备用方案
- ✅ 兼容Windows和Unix路径格式

### 💾 持久化存储 / Persistent Storage  
- 🥇 优先使用应用程序配置管理器
- 🥈 备用localStorage存储
- 🔄 启动时自动恢复设置

### 🎨 用户体验 / User Experience
- 📱 响应式界面设计
- 💡 提供帮助提示文本
- 🎯 直观的浏览按钮
- ⚡ 实时保存更改

### 🛡️ 错误处理 / Error Handling
- 🚫 优雅处理文件对话框失败
- 🔄 提供多种备用方案
- 📝 详细的控制台日志记录

## 测试验证 / Testing Verification

创建了测试文件 `test-benchmark-directory-config.js` 来验证功能：

- ✅ 默认目录字段功能
- ✅ 配置集成测试
- ✅ UI交互模拟测试
- ✅ 路径规范化测试

## 未来增强 / Future Enhancements

### 可能的改进 / Possible Improvements
1. 📁 添加最近使用目录的下拉列表
2. 🔍 验证目录是否存在和可访问
3. 📋 支持多个预设目录配置
4. 🎨 改进目录选择的视觉反馈
5. 📊 与文件加载统计集成

### 集成建议 / Integration Suggestions
1. 将默认目录应用到文件加载工具
2. 在导出操作中使用默认目录
3. 与项目管理器的工作空间设置集成

---

## 总结 / Summary

成功在Benchmark界面中实现了默认目录配置功能，提供了：
- 🎯 用户友好的目录设置界面
- 💾 可靠的配置持久化存储
- 🔧 强大的错误处理和备用方案
- ✅ 完整的功能测试验证

This feature enhances the user experience by providing a centralized way to manage file paths for benchmark operations, reducing the need for repeated directory navigation and improving workflow efficiency.