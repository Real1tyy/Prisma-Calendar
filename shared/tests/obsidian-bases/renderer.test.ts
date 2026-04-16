import { describe, expect, it } from "vitest";

import { BaseBuilder } from "../../src/integrations/obsidian-bases/builder";
import { Filter } from "../../src/integrations/obsidian-bases/filter";
import { BasePresets } from "../../src/integrations/obsidian-bases/presets";
import { BaseRenderer } from "../../src/integrations/obsidian-bases/renderer";

describe("BaseRenderer", () => {
	describe("leaf expression rendering", () => {
		it("renders note comparison with string value", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.eq("Status", "In Progress"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Status"] == "In Progress"');
		});

		it("renders note comparison with boolean value", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.neq("Archived", true),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Archived"] != true');
		});

		it("renders note comparison with numeric value", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.gte("Priority", 5),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Priority"] >= 5');
		});

		it("renders noteContains", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.contains("Category", "Work"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Category"].contains("Work")');
		});

		it("renders noteSelfLink", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.selfLink("Goal"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Goal"].contains(this.file.asLink())');
		});

		it("renders reverseContains", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.reverseContains("Children"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('this["Children"].contains(file)');
		});

		it("renders file.inFolder", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.inFolder("Tasks"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('file.inFolder("Tasks")');
		});

		it("renders file.hasTag with multiple args", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.hasTag("work", "important"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('file.hasTag("work", "important")');
		});

		it("renders file.path comparison", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.filePath("People/Alice.md"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('file.path == "People/Alice.md"');
		});

		it("renders link comparison with display name", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.eqLink("Parent", "Periodic/Weekly/2026-W11", "2026-W11"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Parent"] == ["[[Periodic/Weekly/2026-W11|2026-W11]]"]');
		});

		it("renders link comparison without display name", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.eqLink("Parent", "Periodic/Weekly/2026-W11"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Parent"] == ["[[Periodic/Weekly/2026-W11]]"]');
		});

		it("renders neqLink comparison", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.neqLink("Parent", "Periodic/Monthly/2026-03", "March 2026"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Parent"] != ["[[Periodic/Monthly/2026-03|March 2026]]"]');
		});

		it("renders raw expression", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.raw("custom.expression()"),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("custom.expression()");
		});

		it("escapes double quotes in string values", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					filter: Filter.eq("Title", 'Say "Hello"'),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('note["Title"] == "Say \\"Hello\\""');
		});
	});

	describe("filter group rendering", () => {
		it("renders top-level and filter", () => {
			const def = BaseBuilder.create()
				.filter(Filter.and(Filter.inFolder("Tasks"), Filter.eq("Status", "Active")))
				.addView({ type: "table" })
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"filters:",
					"  and:",
					'    - file.inFolder("Tasks")',
					'    - note["Status"] == "Active"',
					"views:",
					"  - type: table",
				].join("\n")
			);
		});

		it("renders top-level or filter", () => {
			const def = BaseBuilder.create()
				.filter(Filter.or(Filter.filePath("a.md"), Filter.filePath("b.md")))
				.addView({ type: "table" })
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("  or:");
			expect(output).toContain('    - file.path == "a.md"');
			expect(output).toContain('    - file.path == "b.md"');
		});

		it("renders nested groups", () => {
			const def = BaseBuilder.create()
				.filter(Filter.or(Filter.hasTag("tag"), Filter.and(Filter.hasTag("book"), Filter.hasLink("Textbook"))))
				.addView({ type: "table" })
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"filters:",
					"  or:",
					'    - file.hasTag("tag")',
					"    - and:",
					'        - file.hasTag("book")',
					'        - file.hasLink("Textbook")',
					"views:",
					"  - type: table",
				].join("\n")
			);
		});

		it("renders view-level filter with correct indentation", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "Active",
					filter: Filter.and(Filter.eq("Status", "Active"), Filter.neq("Archived", true)),
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"views:",
					"  - type: table",
					"    name: Active",
					"    filters:",
					"      and:",
					'        - note["Status"] == "Active"',
					'        - note["Archived"] != true',
				].join("\n")
			);
		});
	});

	describe("formulas rendering", () => {
		it("renders inline formula", () => {
			const def = BaseBuilder.create().formula("ppu", "(price / age).toFixed(2)").addView({ type: "table" }).build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("formulas:");
			expect(output).toContain("  ppu: '(price / age).toFixed(2)'");
		});

		it("renders multiline formula with block scalar", () => {
			const def = BaseBuilder.create().formula("complex", "line1\nline2").addView({ type: "table" }).build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("  complex: |-");
			expect(output).toContain("    line1");
			expect(output).toContain("    line2");
		});
	});

	describe("properties rendering", () => {
		it("renders properties with displayName", () => {
			const def = BaseBuilder.create()
				.property("status", "Status")
				.property("formula.formatted_price", "Price")
				.addView({ type: "table" })
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("properties:");
			expect(output).toContain("  status:");
			expect(output).toContain("    displayName: Status");
			expect(output).toContain("  formula.formatted_price:");
			expect(output).toContain("    displayName: Price");
		});
	});

	describe("view rendering", () => {
		it("renders order section", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					order: ["file.name", "note.Status", "formula.Days Remaining"],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    order:");
			expect(output).toContain("      - file.name");
			expect(output).toContain("      - note.Status");
			expect(output).toContain("      - formula.Days Remaining");
		});

		it("renders sort section", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					sort: [
						{ property: "Priority", direction: "DESC" },
						{ property: "file.name", direction: "ASC" },
					],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    sort:");
			expect(output).toContain("      - property: Priority");
			expect(output).toContain("        direction: DESC");
			expect(output).toContain("      - property: file.name");
			expect(output).toContain("        direction: ASC");
		});

		it("renders columnSize section", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					columnSize: { "note.Title": 300, "note.Date": 170 },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    columnSize:");
			expect(output).toContain("      note.Title: 300");
			expect(output).toContain("      note.Date: 170");
		});

		it("renders groupBy section", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					groupBy: { property: "note.age", direction: "DESC" },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    groupBy:");
			expect(output).toContain("      property: note.age");
			expect(output).toContain("      direction: DESC");
		});

		it("renders limit", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					limit: 10,
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    limit: 10");
		});

		it("renders view-level summaries", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					summaries: { "formula.ppu": "Average" },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain("    summaries:");
			expect(output).toContain("      formula.ppu: 'Average'");
		});
	});

	describe("renderCodeBlock", () => {
		it("wraps output in base code block", () => {
			const def = BaseBuilder.create().addView({ type: "table", name: "All" }).build();

			const output = BaseRenderer.renderCodeBlock(def);
			expect(output.startsWith("```base\n")).toBe(true);
			expect(output.endsWith("\n```")).toBe(true);
		});
	});

	describe("real-world scenarios", () => {
		it("matches PeopleManager output", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "People",
					filter: Filter.inFolder("People"),
					order: [
						"file.name",
						"note.Segment",
						"note.City",
						"note.Original City",
						"note.Born On",
						"note.First Contact",
						"note.Contact Channel",
						"note.Status",
					],
					sort: [{ property: "file.name", direction: "ASC" }],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"views:",
					"  - type: table",
					"    name: People",
					"    filters:",
					'      - file.inFolder("People")',
					"    order:",
					"      - file.name",
					"      - note.Segment",
					"      - note.City",
					"      - note.Original City",
					"      - note.Born On",
					"      - note.First Contact",
					"      - note.Contact Channel",
					"      - note.Status",
					"    sort:",
					"      - property: file.name",
					"        direction: ASC",
				].join("\n")
			);
		});

		it("matches Periodix-Planner output", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "Weekly Tasks",
					filter: Filter.and(
						Filter.inFolder("Tasks"),
						Filter.gt("Sort Date", "2026-03-09"),
						Filter.lt("Sort Date", "2026-03-15")
					),
					order: ["file.name", "Sort Date", "Category", "Goal", "Status"],
					sort: [{ property: "Sort Date", direction: "DESC" }],
					columnSize: { "note.Sort Date": 150 },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"views:",
					"  - type: table",
					"    name: Weekly Tasks",
					"    filters:",
					"      and:",
					'        - file.inFolder("Tasks")',
					'        - note["Sort Date"] > "2026-03-09"',
					'        - note["Sort Date"] < "2026-03-15"',
					"    order:",
					"      - file.name",
					"      - Sort Date",
					"      - Category",
					"      - Goal",
					"      - Status",
					"    sort:",
					"      - property: Sort Date",
					"        direction: DESC",
					"    columnSize:",
					"      note.Sort Date: 150",
				].join("\n")
			);
		});

		it("matches Fusion-Goals output with top-level filters and formulas", () => {
			const def = BaseBuilder.create()
				.filter(Filter.and(Filter.selfLink("Goal"), Filter.inFolder("Tasks")))
				.formula(
					"Days Remaining",
					'date(if(note["End Date"].toString().contains("T"),note["End Date"].slice(0, 19).replace("T", " "),note["End Date"])).relative()'
				)
				.addView({
					type: "table",
					name: "In Progress",
					filter: Filter.and(Filter.eq("Status", "In Progress"), Filter.neq("Archived", true)),
					order: ["file.name", "Status", "formula.Days Remaining"],
					sort: [{ property: "Status", direction: "DESC" }],
					columnSize: { "note.Title": 300 },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"filters:",
					"  and:",
					'    - note["Goal"].contains(this.file.asLink())',
					'    - file.inFolder("Tasks")',
					"formulas:",
					`  Days Remaining: '${[
						'date(if(note["End Date"].toString().contains("T"),',
						'note["End Date"].slice(0, 19).replace("T", " "),',
						'note["End Date"])).relative()',
					].join("")}'`,
					"views:",
					"  - type: table",
					"    name: In Progress",
					"    filters:",
					"      and:",
					'        - note["Status"] == "In Progress"',
					'        - note["Archived"] != true',
					"    order:",
					"      - file.name",
					"      - Status",
					"      - formula.Days Remaining",
					"    sort:",
					"      - property: Status",
					"        direction: DESC",
					"    columnSize:",
					"      note.Title: 300",
				].join("\n")
			);
		});

		it("matches Nexus-Properties file path list output", () => {
			const paths = ["People/Alice.md", "People/Bob.md", "People/Charlie.md"];

			const def = BaseBuilder.create()
				.filter(BasePresets.filePathList(paths))
				.addView({
					type: "table",
					name: "All Children (3)",
					filter: Filter.and(Filter.neq("Archived", true)),
					order: ["file.name", "Status", "Category"],
					sort: [{ property: "file.name", direction: "ASC" }],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"filters:",
					"  or:",
					'    - file.path == "People/Alice.md"',
					'    - file.path == "People/Bob.md"',
					'    - file.path == "People/Charlie.md"',
					"views:",
					"  - type: table",
					"    name: All Children (3)",
					"    filters:",
					"      and:",
					'        - note["Archived"] != true',
					"    order:",
					"      - file.name",
					"      - Status",
					"      - Category",
					"    sort:",
					"      - property: file.name",
					"        direction: ASC",
				].join("\n")
			);
		});

		it("matches Nexus-Properties reverse contains output", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "Children",
					filter: Filter.reverseContains("Children"),
					order: ["file.name", "Status"],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('this["Children"].contains(file)');
		});

		it("matches Prisma-Calendar category modal output", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "Work",
					filter: Filter.and(Filter.inFolder("Events"), Filter.contains("Category", "Work")),
					order: ["file.name", "Date", "Category", "Status"],
					sort: [{ property: "Date", direction: "DESC" }],
					columnSize: { "note.Date": 170 },
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"views:",
					"  - type: table",
					"    name: Work",
					"    filters:",
					"      and:",
					'        - file.inFolder("Events")',
					'        - note["Category"].contains("Work")',
					"    order:",
					"      - file.name",
					"      - Date",
					"      - Category",
					"      - Status",
					"    sort:",
					"      - property: Date",
					"        direction: DESC",
					"    columnSize:",
					"      note.Date: 170",
				].join("\n")
			);
		});

		it("matches Periodix-Planner hierarchy filter output", () => {
			const def = BaseBuilder.create()
				.addView({
					type: "table",
					name: "Weekly Tasks",
					filter: Filter.and(
						Filter.or(Filter.inFolder("Periodic/Daily")),
						Filter.eqLink("Week", "Periodic/Weekly/2026-W11", "2026-W11")
					),
					order: ["file.name", "Status"],
				})
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toBe(
				[
					"views:",
					"  - type: table",
					"    name: Weekly Tasks",
					"    filters:",
					"      and:",
					"        - or:",
					'            - file.inFolder("Periodic/Daily")',
					'        - note["Week"] == ["[[Periodic/Weekly/2026-W11|2026-W11]]"]',
					"    order:",
					"      - file.name",
					"      - Status",
				].join("\n")
			);
		});

		it("handles empty file path list (no results)", () => {
			const def = BaseBuilder.create()
				.filter(BasePresets.filePathList([]))
				.addView({ type: "table", name: "Empty" })
				.build();

			const output = BaseRenderer.render(def);
			expect(output).toContain('file.path == ""');
		});
	});
});
