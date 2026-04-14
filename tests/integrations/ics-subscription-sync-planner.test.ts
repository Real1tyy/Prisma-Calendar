/**
 * Approval snapshots for `computeIcsSubscriptionSyncPlan`.
 *
 * The planner is the pure decision function at the heart of ICS subscription
 * sync. Given the remote ICS payload + current tracked state, it decides
 * which events to create, update, skip-unchanged, skip-foreign-uid,
 * skip-missing-uid, and delete. Pinning the plan per scenario makes every
 * branch of the decision tree a diffable test case.
 *
 * The plan drives sync.ts; wiring that delegates here is covered by the
 * type system (compilation would fail if the plan shape drifts).
 */
import { describe, expect, it } from "vitest";

import { type ImportedEvent } from "../../src/core/integrations/ics-import";
import {
	computeIcsSubscriptionSyncPlan,
	type TrackedRef,
} from "../../src/core/integrations/ics-subscription/sync-planner";
import type { ICSSubscriptionSyncMetadata } from "../../src/core/integrations/ics-subscription/types";

// ─── Factories ───────────────────────────────────────────────

function makeRemote(overrides: Partial<ImportedEvent> & { uid: string }): ImportedEvent {
	return {
		title: `Remote ${overrides.uid}`,
		start: new Date("2026-04-15T09:00:00Z"),
		end: new Date("2026-04-15T10:00:00Z"),
		allDay: false,
		lastModified: 1_700_000_000_000,
		...overrides,
	};
}

function makeTracked(uid: string, filePath: string, overrides: Partial<ICSSubscriptionSyncMetadata> = {}): TrackedRef {
	return {
		filePath,
		metadata: {
			subscriptionId: "sub-local",
			uid,
			lastModified: 1_700_000_000_000,
			lastSyncedAt: 1_700_000_000_000,
			...overrides,
		},
	};
}

// Serialize plans with stripped Date/reference-heavy event payloads so
// snapshots stay readable. Full event contract is covered by the
// import-frontmatter snapshots.
function summarizeAction(action: ReturnType<typeof computeIcsSubscriptionSyncPlan>["actions"][number]) {
	switch (action.kind) {
		case "create":
			return { kind: action.kind, uid: action.uid, title: action.event.title };
		case "update":
			return {
				kind: action.kind,
				uid: action.uid,
				filePath: action.filePath,
				title: action.event.title,
				lastModified: action.event.lastModified,
			};
		case "delete":
		case "skip-unchanged":
			return { kind: action.kind, uid: action.uid, filePath: action.filePath };
		case "skip-foreign-uid":
			return { kind: action.kind, uid: action.uid, ownedBy: action.ownedBy };
		case "skip-missing-uid":
			return { kind: action.kind, title: action.title };
	}
}

function asSnapshot(plan: ReturnType<typeof computeIcsSubscriptionSyncPlan>): string {
	return (
		JSON.stringify(
			{
				actions: plan.actions.map(summarizeAction),
				summary: plan.summary,
			},
			null,
			2
		) + "\n"
	);
}

// ─── Tests ───────────────────────────────────────────────────

describe("computeIcsSubscriptionSyncPlan — approval snapshots", () => {
	it("empty remote + empty tracked → empty plan", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [],
			trackedBySubscription: [],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-empty.approved.json");
	});

	it("new remote events with no prior state → all create", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha" }), makeRemote({ uid: "u-2", title: "Bravo" })],
			trackedBySubscription: [],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-all-create.approved.json");
	});

	it("tracked + lastModified unchanged → skip-unchanged", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha", lastModified: 100 })],
			trackedBySubscription: [makeTracked("u-1", "Events/alpha.md", { lastModified: 100 })],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-skip-unchanged.approved.json");
	});

	it("tracked + lastModified differs → update with the new payload", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha v2", lastModified: 200 })],
			trackedBySubscription: [makeTracked("u-1", "Events/alpha.md", { lastModified: 100 })],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-update.approved.json");
	});

	it("tracked by a different subscription → skip-foreign-uid, never create a duplicate note", async () => {
		const otherSubTracked = makeTracked("u-1", "Events/alpha.md", { subscriptionId: "sub-other" });
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha" })],
			trackedBySubscription: [],
			findByUidGlobal: (uid) => (uid === "u-1" ? otherSubTracked : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-skip-foreign.approved.json");
	});

	it("event without a uid → skip-missing-uid, never reach downstream", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "", title: "No UID" })],
			trackedBySubscription: [],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-missing-uid.approved.json");
	});

	it("tracked uid absent from remote payload → delete", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha" })],
			trackedBySubscription: [makeTracked("u-1", "Events/alpha.md"), makeTracked("u-stale", "Events/stale.md")],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-delete.approved.json");
	});

	it("mixed: create + update + skip-unchanged + skip-foreign + delete in one pass", async () => {
		const foreign = makeTracked("u-foreign", "Events/foreign.md", { subscriptionId: "sub-other" });
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [
				makeRemote({ uid: "u-new", title: "Newcomer" }),
				makeRemote({ uid: "u-same", title: "Same", lastModified: 100 }),
				makeRemote({ uid: "u-changed", title: "Changed v2", lastModified: 200 }),
				makeRemote({ uid: "u-foreign", title: "Foreign" }),
			],
			trackedBySubscription: [
				makeTracked("u-same", "Events/same.md", { lastModified: 100 }),
				makeTracked("u-changed", "Events/changed.md", { lastModified: 100 }),
				makeTracked("u-gone", "Events/gone.md"),
			],
			findByUidGlobal: (uid) => (uid === "u-foreign" ? foreign : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-mixed.approved.json");
	});

	it("preserves remote ordering in the output actions (stable plan)", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [
				makeRemote({ uid: "u-3", title: "Gamma" }),
				makeRemote({ uid: "u-1", title: "Alpha" }),
				makeRemote({ uid: "u-2", title: "Beta" }),
			],
			trackedBySubscription: [],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-ordering.approved.json");
	});

	it("deletes come after all create/update/skip actions, preserving tracked-list order", async () => {
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-keep", title: "Keep" })],
			trackedBySubscription: [
				makeTracked("u-keep", "Events/keep.md"),
				makeTracked("u-gone-a", "Events/gone-a.md"),
				makeTracked("u-gone-b", "Events/gone-b.md"),
			],
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-delete-ordering.approved.json");
	});

	it("own-subscription global hit (re-import same tracked uid) treats it as own, not foreign", async () => {
		const own = makeTracked("u-1", "Events/alpha.md");
		const plan = computeIcsSubscriptionSyncPlan({
			subscriptionId: "sub-local",
			remoteEvents: [makeRemote({ uid: "u-1", title: "Alpha", lastModified: 200 })],
			trackedBySubscription: [own],
			// Global index also returns own record — shouldn't matter, own-match wins first.
			findByUidGlobal: (uid) => (uid === "u-1" ? own : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/plan-own-global-hit.approved.json");
	});
});
