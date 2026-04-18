import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

// Color rules live under `colorRules: ColorRule[]` on the calendar settings
// and are evaluated by `colorEvaluator` at event-render time. The matched
// color is written as inline `background-color` on the FullCalendar tile.
// Seeding the rule via the settings store (mirroring filter-presets.spec)
// keeps the spec focused on the runtime colour-evaluation path rather than
// the Rules settings-tab UI — which has its own much larger click surface.

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

		await calendar.createEvent({
			title: "Urgent Ticket",
			start: todayStamp(9, 0),
			end: todayStamp(10, 0),
			categories: ["Urgent"],
		});

		const tile = calendar.page.locator(`${sel(TID.block)}[data-event-title="Urgent Ticket"]`).first();
		await expect(tile).toBeVisible();

		// `applyEventMountStyling` writes the resolved colour onto the tile as
		// the `--event-color` CSS variable. We read it back with getPropertyValue
		// because the raw value is what the evaluator emitted (e.g. `#ff00aa`).
		await expect
			.poll(async () => tile.evaluate((el) => (el as HTMLElement).style.getPropertyValue("--event-color").trim()))
			.toBe(RULE_COLOR);
	});
});
