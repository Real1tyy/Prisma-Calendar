/**
 * Picks the surviving file when several notes claim the same logical identity
 * (one recurring instance date, one remote-calendar UID, …).
 *
 * The choice is a pure function of the candidate paths — never of arrival
 * order, scan order, or which device is asking. Two devices that each hold
 * both files therefore trash the *same* loser; "first seen wins" made each
 * device keep its own copy and trash the other's, and the two trashes
 * replicated into no copy at all. See
 * [[decision-deterministic-automatic-writes-across-synced-devices]].
 *
 * Order: the shortest path wins, then the smallest by UTF-16 code units.
 * Shortest-first means the canonical name always beats its collision
 * suffixes (`Standup 2026-09-04-x.md` beats `Standup 2026-09-04-x 1.md`)
 * without the caller having to know what canonical is; the code-unit
 * comparison (not `localeCompare`) keeps the tie-break identical on every
 * platform and locale.
 */
export function pickCanonicalDuplicate(paths: readonly string[]): string {
	if (paths.length === 0) throw new Error("pickCanonicalDuplicate: no candidates");
	let winner = paths[0];
	for (let i = 1; i < paths.length; i++) {
		if (comparePathsCanonical(paths[i], winner) < 0) winner = paths[i];
	}
	return winner;
}

/** The total order behind {@link pickCanonicalDuplicate}; negative when `a` should survive over `b`. */
export function comparePathsCanonical(a: string, b: string): number {
	if (a.length !== b.length) return a.length - b.length;
	if (a === b) return 0;
	return a < b ? -1 : 1;
}
