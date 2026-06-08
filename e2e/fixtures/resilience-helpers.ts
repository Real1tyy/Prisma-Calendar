import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { PLUGIN_ID } from "./constants";
import { seedEvent, type SeedEventInput } from "./seed-events";
import type { PrismaPlugin, PrismaWindow } from "./window-types";

export function dataJsonPath(vaultDir: string): string {
	// test fixture intentionally seeds the Obsidian config directory by path
	return join(vaultDir, ".obsidian", "plugins", PLUGIN_ID, "data.json");
}

/**
 * Write raw bytes into `<vault>/Events/<fileName>` without running them through
 * `seedEvent`'s structured frontmatter builder. Use only when the spec needs
 * an intentionally malformed file (invalid YAML, truncated blocks) — all
 * well-formed seeding should go through `seedEvent`.
 */
export function writeRawEventFile(vaultDir: string, fileName: string, content: string): string {
	const relative = join("Events", fileName);
	writeFileSync(join(vaultDir, relative), content, "utf8");
	return relative;
}

/**
 * Reload Obsidian's renderer and wait until prisma-calendar is fully ready
 * again: plugin loaded, calendar bundles initialized, layout ready. Use this
 * after mutating files on disk (data.json, event frontmatter) to observe how
 * the plugin reacts to the new on-disk state from a cold boot.
 *
 * Repeats the bootstrap dance (`setEnable` → `loadManifests` → `enablePlugin`)
 * because `community-plugins.json` persists the enabled set, but some Obsidian
 * builds still start with `setEnable(false)` on a fresh renderer.
 */
export async function reloadAndWaitForPrisma(page: Page): Promise<void> {
	// Obsidian debounces `workspace.requestSaveLayout`; if we reload before it
	// fires, leaves opened via `setViewState` never reach `workspace.json` and
	// the renderer reboots without them. Flush the debouncer synchronously
	// before tearing the renderer down.
	await page.evaluate(async () => {
		await (window as unknown as PrismaWindow).app.workspace.requestSaveLayout.run();
	});

	await page.reload({ waitUntil: "domcontentloaded" });

	await page.waitForFunction(() => Boolean((window as unknown as { app?: { plugins?: unknown } }).app?.plugins));

	await page.evaluate(async (id) => {
		const w = window as unknown as PrismaWindow;
		const plugins = w.app.plugins;
		try {
			if (typeof plugins.setEnable === "function") await plugins.setEnable(true);
			if (typeof plugins.loadManifests === "function") await plugins.loadManifests();
			if (!plugins.plugins[id]) {
				if (typeof plugins.enablePluginAndSave === "function") await plugins.enablePluginAndSave(id);
				else if (typeof plugins.enablePlugin === "function") await plugins.enablePlugin(id);
			}
		} catch {
			// best-effort; the waitForFunction below is the real gate
		}
	}, PLUGIN_ID);

	await page.waitForFunction((id) => Boolean((window as unknown as PrismaWindow).app.plugins.plugins[id]), PLUGIN_ID);

	// Some malformed-state tests may end up with zero bundles — that's a
	// valid assertion target rather than a harness failure.
	await page
		.waitForFunction((id) => {
			const plugin = (window as unknown as PrismaWindow).app.plugins.plugins[id] as PrismaPlugin | undefined;
			return Boolean(plugin?.calendarBundles?.length);
		}, PLUGIN_ID)
		.catch(() => {});

	await page.evaluate(async (id) => {
		const w = window as unknown as PrismaWindow;
		const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
		if (plugin && typeof plugin.ensureCalendarBundlesReady === "function") {
			await plugin.ensureCalendarBundlesReady();
		}
	}, PLUGIN_ID);
}

/** Disable the plugin via the community-plugins runtime API. */
export async function disablePrisma(page: Page): Promise<void> {
	await page.evaluate(async (id) => {
		const w = window as unknown as PrismaWindow;
		const plugins = w.app.plugins;
		if (typeof plugins.disablePluginAndSave === "function") await plugins.disablePluginAndSave(id);
		else if (typeof plugins.disablePlugin === "function") await plugins.disablePlugin(id);
		else throw new Error("no disable fn");
	}, PLUGIN_ID);
}

/** Re-enable the plugin via the community-plugins runtime API and wait until bundles are back. */
export async function enablePrisma(page: Page): Promise<void> {
	await page.evaluate(async (id) => {
		const w = window as unknown as PrismaWindow;
		const plugins = w.app.plugins;
		if (typeof plugins.enablePluginAndSave === "function") await plugins.enablePluginAndSave(id);
		else if (typeof plugins.enablePlugin === "function") await plugins.enablePlugin(id);
		else throw new Error("no enable fn");
	}, PLUGIN_ID);

	await page.waitForFunction(
		(id) => {
			const plugin = (window as unknown as PrismaWindow).app.plugins.plugins[id] as PrismaPlugin | undefined;
			return Boolean(plugin?.calendarBundles?.length);
		},
		PLUGIN_ID,
		{ timeout: 30_000 }
	);
}

/**
 * Shallow-merge `patch` into the default calendar entry (index 0 by default).
 * Every top-level key in `patch` overrides the corresponding key on the
 * calendar record. Use for toggling boolean/string/dropdown fields before a
 * reload-barrier assertion — see reload-preserves-settings.spec.ts.
 */
export async function patchDefaultCalendar(
	page: Page,
	patch: Record<string, unknown>,
	calendarIndex = 0
): Promise<void> {
	await page.evaluate(
		async ({ id, p, i }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
			if (!plugin?.settingsStore?.updateSettings) throw new Error("settingsStore.updateSettings missing");
			await plugin.settingsStore.updateSettings((current) => {
				const calendars = (current["calendars"] as Array<Record<string, unknown>> | undefined) ?? [];
				if (!calendars[i]) throw new Error(`no calendar at index ${i}`);
				const next = [...calendars];
				next[i] = { ...next[i], ...p };
				return { ...current, calendars: next };
			});
			if (typeof plugin.ensureCalendarBundlesReady === "function") {
				await plugin.ensureCalendarBundlesReady();
			}
		},
		{ id: PLUGIN_ID, p: patch, i: calendarIndex }
	);
}

/**
 * Append a calendar record to the settings store, cloning the first calendar's
 * fields as a base so defaults are carried over. `overrides` wins.
 *
 * Default behaviour runs `refreshCalendarBundles` so the new calendar gets a
 * live bundle — `ensureCalendarBundlesReady` only initializes existing bundles,
 * not new ones.
 *
 * Pass `{ preserveActiveView: true }` to spin up ONLY the new bundle via
 * `plugin.addCalendarBundle`. The primary's mounted view and painted events
 * stay untouched — required when a spec has already rendered a tile in the
 * primary calendar and is about to interact with it (e.g. right-click + move).
 */
export async function addCalendar(
	page: Page,
	overrides: Record<string, unknown>,
	options: { preserveActiveView?: boolean } = {}
): Promise<void> {
	const preserveActiveView = options.preserveActiveView ?? false;
	await page.evaluate(
		async ({ id, o, preserve }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
			if (!plugin?.settingsStore?.updateSettings) throw new Error("settingsStore.updateSettings missing");
			const targetId = String(o["id"]);
			await plugin.settingsStore.updateSettings((current) => {
				const calendars = (current["calendars"] as Array<Record<string, unknown>> | undefined) ?? [];
				if (calendars.some((c) => c["id"] === targetId)) return current;
				const base = calendars[0] ?? {};
				return { ...current, calendars: [...calendars, { ...base, ...o }] };
			});
			if (preserve) {
				if (typeof plugin.addCalendarBundle !== "function") throw new Error("plugin.addCalendarBundle missing");
				await plugin.addCalendarBundle(targetId);
			} else if (typeof plugin.refreshCalendarBundles === "function") {
				await plugin.refreshCalendarBundles();
			} else if (typeof plugin.ensureCalendarBundlesReady === "function") {
				await plugin.ensureCalendarBundlesReady();
			}
		},
		{ id: PLUGIN_ID, o: overrides, preserve: preserveActiveView }
	);
}

/**
 * Read the currently-active view tab id from the live settings store.
 * Returns `null` when the settings haven't been written yet (e.g. first boot
 * before any tab switch).
 */
export async function readActiveTab(page: Page): Promise<string | null> {
	return page.evaluate((id) => {
		const w = window as unknown as PrismaWindow;
		const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
		const settings = plugin?.settingsStore?.currentSettings;
		if (!settings) return null;
		const activeTab = settings["activeTab"] as { visibleTabIds?: string[]; activeTabIndex?: number } | undefined;
		if (!activeTab?.visibleTabIds || activeTab.activeTabIndex === undefined) return null;
		return activeTab.visibleTabIds[activeTab.activeTabIndex] ?? null;
	}, PLUGIN_ID);
}

/** Read the Nth (default: 0) calendar entry from the live settings store. */
export async function readLiveCalendar(page: Page, index = 0): Promise<Record<string, unknown> | null> {
	return page.evaluate(
		({ id, i }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[id] as PrismaPlugin | undefined;
			const calendars = plugin?.settingsStore?.currentSettings?.["calendars"] as
				| Array<Record<string, unknown>>
				| undefined;
			return calendars?.[i] ?? null;
		},
		{ id: PLUGIN_ID, i: index }
	);
}

export async function activateCalendar(page: Page, calendarId: string): Promise<void> {
	// `refreshCalendarBundles` resolves the promise before the new bundle's
	// `initialize()` runs; the bundle array updates synchronously but the
	// `activateCalendarView` path isn't wired up until init completes. Poll
	// rather than relying on the prior await to finish everything.
	await page.waitForFunction(
		({ id, pid }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			return Boolean(plugin?.calendarBundles?.some((b) => b.calendarId === id));
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
	await page.evaluate(
		async ({ id, pid }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			const bundle = plugin?.calendarBundles?.find((b) => b.calendarId === id);
			if (!bundle?.activateCalendarView) throw new Error(`no bundle for ${id}`);
			await bundle.activateCalendarView();
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
}

export async function countLeavesOfType(page: Page, viewType: string): Promise<number> {
	return page.evaluate((t) => {
		const w = window as unknown as PrismaWindow;
		return w.app.workspace.getLeavesOfType(t).length;
	}, viewType);
}

/**
 * Return vault paths whose frontmatter has `ZettelID` matching `zettelId`.
 * Compares after `String()` coercion so an unquoted-numeric ZettelID that
 * YAML parsed as a number still matches a string-shaped query.
 */
export async function resolveByZettelId(page: Page, zettelId: string): Promise<string[]> {
	return page.evaluate((id) => {
		const w = window as unknown as PrismaWindow;
		const winners: string[] = [];
		for (const f of w.app.vault.getFiles()) {
			// frontmatter is untyped in Obsidian API
			const fm = w.app.metadataCache.getFileCache(f)?.frontmatter;
			// frontmatter fields are dynamically keyed
			if (fm && String(fm["ZettelID"]) === id) winners.push(f.path);
		}
		return winners;
	}, zettelId);
}

/** For each `endsWith` needle, return whether any vault path ends with it. */
export async function vaultHasFilesEndingWith(page: Page, needles: readonly string[]): Promise<boolean[]> {
	return page.evaluate((ends) => {
		const w = window as unknown as PrismaWindow;
		const haystack = w.app.vault.getFiles().map((f) => f.path);
		return ends.map((n) => haystack.some((h) => h.endsWith(n)));
	}, needles);
}

/** Seed a batch of events on disk via `seedEvent` and return the relative paths. */
export function seedEventFiles(vaultDir: string, events: readonly SeedEventInput[]): string[] {
	return events.map((e) => seedEvent(vaultDir, e));
}

export { PLUGIN_ID };
