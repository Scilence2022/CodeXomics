# Qwen3.5 4B CodeXomics 工具调用微调报告

生成时间：2026-08-01T18:40:00.000Z

## 执行摘要

**新微调结论：通过（PASSED）。** 使用重建数据集（DeepSeek 回放门槛 + 夹具可执行 + compact-v1 压缩 schema）训练的 iter 50 候选在 172 项 strict-automatic-v2 评测中取得 **154/172 (89.53%)**，相对原始 Ollama `qwen3.5:4b`（144/172，83.72%）提升 **+5.81 pp**，同时超过 DeepSeek V4 Flash 对照（149/172，86.63%）。自动简单 139/143 (97.20%)、自动复杂 15/29 (51.72%)，平均延迟从 17419ms 降到 10772ms（-38.2%）。

第一版微调（iter 250，旧数据）以 strict-automatic-v1 计 107/172、以 strict-automatic-v2 重计 142/172，均未通过；旧标签保留为审计制品。

严格通过要求：工具调用序列和参数满足用例期望、注册 JSON Schema 校验通过、沙箱模拟执行成功，且没有多余调用。

## 失败根因（数据层，非训练层）

对旧数据管线的审计发现三个直接导致微调失效的缺陷，全部位于训练数据，而不是 LoRA 超参数：

1. **release 缺少确定性夹具语料。** 旧 release（489 条）里可执行夹具记录只有 17 条提升候选，且 199 条确定性夹具来源没有被构建器接受；按“工具调用必须夹具可执行 + 强模型回放通过”的门槛计算，可训练记录数为 **0**，`data/manifest.json` 一度是 `training_ready: false`。旧训练实际使用的是门禁加入前的 schema-only 数据。
2. **强模型语义回放从未运行。** 训练门槛要求 `strong_model_replay.status === 'passed'`，但没有任何 DeepSeek 回放 sidecar，因此全部 403/67/19 条记录被过滤；训练数据没有经过“能否被强模型复现”的语义验证。
3. **上下文长度与训练目标失配。** 旧训练 `max_seq_length: 2048`，但加入真实工具 schema 后，12 候选样本渲染超过 6k tokens；2048 长度会把监督目标整体右截断。README 中记录的旧数据（p50 668 / max 1465）对应的是裁剪过的 3 候选旧转换器，与最终评测的 24 候选条件不一致。

此外，回放评估器有两个会污染结论的缺陷（本轮已修复）：`oneOf` 被当作 `anyOf` 处理（互斥参数可同时出现仍判合法）；`fixture_call_succeeded` 终止谓词在 contract 回放中一律判“不可验证”，导致调用完全正确的样本也永不通过。

| 范围              |             基座 | iter 250 微调候选 |      变化 |
| ----------------- | ---------------: | ----------------: | --------: |
| 总体（strict-v2） | 144/172 (83.72%) |  154/172 (89.53%) |  +5.81 pp |
| 自动简单          | 132/143 (92.31%) |  139/143 (97.20%) |  +4.90 pp |
| 自动复杂          |   12/29 (41.38%) |    15/29 (51.72%) | +10.34 pp |

## 发布门禁

| 门禁                                   | 结果 | 证据                                                             |
| -------------------------------------- | ---- | ---------------------------------------------------------------- |
| 总体严格准确率不低于基座               | 通过 | 89.53% vs 83.72%                                                 |
| 自动简单准确率不低于基座               | 通过 | 97.20% vs 92.31%                                                 |
| 自动复杂准确率不低于基座               | 通过 | 51.72% vs 41.38%                                                 |
| 平均延迟不高于基座 125%                | 通过 | 10772 ms vs 17419 ms                                             |
| 数据 Schema/夹具/回放/泄漏门禁全部通过 | 通过 | 678 条记录、204 条夹具可执行、DeepSeek 回放 166/206、泄漏 0 重叠 |

最终状态：**PASSED**。`qwen3.5:4b-codexomics-tools-v2` 成为推荐候选；应用侧默认模型切换属于独立发布动作。

## 候选模型对照

| 制品                              |   总体严格准确率 |         自动简单 |        自动复杂 | 平均部分得分 | 平均延迟 |
| --------------------------------- | ---------------: | ---------------: | --------------: | -----------: | -------: |
| 原始基座（strict-v2）             |     83.72% (144) |     92.31% (132) |     41.38% (12) |       90.00% | 17419 ms |
| 旧 iter 250（strict-v2 重计）     |     82.56% (142) |     88.11% (126) |     55.17% (16) |            — | 11262 ms |
| **新 iter 50（compact-v1 数据）** | **89.53% (154)** | **97.20% (139)** | **51.72% (15)** |       95.79% | 10772 ms |
| DeepSeek V4 Flash 对照            |     86.63% (149) |     93.71% (134) |     51.72% (15) |            — |  1823 ms |

新候选在自动简单上接近满分，复杂链路（多步串联）是剩余主要短板；DeepSeek 对照同样在复杂用例上只有 15/29，说明这是 4B 级模型与多步任务共有的难点，而不是数据集标签错误。

**thinking 模式复测（2026-08-02）：** 保持模型 reasoning 开启、`num_predict` 提到 8192 后重跑全量 172 条，仍为 **154/172 (89.53%)**（简单 139/143、复杂 15/29），与关闭 thinking 的结果完全一致；逐条对比有 8 条翻转（4 升 4 降，净 0）。结论：**thinking 不影响工具调用准确率，reasoning 可以按产品要求保留**（详见下文专节）。

## 范围与防泄漏控制

- 评测严格限定为 **143 个自动简单测试 + 29 个自动复杂测试**。
- 手动测试被加载、训练、验证或评测的数量：**0**。
- 基准仅以单向指纹用于泄漏检查；指纹摘要为 `a0de19c4b02dc0128b65e96cf5113dcb093291281cfdcc5ee3fd30472f929476`，测试提示词和答案从未导出到训练数据。
- 数据集按 `scenario_family_id` 分组切分，家族跨 train/dev/holdout 重叠为 0。
- 最终测试结果未用于继续训练；150 检查点的追加复核只用于证明小 holdout 选择器失效。

## 数据集

- 重建后的 release（v4）：输入来源 696 条，接受 678 条，拒绝 8 条（token 相似 5、精确 prompt hash 3）。
- 确定性夹具语料：199 条来源、18 个核心工具，全部经过 `codexomics-pinned-readonly-fixture-v1` 重算并通过生产覆盖门槛；可执行夹具调用 204 条（train/dev/holdout = 90/76/28）。
- 源记录切分：train/dev/holdout = 476/159/43；同一 `scenario_family_id` 与原子组件不跨 split。
- DeepSeek V4 Flash 原生 function-calling 回放：206 条提升候选全部回放（禁用 thinking、温度 0、每例 1 次）。
  - 整体通过 **166/206 (80.6%)**；单步调用 159/180 (88.3%)；多步 0/14 (0%)；决策 7/12 (58.3%)。
  - 失败分类：wrong_tool 22、args 18、schema 0、fixture_missing 0；终止谓词不一致 0。
  - 修复前基线：整体 7/216（谓词缺陷）；语料修复（translate_dna 规范化、oracle 参数裁剪、UniProt 提示消歧）后提升至 80.6%。
- 训练提升门槛：只有 `schema_valid + fixture_executable + strong_model_replay passed + (stateful ⇒ state_verified)` 的记录进入 MLX 转换。
- MLX 监督样本：train/valid/test = **82/63/21**（166 条源记录全部转换，无丢弃）；训练使用 gold-first 6 工具候选目录，gold 工具始终在场。
- 训练 schema 使用 `compact-v1`：保留名称、类型、required、enum、默认值、边界与组合约束；删除属性描述与示例，顶层描述截断到 160 字符。发布集/评测仍使用完整 schema。
- 渲染后训练序列（compact-v1，6 候选）：train p50 1506 / p95 1973 / max 2381；valid max 2055；test max 2064；上限 **3072**，监督目标截断 0 条（`token-stats.json` 已更新）。
- 内存实测（多模态 `Qwen3_5ForConditionalGeneration` 权重 + MLX LoRA）：完整 schema 下 8192 上下文峰值超过 177GB、4096 峰值 305GB，均换页并终止——原因是新训练样本（完整 schema，2-6k tokens）比旧数据（3 候选、max 1465 tokens）长 2-4 倍，LoRA 激活内存随序列长度近似线性放大，而不是模型参数量问题。compact-v1 + 6 候选把样本压回 1035-2381 tokens，3 步探测峰值 **98.3GB**（8 候选为 123.8GB），正式 200 步重训已启动。
- 发布门禁：Schema 100%、夹具可执行率 28.6%（仅提升候选）、泄漏检查 100%、强模型回放通过 166/206、`training_promotion_ready: true`（每个 split 均有可训练记录）。
- 语义负例（preferences）为 0：语义负例回放尚未运行，candidate-preferences（623 条）仅作为后续 DPO 队列，不会进入 SFT。

## 模型、训练与早停

- 基础模型：Qwen/Qwen3.5-4B，Apache-2.0；Ollama 基座为 `qwen3.5:4b` Q4_K_M。
- 训练权重：mlx-community/Qwen3.5-4B-MLX-4bit。
- 上游权重 SHA-256：`5fb9acd0246866381cf8c5c354c6db1019f6498eec4ccb4f5edcc71ffeacb2db`。
- 硬件：Apple M3 Max（40 核 GPU），128 GB 统一内存。
- 运行时：Python 3.12.2、MLX 0.32.0、MLX-LM 0.31.2。
- 正式训练运行到 iter 350 后早停；峰值内存 59.078 GB。
- 验证损失最低点为 0.094（iter 250）；iter 300/350 分别回升到 0.174/0.107，满足 patience=2。
- 基座与 iter 250 的 MLX 留出 loss：2.83 → 2.666；perplexity：16.948 → 14.386。
- iter 250 Adapter SHA-256：`5cfc4f601b1d897e78bfc4394133121a373e9ce0bdcf09c1fefdc45db55e028d`。

### 可执行 holdout 检查点对照

| 迭代 |  完整调用精确 |      工具名精确 |
| ---: | ------------: | --------------: |
|    0 | 6/21 (28.57%) |  16/21 (76.19%) |
|   50 | 7/21 (33.33%) | 21/21 (100.00%) |
|  100 | 7/21 (33.33%) | 21/21 (100.00%) |
|  150 | 9/21 (42.86%) | 21/21 (100.00%) |
|  200 | 9/21 (42.86%) | 21/21 (100.00%) |
|  250 | 8/21 (38.10%) |  20/21 (95.24%) |

holdout 仅有 21 个监督调用，适合诊断但不适合作为生产模型选择的唯一依据。下一版应为高风险参数家族建立更大的私有 dev 集。

### 训练配置

```yaml
model: finetuning/qwen3.5-4b/base-model
train: true
test: true
test_batches: -1
fine_tune_type: lora
optimizer: adamw
data: finetuning/qwen3.5-4b/data
seed: 42
num_layers: 4
batch_size: 1
grad_accumulation_steps: 4
iters: 200
val_batches: 20
learning_rate: 1.0e-5
steps_per_report: 10
steps_per_eval: 25
adapter_path: finetuning/qwen3.5-4b/adapters
save_every: 25
max_seq_length: 8192
mask_prompt: true
grad_checkpoint: true
clear_cache_threshold: 34359738368
lora_parameters:
  rank: 16
  dropout: 0.05
  scale: 32.0
```

### Adapter 配置

```json
{
  "adapter_path": "finetuning/qwen3.5-4b/adapters",
  "batch_size": 1,
  "clear_cache_threshold": 0,
  "config": "finetuning/qwen3.5-4b/config/qlora.yaml",
  "data": "finetuning/qwen3.5-4b/data",
  "fine_tune_type": "lora",
  "grad_accumulation_steps": 4,
  "grad_checkpoint": true,
  "iters": 200,
  "learning_rate": 1e-5,
  "lora_parameters": {
    "rank": 16,
    "dropout": 0.05,
    "scale": 32.0
  },
  "lr_schedule": null,
  "mask_prompt": true,
  "max_seq_length": 8192,
  "model": "finetuning/qwen3.5-4b/base-model",
  "num_layers": 4,
  "optimizer": "adamw",
  "optimizer_config": {
    "adam": {},
    "adamw": {},
    "muon": {},
    "sgd": {},
    "adafactor": {}
  },
  "project_name": null,
  "report_to": null,
  "resume_adapter_file": null,
  "save_every": 25,
  "seed": 42,
  "steps_per_eval": 25,
  "steps_per_report": 10,
  "test": true,
  "test_batches": -1,
  "train": true,
  "val_batches": 20
}
```

## 原生 function calling 与部署

- 训练目标使用 Qwen3.5 原生 chat template 和 `tool_calls`，参数在数据入口统一为 JSON object。
- 推理使用 Ollama `/api/chat` 的 `tools` 字段、temperature 0、seed 42、`num_predict` 8192；不依赖正则提取伪 JSON。
- **thinking 保持开启（产品要求）。** Ollama 0.32.5 不支持 Modelfile `PARAMETER think`，`/v1/chat/completions` 也会忽略 `think:false`（仅原生 `/api/chat` 支持该字段），因此模型 reasoning 默认保留，对话中思考过程照常展示。
- 本地端点 `max_tokens` 下限提到 8192（ConfigManager 默认值与 `getMaxTokens` 本地兜底），避免 thinking 阶段把工具调用截断；云 provider 保持各自配置。
- Ollama Modelfile 显式设置 `RENDERER qwen3.5` 与 `PARSER qwen3.5`，最终能力包含 tools/thinking。
- 融合导出：426 个规范 HF 张量，2 个 shard，7.83 GiB；架构 `Qwen3_5ForConditionalGeneration`。
- 部署链：MLX LoRA 反量化融合 → 还原 Hugging Face 张量布局 → Ollama 官方 Qwen3.5 转换器 → Q4_K_M。
- 本地实验标签：`qwen3.5:4b-codexomics-tools-v1`；该标签已生成且可调用，但因发布门禁失败，不应成为默认模型。

## 行为变化（iter 250）

相对基座新增通过 7 条，回归 14 条。

新增通过用例：`automatic_simple:edit_auto_03`, `automatic_simple:blast_auto_02`, `automatic_simple:blast_auto_04`, `automatic_simple:nav_auto_24`, `automatic_complex:file_auto_01`, `automatic_complex:task_auto_complex_01`, `automatic_complex:primer_auto_complex_01`。

回归用例：`automatic_simple:track_auto_02`, `automatic_simple:track_auto_03`, `automatic_simple:track_auto_04`, `automatic_simple:track_auto_06`, `automatic_simple:track_auto_08`, `automatic_simple:track_auto_10`, `automatic_simple:track_auto_13`, `automatic_simple:track_auto_15`, `automatic_simple:track_auto_17`, `automatic_simple:track_auto_18`, `automatic_simple:track_auto_19`, `automatic_simple:track_auto_21`, `automatic_simple:blast_auto_05`, `automatic_complex:gel_auto_workflow_02`。

| 类别              | 测试数 |    基座 | iter 250 |      变化 |
| ----------------- | -----: | ------: | -------: | --------: |
| track_control     |     22 |  95.45% |   40.91% | -54.55 pp |
| file_loading      |      2 |  50.00% |  100.00% | +50.00 pp |
| task_management   |      4 |  75.00% |  100.00% | +25.00 pp |
| primer_design     |      7 |  71.43% |   85.71% | +14.29 pp |
| restriction       |      8 |  62.50% |   50.00% | -12.50 pp |
| blast             |      9 |  44.44% |   55.56% | +11.11 pp |
| sequence_editing  |     11 |  54.55% |   63.64% |  +9.09 pp |
| navigation        |     24 |  75.00% |   79.17% |  +4.17 pp |
| system_setup      |      1 | 100.00% |  100.00% |  +0.00 pp |
| system            |     11 | 100.00% |  100.00% |  +0.00 pp |
| data_loading      |      6 |  83.33% |   83.33% |  +0.00 pp |
| analysis          |      4 |  50.00% |   50.00% |  +0.00 pp |
| sequence          |      6 |  50.00% |   50.00% |  +0.00 pp |
| search            |      4 |  75.00% |   75.00% |  +0.00 pp |
| file_export       |      9 |   0.00% |    0.00% |  +0.00 pp |
| ui_interaction    |      3 |  33.33% |   33.33% |  +0.00 pp |
| external_database |      4 | 100.00% |  100.00% |  +0.00 pp |
| annotation        |     11 |  63.64% |   63.64% |  +0.00 pp |
| gene_analysis     |      1 |   0.00% |    0.00% |  +0.00 pp |
| track_settings    |      5 |  80.00% |   80.00% |  +0.00 pp |
| utility           |      2 |  50.00% |   50.00% |  +0.00 pp |
| benchmark         |      2 | 100.00% |  100.00% |  +0.00 pp |
| file_operations   |      3 | 100.00% |  100.00% |  +0.00 pp |
| data_management   |      1 | 100.00% |  100.00% |  +0.00 pp |
| database          |      3 |   0.00% |    0.00% |  +0.00 pp |
| protein_structure |      2 | 100.00% |  100.00% |  +0.00 pp |
| sequence_analysis |      4 |  25.00% |   25.00% |  +0.00 pp |
| annotations       |      2 |   0.00% |    0.00% |  +0.00 pp |
| protein_analysis  |      1 |   0.00% |    0.00% |  +0.00 pp |

## 严格失败分类

| 失败信号                    | 基座 (strict-v2) | 新 iter 50 |
| --------------------------- | ---------------: | ---------: |
| 未通过测试                  |               28 |         18 |
| 未调用工具                  |                4 |          0 |
| 工具序列错误/多余调用       |               16 |         10 |
| 参数不匹配（含缺参）        |                7 |          8 |
| JSON Schema 无效            |                1 |          3 |
| 执行未完成（contract 模拟） |               28 |         18 |

thinking 开启运行（`qwen3.5_4b-codexomics-tools-v2-thinking.json`）的 18 个失败里，自动简单 4 个：`load_auto_05`（`filePaths` 给了数组、oracle 期望单字符串，契约口径问题）、`nav_auto_01`（缺 `position` 参数）、`settings_auto_07`（选错工具 `get_track_settings_schema` vs `set_track_settings`）、`db_auto_02`（缺 `searchTerm`）。其余 14 个都在自动复杂，三类模式：

1. **近义工具替换/序列错位**（10 条）：`batch_create_annotations` vs `create_annotation`、`blast_create_database` vs `blast_create_db_from_genome`、`advanced_uniprot_search` vs `analyze_interpro_domains`、`virtual_digest` 重复两次 vs `simulate_gel_electrophoresis`、多步链路中途换成无关工具（`analysis_auto_complex_03/05`、`task_auto_complex_01`）。
2. **跨轮参数引用丢失**：`ui_auto_complex_02` 的 `switch_to_tab` 未写 `{open_new_tab.tab_id}` 引用。
3. **参数键/枚举错误**（8 条含缺参）：`update_annotation` 的 `updates.note` vs `updates.description`、`capture_screenshot` 缺 `mode`、`export_current_view_fasta` 的 `sequence_type` 越界、`export_bed_format` 缺 `featureTypes`。

剩余短板是长链工具编排与跨工具结果参数引用，不是工具检索或单步 grounding。

## 多轮循环终止与 thinking 模式评测（2026-08-02）

### 多轮对话循环终止逻辑（ChatManager）

任务级终止以“最终助手消息不再包含工具调用”为主信号（与 Claude Code / Codex CLI 一致），并增加四道防线：

1. **stop_reason 主信号**：干净停止（`stop` / `end_turn` / `stop_sequence` 等）或缺失（适配器把干净完成折叠成纯字符串）才允许结束回合；异常停止（`length`、`tool_calls` 协议不一致、未知原因）即使绕过协议恢复也会被兜底判为未完成，不再冒充正常回答。
2. **空响应有界终止**：连续两轮“干净停止 + 空正文”（例如只输出 thinking、没有可见内容）以确定性消息终止；`finish_reason=length` 的截断轮次不计入，仍走协议重试，避免误杀 thinking 模型。
3. **关键词启发式降级**：`checkTaskCompletion` 只在 stop_reason 干净、正文非空、且回复不是“我接下来要…”这类续行动作时才生效。
4. **显式 `<end_of_turn>` 标记：评估后放弃。** 它只解决纯文本协议的解析问题；CodeXomics 使用结构化 `tool_calls`，任务级终止已由“无工具调用的最终消息”确定，标记只会给本地模型增加“忘记打标记→误判未完成”的失败模式。DeepSeek/Claude/GPT 等 API 模型本身也不会输出该标记，它们依赖 `finish_reason` / `stop_reason`。

### thinking 开启评测（172 条全量）

运行条件：Ollama `/api/chat`、temperature 0、seed 42、`num_predict` 8192、thinking 开启；约 28 分钟。

| 套件     | think:false 基线 |    thinking 开启 | 变化 |
| -------- | ---------------: | ---------------: | ---: |
| 自动简单 | 139/143 (97.20%) | 139/143 (97.20%) |    0 |
| 自动复杂 |   15/29 (51.72%) |   15/29 (51.72%) |    0 |
| 总体     | 154/172 (89.53%) | 154/172 (89.53%) |    0 |

逐条对比（`tuned-v2.json` vs `qwen3.5_4b-codexomics-tools-v2-thinking.json`）共 8 条翻转，4 升 4 降：

| 用例                  |          变化 | 失败原因                 |
| --------------------- | ------------: | ------------------------ |
| nav_auto_01           |   10/10 → 3/5 | 缺 `position` 参数       |
| db_auto_02            |     5/5 → 3/5 | 缺 `searchTerm` 参数     |
| task_auto_complex_01  | 15/15 → 13/15 | `list_tasks` 出现位置错  |
| blast_auto_complex_03 | 20/20 → 19/20 | `sequence_type` 枚举越界 |
| annot_auto_08         |     0/5 → 5/5 | 修复                     |
| db_auto_01            |     3/5 → 5/5 | 修复                     |
| nav_auto_complex_02   | 18/20 → 20/20 | 满分                     |
| blast_auto_complex_04 | 12/15 → 15/15 | 满分                     |

结论：thinking 开关不改变工具调用准确率（净 0），但生成 token 从约 1.08 万增至 5.44 万（约 5 倍）；平均延迟 10772ms → 9967ms。reasoning 可保留，且对话中思考内容照常进入 thinking 面板。

## v3 多轮轨迹微调（2026-08-02）

针对自动复杂短板（v2 只有单轮监督样本：多步记录全部被强模型回放门禁过滤，DeepSeek 多步回放 0/14），构建了 v3 多轮轨迹训练集并重新微调：

- **数据**：`data-v3/` = 原 82/63/21 单轮合格样本 + 8/3/3 条夹具可执行多步 release 记录（oracle 金标 + 真实夹具输出）+ 合成链式轨迹（train 260 / dev 46，13 类模板，覆盖"查找基因→取序列→计算"、"序列→翻译→分子量"、"列表→详情"、"UniProt 搜索→条目"等，依赖参数使用 `{tool_name.path}` 跨轮引用语法）；全部经过 172 条基准泄漏过滤，渲染后 max 2581 tokens（上限 3072）。
- **训练**：`config/qlora-v3.yaml`（200 iters，iter 200 最优，Val loss 0.018，Test loss 0.036 / ppl 1.037，峰值内存 165GB 含换页）。
- **部署**：`qwen3.5:4b-codexomics-tools-v3`（Q4_K_M，2.7GB）。

| 套件     |   v2（thinking） |   v3（thinking） | 变化 |
| -------- | ---------------: | ---------------: | ---: |
| 自动简单 | 139/143 (97.20%) | 138/143 (96.50%) |   -1 |
| 自动复杂 |   15/29 (51.72%) |   16/29 (55.17%) |   +1 |
| 总体     | 154/172 (89.53%) | 154/172 (89.53%) |    0 |

复杂套件新通过：`analysis_auto_01`（GC + BED 导出）、`blast_auto_complex_03`（5 步 blast 链）；`gel_auto_01` 已选对 `simulate_gel_electrophoresis` 但参数 `ladderType` 出现双重编码（`"\"1kb\""`），`export_auto_complex_02` 与 `primer_auto_complex_02` 为新增回退。剩余 13 条失败仍集中在：近义工具替换（`blast_create_database` vs `blast_create_db_from_genome`、`advanced_uniprot_search` vs `analyze_interpro_domains`）、跨轮引用未泛化（`switch_to_tab` 仍缺 `{open_new_tab.tab_id}`）、参数键错误（`updates.note` vs `updates.description`、缺 `mode`/`position`）。下一轮方向：为非夹具工具（tab/task/annotation/blast/primer）构造"模拟结果 + 跨轮引用"轨迹，并加入近义工具对判别样本。

## 生产结论与下一轮方案

1. **发布 `qwen3.5:4b-codexomics-tools-v2` 为推荐候选。** 154/172 (89.53%) 通过全部发布门禁，且超过基座与 DeepSeek V4 Flash 对照；应用侧默认模型切换按产品流程单独执行。
2. **多步链路是下一轮重点。** 自动复杂 15/29 已比基座（12/29）提升，但 14 个失败几乎全部是多步序列错位、近义工具替换或跨轮参数引用丢失。优先把 SFT 数据从“单轮工具调用”升级为“工具结果 → 下一步调用/最终总结”的多轮轨迹（现有 166 条强模型通过 replay 已带 fixture outputs，可直接构造），并把 `{tool_call_id.param}` 参数引用格式写进训练样本；同时为容易混淆的工具对（blast_create_database/blast_create_db_from_genome、virtual_digest/simulate_gel_electrophoresis、create_annotation/batch_create_annotations、search_uniprot_database/advanced_uniprot_search）增加判别性提示与负例。
3. **模型规模。** 4B 单步已达 97.2%；若要把复杂链路推到 75%+，7B/14B 或带思考的模型更合适，但仍需先在夹具 dev 上验证再下载。
4. **DPO/偏好数据。** 运行语义负例回放后，将 `candidate-preferences.jsonl`（623 条）中通过负例验证的行提升为 `preferences.jsonl`，再做第二轮偏好优化。
5. **评测纪律。** 训练期只使用私有夹具 dev/holdout；172 条最终测试仅作一次验收，不再承担模型选择职责。

## 复现命令与制品

- 数据构建/验证：`npm run dataset:build && npm run dataset:validate`
- DeepSeek 回放：`DEEPSEEK_API_KEY=... node scripts/deepseek-dataset-replay.js --split all --model deepseek-v4-flash --thinking disabled --output finetuning/qwen3.5-4b/metrics/deepseek-v4-flash-dataset-v3.jsonl`
- MLX 数据：`npm run dataset:prepare:qwen35 && npm run dataset:verify:qwen35`
- 训练配置与日志：`config/qlora.yaml`、`training-v2.log`（旧运行保留在 `training-legacy.log`）。
- 检查点选择：`metrics/checkpoint-selection.json` 与 `metrics/holdout-*.json`。
- 机器可读发布结论：`artifacts/release-decision.json`。
- 数据集回放结论：`metrics/deepseek-v4-flash-dataset-v3.jsonl` 与 `metrics/deepseek-v4-flash-dataset-v3.jsonl.summary.json`。
- 基线：`metrics/baseline.json`、`metrics/baseline-rescored-v2.json`。
- 新候选基准：`metrics/tuned-v2.json`（154/172）；旧 iter 250：`metrics/tuned-rescored-v2.json`。
- thinking 开启复测：`metrics/qwen3.5_4b-codexomics-tools-v2-thinking.json`（154/172，逐条对比见“多轮循环终止与 thinking 模式评测”）。
- 复测命令：`node scripts/ollama-tool-benchmark.js --model qwen3.5:4b-codexomics-tools-v2 --suite all --tag thinking`。
- v3 多轮轨迹复测：`metrics/qwen3.5_4b-codexomics-tools-v3-thinking-v3.json`（复杂 16/29、简单 138/143，总体 154/172）；训练日志 `training-v3.log`；配置 `config/qlora-v3.yaml`；部署配方 `ollama/Modelfile-v3`。
- Adapter：`selected-adapter/`（iter 50）；旧 Adapter 备份：`adapters-legacy-rejected/`。
- 部署配方：`ollama/Modelfile`；规范权重：`fused-hf/`。

## 主要参考资料

- [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B)
- [MLX-LM LoRA/QLoRA guide](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md)
- [MLX Qwen3.5 4-bit conversion](https://huggingface.co/mlx-community/Qwen3.5-4B-MLX-4bit)
- [Ollama model import guide](https://docs.ollama.com/import)
- [Ollama Qwen3.5 Safetensors converter](https://github.com/ollama/ollama/blob/main/convert/convert_qwen3next.go)
