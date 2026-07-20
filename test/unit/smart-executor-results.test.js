import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

let SmartExecutor;

beforeAll(() => {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/SmartExecutor.js'), 'utf8');
  // eslint-disable-next-line no-new-func -- evaluate the renderer class without constructing its browser dependencies
  SmartExecutor = new Function('FunctionCallsOrganizer', `${source}; return SmartExecutor;`)(class {});
});

function createExecutor(resultFactory) {
  const executor = Object.create(SmartExecutor.prototype);
  executor.executeSingleTool = resultFactory;
  return executor;
}

describe('SmartExecutor result normalization', () => {
  it('preserves explicit unsuccessful outcomes in parallel execution', async () => {
    const executor = createExecutor(async tool =>
      tool.tool_name === 'select_gene' ? { success: false, error: 'Gene not found' } : { success: true, value: 'ok' }
    );

    const results = await executor.executeParallel([
      { tool_name: 'select_gene', parameters: { geneName: 'missing' } },
      { tool_name: 'get_current_state', parameters: {} },
    ]);

    expect(results[0]).toMatchObject({ success: false, result: null, error: 'Gene not found' });
    expect(results[1]).toMatchObject({ success: true, result: { success: true, value: 'ok' } });
  });

  it('preserves explicit unsuccessful outcomes in sequential execution', async () => {
    const executor = createExecutor(async () => ({ success: false, message: 'Selection failed' }));

    const [result] = await executor.executeSequential([
      { tool_name: 'select_gene', parameters: { geneName: 'missing' } },
    ]);

    expect(result).toMatchObject({ success: false, result: null, error: 'Selection failed' });
  });
});
