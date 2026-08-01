#!/usr/bin/env python3
"""Audit candidate tool-data lengths with the model's real chat template."""

from __future__ import annotations

import argparse
import json
import statistics
from collections import Counter
from pathlib import Path

from transformers import AutoTokenizer


SPLITS = ("train", "dev", "holdout")
THRESHOLDS = (2048, 4096, 8192, 16384)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", type=Path, required=True)
    parser.add_argument("--release", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--candidate-limit",
        type=int,
        help="Audit a smaller gold-preserving candidate catalog without changing the release.",
    )
    return parser.parse_args()


def percentile(values: list[int], fraction: float) -> int:
    ordered = sorted(values)
    if not ordered:
        return 0
    index = min(len(ordered) - 1, int((len(ordered) - 1) * fraction))
    return ordered[index]


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def clean_messages(messages: list[dict]) -> list[dict]:
    cleaned = json.loads(json.dumps(messages))
    for message in cleaned:
        for tool_call in message.get("tool_calls", []):
            arguments = tool_call.get("function", {}).get("arguments")
            if isinstance(arguments, str):
                tool_call["function"]["arguments"] = json.loads(arguments)
    return cleaned


def supervised_prefixes(messages: list[dict]) -> list[list[dict]]:
    prefixes = [
        messages[: index + 1]
        for index, message in enumerate(messages)
        if message.get("role") == "assistant"
        and (message.get("tool_calls") or message.get("content") is not None)
    ]
    return prefixes or [messages]


def summarize(lengths: list[int], prompt_offsets: list[int]) -> dict:
    return {
        "examples": len(lengths),
        "min_tokens": min(lengths, default=0),
        "mean_tokens": round(statistics.fmean(lengths), 2) if lengths else 0,
        "p50_tokens": percentile(lengths, 0.50),
        "p95_tokens": percentile(lengths, 0.95),
        "p99_tokens": percentile(lengths, 0.99),
        "max_tokens": max(lengths, default=0),
        "max_prompt_offset": max(prompt_offsets, default=0),
        "records_over_threshold": {
            str(threshold): sum(length > threshold for length in lengths) for threshold in THRESHOLDS
        },
        "targets_starting_after_threshold": {
            str(threshold): sum(offset >= threshold for offset in prompt_offsets) for threshold in THRESHOLDS
        },
    }


def main() -> None:
    args = parse_args()
    tokenizer = AutoTokenizer.from_pretrained(args.model, trust_remote_code=True)
    catalog = json.loads((args.release / "tool-catalog.json").read_text())
    tool_map = {tool["function"]["name"]: tool for tool in catalog["tools"]}
    report = {
        "schema_version": "1.0",
        "model": str(args.model),
        "release": str(args.release),
        "manual_tests_included": 0,
        "candidate_limit_override": args.candidate_limit,
        "thresholds": list(THRESHOLDS),
        "splits": {},
    }
    all_lengths: list[int] = []
    all_offsets: list[int] = []
    tool_histogram: Counter[int] = Counter()

    for split in SPLITS:
        lengths: list[int] = []
        offsets: list[int] = []
        records = load_jsonl(args.release / f"{split}.jsonl")
        for record in records:
            selected = record.get("tool_catalog", {}).get("candidate_tool_names", [])
            if args.candidate_limit:
                gold = [
                    call.get("tool_name")
                    for call in record.get("oracle", {}).get("acceptable_calls", [])
                    if call.get("tool_name")
                ]
                selected = list(dict.fromkeys(gold + selected))[: args.candidate_limit]
            tools = [tool_map[name] for name in selected]
            tool_histogram[len(tools)] += 1
            messages = clean_messages(record.get("messages", []))
            for prefix in supervised_prefixes(messages):
                tokens = tokenizer.apply_chat_template(prefix, tools=tools, return_dict=False)
                prompt = tokenizer.apply_chat_template(
                    prefix[:-1],
                    tools=tools,
                    add_generation_prompt=prefix[-1].get("role") == "assistant",
                    return_dict=False,
                )
                lengths.append(len(tokens))
                offsets.append(len(prompt))
        report["splits"][split] = {
            "source_records": len(records),
            **summarize(lengths, offsets),
        }
        all_lengths.extend(lengths)
        all_offsets.extend(offsets)

    report["overall"] = summarize(all_lengths, all_offsets)
    report["candidate_tool_count_histogram"] = {
        str(count): records for count, records in sorted(tool_histogram.items())
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered)
    print(rendered, end="")


if __name__ == "__main__":
    main()
