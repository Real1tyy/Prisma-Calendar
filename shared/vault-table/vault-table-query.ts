import type { VaultRow } from "./types";
import type {
	FilterOperator,
	ParsedFilter,
	ParsedSort,
	RestFilterValue,
	RestSortDirection,
	SortField,
} from "./zod-filter-sort";
import { applyFilters, applySorts } from "./zod-filter-sort";

// ─── Types ──────────────────────────────────────────────────────

interface VaultTableQuerySource<TData> {
	toClonedArray(): VaultRow<TData>[];
}

const DEFAULT_QUERY_LIMIT = 100;

// ─── Field Predicate Builder ────────────────────────────────────

export class FieldPredicate<TData> {
	constructor(
		private readonly query: VaultTableQuery<TData>,
		private readonly field: string
	) {}

	eq(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "eq", value });
	}

	neq(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "neq", value });
	}

	contains(value: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "contains", value });
	}

	startsWith(value: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "startsWith", value });
	}

	endsWith(value: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "endsWith", value });
	}

	gt(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "gt", value });
	}

	lt(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "lt", value });
	}

	gte(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "gte", value });
	}

	lte(value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "lte", value });
	}

	before(value: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "before", value });
	}

	after(value: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "after", value });
	}

	in(values: string): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator: "in", value: values });
	}

	op(operator: FilterOperator, value: RestFilterValue): VaultTableQuery<TData> {
		return this.query.addFilter({ field: this.field, operator, value });
	}
}

// ─── Query Result ───────────────────────────────────────────────

export interface VaultTableQueryResult<TData> {
	data: VaultRow<TData>[];
	total: number;
	filtered: number;
	limit: number;
	offset: number;
}

// ─── Query Builder ──────────────────────────────────────────────

export class VaultTableQuery<TData> {
	private readonly filters: ParsedFilter[] = [];
	private readonly sorts: ParsedSort[] = [];
	private readonly sortFields: SortField[];
	private _limit: number | undefined;
	private _offset: number | undefined;

	private constructor(
		private readonly source: VaultTableQuerySource<TData>,
		sortFields?: SortField[]
	) {
		this.sortFields = sortFields ?? [];
	}

	static from<TData>(source: VaultTableQuerySource<TData>, sortFields?: SortField[]): VaultTableQuery<TData> {
		return new VaultTableQuery(source, sortFields);
	}

	// ─── Filter Chaining ────────────────────────────────────────

	where(field: Extract<keyof TData, string>): FieldPredicate<TData> {
		return new FieldPredicate(this, field);
	}

	filter(field: Extract<keyof TData, string>, operator: FilterOperator, value: RestFilterValue): this {
		this.filters.push({ field, operator, value });
		return this;
	}

	addFilter(parsed: ParsedFilter): this {
		this.filters.push(parsed);
		return this;
	}

	addFilters(filters: ParsedFilter[]): this {
		this.filters.push(...filters);
		return this;
	}

	// ─── Sort Chaining ──────────────────────────────────────────

	sortBy(field: Extract<keyof TData, string>, direction: RestSortDirection = "asc"): this {
		this.sorts.push({ field, direction });
		return this;
	}

	asc(field: Extract<keyof TData, string>): this {
		return this.sortBy(field, "asc");
	}

	desc(field: Extract<keyof TData, string>): this {
		return this.sortBy(field, "desc");
	}

	addSorts(sorts: ParsedSort[]): this {
		this.sorts.push(...sorts);
		return this;
	}

	// ─── Pagination ─────────────────────────────────────────────

	limit(n: number): this {
		this._limit = n;
		return this;
	}

	offset(n: number): this {
		this._offset = n;
		return this;
	}

	// ─── Execution ──────────────────────────────────────────────

	exec(): VaultTableQueryResult<TData> {
		let rows = this.source.toClonedArray();
		const total = rows.length;

		if (this.filters.length > 0) {
			const dataItems = rows.map((r) => ({ ...(r.data as Record<string, unknown>), __rowId: r.id }));
			const filtered = applyFilters(dataItems, this.filters);
			const filteredIds = new Set(filtered.map((f) => f.__rowId));
			rows = rows.filter((r) => filteredIds.has(r.id));
		}

		if (this.sorts.length > 0 && this.sortFields.length > 0) {
			const indexed = rows.map((r) => ({ ...(r.data as Record<string, unknown>), __row: r }));
			const sorted = applySorts(indexed, this.sorts, this.sortFields);
			rows = sorted.map((s) => s.__row);
		}

		const filtered = rows.length;
		const offset = this._offset ?? 0;
		const limit = this._limit ?? DEFAULT_QUERY_LIMIT;
		rows = rows.slice(offset, offset + limit);

		return { data: rows, total, filtered, limit, offset };
	}

	toArray(): VaultRow<TData>[] {
		return this.exec().data;
	}

	first(): VaultRow<TData> | undefined {
		return this.limit(1).exec().data[0];
	}

	count(): number {
		return this.exec().filtered;
	}
}
