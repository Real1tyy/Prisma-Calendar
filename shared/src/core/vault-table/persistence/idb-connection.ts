import {
	DEFAULT_IDB_FACTORY,
	IDB_VERSION,
	type IdbFactory,
	META_SCHEMA_VERSION_KEY,
	META_STORE,
	STORE_NAME,
} from "./types";

export interface StoredRecord {
	key: string;
	entry: unknown;
}

/**
 * ─── Typestate pattern ────────────────────────────────────────────────────
 *
 * Connection lifecycle is encoded in the type system:
 *
 *   ClosedIdbConnection ──open()──▶ OpenIdbConnection ──close()──▶ ClosedIdbConnection
 *
 * There is no "is it open?" check inside read/write methods — those methods
 * exist only on {@link OpenIdbConnection}, so the compiler proves the
 * precondition for every call site. The only state branches that remain are:
 *   1. {@link ClosedIdbConnection.open} dedupes concurrent callers.
 *   2. {@link OpenIdbConnection} guards against use-after-close on a stale
 *      reference (callers holding an OpenIdbConnection after they called
 *      close on it). That single check replaces the old N-way branching.
 *
 * Keys are strings; {@link OpenIdbConnection.getAllInRange} and
 * {@link OpenIdbConnection.clearRange} rely on lexicographic prefix ordering
 * which IndexedDB guarantees only for string keys.
 *
 * **Write semantics.** {@link OpenIdbConnection.put} and
 * {@link OpenIdbConnection.delete} are fire-and-forget — IDB errors are logged,
 * not thrown. Callers that need durability must await {@link
 * OpenIdbConnection.flush} before {@link OpenIdbConnection.close}. Writes
 * issued after close are silently dropped.
 */

/** Inclusive upper bound of a string-prefix range in IDB lexicographic order. */
const PREFIX_RANGE_UPPER = "\uffff";

function prefixRange(prefix: string): IDBKeyRange {
	return IDBKeyRange.bound(prefix, prefix + PREFIX_RANGE_UPPER, false, false);
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? new Error("IDB request failed"));
	});
}

function warnBlocked(op: string, dbName: string): () => void {
	return () => console.warn(`[IdbConnection] ${op}(${dbName}) blocked — waiting`);
}

/**
 * A not-yet-opened handle to a namespace-scoped IndexedDB database.
 *
 * The only operations it exposes are the ones valid before a connection
 * exists: opening it, or deleting the underlying database.
 */
export class ClosedIdbConnection {
	private openPromise: Promise<OpenIdbConnection> | null = null;
	private readonly factory: IdbFactory;

	constructor(
		readonly dbName: string,
		factory: IdbFactory = DEFAULT_IDB_FACTORY
	) {
		this.factory = factory;
	}

	getFactory(): IdbFactory {
		return this.factory;
	}

	/**
	 * Open the database. Concurrent callers share a single in-flight request
	 * and receive the same {@link OpenIdbConnection}.
	 */
	async open(): Promise<OpenIdbConnection> {
		if (this.openPromise) return this.openPromise;
		const promise = this.doOpen();
		this.openPromise = promise;
		try {
			return await promise;
		} finally {
			// Whether it succeeded or threw, the next open() call should try fresh.
			if (this.openPromise === promise) this.openPromise = null;
		}
	}

	/**
	 * Remove the underlying database entirely. Safe to call when nothing is open.
	 * Tolerant of transient `blocked` events — waits for success/error instead.
	 */
	static async deleteDatabase(dbName: string, factory: IdbFactory = DEFAULT_IDB_FACTORY): Promise<void> {
		const req = factory.deleteDatabase(dbName);
		req.onblocked = warnBlocked("deleteDatabase", dbName);
		await requestAsPromise(req);
	}

	async deleteDatabase(): Promise<void> {
		await ClosedIdbConnection.deleteDatabase(this.dbName, this.factory);
	}

	private async doOpen(): Promise<OpenIdbConnection> {
		const req = this.factory.open(this.dbName, IDB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, { keyPath: "key" });
			}
			if (!db.objectStoreNames.contains(META_STORE)) {
				db.createObjectStore(META_STORE);
			}
		};
		// Tolerant: another connection hasn't processed versionchange yet —
		// log and wait instead of rejecting immediately (mirrors deleteDatabase).
		req.onblocked = warnBlocked("open", this.dbName);
		const db = await requestAsPromise(req);
		return new OpenIdbConnection(this.dbName, this.factory, db);
	}
}

/**
 * An open, read/write handle to a namespace-scoped IndexedDB database.
 *
 * Created exclusively by {@link ClosedIdbConnection.open}. All data operations
 * live here so that calling any of them is a compile-time proof that the
 * connection is open.
 *
 * After {@link close}, the caller is expected to discard this reference and
 * use the returned {@link ClosedIdbConnection}. Using a stale reference relies
 * on IndexedDB's native semantics: reads throw `InvalidStateError` once the
 * underlying {@link IDBDatabase} is closed, and the fire-and-forget writes
 * swallow that error in their try/catch. No shadow `closed` flag is needed.
 */
export class OpenIdbConnection {
	constructor(
		readonly dbName: string,
		private readonly factory: IdbFactory,
		private readonly db: IDBDatabase
	) {
		db.onversionchange = () => db.close();
	}

	getFactory(): IdbFactory {
		return this.factory;
	}

	/**
	 * Close the database and return a fresh {@link ClosedIdbConnection} that
	 * can be reopened. The caller's reference to `this` becomes stale.
	 */
	close(): ClosedIdbConnection {
		this.db.close();
		return new ClosedIdbConnection(this.dbName, this.factory);
	}

	/**
	 * Close and delete this database. Returns a fresh closed handle.
	 */
	async deleteDatabase(): Promise<ClosedIdbConnection> {
		const closed = this.close();
		await closed.deleteDatabase();
		return closed;
	}

	// ─── Meta store (schema versioning) ──────────────────────────

	async getStoredSchemaVersion(): Promise<number | undefined> {
		const tx = this.db.transaction(META_STORE, "readonly");
		const value = await requestAsPromise(tx.objectStore(META_STORE).get(META_SCHEMA_VERSION_KEY));
		return typeof value === "number" ? value : undefined;
	}

	async setStoredSchemaVersion(version: number): Promise<void> {
		await this.runWriteTx(META_STORE, (store) => {
			store.put(version, META_SCHEMA_VERSION_KEY);
		});
	}

	// ─── Row operations ──────────────────────────────────────────

	async getAllInRange(prefix: string): Promise<StoredRecord[]> {
		const tx = this.db.transaction(STORE_NAME, "readonly");
		return requestAsPromise<StoredRecord[]>(tx.objectStore(STORE_NAME).getAll(prefixRange(prefix)));
	}

	/**
	 * Fire-and-forget write. If the caller holds this reference after close(),
	 * `db.transaction()` throws `InvalidStateError` and the catch swallows it.
	 */
	put(key: string, entry: unknown): void {
		this.fireAndForget("put", (store) => store.put({ key, entry }));
	}

	async putBatch(records: Array<[string, unknown]>): Promise<void> {
		if (records.length === 0) return;
		await this.runWriteTx(STORE_NAME, (store) => {
			for (const [key, entry] of records) {
				store.put({ key, entry });
			}
		});
	}

	/** Fire-and-forget delete — same stale-reference semantics as {@link put}. */
	delete(key: string): void {
		this.fireAndForget("delete", (store) => store.delete(key));
	}

	async clearRange(prefix: string): Promise<void> {
		const readTx = this.db.transaction(STORE_NAME, "readonly");
		const keys = (await requestAsPromise(readTx.objectStore(STORE_NAME).getAllKeys(prefixRange(prefix)))) as string[];
		if (keys.length === 0) return;

		await this.runWriteTx(STORE_NAME, (store) => {
			for (const key of keys) store.delete(key);
		});
	}

	async clearAll(): Promise<void> {
		await this.runWriteTx(STORE_NAME, (store) => store.clear());
	}

	/**
	 * Await completion of fire-and-forget writes previously issued through
	 * this connection. Relies on IndexedDB transaction ordering on the same
	 * connection — this does NOT fence writes from other connections, tabs,
	 * or processes; only those queued through this object.
	 */
	async flush(): Promise<void> {
		await this.runWriteTx(STORE_NAME, () => undefined);
	}

	// ─── Private helpers ──────────────────────────────────────────

	private runWriteTx(storeName: string, work: (store: IDBObjectStore) => void): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			const tx = this.db.transaction(storeName, "readwrite");
			work(tx.objectStore(storeName));
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error ?? new Error("Transaction failed"));
			tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
		});
	}

	private fireAndForget(op: "put" | "delete", work: (store: IDBObjectStore) => void): void {
		try {
			const tx = this.db.transaction(STORE_NAME, "readwrite");
			tx.onerror = () => console.warn(`[IdbConnection] ${op} tx failed:`, tx.error);
			tx.onabort = () => console.warn(`[IdbConnection] ${op} tx aborted:`, tx.error);
			work(tx.objectStore(STORE_NAME));
		} catch (error) {
			console.warn(`[IdbConnection] ${op} threw:`, error);
		}
	}
}
