import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { type ConsoleMessage, type Page, test as base } from "@playwright/test";
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

// Demo mode: `PW_DEMO=1` (or any positive int value, interpreted as ms) slows
// every Playwright operation so you can watch what the suite does. The wrapper
// script also forces headed mode when PW_DEMO is set, so a visible Obsidian
// window shows up.
//
// slowMo only paces Playwright's own input primitives (click/fill/press). Most
// of `fill-event-modal.ts` drives fields via `page.evaluate()` against the
// exposed `__prismaActiveEventModal` — those calls bypass slowMo entirely, so
// the visible pacing came out much faster than the raw slowMo value suggested.
// The `demoPause` helper is sprinkled between those evaluate-driven steps to
// restore the intended pacing.
const DEMO_DEFAULT_SLOW_MO_MS = 500;
const DEMO_DEFAULT_HOLD_SECONDS = 10;

function resolveDemoSlowMo(): number {
	const raw = process.env["PW_DEMO"];
	if (!raw || raw === "0" || raw === "false") return 0;
	if (raw === "1" || raw === "true") return DEMO_DEFAULT_SLOW_MO_MS;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : DEMO_DEFAULT_SLOW_MO_MS;
}

function resolveDemoHoldMs(slowMoMs: number): number {
	// Hold only makes sense when demo is active; otherwise CI would block 10s per
	// spec for no reason.
	if (slowMoMs <= 0) return 0;
	const raw = process.env["PW_DEMO_HOLD"];
	if (raw === undefined || raw === "") return DEMO_DEFAULT_HOLD_SECONDS * 1000;
	if (raw === "0" || raw === "false") return 0;
	const parsed = Number.parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed * 1000 : DEMO_DEFAULT_HOLD_SECONDS * 1000;
}

const DEMO_SLOW_MO_MS = resolveDemoSlowMo();
const DEMO_HOLD_MS = resolveDemoHoldMs(DEMO_SLOW_MO_MS);

/**
 * Pause between evaluate-driven field sets in demo mode so glass-box steps
 * (chip lists, schema-form fields, custom properties, recurring widgets) pace
 * at the same visible speed as slowMo'd clicks. No-op outside demo mode.
 */
export async function demoPause(page: Page): Promise<void> {
	if (DEMO_SLOW_MO_MS <= 0) return;
	await page.waitForTimeout(DEMO_SLOW_MO_MS);
}

export const demoMode = {
	slowMoMs: DEMO_SLOW_MO_MS,
	holdMs: DEMO_HOLD_MS,
	enabled: DEMO_SLOW_MO_MS > 0,
};

export async function bootstrapObsidian(options: { prefix?: string } = {}): Promise<BootstrappedObsidian> {
	const version = JSON.parse(readFileSync(VERSION_FILE, "utf8")) as {
		appVersion: string;
		installerVersion: string;
	};

	return sharedBootstrap({
		version,
		slowMoMs: DEMO_SLOW_MO_MS,
		vaultSeedDir: join(E2E_ROOT, "fixtures", "vault-seed"),
		vaultsRoot: VAULTS_ROOT,
		prefix: options.prefix ?? "run",
		plugin: { id: PLUGIN_ID, rootDir: PLUGIN_ROOT },
		logger: log,
		// Retained vaults are trimmed to just the events folder and the plugin's
		// data.json on close — everything else (seeded Obsidian config, staged
		// plugin artifacts) is regeneratable and bloats the cache.
		leanVaultOnClose: { keep: ["Events"] },
		env: {
			PRISMA_LOG_LEVEL: VERBOSE ? "debug" : "warn",
		},
		onRendererReady: async (page: Page) => {
			// Always mark the renderer as E2E — plugin code uses this flag to enable
			// testability hooks (e.g., exposing the active event modal instance).
			await page.evaluate(
				({ verbose }) => {
					const w = window as unknown as { E2E?: boolean };
					w.E2E = true;
					if (verbose) return;
					// Silence Prisma's raw `console.log/info/debug` under the default
					// E2E run; they drown out Playwright's summary. `warn`/`error`
					// still flow through. Restore everything with E2E_VERBOSE=1.
					const noop = (): void => {};

					console.log = noop;

					console.info = noop;

					console.debug = noop;
				},
				{ verbose: VERBOSE }
			);
		},
		seedPluginData: (pluginDir, { manifest }) => {
			// Pre-seed Prisma data.json so the calendar points at Events/, AND
			// suppress the "What's new" modal by pre-setting `version` to the
			// current plugin version (the modal fires when stored version differs).
			//
			// `pageHeaderState.visibleActionIds` is seeded so every toolbar button
			// an analytics E2E spec might click is present on first paint — the
			// production defaults hide several (including the plain "Create"
			// action) behind the gear menu.
			const manifestVersion = manifest["version"] as string;
			writeFileSync(
				join(pluginDir, "data.json"),
				JSON.stringify(
					{
						version: manifestVersion,
						calendars: [{ id: "default", name: "Main Calendar", enabled: true, directory: "Events" }],
						pageHeaderState: {
							visibleActionIds: [
								"create-event",
								"create-untracked",
								"go-to-today",
								"scroll-to-now",
								"navigate-back",
								"navigate-forward",
								"global-search",
								"toggle-batch",
								"daily-stats",
								"weekly-stats",
								"monthly-stats",
								"alltime-stats",
								"toggle-prerequisites",
								"refresh",
							],
						},
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
		// Surface renderer-side failures as spec failures. `console.error` is
		// kept live by the onRendererReady silencer (only log/info/debug are
		// nooped), and uncaught exceptions reach us via `pageerror`. Collecting
		// both here replaces the standalone plugin-load "no console errors"
		// smoke test with a guard that fires on every spec.
		const consoleErrors: string[] = [];
		const onConsole = (msg: ConsoleMessage): void => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		};
		const onPageError = (err: Error): void => {
			consoleErrors.push(`pageerror: ${err.message}`);
		};
		handle.page.on("console", onConsole);
		handle.page.on("pageerror", onPageError);

		await use(handle);
		// Demo mode: hold the window open so a human can poke around the vault
		// state before teardown. If the user closes Obsidian manually during the
		// hold the subsequent `handle.close()` no-ops (browser/process `close()`
		// already tolerates a dead target).
		if (DEMO_HOLD_MS > 0) {
			log.info(
				`demo hold: keeping Obsidian open for ${DEMO_HOLD_MS / 1000}s — inspect the vault, close manually to skip`
			);
			await handle.page.waitForTimeout(DEMO_HOLD_MS).catch(() => {});
		}
		handle.page.off("console", onConsole);
		handle.page.off("pageerror", onPageError);
		await handle.close();
		if (consoleErrors.length > 0) {
			throw new Error(`renderer emitted ${consoleErrors.length} error(s):\n${consoleErrors.join("\n")}`);
		}
	},
});

export const expect = test.expect;
