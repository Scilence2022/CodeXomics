/**
 * Reasoning is rendered into the thinking panel as it streams, rather than
 * dumped in one block after the round resolves. These tests cover the render
 * lifecycle: live append, coalescing, finalization without duplication, and the
 * abort/retry paths that must not leave a half-written block behind.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ChatManager from '../../src/renderer/modules/ChatManager.js';

describe('live reasoning streaming', () => {
  let cm;
  let frameCallbacks;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chatMessages"></div>';

    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', cb => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});

    cm = Object.create(ChatManager.prototype);
    cm.showThinkingProcess = true;
    cm.autoScrollToBottom = false;
    cm.conversationState = { currentRequestId: 'req1' };
    cm.addToEvolutionData = vi.fn();
    cm.streamingState = null;
    cm.reasoningStreamState = null;

    const thinking = document.createElement('div');
    thinking.className = 'thinking-process';
    thinking.id = 'thinkingProcess_req1';
    thinking.innerHTML = '<div class="thinking-content"></div>';
    document.getElementById('chatMessages').appendChild(thinking);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  const runFrame = () => {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    callbacks.forEach(cb => cb());
  };

  const block = () => document.querySelector('.reasoning-stream');
  const body = () => document.querySelector('.reasoning-stream-body');

  it('renders reasoning into the thinking panel while it arrives', () => {
    cm.appendStreamingReasoningToken('The user wants ');
    runFrame();

    expect(block()).not.toBeNull();
    expect(body().textContent).toBe('The user wants ');
    // Open with a live cursor: the round is still in flight.
    expect(block().open).toBe(true);
    expect(block().querySelector('.streaming-cursor')).not.toBeNull();

    cm.appendStreamingReasoningToken('codon usage.');
    runFrame();

    expect(body().textContent).toBe('The user wants codon usage.');
  });

  it('coalesces many tokens into one DOM write per frame', () => {
    for (let i = 0; i < 20; i++) {
      cm.appendStreamingReasoningToken('x');
    }

    // One frame scheduled for 20 tokens, and nothing written before it runs.
    expect(frameCallbacks).toHaveLength(1);
    expect(body().textContent).toBe('');

    runFrame();

    expect(body().textContent).toBe('x'.repeat(20));
  });

  it('creates the block only once across the whole round', () => {
    cm.appendStreamingReasoningToken('a');
    runFrame();
    cm.appendStreamingReasoningToken('b');
    runFrame();

    expect(document.querySelectorAll('.reasoning-stream')).toHaveLength(1);
  });

  it('does not render anything when the thinking panel is hidden', () => {
    cm.showThinkingProcess = false;

    cm.appendStreamingReasoningToken('hidden');
    runFrame();

    expect(block()).toBeNull();
    expect(cm.reasoningStreamState).toBeNull();
  });

  it('finalizes the streamed block in place instead of appending a second one', () => {
    cm.appendStreamingReasoningToken('We need codon usage. It is genome wide.');
    runFrame();

    cm.displayLLMThinking('final answer', 'We need codon usage. It is genome wide.', []);

    const blocks = document.querySelectorAll('details');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].querySelector('summary').textContent).toBe('💭 Model reasoning');
    // Finalized: collapsed, no cursor, and reformatted for readability.
    expect(blocks[0].open).toBe(false);
    expect(document.querySelector('.streaming-cursor')).toBeNull();
    expect(body().textContent).toContain('We need codon usage.');
    expect(cm.reasoningStreamState).toBeNull();
  });

  it('records the reasoning text for Evolution, not the DOM node', () => {
    cm.appendStreamingReasoningToken('a genuine thought.');
    runFrame();
    cm.displayLLMThinking('answer', 'a genuine thought.', []);

    const reasoningEntries = cm.addToEvolutionData.mock.calls
      .map(([entry]) => entry)
      .filter(entry => entry.metadata?.step === 'model_reasoning');

    expect(reasoningEntries).toHaveLength(1);
    expect(reasoningEntries[0].content).toBe('a genuine thought.');
    // No entry anywhere holds an element, which would serialize to `{}`.
    expect(cm.addToEvolutionData.mock.calls.every(([entry]) => typeof entry.content === 'string')).toBe(true);
  });

  it('still renders a block when nothing streamed, preserving the old behaviour', () => {
    cm.displayLLMThinking('answer', 'reasoning that never streamed', []);

    const details = document.querySelector('details');
    expect(details).not.toBeNull();
    expect(details.querySelector('summary').textContent).toBe('💭 Model reasoning');
    expect(details.textContent).toContain('reasoning that never streamed');
  });

  it('keeps the streamed text when the round reports no final reasoning', () => {
    cm.appendStreamingReasoningToken('partial thought');
    runFrame();

    cm.displayLLMThinking('answer', '', []);

    expect(document.querySelectorAll('details')).toHaveLength(1);
    expect(body().textContent).toContain('partial thought');
    expect(block().open).toBe(false);
  });

  it('drops a block that only ever received whitespace', () => {
    cm.appendStreamingReasoningToken('   ');
    runFrame();
    expect(block()).not.toBeNull();

    cm.displayLLMThinking('answer', '', []);

    expect(document.querySelector('.reasoning-stream')).toBeNull();
    expect(document.querySelector('.thinking-step-dom')).toBeNull();
  });

  it('stops the block animating when the round ends without a final render', () => {
    cm.appendStreamingReasoningToken('interrupted');
    // Abort before the frame runs: the buffered token must not be lost.
    cm.endStreamingResponse();

    expect(body().textContent).toBe('interrupted');
    expect(document.querySelector('.streaming-cursor')).toBeNull();
  });

  it('discards the partial block when a failed stream is retried', () => {
    cm.appendStreamingReasoningToken('from the failed provider');
    runFrame();
    expect(block()).not.toBeNull();

    cm.resetStreamingResponse();

    // Nothing left for the retry to append to, and no empty step behind.
    expect(document.querySelector('.reasoning-stream')).toBeNull();
    expect(document.querySelector('.thinking-step-dom')).toBeNull();
    expect(cm.reasoningStreamState).toBeNull();

    cm.appendStreamingReasoningToken('from the fallback provider');
    runFrame();

    expect(document.querySelectorAll('.reasoning-stream')).toHaveLength(1);
    expect(body().textContent).toBe('from the fallback provider');
  });

  it('starts a fresh block for each round', () => {
    cm.appendStreamingReasoningToken('round one');
    runFrame();
    cm.displayLLMThinking('answer', 'round one', []);

    cm.beginStreamingResponse();
    cm.appendStreamingReasoningToken('round two');
    runFrame();

    const bodies = document.querySelectorAll('.reasoning-stream-body');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].textContent).toContain('round one');
    expect(bodies[1].textContent).toBe('round two');
  });

  describe('inline <think> tags in the content stream', () => {
    // Some providers do not stream reasoning on a separate channel; they inline
    // it in the answer. Those tokens still belong in the thinking panel.
    const answer = () => document.querySelector('.streaming-text')?.firstChild?.data ?? '';

    beforeEach(() => {
      cm.beginStreamingResponse();
    });

    it('routes inlined reasoning to the thinking panel, not the answer bubble', () => {
      cm.appendStreamingToken('<think>');
      cm.appendStreamingToken('deciding what to do');
      cm.appendStreamingToken('</think>');
      cm.appendStreamingToken('Here is the answer.');
      runFrame();

      expect(body().textContent).toBe('deciding what to do');
      expect(answer()).toBe('Here is the answer.');
      // No raw tag leaks into either surface.
      expect(answer()).not.toContain('<think>');
    });

    it('handles a tag split across token boundaries', () => {
      for (const tok of ['<th', 'ink>', 'why', '</thi', 'nk>', 'done']) {
        cm.appendStreamingToken(tok);
      }
      runFrame();

      expect(body().textContent).toBe('why');
      expect(answer()).toBe('done');
    });

    it('handles reasoning and answer arriving inside one token', () => {
      cm.appendStreamingToken('<think>brief</think>answer');
      runFrame();

      expect(body().textContent).toBe('brief');
      expect(answer()).toBe('answer');
    });

    it('leaves ordinary angle brackets in the answer alone', () => {
      cm.appendStreamingToken('if a < b and c ');
      cm.appendStreamingToken('> d then');
      runFrame();

      expect(answer()).toBe('if a < b and c > d then');
      expect(block()).toBeNull();
    });

    it('does not stall on text that can never become a reasoning tag', () => {
      // `<threshold` looks like an opening tag but no reasoning tag starts that
      // way, so it must not be held back waiting for a `>` that never arrives.
      cm.appendStreamingToken('values below <threshold are dropped');
      runFrame();

      expect(answer()).toBe('values below <threshold are dropped');
    });

    it('holds a viable tag prefix until the next token resolves it', () => {
      cm.appendStreamingToken('answer <think');
      runFrame();

      // `<think` is still a viable tag, so it is withheld rather than shown.
      expect(answer()).toBe('answer ');

      cm.appendStreamingToken('>reasoning</think> more');
      runFrame();

      expect(body().textContent).toBe('reasoning');
      expect(answer()).toBe('answer  more');
    });

    it('emits a non-reasoning tag once it completes', () => {
      cm.appendStreamingToken('bold <b');
      cm.appendStreamingToken('>text</b>');
      runFrame();

      expect(answer()).toBe('bold <b>text</b>');
      expect(block()).toBeNull();
    });

    it('restarts tag routing when a failed stream is retried mid-tag', () => {
      cm.appendStreamingToken('<think>half a thought');
      runFrame();
      expect(body().textContent).toBe('half a thought');

      cm.resetStreamingResponse();
      cm.appendStreamingToken('plain answer from the fallback');
      runFrame();

      // Not still treated as inside a <think> block.
      expect(answer()).toBe('plain answer from the fallback');
    });
  });

  it('does not append into a previous round left unfinalized by an error', () => {
    cm.appendStreamingReasoningToken('round one');
    runFrame();
    // Errored round: settled by the `finally`, but never finalized.
    cm.endStreamingResponse();

    cm.beginStreamingResponse();
    cm.appendStreamingReasoningToken('round two');
    runFrame();

    const bodies = document.querySelectorAll('.reasoning-stream-body');
    expect(bodies).toHaveLength(2);
    expect(bodies[0].textContent).toBe('round one');
    expect(bodies[1].textContent).toBe('round two');
  });
});
