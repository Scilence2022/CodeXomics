import { describe, expect, it } from 'vitest';
import credentials from '../../src/shared/configuration-credentials.js';

describe('configuration credential fallback', () => {
  it('keeps existing local credentials without persisting new plaintext', () => {
    const storage = new Map([['llm', '{"apiKey":"old-key"}']]);
    const local = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
    const incoming = { apiKey: 'replacement', local: { accessToken: 'new-key' }, theme: 'midnight' };
    expect(credentials.saveFallbackConfiguration(local, 'llm', incoming).credentialsPersisted).toBe(false);
    expect(JSON.parse(storage.get('llm'))).toEqual({
      apiKey: 'old-key',
      local: { accessToken: '' },
      theme: 'midnight',
    });
    expect(incoming.local.accessToken).toBe('new-key');
  });

  it('removes a legacy browser copy only after its credentials have migrated', () => {
    const storage = new Map([['llm', '{"provider":{"apiKey":"old-key"}}']]);
    const local = { getItem: key => storage.get(key), removeItem: key => storage.delete(key) };
    credentials.clearMigratedFallbackConfiguration(local, 'llm', { provider: { apiKey: 'other-key' } });
    expect(storage.has('llm')).toBe(true);
    credentials.clearMigratedFallbackConfiguration(local, 'llm', { provider: { apiKey: 'old-key' } });
    expect(storage.has('llm')).toBe(false);
  });
});
