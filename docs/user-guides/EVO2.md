# Evo 2 DNA Generation

CodeXomics supports **arc/evo2-40b** through NVIDIA NIM's hosted DNA generation API. Open **Options → Evo 2 DNA Generation** in a genome browser window. Evo 2 has its own sequence interface and does not replace the ChatBox's conversational model.

## Set up and generate

1. Obtain a key from the [NVIDIA Evo 2 model page](https://build.nvidia.com/arc/evo2-40b).
2. Expand **NVIDIA API key**, paste the key, and select **Save key**. Credentials are stored under the app's user-data configuration directory with OS encryption. If encryption is unavailable, saving fails without storing plaintext. Use **Remove key** to delete the saved credential.
3. Paste DNA or one FASTA record, or choose **Use visible region** to copy the current genome viewport on the forward strand. Input supports A, C, G, T and N; whitespace and lower-case bases are normalized.
4. Choose generation parameters and select **Generate DNA**. This sends the supplied DNA and optional taxonomy to NVIDIA. You can close the panel and reopen it while generation runs.
5. Copy the generated sequence or export **FASTA** or **JSON**. Results are separate from the loaded genome; generation does not insert sequence or change annotations.

The API key field is cleared after saving and on close. Configuration queries and AI tool results never return the key. Keep credentials out of ChatBox prompts and tool arguments.

## Parameters

| Parameter           | Default                 | Supported values                                       |
| ------------------- | ----------------------- | ------------------------------------------------------ |
| New tokens          | 100                     | 1–1,200 (CodeXomics limit)                             |
| Temperature         | 0.7                     | Greater than 0, up to 1.3                              |
| Top K               | 3                       | Integer 0–6; 0 considers all tokens                    |
| Top P               | 1                       | 0–1; 0 disables nucleus sampling                       |
| Random seed         | Automatic               | Optional integer for reproducible development requests |
| Token probabilities | On in GUI; off in tools | Per-generated-token probabilities in JSON              |
| Logits              | Off                     | Optional larger matrix included in JSON export         |
| Per-token timing    | Off                     | Optional timing data in JSON                           |

Input is limited to **100,000 bases per request** in CodeXomics. The advanced taxonomy field uses NVIDIA's format `|k__kingdom;p__phylum;c__class;o__organism;g__genus;s__species|`. These application limits bound hosted requests and retained results; they are not a statement of Evo 2's full model context capacity.

## ChatBox and MCP tools

The same tools are available to the in-app assistant and external MCP clients in tools mode. Configure the key in the GUI first. An external caller should retain the same `windowId` for submission, polling and cancellation.

```json
{
  "name": "evo2_generate",
  "arguments": {
    "sequence": "ACTGACTGACTGACTG",
    "num_tokens": 8,
    "top_k": 1,
    "enable_sampled_probs": true
  }
}
```

Submission returns a `job_id` immediately. Query `evo2_get_result` with that ID until `status` becomes `completed`, `failed` or `cancelled`. While running, wait at least `next_poll_ms` between queries. Completed results contain the provider's generated `sequence`, `elapsed_ms` and requested probability/timing data. Logits are summarized by shape unless `include_logits: true` is requested.

Use `evo2_cancel` with the same `job_id` to stop local waiting. NVIDIA may continue processing an already submitted request. Agent mode continues to expose only `codexomics_chat`, `list_genome_windows` and `switch_active_window`.

Only one generation runs per genome window at a time. Jobs stay in memory, with at most ten retained jobs across windows; old completed jobs may be evicted to admit new ones. Completed jobs are cleaned up after an hour when another request is submitted. Closing the owning genome window or restarting the app removes its jobs. Export results you want to keep.

## Troubleshooting

- **401/403:** Re-enter the key and check its access to the hosted model.
- **429:** Wait before trying again; automatic resubmission is disabled to avoid duplicate inference.
- **Timeout:** CodeXomics stops waiting after ten minutes. The provider may still be processing the request.
- **Non-JSON or oversized result:** Reduce the generated token count or disable logits. Binary/ZIP responses and JSON larger than 16 MB are not imported.
- **Job not found:** Use the original window and ID. The job may have been evicted or lost when the window/app closed.

The integration implements the documented 40B **generation** endpoint. It does not claim to implement sequence scoring, variant-effect prediction, or the separate 7B forward-pass endpoint.

API reference: [NVIDIA — Generate DNA sequences](https://docs.api.nvidia.com/nim/reference/arc-evo2-40b-infer).
