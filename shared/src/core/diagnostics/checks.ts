import { getLicenseStatusText } from "../license/status-text";
import type { LicenseStatus } from "../license/types";
import { DEBUG_BUNDLE_WINDOW_MS } from "../logging/debug-bundle";
import type { LogEntry } from "../logging/types";
import type { HealthCheck, HealthCheckFix } from "./health";

const MINUTE_MS = 60_000;

function plural(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** `indexing 3, sync 1` — count-descending, then alphabetical so it is stable. */
function tallyByScope(entries: readonly LogEntry[]): string {
	const counts = new Map<string, number>();
	for (const entry of entries) counts.set(entry.scope, (counts.get(entry.scope) ?? 0) + 1);
	return Array.from(counts)
		.sort(([scopeA, countA], [scopeB, countB]) => countB - countA || scopeA.localeCompare(scopeB))
		.map(([scope, count]) => `${scope} ${count}`)
		.join(", ");
}

function countLine(errors: number, warnings: number): string {
	const parts: string[] = [];
	if (errors > 0) parts.push(plural(errors, "error"));
	if (warnings > 0) parts.push(plural(warnings, "warning"));
	return parts.join(" and ");
}

function withFix(check: HealthCheck, fix: HealthCheckFix | undefined): HealthCheck {
	return fix === undefined ? check : { ...check, fix };
}

export interface RecentIssuesCheckOptions {
	/** The log buffer, oldest-first. */
	entries: readonly LogEntry[];
	/** Epoch ms the window is measured back from — injected, never read here. */
	now: number;
	/** Defaults to the same window the debug bundle uses, so the row and the export agree. */
	windowMs?: number;
	id?: string;
	label?: string;
	fix?: HealthCheckFix;
}

/**
 * The catch-all row: everything that went wrong recently, rolled up by scope.
 * Any error fails the check; warnings alone warn. It is deliberately the last
 * row — a specific check above it usually explains the same entries better.
 */
export function buildRecentIssuesCheck(options: RecentIssuesCheckOptions): HealthCheck {
	const windowMs = options.windowMs ?? DEBUG_BUNDLE_WINDOW_MS;
	const windowMinutes = windowMs / MINUTE_MS;
	const since = options.now - windowMs;
	const recent = options.entries.filter(
		(entry) => entry.ts >= since && (entry.level === "warn" || entry.level === "error")
	);
	const id = options.id ?? "recent-issues";
	const label = options.label ?? "Recent errors and warnings";

	if (recent.length === 0) {
		return {
			id,
			label,
			status: "ok",
			detail: `Nothing went wrong in the last ${windowMinutes} minutes.`,
		};
	}

	const errors = recent.filter((entry) => entry.level === "error").length;
	const warnings = recent.length - errors;
	return withFix(
		{
			id,
			label,
			status: errors > 0 ? "fail" : "warn",
			detail: `${countLine(errors, warnings)} in the last ${windowMinutes} minutes (${tallyByScope(recent)}).`,
		},
		options.fix
	);
}

export interface ScopeIssuesCheckOptions {
	id: string;
	label: string;
	/** The log scope(s) this row speaks for, e.g. `"settings"`. */
	scope: string | readonly string[];
	entries: readonly LogEntry[];
	/** The sentence shown when the scope recorded nothing. */
	okDetail: string;
	fix?: HealthCheckFix;
}

/**
 * A row for one subsystem, over the **whole buffer** rather than a window —
 * settings and migrations fail at load, which is already minutes old by the
 * time anyone opens the Doctor.
 */
export function buildScopeIssuesCheck(options: ScopeIssuesCheckOptions): HealthCheck {
	const scopes = new Set(typeof options.scope === "string" ? [options.scope] : options.scope);
	const issues = options.entries.filter(
		(entry) => scopes.has(entry.scope) && (entry.level === "warn" || entry.level === "error")
	);
	const { id, label } = options;

	if (issues.length === 0) return { id, label, status: "ok", detail: options.okDetail };

	const errors = issues.filter((entry) => entry.level === "error").length;
	const warnings = issues.length - errors;
	const mostRecent = issues[issues.length - 1].message;
	return withFix(
		{
			id,
			label,
			status: errors > 0 ? "fail" : "warn",
			detail: `${countLine(errors, warnings)} in this session. Most recent: ${mostRecent}`,
		},
		options.fix
	);
}

export interface LicenseHealthCheckOptions {
	status: LicenseStatus;
	id?: string;
	label?: string;
	fix?: HealthCheckFix;
}

/**
 * License state in the user's words, reusing the same copy the License section
 * shows. Never `fail`: an inactive licence turns Pro features off, it does not
 * break the plugin, and a red row would read as "something is broken".
 */
export function buildLicenseHealthCheck(options: LicenseHealthCheckOptions): HealthCheck {
	const { status } = options;
	const healthy = status.state === "valid" || status.state === "none";
	return withFix(
		{
			id: options.id ?? "license",
			label: options.label ?? "License",
			status: healthy ? "ok" : "warn",
			detail: getLicenseStatusText(status),
		},
		options.fix
	);
}
