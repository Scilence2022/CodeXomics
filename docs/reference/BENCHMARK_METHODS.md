# Methods: LLM Function Calling Benchmark Framework

## Overview

We developed a comprehensive benchmark framework to systematically evaluate the function calling capabilities of Large Language Models (LLMs) in the context of genomic data analysis. The framework was designed to assess both the accuracy of tool selection and the correctness of parameter extraction across multiple interaction rounds, providing quantitative metrics for LLM performance in specialized scientific domains.

## Benchmark Architecture

The in-app harness captures tool calls and results across the current request's function-calling rounds. The automatic evaluator checks tool coverage, arguments, JSON Schema validity, and observed execution. It also records retrieval and sequence diagnostics. The report uses structured calls and results as execution evidence.

## Test Suite Design

The current source defines 143 Automatic Simple cases and 29 Automatic Complex cases. The simple suite covers operations such as gene search, sequence retrieval, and navigation. The complex suite covers multi-step workflows. Manual cases use a separate human-scored workflow. [Running tests](../user-guides/USER_GUIDE.md#benchmark-testing)

## Test Execution Protocol

For each case, the system opens a real ChatBox conversation (`startConversation()`, exactly as a typed message does), applies the configured timeout, sends only the current instruction (context mode "current message only"), and passes the selected tools' strict JSON Schemas through the provider's native function-calling protocol. Opening the conversation is what makes a timed-out test abortable, clears any abort left by an earlier chat, and locks the ChatBox input so a user message cannot start a second loop on top of the test. Provider fallback is always disabled, so a scored answer comes from the model the record names; every other request setting depends on the harness mode (below). Logs remain available for diagnosis, but only the current request's structured calls and execution results are admissible scoring evidence.

## In-App Versus Offline Harnesses

Two harnesses produce numbers. The **in-app** harness (`LLMBenchmarkFramework`) drives the shipped `ChatManager` round loop. It also runs in one of two modes, chosen in the Benchmark panel ("Harness Mode") or with `start_benchmark`'s `harness_mode`, and recorded in `results.harness` and in every interaction record:

- **`production-parity`** (default). The test goes through the same pipeline and the user's own settings: ChatBox temperature, streaming, tool-selection limit, Smart Executor and agent routing. The round loop ends on its own, so over-completion is scored as it happened. These are the numbers that reflect what a ChatBox user gets.
- **`oracle-assisted`**. The legacy controlled run: the test oracle stops the round loop as soon as every expected call has executed, temperature is pinned to 0, streaming is off, exactly 24 candidate tools are advertised, and Smart Executor and agent routing are disabled.

CSV exports include the run ID, harness mode, provider, and model. The HTML report displays the harness mode. Historical results without a recorded mode are labeled unknown. In-app JSON interaction records include per-attempt provider evidence
with the resolved model, stream outcome, request duration, temperature, output token limit, serialized byte count, and tool names.
The evidence entries contain counts and request settings, with prompts and credentials excluded.

`results.harness.effective_request` lists the temperature, streaming, tool limit and routing that were actually in force. Skills stay out of every benchmark prompt in both modes (see `Agents.md`).

The **offline CLI** harnesses (`scripts/ollama-tool-benchmark.js`, `scripts/deepseek-tool-benchmark.js`) re-implement a minimal loop against synthetic contract tool results, which keeps a sweep independent of NCBI latency and local subprocesses.

The offline harnesses run in one of two modes, recorded as `harness_mode` in every report and record:

- **`oracle-assisted`** (default). When a turn ends without covering every expected call, the harness injects a nudge that states how many of the expected steps remain, and the round budget is derived from the expected call count (`expected_steps + 4`). Both facts come from the test oracle. The shipped application has neither: it does not know how many steps a request contains. These runs measure how well a model _can_ be steered, not what a user experiences.
- **`production-parity`** (`--production-parity`). The step-count disclosure is removed, the round budget is fixed at the shipped default of 10 rounds, and tool results carry the same continuation guidance the application appends. These runs are the ones comparable to in-app behaviour.

`harness_assistance` in each report states explicitly whether the expected step count was disclosed and which round budget applied. Accuracy figures from the two modes measure different things and must never be pooled or compared directly.

## Multi-Round Tool Detection

A request may contain several function-calling rounds. `ChatManager` records each submitted call, its arguments, round, and execution result in request-local execution data. The evaluator consumes that structured record directly. Console logs and final-answer text may help debugging, but cannot create or upgrade a score.

## Evaluation Methodology

The in-app benchmark scores with the **task-completion-execution** tier: it
asks whether the observed plan completed the task, not whether it matched one
hand-written oracle byte for byte. An automatic case passes only when all of
the following hold:

1. The current request produced an authoritative structured tool call.
2. Every expected capability is covered by a matching or explicitly equivalent
   tool. This tier matches required calls across the request without requiring
   the oracle's order. A repeated check still needs a distinct call for each
   expected occurrence.
3. Expected concrete arguments match an accepted parameter shape. An omitted
   argument satisfies a concrete expectation when the tool's registered default
   supplies the expected value. For example, `navigate_to_position` accepts
   `position` or a start-only call for a centered jump.
4. Every call satisfies the current registered JSON Schema.
5. Every expected call completed successfully, except tests explicitly marked
   call-only.
6. Extra calls are tolerated when they are read-only, a repeat the case permits,
   or the documented follow-up of a required workflow
   step (for example `execute_actions` after a queued edit, or
   `export_genbank_format` repeating the file `execute_actions` already
   writes). Explicitly showing the Reads track is also allowed after a matching
   successful reads import. Other unexpected state-changing calls still fail.

Text mentions, inferred calls, stale tracker entries, and debug-log matches earn no credit. Failed cases may receive diagnostic partial scores, but the pass flag remains strict.

The **native-function-contract** and **real-tool-execution** diagnostic tiers
check the expected sequence and argument contract more strictly. The offline
audit reports these tiers before the task-completion rescore.

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

## Data Handling

CodeXomics stores benchmark results locally. Model requests follow the selected provider configuration. When a benchmark uses a cloud model, the instruction, conversation messages and tool results included in the request go to that provider. Individual cases can also call external services such as NCBI BLAST.
