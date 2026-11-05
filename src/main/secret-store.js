'use strict';

/**
 * secret-store
 *
 * Encrypts sensitive configuration fields (API keys) at rest using Electron's
 * safeStorage, which is backed by the OS keychain (macOS Keychain, Windows DPAPI,
 * libsecret/kwallet on Linux). Plaintext is only ever held in renderer memory and
 * in the local IPC payload; on disk the values are OS-encrypted.
 *
 * Design goals:
 *  - Transparent to the renderer: encryption/decryption happens entirely in the
 *    main process around config:load / config:save.
 *  - Backward compatible: existing plaintext configs load fine and are migrated to
 *    encrypted form on the next save.
 *  - Preserve existing credentials during a keyring outage. New credentials
 *    require an OS-backed provider and are never written as plaintext.
 */

const { CONFIG_CREDENTIAL_FIELDS, mapConfigurationCredentials } = require('../shared/configuration-credentials');

// Marker prefix identifying a safeStorage-encrypted, base64-encoded value.
const ENCRYPTED_PREFIX = 'sfs:v1:';

// Field names treated as secrets and encrypted at rest (case-insensitive match).
const DEFAULT_SECRET_KEYS = CONFIG_CREDENTIAL_FIELDS;

// safeStorage is resolved lazily: requiring 'electron' outside an Electron runtime
// returns the binary path (a string) rather than the API object, so we guard for
// the presence of the expected methods. Tests inject a stub via the seam below.
let injectedSafeStorage = null;

function getSafeStorage() {
  if (injectedSafeStorage) {
    return injectedSafeStorage;
  }
  try {
    const electron = require('electron');
    if (electron && typeof electron.safeStorage?.isEncryptionAvailable === 'function') {
      return electron.safeStorage;
    }
  } catch (error) {
    // electron is unavailable (e.g. unit tests / standalone tooling)
  }
  return null;
}

// Test seam — allows unit tests to provide a controllable safeStorage stub
// without depending on a real OS keychain or an Electron runtime.
function __setSafeStorageForTesting(stub) {
  injectedSafeStorage = stub;
}

function isEncryptionAvailable() {
  try {
    const safeStorage = getSafeStorage();
    return (
      !!safeStorage && safeStorage.isEncryptionAvailable() && safeStorage.getSelectedStorageBackend?.() !== 'basic_text'
    );
  } catch (error) {
    return false;
  }
}

function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

function encryptSecret(value) {
  if (typeof value !== 'string' || value.length === 0 || isEncryptedValue(value)) return value;
  if (isEncryptionAvailable()) {
    try {
      const encrypted = getSafeStorage().encryptString(value);
      return ENCRYPTED_PREFIX + encrypted.toString('base64');
    } catch {
      // Report the storage failure without including the attempted value.
    }
  }
  const error = new Error('OS credential encryption is unavailable');
  error.code = 'CREDENTIAL_STORAGE_UNAVAILABLE';
  throw error;
}

/**
 * Decrypt a marker-prefixed value back to plaintext. Non-encrypted values
 * (legacy plaintext) are returned unchanged. Decryption failures return ''.
 */
function decryptSecret(value) {
  if (!isEncryptedValue(value)) {
    return value;
  }
  const safeStorage = getSafeStorage();
  try {
    if (!safeStorage?.isEncryptionAvailable()) return '';
    const buffer = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    console.warn('[secret-store] Could not decrypt a stored credential');
    return '';
  }
}

function encryptSecretsInPlace(config, secretKeys = DEFAULT_SECRET_KEYS) {
  return mapConfigurationCredentials(config, encryptSecret, null, secretKeys);
}

function decryptSecretsInPlace(config, secretKeys = DEFAULT_SECRET_KEYS) {
  return mapConfigurationCredentials(config, decryptSecret, null, secretKeys);
}

function prepareConfigForStorage(config, stored) {
  let credentialsPersisted = true;
  mapConfigurationCredentials(
    config,
    (value, previous) => {
      // The renderer sees a blank field when a previously stored secret cannot be
      // decrypted. A background settings save must preserve the opaque value.
      if (!value && isEncryptedValue(previous) && !decryptSecret(previous)) {
        credentialsPersisted = false;
        return previous;
      }
      try {
        return encryptSecret(value);
      } catch (error) {
        if (error.code !== 'CREDENTIAL_STORAGE_UNAVAILABLE') throw error;
        if (value !== previous) credentialsPersisted = false;
        return typeof previous === 'string' ? previous : '';
      }
    },
    stored
  );
  return { config, credentialsPersisted };
}

module.exports = {
  ENCRYPTED_PREFIX,
  DEFAULT_SECRET_KEYS,
  __setSafeStorageForTesting,
  isEncryptionAvailable,
  prepareConfigForStorage,
  isEncryptedValue,
  encryptSecret,
  decryptSecret,
  encryptSecretsInPlace,
  decryptSecretsInPlace,
};
