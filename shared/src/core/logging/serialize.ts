import type { LogEntry } from "./types";

/**
 * `JSON.stringify` replacer that degrades every value the spec forbids from
 * throwing — cycles, `Error`s, `bigint`s, functions, symbols — into something
 * printable. A fresh `WeakSet` per stringify call is what makes the cycle
 * check correct across calls. `Error` is special-cased because it serializes
 * to `{}` otherwise, which would drop the one field anybody searches for.
 */
export function createLogJsonReplacer(): (key: string, value: unknown) => unknown {
	const seen = new WeakSet();
	return (_key, val) => {
		if (val instanceof Error) {
			return { name: val.name, message: val.message, stack: val.stack };
		}
		if (typeof val === "bigint") return val.toString();
		if (typeof val === "function") return `[function ${val.name || "anonymous"}]`;
		if (typeof val === "symbol") return val.toString();
		if (typeof val === "object" && val !== null) {
			if (seen.has(val)) return "[circular]";
			seen.add(val);
		}
		return val;
	};
}

/**
 * Best-effort `JSON.stringify` for a log entry's `data`.
 *
 * Callers log whatever they have — cycles, `Error`s, `bigint`s, objects with a
 * throwing getter or `toJSON`. None of that may reach the feature being logged
 * as an exception, so every failure mode degrades to a string instead of
 * throwing.
 */
export function stringifyLogData(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;

	try {
		const json = JSON.stringify(value, createLogJsonReplacer());
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- the overload types this `string`, but a root `toJSON()` returning undefined makes `JSON.stringify` return undefined at runtime.
		return json ?? "";
	} catch {
		try {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string -- the point of this fallback is "whatever the value can still tell us"; a custom `toString` is the useful case and `[object Object]` beats dropping the payload.
			return String(value);
		} catch {
			return "[unserializable]";
		}
	}
}

/**
 * One JSON object per line for the file sink. `time` duplicates `ts` as ISO so
 * the file reads without a converter; a `data` that defeats even the replacer
 * (a throwing getter or `toJSON`) is carried as its best-effort string so the
 * line itself stays valid JSON.
 */
export function formatLogLine(entry: LogEntry): string {
	const record = {
		ts: entry.ts,
		time: new Date(entry.ts).toISOString(),
		level: entry.level,
		scope: entry.scope,
		message: entry.message,
		...(entry.data === undefined ? {} : { data: entry.data }),
	};
	try {
		return `${JSON.stringify(record, createLogJsonReplacer())}\n`;
	} catch {
		return `${JSON.stringify({ ...record, data: stringifyLogData(entry.data) })}\n`;
	}
}
