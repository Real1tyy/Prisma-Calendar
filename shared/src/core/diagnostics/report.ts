import type { DebugBundle } from "../logging/debug-bundle";
import { serializeForExport, type RedactOptions } from "../logging/redact";
import { summarizeHealth, type HealthCheck, type HealthStatus } from "./health";

const MINUTE_MS = 60_000;

/** A health check as it travels in a report — the `fix` callback stripped, so the row is plain data. */
export interface HealthReportRow {
	id: string;
	label: string;
	status: HealthStatus;
	detail: string;
}

/**
 * What the Doctor puts on the clipboard: the plugin's own verdict on itself,
 * plus the log context behind it.
 *
 * Deliberately a wrapper rather than fields added to {@link DebugBundle} — that
 * shape is the contract the bug-report flow already submits
 * ([[spec-in-app-feedback-and-bug-reports]]), and the health rows are the
 * Doctor's reading of the same data, not more of it.
 */
export interface DoctorReport {
	health: HealthReportRow[];
	debug: DebugBundle;
}

export function toHealthReportRows(checks: readonly HealthCheck[]): HealthReportRow[] {
	return checks.map(({ id, label, status, detail }) => ({ id, label, status, detail }));
}

export function buildDoctorReport(checks: readonly HealthCheck[], debug: DebugBundle): DoctorReport {
	return { health: toHealthReportRows(checks), debug };
}

export interface FormatDoctorReportOptions extends RedactOptions {
	/** Display name for the header, e.g. `"Prisma Calendar"`. Defaults to the environment's plugin id. */
	pluginName?: string | undefined;
}

function healthLine(health: readonly HealthReportRow[]): string {
	if (health.length === 0) return "not run";
	const summary = summarizeHealth(health);
	return `${summary.fail} failing, ${summary.warn} warning, ${summary.ok} ok`;
}

/**
 * The report as the text a user pastes into an issue: a header anyone can read
 * at a glance, then the full structured payload in a fenced JSON block.
 *
 * The payload goes through `serializeForExport()` — the one serializer for
 * content leaving the process ([[decision-observability-privacy-posture]]). The
 * header is built only from environment and count fields, so there is nothing
 * in it that would need redacting.
 */
export function formatDoctorReport(report: DoctorReport, options: FormatDoctorReportOptions = {}): string {
	const { pluginName, ...redactOptions } = options;
	const { environment: env, counts } = report.debug;
	const header = [
		`# ${pluginName ?? env.pluginId} debug bundle`,
		`Captured: ${report.debug.capturedAt}`,
		`Plugin: ${env.pluginId} ${env.pluginVersion}`,
		`Obsidian: ${env.obsidianVersion} (${env.platform})`,
		`Health: ${healthLine(report.health)}`,
		`Buffered: ${counts.buffered} entries — ${counts.errors} errors, ${counts.warnings} warnings`,
		`Window: last ${report.debug.windowMs / MINUTE_MS} minutes — ${report.debug.recent.length} entries`,
		redactOptions.fullDetail === true
			? "Redaction: full detail — paths and property values kept; secrets removed"
			: "Redaction: paths abbreviated, property values elided, secrets removed",
	].join("\n");

	return `${header}\n\n\`\`\`json\n${serializeForExport(report, redactOptions)}\n\`\`\`\n`;
}
