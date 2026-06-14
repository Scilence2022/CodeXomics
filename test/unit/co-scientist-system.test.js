import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const CoScientistSystem = require('../../src/renderer/modules/CoScientistSystem.js');

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: key => {
      store.delete(key);
    },
  };
}

function createSystem(storage = createMemoryStorage()) {
  let idCounter = 0;
  let timeCounter = 0;
  return new CoScientistSystem({
    storage,
    idGenerator: prefix => `${prefix}_${++idCounter}`,
    now: () => `2026-06-14T00:00:${String(++timeCounter).padStart(2, '0')}.000Z`,
  });
}

describe('CoScientistSystem', () => {
  let system;

  beforeEach(() => {
    system = createSystem();
  });

  it('starts an independent research session with evidence and seed ideas', () => {
    const result = system.startSession({
      researchGoal: 'Find testable mechanisms for dry AMD therapeutic repurposing',
      domain: 'biomedicine',
      constraints: ['in vitro assay ready'],
      initialEvidence: ['RPE phagocytosis can be quantified with flow cytometry.'],
      seedIdeas: ['ROCK inhibition may increase RPE phagocytic capacity.'],
    });

    expect(result.success).toBe(true);
    expect(result.sessionId).toBe('cosci_1');
    expect(result.session.evidenceCount).toBe(1);
    expect(result.session.hypothesisCount).toBe(1);
    expect(result.agents).toContain('ReflectionAgent');
    expect(result.agents).toContain('MetaReviewAgent');
  });

  it('runs reflection, proximity, tournament ranking, evolution, and meta-review in one cycle', () => {
    const session = system.startSession({
      researchGoal: 'Identify antimicrobial resistance transfer mechanisms',
      domain: 'microbiology',
      initialEvidence: [
        {
          content: 'Capsid-forming islands can interact with phage components across hosts.',
          reliability: 'high',
          evidenceType: 'literature',
        },
      ],
    });

    const generated = system.generateHypotheses({
      sessionId: session.sessionId,
      hypotheses: [
        {
          title: 'Tail borrowing expands host range',
          statement: 'cf-PICIs expand host range by borrowing compatible phage tail modules.',
          proposedExperiment: 'Compare transfer efficiency with tail module knockouts and host-range controls.',
        },
        {
          title: 'Envelope stress increases transfer',
          statement: 'Envelope stress increases cf-PICI packaging and interspecies transfer.',
          proposedExperiment: 'Measure transfer under controlled envelope stress with untreated controls.',
        },
      ],
    });

    expect(generated.generated).toBe(2);

    const cycle = system.runCycle({
      sessionId: session.sessionId,
      cycles: 1,
      includeEvolution: true,
      evolutionCount: 1,
    });

    expect(cycle.success).toBe(true);
    expect(cycle.iterations).toBe(1);
    expect(cycle.report.summary.reviewCount).toBeGreaterThanOrEqual(2);
    expect(cycle.report.tournament.matchCount).toBeGreaterThanOrEqual(1);
    expect(cycle.report.proximityGraph.nodes.length).toBeGreaterThanOrEqual(2);
    expect(cycle.report.metaReview.guidance.length).toBeGreaterThanOrEqual(1);
    expect(cycle.report.topHypotheses.length).toBeGreaterThanOrEqual(1);
    expect(cycle.report.summary.hypothesisCount).toBeGreaterThan(2);
  });

  it('adds scientist feedback as persistent evidence and produces reports', () => {
    const session = system.startSession({
      researchGoal: 'Prioritize AML drug repurposing candidates',
    });

    const evidence = system.addEvidence({
      sessionId: session.sessionId,
      evidence: 'A candidate should be selective at clinically relevant concentrations.',
      evidenceType: 'feedback',
      reliability: 'high',
      feedback: 'Prefer hypotheses that can be tested in short-term cytotoxicity assays.',
    });

    expect(evidence.success).toBe(true);
    expect(evidence.added).toBe(1);

    system.generateHypotheses({ sessionId: session.sessionId, count: 2 });
    system.runCycle({ sessionId: session.sessionId, includeEvolution: false });

    const report = system.getReport({
      sessionId: session.sessionId,
      includeEvidence: true,
    });

    expect(report.success).toBe(true);
    expect(report.report.evidence).toHaveLength(1);
    expect(report.report.nextActions.length).toBeGreaterThanOrEqual(1);
  });

  it('persists sessions through storage', () => {
    const storage = createMemoryStorage();
    const first = createSystem(storage);
    const created = first.startSession({
      researchGoal: 'Discover fibrosis target hypotheses',
    });

    const second = createSystem(storage);
    const listed = second.listSessions();

    expect(listed.count).toBe(1);
    expect(listed.sessions[0].id).toBe(created.sessionId);
    expect(listed.sessions[0].researchGoal).toContain('fibrosis');
  });
});
