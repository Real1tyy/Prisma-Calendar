import { LocalKV, type KVBackend } from "../storage/local-kv";
import { PersistedHistorySchema, type PersistedHistory } from "./history-entry";

export interface HistoryPersistenceOptions {
	/** `LocalKV` namespace — convention `"<plugin-id>:<feature>:<purpose>"`. */
	namespace: string;
	/** Key within the namespace; one history log per scope (e.g. a calendar id). */
	scope: string;
	/** Back-end override; omit in production (falls through to `window.localStorage`). */
	backend?: KVBackend;
	/** Trailing-debounce window for writes. */
	debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 250;

/**
 * Device-local durability for a history log — the whole storage concern behind
 * one seam.
 *
 * `localStorage` suits the shipped shape: a 100-entry metadata-only log is
 * ~15 KB, so a debounced whole-log rewrite is cheaper than tracking per-entry
 * deltas. If the cap grows by an order of magnitude, or entries ever carry
 * serialized snapshots, this class is what should be reimplemented over
 * IndexedDB (see `core/vault-table/persistence`) — nothing outside it knows how
 * the log is stored.
 */
export class HistoryPersistence {
	private readonly kv: LocalKV<PersistedHistory>;
	private readonly scope: string;
	private readonly debounceMs: number;
	private timer: number | null = null;
	private pending: (() => PersistedHistory) | null = null;

	constructor(options: HistoryPersistenceOptions) {
		this.kv = new LocalKV<PersistedHistory>({
			namespace: options.namespace,
			schema: PersistedHistorySchema,
			...(options.backend ? { backend: options.backend } : {}),
		});
		this.scope = options.scope;
		this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
	}

	/** The stored log, or `null` when absent or schema-incompatible. */
	load(): PersistedHistory | null {
		return this.kv.get(this.scope);
	}

	/**
	 * Queue a write of whatever `snapshot()` returns when the debounce fires. A
	 * 200-file batch pushes 200 entries in a tick; serializing the whole log on
	 * each would be the jank source this feature is most likely to introduce.
	 */
	schedule(snapshot: () => PersistedHistory): void {
		this.pending = snapshot;
		if (this.timer !== null) window.clearTimeout(this.timer);
		this.timer = window.setTimeout(() => {
			this.timer = null;
			this.write();
		}, this.debounceMs);
	}

	/** Write any queued snapshot immediately. */
	flush(): void {
		if (this.timer === null) return;
		this.cancel();
		this.write();
	}

	/** Drop the stored log, discarding any queued write so it can't resurrect it. */
	clear(): void {
		this.cancel();
		this.pending = null;
		this.kv.delete(this.scope);
	}

	private cancel(): void {
		if (this.timer === null) return;
		window.clearTimeout(this.timer);
		this.timer = null;
	}

	private write(): void {
		if (!this.pending) return;
		try {
			this.kv.set(this.scope, this.pending());
		} catch (error) {
			// A full quota or a locked-down private-browsing store must never
			// take down the command that triggered the write.
			console.warn("[CommandManager] Failed to persist history", error);
		}
	}
}
