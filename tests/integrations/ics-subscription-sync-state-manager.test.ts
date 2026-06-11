/**
 * Regression guard for the ICS subscription state-priming contract.
 *
 * `ICSSubscriptionSyncStateManager` populates its UID→filePath maps reactively
 * via the vault's RxJS indexer. When `ICSSubscriptionSyncService.sync()` writes
 * files, it primes the state manager synchronously through `registerTracked`
 * so a follow-up sync fired before the indexer drains still sees consistent
 * state. Without priming, an immediate second sync sees an empty tracked map
 * and (a) spuriously re-creates already-tracked events, (b) never emits delete
 * actions for UIDs dropped from the remote payload. That bug surfaced as a
 * flaky E2E (`incremental sync adds new events, removes deleted events`).
 *
 * These tests lock in the public priming API without touching the reactive
 * pipeline: the event source's `events$` is wired to `NEVER`, so every entry
 * in the map must come from an explicit `registerTracked` / `unregisterTracked`
 * call.
 */
import type { App } from "obsidian";
import { BehaviorSubject, NEVER, Subject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import type { ImportedEvent } from "../../src/core/integrations/ics-import";
import { computeIcsSubscriptionSyncPlan } from "../../src/core/integrations/ics-subscription/sync-planner";
import { ICSSubscriptionSyncStateManager } from "../../src/core/integrations/ics-subscription/sync-state-manager";
import type { ICSSubscriptionSyncMetadata } from "../../src/core/integrations/ics-subscription/types";
import type { CalendarEventSource, IndexerEvent } from "../../src/types/event-source";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createRawEventSource } from "../fixtures";
import { createMockSingleCalendarSettings } from "../fixtures/settings-fixtures";
import { createMockApp } from "../setup";

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
	const settings$ = new BehaviorSubject<SingleCalendarConfig>(createMockSingleCalendarSettings());
	const manager = new ICSSubscriptionSyncStateManager(app, silentEventSource(), settings$);
	return { manager };
}

function meta(overrides: Partial<ICSSubscriptionSyncMetadata> & { uid: string }): ICSSubscriptionSyncMetadata {
	return {
		subscriptionId: "sub-a",
		lastModified: 1_700_000_000_000,
		lastSyncedAt: 1_700_000_000_000,
		...overrides,
	};
}

function remote(uid: string, title = `Remote ${uid}`): ImportedEvent {
	return {
		title,
		start: new Date("2026-04-15T09:00:00Z"),
		end: new Date("2026-04-15T10:00:00Z"),
		allDay: false,
		lastModified: 1_700_000_000_000,
		uid,
	};
}

describe("ICSSubscriptionSyncStateManager — synchronous priming", () => {
	it("registerTracked makes the entry visible to getAllForSubscription without any indexer event", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/Stable.md", meta({ uid: "uid-1" }));

		const tracked = manager.getAllForSubscription("sub-a");
		expect(tracked).toHaveLength(1);
		expect(tracked[0]).toEqual({
			filePath: "Events/Stable.md",
			metadata: meta({ uid: "uid-1" }),
		});
	});

	it("registerTracked updates the global UID index used for cross-subscription dedup", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/A.md", meta({ uid: "uid-1" }));

		expect(manager.findByUidGlobal("uid-1")).toEqual({
			filePath: "Events/A.md",
			metadata: meta({ uid: "uid-1" }),
		});
		expect(manager.findByUidGlobal("uid-missing")).toBeNull();
	});

	it("unregisterTracked removes the entry from both the subscription map and the global index", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/A.md", meta({ uid: "uid-1" }));
		const removed = manager.unregisterTracked("Events/A.md");

		expect(removed).toBe(true);
		expect(manager.getAllForSubscription("sub-a")).toHaveLength(0);
		expect(manager.findByUidGlobal("uid-1")).toBeNull();
	});

	it("duplicate UID at a second filePath is rejected; first entry wins", () => {
		const { manager } = createStateManager();

		manager.registerTracked("Events/First.md", meta({ uid: "uid-dup" }));
		manager.registerTracked("Events/Second.md", meta({ uid: "uid-dup" }));

		expect(manager.findByUidGlobal("uid-dup")?.filePath).toBe("Events/First.md");
		expect(manager.getAllForSubscription("sub-a")).toHaveLength(1);
	});
});

describe("ICSSubscriptionSyncStateManager — planner integration on a rapid second sync", () => {
	// Mirrors the race fixed by the state-priming patch: sync-1 creates two
	// events and primes state synchronously; sync-2 fires before any indexer
	// event has drained, and must still produce the correct plan.
	it("a primed state feeds the planner so a second sync emits skip-unchanged + create + delete", () => {
		const { manager } = createStateManager();

		// Prime state as sync-1 would after writing each file.
		manager.registerTracked("Events/Stable.md", meta({ uid: "uid-stable" }));
		manager.registerTracked("Events/ToBeDeleted.md", meta({ uid: "uid-deleted" }));

		// Sync-2 remote payload: Stable is still there, ToBeDeleted is gone,
		// NewlyAdded appears.
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-a",
			remoteEvents: [remote("uid-stable", "Stable"), remote("uid-new", "Newly Added")],
			trackedBySubscription: manager.getAllForSubscription("sub-a"),
			findByUidGlobal: (uid) => manager.findByUidGlobal(uid),
		});

		expect(plan.summary).toMatchObject({ create: 1, skipUnchanged: 1, delete: 1 });
		const kinds = plan.actions.map((a) => a.kind).sort();
		expect(kinds).toEqual(["create", "delete", "skip-unchanged"]);

		const del = plan.actions.find((a) => a.kind === "delete");
		expect(del).toMatchObject({ uid: "uid-deleted", filePath: "Events/ToBeDeleted.md" });

		const create = plan.actions.find((a) => a.kind === "create");
		expect(create).toMatchObject({ uid: "uid-new" });

		const skip = plan.actions.find((a) => a.kind === "skip-unchanged");
		expect(skip).toMatchObject({ uid: "uid-stable", filePath: "Events/Stable.md" });
	});

	it("without priming (the regression), the planner treats every remote event as new and never deletes", () => {
		const { manager } = createStateManager();
		// Deliberately skip registerTracked to simulate the pre-fix race where
		// the indexer hadn't populated state before sync-2 fires.

		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-a",
			remoteEvents: [remote("uid-stable", "Stable"), remote("uid-new", "Newly Added")],
			trackedBySubscription: manager.getAllForSubscription("sub-a"),
			findByUidGlobal: (uid) => manager.findByUidGlobal(uid),
		});

		expect(plan.summary).toMatchObject({ create: 2, skipUnchanged: 0, delete: 0 });
	});
});

// The race this guards: `byUid` is hydrated reactively from the indexer's
// `events$`. The pre-fix bug let a sync run before that hydration finished, so
// the planner treated every already-on-disk event as `create` — the duplicate
// storm that self-healing then had to trash. The state manager now exposes a
// `whenHydrated()` gate the sync services await; these tests drive it through a
// controllable indexer signal — the race is impossible to force deterministically
// in E2E, where a small seeded vault finishes indexing before any sync can fire.
describe("ICSSubscriptionSyncStateManager — index-hydration gate", () => {
	function controllableSource(): {
		source: CalendarEventSource;
		events$: Subject<IndexerEvent>;
		indexingComplete$: BehaviorSubject<boolean>;
	} {
		const events$ = new Subject<IndexerEvent>();
		const indexingComplete$ = new BehaviorSubject<boolean>(false);
		const source: CalendarEventSource = {
			events$,
			indexingComplete$,
			markFileAsDone: vi.fn().mockResolvedValue(undefined),
			resync: vi.fn(),
		};
		return { source, events$, indexingComplete$ };
	}

	function makeManager(source: CalendarEventSource) {
		const app = createMockApp() as unknown as App;
		const settings = createMockSingleCalendarSettings();
		const settings$ = new BehaviorSubject<SingleCalendarConfig>(settings);
		const manager = new ICSSubscriptionSyncStateManager(app, source, settings$);
		return { manager, settings };
	}

	// Drain the microtask queue so a `whenHydrated()` that is genuinely pending
	// has had every chance to settle before we assert it has not.
	const flushMicrotasks = async (): Promise<void> => {
		await Promise.resolve();
		await Promise.resolve();
	};

	it("whenHydrated() stays pending until the indexer signals completion", async () => {
		const { source, indexingComplete$ } = controllableSource();
		const { manager } = makeManager(source);

		let resolved = false;
		const gate = manager.whenHydrated().then(() => {
			resolved = true;
		});

		await flushMicrotasks();
		expect(resolved).toBe(false);

		indexingComplete$.next(true);
		await gate;
		expect(resolved).toBe(true);
	});

	it("whenHydrated() resolves immediately when the index is already hydrated", async () => {
		const { source, indexingComplete$ } = controllableSource();
		indexingComplete$.next(true);
		const { manager } = makeManager(source);

		await expect(manager.whenHydrated()).resolves.toBeUndefined();
	});

	it("re-arms after a resync: pending while re-indexing, resolves once it completes again", async () => {
		const { source, indexingComplete$ } = controllableSource();
		indexingComplete$.next(true);
		const { manager } = makeManager(source);

		indexingComplete$.next(false); // resync()/reindex started — byUid is stale
		let resolved = false;
		const gate = manager.whenHydrated().then(() => {
			resolved = true;
		});

		await flushMicrotasks();
		expect(resolved).toBe(false);

		indexingComplete$.next(true);
		await gate;
		expect(resolved).toBe(true);
	});

	it("a pre-existing note streamed by the indexer is tracked before hydration completes, so the planner skips it instead of re-creating", async () => {
		const { source, events$, indexingComplete$ } = controllableSource();
		const { manager, settings } = makeManager(source);

		const trackedMeta = meta({ uid: "uid-existing" });
		events$.next({
			type: "file-changed",
			filePath: "Events/Existing.md",
			source: createRawEventSource({
				filePath: "Events/Existing.md",
				frontmatter: { [settings.icsSubscriptionProp]: trackedMeta },
			}),
		});
		indexingComplete$.next(true);
		await manager.whenHydrated();

		const trackedBySubscription = manager.getAllForSubscription("sub-a");
		expect(trackedBySubscription).toHaveLength(1);

		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-a",
			remoteEvents: [remote("uid-existing", "Existing")],
			trackedBySubscription,
			findByUidGlobal: (uid) => manager.findByUidGlobal(uid),
		});

		expect(plan.summary).toMatchObject({ create: 0, skipUnchanged: 1 });
	});
});
