import { BehaviorSubject, type Observable, Subject } from "rxjs";

import type { FrontmatterDiff } from "../../core/frontmatter/frontmatter-diff";
import type { InsertVaultRow, VaultRow, VaultTableEvent } from "../../core/vault-table/types";
import { TFile } from "./obsidian";

// ─── Operation Log ───────────────────────────────────────────

export type VaultTableOperation<TData> =
	| { type: "create"; key: string; data: TData; content: string }
	| { type: "update"; key: string; data: Partial<TData>; previousData: TData }
	| { type: "updateContent"; key: string; content: string; previousContent: string }
	| { type: "delete"; key: string; previousData: TData; previousContent: string };

// ─── Mock VaultTable ─────────────────────────────────────────

/**
 * HashMap-backed mock of VaultTable for unit testing.
 * Stores rows in a Map, emits VaultTableEvents, and records all
 * CRUD operations in an inspectable log for assertions.
 */
export class MockVaultTable<TData extends Record<string, unknown> = Record<string, unknown>> {
	readonly directory: string;

	private readonly rowsByKey = new Map<string, VaultRow<TData>>();
	private readonly operationLog: VaultTableOperation<TData>[] = [];
	private mtimeCounter = 1000;

	private readonly eventsSubject = new Subject<VaultTableEvent<TData>>();
	private readonly readySubject = new BehaviorSubject<boolean>(false);

	readonly events$: Observable<VaultTableEvent<TData>> = this.eventsSubject.asObservable();
	readonly ready$: Observable<boolean> = this.readySubject.asObservable();

	constructor(directory = "test-directory") {
		this.directory = directory;
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	async start(): Promise<void> {
		this.readySubject.next(true);
	}

	async waitUntilReady(): Promise<void> {
		return;
	}

	stop(): void {
		/* noop */
	}

	destroy(): void {
		this.rowsByKey.clear();
		this.eventsSubject.complete();
		this.readySubject.complete();
	}

	// ─── CRUD ────────────────────────────────────────────────────

	async create(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		const key = insert.fileName;
		if (this.rowsByKey.has(key)) {
			throw new Error(`MockVaultTable: row "${key}" already exists`);
		}

		const content = insert.content ?? "";
		const row = this.buildRow(key, insert.data, content);
		this.rowsByKey.set(key, row);

		this.operationLog.push({ type: "create", key, data: insert.data, content });
		this.eventsSubject.next({ type: "row-created", id: key, filePath: row.filePath, row });

		return row;
	}

	async update(key: string, data: Partial<TData>): Promise<VaultRow<TData>> {
		const oldRow = this.require(key);
		const merged = { ...oldRow.data, ...data } as TData;
		const newRow = this.buildRow(key, merged, oldRow.content);
		this.rowsByKey.set(key, newRow);

		this.operationLog.push({ type: "update", key, data, previousData: oldRow.data });
		this.eventsSubject.next({
			type: "row-updated",
			id: key,
			filePath: newRow.filePath,
			oldRow,
			newRow,
			contentChanged: false,
		});

		return newRow;
	}

	/** Replaces the entire data object without merging — supports property deletion */
	async replace(key: string, data: TData): Promise<VaultRow<TData>> {
		const oldRow = this.require(key);
		const newRow = this.buildRow(key, data, oldRow.content);
		this.rowsByKey.set(key, newRow);

		this.operationLog.push({ type: "update", key, data, previousData: oldRow.data });
		this.eventsSubject.next({
			type: "row-updated",
			id: key,
			filePath: newRow.filePath,
			oldRow,
			newRow,
			contentChanged: false,
		});

		return newRow;
	}

	async updateContent(key: string, content: string): Promise<VaultRow<TData>> {
		const oldRow = this.require(key);
		const newRow = this.buildRow(key, oldRow.data, content);
		this.rowsByKey.set(key, newRow);

		this.operationLog.push({ type: "updateContent", key, content, previousContent: oldRow.content });
		this.eventsSubject.next({
			type: "row-updated",
			id: key,
			filePath: newRow.filePath,
			oldRow,
			newRow,
			contentChanged: true,
		});

		return newRow;
	}

	async delete(key: string): Promise<void> {
		const oldRow = this.require(key);
		this.rowsByKey.delete(key);

		this.operationLog.push({ type: "delete", key, previousData: oldRow.data, previousContent: oldRow.content });
		this.eventsSubject.next({ type: "row-deleted", id: key, filePath: oldRow.filePath, oldRow });
	}

	async upsert(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		if (this.rowsByKey.has(insert.fileName)) {
			return this.update(insert.fileName, insert.data);
		}
		return this.create(insert);
	}

	// ─── Reads ───────────────────────────────────────────────────

	get(name: string): VaultRow<TData> | undefined {
		return this.rowsByKey.get(name);
	}

	has(name: string): boolean {
		return this.rowsByKey.has(name);
	}

	count(): number {
		return this.rowsByKey.size;
	}

	toArray(): ReadonlyArray<VaultRow<TData>> {
		return Array.from(this.rowsByKey.values());
	}

	// ─── Operation Log (for assertions) ──────────────────────────

	/** Returns all recorded operations in order */
	getOperations(): ReadonlyArray<VaultTableOperation<TData>> {
		return this.operationLog;
	}

	/** Returns operations filtered by type */
	getOperationsOfType(type: VaultTableOperation<TData>["type"]): ReadonlyArray<VaultTableOperation<TData>> {
		return this.operationLog.filter((op) => op.type === type);
	}

	/** Clears the operation log without affecting stored data */
	clearOperations(): void {
		this.operationLog.length = 0;
	}

	// ─── Test Helpers ────────────────────────────────────────────

	/**
	 * Seeds a row without recording an operation or emitting an event.
	 * Use this to set up initial state before the test begins.
	 */
	seed(key: string, data: TData, content = ""): VaultRow<TData> {
		const row = this.buildRow(key, data, content);
		this.rowsByKey.set(key, row);
		return row;
	}

	/**
	 * Seeds multiple rows at once without recording operations or emitting events.
	 */
	seedMany(entries: { key: string; data: TData; content?: string }[]): VaultRow<TData>[] {
		return entries.map((e) => this.seed(e.key, e.data, e.content));
	}

	/** Manually emit a ready signal (useful for testing indexing-complete flows) */
	emitReady(ready = true): void {
		this.readySubject.next(ready);
	}

	/**
	 * Manually emit an event without going through CRUD.
	 * Useful for simulating external file changes picked up by the indexer.
	 */
	emitEvent(event: VaultTableEvent<TData>): void {
		this.eventsSubject.next(event);
	}

	/**
	 * Emit an update event with a frontmatter diff — simulates an external file edit
	 * where we need to test diff-based propagation logic.
	 */
	emitUpdateWithDiff(key: string, newData: Partial<TData>, diff: FrontmatterDiff): void {
		const oldRow = this.require(key);
		const merged = { ...oldRow.data, ...newData } as TData;
		const newRow = this.buildRow(key, merged, oldRow.content);
		this.rowsByKey.set(key, newRow);

		this.eventsSubject.next({
			type: "row-updated",
			id: key,
			filePath: newRow.filePath,
			oldRow,
			newRow,
			diff,
			contentChanged: false,
		});
	}

	// ─── Internal ────────────────────────────────────────────────

	private require(key: string): VaultRow<TData> {
		const row = this.rowsByKey.get(key);
		if (!row) throw new Error(`MockVaultTable: row "${key}" not found`);
		return row;
	}

	private buildRow(key: string, data: TData, content: string): VaultRow<TData> {
		const filePath = `${this.directory}/${key}.md`;
		const mtime = this.mtimeCounter++;
		const file = new TFile(filePath);
		(file.stat as Record<string, unknown>) = { mtime };

		return { id: key, file: file as any, filePath, data, content, mtime };
	}
}
