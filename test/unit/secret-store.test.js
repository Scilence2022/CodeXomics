import { describe, expect, it, beforeEach } from 'vitest';

// Controllable safeStorage stub injected via the module's test seam. encryptString/
// decryptString implement a trivial reversible transform so we can assert
// round-trips without a real OS keychain.
const mockState = { available: true, backend: 'gnome_libsecret' };
const stubSafeStorage = {
  isEncryptionAvailable: () => mockState.available,
  getSelectedStorageBackend: () => mockState.backend,
  encryptString: plaintext => Buffer.from(`enc(${plaintext})`, 'utf8'),
  decryptString: buffer => {
    const wrapped = buffer.toString('utf8');
    const match = /^enc\(([\s\S]*)\)$/.exec(wrapped);
    if (!match) throw new Error('not decryptable');
    return match[1];
  },
};

const {
  ENCRYPTED_PREFIX,
  encryptSecret,
  decryptSecret,
  encryptSecretsInPlace,
  decryptSecretsInPlace,
  isEncryptedValue,
  prepareConfigForStorage,
  __setSafeStorageForTesting,
} = await import('../../src/main/secret-store.js');

__setSafeStorageForTesting(stubSafeStorage);

describe('secret-store', () => {
  beforeEach(() => {
    mockState.available = true;
    mockState.backend = 'gnome_libsecret';
  });

  it('round-trips a single secret through encrypt/decrypt', () => {
    const cipher = encryptSecret('sk-test-123');
    expect(cipher.startsWith(ENCRYPTED_PREFIX)).toBe(true);
    expect(cipher).not.toContain('sk-test-123');
    expect(decryptSecret(cipher)).toBe('sk-test-123');
  });

  it('does not double-encrypt an already-encrypted value', () => {
    const cipher = encryptSecret('sk-abc');
    expect(encryptSecret(cipher)).toBe(cipher);
  });

  it('leaves empty strings untouched', () => {
    expect(encryptSecret('')).toBe('');
    expect(decryptSecret('')).toBe('');
  });

  it('treats legacy plaintext as-is on decrypt (backward compatible)', () => {
    expect(decryptSecret('legacy-plaintext-key')).toBe('legacy-plaintext-key');
    expect(isEncryptedValue('legacy-plaintext-key')).toBe(false);
  });

  it('recursively encrypts only apiKey fields in a nested config', () => {
    const config = {
      providers: {
        openai: { name: 'OpenAI', apiKey: 'sk-openai', baseUrl: 'https://api.openai.com' },
        anthropic: { name: 'Anthropic', apiKey: 'sk-anthropic' },
      },
      uiPreference: 'midnight',
    };

    encryptSecretsInPlace(config);

    expect(isEncryptedValue(config.providers.openai.apiKey)).toBe(true);
    expect(isEncryptedValue(config.providers.anthropic.apiKey)).toBe(true);
    // Non-secret fields are untouched.
    expect(config.providers.openai.name).toBe('OpenAI');
    expect(config.providers.openai.baseUrl).toBe('https://api.openai.com');
    expect(config.uiPreference).toBe('midnight');

    decryptSecretsInPlace(config);
    expect(config.providers.openai.apiKey).toBe('sk-openai');
    expect(config.providers.anthropic.apiKey).toBe('sk-anthropic');
  });

  it('handles arrays of provider objects', () => {
    const config = { customProviders: [{ apiKey: 'k1' }, { apiKey: 'k2' }] };
    encryptSecretsInPlace(config);
    expect(isEncryptedValue(config.customProviders[0].apiKey)).toBe(true);
    expect(isEncryptedValue(config.customProviders[1].apiKey)).toBe(true);
    decryptSecretsInPlace(config);
    expect(config.customProviders[0].apiKey).toBe('k1');
    expect(config.customProviders[1].apiKey).toBe('k2');
  });

  it('requires protected storage for new credentials', () => {
    mockState.available = false;
    expect(() => encryptSecret('sk-plain')).toThrow('OS credential encryption is unavailable');
    mockState.available = true;
    mockState.backend = 'basic_text';
    expect(() => encryptSecret('sk-plain')).toThrow('OS credential encryption is unavailable');
  });

  it('keeps the encrypted key when an unavailable keyring produces a blank renderer field', () => {
    const encrypted = encryptSecret('old-key');
    mockState.available = false;
    const result = prepareConfigForStorage(
      { provider: { apiKey: '', model: 'updated' } },
      { provider: { apiKey: encrypted, model: 'old' } }
    );
    expect(result.credentialsPersisted).toBe(false);
    expect(result.config.provider).toEqual({ apiKey: encrypted, model: 'updated' });
  });

  it('keeps old keys and new non-secret settings during a keyring outage', () => {
    const encrypted = encryptSecret('old-key');
    mockState.available = false;
    const result = prepareConfigForStorage(
      { providers: { old: { apiKey: 'replacement' }, new: { apiKey: 'new-key', model: 'model' } } },
      { providers: { old: { apiKey: encrypted } } }
    );
    expect(result.credentialsPersisted).toBe(false);
    expect(result.config.providers).toEqual({ old: { apiKey: encrypted }, new: { apiKey: '', model: 'model' } });
  });

  it('clears a field that cannot be decrypted rather than throwing', () => {
    // A value marked encrypted but with corrupt payload.
    const corrupt = `${ENCRYPTED_PREFIX}not-base64-enc-data`;
    expect(decryptSecret(corrupt)).toBe('');
  });

  it('does not infinitely recurse on circular references', () => {
    const config = { apiKey: 'sk-circular' };
    config.self = config;
    expect(() => encryptSecretsInPlace(config)).not.toThrow();
    expect(isEncryptedValue(config.apiKey)).toBe(true);
  });
});
