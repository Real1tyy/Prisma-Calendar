import { toSafeString } from "./date/date";

/**
 * Returns a human-readable string for any thrown value.
 *
 * Behavior:
 *   - `Error` instances → `error.message`
 *   - Primitives (string / number / boolean) → coerced via `toSafeString`
 *   - Objects, arrays, `null`, `undefined` → the provided `fallback`
 *
 * Use this anywhere you need to interpolate a caught `unknown` into a user-
 * facing string (Notice, log message, error template). Avoids the
 * `"[object Object]"` corruption that comes from naïve `String(value)`.
 */
export function describeError(error: unknown, fallback = "unknown error"): string {
	if (error instanceof Error) return error.message;
	const safe = toSafeString(error);
	return safe ?? fallback;
}
