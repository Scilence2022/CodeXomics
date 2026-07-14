const crypto = require('crypto');
const path = require('path');

const MAX_SIDECAR_FILE_BYTES = 64 * 1024 * 1024;
const MAX_SIDECAR_JSON_NODES = 1000000;

function estimateJsonStringBytes(value) {
  const text = String(value);
  let bytes = Buffer.byteLength(text, 'utf8') + 2;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x22 || code === 0x5c) bytes += 1;
    else if (code <= 0x1f) bytes += [0x08, 0x09, 0x0a, 0x0c, 0x0d].includes(code) ? 1 : 5;
  }
  return bytes;
}

function assertSidecarContentSize(value, maximumBytes = MAX_SIDECAR_FILE_BYTES) {
  const size =
    typeof value === 'number'
      ? value
      : Buffer.isBuffer(value)
        ? value.byteLength
        : Buffer.byteLength(String(value || ''), 'utf8');
  if (!Number.isFinite(size) || size < 0 || size > maximumBytes) {
    throw new Error(`sidecar exceeds the ${maximumBytes}-byte storage limit`);
  }
  return size;
}

function assertSidecarValueSize(value, maximumBytes = MAX_SIDECAR_FILE_BYTES, maximumNodes = MAX_SIDECAR_JSON_NODES) {
  if (!Number.isInteger(maximumNodes) || maximumNodes < 1) {
    throw new Error('sidecar JSON node limit must be a positive integer');
  }
  const stack = [{ value, exiting: false }];
  const ancestors = new WeakSet();
  let estimatedBytes = 0;
  let nodeCount = 0;
  let scheduledNodeCount = 1;
  while (stack.length > 0) {
    const frame = stack.pop();
    const current = frame.value;
    if (frame.exiting) {
      ancestors.delete(current);
      continue;
    }
    nodeCount += 1;
    if (nodeCount > maximumNodes) {
      throw new Error(`sidecar exceeds the ${maximumNodes}-node JSON limit`);
    }
    if (current === null || current === undefined) {
      estimatedBytes += 4;
    } else if (typeof current === 'string') {
      estimatedBytes += estimateJsonStringBytes(current);
    } else if (typeof current === 'number' || typeof current === 'boolean') {
      estimatedBytes += Buffer.byteLength(String(current), 'utf8');
    } else if (typeof current === 'object') {
      if (ancestors.has(current)) throw new Error('sidecar data must not contain circular references');
      ancestors.add(current);
      stack.push({ value: current, exiting: true });
      estimatedBytes += 2;
      if (Array.isArray(current)) {
        if (scheduledNodeCount + current.length > maximumNodes) {
          throw new Error(`sidecar exceeds the ${maximumNodes}-node JSON limit`);
        }
        scheduledNodeCount += current.length;
        estimatedBytes += Math.max(0, current.length - 1);
        for (const item of current) stack.push({ value: item, exiting: false });
      } else {
        const keys = [];
        const remainingNodes = maximumNodes - scheduledNodeCount;
        for (const key in current) {
          if (!Object.prototype.hasOwnProperty.call(current, key)) continue;
          keys.push(key);
          if (keys.length > remainingNodes) {
            throw new Error(`sidecar exceeds the ${maximumNodes}-node JSON limit`);
          }
        }
        scheduledNodeCount += keys.length;
        estimatedBytes += Math.max(0, keys.length - 1);
        for (const key of keys) {
          estimatedBytes += estimateJsonStringBytes(key) + 1;
          stack.push({ value: current[key], exiting: false });
        }
      }
    } else {
      throw new Error(`sidecar contains unsupported JSON value type: ${typeof current}`);
    }
    if (estimatedBytes > maximumBytes) {
      throw new Error(`sidecar exceeds the ${maximumBytes}-byte storage limit`);
    }
  }
  return estimatedBytes;
}

function legacyPathHash(value) {
  let hash = 0;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function securePathHash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function buildFallbackPaths(fallbackDir, authorizedGenomePath, safeGenomePath) {
  const sourcePathHash = securePathHash(safeGenomePath);
  const fallbackPath = path.resolve(fallbackDir, `${sourcePathHash}.CodeXomics`);
  const legacyFallbackPaths = Array.from(
    new Set([authorizedGenomePath, safeGenomePath].map(candidate => legacyPathHash(candidate)))
  ).map(hash => path.resolve(fallbackDir, `${hash}.CodeXomics`));
  return { sourcePathHash, fallbackPath, legacyFallbackPaths };
}

function validateFallbackBinding(data, options = {}) {
  const sourceBindingMatches =
    typeof data?._sourceGenomePathSha256 === 'string' && data._sourceGenomePathSha256 === options.sourcePathHash;
  const originalPathMatches =
    typeof data?._originalPath === 'string' &&
    [options.authorizedGenomePath, options.safeGenomePath]
      .filter(Boolean)
      .some(candidate => path.resolve(data._originalPath) === path.resolve(candidate));

  if (data?._sourceGenomePathSha256 && options.sourcePathHash && !sourceBindingMatches) {
    throw new Error('sidecar genome-path binding does not match the requested genome');
  }
  if (!sourceBindingMatches && !originalPathMatches) {
    throw new Error('fallback sidecar has no verifiable genome-path binding');
  }
  return true;
}

function createMigratedSidecarData(data, safeGenomePath, sourcePathHash) {
  return {
    ...(data || {}),
    _sourceGenomePathSha256: sourcePathHash,
    _originalPath: safeGenomePath,
  };
}

module.exports = {
  MAX_SIDECAR_FILE_BYTES,
  MAX_SIDECAR_JSON_NODES,
  assertSidecarContentSize,
  assertSidecarValueSize,
  legacyPathHash,
  securePathHash,
  buildFallbackPaths,
  validateFallbackBinding,
  createMigratedSidecarData,
};
