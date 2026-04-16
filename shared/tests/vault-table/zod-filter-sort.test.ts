import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
	applyFilters,
	applySorts,
	type FilterField,
	inferFilterFields,
	inferSortFields,
	matchesAllFilters,
	OPERATORS_BY_TYPE,
	type ParsedFilter,
	type ParsedSort,
	parseFilterParams,
	parseSortParams,
	sortByFields,
	type SortField,
} from "../../src/core/vault-table/zod-filter-sort";

// ─── inferFilterFields / inferSortFields ───────────────────────

describe("inferFilterFields / inferSortFields", () => {
	const shape = {
		status: z.string().optional(),
		progress: z.number().min(0).max(100).optional(),
		archived: z.union([z.boolean(), z.string()]).optional(),
		startDate: z.iso.date().optional(),
		createdAt: z.iso.datetime().optional(),
		tags: z.array(z.string()).optional(),
	};

	it("infers correct field types from Zod schema", () => {
		const fields = inferFilterFields(shape);
		expect(fields.find((f) => f.key === "status")!.type).toBe("string");
		expect(fields.find((f) => f.key === "progress")!.type).toBe("number");
		expect(fields.find((f) => f.key === "archived")!.type).toBe("string");
		expect(fields.find((f) => f.key === "startDate")!.type).toBe("date");
		expect(fields.find((f) => f.key === "createdAt")!.type).toBe("date");
	});

	it("assigns correct operators per type", () => {
		const fields = inferFilterFields(shape);
		expect(fields.find((f) => f.key === "status")!.operators).toEqual(OPERATORS_BY_TYPE.string);
		expect(fields.find((f) => f.key === "progress")!.operators).toEqual(OPERATORS_BY_TYPE.number);
		expect(fields.find((f) => f.key === "startDate")!.operators).toEqual(OPERATORS_BY_TYPE.date);
		expect(fields.find((f) => f.key === "createdAt")!.operators).toEqual(OPERATORS_BY_TYPE.date);
	});

	it("skips unknown types like arrays", () => {
		expect(inferFilterFields(shape).find((f) => f.key === "tags")).toBeUndefined();
	});

	it("returns empty for empty shape", () => {
		expect(inferFilterFields({})).toEqual([]);
	});

	it("inferSortFields returns same keys as inferFilterFields", () => {
		const filterKeys = inferFilterFields(shape).map((f) => f.key);
		const sortKeys = inferSortFields(shape).map((f) => f.key);
		expect(sortKeys).toEqual(filterKeys);
	});

	it("inferSortFields assigns correct types", () => {
		const fields = inferSortFields(shape);
		expect(fields.find((f) => f.key === "progress")!.type).toBe("number");
		expect(fields.find((f) => f.key === "status")!.type).toBe("string");
		expect(fields.find((f) => f.key === "startDate")!.type).toBe("date");
		expect(fields.find((f) => f.key === "createdAt")!.type).toBe("date");
	});
});

// ─── parseFilterParams ─────────────────────────────────────────

describe("parseFilterParams", () => {
	const fields: FilterField[] = [
		{ key: "status", operators: OPERATORS_BY_TYPE.string, type: "string" },
		{ key: "progress", operators: OPERATORS_BY_TYPE.number, type: "number" },
		{ key: "archived", operators: OPERATORS_BY_TYPE.boolean, type: "boolean" },
		{ key: "startDate", operators: OPERATORS_BY_TYPE.date, type: "date" },
	];

	describe("operator suffix parsing", () => {
		it("bare field name → eq", () => {
			expect(parseFilterParams({ status: "active" }, fields)).toEqual([
				{ field: "status", operator: "eq", value: "active" },
			]);
		});

		it.each([
			["status_contains", "act", "contains"],
			["status_startsWith", "act", "startsWith"],
			["status_endsWith", "ive", "endsWith"],
			["status_neq", "done", "neq"],
			["status_in", "a,b", "in"],
			["progress_gte", "50", "gte"],
			["progress_gt", "50", "gt"],
			["progress_lt", "80", "lt"],
			["progress_lte", "80", "lte"],
			["startDate_before", "2026-01-01", "before"],
			["startDate_after", "2026-01-01", "after"],
		])("'%s' → operator '%s'", (key, value, expectedOp) => {
			const filters = parseFilterParams({ [key]: value }, fields);
			expect(filters).toHaveLength(1);
			expect(filters[0].operator).toBe(expectedOp);
		});
	});

	describe("value coercion", () => {
		it("coerces number field values to numbers", () => {
			const filters = parseFilterParams({ progress: "42" }, fields);
			expect(filters[0].value).toBe(42);
			expect(typeof filters[0].value).toBe("number");
		});

		it("coerces 'true' to boolean true", () => {
			expect(parseFilterParams({ archived: "true" }, fields)[0].value).toBe(true);
		});

		it("coerces '1' to boolean true", () => {
			expect(parseFilterParams({ archived: "1" }, fields)[0].value).toBe(true);
		});

		it("coerces '0' to boolean false", () => {
			expect(parseFilterParams({ archived: "0" }, fields)[0].value).toBe(false);
		});

		it("leaves date values as strings", () => {
			const filters = parseFilterParams({ startDate: "2026-01-01" }, fields);
			expect(typeof filters[0].value).toBe("string");
		});
	});

	describe("edge cases", () => {
		it("parses multiple filters from one query", () => {
			expect(parseFilterParams({ status: "active", progress_gte: "50" }, fields)).toHaveLength(2);
		});

		it("ignores reserved params", () => {
			const filters = parseFilterParams({ sort: "x:asc", limit: "10", offset: "0", status: "active" }, fields);
			expect(filters).toHaveLength(1);
		});

		it("ignores unknown fields", () => {
			expect(parseFilterParams({ unknownField: "x" }, fields)).toEqual([]);
		});

		it("ignores invalid operator for field type", () => {
			expect(parseFilterParams({ archived_contains: "true" }, fields)).toEqual([]);
		});

		it("returns empty for empty query", () => {
			expect(parseFilterParams({}, fields)).toEqual([]);
		});
	});
});

// ─── parseSortParams ───────────────────────────────────────────

describe("parseSortParams", () => {
	it("parses single sort with direction", () => {
		expect(parseSortParams({ sort: "priority:desc" })).toEqual([{ field: "priority", direction: "desc" }]);
	});

	it("defaults to asc", () => {
		expect(parseSortParams({ sort: "name" })).toEqual([{ field: "name", direction: "asc" }]);
	});

	it("parses multi-key sort", () => {
		expect(parseSortParams({ sort: "priority:desc,name:asc" })).toEqual([
			{ field: "priority", direction: "desc" },
			{ field: "name", direction: "asc" },
		]);
	});

	it("returns empty when no sort param", () => {
		expect(parseSortParams({})).toEqual([]);
	});
});

// ─── applyFilters ──────────────────────────────────────────────

describe("applyFilters", () => {
	describe("string operations", () => {
		const items = [
			{ name: "Alice", city: "New York", role: "engineer" },
			{ name: "Bob", city: "Los Angeles", role: "designer" },
			{ name: "Charlie", city: "New Orleans", role: "engineer" },
			{ name: "Diana", city: "Chicago", role: "manager" },
		];

		it("eq: exact match", () => {
			const result = applyFilters(items, [{ field: "city", operator: "eq", value: "Chicago" }]);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Diana");
		});

		it("neq: excludes match", () => {
			const result = applyFilters(items, [{ field: "city", operator: "neq", value: "Chicago" }]);
			expect(result).toHaveLength(3);
		});

		it("contains: case-insensitive substring", () => {
			const result = applyFilters(items, [{ field: "city", operator: "contains", value: "new" }]);
			expect(result.map((r) => r.name)).toEqual(["Alice", "Charlie"]);
		});

		it("startsWith: case-insensitive prefix", () => {
			const result = applyFilters(items, [{ field: "city", operator: "startsWith", value: "los" }]);
			expect(result[0].name).toBe("Bob");
		});

		it("endsWith: case-insensitive suffix", () => {
			const result = applyFilters(items, [{ field: "city", operator: "endsWith", value: "york" }]);
			expect(result[0].name).toBe("Alice");
		});

		it("in: comma-separated membership", () => {
			const result = applyFilters(items, [{ field: "role", operator: "in", value: "engineer,manager" }]);
			expect(result.map((r) => r.name)).toEqual(["Alice", "Charlie", "Diana"]);
		});
	});

	describe("number operations", () => {
		const items = [
			{ name: "Project Alpha", budget: 50000, progress: 80 },
			{ name: "Project Beta", budget: 120000, progress: 30 },
			{ name: "Project Gamma", budget: 75000, progress: 100 },
			{ name: "Project Delta", budget: 50000, progress: 55 },
		];

		it("eq: exact number match", () => {
			const result = applyFilters(items, [{ field: "budget", operator: "eq", value: 50000 }]);
			expect(result).toHaveLength(2);
		});

		it("gt: strictly greater", () => {
			const result = applyFilters(items, [{ field: "budget", operator: "gt", value: 75000 }]);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Project Beta");
		});

		it("gte: includes boundary", () => {
			const result = applyFilters(items, [{ field: "budget", operator: "gte", value: 75000 }]);
			expect(result).toHaveLength(2);
		});

		it("lt: strictly less", () => {
			const result = applyFilters(items, [{ field: "progress", operator: "lt", value: 55 }]);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Project Beta");
		});

		it("lte: includes boundary", () => {
			const result = applyFilters(items, [{ field: "progress", operator: "lte", value: 55 }]);
			expect(result).toHaveLength(2);
		});
	});

	describe("boolean operations", () => {
		const items = [
			{ name: "Task A", completed: true },
			{ name: "Task B", completed: false },
			{ name: "Task C", completed: true },
		];

		it("eq: matches true", () => {
			const result = applyFilters(items, [{ field: "completed", operator: "eq", value: "true" }]);
			expect(result).toHaveLength(2);
		});

		it("neq: excludes true", () => {
			const result = applyFilters(items, [{ field: "completed", operator: "neq", value: "true" }]);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Task B");
		});
	});

	describe("date operations", () => {
		const events = [
			{ title: "Team Meeting", date: "2025-03-15" },
			{ title: "Weekly Review", date: "2025-06-20" },
			{ title: "Project Planning", date: "2025-09-01" },
			{ title: "Quarterly Review", date: "2025-12-15" },
		];

		it("after: filters dates after given date", () => {
			const result = applyFilters(events, [{ field: "date", operator: "after", value: "2025-06-20" }]);
			expect(result.map((r) => r.title)).toEqual(["Project Planning", "Quarterly Review"]);
		});

		it("before: filters dates before given date", () => {
			const result = applyFilters(events, [{ field: "date", operator: "before", value: "2025-06-20" }]);
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe("Team Meeting");
		});

		it("gte: includes exact date", () => {
			const result = applyFilters(events, [{ field: "date", operator: "gte", value: "2025-06-20" }]);
			expect(result).toHaveLength(3);
			expect(result[0].title).toBe("Weekly Review");
		});

		it("lte: includes exact date", () => {
			const result = applyFilters(events, [{ field: "date", operator: "lte", value: "2025-06-20" }]);
			expect(result).toHaveLength(2);
		});

		it("date range: after + before combined", () => {
			const filters: ParsedFilter[] = [
				{ field: "date", operator: "after", value: "2025-03-15" },
				{ field: "date", operator: "before", value: "2025-12-15" },
			];
			const result = applyFilters(events, filters);
			expect(result.map((r) => r.title)).toEqual(["Weekly Review", "Project Planning"]);
		});

		it("eq: exact date match", () => {
			const result = applyFilters(events, [{ field: "date", operator: "eq", value: "2025-09-01" }]);
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe("Project Planning");
		});

		it("handles ISO datetime strings", () => {
			const datetimeEvents = [
				{ title: "Morning", date: "2025-06-20T09:00:00" },
				{ title: "Afternoon", date: "2025-06-20T14:00:00" },
				{ title: "Evening", date: "2025-06-20T19:00:00" },
			];
			const result = applyFilters(datetimeEvents, [{ field: "date", operator: "after", value: "2025-06-20T12:00:00" }]);
			expect(result.map((r) => r.title)).toEqual(["Afternoon", "Evening"]);
		});

		it("handles cross-month date comparison correctly", () => {
			const items = [
				{ title: "Jan", date: "2025-01-31" },
				{ title: "Feb", date: "2025-02-01" },
				{ title: "Mar", date: "2025-03-01" },
			];
			const result = applyFilters(items, [{ field: "date", operator: "after", value: "2025-01-31" }]);
			expect(result.map((r) => r.title)).toEqual(["Feb", "Mar"]);
		});

		it("handles cross-year date comparison", () => {
			const items = [
				{ title: "Old", date: "2024-12-31" },
				{ title: "New", date: "2025-01-01" },
			];
			const result = applyFilters(items, [{ field: "date", operator: "after", value: "2024-12-31" }]);
			expect(result).toHaveLength(1);
			expect(result[0].title).toBe("New");
		});
	});

	describe("multiple filters (AND logic)", () => {
		const items = [
			{ name: "Alice", age: 30, role: "engineer", active: true },
			{ name: "Bob", age: 25, role: "designer", active: false },
			{ name: "Charlie", age: 35, role: "engineer", active: true },
			{ name: "Diana", age: 28, role: "manager", active: true },
		];

		it("all filters must match", () => {
			const filters: ParsedFilter[] = [
				{ field: "active", operator: "eq", value: "true" },
				{ field: "role", operator: "eq", value: "engineer" },
			];
			const result = applyFilters(items, filters);
			expect(result.map((r) => r.name)).toEqual(["Alice", "Charlie"]);
		});
	});

	describe("edge cases", () => {
		it("returns all items when no filters", () => {
			expect(applyFilters([{ a: 1 }], [])).toEqual([{ a: 1 }]);
		});

		it("excludes null field values", () => {
			const items = [{ city: "Berlin" }, { city: null as unknown as string }];
			expect(applyFilters(items, [{ field: "city", operator: "eq", value: "Berlin" }])).toHaveLength(1);
		});

		it("excludes undefined field values", () => {
			const items = [{ name: "Alice" }, { name: "Bob" }];

			expect(applyFilters(items as any, [{ field: "city", operator: "eq", value: "x" }])).toHaveLength(0);
		});
	});
});

// ─── applySorts ────────────────────────────────────────────────

describe("applySorts", () => {
	describe("string sorting", () => {
		const fields: SortField[] = [{ key: "name", type: "string" }];
		const items = [{ name: "Charlie" }, { name: "Alice" }, { name: "Bob" }];

		it("sorts ascending", () => {
			const result = applySorts(items, [{ field: "name", direction: "asc" }], fields);
			expect(result.map((r) => r.name)).toEqual(["Alice", "Bob", "Charlie"]);
		});

		it("sorts descending", () => {
			const result = applySorts(items, [{ field: "name", direction: "desc" }], fields);
			expect(result.map((r) => r.name)).toEqual(["Charlie", "Bob", "Alice"]);
		});
	});

	describe("number sorting", () => {
		const fields: SortField[] = [{ key: "age", type: "number" }];
		const items = [{ age: 35 }, { age: 25 }, { age: 30 }];

		it("sorts ascending", () => {
			const result = applySorts(items, [{ field: "age", direction: "asc" }], fields);
			expect(result.map((r) => r.age)).toEqual([25, 30, 35]);
		});

		it("sorts descending", () => {
			const result = applySorts(items, [{ field: "age", direction: "desc" }], fields);
			expect(result.map((r) => r.age)).toEqual([35, 30, 25]);
		});
	});

	describe("boolean sorting", () => {
		const fields: SortField[] = [{ key: "active", type: "boolean" }];
		const items = [{ active: true }, { active: false }, { active: true }];

		it("sorts false before true ascending", () => {
			const result = applySorts(items, [{ field: "active", direction: "asc" }], fields);
			expect(result[0].active).toBe(false);
		});

		it("sorts true before false descending", () => {
			const result = applySorts(items, [{ field: "active", direction: "desc" }], fields);
			expect(result[0].active).toBe(true);
			expect(result[result.length - 1].active).toBe(false);
		});
	});

	describe("date sorting", () => {
		const fields: SortField[] = [{ key: "date", type: "date" }];

		it("sorts ISO date strings ascending using DateTime", () => {
			const items = [{ date: "2025-09-10" }, { date: "2025-01-15" }, { date: "2025-06-01" }, { date: "2025-03-20" }];
			const result = applySorts(items, [{ field: "date", direction: "asc" }], fields);
			expect(result.map((r) => r.date)).toEqual(["2025-01-15", "2025-03-20", "2025-06-01", "2025-09-10"]);
		});

		it("sorts ISO date strings descending", () => {
			const items = [{ date: "2025-01-15" }, { date: "2025-09-10" }, { date: "2025-03-20" }];
			const result = applySorts(items, [{ field: "date", direction: "desc" }], fields);
			expect(result.map((r) => r.date)).toEqual(["2025-09-10", "2025-03-20", "2025-01-15"]);
		});

		it("sorts ISO datetime strings correctly", () => {
			const items = [{ date: "2025-06-20T19:00:00" }, { date: "2025-06-20T09:00:00" }, { date: "2025-06-20T14:00:00" }];
			const result = applySorts(items, [{ field: "date", direction: "asc" }], fields);
			expect(result.map((r) => r.date)).toEqual(["2025-06-20T09:00:00", "2025-06-20T14:00:00", "2025-06-20T19:00:00"]);
		});

		it("sorts cross-year dates correctly", () => {
			const items = [{ date: "2026-01-01" }, { date: "2024-12-31" }, { date: "2025-06-15" }];
			const result = applySorts(items, [{ field: "date", direction: "asc" }], fields);
			expect(result.map((r) => r.date)).toEqual(["2024-12-31", "2025-06-15", "2026-01-01"]);
		});

		it("sorts same-day different-time entries", () => {
			const items = [{ date: "2025-03-15T23:59:59" }, { date: "2025-03-15T00:00:00" }, { date: "2025-03-15T12:00:00" }];
			const result = applySorts(items, [{ field: "date", direction: "asc" }], fields);
			expect(result.map((r) => r.date)).toEqual(["2025-03-15T00:00:00", "2025-03-15T12:00:00", "2025-03-15T23:59:59"]);
		});
	});

	describe("multi-key sort", () => {
		const fields: SortField[] = [
			{ key: "role", type: "string" },
			{ key: "age", type: "number" },
		];

		it("uses secondary sort when primary ties", () => {
			const items = [
				{ role: "engineer", age: 35 },
				{ role: "engineer", age: 25 },
				{ role: "designer", age: 30 },
			];
			const sorts: ParsedSort[] = [
				{ field: "role", direction: "asc" },
				{ field: "age", direction: "desc" },
			];
			const result = applySorts(items, sorts, fields);
			expect(result).toEqual([
				{ role: "designer", age: 30 },
				{ role: "engineer", age: 35 },
				{ role: "engineer", age: 25 },
			]);
		});
	});

	describe("edge cases", () => {
		const fields: SortField[] = [{ key: "name", type: "string" }];

		it("returns unchanged when no sorts", () => {
			const items = [{ name: "B" }, { name: "A" }];
			expect(applySorts(items, [], fields)).toEqual(items);
		});

		it("does not mutate original array", () => {
			const items = [{ name: "B" }, { name: "A" }];
			const original = [...items];
			applySorts(items, [{ field: "name", direction: "asc" }], fields);
			expect(items).toEqual(original);
		});

		it("undefined values sort last", () => {
			const items = [{ name: "Alice" }, { name: undefined as unknown as string }, { name: "Bob" }];
			const result = applySorts(items, [{ field: "name", direction: "asc" }], fields);
			expect(result[result.length - 1].name).toBeUndefined();
		});

		it("skips unknown sort fields", () => {
			const items = [{ name: "B" }, { name: "A" }];
			expect(applySorts(items, [{ field: "nonexistent", direction: "asc" }], fields)).toEqual(items);
		});
	});
});

// ─── Full Pipeline ─────────────────────────────────────────────

describe("full pipeline: infer → parse → apply", () => {
	const shape = {
		status: z.string().optional(),
		priority: z.string().optional(),
		progress: z.number().min(0).max(100).optional(),
	};

	const items = [
		{ status: "active", priority: "high", progress: 80 },
		{ status: "active", priority: "low", progress: 30 },
		{ status: "done", priority: "medium", progress: 100 },
		{ status: "active", priority: "high", progress: 60 },
	];

	it("filters + sorts from inferred schema", () => {
		const filterFields = inferFilterFields(shape);
		const sortFieldDefs = inferSortFields(shape);
		const query = { status: "active", progress_gte: "50", sort: "progress:desc" };

		let result = applyFilters(items, parseFilterParams(query, filterFields));
		result = applySorts(result, parseSortParams(query), sortFieldDefs);

		expect(result).toHaveLength(2);
		expect(result[0].progress).toBe(80);
		expect(result[1].progress).toBe(60);
	});

	it("string contains filter on inferred schema", () => {
		const filterFields = inferFilterFields(shape);
		const result = applyFilters(items, parseFilterParams({ priority: "high" }, filterFields));
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.priority === "high")).toBe(true);
	});
});

// ─── matchesAllFilters ──────────────────────────────────────────

describe("matchesAllFilters", () => {
	it("should return true when all filters match", () => {
		const item = { name: "Alice", city: "New York", age: 30 };
		const filters: ParsedFilter[] = [
			{ field: "name", operator: "eq", value: "Alice" },
			{ field: "city", operator: "contains", value: "york" },
		];
		expect(matchesAllFilters(item, filters)).toBe(true);
	});

	it("should return false when any filter fails", () => {
		const item = { name: "Alice", city: "New York", age: 30 };
		const filters: ParsedFilter[] = [
			{ field: "name", operator: "eq", value: "Alice" },
			{ field: "city", operator: "eq", value: "Chicago" },
		];
		expect(matchesAllFilters(item, filters)).toBe(false);
	});

	it("should return true for empty filters", () => {
		const item = { name: "Alice" };
		expect(matchesAllFilters(item, [])).toBe(true);
	});

	it("should produce same result as applyFilters for single item", () => {
		const item = { name: "Bob", priority: 5, active: true };
		const filters: ParsedFilter[] = [
			{ field: "priority", operator: "gt", value: 3 },
			{ field: "active", operator: "eq", value: true },
		];
		const arrayResult = applyFilters([item], filters);
		const singleResult = matchesAllFilters(item, filters);
		expect(singleResult).toBe(arrayResult.length === 1);
	});
});

// ─── sortByFields ───────────────────────────────────────────────

describe("sortByFields", () => {
	interface WrappedItem {
		id: string;
		data: { name: string; priority: number };
	}

	const fields: SortField[] = [
		{ key: "priority", type: "number" },
		{ key: "name", type: "string" },
	];

	const accessor = (item: WrappedItem) => item.data as Record<string, unknown>;

	it("should sort by a single field ascending", () => {
		const items: WrappedItem[] = [
			{ id: "c", data: { name: "Charlie", priority: 3 } },
			{ id: "a", data: { name: "Alice", priority: 1 } },
			{ id: "b", data: { name: "Bob", priority: 2 } },
		];

		const sorted = sortByFields(items, [{ field: "priority", direction: "asc" }], fields, accessor);
		expect(sorted.map((s) => s.id)).toEqual(["a", "b", "c"]);
	});

	it("should sort by a single field descending", () => {
		const items: WrappedItem[] = [
			{ id: "a", data: { name: "Alice", priority: 1 } },
			{ id: "c", data: { name: "Charlie", priority: 3 } },
			{ id: "b", data: { name: "Bob", priority: 2 } },
		];

		const sorted = sortByFields(items, [{ field: "priority", direction: "desc" }], fields, accessor);
		expect(sorted.map((s) => s.id)).toEqual(["c", "b", "a"]);
	});

	it("should produce same results as applySorts for flat objects", () => {
		const wrapped: WrappedItem[] = [
			{ id: "c", data: { name: "Charlie", priority: 1 } },
			{ id: "a", data: { name: "Alice", priority: 1 } },
			{ id: "b", data: { name: "Bob", priority: 2 } },
		];
		const flat = wrapped.map((w) => ({ ...w.data, __id: w.id }));

		const sorts: ParsedSort[] = [
			{ field: "priority", direction: "asc" },
			{ field: "name", direction: "asc" },
		];

		const sortedWrapped = sortByFields(wrapped, sorts, fields, accessor);
		const sortedFlat = applySorts(flat, sorts, fields);

		expect(sortedWrapped.map((s) => s.id)).toEqual(sortedFlat.map((s) => s.__id));
	});

	it("should not mutate the original array", () => {
		const items: WrappedItem[] = [
			{ id: "b", data: { name: "Bob", priority: 2 } },
			{ id: "a", data: { name: "Alice", priority: 1 } },
		];

		const original = [...items];
		sortByFields(items, [{ field: "priority", direction: "asc" }], fields, accessor);
		expect(items).toEqual(original);
	});

	it("should return items unchanged when no sorts provided", () => {
		const items: WrappedItem[] = [
			{ id: "b", data: { name: "Bob", priority: 2 } },
			{ id: "a", data: { name: "Alice", priority: 1 } },
		];

		const result = sortByFields(items, [], fields, accessor);
		expect(result).toBe(items);
	});
});
