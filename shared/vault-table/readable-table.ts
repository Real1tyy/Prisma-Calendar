import type { Observable } from "rxjs";

import { LiveQueryBuilder } from "./live-query";
import type { VaultRow, VaultTableEvent } from "./types";
import type { SortField } from "./zod-filter-sort";

/**
 * Read-only interface for querying a VaultTable or VaultTableView.
 * Downstream consumers can accept ReadableTable<T> without caring
 * whether the source is a full table or a filtered view.
 */
export interface ReadableTable<TData> {
	readonly events$: Observable<VaultTableEvent<TData>>;

	// ─── Row Access ──────────────────────────────────────────────
	get(name: string): VaultRow<TData> | undefined;
	has(name: string): boolean;
	count(): number;
	first(predicate?: (row: VaultRow<TData>) => boolean): VaultRow<TData> | undefined;

	// ─── Collection Access ───────────────────────────────────────
	toArray(): ReadonlyArray<VaultRow<TData>>;
	toClonedArray(): VaultRow<TData>[];

	// ─── Queries ─────────────────────────────────────────────────
	where(predicate: (row: VaultRow<TData>) => boolean): VaultRow<TData>[];
	findBy<K extends keyof TData>(key: K, value: TData[K]): VaultRow<TData>[];
	orderBy(comparator: (a: VaultRow<TData>, b: VaultRow<TData>) => number): VaultRow<TData>[];
	groupBy<K>(keyFn: (row: VaultRow<TData>) => K): Map<K, VaultRow<TData>[]>;
	pluck<K extends keyof TData>(key: K): TData[K][];
	some(predicate: (row: VaultRow<TData>) => boolean): boolean;
	every(predicate: (row: VaultRow<TData>) => boolean): boolean;

	/** Creates a reactive live query builder that re-evaluates on every source event */
	createLiveQuery(sortFields?: SortField[]): LiveQueryBuilder<TData>;
}

/**
 * Mixin that implements all ReadableTable query methods.
 * Concrete classes must provide `getRows()` and `getRowByFileName()`.
 */
export abstract class ReadableTableMixin<TData> implements ReadableTable<TData> {
	abstract readonly events$: Observable<VaultTableEvent<TData>>;

	protected abstract getRowByFileName(): ReadonlyMap<string, VaultRow<TData>>;
	protected abstract getRows(): ReadonlyArray<VaultRow<TData>>;

	get(name: string): VaultRow<TData> | undefined {
		return this.getRowByFileName().get(name);
	}

	has(name: string): boolean {
		return this.getRowByFileName().has(name);
	}

	count(): number {
		return this.getRowByFileName().size;
	}

	first(predicate?: (row: VaultRow<TData>) => boolean): VaultRow<TData> | undefined {
		const rows = this.getRows();
		if (!predicate) return rows[0];
		return rows.find(predicate);
	}

	toArray(): ReadonlyArray<VaultRow<TData>> {
		return this.getRows();
	}

	toClonedArray(): VaultRow<TData>[] {
		return [...this.getRows()];
	}

	where(predicate: (row: VaultRow<TData>) => boolean): VaultRow<TData>[] {
		return this.getRows().filter(predicate);
	}

	findBy<K extends keyof TData>(key: K, value: TData[K]): VaultRow<TData>[] {
		return this.getRows().filter((row) => row.data[key] === value);
	}

	orderBy(comparator: (a: VaultRow<TData>, b: VaultRow<TData>) => number): VaultRow<TData>[] {
		return [...this.getRows()].sort(comparator);
	}

	groupBy<K>(keyFn: (row: VaultRow<TData>) => K): Map<K, VaultRow<TData>[]> {
		const groups = new Map<K, VaultRow<TData>[]>();
		for (const row of this.getRows()) {
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
		return this.getRows().map((row) => row.data[key]);
	}

	some(predicate: (row: VaultRow<TData>) => boolean): boolean {
		return this.getRows().some(predicate);
	}

	every(predicate: (row: VaultRow<TData>) => boolean): boolean {
		return this.getRows().every(predicate);
	}

	createLiveQuery(sortFields?: SortField[]): LiveQueryBuilder<TData> {
		return new LiveQueryBuilder(this, sortFields);
	}
}
