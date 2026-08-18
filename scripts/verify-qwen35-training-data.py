#!/usr/bin/env python3
"""Render Qwen3.5 chat records and fail if truncation would remove a target."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from transformers import AutoTokenizer


SPLITS = ("train", "valid", "test")


def percentile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(len(ordered) * fraction))]


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--max-seq-length", type=int, default=10240)
    parser.add_argument("--output", type=Path, required=True)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest = json.loads((args.data / "manifest.json").read_text())
    if manifest["benchmark_scope"]["manual_tests_included"] != 0:
        raise ValueError("Manual benchmark data is forbidden")

    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    report = {
        "schema_version": "1.0",
        "model": str(args.model),
        "max_seq_length": args.max_seq_length,
        "manual_tests_included": 0,
        "splits": {},
    }
    for split in SPLITS:
        path = args.data / f"{split}.jsonl"
        lengths: list[int] = []
        offsets: list[int] = []
        records = [json.loads(line) for line in path.read_text().splitlines() if line]
        for index, record in enumerate(records, start=1):
            messages = record["messages"]
            for message in messages:
                for tool_call in message.get("tool_calls", []):
                    arguments = tool_call.get("function", {}).get("arguments")
                    if not isinstance(arguments, dict):
                        raise TypeError(f"{split}:{index}: tool-call arguments must be an object")
            tokens = tokenizer.apply_chat_template(messages, tools=record.get("tools"), return_dict=False)
            prompt = tokenizer.apply_chat_template(
                messages[:-1],
                tools=record.get("tools"),
                add_generation_prompt=messages[-1].get("role") == "assistant",
                return_dict=False,
            )
            lengths.append(len(tokens))
            offsets.append(len(prompt))
            if len(prompt) >= args.max_seq_length:
                raise ValueError(f"{split}:{index}: right truncation would remove the entire target")
            if len(tokens) > args.max_seq_length:
                raise ValueError(f"{split}:{index}: rendered record exceeds max_seq_length")
        report["splits"][split] = {
            "records": len(records),
            "min_tokens": min(lengths),
            "p50_tokens": percentile(lengths, 0.50),
            "p95_tokens": percentile(lengths, 0.95),
            "p99_tokens": percentile(lengths, 0.99),
            "max_tokens": max(lengths),
            "max_prompt_offset": max(offsets),
            "sha256": file_sha256(path),
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
