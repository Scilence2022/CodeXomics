'use strict';

const MicrobeGenomicsFunctions = require('../../src/renderer/modules/MicrobeGenomicsFunctions');
const SequenceProcessing = require('../../src/renderer/modules/UnifiedSequenceProcessing');
const GenomeAnalysisService = require('../../src/renderer/modules/chat/services/GenomeAnalysisService');
const { formatInterproDetails } = require('../../src/shared/protein-database');
const { buildContractToolResult } = require('./contract-tool-results');

/**
 * Result shapes fed to the automatic benchmark. Keep the pinned dataset
 * contract above available to dataset generation and historical replay.
 */
async function buildBenchmarkToolResult(toolName, parameters = {}) {
  try {
    return await executeBenchmarkFixture(toolName, parameters);
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function executeBenchmarkFixture(toolName, parameters) {
  switch (toolName) {
    case 'translate_dna':
    case 'translate_sequence': {
      const dna = parameters.dna ?? parameters.sequence;
      const { frame, options } = MicrobeGenomicsFunctions.translationArgsFromParameters(parameters);
      const protein = MicrobeGenomicsFunctions.translateDNA(dna, frame, options);
      return { success: true, protein, frame, length: protein.length };
    }
    case 'reverse_complement':
      return { reverseComplement: SequenceProcessing.reverseComplementForTool(parameters) };
    case 'codon_usage_analysis':
      if (!parameters.sequence || parameters.chromosome) {
        return { success: false, error: 'This offline benchmark has no loaded genome for codon usage lookup' };
      }
      return new GenomeAnalysisService(null, null).codonUsageAnalysis(parameters);
    case 'get_coding_sequence': {
      const identifier = parameters.identifier ?? parameters.gene_name ?? parameters.geneName;
      const { sequence, length, chromosome, start, end, strand } = buildContractToolResult(toolName, {
        gene_name: identifier,
      });
      return { success: true, identifier, codingSequence: sequence, length, chromosome, start, end, strand };
    }
    case 'fetch_alphafold_structure':
    case 'fetch_protein_structure': {
      const id =
        parameters.uniprotId ?? parameters.uniprot_id ?? parameters.pdbId ?? parameters.pdb_id ?? parameters.geneName;
      const fixtureKey = encodeURIComponent(String(id));
      return {
        success: true,
        _dataRef: `benchmark_structure_${fixtureKey}`,
        structureFile: `/tmp/benchmark-${fixtureKey}.pdb`,
      };
    }
    case 'get_interpro_entry_details': {
      const interproId = (parameters.interpro_id ?? parameters.interproId).toUpperCase();
      const details = { interproId, name: 'Benchmark entry', type: 'domain', description: 'Synthetic InterPro entry.' };
      return { success: true, tool: toolName, details: formatInterproDetails(details, parameters.output_format) };
    }
    case 'search_uniprot_database': {
      const query = parameters.query ?? parameters.search_query;
      const result = buildContractToolResult(toolName, {
        search_query: query,
        organism: parameters.organism,
        reviewed_only: parameters.reviewedOnly ?? parameters.reviewed_only,
        max_results: parameters.limit ?? parameters.max_results ?? 20,
      });
      const entries = result.entries || [];
      // The DapA workflow uses an accession outside the pinned dataset corpus.
      if (
        entries.length === 0 &&
        /^dapa$/i.test(query) &&
        (!parameters.organism || /^escherichia coli$/i.test(parameters.organism))
      ) {
        const { entry_info: dapA, sequence_length: length } = buildContractToolResult('get_uniprot_entry', {
          uniprot_id: 'P0A6L2',
        });
        entries.push({ ...dapA, length });
      }
      const results = entries.map(entry => ({
        uniprotId: entry.accession,
        proteinName: entry.protein_name,
        genes: [entry.gene_name],
        organism: entry.organism,
        reviewed: entry.reviewed,
        length: entry.length,
      }));
      return { success: true, count: results.length, results };
    }
    case 'get_uniprot_entry': {
      const result = buildContractToolResult(toolName, {
        ...parameters,
        uniprot_id: parameters.uniprot_id ?? parameters.uniprotId,
        geneName: parameters.geneName ?? parameters.gene_name,
        include_sequence: parameters.include_sequence ?? parameters.includeSequence,
      });
      const { accession, ...entry } = result.entry_info;
      const formatted = { ...result, entry_info: { ...entry, uniprot_id: accession } };
      if ((parameters.include_sequence ?? parameters.includeSequence) === false) delete formatted.protein_sequence;
      return formatted;
    }
    default:
      return buildContractToolResult(toolName, parameters);
  }
}

module.exports = { buildBenchmarkToolResult };
