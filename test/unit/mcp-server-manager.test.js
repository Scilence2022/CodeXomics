import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MCPServerManager = require('../../src/renderer/modules/MCPServerManager.js');

function createManager() {
  return new MCPServerManager({
    get: (_key, fallback) => fallback,
    set: vi.fn(),
  });
}

describe('MCPServerManager Deep Gene Research status handling', () => {
  it('preserves a completed status envelope that contains a research result', async () => {
    const manager = createManager();
    manager.connections.set('deep-gene-research', { type: 'http' });
    const status = {
      taskId: 'dgr-task-1',
      status: 'completed',
      progress: 100,
      step: 'gene-research',
      result: { annotationProposal: { status: 'draft_requires_evidence' } },
    };
    manager.executeToolOnServer = vi.fn().mockResolvedValue(status);

    await expect(manager.checkTaskStatus('deep-gene-research', 'dgr-task-1')).resolves.toEqual(status);
    expect(manager.executeToolOnServer).toHaveBeenCalledWith('deep-gene-research', 'get-task-status', {
      taskId: 'dgr-task-1',
      resultMode: 'annotation',
    });
  });

  it('returns only the research result for the DGR result convenience method', async () => {
    const manager = createManager();
    manager.connections.set('deep-gene-research', { type: 'http' });
    const result = { annotationProposal: { status: 'draft_requires_evidence' } };
    manager.executeToolOnServer = vi.fn().mockResolvedValue({ status: 'completed', result });

    await expect(manager.getTaskResult('deep-gene-research', 'dgr-task-1')).resolves.toEqual(result);
  });
});
