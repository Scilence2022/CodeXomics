// @ts-check
/**
 * CoScientistSystem - an independent scientific discovery agent system.
 *
 * The regular MultiAgentSystem remains focused on genome navigation, data access,
 * and analysis tools. CoScientistSystem manages long-horizon research sessions:
 * hypothesis generation, reflection, tournament ranking, proximity clustering,
 * evolution, meta-review, and scientist-in-the-loop feedback.
 */
class CoScientistSystem {
  constructor(options = {}) {
    this.app = options.app || null;
    this.chatManager = options.chatManager || null;
    this.storageKey = options.storageKey || 'codexomics.coScientist.sessions.v1';
    this.storage = options.storage || this.resolveStorage();
    this.now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
    this.idGenerator = typeof options.idGenerator === 'function' ? options.idGenerator : null;
    this.sessions = new Map();
    this.agentNames = [
      'SupervisorAgent',
      'GenerationAgent',
      'ReflectionAgent',
      'RankingAgent',
      'ProximityAgent',
      'EvolutionAgent',
      'MetaReviewAgent',
    ];

    this.loadSessions();
  }

  resolveStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage;
      }
    } catch (error) {
      console.warn('[CoScientistSystem] localStorage unavailable:', error.message);
    }
    return null;
  }

  startSession(parameters = {}) {
    const researchGoal = this.requireString(parameters.researchGoal || parameters.goal, 'researchGoal');
    const session = {
      id: this.createId('cosci'),
      researchGoal,
      domain: parameters.domain || 'biomedicine',
      status: 'active',
      createdAt: this.now(),
      updatedAt: this.now(),
      iteration: 0,
      constraints: this.normalizeStringArray(parameters.constraints),
      desiredAttributes: this.normalizeStringArray(parameters.desiredAttributes || parameters.attributes),
      safetyNotes: this.normalizeStringArray(parameters.safetyNotes),
      evidence: [],
      hypotheses: [],
      reviews: [],
      tournament: {
        matches: [],
        rankings: [],
      },
      proximityGraph: {
        nodes: [],
        edges: [],
        clusters: [],
      },
      memory: {
        context: [],
        metaReviewNotes: [],
        supervisorStats: {},
        feedback: [],
      },
      activityLog: [],
    };

    const initialEvidence = this.normalizeEvidenceInput(parameters.initialEvidence || parameters.evidence);
    initialEvidence.forEach(item => {
      session.evidence.push(this.createEvidenceRecord(item));
    });

    const seedIdeas = this.normalizeHypothesisInput(parameters.seedIdeas || parameters.hypotheses);
    seedIdeas.forEach(item => {
      session.hypotheses.push(this.createHypothesisRecord(session, item, 'scientist_seed'));
    });

    this.logActivity(session, 'SupervisorAgent', 'session_started', {
      researchGoal,
      evidenceCount: session.evidence.length,
      seedHypothesisCount: session.hypotheses.length,
    });
    this.updateSupervisorStats(session);
    this.sessions.set(session.id, session);
    this.persist();

    return {
      success: true,
      sessionId: session.id,
      session: this.toSessionSummary(session),
      agents: this.agentNames,
    };
  }

  listSessions(parameters = {}) {
    const includeArchived = parameters.includeArchived === true;
    const sessions = Array.from(this.sessions.values())
      .filter(session => includeArchived || session.status !== 'archived')
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(session => this.toSessionSummary(session));

    return {
      success: true,
      count: sessions.length,
      sessions,
    };
  }

  addEvidence(parameters = {}) {
    const session = this.getSession(parameters.sessionId);
    const evidenceItems = this.normalizeEvidenceInput(parameters.evidence || parameters.items || parameters);
    if (evidenceItems.length === 0) {
      throw new Error('Missing required parameter: evidence');
    }

    const records = evidenceItems.map(item =>
      this.createEvidenceRecord({
        ...item,
        evidenceType: item.evidenceType || parameters.evidenceType,
        source: item.source || parameters.source,
        reliability: item.reliability || parameters.reliability,
        direction: item.direction || parameters.direction,
      })
    );

    session.evidence.push(...records);

    if (parameters.feedback) {
      session.memory.feedback.push({
        id: this.createId('feedback'),
        content: String(parameters.feedback),
        createdAt: this.now(),
      });
    }

    this.touch(session);
    this.logActivity(session, 'SupervisorAgent', 'evidence_added', {
      evidenceIds: records.map(record => record.id),
      evidenceCount: session.evidence.length,
    });
    this.updateSupervisorStats(session);
    this.persist();

    return {
      success: true,
      sessionId: session.id,
      added: records.length,
      evidence: records,
      evidenceCount: session.evidence.length,
    };
  }

  generateHypotheses(parameters = {}) {
    const session = this.getSession(parameters.sessionId);
    const strategy = parameters.strategy || 'generation';
    const requestedCount = this.clampInteger(parameters.count, 1, 12, 3);
    const providedHypotheses = this.normalizeHypothesisInput(parameters.hypotheses || parameters.candidates);
    const focusAreas = this.normalizeStringArray(parameters.focusAreas);
    const generated = [];

    if (providedHypotheses.length > 0) {
      providedHypotheses.slice(0, requestedCount).forEach(item => {
        generated.push(this.createHypothesisRecord(session, item, strategy));
      });
    } else {
      const scaffolds = this.createHypothesisScaffolds(session, requestedCount, focusAreas, strategy);
      scaffolds.forEach(item => {
        generated.push(this.createHypothesisRecord(session, item, strategy));
      });
    }

    session.hypotheses.push(...generated);
    this.touch(session);
    this.logActivity(session, 'GenerationAgent', 'hypotheses_generated', {
      strategy,
      hypothesisIds: generated.map(item => item.id),
    });
    this.updateSupervisorStats(session);
    this.persist();

    return {
      success: true,
      sessionId: session.id,
      generated: generated.length,
      hypotheses: generated,
      supervisorStats: session.memory.supervisorStats,
    };
  }

  runCycle(parameters = {}) {
    const session = this.getSession(parameters.sessionId);
    const cycles = this.clampInteger(parameters.cycles, 1, 5, 1);
    const cycleSummaries = [];

    for (let index = 0; index < cycles; index += 1) {
      if (session.hypotheses.length === 0 || parameters.generateEachCycle === true) {
        const generationResult = this.generateHypotheses({
          sessionId: session.id,
          count: parameters.generateCount || 3,
          focusAreas: parameters.focusAreas,
          strategy: session.hypotheses.length === 0 ? 'generation' : 'continued_generation',
        });
        cycleSummaries.push({
          step: 'generation',
          generated: generationResult.generated,
          hypothesisIds: generationResult.hypotheses.map(item => item.id),
        });
      }

      const reviewed = this.reflect(session, parameters.reviewDepth || 'standard');
      const proximity = this.computeProximity(session);
      const ranking = this.rankHypotheses(session, {
        maxComparisons: parameters.maxComparisons,
      });
      const evolved = parameters.includeEvolution === false ? [] : this.evolveTopHypotheses(session, parameters);
      const metaReview = this.createMetaReview(session);

      session.iteration += 1;
      this.touch(session);
      this.updateSupervisorStats(session);

      cycleSummaries.push({
        step: 'cycle',
        iteration: session.iteration,
        reviewed: reviewed.length,
        matches: ranking.newMatches,
        evolved: evolved.length,
        proximityEdges: proximity.edges.length,
        topHypotheses: session.tournament.rankings.slice(0, 5),
        metaReview,
      });
    }

    this.persist();

    return {
      success: true,
      sessionId: session.id,
      iterations: session.iteration,
      cyclesRun: cycles,
      cycleSummaries,
      report: this.buildReport(session, {
        topN: parameters.topN || 5,
        includeEvidence: false,
      }),
    };
  }

  getReport(parameters = {}) {
    const session = this.getSession(parameters.sessionId);
    return {
      success: true,
      sessionId: session.id,
      report: this.buildReport(session, parameters),
    };
  }

  getSession(sessionId) {
    const id = this.requireString(sessionId, 'sessionId');
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Co-Scientist session not found: ${id}`);
    }
    return session;
  }

  createHypothesisRecord(session, input, strategy) {
    const normalized = typeof input === 'string' ? { statement: input } : { ...input };
    const statement = this.requireString(
      normalized.statement || normalized.hypothesis || normalized.title,
      'statement'
    );
    const title = normalized.title || this.createTitleFromStatement(statement);
    const now = this.now();

    return {
      id: this.createId('hyp'),
      title,
      statement,
      rationale: normalized.rationale || this.inferRationale(session, statement),
      proposedExperiment:
        normalized.proposedExperiment || normalized.experiment || this.inferExperiment(session, title),
      expectedObservation: normalized.expectedObservation || normalized.expectedResult || '',
      evidenceIds: this.normalizeStringArray(normalized.evidenceIds).filter(id =>
        session.evidence.some(record => record.id === id)
      ),
      status: 'draft',
      source: strategy,
      createdAt: now,
      updatedAt: now,
      iterationCreated: session.iteration,
      elo: Number.isFinite(normalized.elo) ? normalized.elo : 1000,
      criteriaScores: null,
      reviewIds: [],
      parentIds: this.normalizeStringArray(normalized.parentIds),
      noveltyAngle: normalized.noveltyAngle || '',
      riskNotes: this.normalizeStringArray(normalized.riskNotes),
    };
  }

  createEvidenceRecord(input) {
    const normalized = typeof input === 'string' ? { content: input } : { ...input };
    const content = this.requireString(normalized.content || normalized.summary || normalized.text, 'evidence.content');
    return {
      id: this.createId('ev'),
      evidenceType: normalized.evidenceType || normalized.type || 'literature',
      source: normalized.source || '',
      content,
      reliability: normalized.reliability || 'medium',
      direction: normalized.direction || 'neutral',
      notes: normalized.notes || '',
      createdAt: this.now(),
    };
  }

  createHypothesisScaffolds(session, count, focusAreas, strategy) {
    const evidenceTerms = this.extractFocusTerms(session);
    const terms = [...focusAreas, ...evidenceTerms, session.domain].filter(Boolean);
    const uniqueTerms = [...new Set(terms)].slice(0, Math.max(count, 3));
    const scaffolds = [];

    for (let index = 0; index < count; index += 1) {
      const term = uniqueTerms[index % uniqueTerms.length] || 'candidate mechanism';
      const title = `${this.capitalize(term)} hypothesis for ${session.domain}`;
      scaffolds.push({
        title,
        statement:
          `A testable ${session.domain} hypothesis should evaluate whether ${term} can explain or improve ` +
          `the research goal: ${session.researchGoal}`,
        rationale: `Generated by the ${strategy} strategy from the current research goal, constraints, and evidence memory.`,
        proposedExperiment:
          `Design a focused experiment or computational assay that perturbs or measures ${term} and compares it ` +
          `against a relevant control.`,
        evidenceIds: session.evidence.slice(-3).map(record => record.id),
      });
    }

    return scaffolds;
  }

  reflect(session, reviewDepth) {
    const reviewed = [];
    const candidateHypotheses = session.hypotheses.filter(
      hypothesis => hypothesis.reviewIds.length === 0 || reviewDepth === 'recurrent'
    );

    candidateHypotheses.forEach(hypothesis => {
      const review = this.reviewHypothesis(session, hypothesis, reviewDepth);
      session.reviews.push(review);
      hypothesis.reviewIds.push(review.id);
      hypothesis.criteriaScores = review.criteriaScores;
      hypothesis.status = review.criteriaScores.overall >= 0.62 ? 'reviewed' : 'needs_revision';
      hypothesis.updatedAt = this.now();
      reviewed.push(review);
    });

    if (reviewed.length > 0) {
      this.logActivity(session, 'ReflectionAgent', 'hypotheses_reviewed', {
        reviewDepth,
        reviewIds: reviewed.map(review => review.id),
      });
    }

    return reviewed;
  }

  reviewHypothesis(session, hypothesis, reviewDepth) {
    const linkedEvidence = hypothesis.evidenceIds
      .map(id => session.evidence.find(record => record.id === id))
      .filter(Boolean);
    const text = `${hypothesis.title} ${hypothesis.statement} ${hypothesis.rationale} ${hypothesis.proposedExperiment}`;
    const specificity = this.scoreSpecificity(text);
    const evidenceScore = this.scoreEvidence(linkedEvidence, session.evidence);
    const experimentScore = this.scoreExperiment(hypothesis.proposedExperiment);
    const safetyScore = this.scoreSafety(text, session.safetyNotes);
    const noveltyScore = this.scoreNovelty(hypothesis, session);
    const constraintScore = this.scoreConstraints(text, session.constraints);
    const plausibility = this.roundScore(0.35 + evidenceScore * 0.3 + specificity * 0.2 + constraintScore * 0.15);
    const testability = this.roundScore(0.25 + experimentScore * 0.55 + specificity * 0.2);
    const novelty = this.roundScore(noveltyScore);
    const safety = this.roundScore(safetyScore);
    const evidence = this.roundScore(evidenceScore);
    const overall = this.roundScore(
      plausibility * 0.25 + novelty * 0.2 + testability * 0.25 + safety * 0.15 + evidence * 0.15
    );
    const weaknesses = [];
    const recommendations = [];

    if (evidence < 0.45) {
      weaknesses.push('Limited explicit evidence is linked to this hypothesis.');
      recommendations.push('Add literature, assay, or dataset evidence before prioritizing wet-lab work.');
    }
    if (testability < 0.55) {
      weaknesses.push('The proposed validation path is underspecified.');
      recommendations.push('Define measurable endpoints, controls, and a falsification criterion.');
    }
    if (novelty < 0.5) {
      weaknesses.push('The hypothesis may be close to existing ideas in this session.');
      recommendations.push('Differentiate the mechanism, context, or intervention from nearby hypotheses.');
    }
    if (safety < 0.65) {
      weaknesses.push('Potential safety or ethics concerns require explicit review.');
      recommendations.push('Add containment, risk, or ethics constraints before execution.');
    }

    return {
      id: this.createId('rev'),
      hypothesisId: hypothesis.id,
      agent: 'ReflectionAgent',
      reviewDepth,
      createdAt: this.now(),
      criteriaScores: {
        plausibility,
        novelty,
        testability,
        safety,
        evidence,
        overall,
      },
      strengths: this.createStrengths(hypothesis, linkedEvidence),
      weaknesses,
      recommendations,
      evidenceIds: linkedEvidence.map(record => record.id),
    };
  }

  rankHypotheses(session, options = {}) {
    const hypotheses = session.hypotheses.filter(hypothesis => hypothesis.criteriaScores);
    if (hypotheses.length < 2) {
      session.tournament.rankings = this.createRankings(session);
      return { newMatches: 0, rankings: session.tournament.rankings };
    }

    const pairs = this.createTournamentPairs(session, hypotheses, options.maxComparisons);
    pairs.forEach(([left, right]) => {
      const match = this.comparePair(session, left, right);
      session.tournament.matches.push(match);
    });

    session.tournament.rankings = this.createRankings(session);
    this.logActivity(session, 'RankingAgent', 'tournament_ranked', {
      newMatches: pairs.length,
      rankedCount: session.tournament.rankings.length,
    });

    return {
      newMatches: pairs.length,
      rankings: session.tournament.rankings,
    };
  }

  createTournamentPairs(session, hypotheses, maxComparisons) {
    const ordered = hypotheses.slice().sort((a, b) => {
      const aScore = a.criteriaScores?.overall || 0;
      const bScore = b.criteriaScores?.overall || 0;
      return bScore - aScore;
    });
    const limit = this.clampInteger(maxComparisons, 1, 300, ordered.length <= 25 ? 300 : 60);
    const existing = new Set(session.tournament.matches.map(match => this.pairKey(match.leftId, match.rightId)));
    const pairs = [];

    for (let i = 0; i < ordered.length; i += 1) {
      for (let j = i + 1; j < ordered.length; j += 1) {
        const key = this.pairKey(ordered[i].id, ordered[j].id);
        if (existing.has(key)) continue;
        pairs.push([ordered[i], ordered[j]]);
        if (pairs.length >= limit) {
          return pairs;
        }
      }
    }

    return pairs;
  }

  comparePair(session, left, right) {
    const leftScore = this.comparisonScore(left);
    const rightScore = this.comparisonScore(right);
    const winner = leftScore >= rightScore ? left : right;
    const loser = winner.id === left.id ? right : left;
    const margin = Math.abs(leftScore - rightScore);
    const eloChange = this.updateElo(winner, loser, margin);

    return {
      id: this.createId('match'),
      agent: 'RankingAgent',
      createdAt: this.now(),
      leftId: left.id,
      rightId: right.id,
      winnerId: winner.id,
      loserId: loser.id,
      rationale:
        `Winner selected by weighted review criteria with margin ${margin.toFixed(3)}. ` +
        `Plausibility, novelty, testability, safety, and evidence scores were considered.`,
      eloChange,
    };
  }

  updateElo(winner, loser, margin) {
    const k = margin > 0.2 ? 40 : 24;
    const expectedWinner = 1 / (1 + Math.pow(10, (loser.elo - winner.elo) / 400));
    const change = Math.round(k * (1 - expectedWinner));
    winner.elo += change;
    loser.elo -= change;
    winner.updatedAt = this.now();
    loser.updatedAt = this.now();
    return change;
  }

  computeProximity(session) {
    const nodes = session.hypotheses.map(hypothesis => ({
      id: hypothesis.id,
      title: hypothesis.title,
    }));
    const edges = [];

    for (let i = 0; i < session.hypotheses.length; i += 1) {
      for (let j = i + 1; j < session.hypotheses.length; j += 1) {
        const left = session.hypotheses[i];
        const right = session.hypotheses[j];
        const similarity = this.jaccardSimilarity(
          this.tokenize(`${left.title} ${left.statement}`),
          this.tokenize(`${right.title} ${right.statement}`)
        );
        if (similarity >= 0.22) {
          edges.push({
            source: left.id,
            target: right.id,
            similarity: this.roundScore(similarity),
          });
        }
      }
    }

    const clusters = this.createClusters(nodes, edges);
    session.proximityGraph = { nodes, edges, clusters };
    this.logActivity(session, 'ProximityAgent', 'proximity_graph_updated', {
      nodes: nodes.length,
      edges: edges.length,
      clusters: clusters.length,
    });

    return session.proximityGraph;
  }

  evolveTopHypotheses(session, parameters = {}) {
    const count = this.clampInteger(parameters.evolutionCount, 0, 5, 2);
    if (count === 0) return [];

    const topRankings = session.tournament.rankings.slice(0, count);
    const evolved = [];

    topRankings.forEach(ranking => {
      const parent = session.hypotheses.find(hypothesis => hypothesis.id === ranking.hypothesisId);
      if (!parent || !parent.criteriaScores) return;

      const latestReview = this.getLatestReview(session, parent);
      const recommendations = latestReview?.recommendations || [];
      const statement = `${parent.statement} This evolved version explicitly addresses ${
        recommendations[0] || 'evidence grounding and experimental validation'
      }.`;
      const evolvedHypothesis = this.createHypothesisRecord(
        session,
        {
          title: `${parent.title} (evolved)`,
          statement,
          rationale:
            `${parent.rationale} The EvolutionAgent refined this candidate using review feedback, tournament ` +
            `rankings, and proximity context.`,
          proposedExperiment:
            parent.proposedExperiment ||
            'Define a controlled validation assay with measurable endpoints and negative controls.',
          evidenceIds: parent.evidenceIds,
          parentIds: [parent.id],
          noveltyAngle: parent.noveltyAngle,
        },
        'evolution'
      );
      evolved.push(evolvedHypothesis);
    });

    session.hypotheses.push(...evolved);
    if (evolved.length > 0) {
      this.logActivity(session, 'EvolutionAgent', 'hypotheses_evolved', {
        hypothesisIds: evolved.map(hypothesis => hypothesis.id),
      });
    }

    return evolved;
  }

  createMetaReview(session) {
    const recentReviews = session.reviews.slice(-Math.max(3, session.hypotheses.length));
    const issueCounts = new Map();

    recentReviews.forEach(review => {
      review.weaknesses.forEach(weakness => {
        issueCounts.set(weakness, (issueCounts.get(weakness) || 0) + 1);
      });
    });

    const recurringIssues = Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([issue, count]) => ({ issue, count }));
    const guidance = [];

    if (recurringIssues.some(item => item.issue.includes('evidence'))) {
      guidance.push('Prioritize evidence-grounded hypotheses and request literature or dataset support.');
    }
    if (recurringIssues.some(item => item.issue.includes('validation') || item.issue.includes('underspecified'))) {
      guidance.push('Require concrete assays, controls, measurable endpoints, and falsification criteria.');
    }
    if (recurringIssues.some(item => item.issue.includes('existing ideas'))) {
      guidance.push('Use proximity clusters to diversify mechanisms and remove near-duplicates.');
    }
    if (guidance.length === 0) {
      guidance.push('Continue tournament exploration while preserving scientist feedback and safety constraints.');
    }

    const note = {
      id: this.createId('meta'),
      agent: 'MetaReviewAgent',
      createdAt: this.now(),
      recurringIssues,
      guidance,
    };

    session.memory.metaReviewNotes.push(note);
    this.logActivity(session, 'MetaReviewAgent', 'meta_review_created', {
      noteId: note.id,
      recurringIssueCount: recurringIssues.length,
    });

    return note;
  }

  buildReport(session, parameters = {}) {
    const topN = this.clampInteger(parameters.topN, 1, 20, 5);
    const includeEvidence = parameters.includeEvidence === true;
    const rankings =
      session.tournament.rankings.length > 0 ? session.tournament.rankings : this.createRankings(session);
    const topHypotheses = rankings.slice(0, topN).map(ranking => {
      const hypothesis = session.hypotheses.find(item => item.id === ranking.hypothesisId);
      const latestReview = hypothesis ? this.getLatestReview(session, hypothesis) : null;
      return {
        ...ranking,
        hypothesis,
        latestReview,
      };
    });

    return {
      summary: this.toSessionSummary(session),
      topHypotheses,
      tournament: {
        matchCount: session.tournament.matches.length,
        rankings,
      },
      proximityGraph: session.proximityGraph,
      metaReview: session.memory.metaReviewNotes.slice(-1)[0] || null,
      nextActions: this.createNextActions(session),
      evidence: includeEvidence ? session.evidence : undefined,
      activityLog: parameters.includeActivityLog === true ? session.activityLog : undefined,
    };
  }

  createRankings(session) {
    return session.hypotheses
      .slice()
      .sort((a, b) => {
        const aOverall = a.criteriaScores?.overall || 0;
        const bOverall = b.criteriaScores?.overall || 0;
        if (b.elo !== a.elo) return b.elo - a.elo;
        return bOverall - aOverall;
      })
      .map((hypothesis, index) => ({
        rank: index + 1,
        hypothesisId: hypothesis.id,
        title: hypothesis.title,
        elo: hypothesis.elo,
        overall: hypothesis.criteriaScores?.overall || null,
        status: hypothesis.status,
      }));
  }

  createNextActions(session) {
    const actions = [];
    if (session.evidence.length === 0) {
      actions.push('Add literature, dataset, or experimental evidence to ground the first hypothesis cycle.');
    }
    if (session.hypotheses.length === 0) {
      actions.push('Generate or seed candidate hypotheses for the research goal.');
    }
    if (session.hypotheses.some(hypothesis => hypothesis.status === 'needs_revision')) {
      actions.push('Evolve low-scoring hypotheses using review recommendations.');
    }
    if (session.tournament.rankings.length > 0) {
      actions.push('Select top-ranked hypotheses for scientist review and experimental planning.');
    }
    if (actions.length === 0) {
      actions.push('Run another Co-Scientist cycle or add scientist feedback from new experiments.');
    }
    return actions;
  }

  toSessionSummary(session) {
    return {
      id: session.id,
      researchGoal: session.researchGoal,
      domain: session.domain,
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      iteration: session.iteration,
      evidenceCount: session.evidence.length,
      hypothesisCount: session.hypotheses.length,
      reviewCount: session.reviews.length,
      tournamentMatchCount: session.tournament.matches.length,
      topHypothesis: session.tournament.rankings[0] || null,
      supervisorStats: session.memory.supervisorStats,
    };
  }

  updateSupervisorStats(session) {
    const reviewed = session.hypotheses.filter(hypothesis => hypothesis.reviewIds.length > 0).length;
    const needsRevision = session.hypotheses.filter(hypothesis => hypothesis.status === 'needs_revision').length;
    const evolved = session.hypotheses.filter(hypothesis => hypothesis.source === 'evolution').length;
    session.memory.supervisorStats = {
      agents: this.agentNames,
      evidenceCount: session.evidence.length,
      hypothesisCount: session.hypotheses.length,
      reviewedHypothesisCount: reviewed,
      needsRevisionCount: needsRevision,
      evolvedHypothesisCount: evolved,
      tournamentMatchCount: session.tournament.matches.length,
      proximityEdgeCount: session.proximityGraph.edges.length,
      metaReviewCount: session.memory.metaReviewNotes.length,
      lastUpdatedAt: this.now(),
    };
  }

  normalizeEvidenceInput(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(item => (typeof item === 'string' ? { content: item } : item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return [{ content: value }];
    }
    if (typeof value === 'object' && (value.content || value.summary || value.text)) {
      return [value];
    }
    return [];
  }

  normalizeHypothesisInput(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(item => (typeof item === 'string' ? { statement: item } : item)).filter(Boolean);
    }
    if (typeof value === 'string') {
      return [{ statement: value }];
    }
    if (typeof value === 'object' && (value.statement || value.hypothesis || value.title)) {
      return [value];
    }
    return [];
  }

  normalizeStringArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map(item => (item === undefined || item === null ? '' : String(item).trim())).filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/[;\n]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [String(value).trim()].filter(Boolean);
  }

  inferRationale(session, statement) {
    const evidence = session.evidence
      .slice(-2)
      .map(record => record.content)
      .join(' ');
    if (evidence) {
      return `The hypothesis connects the research goal to recent evidence in the session memory: ${evidence.slice(0, 240)}`;
    }
    return `The hypothesis is aligned with the research goal: ${session.researchGoal}`;
  }

  inferExperiment(session, title) {
    const constraintText = session.constraints.length ? ` while respecting ${session.constraints.join(', ')}` : '';
    return `Design a controlled assay or computational analysis to test "${title}"${constraintText}.`;
  }

  createTitleFromStatement(statement) {
    const trimmed = statement.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= 72) return trimmed;
    return `${trimmed.slice(0, 69).trim()}...`;
  }

  extractFocusTerms(session) {
    const text = [session.researchGoal, ...session.evidence.map(record => record.content)].join(' ');
    const tokens = this.tokenize(text).filter(token => token.length > 4);
    const counts = new Map();
    tokens.forEach(token => counts.set(token, (counts.get(token) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([token]) => token);
  }

  scoreSpecificity(text) {
    const tokens = this.tokenize(text);
    const hasNumbers = /\d/.test(text);
    const hasMechanismWords = /\b(mechanism|pathway|target|assay|gene|protein|cell|model|control|endpoint)\b/i.test(
      text
    );
    return this.roundScore(Math.min(1, tokens.length / 80 + (hasNumbers ? 0.12 : 0) + (hasMechanismWords ? 0.18 : 0)));
  }

  scoreEvidence(linkedEvidence, allEvidence) {
    if (linkedEvidence.length === 0 && allEvidence.length === 0) return 0.25;
    if (linkedEvidence.length === 0) return 0.35;
    const reliability = linkedEvidence.reduce((sum, item) => sum + this.reliabilityScore(item.reliability), 0);
    return this.roundScore(Math.min(1, 0.35 + reliability / Math.max(3, linkedEvidence.length * 2)));
  }

  reliabilityScore(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized === 'high') return 1;
    if (normalized === 'low') return 0.35;
    return 0.65;
  }

  scoreExperiment(experiment) {
    if (!experiment) return 0.15;
    const text = String(experiment);
    let score = 0.25;
    if (/\b(assay|experiment|analysis|screen|model|rna-seq|flow|validation|measure|perturb)\b/i.test(text))
      score += 0.3;
    if (/\b(control|endpoint|replicate|statistical|compare|baseline|dose|time)\b/i.test(text)) score += 0.25;
    if (text.length > 120) score += 0.15;
    return this.roundScore(Math.min(1, score));
  }

  scoreSafety(text, safetyNotes) {
    let score = safetyNotes.length > 0 ? 0.82 : 0.75;
    if (/\b(pathogen|toxin|virulence|gain.of.function|human subject|clinical|animal)\b/i.test(text)) {
      score -= 0.2;
    }
    if (/\b(containment|ethics|safety|irb|approval|non-pathogenic|risk)\b/i.test(text)) {
      score += 0.12;
    }
    return this.roundScore(Math.max(0.1, Math.min(1, score)));
  }

  scoreNovelty(hypothesis, session) {
    const currentTokens = this.tokenize(`${hypothesis.title} ${hypothesis.statement}`);
    const others = session.hypotheses.filter(item => item.id !== hypothesis.id);
    if (others.length === 0) return 0.72;
    const maxSimilarity = Math.max(
      ...others.map(item => this.jaccardSimilarity(currentTokens, this.tokenize(`${item.title} ${item.statement}`)))
    );
    return this.roundScore(Math.max(0.2, 0.9 - maxSimilarity));
  }

  scoreConstraints(text, constraints) {
    if (constraints.length === 0) return 0.65;
    const lower = text.toLowerCase();
    const matched = constraints.filter(constraint => {
      const words = this.tokenize(constraint);
      return words.some(word => lower.includes(word));
    }).length;
    return this.roundScore(Math.min(1, 0.45 + matched / constraints.length));
  }

  createStrengths(hypothesis, linkedEvidence) {
    const strengths = [];
    if (linkedEvidence.length > 0) strengths.push('Links to evidence already present in the session memory.');
    if (hypothesis.proposedExperiment) strengths.push('Includes a proposed validation route.');
    if (hypothesis.parentIds.length > 0)
      strengths.push('Carries forward tournament and review feedback from a parent hypothesis.');
    if (strengths.length === 0)
      strengths.push('Addresses the stated research goal and can be refined in later cycles.');
    return strengths;
  }

  comparisonScore(hypothesis) {
    const scores = hypothesis.criteriaScores || {};
    return (
      (scores.overall || 0) * 0.55 +
      (scores.testability || 0) * 0.15 +
      (scores.novelty || 0) * 0.12 +
      (scores.evidence || 0) * 0.1 +
      (hypothesis.elo || 1000) / 10000
    );
  }

  getLatestReview(session, hypothesis) {
    const reviewIds = new Set(hypothesis.reviewIds || []);
    return session.reviews
      .filter(review => reviewIds.has(review.id))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  }

  createClusters(nodes, edges) {
    const parent = new Map(nodes.map(node => [node.id, node.id]));
    const find = id => {
      let current = id;
      while (parent.get(current) !== current) {
        current = parent.get(current);
      }
      return current;
    };
    const union = (a, b) => {
      const rootA = find(a);
      const rootB = find(b);
      if (rootA !== rootB) parent.set(rootB, rootA);
    };

    edges.forEach(edge => union(edge.source, edge.target));
    const groups = new Map();
    nodes.forEach(node => {
      const root = find(node.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(node.id);
    });

    return Array.from(groups.values()).map((hypothesisIds, index) => ({
      id: `cluster_${index + 1}`,
      hypothesisIds,
      size: hypothesisIds.length,
    }));
  }

  tokenize(text) {
    const stopWords = new Set([
      'the',
      'and',
      'for',
      'with',
      'that',
      'this',
      'from',
      'into',
      'will',
      'should',
      'could',
      'would',
      'hypothesis',
      'research',
      'goal',
      'testable',
    ]);
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2 && !stopWords.has(token));
  }

  jaccardSimilarity(leftTokens, rightTokens) {
    const left = new Set(leftTokens);
    const right = new Set(rightTokens);
    if (left.size === 0 || right.size === 0) return 0;
    let intersection = 0;
    left.forEach(token => {
      if (right.has(token)) intersection += 1;
    });
    const union = new Set([...left, ...right]).size;
    return union === 0 ? 0 : intersection / union;
  }

  pairKey(leftId, rightId) {
    return [leftId, rightId].sort().join('::');
  }

  logActivity(session, agent, event, detail = {}) {
    session.activityLog.push({
      id: this.createId('log'),
      agent,
      event,
      detail,
      createdAt: this.now(),
    });
  }

  touch(session) {
    session.updatedAt = this.now();
  }

  persist() {
    if (!this.storage || typeof this.storage.setItem !== 'function') return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(Array.from(this.sessions.values())));
    } catch (error) {
      console.warn('[CoScientistSystem] Failed to persist sessions:', error.message);
    }
  }

  loadSessions() {
    if (!this.storage || typeof this.storage.getItem !== 'function') return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      parsed.forEach(session => {
        if (session && session.id) {
          this.sessions.set(session.id, this.migrateSession(session));
        }
      });
    } catch (error) {
      console.warn('[CoScientistSystem] Failed to load persisted sessions:', error.message);
    }
  }

  migrateSession(session) {
    return {
      ...session,
      evidence: Array.isArray(session.evidence) ? session.evidence : [],
      hypotheses: Array.isArray(session.hypotheses) ? session.hypotheses : [],
      reviews: Array.isArray(session.reviews) ? session.reviews : [],
      tournament: session.tournament || { matches: [], rankings: [] },
      proximityGraph: session.proximityGraph || { nodes: [], edges: [], clusters: [] },
      memory: {
        context: [],
        metaReviewNotes: [],
        supervisorStats: {},
        feedback: [],
        ...(session.memory || {}),
      },
      activityLog: Array.isArray(session.activityLog) ? session.activityLog : [],
    };
  }

  createId(prefix) {
    if (this.idGenerator) return this.idGenerator(prefix);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${random}`;
  }

  requireString(value, name) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value.trim();
  }

  clampInteger(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  roundScore(value) {
    return Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
  }

  capitalize(value) {
    const text = String(value || '');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
}

if (typeof window !== 'undefined') {
  window.CoScientistSystem = CoScientistSystem;
}

if (typeof globalThis !== 'undefined') {
  globalThis.CoScientistSystem = CoScientistSystem;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoScientistSystem;
}
