/**
 * Fixed-capacity FIFO: once full, `push` evicts the oldest item.
 *
 * Kept as a ring (head index + count) rather than an array + `shift()` because
 * logging appends on hot paths — `shift()` would reindex the whole backing array
 * on every call past capacity.
 */
export class RingBuffer<T> implements Iterable<T> {
	private readonly items: (T | undefined)[];
	private start = 0;
	private count = 0;

	constructor(readonly capacity: number) {
		if (!Number.isInteger(capacity) || capacity < 1) {
			throw new RangeError(`RingBuffer capacity must be a positive integer, got ${capacity}`);
		}
		this.items = new Array<T | undefined>(capacity).fill(undefined);
	}

	get length(): number {
		return this.count;
	}

	push(item: T): void {
		this.items[(this.start + this.count) % this.capacity] = item;
		if (this.count < this.capacity) {
			this.count++;
		} else {
			this.start = (this.start + 1) % this.capacity;
		}
	}

	clear(): void {
		// Drop the references too, not just the count — a discarded entry's `data`
		// may retain an arbitrarily large object graph.
		this.items.fill(undefined);
		this.start = 0;
		this.count = 0;
	}

	*[Symbol.iterator](): IterableIterator<T> {
		for (let i = 0; i < this.count; i++) {
			yield this.items[(this.start + i) % this.capacity] as T;
		}
	}

	/** Oldest-first copy. */
	toArray(): T[] {
		return [...this];
	}
}
