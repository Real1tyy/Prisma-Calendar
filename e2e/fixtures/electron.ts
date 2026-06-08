import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test as base, type Page } from "@playwright/test";
import {
	applyStandardRendererBoilerplate,
	createConsoleErrorGuard,
	createPluginE2eHarness,
	bootstrapObsidian as sharedBootstrap,
	writeStandardAppJson,
	type BootstrappedObsidian,
	type ObsidianWindow,
} from "@real1ty-obsidian-plugins/testing/e2e";

import { CONTEXT_MENU_ITEM_IDS } from "../../src/context-menu-items";
import { openCalendarReady } from "../specs/events/events-helpers";
import { PLUGIN_ID } from "./constants";
import { createCalendarHandle, type CalendarHandle } from "./dsl/calendar";

const E2E_ROOT = resolve(__dirname, "..");
const PLUGIN_ROOT = resolve(E2E_ROOT, "..");
const harness = createPluginE2eHarness({ e2eRoot: E2E_ROOT });

// Batch buttons seeded into every calendar so specs can exercise ones the
// production default hides (batchCloneNext / batchMoveNext / etc. — see
// DEFAULT_BATCH_ACTION_BUTTONS in src/constants.ts). Kept inline rather than
// imported from src to keep the fixture build-free.
const ALL_BATCH_BUTTONS = [
	"batchSelectAll",
	"batchClear",
	"batchDuplicate",
	"batchMoveBy",
	"batchMarkAsDone",
	"batchMarkAsNotDone",
	"batchCategories",
	"batchFrontmatter",
	"batchCloneNext",
	"batchClonePrev",
	"batchMoveNext",
	"batchMovePrev",
	"batchOpenAll",
	"batchSkip",
	"batchMakeVirtual",
	"batchMakeReal",
	"batchDelete",
];

// Every context menu item seeded as visible so specs can exercise items the
// production default hides (see DEFAULT_CONTEXT_MENU_ITEMS in
// src/context-menu-items.ts).
const DEFAULT_CALENDAR = {
	id: "default",
	name: "Main Calendar",
	enabled: true,
	directory: "Events",
	enableNotifications: false,
	autoAssignCategoryByName: false,
	autoAssignCategoryByIncludes: false,
	batchActionButtons: ALL_BATCH_BUTTONS,
	contextMenuItems: [...CONTEXT_MENU_ITEM_IDS],
};

const DEFAULT_PAGE_HEADER_STATE = {
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
};

export interface BootstrapOverrides {
	calendars?: Array<Record<string, unknown>>;
	keepDirs?: string[];
	/**
	 * Top-level data.json keys merged over the default seed (e.g. `caldav`,
	 * `icsSubscriptions`). Per-calendar fields still go under `calendars`.
	 */
	settings?: Record<string, unknown>;
}

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
// Any mode where a human is watching the window — demo implies it, and plain
// `E2E_HEADED=1` (set by `pnpm test:e2e:headed`) means the real Obsidian window
// is shown. Both should get maximize + sidebar-collapse polish for readability.
const HEADED_VISIBLE = process.env["E2E_HEADED"] === "1" || DEMO_SLOW_MO_MS > 0;

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

export async function bootstrapObsidian(
	options: { prefix?: string; overrides?: BootstrapOverrides } = {}
): Promise<BootstrappedObsidian> {
	const calendars = options.overrides?.calendars ?? [DEFAULT_CALENDAR];
	const keepDirs = options.overrides?.keepDirs ?? ["Events"];
	const extraSettings = options.overrides?.settings ?? {};

	return sharedBootstrap({
		version: harness.readVersion(),
		slowMoMs: DEMO_SLOW_MO_MS,
		polishVisibleWindow: HEADED_VISIBLE,
		vaultSeedDir: harness.vaultSeedDir,
		vaultsRoot: harness.vaultsRoot,
		prefix: options.prefix ?? "run",
		plugin: { id: PLUGIN_ID, rootDir: PLUGIN_ROOT },
		logger: harness.log,
		// Retained vaults are trimmed to just the events folder(s) and the
		// plugin's data.json on close — everything else (seeded Obsidian
		// config, staged plugin artifacts) is regeneratable and bloats the
		// cache.
		leanVaultOnClose: { keep: keepDirs },
		env: {
			PRISMA_LOG_LEVEL: harness.verbose ? "debug" : "warn",
		},
		onRendererReady: (page: Page) => applyStandardRendererBoilerplate(page, { verbose: harness.verbose }),
		seedPluginData: (pluginDir, { manifest }) => {
			// Pre-seed Prisma data.json so the calendar points at Events/, AND
			// suppress the "What's new" modal by pre-setting `version` to the
			// current plugin version (the modal fires when stored version differs).
			//
			// `pageHeaderState.visibleActionIds` is seeded so every toolbar button
			// an analytics E2E spec might click is present on first paint — the
			// production defaults hide several (including the plain "Create"
			// action) behind the gear menu.
			//
			// `writeStandardAppJson` writes `.obsidian/app.json` with
			// `alwaysUpdateLinks: true` so the "Update links" modal never appears
			// when the plugin renames an event file (e.g. on zettel-id assignment
			// or title change). That modal blocks subsequent test clicks.
			writeStandardAppJson(pluginDir);

			// Notifications default to ON in production. Tests seed events at wall-
			// clock-relative times (e.g. `today T09:00`) which fire the
			// notification-manager modal whenever the test runs within
			// MAX_PAST_NOTIFICATION_THRESHOLD (5h timed / 1d all-day) of the start.
			// That modal steals pointer events and breaks any right-click / click
			// flow the spec tries next. Flipping `enableNotifications: false` here
			// mutes the whole feature by default. Specs that specifically exercise
			// notifications must re-enable it (e.g. via the settings tab or by
			// rewriting data.json in the spec).
			writeFileSync(
				join(pluginDir, "data.json"),
				JSON.stringify(
					{
						version: manifest["version"] as string,
						calendars,
						pageHeaderState: DEFAULT_PAGE_HEADER_STATE,
						// Mark onboarding done by default so the tour (which now auto-starts
						// whenever tutorialCompleted is false) doesn't cover every spec's UI.
						// The tutorial specs opt back in with `settings: { tutorialCompleted: false }`.
						tutorialCompleted: true,
						...extraSettings,
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
			type PrismaPlugin = {
				calendarBundles?: Array<{ calendarId: string; initialize: () => Promise<void> }>;
				ensureCalendarBundlesReady?: () => Promise<void>;
			};
			await page.waitForFunction(
				(id) => {
					const w = window as unknown as ObsidianWindow;

					return Boolean((w.app.plugins.plugins[id] as PrismaPlugin | undefined)?.calendarBundles?.length);
				},
				PLUGIN_ID,
				{ timeout: 60_000 }
			);
			await page.evaluate(async (id) => {
				const w = window as unknown as ObsidianWindow;
				const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;

				if (!plugin) return;
				if (typeof plugin.ensureCalendarBundlesReady === "function") {
					await plugin.ensureCalendarBundlesReady();
				} else {
					for (const bundle of plugin.calendarBundles ?? []) {
						await bundle.initialize();
					}
				}
			}, PLUGIN_ID);
			harness.log.debug(`afterPluginLoaded: calendarBundles ready`);
		},
	});
}

type UseObsidian = (handle: BootstrappedObsidian) => Promise<void>;

// Plugin-specific transient pattern: some flows (undo-of-create / undo-of-clone)
// delete a file the metadata cache still has a pending read for. Obsidian
// surfaces that race as an `ENOENT … .md` console.error at teardown time —
// assertions on the actual disk state pass, but the console-error guard would
// otherwise fail the spec.
const PRISMA_TRANSIENT_PATTERNS: readonly RegExp[] = [/ENOENT.*\/Events\/[^/]+\.md/];

async function runWithObsidianHandle(
	options: { prefix: string; overrides?: BootstrapOverrides; expectedErrorPatterns?: readonly RegExp[] },
	use: UseObsidian
): Promise<void> {
	const handle = await bootstrapObsidian(options);
	const guard = createConsoleErrorGuard({
		extraTransientPatterns: PRISMA_TRANSIENT_PATTERNS,
		expectedErrorPatterns: options.expectedErrorPatterns ?? [],
	});
	guard.attach(handle.page);

	try {
		await use(handle);
	} finally {
		// Demo mode: hold the window open so a human can poke around the vault
		// state before teardown. If the user closes Obsidian manually during the
		// hold the subsequent `handle.close()` no-ops (browser/process `close()`
		// already tolerates a dead target).
		if (DEMO_HOLD_MS > 0) {
			harness.log.info(
				`demo hold: keeping Obsidian open for ${DEMO_HOLD_MS / 1000}s — inspect the vault, close manually to skip`
			);
			await handle.page.waitForTimeout(DEMO_HOLD_MS).catch(() => {});
		}
		guard.detach(handle.page);
		await handle.close();
	}

	guard.throwIfErrors();
}

// Opt-in DSL fixture shared across every `test*` variant. Factored out so each
// variant can mount the same `calendar` handle without duplicating the body.
// Each variant still owns its own `obsidian` fixture (different prefixes,
// overrides, error whitelists).
const calendarFixture = async (
	{ obsidian }: { obsidian: BootstrappedObsidian },
	use: (handle: CalendarHandle) => Promise<void>
): Promise<void> => {
	const handle = createCalendarHandle({ obsidian });
	// Headless runs keep Obsidian's default ~1280px window with the file-explorer
	// open, leaving the calendar leaf too narrow for the full page-header toolbar —
	// the responsive header then trims most actions into the overflow menu, where
	// specs that click them can't reach them directly. Emulate a wide desktop window
	// and collapse the sidebar *before* the view mounts so the header packs the whole
	// toolbar onto the bar from the first paint (no post-mount re-pack race), matching
	// how the plugin is actually used on desktop. Specs that exercise narrow layouts
	// (page-header overflow, mobile) override these metrics themselves afterwards.
	const cdp = await obsidian.page.context().newCDPSession(obsidian.page);
	await cdp.send("Emulation.setDeviceMetricsOverride", {
		width: 1600,
		height: 900,
		deviceScaleFactor: 1,
		mobile: false,
		screenWidth: 1600,
		screenHeight: 900,
	});
	await handle.collapseLeftSidebar();
	await openCalendarReady(obsidian.page);
	await use(handle);
};

export const test = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "spec" }, use);
	},
	// Opt-in DSL fixture: destructure `{ calendar }` instead of (or alongside)
	// `{ obsidian }` to get a CalendarHandle with the calendar view already
	// open. Classic `{ obsidian }`-only specs are unaffected — this fixture
	// only runs when a spec actually references `calendar`.
	calendar: calendarFixture,
});

/**
 * Patterns the resilience suite expects to see in the renderer console during
 * recovery paths. Kept as module-level consts so the list stays explicit —
 * every entry needs a matching spec scenario, or it should be deleted.
 */
/**
 * Specs that bulk-seed files via writeFileSync while Obsidian runs may trigger
 * a transient "File already exists" pageerror from the vault watcher. The files
 * are still created correctly — the error is a harmless race.
 */
export const FILE_SEED_EXPECTED_ERRORS: readonly RegExp[] = [/File already exists/];

export const testWithSeededFiles = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "seed-spec", expectedErrorPatterns: FILE_SEED_EXPECTED_ERRORS }, use);
	},
	calendar: calendarFixture,
});

export const RESILIENCE_EXPECTED_ERRORS: readonly RegExp[] = [
	// corrupt-data-json.spec.ts: truncated / schema-incompatible data.json
	/failed to read JSON.*prisma-calendar\/data\.json/,
	// unreadable-event-file.spec.ts: chmod 000 under Events/
	/EACCES.*\/Events\/.*\.md/,
];

/**
 * Variant of `test` that whitelists the resilience suite's expected recovery-
 * path renderer errors. Every spec under `specs/resilience/` should import
 * from here instead of the default `test`.
 */
export const testResilience = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "resilience-spec", expectedErrorPatterns: RESILIENCE_EXPECTED_ERRORS }, use);
	},
	calendar: calendarFixture,
});

/**
 * Patterns the ICS subscription E2E suite expects to see. The subscription
 * sync service logs `[ICS Subscription] Sync failed: …` on every error path
 * it handles (403, malformed ICS body, network failure). The whole point of
 * those specs is to prove the *plugin* stays up when those errors fire, so
 * the renderer error must not fail the test harness.
 */
export const ICS_SUBSCRIPTION_EXPECTED_ERRORS: readonly RegExp[] = [
	/\[ICS Subscription\].*Sync failed/,
	/\[ICSImport\] Failed to import event/,
];

/**
 * Variant of `test` for integration specs that exercise network/error paths
 * the plugin legitimately logs to the renderer console. Use for ICS
 * subscription and (future) CalDAV specs.
 */
export const testIntegrations = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle(
			{ prefix: "integration-spec", expectedErrorPatterns: ICS_SUBSCRIPTION_EXPECTED_ERRORS },
			use
		);
	},
	calendar: calendarFixture,
});

const NOTIFICATIONS_ON_OVERRIDES: BootstrapOverrides = {
	calendars: [{ ...DEFAULT_CALENDAR, enableNotifications: true }],
};

export const SEEDED_ICS_SUBSCRIPTION_ID = "seeded-sub";
export const SEEDED_ICS_SUBSCRIPTION_NAME = "Team Holidays";

const SEEDED_ICS_SUBSCRIPTION_OVERRIDES: BootstrapOverrides = {
	settings: {
		// `icsSubscriptions` lives at the data.json top level (alongside
		// `calendars`), not per-calendar — settings-store reads it via
		// mainSettingsStore.currentSettings.icsSubscriptions. See
		// CustomCalendarSettingsSchema in src/types/settings.ts.
		icsSubscriptions: {
			subscriptions: [
				{
					id: SEEDED_ICS_SUBSCRIPTION_ID,
					name: SEEDED_ICS_SUBSCRIPTION_NAME,
					urlSecretName: "",
					enabled: true,
					calendarId: DEFAULT_CALENDAR.id,
					syncIntervalMinutes: 1440,
					timezone: "UTC",
					createdAt: 1_700_000_000_000,
				},
			],
			// Every sync flag off so bootstrap doesn't attempt network I/O
			// for the seeded subscription. The delete path we exercise runs
			// entirely in-process.
			enableAutoSync: false,
			syncOnStartup: false,
			notifyOnSync: false,
			integrationEventColor: "#8b5cf6",
		},
	},
};

/**
 * Variant of `test` that seeds `enableNotifications: true` in data.json
 * before the plugin loads. Use for specs that exercise notification-bound UI
 * (e.g. "Notify minutes before" field in the event modal, or the notification
 * settings tab). Bypasses the pointer-event-stealing notification modal by
 * setting the toggle at bootstrap time rather than via the settings UI.
 *
 * Exposes the same opt-in `calendar` DSL fixture as the default `test`.
 */
export const testWithNotifications = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "notif-spec", overrides: NOTIFICATIONS_ON_OVERRIDES }, use);
	},
	calendar: calendarFixture,
});

const ONBOARDING_INCOMPLETE_OVERRIDES: BootstrapOverrides = {
	settings: { tutorialCompleted: false },
};

/**
 * Variant of `test` that seeds `tutorialCompleted: false` so the onboarding tour
 * auto-starts on launch. The default `test` seeds it `true` to keep the tour out
 * of every other spec, so this is the only fixture that exercises the auto-trigger.
 */
export const testOnboarding = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "onboarding-spec", overrides: ONBOARDING_INCOMPLETE_OVERRIDES }, use);
	},
	calendar: calendarFixture,
});

/**
 * Variant of `test` that seeds a single ICS subscription on the default
 * calendar so specs can exercise the subscription-list UI without going
 * through the (network-bound) add-subscription modal. Sync flags are all off
 * so bootstrap doesn't try to fetch the URL.
 */
export const testWithSeededICSSubscription = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "ics-sub-spec", overrides: SEEDED_ICS_SUBSCRIPTION_OVERRIDES }, use);
	},
	calendar: calendarFixture,
});

export const MULTI_CALENDAR_PRIMARY_ID = "primary";
export const MULTI_CALENDAR_SECONDARY_ID = "secondary";
export const MULTI_CALENDAR_PRIMARY_DIR = "EventsPrimary";
export const MULTI_CALENDAR_SECONDARY_DIR = "EventsSecondary";

const MULTI_CALENDAR_OVERRIDES: BootstrapOverrides = {
	calendars: [
		{
			...DEFAULT_CALENDAR,
			id: MULTI_CALENDAR_PRIMARY_ID,
			name: "Primary Calendar",
			directory: MULTI_CALENDAR_PRIMARY_DIR,
		},
		{
			...DEFAULT_CALENDAR,
			id: MULTI_CALENDAR_SECONDARY_ID,
			name: "Secondary Calendar",
			directory: MULTI_CALENDAR_SECONDARY_DIR,
		},
	],
	keepDirs: [MULTI_CALENDAR_PRIMARY_DIR, MULTI_CALENDAR_SECONDARY_DIR],
};

/**
 * Variant of `test` that seeds two independent calendar bundles so specs can
 * exercise cross-calendar semantics — undo-stack isolation, last-used bundle
 * resolution, etc. Use `openCalendarView(page, "primary"|"secondary")` to
 * switch between them.
 */
export const testMultiCalendar = base.extend<{
	obsidian: BootstrappedObsidian;
	calendar: CalendarHandle;
}>({
	// eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructuring even when no fixtures are needed
	obsidian: async ({}, use) => {
		await runWithObsidianHandle({ prefix: "multi-cal-spec", overrides: MULTI_CALENDAR_OVERRIDES }, use);
	},
	// Auto-opens the primary bundle (the `openCalendarView` fallback path picks
	// `calendarBundles[0]` when the default "default" id isn't present). Specs
	// that need to act on the secondary calendar call `openCalendarView(page,
	// "secondary")` themselves before using the handle.
	calendar: calendarFixture,
});

export const expect = test.expect;
