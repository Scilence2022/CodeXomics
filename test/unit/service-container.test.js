/**
 * ServiceContainer Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Import the ServiceContainer class
const ServiceContainer = (await import('../../src/renderer/modules/core/ServiceContainer.js')).default || (await import('../../src/renderer/modules/core/ServiceContainer.js'));

describe('ServiceContainer', () => {
  let container;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('register()', () => {
    it('should register a service with a factory function', () => {
      container.register('test', () => 'value');
      expect(container.has('test')).toBe(true);
    });

    it('should accept dependencies array', () => {
      container.register('test', () => 'value', ['dep1', 'dep2']);
      const graph = container.getDependencyGraph();
      const testEntry = graph.find(e => e.name === 'test');
      expect(testEntry.deps).toEqual(['dep1', 'dep2']);
    });

    it('should warn on duplicate registration', () => {
      const warnSpy = { calls: [] };
      const origWarn = console.warn;
      console.warn = (...args) => warnSpy.calls.push(args);

      container.register('dup', () => 1);
      container.register('dup', () => 2);

      console.warn = origWarn;
      expect(warnSpy.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('get()', () => {
    it('should return the factory result', () => {
      container.register('greeting', () => 'hello');
      expect(container.get('greeting')).toBe('hello');
    });

    it('should cache singletons (same instance on multiple gets)', () => {
      let counter = 0;
      container.register('counter', () => ({ id: ++counter }));
      const a = container.get('counter');
      const b = container.get('counter');
      expect(a).toBe(b);
      expect(a.id).toBe(1);
      expect(b.id).toBe(1);
    });

    it('should throw for unregistered service', () => {
      expect(() => container.get('nonexistent')).toThrow(/not registered/);
    });

    it('should throw error message listing available services', () => {
      container.register('available1', () => 1);
      container.register('available2', () => 2);
      expect(() => container.get('missing')).toThrow(/available1, available2/);
    });

    it('should detect circular dependencies', () => {
      container.register('a', (c) => c.get('b'));
      container.register('b', (c) => c.get('a'));
      expect(() => container.get('a')).toThrow(/circular/i);
    });

    it('should pass container to factory for dependency resolution', () => {
      container.register('db', () => ({ connected: true }));
      container.register('service', (c) => ({ db: c.get('db') }));
      const svc = container.get('service');
      expect(svc.db).toEqual({ connected: true });
    });

    it('should support chain of 3+ dependencies', () => {
      container.register('config', () => ({ env: 'prod' }));
      container.register('logger', (c) => ({ config: c.get('config') }));
      container.register('app', (c) => ({ logger: c.get('logger') }));

      const app = container.get('app');
      expect(app.logger.config.env).toBe('prod');
    });
  });

  describe('has()', () => {
    it('should return true for registered services', () => {
      container.register('foo', () => 1);
      expect(container.has('foo')).toBe(true);
    });

    it('should return false for unregistered services', () => {
      expect(container.has('bar')).toBe(false);
    });
  });

  describe('list()', () => {
    it('should return empty array for empty container', () => {
      expect(container.list()).toEqual([]);
    });

    it('should return all registered service names', () => {
      container.register('a', () => 1);
      container.register('b', () => 2);
      container.register('c', () => 3);
      expect(container.list().sort()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getDependencyGraph()', () => {
    it('should return instantiated=false before get()', () => {
      container.register('svc', () => 'val');
      const graph = container.getDependencyGraph();
      expect(graph[0].instantiated).toBe(false);
    });

    it('should return instantiated=true after get()', () => {
      container.register('svc', () => 'val');
      container.get('svc');
      const graph = container.getDependencyGraph();
      expect(graph[0].instantiated).toBe(true);
    });
  });

  describe('initializeAll()', () => {
    it('should eagerly initialize all services', () => {
      let initCount = 0;
      container.register('s1', () => { initCount++; return 'a'; });
      container.register('s2', () => { initCount++; return 'b'; });

      const names = container.initializeAll();
      expect(names.sort()).toEqual(['s1', 's2']);
      expect(initCount).toBe(2);
    });

    it('should throw if any service fails to initialize', () => {
      container.register('good', () => 'ok');
      container.register('bad', () => { throw new Error('init failed'); });
      expect(() => container.initializeAll()).toThrow('init failed');
    });
  });

  describe('reset()', () => {
    it('should clear all cached instances', () => {
      let counter = 0;
      container.register('counter', () => ++counter);

      expect(container.get('counter')).toBe(1);
      container.reset();
      expect(container.get('counter')).toBe(2); // New instance
    });
  });

  describe('unregister()', () => {
    it('should remove a registered service', () => {
      container.register('temp', () => 'val');
      expect(container.has('temp')).toBe(true);
      container.unregister('temp');
      expect(container.has('temp')).toBe(false);
    });
  });
});
