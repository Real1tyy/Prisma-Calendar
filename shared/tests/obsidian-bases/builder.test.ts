import { describe, expect, it } from "vitest";

import { BaseBuilder } from "../../src/integrations/obsidian-bases/builder";
import { Filter } from "../../src/integrations/obsidian-bases/filter";

describe("BaseBuilder", () => {
	it("builds a minimal definition with one view", () => {
		const def = BaseBuilder.create().addView({ type: "table", name: "All" }).build();

		expect(def.views).toHaveLength(1);
		expect(def.views[0].type).toBe("table");
		expect(def.views[0].name).toBe("All");
		expect(def.filter).toBeUndefined();
		expect(def.formulas).toBeUndefined();
	});

	it("throws when no views are added", () => {
		expect(() => BaseBuilder.create().build()).toThrow("at least one view");
	});

	it("builds a full definition with all sections", () => {
		interface TaskFields {
			Status: string;
			Priority: number;
			Goal: string;
		}

		const def = BaseBuilder.create<TaskFields>()
			.filter(Filter.and(Filter.inFolder("Tasks"), Filter.selfLink("Goal")))
			.formula("Days Remaining", 'date(note["End Date"]).relative()')
			.property("formula.Days Remaining", "Days Left")
			.summary("avg", "values.mean()")
			.addView({
				type: "table",
				name: "Active",
				filter: Filter.eq("Status", "Active"),
				order: ["file.name", "Status", "Priority", "formula.Days Remaining"],
				sort: [{ property: "Priority", direction: "DESC" }],
				columnSize: { "note.Status": 150 },
			})
			.build();

		expect(def.filter?.type).toBe("group");
		expect(def.formulas).toHaveLength(1);
		expect(def.formulas![0].name).toBe("Days Remaining");
		expect(def.properties).toHaveLength(1);
		expect(def.summaries).toEqual({ avg: "values.mean()" });
		expect(def.views).toHaveLength(1);
		expect(def.views[0].sort![0].direction).toBe("DESC");
	});

	it("supports multiple views", () => {
		const def = BaseBuilder.create()
			.addView({ type: "table", name: "View A" })
			.addView({ type: "board", name: "View B" })
			.addView({ type: "gallery", name: "View C" })
			.build();

		expect(def.views).toHaveLength(3);
		expect(def.views.map((v) => v.name)).toEqual(["View A", "View B", "View C"]);
	});

	it("supports bulk formula addition", () => {
		const def = BaseBuilder.create()
			.formulas([
				{ name: "A", expression: "1 + 1" },
				{ name: "B", expression: "2 + 2" },
			])
			.addView({ type: "table" })
			.build();

		expect(def.formulas).toHaveLength(2);
	});
});
