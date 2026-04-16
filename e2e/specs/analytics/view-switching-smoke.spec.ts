import { test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, switchToGroupChild, switchView } from "../../fixtures/helpers";

// Rapidly cycle every analytics tab a few times — catches teardown/re-render
// regressions (leaks, stale subs, null-deref in cleanup paths). The electron
// fixture fails the test if any renderer console.error or pageerror fires
// during the run, so the assertion is implicit.
//
// `dashboard` is a group tab (children: by-name / by-category / recurring),
// so we drill into the first child instead of clicking the parent (which
// would just leave the dropdown open).
const LEAF_TABS = [
	"calendar",
	"timeline",
	"daily-stats",
	"dual-daily",
	"heatmap-monthly-stats",
	"heatmap",
	"gantt",
] as const;

test.describe("analytics: view switching smoke", () => {
	test("cycling all tabs 3× raises no renderer errors", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);

		for (let i = 0; i < 3; i++) {
			for (const tab of LEAF_TABS) {
				await switchView(obsidian.page, tab);
			}
			await switchToGroupChild(obsidian.page, "dashboard", "dashboard-by-name");
		}
	});
});
