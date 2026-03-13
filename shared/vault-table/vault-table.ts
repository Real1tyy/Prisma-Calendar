import type { App, TFile } from "obsidian";
import { BehaviorSubject, filter, firstValueFrom, type Observable, Subject, type Subscription } from "rxjs";

import { Indexer, type IndexerConfig, type IndexerEvent } from "../core/indexer";
import { extractFileName, getFolderPath, isDirectChildOrFolderNote } from "../file/file";
import { ensureDirectory, extractContentAfterFrontmatter, withFrontmatter } from "../file/file-utils";
import { correctFrontmatter, deleteInvalidFile } from "../file/frontmatter-repair";
import { createFileContentWithFrontmatter } from "../file/frontmatter-serialization";
import type { SerializableSchema } from "./create-mapped-schema";
import type {
	InsertVaultRow,
	InvalidStrategy,
	NodeType,
	VaultRow,
	VaultTableConfig,
	VaultTableDef,
	VaultTableDefMap,
	VaultTableEvent,
} from "./types";

type ResolveChildRelations<T extends VaultTableDefMap> = {
	[K in keyof T]: T[K] extends VaultTableDef<infer D, infer S, infer C> ? VaultTable<D, S, C> : never;
};

export type RowRelations<T extends VaultTableDefMap> = ResolveChildRelations<T>;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type VaultTableRow<TData, TChildren extends VaultTableDefMap = {}> = VaultRow<TData> & {
	relations: RowRelations<TChildren>;
};

export class VaultTable<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	TChildren extends VaultTableDefMap = {},
> {
	readonly app: App;
	readonly directory: string;
	private readonly schema: TSchema;
	private readonly invalidStrategy: InvalidStrategy;
	private readonly nodeType: NodeType;
	private readonly fileNameFilter?: (fileName: string) => boolean;
	private readonly filePathResolver: (directory: string, fileName: string) => string;
	private readonly childDefs: TChildren | undefined;

	private readonly indexer: Indexer;
	private readonly indexerConfigStore: BehaviorSubject<IndexerConfig>;
	private indexerSub: Subscription | null = null;
	private readySub: Subscription | null = null;

	private readonly rowByFileName = new Map<string, VaultRow<TData>>();
	private rows: VaultRow<TData>[] = [];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private readonly childCacheByPath = new Map<string, Map<string, VaultTable<any, any, any>>>();

	private readonly eventsSubject = new Subject<VaultTableEvent<TData>>();
	private readonly readySubject = new BehaviorSubject<boolean>(false);

	public readonly events$: Observable<VaultTableEvent<TData>>;
	public readonly ready$: Observable<boolean>;

	constructor(config: VaultTableConfig<TData, TSchema, TChildren>) {
		this.app = config.app;
		this.directory = config.directory;
		this.schema = config.schema;
		this.invalidStrategy = config.invalidStrategy ?? "skip";
		this.nodeType = config.nodeType ?? "files";
		this.fileNameFilter = config.fileNameFilter;
		this.filePathResolver = config.filePathResolver ?? ((dir, name) => `${dir}/${name}.md`);

		if (config.children && this.nodeType !== "folderNotes") {
			throw new Error('VaultTable: children are only supported when nodeType is "folderNotes"');
		}
		this.childDefs = config.children;

		this.events$ = this.eventsSubject.asObservable();
		this.ready$ = this.readySubject.asObservable();

		const includeFile = this.buildIncludeFile();
		this.indexerConfigStore = new BehaviorSubject<IndexerConfig>({
			includeFile,
			debounceMs: config.debounceMs,
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

	async waitUntilReady(): Promise<void> {
		if (this.readySubject.value) return;
		await firstValueFrom(this.ready$.pipe(filter(Boolean)));
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
		for (const cache of this.childCacheByPath.values()) {
			for (const table of cache.values()) {
				table.destroy();
			}
		}
		this.childCacheByPath.clear();
		this.rowByFileName.clear();
		this.rows = [];
		this.eventsSubject.complete();
		this.readySubject.complete();
	}

	// =========================================================================
	// CRUD — eagerly updates in-memory state, events emitted by indexer only
	// =========================================================================

	async create(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		const id = insert.fileName;
		if (this.rowByFileName.has(id)) {
			throw new Error(`VaultTable: row "${id}" already exists`);
		}

		if (this.fileNameFilter && !this.fileNameFilter(id)) {
			throw new Error(`VaultTable: file name "${id}" does not match the file name filter`);
		}

		const validated = this.schema.parse(insert.data) as TData;
		const filePath = this.filePathResolver(this.directory, id);
		const content = insert.content ?? "";

		const file = await this.persistNewFile(filePath, validated, content);
		const row = this.buildRow(id, file, filePath, validated, content, file.stat.mtime);
		this.insertRow(row);

		return row;
	}

	async update(key: string, data: Partial<TData>): Promise<VaultRow<TData>> {
		const existing = this.require(key);
		const merged = { ...existing.data, ...data };
		const validated = this.schema.parse(merged) as TData;
		const serialized = this.serialize(validated);

		await withFrontmatter(this.app, existing.file, (fm) => {
			Object.assign(fm, serialized);
		});

		const newRow = this.buildRow(
			existing.id,
			existing.file,
			existing.filePath,
			validated,
			existing.content,
			existing.file.stat.mtime
		);
		this.removeRow(existing.id);
		this.insertRow(newRow);

		return newRow;
	}

	async updateContent(key: string, content: string): Promise<VaultRow<TData>> {
		const existing = this.require(key);
		const fileContent = createFileContentWithFrontmatter(this.serialize(existing.data), content);
		await this.app.vault.modify(existing.file, fileContent);

		const newRow = this.buildRow(
			existing.id,
			existing.file,
			existing.filePath,
			existing.data,
			content,
			existing.file.stat.mtime
		);
		this.removeRow(existing.id);
		this.insertRow(newRow);

		return newRow;
	}

	async upsert(insert: InsertVaultRow<TData>): Promise<VaultRow<TData>> {
		const existing = this.rowByFileName.get(insert.fileName);
		if (existing) {
			return this.update(insert.fileName, insert.data);
		}
		return this.create(insert);
	}

	async delete(key: string): Promise<void> {
		const existing = this.require(key);
		await this.app.vault.trash(existing.file, true);
		this.removeRow(existing.id);
	}

	// =========================================================================
	// Batch Operations
	// =========================================================================

	async createMany(inserts: InsertVaultRow<TData>[]): Promise<VaultRow<TData>[]> {
		return Promise.all(inserts.map((insert) => this.create(insert)));
	}

	async updateMany(updates: { key: string; data: Partial<TData> }[]): Promise<VaultRow<TData>[]> {
		return Promise.all(updates.map(({ key, data }) => this.update(key, data)));
	}

	async upsertMany(inserts: InsertVaultRow<TData>[]): Promise<VaultRow<TData>[]> {
		return Promise.all(inserts.map((insert) => this.upsert(insert)));
	}

	async deleteMany(keys: string[]): Promise<void> {
		await Promise.all(keys.map((key) => this.delete(key)));
	}

	// =========================================================================
	// Reads
	// =========================================================================

	get(name: string): VaultRow<TData> | undefined {
		return this.rowByFileName.get(name);
	}

	has(name: string): boolean {
		return this.rowByFileName.has(name);
	}

	count(): number {
		return this.rowByFileName.size;
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
	// Hydration — lazy child table initialization with sync access after
	// =========================================================================

	async hydrateRow(row: VaultRow<TData>): Promise<VaultTableRow<TData, TChildren>> {
		if (!this.childDefs) {
			return { ...row, relations: {} as RowRelations<TChildren> };
		}

		let cache = this.childCacheByPath.get(row.filePath);
		if (!cache) {
			cache = new Map();
			this.childCacheByPath.set(row.filePath, cache);
		}

		const rowDir = this.getRowDirectory(row.filePath);

		for (const key of Object.keys(this.childDefs) as Array<keyof TChildren & string>) {
			if (!cache.has(key)) {
				const childDef = this.childDefs[key];
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const child = await this.startChildTable(rowDir, childDef as any);
				cache.set(key, child);
			}
		}

		const relations = {} as RowRelations<TChildren>;
		for (const key of Object.keys(this.childDefs) as Array<keyof TChildren & string>) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(relations as any)[key] = cache.get(key)!;
		}

		return { ...row, relations };
	}

	async getHydrated(key: string): Promise<VaultTableRow<TData, TChildren> | undefined> {
		const row = this.rowByFileName.get(key);
		if (!row) return undefined;
		return this.hydrateRow(row);
	}

	// =========================================================================
	// Row Resolution
	// =========================================================================

	private require(name: string): VaultRow<TData> {
		const row = this.rowByFileName.get(name);
		if (!row) {
			throw new Error(`VaultTable: row "${name}" not found`);
		}
		return row;
	}

	// =========================================================================
	// Indexer Event Handling — single source of truth for state and events
	// =========================================================================

	private handleIndexerEvent(event: IndexerEvent): void {
		if (event.type === "file-deleted") {
			this.handleFileDeleted(event.filePath);
			return;
		}

		if (!event.source) return;

		const filePath = event.filePath;
		const id = extractFileName(filePath);
		const raw = event.source.frontmatter;
		const result = this.schema.safeParse(raw);

		if (!result.success) {
			this.handleInvalidFrontmatter(filePath, raw);
			return;
		}

		const existingRow = this.rowByFileName.get(id);

		if (existingRow && existingRow.mtime === event.source.mtime) {
			return;
		}

		void this.buildAndUpsertRow(id, filePath, result.data as TData, event);
	}

	private async buildAndUpsertRow(id: string, filePath: string, data: TData, event: IndexerEvent): Promise<void> {
		const file = event.source!.file;
		const fullContent = await this.app.vault.cachedRead(file);
		const content = extractContentAfterFrontmatter(fullContent);

		const oldRow = this.rowByFileName.get(id);
		const newRow = this.buildRow(id, file, filePath, data, content, event.source?.mtime ?? Date.now());

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
		const existing = this.rowByFileName.get(extractFileName(filePath));
		if (!existing) return;

		this.removeRow(existing.id);
		this.eventsSubject.next({ type: "row-deleted", id: existing.id, filePath, oldRow: existing });
	}

	private handleInvalidFrontmatter(filePath: string, raw: Record<string, unknown>): void {
		switch (this.invalidStrategy) {
			case "skip": {
				const existing = this.rowByFileName.get(extractFileName(filePath));
				if (existing) {
					this.removeRow(existing.id);
				}
				break;
			}
			case "correct": {
				void correctFrontmatter(this.app, this.schema, filePath, raw);
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

	private buildRow(
		id: string,
		file: TFile,
		filePath: string,
		data: TData,
		content: string,
		mtime: number
	): VaultRow<TData> {
		return { id, file, filePath, data, content, mtime };
	}

	private insertRow(row: VaultRow<TData>): void {
		this.rowByFileName.set(row.id, row);
		this.rows = Array.from(this.rowByFileName.values());
	}

	private removeRow(id: string): void {
		const row = this.rowByFileName.get(id);
		if (!row) return;
		this.destroyRowChildren(row);
		this.rowByFileName.delete(id);
		this.rows = Array.from(this.rowByFileName.values());
	}

	private buildIncludeFile(): (path: string) => boolean {
		const nameFilter = this.fileNameFilter;
		return (path) => {
			if (!isDirectChildOrFolderNote(path, this.directory, this.nodeType)) return false;
			if (nameFilter) {
				return nameFilter(extractFileName(path));
			}
			return true;
		};
	}

	private async persistNewFile(filePath: string, data: TData, content: string): Promise<TFile> {
		await ensureDirectory(this.app, this.directory);
		const fileContent = createFileContentWithFrontmatter(this.serialize(data), content);
		return this.app.vault.create(filePath, fileContent);
	}

	private serialize(data: TData): Record<string, unknown> {
		return this.schema.serialize(data);
	}

	private getRowDirectory(filePath: string): string {
		if (this.nodeType !== "folderNotes") {
			throw new Error("VaultTable: only folderNotes rows can own child relations");
		}
		return getFolderPath(filePath);
	}

	private async startChildTable<D, S extends SerializableSchema<D>, C extends VaultTableDefMap>(
		directory: string,
		def: VaultTableDef<D, S, C>
	): Promise<VaultTable<D, S, C>> {
		const child = new VaultTable<D, S, C>({
			app: this.app,
			directory,
			...def,
		} as VaultTableConfig<D, S, C>);
		await child.start();
		await child.waitUntilReady();
		return child;
	}

	private destroyRowChildren(row: VaultRow<TData>): void {
		const cache = this.childCacheByPath.get(row.filePath);
		if (!cache) return;
		for (const table of cache.values()) {
			table.destroy();
		}
		this.childCacheByPath.delete(row.filePath);
	}
}
