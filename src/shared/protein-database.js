(function () {
  'use strict';

  function normalizeAdvancedUniprotParameters(parameters) {
    const source = parameters && typeof parameters === 'object' ? parameters : {};
    const flat = { ...source };
    for (const nestedKey of ['query_fields', 'queryFields', 'filters', 'query', 'fields']) {
      const nested = source[nestedKey];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        Object.assign(flat, nested);
        delete flat[nestedKey];
      }
    }

    const pick = (...keys) => {
      for (const key of keys) {
        const value = flat[key];
        if (value !== undefined && value !== null && value !== '') return value;
      }
      return undefined;
    };
    const asText = value => (Array.isArray(value) ? value.filter(Boolean).join(' ') : value);

    const limit = Number(pick('limit', 'max_results', 'maxResults', 'size'));

    return {
      proteinName: asText(pick('proteinName', 'protein_name')),
      geneName: asText(pick('geneName', 'gene_name', 'gene')),
      organism: asText(pick('organism', 'organism_name', 'organismName', 'species')),
      keywords: pick('keywords', 'keyword'),
      subcellularLocation: asText(pick('subcellularLocation', 'subcellular_location')),
      function: asText(pick('function', 'cc_function', 'proteinFunction')),
      reviewedOnly: Boolean(pick('reviewedOnly', 'reviewed_only', 'reviewed')),
      limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
    };
  }
  function formatInterproDetails(details, format) {
    const { interproId, name, type, description } = details;
    if (format === 'minimal') return { interproId, name, type };
    if (format === 'summary') return { interproId, name, type, description };
    return details;
  }

  const api = { normalizeAdvancedUniprotParameters, formatInterproDetails };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.proteinDatabase = api;
})();
