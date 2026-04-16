import { describe, expect, it } from "vitest";

import { Filter } from "../../src/integrations/obsidian-bases/filter";

describe("Filter", () => {
	describe("note comparison filters", () => {
		it("creates eq filter", () => {
			const f = Filter.eq("Status", "Active");
			expect(f).toEqual({ type: "noteComparison", property: "Status", operator: "==", value: "Active" });
		});

		it("creates neq filter", () => {
			const f = Filter.neq("Archived", true);
			expect(f).toEqual({ type: "noteComparison", property: "Archived", operator: "!=", value: true });
		});

		it("creates gt filter", () => {
			const f = Filter.gt("Sort Date", "2026-03-09");
			expect(f).toEqual({ type: "noteComparison", property: "Sort Date", operator: ">", value: "2026-03-09" });
		});

		it("creates gte filter", () => {
			const f = Filter.gte("Priority", 5);
			expect(f).toEqual({ type: "noteComparison", property: "Priority", operator: ">=", value: 5 });
		});

		it("creates lt filter", () => {
			const f = Filter.lt("Sort Date", "2026-03-15");
			expect(f).toEqual({ type: "noteComparison", property: "Sort Date", operator: "<", value: "2026-03-15" });
		});

		it("creates lte filter", () => {
			const f = Filter.lte("Priority", 10);
			expect(f).toEqual({ type: "noteComparison", property: "Priority", operator: "<=", value: 10 });
		});
	});

	describe("contains filters", () => {
		it("creates contains filter", () => {
			const f = Filter.contains("Category", "Work");
			expect(f).toEqual({ type: "noteContains", property: "Category", value: "Work" });
		});

		it("creates selfLink filter", () => {
			const f = Filter.selfLink("Goal");
			expect(f).toEqual({ type: "noteSelfLink", property: "Goal" });
		});

		it("creates reverseContains filter", () => {
			const f = Filter.reverseContains("Children");
			expect(f).toEqual({ type: "reverseContains", property: "Children" });
		});
	});

	describe("file filters", () => {
		it("creates inFolder filter", () => {
			const f = Filter.inFolder("Tasks");
			expect(f).toEqual({ type: "fileFunction", fn: "inFolder", args: ["Tasks"] });
		});

		it("creates hasTag filter with multiple tags", () => {
			const f = Filter.hasTag("work", "important");
			expect(f).toEqual({ type: "fileFunction", fn: "hasTag", args: ["work", "important"] });
		});

		it("creates hasLink filter", () => {
			const f = Filter.hasLink("Index");
			expect(f).toEqual({ type: "fileFunction", fn: "hasLink", args: ["Index"] });
		});

		it("creates hasProperty filter", () => {
			const f = Filter.hasProperty("status");
			expect(f).toEqual({ type: "fileFunction", fn: "hasProperty", args: ["status"] });
		});

		it("creates filePath filter", () => {
			const f = Filter.filePath("People/Alice.md");
			expect(f).toEqual({ type: "filePath", operator: "==", path: "People/Alice.md" });
		});

		it("creates filePathNot filter", () => {
			const f = Filter.filePathNot("Templates/Template.md");
			expect(f).toEqual({ type: "filePath", operator: "!=", path: "Templates/Template.md" });
		});
	});

	describe("logical operators", () => {
		it("creates and group", () => {
			const f = Filter.and(Filter.inFolder("Tasks"), Filter.eq("Status", "Active"));
			expect(f.type).toBe("group");
			expect(f.operator).toBe("and");
			expect(f.children).toHaveLength(2);
		});

		it("creates or group", () => {
			const f = Filter.or(Filter.filePath("a.md"), Filter.filePath("b.md"));
			expect(f.operator).toBe("or");
			expect(f.children).toHaveLength(2);
		});

		it("creates not group", () => {
			const f = Filter.not(Filter.hasTag("archive"));
			expect(f.operator).toBe("not");
			expect(f.children).toHaveLength(1);
		});

		it("supports nested groups", () => {
			const f = Filter.or(Filter.hasTag("tag"), Filter.and(Filter.hasTag("book"), Filter.hasLink("Textbook")));
			expect(f.children).toHaveLength(2);
			expect(f.children[1].type).toBe("group");
		});
	});

	describe("link comparison filters", () => {
		it("creates eqLink filter with display name", () => {
			const f = Filter.eqLink("Parent", "Periodic/Weekly/2026-W11", "2026-W11");
			expect(f).toEqual({
				type: "noteLinkComparison",
				property: "Parent",
				operator: "==",
				path: "Periodic/Weekly/2026-W11",
				displayName: "2026-W11",
			});
		});

		it("creates eqLink filter without display name", () => {
			const f = Filter.eqLink("Parent", "Periodic/Weekly/2026-W11");
			expect(f).toEqual({
				type: "noteLinkComparison",
				property: "Parent",
				operator: "==",
				path: "Periodic/Weekly/2026-W11",
			});
		});

		it("creates neqLink filter", () => {
			const f = Filter.neqLink("Parent", "Periodic/Monthly/2026-03", "March 2026");
			expect(f).toEqual({
				type: "noteLinkComparison",
				property: "Parent",
				operator: "!=",
				path: "Periodic/Monthly/2026-03",
				displayName: "March 2026",
			});
		});
	});

	describe("raw filter", () => {
		it("creates raw filter", () => {
			const f = Filter.raw('file.hasTag("special") && custom.check()');
			expect(f).toEqual({ type: "raw", expression: 'file.hasTag("special") && custom.check()' });
		});
	});
});
