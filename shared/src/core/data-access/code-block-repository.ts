import type { App, TFile } from "obsidian";
import type { Observable } from "rxjs";
import { Subject } from "rxjs";
import type { z } from "zod";

import { ReactiveGroupBy, ReactiveMultiGroupBy } from "../vault-table/reactive-group-by";
import { ReadableTableMixin } from "../vault-table/readable-table";
import type { DataRow, VaultTableEvent } from "../vault-table/types";
import { CodeBlockFile } from "./code-block-file";

export interface CodeBlockBinding {
	unsubscribe: () => void;
}

export interface CodeBlockBindOptions {
	onChange?: () => void;
	/** When true, creates the directory and file with an empty code block if missing. */
	createIfMissing?: boolean;
}

export interface CodeBlockRepositoryConfig<T> {
	codeFence: string;
	itemSchema: z.ZodType<T>;
	idField?: keyof T & string;
	sort?: (a: T, b: T) => number;
}

/**
 * Reactive repository for items stored as a JSON array inside a fenced code block.
 * Extends ReadableTableMixin directly — query methods (get, toArray, where, findBy,
 * groupBy, orderBy, pluck, etc.) all operate on DataRow<T> wrappers. CRUD methods
 * (create, update, delete) take and return raw T items.
 *
 * Unwrap pattern: `repo.get(id)?.data`, `repo.toArray().map(r => r.data)`.
 */
export class CodeBlockRepository<T> extends ReadableTableMixin<T, DataRow<T>> {
	private readonly file: CodeBlockFile<T>;
	private readonly idField: (keyof T & string) | null;
	private readonly sortComparator: ((a: T, b: T) => number) | null;

	private rowMap = new Map<string, DataRow<T>>();
	private sortedRows: DataRow<T>[] = [];
	private sortedDirty = false;
	private boundFile: { app: App; file: TFile } | null = null;
	// Incremented before our own writes, decremented in the vault listener to skip self-triggered reloads.
	private pendingSelfWrites = 0;

	private readonly eventsSubject = new Subject<VaultTableEvent<T, DataRow<T>>>();
	public readonly events$: Observable<VaultTableEvent<T, DataRow<T>>> = this.eventsSubject.asObservable();

	constructor(config: CodeBlockRepositoryConfig<T>) {
		super();
		this.file = new CodeBlockFile({ codeFence: config.codeFence, itemSchema: config.itemSchema });
		this.idField = config.idField ?? null;
		this.sortComparator = config.sort ?? null;
	}

	// =========================================================================
	// ReadableTableMixin — abstract method implementations
	// =========================================================================

	protected getRowById(): ReadonlyMap<string, DataRow<T>> {
		return this.rowMap;
	}

	protected getRows(): ReadonlyArray<DataRow<T>> {
		if (this.sortedDirty) {
			this.sortedRows = [...this.rowMap.values()];
			if (this.sortComparator) {
				const cmp = this.sortComparator;
				this.sortedRows.sort((a, b) => cmp(a.data, b.data));
			}
			this.sortedDirty = false;
		}
		return this.sortedRows;
	}

	// =========================================================================
	// Reactive grouping
	// =========================================================================

	/** Creates a reactive 1:1 grouped index that stays in sync */
	createGroupBy<K>(keyFn: (row: DataRow<T>) => K | null): ReactiveGroupBy<T, K, DataRow<T>> {
		return new ReactiveGroupBy(this.toArray(), this.events$, keyFn);
	}

	/** Creates a reactive multi-group index (row → multiple keys) that stays in sync */
	createMultiGroupBy<K>(keysFn: (row: DataRow<T>) => K[]): ReactiveMultiGroupBy<T, K, DataRow<T>> {
		return new ReactiveMultiGroupBy(this.toArray(), this.events$, keysFn);
	}

	// =========================================================================
	// Binding / loading
	// =========================================================================

	async load(app: App, file: TFile): Promise<void> {
		this.boundFile = { app, file };
		const items = await this.file.read(app.vault, file);
		this.populateIndex(items);
	}

	loadFromRaw(raw: string, app: App, file: TFile): void {
		this.boundFile = { app, file };
		const items = this.file.parse(raw);
		this.populateIndex(items);
	}

	/**
	 * Binds the repository to a file path. Loads from the file if it exists.
	 * When `createIfMissing` is true, creates the directory and file with an
	 * empty code block before loading. Registers a vault modify listener to
	 * reload on external changes.
	 */
	async bind(app: App, filePath: string, options?: CodeBlockBindOptions): Promise<CodeBlockBinding> {
		const { onChange, createIfMissing = false } = options ?? {};

		let file = this.file.resolveFile(app, filePath);

		if (!file && createIfMissing) {
			file = await this.file.createBackingFile(app, filePath);
		}

		if (file) {
			await this.load(app, file);
			onChange?.();
		}

		const vaultRef = app.vault.on("modify", (modified) => {
			if (modified.path !== filePath) return;
			if (this.pendingSelfWrites > 0) {
				this.pendingSelfWrites--;
				return;
			}
			const current = this.file.resolveFile(app, filePath);
			if (current) {
				void this.load(app, current).then(() => onChange?.());
			}
		});

		return {
			unsubscribe: () => {
				app.vault.offref(vaultRef);
			},
		};
	}

	/**
	 * Rebinds the repository to a new file path. Unsubscribes the old binding,
	 * clears the index, and creates a new binding.
	 */
	async rebind(
		oldBinding: CodeBlockBinding,
		app: App,
		filePath: string,
		options?: CodeBlockBindOptions
	): Promise<CodeBlockBinding> {
		oldBinding.unsubscribe();
		this.rowMap.clear();
		this.sortedRows = [];
		this.sortedDirty = false;
		this.boundFile = null;
		return this.bind(app, filePath, options);
	}

	// =========================================================================
	// CRUD (item-level — takes/returns T, emits row-level events)
	// =========================================================================

	async create(item: T): Promise<T> {
		const key = this.extractId(item);
		if (this.rowMap.has(key)) {
			throw new Error(`Item with ID "${key}" already exists`);
		}
		const row: DataRow<T> = { id: key, data: item };
		this.rowMap.set(key, row);
		this.sortedDirty = true;
		await this.persist();
		this.eventsSubject.next({ type: "row-created", id: key, filePath: "", row });
		return item;
	}

	async update(id: string, partial: Partial<T>): Promise<T> {
		const existingRow = this.rowMap.get(id);
		if (!existingRow) {
			throw new Error(`Item with ID "${id}" not found`);
		}
		const updated = { ...existingRow.data, ...partial };
		const newKey = this.extractId(updated);
		const newRow: DataRow<T> = { id: newKey, data: updated };

		if (newKey !== id) {
			this.rowMap.delete(id);
		}
		this.rowMap.set(newKey, newRow);
		this.sortedDirty = true;
		await this.persist();
		this.eventsSubject.next({
			type: "row-updated",
			id: newKey,
			filePath: "",
			oldRow: existingRow,
			newRow,
			contentChanged: false,
		});
		return updated;
	}

	async delete(id: string): Promise<void> {
		const existingRow = this.rowMap.get(id);
		if (!existingRow) return;
		this.rowMap.delete(id);
		this.sortedDirty = true;
		await this.persist();
		this.eventsSubject.next({ type: "row-deleted", id, filePath: "", oldRow: existingRow });
	}

	// =========================================================================
	// File I/O pass-through (kept for external callers like host plugin file-open hooks)
	// =========================================================================

	/** Ensures the code fence block exists in the given file. */
	async ensureBlock(app: App, file: TFile, defaultEntries?: T[]): Promise<void> {
		return this.file.ensureBlock(app, file, defaultEntries);
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	destroy(): void {
		this.eventsSubject.complete();
		this.rowMap.clear();
		this.sortedRows = [];
		this.sortedDirty = false;
	}

	// =========================================================================
	// Internal helpers
	// =========================================================================

	private populateIndex(items: T[]): void {
		const newMap = new Map<string, DataRow<T>>();
		for (const item of items) {
			const key = this.extractId(item);
			newMap.set(key, { id: key, data: item });
		}

		// Diff old vs new to emit granular events
		const oldMap = this.rowMap;
		this.rowMap = newMap;
		this.sortedDirty = true;

		for (const [id, oldRow] of oldMap) {
			const newRow = newMap.get(id);
			if (!newRow) {
				this.eventsSubject.next({ type: "row-deleted", id, filePath: "", oldRow });
			} else if (!this.itemsEqual(oldRow.data, newRow.data)) {
				this.eventsSubject.next({ type: "row-updated", id, filePath: "", oldRow, newRow, contentChanged: false });
			}
		}
		for (const [id, row] of newMap) {
			if (!oldMap.has(id)) {
				this.eventsSubject.next({ type: "row-created", id, filePath: "", row });
			}
		}
	}

	private itemsEqual(a: T, b: T): boolean {
		return JSON.stringify(a) === JSON.stringify(b);
	}

	private extractId(item: T): string {
		if (!this.idField) {
			throw new Error("Cannot use CRUD methods without idField configured");
		}
		return String(item[this.idField]);
	}

	private async persist(): Promise<void> {
		if (!this.boundFile) {
			throw new Error("Cannot persist: no file bound. Call load() or loadFromRaw() first");
		}
		await this.file.write(
			this.boundFile.app,
			this.boundFile.file,
			this.getRows().map((r) => r.data),
			() => {
				this.pendingSelfWrites++;
			}
		);
	}
}
