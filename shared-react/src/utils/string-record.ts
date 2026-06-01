/**
 * Helpers for the immutable `Record<string, string>` pattern used by
 * customizable-UI state (renames, icon overrides, color overrides).
 */

/** Shallow-copy a string record, treating `undefined` as empty. */
export function loadStringRecord(source: Record<string, string> | undefined): Record<string, string> {
	return { ...(source ?? {}) };
}

/** Returns a fresh shallow copy when the record has entries, otherwise `undefined`. */
export function nonEmptyRecord(record: Record<string, string>): Record<string, string> | undefined {
	return Object.keys(record).length > 0 ? { ...record } : undefined;
}

/**
 * Immutably set or delete an entry. Passing `undefined` clears the key. Returns
 * a new record — never mutates the input.
 */
export function setOrDelete(
	record: Record<string, string>,
	key: string,
	value: string | undefined
): Record<string, string> {
	if (value !== undefined) return { ...record, [key]: value };
	const { [key]: _removed, ...rest } = record;
	return rest;
}
