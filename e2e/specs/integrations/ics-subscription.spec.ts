import { expect, testIntegrations as test } from "../../fixtures/electron";
import { type VEventInput } from "../../fixtures/ics-server";
import { type IcsSubscriptionHandle, setupIcsSubscription } from "../../fixtures/ics-subscription";

// ICS URL subscriptions are a Pro feature. The full sync pipeline is:
//   palette → Sync ICS subscriptions → plugin.syncSingleICSSubscription →
//   bundle.syncICSSubscription → ICSSubscriptionSyncService.sync() →
//   requestUrl(GET subscription-url) → parseICSContent → computeSyncPlan →
//   disk writes. Every link in that chain can break in ways unit tests miss
//   (URL resolution, HTTP status handling, content-type, ICS parsing quirks,
//   UID-based dedup). We exercise it end-to-end with a local HTTP server so
//   the assertions land on real network round-trips and real file I/O.
//
// Boilerplate (mock server, secret stub, subscription seed, vault clean-up)
// lives in `fixtures/ics-subscription.ts` — specs read as a sequence of remote
// state changes and on-disk assertions, nothing else.

test.describe("ICS URL subscription sync", () => {
	let ics: IcsSubscriptionHandle;

	test.afterEach(async () => {
		await ics?.close();
	});

	test("initial sync pulls every VEVENT into the vault", async ({ obsidian }) => {
		const events: VEventInput[] = [
			{
				uid: "e2e-meeting-1@test",
				summary: "Team Meeting",
				dtstart: "20261101T100000Z",
				dtend: "20261101T110000Z",
				categories: "Work",
			},
			{
				uid: "e2e-holiday-1@test",
				summary: "Holiday",
				dtstart: "20261125",
				allDay: true,
			},
		];

		ics = await setupIcsSubscription(obsidian, { initial: events });

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(events.length);

		for (const v of events) {
			ics.expectEventFile(v.summary);
			const fm = ics.readFrontmatter(v.summary)!;

			if (v.allDay) {
				expect(fm["All Day"]).toBe(true);
				// `YYYYMMDD` → `YYYY-MM-DD`
				const expectedDate = `${v.dtstart.slice(0, 4)}-${v.dtstart.slice(4, 6)}-${v.dtstart.slice(6, 8)}`;
				expect(fm["Date"]).toBe(expectedDate);
			} else {
				// `20261101T100000Z` → ISO `2026-11-01T10:00:00.000Z`
				const iso = `${v.dtstart.slice(0, 4)}-${v.dtstart.slice(4, 6)}-${v.dtstart.slice(6, 8)}T${v.dtstart.slice(
					9,
					11
				)}:${v.dtstart.slice(11, 13)}:${v.dtstart.slice(13, 15)}.000Z`;
				expect(fm["Start Date"]).toBe(iso);
			}
		}

		expect(ics.server.requests[0]?.method).toBe("GET");
		expect(ics.server.requests[0]?.path).toBe("/calendar.ics");
	});

	test("incremental sync adds new events, removes deleted events", async ({ obsidian }) => {
		const stable: VEventInput = {
			uid: "e2e-stable@test",
			summary: "Stable Event",
			dtstart: "20261201T100000Z",
			dtend: "20261201T110000Z",
		};

		ics = await setupIcsSubscription(obsidian, {
			initial: [
				stable,
				{
					uid: "e2e-deleted@test",
					summary: "To Be Deleted",
					dtstart: "20261202T100000Z",
					dtend: "20261202T110000Z",
				},
			],
		});

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(2);

		// Second pass: remove one, add one. The sync planner should unlink the
		// deleted event's file and create the new one, leaving the stable
		// event untouched.
		ics.setRemoteEvents([
			stable,
			{ uid: "e2e-new@test", summary: "Newly Added", dtstart: "20261203T100000Z", dtend: "20261203T110000Z" },
		]);
		ics.resetRequests();

		await ics.sync();
		await ics.waitForRequest();

		await expect.poll(() => ics.findEventFile("Newly Added")).toBeDefined();
		await expect.poll(() => ics.findEventFile("To Be Deleted")).toBeUndefined();
		expect(ics.findEventFile("Stable Event")).toBeDefined();
	});

	test("malformed ICS response leaves the vault untouched and the plugin alive", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian);
		ics.setRawBody("this is not an ICS file\n\n<!doctype html><html>sorry</html>");

		await ics.sync();
		await ics.waitForRequest();

		// No files should land, plugin should still be operational (another
		// sync runs cleanly afterwards).
		expect(ics.listEventFiles()).toHaveLength(0);
		await ics.sync();
		await ics.waitForRequest(2);
	});

	test("HTTP 403 does not crash the plugin or touch the vault", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian);
		ics.setRawBody("Forbidden");
		ics.setStatus(403);

		await ics.sync();
		await ics.waitForRequest();

		expect(ics.listEventFiles()).toHaveLength(0);

		// Flip the server back to a successful response and re-sync —
		// transient errors shouldn't permanently disable the subscription.
		ics.setStatus(200);
		ics.setRemoteEvents([
			{
				uid: "e2e-recovered@test",
				summary: "Recovered",
				dtstart: "20261210T090000Z",
				dtend: "20261210T100000Z",
			},
		]);
		ics.resetRequests();

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(1);
	});

	test("disabled subscription is skipped entirely (no network request)", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian, {
			initial: [
				{
					uid: "e2e-should-not-import@test",
					summary: "Should Not Import",
					dtstart: "20261220T100000Z",
					dtend: "20261220T110000Z",
				},
			],
			subscription: { enabled: false },
		});

		await ics.sync();

		// Sync command short-circuits on disabled subscriptions before the
		// HTTP request. Give the command a moment to run, then assert.
		await obsidian.page.waitForTimeout(500);

		expect(ics.server.requests).toHaveLength(0);
		expect(ics.listEventFiles()).toHaveLength(0);
	});
});
