/**
 * Regression guard for the CalDAV state-priming contract + the new
 * object-href index that RFC 6578 tombstone resolution depends on.
 *
 * `CalDAVSyncStateManager` populates its UID / object-href maps reactively
 * via the vault's RxJS indexer. `CalDAVSyncService.sync()` primes these maps
 * synchronously through `registerTracked` so a follow-up sync fired before
 * the indexer drains still sees consistent state. Without priming, the sync
 * planner would (a) spuriously re-create already-tracked events, and (b) fail
 * to resolve a tombstone href back to the local file it represents.
 *
 * These tests wire the event source to `NEVER` so every map entry must come
 * from an explicit `registerTracked` call — the same discipline applied to
 * the ICS subscription suite.
 */
import type { App } from "obsidian";
import { BehaviorSubject, NEVER } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import type { CalDAVFetchedEvent } from "../../src/core/integrations/caldav/client";
import { computeCaldavSyncPlan } from "../../src/core/integrations/caldav/sync-planner";
import { CalDAVSyncStateManager } from "../../src/core/integrations/caldav/sync-state-manager";
import type { CalDAVSyncMetadata } from "../../src/core/integrations/caldav/types";
import type { CalendarEventSource } from "../../src/types/event-source";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createMockApp, createMockSingleCalendarSettings } from "../setup";

const ACCOUNT_ID = "acc-local";
const CALENDAR_HREF = "https://dav.example.com/acc-local/work/";
const OTHER_ACCOUNT_ID = "acc-other";
const OTHER_CALENDAR_HREF = "https://dav.example.com/acc-other/work/";

function silentEventSource(): CalendarEventSource {
	return {
		events$: NEVER,
		indexingComplete$: NEVER,
		markFileAsDone: vi.fn().mockResolvedValue(undefined),
		resync: vi.fn(),
	};
}

function createStateManager() {
	const app = createMockApp() as unknown as App;
	const settings$ = new BehaviorSubject<SingleCalendarConfig>(
		createMockSingleCalendarSettings() as SingleCalendarConfig
	);
	const manager = new CalDAVSyncStateManager(app, silentEventSource(), settings$);
	return { manager };
}

function meta(overrides: Partial<CalDAVSyncMetadata> & { uid: string; objectHref: string }): CalDAVSyncMetadata {
	return {
		accountId: ACCOUNT_ID,
		calendarHref: CALENDAR_HREF,
		etag: '"etag-default"',
		lastSyncedAt: 1_700_000_000_000,
		...overrides,
	};
}

function remote(uid: string, etag = '"etag-default"'): CalDAVFetchedEvent {
	return {
		url: `${CALENDAR_HREF}${uid}.ics`,
		etag,
		data: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
		uid,
	};
}

describe("CalDAVSyncStateManager — synchronous priming", () => {
	it("registerTracked makes entries visible to findByUid without any indexer event", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/Alpha.md", meta({ uid: "uid-alpha", objectHref: `${CALENDAR_HREF}alpha.ics` }));

		const tracked = manager.findByUid(ACCOUNT_ID, CALENDAR_HREF, "uid-alpha");
		expect(tracked?.filePath).toBe("Events/Alpha.md");
	});

	it("registerTracked populates the global UID index used for foreign-dedup", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/Alpha.md", meta({ uid: "uid-alpha", objectHref: `${CALENDAR_HREF}alpha.ics` }));

		expect(manager.findByUidGlobal("uid-alpha")?.filePath).toBe("Events/Alpha.md");
		expect(manager.findByUidGlobal("uid-missing")).toBeNull();
	});

	it("registerTracked populates the object-href index so tombstones resolve to filePaths", () => {
		const { manager } = createStateManager();
		const href = `${CALENDAR_HREF}alpha.ics`;

		manager.registerTracked("Events/Alpha.md", meta({ uid: "uid-alpha", objectHref: href }));

		const viaHref = manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href);
		expect(viaHref?.filePath).toBe("Events/Alpha.md");
		expect(viaHref?.metadata.uid).toBe("uid-alpha");
	});

	it("findByObjectHref scopes by (account, calendar): same href under a different account does not leak", () => {
		const { manager } = createStateManager();
		const href = `${CALENDAR_HREF}alpha.ics`;

		manager.registerTracked("Events/Alpha.md", meta({ uid: "uid-alpha", objectHref: href }));

		expect(manager.findByObjectHref(OTHER_ACCOUNT_ID, CALENDAR_HREF, href)).toBeNull();
		expect(manager.findByObjectHref(ACCOUNT_ID, OTHER_CALENDAR_HREF, href)).toBeNull();
	});

	it("unregisterTracked removes entries from every index — UID, global, and href", () => {
		const { manager } = createStateManager();
		const href = `${CALENDAR_HREF}alpha.ics`;

		manager.registerTracked("Events/Alpha.md", meta({ uid: "uid-alpha", objectHref: href }));
		const removed = manager.unregisterTracked("Events/Alpha.md");

		expect(removed).toBe(true);
		expect(manager.findByUid(ACCOUNT_ID, CALENDAR_HREF, "uid-alpha")).toBeNull();
		expect(manager.findByUidGlobal("uid-alpha")).toBeNull();
		expect(manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href)).toBeNull();
	});

	it("duplicate UID at a second filePath is rejected; first entry wins across all indexes", () => {
		const { manager } = createStateManager();
		const href1 = `${CALENDAR_HREF}alpha-first.ics`;
		const href2 = `${CALENDAR_HREF}alpha-second.ics`;

		manager.registerTracked("Events/AlphaFirst.md", meta({ uid: "uid-dup", objectHref: href1 }));
		manager.registerTracked("Events/AlphaSecond.md", meta({ uid: "uid-dup", objectHref: href2 }));

		expect(manager.findByUidGlobal("uid-dup")?.filePath).toBe("Events/AlphaFirst.md");
		expect(manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href1)?.filePath).toBe("Events/AlphaFirst.md");
		// The rejected duplicate must not leak into the href index either.
		expect(manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href2)).toBeNull();
	});
});

describe("CalDAVSyncStateManager — planner integration on a rapid second sync", () => {
	it("a primed state + server tombstone feeds the planner so sync emits a delete action", () => {
		const { manager } = createStateManager();
		const doomedHref = `${CALENDAR_HREF}doomed.ics`;
		manager.registerTracked("Events/Stable.md", meta({ uid: "uid-stable", objectHref: `${CALENDAR_HREF}stable.ics` }));
		manager.registerTracked("Events/Doomed.md", meta({ uid: "uid-doomed", objectHref: doomedHref }));

		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [remote("uid-stable")],
			tombstonedObjectHrefs: [doomedHref],
			findByUid: (uid) => manager.findByUid(ACCOUNT_ID, CALENDAR_HREF, uid),
			findByUidGlobal: (uid) => manager.findByUidGlobal(uid),
			findByObjectHref: (href) => manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href),
		});

		expect(plan.summary).toMatchObject({ delete: 1, skipUnchanged: 1 });
		const deleteAction = plan.actions.find((a) => a.kind === "delete");
		expect(deleteAction).toMatchObject({ uid: "uid-doomed", filePath: "Events/Doomed.md" });
	});

	it("without priming (the race), a tombstone for an untracked href falls back to skip-tombstone-untracked", () => {
		const { manager } = createStateManager();
		// Skip registerTracked to simulate the pre-priming race.

		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [],
			tombstonedObjectHrefs: [`${CALENDAR_HREF}doomed.ics`],
			findByUid: (uid) => manager.findByUid(ACCOUNT_ID, CALENDAR_HREF, uid),
			findByUidGlobal: (uid) => manager.findByUidGlobal(uid),
			findByObjectHref: (href) => manager.findByObjectHref(ACCOUNT_ID, CALENDAR_HREF, href),
		});

		// Safer than a spurious create or delete — the planner surfaces that
		// we saw a tombstone but had nothing to remove.
		expect(plan.summary).toMatchObject({ delete: 0, skipTombstoneUntracked: 1 });
	});
});
