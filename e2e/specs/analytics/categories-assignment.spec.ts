import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Categories are assigned via the shared assignment modal, stamped with
// `prisma-assign-item` + `data-assign-name` rows. The DSL's `createEvent`
// accepts `categories` and drives the full flow including the "Create new"
// fallback when a category doesn't exist yet. This spec asserts the
// frontmatter side-effect (the value lands on disk under the configured
// category property), that the tile still renders after assignment, and
// that the matching colour rule paints the tile — i.e. the full create →
// indexer → VaultTable → EventStore → render chain lights up under a
// real category pick.

const RULE_COLOR = "#7744ff";

test.describe("categories assignment", () => {
	test("assigns a category via the picker, persists it in frontmatter, and paints the tile via a matching colour rule", async ({
		calendar,
	}) => {
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{
					id: "rule-work",
					expression: "Category.includes('Work')",
					color: RULE_COLOR,
					enabled: true,
				},
			],
		});

		const evt = await calendar.createEvent({
			title: "Categorised Task",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Work"],
		});
		await evt.expectVisible();

		expect(evt.readCategory()).toEqual(["Work"]);
		await evt.expectColor(RULE_COLOR);
	});
});
