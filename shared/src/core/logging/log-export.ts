import { redactLogEntries, type RedactOptions } from "./redact";
import { createLogJsonReplacer, formatLogLine, toLogExportRecord } from "./serialize";
import type { LogEntry } from "./types";

/** `json`: one prettified array. `jsonl`: one object per line, as the sink writes. */
export type LogExportFormat = "json" | "jsonl";

export interface LogExportOptions extends RedactOptions {
	format?: LogExportFormat;
}

function pad(value: number, width = 2): string {
	return String(value).padStart(width, "0");
}

/**
 * Serialize entries for the clipboard or a saved file.
 *
 * There is deliberately no unredacted path: every entry goes through
 * `redactLogEntries` first, and `fullDetail` only relaxes path/value
 * abbreviation — secrets are gone in both modes. Both formats emit the same
 * record shape, so a saved file and a copied selection read identically.
 * See [[decision-observability-privacy-posture]].
 */
export function formatLogEntriesForExport(entries: readonly LogEntry[], options: LogExportOptions = {}): string {
	const { format = "json", ...redactOptions } = options;
	const redacted = redactLogEntries(entries, redactOptions);
	if (format === "jsonl") return redacted.map(formatLogLine).join("");
	return JSON.stringify(redacted.map(toLogExportRecord), createLogJsonReplacer(), 2);
}

/**
 * `logs-20260904-211500.json`. Local wall-clock, because the name exists for a
 * human matching the file against when they reproduced the problem — the
 * entries inside carry the exact instant.
 */
export function buildLogExportFilename(ts: number, format: LogExportFormat = "json", prefix = "logs"): string {
	const date = new Date(ts);
	const stamp =
		`${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
		`-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
	return `${prefix}-${stamp}.${format}`;
}
