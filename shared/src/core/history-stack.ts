export interface HistoryStackOptions<T> {
	maxSize?: number;
	equals?: (a: T, b: T) => boolean;
}

const DEFAULT_MAX_SIZE = 100;

/**
 * Linear history with a cursor.
 *
 * Two coexisting use cases:
 * - **Navigation** (cursor stays within `[0, length-1]`) — `back()`/`forward()`
 *   refuse to fall off the origin. `canGoBack()` is true only when there is an
 *   *earlier* entry to retreat to.
 * - **Undo/redo stack** (cursor may sit at `-1` meaning "nothing applied") —
 *   `retreat()` and `dropCurrent()` allow the cursor to step past index 0.
 *   `hasCurrent()` distinguishes "an entry exists at the cursor" from "an entry
 *   exists before the cursor".
 */
export class HistoryStack<T> {
	private entries: T[] = [];
	private cursor = -1;
	private locked = false;
	private readonly maxSize: number;
	private readonly equals: ((a: T, b: T) => boolean) | undefined;

	constructor(options?: HistoryStackOptions<T>) {
		this.maxSize = options?.maxSize ?? DEFAULT_MAX_SIZE;
		this.equals = options?.equals;
	}

	push(entry: T): void {
		if (this.locked) return;

		const current = this.current();
		if (current !== null && this.equals?.(current, entry)) return;

		this.entries.length = this.cursor + 1;
		this.entries.push(entry);
		this.cursor = this.entries.length - 1;

		if (this.entries.length > this.maxSize) {
			this.entries.shift();
			this.cursor--;
		}
	}

	current(): T | null {
		return this.cursor >= 0 ? this.entries[this.cursor] : null;
	}

	/** True iff the cursor points at an entry (cursor >= 0). */
	hasCurrent(): boolean {
		return this.cursor >= 0;
	}

	back(): T | null {
		if (!this.canGoBack()) return null;
		this.cursor--;
		return this.entries[this.cursor];
	}

	forward(): T | null {
		if (!this.canGoForward()) return null;
		this.cursor++;
		return this.entries[this.cursor];
	}

	/** Navigate back/forward and run a callback while pushes are suppressed. */
	navigate(direction: "back" | "forward", apply: (entry: T) => void): boolean {
		const entry = direction === "back" ? this.back() : this.forward();
		if (!entry) return false;
		this.locked = true;
		apply(entry);
		this.locked = false;
		return true;
	}

	/**
	 * Move cursor back one step (may land at -1). Returns the entry the cursor
	 * was on before moving. Used by stack-style callers that need to mark the
	 * current entry as "no longer applied" while keeping it available for
	 * `forward()` to re-apply.
	 */
	retreat(): T | null {
		if (this.cursor < 0) return null;
		const entry = this.entries[this.cursor];
		this.cursor--;
		return entry;
	}

	/**
	 * Remove the entry at the cursor entirely; cursor moves back by one. Entries
	 * beyond the cursor are preserved. Used to discard a command that failed to
	 * undo/redo, so the remaining redo branch stays intact.
	 */
	dropCurrent(): T | null {
		if (this.cursor < 0) return null;
		const [dropped] = this.entries.splice(this.cursor, 1);
		this.cursor--;
		return dropped;
	}

	canGoBack(): boolean {
		return this.cursor > 0;
	}

	canGoForward(): boolean {
		return this.cursor < this.entries.length - 1;
	}

	clear(): void {
		this.entries = [];
		this.cursor = -1;
	}

	get size(): number {
		return this.entries.length;
	}

	/** Number of entries up to and including the cursor (i.e. "undoable" count). */
	get appliedCount(): number {
		return this.cursor + 1;
	}

	/** Number of entries past the cursor (i.e. "redoable" count). */
	get forwardCount(): number {
		return this.entries.length - this.cursor - 1;
	}

	/** Entry that `forward()` would land on, without moving the cursor. */
	peekForward(): T | null {
		const next = this.cursor + 1;
		return next < this.entries.length ? this.entries[next] : null;
	}
}
