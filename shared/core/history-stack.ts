export interface HistoryStackOptions<T> {
	maxSize?: number;
	equals?: (a: T, b: T) => boolean;
}

const DEFAULT_MAX_SIZE = 100;

export class HistoryStack<T> {
	private entries: T[] = [];
	private index = -1;
	private locked = false;
	private readonly maxSize: number;
	private readonly equals: ((a: T, b: T) => boolean) | undefined;

	constructor(options?: HistoryStackOptions<T>) {
		this.maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
		this.equals = options?.equals;
	}

	push(entry: T): void {
		if (this.locked) return;

		const current = this.entries[this.index];
		if (current && this.equals?.(current, entry)) return;

		this.entries = this.entries.slice(0, this.index + 1);
		this.entries.push(entry);

		if (this.entries.length > this.maxSize) {
			this.entries.shift();
		}

		this.index = this.entries.length - 1;
	}

	back(): T | null {
		if (!this.canGoBack()) return null;

		this.locked = true;
		this.index--;
		this.locked = false;
		return this.entries[this.index];
	}

	forward(): T | null {
		if (!this.canGoForward()) return null;

		this.locked = true;
		this.index++;
		this.locked = false;
		return this.entries[this.index];
	}

	current(): T | null {
		return this.entries[this.index] ?? null;
	}

	canGoBack(): boolean {
		return this.index > 0;
	}

	canGoForward(): boolean {
		return this.index < this.entries.length - 1;
	}

	clear(): void {
		this.entries = [];
		this.index = -1;
	}

	get size(): number {
		return this.entries.length;
	}
}
