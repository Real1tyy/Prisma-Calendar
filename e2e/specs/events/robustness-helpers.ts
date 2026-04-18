import { listEventFiles } from "./events-helpers";

// Small helpers used only by the Round 2/3/4 robustness specs. Every helper
// here composes existing primitives — nothing that belongs in shared/e2e
// (Foundation-owned) or in `events-helpers.ts` (Round 1-owned).
//
// Settings mutation uses `updateCalendarSettings` from `fixtures/seed-events.ts`.

const POLL_INTERVAL_MS = 100;
const DEFAULT_POLL_TIMEOUT_MS = 10_000;

/**
 * Match a physical instance filename for `title`: `Title YYYY-MM-DD-<zettel>.md`
 * — the space-date-zettel suffix is what distinguishes instances from the
 * source event note, which uses `Title-<zettel>.md` (no date token).
 *
 * Mirrors the regex in `events/recurring.spec.ts`; kept local to avoid a
 * circular import between two spec-adjacent helper files.
 */
export function instanceFileRegex(title: string): RegExp {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`/${escaped} (\\d{4})-(\\d{2})-(\\d{2})-\\d+\\.md$`);
}

/** Parse `YYYY-MM-DD` captured from the filename into a local Date. */
export function parseInstanceDate(match: RegExpMatchArray): Date {
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function collectInstanceFiles(vaultDir: string, title: string): string[] {
	const regex = instanceFileRegex(title);
	return listEventFiles(vaultDir).filter((p) => regex.test(p));
}

/**
 * Sorted list of instance dates (`YYYY-MM-DD`) parsed out of the physical
 * instance filenames for `title`. Used by the recurring-events spec to
 * assert the *exact* calendar dates the plugin materialised, not just the
 * count — the count is a weaker signal because the plugin's past-events
 * boundary is inclusive of today, which is easy to miscount.
 */
export function collectInstanceDates(vaultDir: string, title: string): string[] {
	const regex = instanceFileRegex(title);
	return collectInstanceFiles(vaultDir, title)
		.map((abs) => {
			const match = abs.match(regex);
			return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
		})
		.filter((d): d is string => d !== null)
		.sort();
}

/** Local-calendar `YYYY-MM-DD` for a Date — no timezone conversion. */
export function toYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Clone `d` and shift by `days` calendar days in local time. */
export function addDays(d: Date, days: number): Date {
	const next = new Date(d);
	next.setDate(next.getDate() + days);
	return next;
}

/**
 * Poll until `predicate()` returns true. Throws with `message` on timeout.
 * Used by propagation specs that poll for frontmatter changes after
 * PROPAGATION_DEBOUNCE_MS + propagation work settles.
 */
export async function waitFor(
	predicate: () => boolean | Promise<boolean>,
	message: string,
	timeoutMs = DEFAULT_POLL_TIMEOUT_MS
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (await predicate()) return;
		if (Date.now() > deadline) throw new Error(`waitFor timed out: ${message}`);
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}
}
