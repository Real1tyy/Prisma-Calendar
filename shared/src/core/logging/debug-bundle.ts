import type { LogEntry, LogLevel } from "./types";

/**
 * How far back "recent" reaches. Fifteen minutes is long enough to contain the
 * session that went wrong and short enough that the bundle stays readable in a
 * support thread ([[spec-doctor-health-and-quick-debug-export]]).
 */
export const DEBUG_BUNDLE_WINDOW_MS = 15 * 60 * 1000;

/** Per-list cap. A bundle that outgrows this is noise, not signal — and it has to fit in a POST. */
export const DEBUG_BUNDLE_MAX_ENTRIES = 200;

const PROBLEM_LEVELS: ReadonlySet<LogLevel> = new Set<LogLevel>(["warn", "error"]);

export interface DebugEnvironment {
	pluginId: string;
	pluginVersion: string;
	obsidianVersion: string;
	platform: string;
}

/**
 * The structured context a support request needs, in a stable shape both the
 * Doctor export and the bug-report payload carry. Raw on purpose: redaction is
 * applied at each exit (`serializeForExport` for the clipboard,
 * `buildFeedbackSubmission` for the wire) so there is exactly one gate per
 * destination rather than a half-redacted object floating around in memory.
 */
export interface DebugBundle {
	/** ISO-8601 of the injected clock — a bundle is a snapshot, never a stream. */
	capturedAt: string;
	windowMs: number;
	environment: DebugEnvironment;
	/** Counted over the whole buffer, so a truncated bundle still reports real totals. */
	counts: { buffered: number; warnings: number; errors: number };
	/** Every warn/error still buffered, oldest-first, newest kept when capped. */
	problems: LogEntry[];
	/** Everything logged inside the window, oldest-first, newest kept when capped. */
	recent: LogEntry[];
}

export interface DebugBundleInput {
	entries: readonly LogEntry[];
	environment: DebugEnvironment;
	/** Epoch millis. Injected rather than read, so the builder stays pure and testable. */
	now: number;
	windowMs?: number;
	maxEntries?: number;
}

function newest(entries: readonly LogEntry[], max: number): LogEntry[] {
	return entries.length <= max ? [...entries] : entries.slice(entries.length - max);
}

/**
 * Reduces a log buffer to the two views that actually diagnose a report: every
 * warning and error still held, and everything from the last few minutes.
 * Consumed by the bug-report flow ([[spec-in-app-feedback-and-bug-reports]]).
 */
export function buildDebugBundle({
	entries,
	environment,
	now,
	windowMs = DEBUG_BUNDLE_WINDOW_MS,
	maxEntries = DEBUG_BUNDLE_MAX_ENTRIES,
}: DebugBundleInput): DebugBundle {
	const since = now - windowMs;
	const problems = entries.filter((entry) => PROBLEM_LEVELS.has(entry.level));
	const recent = entries.filter((entry) => entry.ts >= since);

	return {
		capturedAt: new Date(now).toISOString(),
		windowMs,
		environment,
		counts: {
			buffered: entries.length,
			warnings: problems.filter((entry) => entry.level === "warn").length,
			errors: problems.filter((entry) => entry.level === "error").length,
		},
		problems: newest(problems, maxEntries),
		recent: newest(recent, maxEntries),
	};
}
