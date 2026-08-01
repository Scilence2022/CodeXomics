#!/usr/bin/env python3
"""Export fused MLX Qwen3.5 weights as canonical HF Safetensors for Ollama."""

from __future__ import annotations

import argparse
import json
import math
import shutil
from pathlib import Path

import mlx.core as mx


NORM_SUFFIXES = (
    ".input_layernorm.weight",
    ".post_attention_layernorm.weight",
    "model.norm.weight",
    ".q_norm.weight",
    ".k_norm.weight",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def canonical_name(name: str) -> str:
    if name.startswith("language_model.model."):
        return "model.language_model." + name.removeprefix("language_model.model.")
    if name.startswith("language_model.lm_head."):
        return "lm_head." + name.removeprefix("language_model.lm_head.")
    raise ValueError(f"Unexpected fused MLX tensor name: {name}")


def canonical_tensor(name: str, value: mx.array) -> mx.array:
    if "conv1d.weight" in name and value.ndim == 3:
        value = mx.moveaxis(value, 1, 2)
    if any(name.endswith(suffix) for suffix in NORM_SUFFIXES) and value.ndim == 1:
        value = value - mx.array(1.0, dtype=value.dtype)
    return value


def copy_support_files(source: Path, destination: Path) -> None:
    for path in source.iterdir():
        if path.name.startswith("model") and path.suffix in {".safetensors", ".json"}:
            continue
        if path.is_file():
            shutil.copy2(path, destination / path.name)


def main() -> None:
    args = parse_args()
    input_files = sorted(args.input.glob("model*.safetensors"))
    if not input_files:
        raise FileNotFoundError(f"No fused Safetensors in {args.input}")
    args.output.mkdir(parents=True, exist_ok=True)
    if list(args.output.glob("model*.safetensors")):
        raise FileExistsError(f"Output already contains model weights: {args.output}")

    config = json.loads((args.input / "config.json").read_text())
    if config.get("model_type") != "qwen3_5":
        raise ValueError(f"Expected qwen3_5, found {config.get('model_type')}")
    if config.get("quantization") or config.get("quantization_config"):
        raise ValueError("Input must be a dequantized fused model")
    text_config = config.get("text_config", config)
    text_config["mtp_num_hidden_layers"] = 0
    text_config.pop("num_nextn_predict_layers", None)
    config.pop("vision_config", None)
    for key in ("image_token_id", "video_token_id", "vision_start_token_id", "vision_end_token_id"):
        config.pop(key, None)

    weight_map: dict[str, str] = {}
    total_size = 0
    file_count = len(input_files)
    for index, input_file in enumerate(input_files, start=1):
        output_name = "model.safetensors" if file_count == 1 else f"model-{index:05d}-of-{file_count:05d}.safetensors"
        tensors = {}
        for internal_name, value in mx.load(str(input_file)).items():
            name = canonical_name(internal_name)
            value = canonical_tensor(internal_name, value)
            mx.eval(value)
            tensors[name] = value
            weight_map[name] = output_name
            total_size += math.prod(value.shape) * value.itemsize
        mx.save_safetensors(str(args.output / output_name), tensors, metadata={"format": "pt"})
        del tensors
        mx.clear_cache()

    copy_support_files(args.input, args.output)
    (args.output / "config.json").write_text(json.dumps(config, indent=2) + "\n")
    if file_count > 1:
        index = {"metadata": {"total_size": total_size}, "weight_map": weight_map}
        (args.output / "model.safetensors.index.json").write_text(json.dumps(index, indent=2) + "\n")

    summary = {
        "schema_version": "1.0",
        "architecture": config["architectures"][0],
        "model_type": config["model_type"],
        "tensor_count": len(weight_map),
        "total_size": total_size,
        "shards": file_count,
        "quantization": None,
        "mtp_num_hidden_layers": text_config["mtp_num_hidden_layers"],
    }
    (args.output / "export-manifest.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
