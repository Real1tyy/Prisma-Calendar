import { BehaviorSubject, type Observable, type Subscription } from "rxjs";

import type { ReadableTable } from "./readable-table";
import type { VaultRow } from "./types";
import type { ParsedFilter, ParsedSort, SortField } from "./zod-filter-sort";
import { matchesAllFilters, sortByFields } from "./zod-filter-sort";

export interface LiveQueryConfig<TData> {
	filters: ParsedFilter[];
	sorts: ParsedSort[];
	sortFields: SortField[];
	limit?: number;
	offset?: number;
	predicate?: (row: VaultRow<TData>) => boolean;
}

const DEFAULT_LIVE_QUERY_LIMIT = 100;

/**
 * A reactive query that re-evaluates automatically when the source emits events.
 * Returns an Observable<VaultRow[]> that emits new results whenever the underlying data changes.
 */
export class LiveQuery<TData> {
	private readonly subject: BehaviorSubject<ReadonlyArray<VaultRow<TData>>>;
	private readonly subscription: Subscription;

	public readonly results$: Observable<ReadonlyArray<VaultRow<TData>>>;

	constructor(
		private readonly source: ReadableTable<TData>,
		private readonly config: LiveQueryConfig<TData>
	) {
		this.subject = new BehaviorSubject<ReadonlyArray<VaultRow<TData>>>(this.execute());
		this.results$ = this.subject.asObservable();

		this.subscription = this.source.events$.subscribe(() => {
			this.subject.next(this.execute());
		});
	}

	/** Returns the current query result snapshot */
	value(): ReadonlyArray<VaultRow<TData>> {
		return this.subject.value;
	}

	destroy(): void {
		this.subscription.unsubscribe();
		this.subject.complete();
	}

	private execute(): ReadonlyArray<VaultRow<TData>> {
		let rows = this.source.toClonedArray();

		if (this.config.predicate) {
			rows = rows.filter(this.config.predicate);
		}

		if (this.config.filters.length > 0) {
			rows = rows.filter((r) => matchesAllFilters(r.data as Record<string, unknown>, this.config.filters));
		}

		if (this.config.sorts.length > 0 && this.config.sortFields.length > 0) {
			rows = sortByFields(rows, this.config.sorts, this.config.sortFields, (r) => r.data as Record<string, unknown>);
		}

		const offset = this.config.offset ?? 0;
		const limit = this.config.limit ?? DEFAULT_LIVE_QUERY_LIMIT;
		return rows.slice(offset, offset + limit);
	}
}

// ─── Builder ────────────────────────────────────────────────────

export class LiveQueryBuilder<TData> {
	private readonly filters: ParsedFilter[] = [];
	private readonly sorts: ParsedSort[] = [];
	private readonly sortFields: SortField[];
	private _limit: number | undefined;
	private _offset: number | undefined;
	private _predicate: ((row: VaultRow<TData>) => boolean) | undefined;

	constructor(
		private readonly source: ReadableTable<TData>,
		sortFields?: SortField[]
	) {
		this.sortFields = sortFields ?? [];
	}

	/** Add a programmatic filter predicate */
	filter(predicate: (row: VaultRow<TData>) => boolean): this {
		this._predicate = predicate;
		return this;
	}

	/** Add a parsed filter (field-level) */
	addFilter(parsed: ParsedFilter): this {
		this.filters.push(parsed);
		return this;
	}

	/** Add multiple parsed filters */
	addFilters(filters: ParsedFilter[]): this {
		this.filters.push(...filters);
		return this;
	}

	/** Add a sort */
	sortBy(field: string, direction: "asc" | "desc" = "asc"): this {
		this.sorts.push({ field, direction });
		return this;
	}

	limit(n: number): this {
		this._limit = n;
		return this;
	}

	offset(n: number): this {
		this._offset = n;
		return this;
	}

	/** Build and start the live query */
	build(): LiveQuery<TData> {
		const config: LiveQueryConfig<TData> = {
			filters: this.filters,
			sorts: this.sorts,
			sortFields: this.sortFields,
		};
		if (this._limit !== undefined) config.limit = this._limit;
		if (this._offset !== undefined) config.offset = this._offset;
		if (this._predicate !== undefined) config.predicate = this._predicate;
		return new LiveQuery(this.source, config);
	}
}
