/* eslint-disable no-undef */
/**
 * primer-binding-worker.js
 * Off-main-thread whole-chromosome primer binding-site scanning.
 *
 * Loaded as a classic Web Worker by PrimerBindingService. It imports the shared
 * PrimerDesigner engine (whose export guards no-op outside window/module, leaving
 * the class as a worker global) and answers scan jobs without blocking the UI.
 */
try {
  importScripts('../PrimerDesigner.js');
} catch (e) {
  // If the engine cannot be loaded, fail every job so the main thread falls back
  // to its synchronous compute path.
}

self.onmessage = function (e) {
  const { jobId, primerSequence, template, stringency } = e.data || {};
  try {
    if (typeof PrimerDesigner === 'undefined') {
      throw new Error('PrimerDesigner engine unavailable in worker');
    }
    const sites = PrimerDesigner.findBindingSites(primerSequence, template, stringency.maxMismatches, {
      max3PrimeMismatches: stringency.max3PrimeMismatches,
      minBindingTm: stringency.minBindingTm,
      scoringMode: stringency.scoringMode,
      naConcentration: stringency.naConcentration,
      primerConcentration: stringency.primerConcentration,
    });
    self.postMessage({ jobId, ok: true, sites });
  } catch (err) {
    self.postMessage({ jobId, ok: false, error: String((err && err.message) || err) });
  }
};
