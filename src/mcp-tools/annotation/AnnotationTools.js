/**
 * Annotation Tools Module
 * Provides full CRUD operations for genome annotations via MCP.
 * Designed for both interactive (ChatBox) and programmatic (AI agent) access.
 *
 * All tools delegate to the browser client where genome data lives in memory,
 * following the same pattern as NavigationTools, DataTools, etc.
 */

class AnnotationTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      list_annotations: {
        name: 'list_annotations',
        description:
          'List genome annotations in a specified region or chromosome. Supports filtering by feature type (CDS, gene, rRNA, tRNA, etc.). Returns annotation details including locus_tag, gene name, product, position, and strand.',
        inputSchema: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description:
                'Chromosome/replicon name to list annotations from. If omitted, uses the currently selected chromosome.',
            },
            start: {
              type: 'number',
              description: 'Start position to filter annotations (optional). If omitted, lists from the beginning.',
            },
            end: {
              type: 'number',
              description: 'End position to filter annotations (optional). If omitted, lists to the end.',
            },
            type: {
              type: 'string',
              description:
                'Feature type filter (e.g., "CDS", "gene", "rRNA", "tRNA", "misc_feature"). If omitted, returns all types.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of annotations to return (default: 100). Use 0 for no limit.',
              default: 100,
            },
            offset: {
              type: 'number',
              description: 'Number of annotations to skip for pagination (default: 0).',
              default: 0,
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: [],
        },
      },

      assess_annotation_quality: {
        name: 'assess_annotation_quality',
        description:
          'Assess the completeness and curation quality of one resolved gene annotation feature. Returns a deterministic 0-100 quality score, actionable reasons, missing fields, and recommended research focus. When co-located gene and CDS records share an identifier, the CDS is assessed.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Locus tag, gene symbol, protein ID, annotation ID, or stable feature ID.',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome or replicon used to disambiguate the identifier.',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support.',
            },
          },
          required: ['identifier'],
        },
      },

      list_annotation_quality_candidates: {
        name: 'list_annotation_quality_candidates',
        description:
          'Rank gene-associated annotation features for curation. Supports CDS, gene, mRNA, coding and non-coding RNA types; collapses co-located duplicate feature records and always prefers CDS when present at the same locus. Returns deterministic quality scores, reasons, and research-focus recommendations.',
        inputSchema: {
          type: 'object',
          properties: {
            chromosome: {
              type: 'string',
              description: 'Optional chromosome or replicon filter.',
            },
            featureTypes: {
              type: 'array',
              items: { type: 'string' },
              maxItems: 32,
              description:
                'Gene-associated feature types to include. Defaults to CDS, gene, mRNA, tRNA, rRNA, ncRNA, tmRNA, other RNA features, and pseudogene.',
            },
            maximumQualityScore: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              default: 100,
              description: 'Only return features with a quality score at or below this threshold.',
            },
            sortBy: {
              type: 'string',
              enum: ['quality', 'coordinate'],
              default: 'quality',
              description: 'Rank lowest quality first or preserve deterministic coordinate coverage order.',
            },
            researchHistoryPolicy: {
              type: 'string',
              enum: ['include', 'exclude-active', 'exclude-completed', 'exclude-covered'],
              default: 'include',
              description: 'Optionally exclude targets with active or durably archived completed DGR research.',
            },
            researchRefreshDays: {
              type: 'integer',
              minimum: 1,
              maximum: 3650,
              description:
                'With history exclusion, allow completed research older than this many days to become eligible again.',
            },
            limit: {
              type: 'number',
              minimum: 0,
              maximum: 100000,
              default: 100,
              description: 'Maximum results to return; use 0 for all matching candidates.',
            },
            offset: {
              type: 'number',
              minimum: 0,
              default: 0,
              description: 'Number of ranked candidates to skip.',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support.',
            },
          },
          required: [],
        },
      },

      get_annotation: {
        name: 'get_annotation',
        description:
          'Get detailed information about a specific annotation by its locus_tag, gene name, or feature index. Returns all qualifier fields including product, note, db_xref, EC_number, GO terms, etc.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'The locus_tag, gene name, or protein_id of the annotation to retrieve.',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (optional, searches all if omitted).',
            },
            full_details: {
              type: 'boolean',
              description: 'If true, returns the complete raw annotation object. Defaults to false.',
              default: false,
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: ['identifier'],
        },
      },

      update_annotation: {
        name: 'update_annotation',
        description:
          'Legacy compatibility tool. It creates a reviewable annotation ChangeSet and never writes directly; use create_annotation_changeset, request_annotation_approval, and apply_annotation_changeset for the explicit workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'The locus_tag, gene name, or protein_id identifying the annotation to update.',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (optional, searches all if omitted).',
            },
            updates: {
              type: 'object',
              description:
                'Object of fields to update. Keys are qualifier names (e.g., "product", "gene", "note", "EC_number", "db_xref"), values are the new values. Example: {"product": "ATP synthase subunit alpha", "EC_number": "3.6.3.14"}',
            },
            agent: {
              type: 'string',
              description:
                'Identity of the agent making this change (e.g., "openclaw/genome-annotator", "user"). Used for change tracking.',
              default: 'mcp-agent',
            },
            evidence: {
              type: 'array',
              description:
                'Optional list of evidence references supporting this change (e.g., ["UniProt:P0ABB4", "PMID:12345678"]).',
              items: { type: 'string' },
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: ['identifier', 'updates'],
        },
      },

      merge_gene_research_report: {
        name: 'merge_gene_research_report',
        description:
          'Merge a Deep Gene Research report or structured annotation proposal into an existing gene annotation. Conservatively updates product, note, GO terms, EC number, KO/pathway fields, db_xref, and CodeXomics research metadata while recording literature evidence in the annotation change history.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description:
                'The locus_tag, gene name, or protein_id identifying the annotation to update. If omitted, CodeXomics may use the currently selected gene.',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (optional, searches all if omitted).',
            },
            annotationProposal: {
              type: 'object',
              description:
                'Structured proposal from Deep Gene Research. Expected fields include updates, evidence, confidence, summary, reportUrl, detailsUrl, ecNumbers, goTerms, koTerms, pathwayTerms, and dbXrefs.',
            },
            report: {
              type: 'string',
              description:
                'Raw Deep Gene Research markdown/text report. Used to extract summary, citations, EC numbers, GO terms, KO terms, and pathway references when annotationProposal is absent or incomplete.',
            },
            sources: {
              type: 'array',
              description: 'Literature/source objects or strings from Deep Gene Research.',
              items: {},
            },
            reportUrl: {
              type: 'string',
              description: 'Optional downloadable final report URL to store on the annotation.',
            },
            detailsUrl: {
              type: 'string',
              description: 'Optional downloadable workflow/details URL to store on the annotation.',
            },
            dryRun: {
              type: 'boolean',
              description:
                'Deprecated compatibility flag. Research merges always create a reviewable ChangeSet and never apply directly.',
              default: true,
            },
            overwriteProduct: {
              type: 'boolean',
              description:
                'If true, allow product replacement even when the existing product is not a placeholder. Defaults to false.',
              default: false,
            },
            agent: {
              type: 'string',
              description: 'Identity recorded in the annotation change history.',
              default: 'deep-gene-research',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: [],
        },
      },

      resolve_annotation_target: {
        name: 'resolve_annotation_target',
        description:
          'Resolve a gene/locus identifier to an immutable CodeXomics annotation target with featureId, featureHash, and annotation revision. Co-located generic gene and specific feature records are collapsed; CDS is preferred when present, otherwise RNA or transcript features are preferred over gene. Call this before autonomous research.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: { type: 'string', description: 'locus_tag, gene name, protein_id, or feature identifier.' },
            chromosome: { type: 'string', description: 'Required when the identifier is ambiguous across replicons.' },
            clientId: { type: 'string', description: 'Browser client ID for multi-window support.' },
          },
          required: ['identifier'],
        },
      },

      create_annotation_changeset: {
        name: 'create_annotation_changeset',
        description:
          'Validate a structured research proposal and create an immutable, reviewable annotation ChangeSet. This tool never mutates a genome.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Target locus_tag, gene name, protein_id, or feature identifier.',
            },
            chromosome: { type: 'string', description: 'Target chromosome/replicon.' },
            baseRevision: { type: 'number', description: 'Annotation revision returned by resolve_annotation_target.' },
            annotationProposal: {
              type: 'object',
              description: 'Versioned proposal with target, operations or restricted qualifier updates, and evidence.',
            },
            operations: {
              type: 'array',
              description:
                'Explicit ChangeSet operations: addQualifier, replaceQualifier, removeQualifier, addDbxref, or addEvidenceLink.',
              items: { type: 'object' },
            },
            evidence: {
              type: 'array',
              items: { type: 'string' },
              description: 'Evidence IDs or immutable evidence-resource URIs.',
            },
            researchRun: { type: 'string', description: 'DGR research run ID.' },
            manifestHash: { type: 'string', description: 'Hash of the immutable DGR evidence manifest.' },
            idempotencyKey: {
              type: 'string',
              description: 'Stable client-generated key used to prevent duplicate commits.',
            },
            clientId: { type: 'string', description: 'Browser client ID for multi-window support.' },
          },
          required: ['identifier'],
        },
      },

      get_annotation_changeset: {
        name: 'get_annotation_changeset',
        description: 'Get a pending, approved, stale, or committed annotation ChangeSet.',
        inputSchema: {
          type: 'object',
          properties: { changeSetId: { type: 'string' }, clientId: { type: 'string' } },
          required: ['changeSetId'],
        },
      },

      list_annotation_changesets: {
        name: 'list_annotation_changesets',
        description:
          'List lightweight annotation ChangeSet summaries for human review, including target, status, risk, operation fields, evidence count, and a live preview. Use get_annotation_changeset to retrieve one full immutable proposal.',
        inputSchema: {
          type: 'object',
          properties: {
            statuses: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional statuses such as awaiting_approval, approved, committed, rejected, or stale.',
            },
            riskLevels: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional risk filters: low, medium, or high.',
            },
            query: { type: 'string', description: 'Gene, locus tag, chromosome, or ChangeSet ID search text.' },
            limit: { type: 'number', default: 100 },
            offset: { type: 'number', default: 0 },
            clientId: { type: 'string', description: 'Browser client ID for multi-window support.' },
          },
          required: [],
        },
      },

      request_annotation_approval: {
        name: 'request_annotation_approval',
        description:
          'Record a human curator approval for an awaiting-review ChangeSet and return a short-lived commit capability. The proposal creator cannot self-approve.',
        inputSchema: {
          type: 'object',
          properties: {
            changeSetId: { type: 'string' },
            expiresInMinutes: { type: 'number', default: 30 },
            clientId: { type: 'string' },
          },
          required: ['changeSetId'],
        },
      },

      reject_annotation_changeset: {
        name: 'reject_annotation_changeset',
        description:
          'Record a curator rejection for an awaiting-review or approved ChangeSet. Any outstanding approval capability is revoked and the ChangeSet can no longer be committed.',
        inputSchema: {
          type: 'object',
          properties: {
            changeSetId: { type: 'string' },
            reason: { type: 'string' },
            clientId: { type: 'string' },
          },
          required: ['changeSetId'],
        },
      },

      apply_annotation_changeset: {
        name: 'apply_annotation_changeset',
        description:
          'Atomically apply an approved ChangeSet only when its target feature hash and annotation revision still match. Requires the approval capability returned by request_annotation_approval.',
        inputSchema: {
          type: 'object',
          properties: {
            changeSetId: { type: 'string' },
            approvalToken: { type: 'string' },
            clientId: { type: 'string' },
          },
          required: ['changeSetId', 'approvalToken'],
        },
      },

      rollback_annotation_changeset: {
        name: 'rollback_annotation_changeset',
        description:
          'Create a new human-review ChangeSet that reverses a previous committed ChangeSet. Rollback is never applied directly.',
        inputSchema: {
          type: 'object',
          properties: {
            changeSetId: { type: 'string' },
            principal: { type: 'string' },
            clientId: { type: 'string' },
          },
          required: ['changeSetId'],
        },
      },

      get_annotation_audit: {
        name: 'get_annotation_audit',
        description: 'Get the per-genome revisioned annotation ChangeSet audit trail.',
        inputSchema: {
          type: 'object',
          properties: { limit: { type: 'number', default: 100 }, clientId: { type: 'string' } },
          required: [],
        },
      },

      start_annotation_research: {
        name: 'start_annotation_research',
        description:
          'Start a resumable Deep Gene Research run bound to an exact CodeXomics feature target. Organism metadata is taken from the loaded genome when available; otherwise organism is required. It never writes annotations directly.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: { type: 'string' },
            chromosome: { type: 'string' },
            organism: {
              type: 'string',
              description: 'Scientific organism name; required only when the loaded genome lacks organism metadata.',
            },
            geneSymbol: { type: 'string' },
            researchFocus: { type: 'array', items: { type: 'string' } },
            specificAspects: { type: 'array', items: { type: 'string' } },
            userPrompt: { type: 'string' },
            diseaseContext: { type: 'string' },
            experimentalApproach: { type: 'string' },
            language: { type: 'string' },
            maxResult: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
            forceRefresh: {
              type: 'boolean',
              default: false,
              description: 'Bypass the DGR semantic result cache while preserving request idempotency.',
            },
            researchDocumentPaths: {
              type: 'array',
              maxItems: 8,
              items: { type: 'string', maxLength: 4096 },
              description:
                'Explicit absolute user PDF paths. CodeXomics stores them as gene-scoped attachments and gives DGR content-addressed document IDs.',
            },
            researchAttachmentIds: {
              type: 'array',
              maxItems: 8,
              items: { type: 'string', maxLength: 256 },
              description: 'Existing PDF attachment IDs on the resolved gene to prioritize as full-text evidence.',
            },
            repeatPolicy: {
              type: 'string',
              enum: ['allow', 'skip-covered'],
              default: 'allow',
              description:
                'Use skip-covered for automation to resume active work and skip durably archived completed research.',
            },
            researchRefreshDays: {
              type: 'integer',
              minimum: 1,
              maximum: 3650,
              description: 'With skip-covered, rerun completed research after this many days.',
            },
            idempotencyKey: { type: 'string', minLength: 1, maxLength: 256 },
            correlationId: { type: 'string', minLength: 1, maxLength: 256 },
            clientId: { type: 'string' },
          },
          required: ['identifier'],
        },
      },

      archive_annotation_research: {
        name: 'archive_annotation_research',
        description:
          'Archive a completed DGR task as a verified, genome-scoped JSON attachment bound to an exact supported gene annotation target. CodeXomics re-derives the live scientific qualifier snapshot and requires the DGR task currentAnnotation to match. Use this for research started directly through the DGR MCP server before creating a ChangeSet.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', minLength: 1, maxLength: 256 },
            correlationId: { type: 'string', minLength: 1, maxLength: 256 },
            identifier: {
              type: 'string',
              description: 'Target locus_tag, gene name, protein_id, or feature identifier.',
            },
            chromosome: { type: 'string' },
            clientId: { type: 'string' },
          },
          required: ['taskId', 'correlationId', 'identifier'],
        },
      },

      get_annotation_research_workflow: {
        name: 'get_annotation_research_workflow',
        description:
          'Get a resumable internal DGR research workflow. On completion, annotation:propose callers create a reviewable ChangeSet; research-only callers receive the proposal for later materialization.',
        inputSchema: {
          type: 'object',
          properties: { taskId: { type: 'string' }, clientId: { type: 'string' } },
          required: ['taskId'],
        },
      },

      list_annotation_research_history: {
        name: 'list_annotation_research_history',
        description:
          'List durable per-genome DGR research history, including active, archived completed, incomplete archival, failed, and cancelled runs. Use this as the authoritative cross-agent research coverage ledger.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'Optional task ID, feature ID, locus tag, protein ID, or gene-symbol filter.',
            },
            coverageStates: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['active', 'completed', 'completed_unarchived', 'failed', 'cancelled'],
              },
            },
            coveredOnly: { type: 'boolean', default: false },
            latestPerTarget: { type: 'boolean', default: false },
            researchRefreshDays: { type: 'integer', minimum: 1, maximum: 3650 },
            limit: { type: 'integer', minimum: 0, maximum: 2000, default: 100 },
            offset: { type: 'integer', minimum: 0, default: 0 },
            clientId: { type: 'string' },
          },
          required: [],
        },
      },

      cancel_annotation_research: {
        name: 'cancel_annotation_research',
        description: 'Cancel a DGR research workflow while retaining its durable audit record.',
        inputSchema: {
          type: 'object',
          properties: { taskId: { type: 'string' }, clientId: { type: 'string' } },
          required: ['taskId'],
        },
      },

      edit_annotation: {
        name: 'edit_annotation',
        description:
          'Privileged raw structural editing of one existing genome annotation. Requires annotation:structural permission and bypasses the qualifier-only ChangeSet workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            annotationId: {
              type: 'string',
              description: 'Annotation ID, locus_tag, or gene name identifying the feature to edit.',
            },
            updates: {
              type: 'object',
              description:
                'Raw annotation fields to merge, such as start, end, strand, type, phase, source, score, or qualifiers.',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support.',
            },
          },
          required: ['annotationId', 'updates'],
        },
      },

      batch_create_annotations: {
        name: 'batch_create_annotations',
        description:
          'Privileged creation of multiple structural genome annotations on one chromosome. Requires annotation:structural permission and bypasses the qualifier-only ChangeSet workflow.',
        inputSchema: {
          type: 'object',
          properties: {
            annotations: {
              type: 'array',
              description: 'Structural annotations to create.',
              minItems: 1,
              maxItems: 1000,
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: 'Feature type, such as CDS, gene, or rRNA.' },
                  start: { type: 'number', description: 'One-based feature start coordinate.' },
                  end: { type: 'number', description: 'One-based feature end coordinate.' },
                  strand: { type: 'number', description: 'Feature strand, normally 1 or -1.' },
                  qualifiers: { type: 'object', description: 'Raw annotation qualifier map.' },
                },
                required: ['start', 'end'],
              },
            },
            chromosome: {
              type: 'string',
              description: 'Target chromosome or replicon. Defaults to the active chromosome.',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support.',
            },
          },
          required: ['annotations'],
        },
      },

      delete_annotation: {
        name: 'delete_annotation',
        description:
          'Delete a genome annotation by its locus_tag, gene name, or feature index. The deletion is tracked in the change history for audit purposes.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: 'The locus_tag, gene name, or protein_id of the annotation to delete.',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (optional, searches all if omitted).',
            },
            agent: {
              type: 'string',
              description: 'Identity of the agent making this deletion.',
              default: 'mcp-agent',
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: ['identifier'],
        },
      },

      search_annotations: {
        name: 'search_annotations',
        description:
          'Full-text search across all annotation fields (product, gene, note, locus_tag, db_xref, etc.). Useful for finding hypothetical proteins, specific enzymes, or annotations with particular keywords.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search query string. Searches across product, gene, note, locus_tag, and other qualifier fields. Case-insensitive.',
            },
            chromosome: {
              type: 'string',
              description: 'Limit search to a specific chromosome (optional).',
            },
            type: {
              type: 'string',
              description: 'Filter by feature type (e.g., "CDS"). Optional.',
            },
            fields: {
              type: 'array',
              description:
                'Specific qualifier fields to search in (e.g., ["product", "note"]). If omitted, searches all fields.',
              items: { type: 'string' },
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results to return (default: 50).',
              default: 50,
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: ['query'],
        },
      },

      bulk_update_annotations: {
        name: 'bulk_update_annotations',
        description:
          'Update multiple annotations in a single operation. Each update specifies an identifier and the fields to change. All changes are tracked. Useful for batch operations like renaming hypothetical proteins or adding cross-references.',
        inputSchema: {
          type: 'object',
          properties: {
            updates: {
              type: 'array',
              description:
                'Array of update objects. Each object must have "identifier" (locus_tag or gene name) and "updates" (object of field:value pairs). Example: [{"identifier": "gene1", "updates": {"product": "new name"}}, {"identifier": "gene2", "updates": {"note": "updated"}}]',
              items: {
                type: 'object',
                properties: {
                  identifier: {
                    type: 'string',
                    description: 'The locus_tag or gene name of the annotation to update.',
                  },
                  chromosome: {
                    type: 'string',
                    description: 'Chromosome name (optional).',
                  },
                  updates: {
                    type: 'object',
                    description: 'Object of fields to update.',
                  },
                },
                required: ['identifier', 'updates'],
              },
            },
            agent: {
              type: 'string',
              description: 'Identity of the agent making these changes.',
              default: 'mcp-agent',
            },
            evidence: {
              type: 'array',
              description: 'Optional evidence references for all updates in this batch.',
              items: { type: 'string' },
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: ['updates'],
        },
      },

      get_annotation_history: {
        name: 'get_annotation_history',
        description:
          'Retrieve the change history for a specific annotation or the entire genome. Returns all tracked modifications with timestamps, old/new values, and agent identity. Useful for auditing changes made by AI agents.',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description:
                'The locus_tag or gene name to get history for. If omitted, returns history for all annotations.',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of history records to return (default: 50).',
              default: 50,
            },
            clientId: {
              type: 'string',
              description: 'Browser client ID for multi-window support',
            },
          },
          required: [],
        },
      },
    };
  }

  /**
   * All annotation tools delegate to the browser client because genome
   * annotation data lives in-memory on the renderer side (GenomeDataProxy).
   */
  async executeClientTool(toolName, parameters, clientId, executionContext = null) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId, executionContext);
  }
}

module.exports = AnnotationTools;
