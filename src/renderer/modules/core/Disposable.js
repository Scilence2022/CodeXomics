/**
 * Disposable - Core resource management pattern inspired by VS Code Extension API
 * 
 * Provides a mechanism to manage resource cleanup by executing a function when
 * the disposable is disposed. This is fundamental to extension lifecycle management.
 * 
 * @see https://code.visualstudio.com/api/references/vscode-api#Disposable
 */

/**
 * Represents a type that can release resources when no longer needed.
 * @interface IDisposable
 */

/**
 * Disposable class that wraps a cleanup function
 */
class Disposable {
    /**
     * Creates a new Disposable
     * @param {Function} callOnDispose - Function to execute when disposed
     */
    constructor(callOnDispose) {
        this._callOnDispose = callOnDispose;
        this._isDisposed = false;
    }

    /**
     * Combines multiple disposable-likes into one Disposable
     * @param {...{dispose: Function}} disposableLikes - Objects with dispose methods
     * @returns {Disposable} A new Disposable that disposes all provided disposables
     */
    static from(...disposableLikes) {
        return new Disposable(() => {
            for (const disposable of disposableLikes) {
                if (disposable && typeof disposable.dispose === 'function') {
                    try {
                        disposable.dispose();
                    } catch (error) {
                        console.error('Error disposing resource:', error);
                    }
                }
            }
        });
    }

    /**
     * Creates an empty Disposable that does nothing when disposed
     * @returns {Disposable}
     */
    static get NONE() {
        return new Disposable(() => {});
    }

    /**
     * Check if this disposable has been disposed
     * @returns {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * Dispose this object and release associated resources
     * @returns {any} Result of the cleanup function
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;

        if (this._callOnDispose) {
            try {
                return this._callOnDispose();
            } catch (error) {
                console.error('Error during dispose:', error);
                throw error;
            } finally {
                this._callOnDispose = null;
            }
        }
    }
}

/**
 * DisposableStore - Manages a collection of disposables
 * 
 * Provides safe management of multiple disposables with automatic cleanup.
 * When the store is disposed, all registered disposables are also disposed.
 */
class DisposableStore {
    constructor() {
        /** @type {Set<IDisposable>} */
        this._disposables = new Set();
        this._isDisposed = false;
    }

    /**
     * Check if this store has been disposed
     * @returns {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * Add a disposable to the store
     * @template T
     * @param {T} disposable - The disposable to add
     * @returns {T} The same disposable for chaining
     */
    add(disposable) {
        if (this._isDisposed) {
            console.warn('Adding disposable to an already disposed store');
            if (disposable && typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
            return disposable;
        }

        this._disposables.add(disposable);
        return disposable;
    }

    /**
     * Remove a disposable from the store without disposing it
     * @param {IDisposable} disposable - The disposable to remove
     * @returns {boolean} True if the disposable was found and removed
     */
    delete(disposable) {
        return this._disposables.delete(disposable);
    }

    /**
     * Remove and dispose a specific disposable from the store
     * @param {IDisposable} disposable - The disposable to remove and dispose
     */
    deleteAndDispose(disposable) {
        if (this._disposables.delete(disposable)) {
            if (typeof disposable.dispose === 'function') {
                disposable.dispose();
            }
        }
    }

    /**
     * Clear all disposables without disposing them
     */
    clear() {
        this._disposables.clear();
    }

    /**
     * Clear and dispose all disposables
     */
    clearAndDisposeAll() {
        if (this._isDisposed) {
            return;
        }

        const disposables = Array.from(this._disposables);
        this._disposables.clear();

        for (const disposable of disposables) {
            try {
                if (typeof disposable.dispose === 'function') {
                    disposable.dispose();
                }
            } catch (error) {
                console.error('Error disposing item in store:', error);
            }
        }
    }

    /**
     * Dispose the store and all its disposables
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;
        this.clearAndDisposeAll();
    }

    /**
     * Get the number of disposables in the store
     * @returns {number}
     */
    get size() {
        return this._disposables.size;
    }
}

/**
 * MutableDisposable - A disposable that can be replaced
 * 
 * Useful when you need to track a single resource that may change over time.
 * Setting a new value automatically disposes the previous one.
 */
class MutableDisposable {
    constructor() {
        /** @type {IDisposable|undefined} */
        this._value = undefined;
        this._isDisposed = false;
    }

    /**
     * Get the current disposable value
     * @returns {IDisposable|undefined}
     */
    get value() {
        return this._isDisposed ? undefined : this._value;
    }

    /**
     * Set a new disposable value, disposing the previous one
     * @param {IDisposable|undefined} value - The new disposable
     */
    set value(value) {
        if (this._isDisposed) {
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
            return;
        }

        if (this._value === value) {
            return;
        }

        // Dispose the old value
        if (this._value && typeof this._value.dispose === 'function') {
            this._value.dispose();
        }

        this._value = value;
    }

    /**
     * Clear the current value without disposing it
     * @returns {IDisposable|undefined} The previous value
     */
    clear() {
        const oldValue = this._value;
        this._value = undefined;
        return oldValue;
    }

    /**
     * Clear and dispose the current value
     */
    clearAndDispose() {
        if (this._value && typeof this._value.dispose === 'function') {
            this._value.dispose();
        }
        this._value = undefined;
    }

    /**
     * Dispose the MutableDisposable and its current value
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;
        this.clearAndDispose();
    }

    /**
     * Check if this has been disposed
     * @returns {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }
}

/**
 * RefCountedDisposable - A disposable with reference counting
 * 
 * Allows multiple references to a shared resource. The underlying resource
 * is only disposed when all references have been released.
 */
class RefCountedDisposable {
    /**
     * @param {IDisposable} value - The disposable to manage
     */
    constructor(value) {
        this._value = value;
        this._refCount = 1;
    }

    /**
     * Acquire a new reference
     * @returns {RefCountedDisposable} A new reference to the same resource
     */
    acquire() {
        this._refCount++;
        return this;
    }

    /**
     * Release a reference. When all references are released, the resource is disposed.
     */
    dispose() {
        if (--this._refCount === 0) {
            if (this._value && typeof this._value.dispose === 'function') {
                this._value.dispose();
            }
            this._value = null;
        }
    }

    /**
     * Get the current reference count
     * @returns {number}
     */
    get refCount() {
        return this._refCount;
    }
}

/**
 * AsyncDisposable - For asynchronous cleanup operations
 */
class AsyncDisposable {
    /**
     * @param {Function} asyncCallOnDispose - Async function to execute when disposed
     */
    constructor(asyncCallOnDispose) {
        this._callOnDispose = asyncCallOnDispose;
        this._isDisposed = false;
        this._disposePromise = null;
    }

    /**
     * Check if this has been disposed
     * @returns {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * Dispose this object asynchronously
     * @returns {Promise<void>}
     */
    async dispose() {
        if (this._isDisposed) {
            return this._disposePromise;
        }

        this._isDisposed = true;

        if (this._callOnDispose) {
            this._disposePromise = Promise.resolve().then(async () => {
                try {
                    await this._callOnDispose();
                } catch (error) {
                    console.error('Error during async dispose:', error);
                    throw error;
                } finally {
                    this._callOnDispose = null;
                }
            });

            return this._disposePromise;
        }
    }
}

/**
 * DisposableMap - A Map that automatically disposes values when removed
 * @template K, V
 */
class DisposableMap {
    constructor() {
        /** @type {Map<K, V>} */
        this._store = new Map();
        this._isDisposed = false;
    }

    /**
     * Set a value in the map, disposing any previous value with the same key
     * @param {K} key 
     * @param {V} value 
     */
    set(key, value) {
        if (this._isDisposed) {
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
            return;
        }

        const oldValue = this._store.get(key);
        if (oldValue && typeof oldValue.dispose === 'function') {
            oldValue.dispose();
        }

        this._store.set(key, value);
    }

    /**
     * Get a value from the map
     * @param {K} key 
     * @returns {V|undefined}
     */
    get(key) {
        return this._store.get(key);
    }

    /**
     * Check if the map has a key
     * @param {K} key 
     * @returns {boolean}
     */
    has(key) {
        return this._store.has(key);
    }

    /**
     * Delete a key and dispose its value
     * @param {K} key 
     * @returns {boolean}
     */
    delete(key) {
        const value = this._store.get(key);
        const deleted = this._store.delete(key);

        if (value && typeof value.dispose === 'function') {
            value.dispose();
        }

        return deleted;
    }

    /**
     * Clear all entries, disposing each value
     */
    clear() {
        for (const value of this._store.values()) {
            if (value && typeof value.dispose === 'function') {
                value.dispose();
            }
        }
        this._store.clear();
    }

    /**
     * Dispose the map and all its values
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;
        this.clear();
    }

    /**
     * Get the size of the map
     * @returns {number}
     */
    get size() {
        return this._store.size;
    }

    /**
     * Get all keys
     * @returns {IterableIterator<K>}
     */
    keys() {
        return this._store.keys();
    }

    /**
     * Get all values
     * @returns {IterableIterator<V>}
     */
    values() {
        return this._store.values();
    }

    /**
     * Get all entries
     * @returns {IterableIterator<[K, V]>}
     */
    entries() {
        return this._store.entries();
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Disposable,
        DisposableStore,
        MutableDisposable,
        RefCountedDisposable,
        AsyncDisposable,
        DisposableMap
    };
} else if (typeof window !== 'undefined') {
    window.Disposable = Disposable;
    window.DisposableStore = DisposableStore;
    window.MutableDisposable = MutableDisposable;
    window.RefCountedDisposable = RefCountedDisposable;
    window.AsyncDisposable = AsyncDisposable;
    window.DisposableMap = DisposableMap;
}
