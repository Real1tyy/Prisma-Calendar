import {
	buildDebugBundle,
	buildDoctorReport,
	buildLicenseHealthCheck,
	buildRecentIssuesCheck,
	buildScopeIssuesCheck,
	describeDebugEnvironment,
	formatDoctorReport,
	HealthCheckRegistry,
	type HealthCheck,
} from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";

import { DEFAULT_EXPORT_FOLDER, PRISMA_CALENDAR_PLUGIN_ID } from "../constants";
import type CustomCalendarPlugin from "../main";
import type { IndexingTally } from "./indexing-stats";

/** Display name the debug bundle's header is titled with. */
const PLUGIN_DISPLAY_NAME = "Prisma Calendar";

/** The log scope indexing failures are reported under. */
const INDEXING_SCOPE = "indexing";

/**
 * Frontmatter keys whose values are the user's own content rather than plugin
 * state. They are already elided by the default redaction; naming them keeps
 * them elided when a calendar maps them onto unusual property names.
 * See [[decision-observability-privacy-posture]].
 */
function sensitiveKeys(plugin: CustomCalendarPlugin): string[] {
	const keys = new Set<string>();
	for (const bundle of plugin.calendarBundles) {
		const settings = bundle.settingsStore.currentSettings;
		for (const key of [
			settings.titleProp,
			settings.calendarTitleProp,
			settings.categoryProp,
			settings.locationProp,
			settings.participantsProp,
		]) {
			if (key) keys.add(key);
		}
	}
	return Array.from(keys).sort();
}

/**
 * Absolute vault root, so redaction can collapse it to `vault://` before
 * hashing the segments below it. Mobile has no filesystem adapter — redaction
 * still abbreviates every path it recognises, it just cannot anchor them.
 */
function vaultPath(app: App): string | undefined {
	const adapter = app.vault.adapter as { getBasePath?: () => string };
	return adapter.getBasePath?.();
}

function totalTally(plugin: CustomCalendarPlugin): IndexingTally | null {
	if (plugin.calendarBundles.length === 0) return null;
	const total: IndexingTally = {
		total: 0,
		timed: 0,
		allDay: 0,
		untracked: 0,
		dropped: 0,
		dropReasons: { "unparseable-date": 0, "unmapped-date-prop": 0, "trailing-space-key": 0 },
	};
	for (const bundle of plugin.calendarBundles) {
		const tally = bundle.getIndexingTally();
		total.total += tally.total;
		total.timed += tally.timed;
		total.allDay += tally.allDay;
		total.untracked += tally.untracked;
		total.dropped += tally.dropped;
		for (const [reason, count] of Object.entries(tally.dropReasons)) {
			total.dropReasons[reason as keyof IndexingTally["dropReasons"]] += count;
		}
	}
	return total;
}

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * The one row that answers "is the calendar actually seeing my notes?".
 * Aggregated across every planning system so the row is one stable line
 * however many calendars are configured.
 */
function buildIndexingCheck(plugin: CustomCalendarPlugin): HealthCheck | null {
	const tally = totalTally(plugin);
	if (tally === null) return null;

	const fix = {
		label: "Reindex",
		run: () => {
			for (const bundle of plugin.calendarBundles) bundle.refreshCalendar();
		},
	};
	const base = { id: "indexing", label: "Indexing", fix };
	const onCalendar = tally.timed + tally.allDay;

	const failures = plugin.logging.service.entries({ scope: INDEXING_SCOPE, level: "error" });
	if (failures.length > 0) {
		return {
			...base,
			status: "fail",
			detail: `Indexing reported ${plural(failures.length, "error")} in this session. Most recent: ${failures[failures.length - 1].message}`,
		};
	}

	if (tally.dropped > 0) {
		return {
			...base,
			status: "warn",
			detail: `${plural(tally.dropped, "note")} in your planning system could not be read as events — usually a date property that isn't a recognised date, or one that isn't mapped. The Planning system settings list each one.`,
		};
	}

	if (onCalendar === 0) {
		// The folder is deliberately not named. A check's `detail` can be attached
		// to a bug report, and free-text redaction is heuristic — a bare folder
		// name ("Clients") has no path shape to recognise, so it would travel
		// verbatim. The user already knows which folder they configured; naming it
		// helps them not at all and leaks it to us
		// ([[decision-observability-privacy-posture]] — paths go in structured
		// fields, messages stay structural).
		return {
			...base,
			status: "warn",
			detail: `No events are on the calendar yet, though ${plural(tally.total, "note")} were indexed — check the folder and the date properties in Settings → Planning system.`,
		};
	}

	return {
		...base,
		status: "ok",
		detail: `${plural(onCalendar, "event")} on the calendar, from ${plural(tally.total, "indexed note")}.`,
	};
}

/**
 * The plugin's check set, in the order the Doctor renders it: the specific
 * subsystems first, then the catch-all rollup that would otherwise repeat
 * whatever a row above already explained.
 */
export function createPrismaHealthChecks(plugin: CustomCalendarPlugin): HealthCheckRegistry {
	const registry = new HealthCheckRegistry();
	const entries = () => plugin.logging.service.snapshot();

	registry.register("indexing", () => buildIndexingCheck(plugin));
	registry.register("settings", () =>
		buildScopeIssuesCheck({
			id: "settings",
			label: "Settings",
			scope: "settings",
			entries: entries(),
			okDetail: "Settings loaded and migrated cleanly.",
		})
	);
	registry.register("license", () => buildLicenseHealthCheck({ status: plugin.licenseManager.status }));
	registry.register("recent-issues", () => buildRecentIssuesCheck({ entries: entries(), now: Date.now() }));

	return registry;
}

/**
 * The Doctor's report as the text a user pastes into a bug report — the health
 * verdict plus the same debug bundle the bug-report flow submits. Redacted by
 * `serializeForExport()` inside `formatDoctorReport`; `fullDetail` relaxes
 * paths and property values for a trusted recipient and never restores secrets.
 *
 * The wall clock is read here because this is a user gesture — the report is a
 * snapshot of "now", not an automatic write.
 */
export function buildPrismaDebugText(
	plugin: CustomCalendarPlugin,
	health: readonly HealthCheck[],
	fullDetail: boolean
): string {
	const report = buildDoctorReport(
		health,
		buildDebugBundle({
			now: Date.now(),
			entries: plugin.logging.service.snapshot(),
			environment: describeDebugEnvironment(PRISMA_CALENDAR_PLUGIN_ID, plugin.manifest.version),
		})
	);

	const base = vaultPath(plugin.app);
	return formatDoctorReport(report, {
		pluginName: PLUGIN_DISPLAY_NAME,
		...(base !== undefined ? { vaultPath: base } : {}),
		sensitiveKeys: sensitiveKeys(plugin),
		fullDetail,
	});
}

/** Timestamped so a second save never collides with the first. */
export function debugBundleFilename(now: Date): string {
	return `prisma-debug-${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;
}

/**
 * Writes the bundle into the calendar's export folder and returns the path.
 * An explicit user action, like the ICS export it sits beside — never
 * automatic, so it is not subject to the multi-device determinism rules.
 */
export async function savePrismaDebugFile(plugin: CustomCalendarPlugin, text: string): Promise<string> {
	const folder = plugin.calendarBundles[0]?.settingsStore.currentSettings.exportFolder || DEFAULT_EXPORT_FOLDER;
	if (!plugin.app.vault.getAbstractFileByPath(folder)) {
		await plugin.app.vault.createFolder(folder);
	}
	const path = `${folder}/${debugBundleFilename(new Date())}`;
	await plugin.app.vault.create(path, text);
	return path;
}
