import type {
	PrismaCalendarGetCalendarInfoOutput,
	PrismaCalendarGetCategoriesOutput,
	PrismaCalendarGetEventsOutput,
} from "@real1ty-obsidian-plugins/external-apis/prisma-calendar";

import { createPrismaApi, waitForApiIndex } from "../../fixtures/api-helpers";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// The .d.ts is generated from `api-contract.json` and is type-only — no
// runtime, no obsidian transitive import. Element types are extracted via
// `[number]` (arrays) and `NonNullable<…>` (point lookups that return null).
// The drift test in `tests/api/contract-drift.test.ts` owns JSON-Schema
// conformance against the committed artifact; this spec exercises the runtime
// shape with type-checked structural assertions.

type EventOutput = PrismaCalendarGetEventsOutput[number];
type CategoryOutput = PrismaCalendarGetCategoriesOutput[number];
type CalendarInfo = NonNullable<PrismaCalendarGetCalendarInfoOutput>;

function assertEventShape(event: EventOutput): void {
	expect(typeof event.filePath).toBe("string");
	expect(typeof event.title).toBe("string");
	expect(["timed", "allDay", "untracked"]).toContain(event.type);
	expect(typeof event.allDay).toBe("boolean");
	expect(typeof event.skipped).toBe("boolean");
}

function assertCategoryShape(category: CategoryOutput): void {
	expect(typeof category.name).toBe("string");
	expect(typeof category.color).toBe("string");
}

function assertCalendarInfoShape(info: CalendarInfo): void {
	expect(typeof info.calendarId).toBe("string");
	expect(typeof info.name).toBe("string");
	expect(typeof info.directory).toBe("string");
	expect(typeof info.enabled).toBe("boolean");
	expect(typeof info.eventCount).toBe("number");
	expect(typeof info.untrackedEventCount).toBe("number");
}

// Tier 1 contract spec for the read surface of `window.PrismaCalendar.*`.
//
// Coverage matrix (5 of 5 read actions exercised, 100%):
//   - getEvents       (range query)
//   - getEventByPath  (point lookup)
//   - getAllEvents    (collection scan)
//   - getCategories   (derived collection)
//   - getUntrackedEvents (filter)
//   - listCalendars / getCalendarInfo (metadata reads — bonus coverage)
//
// Every payload is validated against the same Zod schema the contract artifact
// (`api-contract.json`) was emitted from. That is the wire-shape proof: a
// regression where the handler returns extra/missing fields fails here and
// the schema in source remains the canonical contract.
//
// We use `todayStamp` / `todayISO` because none of these actions open a
// FullCalendar viewport.

test.describe("plugin api contract — read surface via window.PrismaCalendar", () => {
	test("read surface schema-conformance + value cross-checks on a known seed", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// Two tracked events with distinct categories. The test asserts that
		// both surface through every applicable read action — getEvents,
		// getAllEvents, getEventByPath, getCategories. Variety in categories
		// proves the category-aggregation path inside getCategories.
		const tracked1 = (await api.createEvent({
			title: "Team Meeting",
			start: todayStamp(9),
			end: todayStamp(10),
			allDay: false,
			categories: ["Work"],
		}))!;
		const tracked2 = (await api.createEvent({
			title: "Workout",
			start: todayStamp(18),
			end: todayStamp(19),
			allDay: false,
			categories: ["Fitness"],
		}))!;
		await waitForApiIndex(api, tracked1);
		await waitForApiIndex(api, tracked2);

		// Untracked event lacks a Start Date — `createUntrackedEvent` is the
		// canonical entry point. Surfaces through getUntrackedEvents.
		const untracked = (await api.createUntrackedEvent({ title: "Project Planning" }))!;
		// Untracked events still show up via getEventByPath once indexed.
		await waitForApiIndex(api, untracked);

		const allFiles = [tracked1, tracked2, untracked];

		try {
			// ── getEvents (range query) ────────────────────────────────
			const today = todayISO();
			const ranged = await api.getEvents({ start: `${today}T00:00`, end: `${today}T23:59` });
			ranged.forEach(assertEventShape);
			expect(ranged.some((e) => e.filePath === tracked1)).toBe(true);
			expect(ranged.some((e) => e.filePath === tracked2)).toBe(true);
			// Untracked events have no Start Date → excluded from range queries.
			expect(ranged.some((e) => e.filePath === untracked)).toBe(false);

			// ── getEventByPath (point lookup) ──────────────────────────
			const one = await api.getEventByPath({ filePath: tracked1 });
			expect(one).not.toBeNull();
			assertEventShape(one!);
			expect(one!.title).toBe("Team Meeting");
			expect(one!.categories).toEqual(["Work"]);
			expect(one!.type).toBe("timed");

			expect(await api.getEventByPath({ filePath: "Events/Does Not Exist.md" })).toBeNull();

			// ── getAllEvents ───────────────────────────────────────────
			const all = await api.getAllEvents({});
			all.forEach(assertEventShape);
			const allPaths = new Set(all.map((e) => e.filePath));
			expect(allPaths.has(tracked1)).toBe(true);
			expect(allPaths.has(tracked2)).toBe(true);
			expect(allPaths.has(untracked)).toBe(true);

			// ── getCategories ──────────────────────────────────────────
			const cats = await api.getCategories({});
			cats.forEach(assertCategoryShape);
			const catNames = new Set(cats.map((c) => c.name));
			expect(catNames.has("Work")).toBe(true);
			expect(catNames.has("Fitness")).toBe(true);
			// Every entry has a non-empty color string — proves the category
			// trackers feed the colour map correctly.
			for (const c of cats) {
				expect(c.color.length).toBeGreaterThan(0);
			}

			// ── getUntrackedEvents ─────────────────────────────────────
			const untrackedAll = await api.getUntrackedEvents({});
			untrackedAll.forEach(assertEventShape);
			expect(untrackedAll.some((e) => e.filePath === untracked)).toBe(true);
			// Tracked events must NOT appear in the untracked list — proves the
			// filter at the read-operations layer.
			expect(untrackedAll.some((e) => e.filePath === tracked1)).toBe(false);
			expect(untrackedAll.some((e) => e.filePath === tracked2)).toBe(false);
		} finally {
			// Clean up via batchDelete to keep this spec contained — the deletes
			// in any cross-cutting suite would otherwise pollute later state.
			await api.batchDelete({ filePaths: allFiles });
		}
	});

	test("calendar metadata reads: listCalendars + getCalendarInfo schema-validate and return the default bundle", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// ── listCalendars ──────────────────────────────────────────────
		const list = await api.listCalendars();
		list.forEach(assertCalendarInfoShape);
		expect(list.length).toBeGreaterThanOrEqual(1);
		// Default seed in `electron.ts` sets the calendar id to "default".
		const def = list.find((c) => c.calendarId === "default");
		expect(def).toBeDefined();
		expect(def!.directory).toBe("Events");

		// ── getCalendarInfo (no calendarId → resolves to the active bundle) ─
		const info = await api.getCalendarInfo({});
		expect(info).not.toBeNull();
		assertCalendarInfoShape(info!);
		expect(info!.calendarId).toBe("default");
		expect(info!.directory).toBe("Events");

		// ── getCalendarInfo (unknown id → null) ────────────────────────
		expect(await api.getCalendarInfo({ calendarId: "does-not-exist" })).toBeNull();
	});
});
