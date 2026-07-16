'use strict';
// @ts-check

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAX_DGR_ARTIFACT_BYTES = 16 * 1024 * 1024;
const REQUIRED_TARGET_FIELDS = [
  'workspaceId',
  'genomeId',
  'annotationRevision',
  'featureId',
  'featureHash',
  'chromosome',
];
const CURRENT_ANNOTATION_VALIDATION_SCHEMA = 'codexomics.dgr-current-annotation-validation.v1';
const CURRENT_ANNOTATION_LIMITS = Object.freeze({
  product: { maximumItems: 1, maximumLength: 1024, scalar: true },
  note: { maximumItems: 32, maximumLength: 8192 },
  EC_number: { maximumItems: 64, maximumLength: 64 },
  go_terms: { maximumItems: 256, maximumLength: 64 },
  ko: { maximumItems: 128, maximumLength: 128 },
  pathway: { maximumItems: 256, maximumLength: 256 },
  db_xref: { maximumItems: 512, maximumLength: 512 },
});

function isInside(rootPath, targetPath) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function parseJsonRpcBody(body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('DGR returned an empty response while archiving the report');
  let envelope;
  if (text.startsWith('event:') || text.includes('\ndata:')) {
    const dataLines = text
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trim())
      .filter(Boolean);
    for (let index = dataLines.length - 1; index >= 0; index -= 1) {
      try {
        envelope = JSON.parse(dataLines[index]);
        break;
      } catch (_error) {
        // Continue to an earlier complete SSE event.
      }
    }
    if (!envelope) throw new Error('DGR returned invalid SSE JSON while archiving the report');
  } else {
    envelope = JSON.parse(text);
  }
  if (envelope.error) throw new Error(envelope.error.message || 'DGR report archival request failed');
  const candidate = envelope.result ?? envelope;
  if (Array.isArray(candidate?.content)) {
    const structured = candidate.content.find(item => item?.type === 'text' && typeof item.text === 'string');
    if (!structured) throw new Error('DGR report archival response did not contain structured text');
    return JSON.parse(structured.text);
  }
  return candidate;
}

function assertSafeTaskId(taskId) {
  const value = String(taskId || '').trim();
  if (!value || value.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw new Error('DGR taskId is invalid for report archival');
  }
  return value;
}

function assertBoundTarget(actual, expected, label) {
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) {
    throw new Error(`${label} is missing an exact CodeXomics target`);
  }
  if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
    throw new Error('Expected CodeXomics target is missing');
  }
  for (const field of REQUIRED_TARGET_FIELDS) {
    if (expected[field] === undefined || expected[field] === null || expected[field] === '') {
      throw new Error(`Bound CDS target is missing required field "${field}"`);
    }
    if (actual[field] === undefined || actual[field] === null || actual[field] === '') {
      throw new Error(`${label} is missing required target field "${field}"`);
    }
  }
  if (!Number.isInteger(Number(expected.annotationRevision)) || Number(expected.annotationRevision) < 0) {
    throw new Error('Bound CDS target annotationRevision must be a non-negative integer');
  }
  for (const field of REQUIRED_TARGET_FIELDS) {
    if (String(actual[field]) !== String(expected[field])) {
      throw new Error(`${label} ${field} does not match the bound CDS target`);
    }
  }
  if (String(expected.featureType || '').toUpperCase() !== 'CDS') {
    throw new Error('DGR report archival is restricted to CDS annotation targets');
  }
  if (String(actual.featureType || '').toUpperCase() !== 'CDS') {
    throw new Error(`${label} is not bound to a CDS feature`);
  }
  for (const field of ['locusTag', 'geneSymbol', 'proteinId', 'assemblyAccession']) {
    if (actual[field] !== undefined && String(actual[field] ?? '') !== String(expected[field] ?? '')) {
      throw new Error(`${label} ${field} does not match the bound CDS target`);
    }
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }
  return value;
}

function canonicalSha256(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function assertCurrentAnnotationSnapshot(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a bounded scientific qualifier snapshot`);
  }
  const unknownField = Object.keys(value).find(
    field => !Object.prototype.hasOwnProperty.call(CURRENT_ANNOTATION_LIMITS, field)
  );
  if (unknownField) throw new Error(`${label}.${unknownField} is not an allowed qualifier`);

  const snapshot = {};
  for (const [field, limits] of Object.entries(CURRENT_ANNOTATION_LIMITS)) {
    const candidate = value[field];
    if (candidate === undefined) continue;
    if (limits.scalar) {
      if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > limits.maximumLength) {
        throw new Error(`${label}.${field} must be a non-empty string of at most ${limits.maximumLength} characters`);
      }
      snapshot[field] = candidate;
      continue;
    }
    if (!Array.isArray(candidate) || candidate.length > limits.maximumItems) {
      throw new Error(`${label}.${field} must contain at most ${limits.maximumItems} items`);
    }
    snapshot[field] = candidate.map((item, index) => {
      if (typeof item !== 'string' || !item.trim() || item.length > limits.maximumLength) {
        throw new Error(
          `${label}.${field}[${index}] must be a non-empty string of at most ${limits.maximumLength} characters`
        );
      }
      return item;
    });
  }
  return snapshot;
}

function validateCurrentAnnotationBinding({ expected, actual, required, target }) {
  if (required && expected === undefined) {
    throw new Error('A live CodeXomics currentAnnotation snapshot is required for this DGR report archive');
  }
  if (expected === undefined) {
    return {
      schema: CURRENT_ANNOTATION_VALIDATION_SCHEMA,
      verified: false,
      required: false,
      snapshotSha256: null,
      targetFeatureHash: String(target?.featureHash || ''),
    };
  }

  const expectedSnapshot = assertCurrentAnnotationSnapshot(expected, 'Expected currentAnnotation');
  if (actual === undefined || actual === null) {
    throw new Error('DGR task parameters are missing the required currentAnnotation snapshot');
  }
  const actualSnapshot = assertCurrentAnnotationSnapshot(actual, 'DGR task currentAnnotation');
  const expectedHash = canonicalSha256(expectedSnapshot);
  const actualHash = canonicalSha256(actualSnapshot);
  if (actualHash !== expectedHash) {
    throw new Error('DGR task currentAnnotation does not match the live CodeXomics CDS qualifier snapshot');
  }
  return {
    schema: CURRENT_ANNOTATION_VALIDATION_SCHEMA,
    verified: true,
    required: required === true,
    snapshotSha256: expectedHash,
    targetFeatureHash: String(target.featureHash),
  };
}

function textSha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function normalizeDoi(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/[),.;\]]+$/, '')
    .toLowerCase();
}

function canonicalizePubMedAbstract(value) {
  return String(value || '')
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\s+/gu, ' ')
    .trim();
}

function pubMedSourceMetadata(source) {
  if (String(source?.database || '').toLowerCase() !== 'pubmed') return null;
  const reference = source?.structuredData?.literatureReferences?.[0] || {};
  const pmid = String(reference.pmid || source?.pmid || source?.provenance?.recordId || '').trim();
  if (!/^\d{6,10}$/.test(pmid)) return null;
  return {
    pmid,
    doi: normalizeDoi(reference.doi || source?.doi),
    abstract: canonicalizePubMedAbstract(reference.abstract || source?.abstract),
    directness: source?.structuredData?.targetRelevance?.directness,
    accepted: source?.structuredData?.targetRelevance?.accepted === true,
  };
}

function evidenceIdentifier(record, scheme) {
  return (record?.identifiers || [])
    .filter(identifier => String(identifier?.scheme || '').toLowerCase() === scheme)
    .map(identifier => (scheme === 'doi' ? normalizeDoi(identifier.value) : String(identifier.value || '').trim()));
}

function validateCitationBoundFacts(task) {
  const proposal = task?.result?.annotationProposal;
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) {
    throw new Error('DGR task is missing the annotation proposal required for report archival');
  }
  const facts = Array.isArray(proposal?.researchSummary?.facts)
    ? proposal.researchSummary.facts.filter(fact => fact?.evidenceLevel === 'target_literature')
    : [];
  const records = Array.isArray(proposal?.evidenceManifest?.sourceRecords)
    ? proposal.evidenceManifest.sourceRecords
    : [];
  const noteEvidenceIds = new Set(
    Array.isArray(proposal?.curationNote?.segments)
      ? proposal.curationNote.segments.flatMap(segment =>
          Array.isArray(segment?.evidenceIds) ? segment.evidenceIds.map(String) : []
        )
      : []
  );
  const pubMedSources = (Array.isArray(task?.result?.sources) ? task.result.sources : [])
    .map(pubMedSourceMetadata)
    .filter(Boolean);
  const verifiedPmids = new Set();

  for (const fact of facts) {
    const basis = fact?.literatureBasis;
    const citation = fact?.citation;
    const pmid = String(basis?.pmid || '').trim();
    const excerpt = String(basis?.excerpt || '');
    if (
      basis?.kind !== 'pubmed_abstract_span' ||
      basis.canonicalization !== 'dgr.pubmed-abstract.v1' ||
      basis.offsetEncoding !== 'utf16_code_units' ||
      basis.hashEncoding !== 'utf8' ||
      !/^\d{6,10}$/.test(pmid) ||
      !excerpt ||
      !Number.isSafeInteger(basis.excerptStart) ||
      !Number.isSafeInteger(basis.excerptEnd) ||
      !Number.isSafeInteger(basis.abstractLength) ||
      !/^[a-f0-9]{64}$/i.test(String(basis.abstractSha256 || ''))
    ) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} is missing an exact PubMed abstract span`);
    }
    if (textSha256(excerpt) !== String(basis.excerptSha256 || '').toLowerCase()) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} has an invalid excerpt hash`);
    }
    if (String(fact?.statement || '') !== excerpt) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} statement does not equal its authenticated excerpt`
      );
    }
    if (
      String(citation?.id || '') !== pmid ||
      String(citation?.url || '') !== `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
    ) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} has inconsistent PubMed citation metadata`);
    }
    const matchingSources = pubMedSources.filter(source => source.pmid === pmid);
    if (matchingSources.length !== 1) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} does not resolve to exactly one archived PubMed source`
      );
    }
    const source = matchingSources[0];
    if (!source.accepted || source.directness !== 'direct' || !source.abstract) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} is not backed by a direct accepted PubMed abstract`
      );
    }
    const excerptOffset = source.abstract.indexOf(excerpt);
    if (excerptOffset < 0) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} excerpt is absent from the archived PubMed abstract`
      );
    }
    if (
      textSha256(source.abstract) !== String(basis.abstractSha256).toLowerCase() ||
      source.abstract.length !== basis.abstractLength
    ) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} abstract hash does not match the archived source`);
    }
    if (basis.excerptStart !== excerptOffset || basis.excerptEnd !== excerptOffset + excerpt.length) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} abstract span offsets do not match the archived source`
      );
    }
    const factEvidence = records.filter(record => (fact.evidenceIds || []).includes(record?.id));
    // One PubMed record may authenticate multiple extracted facts. Its
    // supporting flag is therefore evidence-scoped: it becomes true when any
    // note segment uses that record, even if another fact from the same
    // abstract is omitted from the concise note.
    const expectedSupporting = (fact?.evidenceIds || []).some(id => noteEvidenceIds.has(String(id)));
    const matchingEvidence = factEvidence.filter(
      record =>
        String(record?.database || '').toLowerCase() === 'pubmed' &&
        record?.supporting === expectedSupporting &&
        evidenceIdentifier(record, 'pmid').includes(pmid)
    );
    if (matchingEvidence.length !== 1) {
      throw new Error(
        `Citation-bound fact ${fact?.id || 'unknown'} must reference exactly one PMID evidence record with note-consistent supporting status`
      );
    }
    const evidence = matchingEvidence[0];
    const binding = evidence.sourceBinding;
    if (
      basis.evidenceId !== evidence.id ||
      binding?.schema !== 'dgr.evidence-source-binding.v1' ||
      binding.sourceCollection !== 'sources' ||
      binding.selector?.database !== 'pubmed' ||
      binding.selector?.identifier?.scheme !== 'pmid' ||
      String(binding.selector?.identifier?.value || '') !== pmid ||
      binding.content?.relativeJsonPointer !== '/structuredData/literatureReferences/0/abstract' ||
      binding.content?.canonicalization !== 'dgr.pubmed-abstract.v1' ||
      binding.content?.hashEncoding !== 'utf8' ||
      binding.content?.lengthEncoding !== 'utf16_code_units' ||
      binding.content?.sha256 !== basis.abstractSha256 ||
      binding.content?.length !== basis.abstractLength
    ) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} has an invalid archived-source binding`);
    }
    const expectedDoi = normalizeDoi(basis.doi || citation?.doi);
    if (expectedDoi && source.doi !== expectedDoi) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} DOI does not match the archived PubMed source`);
    }
    if (expectedDoi && !evidenceIdentifier(matchingEvidence[0], 'doi').includes(expectedDoi)) {
      throw new Error(`Citation-bound fact ${fact?.id || 'unknown'} DOI is missing from its evidence record`);
    }
    verifiedPmids.add(pmid);
  }

  return {
    schema: 'codexomics.dgr-citation-validation.v1',
    verified: true,
    factCount: facts.length,
    pubMedSourceCount: pubMedSources.length,
    verifiedPubMedSourceCount: verifiedPmids.size,
  };
}

async function writeFileAtomically(destinationPath, content) {
  const tempPath = `${destinationPath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await fs.promises.open(tempPath, 'wx', 0o600);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(tempPath, destinationPath);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function artifactRoot(userDataPath) {
  return path.resolve(userDataPath, 'gene_attachments', 'dgr');
}

async function archiveDgrTaskResult({
  userDataPath,
  taskId,
  target,
  correlationId,
  currentAnnotation,
  requireCurrentAnnotation = false,
  proxyRequest,
}) {
  const safeTaskId = assertSafeTaskId(taskId);
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error('A bound CDS target is required to archive a DGR report');
  }
  assertBoundTarget(target, target, 'Requested target');
  if (typeof proxyRequest !== 'function') throw new Error('DGR report archival transport is unavailable');
  const response = await proxyRequest({
    body: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'get-task-status', arguments: { taskId: safeTaskId, resultMode: 'full' } },
      id: `archive-${crypto.randomBytes(8).toString('hex')}`,
    },
    timeoutMs: 120000,
  });
  if (!response?.ok) {
    throw new Error(`DGR returned ${response?.status || 'an error'} while archiving the full report`);
  }
  const task = parseJsonRpcBody(response.body);
  if (String(task?.id || task?.taskId || '') !== safeTaskId) {
    throw new Error('DGR returned a different task while archiving the full report');
  }
  if (String(task?.status || '').toLowerCase() !== 'completed' || !task.result) {
    throw new Error(`DGR task ${safeTaskId} is not complete and cannot be archived`);
  }
  const expectedCorrelationId = String(correlationId || '').trim();
  if (expectedCorrelationId && String(task.parameters?.correlationId || '').trim() !== expectedCorrelationId) {
    throw new Error('DGR task correlationId does not match the bound research workflow');
  }
  assertBoundTarget(task.parameters?.target, target, 'DGR task parameters');
  assertBoundTarget(task.result?.annotationProposal?.target, target, 'DGR annotation proposal');
  const currentAnnotationValidation = validateCurrentAnnotationBinding({
    expected: currentAnnotation,
    actual: task.parameters?.currentAnnotation,
    required: requireCurrentAnnotation === true,
    target,
  });
  const citationValidation = validateCitationBoundFacts(task);
  const proposalSha256 = canonicalSha256(task.result.annotationProposal);

  const content = `${JSON.stringify(task, null, 2)}\n`;
  const size = Buffer.byteLength(content, 'utf8');
  if (size > MAX_DGR_ARTIFACT_BYTES) {
    throw new Error(`DGR report exceeds the ${MAX_DGR_ARTIFACT_BYTES}-byte artifact limit`);
  }
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  const workspaceKey = crypto
    .createHash('sha256')
    .update(`${target.workspaceId}:${target.genomeId}:${target.featureHash}`)
    .digest('hex')
    .slice(0, 24);
  const geneKey = String(target.locusTag || target.featureId)
    .replace(/[^A-Za-z0-9_.-]/g, '_')
    .slice(0, 128);
  const fileName = `DGR_${safeTaskId.replace(/[^A-Za-z0-9_.-]/g, '_')}_${sha256.slice(0, 12)}.json`;
  const root = artifactRoot(userDataPath);
  const directory = path.resolve(root, workspaceKey, geneKey);
  const storedPath = path.resolve(directory, fileName);
  if (!isInside(root, storedPath)) throw new Error('DGR report artifact path escapes its storage root');
  await fs.promises.mkdir(directory, { recursive: true, mode: 0o700 });
  const rootStats = await fs.promises.lstat(root);
  if (rootStats.isSymbolicLink()) throw new Error('DGR report artifact root cannot be a symbolic link');
  const realRoot = await fs.promises.realpath(root);
  const realDirectory = await fs.promises.realpath(directory);
  if (!isInside(realRoot, realDirectory)) {
    throw new Error('DGR report artifact directory resolves outside its storage root');
  }

  let writeRequired = true;
  try {
    const existing = await fs.promises.readFile(storedPath);
    const existingHash = crypto.createHash('sha256').update(existing).digest('hex');
    if (existingHash !== sha256) throw new Error('Existing DGR artifact failed content-address integrity');
    writeRequired = false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (writeRequired) await writeFileAtomically(storedPath, content);

  const sourceCount = Number(
    task.result?.metadata?.searchDiagnostics?.uniqueSourceCount ?? task.result?.sources?.length ?? 0
  );
  const confidence = task.result?.metadata?.confidence ?? task.result?.qualityMetrics?.overallQuality ?? null;
  const pubmedSources = Array.isArray(task.result?.sources)
    ? task.result.sources.filter(source => String(source?.database || '').toLowerCase() === 'pubmed')
    : [];
  const directLiteratureCount = pubmedSources.filter(
    source => source?.structuredData?.targetRelevance?.directness === 'direct'
  ).length;
  const geneLinkedContextCount = pubmedSources.filter(
    source => source?.structuredData?.targetRelevance?.directness === 'gene_linked_context'
  ).length;
  const citationBoundFactCount = Array.isArray(task.result?.annotationProposal?.researchSummary?.facts)
    ? task.result.annotationProposal.researchSummary.facts.filter(fact => fact?.evidenceLevel === 'target_literature')
        .length
    : 0;
  return {
    fileName,
    storedPath,
    size,
    sha256,
    taskId: safeTaskId,
    storedAt: new Date().toISOString(),
    correlationId: String(correlationId || task.parameters?.correlationId || '').slice(0, 256) || null,
    proposalSha256,
    citationValidation,
    currentAnnotationValidation,
    target: { ...target },
    summary: {
      title: task.result?.title || task.result?.report?.title || `Deep Gene Research: ${target.geneSymbol || geneKey}`,
      sourceCount: Number.isFinite(sourceCount) ? sourceCount : 0,
      confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
      literatureCount: directLiteratureCount + geneLinkedContextCount,
      directLiteratureCount,
      geneLinkedContextCount,
      citationBoundFactCount,
    },
  };
}

async function readDgrArtifact({ userDataPath, storedPath, expectedSha256 }) {
  const root = artifactRoot(userDataPath);
  const resolved = path.resolve(String(storedPath || ''));
  if (!isInside(root, resolved) || path.extname(resolved).toLowerCase() !== '.json') {
    throw new Error('DGR JSON viewer can only open archived DGR JSON artifacts');
  }
  const rootStats = await fs.promises.lstat(root);
  if (rootStats.isSymbolicLink()) throw new Error('DGR report artifact root cannot be a symbolic link');
  const realRoot = await fs.promises.realpath(root);
  const realPath = await fs.promises.realpath(resolved);
  if (!isInside(realRoot, realPath)) throw new Error('DGR artifact resolves outside its storage root');
  const stats = await fs.promises.stat(realPath);
  if (!stats.isFile() || stats.size > MAX_DGR_ARTIFACT_BYTES) {
    throw new Error('DGR artifact is not a regular file within the supported size limit');
  }
  const content = await fs.promises.readFile(realPath, 'utf8');
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  if (!/^[a-f0-9]{64}$/i.test(String(expectedSha256 || '')) || sha256 !== String(expectedSha256).toLowerCase()) {
    throw new Error('DGR artifact integrity verification failed');
  }
  JSON.parse(content);
  return { content, sha256, size: stats.size, fileName: path.basename(realPath) };
}

module.exports = {
  MAX_DGR_ARTIFACT_BYTES,
  CURRENT_ANNOTATION_VALIDATION_SCHEMA,
  archiveDgrTaskResult,
  artifactRoot,
  assertBoundTarget,
  canonicalSha256,
  canonicalizePubMedAbstract,
  parseJsonRpcBody,
  readDgrArtifact,
  validateCurrentAnnotationBinding,
  validateCitationBoundFacts,
};
