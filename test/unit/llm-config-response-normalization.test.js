/* eslint-disable no-new-func */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const LLM_CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js');

function loadLLMConfigManager() {
  const code = fs.readFileSync(LLM_CONFIG_MANAGER_PATH, 'utf-8');
  const fn = new Function(`${code}; return LLMConfigManager;`);
  return fn();
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn(async () => data),
    text: vi.fn(async () => JSON.stringify(data)),
  };
}

describe('LLM provider response normalization', () => {
  let LLMConfigManagerClass;
  let manager;

  beforeAll(() => {
    LLMConfigManagerClass = loadLLMConfigManager();
  });

  beforeEach(() => {
    manager = new LLMConfigManagerClass({}, null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('OpenAI-compatible responses', () => {
    it('keeps normal prose backward-compatible and includes reasoning text', () => {
      const response = manager.normalizeOpenAICompatibleResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'The answer.',
              reasoning_content: 'I checked the evidence.',
            },
            finish_reason: 'stop',
          },
        ],
      });

      expect(response).toBe('<think>\nI checked the evidence.\n</think>\nThe answer.');
    });

    it('preserves native tool_calls, reasoning, and the choice finish reason', () => {
      const toolCalls = [
        {
          id: 'call_lysC',
          type: 'function',
          function: { name: 'find_gene_by_name', arguments: '{"gene_name":"lysC"}' },
        },
      ];
      const response = manager.normalizeOpenAICompatibleResponse(
        {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'I will locate it.',
                reasoning_content: 'A genome lookup is required.',
                tool_calls: toolCalls,
              },
              finish_reason: 'tool_calls',
            },
          ],
        },
        'openai'
      );

      expect(response).toMatchObject({
        provider: 'openai',
        role: 'assistant',
        finish_reason: 'tool_calls',
        reasoning_content: 'A genome lookup is required.',
        tool_calls: toolCalls,
      });
      expect(response.content).toContain('<think>\nA genome lookup is required.\n</think>');
      expect(response.content).toContain('I will locate it.');
    });

    it('preserves legacy function_call and abnormal text-only finishes', () => {
      const legacyCall = manager.normalizeOpenAICompatibleResponse({
        choices: [
          {
            message: {
              content: null,
              function_call: { name: 'find_gene_by_name', arguments: '{"gene_name":"lysC"}' },
            },
            finish_reason: 'function_call',
          },
        ],
      });
      const truncated = manager.normalizeOpenAICompatibleResponse({
        choices: [{ message: { content: 'Partial answer' }, finish_reason: 'length' }],
      });

      expect(legacyCall.function_call.name).toBe('find_gene_by_name');
      expect(legacyCall.finish_reason).toBe('function_call');
      expect(truncated).toMatchObject({ content: 'Partial answer', finish_reason: 'length' });
    });
  });

  describe('Anthropic responses', () => {
    it('preserves every original mixed content block and stop_reason', () => {
      const content = [
        { type: 'thinking', thinking: 'I need the genome feature index.' },
        { type: 'text', text: 'I will locate the gene.' },
        { type: 'tool_use', id: 'toolu_1', name: 'find_gene_by_name', input: { gene_name: 'lysC' } },
      ];
      const response = manager.normalizeAnthropicResponse({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content,
        stop_reason: 'tool_use',
      });

      expect(response.provider).toBe('anthropic');
      expect(response.stop_reason).toBe('tool_use');
      expect(response.content).toEqual(content);
      expect(response.content[0].thinking).toBe('I need the genome feature index.');
    });

    it('combines normal text blocks while retaining thinking in the string path', () => {
      const response = manager.normalizeAnthropicResponse({
        content: [
          { type: 'thinking', thinking: 'Reasoning remains available.' },
          { type: 'text', text: 'First. ' },
          { type: 'text', text: 'Second.' },
        ],
        stop_reason: 'end_turn',
      });

      expect(response).toBe('<think>\nReasoning remains available.\n</think>\nFirst. Second.');
    });
  });

  describe('Gemini responses', () => {
    it('preserves every original part, functionCall, and finishReason', () => {
      const parts = [
        { text: 'I will locate the gene.' },
        { functionCall: { name: 'find_gene_by_name', args: { gene_name: 'lysC' } } },
      ];
      const response = manager.normalizeGoogleResponse({
        candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }],
      });

      expect(response.provider).toBe('google');
      expect(response.finishReason).toBe('STOP');
      expect(response.content.parts).toEqual(parts);
      expect(response.content.parts[1].functionCall.name).toBe('find_gene_by_name');
    });

    it('returns an envelope for an abnormal finish and a reasoning-aware string for normal prose', () => {
      const truncated = manager.normalizeGoogleResponse({
        candidates: [{ content: { parts: [{ text: 'Partial answer' }] }, finishReason: 'MAX_TOKENS' }],
      });
      const normal = manager.normalizeGoogleResponse({
        candidates: [
          {
            content: {
              parts: [{ text: 'Gemini reasoning.', thought: true }, { text: 'Complete answer.' }],
            },
            finishReason: 'STOP',
          },
        ],
      });

      expect(truncated.finishReason).toBe('MAX_TOKENS');
      expect(truncated.content.parts[0].text).toBe('Partial answer');
      expect(normal).toBe('<think>\nGemini reasoning.\n</think>\nComplete answer.');
    });

    it('preserves an abnormal candidate even when Google omits content parts', () => {
      const blocked = manager.normalizeGoogleResponse({
        candidates: [{ finishReason: 'SAFETY', safetyRatings: [{ category: 'HARM_CATEGORY_DANGEROUS' }] }],
      });

      expect(blocked).toMatchObject({ provider: 'google', finishReason: 'SAFETY' });
    });

    it('returns an empty normal candidate for bounded outer-loop recovery', () => {
      const empty = manager.normalizeGoogleResponse({ candidates: [{ finishReason: 'STOP' }] });

      expect(empty).toMatchObject({ provider: 'google', finishReason: 'STOP' });
      expect(empty.content.parts).toEqual([]);
    });
  });

  describe('with-history provider paths', () => {
    it('returns the OpenAI structured envelope instead of only message content', async () => {
      const toolCalls = [
        {
          id: 'call_1',
          type: 'function',
          function: { name: 'find_gene_by_name', arguments: '{"gene_name":"lysC"}' },
        },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          jsonResponse({
            choices: [{ message: { content: null, tool_calls: toolCalls }, finish_reason: 'tool_calls' }],
          })
        )
      );

      const response = await manager.sendOpenAIMessageWithHistory(
        { baseUrl: 'https://example.test/v1', apiKey: 'key', model: 'model' },
        [{ role: 'user', content: 'select lysC' }]
      );

      expect(response.tool_calls).toEqual(toolCalls);
      expect(response.finish_reason).toBe('tool_calls');
    });

    it('routes Anthropic and Gemini mixed responses through their normalizers', async () => {
      const anthropicBlocks = [
        { type: 'text', text: 'Searching.' },
        { type: 'tool_use', id: 'toolu_2', name: 'find_gene_by_name', input: { gene_name: 'lysC' } },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ content: anthropicBlocks, stop_reason: 'tool_use' }))
      );
      const anthropic = await manager.sendAnthropicMessageWithHistory(
        { baseUrl: 'https://example.test', apiKey: 'key', model: 'model' },
        [{ role: 'user', content: 'select lysC' }]
      );

      const geminiParts = [
        { text: 'Searching.' },
        { functionCall: { name: 'find_gene_by_name', args: { gene_name: 'lysC' } } },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ candidates: [{ content: { parts: geminiParts }, finishReason: 'STOP' }] }))
      );
      const google = await manager.sendGoogleMessageWithHistory(
        { baseUrl: 'https://example.test', apiKey: 'key', model: 'model' },
        [{ role: 'user', content: 'select lysC' }]
      );

      expect(anthropic.content).toEqual(anthropicBlocks);
      expect(anthropic.stop_reason).toBe('tool_use');
      expect(google.content.parts).toEqual(geminiParts);
      expect(google.finishReason).toBe('STOP');
    });

    it('sends the required Anthropic direct-browser header on both request paths', async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn' })
      );
      vi.stubGlobal('fetch', fetchMock);
      const provider = { baseUrl: 'https://example.test', apiKey: 'key', model: 'model' };

      await manager.sendAnthropicMessage(provider, 'hello', {});
      await manager.sendAnthropicMessageWithHistory(provider, [{ role: 'user', content: 'hello' }]);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      for (const [, request] of fetchMock.mock.calls) {
        expect(request.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
      }
    });

    it('preserves local OpenAI-like tool calls together with finish_reason', async () => {
      const toolCalls = [
        {
          id: 'local_1',
          type: 'function',
          function: { name: 'find_gene_by_name', arguments: { gene_name: 'lysC' } },
        },
      ];
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          jsonResponse({ choices: [{ message: { content: '', tool_calls: toolCalls }, finish_reason: 'tool_calls' }] })
        )
      );

      const response = await manager.sendLocalMessageWithHistory(
        { baseUrl: 'http://localhost:1234/v1', apiKey: '', model: 'local-model' },
        [{ role: 'user', content: 'select lysC' }]
      );

      expect(response.provider).toBe('local');
      expect(response.tool_calls).toEqual(toolCalls);
      expect(response.finish_reason).toBe('tool_calls');
    });
  });
});
