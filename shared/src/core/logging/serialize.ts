/**
 * Best-effort `JSON.stringify` for a log entry's `data`.
 *
 * Callers log whatever they have — cycles, `Error`s, `bigint`s, objects with a
 * throwing getter or `toJSON`. None of that may reach the feature being logged
 * as an exception, so every failure mode degrades to a string instead of
 * throwing. `Error` is special-cased because it serializes to `{}` otherwise,
 * which would drop the one field anybody searches for.
 */
export function stringifyLogData(value: unknown): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;

	try {
		const seen = new WeakSet();
		const json = JSON.stringify(value, (_key, val: unknown) => {
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
		});
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
