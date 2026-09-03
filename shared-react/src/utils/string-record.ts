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

type StringRecordState<Key extends string> = Partial<Record<Key, Record<string, string> | undefined>>;
export type StringRecordFields<Key extends string> = Record<Key, Record<string, string>>;

/** Load a related set of persisted string-record fields, defaulting each absent field to an empty record. */
export function loadStringRecords<Key extends string>(
	state: StringRecordState<Key> | undefined,
	keys: readonly Key[]
): StringRecordFields<Key> {
	return Object.fromEntries(keys.map((key) => [key, loadStringRecord(state?.[key])])) as StringRecordFields<Key>;
}

/** Copy non-empty string-record fields into a persisted state object and return whether any were written. */
export function writeNonEmptyStringRecords<State extends object, Key extends string>(
	state: State,
	records: StringRecordFields<Key>,
	keys: readonly Key[]
): boolean {
	let wrote = false;
	for (const key of keys) {
		const record = nonEmptyRecord(records[key]);
		if (!record) continue;
		Object.assign(state, { [key]: record });
		wrote = true;
	}
	return wrote;
}

export type StringRecordMapFields<Key extends string> = Record<Key, Map<string, string>>;

/** Load persisted string records into mutable maps for stores that use `Map` snapshots. */
export function loadStringRecordMaps<Key extends string>(
	state: StringRecordState<Key> | undefined,
	keys: readonly Key[]
): StringRecordMapFields<Key> {
	return Object.fromEntries(
		keys.map((key) => [key, new Map(Object.entries(state?.[key] ?? {}))])
	) as StringRecordMapFields<Key>;
}

/** Serialize non-empty string-record maps into a persisted state object. */
export function writeNonEmptyStringRecordMaps<State extends object, Key extends string>(
	state: State,
	maps: Readonly<Record<Key, ReadonlyMap<string, string>>>,
	keys: readonly Key[]
): boolean {
	let wrote = false;
	for (const key of keys) {
		if (maps[key].size === 0) continue;
		Object.assign(state, { [key]: Object.fromEntries(maps[key]) });
		wrote = true;
	}
	return wrote;
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
	return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}
