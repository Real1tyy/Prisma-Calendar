import { TFile } from "obsidian";
import { describe, expect, it } from "vitest";

import type { VaultRow } from "../../src/core/vault-table/types";
import { VaultTableQuery } from "../../src/core/vault-table/vault-table-query";
import type { SortField } from "../../src/core/vault-table/zod-filter-sort";

// ─── Test Fixtures ──────────────────────────────────────────────

interface Person {
	name: string;
	city: string;
	age: number;
	active: boolean;
	joinDate: string;
}

function mockRow(id: string, data: Person): VaultRow<Person> {
	return {
		id,
		file: new TFile(`People/${id}.md`),
		filePath: `People/${id}.md`,
		data,
		content: "",
		mtime: Date.now(),
	};
}

const ROWS: VaultRow<Person>[] = [
	mockRow("alice", { name: "Alice", city: "New York", age: 30, active: true, joinDate: "2025-01-15" }),
	mockRow("bob", { name: "Bob", city: "Los Angeles", age: 25, active: false, joinDate: "2025-03-20" }),
	mockRow("charlie", { name: "Charlie", city: "New Orleans", age: 35, active: true, joinDate: "2025-06-01" }),
	mockRow("diana", { name: "Diana", city: "Chicago", age: 28, active: true, joinDate: "2025-09-10" }),
];

const SORT_FIELDS: SortField[] = [
	{ key: "name", type: "string" },
	{ key: "city", type: "string" },
	{ key: "age", type: "number" },
	{ key: "active", type: "boolean" },
	{ key: "joinDate", type: "date" },
];

function createSource(rows: VaultRow<Person>[] = ROWS) {
	return { toClonedArray: () => [...rows] };
}

function query(rows?: VaultRow<Person>[]) {
	return VaultTableQuery.from(createSource(rows), SORT_FIELDS);
}

// ─── Factory Tests ──────────────────────────────────────────────

describe("VaultTableQuery", () => {
	describe("factory", () => {
		it("creates a query from a source", () => {
			const q = query();
			expect(q).toBeInstanceOf(VaultTableQuery);
		});
	});

	// ─── Filter: where().operator() ─────────────────────────────

	describe("where() filter chaining", () => {
		it("filters by eq", () => {
			const result = query().where("city").eq("Chicago").toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Diana");
		});

		it("filters by neq", () => {
			const result = query().where("city").neq("Chicago").toArray();
			expect(result).toHaveLength(3);
			expect(result.every((r) => r.data.city !== "Chicago")).toBe(true);
		});

		it("filters by contains", () => {
			const result = query().where("city").contains("new").toArray();
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Charlie"]);
		});

		it("filters by startsWith", () => {
			const result = query().where("city").startsWith("los").toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Bob");
		});

		it("filters by endsWith", () => {
			const result = query().where("city").endsWith("york").toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Alice");
		});

		it("filters by gt", () => {
			const result = query().where("age").gt(30).toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Charlie");
		});

		it("filters by lt", () => {
			const result = query().where("age").lt(28).toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Bob");
		});

		it("filters by gte (includes boundary)", () => {
			const result = query().where("age").gte(30).toArray();
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Charlie"]);
		});

		it("filters by lte (includes boundary)", () => {
			const result = query().where("age").lte(28).toArray();
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Bob", "Diana"]);
		});

		it("filters by before (date)", () => {
			const result = query().where("joinDate").before("2025-03-20").toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Alice");
		});

		it("filters by after (date)", () => {
			const result = query().where("joinDate").after("2025-06-01").toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Diana");
		});

		it("filters by in", () => {
			const result = query().where("city").in("Chicago,New York").toArray();
			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Diana"]);
		});

		it("filters by op (generic operator)", () => {
			const result = query().where("age").op("gte", 35).toArray();
			expect(result).toHaveLength(1);
			expect(result[0].data.name).toBe("Charlie");
		});
	});

	// ─── Chained Filters ────────────────────────────────────────

	describe("chained filters (AND)", () => {
		it("chains multiple where clauses", () => {
			const result = query().where("active").eq("true").where("age").gte(30).toArray();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Charlie"]);
		});

		it("chains three filters", () => {
			const result = query().where("active").eq("true").where("age").gte(28).where("city").contains("new").toArray();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Charlie"]);
		});

		it("returns empty when filters exclude everything", () => {
			const result = query().where("age").gt(100).toArray();

			expect(result).toEqual([]);
		});
	});

	// ─── Sort Chaining ──────────────────────────────────────────

	describe("sort chaining", () => {
		it("sorts ascending by name", () => {
			const result = query().sortBy("name", "asc").toArray();
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Bob", "Charlie", "Diana"]);
		});

		it("sorts descending by name", () => {
			const result = query().desc("name").toArray();
			expect(result.map((r) => r.data.name)).toEqual(["Diana", "Charlie", "Bob", "Alice"]);
		});

		it("sorts ascending by age", () => {
			const result = query().asc("age").toArray();
			expect(result.map((r) => r.data.age)).toEqual([25, 28, 30, 35]);
		});

		it("sorts descending by age", () => {
			const result = query().desc("age").toArray();
			expect(result.map((r) => r.data.age)).toEqual([35, 30, 28, 25]);
		});

		it("sorts by date ascending", () => {
			const result = query().asc("joinDate").toArray();
			expect(result.map((r) => r.data.joinDate)).toEqual(["2025-01-15", "2025-03-20", "2025-06-01", "2025-09-10"]);
		});

		it("multi-key sort: primary then secondary", () => {
			const rows: VaultRow<Person>[] = [
				mockRow("a", { name: "Alice", city: "Berlin", age: 30, active: true, joinDate: "2025-01-01" }),
				mockRow("b", { name: "Bob", city: "Berlin", age: 25, active: true, joinDate: "2025-02-01" }),
				mockRow("c", { name: "Charlie", city: "Amsterdam", age: 35, active: true, joinDate: "2025-03-01" }),
			];

			const result = query(rows).asc("city").desc("age").toArray();
			expect(result.map((r) => r.data.name)).toEqual(["Charlie", "Alice", "Bob"]);
		});

		it("asc is shorthand for sortBy(field, 'asc')", () => {
			const a = query().asc("name").toArray();
			const b = query().sortBy("name", "asc").toArray();
			expect(a.map((r) => r.id)).toEqual(b.map((r) => r.id));
		});
	});

	// ─── Filter + Sort Composition ──────────────────────────────

	describe("filter + sort composition", () => {
		it("filters then sorts", () => {
			const result = query().where("active").eq("true").desc("age").toArray();

			expect(result).toHaveLength(3);
			expect(result.map((r) => r.data.name)).toEqual(["Charlie", "Alice", "Diana"]);
		});

		it("sorts then filters (order doesn't matter)", () => {
			const result = query().desc("age").where("active").eq("true").toArray();

			expect(result).toHaveLength(3);
			expect(result.map((r) => r.data.name)).toEqual(["Charlie", "Alice", "Diana"]);
		});

		it("filter + sort + limit", () => {
			const result = query().where("active").eq("true").desc("age").limit(2).exec();

			expect(result.data).toHaveLength(2);
			expect(result.data.map((r) => r.data.name)).toEqual(["Charlie", "Alice"]);
			expect(result.filtered).toBe(3);
			expect(result.total).toBe(4);
			expect(result.limit).toBe(2);
		});
	});

	// ─── Pagination ─────────────────────────────────────────────

	describe("pagination", () => {
		it("limits results", () => {
			const result = query().limit(2).exec();
			expect(result.data).toHaveLength(2);
			expect(result.limit).toBe(2);
		});

		it("offsets results", () => {
			const result = query().asc("name").offset(1).limit(2).exec();
			expect(result.data).toHaveLength(2);
			expect(result.data.map((r) => r.data.name)).toEqual(["Bob", "Charlie"]);
			expect(result.offset).toBe(1);
		});

		it("offset beyond data returns empty", () => {
			const result = query().offset(100).exec();
			expect(result.data).toEqual([]);
			expect(result.filtered).toBe(4);
		});

		it("default limit is 100", () => {
			const result = query().exec();
			expect(result.limit).toBe(100);
		});
	});

	// ─── Terminal Operations ────────────────────────────────────

	describe("terminal operations", () => {
		it("toArray() returns just the data rows", () => {
			const rows = query().where("city").eq("Chicago").toArray();
			expect(rows).toHaveLength(1);
			expect(rows[0].data.name).toBe("Diana");
		});

		it("first() returns the first matching row", () => {
			const row = query().asc("name").first();
			expect(row).toBeDefined();
			expect(row!.data.name).toBe("Alice");
		});

		it("first() returns undefined when no matches", () => {
			const row = query().where("age").gt(100).first();
			expect(row).toBeUndefined();
		});

		it("count() returns filtered count", () => {
			const n = query().where("active").eq("true").count();
			expect(n).toBe(3);
		});

		it("exec() returns full result object", () => {
			const result = query().where("active").eq("true").asc("name").limit(2).offset(1).exec();

			expect(result.data).toHaveLength(2);
			expect(result.total).toBe(4);
			expect(result.filtered).toBe(3);
			expect(result.limit).toBe(2);
			expect(result.offset).toBe(1);
		});
	});

	// ─── filter() shorthand ─────────────────────────────────────

	describe("filter() shorthand", () => {
		it("adds filter directly with operator and value", () => {
			const result = query().filter("age", "gte", 30).filter("active", "eq", "true").toArray();

			expect(result).toHaveLength(2);
			expect(result.map((r) => r.data.name)).toEqual(["Alice", "Charlie"]);
		});
	});

	// ─── Edge Cases ─────────────────────────────────────────────

	describe("edge cases", () => {
		it("works with empty source", () => {
			const result = query([]).toArray();
			expect(result).toEqual([]);
		});

		it("does not mutate source data", () => {
			const source = createSource();
			const original = source.toClonedArray();
			VaultTableQuery.from(source, SORT_FIELDS).desc("age").toArray();
			expect(source.toClonedArray().map((r) => r.id)).toEqual(original.map((r) => r.id));
		});

		it("works without sort fields (sort is no-op)", () => {
			const q = VaultTableQuery.from(createSource());
			const result = q.desc("age").toArray();
			expect(result).toHaveLength(4);
		});

		it("multiple exec() calls are idempotent", () => {
			const q = query().where("active").eq("true").asc("name");
			const r1 = q.exec();
			const r2 = q.exec();
			expect(r1.data.map((r) => r.id)).toEqual(r2.data.map((r) => r.id));
		});
	});
});
