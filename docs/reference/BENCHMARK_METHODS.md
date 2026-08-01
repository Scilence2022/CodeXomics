# Methods: LLM Function Calling Benchmark Framework

## Overview

We developed a comprehensive benchmark framework to systematically evaluate the function calling capabilities of Large Language Models (LLMs) in the context of genomic data analysis. The framework was designed to assess both the accuracy of tool selection and the correctness of parameter extraction across multiple interaction rounds, providing quantitative metrics for LLM performance in specialized scientific domains.

## Benchmark Architecture

The benchmark system is implemented as a modular framework integrated into CodeXomics, consisting of the test execution engine, strict automatic evaluator, and reporting system. The execution engine captures request-scoped calls and results across multiple function-calling rounds. The automatic evaluator assesses retrieval coverage, exact tool sequence, argument correctness, registered JSON Schema validity, and execution success. The reporting system aggregates these results without treating natural-language claims as execution evidence.

## Test Suite Design

The production tool-calling evaluation covered here contains 172 cases: 143 Automatic Simple tests and 29 Automatic Complex tests. The simple suite targets individual genomic operations such as gene search, sequence retrieval, and navigation. The complex suite covers multi-step workflows and validates every required step in order. Manual suites are outside this evaluation and training-data boundary.

## Test Execution Protocol

For each case, the system establishes a request-scoped execution context, applies the configured timeout, retrieves at most 24 high-recall candidate tools in benchmark mode, and sends their strict JSON Schemas through the provider's native function-calling protocol. Benchmark requests use temperature 0, disable provider fallback and streaming, and retain the configured multi-round execution limit. Logs remain available for diagnosis, but only the current request's structured calls and execution results are admissible scoring evidence.

## Multi-Round Tool Detection

A request may contain several function-calling rounds. `ChatManager` records each submitted call, its arguments, round, and execution result in request-local execution data. The evaluator consumes that structured record directly. Console logs and final-answer text may help debugging, but cannot create or upgrade a score.

## Evaluation Methodology

An automatic case passes only when all of the following hold:

1. The current request produced an authoritative structured tool call.
2. The tool name or explicitly declared alternative matches.
3. Every expected concrete argument matches; omitted schema defaults remain valid.
4. Every call satisfies the current registered JSON Schema.
5. Every expected call completed successfully, except tests explicitly marked call-only.
6. Complex workflows contain every expected step in the required order and no unexpected calls; tools explicitly marked order-insensitive may move.

Text mentions, inferred calls, stale tracker entries, and debug-log matches earn no credit. Failed cases may receive diagnostic partial scores, but the pass flag remains strict.

## Scoring and Statistical Analysis

Diagnostic partial scores never determine the pass flag. Native-contract diagnostics weight expected tool coverage at 45%, arguments at 35%, and Schema validity at 20%. Real-execution diagnostics weight tool coverage at 35%, arguments at 25%, Schema validity at 15%, observed execution at 10%, and successful execution at 15%. A test only passes when every strict condition for its assessment tier succeeds. Unexpected calls cannot earn bonuses.

Aggregate performance metrics are calculated at the suite and overall levels. Strict accuracy is the percentage of tests whose pass flag is true; it is not a threshold over partial score. Average partial score remains a diagnostic measure and must be reported separately from strict accuracy. Contract-only and real-execution results are separate assessment tiers and must not be combined into one accuracy figure.

## Quality Control and Validation

To ensure benchmark reliability, we implemented multiple quality control measures throughout the testing process. Each test execution is validated for completion status, checking that the LLM response was received within the timeout period and that all expected execution phases were reached. The system automatically detects and flags anomalous results such as tests receiving zero points when execution data indicates successful tool usage, triggering manual review of the evaluation logic. Inter-rater reliability for manual tests is established through independent scoring by two domain experts, with disagreements resolved through consensus discussion.

The benchmark framework underwent extensive validation using known-good test cases where expected outcomes were predetermined through manual analysis. We verified that the tool detection mechanism correctly identifies tools across all three rounds, that the evaluation priority system appropriately weighs different evidence types, and that the scoring algorithm produces consistent results across repeated executions. Edge cases such as malformed LLM responses, timeout conditions, and partial task completion were specifically tested to ensure robust error handling and appropriate score attribution.

## User Interface and Visualization

The benchmark interface provides real-time visualization of test execution and results through an interactive dashboard. During test execution, the interface displays detailed progress information including the current test name, round-by-round function calls with color-coded tool badges, and execution timing metrics. Completed tests are presented with expandable detail panels showing the LLM's response, detected tool calls, evaluation rationale, and awarded scores. Summary statistics are visualized through bar charts comparing performance across test categories and time-series plots showing score distributions.

A particularly innovative feature of the interface is the round-by-round tool visualization, which displays each function calling round as an expandable card showing the round number, timestamp, and all tools invoked during that round. Tools are rendered as green badges for successful execution or yellow warning indicators when no tools were detected, providing immediate visual feedback on the LLM's function calling behavior throughout the multi-round interaction process. This granular visualization enables researchers to diagnose specific failure modes and understand how LLMs distribute computational tasks across multiple reasoning iterations.

## Reproducibility and Data Management

Automatic benchmark definitions are JavaScript objects in `src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js` and `AutomaticComplexSuite.js`. Tool contracts are versioned in `tools_registry/`, and the generated registry hash is recorded with dataset and prompt metadata. Each execution package includes the instruction, selected-tool set, structured calls, execution summaries, strict evaluation details, and timing information.

The benchmark framework supports both automated batch execution and interactive single-test modes, accommodating different research workflows. Automated execution processes entire test suites sequentially with configurable delays between tests to prevent resource contention, while interactive mode allows researchers to execute individual tests with detailed real-time logging for debugging and analysis purposes. All execution modes produce standardized output formats compatible with downstream statistical analysis tools and data visualization platforms.

## Ethical Considerations

The benchmark framework was designed with consideration for responsible AI evaluation practices. Test instructions avoid potentially harmful scenarios and focus exclusively on legitimate genomic analysis tasks. All benchmark data and results are retained locally without transmission to external services, protecting any proprietary genomic information that may be involved in testing. The framework includes safeguards against infinite retry loops and excessive resource consumption, with hard limits on execution time and API call frequency to ensure responsible use of computational resources.
