# CodeXomics 垃圾代码与维护债务深度分析报告

审计日期：2026-10-08（Asia/Shanghai）  
版本：0.722.0  
基准提交：`203baf4bdde6b843c0650d2d73f356c5abcbc010`  
性质：代码审计与报告；未修复、删除或提交生产代码。

## 1. 结论

项目的主要问题并非大量未使用变量或语法错误，而是**演示实现进入生产能力、抽取后的旧逻辑未退出、同一算法的多份实现发生语义分歧，以及检查脚本仍针对已移走的代码进行验证**。

最应优先处理的三个问题是：

1. tools 模式的 MCP `blast_search` 直接生成随机命中，返回固定统计信息，没有模拟标记。
2. 插件安全验证使用随机生成的代码和权限；单个插件被拒绝后，安装计划仍可能批准。
3. 同一段含 IUPAC 模糊碱基的 DNA，通过 MCP、渲染器默认回退和“统一处理”模块得到三个不同的反向互补结果。

这些代码不能通过“删掉 TODO”解决。必须先纠正能力契约、数据来源和调用链，再删除残留。报告列出 19 项发现，其中 7 项为 P1、10 项为 P2、2 项为 P3。P1 表示结果可信度、检查有效性或可访问功能已出现明确问题；不表示已证明所有正常使用场景都会触发，也不表示发现了可利用的安全漏洞。

## 2. 范围、方法与证据边界

### 2.1 审计范围

覆盖 Git 跟踪的 `src/`、`tools_registry/`、`scripts/`、`packages/` JavaScript 文件；通过 HTML 入口、动态脚本加载、模块导出、IPC、工具注册表和测试追踪调用关系。人工检查了资源管理 HTML、CSS 入口、构建配置和测试配置。

| 范围                        | JavaScript 文件数 |    物理行数 |
| --------------------------- | ----------------: | ----------: |
| `src/`，排除 `vendor/`      |               230 |     273,592 |
| `tools_registry/`           |                10 |       9,184 |
| `scripts/`                  |                32 |      11,120 |
| `packages/`，含插件示例载荷 |                 9 |       4,684 |
| 合计                        |           **281** | **298,580** |

物理行数包含注释、空行及嵌入的 HTML/CSS/数据，不能作为有效业务逻辑量。扫描排除第三方 vendor、依赖安装目录、生成站点、训练数据和论文材料；HTML 内联 JavaScript 未纳入 AST 总量。

### 2.2 方法

- 使用 Espree AST 分析 281 个文件，全部解析成功，收集 7,288 个类方法。
- 对至少 12 行的方法体按 token 类型和值比较，忽略注释与格式，识别完全重复的方法体。未做变量改名归一化，因此不覆盖所有近似重复。
- 搜索文件名和类名在运行代码中的引用，再人工检查脚本入口、动态加载和导出。没有调用引用只是候选证据，不能证明插件、控制台或外部客户端永远不会调用。
- 执行现有 ESLint、工具注册表校验、全量测试和覆盖率检查。
- 使用隔离 VM、IPC/Menu 替身和固定随机数执行最小复现。没有启动 Electron GUI，没有访问远程服务，没有安装或更新真实插件，没有操作用户基因组。

**“已证实”指源码行为或隔离调用已证实；“候选”指静态引用未找到、仍需运行与外部兼容性核实。** 所有位置以基准提交为准，后续改动可能使行号移动。

### 2.3 实际检查结果

| 检查                    | 结果                                                         | 解读                                                                                  |
| ----------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 现有 ESLint             | 455 个文件；0 错误、4 警告                                   | 没有大量未使用变量告警；Lint 无法判别随机结果是否冒充真实结果                         |
| AST 重复类方法声明      | 0                                                            | 未发现同一个类的方法被后面的同名声明覆盖                                              |
| 完全重复的方法体        | 17 组，40 处                                                 | 838 行涉及克隆；按每组保留一份粗算 477 行候选冗余，不能直接当成可删除量               |
| 工具注册表校验          | 命令成功                                                     | 219 条定义、213 个唯一工具、181 个内置映射；仍有 12 条重复诊断；策略检查实际检查 0 项 |
| 首次 `npm test`         | 8 文件失败、169 通过；65 测试失败、2161 通过；2 个未处理错误 | 使用本机 Node 25.6.1，主要错误是 `localStorage` 方法缺失                              |
| 关闭实验 Web Storage 后 | **177 文件、2226 测试全部通过**                              | 环境对照明确；不能把首次失败直接归为应用缺陷                                          |
| 同样环境下覆盖率检查    | 成功                                                         | 语句 12.17%、分支 11.66%、函数 13.10%、行 12.08%                                      |

依赖通过 `npm ci --ignore-scripts --no-audit --no-fund` 安装，未改动锁文件。项目声明的受支持 Node 基线是 20/22，本机是 25；本次未在 Node 20/22 或 Electron 内复测。Web Storage 对照使用 `NODE_OPTIONS=--no-experimental-webstorage`。

覆盖率分母只来自 `vitest.config.mjs` 配置的 `src/renderer/modules/**/*.js`；不代表主进程、MCP、独立 HTML 工具或整个项目的覆盖率。下述审计探针未纳入现有 Vitest 覆盖率。

## 3. 发现总览

| 编号 | 优先级 | 发现                                     | 证据与触发范围                           |
| ---- | ------ | ---------------------------------------- | ---------------------------------------- |
| A01  | P1     | MCP BLAST 随机生成结果                   | 已复现；tools 模式 `blast_search`        |
| A02  | P1     | 本地 BLAST 缺失序列时补造比对数据        | 已复现；目标序列字段为空                 |
| A03  | P1     | 插件安全分析与权限分析基于随机样例       | 已复现；启用该验证链时                   |
| A04  | P1     | 安装计划忽略非 critical 的单插件拒绝     | 已复现；strictMode 的 high 拒绝          |
| A05  | P1     | 依赖版本来自硬编码样例，版本算法错误     | 已复现部分算法；兼容版本回退分支         |
| A06  | P1     | 统一序列模块未接入，反向互补语义漂移     | 已复现；默认脚本入口与模糊碱基           |
| A07  | P1     | 下载菜单依赖缺失，旧窗口函数被遗留       | 菜单回调已复现；Project Manager 下载菜单 |
| A08  | P2     | 取不到区域序列时生成随机 DNA             | 已复现；`app.chatManager` 缺失           |
| A09  | P2     | 资源管理返回示例数据与空操作成功         | 完整 IPC/UI 调用链已核实                 |
| A10  | P2     | 工具策略一致性校验退化为零项检查         | 校验输出与实际策略对象已核实             |
| A11  | P2     | 同名 YAML 工具定义冲突，旧定义滞留       | 6 个同名工具、12 条诊断                  |
| A12  | P2     | PluginIntegrationService 抽取后未接线    | 高置信未使用候选；旧逻辑仍在 ChatManager |
| A13  | P2     | BLAST 模拟生成器与旧导出器残留           | 静态未调用候选；有源码测试引用           |
| A14  | P2     | 下载客户端子系统没有外部入口             | 6 文件、1001 行的孤立子图候选            |
| A15  | P2     | 插件更新器只更新元数据，安全更新随机判定 | 方法行为已复现；正常 UI 更新另走安装链   |
| A16  | P2     | 记忆推荐的占位实现与人为等待             | 源码与调用点已核实                       |
| A17  | P3     | 其他占位端点仍留在能力表或 UI 流程       | 项目打开事件、ZIP 导入、旧 RPC           |
| A18  | P3     | 开发示例随应用打包，旧依赖和样式候选     | 构建配置已核实；删除仍需兼容核实         |
| A19  | P2     | 算法克隆与超大模块提高维护成本           | AST 证实重复；文件体积仅作维护指标       |

## 4. 高优先级发现

### A01：MCP `blast_search` 实际返回随机命中

**位置：** `src/mcp-tools/ToolsIntegrator.js:349`；`src/mcp-tools/pathway/PathwayTools.js:247`、`:283`。

tools 模式从 `executeTool()` 直接进入 `performBLASTSearch()`，后者调用 `simulateBLASTResults()`。相似度、E-value、位置和长度通过随机数构造；耗时、数据库规模和搜索空间是固定字符串。没有执行真实 BLAST，也没有委托 renderer；结果不包含模拟标记。

固定相同输入，分别将随机数固定为 0.1 和 0.9，第一条命中的 identity 分别为 `64.0`、`96.0`，委托次数始终为 0。tools 模式这一端点已可直接复现；agent 模式另走代理链，不能据此断言它同样返回随机结果。

**影响：** 外部 MCP 客户端可能将演示命中当成真实分析。既有 ChatBox BLAST 实现与 MCP 路径发生分叉。

**建议：** 将该工具路由到真实 BLAST 服务，保持工具参数、返回协议和窗口选择契约；模拟生成器迁到明确的测试夹具。无运行环境时应返回不可执行错误。验收必须检查真正的执行委托、原始输出来源和失败路径。

### A02：本地 BLAST 解析器会随机补造目标序列

**位置：** `src/renderer/modules/BlastManager.js:5004`、`:5055`、`:5067`、`:5140`、`:5204`。

`parseBlastOutput()` 在 `sseq` 为空时调用 `generateSubjectSequence()`；没有真实序列时，还会按 mismatch/gap 数拼接近似 match 字符串。构造的数据写入 `alignment.subject`、`hsps.hitSeq`，返回标签仍为 `source: 'Local'`。

对同一条 17 列输出行，query 为 `ACGT`、subject 为空、identity 为 0，固定两组随机数得到目标序列 `DDDD` 和 `YYYY`。原因还包括 `/[ARNDCQEGHILKMFPSTWYV]/i.test(querySeq)` 将 DNA 也识别为蛋白质候选，导致补造内容可以含氨基酸字符。

正常命令在 `BlastManager.js:4925` 请求了 `qseq/sseq`，因此这属于字段缺失、异常输出或兼容数据触发的回退问题，不能描述成每次本地 BLAST 都造假。

**建议：** 缺失序列应显式表示 unavailable 或拒绝不完整输出；保留已读取的分数与坐标，但不要补造 subject 或比对位置。若支持展示性近似，必须单独标注且不可写入真实 HSP 字段。验收覆盖字段为空、格式错误、核酸/蛋白和 gap 情况。

### A03：插件安全验证使用随机生成的代码和权限

**位置：** `src/renderer/modules/PluginSecurityValidator.js:238`、`:321`、`:367`、`:390`、`:421`、`:515`。

`analyzePluginCode()` 扫描 `generateMockCode()` 返回的随机字符串，没有读取待安装包源码。`getMockPermissions()` 根据类别和随机数构造权限，问题行号也是随机生成。所谓依赖漏洞检查仅比较 `old-crypto-lib`、`insecure-parser` 两个样例名称。缓存键是 `id@version`，没有绑定包内容摘要。

同一插件、同一版本、同一来源，用两个新验证器和不同固定随机数，结果分别为 approved 和 rejected。使用新实例是为了避免缓存掩盖随机性。

**实际范围：** `PluginMarketplace.js:884` 将此结果用于可选安装验证。`PluginMarketplace.js:13`、`PluginManagerV2.js:26`、`PluginSystemBootstrap.js:52` 的默认设置均关闭验证，并标注为测试暂时关闭；General Settings 可改变开关。因此它不是当前默认必经检查，但开启它也不能获得真实源码检查。

**建议：** 核查真实包内容和权限声明，将检查结果绑定内容摘要；样例扫描器移入演示目录。未实现的验证不得产生“Security validation passed”。修复后再统一默认配置；仅把开关改为 true 会启用错误的随机逻辑。

### A04：单插件被拒绝，安装计划仍可能批准

**位置：** `src/renderer/modules/PluginSecurityValidator.js:132`、`:154`、`:165`、`:265`。

`validateInstallPlan()` 收集所有 `approved: false` 结果，但只因 critical 问题抛错。strictMode 下因 high 问题拒绝的插件，到了计划层仅记录警告，最终返回 `approved: true`。

探针固定随机数为 0.6、来源为 official、strictMode 为 true：单插件结果为 false，计划结果为 true。此问题在开启验证、使用相关严格规则时成立；并不意味着整个安装系统没有其他校验。

**建议：** 计划层忠实汇总子项批准状态，明确每种拒绝与警告的含义；任何被拒绝的必装项必须使计划失败。验收同时覆盖 high、critical、未信任来源和缓存结果。

### A05：插件依赖回退使用虚构版本，三份简陋版本算法共存

**位置：** `src/renderer/modules/PluginDependencyResolver.js:128`、`:146`、`:156`、`:225`、`:255`、`:273`；`PluginMarketplace.js:1427`；`PluginUpdateManager.js:152`。

当当前搜索结果不满足依赖约束时，`getAllVersionsForPlugin()` 返回六个样例插件的硬编码版本。未知真实插件返回空数组。选中所谓兼容版本后，再从 official 源获取插件对象并修改它的 `version`，没有按选中版本获取对应载荷。

`isCaretCompatible()` 只检查 major 相同及版本不小于下限，因此接受 `0.2.0` 满足 `^0.1.0`。版本比较的三个副本均使用 `split('.').map(Number)`，无法正确处理完整的预发布语义。

**建议：** 接入源的真实版本列表和按版本下载契约，无法查询时返回明确错误；统一使用已存在于依赖树的 semver 能力或同等经过验证的实现。不能通过改写对象的版本号假装切换软件包。

### A06：“统一序列处理”模块缺少加载入口，实际算法语义已分歧

**位置：** `src/renderer/modules/UnifiedSequenceProcessing.js:26`；`UnifiedDNATranslation.js:15`；`MicrobeGenomicsFunctions.js:102`；`src/mcp-tools/sequence/SequenceTools.js:394`；`src/renderer/index.html:5411`、`:5508`。

两个 Unified 文件存在，多个模块也通过 `window.Unified…` 判断是否使用它们；但在当前 `index.html` 脚本列表、动态 `loadScript()` 和其他运行源码中未找到对应加载入口。默认回退因此仍是主要路径；外部主动注入这些全局对象的情况不在此结论范围内。

输入 `ARYN` 的实际结果：

| 实现                                                           | 输出   | 原因                           |
| -------------------------------------------------------------- | ------ | ------------------------------ |
| MCP `SequenceTools.reverseComplement`                          | `NYRT` | 只互补 A/T/G/C/N，保留其他字母 |
| renderer `MicrobeGenomicsFunctions.reverseComplement` 默认回退 | `NNNT` | 未知碱基统一变为 N             |
| `UnifiedSequenceProcessing.reverseComplement`                  | `NRYT` | 正确互补 R/Y                   |

“统一模块”文件存在并不等于完成统一。**建议：** 先定义核酸算法共享契约、返回形状和大小写/模糊字符规则，接入所有消费者，再移除重复 fallback；不能直接删除 Unified 文件，也不能无适配地切换返回类型。

### A07：下载窗口实现被封存在局部作用域，菜单注入的是 undefined

**位置：** `src/main/project-ipc.js:1557`、`:1558`、`:1655`；`src/main.js:287`；`src/main/menu-builder.js:2807`、`:3181`；`src/main/window-management.js` 的 `module.exports`。

`main.js` 注入 `wm.createGenomicDownloadWindow`，但 window-management 没有定义或导出此成员。真正的同名实现被留在 project-ipc 注册函数内部，并用 `eslint-disable-next-line no-unused-vars` 保留。注释声称它镜像 window-management 实现，实际并不存在该镜像。

用 Menu/IPC 替身加载真实两个模块，建立 Project Manager 菜单并点击 NCBI Databases，得到 `createGenomicDownloadWindow is not a function`。这是调用级复现，尚未在真实 Electron UI 中点击复测。

旧局部实现还把下载 HTML 指向 `src/main/genomic-data-download.html`，实际已存在页面在 `src/genomic-data-download.html`。因此不能直接导出旧函数就算修复完成。

**建议：** 恢复明确的窗口工厂、正确的页面路径与依赖注入，再删除旧局部函数及只由它调用的 HTML 生成器。保留其他仍活跃的 project-ipc 项目/下载处理器。验收运行菜单回调和窗口载入，避免仅检查导出名称。

## 5. 冗余、空操作与未完成迁移

### A08：区域序列读取失败时生成随机 DNA

**位置：** `src/renderer/modules/BlastManager.js:3654`、`:3674`。

`getSequenceFromRegion()` 在 `app.chatManager` 不存在时，按区域长度随机拼接 A/T/G/C 并返回。相同区域的固定随机数复现结果是 `AAAAAAAA` 和 `CCCCCCCC`。正常 app 中 ChatManager 通常存在，因此是缺失依赖/异常初始化的触发范围；若读取已进入 catch，则另行抛错。

**建议：** 从真实 genome 数据源读取，依赖缺失或区域不可用时失败；不要用模拟序列填充用户准备提交的 BLAST query。用已知序列断言坐标、端点和错误处理。

### A09：资源管理接口返回样例，移除/导出为空操作

**位置：** `src/main/ipc-handlers.js:3672`、`:3714`、`:3725`；`src/preload.js:369`；`src/resource-manager.html:600`、`:976`、`:993`。

资源管理窗口初始化会调用 `getLoadedResources()`；主进程固定返回 `E.coli_K12.fasta` 和 `/Users/example/data/...`，与实际加载的基因组无关。remove/export 处理器只输出日志就返回 success；renderer 按此成功结果删除本地列表项目，造成视觉状态与真实状态分离。刷新发送 `collect-resource-info`，但本次未找到 renderer 对这一事件的消费处理。

**建议：** 建立窗口绑定的真实资源清单；卸载必须等真实操作完成，导出必须返回真实文件结果。未实现之前禁用相关按钮并给出明确原因。测试不能只断言 `{success:true}`。

### A10：工具策略一致性校验成功，但实际检查零项

**位置：** `scripts/validate-tool-registry-consistency.js:150`、`:260`；`src/renderer/modules/chat/services/LLMContextService.js:1049`；`ToolCapabilityPolicy.js:10`。

检查脚本仍在 LLMContextService 文本中找 `const toolPolicies =` 和旧结束注释。策略已抽到 ToolCapabilityPolicy，旧锚点不存在，于是返回空列表。命令输出 `LLMContextService.shouldAllowToolExecution.checked: 0` 并报告 success；读取实际策略对象得到 **195 个唯一工具名**。

**建议：** 直接读取真正的 hardcoded policy 对象，检查非空以及与注册表的交集/别名。未知工具和例外需要显式解释。解析失败、锚点失效或零项检查必须失败，不能当成一致性通过。

### A11：六个同名 YAML 定义中，旧版本缺失关键参数

**位置：** `tools_registry/file_loading/load_genome_file.yaml:1`；`tools_registry/file_operations/load_genome_file.yaml:1`；`tools_registry/generated/tool-registry-manifest.json` 的 diagnostics。

重复工具为 `load_annotation_file`、`load_genome_file`、`load_operon_file`、`load_reads_file`、`load_variant_file`、`load_wig_tracks`。219 条工具定义仅有 213 个唯一名称，并产生 12 条诊断：六次 root 重复、六次首个定义保留。

以 load_genome_file 为例，file_loading 的 2.0.0 定义包含 `filePath/showFileDialog/fileType`，file_operations 的 1.0.0 定义仅描述 clientId；旧样例仍为 `parameter1='value1'`。它们是同名冲突，不能当成不同类别的独立能力。

**建议：** 确立唯一 schema 来源，核实加载顺序和所有注册器/生成器，再移除旧定义并重新生成 manifest。同步核查数据集与提示词素材是否引用旧 schema；不必仅因名字重复就删除有真实语义的兼容别名。

### A12：PluginIntegrationService 是未完成的服务抽取

**位置：** `src/renderer/modules/chat/services/PluginIntegrationService.js:14`；`src/renderer/modules/ChatManager.js:412`；`src/renderer/index.html:5455`。

该服务 101 行，没有其他文件引用它的文件名或类名，既未列入 HTML 服务脚本，也未在 `initializeServices()` 注册。ChatManager 仍执行自身的插件初始化、事件注册与工具连接。服务内还保留三个空事件处理器。

**建议：** 在“完成抽取”和“删除未使用副本”之间选择一个明确方向；优先检查初始化 promise、重复监听器和 plugin state 通知。不能仅删 ChatManager 原实现，把未加载的服务当作已接管。

### A13：BLAST 演示生成器与旧 GenBank 导出实现未退出

**位置：** `src/renderer/modules/BlastManager.js:4654`、`:6669`；`src/renderer/modules/ActionManager.js:3172`；`test/unit/benchmark-runtime-hardening.test.js:37`。

未找到 `generateMockResults()`、`generateEnhancedMockResults()` 的生产调用；后者及其模拟专用下游构成残留子图。旧 `generateChromosomeGBKContent()` 有 87 行完整导出逻辑，也未找到生产调用，与新的 GenBankExporter 并存。

清理时必须保留以下区别：

- `getDatabaseInfo()` 仍在真实结果标题渲染中被调用（`BlastManager.js:5337`），不能连同模拟生成器删除。
- `generateSubjectSequence()` 被真实输出解析器调用，是 A02 的活跃缺陷，不能当成孤立死代码处理。
- 测试用 `generateEnhancedMockResults` 字符串确定源码截取边界；删除方法会影响该测试，需要改为行为断言。
- deprecated 的转发 wrapper 与完整旧实现不同，外部兼容性未核实前不能一并删除。

**建议：** 把演示代码迁到测试夹具，逐个计算模拟专用方法的调用闭包；完成导出器行为对照后删除完整旧实现。调用引用缺失只支持候选，尚未排除插件或控制台访问导出的实例。

### A14：下载 API 客户端形成没有外部入口的子系统

**位置：** `src/renderer/modules/genomic-downloader/api/NCBIClient.js:5` 及同目录的 BaseAPIClient、utils 下四个文件。

共六个文件、1001 行。NCBIClient 只在自身出现，BaseAPIClient、RateLimiter、LRUCache、ErrorHandler、Validator 的引用主要形成目录内连接；未找到 app 页面或运行模块加载该子系统。真实下载页面已有独立实现。

**建议：** 将整个子图作为一次候选审查，决定接入还是删除；不要因目录内部有互相 require 就认定它在运行，也不要因通用类名在别处出现就认为它被使用。删除前检查插件和 Electron 打包 smoke。

### A15：插件更新器只改注册表，回滚也只恢复元数据

**位置：** `src/renderer/modules/PluginUpdateManager.js:200`、`:208`、`:293`、`:314`、`:343`；`PluginMarketplaceUI.js:765`。

`performUpdate()` 等待 1 秒，修改已安装插件的 version/updatedAt，然后保存注册表；没有下载、替换或重新加载插件。rollback 保存和恢复浅拷贝 metadata，没有恢复软件包内容。`isSecurityUpdate()` 用随机数判定“安全更新”。因为 installedPlugin 被原地修改，随后记录的 fromVersion 也可能已是新版本。

探针只提供 installedPlugins 和保存注册表两个能力，performUpdate 就成功把 1.0.0 改为 2.0.0；没有可用于下载安装的能力。

**重要范围区别：** MarketplaceUI 的普通 Update 按钮另走 uninstall/install，不能把此发现描述成所有 UI 更新都只改版本号。该 updater 被创建且用于检查更新，但未找到默认启动自动更新执行器的调用。它是存在且可调用的错误实现与并行更新路径。

**建议：** 合并更新生命周期到真实安装服务，包内容与元数据一起成功后再宣布更新完成；保存原版本、真实载荷和恢复点。随机安全更新判定及假等待应删除。

### A16：MemorySystem 的部分推荐分支永远为空，人为增加等待

**位置：** `src/renderer/modules/MemorySystem.js:240`、`:434`、`:851`、`:1120`。

`findSimilarContexts()` 恒返回空数组，导致 similar-context 成功模式建议分支永远不产生结果；而其他用户偏好分支仍可能工作，不能称整个推荐系统无效。`applyContextOptimizationsAsync()` 先人为等待 10 ms，注释明确称为 simulation，然后执行同步对象合并。

**建议：** 取消未实现能力的描述与占位链，或接入真实历史上下文；删除模拟等待，保留确实需要的异步边界。不要删除整个 MemorySystem：它由 ChatManager 动态加载，且被 Coordinator 使用。

## 6. 其他待处理项与维护结构

### A17：已暴露的占位能力需要收窄

| 位置                                                         | 事实                                                    | 建议                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------- | ----------------------------------------------------------- |
| `src/renderer/renderer-modular.js:3589`                      | open-project-file 事件只显示 Opening 通知，没有加载动作 | 接到实际项目加载流程或移除此空处理器                        |
| `src/main/ipc-handlers.js:1779`；`src/preload.js:590`        | extract-plugin-zip 创建临时目录后固定返回未实现错误     | 使用已有 ZIP 处理能力并清理临时文件；不可用时不要先创建目录 |
| `src/renderer/modules/GenomeStudioRPCHandler.js:297`、`:327` | advertised methods 包含四个固定返回未实现的接口         | 从能力表移除或接真实服务，错误协议保持一致                  |

GenomeStudioRPCHandler 文件由 renderer 动态加载，但本次未找到实例化/initialize 的运行调用，因此四个 RPC 占位方法不能描述成默认运行端点。它们返回内部 `success:false`，但 `handleRPCCall()` 将未抛错结果包在外层 `success:true` 中，进一步增加协议歧义。应先确认旧 RPC 是否仍有消费者，再决定保留或退出。

### A18：开发材料被打包，旧依赖与样式是清理候选

`package.json` 的构建配置包含 `src/**/*` 和 `tools_registry/**/*`，没有针对以下开发脚本设置排除：

- `tools_registry/chatmanager_integration_example.js`：252 行示例 ChatManager。
- `tools_registry/enhanced_chatmanager_integration.js`：502 行演示实现，加载文件工具只返回成功消息。
- `tools_registry/complete_system_verification.js`：225 行，以 mockApp 验证上述演示实现；未找到 CI/package script 调用。
- `tools_registry/deploy.js`：374 行旧部署流程，其中 createBackup 只写 marker，却打印已创建 backup 路径；不能作为可恢复备份使用。
- `src/renderer/modules/ExternalToolsSystemTest.js`：190 行，无外部代码引用。

这些脚本的构建 glob 会选入应用载荷，但本次没有实际构建安装包测量体积；不应把全部行数都当成启动时执行开销。示例可保留在 docs/examples 或 devtools，但应明确开发属性和退出默认打包。

`file-saver` 与旧 `generic-filehandle` 未发现直接运行引用；`npm explain` 也只显示根依赖。当前 BAM/BBI 路径使用 `generic-filehandle2`。它们是依赖移除候选，仍需检查外部插件并通过卸包后测试/packaging 验证，不能仅凭字符串搜索直接删除。

`src/renderer/css/main-legacy.css` 有 365 行，index.html 中两处引用均被注释；可作为未加载样式候选。**`css/legacy/01…08` 则被 styles.css 的八条 @import 实际加载，合计 16,014 行，不能因名称包含 legacy 就删除。** 大型历史 CSS 需要选择器使用与界面回归，而不是按目录名清理。

### A19：相同算法反复实现，超大模块混合业务与展示

以下方法体忽略注释和格式后 token 完全一致：

| 逻辑                      | 位置                                                                                           | 每处物理行数 |
| ------------------------- | ---------------------------------------------------------------------------------------------- | -----------: |
| 分子量计算                | `SequenceTools.js:430` / `MicrobeGenomicsFunctions.js:306`                                     |      65 / 65 |
| 反向互补                  | `AdvancedSearchManager.js:1071` / `VariantAnalyzer.js:585` / `renderer-modular.js:8621`        | 20 / 20 / 20 |
| 带 Unified 检测的反向互补 | `ExportManager.js:796` / `NavigationManager.js:1487`                                           |      27 / 27 |
| semver 简化比较           | `PluginDependencyResolver.js:255` / `PluginMarketplace.js:1427` / `PluginUpdateManager.js:152` | 14 / 14 / 14 |
| 参数归一化                | `ChatManager.js:9382` / `LLMContextService.js:980`                                             |      20 / 20 |
| ResizeObserver 接线       | `CanvasGenesRenderer.js:164` / `CanvasReadsRenderer.js:1110` / `CanvasSequenceRenderer.js:641` | 16 / 17 / 17 |
| 参数相似度                | MemorySystem、MediumTermMemory、LongTermMemory 的对应方法                                      | 16 / 16 / 16 |

17 组克隆还包括插件示例、HTML escaping、小型元数据方法。重复不都值得抽象：要优先合并已经发生语义错误的生物算法和版本算法，而不是为了减少 12 行 wrapper 引入复杂共享层。

| 大型文件            | 物理行数 | 代表性方法                     |
| ------------------- | -------: | ------------------------------ |
| ChatManager.js      |   20,907 | sendToLLM：922 行              |
| TrackRenderer.js    |   16,087 | 渲染、设置、交互集中           |
| renderer-modular.js |   12,056 | setupIPC：680 行               |
| ActionManager.js    |    7,716 | 编辑、导出、文件路径与 UI 集中 |
| BlastManager.js     |    7,305 | injectStyles：729 行           |

前五文件共 64,071 行，占被审计 JavaScript 物理行数约 21.46%。BenchmarkUI 的 generateBenchmarkHTML 为 1404 行。模板、数据初始化和长 CSS 字符串会放大方法行数，因此长度仅证明维护集中，不能证明整段是垃圾代码或性能瓶颈。

**建议：** 保持项目 vanilla JavaScript/service 边界，优先抽取独立纯算法和稳定服务；后续再拆 UI 模板、样式和 IPC。迁移必须同时删除旧副本或保留明确转发 wrapper，防止产生 A12 式“服务存在但不运行”。

## 7. 为什么现有检查没有发现这些问题

### 7.1 测试数量与执行覆盖不匹配

| renderer 模块            | 行覆盖率 |
| ------------------------ | -------: |
| ChatManager              |   16.85% |
| TrackRenderer            |   11.86% |
| BlastManager             |    6.19% |
| PluginSecurityValidator  |       0% |
| PluginDependencyResolver |       0% |
| PluginUpdateManager      |       0% |
| MemorySystem             |       0% |

现有覆盖率门槛仅为各项 4%。不少测试通过读取源码验证接口和接线，适合静态边界检查，但不能证明方法真实读取数据、下载软件包或扫描插件内容。A13 的源码截取边界已经说明这种测试会反过来绑定残留方法名。

建议先补高风险行为测试：真实 BLAST 委托与缺失字段失败、插件验证输入绑定与计划拒绝、IUPAC 算法一致性、窗口工厂调用，以及资源操作完成后的真实状态。再逐步提高相关模块覆盖门槛；没有必要为每个简单 wrapper 添加镜像测试。

### 7.2 文档中的“当前事实”已与实现漂移

Agents.md 描述 216 YAML/178 built-ins，Memory.md 描述 179/143；当前校验结果是 219 条定义/213 唯一工具/181 built-ins。Memory.md 部分策略说明仍描述按 prose 成功标记检索，而实现已支持结构化记录。

这不是直接可删除的代码，但会误导后续维护判断。建议机器生成可验证统计，并更新架构文档到真正的策略服务；修改这些 canonical/public docs 时按项目约定运行 `npm run docs:validate`。

### 7.3 不应误判为垃圾代码的内容

- MemorySystem、PluginTestFramework、CircosPluginTestSuite 等存在动态加载入口；不能只查 index.html。
- primer 工具别名、sidecar 旧格式迁移、MCP legacy transport 是明确兼容边界；需要迁移期与消费者证据才能删除。
- tool manifest 是构建/运行素材；修改来源并生成，不能单独手工删改生成物。
- DebugLogger 在入口先加载并对 verbose console 设置门控。日志很多不等于全部无价值；昂贵参数表达式仍可能被求值，但本次没有 profiling 证实其成本。
- 空 catch、空数组返回和模拟电泳等关键词有合法用途；没有按关键词将其全部列为问题。
- 文件体积和低覆盖率不能独立证明代码未运行，更不能用作删除依据。

## 8. 建议的整改顺序与验收

### 第一批：恢复结果与能力契约

处理 A01/A02/A08 的模拟结果与序列，A03/A04 的随机检查和拒绝汇总，A06 的算法一致性，A07 的缺失工厂。每项独立变更，优先新增有真实输入输出的行为检查；不在同一变更顺带重构整个 ChatManager。

验收要求：同一输入不再因随机数改变分析/检查结论；真实数据缺失显式失败；拒绝的安装计划不能继续；菜单回调能调用真实工厂；核酸算法处理大小写、空输入、模糊碱基及坐标边界。

### 第二批：完成迁移并退出旧实现

处理 A05/A09/A10/A11/A12/A15：版本与载荷绑定、真实资源操作、非空策略校验、唯一 YAML 定义、完整服务注册和统一更新流程。对 registry 变更同步工具映射、执行策略、MCP schema 和生成 manifest。

### 第三批：以调用闭包清理残留

处理 A13/A14/A16/A17/A18 的候选与占位能力。先核实外部插件/客户端兼容要求，再删除旧实现及只服务旧实现的下游；修复依赖残留方法名的源码测试。开发演示材料移出默认应用载荷。

### 后续：控制复发

只对变化区域要求“新旧实现二选一或显式 wrapper”、非空检查、行为测试与必要覆盖率；逐步推进 A19，避免一次性替换整个架构。按维护边界集中生物纯算法、插件版本与真实安装服务。

完成代码整改后建议执行现有 lint/test/registry 校验、与受支持 Node 20/22 的 CI 对照，以及 Electron packaging 和相关 UI smoke。修改公共/规范文档时另跑 docs:validate。本次只新增独立 reports 审计产物，未改变这些受约束文档或构建配置，因此未运行 docs:validate，也未发布站点。

## 9. 复核材料与复现

本报告配套目录：`reports/code-quality-audit-2026-10-08/`。

- [static-analysis.json](code-quality-audit-2026-10-08/static-analysis.json)：完整克隆分组、文件量级、孤立候选与大方法位置。
- [verification.json](code-quality-audit-2026-10-08/verification.json)：提交、环境、Lint 诊断、测试对照、逐文件覆盖率与注册表诊断。
- [probes.json](code-quality-audit-2026-10-08/probes.json)：随机 BLAST、检查批准分歧、反向互补、版本回退、假更新及菜单错误的实际输出。
- [reproduce.cjs](code-quality-audit-2026-10-08/reproduce.cjs)：隔离调用探针，仅读取项目源码，使用替身阻止真实安装与 UI 操作。
- [static-analysis.cjs](code-quality-audit-2026-10-08/static-analysis.cjs)：只读源码清单与 token 克隆扫描。

从仓库根目录运行：

```bash
node reports/code-quality-audit-2026-10-08/reproduce.cjs
node reports/code-quality-audit-2026-10-08/static-analysis.cjs
npm run lint
npm run tool-registry:validate
NODE_OPTIONS=--no-experimental-webstorage npm test
```

探针断言的是本次缺陷可复现，修复后这些断言应更新为正常行为回归测试；探针成功不能作为应用健康的验收信号。Node 20/22 应首先按项目标准命令测试，Web Storage flag 是本机 Node 25 的诊断对照，不是要求修改生产启动参数。

没有通过真实用户会话测量启动耗时、内存、GUI 操作或安装包体积，也没有计算“垃圾代码占比”。现有证据足以确定优先整改项，但不支持宣称上述所有候选均可立即删除。
