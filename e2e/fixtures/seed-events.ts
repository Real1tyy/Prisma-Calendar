import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { expect, type Page } from "@playwright/test";

import { PLUGIN_ID } from "./constants";

// Disk-level event seeding + runtime introspection. These utilities bypass
// the create-event modal so specs that focus on integrations (ICS export,
// filter presets) or edge cases (DST, year boundary, 500-event stress) can
// arrive at a known event set without clicking through the UI. The modal
// flow itself is already covered by the specs under `specs/events/`.

export interface SeedEventInput {
	title: string;
	startDate?: string;
	endDate?: string;
	date?: string;
	allDay?: boolean;
	category?: string;
	location?: string;
	participants?: string[];
	rrule?: string;
	rruleSpec?: string;
	extra?: Record<string, unknown>;
	body?: string;
	subdir?: string;
}

function frontmatterValue(value: unknown): string {
	if (value === null || value === undefined) return '""';
	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		return `\n${value.map((v) => `  - ${String(v)}`).join("\n")}`;
	}
	if (typeof value === "string") {
		return value.includes(":") || value.includes("#") ? `"${value.replace(/"/g, '\\"')}"` : value;
	}
	return String(value);
}

export function seedEvent(vaultDir: string, event: SeedEventInput): string {
	const subdir = event.subdir ?? "Events";
	const filename = `${event.title.replace(/[/\\:*?"<>|]/g, "-")}.md`;
	const relative = join(subdir, filename);
	const absolute = join(vaultDir, relative);

	const fm: Record<string, unknown> = {};
	if (event.startDate) fm["Start Date"] = event.startDate;
	if (event.endDate) fm["End Date"] = event.endDate;
	if (event.date) fm["Date"] = event.date;
	if (event.allDay) fm["All Day"] = true;
	if (event.category) fm["Category"] = event.category;
	if (event.location) fm["Location"] = event.location;
	if (event.participants?.length) fm["Participants"] = event.participants;
	if (event.rrule) fm["RRule"] = event.rrule;
	if (event.rruleSpec) fm["RRuleSpec"] = event.rruleSpec;
	if (event.extra) {
		for (const [k, v] of Object.entries(event.extra)) fm[k] = v;
	}

	const fmLines = Object.entries(fm)
		.map(([k, v]) => `${k}: ${frontmatterValue(v)}`)
		.join("\n");
	const body = event.body ?? `# ${event.title}\n`;
	const content = `---\n${fmLines}\n---\n\n${body}`;

	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, content, "utf8");
	return relative;
}

export function seedEvents(vaultDir: string, events: readonly SeedEventInput[]): string[] {
	return events.map((e) => seedEvent(vaultDir, e));
}

/**
 * Mutate a single frontmatter field on an already-indexed vault file through
 * Obsidian's `processFrontMatter`. This is the ONLY write path that atomically
 * updates bytes AND the metadata cache in one step.
 *
 * Do NOT replace this with `writeFileSync` + a refresh/nudge. That older
 * pattern raced: if the vault watcher hadn't ingested the raw write yet, the
 * plugin's own background writes (or a "nudge" `processFrontMatter` call)
 * would read stale cached YAML and rewrite the file from the stale cache —
 * silently clobbering the change. Use raw `writeFileSync` only for SEEDING
 * (before the plugin indexes the file) where cache can't be stale.
 */
export async function setFrontmatterField(
	page: Page,
	relativePath: string,
	field: string,
	value: unknown
): Promise<void> {
	await page.evaluate(
		async ({ path, key, val }) => {
			const w = window as unknown as {
				app: {
					vault: { getAbstractFileByPath: (p: string) => unknown };
					fileManager: {
						processFrontMatter: (file: unknown, fn: (fm: Record<string, unknown>) => void) => Promise<void>;
					};
				};
			};
			const file = w.app.vault.getAbstractFileByPath(path);
			if (!file) throw new Error(`setFrontmatterField: no file at ${path}`);
			await w.app.fileManager.processFrontMatter(file, (fm) => {
				fm[key] = val;
			});
		},
		{ path: relativePath, key: field, val: value }
	);
}

/** Force Prisma's indexer to pick up on-disk changes via the refresh command. */
export async function refreshCalendar(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const w = window as unknown as {
			app: { commands: { executeCommandById: (id: string) => boolean } };
		};
		w.app.commands.executeCommandById("prisma-calendar:refresh-calendar");
		await new Promise((r) => setTimeout(r, 500));
	});
}

/** Read the default-calendar bundle's live settings snapshot. */
export async function readCalendarSettings(page: Page): Promise<Record<string, unknown>> {
	return page.evaluate((pid) => {
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							calendarBundles?: Array<{
								settingsStore: { currentSettings: Record<string, unknown> };
							}>;
						}
					>;
				};
			};
		};
		const plugin = w.app.plugins.plugins[pid];
		const bundle = plugin?.calendarBundles?.[0];
		if (!bundle) throw new Error("No calendar bundle");
		return bundle.settingsStore.currentSettings;
	}, PLUGIN_ID);
}

/** Shallow-merge a settings patch into the default-calendar bundle. */
export async function updateCalendarSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
	await page.evaluate(
		async ({ p, pid }) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								calendarBundles?: Array<{
									settingsStore: {
										currentSettings: Record<string, unknown>;
										updateSettings: (
											updater: (current: Record<string, unknown>) => Record<string, unknown>
										) => Promise<void>;
									};
								}>;
							}
						>;
					};
				};
			};
			const plugin = w.app.plugins.plugins[pid];
			const bundle = plugin?.calendarBundles?.[0];
			if (!bundle) throw new Error("No calendar bundle");
			await bundle.settingsStore.updateSettings((current) => ({ ...current, ...p }));
		},
		{ p: patch, pid: PLUGIN_ID }
	);
}

export async function waitForEventCount(page: Page, count: number, timeout = 30_000): Promise<void> {
	await expect
		.poll(() => getEventCount(page), {
			timeout,
			message: `indexer never reached ${count} events`,
		})
		.toBe(count);
}

/** Count events the plugin currently sees via the event store. */
export async function getEventCount(page: Page): Promise<number> {
	return page.evaluate((pid) => {
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							calendarBundles?: Array<{
								eventStore: { getAllEvents: () => unknown[] };
							}>;
						}
					>;
				};
			};
		};
		const plugin = w.app.plugins.plugins[pid];
		const bundle = plugin?.calendarBundles?.[0];
		if (!bundle) throw new Error("No calendar bundle");
		return bundle.eventStore.getAllEvents().length;
	}, PLUGIN_ID);
}

export async function waitForCalendarCount(page: Page, count: number): Promise<void> {
	await expect
		.poll(
			() =>
				page.evaluate((pid) => {
					const w = window as unknown as {
						app: { plugins: { plugins: Record<string, { calendarBundles?: unknown[] }> } };
					};
					return w.app.plugins.plugins[pid]?.calendarBundles?.length ?? 0;
				}, PLUGIN_ID),
			{ message: `waiting for ${count} calendar bundles` }
		)
		.toBe(count);
}
