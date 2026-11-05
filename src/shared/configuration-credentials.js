'use strict';

const CONFIG_CREDENTIAL_FIELDS = Object.freeze(['apikey', 'api_key', 'apitoken', 'accesstoken', 'secretkey']);

function mapConfigurationCredentials(
  node,
  transform,
  stored = null,
  fields = CONFIG_CREDENTIAL_FIELDS,
  seen = new WeakSet()
) {
  if (!node || typeof node !== 'object' || seen.has(node)) return node;
  seen.add(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    const previous = stored && Object.hasOwn(stored, key) ? stored[key] : undefined;
    if (fields.includes(key.toLowerCase())) {
      node[key] = typeof value === 'string' ? transform(value, previous) : '';
    } else if (value && typeof value === 'object') {
      mapConfigurationCredentials(value, transform, previous, fields, seen);
    }
  }
  return node;
}

function saveFallbackConfiguration(storage, key, value, serialize = JSON.stringify) {
  let stored;
  try {
    stored = JSON.parse(storage.getItem(key));
  } catch {
    stored = null;
  }
  let credentialsPersisted = true;
  const safeConfig = mapConfigurationCredentials(
    structuredClone(value),
    (secret, previous) => {
      if (!secret || secret === previous) return secret;
      credentialsPersisted = false;
      return typeof previous === 'string' ? previous : '';
    },
    stored
  );
  storage.setItem(key, serialize(safeConfig));
  return { credentialsPersisted };
}

function clearMigratedFallbackConfiguration(storage, key, saved) {
  try {
    const previous = JSON.parse(storage.getItem(key));
    if (!previous) return;
    let migrated = true;
    mapConfigurationCredentials(
      previous,
      (credential, stored) => {
        if (credential && credential !== stored) migrated = false;
        return credential;
      },
      saved
    );
    if (migrated) storage.removeItem(key);
  } catch {
    // Preserve the legacy entry when it cannot be verified.
  }
}

const configurationCredentials = {
  CONFIG_CREDENTIAL_FIELDS,
  mapConfigurationCredentials,
  saveFallbackConfiguration,
  clearMigratedFallbackConfiguration,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = configurationCredentials;
} else {
  window.configurationCredentials = configurationCredentials;
}
