/**
 * BenchmarkEvaluatorBase - Shared evaluation logic for all benchmark suites.
 *
 * Fixes consolidated:
 *   Problem 3: compareParameters substring matching replaced with Levenshtein similarity
 *   Problem 4: Deduplicated evaluateBasicFunctionCall across all 4 suites
 *   Problem 5: executed && confidence===100 bypass reduced from 50pts to 30+20 with critical-param check
 *   Problem 6: knownFunctions dynamically loaded from builtInToolsMap instead of hardcoded list
 */
class BenchmarkEvaluatorBase {
  constructor() {
    this.framework = null;
    this._cachedKnownFunctions = null;
  }

  static TIMEOUTS = {
    DEFAULT: 120000,
    EXPORT_WORKFLOW: 180000,
    SHORT: 60000,
  };

  static THRESHOLDS = {
    SUCCESS_COMPLEX: 0.4,
    SUCCESS_SIMPLE: 0.6,
    SUCCESS_EXPORT_PASS: 0.6,
    FILE_EXPORT_PASS: 0.5,
    FILE_LOADING_PASS: 0.4,
    GENERAL_SUCCESS_BONUS: 0.3,
    WORKFLOW_BASELINE: 0.4,
  };

  // ─── Tool Name Normalization (camelCase / kebab-case → snake_case) ───────

  /**
   * Normalize a tool name to snake_case for comparison.
   * Handles: searchGeneByName → find_gene_by_name,
   *           find-gene-by-name → find_gene_by_name
   */
  normalizeToolName(name) {
    if (!name || typeof name !== 'string') return '';
    // camelCase → snake_case
    let normalized = name.replace(/([a-z])([A-Z])/g, '$1_$2');
    // kebab-case → snake_case
    normalized = normalized.replace(/-/g, '_');
    return normalized.toLowerCase();
  }

  canonicalizeToolName(name) {
    const normalized = this.normalizeToolName(name);
    const aliases = {
      load_genome: 'load_genome_file',
      load_fasta: 'load_genome_file',
      load_fasta_file: 'load_genome_file',
      load_genbank: 'load_genome_file',
      load_genbank_file: 'load_genome_file',
      load_gbk: 'load_genome_file',
      load_gbk_file: 'load_genome_file',
      load_annotation: 'load_annotation_file',
      load_bed: 'load_annotation_file',
      load_bed_file: 'load_annotation_file',
      load_gff: 'load_annotation_file',
      load_gff_file: 'load_annotation_file',
      load_gff3: 'load_annotation_file',
      load_gff3_file: 'load_annotation_file',
      load_gtf: 'load_annotation_file',
      load_gtf_file: 'load_annotation_file',
      load_variant: 'load_variant_file',
      load_vcf: 'load_variant_file',
      load_vcf_file: 'load_variant_file',
      load_reads: 'load_reads_file',
      load_bam: 'load_reads_file',
      load_bam_file: 'load_reads_file',
      load_sam: 'load_reads_file',
      load_sam_file: 'load_reads_file',
      load_wig: 'load_wig_tracks',
      load_wig_file: 'load_wig_tracks',
      load_bigwig: 'load_wig_tracks',
      load_bigwig_file: 'load_wig_tracks',
      load_bedgraph: 'load_wig_tracks',
      load_bedgraph_file: 'load_wig_tracks',
      load_track: 'load_wig_tracks',
      load_track_file: 'load_wig_tracks',
      load_tracks: 'load_wig_tracks',
      load_operon: 'load_operon_file',
      load_operons: 'load_operon_file',
    };
    return aliases[normalized] || normalized;
  }

  /**
   * Check whether two tool names match, with normalization support.
   * Returns 'exact' for identical strings, 'normalized' for snake_case equivalence, or false.
   *
   * `expected` may also be an array of alternative tool names (e.g. ['jump_to_gene', 'zoom_to_gene']),
   * representing tools that are interchangeable for a given workflow step. Any one match is sufficient.
   */
  matchToolName(actual, expected) {
    if (Array.isArray(expected)) {
      return expected.reduce((match, alternative) => match || this.matchToolName(actual, alternative), false);
    }
    if (actual === expected) return 'exact';
    if (this.normalizeToolName(actual) === this.normalizeToolName(expected)) return 'normalized';
    if (this.canonicalizeToolName(actual) === this.canonicalizeToolName(expected)) return 'alias';
    return false;
  }

  // ─── Schema-default Expectations ─────────────────────────────────────────

  /**
   * Wrap an expected parameter value that is identical to the tool schema's default.
   *
   * Models routinely omit such parameters: the tool applies the same value either way,
   * so the resulting behaviour is indistinguishable. Scoring the omission as a wrong
   * parameter produced false failures, so a wrapped expectation is satisfied when the
   * parameter is absent, and still compared normally when the model does send it.
   *
   *   parameters: { blastType: this.schemaDefault('blastn'), database: 'nt' }
   */
  schemaDefault(value) {
    return { benchmarkDefaultValue: value };
  }

  isSchemaDefaultExpectation(value) {
    return (
      !!value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === 1 &&
      Object.prototype.hasOwnProperty.call(value, 'benchmarkDefaultValue')
    );
  }

  unwrapExpectedValue(value) {
    return this.isSchemaDefaultExpectation(value) ? value.benchmarkDefaultValue : value;
  }

  // ─── Organism Name Normalization ─────────────────────────────────────────

  /**
   * Normalize organism names so that the abbreviations models actually emit
   * ("E. coli", "E.coli") compare equal to the full binomial name.
   */
  normalizeOrganismValue(value) {
    if (value === undefined || value === null) return '';
    const text = String(value).toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    const abbreviations = {
      e: 'escherichia',
      b: 'bacillus',
      s: 'saccharomyces',
      h: 'homo',
      m: 'mus',
    };
    const [genus, ...rest] = text.split(' ');
    if (rest.length > 0 && abbreviations[genus]) {
      return [abbreviations[genus], ...rest].join(' ');
    }
    return text;
  }

  // ─── String Similarity (Levenshtein) ─────────────────────────────────────

  /**
   * Compute Levenshtein edit distance between two strings.
   */
  levenshteinDistance(a, b) {
    if (!a || !b) return Math.max((a || '').length, (b || '').length);
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[m][n];
  }

  /**
   * Compute similarity ratio (0-1) between two strings using Levenshtein distance.
   */
  calculateStringSimilarity(a, b) {
    if (!a && !b) return 1.0;
    if (!a || !b) return 0.0;
    const longer = a.length >= b.length ? a.toLowerCase() : b.toLowerCase();
    const shorter = a.length >= b.length ? b.toLowerCase() : a.toLowerCase();
    if (longer.length === 0) return 1.0;
    const dist = this.levenshteinDistance(longer, shorter);
    return (longer.length - dist) / longer.length;
  }

  // ─── Parameter Comparison (Fix Problem 3) ────────────────────────────────

  /**
   * Compare actual vs expected parameters with improved string matching.
   * Returns a score from 0 to 50 (50 = perfect).
   *
   * Improvements over original:
   *  - Substring match replaced with Levenshtein similarity scoring
   *  - Tiered similarity thresholds: ≥0.8 → 35pts, ≥0.5 → 20pts, else → 5pts
   */
  compareParameters(actual, expected) {
    if (!actual && !expected) return 50;
    if (!actual || !expected) return 0;

    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    if (expectedKeys.length === 0) return 50;

    let score = 0;
    const maxScore = expectedKeys.length * 50;

    console.log('🔍 [BenchmarkEvaluatorBase] Comparing parameters:', {
      actual,
      expected,
      expectedKeys,
      actualKeys,
    });

    for (const key of expectedKeys) {
      const rawExpectedValue = expected[key];
      const expectedValue = this.unwrapExpectedValue(rawExpectedValue);
      const actualValue = actual[key];

      if (actualValue === undefined) {
        if (this.isSchemaDefaultExpectation(rawExpectedValue)) {
          score += 50;
          console.log(`✅ Omitted parameter ${key} matches the tool default (${JSON.stringify(expectedValue)})`);
          continue;
        }
        console.log(`❌ Missing parameter: ${key}`);
        continue;
      }

      // Placeholder values like <current_chromosome>
      if (typeof expectedValue === 'string' && expectedValue.startsWith('<') && expectedValue.endsWith('>')) {
        score += 50;
        console.log(`✅ Placeholder match for ${key}: expected ${expectedValue}, got ${actualValue}`);
        continue;
      }

      if (actualValue === expectedValue) {
        score += 50;
        console.log(`✅ Exact match for ${key}: ${actualValue}`);
      } else if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
        // Case-insensitive exact match
        if (actualValue.toLowerCase() === expectedValue.toLowerCase()) {
          score += 45;
          console.log(`✅ Case-insensitive match for ${key}: ${actualValue}`);
        } else {
          // Use Levenshtein similarity instead of raw substring matching
          const similarity = this.calculateStringSimilarity(actualValue, expectedValue);
          if (similarity >= 0.8) {
            score += 35;
            console.log(
              `✅ High similarity for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(1)}%)`
            );
          } else if (similarity >= 0.5) {
            score += 20;
            console.log(
              `⚠️ Moderate similarity for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(1)}%)`
            );
          } else {
            score += 5;
            console.log(
              `❌ Low similarity for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(1)}%)`
            );
          }
        }
      } else if (typeof expectedValue === 'number' && typeof actualValue === 'number') {
        const diff = Math.abs(actualValue - expectedValue);
        const tolerance = Math.abs(expectedValue * 0.1);
        if (diff === 0) {
          score += 50;
          console.log(`✅ Exact number match for ${key}: ${actualValue}`);
        } else if (diff <= tolerance) {
          score += 40;
          console.log(`✅ Close number match for ${key}: ${actualValue} vs ${expectedValue}`);
        } else {
          score += 10;
          console.log(`⚠️ Number mismatch for ${key}: ${actualValue} vs ${expectedValue}`);
        }
      } else if (typeof expectedValue === 'boolean' && typeof actualValue === 'boolean') {
        if (actualValue === expectedValue) {
          score += 50;
          console.log(`✅ Boolean match for ${key}: ${actualValue}`);
        } else {
          console.log(`❌ Boolean mismatch for ${key}: ${actualValue} vs ${expectedValue}`);
        }
      } else {
        // Type mismatch but parameter exists
        score += 10;
        console.log(`⚠️ Type mismatch for ${key}: ${typeof actualValue} vs ${typeof expectedValue}`);
      }
    }

    const finalScore = Math.min(Math.round((score / maxScore) * 50), 50);
    console.log(`📊 [BenchmarkEvaluatorBase] Parameter comparison score: ${finalScore}/50 (${score}/${maxScore})`);
    return finalScore;
  }

  // ─── Critical Parameter Check (Fix Problem 5) ────────────────────────────

  /**
   * Check whether the actual parameters contain the critical parameters
   * from the expected set. A parameter is "critical" if it is NOT a placeholder
   * (i.e., it has a concrete expected value).
   */
  hasCriticalParams(actualParams, expectedParams) {
    if (!expectedParams || Object.keys(expectedParams).length === 0) return true;
    if (!actualParams) return false;

    const criticalKeys = Object.entries(expectedParams)
      .filter(([, v]) => !(typeof v === 'string' && v.startsWith('<') && v.endsWith('>')))
      .map(([k]) => k);

    if (criticalKeys.length === 0) return true; // All placeholders → no critical params to check

    const matchedCritical = criticalKeys.filter(key => {
      // Parameters whose expected value is the tool's own default stay satisfied when omitted.
      if (!(key in actualParams)) return this.isSchemaDefaultExpectation(expectedParams[key]);
      const actual = actualParams[key];
      const expected = this.unwrapExpectedValue(expectedParams[key]);
      if (typeof expected === 'string' && typeof actual === 'string') {
        return (
          actual.toLowerCase() === expected.toLowerCase() || this.calculateStringSimilarity(actual, expected) >= 0.8
        );
      }
      return actual === expected;
    });

    return matchedCritical.length === criticalKeys.length;
  }

  // ─── Single Function Call Evaluation (Fix Problem 5) ──────────────────────

  /**
   * Evaluate a single function call (0-100 scale).
   *
   * Fix Problem 5: When executed && confidence===100, instead of giving full 50 pts
   * for parameters, we give 30 pts baseline + 20 pts if critical params match.
   */
  evaluateSingleFunctionCall(actualCall, expectedCall) {
    const result = {
      score: 0,
      success: false,
      errors: [],
      warnings: [],
    };

    if (!actualCall || !actualCall.tool_name) {
      result.errors.push('Invalid function call format');
      return result;
    }

    // Check tool name (50 points out of 100) — with normalization support
    const nameMatch = this.matchToolName(actualCall.tool_name, expectedCall.tool_name);
    if (nameMatch === 'exact') {
      result.score += 50;
      console.log(`✅ [Single Call Eval] Function name matches exactly! +50 points`);
    } else if (nameMatch === 'normalized') {
      result.score += 45; // Slight deduction for non-canonical name format
      result.warnings.push(
        `Tool name matched after normalization: ${actualCall.tool_name} ≈ ${expectedCall.tool_name}`
      );
      console.log(`✅ [Single Call Eval] Function name matches after normalization! +45 points`);
    } else {
      result.errors.push(`Expected function ${expectedCall.tool_name}, got ${actualCall.tool_name}`);
      console.log(`❌ [Single Call Eval] Function name mismatch! +0 points`);
    }

    // Check parameters (50 points out of 100)
    if (actualCall.executed && actualCall.confidence === 100) {
      // Fix Problem 5: Execution success = 30 pts baseline, +20 if critical params match
      result.score += 30;
      console.log(`✅ [Single Call Eval] Tool was actually executed successfully (+30 baseline points)`);

      if (this.hasCriticalParams(actualCall.parameters, expectedCall.parameters)) {
        result.score += 20;
        console.log(`✅ [Single Call Eval] Critical parameters match! +20 bonus points`);
      } else {
        result.warnings.push('Tool executed but critical parameters differ from expected');
        console.log(`⚠️ [Single Call Eval] Critical parameters do NOT match — no bonus (+0)`);
      }
    } else if (actualCall.parameters && expectedCall.parameters) {
      const paramScore = this.compareParameters(actualCall.parameters, expectedCall.parameters);
      result.score += paramScore;

      if (paramScore >= 40) {
        console.log(`✅ [Single Call Eval] Parameters match well! (${paramScore} points)`);
      } else if (paramScore >= 20) {
        result.warnings.push('Parameters partially match expected values');
        console.log(`⚠️ [Single Call Eval] Parameters partially match (${paramScore} points)`);
      } else {
        result.errors.push('Parameters do not match expected values');
        console.log(`❌ [Single Call Eval] Parameters do not match (${paramScore} points)`);
      }
    } else if (!expectedCall.parameters || Object.keys(expectedCall.parameters).length === 0) {
      result.score += 50;
      console.log(`✅ [Single Call Eval] No parameters expected — perfect match! +50 points`);
    } else {
      result.errors.push('Missing required parameters');
      console.log(`❌ [Single Call Eval] Missing required parameters! +0 points`);
    }

    result.success = result.score >= 70;
    return result;
  }

  // ─── Tool Execution Tracker Helper ───────────────────────────────────────

  /**
   * Check the Tool Execution Tracker for a given tool name.
   * Returns { found: true, status: 'completed'|'running'|'failed', execution } or { found: false }.
   * @param {string} expectedToolName - The tool name to look for
   * @param {number} [timeoutMs] - Timeout for staleness check
   * @param {boolean} [earlyReturn=false] - If true, accept 'running' status as successful submission
   */
  /**
   * Return the list of tool executions for the current interaction, normalized to
   * { toolName, parameters, status, startTime }.
   *
   * Primary source is the ToolExecutionTracker session. When that is empty — which is
   * the case whenever the live execution path doesn't feed the tracker — we fall back
   * to ChatManager.getLastExecutionData(), the same authoritative record the ChatBox
   * relies on. This keeps every tracker-based evaluator working off real execution
   * results instead of silently degrading to brittle response-text regex matching.
   */
  getTrackedExecutions() {
    const tracker = window.chatManager && window.chatManager.toolExecutionTracker;
    if (tracker) {
      // The tracker session spans the whole benchmark run, so session-wide records leak
      // earlier tests' tool calls into the current evaluation — that both fakes matches
      // and, worse, lets a stale same-named call be matched with the wrong parameters.
      // Prefer the records stamped with the test currently under evaluation.
      if (typeof tracker.getTestExecutions === 'function' && tracker.currentTestId) {
        const testExecutions = tracker.getTestExecutions(tracker.currentTestId);
        if (Array.isArray(testExecutions) && testExecutions.length > 0) {
          return testExecutions;
        }
      }
      if (typeof tracker.getSessionExecutions === 'function') {
        const sessionExecutions = tracker.getSessionExecutions();
        if (Array.isArray(sessionExecutions) && sessionExecutions.length > 0) {
          // Records from earlier tests carry a different testId; drop them whenever the
          // tracker stamps test ids, even if nothing is left for the current test.
          const currentTestId = tracker.currentTestId;
          if (currentTestId && sessionExecutions.some(exec => exec && exec.testId)) {
            return sessionExecutions.filter(exec => !exec.testId || exec.testId === currentTestId);
          }
          return sessionExecutions;
        }
      }
    }
    return this.deriveExecutionsFromExecutionData();
  }

  /**
   * Build normalized tracker-style execution records from ChatManager.getLastExecutionData().
   * Each executed function call is paired with its first unconsumed tool result (calls
   * and results are recorded in execution order) to recover per-call success state.
   */
  deriveExecutionsFromExecutionData() {
    const executionData =
      window.chatManager &&
      typeof window.chatManager.getLastExecutionData === 'function' &&
      window.chatManager.getLastExecutionData();

    if (!executionData || !Array.isArray(executionData.functionCalls)) {
      return [];
    }

    const pendingResults = Array.isArray(executionData.toolResults) ? [...executionData.toolResults] : [];
    const fallbackStart = executionData.startTime || Date.now();

    return executionData.functionCalls
      .map(call => {
        const toolName = call.tool_name || call.toolName || call.tool;
        let success = true;
        const resultIndex = pendingResults.findIndex(r => (r.tool || r.tool_name) === toolName);
        if (resultIndex !== -1) {
          success = pendingResults[resultIndex].success !== false;
          pendingResults.splice(resultIndex, 1);
        }
        const parsedTimestamp = call.timestamp ? Date.parse(call.timestamp) : NaN;
        return {
          toolName,
          parameters: call.parameters || {},
          status: success ? 'completed' : 'failed',
          startTime: Number.isFinite(parsedTimestamp) ? parsedTimestamp : fallbackStart,
          success,
        };
      })
      .filter(exec => exec.toolName);
  }

  checkToolExecutionTracker(expectedToolName, timeoutMs, earlyReturn = false) {
    const recentExecutions = this.getTrackedExecutions();
    if (recentExecutions.length === 0) {
      return { found: false };
    }
    const effectiveTimeout =
      timeoutMs || (this.framework && this.framework.testTimeout) || BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT;

    const completed = recentExecutions.find(
      exec =>
        this.matchToolName(exec.toolName, expectedToolName) &&
        exec.status === 'completed' &&
        Date.now() - exec.startTime < effectiveTimeout
    );
    if (completed) {
      return { found: true, status: 'completed', execution: completed };
    }

    if (earlyReturn) {
      const running = recentExecutions.find(
        exec =>
          this.matchToolName(exec.toolName, expectedToolName) &&
          exec.status === 'running' &&
          Date.now() - exec.startTime < effectiveTimeout
      );
      if (running) {
        return { found: true, status: 'running', execution: running };
      }
    }

    const failed = recentExecutions.find(
      exec =>
        this.matchToolName(exec.toolName, expectedToolName) &&
        exec.status === 'failed' &&
        Date.now() - exec.startTime < effectiveTimeout
    );
    if (failed) {
      return { found: true, status: 'failed', execution: failed };
    }

    return { found: false };
  }

  getRecentToolMatches(expectedToolNames, timeoutMs = BenchmarkEvaluatorBase.TIMEOUTS.DEFAULT, expectedParams = null) {
    const recentExecutions = this.getTrackedExecutions();
    if (recentExecutions.length === 0) {
      return { matched: [], unmatched: [...expectedToolNames], matchDetails: [] };
    }
    const now = Date.now();

    const matched = [];
    const unmatched = [];
    const matchDetails = [];

    for (const expectedTool of expectedToolNames) {
      const paramIndex = expectedToolNames.indexOf(expectedTool);
      const toolExpectedParams = expectedParams
        ? Array.isArray(expectedParams)
          ? expectedParams[paramIndex]
          : expectedParams
        : null;

      const relevantExec = recentExecutions.find(exec => {
        if (!this.matchToolName(exec.toolName, expectedTool)) return false;
        if (exec.status !== 'completed') return false;
        if (now - exec.startTime >= timeoutMs) return false;
        if (toolExpectedParams && exec.parameters) {
          return this.hasCriticalParams(exec.parameters, toolExpectedParams);
        }
        return true;
      });

      if (relevantExec) {
        matched.push(expectedTool);
        matchDetails.push({ tool: expectedTool, execution: relevantExec, paramsVerified: !!toolExpectedParams });
      } else {
        unmatched.push(expectedTool);
      }
    }

    return { matched, unmatched, matchDetails };
  }

  async checkFileExists(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    try {
      if (window.electronAPI?.checkFileExists) {
        const result = await window.electronAPI.checkFileExists(filePath);
        const exists = result === true || result?.exists === true;
        console.log(`✅ [BenchmarkEvaluatorBase] electronAPI.checkFileExists(${filePath}): ${exists}`);
        return exists;
      }
    } catch (error) {
      console.log(`⚠️ [BenchmarkEvaluatorBase] electronAPI file check failed:`, error.message);
    }

    try {
      if (window.chatManager?.checkFileExists) {
        const result = await window.chatManager.checkFileExists(filePath);
        const exists = result === true || result?.exists === true;
        console.log(`✅ [BenchmarkEvaluatorBase] chatManager.checkFileExists(${filePath}): ${exists}`);
        return exists;
      }
    } catch (error) {
      console.log(`⚠️ [BenchmarkEvaluatorBase] chatManager file check failed:`, error.message);
    }

    console.log(`❌ [BenchmarkEvaluatorBase] Cannot verify file existence for: ${filePath}`);
    return false;
  }

  /**
   * Unified basic function call evaluation.
   *
   * This merges the divergent logic from AutomaticSimpleSuite, AutomaticComplexSuite,
   * ManualSuite, and ManualComplexSuite into one consistent implementation.
   *
   * @param {Object}  actualResult   - The actual result from LLM execution
   * @param {Object}  expectedResult - The expected result (must have tool_name)
   * @param {Object}  testResult     - The test result container (maxScore, etc.)
   * @param {Object}  [options={}]   - Suite-specific options
   * @param {number}  [options.defaultMaxScore=5] - Default maxScore if not in testResult
   * @param {number}  [options.successThreshold=0.6] - Fraction of maxScore to pass
   * @param {boolean} [options.useParseDebugInfo=false] - Whether to use parseDebugInfo (ComplexSuite)
   * @param {boolean} [options.useRoundCheck=true] - Whether to check toolCallRounds (SimpleSuite)
   * @param {boolean} [options.useStringSuccessPatterns=true] - Whether to check string success patterns
   * @param {boolean} [options.usePositionRangeConversion=true] - Whether to support position↔range conversion
   */
  async evaluateBasicFunctionCall(actualResult, expectedResult, testResult, options = {}) {
    const {
      defaultMaxScore = 5,
      successThreshold = 0.6,
      useParseDebugInfo = false,
      useRoundCheck = true,
      useStringSuccessPatterns = true,
      usePositionRangeConversion = true,
      maxParamDeduction = 1,
    } = options;

    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || defaultMaxScore,
      errors: [],
      warnings: [],
    };

    if (!actualResult) {
      evaluation.errors.push('No result obtained from test execution');
      return evaluation;
    }

    console.log(`📊 [BenchmarkEvaluatorBase] Evaluating test result:`, {
      testId: testResult.testId,
      expectedTool: expectedResult.tool_name,
      actualResultType: typeof actualResult,
    });

    // Extract tool names from actual result
    let actualTools = [];
    let actualTool = null;

    if (Array.isArray(actualResult)) {
      actualTools = actualResult.map(call => call?.tool_name).filter(Boolean);
      actualTool = actualTools[0];
    } else if (actualResult && typeof actualResult === 'object') {
      actualTool = actualResult.tool_name;
      actualTools = actualTool ? [actualTool] : [];
    }

    // Record debug info
    this._recordDebugEntry(testResult, expectedResult, actualTool, actualTools, actualResult);

    // ── Round check (from AutomaticSimpleSuite) ──
    if (useRoundCheck && testResult.detailedLogs?.toolCallHistory?.toolCallRounds) {
      const rounds = testResult.detailedLogs.toolCallHistory.toolCallRounds;
      for (const round of rounds) {
        if (round.tools && round.tools.includes(expectedResult.tool_name)) {
          evaluation.score = evaluation.maxScore;
          evaluation.success = true;
          evaluation.warnings.push(`Tool found in round ${round.current}/${rounds.length}`);
          return evaluation;
        }
      }
    }

    // ── PRIORITY 0: Tool Execution Tracker ──
    const earlyReturn = testResult.earlyReturn || false;
    const trackerResult = this.checkToolExecutionTracker(expectedResult.tool_name, undefined, earlyReturn);
    if (trackerResult.found) {
      if (trackerResult.status === 'completed') {
        evaluation.score = evaluation.maxScore;
        evaluation.success = true;
        evaluation.warnings.push('Awarded full points based on Tool Execution Tracker data');
        return evaluation;
      } else if (trackerResult.status === 'running') {
        evaluation.score = evaluation.maxScore;
        evaluation.success = true;
        evaluation.warnings.push('Tool submitted and running (earlyReturn: task accepted, not waiting for completion)');
        return evaluation;
      } else {
        evaluation.errors.push(`Tool execution failed: ${trackerResult.execution.error?.message || 'Unknown error'}`);
        return evaluation;
      }
    }

    // ── PRIORITY 0.5: ParseDebugInfo (from AutomaticComplexSuite) ──
    if (useParseDebugInfo && testResult.parseDebugInfo?.detectedTools?.length > 0) {
      const detectedTools = testResult.parseDebugInfo.detectedTools;
      const matchingTool = detectedTools.find(
        tool =>
          tool.tool === expectedResult.tool_name ||
          tool.tool.toLowerCase().includes(expectedResult.tool_name.toLowerCase()) ||
          expectedResult.tool_name.toLowerCase().includes(tool.tool.toLowerCase())
      );
      if (matchingTool) {
        actualTool = matchingTool.tool;
      } else {
        actualTool = detectedTools[0].tool;
      }
    }

    // ── PRIORITY 1: String success patterns ──
    if (useStringSuccessPatterns && typeof actualResult === 'string') {
      const successPatterns = [
        /tool execution completed.*succeeded/i,
        /successfully (executed|navigated|loaded|processed|analyzed)/i,
        /task completed successfully/i,
        /operation completed successfully/i,
        /results have been processed/i,
        /(file|reads|genome|annotation|variant).*loaded successfully/i,
        /I've successfully loaded/i,
      ];

      const hasSuccessSignal = successPatterns.some(pattern => pattern.test(actualResult));
      if (hasSuccessSignal) {
        const toolMentioned = actualResult.toLowerCase().includes(expectedResult.tool_name.toLowerCase());
        if (
          /tool execution completed.*succeeded/i.test(actualResult) ||
          /(file|reads|genome|annotation|variant).*loaded successfully|I've successfully loaded/i.test(actualResult) ||
          toolMentioned
        ) {
          evaluation.score = evaluation.maxScore;
          evaluation.success = true;
          evaluation.warnings.push('Awarded full points based on explicit success signal');
          return evaluation;
        }
      }
    }

    // ── PRIORITY 2: Check tool name match (with normalization) ──
    const toolMatch = this.matchToolName(actualTool, expectedResult.tool_name);
    if (actualTools.includes(expectedResult.tool_name)) {
      evaluation.score = evaluation.maxScore;
      actualTool = expectedResult.tool_name;
    } else if (toolMatch === 'exact') {
      evaluation.score = evaluation.maxScore;
    } else if (toolMatch === 'normalized') {
      evaluation.score = evaluation.maxScore;
      evaluation.warnings.push(`Tool name matched after normalization: ${actualTool} ≈ ${expectedResult.tool_name}`);
    } else if (!actualTool && typeof actualResult === 'string') {
      // Fallback: Parse tool call JSON from string
      try {
        const jsonMatch = actualResult.match(/\{[^{}]*"tool_name"[^{}]*\}/);
        if (jsonMatch) {
          const parsedTool = JSON.parse(jsonMatch[0]);
          const parsedMatch = this.matchToolName(parsedTool.tool_name, expectedResult.tool_name);
          if (parsedMatch) {
            actualTool = parsedTool.tool_name;
            evaluation.score = evaluation.maxScore;
            if (parsedMatch === 'normalized') {
              evaluation.warnings.push(`Parsed tool name matched after normalization`);
            }
          }
        }
      } catch (e) {
        /* ignore */
      }

      // Emergency fallback: check if expected tool name appears in string
      if (evaluation.score === 0 && actualResult.toLowerCase().includes(expectedResult.tool_name.toLowerCase())) {
        actualTool = expectedResult.tool_name;
        evaluation.score = evaluation.maxScore;
        evaluation.warnings.push('Awarded points based on string mention of expected tool');
      }
    } else if (!actualTool && actualResult && typeof actualResult === 'object') {
      // Check alternative property names
      actualTool =
        actualResult.function_call?.name ||
        actualResult.tool_call?.name ||
        actualResult.function_name ||
        actualResult.name;
      const altMatch = actualTool ? this.matchToolName(actualTool, expectedResult.tool_name) : false;
      if (altMatch) {
        evaluation.score = evaluation.maxScore;
        if (altMatch === 'normalized') {
          evaluation.warnings.push(`Alternative property tool name matched after normalization`);
        }
      }
    }

    if (evaluation.score === 0) {
      evaluation.errors.push(
        `Expected tool '${expectedResult.tool_name}' but got '${actualTool || 'none'}'. Available tools: [${actualTools.join(', ')}]`
      );
      evaluation.success = false;
      return evaluation;
    }

    // ── PRIORITY 3: Parameter validation ──
    let relevantToolCall = actualResult;
    if (Array.isArray(actualResult)) {
      relevantToolCall = actualResult.find(call => call?.tool_name === expectedResult.tool_name) || actualResult[0];
    }

    const actualParams = relevantToolCall?.parameters;
    if (actualParams && expectedResult.parameters) {
      const expectedKeys = Object.keys(expectedResult.parameters);
      const matchingKeys = expectedKeys.filter(key => {
        if (!(key in actualParams)) {
          // Omitting a parameter whose expected value is the tool default is equivalent
          // to sending it, so it must not be scored as a missing parameter.
          if (this.isSchemaDefaultExpectation(expectedResult.parameters[key])) return true;

          // Position ↔ Range conversion support
          if (usePositionRangeConversion) {
            if (key === 'position' && 'start' in actualParams && 'end' in actualParams) {
              const rangeCenter = Math.floor((actualParams.start + actualParams.end) / 2);
              const tolerance = Math.abs(actualParams.end - actualParams.start);
              return Math.abs(expectedResult.parameters[key] - rangeCenter) <= tolerance / 2;
            }
            if ((key === 'start' || key === 'end') && 'position' in actualParams) {
              const pos = actualParams.position;
              const val = expectedResult.parameters[key];
              if (key === 'start') {
                const end = expectedResult.parameters.end || val + 2000;
                return pos >= val && pos <= end;
              }
              if (key === 'end') {
                const start = expectedResult.parameters.start || val - 2000;
                return pos >= start && pos <= val;
              }
            }
          }
          console.log(`❌ Missing parameter: ${key}`);
          return false;
        }

        const actualValue = actualParams[key];
        const expectedValue = this.unwrapExpectedValue(expectedResult.parameters[key]);

        // Placeholder matches
        const isPlaceholder =
          expectedValue === '<current_chromosome>' ||
          expectedValue === '<lacZ_protein_sequence>' ||
          expectedValue === '<araA_protein_sequence>' ||
          (typeof expectedValue === 'string' && expectedValue.startsWith('<') && expectedValue.endsWith('>'));

        if (isPlaceholder) {
          if (expectedValue === '<current_chromosome>' && typeof actualValue === 'string' && actualValue.length > 0) {
            return true;
          }
          return true; // Other placeholders accept any non-undefined value
        }

        // Direct match
        if (actualValue === expectedValue) return true;

        // Case-insensitive string match
        if (typeof actualValue === 'string' && typeof expectedValue === 'string') {
          if (actualValue.toLowerCase() === expectedValue.toLowerCase()) return true;
          // High similarity match (Levenshtein)
          if (this.calculateStringSimilarity(actualValue, expectedValue) >= 0.8) return true;
        }

        return false;
      });

      const missingParams = expectedKeys.length - matchingKeys.length;
      if (missingParams > 0) {
        const deduction = Math.min(maxParamDeduction, missingParams);
        evaluation.score = Math.max(0, evaluation.score - deduction);
        evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect (-${deduction} pt)`);
      }
    }

    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * successThreshold);
    return evaluation;
  }

  // ─── Debug Recording ─────────────────────────────────────────────────────

  _recordDebugEntry(testResult, expectedResult, actualTool, actualTools, actualResult) {
    const debugEntry = {
      testId: testResult.testId,
      testName: testResult.testName || testResult.name || 'unknown',
      expectedTool: expectedResult.tool_name,
      actualTool,
      allDetectedTools: actualTools,
      actualResultType: typeof actualResult,
      isMultipleTools: Array.isArray(actualResult) && actualResult.length > 1,
      toolFoundInArray: actualTools.includes(expectedResult.tool_name),
      timestamp: new Date().toISOString(),
    };

    if (!window.songBenchmarkDebug) {
      window.songBenchmarkDebug = { detectedTools: [] };
    }
    window.songBenchmarkDebug.detectedTools = window.songBenchmarkDebug.detectedTools || [];
    window.songBenchmarkDebug.detectedTools.push(debugEntry);
  }

  // ─── Workflow Evaluation (shared across Complex suites) ──────────────────

  /**
   * Evaluate a workflow call by checking tool_sequence presence.
   */
  async evaluateWorkflowCall(actualResult, expectedResult, testResult, options = {}) {
    const { defaultMaxScore = 10, successThreshold = 0.4 } = options;
    const earlyReturn = testResult.earlyReturn || false;
    const evaluation = {
      success: false,
      score: 0,
      maxScore: testResult.maxScore || defaultMaxScore,
      errors: [],
      warnings: [],
    };

    if (!actualResult) {
      evaluation.errors.push('No result obtained from workflow execution');
      return evaluation;
    }

    // For earlyReturn workflows, check if any expected tool was submitted via tracker
    if (earlyReturn && expectedResult.tool_sequence) {
      const submittedTools = [];
      const failedTools = [];
      for (const expectedTool of expectedResult.tool_sequence) {
        const trackerCheck = this.checkToolExecutionTracker(expectedTool, undefined, true);
        if (trackerCheck.found && (trackerCheck.status === 'completed' || trackerCheck.status === 'running')) {
          submittedTools.push(expectedTool);
        } else if (trackerCheck.found && trackerCheck.status === 'failed') {
          failedTools.push(expectedTool);
        }
      }
      if (submittedTools.length === expectedResult.tool_sequence.length) {
        evaluation.score = evaluation.maxScore;
        evaluation.success = true;
        evaluation.warnings.push(
          `All ${submittedTools.length} workflow tools submitted (earlyReturn: not waiting for completion)`
        );
        return evaluation;
      } else if (submittedTools.length > 0) {
        const partialScore = Math.floor(
          evaluation.maxScore * (submittedTools.length / expectedResult.tool_sequence.length)
        );
        evaluation.score = partialScore;
        evaluation.success = partialScore >= Math.ceil(evaluation.maxScore * successThreshold);
        evaluation.warnings.push(
          `${submittedTools.length}/${expectedResult.tool_sequence.length} workflow tools submitted (earlyReturn)`
        );
        return evaluation;
      }
    }

    if (Array.isArray(actualResult) && actualResult.length > 1) {
      evaluation.score = Math.ceil(evaluation.maxScore * 0.5);

      if (expectedResult.tool_sequence) {
        const actualTools = actualResult.map(call => call.tool_name);
        const expectedTools = expectedResult.tool_sequence;

        let toolMatches = 0;
        expectedTools.forEach(expectedTool => {
          if (actualTools.includes(expectedTool)) {
            toolMatches++;
          }
        });

        if (expectedTools.length > 0) {
          const remainingPoints = evaluation.maxScore - evaluation.score;
          const toolScore = Math.floor(remainingPoints * (toolMatches / expectedTools.length));
          evaluation.score += toolScore;
        }
      }
    } else {
      const singleStepEval = await this.evaluateBasicFunctionCall(
        actualResult,
        {
          tool_name: expectedResult.tool_sequence?.[0] || expectedResult.tool_name,
          parameters: expectedResult.parameters?.[0] || expectedResult.parameters,
        },
        testResult,
        options
      );
      evaluation.score = singleStepEval.score;
      evaluation.errors = singleStepEval.errors;
      evaluation.warnings = singleStepEval.warnings;
    }

    evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * successThreshold);
    return evaluation;
  }

  // ─── Navigation Post-Check ───────────────────────────────────────────────

  addNavigationChecks(evaluation, actualResult) {
    if (actualResult && actualResult.parameters) {
      const params = actualResult.parameters;
      if (params.start && params.end && params.start > params.end) {
        evaluation.warnings.push('Start position should be less than end position');
      }
      if (params.start && params.end && params.end - params.start > 10000000) {
        evaluation.warnings.push('Range is very large (>10Mb), verify this is intentional');
      }
    }
    return evaluation;
  }

  // ─── Dynamic knownFunctions (Fix Problem 6) ──────────────────────────────

  /**
   * Get known function names, dynamically from builtInToolsMap when available,
   * falling back to a hardcoded default list.
   */
  getKnownFunctionNames() {
    if (this._cachedKnownFunctions) return this._cachedKnownFunctions;

    const builtInTools = [];
    // Try to get from ChatManager's builtInToolsMap
    if (window.chatManager && window.chatManager.builtInToolsMap) {
      try {
        for (const [toolName] of window.chatManager.builtInToolsMap) {
          builtInTools.push(toolName);
        }
      } catch (e) {
        console.warn('[BenchmarkEvaluatorBase] Failed to read builtInToolsMap:', e.message);
      }
    }

    // Also check the global tools_registry builtin_tools_integration
    if (builtInTools.length === 0 && typeof window.BuiltinToolsIntegration !== 'undefined') {
      try {
        const integration = window.BuiltinToolsIntegration;
        if (integration.builtInToolsMap) {
          for (const [toolName] of integration.builtInToolsMap) {
            builtInTools.push(toolName);
          }
        }
      } catch (e) {
        console.warn('[BenchmarkEvaluatorBase] Failed to read BuiltinToolsIntegration:', e.message);
      }
    }

    if (builtInTools.length > 0) {
      console.log(
        `✅ [BenchmarkEvaluatorBase] Loaded ${builtInTools.length} tool names dynamically from builtInToolsMap`
      );
      this._cachedKnownFunctions = builtInTools;
      return this._cachedKnownFunctions;
    }

    // Fallback: comprehensive hardcoded list (updated from the original 21 entries)
    console.warn('[BenchmarkEvaluatorBase] builtInToolsMap not available, using fallback known functions list');
    this._cachedKnownFunctions = [
      // Navigation
      'find_gene_by_name',
      'search_features',
      'search_by_position',
      'navigate_to_position',
      'jump_to_gene',
      'switch_chromosome',
      'zoom_in',
      'zoom_out',
      'set_zoom_level',
      // Sequence
      'get_gene_sequence',
      'get_sequence',
      'get_coding_sequence',
      'compute_gc',
      'reverse_complement',
      'translate_dna',
      'codon_usage_analysis',
      'genome_codon_usage_analysis',
      'search_sequence_motif',
      // File loading
      'load_genome_file',
      'load_annotation_file',
      'load_reads_file',
      'load_variant_file',
      'load_wig_tracks',
      'load_operon_file',
      // Export
      'export_fasta_sequence',
      'export_genbank_format',
      'export_gff_annotations',
      'export_bed_format',
      'export_cds_fasta',
      'export_protein_fasta',
      'export_current_view_fasta',
      // BLAST & External
      'run_blast_search',
      'uniprot_search',
      'alphafold_search',
      'search_pdb_structures',
      'search_alphafold_structures',
      // State & System
      'get_current_state',
      'set_working_directory',
      'show_gene_details',
      'save_current_view',
      'toggle_track_visibility',
      // Sequence editing
      'copy_sequence',
      'paste_sequence',
      'delete_sequence',
      'insert_sequence',
      'replace_sequence',
      'cut_sequence',
      'execute_actions',
      'get_action_list',
      'clear_actions',
      // UI
      'open_new_tab',
      'switch_to_tab',
    ];
    return this._cachedKnownFunctions;
  }

  /**
   * Invalidate the cached known functions (e.g., after tool registry changes).
   */
  invalidateKnownFunctionsCache() {
    this._cachedKnownFunctions = null;
  }
}

// Make available globally
window.BenchmarkEvaluatorBase = BenchmarkEvaluatorBase;
