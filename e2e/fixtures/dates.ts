// Deterministic date-string builders used across specs. Centralised here so
// every suite shares one implementation — prior fragmentation had today-ISO
// logic duplicated across history-helpers, analytics-helpers, and
// calendar-helpers. All output is local-time, matching the "local-time-as-UTC"
// convention Prisma stores in frontmatter (see ics-export.ts).
//
// Prefer `anchorDate()` / `fromAnchor()` over the today-based helpers for new
// specs — see `docs/specs/e2e-date-anchor-robustness.md`. The today-anchored
// variants remain for recurring specs (which genuinely need future offsets
// relative to "now") and for pre-migration specs.

const pad = (n: number): string => String(n).padStart(2, "0");

/** `YYYY-MM-DD` for today in local TZ. */
export function todayISO(): string {
	const d = new Date();
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM-DDTHH:mm` for today at the given hour/minute in local TZ. */
export function todayStamp(hours: number, minutes = 0): string {
	return `${todayISO()}T${pad(hours)}:${pad(minutes)}`;
}

/** `YYYY-MM-DDTHH:mm` for a date N days from today at the given hour/minute. */
export function isoLocal(daysFromToday: number, hh = 10, mm = 0): string {
	const d = new Date();
	d.setDate(d.getDate() + daysFromToday);
	d.setHours(hh, mm, 0, 0);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Anchor helpers ──────────────────────────────────────────────────────
//
// The test suite runs on a moving wall clock. "Today" varies day-of-week,
// which pushes `isoLocal(1, …)` across a week boundary on Saturdays and
// produces flaky failures (see `docs/specs/e2e-date-anchor-robustness.md`).
//
// `anchorDate()` returns the most recent Wednesday at-or-before today. Every
// non-recurring spec seeds relative to the anchor and calls
// `calendar.goToAnchor()` so the viewport shows the anchor's week. Offsets
// in [-3, +3] stay inside that week regardless of the configured
// `firstDayOfWeek`.

/** JS `getDay()` code for Wednesday. 0 = Sunday, 3 = Wednesday. */
const ANCHOR_DOW = 3;

/**
 * A stable mid-week reference day for seeding events — the most recent
 * Wednesday at-or-before today, midnight local. Wednesday is chosen because
 * it sits in the middle of the visible week under every week-start setting,
 * so offsets of ±3 days remain inside the same rendered week.
 *
 * Pair with `calendar.goToAnchor()` so the viewport is deterministic.
 */
export function anchorDate(): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	const offset = (d.getDay() - ANCHOR_DOW + 7) % 7;
	d.setDate(d.getDate() - offset);
	return d;
}

/** `YYYY-MM-DD` form of `anchorDate()`. */
export function anchorISO(): string {
	return formatISODate(anchorDate());
}

/** `YYYY-MM-DD` for anchor + N days. Negative values return dates before the anchor. */
export function anchorDayISO(daysFromAnchor: number): string {
	const d = anchorDate();
	d.setDate(d.getDate() + daysFromAnchor);
	return formatISODate(d);
}

/** `YYYY-MM-DDTHH:mm` for anchor + N days at the given hour/minute. */
export function fromAnchor(daysFromAnchor: number, hh = 10, mm = 0): string {
	const d = anchorDate();
	d.setDate(d.getDate() + daysFromAnchor);
	d.setHours(hh, mm, 0, 0);
	return `${formatISODate(d)}T${pad(hh)}:${pad(mm)}`;
}

function formatISODate(d: Date): string {
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
