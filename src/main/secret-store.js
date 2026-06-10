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
 *  - Fail-soft: if encryption is unavailable (e.g. a headless Linux box with no
 *    keyring) values are written in plaintext so the app keeps working, and a
 *    warning is logged. Decryption failures degrade to an empty string for the
 *    affected field rather than aborting the whole config load.
 */

// Marker prefix identifying a safeStorage-encrypted, base64-encoded value.
const ENCRYPTED_PREFIX = 'sfs:v1:';

// Field names treated as secrets and encrypted at rest (case-insensitive match).
const DEFAULT_SECRET_KEYS = Object.freeze(['apikey', 'api_key', 'apitoken', 'accesstoken', 'secretkey']);

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
    return !!safeStorage && safeStorage.isEncryptionAvailable();
  } catch (error) {
    return false;
  }
}

function isEncryptedValue(value) {
  return typeof value === 'string' && value.startsWith(ENCRYPTED_PREFIX);
}

function isSecretKey(key, secretKeys) {
  return secretKeys.includes(String(key).toLowerCase());
}

/**
 * Encrypt a plaintext string into the marker-prefixed base64 form.
 * Returns the original value unchanged if it is empty, already encrypted, or if
 * OS encryption is unavailable.
 */
function encryptSecret(value) {
  if (typeof value !== 'string' || value.length === 0 || isEncryptedValue(value)) {
    return value;
  }
  const safeStorage = getSafeStorage();
  if (!safeStorage || !isEncryptionAvailable()) {
    return value;
  }
  try {
    const encrypted = safeStorage.encryptString(value);
    return ENCRYPTED_PREFIX + encrypted.toString('base64');
  } catch (error) {
    console.warn('[secret-store] Failed to encrypt secret, storing as-is:', error.message);
    return value;
  }
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
  if (!safeStorage || !isEncryptionAvailable()) {
    console.warn('[secret-store] Encrypted secret found but OS encryption is unavailable');
    return '';
  }
  try {
    const buffer = Buffer.from(value.slice(ENCRYPTED_PREFIX.length), 'base64');
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.warn('[secret-store] Failed to decrypt secret, clearing field:', error.message);
    return '';
  }
}

function transformSecretsInPlace(node, transform, secretKeys, seen) {
  if (!node || typeof node !== 'object') {
    return node;
  }
  if (seen.has(node)) {
    return node;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      transformSecretsInPlace(item, transform, secretKeys, seen);
    }
    return node;
  }

  for (const key of Object.keys(node)) {
    const current = node[key];
    if (typeof current === 'string' && isSecretKey(key, secretKeys)) {
      node[key] = transform(current);
    } else if (current && typeof current === 'object') {
      transformSecretsInPlace(current, transform, secretKeys, seen);
    }
  }
  return node;
}

/**
 * Recursively encrypt every secret-named string field within a config object.
 * Mutates and returns the object.
 */
function encryptSecretsInPlace(config, secretKeys = DEFAULT_SECRET_KEYS) {
  return transformSecretsInPlace(config, encryptSecret, secretKeys, new WeakSet());
}

/**
 * Recursively decrypt every secret-named string field within a config object.
 * Mutates and returns the object.
 */
function decryptSecretsInPlace(config, secretKeys = DEFAULT_SECRET_KEYS) {
  return transformSecretsInPlace(config, decryptSecret, secretKeys, new WeakSet());
}

module.exports = {
  ENCRYPTED_PREFIX,
  DEFAULT_SECRET_KEYS,
  __setSafeStorageForTesting,
  isEncryptionAvailable,
  isEncryptedValue,
  encryptSecret,
  decryptSecret,
  encryptSecretsInPlace,
  decryptSecretsInPlace,
};
