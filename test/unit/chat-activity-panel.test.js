/**
 * The activity panel (formerly "AI Thinking Process") groups each round into a
 * collapsible block and collapses itself to a summary line when the request
 * finishes. These tests cover the grouping, the summaries, the failure
 * exemption that keeps detail on screen when it matters, the compact detail
 * level, and the sticky expand/collapse preference.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ChatManager from '../../src/renderer/modules/ChatManager.js';

describe('activity panel', () => {
  let cm;
  let settings;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chatMessages"></div>';

    settings = {};
    cm = Object.create(ChatManager.prototype);
    cm.showThinkingProcess = true;
    cm.autoScrollToBottom = false;
    cm.showTimestamps = false;
    cm.activityDetailLevel = 'detailed';
    cm.activityAutoCollapse = true;
    cm.activityRoundState = null;
    cm.activityTotals = { rounds: 0, tools: 0, failures: 0 };
    cm.conversationState = { currentRequestId: 'req1', startTime: Date.now() };
    cm.addToEvolutionData = vi.fn();
    cm.chatBoxSettingsManager = {
      setSetting: vi.fn((key, value) => {
        settings[key] = value;
      }),
    };
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const panel = () => document.querySelector('.thinking-process');
  const rounds = () => [...document.querySelectorAll('.activity-round')];

  describe('round grouping', () => {
    it('routes steps into the round group that is currently open', () => {
      cm.addThinkingMessage('preamble');

      cm.beginActivityRound(1, 20);
      cm.updateThinkingMessage('first round step');
      cm.beginActivityRound(2, 20);
      cm.updateThinkingMessage('second round step');

      expect(rounds()).toHaveLength(2);
      expect(rounds()[0].textContent).toContain('first round step');
      expect(rounds()[0].textContent).not.toContain('second round step');
      expect(rounds()[1].textContent).toContain('second round step');
    });

    it('keeps pre-round steps in the panel body rather than a round group', () => {
      cm.addThinkingMessage('starting request processing');
      cm.updateThinkingMessage('context info');

      expect(rounds()).toHaveLength(0);
      expect(panel().querySelector('.thinking-content').textContent).toContain('context info');
    });

    it('creates the panel when a round starts without one', () => {
      expect(panel()).toBeNull();

      cm.beginActivityRound(1, 20);

      expect(panel()).not.toBeNull();
      expect(rounds()).toHaveLength(1);
    });

    it('collapses a finished round into a summary naming its tools', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_search']);
      cm.noteActivityRoundOutcome(1, 0);
      cm.closeActivityRound();

      const round = rounds()[0];
      expect(round.open).toBe(false);
      expect(round.querySelector('summary').textContent).toContain('Round 1');
      expect(round.querySelector('summary').textContent).toContain('blast_search');
      expect(round.querySelector('summary').textContent).toContain('✅');
    });

    it('leaves a round with a failed tool expanded and flagged', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_export_results']);
      cm.noteActivityRoundOutcome(0, 1);
      cm.closeActivityRound();

      const round = rounds()[0];
      expect(round.open).toBe(true);
      expect(round.classList.contains('activity-round-failed')).toBe(true);
      expect(round.querySelector('summary').textContent).toContain('1 failed');
    });

    it('truncates a long tool list in the round summary', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['a', 'b', 'c', 'd', 'e']);
      cm.closeActivityRound();

      expect(rounds()[0].querySelector('summary').textContent).toContain('a, b, c +2 more');
    });
  });

  describe('completion summary', () => {
    it('reports rounds, tools, and elapsed time, then collapses', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_search', 'blast_filter_results']);
      cm.noteActivityRoundOutcome(2, 0);

      cm.finalizeCurrentThinkingProcess('req1');

      const summary = document.querySelector('.activity-summary').textContent;
      expect(summary).toContain('1 round');
      expect(summary).toContain('2 tools');
      expect(document.querySelector('.thinking-process').classList.contains('activity-collapsed')).toBe(true);
      expect(document.querySelector('.thinking-header').getAttribute('aria-expanded')).toBe('false');
    });

    it('stays expanded and flags the panel when a tool failed', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_export_results']);
      cm.noteActivityRoundOutcome(0, 1);

      cm.finalizeCurrentThinkingProcess('req1');

      const finished = document.querySelector('.thinking-process');
      expect(finished.classList.contains('activity-collapsed')).toBe(false);
      expect(finished.classList.contains('activity-failed')).toBe(true);
      expect(document.querySelector('.activity-summary').textContent).toContain('1 failed');
      expect(finished.querySelector('.message-icon i').classList.contains('fa-exclamation-circle')).toBe(true);
    });

    it('honours the auto-collapse setting being off', () => {
      cm.activityAutoCollapse = false;
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);

      cm.finalizeCurrentThinkingProcess('req1');

      expect(document.querySelector('.thinking-process').classList.contains('activity-collapsed')).toBe(false);
    });

    it('removes the panel when hideThinkingAfterConversation is on', () => {
      vi.useFakeTimers();
      cm.hideThinkingAfterConversation = true;
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);

      cm.finalizeCurrentThinkingProcess('req1');
      vi.advanceTimersByTime(600);

      expect(document.querySelector('.thinking-process')).toBeNull();
      vi.useRealTimers();
    });

    it('keeps the panel when hideThinkingAfterConversation is off', () => {
      vi.useFakeTimers();
      cm.hideThinkingAfterConversation = false;
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);

      cm.finalizeCurrentThinkingProcess('req1');
      vi.advanceTimersByTime(600);

      expect(document.querySelector('.thinking-process')).not.toBeNull();
      vi.useRealTimers();
    });

    it('seals the open round so its summary is filled in', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_search']);

      cm.finalizeCurrentThinkingProcess('req1');

      expect(rounds()[0].querySelector('summary').textContent).toContain('blast_search');
      expect(cm.activityRoundState).toBeNull();
    });
  });

  describe('detail level', () => {
    it('drops verbose steps when compact but still records them', () => {
      cm.activityDetailLevel = 'compact';
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);

      cm.updateThinkingMessage('Sending request to LLM...', { verbose: true });
      cm.updateThinkingMessage('Execution completed: 1 successful, 0 failed');

      const text = panel().textContent;
      expect(text).not.toContain('Sending request to LLM');
      expect(text).toContain('Execution completed');

      // The full trace still reaches Evolution, so export and the detailed
      // level are never missing steps the compact view skipped.
      const recorded = cm.addToEvolutionData.mock.calls.map(([entry]) => entry);
      const verboseEntry = recorded.find(e => String(e.content).includes('Sending request to LLM'));
      expect(verboseEntry).toBeDefined();
      expect(verboseEntry.visible).toBe(false);
      expect(verboseEntry.metadata.verbose).toBe(true);
    });

    it('renders verbose steps when detailed', () => {
      cm.activityDetailLevel = 'detailed';
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);

      cm.updateThinkingMessage('Sending request to LLM...', { verbose: true });

      expect(panel().textContent).toContain('Sending request to LLM');
    });
  });

  describe('header toggle', () => {
    it('expands a collapsed panel on click', () => {
      cm.addThinkingMessage('');
      cm.finalizeCurrentThinkingProcess('req1');
      const finished = document.querySelector('.thinking-process');
      expect(finished.classList.contains('activity-collapsed')).toBe(true);

      finished.querySelector('.thinking-header').click();

      expect(finished.classList.contains('activity-collapsed')).toBe(false);
      expect(finished.querySelector('.activity-chevron').classList.contains('fa-chevron-down')).toBe(true);
    });

    it('persists a manual toggle so the next request opens the same way', () => {
      cm.addThinkingMessage('');
      cm.finalizeCurrentThinkingProcess('req1');

      document.querySelector('.thinking-process .thinking-header').click();

      expect(cm.activityAutoCollapse).toBe(false);
      expect(settings.activityAutoCollapse).toBe(false);
    });

    it('does not collapse the whole panel when a round group is toggled', () => {
      cm.addThinkingMessage('');
      cm.beginActivityRound(1, 20);
      cm.noteActivityRoundTools(['blast_search']);
      cm.closeActivityRound();

      rounds()[0].querySelector('summary').click();

      expect(panel().classList.contains('activity-collapsed')).toBe(false);
      expect(cm.chatBoxSettingsManager.setSetting).not.toHaveBeenCalled();
    });

    it('does not persist a toggle made while the request is still running', () => {
      cm.addThinkingMessage('');

      panel().querySelector('.thinking-header').click();

      expect(panel().classList.contains('activity-collapsed')).toBe(true);
      expect(cm.chatBoxSettingsManager.setSetting).not.toHaveBeenCalled();
      expect(cm.activityAutoCollapse).toBe(true);
    });
  });

  describe('duration formatting', () => {
    it('scales the unit to the magnitude', () => {
      expect(cm.formatActivityDuration(940)).toBe('940ms');
      expect(cm.formatActivityDuration(12400)).toBe('12.4s');
      expect(cm.formatActivityDuration(125000)).toBe('2m 05s');
      expect(cm.formatActivityDuration(-1)).toBe('');
    });
  });
});
