/* eslint-disable no-new-func */
/**
 * InterProScan jobs legitimately report QUEUED before RUNNING/FINISHED.
 * Regression: the polling loop treated QUEUED as terminal and threw a
 * spurious "timeout" a few seconds after submission.
 */
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/ProteinService.js');

function createService() {
  const code = fs.readFileSync(SERVICE_PATH, 'utf-8').replace('window.ProteinService = ProteinService;', '');
  const body = `${code}; return new ProteinService({}, {});`;
  const fn = new Function('mockApp', 'mockChatManager', body);
  return fn({}, {});
}

function responseWithText(text, ok = true) {
  return { ok, text: vi.fn(async () => text) };
}

describe('ProteinService analyzeInterProDomains polling', () => {
  it('keeps polling while EBI reports QUEUED and completes once FINISHED', async () => {
    const originalFetch = globalThis.fetch;
    const statusCalls = vi
      .fn()
      .mockResolvedValueOnce(responseWithText('QUEUED'))
      .mockResolvedValueOnce(responseWithText('QUEUED'))
      .mockResolvedValueOnce(responseWithText('FINISHED'));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(responseWithText('iprscan5-test-job')) // submit
      .mockImplementationOnce(statusCalls) // first status poll
      .mockImplementationOnce(statusCalls) // second status poll
      .mockImplementationOnce(statusCalls) // third status poll
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn(async () => ({ matches: [] })),
      }); // result

    const service = createService();
    service.waitUnlessAborted = vi.fn(async () => {});
    service.isConversationAborted = vi.fn(() => false);

    try {
      const result = await service.analyzeInterProDomains({
        sequence: 'MFTGSIVAIVTPMDEK',
        analysis_type: 'domains',
      });

      expect(result.success).toBe(true);
      expect(statusCalls).toHaveBeenCalledTimes(3);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
