# Genome AI Studio 文件组织规则

## 文件目录结构规范

### 1. 文档文件 (*.md)

**位置：`docs/` 目录**

- **`docs/implementation-summaries/`** - 实现总结文档
  - 所有包含 `_IMPLEMENTATION`、`_SUMMARY`、`_COMPLETE`、`_SYSTEM`、`_FIX`、`_ENHANCEMENT` 的文档
  - 功能实现、修复记录、增强功能的详细说明
  - 例：`BLAST_INSTALLER_IMPLEMENTATION.md`、`PLUGIN_SYSTEM_PHASE2_COMPLETE.md`

- **`docs/project-guides/`** - 项目指南文档
  - 所有包含 `_README`、`_GUIDE`、`_SETUP` 的文档
  - 构建指南、使用说明、配置指南
  - 例：`build-instructions.md`、`PLUGIN_MARKETPLACE_SERVER_SETUP.md`

### 2. 测试文件 (test*.html)

**位置：`test/` 目录**

- **`test/unit-tests/`** - 单元测试
  - 单个功能模块的测试文件
  - 基础功能验证测试

- **`test/integration-tests/`** - 集成测试
  - 包含 `integration`、`complete`、`enhanced` 的测试文件
  - 多模块协作功能测试
  - 演示文件 (`demo-*.html`)

- **`test/fix-validation-tests/`** - 修复验证测试
  - 包含 `fix`、`validation`、`debug` 的测试文件
  - Bug修复验证和调试测试

### 3. 根目录保留文件

**仅保留以下文件在根目录：**
- `README.md` - 项目主要说明文档
- `PROJECT_RULES.md` - 项目规则文档
- `package.json` - Node.js项目配置
- `.gitignore` - Git忽略规则
- 其他核心配置文件

## AI 开发规则

### 创建新文档时：

1. **实现总结类文档** → `docs/implementation-summaries/`
   - 文件名包含：IMPLEMENTATION、SUMMARY、COMPLETE、SYSTEM、FIX、ENHANCEMENT
   - 内容：功能实现详情、修复记录、增强功能说明

2. **指南类文档** → `docs/project-guides/`
   - 文件名包含：README、GUIDE、SETUP、INSTRUCTIONS
   - 内容：使用指南、配置说明、构建指导

### 创建新测试文件时：

1. **单元测试** → `test/unit-tests/`
   - 文件名：`test-[功能名].html`
   - 内容：单个功能模块测试

2. **集成测试** → `test/integration-tests/`
   - 文件名：`test-[功能名]-integration.html`、`test-[功能名]-complete.html`
   - 内容：多模块协作测试、完整功能测试

3. **修复验证测试** → `test/fix-validation-tests/`
   - 文件名：`test-[功能名]-fix.html`、`test-[功能名]-validation.html`
   - 内容：Bug修复验证、调试测试

### 严格禁止：

- ❌ 在根目录创建新的 `*.md` 文档文件
- ❌ 在根目录创建新的 `test*.html` 测试文件
- ❌ 创建临时文档不清理
- ❌ 混合不同类型的文件在同一目录

### 文件命名规范：

- 文档文件：使用大写字母和下划线，如 `FEATURE_IMPLEMENTATION.md`
- 测试文件：使用小写字母和连字符，如 `test-feature-fix.html`
- 保持文件名描述性和一致性

## 定期整理规则

每当根目录下累积超过5个 `*.md` 或 `test*.html` 或 `test*.js` 文件时，AI应主动提醒进行文件整理，并按照本规则进行分类移动。

---

**最后更新：** 2024年12月
**适用版本：** GenomeExplorer v0.2.0+ 