import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { type BootstrappedObsidian, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { runCommand } from "./commands";
import { expect } from "./electron";
import { unlockPro } from "./helpers";
import { buildIcs, type IcsServer, startIcsServer, type VEventInput } from "./ics-server";
import type { PrismaPlugin, PrismaWindow } from "./window-types";

// High-level DSL for ICS subscription specs. Owns the mock HTTP server,
// secret-storage stub, subscription seed, vault clean-up, and exposes polling
// helpers so specs read as a sequence of remote-state changes and on-disk
// assertions instead of repeating the same 100-line boilerplate per file.

const EVENTS_DIR = "Events";
const PLUGIN_ID = "prisma-calendar";
const SYNC_COMMAND = "Prisma Calendar: Sync ICS subscriptions";
const DEFAULT_SUBSCRIPTION_ID = "e2e-subscription";
const DEFAULT_SUBSCRIPTION_NAME = "E2E Feed";
const DEFAULT_CALENDAR_ID = "default";
const DEFAULT_URL_SECRET_NAME = "e2e-ics-subscription-url";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_SYNC_INTERVAL_MINUTES = 60;

export interface IcsSubscriptionConfig {
	id?: string;
	name?: string;
	calendarId?: string;
	urlSecretName?: string;
	timezone?: string;
	enabled?: boolean;
}

export interface SetupIcsOptions {
	/** Initial VEVENTs to serve from the mock server. Default: empty feed. */
	initial?: readonly VEventInput[];
	/** Override any subscription field; defaults serve a single enabled UTC sub. */
	subscription?: IcsSubscriptionConfig;
}

export interface IcsSubscriptionHandle {
	readonly server: IcsServer;
	/** Replace the served feed body with a fresh VEVENT set. */
	setRemoteEvents(events: readonly VEventInput[]): void;
	/** Serve an arbitrary body — used by malformed-input error-path specs. */
	setRawBody(body: string): void;
	/** Swap the HTTP status code (e.g., 403 / 500). */
	setStatus(status: number): void;
	/** Clear the recorded request log on the mock server. */
	resetRequests(): void;
	/** Trigger the sync command via the palette and wait for it to dismiss. */
	sync(): Promise<void>;
	/** Poll until the server has observed at least `minRequests` requests. */
	waitForRequest(minRequests?: number): Promise<void>;
	/** Snapshot of `.md` filenames under the Events dir, minus virtual-event files. */
	listEventFiles(): string[];
	findEventFile(summarySubstring: string): string | undefined;
	/** Like `findEventFile` but throws with a helpful diff if no match exists. */
	expectEventFile(summarySubstring: string): string;
	readFrontmatter(summarySubstring: string): Record<string, unknown> | undefined;
	expectFileCount(expected: number): Promise<void>;
	close(): Promise<void>;
}

export async function setupIcsSubscription(
	obsidian: BootstrappedObsidian,
	options: SetupIcsOptions = {}
): Promise<IcsSubscriptionHandle> {
	const config: Required<IcsSubscriptionConfig> = {
		id: options.subscription?.id ?? DEFAULT_SUBSCRIPTION_ID,
		name: options.subscription?.name ?? DEFAULT_SUBSCRIPTION_NAME,
		calendarId: options.subscription?.calendarId ?? DEFAULT_CALENDAR_ID,
		urlSecretName: options.subscription?.urlSecretName ?? DEFAULT_URL_SECRET_NAME,
		timezone: options.subscription?.timezone ?? DEFAULT_TIMEZONE,
		enabled: options.subscription?.enabled ?? true,
	};

	const server = await startIcsServer(buildIcs(options.initial ?? []));
	deleteAllEventFiles(obsidian.vaultDir);
	await stubSecretStorage(obsidian.page, config.urlSecretName, server.url);
	await unlockPro(obsidian.page);
	await addSubscription(obsidian.page, config);

	return {
		server,
		setRemoteEvents: (events) => server.setBody(buildIcs(events)),
		setRawBody: (body) => server.setBody(body),
		setStatus: (status) => server.setStatus(status),
		resetRequests: () => server.resetRequests(),
		sync: () => triggerSync(obsidian.page),
		waitForRequest: (minRequests = 1) => waitForRequest(server, minRequests),
		listEventFiles: () => listEventFiles(obsidian.vaultDir),
		findEventFile: (summarySubstring) => findEventFile(obsidian.vaultDir, summarySubstring),
		expectEventFile(summarySubstring) {
			const files = listEventFiles(obsidian.vaultDir);
			const match = files.find((f) => f.includes(summarySubstring));
			expect(match, `expected an event file containing "${summarySubstring}" in [${files.join(", ")}]`).toBeDefined();
			return match!;
		},
		readFrontmatter(summarySubstring) {
			const file = findEventFile(obsidian.vaultDir, summarySubstring);
			if (!file) return undefined;
			return readEventFrontmatter(obsidian.vaultDir, `${EVENTS_DIR}/${file}`);
		},
		expectFileCount: (expected) => expect.poll(() => listEventFiles(obsidian.vaultDir).length).toBe(expected),
		close: () => server.close(),
	};
}

function listEventFiles(vaultDir: string): string[] {
	const dir = join(vaultDir, EVENTS_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("Virtual Events"));
}

function deleteAllEventFiles(vaultDir: string): void {
	const dir = join(vaultDir, EVENTS_DIR);
	if (!existsSync(dir)) return;
	for (const f of readdirSync(dir).filter((x) => x.endsWith(".md"))) {
		unlinkSync(join(dir, f));
	}
}

function findEventFile(vaultDir: string, summarySubstring: string): string | undefined {
	return listEventFiles(vaultDir).find((f) => f.includes(summarySubstring));
}

// Replace `app.secretStorage.getSecret` in the renderer so the subscription
// reads our test URL without touching the OS keychain. Renderer-scoped — dies
// with the page; can't leak across runs.
async function stubSecretStorage(page: Page, secretName: string, secretValue: string): Promise<void> {
	await page.evaluate(
		({ name, value }) => {
			const w = window as unknown as PrismaWindow;
			const original = w.app.secretStorage.getSecret.bind(w.app.secretStorage);
			w.app.secretStorage.getSecret = (requested: string) => (requested === name ? value : original(requested));
		},
		{ name: secretName, value: secretValue }
	);
}

// `syncICSSubscription` re-reads from the settings store on every invocation,
// so inserting after boot is safe — no re-bootstrap needed.
async function addSubscription(page: Page, sub: Required<IcsSubscriptionConfig>): Promise<void> {
	await page.evaluate(
		({ pid, sub, syncIntervalMinutes }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			const store = plugin?.settingsStore;
			if (!store?.updateSettings) throw new Error("settingsStore.updateSettings missing");
			return store.updateSettings((current) => {
				const icsSubs = (current["icsSubscriptions"] as Record<string, unknown> | undefined) ?? {};
				const existing = (icsSubs["subscriptions"] as Array<Record<string, unknown>> | undefined) ?? [];
				return {
					...current,
					icsSubscriptions: {
						...icsSubs,
						subscriptions: [
							...existing.filter((s) => s["id"] !== sub.id),
							{ ...sub, syncIntervalMinutes, createdAt: Date.now() },
						],
					},
				};
			});
		},
		{ pid: PLUGIN_ID, sub, syncIntervalMinutes: DEFAULT_SYNC_INTERVAL_MINUTES }
	);
}

async function triggerSync(page: Page): Promise<void> {
	await runCommand(page, SYNC_COMMAND);
}

// Polling the request log is more robust than polling the file system: a sync
// that fails (auth, parse error, network hiccup) still lands a request, so
// error-path specs can assert regardless of whether files appeared.
async function waitForRequest(server: IcsServer, minRequests: number): Promise<void> {
	await expect.poll(() => server.requests.length).toBeGreaterThanOrEqual(minRequests);
}
