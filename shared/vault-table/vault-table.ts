import type { App } from "obsidian";
import { BehaviorSubject, type Observable, Subject, type Subscription } from "rxjs";
import { z } from "zod";

import { Indexer, type IndexerConfig, type IndexerEvent } from "../core/indexer";
import { extractDisplayName, isFolderNote } from "../file/file";
import { ensureDirectory, extractContentAfterFrontmatter, getTFileOrThrow, withFrontmatter } from "../file/file-utils";
import { correctFrontmatter, deleteInvalidFile } from "../file/frontmatter-repair";
import { createFileContentWithFrontmatter } from "../file/frontmatter-serialization";
import type {
	InsertVaultRow,
	InvalidStrategy,
	ParseStrategy,
	VaultRow,
	VaultTableConfig,
	VaultTableEvent,
} from "./types";

export class VaultTable<TSchema extends z.ZodObject<z.ZodRawShape>, TData = z.infer<TSchema>> {
	private readonly app: App;
	private readonly directory: string;
	private readonly schema: TSchema;
	private readonly effectiveSchema: z.ZodType;
	private readonly invalidStrategy: InvalidStrategy;

	private readonly indexer: Indexer;
	private readonly indexerConfigStore: BehaviorSubject<IndexerConfig>;
	private indexerSub: Subscription | null = null;
	private readySub: Subscription | null = null;

	private readonly rowById = new Map<string, VaultRow<TData>>();
	private readonly rowByPath = new Map<string, VaultRow<TData>>();
	private rows: VaultRow<TData>[] = [];

	private readonly eventsSubject = new Subject<VaultTableEvent<TData>>();
	private readonly readySubject = new BehaviorSubject<boolean>(false);

	public readonly events$: Observable<VaultTableEvent<TData>>;
	public readonly ready$: Observable<boolean>;

	constructor(config: VaultTableConfig<TSchema>) {
		this.app = config.app;
		this.directory = config.directory;
		this.schema = config.schema;
		this.invalidStrategy = config.invalidStrategy ?? "skip";
		this.effectiveSchema = this.buildEffectiveSchema(config.parseStrategy ?? "passthrough");

		this.events$ = this.eventsSubject.asObservable();
		this.ready$ = this.readySubject.asObservable();

		const skipFolderNotes = config.skipFolderNotes ?? false;
		this.indexerConfigStore = new BehaviorSubject<IndexerConfig>({
			includeFile: (path) => path.startsWith(this.directory + "/") && (!skipFolderNotes || !isFolderNote(path)),
			debounceMs: config.debounceMs ?? 100,
		});

		this.indexer = new Indexer(this.app, this.indexerConfigStore);
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	async start(): Promise<void> {
		await ensureDirectory(this.app, this.directory);

		this.indexerSub = this.indexer.events$.subscribe((event) => {
			this.handleIndexerEvent(event);
		});

		this.readySub = this.indexer.indexingComplete$.subscribe((complete) => {
			if (complete) {
				this.readySubject.next(true);
			}
		});

		await this.indexer.start();
	}

	stop(): void {
		this.indexerSub?.unsubscribe();
		this.indexerSub = null;
		this.readySub?.unsubscribe();
		this.readySub = null;
		this.indexer.stop();
	}

	destroy(): void {
		this.stop();
		this.rowById.clear();
		this.rowByPath.clear();
		this.rows = [];
		this.eventsSubject.complete();
		this.readySubject.complete();
	}

	// =========================================================================
	// CRUD
	// =========================================================================

	async create(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		const id = insert.fileName;
		if (this.rowById.has(id)) {
			throw new Error(`VaultTable: row "${id}" already exists`);
		}

		const validated = this.effectiveSchema.parse(insert.data) as TData;
		const filePath = `${this.directory}/${id}.md`;
		const content = insert.content ?? "";

		const fileContent = createFileContentWithFrontmatter(validated as Record<string, unknown>, content);
		const file = await this.app.vault.create(filePath, fileContent);

		const row: VaultRow<TData> = {
			id,
			file,
			filePath,
			data: validated,
			content,
			mtime: file.stat.mtime,
		};

		this.insertRow(row);
		this.eventsSubject.next({ type: "row-created", id, filePath, row });

		return row;
	}

	async updateById(id: string, data: Partial<TData>): Promise<VaultRow<TData>> {
		const existing = this.requireById(id);
		return this.applyUpdate(existing, data);
	}

	async updateByPath(path: string, data: Partial<TData>): Promise<VaultRow<TData>> {
		const existing = this.requireByPath(path);
		return this.applyUpdate(existing, data);
	}

	async upsert(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		const existing = this.rowById.get(insert.fileName);
		if (existing) {
			return this.applyUpdate(existing, insert.data);
		}
		return this.create(insert);
	}

	async deleteById(id: string): Promise<void> {
		const existing = this.requireById(id);
		await this.applyDelete(existing);
	}

	async deleteByPath(path: string): Promise<void> {
		const existing = this.requireByPath(path);
		await this.applyDelete(existing);
	}

	// =========================================================================
	// Batch Operations
	// =========================================================================

	async createMany(inserts: InsertVaultRow<TData>[]): Promise<VaultRow<TData>[]> {
		return await Promise.all(inserts.map((insert) => this.create(insert)));
	}

	async updateManyById(updates: { id: string; data: Partial<TData> }[]): Promise<VaultRow<TData>[]> {
		return await Promise.all(
			updates.map(({ id, data }) => {
				const existing = this.requireById(id);
				return this.applyUpdate(existing, data);
			})
		);
	}

	async updateManyByPath(updates: { path: string; data: Partial<TData> }[]): Promise<VaultRow<TData>[]> {
		return await Promise.all(
			updates.map(({ path, data }) => {
				const existing = this.requireByPath(path);
				return this.applyUpdate(existing, data);
			})
		);
	}

	async upsertMany(inserts: InsertVaultRow<TData>[]): Promise<VaultRow<TData>[]> {
		return await Promise.all(inserts.map((insert) => this.upsert(insert)));
	}

	async deleteManyById(ids: string[]): Promise<void> {
		await Promise.all(
			ids.map((id) => {
				const existing = this.requireById(id);
				return this.applyDelete(existing);
			})
		);
	}

	async deleteManyByPath(paths: string[]): Promise<void> {
		await Promise.all(
			paths.map((path) => {
				const existing = this.requireByPath(path);
				return this.applyDelete(existing);
			})
		);
	}

	// =========================================================================
	// Reads
	// =========================================================================

	getById(id: string): VaultRow<TData> | undefined {
		return this.rowById.get(id);
	}

	getByPath(path: string): VaultRow<TData> | undefined {
		return this.rowByPath.get(path);
	}

	hasById(id: string): boolean {
		return this.rowById.has(id);
	}

	hasByPath(path: string): boolean {
		return this.rowByPath.has(path);
	}

	count(): number {
		return this.rowById.size;
	}

	first(predicate?: (row: VaultRow<TData>) => boolean): VaultRow<TData> | undefined {
		if (!predicate) return this.rows[0];
		return this.rows.find(predicate);
	}

	// =========================================================================
	// Collection Access
	// =========================================================================

	toArray(): ReadonlyArray<VaultRow<TData>> {
		return this.rows;
	}

	toClonedArray(): VaultRow<TData>[] {
		return [...this.rows];
	}

	// =========================================================================
	// Queries
	// =========================================================================

	where(predicate: (row: VaultRow<TData>) => boolean): VaultRow<TData>[] {
		return this.rows.filter(predicate);
	}

	findBy<K extends keyof TData>(key: K, value: TData[K]): VaultRow<TData>[] {
		return this.rows.filter((row) => row.data[key] === value);
	}

	orderBy(comparator: (a: VaultRow<TData>, b: VaultRow<TData>) => number): VaultRow<TData>[] {
		return [...this.rows].sort(comparator);
	}

	groupBy<K>(keyFn: (row: VaultRow<TData>) => K): Map<K, VaultRow<TData>[]> {
		const groups = new Map<K, VaultRow<TData>[]>();
		for (const row of this.rows) {
			const key = keyFn(row);
			const group = groups.get(key);
			if (group) {
				group.push(row);
			} else {
				groups.set(key, [row]);
			}
		}
		return groups;
	}

	pluck<K extends keyof TData>(key: K): TData[K][] {
		return this.rows.map((row) => row.data[key]);
	}

	some(predicate: (row: VaultRow<TData>) => boolean): boolean {
		return this.rows.some(predicate);
	}

	every(predicate: (row: VaultRow<TData>) => boolean): boolean {
		return this.rows.every(predicate);
	}

	// =========================================================================
	// Row Resolution
	// =========================================================================

	private requireById(id: string): VaultRow<TData> {
		const row = this.rowById.get(id);
		if (!row) {
			throw new Error(`VaultTable: row with id "${id}" not found`);
		}
		return row;
	}

	private requireByPath(path: string): VaultRow<TData> {
		const row = this.rowByPath.get(path);
		if (!row) {
			throw new Error(`VaultTable: row with path "${path}" not found`);
		}
		return row;
	}

	private async applyUpdate(existing: VaultRow<TData>, data: Partial<TData>): Promise<VaultRow<TData>> {
		const merged = { ...existing.data, ...data };
		const validated = this.effectiveSchema.parse(merged) as TData;

		await withFrontmatter(this.app, existing.file, (fm) => {
			Object.assign(fm, validated);
		});

		const newRow: VaultRow<TData> = {
			...existing,
			data: validated,
			mtime: existing.file.stat.mtime,
		};

		this.removeRow(existing.id);
		this.insertRow(newRow);

		return newRow;
	}

	private async applyDelete(existing: VaultRow<TData>): Promise<void> {
		await this.app.vault.trash(existing.file, true);

		this.removeRow(existing.id);
		this.eventsSubject.next({ type: "row-deleted", id: existing.id, filePath: existing.filePath, oldRow: existing });
	}

	// =========================================================================
	// Indexer Event Handling
	// =========================================================================

	private handleIndexerEvent(event: IndexerEvent): void {
		if (event.type === "file-deleted") {
			this.handleFileDeleted(event.filePath);
			return;
		}

		if (!event.source) return;

		const filePath = event.filePath;
		const id = extractDisplayName(filePath);
		const raw = event.source.frontmatter;
		const result = this.effectiveSchema.safeParse(raw);

		if (!result.success) {
			this.handleInvalidFrontmatter(filePath, raw);
			return;
		}

		const existingRow = this.rowByPath.get(filePath);

		if (existingRow && existingRow.mtime === event.source.mtime) {
			return;
		}

		void this.buildAndUpsertRow(id, filePath, result.data as TData, event);
	}

	private async buildAndUpsertRow(id: string, filePath: string, data: TData, event: IndexerEvent): Promise<void> {
		let content = "";
		let file;
		try {
			file = getTFileOrThrow(this.app, filePath);
			const fullContent = await this.app.vault.cachedRead(file);
			content = extractContentAfterFrontmatter(fullContent);
		} catch {
			return;
		}

		const oldRow = this.rowByPath.get(filePath);
		const newRow: VaultRow<TData> = {
			id,
			file,
			filePath,
			data,
			content,
			mtime: event.source?.mtime ?? Date.now(),
		};

		if (oldRow) {
			this.removeRow(oldRow.id);
			this.insertRow(newRow);
			if (event.frontmatterDiff) {
				this.eventsSubject.next({
					type: "row-updated",
					id,
					filePath,
					oldRow,
					newRow,
					diff: event.frontmatterDiff,
				});
			}
		} else {
			this.insertRow(newRow);
			this.eventsSubject.next({ type: "row-created", id, filePath, row: newRow });
		}
	}

	private handleFileDeleted(filePath: string): void {
		const existing = this.rowByPath.get(filePath);
		if (!existing) return;

		this.removeRow(existing.id);
		this.eventsSubject.next({ type: "row-deleted", id: existing.id, filePath, oldRow: existing });
	}

	private handleInvalidFrontmatter(filePath: string, raw: Record<string, unknown>): void {
		switch (this.invalidStrategy) {
			case "skip": {
				const existing = this.rowByPath.get(filePath);
				if (existing) {
					this.removeRow(existing.id);
				}
				break;
			}
			case "correct": {
				void correctFrontmatter(this.app, this.effectiveSchema, filePath, raw);
				break;
			}
			case "delete": {
				void deleteInvalidFile(this.app, filePath);
				break;
			}
		}
	}

	// =========================================================================
	// Internal Helpers
	// =========================================================================

	private insertRow(row: VaultRow<TData>): void {
		this.rowById.set(row.id, row);
		this.rowByPath.set(row.filePath, row);
		this.rows = Array.from(this.rowById.values());
	}

	private removeRow(id: string): void {
		const row = this.rowById.get(id);
		if (!row) return;
		this.rowById.delete(id);
		this.rowByPath.delete(row.filePath);
		this.rows = Array.from(this.rowById.values());
	}

	private buildEffectiveSchema(strategy: ParseStrategy): z.ZodType {
		if (strategy === "passthrough") return z.looseObject(this.schema.shape);
		if (strategy === "strict") return z.strictObject(this.schema.shape);
		return this.schema;
	}
}
