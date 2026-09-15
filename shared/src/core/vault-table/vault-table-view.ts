import { BehaviorSubject, Subject, type Observable, type Subscription } from "rxjs";

import type { SerializableSchema } from "./create-mapped-schema";
import { ReactiveGroupBy, ReactiveMultiGroupBy } from "./reactive-group-by";
import { ReadableTableMixin } from "./readable-table";
import type { VaultRow, VaultTableEvent } from "./types";
import type { VaultTable } from "./vault-table";

export interface VaultTableViewConfig<TData> {
	filter: (row: VaultRow<TData>) => boolean;
	/**
	 * Optional comparator to suppress row-updated events when the view-relevant
	 * data hasn't meaningfully changed. Return true if oldRow and newRow are
	 * equivalent from this view's perspective.
	 */
	distinctBy?: (oldRow: VaultRow<TData>, newRow: VaultRow<TData>) => boolean;
}

export class VaultTableView<
	TData,
	TSchema extends SerializableSchema<TData> = SerializableSchema<TData>,
> extends ReadableTableMixin<TData> {
	private filter: (row: VaultRow<TData>) => boolean;
	private readonly distinctBy?: (oldRow: VaultRow<TData>, newRow: VaultRow<TData>) => boolean;

	private readonly rowByFileName = new Map<string, VaultRow<TData>>();
	private rows: VaultRow<TData>[] = [];
	private rowsDirty = false;

	private readonly eventsSubject = new Subject<VaultTableEvent<TData>>();
	private subscription: Subscription | null = null;
	private readySub: Subscription | null = null;
	private readonly readySubject = new BehaviorSubject<boolean>(false);
	private table: VaultTable<TData, TSchema>;

	public readonly events$: Observable<VaultTableEvent<TData>>;
	/**
	 * The parent table's readiness, mirrored. A view built before the table's
	 * initial scan settles is legitimate — it fills in as rows arrive — but
	 * nothing derived from it is a basis for a write until this flips true.
	 * Consumers gate on this instead of tracking indexing completion themselves.
	 * Mirrored rather than aliased so the observable survives a {@link rebind}
	 * onto a replacement table.
	 */
	public readonly ready$: Observable<boolean>;

	constructor(table: VaultTable<TData, TSchema>, config: VaultTableViewConfig<TData>) {
		super();
		this.table = table;
		this.filter = config.filter;
		if (config.distinctBy) this.distinctBy = config.distinctBy;
		this.events$ = this.eventsSubject.asObservable();
		this.ready$ = this.readySubject.asObservable();

		this.populateFromTable();
		this.attachToTable();
	}

	// =========================================================================
	// ReadableTableMixin — abstract method implementations
	// =========================================================================

	protected getRowById(): ReadonlyMap<string, VaultRow<TData>> {
		return this.rowByFileName;
	}

	protected getRows(): ReadonlyArray<VaultRow<TData>> {
		if (this.rowsDirty) {
			this.rows = Array.from(this.rowByFileName.values());
			this.rowsDirty = false;
		}
		return this.rows;
	}

	get isReady(): boolean {
		return this.table.isReady;
	}

	waitUntilReady(): Promise<void> {
		return this.table.waitUntilReady();
	}

	// =========================================================================
	// Reactive Grouping
	// =========================================================================

	/** Creates a reactive 1:1 grouped index that stays in sync with this view */
	createGroupBy<K>(keyFn: (row: VaultRow<TData>) => K | null): ReactiveGroupBy<TData, K> {
		return new ReactiveGroupBy(this.toArray(), this.events$, keyFn);
	}

	/** Creates a reactive multi-group index (row → multiple keys) that stays in sync */
	createMultiGroupBy<K>(keysFn: (row: VaultRow<TData>) => K[]): ReactiveMultiGroupBy<TData, K> {
		return new ReactiveMultiGroupBy(this.toArray(), this.events$, keysFn);
	}

	// =========================================================================
	// Dynamic Filter Update
	// =========================================================================

	/**
	 * Replaces the view's filter predicate and recomputes the view.
	 * Emits row-created for rows entering the view and row-deleted for rows leaving.
	 */
	updateFilter(newFilter: (row: VaultRow<TData>) => boolean): void {
		this.filter = newFilter;

		const oldIds = new Set(this.rowByFileName.keys());
		const newMatchIds = new Set<string>();

		for (const row of this.table.toArray()) {
			if (newFilter(row)) {
				newMatchIds.add(row.id);

				if (!oldIds.has(row.id)) {
					this.rowByFileName.set(row.id, row);
					this.rowsDirty = true;
					this.eventsSubject.next({ type: "row-created", id: row.id, filePath: row.filePath, row });
				}
			}
		}

		for (const id of oldIds) {
			if (!newMatchIds.has(id)) {
				const oldRow = this.rowByFileName.get(id);
				if (oldRow === undefined) continue;
				this.rowByFileName.delete(id);
				this.rowsDirty = true;
				this.eventsSubject.next({ type: "row-deleted", id, filePath: oldRow.filePath, oldRow });
			}
		}
	}

	// =========================================================================
	// Lifecycle
	// =========================================================================

	/**
	 * Points the view at a replacement table. A table's owner sometimes has to
	 * rebuild it wholesale — the indexed directory changed, the schema was
	 * swapped — and destroys the old instance; without this, every view built
	 * against it goes silently dead, which reads downstream as "the plugin
	 * stopped seeing my notes".
	 *
	 * Every row the view held is announced as deleted before the replacement's
	 * rows arrive as created, so group-by indexes and downstream caches converge
	 * on the new table instead of stranding rows that no longer exist.
	 */
	rebind(table: VaultTable<TData, TSchema>): void {
		this.detachFromTable();

		const previous = Array.from(this.rowByFileName.values());
		this.rowByFileName.clear();
		this.rows = [];
		this.rowsDirty = false;
		for (const row of previous) {
			this.eventsSubject.next({ type: "row-deleted", id: row.id, filePath: row.filePath, oldRow: row });
		}

		this.table = table;
		this.populateFromTable();
		for (const row of Array.from(this.rowByFileName.values())) {
			this.eventsSubject.next({ type: "row-created", id: row.id, filePath: row.filePath, row });
		}

		this.attachToTable();
	}

	destroy(): void {
		this.detachFromTable();
		this.rowByFileName.clear();
		this.rows = [];
		this.rowsDirty = false;
		this.eventsSubject.complete();
		this.readySubject.complete();
	}

	// =========================================================================
	// Internal
	// =========================================================================

	private attachToTable(): void {
		this.subscription = this.table.events$.subscribe((event) => {
			this.handleEvent(event);
		});
		this.readySub = this.table.ready$.subscribe((ready) => {
			this.readySubject.next(ready);
		});
	}

	private detachFromTable(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.readySub?.unsubscribe();
		this.readySub = null;
	}

	private populateFromTable(): void {
		for (const row of this.table.toArray()) {
			if (this.filter(row)) {
				this.rowByFileName.set(row.id, row);
			}
		}
		this.rows = Array.from(this.rowByFileName.values());
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
		const existingRow = this.rowByFileName.get(event.id);
		const wasInView = existingRow !== undefined;
		const isInView = this.filter(event.newRow);

		if (wasInView && isInView) {
			const shouldSuppress = this.distinctBy !== undefined && this.distinctBy(existingRow, event.newRow);
			this.rowByFileName.set(event.id, event.newRow);
			this.rowsDirty = true;
			if (!shouldSuppress) {
				this.eventsSubject.next(event);
			}
		} else if (!wasInView && isInView) {
			this.insertRow(event.newRow);
			this.eventsSubject.next({ type: "row-created", id: event.id, filePath: event.filePath, row: event.newRow });
		} else if (wasInView && !isInView) {
			this.removeRow(event.id);
			this.eventsSubject.next({ type: "row-deleted", id: event.id, filePath: event.filePath, oldRow: existingRow });
		}
	}

	private handleRowDeleted(event: VaultTableEvent<TData> & { type: "row-deleted" }): void {
		if (!this.rowByFileName.has(event.id)) return;

		this.removeRow(event.id);
		this.eventsSubject.next(event);
	}

	private insertRow(row: VaultRow<TData>): void {
		this.rowByFileName.set(row.id, row);
		this.rowsDirty = true;
	}

	private removeRow(id: string): void {
		if (!this.rowByFileName.has(id)) return;
		this.rowByFileName.delete(id);
		this.rowsDirty = true;
	}
}
