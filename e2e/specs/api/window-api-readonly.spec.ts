import { type Invoker, pageEvaluateInvoker } from "@real1ty-obsidian-plugins/testing/api-contract";

import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Schemas live in `src/core/api/types.ts`. Importing them at runtime here
// would transitively load `obsidian` (via `SingleCalendarConfigSchema`), which
// Playwright's Node runner can't resolve. The drift test in
// `tests/api/contract-drift.test.ts` owns JSON-Schema conformance against the
// committed artifact; this spec asserts the load-bearing fields exist and
// carry the right types/values.

interface EventOutput {
	filePath: string;
	title: string;
	type: "timed" | "allDay" | "untracked";
	allDay: boolean;
	skipped: boolean;
	virtualKind: string;
	start?: string;
	end?: string;
	categories?: string[];
}

interface CategoryOutput {
	name: string;
	color: string;
}

interface CalendarInfo {
	calendarId: string;
	name: string;
	directory: string;
	enabled: boolean;
	eventCount: number;
	untrackedEventCount: number;
}

function assertEventArray(value: unknown): asserts value is EventOutput[] {
	expect(Array.isArray(value), "expected an array of events").toBe(true);
	for (const event of value as unknown[]) {
		const e = event as Record<string, unknown>;
		expect(typeof e["filePath"]).toBe("string");
		expect(typeof e["title"]).toBe("string");
		expect(["timed", "allDay", "untracked"]).toContain(e["type"]);
		expect(typeof e["allDay"]).toBe("boolean");
		expect(typeof e["skipped"]).toBe("boolean");
	}
}

function assertEventOrNull(value: unknown): asserts value is EventOutput | null {
	if (value === null) return;
	const e = value as Record<string, unknown>;
	expect(typeof e["filePath"]).toBe("string");
	expect(typeof e["title"]).toBe("string");
	expect(["timed", "allDay", "untracked"]).toContain(e["type"]);
}

function assertCategoryArray(value: unknown): asserts value is CategoryOutput[] {
	expect(Array.isArray(value), "expected an array of categories").toBe(true);
	for (const cat of value as unknown[]) {
		const c = cat as Record<string, unknown>;
		expect(typeof c["name"]).toBe("string");
		expect(typeof c["color"]).toBe("string");
	}
}

function assertCalendarInfo(value: unknown): asserts value is CalendarInfo {
	expect(value, "expected calendar info").not.toBeNull();
	const c = value as Record<string, unknown>;
	expect(typeof c["calendarId"]).toBe("string");
	expect(typeof c["name"]).toBe("string");
	expect(typeof c["directory"]).toBe("string");
	expect(typeof c["enabled"]).toBe("boolean");
	expect(typeof c["eventCount"]).toBe("number");
	expect(typeof c["untrackedEventCount"]).toBe("number");
}

function assertCalendarInfoArray(value: unknown): asserts value is CalendarInfo[] {
	expect(Array.isArray(value)).toBe(true);
	for (const info of value as unknown[]) assertCalendarInfo(info);
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

async function waitForApiIndex(invoke: Invoker, filePath: string): Promise<void> {
	await expect.poll(async () => (await invoke("getEventByPath", { filePath })) !== null).toBe(true);
}

test.describe("plugin api contract — read surface via window.PrismaCalendar", () => {
	test("read surface schema-conformance + value cross-checks on a known seed", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		// Two tracked events with distinct categories. The test asserts that
		// both surface through every applicable read action — getEvents,
		// getAllEvents, getEventByPath, getCategories. Variety in categories
		// proves the category-aggregation path inside getCategories.
		const tracked1 = (await invoke("createEvent", {
			title: "Team Meeting",
			start: todayStamp(9),
			end: todayStamp(10),
			allDay: false,
			categories: ["Work"],
		})) as string;
		const tracked2 = (await invoke("createEvent", {
			title: "Workout",
			start: todayStamp(18),
			end: todayStamp(19),
			allDay: false,
			categories: ["Fitness"],
		})) as string;
		await waitForApiIndex(invoke, tracked1);
		await waitForApiIndex(invoke, tracked2);

		// Untracked event lacks a Start Date — `createUntrackedEvent` is the
		// canonical entry point. Surfaces through getUntrackedEvents.
		const untracked = (await invoke("createUntrackedEvent", {
			title: "Project Planning",
		})) as string;
		// Untracked events still show up via getEventByPath once indexed.
		await waitForApiIndex(invoke, untracked);

		const allFiles = [tracked1, tracked2, untracked];

		try {
			// ── getEvents (range query) ────────────────────────────────
			const today = todayISO();
			const rangedRaw = await invoke("getEvents", { start: `${today}T00:00`, end: `${today}T23:59` });
			assertEventArray(rangedRaw);
			expect(rangedRaw.some((e) => e.filePath === tracked1)).toBe(true);
			expect(rangedRaw.some((e) => e.filePath === tracked2)).toBe(true);
			// Untracked events have no Start Date → excluded from range queries.
			expect(rangedRaw.some((e) => e.filePath === untracked)).toBe(false);

			// ── getEventByPath (point lookup) ──────────────────────────
			const oneRaw = await invoke("getEventByPath", { filePath: tracked1 });
			assertEventOrNull(oneRaw);
			expect(oneRaw).not.toBeNull();
			expect(oneRaw!.title).toBe("Team Meeting");
			expect(oneRaw!.categories).toEqual(["Work"]);
			expect(oneRaw!.type).toBe("timed");

			const missingRaw = await invoke("getEventByPath", { filePath: "Events/Does Not Exist.md" });
			expect(missingRaw).toBeNull();

			// ── getAllEvents ───────────────────────────────────────────
			const allRaw = await invoke("getAllEvents", undefined);
			assertEventArray(allRaw);
			const allPaths = new Set(allRaw.map((e) => e.filePath));
			expect(allPaths.has(tracked1)).toBe(true);
			expect(allPaths.has(tracked2)).toBe(true);
			expect(allPaths.has(untracked)).toBe(true);

			// ── getCategories ──────────────────────────────────────────
			const catsRaw = await invoke("getCategories", undefined);
			assertCategoryArray(catsRaw);
			const catNames = new Set(catsRaw.map((c) => c.name));
			expect(catNames.has("Work")).toBe(true);
			expect(catNames.has("Fitness")).toBe(true);
			// Every entry has a non-empty color string — proves the category
			// trackers feed the colour map correctly.
			for (const c of catsRaw) {
				expect(c.color.length).toBeGreaterThan(0);
			}

			// ── getUntrackedEvents ─────────────────────────────────────
			const untrackedRaw = await invoke("getUntrackedEvents", undefined);
			assertEventArray(untrackedRaw);
			expect(untrackedRaw.some((e) => e.filePath === untracked)).toBe(true);
			// Tracked events must NOT appear in the untracked list — proves the
			// filter at the read-operations layer.
			expect(untrackedRaw.some((e) => e.filePath === tracked1)).toBe(false);
			expect(untrackedRaw.some((e) => e.filePath === tracked2)).toBe(false);
		} finally {
			// Clean up via batchDelete to keep this spec contained — the deletes
			// in any cross-cutting suite would otherwise pollute later state.
			await invoke("batchDelete", { filePaths: allFiles });
		}
	});

	test("calendar metadata reads: listCalendars + getCalendarInfo schema-validate and return the default bundle", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		// ── listCalendars ──────────────────────────────────────────────
		const listRaw = await invoke("listCalendars", undefined);
		assertCalendarInfoArray(listRaw);
		expect(listRaw.length).toBeGreaterThanOrEqual(1);
		// Default seed in `electron.ts` sets the calendar id to "default".
		const def = listRaw.find((c) => c.calendarId === "default");
		expect(def).toBeDefined();
		expect(def!.directory).toBe("Events");

		// ── getCalendarInfo (no calendarId → resolves to the active bundle) ─
		const infoRaw = await invoke("getCalendarInfo", undefined);
		expect(infoRaw).not.toBeNull();
		assertCalendarInfo(infoRaw);
		expect(infoRaw.calendarId).toBe("default");
		expect(infoRaw.directory).toBe("Events");

		// ── getCalendarInfo (unknown id → null) ────────────────────────
		const missingRaw = await invoke("getCalendarInfo", { calendarId: "does-not-exist" });
		expect(missingRaw).toBeNull();
	});
});
