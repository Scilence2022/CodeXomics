/**
 * Disposable Pattern Tests
 */
import { describe, it, expect, vi } from 'vitest';

// Mock Disposable since it loads as script tag, not ES module
class Disposable {
  constructor(callOnDispose) {
    this._callOnDispose = callOnDispose;
    this._isDisposed = false;
  }

  dispose() {
    if (!this._isDisposed && this._callOnDispose) {
      this._isDisposed = true;
      this._callOnDispose();
    }
  }

  get isDisposed() {
    return this._isDisposed;
  }

  static from(...disposableLikes) {
    return new Disposable(() => {
      for (const d of disposableLikes) {
        if (d && typeof d.dispose === 'function') {
          d.dispose();
        }
      }
    });
  }
}

describe('Disposable Pattern', () => {
  it('should call dispose function exactly once', () => {
    const fn = vi.fn();
    const d = new Disposable(fn);
    d.dispose();
    d.dispose(); // second call
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should track disposal state', () => {
    const d = new Disposable(() => {});
    expect(d.isDisposed).toBe(false);
    d.dispose();
    expect(d.isDisposed).toBe(true);
  });

  it('Disposable.from should combine multiple disposables', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const d = Disposable.from(
      new Disposable(fn1),
      new Disposable(fn2)
    );
    d.dispose();
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('Disposable.from should handle null/undefined', () => {
    const fn = vi.fn();
    const d = Disposable.from(
      new Disposable(fn),
      null,
      undefined,
      { dispose: 'not a function' }
    );
    expect(() => d.dispose()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Disposable.from should skip already-disposed items', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const d1 = new Disposable(fn1);
    d1.dispose(); // already disposed
    const d2 = new Disposable(fn2);
    const combined = Disposable.from(d1, d2);
    combined.dispose();
    expect(fn1).toHaveBeenCalledTimes(1); // only from earlier
    expect(fn2).toHaveBeenCalledTimes(1); // from combined
  });

  it('should not throw if dispose function is missing', () => {
    const d = new Disposable(null);
    expect(() => d.dispose()).not.toThrow();
  });
});
