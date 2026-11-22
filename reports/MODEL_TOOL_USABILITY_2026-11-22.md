# CodeXomics 工具易用性评估

基线为 `93329862`。评估覆盖 18 个类别的 214 个注册定义、181 个内置映射、130 个 MCP 定义，以及 ChatBox 从选择工具到下一轮读取结果的路径。评估分别衡量模型能否拿到工具、第一次调用是否符合契约，以及执行后能否依据结果继续。

## 第一轮改造对照

| 检查 | 改造前 | 改造后 |
| --- | ---: | ---: |
| 输入完整工具名，目标排名第一 | 209 / 214 | 214 / 214 |
| 逐工具渲染时出现的错误调用示例 | 37 / 168 | 0 / 131 |
| 同名 ChatBox 与 MCP 工具的顶层参数名集合不同 | 34 / 123 | 28 / 123 |
| 同名工具的顶层必填字段集合不同 | 10 / 123 | 8 / 123 |
| 本机模型首次原生调用通过 | 5 / 8 | 8 / 8 |
| 八次模型请求合计输入 token | 29,198 | 15,866 |

全名检索检查开启协调工具。示例检查针对每个工具实际送入文本提示的第一条可用示例，按名称和参数 schema 判定。基线共有 429 条原始记录，402 条能解析成调用，其中 41 条过不了所在工具的参数校验。改造后删除了 37 条使用 `parameter1`、`parameter2` 的模板示例，生成器也已停止产生这些字段。注册数据里用于解释迁移的跨工具示例仍保留其原意，渲染器会跳过它们。MCP 对比使用模块定义，忽略窗口路由字段 `clientId`，也不计发布工具时额外注入的窗口定位字段。

## 模型实际遇到的障碍

| 阶段 | 可复现的表现 | 改动 |
| --- | --- | --- |
| 发现 | 输入 `get_annotation_history`，通用的 `get_annotation` 排在前面。插件在内置候选填满预算后才被考虑。中文连续指令也容易把第二步挤出去。 | 内置、MCP、插件共同排名，完整名称优先。多步请求先给各步骤分配首选候选，再分配第二候选。 |
| 选参 | 原生函数定义已随请求发送，系统提示又列一遍参数，并要求模型手写 JSON。文本调用则只展示前八个字段，后面的可选参数看不到。 | 原生模式保留工具名与运行上下文，参数由随请求发送的 schema 提供。文本模式展示完整可调用 schema，包括必填项、枚举、嵌套字段和组合条件。 |
| 查阅 | 大型目录会压缩到只剩名称，模型难以取回某个工具的参数。筛选得到零项时，代码还可能返回通用目录。 | `list_available_tools` 支持按 `query` 搜索、按 `tool_name` 精确查契约。宽泛清单告诉模型如何查详情，零匹配如实返回。 |
| 执行 | 模型传了 Markdown 查看器的 `title`，检测重复调用时使用的归一化逻辑却把标题从执行参数和历史中删掉。 | 校验、执行和回放使用实际调用参数。执行记录继续使用用于判重的参数表示。 |
| 纠错 | 同批调用有一个字段名拼错，整批没有执行。下一轮只收到笼统的格式错误，在重试次数有限时只能再猜一次。 | 有界反馈指明工具、字段路径、约束和整批执行状态。关闭原生调用时，重试指令也使用文本协议。 |
| 读取结果 | 原生结果末尾拼接了自然语言，接收方无法把整条消息解析为 JSON。失败的最后一个调用还会收到“已完成”的提示。 | 原生结果保持合法 JSON，成功调用的提示放入结构化字段。失败调用返回错误。短列表保留数组结构，大列表报告原始数量。 |

两个代谢通路查询原先只向 ChatBox 公布了 `clientId`，调用者无法提交处理器需要的 `pathwayName`。现在两个入口都说明通路名称，以及各自支持的调控基因或高亮选项。浏览器状态工具现在会按请求省略轨道和文件清单，按染色体累计注释数量，避免把有注释的基因组显示为零。其参数也同步到了 MCP。同时对齐了基因组概览、操纵子文件导入、截图三个 MCP 定义。工作目录工具也接受了原本处理器就支持的 `use_home_directory: true` 单参数调用。

## 本机模型结果

使用 Ollama 0.40.16 的 `qwen3.5:4b`，Q4_K_M，模型摘要前缀 `96f38c742e0a`。两个版本使用同一组中英文请求、同一模拟视口、最多八个候选、温度 0、种子 42，并关闭思考和流式输出。每个版本各运行一次。只有恰好发出一次预期原生调用、参数通过该版本校验、且用户明确指定的值均保留，才计为通过。允许合法的可选参数。此次采集只生成调用，文件、标签页和工作目录均未被操作。

| 请求 | 基线首次调用 | 改造后首次调用 |
| --- | --- | --- |
| 列出所有可用工具 | `list_available_tools` | `list_available_tools` |
| 查看当前浏览器状态 | `get_current_state` | `get_current_state` |
| 列出已加载的文件 | `load_annotation_file`，请求打开文件对话框 | `get_loaded_files_list` |
| 关闭当前标签页 | `list_highlights` | `close_tab` |
| 保存当前视图，命名为 morning | `export_current_view_fasta`，生成了输出文件名 | `save_view_state(name="morning")` |
| 打开 Markdown 文件，窗口标题为 Review | 正确 | 正确 |
| 将工作目录设为主目录 | 同时填写路径和主目录开关 | 只填写主目录开关 |
| 新建标题为 Comparison 的标签页 | 正确 | 正确 |

三条由错转对的请求，在基线中都没有拿到目标工具。对这三条，首要瓶颈是候选选择。关闭标签页这一条的输入从 1,171 增至 1,458 token，但模型首次获得了正确工具。八条合计输入减少 45.7%。这是固定样本上的首调用测量，无法据此估算其他模型、完整多轮任务或整套工具的总体成功率。

## 验证与复现

- 全量 Vitest 在 Node.js 22.23.5 下通过，共 231 个测试文件、3,078 项测试。仓库原有门槛覆盖 143 个简单请求的 Top-8，以及 29 个复合请求中每一步的 Top-24。
- 新增的契约测试使用发布清单和真实 ChatBox 对话循环，覆盖中文检索、跨来源选择、精确查参、字段纠错、批次重试、原始参数回放和 Gemini 结果转换。对话回放使用脚本化模型响应和受控执行器。
- `npm run tool-registry:validate` 检查注册、路由与执行策略的一致性。
- 复现本机模型对照时，使用两个版本的检出目录和本地已安装的模型。输出为逐请求 JSON，标记为 `first-call-smoke`。仓库的 `production-parity` 和 `oracle-assisted` 多轮基准继续独立统计。

```sh
node scripts/assess-model-tool-usability.js /path/to/baseline /path/to/updated
```

## 第二轮接口对齐

第一轮提交 `b5e99451` 留有 29 个需要复核的同名工具。其中 28 个的顶层业务字段不同，8 个的顶层必填字段不同。第二轮沿用第一轮统计口径，读取发布清单和 MCP 模块的真实定义，忽略路由字段。结果如下。

| 比较对象 | 第一轮结束时 | 第二轮结束时 |
| --- | ---: | ---: |
| 具有同名定义的工具 | 123 | 123 |
| 顶层业务字段集合不同 | 28 | 1 |
| 顶层必填字段集合不同 | 8 | 1 |

两个剩余计数都指向 `codon_usage_analysis`。ChatBox 能从已加载的基因组按基因名或 locus tag 取序列。独立 MCP 处理器要求直接传入 `sequence`，其中 `geneName` 只给结果加标签。两者有各自的分析实现和结果结构，MCP 的说明已写明这一点。

### 模型调用时的变化

| 涉及的工具 | 可观察的行为 |
| --- | --- |
| `search_uniprot_database`、`advanced_uniprot_search`、`get_uniprot_entry`、`get_interpro_entry_details` | 普通检索可只指定物种。高级检索接受平铺条件或嵌套的 `query_fields`，多个关键词按 AND 组合。两个入口均支持显式关闭序列、特征或功能字段。InterPro 的 `minimal` 只返回条目 ID、名称和类型。 |
| `find_gene_by_name`、`search_features`、`bookmark_position`、`toggle_track` | 基因查询可精确匹配、区分大小写，并把命中的坐标和链方向传给后续调用。特征类型和结果条数直接作用于搜索。书签支持备注。两个轨道名拼写都可用，ChatBox 模型调用需明确给出 `visible` 或 `action`。MCP 继续接受只给轨道名的旧调用，其含义是反转当前状态。 |
| `get_sequence`、`get_coding_sequence`、`reverse_complement`、`compute_gc`、`translate_dna`、`genome_codon_usage_analysis` | 区间读取尊重链方向。CDS 查询接受 `gene_name` 或 `identifier`。反向互补接受 `sequence` 或 `dna`，并执行大小写、字符验证选项。GC 百分比以 A、C、G、T 的数量为分母。翻译的 `frame` 从 0 开始，`reading_frame` 从 1 开始。全基因组密码子统计的 MCP 描述补齐了已有的 `genetic_code` 参数。 |
| `fetch_protein_structure`、`fetch_alphafold_structure`、`open_protein_viewer`、`search_pdb_structures`、`search_alphafold_structures` | PDB 搜索和下载分别说明所需标识符。下载返回的 `_dataRef` 可以原样作为查看器输入。PDB 下载包含文件中已有的配体，显式要求去除配体会收到错误。搜索工具撤下了执行器未实现的分辨率、方法和置信度筛选。 |
| `load_annotation_file`、`load_wig_tracks`、`export_data` | 模型能指定注释合并或另建轨道，WIG 工具接受单个路径或路径列表，`multiple: false` 会打开单选对话框。两个入口均可省略导出格式，默认使用 GenBank。 |
| `start_annotation_research`、`blast_search`、`copy_sequence`、`cut_sequence`、`delete_sequence`、`execute_actions` | 注册描述对齐了已有的文献预算、BLAST 参数、链方向与动作确认选项。复制工具撤下了执行器未读取的调用方动作 ID 和注释开关。 |

这些数字衡量字段名称和顶层必填集合。兼容调用和返回值仍有入口差异。例如，MCP 把反向互补字符串放在 `reverseComplement` 字段里，ChatBox 的本地路径可以直接返回字符串。旧调用方仍可按原有方式读取结果。

### 复现

`test/unit/shared-model-tool-contracts.test.js` 遍历同名定义，对新增差异报错。行为用例经过实际 MCP 分派、ChatBox 方法和原生对话框选项构建函数，并用固定数据比较两个入口发出的数据库请求和返回字段。全量 Vitest 在 Node.js 22.23.5 下通过，共 232 个测试文件、3,094 项测试。工具注册一致性检查通过。外部数据库响应使用替身。第一轮的八次模型首调用测量属于当时的版本，本轮没有重新测量模型成功率。

```sh
npm run tool-registry:generate
npm run tool-registry:validate
npm test -- --silent
```
