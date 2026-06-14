// @ts-check
/**
 * CoScientistService exposes the independent Co-Scientist research system as
 * AI-callable tools in the ChatBox execution pipeline.
 */
class CoScientistService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  getSystem() {
    if (this.chatManager?.coScientistSystem) {
      return this.chatManager.coScientistSystem;
    }

    const SystemClass =
      (typeof window !== 'undefined' && window.CoScientistSystem) ||
      (typeof globalThis !== 'undefined' && globalThis.CoScientistSystem);

    if (typeof SystemClass !== 'function') {
      throw new Error('CoScientistSystem is not available');
    }

    const system = new SystemClass({
      app: this.app,
      chatManager: this.chatManager,
    });

    if (this.chatManager) {
      this.chatManager.coScientistSystem = system;
    }
    if (typeof window !== 'undefined') {
      window.coScientistSystem = system;
    }

    return system;
  }

  async startCoScientistSession(parameters = {}) {
    try {
      return this.getSystem().startSession(parameters);
    } catch (error) {
      return this.createErrorResult('start_co_scientist_session', error);
    }
  }

  async listCoScientistSessions(parameters = {}) {
    try {
      return this.getSystem().listSessions(parameters);
    } catch (error) {
      return this.createErrorResult('list_co_scientist_sessions', error);
    }
  }

  async addCoScientistEvidence(parameters = {}) {
    try {
      return this.getSystem().addEvidence(parameters);
    } catch (error) {
      return this.createErrorResult('add_co_scientist_evidence', error);
    }
  }

  async generateCoScientistHypotheses(parameters = {}) {
    try {
      return this.getSystem().generateHypotheses(parameters);
    } catch (error) {
      return this.createErrorResult('generate_co_scientist_hypotheses', error);
    }
  }

  async runCoScientistCycle(parameters = {}) {
    try {
      return this.getSystem().runCycle(parameters);
    } catch (error) {
      return this.createErrorResult('run_co_scientist_cycle', error);
    }
  }

  async getCoScientistReport(parameters = {}) {
    try {
      return this.getSystem().getReport(parameters);
    } catch (error) {
      return this.createErrorResult('get_co_scientist_report', error);
    }
  }

  createErrorResult(toolName, error) {
    console.error(`[CoScientistService] ${toolName} failed:`, error);
    return {
      success: false,
      toolName,
      error: error.message || String(error),
    };
  }
}

if (typeof window !== 'undefined') {
  window.CoScientistService = CoScientistService;
}

if (typeof globalThis !== 'undefined') {
  globalThis.CoScientistService = CoScientistService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CoScientistService;
}
