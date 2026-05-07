/**
 * ErrorHandler Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ErrorHandler = (await import('../../src/renderer/modules/core/ErrorHandler.js')).default || (await import('../../src/renderer/modules/core/ErrorHandler.js'));

describe('ErrorHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new ErrorHandler({ showToasts: false });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('handle()', () => {
    it('should increment error count', () => {
      handler.handle(new Error('test'));
      expect(handler.getStats().total).toBe(1);
    });

    it('should log errors to console with context', () => {
      handler.handle(new Error('boom'), 'ChatManager.send');
      expect(console.error).toHaveBeenCalled();
    });

    it('should accept string errors', () => {
      handler.handle('string error', 'somewhere');
      expect(handler.getStats().total).toBe(1);
    });

    it('should track error history', () => {
      handler.handle(new Error('e1'), 'ctx1');
      handler.handle(new Error('e2'), 'ctx2');
      const stats = handler.getStats();
      expect(stats.recent.length).toBe(2);
      expect(stats.recent[0].context).toBe('ctx1');
      expect(stats.recent[1].context).toBe('ctx2');
    });
  });

  describe('fatal()', () => {
    it('should call console.error for fatal errors', () => {
      handler.fatal(new Error('critical'));
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('warning()', () => {
    it('should log warnings', () => {
      handler.warning(new Error('minor'));
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('info()', () => {
    it('should log diagnostic info', () => {
      handler.info(new Error('diagnostic'));
      expect(console.info).toHaveBeenCalled();
    });
  });

  describe('error history limit', () => {
    it('should keep last 50 errors', () => {
      for (let i = 0; i < 60; i++) {
        handler.handle(new Error(`err${i}`));
      }
      const stats = handler.getStats();
      expect(stats.recent.length).toBeLessThanOrEqual(50);
    });
  });

  describe('clearHistory()', () => {
    it('should reset error count and history', () => {
      handler.handle(new Error('e1'));
      handler.handle(new Error('e2'));
      handler.clearHistory();
      expect(handler.getStats().total).toBe(0);
      expect(handler.getStats().recent.length).toBe(0);
    });
  });

  describe('callback', () => {
    it('should call onError callback', () => {
      const callback = vi.fn();
      const h = new ErrorHandler({ onError: callback, showToasts: false });
      h.handle(new Error('callback test'), 'ctx');
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'callback test', context: 'ctx' }),
        'error'
      );
    });

    it('should catch errors in callback gracefully', () => {
      const callback = vi.fn(() => { throw new Error('callback error'); });
      const h = new ErrorHandler({ onError: callback, showToasts: false });
      expect(() => h.handle(new Error('test'))).not.toThrow();
    });
  });

  describe('wrap()', () => {
    it('should wrap sync functions with error handling', () => {
      const badFn = () => { throw new Error('fail'); };
      const wrapped = handler.wrap(badFn, 'testFn');
      expect(() => wrapped()).toThrow('fail');
      expect(handler.getStats().total).toBe(1);
    });
  });

  describe('safeAsync()', () => {
    it('should return [result, null] on success', async () => {
      const [result, error] = await ErrorHandler.safeAsync(async () => 42);
      expect(result).toBe(42);
      expect(error).toBeNull();
    });

    it('should return [null, error] on failure', async () => {
      const [result, error] = await ErrorHandler.safeAsync(async () => {
        throw new Error('async fail');
      });
      expect(result).toBeNull();
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('async fail');
    });
  });

  describe('global handler registration', () => {
    it('should define registerGlobalHandlers without throwing', () => {
      expect(() => handler.registerGlobalHandlers()).not.toThrow();
    });
  });

  describe('singleton instance', () => {
    it('should support setInstance/getInstance', () => {
      ErrorHandler.setInstance(handler);
      expect(ErrorHandler.getInstance()).toBe(handler);
      ErrorHandler.setInstance(null);
    });
  });
});
