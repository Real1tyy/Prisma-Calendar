/**
 * Fixed-capacity map with LRU eviction. Backed by `Map`, which preserves
 * insertion order — re-inserting a key on access promotes it to most-recent.
 *
 * Recency semantics:
 * - `get(key)` — promotes the key to most-recently-used.
 * - `set(key, value)` — inserts or promotes the key to most-recently-used.
 * - `has(key)` — **does not** promote. Use `get` if you want a lookup that
 *   also affects eviction order.
 * - `peek(key)` — explicit non-promoting read, useful for diagnostics or
 *   read-through patterns where you need the value without disturbing LRU
 *   state.
 *
 * Iteration (`keys`, `values`, `entries`, `forEach`, `[Symbol.iterator]`)
 * walks entries in LRU order, oldest first — the same order in which they
 * would be evicted.
 *
 * Use for long-lived path-keyed caches (indexer frontmatter, compiled
 * expressions) so memory cannot grow without bound over a session.
 */
export class BoundedMap<K, V> {
	private readonly store = new Map<K, V>();

	constructor(private readonly maxSize: number) {
		if (!Number.isInteger(maxSize) || maxSize <= 0) {
			throw new Error(`BoundedMap maxSize must be a positive integer, got ${maxSize}`);
		}
	}

	get size(): number {
		return this.store.size;
	}

	get capacity(): number {
		return this.maxSize;
	}

	has(key: K): boolean {
		return this.store.has(key);
	}

	get(key: K): V | undefined {
		if (!this.store.has(key)) return undefined;
		const value = this.store.get(key)!;
		this.store.delete(key);
		this.store.set(key, value);
		return value;
	}

	peek(key: K): V | undefined {
		return this.store.get(key);
	}

	set(key: K, value: V): this {
		if (this.store.has(key)) {
			this.store.delete(key);
		} else if (this.store.size >= this.maxSize) {
			const oldest = this.store.keys().next();
			if (!oldest.done) this.store.delete(oldest.value);
		}
		this.store.set(key, value);
		return this;
	}

	delete(key: K): boolean {
		return this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}

	keys(): IterableIterator<K> {
		return this.store.keys();
	}

	values(): IterableIterator<V> {
		return this.store.values();
	}

	entries(): IterableIterator<[K, V]> {
		return this.store.entries();
	}

	forEach(callback: (value: V, key: K, map: BoundedMap<K, V>) => void): void {
		this.store.forEach((value, key) => callback(value, key, this));
	}

	[Symbol.iterator](): IterableIterator<[K, V]> {
		return this.store.entries();
	}
}
