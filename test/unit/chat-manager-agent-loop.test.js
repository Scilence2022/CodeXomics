/**
 * Behavioural coverage for the ChatManager round loop, driven through the real
 * `sendToLLM()` against a scripted provider (see test/helpers/agent-loop-harness.js).
 *
 * These assert on what the loop does — which tools run, what the next round
 * actually receives, how a turn terminates — rather than on how the source is
 * written.
 */
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createAgentLoopHarness, openAiToolCall, openAiToolCalls } = require('../helpers/agent-loop-harness.js');

describe('agent loop', () => {
  describe('tool inventory', () => {
    const catalog = Array.from({ length: 214 }, (_, index) => ({
      name: 'fixture_tool_' + index,
      category: index < 200 ? 'navigation' : 'sequence',
      description: 'Catalog description '.repeat(40),
    }));

    it('answers the full catalog request after one provider round and preserves every tool in the answer', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCall('list_available_tools', { format: 'summary', include_details: true }),
          openAiToolCall('list_available_tools', { category: 'navigation' }),
        ],
        tools: {
          list_available_tools: parameters => harness.chatManager.listAvailableTools(parameters),
        },
      });
      harness.chatManager.dynamicToolsEnabled = true;
      harness.chatManager.dynamicTools = { getAllTools: async () => catalog };

      const answer = await harness.send('List all available tools in the CodeXomics system.');

      expect(harness.rounds).toBe(1);
      expect(harness.toolCalls.map(call => call.tool_name)).toEqual(['list_available_tools']);
      expect(answer).toContain('**Total Tools:** 214');
      expect(answer.match(/^- fixture_tool_\d+$/gm)).toHaveLength(214);
    });

    it('passes a complete inventory to the next round and suppresses an equivalent repeat during a workflow', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCall('list_available_tools'),
          openAiToolCalls([
            { name: 'list_available_tools', parameters: { format: 'summary', include_details: false }, id: 'repeat' },
            { name: 'zoom_in', id: 'zoom' },
          ]),
          'Listed the available tools and zoomed in.',
        ],
        tools: {
          list_available_tools: parameters => harness.chatManager.listAvailableTools(parameters),
          zoom_in: () => ({ success: true }),
        },
      });
      harness.chatManager.dynamicToolsEnabled = true;
      harness.chatManager.dynamicTools = { getAllTools: async () => catalog };

      await harness.send('List all available tools and then zoom in.');

      expect(harness.toolCalls.map(call => call.tool_name)).toEqual(['list_available_tools', 'zoom_in']);
      const result = harness.requests[1].find(message => message.role === 'tool');
      const inventory = JSON.parse(result.content.split('\n')[0]);
      expect(inventory.total_tools).toBe(214);
      expect(inventory.categories.navigation.tools).toEqual(catalog.slice(0, 200).map(tool => tool.name));
      expect(inventory.categories.sequence.tools).toEqual(catalog.slice(200).map(tool => tool.name));
      expect(result.content.length).toBeLessThan(8192);
    });
  });

  describe('basic round-tripping', () => {
    it('executes a native tool call and feeds the result into the next round', async () => {
      const harness = createAgentLoopHarness({
        responses: [openAiToolCall('jump_to_gene', { geneName: 'lysC' }), 'Moved the view to lysC.'],
        tools: { jump_to_gene: () => ({ success: true, position: '1234-5678' }) },
      });

      const answer = await harness.send('jump to the lysC gene');

      expect(harness.toolCalls).toEqual([{ tool_name: 'jump_to_gene', parameters: { geneName: 'lysC' } }]);
      expect(harness.rounds).toBe(2);
      expect(answer).toBe('Moved the view to lysC.');
    });

    it('answers a conversational question without any tool round', async () => {
      const harness = createAgentLoopHarness({
        responses: ['lysC encodes aspartokinase III.'],
      });

      const answer = await harness.send('What is lysC?');

      expect(harness.toolCalls).toEqual([]);
      expect(harness.rounds).toBe(1);
      expect(answer).toBe('lysC encodes aspartokinase III.');
    });

    it('runs several tool calls from one response in order', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCalls([
            { name: 'jump_to_gene', parameters: { geneName: 'lysC' } },
            { name: 'zoom_in', parameters: {} },
          ]),
          'Both steps are done.',
        ],
        tools: { jump_to_gene: () => ({ success: true }), zoom_in: () => ({ success: true }) },
      });

      await harness.send('jump to lysC and zoom in');

      expect(harness.toolCalls.map(call => call.tool_name)).toEqual(['jump_to_gene', 'zoom_in']);
    });
  });

  describe('failure handling', () => {
    it('reports a non-retryable failure instead of looping on it', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCall('jump_to_gene', { geneName: 'nope' }),
          openAiToolCall('jump_to_gene', { geneName: 'nope2' }),
          openAiToolCall('jump_to_gene', { geneName: 'nope3' }),
        ],
        tools: { jump_to_gene: () => ({ success: false, error: 'gene not found' }) },
      });

      const answer = await harness.send('jump to the nope gene');

      expect(answer).toContain('Tool Execution Failed');
      // One corrective round is allowed; the third attempt must not happen.
      expect(harness.toolCalls.length).toBeLessThanOrEqual(2);
    });

    it('surfaces a thrown tool error to the model before giving up', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCall('jump_to_gene', { geneName: 'boom' }),
          openAiToolCall('jump_to_gene', { geneName: 'boom' }),
        ],
        tools: {
          jump_to_gene: () => {
            throw new Error('renderer offline');
          },
        },
      });

      await harness.send('jump to the boom gene');

      const feedback = harness.lastRequest.map(message => String(message.content ?? '')).join('\n');
      expect(feedback).toContain('renderer offline');
    });
  });

  describe('round budget', () => {
    it('stops at the configured round limit with a deterministic answer', async () => {
      const harness = createAgentLoopHarness({
        config: { 'llm.functionCallRounds': 3 },
        responses: Array.from({ length: 6 }, (_, index) =>
          openAiToolCall('search_features', { query: `q${index}` }, { id: `call_${index}` })
        ),
        tools: { search_features: () => ({ success: true, features: [] }) },
      });

      const answer = await harness.send('search for every feature and then summarise them');

      expect(harness.rounds).toBeLessThanOrEqual(3);
      expect(answer).toBeTruthy();
    });
  });

  describe('abort', () => {
    it('hands the provider an abort signal it can act on', async () => {
      const harness = createAgentLoopHarness({ responses: ['done'] });

      await harness.send('hello');

      expect(harness.lastOptions.signal).toBeInstanceOf(AbortSignal);
    });

    it('propagates an AbortError instead of returning an "Unexpected Error" answer', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          () => {
            harness.abort();
            return 'this response arrives after the user pressed stop';
          },
        ],
      });

      await expect(harness.send('jump to lysC')).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('does not start another round after the user aborts', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          ({ harness: self }) => {
            self.abort();
            return openAiToolCall('jump_to_gene', { geneName: 'lysC' });
          },
          openAiToolCall('zoom_in', {}),
        ],
        tools: { jump_to_gene: () => ({ success: true }), zoom_in: () => ({ success: true }) },
      });

      await expect(harness.send('jump to lysC then zoom in')).rejects.toMatchObject({ name: 'AbortError' });

      expect(harness.rounds).toBe(1);
      expect(harness.toolCalls).toEqual([]);
    });

    it('stops even though endConversation() already cleared the controller', async () => {
      // abortCurrentConversation() tears the conversation state down immediately
      // so the UI unlocks; the in-flight loop must still observe the abort.
      const harness = createAgentLoopHarness({
        responses: [
          ({ harness: self }) => {
            self.chatManager.abortCurrentConversation();
            expect(self.chatManager.conversationState.abortController).toBeNull();
            return 'late response';
          },
          'second round must never run',
        ],
      });

      await expect(harness.send('do something')).rejects.toMatchObject({ name: 'AbortError' });
      expect(harness.rounds).toBe(1);
    });
  });

  describe('duplicate suppression', () => {
    it('does not run the same call with the same parameters twice', async () => {
      const harness = createAgentLoopHarness({
        responses: [
          openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'a' }),
          openAiToolCall('jump_to_gene', { geneName: 'lysC' }, { id: 'b' }),
          'Already there.',
        ],
        tools: { jump_to_gene: () => ({ success: true }) },
      });

      await harness.send('jump to lysC');

      expect(harness.toolCalls.length).toBe(1);
    });
  });
});
