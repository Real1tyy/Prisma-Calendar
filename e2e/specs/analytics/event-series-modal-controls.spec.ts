import { test } from "../../fixtures/electron";
import { type SeedEventInput } from "../../fixtures/seed-events";

// Phase-2 coverage from docs/specs/e2e-events-modal-coverage.md.
// Pins the EventSeriesModal's interaction surface — Hide-past / Hide-skipped
// toggles, search input, stats line, past/skipped row classes, and the
// recurring tab's "extra info" banner. Each test seeds a deterministic event
// set so the assertions stay exact regardless of when the suite runs.
//
// Past-vs-future is anchored to fixed ISO timestamps far enough from today
// (>30 days each direction) that test-runner clock drift can't flip the
// classification mid-run.

const FAR_PAST_DATE_A = "2020-01-15";
const FAR_PAST_DATE_B = "2020-02-20";
const FAR_FUTURE_DATE_A = "2099-06-10";
const FAR_FUTURE_DATE_B = "2099-07-15";

function timed(date: string, hour: number): string {
	return `${date}T${String(hour).padStart(2, "0")}:00`;
}

test.describe("event series modal — controls (hide past, hide skipped, search, stats)", () => {
	test.beforeEach(async ({ calendar }) => {
		// 4 events under the same category: 2 past + 2 future, with one
		// skipped past instance. This pins:
		//   - Total: 4
		//   - Past: 2
		//   - Skipped: 1 (one of the past events)
		//   - Hide past → 2 future rows visible
		//   - Hide skipped → 3 non-skipped rows visible
		//   - Hide both → 2 rows (future, non-skipped)
		const events: SeedEventInput[] = [
			{
				title: "Alpha Past",
				startDate: timed(FAR_PAST_DATE_A, 9),
				endDate: timed(FAR_PAST_DATE_A, 10),
				category: "Work",
				extra: { Skip: true },
			},
			{
				title: "Beta Past",
				startDate: timed(FAR_PAST_DATE_B, 9),
				endDate: timed(FAR_PAST_DATE_B, 10),
				category: "Work",
			},
			{
				title: "Gamma Future",
				startDate: timed(FAR_FUTURE_DATE_A, 9),
				endDate: timed(FAR_FUTURE_DATE_A, 10),
				category: "Work",
			},
			{
				title: "Delta Future",
				startDate: timed(FAR_FUTURE_DATE_B, 9),
				endDate: timed(FAR_FUTURE_DATE_B, 10),
				category: "Work",
			},
		];
		await calendar.seedAndStabilize(events);
	});

	test("stats line reports Total / Past / Skipped accurately", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		await series.expectRowCount(4);
		await series.expectStats({ total: 4, past: 2, skipped: 1 });
	});

	test("past instances render with the past class; skipped instances with the skipped class", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		// Default sort is desc — newest first. Use rowByDate for stable lookups.
		await series.rowByDate(FAR_PAST_DATE_A).expectPast(true);
		await series.rowByDate(FAR_PAST_DATE_A).expectSkipped(true);

		await series.rowByDate(FAR_PAST_DATE_B).expectPast(true);
		await series.rowByDate(FAR_PAST_DATE_B).expectSkipped(false);

		await series.rowByDate(FAR_FUTURE_DATE_A).expectPast(false);
		await series.rowByDate(FAR_FUTURE_DATE_A).expectSkipped(false);

		await series.rowByDate(FAR_FUTURE_DATE_B).expectPast(false);
		await series.rowByDate(FAR_FUTURE_DATE_B).expectSkipped(false);
	});

	test("hide-past toggle drops past rows and keeps stats accurate", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		await series.expectRowCount(4);
		await series.toggleHidePast();
		await series.expectRowCount(2);

		// Only the two future dates remain, in ascending order (hidePast flips sort to asc).
		await series.rowByDate(FAR_FUTURE_DATE_A).expectPast(false);
		await series.rowByDate(FAR_FUTURE_DATE_B).expectPast(false);
		await series.expectRowAbsent(FAR_PAST_DATE_A);
		await series.expectRowAbsent(FAR_PAST_DATE_B);

		// Stats line is computed pre-filter, so Past stays at 2.
		await series.expectStats({ total: 4, past: 2, skipped: 1 });
	});

	test("hide-skipped toggle drops skipped rows", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		await series.toggleHideSkipped();
		await series.expectRowCount(3);

		// Alpha Past was the skipped one — must be gone; Beta Past stays.
		await series.expectRowAbsent(FAR_PAST_DATE_A);
		await series.rowByDate(FAR_PAST_DATE_B).expectSkipped(false);
	});

	test("hide-past + hide-skipped together leave only future, non-skipped rows", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		await series.toggleHidePast();
		await series.toggleHideSkipped();
		await series.expectRowCount(2);

		// Both past dates gone (one past + one past-skipped); both future dates remain.
		await series.expectRowAbsent(FAR_PAST_DATE_A);
		await series.expectRowAbsent(FAR_PAST_DATE_B);
		await series.rowByDate(FAR_FUTURE_DATE_A).expectPast(false);
		await series.rowByDate(FAR_FUTURE_DATE_B).expectPast(false);
	});

	test("search filters series rows by title", async ({ calendar }) => {
		const events = await calendar.openEventsModal();
		await events.switchTab("by-category");
		const series = await events.drillInto("Work");

		await series.expectRowCount(4);

		// Match exactly one — "alpha" only hits Alpha Past.
		await series.search("alpha");
		await series.expectRowCount(1);
		await series.rowByDate(FAR_PAST_DATE_A).expectTitle("Alpha Past");

		// Match a different one — "future" hits both Gamma + Delta titles.
		await series.search("future");
		await series.expectRowCount(2);

		// Empty restores the full list.
		await series.search("");
		await series.expectRowCount(4);
	});
});
