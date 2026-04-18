import { ClosedIdbConnection, type OpenIdbConnection } from "./idb-connection";
import type { IdbFactory, PersistenceConfig, PersistentEntry } from "./types";

export interface PersistentTableCacheOptions {
	config: PersistenceConfig;
	/**
	 * Directory prefix for this table's scope. Two tables within the same
	 * namespace but different directories do not collide.
	 */
	directoryPrefix: string;
	/**
	 * Override the IndexedDB factory — tests inject fake-indexeddb here.
	 */
	idbFactory?: IdbFactory;
}

/**
 * Generic persistent cache layered on {@link OpenIdbConnection}.
 *
 * - One IDB database per namespace (`obsidian-cache-${namespace}`).
 * - Keys are composite `${directoryPrefix}\0${filePath}` so multiple tables
 *   in the same plugin can share one DB without collision.
 * - Schema version is tracked once at the DB level (meta store); on mismatch
 *   the entire namespace DB is dropped.
 * - Writes are fire-and-forget; in-memory state must remain authoritative.
 *
 * Construction is async via {@link create}. The returned instance holds a
 * live {@link OpenIdbConnection} for its entire lifetime — there is no
 * "closed" state, so every method is unconditional. When the caller wants to
 * tear down, they call {@link close} and discard the reference.
 *
 * If persistence is disabled (`config.enabled === false`) or the IDB open
 * fails, {@link create} returns `null` — the caller's single null-check replaces
 * what used to be a null check on every method.
 */
export class PersistentTableCache<TData> {
	private constructor(
		private readonly namespace: string,
		private readonly prefix: string,
		private readonly conn: OpenIdbConnection
	) {}

	/**
	 * Open the IDB, enforce the schema-version gate, and return a ready cache.
	 * Returns `null` when disabled or when IDB is unavailable — callers never
	 * see a half-constructed instance.
	 */
	static async create<TData>(options: PersistentTableCacheOptions): Promise<PersistentTableCache<TData> | null> {
		if (options.config.enabled === false) return null;

		const { namespace, schemaVersion } = options.config;
		const dbName = `obsidian-cache-${namespace}`;
		const closed = new ClosedIdbConnection(dbName, options.idbFactory);

		try {
			let open = await closed.open();
			const stored = await open.getStoredSchemaVersion();

			if (stored === undefined) {
				await open.setStoredSchemaVersion(schemaVersion);
			} else if (stored !== schemaVersion) {
				const reclosed = await open.deleteDatabase();
				open = await reclosed.open();
				await open.setStoredSchemaVersion(schemaVersion);
			}

			return new PersistentTableCache<TData>(namespace, `${options.directoryPrefix}\0`, open);
		} catch (error) {
			console.warn(`[PersistentTableCache:${namespace}] open failed, persistence disabled:`, error);
			return null;
		}
	}

	/** Load all entries for this table's directory prefix. filePath → entry. */
	async hydrate(): Promise<Map<string, PersistentEntry<TData>>> {
		const out = new Map<string, PersistentEntry<TData>>();
		await this.swallow("hydrate", async () => {
			const records = await this.conn.getAllInRange(this.prefix);
			for (const record of records) {
				const filePath = this.stripPrefix(record.key);
				if (filePath === null) continue;
				const entry = record.entry as PersistentEntry<TData> | undefined;
				if (!this.isValidEntry(entry)) continue;
				out.set(filePath, entry);
			}
		});
		return out;
	}

	put(filePath: string, data: TData, mtime: number): void {
		this.conn.put(this.prefix + filePath, this.makeEntry(data, mtime));
	}

	async putBatch(entries: Iterable<[string, TData, number]>): Promise<void> {
		const records: Array<[string, unknown]> = [];
		for (const [filePath, data, mtime] of entries) {
			records.push([this.prefix + filePath, this.makeEntry(data, mtime)]);
		}
		await this.swallow("putBatch", () => this.conn.putBatch(records));
	}

	delete(filePath: string): void {
		this.conn.delete(this.prefix + filePath);
	}

	rename(oldPath: string, newPath: string, data: TData, mtime: number): void {
		this.delete(oldPath);
		this.put(newPath, data, mtime);
	}

	async flush(): Promise<void> {
		await this.swallow("flush", () => this.conn.flush());
	}

	async clear(): Promise<void> {
		await this.swallow("clear", () => this.conn.clearRange(this.prefix));
	}

	close(): void {
		this.conn.close();
	}

	// ─── Private ─────────────────────────────────────────────────

	private makeEntry(data: TData, mtime: number): PersistentEntry<TData> {
		return { data, mtime };
	}

	private async swallow(op: string, work: () => Promise<unknown>): Promise<void> {
		try {
			await work();
		} catch (error) {
			console.warn(`[PersistentTableCache:${this.namespace}] ${op} failed:`, error);
		}
	}

	private stripPrefix(key: string): string | null {
		if (!key.startsWith(this.prefix)) return null;
		return key.slice(this.prefix.length);
	}

	private isValidEntry(entry: unknown): entry is PersistentEntry<TData> {
		if (!entry || typeof entry !== "object") return false;
		const e = entry as Partial<PersistentEntry<TData>>;
		return typeof e.mtime === "number" && "data" in e;
	}
}
