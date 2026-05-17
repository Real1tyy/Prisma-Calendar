import { existsSync } from "node:fs";
import { join } from "node:path";

import { defineCrudContractSuite, runContractSuite } from "@real1ty-obsidian-plugins/testing/api-contract";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { createPrismaApi, pageEvaluateInvoker, waitForApiIndex } from "../../fixtures/api-helpers";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec: exercises the real `window.PrismaCalendar.*` surface
// through a Playwright-driven CRUD loop. Lives in this folder because the
// gateway action map is the *contract surface* the rest of the monorepo
// depends on — a regression here is a load-bearing API regression, not just a
// UI bug.
//
// All assertions go through the API; on-disk frontmatter is the secondary
// proof. We never reach into stores, app.* internals, or DOM clicks — the
// invocation site is identical to what a consumer plugin or external script
// would do.
//
// Why `todayStamp` over `fromAnchor`: this spec never opens or asserts on a
// FullCalendar viewport, so the anchor-week robustness rule does not apply.
// We use plain today-relative timestamps for deterministic frontmatter
// assertions.

test.describe("plugin api contract — CRUD via window.PrismaCalendar", () => {
	test("create → read → edit → markAsDone → toggleSkip → delete", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// Sanity: the API surface is actually exposed under the canonical key.
		await expect(
			obsidian.page.evaluate(() => {
				const surface = (window as unknown as Record<string, unknown>)["PrismaCalendar"];
				return surface !== null && typeof surface === "object"
					? Object.keys(surface as Record<string, unknown>).sort()
					: [];
			})
		).resolves.toContain("createEvent");

		const start = todayStamp(9);
		const end = todayStamp(10);
		const editedEnd = todayStamp(11);

		// Pre-create the event so subsequent steps can rely on the indexed path.
		// The created path is captured into the suite as the "create" step result
		// the same way runContractSuite would have done.
		const createdPath = await api.createEvent({
			title: "Project Planning",
			start,
			end,
			allDay: false,
			categories: ["Work"],
		});
		expect(typeof createdPath).toBe("string");
		expect(createdPath).toMatch(/^Events\/Project Planning.*\.md$/);

		await waitForApiIndex(api, createdPath!);

		// Drive the contract suite via the untyped Invoker — `runContractSuite`
		// works at the wire level so it can replay against any transport
		// (in-process vitest, page.evaluate). The typed `api` proxy above is
		// the everyday DSL; this suite is the rare callsite where the loose
		// surface is the right tool.
		const suite = defineCrudContractSuite({
			name: "window-api-crud",
			steps: [
				{
					name: "create",
					action: "getEventByPath",
					params: { filePath: createdPath },
					expect: (result) => {
						expect(result).toMatchObject({
							title: "Project Planning",
							type: "timed",
							allDay: false,
							categories: ["Work"],
						});
					},
				},
				{
					name: "edit",
					// Edit only `end` — changing `title` would rename the file via
					// frontmatter title sync and invalidate `createdPath` for the rest
					// of the loop. Title-rename has its own dedicated coverage.
					action: "editEvent",
					params: { filePath: createdPath, end: editedEnd },
					expect: (result) => expect(result).toBe(true),
				},
				{
					name: "readAfterEdit",
					action: "getEventByPath",
					params: { filePath: createdPath },
					expect: (result) => {
						const event = result as { title: string; end?: string };
						expect(event.title).toBe("Project Planning");
						// Prisma normalises ISO timestamps to second precision on write
						// (`ensureISOSuffix`), so `HH:mm` round-trips as `HH:mm:00`.
						expect(event.end).toMatch(new RegExp(`^${editedEnd}(?::\\d{2})?$`));
					},
				},
				{
					name: "markAsDone",
					action: "markAsDone",
					params: { filePath: createdPath },
					expect: (result) => expect(result).toBe(true),
				},
				{
					name: "toggleSkip",
					action: "toggleSkip",
					params: { filePath: createdPath },
					expect: (result) => expect(result).toBe(true),
				},
				{
					name: "readAfterStatus",
					action: "getEventByPath",
					params: { filePath: createdPath },
					expect: (result) => {
						expect(result).toMatchObject({ skipped: true });
					},
				},
				{
					name: "delete",
					action: "deleteEvent",
					params: { filePath: createdPath },
					expect: (result) => expect(result).toBe(true),
				},
				{
					name: "readAfterDelete",
					action: "getEventByPath",
					params: { filePath: createdPath },
					expect: (result) => expect(result).toBeNull(),
				},
			],
		});

		await runContractSuite(suite, { invoke: pageEvaluateInvoker(obsidian.page, "PrismaCalendar") });

		// Frontmatter cross-check: the event file is gone after delete.
		expect(existsSync(join(obsidian.vaultDir, createdPath!))).toBe(false);
	});

	test("list operations: getAllEvents, getEvents range query, getCategories", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const today = todayISO();
		const rangeStart = `${today}T00:00`;
		const rangeEnd = `${today}T23:59`;

		const created = await api.createEvent({
			title: "Workout",
			start: todayStamp(14),
			end: todayStamp(15),
			allDay: false,
			categories: ["Personal"],
		});
		expect(typeof created).toBe("string");

		await waitForApiIndex(api, created!);

		try {
			const all = await api.getAllEvents({});
			expect(all.some((e) => e.filePath === created)).toBe(true);

			const ranged = await api.getEvents({ start: rangeStart, end: rangeEnd });
			expect(ranged.some((e) => e.filePath === created)).toBe(true);

			const categories = await api.getCategories({});
			expect(categories.some((c) => c.name === "Personal")).toBe(true);

			// Cross-check the created file actually exists on disk with the
			// expected category frontmatter. Single-element lists collapse to a
			// bare string under Prisma's `assignListToFrontmatter` contract; only
			// multi-element lists serialise as YAML arrays.
			expect(existsSync(join(obsidian.vaultDir, created!))).toBe(true);
			const fm = readEventFrontmatter(obsidian.vaultDir, created!);
			expect(fm).toMatchObject({ Category: "Personal" });
		} finally {
			expect(await api.deleteEvent({ filePath: created! })).toBe(true);
		}
	});
});
