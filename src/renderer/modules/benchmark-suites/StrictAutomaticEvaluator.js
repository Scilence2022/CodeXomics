/**
 * Strict scorer for the 143 automatic-simple and 29 automatic-complex cases.
 *
 * Every evidence channel is evaluated independently:
 *   1. a native tool call was observed;
 *   2. the observed tool sequence matches the oracle;
 *   3. the arguments are canonically equivalent to the oracle;
 *   4. each observed call is valid against the production JSON Schema; and
 *   5. real execution was observed and completed successfully.
 *
 * `contract` mode intentionally stops after (4). It is suitable for offline
 * native-function-calling benchmarks, but must never be reported as executable
 * accuracy. `execution` is the default and additionally requires (5).
 *
 * `completion` mode is a task-completion supplement, not a stricter gate: it
 * accepts any schema-valid plan that covers every expected capability, even
 * when the plan uses an equivalent tool, an alternative-but-equivalent
 * parameter key, a different step order, or extra read-only calls. It is used
 * to audit whether failures are genuine task failures or oracle strictness.
 */
class StrictAutomaticEvaluator {
  constructor(options = {}) {
    this.validateToolCall = options.validateToolCall || (() => ({ valid: true, errors: [] }));
    this.assessmentMode = options.assessmentMode || 'execution';
    // When completion mode also requires real execution evidence (the in-app
    // benchmark), an expected call that actually failed to execute still
    // fails the test: under task-completion the task was genuinely not done.
    this.requireExecutionForCompletion = options.requireExecutionForCompletion === true;
    if (!['contract', 'execution', 'completion'].includes(this.assessmentMode)) {
      throw new TypeError("assessmentMode must be 'contract', 'execution', or 'completion'");
    }
    this.completionMode = this.assessmentMode === 'completion';

    // These aliases describe genuinely interchangeable API spellings. Case,
    // snake_case, camelCase, and kebab-case are normalized before this map is used.
    // Directional aliases avoid turning every path-like field into every other one.
    this.parameterAliases = {
      filename: ['fileName', 'filePath', 'path', 'outputPath'],
      fileName: ['filename', 'filePath', 'path', 'outputPath'],
      filePath: ['filename', 'fileName', 'path', 'outputPath'],
      outputPath: ['filename', 'fileName', 'filePath', 'path'],
      inputFile: ['filePath', 'filename', 'fileName', 'path'],
      database: ['dbName', 'databaseName'],
      dbName: ['database', 'databaseName'],
      databaseName: ['database', 'dbName'],
      tabIndex: ['index', 'tab'],
      sequence: ['primerSequence', 'dna'],
      primerSequence: ['sequence'],
      dna: ['sequence'],
      includeCoordinates: ['includeCoordinate', 'includeCoords'],
      includeCoordinate: ['includeCoordinates', 'includeCoords'],
      includeCoords: ['includeCoordinates', 'includeCoordinate'],
      ...options.parameterAliases,
    };

    // Tools that accomplish the same task when the request targets the loaded
    // genome as a whole. Kept minimal and direction-safe: no pair is listed
    // unless the two tools are documented as interchangeable for that request.
    this.toolEquivalents = {
      blast_create_db_from_genome: ['blast_create_quick_db_for_current_genome'],
      blast_create_quick_db_for_current_genome: ['blast_create_db_from_genome'],
      // Both tools run a BLAST sequence search; blast_search_online targets
      // NCBI online databases (e.g. "nt"), which the oracle also accepts via
      // blast_search's database parameter. For a request naming an online
      // database either tool completes the task.
      blast_search: ['blast_search_online'],
      blast_search_online: ['blast_search'],
      // translate_sequence is a backward-compatible alias whose schema says
      // "prefer translate_dna"; either tool completes a DNA translation.
      translate_sequence: ['translate_dna'],
      translate_dna: ['translate_sequence'],
    };

    // Completion-mode parameter fallbacks: when the oracle expects key K but
    // the tool schema accepts alternative keys for the same concept, any
    // concrete alternative satisfies the requirement.
    this.completionParameterAlternatives = {
      switch_to_tab: { tabId: ['tabName', 'tabIndex'] },
      blast_create_quick_db_for_current_genome: { dbName: ['genomeName'] },
      // navigate_to_position documents both spellings: `position` centers a
      // 2kb window, and a start-only call centers the same way. A schema-valid
      // call with either key completes "navigate to position N".
      navigate_to_position: { position: ['start'], start: ['position'] },
      // export_bed_format documents both `export_range` and an explicit
      // region (start_position/end_position); a schema-valid region call
      // completes "export the current view region" just like export_range.
      // The grouped alternative requires both coordinate keys to be present.
      export_bed_format: { exportRange: [['startPosition', 'endPosition']] },
    };

    // Read-only tools never mutate state, so an extra call to one of them does
    // not undo or endanger a completed task. Completion mode ignores extras
    // from this set; every other extra call still fails the audit.
    this.readOnlyToolNames = new Set(
      [
        'get_current_state',
        'get_genome_info',
        'get_chromosome_list',
        'get_loaded_files_list',
        'get_file_info',
        'get_track_status',
        // A screenshot only observes the current view; it never mutates
        // genomic state, so an extra screenshot after the required calls is a
        // benign verification step rather than a task-endangering side effect.
        'capture_screenshot',
        // save_view_state persists a view snapshot (like a bookmark) without
        // touching genomic state; a model that wraps up a completed navigation
        // workflow with one is over-completing, not endangering the task.
        'save_view_state',
        // open_image_file opens a viewer to review a file; it does not mutate
        // genomic state, so opening the screenshot the task just captured is a
        // benign verification step rather than a task-endangering side effect.
        'open_image_file',
        'get_all_track_settings',
        'get_track_settings',
        'get_track_settings_schema',
        'get_gene_details',
        'get_sequence',
        'get_coding_sequence',
        'get_clipboard_content',
        'get_action_list',
        'get_annotation',
        'get_annotation_history',
        'get_annotation_changeset',
        'get_annotation_audit',
        'get_annotation_research_workflow',
        'get_bookmarks',
        'get_operons',
        'get_benchmark_status',
        'get_dna_marker_info',
        'get_interpro_entry_details',
        'list_available_tools',
        'list_annotations',
        'list_annotation_changesets',
        'list_highlights',
        'list_tasks',
        'list_primers',
        'list_restriction_enzymes',
        'list_dna_markers',
        'list_annotation_quality_candidates',
        'list_annotation_research_history',
        'search_features',
        'search_annotations',
        'search_uniprot_database',
        'search_pdb_structures',
        'search_alphafold_structures',
        'search_sequence_motif',
        'search_pattern',
        'find_gene_by_name',
        'find_primer_binding_sites',
        'find_restriction_sites',
        'get_nearby_features',
        'get_uniprot_entry',
        'compute_gc',
        'calc_region_gc',
        'reverse_complement',
        'translate_dna',
        'translate_sequence',
        'calculate_entropy',
        'calculate_molecular_weight',
        'calculate_primer_properties',
        'genome_codon_usage_analysis',
        'predict_promoter',
        'assess_annotation_quality',
        'advanced_uniprot_search',
        'analyze_interpro_domains',
        'virtual_digest',
        'blast_get_installation_status',
        'blast_list_databases',
        'blast_search',
        'blast_search_local',
        'blast_validate_database',
        'blast_filter_results',
        'show_action_list',
      ].map(name => this.normalizeToolName(name))
    );
  }

  isReadOnlyTool(toolName) {
    return this.readOnlyToolNames.has(this.normalizeToolName(toolName));
  }

  normalizeToolName(value) {
    return String(value || '')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();
  }

  toolMatches(actual, expected) {
    if (Array.isArray(expected)) return expected.some(candidate => this.toolMatches(actual, candidate));
    if (this.normalizeToolName(actual) === this.normalizeToolName(expected)) return true;
    if (!this.completionMode) return false;
    const actualName = this.normalizeToolName(actual);
    const expectedName = this.normalizeToolName(expected);
    return (
      (this.toolEquivalents[actualName] || []).includes(expectedName) ||
      (this.toolEquivalents[expectedName] || []).includes(actualName)
    );
  }

  /** JSON-unescape a string that the model double-encoded, or null. */
  unquoteJsonString(value) {
    if (typeof value !== 'string' || value.length < 2) return null;
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'string') return parsed;
      } catch (_error) {
        return null;
      }
    }
    return null;
  }

  /**
   * Completion-mode alias normalization applied before schema validation:
   * track names and double-encoded JSON strings are repaired so that a
   * plan which would execute correctly is not rejected by a spelling quirk.
   */
  normalizeObservedAliases(toolName, parameters) {
    const source = parameters || {};
    if (toolName === 'toggle_track') {
      const clone = { ...source };
      const key = Object.hasOwn(clone, 'track_name') ? 'track_name' : 'trackName';
      if (typeof clone[key] === 'string') {
        const normalized = String(clone[key])
          .trim()
          .toLowerCase()
          .replace(/[\s_-]+/g, '');
        if (normalized === 'gc' || normalized === 'gccontent') clone[key] = 'gc_content';
      }
      return clone;
    }
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const clone = { ...source };
      for (const [key, value] of Object.entries(clone)) {
        const unquoted = this.unquoteJsonString(value);
        if (unquoted !== null) clone[key] = unquoted;
      }
      return clone;
    }
    return source;
  }

  formatExpectedTool(expected) {
    return Array.isArray(expected) ? expected.join(' | ') : String(expected || '');
  }

  normalizeParameterKey(key) {
    const words = String(key || '')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[\s-]+/g, '_')
      .split('_')
      .filter(Boolean);
    if (words.length === 0) return '';
    return (
      words[0].toLowerCase() +
      words
        .slice(1)
        .map(word => {
          const lower = word.toLowerCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('')
    );
  }

  normalizeParameters(value) {
    if (Array.isArray(value)) return value.map(item => this.normalizeParameters(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [this.normalizeParameterKey(key), this.normalizeParameters(child)])
    );
  }

  normalizeArguments(value) {
    if (typeof value !== 'string') return value && typeof value === 'object' ? value : {};
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  isSchemaDefault(value) {
    return (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      Object.prototype.hasOwnProperty.call(value, 'benchmarkDefaultValue')
    );
  }

  isAnyOfKey(key) {
    return this.normalizeParameterKey(key) === 'benchmarkAnyOf';
  }

  isAnglePlaceholder(value) {
    return typeof value === 'string' && /^<[^<>]+>$/.test(value.trim());
  }

  isToolResultReference(value) {
    if (typeof value !== 'string') return false;
    return /^\{\{?\s*[A-Za-z][\w.-]*(?:\[[^\]]+\])?(?:\.[A-Za-z_$][\w$-]*(?:\[[^\]]+\])?)+\s*\}?\}$/.test(value.trim());
  }

  isPlaceholder(value) {
    return this.isAnglePlaceholder(value) || this.isToolResultReference(value);
  }

  isConcreteContextValue(value, placeholder) {
    if (value === undefined || value === null || this.isPlaceholder(value)) return false;
    if (typeof value === 'string' && value.trim() === '') return false;
    if (Array.isArray(value) && value.length === 0) return false;

    const normalizedPlaceholder = String(placeholder || '')
      .trim()
      .toLowerCase();
    if (normalizedPlaceholder === '<created_annotation_id>') {
      return /^user_\d+_[a-z0-9]+$/i.test(String(value));
    }
    if (normalizedPlaceholder === '<created_protein_database>') {
      return /\b(protein|prot)\b|[_-](protein|prot)([_-]|$)/i.test(String(value));
    }
    return true;
  }

  normalizeTrackName(value) {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
    const aliases = {
      gc: 'gc',
      gccontent: 'gc',
      gene: 'genes',
      genes: 'genes',
      variant: 'variants',
      variants: 'variants',
      read: 'reads',
      reads: 'reads',
      protein: 'proteins',
      proteins: 'proteins',
      primer: 'primers',
      primers: 'primers',
      wig: 'wigtracks',
      wigtrack: 'wigtracks',
      wigtracks: 'wigtracks',
    };
    return aliases[normalized] || normalized;
  }

  visibilityValue(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (['show', 'on', 'enable', 'display', 'visible', 'true'].includes(normalized)) return true;
    if (['hide', 'off', 'disable', 'hidden', 'false'].includes(normalized)) return false;
    return null;
  }

  normalizePath(value) {
    return String(value)
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/\.\//g, '/')
      .replace(/\/{2,}/g, '/');
  }

  valuesMatch(actual, expected, context = {}) {
    const expectedValue = this.isSchemaDefault(expected) ? expected.benchmarkDefaultValue : expected;
    if (this.isPlaceholder(expectedValue)) return this.isConcreteContextValue(actual, expectedValue);
    if (Object.is(actual, expectedValue)) return true;

    if (context.toolName === 'toggle_track' && context.parameterKey === 'trackName') {
      return this.normalizeTrackName(actual) === this.normalizeTrackName(expectedValue);
    }
    if (context.toolName === 'toggle_track' && ['visible', 'action'].includes(context.parameterKey)) {
      const actualVisibility = this.visibilityValue(actual);
      const expectedVisibility = this.visibilityValue(expectedValue);
      // The tool documents action="toggle" for explicit invert requests, and
      // the fixture's known initial state makes a toggle achieve the requested
      // visibility for every benchmark toggle test. In completion mode a
      // schema-valid toggle is accepted for either expected visibility.
      if (this.completionMode && actual === 'toggle') return true;
      return actualVisibility !== null && expectedVisibility !== null && actualVisibility === expectedVisibility;
    }

    // analyze_interpro_domains defaults to analysis_type "complete", which is
    // a documented superset that includes domain analysis. In completion mode
    // a request for "domains" is satisfied by "complete".
    if (
      this.completionMode &&
      context.toolName === 'analyze_interpro_domains' &&
      this.normalizeParameterKey(context.parameterKey) === 'analysisType'
    ) {
      const normalizedActual = String(actual).trim().toLowerCase();
      const normalizedExpected = String(expectedValue).trim().toLowerCase();
      if (normalizedExpected === 'domains' && ['domains', 'complete'].includes(normalizedActual)) return true;
    }

    if (typeof expectedValue === 'number') {
      const numericActual = Number(actual);
      return Number.isFinite(numericActual) && numericActual === expectedValue;
    }
    if (typeof expectedValue === 'boolean' && typeof actual === 'string') {
      if (actual.trim().toLowerCase() === String(expectedValue)) return true;
      // Completion mode accepts the show/hide vocabulary for boolean settings
      // (e.g. showStartMarkers: "hide" means false).
      if (this.completionMode) {
        const mapped = this.visibilityValue(actual);
        if (mapped !== null && mapped === expectedValue) return true;
      }
      return false;
    }
    if (typeof actual === 'string' && typeof expectedValue === 'string') {
      const actualText = actual.trim();
      const expectedText = expectedValue.trim();
      if (actualText.toLowerCase() === expectedText.toLowerCase()) return true;
      if (/[\\/]/.test(actualText) || /[\\/]/.test(expectedText)) {
        if (this.completionMode) {
          const unquoted = this.unquoteJsonString(actualText);
          if (unquoted !== null && unquoted === expectedText) return true;
        }
        return this.normalizePath(actualText).toLowerCase() === this.normalizePath(expectedText).toLowerCase();
      }
      if (this.completionMode) {
        const unquoted = this.unquoteJsonString(actualText);
        if (unquoted !== null && unquoted === expectedText) return true;
      }
      return false;
    }
    if (Array.isArray(expectedValue)) {
      return (
        Array.isArray(actual) &&
        actual.length === expectedValue.length &&
        expectedValue.every((item, index) => this.valuesMatch(actual[index], item, context))
      );
    }
    if (expectedValue && typeof expectedValue === 'object') {
      if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
      const alternatives = expectedValue.benchmarkAnyOf;
      if (Array.isArray(alternatives) && alternatives.length > 0) {
        const ordinary = Object.entries(expectedValue).filter(([key]) => !this.isAnyOfKey(key));
        const ordinaryMatches = ordinary.every(([key, value]) =>
          this.valuesMatch(actual[key], value, { ...context, parameterKey: this.normalizeParameterKey(key) })
        );
        if (!ordinaryMatches) return false;
        return alternatives.some(alternative => this.valuesMatch(actual, alternative, context));
      }
      return Object.entries(expectedValue).every(([key, value]) =>
        this.valuesMatch(actual[key], value, { ...context, parameterKey: this.normalizeParameterKey(key) })
      );
    }
    return false;
  }

  getParameterAliasCandidates(expectedKey) {
    const normalizedKey = this.normalizeParameterKey(expectedKey);
    const aliases = this.parameterAliases[normalizedKey] || this.parameterAliases[expectedKey] || [];
    return [...new Set([normalizedKey, ...aliases.map(alias => this.normalizeParameterKey(alias))])];
  }

  getActualParameter(actual, expectedKey, toolName) {
    const normalizedKey = this.normalizeParameterKey(expectedKey);
    for (const candidate of this.getParameterAliasCandidates(normalizedKey)) {
      if (Object.prototype.hasOwnProperty.call(actual, candidate)) {
        return { found: true, key: candidate, value: actual[candidate], alias: candidate !== normalizedKey };
      }
    }

    // toggle_track exposes two equivalent visibility representations.
    if (toolName === 'toggle_track' && normalizedKey === 'visible' && Object.hasOwn(actual, 'action')) {
      return { found: true, key: 'action', value: actual.action, alias: true };
    }
    if (toolName === 'toggle_track' && normalizedKey === 'action' && Object.hasOwn(actual, 'visible')) {
      return { found: true, key: 'visible', value: actual.visible, alias: true };
    }

    // The legacy currentViewOnly boolean and the canonical sequenceType enum
    // describe the same export scope. This mapping is intentionally tool-limited.
    if (toolName === 'export_fasta_sequence' && normalizedKey === 'currentViewOnly') {
      if (Object.hasOwn(actual, 'sequenceType')) {
        return { found: true, key: 'sequenceType', value: actual.sequenceType === 'current_view', alias: true };
      }
    }
    if (toolName === 'export_fasta_sequence' && normalizedKey === 'sequenceType') {
      if (Object.hasOwn(actual, 'currentViewOnly')) {
        return {
          found: true,
          key: 'currentViewOnly',
          value: actual.currentViewOnly ? 'current_view' : 'all',
          alias: true,
        };
      }
    }

    return { found: false, key: null, value: undefined, alias: false };
  }

  parameterAlternativeMatches(actual, alternative, toolName) {
    if (!alternative || typeof alternative !== 'object' || Array.isArray(alternative)) return false;
    const ordinaryKeys = Object.keys(alternative).filter(key => !this.isAnyOfKey(key));
    if (ordinaryKeys.length === 0) return false;
    const supplied = ordinaryKeys.every(key => {
      const expectedValue = alternative[key];
      // Completion mode tolerates omitting placeholder/reference keys when the
      // observed call is schema-valid (compareParameters applies that
      // tolerance); the physical-presence gate must not skip it for anyOf
      // alternative groups (e.g. a start-only navigate_to_position call vs an
      // oracle alternative that also lists chromosome/end references).
      return (
        this.isSchemaDefault(expectedValue) ||
        this.isPlaceholder(expectedValue) ||
        this.getActualParameter(actual, key, toolName).found
      );
    });
    return supplied && this.compareParameters(actual, alternative, toolName).match;
  }

  describeValue(value) {
    if (value === undefined) return '<missing>';
    let serialized;
    try {
      serialized = JSON.stringify(value);
    } catch (_error) {
      serialized = String(value);
    }
    if (serialized === undefined) serialized = String(value);
    return serialized.length > 160 ? serialized.slice(0, 157) + '...' : serialized;
  }

  compareParameters(actualParameters, expectedParameters, rawToolName = '') {
    const toolName = this.normalizeToolName(rawToolName);
    const actual = this.normalizeParameters(this.normalizeArguments(actualParameters));
    const expected = this.normalizeParameters(expectedParameters || {});
    const alternatives = expected.benchmarkAnyOf;
    let mismatches = [];
    const aliasMatches = [];
    const defaultOmissions = [];
    const contextMatches = [];
    let checked = 0;
    let matched = 0;

    for (const [expectedKey, expectedValue] of Object.entries(expected)) {
      if (this.isAnyOfKey(expectedKey)) continue;
      checked += 1;
      const actualCandidate = this.getActualParameter(actual, expectedKey, toolName);
      if (!actualCandidate.found) {
        if (this.isSchemaDefault(expectedValue)) {
          matched += 1;
          defaultOmissions.push(expectedKey);
          continue;
        }
        mismatches.push({
          parameter: expectedKey,
          reason: 'missing',
          expected: this.isSchemaDefault(expectedValue) ? expectedValue.benchmarkDefaultValue : expectedValue,
          actual: undefined,
        });
        continue;
      }

      const valueMatches = this.valuesMatch(actualCandidate.value, expectedValue, {
        toolName,
        parameterKey: expectedKey,
      });
      if (!valueMatches) {
        mismatches.push({
          parameter: expectedKey,
          actualParameter: actualCandidate.key,
          reason: 'different_value',
          expected: this.isSchemaDefault(expectedValue) ? expectedValue.benchmarkDefaultValue : expectedValue,
          actual: actualCandidate.value,
        });
        continue;
      }

      matched += 1;
      if (actualCandidate.alias) aliasMatches.push({ expected: expectedKey, actual: actualCandidate.key });
      if (
        this.isPlaceholder(this.isSchemaDefault(expectedValue) ? expectedValue.benchmarkDefaultValue : expectedValue)
      ) {
        contextMatches.push(expectedKey);
      }
    }

    let alternativeMatched = true;
    if (Array.isArray(alternatives) && alternatives.length > 0) {
      checked += 1;
      alternativeMatched = alternatives.some(alternative =>
        this.parameterAlternativeMatches(actual, alternative, toolName)
      );
      if (alternativeMatched) {
        matched += 1;
      } else {
        mismatches.push({
          parameter: 'benchmarkAnyOf',
          reason: 'no_alternative_matched',
          expected: alternatives,
          actual,
        });
      }
    }

    if (this.completionMode && mismatches.some(mismatch => mismatch.reason === 'missing')) {
      const rawActual = this.normalizeArguments(actualParameters);
      const schemaValid = (this.validateToolCall(toolName, rawActual) || {}).valid === true;
      const tolerated = [];
      for (const mismatch of mismatches) {
        if (mismatch.reason !== 'missing') continue;
        // A context placeholder ("<current_chromosome>") or a cross-round
        // reference ("{open_new_tab.tab_id}") does not have to be spelled out
        // when the observed call is schema-valid and resolves the same concept
        // through an alternative key (tab_index, genomeName, ...).
        const placeholderTolerated = schemaValid && this.isPlaceholder(mismatch.expected);
        const alternativeTolerated = this.completionAlternativeSatisfied(toolName, mismatch.parameter, actual);
        // capture_screenshot: a tracks-targeted screenshot without an explicit
        // mode still accomplishes "capture a visible tracks screenshot"; the
        // suite already treats target variants as equivalent, and mode's
        // schema default ("full") does not change the tracks target.
        const visibleScreenshotTolerated =
          schemaValid &&
          this.normalizeToolName(toolName) === 'capture_screenshot' &&
          this.normalizeParameterKey(mismatch.parameter) === 'mode' &&
          (() => {
            const target = this.getActualParameter(actual, 'target', toolName);
            return (
              target.found &&
              ['visibleTracks', 'tracks', 'track'].includes(this.normalizeParameterKey(String(target.value)))
            );
          })();
        if (placeholderTolerated || alternativeTolerated || visibleScreenshotTolerated) {
          tolerated.push(mismatch);
        }
      }
      if (tolerated.length > 0) {
        mismatches = mismatches.filter(mismatch => !tolerated.includes(mismatch));
        matched += tolerated.length;
      }
    }

    return {
      match: mismatches.length === 0 && alternativeMatched,
      checked,
      matched,
      mismatches,
      aliasMatches,
      defaultOmissions,
      contextMatches,
    };
  }

  completionAlternativeSatisfied(toolName, expectedKey, actual) {
    const normalizedTool = this.normalizeToolName(toolName);
    const alternatives =
      this.completionParameterAlternatives[normalizedTool]?.[this.normalizeParameterKey(expectedKey)];
    if (!Array.isArray(alternatives)) return false;
    return alternatives.some(alternative => {
      // A single key ("start") or a grouped alternative (["startPosition",
      // "endPosition"]) both express the same concept; grouped alternatives
      // require every key to be supplied with a concrete value.
      const keys = Array.isArray(alternative) ? alternative : [alternative];
      return keys.every(key => {
        const candidate = this.getActualParameter(actual, key, toolName);
        return candidate.found && this.isConcreteContextValue(candidate.value, null);
      });
    });
  }

  /**
   * Completion-mode extras that do not endanger a completed task:
   * 1. execute_actions is the documented apply step for queued edit tools
   *    (paste/insert/cut/delete/replace/copy), so applying the queue after the
   *    required edit tool is the workflow's own follow-up, not a deviation.
   * 2. export_genbank_format that writes the same file execute_actions already
   *    generates (auto_save + filename) is a redundant instance of the export
   *    capability the task already requires.
   * 3. highlight_region labelled with the gene select_gene was asked to select
   *    is a redundant instance of select_gene's documented highlight behavior.
   */
  isCompletionToleratedExtra(call, calls, expectedTools, expectedParameters) {
    const toolName = this.normalizeToolName(call?.tool_name || '');
    const flatten = names => names.flat().map(name => this.normalizeToolName(name));
    const expectedNames = flatten(expectedTools.map(expected => (Array.isArray(expected) ? expected : [expected])));
    const queueingEditTools = [
      'paste_sequence',
      'insert_sequence',
      'cut_sequence',
      'delete_sequence',
      'replace_sequence',
      'copy_sequence',
    ];

    if (toolName === 'execute_actions') {
      const queueingToolSeen = calls.some(observed =>
        queueingEditTools.includes(this.normalizeToolName(observed?.tool_name || ''))
      );
      return queueingToolSeen && expectedNames.some(name => queueingEditTools.includes(name));
    }

    if (toolName === 'export_genbank_format') {
      if (!expectedNames.some(name => this.toolMatches(name, 'execute_actions'))) return false;
      const executeCall = calls.find(observed => this.toolMatches(observed?.tool_name, 'execute_actions'));
      const execFilename = executeCall?.parameters?.filename;
      const exportFilename = call?.parameters?.filename;
      if (typeof execFilename !== 'string' || executeCall?.parameters?.auto_save !== true) return false;
      return exportFilename === undefined || exportFilename === execFilename;
    }

    if (toolName === 'highlight_region') {
      if (!expectedNames.some(name => this.toolMatches(name, 'select_gene'))) return false;
      const expectedGene = expectedParameters
        .filter(params => params && typeof params === 'object')
        .map(params => params.geneName || params.gene_name || params.name || params.gene)
        .find(value => typeof value === 'string');
      if (!expectedGene) return false;
      const label = call?.parameters?.label ?? call?.parameters?.geneName ?? call?.parameters?.name;
      return label === expectedGene;
    }

    return false;
  }

  parametersMatch(actualParameters, expectedParameters, toolName = '') {
    return this.compareParameters(actualParameters, expectedParameters, toolName).match;
  }

  hasExecutionEvidence(call, sourceExecutionObserved = false) {
    if (sourceExecutionObserved || call?.executionObserved === true || call?.execution_observed === true) return true;
    if (call?.executed === true) return true;
    const method = String(call?.detectionMethod || call?.detection_method || '').toLowerCase();
    if (method.includes('execution')) return true;
    const status = String(call?.status || '').toLowerCase();
    return ['completed', 'succeeded', 'success', 'failed', 'error'].includes(status);
  }

  getExecutionSuccess(call, executionObserved) {
    if (!executionObserved) return null;
    if (typeof call?.executionSuccess === 'boolean') return call.executionSuccess;
    if (typeof call?.execution_success === 'boolean') return call.execution_success;
    if (typeof call?.success === 'boolean') return call.success;
    if (call?.error) return false;
    const status = String(call?.status || '').toLowerCase();
    if (['completed', 'succeeded', 'success'].includes(status)) return true;
    if (['failed', 'error'].includes(status)) return false;
    return null;
  }

  normalizeCall(call, source, sourceExecutionObserved = false) {
    const toolName = call?.tool_name || call?.toolName || call?.tool || call?.function?.name || call?.name;
    if (!toolName) return null;
    const parameters = this.normalizeArguments(
      call?.parameters ?? call?.arguments ?? call?.function?.arguments ?? call?.params ?? {}
    );
    const executionObserved = this.hasExecutionEvidence(call, sourceExecutionObserved);
    const executionSuccess = this.getExecutionSuccess(call, executionObserved);
    return {
      tool_name: toolName,
      parameters,
      callObserved: true,
      executionObserved,
      executionSuccess,
      executed: executionObserved,
      success: executionSuccess,
      status:
        call?.status || (executionSuccess === true ? 'completed' : executionSuccess === false ? 'failed' : 'unknown'),
      source,
      callId: call?.id || call?.call_id || call?.tool_call_id || null,
    };
  }

  extractCurrentCalls(testResult) {
    const actual = testResult?.actualResult;
    let candidates = [];
    let source = null;
    let sourceExecutionObserved = false;

    if (Array.isArray(actual?.executedFunctionCalls)) {
      candidates = actual.executedFunctionCalls;
      source = 'actualResult.executedFunctionCalls';
      sourceExecutionObserved = true;
    } else if (Array.isArray(actual)) {
      candidates = actual.filter(call => this.hasExecutionEvidence(call));
      source = 'actualResult[]';
    } else if (Array.isArray(actual?.nativeFunctionCalls)) {
      candidates = actual.nativeFunctionCalls;
      source = 'actualResult.nativeFunctionCalls';
    } else if (Array.isArray(actual?.toolCalls)) {
      candidates = actual.toolCalls;
      source = 'actualResult.toolCalls';
    } else if (Array.isArray(actual?.tool_calls)) {
      candidates = actual.tool_calls;
      source = 'actualResult.tool_calls';
    } else if (actual?.tool_name && this.hasExecutionEvidence(actual)) {
      candidates = [actual];
      source = 'actualResult';
    } else {
      candidates = testResult?.llmInteractionData?.response?.functionCalls || [];
      source = 'llmInteractionData.response.functionCalls';
    }

    const calls = candidates.map(call => this.normalizeCall(call, source, sourceExecutionObserved)).filter(Boolean);

    const pendingExecutions = [...(testResult?.llmInteractionData?.response?.toolExecutions || [])];
    for (const call of calls) {
      let executionIndex = -1;
      if (call.callId) {
        executionIndex = pendingExecutions.findIndex(execution =>
          [execution?.id, execution?.call_id, execution?.tool_call_id].filter(Boolean).includes(call.callId)
        );
      }
      if (executionIndex === -1) {
        executionIndex = pendingExecutions.findIndex(execution =>
          this.toolMatches(execution?.tool_name || execution?.tool || execution?.name, call.tool_name)
        );
      }
      if (executionIndex === -1) continue;
      const execution = pendingExecutions.splice(executionIndex, 1)[0];
      call.executionObserved = true;
      call.executed = true;
      call.executionSuccess = this.getExecutionSuccess(execution, true);
      call.success = call.executionSuccess;
      call.status =
        execution?.status ||
        (call.executionSuccess === true ? 'completed' : call.executionSuccess === false ? 'failed' : 'unknown');
    }
    return calls;
  }

  getExpectedTools(test) {
    const expected = test?.expectedResult || {};
    if (Array.isArray(expected.tool_sequence)) return expected.tool_sequence;
    if (!expected.tool_name) return [];
    const repeatedCount = Number(expected.expectedCallCount ?? expected.expectedTabsIncrease ?? 1);
    if (Number.isInteger(repeatedCount) && repeatedCount > 1) {
      return Array.from({ length: repeatedCount }, () => expected.tool_name);
    }
    return [expected.tool_name];
  }

  getExpectedParameters(test, count) {
    const parameters = test?.expectedResult?.parameters;
    if (Array.isArray(parameters)) return parameters;
    if (count === 1) return [parameters || {}];
    return Array.from({ length: count }, () => ({}));
  }

  isOrderInsensitiveTool(expectedTool, orderInsensitiveTools = []) {
    return orderInsensitiveTools.some(tool => {
      if (Array.isArray(expectedTool)) return expectedTool.some(candidate => this.toolMatches(candidate, tool));
      return this.toolMatches(expectedTool, tool);
    });
  }

  isExactToolSequence(calls, expectedTools, orderInsensitiveTools = []) {
    if (calls.length !== expectedTools.length || expectedTools.length === 0) return false;
    let index = 0;
    while (index < expectedTools.length) {
      if (!this.isOrderInsensitiveTool(expectedTools[index], orderInsensitiveTools)) {
        if (!this.toolMatches(calls[index].tool_name, expectedTools[index])) return false;
        index += 1;
        continue;
      }

      let end = index + 1;
      while (end < expectedTools.length && this.isOrderInsensitiveTool(expectedTools[end], orderInsensitiveTools)) {
        end += 1;
      }
      const unused = calls.slice(index, end).map((call, offset) => ({ call, index: index + offset, used: false }));
      for (let expectedIndex = index; expectedIndex < end; expectedIndex += 1) {
        const match = unused.find(
          item => !item.used && this.toolMatches(item.call.tool_name, expectedTools[expectedIndex])
        );
        if (!match) return false;
        match.used = true;
      }
      index = end;
    }
    return true;
  }

  matchToolSequence(calls, expectedTools, orderInsensitiveTools = []) {
    const used = new Set();
    const matches = [];
    let cursor = 0;

    expectedTools.forEach((expectedTool, expectedIndex) => {
      const orderInsensitive = this.isOrderInsensitiveTool(expectedTool, orderInsensitiveTools);
      const start = orderInsensitive ? 0 : cursor;
      let actualIndex = -1;
      for (let index = start; index < calls.length; index += 1) {
        if (!used.has(index) && this.toolMatches(calls[index].tool_name, expectedTool)) {
          actualIndex = index;
          break;
        }
      }
      if (actualIndex === -1) {
        matches.push({
          expectedIndex,
          expectedTool,
          actualIndex: null,
          matched: false,
          callObserved: false,
          orderInsensitive,
        });
        return;
      }
      used.add(actualIndex);
      if (!orderInsensitive) cursor = actualIndex + 1;
      matches.push({
        expectedIndex,
        expectedTool,
        actualIndex,
        matched: true,
        callObserved: true,
        orderInsensitive,
      });
    });

    const unexpectedIndexes = calls.map((_call, index) => index).filter(index => !used.has(index));
    return {
      matches,
      matchedCount: matches.filter(match => match.callObserved).length,
      unexpectedIndexes,
      exact: this.isExactToolSequence(calls, expectedTools, orderInsensitiveTools),
    };
  }

  matchArguments(calls, sequenceMatches, expectedParameters) {
    const used = new Set();
    return sequenceMatches.map(sequenceMatch => {
      if (!sequenceMatch.callObserved) {
        return {
          ...sequenceMatch,
          parametersMatch: false,
          comparison: {
            match: false,
            checked: 0,
            matched: 0,
            mismatches: [],
            aliasMatches: [],
            defaultOmissions: [],
            contextMatches: [],
          },
        };
      }

      let actualIndex = sequenceMatch.actualIndex;
      if (sequenceMatch.orderInsensitive) {
        const candidates = calls
          .map((call, index) => ({ call, index }))
          .filter(item => !used.has(item.index) && this.toolMatches(item.call.tool_name, sequenceMatch.expectedTool));
        const exactCandidate = candidates.find(item =>
          this.parametersMatch(
            item.call.parameters,
            expectedParameters[sequenceMatch.expectedIndex] || {},
            item.call.tool_name
          )
        );
        actualIndex = (exactCandidate || candidates[0] || { index: actualIndex }).index;
      }
      used.add(actualIndex);
      const call = calls[actualIndex];
      const comparison = this.compareParameters(
        call.parameters,
        expectedParameters[sequenceMatch.expectedIndex] || {},
        call.tool_name
      );
      return {
        ...sequenceMatch,
        actualIndex,
        parametersMatch: comparison.match,
        executionSuccess: call.executionSuccess,
        comparison,
      };
    });
  }

  matchCalls(calls, expectedTools, expectedParameters, orderInsensitiveTools = []) {
    const sequence = this.matchToolSequence(calls, expectedTools, orderInsensitiveTools);
    return this.matchArguments(calls, sequence.matches, expectedParameters);
  }

  validateObservedCall(call) {
    try {
      const parameters = this.completionMode
        ? this.normalizeObservedAliases(call.tool_name, call.parameters || {})
        : call.parameters || {};
      const result = this.validateToolCall(call.tool_name, parameters) || {};
      return {
        valid: result.valid === true,
        errors: Array.isArray(result.errors) ? result.errors.map(String) : result.errors ? [String(result.errors)] : [],
      };
    } catch (error) {
      return { valid: false, errors: [`Schema validator threw: ${error.message}`] };
    }
  }

  getRetrievalMetrics(test, testResult) {
    const selected = testResult?.llmInteractionData?.request?.dynamicToolsAnalysis?.selectedToolNames || [];
    const expected = this.getExpectedTools(test);
    const covered = expected.filter(tool => selected.some(name => this.toolMatches(name, tool))).length;
    return {
      selectedToolCount: selected.length,
      expectedToolCount: expected.length,
      expectedToolsCovered: covered,
      recall: expected.length > 0 ? covered / expected.length : 1,
    };
  }

  formatArgumentErrors(argumentMatches, calls) {
    const errors = [];
    for (const match of argumentMatches) {
      if (!match.callObserved || match.parametersMatch) continue;
      const expectedPosition = match.expectedIndex + 1;
      const actualPosition = match.actualIndex + 1;
      const tool = this.formatExpectedTool(match.expectedTool);
      for (const mismatch of match.comparison.mismatches) {
        if (mismatch.reason === 'missing') {
          errors.push(
            `Argument mismatch for expected call ${expectedPosition} '${tool}' (observed call ${actualPosition}): ` +
              `missing parameter '${mismatch.parameter}' (expected ${this.describeValue(mismatch.expected)})`
          );
        } else if (mismatch.reason === 'no_alternative_matched') {
          errors.push(
            `Argument mismatch for expected call ${expectedPosition} '${tool}' (observed call ${actualPosition}): ` +
              'none of the permitted parameter alternatives matched'
          );
        } else {
          errors.push(
            `Argument mismatch for expected call ${expectedPosition} '${tool}' (observed call ${actualPosition}): ` +
              `parameter '${mismatch.parameter}' expected ${this.describeValue(mismatch.expected)}, ` +
              `received ${this.describeValue(mismatch.actual)}`
          );
        }
      }
      if (match.comparison.mismatches.length === 0) {
        errors.push(
          `Argument mismatch for expected call ${expectedPosition} '${tool}' (observed call ${actualPosition})`
        );
      }
      if (!calls[match.actualIndex]) break;
    }
    return errors;
  }

  evaluate(test, testResult) {
    const maxScore = test.maxScore || (test.complexity === 'complex' ? 10 : 5);
    const assessmentMode = test.assertCallOnly === true ? 'contract' : this.assessmentMode;
    const calls = this.extractCurrentCalls(testResult);
    const expectedTools = this.getExpectedTools(test);
    const expectedParameters = this.getExpectedParameters(test, expectedTools.length);
    // Completion mode is coverage-based: any valid step order that covers every
    // expected capability counts, because a task can often be completed in
    // more than one order (list before search, save before navigate, ...).
    const orderInsensitiveTools = this.completionMode
      ? expectedTools
      : test?.expectedResult?.orderInsensitiveTools || [];
    const sequence = this.matchToolSequence(calls, expectedTools, orderInsensitiveTools);
    const argumentMatches = this.matchArguments(calls, sequence.matches, expectedParameters);
    const parameterMatches = argumentMatches.filter(match => match.parametersMatch).length;
    const schemaChecks = calls.map(call => this.validateObservedCall(call));
    const schemaValidCount = schemaChecks.filter(check => check.valid).length;
    // Extra read-only calls (a status check, a list, a search) do not endanger
    // a completed task; completion mode ignores them. Extra state-changing
    // calls still fail the audit UNLESS they are another instance of a tool
    // the task explicitly requires (e.g. saving a second primer when the
    // request says "add primers"): repeating a required capability is a
    // deviation, not a failure to complete the task.
    const unexpectedIndexes = this.completionMode
      ? sequence.unexpectedIndexes.filter(index => {
          const toolName = calls[index]?.tool_name;
          if (this.isReadOnlyTool(toolName)) return false;
          if (expectedTools.some(expected => this.toolMatches(toolName, expected))) return false;
          return !this.isCompletionToleratedExtra(calls[index], calls, expectedTools, expectedParameters);
        })
      : sequence.unexpectedIndexes;
    const unexpectedCalls = unexpectedIndexes.map(index => calls[index]);
    const expectedObservedCalls = sequence.matches.filter(match => match.callObserved);
    const executionObservedCount = expectedObservedCalls.filter(
      match => calls[match.actualIndex].executionObserved
    ).length;
    const executionSuccessCount = expectedObservedCalls.filter(
      match => calls[match.actualIndex].executionObserved && calls[match.actualIndex].executionSuccess === true
    ).length;
    const executionFailureCount = expectedObservedCalls.filter(
      match => calls[match.actualIndex].executionObserved && calls[match.actualIndex].executionSuccess === false
    ).length;
    const executionUnknownCount = expectedObservedCalls.filter(
      match => !calls[match.actualIndex].executionObserved || calls[match.actualIndex].executionSuccess === null
    ).length;

    const exactSequence = this.completionMode ? sequence.matchedCount === expectedTools.length : sequence.exact;
    const argumentsExact = expectedTools.length > 0 && parameterMatches === expectedTools.length;
    const schemasExact = calls.length > 0 && schemaValidCount === calls.length;
    const executionExact =
      expectedTools.length > 0 &&
      sequence.matchedCount === expectedTools.length &&
      executionObservedCount === expectedTools.length &&
      executionSuccessCount === expectedTools.length;
    const contractSatisfied = exactSequence && argumentsExact && schemasExact;
    const executionSatisfied = contractSatisfied && executionExact;
    const completionSatisfied = contractSatisfied && unexpectedCalls.length === 0;
    const completionExecutionSatisfied = completionSatisfied && (!this.requireExecutionForCompletion || executionExact);
    const success =
      assessmentMode === 'completion'
        ? completionExecutionSatisfied
        : assessmentMode === 'contract'
          ? contractSatisfied
          : executionSatisfied;

    const denominator = Math.max(expectedTools.length, 1);
    const toolRatio = sequence.matchedCount / denominator;
    const parameterRatio = parameterMatches / denominator;
    const schemaRatio = calls.length > 0 ? schemaValidCount / calls.length : 0;
    const executionObservedRatio = executionObservedCount / denominator;
    const executionSuccessRatio = executionSuccessCount / denominator;
    const weightedRatio =
      assessmentMode === 'contract'
        ? 0.45 * toolRatio + 0.35 * parameterRatio + 0.2 * schemaRatio
        : 0.35 * toolRatio +
          0.25 * parameterRatio +
          0.15 * schemaRatio +
          0.1 * executionObservedRatio +
          0.15 * executionSuccessRatio;

    const errors = [];
    if (calls.length === 0) errors.push('No authoritative tool calls were captured for this test');
    if (!exactSequence) {
      for (const match of sequence.matches.filter(item => !item.callObserved)) {
        errors.push(
          `Tool sequence mismatch: expected call ${match.expectedIndex + 1} ` +
            `'${this.formatExpectedTool(match.expectedTool)}' was not observed in order`
        );
      }
      for (const index of unexpectedIndexes) {
        errors.push(`Tool sequence mismatch: unexpected observed call ${index + 1} '${calls[index].tool_name}'`);
      }
      if (sequence.matchedCount === expectedTools.length && sequence.unexpectedIndexes.length === 0) {
        const mismatchIndex = expectedTools.findIndex(
          (tool, index) => !this.toolMatches(calls[index]?.tool_name, tool)
        );
        if (mismatchIndex !== -1) {
          errors.push(
            `Tool sequence mismatch at position ${mismatchIndex + 1}: expected ` +
              `'${this.formatExpectedTool(expectedTools[mismatchIndex])}', observed '${calls[mismatchIndex]?.tool_name || '<none>'}'`
          );
        }
      }
    }
    errors.push(...this.formatArgumentErrors(argumentMatches, calls));
    schemaChecks.forEach((check, index) => {
      if (!check.valid) {
        const reasons = check.errors.length > 0 ? check.errors.join('; ') : 'registered JSON Schema rejected the call';
        errors.push(`Schema invalid for observed call ${index + 1} '${calls[index].tool_name}': ${reasons}`);
      }
    });
    if (assessmentMode === 'execution') {
      for (const match of expectedObservedCalls) {
        const call = calls[match.actualIndex];
        if (!call.executionObserved) {
          errors.push(
            `Execution not observed for expected call ${match.expectedIndex + 1} ` +
              `'${this.formatExpectedTool(match.expectedTool)}' (observed call ${match.actualIndex + 1})`
          );
        } else if (call.executionSuccess === null) {
          errors.push(
            `Execution outcome unknown for expected call ${match.expectedIndex + 1} ` +
              `'${this.formatExpectedTool(match.expectedTool)}' (observed call ${match.actualIndex + 1})`
          );
        } else if (call.executionSuccess === false) {
          errors.push(
            `Execution failed for expected call ${match.expectedIndex + 1} ` +
              `'${this.formatExpectedTool(match.expectedTool)}' (observed call ${match.actualIndex + 1})`
          );
        }
      }
    }

    const warnings = unexpectedCalls.map(call => `Unexpected call: ${call.tool_name}`);
    if (
      assessmentMode === 'contract' &&
      expectedObservedCalls.some(match => !calls[match.actualIndex].executionObserved)
    ) {
      warnings.push('Contract tier evaluates native call structure only; tool execution was not assessed');
    }

    const callDetails = calls.map((call, index) => ({
      index,
      toolName: call.tool_name,
      source: call.source,
      call_observed: true,
      schema_valid: schemaChecks[index].valid,
      schema_errors: schemaChecks[index].errors,
      execution_observed: call.executionObserved,
      execution_success: call.executionSuccess,
    }));

    return {
      success,
      score: success ? maxScore : Math.min(maxScore - 1, Math.floor(maxScore * weightedRatio)),
      maxScore,
      errors,
      warnings,
      details: {
        scoringMode: 'strict-automatic-v2',
        assessmentMode,
        assessmentTier:
          assessmentMode === 'completion'
            ? this.requireExecutionForCompletion
              ? 'task-completion-execution'
              : 'task-completion-contract'
            : assessmentMode === 'contract'
              ? 'native-function-contract'
              : 'real-tool-execution',
        executionRequired: assessmentMode === 'execution',
        expectedTools,
        actualTools: calls.map(call => call.tool_name),
        matchedCount: sequence.matchedCount,
        parameterMatches,
        schemaValidCount,
        executionMatches: executionSuccessCount,
        executionObservedCount,
        executionSuccessCount,
        executionFailureCount,
        executionUnknownCount,
        unexpectedCalls: unexpectedCalls.map(call => call.tool_name),
        exactSequence,
        argumentsExact,
        schemasExact,
        executionExact,
        contractSatisfied,
        executionSatisfied,
        metrics: {
          call_observed: {
            observed_count: calls.length,
            expected_count: expectedTools.length,
            expected_matched_count: sequence.matchedCount,
            exact_sequence: exactSequence,
          },
          arguments: {
            matched_count: parameterMatches,
            expected_count: expectedTools.length,
            exact: argumentsExact,
          },
          schema_valid: {
            observed_count: calls.length,
            valid_count: schemaValidCount,
            invalid_count: calls.length - schemaValidCount,
            all_observed_valid: calls.length > 0 ? schemasExact : null,
          },
          execution_observed: {
            observed_count: executionObservedCount,
            expected_matched_count: expectedObservedCalls.length,
            all_expected_observed: expectedTools.length > 0 ? executionObservedCount === expectedTools.length : null,
          },
          execution_success: {
            success_count: executionSuccessCount,
            failure_count: executionFailureCount,
            unknown_count: executionUnknownCount,
            all_expected_succeeded: expectedTools.length > 0 ? executionExact : null,
          },
        },
        matches: argumentMatches.map(match => ({
          expectedIndex: match.expectedIndex,
          expectedTool: this.formatExpectedTool(match.expectedTool),
          actualIndex: match.actualIndex,
          callObserved: match.callObserved,
          parametersMatch: match.parametersMatch,
          argumentDiagnostics: match.comparison,
        })),
        calls: callDetails,
        retrieval: this.getRetrievalMetrics(test, testResult),
      },
    };
  }
}

if (typeof window !== 'undefined') window.StrictAutomaticEvaluator = StrictAutomaticEvaluator;
if (typeof module !== 'undefined') module.exports = StrictAutomaticEvaluator;
