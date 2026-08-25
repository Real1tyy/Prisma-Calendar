import type { Frontmatter } from "./frontmatter-diff";

/**
 * Deterministic ordering for plugin-owned frontmatter properties.
 *
 * Obsidian's `processFrontMatter` serializes keys in object insertion order and appends
 * new keys at the end, so key order is append-history-dependent — replicas synced across
 * devices diverge and every semantically-identical write becomes a sync conflict. The fix
 * is a convention: on every flush, a plugin rewrites *its own* properties as one
 * contiguous block in a configured order, anchored where its properties already live, and
 * never touches foreign keys. Two plugins sharing a directory each converge their own
 * group without fighting over absolute positions. See [[decision-deterministic-property-ordering]].
 */

/**
 * Reorders the plugin-owned subset of `fm`'s keys in place so they form one contiguous
 * block in `orderedOwnedNames` order. The block is anchored at the position of the first
 * owned key currently in the file; all other keys keep their exact relative order.
 * Returns true when the key order actually changed.
 *
 * Deterministic by construction: the result depends only on the key set and the
 * configured order, never on locale or platform.
 */
export function enforcePropertyOrder(fm: Frontmatter, orderedOwnedNames: readonly string[]): boolean {
	const keys = Object.keys(fm);
	const ownedPresent = dedupe(orderedOwnedNames).filter((name) => Object.hasOwn(fm, name));
	if (ownedPresent.length <= 1) return false;

	const ownedSet = new Set(ownedPresent);
	const target: string[] = [];
	let blockInserted = false;
	for (const key of keys) {
		if (!ownedSet.has(key)) {
			target.push(key);
		} else if (!blockInserted) {
			// First owned key encountered — the whole owned block anchors here.
			target.push(...ownedPresent);
			blockInserted = true;
		}
	}

	if (arraysEqual(keys, target)) return false;

	const snapshot: Frontmatter = { ...fm };
	for (const key of keys) Reflect.deleteProperty(fm, key);
	for (const key of target) fm[key] = snapshot[key];
	return true;
}

const dedupe = (names: readonly string[]): string[] => {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const name of names) {
		if (!name || seen.has(name)) continue;
		seen.add(name);
		out.push(name);
	}
	return out;
};

const arraysEqual = (a: readonly string[], b: readonly string[]): boolean =>
	a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Merges a user-stored property order (list of registry keys) with the plugin's default
 * registry order. Unknown stored keys are dropped; registry keys missing from the stored
 * order (properties added in later plugin versions) are inserted next to their default
 * neighbours rather than appended, so upgrades keep the semantic grouping.
 */
export function mergePropertyOrder(storedOrder: readonly string[], defaultOrder: readonly string[]): string[] {
	const known = new Set(defaultOrder);
	const result = dedupe(storedOrder).filter((key) => known.has(key));
	const present = new Set(result);

	for (let i = 0; i < defaultOrder.length; i++) {
		const key = defaultOrder[i];
		if (present.has(key)) continue;
		// Insert after the nearest preceding default-order key already in the result.
		let insertAt = 0;
		for (let j = i - 1; j >= 0; j--) {
			const prevIndex = result.indexOf(defaultOrder[j]);
			if (prevIndex !== -1) {
				insertAt = prevIndex + 1;
				break;
			}
		}
		result.splice(insertAt, 0, key);
		present.add(key);
	}
	return result;
}

/**
 * Resolves an ordered list of registry keys to the actual frontmatter property names via
 * `nameOf`, dropping unset/empty names and duplicates (two registry keys configured to
 * the same property name collapse to the first occurrence).
 */
export function resolveOrderedPropertyNames(
	orderedKeys: readonly string[],
	nameOf: (key: string) => string | undefined
): string[] {
	return dedupe(orderedKeys.map((key) => nameOf(key) ?? ""));
}
