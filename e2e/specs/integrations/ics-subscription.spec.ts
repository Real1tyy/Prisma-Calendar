import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { runCommand } from "../../fixtures/commands";
import { expect, testIntegrations as test } from "../../fixtures/electron";
import { unlockPro } from "../../fixtures/helpers";
import { buildIcs, type IcsServer, startIcsServer, type VEventInput } from "../../fixtures/ics-server";

// ICS URL subscriptions are a Pro feature. The full sync pipeline is:
//   palette → Sync ICS subscriptions → plugin.syncSingleICSSubscription →
//   bundle.syncICSSubscription → ICSSubscriptionSyncService.sync() →
//   requestUrl(GET subscription-url) → parseICSContent → computeSyncPlan →
//   disk writes. Every link in that chain can break in ways unit tests miss
//   (URL resolution, HTTP status handling, content-type, ICS parsing quirks,
//   UID-based dedup). We exercise it end-to-end with a local HTTP server so
//   the assertions land on real network round-trips and real file I/O.

const EVENTS_DIR = "Events";
const PLUGIN_ID = "prisma-calendar";
const SUBSCRIPTION_ID = "e2e-subscription";
const URL_SECRET_NAME = "e2e-ics-subscription-url";
const CALENDAR_ID = "default";

function listSubscribedEvents(vaultDir: string): string[] {
	const dir = join(vaultDir, EVENTS_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("Virtual Events"));
}

function deleteVaultSeedEvent(vaultDir: string): void {
	for (const f of listSubscribedEvents(vaultDir)) {
		unlinkSync(join(vaultDir, EVENTS_DIR, f));
	}
}

/**
 * Replace `app.secretStorage.getSecret` in the renderer so the subscription
 * reads our test URL without touching the OS keychain. Persistence in the real
 * keychain would leak between runs and collide with the user's actual secrets
 * if a developer ran the suite against their own Obsidian. A renderer-side
 * override is scoped to this page context — it dies when the page closes.
 */
async function stubSecretStorage(page: Page, secretName: string, secretValue: string): Promise<void> {
	await page.evaluate(
		({ name, value }) => {
			const w = window as unknown as {
				app: { secretStorage: { getSecret: (name: string) => unknown } };
			};
			const original = w.app.secretStorage.getSecret.bind(w.app.secretStorage);
			w.app.secretStorage.getSecret = (requested: string) => {
				if (requested === name) return value;
				return original(requested);
			};
		},
		{ name: secretName, value: secretValue }
	);
}

/**
 * Insert an ICS subscription into the settings store. Calling after boot is
 * safe — `syncICSSubscription` reads subscriptions from the settings store on
 * every invocation and lazily instantiates the sync service.
 */
async function addSubscription(
	page: Page,
	config: {
		id: string;
		name: string;
		calendarId: string;
		urlSecretName: string;
		timezone?: string;
		enabled?: boolean;
	}
): Promise<void> {
	await page.evaluate(
		({ pid, sub }) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								settingsStore?: {
									updateSettings?: (updater: (s: Record<string, unknown>) => Record<string, unknown>) => Promise<void>;
								};
							}
						>;
					};
				};
			};
			const store = w.app.plugins.plugins[pid]?.settingsStore;
			if (!store?.updateSettings) throw new Error("settingsStore.updateSettings missing");
			return store.updateSettings((current) => {
				const icsSubs = (current["icsSubscriptions"] as Record<string, unknown> | undefined) ?? {};
				const existing = (icsSubs["subscriptions"] as Array<Record<string, unknown>> | undefined) ?? [];
				const now = Date.now();
				const next = {
					id: sub.id,
					name: sub.name,
					calendarId: sub.calendarId,
					urlSecretName: sub.urlSecretName,
					timezone: sub.timezone ?? "UTC",
					enabled: sub.enabled ?? true,
					syncIntervalMinutes: 60,
					createdAt: now,
				};
				return {
					...current,
					icsSubscriptions: {
						...icsSubs,
						subscriptions: [...existing.filter((s) => s["id"] !== sub.id), next],
					},
				};
			});
		},
		{ pid: PLUGIN_ID, sub: config }
	);
}

async function triggerSync(page: Page): Promise<void> {
	await runCommand(page, "Prisma Calendar: Sync ICS subscriptions");
}

/**
 * Wait until the subscription's sync has completed at least one pass by
 * polling the server's request log. This is more robust than staring at the
 * file system: a sync that fails for any reason (auth, parse error, network
 * hiccup) still lands a request, and the spec can make error-path assertions
 * regardless of whether files appeared.
 */
async function waitForRequest(server: IcsServer, minRequests = 1): Promise<void> {
	await expect.poll(() => server.requests.length).toBeGreaterThanOrEqual(minRequests);
}

async function waitForEventFileCount(vaultDir: string, expected: number): Promise<void> {
	await expect.poll(() => listSubscribedEvents(vaultDir).length).toBe(expected);
}

interface SeededEventShape {
	uid: string;
	summary: string;
	dtstart: string;
	dtend?: string;
	allDay?: boolean;
}

function assertEventFileExists(vaultDir: string, summary: string): string {
	const files = listSubscribedEvents(vaultDir);
	const match = files.find((f) => f.includes(summary));
	expect(match, `expected a file for "${summary}" in ${files.join(", ")}`).toBeDefined();
	return match!;
}

test.describe("ICS URL subscription sync", () => {
	let server: IcsServer;

	test.beforeEach(async () => {
		server = await startIcsServer(buildIcs([]));
	});

	test.afterEach(async () => {
		await server.close();
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
		server.setBody(buildIcs(events));

		deleteVaultSeedEvent(obsidian.vaultDir);
		await stubSecretStorage(obsidian.page, URL_SECRET_NAME, server.url);
		await unlockPro(obsidian.page);
		await addSubscription(obsidian.page, {
			id: SUBSCRIPTION_ID,
			name: "E2E Feed",
			calendarId: CALENDAR_ID,
			urlSecretName: URL_SECRET_NAME,
		});

		await triggerSync(obsidian.page);
		await waitForRequest(server);
		await waitForEventFileCount(obsidian.vaultDir, events.length);

		for (const v of events) {
			const filename = assertEventFileExists(obsidian.vaultDir, v.summary);
			const fm = readEventFrontmatter(obsidian.vaultDir, `${EVENTS_DIR}/${filename}`);

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

		expect(server.requests[0]?.method).toBe("GET");
		expect(server.requests[0]?.path).toBe("/calendar.ics");
	});

	test("incremental sync adds new events, removes deleted events", async ({ obsidian }) => {
		const initial: SeededEventShape[] = [
			{
				uid: "e2e-stable@test",
				summary: "Stable Event",
				dtstart: "20261201T100000Z",
				dtend: "20261201T110000Z",
			},
			{
				uid: "e2e-deleted@test",
				summary: "To Be Deleted",
				dtstart: "20261202T100000Z",
				dtend: "20261202T110000Z",
			},
		];
		server.setBody(buildIcs(initial));

		deleteVaultSeedEvent(obsidian.vaultDir);
		await stubSecretStorage(obsidian.page, URL_SECRET_NAME, server.url);
		await unlockPro(obsidian.page);
		await addSubscription(obsidian.page, {
			id: SUBSCRIPTION_ID,
			name: "E2E Feed",
			calendarId: CALENDAR_ID,
			urlSecretName: URL_SECRET_NAME,
		});

		await triggerSync(obsidian.page);
		await waitForRequest(server);
		await waitForEventFileCount(obsidian.vaultDir, 2);

		// Second pass: remove one, add one. The sync planner should unlink the
		// deleted event's file and create the new one, leaving the stable
		// event untouched.
		const afterMutation: SeededEventShape[] = [
			{
				uid: "e2e-stable@test",
				summary: "Stable Event",
				dtstart: "20261201T100000Z",
				dtend: "20261201T110000Z",
			},
			{
				uid: "e2e-new@test",
				summary: "Newly Added",
				dtstart: "20261203T100000Z",
				dtend: "20261203T110000Z",
			},
		];
		server.setBody(buildIcs(afterMutation));
		server.resetRequests();

		await triggerSync(obsidian.page);
		await waitForRequest(server);

		// The sync deletes "To Be Deleted" and creates "Newly Added" asynchronously.
		// Poll until the expected final state materialises on disk.
		await expect.poll(() => listSubscribedEvents(obsidian.vaultDir).some((f) => f.includes("Newly Added"))).toBe(true);
		await expect
			.poll(() => listSubscribedEvents(obsidian.vaultDir).some((f) => f.includes("To Be Deleted")))
			.toBe(false);

		const files = listSubscribedEvents(obsidian.vaultDir);
		expect(files.some((f) => f.includes("Stable Event"))).toBe(true);
	});

	test("malformed ICS response leaves the vault untouched and the plugin alive", async ({ obsidian }) => {
		server.setBody("this is not an ICS file\n\n<!doctype html><html>sorry</html>");

		deleteVaultSeedEvent(obsidian.vaultDir);
		await stubSecretStorage(obsidian.page, URL_SECRET_NAME, server.url);
		await unlockPro(obsidian.page);
		await addSubscription(obsidian.page, {
			id: SUBSCRIPTION_ID,
			name: "E2E Feed",
			calendarId: CALENDAR_ID,
			urlSecretName: URL_SECRET_NAME,
		});

		await triggerSync(obsidian.page);
		await waitForRequest(server);

		// No files should land, plugin should still be operational (another
		// command runs cleanly afterwards).
		expect(listSubscribedEvents(obsidian.vaultDir)).toHaveLength(0);
		await runCommand(obsidian.page, "Prisma Calendar: Sync ICS subscriptions");
		await waitForRequest(server, 2);
	});

	test("HTTP 403 does not crash the plugin or touch the vault", async ({ obsidian }) => {
		server.setBody("Forbidden");
		server.setStatus(403);

		deleteVaultSeedEvent(obsidian.vaultDir);
		await stubSecretStorage(obsidian.page, URL_SECRET_NAME, server.url);
		await unlockPro(obsidian.page);
		await addSubscription(obsidian.page, {
			id: SUBSCRIPTION_ID,
			name: "E2E Feed",
			calendarId: CALENDAR_ID,
			urlSecretName: URL_SECRET_NAME,
		});

		await triggerSync(obsidian.page);
		await waitForRequest(server);

		expect(listSubscribedEvents(obsidian.vaultDir)).toHaveLength(0);

		// Flip the server back to a successful response and re-sync —
		// transient errors shouldn't permanently disable the subscription.
		server.setStatus(200);
		server.setBody(
			buildIcs([
				{
					uid: "e2e-recovered@test",
					summary: "Recovered",
					dtstart: "20261210T090000Z",
					dtend: "20261210T100000Z",
				},
			])
		);
		server.resetRequests();

		await triggerSync(obsidian.page);
		await waitForRequest(server);
		await waitForEventFileCount(obsidian.vaultDir, 1);
	});

	test("disabled subscription is skipped entirely (no network request)", async ({ obsidian }) => {
		server.setBody(
			buildIcs([
				{
					uid: "e2e-should-not-import@test",
					summary: "Should Not Import",
					dtstart: "20261220T100000Z",
					dtend: "20261220T110000Z",
				},
			])
		);

		deleteVaultSeedEvent(obsidian.vaultDir);
		await stubSecretStorage(obsidian.page, URL_SECRET_NAME, server.url);
		await unlockPro(obsidian.page);
		await addSubscription(obsidian.page, {
			id: SUBSCRIPTION_ID,
			name: "E2E Feed",
			calendarId: CALENDAR_ID,
			urlSecretName: URL_SECRET_NAME,
			enabled: false,
		});

		await triggerSync(obsidian.page);

		// Sync command short-circuits on disabled subscriptions before the
		// HTTP request. Give the command a moment to run, then assert.
		await obsidian.page.waitForTimeout(500);

		expect(server.requests).toHaveLength(0);
		expect(listSubscribedEvents(obsidian.vaultDir)).toHaveLength(0);
	});
});
