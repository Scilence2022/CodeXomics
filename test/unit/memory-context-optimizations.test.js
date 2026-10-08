import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: MemorySystem } = loadScript('src/renderer/modules/MemorySystem.js');
const memory = Object.create(MemorySystem.prototype);
afterEach(() => vi.useRealTimers());
describe('memory context recommendations', () => {
  it('retains preference recommendations without fabricated historical matches', async () => {
    const parameters = { limit: 5 };
    const recommendations = await memory.getContextBasedRecommendations('search', parameters, {
      userPreferences: { limit: 10, format: 'json' },
    });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].data.optimizedParams).toEqual({ limit: 5, format: 'json' });
    expect(parameters).toEqual({ limit: 5 });
    expect(await memory.getContextBasedRecommendations('search', parameters, {})).toEqual([]);
  });
  it('applies actual preferences immediately without scheduling simulation timers', async () => {
    vi.useFakeTimers();
    const original = { options: { limit: 5 } };
    expect(
      await memory.applyContextOptimizationsAsync('search', original, {
        context: { userPreferences: { options: { format: 'json' } } },
      })
    ).toEqual({ options: { limit: 5, format: 'json' } });
    expect(original).toEqual({ options: { limit: 5 } });
    expect(vi.getTimerCount()).toBe(0);
  });
});
