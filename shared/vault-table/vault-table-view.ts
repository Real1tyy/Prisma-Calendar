import { type Observable, Subject, type Subscription } from "rxjs";

import type { SerializableSchema } from "./create-mapped-schema";
import type { VaultRow, VaultTableEvent } from "./types";
import type { VaultTable } from "./vault-table";

export interface VaultTableViewConfig<TData> {
	filter: (row: VaultRow<TData>) => boolean;
}

export class VaultTableView<TData, TSchema extends SerializableSchema<TData> = SerializableSchema<TData>> {
	private readonly filter: (row: VaultRow<TData>) => boolean;

	private readonly rowById = new Map<string, VaultRow<TData>>();
	private readonly rowByPath = new Map<string, VaultRow<TData>>();
	private rows: VaultRow<TData>[] = [];

	private readonly eventsSubject = new Subject<VaultTableEvent<TData>>();
	private subscription: Subscription | null = null;

	public readonly events$: Observable<VaultTableEvent<TData>>;

	constructor(
		private readonly table: VaultTable<TData, TSchema>,
		config: VaultTableViewConfig<TData>
	) {
		this.filter = config.filter;
		this.events$ = this.eventsSubject.asObservable();

		this.populateFromTable();

		this.subscription = this.table.events$.subscribe((event) => {
			this.handleEvent(event);
		});
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
	// Lifecycle
	// =========================================================================

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.rowById.clear();
		this.rowByPath.clear();
		this.rows = [];
		this.eventsSubject.complete();
	}

	// =========================================================================
	// Internal
	// =========================================================================

	private populateFromTable(): void {
		for (const row of this.table.toArray()) {
			if (this.filter(row)) {
				this.rowById.set(row.id, row);
				this.rowByPath.set(row.filePath, row);
			}
		}
		this.rows = Array.from(this.rowById.values());
	}

	private handleEvent(event: VaultTableEvent<TData>): void {
		switch (event.type) {
			case "row-created":
				this.handleRowCreated(event);
				break;
			case "row-updated":
				this.handleRowUpdated(event);
				break;
			case "row-deleted":
				this.handleRowDeleted(event);
				break;
		}
	}

	private handleRowCreated(event: VaultTableEvent<TData> & { type: "row-created" }): void {
		if (!this.filter(event.row)) return;

		this.insertRow(event.row);
		this.eventsSubject.next(event);
	}

	private handleRowUpdated(event: VaultTableEvent<TData> & { type: "row-updated" }): void {
		const wasInView = this.rowById.has(event.id);
		const isInView = this.filter(event.newRow);

		if (wasInView && isInView) {
			this.removeRow(event.id);
			this.insertRow(event.newRow);
			this.eventsSubject.next(event);
		} else if (!wasInView && isInView) {
			this.insertRow(event.newRow);
			this.eventsSubject.next({ type: "row-created", id: event.id, filePath: event.filePath, row: event.newRow });
		} else if (wasInView && !isInView) {
			const oldRow = this.rowById.get(event.id)!;
			this.removeRow(event.id);
			this.eventsSubject.next({ type: "row-deleted", id: event.id, filePath: event.filePath, oldRow });
		}
	}

	private handleRowDeleted(event: VaultTableEvent<TData> & { type: "row-deleted" }): void {
		if (!this.rowById.has(event.id)) return;

		this.removeRow(event.id);
		this.eventsSubject.next(event);
	}

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
}
