# Qwen3.5 4B CodeXomics Tool-Calling Fine-Tune

This directory contains the reproducible local QLoRA run for the Ollama
`qwen3.5:4b` model. The evaluation scope is exactly 143 automatic-simple and
29 automatic-complex tests. Manual benchmark suites are never loaded.

## Fixed environment

- Hardware: Apple M3 Max, 40-core GPU, 128 GB unified memory
- Training runtime: Python 3.12.2, MLX 0.32.0, MLX-LM 0.31.2
- Training base: `mlx-community/Qwen3.5-4B-MLX-4bit`
- Deployment base family: `Qwen/Qwen3.5-4B`, Apache-2.0
- Benchmark inference: Ollama native tools API, temperature 0, seed 42,
  streaming disabled, at most 24 retrieved tools

The Ollama Q4_K_M GGUF is an inference artifact and is not used as a training
checkpoint. QLoRA uses the corresponding MLX quantized weights, then fuses the
adapter into dequantized Safetensors. A deterministic export step restores the
canonical Hugging Face tensor names, convolution layout, and RMSNorm convention.
Ollama's current Qwen3.5 converter then imports that directory and produces a
new Q4_K_M deployment artifact.

## Data preparation

```bash
node scripts/tool-calling-dataset.js build
node scripts/tool-calling-dataset.js validate
node scripts/prepare-mlx-tool-data.js
/private/tmp/codexomics-qwen35-venv/bin/python scripts/verify-qwen35-training-data.py \
  --model finetuning/qwen3.5-4b/base-model \
  --data finetuning/qwen3.5-4b/data \
  --max-seq-length 3072 \
  --output finetuning/qwen3.5-4b/data/token-stats.json
```

The release is rebuilt from the deterministic fixture corpus and every
promotion candidate is replayed through DeepSeek V4 Flash native function
calling before it can enter training. Only rows with a semantic `passed`
replay are converted (`data/manifest.json` records the per-split gate). The
MLX conversion expands each multi-step source into one supervised example per
assistant tool-call turn. With `mask_prompt: true`, loss is computed only for
the final tool call or decision response. Tool results and earlier calls
remain context, not prediction targets.

Qwen3.5 requires tool-call `arguments` to be JSON objects in its native chat
template. The converter normalizes the registry's OpenAI-compatible JSON
strings to that representation. Training keeps the release's gold-first
6-tool candidate catalog with a compact schema profile (`compact-v1`): names,
types, required fields, enums, bounds, defaults, and composition constraints
are preserved while property descriptions/examples are dropped and top-level
descriptions are truncated to 160 characters. This is what keeps 6-tool
samples inside the 3072-token training window. Final benchmark inference
retains the harder 24-tool candidate limit with complete schemas. The
configured sequence limit is verified against every rendered record so prompt
masking cannot silently lose the supervised target to right truncation.

The full-schema release remains the source of truth; compacting happens only
in the MLX conversion step.

`data/manifest.json` records source hashes, split sizes, and the explicit
`manual_tests_included: 0` gate. The underlying release additionally enforces
schema validity, deterministic fixture execution, strong-model semantic
replay, benchmark similarity filtering, and scenario-family split isolation.

## Baseline

```bash
node scripts/ollama-tool-benchmark.js \
  --model qwen3.5:4b \
  --concurrency 2 \
  --output finetuning/qwen3.5-4b/metrics/baseline.json
```

The harness sends native tool schemas to Ollama, simulates successful tool
results only after JSON Schema validation, and scores the exact call sequence,
arguments, schema validity, execution status, and extra calls.

## Training

```bash
/private/tmp/codexomics-qwen35-venv/bin/python -m mlx_lm lora \
  --config finetuning/qwen3.5-4b/config/qlora.yaml
```

The checked-in YAML is the authoritative hyperparameter record. Adapter
checkpoints are written under `adapters/`; the validation-selected checkpoint
is copied to `selected-adapter/`. Safetensors are local artifacts excluded from
Git, while configs, hashes, metrics, and selection metadata are retained.

## Fuse and import into Ollama

```bash
/private/tmp/codexomics-qwen35-venv/bin/python -m mlx_lm fuse \
  --model finetuning/qwen3.5-4b/base-model \
  --adapter-path finetuning/qwen3.5-4b/selected-adapter \
  --dequantize \
  --save-path finetuning/qwen3.5-4b/fused-mlx

/private/tmp/codexomics-qwen35-venv/bin/python scripts/export-qwen35-mlx-to-hf.py \
  --input finetuning/qwen3.5-4b/fused-mlx \
  --output finetuning/qwen3.5-4b/fused-hf

ollama create qwen3.5:4b-codexomics-tools-v1 \
  --quantize q4_K_M \
  --file finetuning/qwen3.5-4b/ollama/Modelfile
```

## Release status

The retrained candidate **`qwen3.5:4b-codexomics-tools-v2` PASSES** the
172-case strict benchmark: **154/172 (89.5%)** — automatic simple 139/143
(97.2%), automatic complex 15/29 (51.7%) — versus 144/172 (83.7%) for the
untouched base and 149/172 (86.6%) for the DeepSeek V4 Flash control. It is
the recommended production candidate (app-side rollout is a separate step).

The first fine-tuning run is REJECTED and retained only as an audit artifact.
Root causes were in the data pipeline: the release lacked the deterministic
fixture corpus, no strong-model replay had been run, and the 2048-token limit
truncated most supervised targets once real tool schemas were included. The
release has since been rebuilt (678 records, 204 fixture-executable calls),
all 206 promotion candidates were replayed through DeepSeek V4 Flash (166
passed), and the SFT set (82/63/21) uses compact-v1 6-tool catalogs inside the
3072-token window (max 2381). Training stopped early at iteration 50 (best
validation loss 0.014) after a 98.3GB peak-memory probe; the selected adapter
was fused, imported into Ollama, and benchmarked. See `REPORT.md`.

## Sources

- [Qwen3.5-4B model card](https://huggingface.co/Qwen/Qwen3.5-4B)
- [MLX-LM LoRA/QLoRA guide](https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/LORA.md)
- [MLX Qwen3.5 4-bit conversion](https://huggingface.co/mlx-community/Qwen3.5-4B-MLX-4bit)
- [Ollama model import guide](https://docs.ollama.com/import)
