import { test } from "../../fixtures/electron";
import type { ViewTabKey } from "../../fixtures/testids";

// Rapidly cycle every analytics tab a few times — catches teardown/re-render
// regressions (leaks, stale subs, null-deref in cleanup paths). The electron
// fixture fails the test if any renderer console.error or pageerror fires
// during the run, so the assertion is implicit.
//
// `dashboard` is a group tab (children: by-name / by-category / recurring),
// so we drill into the first child instead of clicking the parent (which
// would just leave the dropdown open).
const LEAF_TABS: ReadonlyArray<ViewTabKey> = [
	"calendar",
	"timeline",
	"daily-stats",
	"dual-daily",
	"heatmap-monthly-stats",
	"heatmap",
	"gantt",
];

test.describe("analytics: view switching smoke", () => {
	test("cycling all tabs 3× raises no renderer errors", async ({ calendar }) => {
		for (let i = 0; i < 3; i++) {
			for (const tab of LEAF_TABS) await calendar.switchView(tab);
			await calendar.switchToGroupChild("dashboard", "dashboard-by-name");
		}
	});
});
