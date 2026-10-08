'use strict';

const crypto = require('crypto');
const path = require('path');
const AdmZip = require('adm-zip');
const MAX_PACKAGE_BYTES = 32 * 1024 * 1024;
const MAX_PACKAGE_FILES = 500;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonical(value[key])])
    );
  }
  return value;
}

function inspectPluginPackage({ data, manifest, pluginId, version } = {}) {
  const files = new Map();
  let totalBytes = 0;
  const add = (name, content) => {
    if (
      typeof name !== 'string' ||
      !name ||
      name.includes('\\') ||
      path.posix.isAbsolute(name) ||
      name.split('/').some(part => part === '..' || part === '.') ||
      /^[A-Za-z]:/.test(name)
    ) {
      throw new Error('Unsafe plugin package path');
    }
    if (files.has(name)) throw new Error(`Duplicate plugin package file: ${name}`);
    const bytes = Buffer.isBuffer(content)
      ? content
      : Buffer.from(typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
    totalBytes += bytes.length;
    if (totalBytes > MAX_PACKAGE_BYTES || files.size >= MAX_PACKAGE_FILES) {
      throw new Error('Plugin package exceeds inspection limits');
    }
    files.set(name, bytes);
  };
  if (Array.isArray(data) || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
    const bytes = Array.isArray(data)
      ? Buffer.from(data)
      : Buffer.from(data instanceof ArrayBuffer ? new Uint8Array(data) : data);
    if (!bytes.length || bytes.length > MAX_PACKAGE_BYTES) throw new Error('Invalid plugin archive size');
    const zip = new AdmZip(bytes);
    const entries = zip.getEntries();
    if (entries.length > MAX_PACKAGE_FILES) throw new Error('Plugin archive has too many entries');
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      if (((entry.header.attr >>> 16) & 0o170000) === 0o120000) {
        throw new Error('Plugin archive symlinks are not supported');
      }
      if (totalBytes + entry.header.size > MAX_PACKAGE_BYTES) {
        throw new Error('Plugin archive exceeds inspection limits');
      }
      add(entry.entryName, entry.getData());
    }
  } else if (data && typeof data === 'object') {
    for (const [name, content] of Object.entries(data)) add(name, content);
  } else {
    throw new Error('Plugin package contents are required');
  }
  if (!files.size) throw new Error('Plugin package is empty');
  const manifestFile = ['plugin.json', 'manifest.json', 'package.json'].find(name => files.has(name));
  const actualManifest = manifestFile ? JSON.parse(files.get(manifestFile).toString('utf8')) : manifest;
  if (
    !actualManifest ||
    typeof actualManifest !== 'object' ||
    actualManifest.id !== pluginId ||
    actualManifest.version !== version
  ) {
    throw new Error('Plugin package identity/version does not match the requested plugin');
  }
  const entries = [...files].sort(([a], [b]) => a.localeCompare(b));
  const sha256 = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        manifest: canonical(actualManifest),
        files: entries.map(([name, bytes]) => [name, bytes.toString('base64')]),
      })
    )
    .digest('hex');
  return {
    sha256,
    manifest: actualManifest,
    files: entries
      .filter(([name]) => /\.(?:[cm]?js|html)$/i.test(name))
      .map(([name, bytes]) => ({ name, content: bytes.toString('utf8') })),
    fileCount: files.size,
    totalBytes,
    scope: 'static_source_and_declared_permissions',
  };
}

module.exports = { inspectPluginPackage };
