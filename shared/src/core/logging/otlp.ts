import type { LogEntry, LogLevel } from "./types";

/**
 * The OpenTelemetry severity number at the bottom of each level's range
 * (DEBUG 5–8, INFO 9–12, WARN 13–16, ERROR 17–20), so a record lines up with
 * any OTLP backend's level buckets.
 */
export const OTLP_SEVERITY_NUMBER: Record<LogLevel, number> = {
	debug: 5,
	info: 9,
	warn: 13,
	error: 17,
};

export type OtlpSeverityText = "DEBUG" | "INFO" | "WARN" | "ERROR";

/**
 * A log entry in the OpenTelemetry log data model's vocabulary. Only the shape
 * follows OTLP — nothing here is exported off the device.
 */
export interface OtlpLogRecord {
	/** Epoch milliseconds. */
	timestamp: number;
	severityText: OtlpSeverityText;
	severityNumber: number;
	body: string;
	attributes: Readonly<Record<string, unknown>>;
	instrumentationScope: { name: string };
}

function toAttributes(data: unknown): Readonly<Record<string, unknown>> {
	if (data === undefined) return {};
	if (typeof data === "object" && data !== null && !Array.isArray(data) && !(data instanceof Error)) {
		return data as Record<string, unknown>;
	}
	// OTLP attributes are a key–value map; a scalar, array or Error payload gets a key of its own.
	return { value: data };
}

/** The single place a `LogEntry` becomes an OTLP-shaped record. */
export function toOtlpLogRecord(entry: LogEntry): OtlpLogRecord {
	return {
		timestamp: entry.ts,
		severityText: entry.level.toUpperCase() as OtlpSeverityText,
		severityNumber: OTLP_SEVERITY_NUMBER[entry.level],
		body: entry.message,
		attributes: toAttributes(entry.data),
		instrumentationScope: { name: entry.scope },
	};
}
