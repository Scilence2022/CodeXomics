/** NVIDIA Evo 2 tools; schemas are checked against the built-in YAML registry. */
const TOOLS = {
  evo2_generate: {
    name: 'evo2_generate',
    description:
      'Start DNA generation with NVIDIA arc/evo2-40b. Sends the supplied DNA to NVIDIA and returns a job_id immediately. Poll evo2_get_result until completed. Configure the API key in Options → Evo 2 DNA Generation; never put credentials in tool arguments. Does not edit the genome.',
    inputSchema: {
      type: 'object',
      properties: {
        sequence: {
          type: 'string',
          description:
            'DNA containing A/C/G/T/N or one FASTA record; up to 100,000 bases (CodeXomics limit). Obtain a region with get_sequence first if needed.',
        },
        taxonomy: {
          type: 'string',
          description:
            'Optional taxonomy prefix in NVIDIA format |k__kingdom;p__phylum;c__class;o__organism;g__genus;s__species|.',
        },
        num_tokens: {
          type: 'integer',
          minimum: 1,
          maximum: 1200,
          default: 100,
          description: 'Number of new tokens; CodeXomics limit is 1,200.',
        },
        temperature: {
          type: 'number',
          exclusiveMinimum: 0,
          maximum: 1.3,
          default: 0.7,
          description: 'Sampling temperature; must be greater than zero.',
        },
        top_k: {
          type: 'integer',
          minimum: 0,
          maximum: 6,
          default: 3,
          description: 'Top K; 0 considers all tokens, 1 uses the highest probability token.',
        },
        top_p: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          default: 1,
          description: 'Nucleus sampling threshold; 0 disables top-p sampling.',
        },
        random_seed: {
          type: 'integer',
          minimum: -9007199254740991,
          maximum: 9007199254740991,
          description: 'Optional deterministic seed for development.',
        },
        enable_logits: {
          type: 'boolean',
          default: false,
          description: 'Return logits; use include_logits in evo2_get_result to retrieve the large matrix.',
        },
        enable_sampled_probs: {
          type: 'boolean',
          default: false,
          description: 'Return generated token probabilities.',
        },
        enable_elapsed_ms_per_token: {
          type: 'boolean',
          default: false,
          description: 'Return per-token generation timing.',
        },
      },
      required: ['sequence'],
    },
  },
  evo2_get_result: {
    name: 'evo2_get_result',
    description:
      'Get status or completed DNA for an Evo 2 job in this window. May be called repeatedly; wait next_poll_ms between calls while running. Jobs are in-memory and retained for up to one hour, with at most 10 jobs across windows.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'Job ID returned by evo2_generate.',
        },
        include_logits: {
          type: 'boolean',
          default: false,
          description:
            'Include the full logits matrix when enabled at generation; omitted by default to keep tool results compact.',
        },
      },
      required: ['job_id'],
    },
  },
  evo2_cancel: {
    name: 'evo2_cancel',
    description:
      'Stop waiting for an Evo 2 job in this window. NVIDIA may continue processing a submitted request. Repeated cancellation is safe.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: {
          type: 'string',
          description: 'Job ID returned by evo2_generate.',
        },
      },
      required: ['job_id'],
    },
  },
};

class Evo2Tools {
  constructor(server) {
    this.server = server;
  }
  getTools() {
    return TOOLS;
  }
  async executeClientTool(name, parameters, clientId) {
    return this.server.executeToolOnClient(name, parameters, clientId);
  }
}
module.exports = Evo2Tools;
