/**
 * One modal at a time may be minimized, app-wide.
 *
 * The single slot is the whole design: a minimized modal is a piece of work the
 * user has paused mid-sentence, and a stack of them is a stack of things they
 * have forgotten they owe. Prisma's event modal established the model
 * ([[decision-component-renderer]]); this is the plugin-agnostic version so the
 * capability is inherited rather than re-implemented per plugin.
 *
 * The slot holds the *state*, never a mounted component — restoring means
 * opening a fresh modal seeded with the state, which is what makes
 * minimize→restore lossless without keeping a detached React tree alive.
 */
export interface MinimizedModal<State> {
	/** What a restore affordance or notice calls this, e.g. "Bug report". */
	label: string;
	state: State;
	restore: (state: State) => void;
}

type Listener = () => void;

class MinimizedModalSlot {
	private entry: MinimizedModal<never> | null = null;
	private readonly listeners = new Set<Listener>();

	/** Replaces whatever was minimized — the previous entry is dropped, not stacked. */
	save<State>(entry: MinimizedModal<State>): void {
		this.entry = entry as unknown as MinimizedModal<never>;
		this.emit();
	}

	get<State>(): MinimizedModal<State> | null {
		return this.entry as MinimizedModal<State> | null;
	}

	has(): boolean {
		return this.entry !== null;
	}

	label(): string | null {
		return this.entry?.label ?? null;
	}

	/** Folds an update into the held state — how a capture appends to a minimized report. */
	patch<State>(update: (state: State) => State): void {
		if (this.entry === null) return;
		const current = this.entry as unknown as MinimizedModal<State>;
		this.entry = { ...current, state: update(current.state) } as unknown as MinimizedModal<never>;
		this.emit();
	}

	clear(): void {
		if (this.entry === null) return;
		this.entry = null;
		this.emit();
	}

	/** Empties the slot before restoring, so the restored modal owns the state again. */
	restore(): void {
		const entry = this.entry;
		if (entry === null) return;
		this.entry = null;
		this.emit();
		entry.restore(entry.state);
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}
}

export const MinimizedModals = new MinimizedModalSlot();
