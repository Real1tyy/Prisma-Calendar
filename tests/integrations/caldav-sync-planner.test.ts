/**
 * Approval snapshots for `computeCaldavSyncPlan`.
 *
 * The planner is the pure decision function at the heart of CalDAV sync.
 * Given the remote CalDAV payload (VEVENTs fetched via the tsdav client) +
 * current tracked state, it decides which events to create, update,
 * skip-unchanged (etag match), skip-foreign-uid (tracked by another
 * account/calendar), and skip-missing-uid. Pinning the plan per scenario
 * makes every branch of the decision tree a diffable test case — the same
 * pattern the ICS subscription planner uses.
 *
 * Deletion is deliberately not covered here: the planner does not emit
 * `delete` actions because plain REPORT responses don't carry tombstones.
 * When sync-token tracking lands (RFC 6578), deletion becomes a new branch
 * and gets its own snapshots.
 */
import { describe, expect, it } from "vitest";

import type { CalDAVFetchedEvent } from "../../src/core/integrations/caldav/client";
import { computeCaldavSyncPlan, type TrackedRef } from "../../src/core/integrations/caldav/sync-planner";
import type { CalDAVSyncMetadata } from "../../src/core/integrations/caldav/types";

const ACCOUNT_ID = "acc-local";
const CALENDAR_HREF = "https://dav.example.com/acc-local/work/";
const OTHER_ACCOUNT_ID = "acc-other";
const OTHER_CALENDAR_HREF = "https://dav.example.com/acc-other/work/";

// ─── Factories ───────────────────────────────────────────────

function makeRemote(overrides: Partial<CalDAVFetchedEvent> & { uid?: string }): CalDAVFetchedEvent {
	const uid = overrides.uid ?? "";
	return {
		url: `${CALENDAR_HREF}${uid || "no-uid"}.ics`,
		etag: '"etag-default"',
		data: "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
		uid: uid || undefined,
		...overrides,
	};
}

function makeTracked(uid: string, filePath: string, overrides: Partial<CalDAVSyncMetadata> = {}): TrackedRef {
	return {
		filePath,
		metadata: {
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			objectHref: `${CALENDAR_HREF}${uid}.ics`,
			etag: '"etag-default"',
			uid,
			lastSyncedAt: 1_700_000_000_000,
			...overrides,
		},
	};
}

// Drop reference-heavy fields from snapshots so the file diff reflects the
// decision, not the payload. Full event-payload fidelity is covered by the
// ICS import tests.
function summarizeAction(action: ReturnType<typeof computeCaldavSyncPlan>["actions"][number]) {
	switch (action.kind) {
		case "create":
			return { kind: action.kind, uid: action.uid, url: action.event.url, etag: action.event.etag };
		case "update":
			return {
				kind: action.kind,
				uid: action.uid,
				filePath: action.filePath,
				url: action.event.url,
				etag: action.event.etag,
			};
		case "skip-unchanged":
			return { kind: action.kind, uid: action.uid, filePath: action.filePath };
		case "skip-foreign-uid":
			return { kind: action.kind, uid: action.uid, ownedBy: action.ownedBy };
		case "skip-missing-uid":
			return { kind: action.kind, url: action.url };
	}
}

function asSnapshot(plan: ReturnType<typeof computeCaldavSyncPlan>): string {
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

describe("computeCaldavSyncPlan — approval snapshots", () => {
	it("empty remote + empty tracked → empty plan", async () => {
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [],
			findByUid: () => null,
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-empty.approved.json");
	});

	it("new remote events with no prior state → all create", async () => {
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ uid: "u-1", etag: '"etag-v1"' }), makeRemote({ uid: "u-2", etag: '"etag-v1"' })],
			findByUid: () => null,
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-all-create.approved.json");
	});

	it("tracked + same etag → skip-unchanged (the high-traffic hot path)", async () => {
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ uid: "u-1", etag: '"etag-stable"' })],
			findByUid: (uid) => (uid === "u-1" ? makeTracked(uid, "Events/event-u-1.md", { etag: '"etag-stable"' }) : null),
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-skip-unchanged.approved.json");
	});

	it("tracked + etag differs → update with new payload", async () => {
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ uid: "u-1", etag: '"etag-v2"' })],
			findByUid: (uid) => (uid === "u-1" ? makeTracked(uid, "Events/event-u-1.md", { etag: '"etag-v1"' }) : null),
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-update.approved.json");
	});

	it("tracked by a different account/calendar → skip-foreign-uid, never duplicate the note", async () => {
		const foreign = makeTracked("u-1", "Events/foreign.md", {
			accountId: OTHER_ACCOUNT_ID,
			calendarHref: OTHER_CALENDAR_HREF,
		});
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ uid: "u-1", etag: '"etag-v1"' })],
			findByUid: () => null,
			findByUidGlobal: (uid) => (uid === "u-1" ? foreign : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-skip-foreign.approved.json");
	});

	it("remote event without a UID → skip-missing-uid, never reach downstream", async () => {
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ url: `${CALENDAR_HREF}mangled.ics`, etag: '"e"' })],
			findByUid: () => null,
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-missing-uid.approved.json");
	});

	it("mixed batch: create + update + skip-unchanged + skip-foreign + skip-missing in one plan", async () => {
		const foreign = makeTracked("u-foreign", "Events/foreign.md", {
			accountId: OTHER_ACCOUNT_ID,
			calendarHref: OTHER_CALENDAR_HREF,
		});
		const tracked = new Map<string, TrackedRef>([
			["u-same-etag", makeTracked("u-same-etag", "Events/same.md", { etag: '"same"' })],
			["u-changed", makeTracked("u-changed", "Events/changed.md", { etag: '"old"' })],
		]);

		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [
				makeRemote({ uid: "u-same-etag", etag: '"same"' }),
				makeRemote({ uid: "u-changed", etag: '"new"' }),
				makeRemote({ uid: "u-brand-new", etag: '"fresh"' }),
				makeRemote({ uid: "u-foreign", etag: '"fresh"' }),
				makeRemote({ uid: "", url: `${CALENDAR_HREF}broken.ics`, etag: '"e"' }),
			],
			findByUid: (uid) => tracked.get(uid) ?? null,
			findByUidGlobal: (uid) => (uid === "u-foreign" ? foreign : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-mixed.approved.json");
	});

	it("refetch with all events unchanged → all skip-unchanged (no IO)", async () => {
		const tracked = new Map<string, TrackedRef>([
			["u-1", makeTracked("u-1", "Events/u-1.md", { etag: '"e1"' })],
			["u-2", makeTracked("u-2", "Events/u-2.md", { etag: '"e2"' })],
			["u-3", makeTracked("u-3", "Events/u-3.md", { etag: '"e3"' })],
		]);
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [
				makeRemote({ uid: "u-1", etag: '"e1"' }),
				makeRemote({ uid: "u-2", etag: '"e2"' }),
				makeRemote({ uid: "u-3", etag: '"e3"' }),
			],
			findByUid: (uid) => tracked.get(uid) ?? null,
			findByUidGlobal: () => null,
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-idle-refetch.approved.json");
	});

	it("foreign ownership does not inherit across a subsequent local track — own-scope wins", async () => {
		// Regression guard: once we track an event in our scope, the fact that
		// a stale global index entry existed for a different owner must not
		// promote us into skip-foreign-uid. findByUid (own-scope) returning a
		// hit takes precedence over findByUidGlobal.
		const own = makeTracked("u-1", "Events/mine.md", { etag: '"mine"' });
		const globalSameRef = own; // own track is also in the global index
		const plan = computeCaldavSyncPlan({
			accountId: ACCOUNT_ID,
			calendarHref: CALENDAR_HREF,
			remoteEvents: [makeRemote({ uid: "u-1", etag: '"mine"' })],
			findByUid: (uid) => (uid === "u-1" ? own : null),
			findByUidGlobal: (uid) => (uid === "u-1" ? globalSameRef : null),
		});
		await expect(asSnapshot(plan)).toMatchFileSnapshot("__snapshots__/caldav-plan-own-scope-wins.approved.json");
	});
});
