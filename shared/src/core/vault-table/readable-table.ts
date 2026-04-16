import type { Observable } from "rxjs";

import { LiveQueryBuilder } from "./live-query";
import type { DataRow, VaultRow, VaultTableEvent } from "./types";
import type { SortField } from "./zod-filter-sort";

/**
 * Read-only interface for querying a reactive data source.
 * Generic over the row type — works with both VaultRow<TData> (file-backed)
 * and DataRow<TData> (CodeBlockRepository / lightweight stores).
 */
export interface ReadableTable<TData, TRow extends DataRow<TData> = VaultRow<TData>> {
	readonly events$: Observable<VaultTableEvent<TData, TRow>>;

	// ─── Row Access ──────────────────────────────────────────────
	get(name: string): TRow | undefined;
	has(name: string): boolean;
	count(): number;
	first(predicate?: (row: TRow) => boolean): TRow | undefined;

	// ─── Collection Access ───────────────────────────────────────
	toArray(): ReadonlyArray<TRow>;
	toClonedArray(): TRow[];

	// ─── Queries ─────────────────────────────────────────────────
	where(predicate: (row: TRow) => boolean): TRow[];
	findBy<K extends keyof TData>(key: K, value: TData[K]): TRow[];
	orderBy(comparator: (a: TRow, b: TRow) => number): TRow[];
	groupBy<K>(keyFn: (row: TRow) => K): Map<K, TRow[]>;
	pluck<K extends keyof TData>(key: K): TData[K][];
	some(predicate: (row: TRow) => boolean): boolean;
	every(predicate: (row: TRow) => boolean): boolean;

	/** Creates a reactive live query builder that re-evaluates on every source event */
	createLiveQuery(sortFields?: SortField[]): LiveQueryBuilder<TData, TRow>;
}

/**
 * Mixin that implements all ReadableTable query methods.
 * Generic over the row type — concrete classes provide getRows() and getRowById().
 */
export abstract class ReadableTableMixin<TData, TRow extends DataRow<TData> = VaultRow<TData>> implements ReadableTable<
	TData,
	TRow
> {
	abstract readonly events$: Observable<VaultTableEvent<TData, TRow>>;

	protected abstract getRowById(): ReadonlyMap<string, TRow>;
	protected abstract getRows(): ReadonlyArray<TRow>;

	get(name: string): TRow | undefined {
		return this.getRowById().get(name);
	}

	has(name: string): boolean {
		return this.getRowById().has(name);
	}

	count(): number {
		return this.getRowById().size;
	}

	first(predicate?: (row: TRow) => boolean): TRow | undefined {
		const rows = this.getRows();
		if (!predicate) return rows[0];
		return rows.find(predicate);
	}

	toArray(): ReadonlyArray<TRow> {
		return this.getRows();
	}

	toClonedArray(): TRow[] {
		return [...this.getRows()];
	}

	where(predicate: (row: TRow) => boolean): TRow[] {
		return this.getRows().filter(predicate);
	}

	findBy<K extends keyof TData>(key: K, value: TData[K]): TRow[] {
		return this.getRows().filter((row) => row.data[key] === value);
	}

	orderBy(comparator: (a: TRow, b: TRow) => number): TRow[] {
		return [...this.getRows()].sort(comparator);
	}

	groupBy<K>(keyFn: (row: TRow) => K): Map<K, TRow[]> {
		const groups = new Map<K, TRow[]>();
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

	some(predicate: (row: TRow) => boolean): boolean {
		return this.getRows().some(predicate);
	}

	every(predicate: (row: TRow) => boolean): boolean {
		return this.getRows().every(predicate);
	}

	createLiveQuery(sortFields?: SortField[]): LiveQueryBuilder<TData, TRow> {
		return new LiveQueryBuilder(this, sortFields);
	}
}
