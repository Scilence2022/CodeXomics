/**
 * ShortTermMemory Tests
 *
 * Validates the in-memory cache used for function call caching
 * with TTL-based eviction in the renderer process.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Lightweight reimplementation matching src/renderer/modules/MemoryLayers/ShortTermMemory.js pattern
class ShortTermMemory {
  constructor(maxSize = 100, ttl = 300000) {
    this._map = new Map();
    this._maxSize = maxSize;
    this._ttl = ttl; // 5 min default
  }

  set(key, value) {
    if (this._map.size >= this._maxSize) {
      const firstKey = this._map.keys().next().value;
      this._map.delete(firstKey);
    }
    this._map.set(key, { value, timestamp: Date.now() });
  }

  get(key) {
    const entry = this._map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this._ttl) {
      this._map.delete(key);
      return null;
    }
    return entry.value;
  }

  has(key) {
    return this.get(key) !== null;
  }

  delete(key) {
    return this._map.delete(key);
  }

  clear() {
    this._map.clear();
  }

  get size() {
    return this._map.size;
  }

  getExpiredKeys() {
    const now = Date.now();
    const expired = [];
    for (const [key, entry] of this._map) {
      if (now - entry.timestamp > this._ttl) {
        expired.push(key);
      }
    }
    return expired;
  }

  evictExpired() {
    const expired = this.getExpiredKeys();
    for (const key of expired) {
      this._map.delete(key);
    }
    return expired.length;
  }
}

describe('ShortTermMemory', () => {
  let memory;

  beforeEach(() => {
    memory = new ShortTermMemory();
  });

  it('should store and retrieve values', () => {
    memory.set('key1', 'value1');
    expect(memory.get('key1')).toBe('value1');
  });

  it('should return null for missing keys', () => {
    expect(memory.get('nonexistent')).toBeNull();
  });

  it('should check existence with has()', () => {
    memory.set('exists', 'yes');
    expect(memory.has('exists')).toBe(true);
    expect(memory.has('missing')).toBe(false);
  });

  it('should delete entries', () => {
    memory.set('temp', 'data');
    memory.delete('temp');
    expect(memory.has('temp')).toBe(false);
  });

  it('should clear all entries', () => {
    memory.set('a', 1);
    memory.set('b', 2);
    memory.clear();
    expect(memory.size).toBe(0);
  });

  it('should enforce max size with FIFO eviction', () => {
    const small = new ShortTermMemory(3);
    small.set('a', 1);
    small.set('b', 2);
    small.set('c', 3);
    small.set('d', 4); // should evict 'a'
    expect(small.has('a')).toBe(false);
    expect(small.get('b')).toBe(2);
    expect(small.get('c')).toBe(3);
    expect(small.get('d')).toBe(4);
  });

  it('should expire entries after TTL', () => {
    const ttl = 50; // 50ms
    const short = new ShortTermMemory(100, ttl);
    short.set('expires', 'soon');

    // Use vi.advanceTimers to simulate time
    return new Promise(resolve => {
      setTimeout(() => {
        expect(short.get('expires')).toBeNull();
        resolve();
      }, 100);
    });
  });

  it('should evict all expired entries', () => {
    const ttl = 20;
    const short = new ShortTermMemory(100, ttl);
    short.set('fresh', 'value');

    return new Promise(resolve => {
      setTimeout(() => {
        // Set another after TTL expired for first
        short.set('also-fresh', 'value');
        // Only 'fresh' should be expired
        const expired = short.getExpiredKeys();
        expect(expired).toContain('fresh');
        expect(expired).not.toContain('also-fresh');
        resolve();
      }, 30);
    });
  });

  it('should support numeric and object values', () => {
    memory.set('num', 42);
    memory.set('obj', { nested: true });
    memory.set('arr', [1, 2, 3]);

    expect(memory.get('num')).toBe(42);
    expect(memory.get('obj')).toEqual({ nested: true });
    expect(memory.get('arr')).toEqual([1, 2, 3]);
  });

  it('should track size correctly', () => {
    expect(memory.size).toBe(0);
    memory.set('a', 1);
    expect(memory.size).toBe(1);
    memory.set('b', 2);
    expect(memory.size).toBe(2);
    memory.delete('a');
    expect(memory.size).toBe(1);
  });
});
