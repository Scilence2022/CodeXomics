'use strict';

/**
 * Per-genome checkpoint store owned by the main process.
 *
 * Checkpoints belong to a genome file, not to a window: every genome view that has the same file
 * open reads and writes one list, and views of different files never see each other's. The main
 * process assigns ids and applies the limits, so concurrent views can neither overwrite each
 * other's checkpoints nor hand out the same id twice.
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { securePathHash } = require('./sidecar-storage');

const MAX_CHECKPOINTS = 50;
const MAX_STORE_BYTES = 2 * 1024 * 1024;
const AUTO_CHECKPOINT_TYPE = 'auto';
const LEGACY_IMPORT_MARKER = 'legacy-import.json';
const CHANGED_CHANNEL = 'checkpoints:changed';

function emptyDocument(genomePath) {
  return { genomePath, nextCheckpointId: 1, checkpoints: [] };
}

function timestampOf(checkpoint) {
  const time = Date.parse(checkpoint?.timestamp);
  return Number.isFinite(time) ? time : 0;
}

class CheckpointStore {
  constructor({ storageDir, maxCheckpoints = MAX_CHECKPOINTS, maxBytes = MAX_STORE_BYTES } = {}) {
    if (!storageDir) throw new Error('CheckpointStore requires a storageDir');
    this.storageDir = storageDir;
    this.maxCheckpoints = maxCheckpoints;
    this.maxBytes = maxBytes;
    this.queues = new Map();
  }

  normalizeGenomePath(genomePath) {
    if (typeof genomePath !== 'string' || !genomePath.trim() || !path.isAbsolute(genomePath)) {
      throw new Error('genomePath must be an absolute file path');
    }
    return path.resolve(genomePath);
  }

  documentPath(genomePath) {
    return path.join(this.storageDir, `${securePathHash(genomePath)}.json`);
  }

  // Serialize every read-modify-write on one genome's file.
  withLock(key, task) {
    const previous = this.queues.get(key) || Promise.resolve();
    const run = previous.then(task, task);
    const settled = run.catch(() => {});
    this.queues.set(key, settled);
    settled.then(() => {
      if (this.queues.get(key) === settled) this.queues.delete(key);
    });
    return run;
  }

  async readDocument(genomePath) {
    const file = this.documentPath(genomePath);
    let text;
    try {
      text = await fs.readFile(file, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return emptyDocument(genomePath);
      throw error;
    }

    try {
      const document = JSON.parse(text);
      if (document?.genomePath !== genomePath || !Array.isArray(document.checkpoints)) {
        throw new Error('checkpoint file does not belong to this genome');
      }
      const nextCheckpointId =
        Number.isInteger(document.nextCheckpointId) && document.nextCheckpointId > 0 ? document.nextCheckpointId : 1;
      return { genomePath, nextCheckpointId, checkpoints: document.checkpoints };
    } catch (error) {
      // Keep the unreadable file for inspection instead of overwriting it on the next write.
      const quarantined = `${file}.corrupt-${Date.now()}`;
      await fs.rename(file, quarantined).catch(() => {});
      console.warn(`[CheckpointStore] Moved unreadable checkpoint file to ${quarantined}: ${error.message}`);
      return emptyDocument(genomePath);
    }
  }

  async writeDocument(document) {
    await fs.mkdir(this.storageDir, { recursive: true });
    const file = this.documentPath(document.genomePath);
    const temporary = `${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(document), 'utf8');
      await fs.rename(temporary, file);
    } catch (error) {
      await fs.unlink(temporary).catch(() => {});
      throw error;
    }
  }

  // Drop the oldest auto checkpoints, then the oldest of any type, until both limits hold.
  enforceLimits(document) {
    const entries = document.checkpoints.map(checkpoint => ({
      checkpoint,
      bytes: Buffer.byteLength(JSON.stringify(checkpoint), 'utf8'),
    }));
    let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
    let count = entries.length;

    const byAge = (a, b) => timestampOf(a.checkpoint) - timestampOf(b.checkpoint);
    const isAuto = entry => entry.checkpoint.type === AUTO_CHECKPOINT_TYPE;
    const evictionOrder = [
      ...entries.filter(isAuto).sort(byAge),
      ...entries.filter(entry => !isAuto(entry)).sort(byAge),
    ];

    const evicted = new Set();
    for (const entry of evictionOrder) {
      if (count <= this.maxCheckpoints && totalBytes <= this.maxBytes) break;
      evicted.add(entry.checkpoint);
      count -= 1;
      totalBytes -= entry.bytes;
    }

    if (evicted.size > 0) {
      document.checkpoints = document.checkpoints.filter(checkpoint => !evicted.has(checkpoint));
    }
    return evicted.size;
  }

  validateCheckpoint(checkpoint) {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
      throw new Error('checkpoint must be an object');
    }
    if (typeof checkpoint.name !== 'string' || !checkpoint.name.trim()) {
      throw new Error('checkpoint name is required');
    }
    if (!checkpoint.state || typeof checkpoint.state !== 'object') {
      throw new Error('checkpoint state is required');
    }
  }

  async list(genomePath) {
    const key = this.normalizeGenomePath(genomePath);
    return this.withLock(key, async () => {
      const document = await this.readDocument(key);
      return { checkpoints: document.checkpoints };
    });
  }

  /**
   * Append checkpoints, assigning ids. A checkpoint that alone exceeds the byte budget is not
   * stored and is reported in `rejected`.
   */
  async add(genomePath, checkpoints) {
    const key = this.normalizeGenomePath(genomePath);
    if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
      throw new Error('checkpoints must be a non-empty array');
    }
    checkpoints.forEach(checkpoint => this.validateCheckpoint(checkpoint));

    return this.withLock(key, async () => {
      const document = await this.readDocument(key);
      const added = [];
      const rejected = [];

      for (const checkpoint of checkpoints) {
        const stored = {
          ...checkpoint,
          id: document.nextCheckpointId,
          timestamp: new Date(timestampOf(checkpoint) || Date.now()).toISOString(),
        };
        if (Buffer.byteLength(JSON.stringify(stored), 'utf8') > this.maxBytes) {
          rejected.push(checkpoint.name);
          continue;
        }
        document.nextCheckpointId += 1;
        document.checkpoints.push(stored);
        added.push(stored.id);
      }

      if (added.length > 0) {
        this.enforceLimits(document);
        await this.writeDocument(document);
      }

      const kept = new Set(document.checkpoints.map(checkpoint => checkpoint.id));
      return {
        checkpoints: document.checkpoints,
        added: added.filter(id => kept.has(id)),
        rejected,
      };
    });
  }

  async remove(genomePath, { ids = [], all = false } = {}) {
    const key = this.normalizeGenomePath(genomePath);
    return this.withLock(key, async () => {
      const document = await this.readDocument(key);
      const removeIds = new Set(ids);
      const before = document.checkpoints.length;
      document.checkpoints = all ? [] : document.checkpoints.filter(checkpoint => !removeIds.has(checkpoint.id));
      const removed = before - document.checkpoints.length;
      if (removed > 0) await this.writeDocument(document);
      return { checkpoints: document.checkpoints, removed };
    });
  }

  /**
   * One-time import of the checkpoints older versions kept in renderer localStorage. The marker
   * makes it idempotent when several genome views start at once.
   */
  async importLegacy(groups) {
    if (!Array.isArray(groups)) throw new Error('groups must be an array');
    const marker = path.join(this.storageDir, LEGACY_IMPORT_MARKER);

    return this.withLock(marker, async () => {
      try {
        await fs.access(marker);
        return { imported: 0, alreadyImported: true, genomePaths: [] };
      } catch {
        // Not imported yet.
      }

      let imported = 0;
      const genomePaths = [];
      for (const group of groups) {
        if (!Array.isArray(group?.checkpoints) || group.checkpoints.length === 0) continue;
        const result = await this.add(group.genomePath, group.checkpoints);
        if (result.added.length > 0) {
          imported += result.added.length;
          genomePaths.push(this.normalizeGenomePath(group.genomePath));
        }
      }

      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.writeFile(marker, JSON.stringify({ importedAt: new Date().toISOString(), imported }), 'utf8');
      return { imported, alreadyImported: false, genomePaths };
    });
  }
}

function registerCheckpointIpc({ ipcMain, app, isRegisteredGenomeSender, storageDir = null }) {
  const store = new CheckpointStore({ storageDir: storageDir || path.join(app.getPath('userData'), 'checkpoints') });
  // webContents id -> { sender, genomePath, key }: which genome each view is showing checkpoints for.
  const subscribers = new Map();

  const subscribe = (sender, genomePath) => {
    const key = store.normalizeGenomePath(genomePath);
    if (!subscribers.has(sender.id)) {
      const id = sender.id;
      sender.once('destroyed', () => subscribers.delete(id));
    }
    subscribers.set(sender.id, { sender, genomePath, key });
    return key;
  };

  const notifyOthers = (origin, key) => {
    for (const [id, subscriber] of subscribers) {
      if (id === origin.id || subscriber.key !== key) continue;
      if (typeof subscriber.sender.isDestroyed === 'function' && subscriber.sender.isDestroyed()) {
        subscribers.delete(id);
        continue;
      }
      try {
        subscriber.sender.send(CHANGED_CHANNEL, { genomePath: subscriber.genomePath });
      } catch (error) {
        console.warn('[CheckpointStore] Failed to notify a genome view of checkpoint changes:', error.message);
      }
    }
  };

  const handlers = {
    'checkpoints:list': async (event, params) => {
      subscribe(event.sender, params?.genomePath);
      return store.list(params.genomePath);
    },
    'checkpoints:add': async (event, params) => {
      const key = subscribe(event.sender, params?.genomePath);
      const result = await store.add(params.genomePath, params.checkpoints);
      if (result.added.length > 0) notifyOthers(event.sender, key);
      return result;
    },
    'checkpoints:remove': async (event, params) => {
      const key = subscribe(event.sender, params?.genomePath);
      const result = await store.remove(params.genomePath, { ids: params.ids, all: params.all === true });
      if (result.removed > 0) notifyOthers(event.sender, key);
      return result;
    },
    'checkpoints:import-legacy': async (event, params) => {
      const result = await store.importLegacy(params?.groups);
      result.genomePaths.forEach(key => notifyOthers(event.sender, key));
      return result;
    },
  };

  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, params) => {
      try {
        if (!isRegisteredGenomeSender(event)) throw new Error('Checkpoints are only available in genome views.');
        return { success: true, ...(await handler(event, params)) };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  return store;
}

module.exports = {
  CheckpointStore,
  registerCheckpointIpc,
  MAX_CHECKPOINTS,
  MAX_STORE_BYTES,
  CHANGED_CHANNEL,
};
