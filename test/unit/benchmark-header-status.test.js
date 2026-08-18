/**
 * Collapsing the benchmark interface hides the progress panel, which is exactly
 * when a long run gets left unattended. These tests cover the digest the header
 * shows in its place: run state, progress, pass/fail tally, elapsed time, and
 * the test currently in flight.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/renderer/modules/BenchmarkUI.js';

describe('collapsed benchmark header status', () => {
  let ui;

  beforeEach(() => {
    document.body.innerHTML = '<div class="benchmark-header-status" id="benchmarkHeaderStatus"></div>';

    ui = Object.create(window.BenchmarkUI.prototype);
    ui.runStats = ui.createEmptyRunStats();
    ui.framework = { totalTestCount: 0, getTotalTestCount: () => 40 };
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  const status = () => document.getElementById('benchmarkHeaderStatus');

  it('reports what is loaded before a run starts', () => {
    ui.updateHeaderStatus();

    expect(status().textContent).toContain('Idle');
    expect(status().textContent).toContain('40 tests loaded');
    // No run, no tally — a 0/0 (NaN%) line would be worse than nothing.
    expect(status().textContent).not.toContain('%');
  });

  it('shows progress, tally, elapsed time and the test in flight while running', () => {
    ui.framework.totalTestCount = 24;
    ui.startTime = Date.now() - 121_000;
    ui.setRunState('running');
    ui.runStats.currentTest = 'navigate_to_gene';
    ui.updateIndividualTestCount({ success: true });
    ui.updateIndividualTestCount({ success: true });
    ui.updateIndividualTestCount({ success: false });
    ui.updateHeaderStatus();

    const text = status().textContent;
    expect(text).toContain('Running');
    expect(text).toContain('3/24 (13%)');
    expect(text).toContain('✅ 2');
    expect(text).toContain('❌ 1');
    expect(text).toContain('02:01');
    expect(text).toContain('navigate_to_gene');
  });

  it('drops the in-flight test once the run is no longer running', () => {
    ui.framework.totalTestCount = 2;
    ui.setRunState('running');
    ui.runStats.currentTest = 'navigate_to_gene';
    ui.updateIndividualTestCount({ success: true });
    ui.updateIndividualTestCount({ success: true });

    ui.setRunState('completed');

    const text = status().textContent;
    expect(text).toContain('Completed');
    expect(text).toContain('2/2 (100%)');
    expect(text).not.toContain('navigate_to_gene');
  });

  it('keeps the tally visible after a manual stop', () => {
    ui.framework.totalTestCount = 10;
    ui.setRunState('running');
    ui.updateIndividualTestCount({ success: false });

    ui.setRunState('stopped');

    expect(status().textContent).toContain('Stopped');
    expect(status().textContent).toContain('1/10 (10%)');
    expect(status().textContent).toContain('❌ 1');
  });

  it('escapes the test id rather than injecting it as markup', () => {
    ui.framework.totalTestCount = 1;
    ui.setRunState('running');
    ui.runStats.currentTest = '<img src=x onerror=alert(1)>';
    ui.updateHeaderStatus();

    expect(status().querySelector('img')).toBeNull();
    expect(status().textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('keeps a quoted test id inside its title attribute', () => {
    ui.framework.totalTestCount = 1;
    ui.setRunState('running');
    ui.runStats.currentTest = 'say "hi" onmouseover=alert(1)';
    ui.updateHeaderStatus();

    const current = status().querySelector('.status-current');
    expect(current.getAttribute('title')).toBe('say "hi" onmouseover=alert(1)');
    expect(current.hasAttribute('onmouseover')).toBe(false);
  });

  it('repaints from the progress callback the framework actually drives', () => {
    ui.framework.totalTestCount = 4;
    ui.startTime = Date.now();
    ui.setRunState('running');

    ui.updateMainWindowTestProgress(0.25, 'load_genome', { status: 'passed', success: true }, 'automatic_simple');

    const text = status().textContent;
    expect(text).toContain('1/4 (25%)');
    expect(text).toContain('✅ 1');
    expect(text).toContain('load_genome');
  });

  it('survives a missing framework, reporting the run from its own tally', () => {
    ui.framework = null;
    ui.setRunState('running');
    ui.updateIndividualTestCount({ success: true });
    ui.updateHeaderStatus();

    expect(status().textContent).toContain('Running');
    expect(status().textContent).toContain('✅ 1');
  });

  it('does nothing when the header is not on screen', () => {
    document.body.innerHTML = '';

    expect(() => ui.updateHeaderStatus()).not.toThrow();
  });
});
