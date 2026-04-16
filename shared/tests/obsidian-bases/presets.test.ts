import { describe, expect, it } from "vitest";

import { BasePresets, ColumnRef, OrderRef } from "../../src/integrations/obsidian-bases/presets";

describe("BasePresets", () => {
	describe("archivedFilter", () => {
		it("creates exclude filter by default", () => {
			const f = BasePresets.archivedFilter("Archived");
			expect(f).toEqual({ type: "noteComparison", property: "Archived", operator: "!=", value: true });
		});

		it("creates include filter when exclude=false", () => {
			const f = BasePresets.archivedFilter("Archived", false);
			expect(f).toEqual({ type: "noteComparison", property: "Archived", operator: "==", value: true });
		});
	});

	describe("dateRange", () => {
		it("creates gt+lt filter group", () => {
			const f = BasePresets.dateRange("Date", "2026-03-01", "2026-03-31");
			expect(f.type).toBe("group");
			if (f.type === "group") {
				expect(f.operator).toBe("and");
				expect(f.children).toHaveLength(2);
			}
		});
	});

	describe("filePathList", () => {
		it("creates or group for multiple paths", () => {
			const f = BasePresets.filePathList(["a.md", "b.md"]);
			expect(f.type).toBe("group");
			if (f.type === "group") {
				expect(f.operator).toBe("or");
				expect(f.children).toHaveLength(2);
			}
		});

		it("creates empty path filter for empty list", () => {
			const f = BasePresets.filePathList([]);
			expect(f).toEqual({ type: "filePath", operator: "==", path: "" });
		});

		it("creates single path in or group", () => {
			const f = BasePresets.filePathList(["only.md"]);
			expect(f.type).toBe("group");
			if (f.type === "group") {
				expect(f.children).toHaveLength(1);
			}
		});
	});

	describe("relativeDateFormula", () => {
		it("generates correct formula expression", () => {
			const f = BasePresets.relativeDateFormula("Days Remaining", "End Date");
			expect(f.name).toBe("Days Remaining");
			expect(f.expression).toContain('note["End Date"]');
			expect(f.expression).toContain(".relative()");
			expect(f.expression).toContain('.contains("T")');
		});
	});
});

describe("OrderRef", () => {
	it("provides file field constants", () => {
		expect(OrderRef.fileName).toBe("file.name");
		expect(OrderRef.filePath).toBe("file.path");
		expect(OrderRef.fileCtime).toBe("file.ctime");
	});

	it("creates note property reference", () => {
		expect(OrderRef.note("Status")).toBe("note.Status");
	});

	it("creates formula reference", () => {
		expect(OrderRef.formula("Days Remaining")).toBe("formula.Days Remaining");
	});
});

describe("ColumnRef", () => {
	it("creates note column reference", () => {
		expect(ColumnRef.note("Title")).toBe("note.Title");
	});

	it("creates formula column reference", () => {
		expect(ColumnRef.formula("ppu")).toBe("formula.ppu");
	});
});
