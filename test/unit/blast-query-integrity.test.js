import { describe, it, expect } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: BlastManager } = loadScript('src/renderer/modules/BlastManager.js');
const manager = app => Object.assign(Object.create(BlastManager.prototype), { app });
describe('BLAST query source integrity', () => {
  it('rejects missing providers', async () => {
    await expect(manager({}).getSequenceFromRegion('chr', 1, 10)).rejects.toThrow('provider unavailable');
  });
  it('uses loaded sequence and requested coordinates', async () => {
    const calls = [];
    const m = manager({
      chatManager: {
        getSequence: async params => {
          calls.push(params);
          return { sequence: 'ARYN' };
        },
      },
    });
    expect(await m.getSequenceFromRegion('chr', 5, 8)).toBe('ARYN');
    expect(calls).toEqual([{ chromosome: 'chr', start: 5, end: 8 }]);
  });
  it.each([{ success: false, error: 'Genome unavailable' }, {}, { sequence: '' }])(
    'rejects unavailable regions',
    async result => {
      await expect(
        manager({ chatManager: { getSequence: async () => result } }).getSequenceFromRegion('chr', 1, 10)
      ).rejects.toThrow();
    }
  );
});
