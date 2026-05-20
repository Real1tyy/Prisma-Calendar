import { todayISO } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Phase-1 coverage from docs/specs/e2e-events-modal-coverage.md.
// Pins the EventsModal's Recurring-tab controls (type filter, show-disabled
// toggle, auto-flip, disable round-trip) and the cross-tab search/sort/default
// behaviour. Every assertion is precise — counts, frontmatter, button labels —
// because the modal's job is to mirror disk state truthfully.
//
// Each test seeds its own recurring sources from scratch via
// `calendar.createEvent({recurring})` so the recurringEventManager is
// populated through the real path — no shortcuts that bypass the
// production indexer + generator pipeline.

const DEFAULT_FUTURE_INSTANCES = 2;

test.describe("events modal — Recurring-tab controls", () => {
	test("type filter narrows the visible rows to the chosen recurrence preset", async ({ calendar }) => {
		const today = todayISO();

		const daily = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await daily.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const weekly = await calendar.createEvent({
			title: "Weekly Review",
			start: `${today}T10:00`,
			end: `${today}T11:00`,
			recurring: { rruleType: "weekly" },
		});
		await weekly.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		const events = await calendar.openEventsModal();
		await events.expectTabActive("recurring", "Recurring (2)");
		await events.expectGroupCountText("2 events");
		await expect(events.listRows()).toHaveCount(2);

		// daily-only — Weekly Review must drop out.
		await events.setRecurringTypeFilter("daily");
		await events.expectGroupCountText("1 of 2 events");
		await expect(events.listRows()).toHaveCount(1);
		await events.recurringRow("Daily Standup").expectType("daily");
		await expect(events.recurringRow("Weekly Review").row).toHaveCount(0);

		// weekly-only — flip again, opposite expectation.
		await events.setRecurringTypeFilter("weekly");
		await events.expectGroupCountText("1 of 2 events");
		await expect(events.listRows()).toHaveCount(1);
		await events.recurringRow("Weekly Review").expectType("weekly");
		await expect(events.recurringRow("Daily Standup").row).toHaveCount(0);

		// Reset shows both again.
		await events.setRecurringTypeFilter("all");
		await events.expectGroupCountText("2 events");
		await expect(events.listRows()).toHaveCount(2);
	});

	test("show-disabled toggle is hidden until a row is disabled, then flips the active pool", async ({ calendar }) => {
		const today = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${today}T09:00`,
			end: `${today}T09:30`,
			recurring: { rruleType: "daily" },
		});
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		// No disabled events yet — toggle should not be in the DOM.
		const initial = await calendar.openEventsModal();
		expect(await initial.hasShowDisabledOnlyToggle()).toBe(false);

		// Disable the only row via its own action button. The pool should empty out
		// because there are no enabled rows left, and the modal auto-flips to the
		// disabled view (RecurringEventsModalPanel's effect, not a manual click).
		const row = initial.recurringRow("Daily Standup");
		await row.expectBadgeLabel("Daily");
		await row.expectInstanceCountText(DEFAULT_FUTURE_INSTANCES);
		await row.clickToggle();

		// Disk-truth: the disable button stamps Skip=true on the source frontmatter.
		await evt.expectFrontmatter("Skip", (v) => v === true, "expected source Skip=true after Disable");

		// Toggle now exists, and we're already viewing the disabled pool — the
		// auto-flip kicks in because the enabled pool is empty.
		await expect.poll(() => initial.hasShowDisabledOnlyToggle()).toBe(true);
		await initial.expectGroupCountText("1 event");
		await expect(initial.listRows()).toHaveCount(1);
		await initial.recurringRow("Daily Standup").expectBadgeLabel("Daily");

		// Re-enable from the disabled view; pool flips back to 0 disabled, 1 enabled.
		await initial.recurringRow("Daily Standup").clickToggle();
		await evt.expectFrontmatter("Skip", (v) => v !== true, "expected source Skip cleared after Enable");
		await expect.poll(() => initial.hasShowDisabledOnlyToggle()).toBe(false);
		await initial.expectGroupCountText("1 event");
		await expect(initial.listRows()).toHaveCount(1);
	});

	test("default tab is byCategory when there are no recurring events", async ({ calendar }) => {
		const today = todayISO();

		// Two distinct categories so byCategory has data; no recurring sources.
		await calendar.seedAndStabilize([
			{
				title: "Team Meeting",
				startDate: `${today}T09:00`,
				endDate: `${today}T10:00`,
				category: "Work",
			},
			{
				title: "Workout",
				startDate: `${today}T12:00`,
				endDate: `${today}T13:00`,
				category: "Fitness",
			},
		]);

		const events = await calendar.openEventsModal();
		await events.expectTabActive("byCategory");
		await events.expectGroupCountText("2 category groups");
	});

	test("search filters group items in the active tab", async ({ calendar }) => {
		const today = todayISO();

		await calendar.seedAndStabilize([
			{ title: "Alpha Standup", startDate: `${today}T09:00`, endDate: `${today}T10:00`, category: "Work" },
			{ title: "Beta Review", startDate: `${today}T10:00`, endDate: `${today}T11:00`, category: "Work" },
			{ title: "Gamma Session", startDate: `${today}T11:00`, endDate: `${today}T12:00`, category: "Personal" },
		]);

		const events = await calendar.openEventsModal();
		await events.switchTab("byCategory");
		await events.expectGroupCountText("2 category groups");
		await expect(events.groupItems()).toHaveCount(2);

		// "work" matches Work, drops Personal.
		await events.search("work");
		await expect(events.groupItems()).toHaveCount(1);
		await expect(events.groupItem("Work")).toBeVisible();

		// "zzz" matches nothing → empty state, count chip drops to 0 of 2.
		await events.search("zzz");
		await expect(events.groupItems()).toHaveCount(0);

		// Clearing brings everything back.
		await events.search("");
		await expect(events.groupItems()).toHaveCount(2);
	});
});
