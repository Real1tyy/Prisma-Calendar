import { todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";

// Color rules live under `colorRules: ColorRule[]` on the calendar settings
// and are evaluated by `colorEvaluator` at event-render time. The matched
// colour surfaces on each tile as the `--event-color` CSS variable written
// by `applyEventMountStyling`. Seeding the rule via the settings store (not
// the Rules settings-tab UI) keeps the spec focused on the runtime colour-
// evaluation path. The read lives on the EventHandle so every colour-aware
// spec goes through the same DSL method.

const RULE_COLOR = "#ff00aa";

test.describe("color rules", () => {
	test("a color rule with a matching expression applies its colour to the event tile", async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{
					id: "rule-urgent",
					expression: "Category === 'Urgent'",
					color: RULE_COLOR,
					enabled: true,
				},
			],
		});

		const evt = await calendar.createEvent({
			title: "Urgent Ticket",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Urgent"],
		});
		await evt.expectVisible();
		await evt.expectColor(RULE_COLOR);
	});
});
