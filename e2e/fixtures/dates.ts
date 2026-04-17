// Deterministic date-string builders used across specs. Centralised here so
// every suite shares one implementation — prior fragmentation had today-ISO
// logic duplicated across history-helpers, analytics-helpers, and
// calendar-helpers. All output is local-time, matching the "local-time-as-UTC"
// convention Prisma stores in frontmatter (see ics-export.ts).

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
