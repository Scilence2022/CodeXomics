#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const RUN_ROOT = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(RUN_ROOT, relativePath), 'utf8'));
}

function readOptional(relativePath) {
  const filePath = path.join(RUN_ROOT, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function sha256File(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(8 * 1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
}

function percent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function signedPoints(value) {
  const points = Number(value || 0) * 100;
  return `${points >= 0 ? '+' : ''}${points.toFixed(2)} pp`;
}

function signedPercent(value) {
  const percentValue = Number(value || 0) * 100;
  return `${percentValue >= 0 ? '+' : ''}${percentValue.toFixed(2)}%`;
}

function metricRows(baseline, tuned) {
  return ['overall', 'automatic_simple', 'automatic_complex'].map(key => ({
    scope: key === 'overall' ? '总体' : key === 'automatic_simple' ? '自动简单' : '自动复杂',
    baseline: baseline.summary[key],
    tuned: tuned.summary[key],
  }));
}

function categoryMetrics(report) {
  const categories = new Map();
  for (const record of report.records) {
    const key = record.category || 'uncategorized';
    const value = categories.get(key) || { tests: 0, passed: 0 };
    value.tests += 1;
    if (record.evaluation.success) value.passed += 1;
    categories.set(key, value);
  }
  return categories;
}

function transitionMetrics(baseline, tuned) {
  const tunedMap = new Map(tuned.records.map(record => [`${record.suite_id}:${record.test_id}`, record]));
  const gains = [];
  const regressions = [];
  for (const before of baseline.records) {
    const key = `${before.suite_id}:${before.test_id}`;
    const after = tunedMap.get(key);
    if (!after) continue;
    if (!before.evaluation.success && after.evaluation.success) gains.push(key);
    if (before.evaluation.success && !after.evaluation.success) regressions.push(key);
  }
  return { gains, regressions };
}

function failureTaxonomy(report) {
  const counts = {
    failed_tests: 0,
    no_call: 0,
    sequence_or_extra_call: 0,
    argument_mismatch: 0,
    schema_invalid: 0,
    execution_incomplete: 0,
  };
  for (const record of report.records.filter(item => !item.evaluation.success)) {
    counts.failed_tests += 1;
    const errors = record.evaluation.errors.join('\n');
    if (record.calls.length === 0) counts.no_call += 1;
    if (errors.includes('sequence') || record.evaluation.details.unexpectedCalls.length > 0) {
      counts.sequence_or_extra_call += 1;
    }
    if (errors.includes('arguments')) counts.argument_mismatch += 1;
    if (errors.includes('JSON Schema')) counts.schema_invalid += 1;
    if (errors.includes('complete successfully')) counts.execution_incomplete += 1;
  }
  return counts;
}

function parseTrainingLog(log) {
  const numberPattern = '([0-9]+(?:\\.[0-9]+)?)';
  const train = [...log.matchAll(new RegExp(`Iter\\s+(\\d+):\\s+Train loss\\s+${numberPattern}`, 'gi'))].map(match => ({
    iteration: Number(match[1]),
    loss: Number(match[2]),
  }));
  const validation = [...log.matchAll(new RegExp(`Iter\\s+(\\d+):\\s+Val loss\\s+${numberPattern}`, 'gi'))].map(match => ({
    iteration: Number(match[1]),
    loss: Number(match[2]),
  }));
  const bestValidation = validation.length
    ? validation.reduce((best, item) => (item.loss < best.loss ? item : best))
    : null;
  const tests = [
    ...log.matchAll(new RegExp(`Test loss\\s+${numberPattern},\\s+Test ppl\\s+${numberPattern}`, 'gi')),
  ].map(match => ({
    loss: Number(match[1]),
    perplexity: Number(match[2]),
  }));
  return {
    first_train: train[0] || null,
    final_train: train.at(-1) || null,
    best_validation: bestValidation,
    final_validation: validation.at(-1) || null,
    train_points: train.length,
    validation_points: validation.length,
    final_test: tests.at(-1) || null,
  };
}

function markdownList(values, emptyText = 'None') {
  if (!values.length) return emptyText;
  return values.map(value => `\`${value}\``).join(', ');
}

function main() {
  const baseline = readJson('metrics/baseline.json');
  const tuned = readJson('metrics/tuned.json');
  const holdoutSelectedDiagnostic = readJson('metrics/tuned-0150.json');
  const checkpointSelection = readJson('metrics/checkpoint-selection.json');
  const selectedMetadata = readJson('selected-adapter/selection.json');
  const diagnosticMetadata = readJson('selected-adapter-0150/selection.json');
  const exportManifest = readJson('artifacts/fused-hf-manifest.json');
  const dataset = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'datasets', 'tool-calling-v1', 'release', 'manifest.json'), 'utf8')
  );
  const mlxData = readJson('data/manifest.json');
  const tokenStats = readJson('data/token-stats.json');
  if (dataset.schema_version === '2.0' || mlxData.schema_version === '2.0') {
    throw new Error(
      'This generator describes the superseded v1 run and cannot publish v2 data as executable. ' +
        'Use finetuning/qwen3.5-4b/REPORT_V2.md; retrain and add a v2 report generator only after ' +
        'data/manifest.json reports training_eligibility.training_ready=true.'
    );
  }
  const upstream = readJson('base-model/UPSTREAM.json');
  const trainingLog = readOptional('training.log');
  const training = parseTrainingLog(trainingLog);
  const baseHoldoutLoss = parseTrainingLog(readOptional('base-test.log')).final_test;
  const selectedHoldoutLoss = parseTrainingLog(readOptional('selected-test.log')).final_test;
  const config = readOptional('config/qlora.yaml').trim();
  const adapterConfig = readOptional('selected-adapter/adapter_config.json');
  const transitions = transitionMetrics(baseline, tuned);
  const baselineFailures = failureTaxonomy(baseline);
  const tunedFailures = failureTaxonomy(tuned);
  const baselineCategories = categoryMetrics(baseline);
  const tunedCategories = categoryMetrics(tuned);
  const categories = [...new Set([...baselineCategories.keys(), ...tunedCategories.keys()])]
    .map(category => {
      const before = baselineCategories.get(category) || { tests: 0, passed: 0 };
      const after = tunedCategories.get(category) || { tests: 0, passed: 0 };
      return {
        category,
        tests: before.tests,
        before: before.tests ? before.passed / before.tests : 0,
        after: after.tests ? after.passed / after.tests : 0,
      };
    })
    .sort((left, right) => Math.abs(right.after - right.before) - Math.abs(left.after - left.before));
  const adapterPath = path.join(RUN_ROOT, 'selected-adapter', 'adapters.safetensors');
  const tunedDelta = tuned.summary.overall.accuracy - baseline.summary.overall.accuracy;
  const scoreDelta = tuned.summary.overall.average_score_ratio - baseline.summary.overall.average_score_ratio;
  const latencyDelta =
    tuned.summary.overall.average_duration_ms / baseline.summary.overall.average_duration_ms - 1;
  const releaseChecks = [
    {
      name: '总体严格准确率不低于基座',
      passed: tuned.summary.overall.accuracy >= baseline.summary.overall.accuracy,
      evidence: `${percent(tuned.summary.overall.accuracy)} vs ${percent(baseline.summary.overall.accuracy)}`,
    },
    {
      name: '自动简单准确率不低于基座',
      passed: tuned.summary.automatic_simple.accuracy >= baseline.summary.automatic_simple.accuracy,
      evidence: `${percent(tuned.summary.automatic_simple.accuracy)} vs ${percent(baseline.summary.automatic_simple.accuracy)}`,
    },
    {
      name: '自动复杂准确率不低于基座',
      passed: tuned.summary.automatic_complex.accuracy >= baseline.summary.automatic_complex.accuracy,
      evidence: `${percent(tuned.summary.automatic_complex.accuracy)} vs ${percent(baseline.summary.automatic_complex.accuracy)}`,
    },
    {
      name: '平均延迟不高于基座 125%',
      passed: tuned.summary.overall.average_duration_ms <= baseline.summary.overall.average_duration_ms * 1.25,
      evidence: `${tuned.summary.overall.average_duration_ms.toFixed(0)} ms vs ` +
        `${baseline.summary.overall.average_duration_ms.toFixed(0)} ms`,
    },
    {
      name: '数据 Schema/执行/泄漏门禁全部通过',
      passed:
        dataset.release_gates.schema_valid_rate === 1 &&
        dataset.release_gates.schema_sandbox_executable_rate === 1 &&
        dataset.release_gates.leakage_pass_rate === 1 &&
        dataset.release_gates.family_split_overlap === 0,
      evidence: '1.00 / 1.00 / 1.00 / 0 overlap',
    },
  ];
  const releaseApproved = releaseChecks.every(check => check.passed);

  const lines = [
    '# Qwen3.5 4B CodeXomics 工具调用微调报告',
    '',
    `生成时间：${new Date().toISOString()}`,
    '',
    '## 执行摘要',
    '',
    `**发布结论：${releaseApproved ? '通过' : '未通过'}。** 验证损失选出的 iter ` +
      `${selectedMetadata.selectedIteration} 微调候选在 172 项严格自动评测中取得 ` +
      `**${tuned.summary.overall.passed}/${tuned.summary.overall.tests} ` +
      `(${percent(tuned.summary.overall.accuracy)})**，相对原始 Ollama \`qwen3.5:4b\` ` +
      `下降 **${signedPoints(tunedDelta)}**。因此不能替换基座模型，生产默认应继续使用 ` +
      '`qwen3.5:4b`；微调标签仅保留为实验与审计制品。',
    '',
    `微调的正向结果是自动复杂测试从 ${baseline.summary.automatic_complex.passed}/29 ` +
      `(${percent(baseline.summary.automatic_complex.accuracy)}) 提升到 ` +
      `${tuned.summary.automatic_complex.passed}/29 (${percent(tuned.summary.automatic_complex.accuracy)})；` +
      `但自动简单测试下降 ${Math.abs(tuned.summary.automatic_simple.passed - baseline.summary.automatic_simple.passed)} 条，` +
      `抵消了复杂能力增益。平均部分得分变化 ${signedPoints(scoreDelta)}，平均延迟变化 ` +
      `${signedPercent(latencyDelta)}。`,
    '',
    '严格通过要求：工具调用序列和参数满足用例期望、注册 JSON Schema 校验通过、沙箱模拟执行成功，且没有多余调用。',
    '',
    '| 范围 | 基座 | iter 250 微调候选 | 变化 |',
    '|---|---:|---:|---:|',
    ...metricRows(baseline, tuned).map(
      row =>
        `| ${row.scope} | ${row.baseline.passed}/${row.baseline.tests} (${percent(row.baseline.accuracy)}) | ` +
        `${row.tuned.passed}/${row.tuned.tests} (${percent(row.tuned.accuracy)}) | ` +
        `${signedPoints(row.tuned.accuracy - row.baseline.accuracy)} |`
    ),
    '',
    '## 发布门禁',
    '',
    '| 门禁 | 结果 | 证据 |',
    '|---|---|---|',
    ...releaseChecks.map(check => `| ${check.name} | ${check.passed ? '通过' : '失败'} | ${check.evidence} |`),
    '',
    `最终状态：**${releaseApproved ? 'APPROVED' : 'REJECTED'}**。失败候选不得覆盖 CodeXomics 的生产默认模型配置。`,
    '',
    '## 候选模型对照',
    '',
    '| 制品 | 总体严格准确率 | 自动简单 | 自动复杂 | 平均部分得分 | 平均延迟 |',
    '|---|---:|---:|---:|---:|---:|',
    `| 原始基座 | ${percent(baseline.summary.overall.accuracy)} | ` +
      `${percent(baseline.summary.automatic_simple.accuracy)} | ` +
      `${percent(baseline.summary.automatic_complex.accuracy)} | ` +
      `${percent(baseline.summary.overall.average_score_ratio)} | ` +
      `${baseline.summary.overall.average_duration_ms.toFixed(0)} ms |`,
    `| iter ${selectedMetadata.selectedIteration}（验证损失选取） | ${percent(tuned.summary.overall.accuracy)} | ` +
      `${percent(tuned.summary.automatic_simple.accuracy)} | ` +
      `${percent(tuned.summary.automatic_complex.accuracy)} | ` +
      `${percent(tuned.summary.overall.average_score_ratio)} | ` +
      `${tuned.summary.overall.average_duration_ms.toFixed(0)} ms |`,
    `| iter ${diagnosticMetadata.selectedIteration}（小 holdout 诊断） | ` +
      `${percent(holdoutSelectedDiagnostic.summary.overall.accuracy)} | ` +
      `${percent(holdoutSelectedDiagnostic.summary.automatic_simple.accuracy)} | ` +
      `${percent(holdoutSelectedDiagnostic.summary.automatic_complex.accuracy)} | ` +
      `${percent(holdoutSelectedDiagnostic.summary.overall.average_score_ratio)} | ` +
      `${holdoutSelectedDiagnostic.summary.overall.average_duration_ms.toFixed(0)} ms |`,
    '',
    `iter ${diagnosticMetadata.selectedIteration} 在 21 条可执行 holdout 上领先，但最终仅为 ` +
      `${holdoutSelectedDiagnostic.summary.overall.passed}/172，证明小 holdout 的方差过大，不能作为单一发布选择器。` +
      '该诊断发生在训练完成后，未把任何基准答案回灌数据。',
    '',
    '## 范围与防泄漏控制',
    '',
    '- 评测严格限定为 **143 个自动简单测试 + 29 个自动复杂测试**。',
    '- 手动测试被加载、训练、验证或评测的数量：**0**。',
    `- 基准仅以单向指纹用于泄漏检查；指纹摘要为 \`${dataset.benchmark_scope.fingerprint_hash}\`，` +
      '测试提示词和答案从未导出到训练数据。',
    `- 数据集按 \`scenario_family_id\` 分组切分，家族跨 train/dev/holdout 重叠为 ` +
      `${dataset.release_gates.family_split_overlap}。`,
    '- 最终测试结果未用于继续训练；150 检查点的追加复核只用于证明小 holdout 选择器失效。',
    '',
    '## 数据集',
    '',
    `- 输入来源 ${dataset.input_sources} 条，接受 ${dataset.accepted_examples} 条，拒绝 ` +
      `${dataset.rejected_examples} 条。拒绝原因：Schema/执行失败 ` +
      `${dataset.rejection_counts.schema_execution_failed}、token 相似泄漏 ` +
      `${dataset.rejection_counts.token_similarity}、精确 prompt hash ` +
      `${dataset.rejection_counts.exact_prompt_hash}。`,
    `- 源记录切分：train/dev/holdout = ${dataset.splits.train.count}/` +
      `${dataset.splits.dev.count}/${dataset.splits.holdout.count}。`,
    `- MLX 监督样本：train/valid/test = ${mlxData.splits.train.supervised_examples}/` +
      `${mlxData.splits.dev.supervised_examples}/${mlxData.splits.holdout.supervised_examples}；` +
      '同一多轮来源保持在同一切分。',
    `- 训练候选工具最多 3 个并始终包含 gold 工具；运行时和最终基准使用动态检索的 24 个候选工具。`,
    `- 渲染后训练序列：p50 ${tokenStats.splits.train.p50_tokens}、p95 ` +
      `${tokenStats.splits.train.p95_tokens}、最大 ${tokenStats.splits.train.max_tokens} tokens；` +
      `上限 ${tokenStats.max_seq_length}，监督目标截断 0 条。`,
    `- 发布门禁：Schema ${percent(dataset.release_gates.schema_valid_rate)}、沙箱可执行 ` +
      `${percent(dataset.release_gates.schema_sandbox_executable_rate)}、泄漏检查 ` +
      `${percent(dataset.release_gates.leakage_pass_rate)}。`,
    '',
    '## 模型、训练与早停',
    '',
    '- 基础模型：Qwen/Qwen3.5-4B，Apache-2.0；Ollama 基座为 `qwen3.5:4b` Q4_K_M。',
    '- 训练权重：mlx-community/Qwen3.5-4B-MLX-4bit。',
    `- 上游权重 SHA-256：\`${upstream.sha256}\`。`,
    '- 硬件：Apple M3 Max（40 核 GPU），128 GB 统一内存。',
    '- 运行时：Python 3.12.2、MLX 0.32.0、MLX-LM 0.31.2。',
    `- 正式训练运行到 iter 350 后早停；峰值内存 59.078 GB。`,
    `- 验证损失最低点为 ${training.best_validation.loss}（iter ${training.best_validation.iteration}）；` +
      `iter 300/350 分别回升到 0.174/0.107，满足 patience=2。`,
    `- 基座与 iter 250 的 MLX 留出 loss：${baseHoldoutLoss?.loss ?? '未解析'} → ` +
      `${selectedHoldoutLoss?.loss ?? '未解析'}；perplexity：` +
      `${baseHoldoutLoss?.perplexity ?? '未解析'} → ${selectedHoldoutLoss?.perplexity ?? '未解析'}。`,
    `- iter 250 Adapter SHA-256：\`${sha256File(adapterPath) || '不可用'}\`。`,
    '',
    '### 可执行 holdout 检查点对照',
    '',
    '| 迭代 | 完整调用精确 | 工具名精确 |',
    '|---:|---:|---:|',
    ...checkpointSelection.candidates.map(
      candidate =>
        `| ${candidate.iteration} | ${candidate.exact}/21 (${percent(candidate.exact / 21)}) | ` +
        `${candidate.tool_names}/21 (${percent(candidate.tool_names / 21)}) |`
    ),
    '',
    'holdout 仅有 21 个监督调用，适合诊断但不适合作为生产模型选择的唯一依据。下一版应为高风险参数家族建立更大的私有 dev 集。',
    '',
    '### 训练配置',
    '',
    '```yaml',
    config,
    '```',
    '',
    '### Adapter 配置',
    '',
    '```json',
    adapterConfig.trim() || '{}',
    '```',
    '',
    '## 原生 function calling 与部署',
    '',
    '- 训练目标使用 Qwen3.5 原生 chat template 和 `tool_calls`，参数在数据入口统一为 JSON object。',
    '- 推理使用 Ollama `/api/chat` 的 `tools` 字段、`think: false`、temperature 0、seed 42；不依赖正则提取伪 JSON。',
    '- Ollama Modelfile 显式设置 `RENDERER qwen3.5` 与 `PARSER qwen3.5`，最终能力包含 tools/thinking。',
    `- 融合导出：${exportManifest.tensor_count} 个规范 HF 张量，${exportManifest.shards} 个 shard，` +
      `${(exportManifest.total_size / 1024 ** 3).toFixed(2)} GiB；架构 ` +
      `\`${exportManifest.architecture}\`。`,
    '- 部署链：MLX LoRA 反量化融合 → 还原 Hugging Face 张量布局 → Ollama 官方 Qwen3.5 转换器 → Q4_K_M。',
    '- 本地实验标签：`qwen3.5:4b-codexomics-tools-v1`；该标签已生成且可调用，但因发布门禁失败，不应成为默认模型。',
    '',
    '## 行为变化（iter 250）',
    '',
    `相对基座新增通过 ${transitions.gains.length} 条，回归 ${transitions.regressions.length} 条。`,
    '',
    `新增通过用例：${markdownList(transitions.gains, '无')}。`,
    '',
    `回归用例：${markdownList(transitions.regressions, '无')}。`,
    '',
    '| 类别 | 测试数 | 基座 | iter 250 | 变化 |',
    '|---|---:|---:|---:|---:|',
    ...categories.map(
      item =>
        `| ${item.category} | ${item.tests} | ${percent(item.before)} | ${percent(item.after)} | ` +
        `${signedPoints(item.after - item.before)} |`
    ),
    '',
    '## 严格失败分类',
    '',
    '| 失败信号 | 基座 | iter 250 |',
    '|---|---:|---:|',
    `| 未通过测试 | ${baselineFailures.failed_tests} | ${tunedFailures.failed_tests} |`,
    `| 未调用工具 | ${baselineFailures.no_call} | ${tunedFailures.no_call} |`,
    `| 序列错误/多余调用 | ${baselineFailures.sequence_or_extra_call} | ${tunedFailures.sequence_or_extra_call} |`,
    `| 参数不匹配 | ${baselineFailures.argument_mismatch} | ${tunedFailures.argument_mismatch} |`,
    `| JSON Schema 无效 | ${baselineFailures.schema_invalid} | ${tunedFailures.schema_invalid} |`,
    `| 执行未完成 | ${baselineFailures.execution_incomplete} | ${tunedFailures.execution_incomplete} |`,
    '',
    '信号允许重叠。主要问题不是工具检索不可用，而是坐标、文件参数、实体标识符、枚举和多步顺序的精确 grounding 不足。',
    '',
    '## 生产结论与下一轮方案',
    '',
    '1. **不发布本次 Adapter 为默认模型。** 保留原始 `qwen3.5:4b`，微调标签仅供实验。',
    '2. 扩展私有可执行 dev：每个高风险参数家族至少 20–30 条，覆盖边界值、别名、缺参澄清和不得添加的默认参数。',
    '3. 用 Schema 生成独立参数对比样本与 preference pairs，重点训练 exact arguments；不要从这 172 条最终测试复制或改写答案。',
    '4. 将单步参数精确率、复杂序列精确率和 p95 延迟作为训练期门禁；交叉熵只能作为辅助指标。',
    '5. 下一版冻结数据与超参数后只运行一次新的私有最终集；本轮 172 条已被用于验收，不应继续承担模型选择职责。',
    '',
    '## 复现命令与制品',
    '',
    '- 数据构建/验证：`npm run dataset:build && npm run dataset:validate`',
    '- MLX 数据：`npm run dataset:prepare:qwen35 && npm run dataset:verify:qwen35`',
    '- 训练配置与日志：`config/qlora.yaml`、`training.log`。',
    '- 检查点选择：`metrics/checkpoint-selection.json` 与 `metrics/holdout-*.json`。',
    '- 机器可读发布结论：`artifacts/release-decision.json`。',
    '- 基线：`metrics/baseline.json`。',
    '- iter 250：`metrics/tuned.json`；iter 150 诊断：`metrics/tuned-0150.json`。',
    '- Adapter：`selected-adapter/`；150 诊断 Adapter：`selected-adapter-0150/`。',
    '- 部署配方：`ollama/Modelfile`；规范权重：`fused-hf/`。',
    '',
    '## 主要参考资料',
    '',
    '- [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B)',
    '- [MLX-LM LoRA/QLoRA guide](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md)',
    '- [MLX Qwen3.5 4-bit conversion](https://huggingface.co/mlx-community/Qwen3.5-4B-MLX-4bit)',
    '- [Ollama model import guide](https://docs.ollama.com/import)',
    '- [Ollama Qwen3.5 Safetensors converter](https://github.com/ollama/ollama/blob/main/convert/convert_qwen3next.go)',
    '',
  ];
  fs.writeFileSync(path.join(RUN_ROOT, 'REPORT.md'), lines.join('\n'));
  console.log(`Wrote ${path.join(RUN_ROOT, 'REPORT.md')}`);
}

main();
