import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { archiveDgrTaskResult, artifactRoot, readDgrArtifact } = require('../../src/main/dgr-artifact-storage.js');

const createTarget = (overrides = {}) => ({
  workspaceId: 'workspace-ecoli-k12',
  genomeId: 'NC_000913.3',
  annotationRevision: 7,
  featureId: 'feature-b4024',
  featureHash: '8d95c4a3583a7f2e',
  chromosome: 'NC_000913.3',
  featureType: 'CDS',
  locusTag: 'b4024',
  geneSymbol: 'lysC',
  proteinId: 'NP_418448.1',
  assemblyAccession: 'GCF_000005845.2',
  ...overrides,
});

const createCurrentAnnotation = (overrides = {}) => ({
  product: 'hypothetical protein',
  EC_number: [],
  go_terms: [],
  ko: [],
  pathway: [],
  db_xref: ['UniProtKB:P08660'],
  ...overrides,
});

const createCompletedTask = (target, overrides = {}) => ({
  id: 'task-lysC-001',
  status: 'completed',
  parameters: {
    target: { ...target },
    correlationId: 'workflow-001',
    currentAnnotation: createCurrentAnnotation(),
  },
  result: {
    title: 'Deep Gene Research: E. coli lysC',
    report: {
      title: 'lysC encodes lysine-sensitive aspartokinase III',
      markdown: '# lysC\n\nEvidence-backed report.',
    },
    sources: [
      {
        id: 'pmid:123',
        database: 'pubmed',
        provenance: { provider: 'pubmed', recordId: '123456' },
        structuredData: {
          targetRelevance: { accepted: true, directness: 'direct' },
          literatureReferences: [
            {
              pmid: '123456',
              doi: '10.1000/lysc.1',
              abstract: 'The Escherichia coli lysC target has experimentally supported regulation.',
            },
          ],
        },
      },
      {
        id: 'pmid:456',
        database: 'pubmed',
        structuredData: { targetRelevance: { directness: 'gene_linked_context' } },
      },
      { id: 'uniprot:P08660', database: 'uniprot' },
    ],
    metadata: {
      confidence: 0.96,
      searchDiagnostics: { uniqueSourceCount: 42 },
    },
    annotationProposal: {
      target: { ...target },
      summary: 'Refine lysC product and catalytic activity.',
      operations: [],
      evidenceManifest: {
        sourceRecords: [
          {
            id: 'evidence-pubmed-123456',
            database: 'pubmed',
            supporting: false,
            identifiers: [
              { scheme: 'pmid', value: '123456' },
              { scheme: 'doi', value: '10.1000/lysc.1' },
            ],
            sourceBinding: {
              schema: 'dgr.evidence-source-binding.v1',
              sourceCollection: 'sources',
              selector: {
                database: 'pubmed',
                identifier: { scheme: 'pmid', value: '123456' },
              },
              content: {
                relativeJsonPointer: '/structuredData/literatureReferences/0/abstract',
                canonicalization: 'dgr.pubmed-abstract.v1',
                sha256: crypto
                  .createHash('sha256')
                  .update('The Escherichia coli lysC target has experimentally supported regulation.')
                  .digest('hex'),
                hashEncoding: 'utf8',
                length: 'The Escherichia coli lysC target has experimentally supported regulation.'.length,
                lengthEncoding: 'utf16_code_units',
              },
            },
          },
        ],
      },
      researchSummary: {
        facts: [
          {
            id: 'fact-literature-1',
            evidenceLevel: 'target_literature',
            evidenceIds: ['evidence-pubmed-123456'],
            statement: 'The Escherichia coli lysC target has experimentally supported regulation.',
            citation: {
              id: '123456',
              doi: '10.1000/lysc.1',
              url: 'https://pubmed.ncbi.nlm.nih.gov/123456/',
            },
            literatureBasis: {
              kind: 'pubmed_abstract_span',
              evidenceId: 'evidence-pubmed-123456',
              pmid: '123456',
              doi: '10.1000/lysc.1',
              excerpt: 'The Escherichia coli lysC target has experimentally supported regulation.',
              excerptSha256: crypto
                .createHash('sha256')
                .update('The Escherichia coli lysC target has experimentally supported regulation.')
                .digest('hex'),
              hashEncoding: 'utf8',
              excerptStart: 0,
              excerptEnd: 'The Escherichia coli lysC target has experimentally supported regulation.'.length,
              abstractSha256: crypto
                .createHash('sha256')
                .update('The Escherichia coli lysC target has experimentally supported regulation.')
                .digest('hex'),
              abstractLength: 'The Escherichia coli lysC target has experimentally supported regulation.'.length,
              canonicalization: 'dgr.pubmed-abstract.v1',
              offsetEncoding: 'utf16_code_units',
            },
          },
          { evidenceLevel: 'authoritative_database' },
        ],
      },
    },
  },
  ...overrides,
});

const createMcpResponse = task => ({
  ok: true,
  status: 200,
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'response-1',
    result: {
      content: [{ type: 'text', text: JSON.stringify(task) }],
    },
  }),
});

const addFullTextEvidence = task => {
  const text = 'Methods and background. The Escherichia coli lysC target is inhibited by lysine in vivo. Discussion.';
  const excerpt = 'The Escherichia coli lysC target is inhibited by lysine in vivo.';
  const excerptStart = text.indexOf(excerpt);
  const documentSha256 = crypto.createHash('sha256').update('original-pdf-bytes').digest('hex');
  const textSha256 = crypto.createHash('sha256').update(text).digest('hex');
  const excerptSha256 = crypto.createHash('sha256').update(excerpt).digest('hex');
  task.result.sources.push({
    id: `user-document:${documentSha256}`,
    sourceId: `sha256:${documentSha256}`,
    database: 'user_document',
    pmid: '7654321',
    doi: '10.1000/lysc.fulltext',
    evidenceRole: 'reference',
    structuredData: {
      targetRelevance: { accepted: true, directness: 'direct' },
      literatureReferences: [{ pmid: '7654321', doi: '10.1000/lysc.fulltext' }],
    },
    fullText: {
      schema: 'dgr.full-text-document.v1',
      canonicalization: 'dgr.full-text.v1',
      offsetEncoding: 'utf16_code_units',
      origin: 'user_upload',
      name: 'lysC-study.pdf',
      documentSha256,
      textSha256,
      textLength: text.length,
      text,
      identifiers: { pmid: '7654321', doi: '10.1000/lysc.fulltext' },
    },
  });
  task.result.annotationProposal.evidenceManifest.sourceRecords.push({
    id: 'evidence-fulltext-7654321',
    database: 'user_document',
    supporting: false,
    identifiers: [
      { scheme: 'pmid', value: '7654321' },
      { scheme: 'doi', value: '10.1000/lysc.fulltext' },
    ],
    sourceBinding: {
      schema: 'dgr.evidence-source-binding.v1',
      sourceCollection: 'sources',
      selector: { database: 'user_document', identifier: { scheme: 'pmid', value: '7654321' } },
      content: {
        relativeJsonPointer: '/fullText/text',
        canonicalization: 'dgr.full-text.v1',
        sha256: textSha256,
        hashEncoding: 'utf8',
        length: text.length,
        lengthEncoding: 'utf16_code_units',
      },
    },
  });
  task.result.annotationProposal.researchSummary.facts.push({
    id: 'fact-fulltext-1',
    evidenceLevel: 'target_literature',
    evidenceIds: ['evidence-fulltext-7654321'],
    statement: excerpt,
    citation: {
      id: '7654321',
      doi: '10.1000/lysc.fulltext',
      url: 'https://pubmed.ncbi.nlm.nih.gov/7654321/',
    },
    literatureBasis: {
      kind: 'full_text_span',
      evidenceId: 'evidence-fulltext-7654321',
      pmid: '7654321',
      doi: '10.1000/lysc.fulltext',
      documentSha256,
      sourceOrigin: 'user_upload',
      excerpt,
      excerptSha256,
      hashEncoding: 'utf8',
      excerptStart,
      excerptEnd: excerptStart + excerpt.length,
      textSha256,
      textLength: text.length,
      pageNumber: 1,
      canonicalization: 'dgr.full-text.v1',
      offsetEncoding: 'utf16_code_units',
    },
  });
  return { text, excerpt, documentSha256 };
};

describe('DGR artifact storage', () => {
  let userDataPath;

  beforeEach(async () => {
    userDataPath = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codexomics-dgr-artifact-'));
  });

  afterEach(async () => {
    await fs.promises.rm(userDataPath, { recursive: true, force: true });
  });

  it('archives and reads a completed report bound to the exact CDS target', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const proxyRequest = vi.fn().mockResolvedValue(createMcpResponse(task));

    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      correlationId: 'workflow-001',
      currentAnnotation: createCurrentAnnotation(),
      requireCurrentAnnotation: true,
      proxyRequest,
    });

    expect(proxyRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 120000,
        body: expect.objectContaining({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'get-task-status',
            arguments: { taskId: task.id, resultMode: 'full' },
          },
        }),
      })
    );
    expect(descriptor).toMatchObject({
      taskId: task.id,
      correlationId: 'workflow-001',
      target,
      summary: {
        title: task.result.title,
        sourceCount: 42,
        confidence: 0.96,
        literatureCount: 2,
        directLiteratureCount: 1,
        geneLinkedContextCount: 1,
        citationBoundFactCount: 1,
      },
      proposalSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      citationValidation: {
        schema: 'codexomics.dgr-citation-validation.v1',
        verified: true,
        factCount: 1,
        pubMedSourceCount: 1,
        verifiedPubMedSourceCount: 1,
      },
      currentAnnotationValidation: {
        schema: 'codexomics.dgr-current-annotation-validation.v1',
        verified: true,
        required: true,
        snapshotSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        targetFeatureHash: target.featureHash,
      },
    });
    expect(descriptor.storedPath.startsWith(`${artifactRoot(userDataPath)}${path.sep}`)).toBe(true);
    expect(descriptor.fileName).toMatch(/^DGR_task-lysC-001_[a-f0-9]{12}\.json$/);
    expect(descriptor.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(descriptor.size).toBeGreaterThan(0);

    const stats = await fs.promises.stat(descriptor.storedPath);
    expect(stats.mode & 0o777).toBe(0o600);
    expect(stats.size).toBe(descriptor.size);

    const opened = await readDgrArtifact({
      userDataPath,
      storedPath: descriptor.storedPath,
      expectedSha256: descriptor.sha256,
    });
    expect(opened).toMatchObject({
      sha256: descriptor.sha256,
      size: descriptor.size,
      fileName: descriptor.fileName,
    });
    expect(JSON.parse(opened.content)).toEqual(task);
  });

  it('accepts a valid historical five-digit PMID throughout report archival', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const pmid = '28751';
    const source = task.result.sources[0];
    source.provenance.recordId = pmid;
    source.structuredData.literatureReferences[0].pmid = pmid;
    const record = task.result.annotationProposal.evidenceManifest.sourceRecords[0];
    record.identifiers.find(identifier => identifier.scheme === 'pmid').value = pmid;
    record.sourceBinding.selector.identifier.value = pmid;
    const fact = task.result.annotationProposal.researchSummary.facts[0];
    fact.citation.id = pmid;
    fact.citation.url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    fact.literatureBasis.pmid = pmid;

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        currentAnnotation: createCurrentAnnotation(),
        requireCurrentAnnotation: true,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).resolves.toMatchObject({ citationValidation: { verified: true, verifiedPubMedSourceCount: 1 } });
  });

  it('archives exact full-text spans and reports verified full-text coverage', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const fullText = addFullTextEvidence(task);

    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });

    expect(descriptor.summary).toMatchObject({ fullTextSourceCount: 1, fullTextFindingCount: 1 });
    expect(descriptor.citationValidation).toMatchObject({
      verified: true,
      factCount: 2,
      fullTextSourceCount: 1,
      verifiedFullTextSourceCount: 1,
    });

    task.result.annotationProposal.researchSummary.facts[2].literatureBasis.excerptStart += 1;
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/full-text offsets do not match/);
    expect(fullText.documentSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('accepts full-text spans acquired through DGR provider waterfall origins', async () => {
    // DGR's provider waterfall yields BioC (PubTator), TEI (OpenAlex), PDF
    // (OA copies), and snippet (Asta) documents in addition to PMC XML and
    // user uploads; all share the same hash/offset verification contract.
    for (const origin of ['bioc', 'tei', 'pdf', 'snippet']) {
      const target = createTarget();
      const task = createCompletedTask(target);
      addFullTextEvidence(task);
      task.result.sources[task.result.sources.length - 1].fullText.origin = origin;
      const facts = task.result.annotationProposal.researchSummary.facts;
      facts[facts.length - 1].literatureBasis.sourceOrigin = origin;

      const descriptor = await archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      });

      expect(descriptor.citationValidation).toMatchObject({
        verified: true,
        verifiedFullTextSourceCount: 1,
      });
    }
  });

  it('requires the DGR task snapshot when external archival requests live current-annotation binding', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    delete task.parameters.currentAnnotation;

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        currentAnnotation: createCurrentAnnotation(),
        requireCurrentAnnotation: true,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/missing the required currentAnnotation snapshot/);
  });

  it('accepts supporting PubMed evidence only when its fact is included in the DGR curation note', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    task.result.annotationProposal.evidenceManifest.sourceRecords[0].supporting = true;

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/note-consistent supporting status/);

    task.result.annotationProposal.curationNote = {
      schema: 'dgr.curation-note.v1',
      segments: [{ factIds: ['fact-literature-1'], evidenceIds: ['evidence-pubmed-123456'] }],
    };
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).resolves.toMatchObject({
      citationValidation: { verified: true, factCount: 1 },
    });
  });

  it('rejects a caller-supplied DGR snapshot that differs from the live CDS qualifiers', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    task.parameters.currentAnnotation.product = 'hypothetical protein';

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        currentAnnotation: createCurrentAnnotation({ product: 'Lysine-sensitive aspartokinase 3' }),
        requireCurrentAnnotation: true,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/does not match the live CodeXomics CDS qualifier snapshot/);
  });

  it('reuses an identical content-addressed artifact instead of rewriting it', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const proxyRequest = vi.fn().mockResolvedValue(createMcpResponse(task));
    const request = {
      userDataPath,
      taskId: task.id,
      target,
      correlationId: 'workflow-001',
      proxyRequest,
    };

    const first = await archiveDgrTaskResult(request);
    await fs.promises.chmod(first.storedPath, 0o400);
    const second = await archiveDgrTaskResult(request);

    expect(second.storedPath).toBe(first.storedPath);
    expect(second.fileName).toBe(first.fileName);
    expect(second.sha256).toBe(first.sha256);
    expect(proxyRequest).toHaveBeenCalledTimes(2);
    expect((await fs.promises.stat(first.storedPath)).mode & 0o777).toBe(0o400);
  });

  it('rejects a completed task whose required target identity does not match', async () => {
    const target = createTarget();
    const mismatchedTask = createCompletedTask(target);
    mismatchedTask.parameters.target.featureId = 'feature-b9999';

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: mismatchedTask.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(mismatchedTask)),
      })
    ).rejects.toThrow(/featureId does not match the bound annotation target/);
    await expect(fs.promises.stat(artifactRoot(userDataPath))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects a fabricated literature excerpt before writing the report artifact', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    task.result.annotationProposal.researchSummary.facts[0].literatureBasis.excerpt =
      'This fabricated claim is not present in the archived abstract.';
    task.result.annotationProposal.researchSummary.facts[0].statement =
      'This fabricated claim is not present in the archived abstract.';
    task.result.annotationProposal.researchSummary.facts[0].literatureBasis.excerptSha256 = crypto
      .createHash('sha256')
      .update('This fabricated claim is not present in the archived abstract.')
      .digest('hex');

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/excerpt is absent from the archived PubMed abstract/);
    await expect(fs.promises.stat(artifactRoot(userDataPath))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an unauthenticated prefix added to an otherwise valid literature excerpt', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    task.result.annotationProposal.researchSummary.facts[0].statement = `Fabricated context. ${task.result.annotationProposal.researchSummary.facts[0].statement}`;
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/statement does not equal its authenticated excerpt/);
  });

  it('rejects a completed task from a different research workflow correlation', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        correlationId: 'different-workflow',
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/correlationId does not match/);
  });

  it('archives supported non-CDS gene annotation targets', async () => {
    const target = createTarget({ featureType: 'tRNA', proteinId: null });
    const task = createCompletedTask(target);
    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });
    expect(descriptor.target.featureType).toBe('tRNA');
  });

  it('rejects unsupported annotation targets before making a DGR request', async () => {
    const proxyRequest = vi.fn();

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: 'task-exon-001',
        target: createTarget({ featureType: 'exon' }),
        proxyRequest,
      })
    ).rejects.toThrow(/does not support feature type/);
    expect(proxyRequest).not.toHaveBeenCalled();
  });

  it('detects content tampering before returning an archived report', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });
    await fs.promises.appendFile(descriptor.storedPath, '\n{"tampered":true}\n');

    await expect(
      readDgrArtifact({
        userDataPath,
        storedPath: descriptor.storedPath,
        expectedSha256: descriptor.sha256,
      })
    ).rejects.toThrow(/integrity verification failed/);
  });

  it('rejects lexical traversal and symlink escapes from the dedicated artifact root', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });
    const outsidePath = path.join(userDataPath, 'outside.json');
    const outsideContent = '{"outside":true}\n';
    const outsideHash = crypto.createHash('sha256').update(outsideContent).digest('hex');
    await fs.promises.writeFile(outsidePath, outsideContent);

    await expect(
      readDgrArtifact({
        userDataPath,
        storedPath: path.join(artifactRoot(userDataPath), '..', '..', 'outside.json'),
        expectedSha256: outsideHash,
      })
    ).rejects.toThrow(/only open archived DGR JSON artifacts/);

    const symlinkPath = path.join(path.dirname(descriptor.storedPath), 'escaped.json');
    await fs.promises.symlink(outsidePath, symlinkPath);
    await expect(
      readDgrArtifact({
        userDataPath,
        storedPath: symlinkPath,
        expectedSha256: outsideHash,
      })
    ).rejects.toThrow(/resolves outside its storage root/);
  });

  it('refuses to archive through a symbolic-link artifact root', async () => {
    const root = artifactRoot(userDataPath);
    const outsideDirectory = path.join(userDataPath, 'outside-root');
    await fs.promises.mkdir(path.dirname(root), { recursive: true });
    await fs.promises.mkdir(outsideDirectory);
    await fs.promises.symlink(outsideDirectory, root);
    const target = createTarget();
    const task = createCompletedTask(target);

    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: task.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
      })
    ).rejects.toThrow(/root cannot be a symbolic link/);
    const outsideFiles = await fs.promises.readdir(outsideDirectory, { recursive: true });
    expect(outsideFiles.some(fileName => String(fileName).endsWith('.json'))).toBe(false);
  });

  it.each([
    {
      name: 'an unsuccessful DGR response',
      response: { ok: false, status: 502, body: '' },
      expected: /DGR returned 502/,
    },
    {
      name: 'malformed JSON',
      response: { ok: true, status: 200, body: '{not-json' },
      expected: /JSON/,
    },
    {
      name: 'an MCP result without structured text',
      response: {
        ok: true,
        status: 200,
        body: JSON.stringify({ result: { content: [{ type: 'image', data: 'ignored' }] } }),
      },
      expected: /did not contain structured text/,
    },
  ])('rejects $name while archiving', async ({ response, expected }) => {
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: 'task-lysC-001',
        target: createTarget(),
        proxyRequest: vi.fn().mockResolvedValue(response),
      })
    ).rejects.toThrow(expected);
  });

  it('rejects a different or incomplete task returned by DGR', async () => {
    const target = createTarget();
    const wrongTask = createCompletedTask(target, { id: 'task-other-002' });
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: 'task-lysC-001',
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(wrongTask)),
      })
    ).rejects.toThrow(/returned a different task/);

    const incompleteTask = createCompletedTask(target, { status: 'processing', result: null });
    await expect(
      archiveDgrTaskResult({
        userDataPath,
        taskId: incompleteTask.id,
        target,
        proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(incompleteTask)),
      })
    ).rejects.toThrow(/is not complete and cannot be archived/);
  });
  it('carries literatureCoverage, llmSynthesis, and annotationNote into the archived summary', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    task.result.metadata.searchDiagnostics = {
      ...task.result.metadata.searchDiagnostics,
      literatureCoverage: {
        literatureBudget: 300,
        pubmedTotalMatchCount: 412,
        retainedAbstractCount: 300,
        linkedBibliographyRequested: 212,
        linkedBibliographyRetrieved: 212,
        linkedBibliographyComplete: true,
      },
    };
    task.result.metadata.llmSynthesis = {
      supplementalQueryCount: 3,
      literatureLearningBatches: 12,
      synthesizedReport: true,
    };
    task.result.annotationNote = {
      schema: 'dgr.curation-note.v1',
      text: 'lysC encodes lysine-sensitive aspartokinase III (PMID:123456).',
      textSha256: 'n'.repeat(64),
      segments: [],
      factIds: [],
      evidenceIds: [],
      coverage: { availableFactCount: 3, includedFactCount: 1, includedCategories: ['function'], omittedFactIds: [] },
    };

    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });

    expect(descriptor.summary.literatureCoverage).toMatchObject({
      literatureBudget: 300,
      pubmedTotalMatchCount: 412,
      linkedBibliographyComplete: true,
    });
    expect(descriptor.summary.llmSynthesis).toMatchObject({ synthesizedReport: true, literatureLearningBatches: 12 });
    expect(descriptor.summary.annotationNote).toMatchObject({
      schema: 'dgr.curation-note.v1',
      text: expect.stringContaining('PMID:123456'),
    });
  });
  it('prefers the canonical literatureMetrics count over directness-derived legacy counting', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    // Six direct papers visible to the legacy counter, but the canonical
    // metrics report the complete retained bibliography (38 papers).
    task.result.metadata.literatureMetrics = {
      totalPapers: 38,
      pubmedPapers: 36,
      directPapers: 6,
      geneLinkedPapers: 30,
      preprintPapers: 2,
      userDocumentPapers: 0,
    };
    task.result.sources.push(
      { id: 'ppr:1', database: 'europepmc_preprints', url: 'https://doi.org/10.1101/example.1' },
      { id: 'ppr:2', database: 'europepmc_preprints', url: 'https://doi.org/10.1101/example.2' }
    );

    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });

    expect(descriptor.summary.literatureCount).toBe(38);
    expect(descriptor.summary.literatureMetrics).toMatchObject({
      totalPapers: 38,
      directPapers: 6,
      preprintPapers: 2,
    });
  });

  it('counts preprints and user documents in the legacy fallback literature count', async () => {
    const target = createTarget();
    const task = createCompletedTask(target);
    delete task.result.metadata.literatureMetrics;
    task.result.sources.push(
      { id: 'ppr:1', database: 'europepmc_preprints', url: 'https://doi.org/10.1101/example.1' },
      { id: 'pdf:1', database: 'user_document', url: 'urn:sha256:aa', pmid: '12345678' }
    );

    const descriptor = await archiveDgrTaskResult({
      userDataPath,
      taskId: task.id,
      target,
      proxyRequest: vi.fn().mockResolvedValue(createMcpResponse(task)),
    });

    // 2 pubmed sources + 1 preprint + 1 user document.
    expect(descriptor.summary.literatureCount).toBe(4);
  });
});
