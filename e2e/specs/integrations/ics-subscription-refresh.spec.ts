import { expect, testIntegrations as test } from "../../fixtures/electron";
import { type VEventInput } from "../../fixtures/ics-server";
import { type IcsSubscriptionHandle, setupIcsSubscription } from "../../fixtures/ics-subscription";

// Re-sync behaviour: when the remote feed changes between syncs the local
// vault must converge. Add/remove/modify cases plus a rapid-fire dedup check.
// All boilerplate (mock server, secret stub, subscription seed, vault clean)
// lives in `fixtures/ics-subscription.ts` — specs deal in remote VEVENTs and
// on-disk frontmatter only.

test.describe("ICS subscription refresh: modified events", () => {
	let ics: IcsSubscriptionHandle;

	test.afterEach(async () => {
		await ics?.close();
	});

	test("re-sync picks up time change on an existing event", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian, {
			initial: [
				{
					uid: "e2e-update-time@test",
					summary: "Morning Standup",
					dtstart: "20261105T090000Z",
					dtend: "20261105T093000Z",
				},
			],
		});

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(1);
		expect(String(ics.readFrontmatter("Morning Standup")?.["Start Date"])).toContain("09:00");

		ics.setRemoteEvents([
			{
				uid: "e2e-update-time@test",
				summary: "Morning Standup",
				dtstart: "20261105T100000Z",
				dtend: "20261105T103000Z",
			},
		]);
		ics.resetRequests();

		await ics.sync();
		await ics.waitForRequest();

		await expect.poll(() => String(ics.readFrontmatter("Morning Standup")?.["Start Date"] ?? "")).toContain("10:00");
	});

	test("re-sync picks up added category on existing event", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian, {
			initial: [
				{
					uid: "e2e-add-category@test",
					summary: "Design Review",
					dtstart: "20261110T140000Z",
					dtend: "20261110T150000Z",
				},
			],
		});

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(1);

		ics.setRemoteEvents([
			{
				uid: "e2e-add-category@test",
				summary: "Design Review",
				dtstart: "20261110T140000Z",
				dtend: "20261110T150000Z",
				categories: "Work",
			},
		]);
		ics.resetRequests();

		await ics.sync();
		await ics.waitForRequest();

		await expect.poll(() => ics.readFrontmatter("Design Review")?.["Category"]).toBe("Work");
	});

	test("re-sync with multiple additions and deletions in one pass", async ({ obsidian }) => {
		const keep: VEventInput = {
			uid: "e2e-keep@test",
			summary: "Keep This",
			dtstart: "20261201T080000Z",
			dtend: "20261201T090000Z",
		};

		ics = await setupIcsSubscription(obsidian, {
			initial: [
				keep,
				{ uid: "e2e-remove-a@test", summary: "Remove A", dtstart: "20261202T100000Z", dtend: "20261202T110000Z" },
				{ uid: "e2e-remove-b@test", summary: "Remove B", dtstart: "20261203T100000Z", dtend: "20261203T110000Z" },
			],
		});

		await ics.sync();
		await ics.waitForRequest();
		await ics.expectFileCount(3);

		ics.setRemoteEvents([
			keep,
			{ uid: "e2e-new-x@test", summary: "New X", dtstart: "20261204T100000Z", dtend: "20261204T110000Z" },
			{ uid: "e2e-new-y@test", summary: "New Y", dtstart: "20261205T100000Z", dtend: "20261205T110000Z" },
		]);
		ics.resetRequests();

		await ics.sync();
		await ics.waitForRequest();

		await expect.poll(() => ics.findEventFile("New X")).toBeDefined();
		await expect.poll(() => ics.findEventFile("New Y")).toBeDefined();
		await expect.poll(() => ics.findEventFile("Remove A")).toBeUndefined();
		await expect.poll(() => ics.findEventFile("Remove B")).toBeUndefined();
		expect(ics.findEventFile("Keep This")).toBeDefined();
		expect(ics.listEventFiles()).toHaveLength(3);
	});

	test("rapid re-syncs do not duplicate events", async ({ obsidian }) => {
		ics = await setupIcsSubscription(obsidian, {
			initial: [
				{
					uid: "e2e-rapid-1@test",
					summary: "Rapid Event",
					dtstart: "20261215T100000Z",
					dtend: "20261215T110000Z",
				},
			],
		});

		await ics.sync();
		await ics.sync();
		await ics.sync();

		await ics.waitForRequest(3);
		await ics.expectFileCount(1);
	});
});
