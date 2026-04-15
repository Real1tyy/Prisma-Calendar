import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { type Page, test as base } from "@playwright/test";
import {
	bootstrapObsidian as sharedBootstrap,
	type BootstrappedObsidian,
	createFileLogger,
} from "@real1ty-obsidian-plugins/testing/e2e";

const E2E_ROOT = resolve(__dirname, "..");
const PLUGIN_ROOT = resolve(E2E_ROOT, "..");
const PLUGIN_ID = "prisma-calendar";

const CACHE_ROOT = join(E2E_ROOT, ".cache");
const VAULTS_ROOT = join(CACHE_ROOT, "vaults");
const LOG_FILE = join(CACHE_ROOT, "last-run.log");
const VERSION_FILE = join(E2E_ROOT, "obsidian-version.json");

const VERBOSE = process.env["E2E_VERBOSE"] === "1" || process.env["E2E_DEBUG"] === "1";
const log = createFileLogger(LOG_FILE, { verbose: VERBOSE });

export async function bootstrapObsidian(options: { prefix?: string } = {}): Promise<BootstrappedObsidian> {
	const version = JSON.parse(readFileSync(VERSION_FILE, "utf8")) as {
		appVersion: string;
		installerVersion: string;
	};

	return sharedBootstrap({
		version,
		vaultSeedDir: join(E2E_ROOT, "fixtures", "vault-seed"),
		vaultsRoot: VAULTS_ROOT,
		prefix: options.prefix ?? "run",
		plugin: { id: PLUGIN_ID, rootDir: PLUGIN_ROOT },
		logger: log,
		env: {
			PRISMA_LOG_LEVEL: VERBOSE ? "debug" : "warn",
		},
		onRendererReady: async (page: Page) => {
			// Silence Prisma's raw `console.log/info/debug` calls under the default
			// E2E run; they drown out Playwright's summary. `warn`/`error` still
			// flow through so real issues surface. Restore everything with
			// E2E_VERBOSE=1.
			if (VERBOSE) return;
			await page.evaluate(() => {
				const w = window as unknown as { E2E?: boolean };
				w.E2E = true;
				const noop = (): void => {};

				console.log = noop;

				console.info = noop;

				console.debug = noop;
			});
		},
		seedPluginData: (pluginDir, { manifest }) => {
			// Pre-seed Prisma data.json so the calendar points at Events/, AND
			// suppress the "What's new" modal by pre-setting `version` to the
			// current plugin version (the modal fires when stored version differs).
			const manifestVersion = manifest["version"] as string;
			writeFileSync(
				join(pluginDir, "data.json"),
				JSON.stringify(
					{
						version: manifestVersion,
						calendars: [{ id: "default", name: "Main Calendar", enabled: true, directory: "Events" }],
					},
					null,
					2
				),
				"utf8"
			);
		},
		afterPluginLoaded: async (page: Page) => {
			// CalendarBundles initialize lazily via workspace.onLayoutReady →
			// waitForCacheReady. Force them to resolve before tests run so the
			// plugin is fully usable (commands registered, views activatable).
			await page.waitForFunction(
				(id) => {
					const w = window as unknown as {
						app: { plugins: { plugins: Record<string, { calendarBundles?: unknown[] }> } };
					};
					return Boolean(w.app.plugins.plugins[id]?.calendarBundles?.length);
				},
				PLUGIN_ID,
				{ timeout: 60_000 }
			);
			await page.evaluate(async (id) => {
				const w = window as unknown as {
					app: {
						plugins: {
							plugins: Record<
								string,
								{
									ensureCalendarBundlesReady?: () => Promise<void>;
									calendarBundles?: Array<{ calendarId: string; initialize: () => Promise<void> }>;
								}
							>;
						};
					};
				};
				const plugin = w.app.plugins.plugins[id];
				if (!plugin) return;
				if (typeof plugin.ensureCalendarBundlesReady === "function") {
					await plugin.ensureCalendarBundlesReady();
				} else {
					for (const bundle of plugin.calendarBundles ?? []) {
						await bundle.initialize();
					}
				}
			}, PLUGIN_ID);
			log.debug(`afterPluginLoaded: calendarBundles ready`);
		},
	});
}

export const test = base.extend<{ obsidian: BootstrappedObsidian }>({
	// eslint-disable-next-line no-empty-pattern
	obsidian: async ({}, use) => {
		const handle = await bootstrapObsidian({ prefix: "spec" });
		await use(handle);
		await handle.close();
	},
});

export const expect = test.expect;
