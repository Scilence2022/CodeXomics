# Windows 兼容性和问题解决指南

## 概述

本指南解决了 Genome AI Studio 在 Windows 操作系统下的两个主要问题：

1. **Blast 数据库创建路径问题**
2. **Protein 3D Structure Viewer WebGL 兼容性问题**

## 🧬 Blast 数据库问题解决方案

### 问题描述

原先的实现存在以下问题：
- 使用硬编码的 macOS 路径 `/Users/song/blast/db`
- 使用 Unix 特定的 `mkdir -p` 命令
- 没有跨平台路径处理逻辑

### 解决方案特性

#### 1. 智能路径选择
- **优先级 1**: 当前打开的基因组文件所在目录
- **优先级 2**: 用户数据目录（按操作系统适配）

#### 2. 跨平台路径支持

| 操作系统 | 默认数据库路径 |
|---------|---------------|
| **Windows** | `%LOCALAPPDATA%\GenomeAIStudio\blast\db` |
| **macOS** | `~/Library/Application Support/GenomeAIStudio/blast/db` |
| **Linux** | `~/.local/share/GenomeAIStudio/blast/db` |

#### 3. 当前文件目录优先
- 如果有打开的基因组文件，数据库将在 `文件目录/blast_db` 创建
- 这样可以保持数据和数据库的关联性

### 使用方法

1. **打开基因组文件**
   ```
   加载任何支持的基因组文件 (.fasta, .gb, .genbank 等)
   ```

2. **创建 Blast 数据库**
   - 转到 Blast 搜索界面
   - 选择"Local"服务
   - 点击"Database Management"
   - 数据库将自动在当前文件目录创建

3. **验证数据库位置**
   - 数据库文件将显示在基因组文件同一目录的 `blast_db` 子文件夹中

## 🧪 Protein 3D Structure Viewer 问题解决方案

### 问题描述

Windows 下 WebGL 可能受到以下因素影响：
- 图形驱动程序版本
- 浏览器安全设置
- 硬件加速设置
- 杀毒软件限制

### 解决方案特性

#### 1. WebGL 兼容性检测
- 启动时自动检测 WebGL 支持
- 提供详细的系统信息反馈
- 识别软件渲染警告

#### 2. 优雅降级机制
当 WebGL 不可用时，提供以下替代方案：

| 功能 | 描述 |
|------|------|
| **📁 下载 PDB 文件** | 直接下载结构文件到本地 |
| **ℹ️ 显示结构信息** | 展示蛋白质元数据和链接 |
| **🌐 RCSB PDB 查看** | 在官方网站查看结构 |

#### 3. 详细错误诊断
- WebGL 支持状态
- 图形渲染器信息
- 浏览器兼容性提示
- 具体解决建议

### Windows 下的解决步骤

#### 1. 更新图形驱动程序
```powershell
# NVIDIA 用户
# 访问 https://www.nvidia.com/drivers/
# 下载并安装最新驱动

# AMD 用户
# 访问 https://www.amd.com/support/
# 下载并安装最新驱动

# Intel 用户
# 访问 https://www.intel.com/content/www/us/en/support/
# 下载并安装最新驱动
```

#### 2. 浏览器设置

**Chrome/Edge:**
1. 地址栏输入 `chrome://flags/`
2. 搜索 "webgl"
3. 启用所有 WebGL 相关选项

**Firefox:**
1. 地址栏输入 `about:config`
2. 搜索 `webgl.force-enabled`
3. 设置为 `true`

#### 3. Windows 硬件加速

1. **Windows 设置**
   - 设置 → 系统 → 显示 → 图形设置
   - 启用"硬件加速 GPU 计划"

2. **应用特定设置**
   - 添加 Genome AI Studio 应用
   - 选择"高性能"GPU

## 💡 最佳实践

### Blast 数据库管理
1. **保持组织结构**
   ```
   项目文件夹/
   ├── genome.fasta          # 基因组文件
   ├── annotations.gff       # 注释文件
   └── blast_db/            # 自动创建的数据库目录
       ├── genome.nhr
       ├── genome.nin
       └── genome.nsq
   ```

2. **备份重要数据库**
   - 大型数据库创建耗时
   - 定期备份 `blast_db` 目录

### Protein 3D Viewer 优化
1. **使用最新浏览器**
   - Chrome 90+ / Edge 90+
   - Firefox 85+

2. **检查系统要求**
   - 4GB+ 内存推荐
   - 专用显卡（推荐）
   - OpenGL 2.1+ 支持

## 🐛 故障排除

### Blast 数据库问题

**问题**: 找不到 makeblastdb 命令
```bash
解决方案:
1. 确保 BLAST+ 已正确安装
2. 检查环境变量 PATH 设置
3. 使用绝对路径指定 BLAST+ 安装位置
```

**问题**: 权限拒绝错误
```bash
解决方案:
1. 以管理员权限运行应用
2. 检查文件夹写入权限
3. 选择不同的数据库存储位置
```

### WebGL 问题

**问题**: WebGL 不受支持
```
解决方案:
1. 更新图形驱动程序
2. 启用浏览器硬件加速
3. 检查杀毒软件设置
4. 使用降级查看选项
```

**问题**: 性能缓慢
```
解决方案:
1. 关闭其他占用 GPU 的应用
2. 降低浏览器缩放级别
3. 使用独立显卡（如可用）
```

## 🔧 开发者信息

### 修改的文件
- `src/renderer/modules/BlastManager.js`: 跨平台路径处理
- `src/renderer/modules/ProteinStructureViewer.js`: WebGL 兼容性

### 新增功能
- 操作系统检测和路径适配
- WebGL 支持检测
- 优雅降级机制
- 详细错误诊断

### API 变更
- `BlastManager.getPlatformDbPath()`: 获取平台特定数据库路径
- `ProteinStructureViewer.checkWebGLSupport()`: WebGL 支持检测
- `ProteinStructureViewer.showWebGLErrorDialog()`: 错误处理对话框

## 📞 技术支持

如果遇到其他问题：

1. **收集系统信息**
   - 操作系统版本
   - 浏览器版本
   - 显卡型号和驱动版本

2. **检查控制台日志**
   - 按 F12 打开开发者工具
   - 查看 Console 标签页的错误信息

3. **提供错误详情**
   - 具体错误消息
   - 重现步骤
   - 系统配置信息

通过这些改进，Genome AI Studio 现在在 Windows 平台上提供了更好的兼容性和用户体验。