# AutomaticComplexSuite 深度分析与优化报告

日期：2026-06-08

## 分析范围

本报告覆盖 `src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js`，重点分析测试先后顺序、每个测试的合理性、覆盖缺口，以及本轮基于分析结果完成的优化。

## 优化前主要问题

优化前该套件包含 19 个测试，覆盖 12 个类别，领域覆盖面较广，但 benchmark 的可信度受到以下问题影响：

- 测试顺序混合了数据加载、分析、导出、UI tab 状态变更和外部服务流程。`ui_auto_01` 在中前段打开 5 个 tab，容易污染后续测试状态。
- 结构化工作流评分只判断期望工具是否出现过，没有验证工具是否按要求顺序执行。
- 重复工具会被重复计分。`track_auto_complex_01` 里一个 `toggle_track` 或一个 `get_track_status` 调用可能被用来满足多个期望步骤。
- 多步结构化结果没有稳定校验每一步关键参数。
- 自然语言 fallback 过宽松：三步复杂工作流里只提到一个工具，再加一句泛化的成功表述，也可能被判为通过。
- `toolSuccessPatterns` 存在过时或未注册项：`switch_tab` 不是实际内置工具名，真实工具是 `switch_to_tab`；`blast_get_subject_sequence` 当前没有注册或执行路径。

## 优化后的测试顺序原则

套件现在通过 `getPreferredTestOrder()` 显式控制运行顺序。排序原则如下：

1. 先加载数据，建立 genome、reads、variant、track 上下文。
2. 再建立导航区域，给后续 current-view 类测试提供稳定状态。
3. 优先运行序列分析和限制性酶切工作流，利用刚建立的 genome/current-region 上下文。
4. 然后运行注释、track、primer display 等状态型工作流。
5. 导出测试放在分析上下文之后，便于覆盖分析到导出的链路。
6. UI tab 管理测试放在后段，因为它会改变 tab 状态。
7. protein 和 BLAST 放在末尾，因为它们更依赖网络、本地 BLAST 安装或外部服务可用性。

## 测试清单与合理性

| 顺序 | 测试 ID                      | 类别              | 工具序列                                                                                         | 合理性                                                                  |
| ---: | ---------------------------- | ----------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
|    1 | `file_auto_01`               | file_loading      | `load_genome_file`, `load_reads_file`, `load_variant_file`, `load_wig_tracks`                    | 下游 genome、reads、variant、track 流程的基础上下文，必须最先执行。     |
|    2 | `nav_auto_01`                | navigation        | `navigate_to_position`, `zoom_in`                                                                | 建立 current-region 上下文，同时验证导航后缩放的顺序。                  |
|    3 | `analysis_auto_01`           | sequence_analysis | `calc_region_gc`, `export_bed_format`                                                            | 验证当前视图区域分析到 BED 导出的链路。                                 |
|    4 | `analysis_auto_02`           | sequence_analysis | `get_genome_info`, `genome_codon_usage_analysis`, `compute_gc`                                   | 覆盖 genome 信息、codon usage 和整体 GC。                               |
|    5 | `analysis_auto_complex_03`   | sequence_analysis | `get_coding_sequence`, `translate_dna`, `calculate_molecular_weight`                             | 覆盖从基因 CDS 到翻译产物再到蛋白性质计算的数据流。                     |
|    6 | `analysis_auto_complex_05`   | sequence_analysis | `get_sequence`, `calculate_entropy`, `reverse_complement`, `translate_dna`                       | 覆盖 visible sequence 在熵、反向互补和翻译任务中的复用。                |
|    7 | `restrict_auto_01`           | restriction       | `virtual_digest`                                                                                 | 保留为高级领域单工具 smoke test，用于快速验证 digest 工具可调用。       |
|    8 | `gel_auto_01`                | restriction       | `simulate_gel_electrophoresis`                                                                   | 验证标准 gel simulation 参数。                                          |
|    9 | `gel_auto_03`                | restriction       | `simulate_gel_electrophoresis`                                                                   | 覆盖 ladder 和 stain 变体参数。                                         |
|   10 | `gel_auto_workflow_02`       | restriction       | `find_restriction_sites`, `virtual_digest`, `simulate_gel_electrophoresis`                       | 完整限制性酶切分析与可视化链路，适合验证工具顺序。                      |
|   11 | `annotation_auto_complex_01` | annotations       | `create_annotation`, `update_annotation`, `list_annotations`                                     | 覆盖注释创建、更新、查询生命周期，同时避免删除类副作用。                |
|   12 | `track_auto_complex_01`      | track_control     | `get_track_status`, `toggle_track`, `toggle_track`, `get_track_status`                           | 有意包含重复工具，本轮已防止单次调用被重复计分。                        |
|   13 | `primer_auto_01`             | primer_design     | `design_primers`                                                                                 | 保留为 primer 设计的早期 smoke test，并覆盖 `earlyReturn` 行为。        |
|   14 | `primer_auto_complex_01`     | primer_design     | `design_primers`, `calculate_primer_properties`, `find_primer_binding_sites`                     | 覆盖 primer 设计、性质计算、结合位点搜索。                              |
|   15 | `primer_auto_complex_02`     | primer_design     | `design_primers`, `add_primer_annotation`, `list_primer_annotations`, `clear_primer_annotations` | 新增。覆盖 primer 可视化生命周期和 `confirm=true` 清理策略。            |
|   16 | `export_auto_complex_01`     | file_export       | 六个导出工具                                                                                     | 覆盖主要格式导出，并保留文件存在性优先的评分逻辑。                      |
|   17 | `export_auto_complex_02`     | file_export       | `navigate_to_position`, `export_current_view_fasta`                                              | 新增。覆盖当前视图 FASTA 导出，这是此前有成功模式但套件中未覆盖的工具。 |
|   18 | `ui_auto_01`                 | ui_interaction    | `open_new_tab`                                                                                   | 保留但后移，避免过早改变 tab 状态。                                     |
|   19 | `ui_auto_complex_02`         | ui_interaction    | `open_new_tab`, `switch_to_tab`, `close_tab`                                                     | 新增。覆盖完整 tab 生命周期，并使用真实工具名 `switch_to_tab`。         |
|   20 | `protein_auto_complex_01`    | protein_structure | `get_uniprot_entry`, `fetch_alphafold_structure`, `open_protein_viewer`                          | 覆盖 protein 查询、AlphaFold 结构获取、viewer 打开。                    |
|   21 | `protein_auto_complex_02`    | protein_analysis  | `search_uniprot_database`, `analyze_interpro_domains`, `search_pdb_structures`                   | 覆盖 protein/domain/structure 发现链路，且不依赖 viewer。               |
|   22 | `blast_auto_complex_01`      | blast             | `blast_create_database`, `blast_list_databases`, `blast_search_online`                           | 覆盖 BLAST 数据库创建、验证和在线搜索。                                 |
|   23 | `blast_auto_complex_02`      | blast             | `blast_create_database`, `blast_list_databases`, `blast_search_local`                            | 新增。补齐本地/离线 BLAST 搜索覆盖。                                    |

## 已完成优化

- 新增 4 个复杂工作流测试：
  - `export_auto_complex_02`
  - `ui_auto_complex_02`
  - `primer_auto_complex_02`
  - `blast_auto_complex_02`
- 新增显式排序方法 `getPreferredTestOrder()` 和 `orderTestsForStableExecution()`。
- 将结构化 workflow 评分从“工具出现过即可”升级为“按序消费工具调用、重复工具必须重复调用”。
- 增加多步 workflow 的关键参数校验。
- ToolExecutionTracker 路径改为按 `startTime` 顺序消费最近执行记录。
- 复杂 workflow 成功判定从宽松部分匹配升级为：按序完成、关键参数匹配、并达到 60% 分数线。
- 自然语言 fallback 不再允许一个工具命中就通过多步复杂 workflow。
- 修正成功模式：
  - `switch_tab` 改为 `switch_to_tab`
  - 增加 `list_primer_annotations`、`clear_primer_annotations`、`get_sequence`
  - 移除未注册的 `blast_get_subject_sequence`
- 同步更新根目录和 `docs/reports/` 下的 `benchmark_AutomaticComplexSuite.csv`，使清单与 23 条优化后测试一致。

## 暂不新增的候选测试

以下候选本轮没有加入，原因是会重复已有覆盖，或当前没有真实注册工具：

- BLAST subject sequence retrieval：`blast_get_subject_sequence` 当前不在 registry 或执行路径中，不能硬加测试。
- 注释删除 workflow：未来有价值，但当前套件已经会创建/更新注释；删除测试需要先明确 cleanup 策略。
- 更强 tab stress test：新生命周期测试已经覆盖 open/switch/close，压力测试更适合单独 UI suite。

## 验证结果

- `npx vitest run test/unit/automatic-complex-suite.test.js`
- `npx vitest run test/unit/benchmark-runtime-hardening.test.js`
- `npx vitest run test/unit/automatic-complex-suite.test.js test/unit/benchmark-runtime-hardening.test.js`
  - 结果：2 个测试文件、22 条测试全部通过。
- `npx eslint src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js test/unit/automatic-complex-suite.test.js`
  - 结果：无错误；`AutomaticComplexSuite.js` 仍有该大文件既有的 console/max-len 警告。
- `npm test`
  - 结果：734/736 通过。两个失败不属于本轮修改范围：
    `test/unit/config-ipc-hardening.test.js` 期望 `ConfigManager` 包含 `configForPersistence`；
    `test/unit/tool-registry-consistency.test.js` 报告 registry tool 数量为 179，低于测试阈值 180。
