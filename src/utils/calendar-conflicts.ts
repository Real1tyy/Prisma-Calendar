import type { SingleCalendarConfig } from "../types";

type CalendarDirectoryScope = Pick<SingleCalendarConfig, "directory" | "indexSubdirectories">;

export type NormalizationConflictReason = "different-strategy" | "different-prop";

export interface NormalizationConflict {
	calendarId: string;
	otherCalendarId: string;
	otherCalendarName: string;
	sharedDirectory: string;
	reason: NormalizationConflictReason;
}

interface NormalizationConflictPair {
	a: SingleCalendarConfig;
	b: SingleCalendarConfig;
	sharedDirectory: string;
	reason: NormalizationConflictReason;
}

function normalizeDirectory(directory: string): string {
	return directory.replace(/\/+$/, "");
}

/**
 * True when two enabled calendars index file paths that overlap on disk.
 *
 * Empty directory ("") is treated as unconfigured and never overlaps.
 * Identical non-empty directories always overlap.
 * Nested directories overlap only when the parent indexes subdirectories.
 */
export function directoriesOverlap(a: CalendarDirectoryScope, b: CalendarDirectoryScope): boolean {
	const dirA = normalizeDirectory(a.directory);
	const dirB = normalizeDirectory(b.directory);
	if (!dirA || !dirB) return false;
	if (dirA === dirB) return true;
	return (
		(a.indexSubdirectories && isParentDirectory(dirA, dirB)) || (b.indexSubdirectories && isParentDirectory(dirB, dirA))
	);
}

function isParentDirectory(parent: string, child: string): boolean {
	return child.startsWith(`${parent}/`);
}

function getNormalizationConflictReason(
	a: SingleCalendarConfig,
	b: SingleCalendarConfig
): NormalizationConflictReason | null {
	if (a.sortingStrategy === "none" && b.sortingStrategy === "none") {
		return null;
	}
	if (a.sortingStrategy !== b.sortingStrategy) {
		return "different-strategy";
	}
	if (a.sortDateProp !== b.sortDateProp) {
		return "different-prop";
	}
	return null;
}

function getSharedDirectoryLabel(a: SingleCalendarConfig, b: SingleCalendarConfig): string {
	const na = normalizeDirectory(a.directory);
	const nb = normalizeDirectory(b.directory);
	return na === nb ? na : `${na} / ${nb}`;
}

function getConflictPair(a: SingleCalendarConfig, b: SingleCalendarConfig): NormalizationConflictPair | null {
	if (!directoriesOverlap(a, b)) return null;
	const reason = getNormalizationConflictReason(a, b);
	if (!reason) return null;
	return {
		a,
		b,
		reason,
		sharedDirectory: getSharedDirectoryLabel(a, b),
	};
}

function toSymmetricConflicts(pair: NormalizationConflictPair): NormalizationConflict[] {
	const { a, b, reason, sharedDirectory } = pair;
	return [
		{
			calendarId: a.id,
			otherCalendarId: b.id,
			otherCalendarName: b.name,
			sharedDirectory,
			reason,
		},
		{
			calendarId: b.id,
			otherCalendarId: a.id,
			otherCalendarName: a.name,
			sharedDirectory,
			reason,
		},
	];
}

/**
 * Returns one entry per calendar side of a conflict.
 *
 * Each conflicting pair generates two entries so callers can index by calendarId.
 */
export function findNormalizationConflicts(calendars: ReadonlyArray<SingleCalendarConfig>): NormalizationConflict[] {
	const enabledCalendars = calendars.filter((calendar) => calendar.enabled);
	const conflicts: NormalizationConflict[] = [];
	for (let i = 0; i < enabledCalendars.length; i++) {
		for (let j = i + 1; j < enabledCalendars.length; j++) {
			const pair = getConflictPair(enabledCalendars[i], enabledCalendars[j]);
			if (pair) {
				conflicts.push(...toSymmetricConflicts(pair));
			}
		}
	}
	return conflicts;
}

/** First conflict that names `calendarId`, or null. */
export function findConflictForCalendar(
	calendarId: string,
	calendars: ReadonlyArray<SingleCalendarConfig>
): NormalizationConflict | null {
	const enabledCalendars = calendars.filter((calendar) => calendar.enabled);
	for (let i = 0; i < enabledCalendars.length; i++) {
		for (let j = i + 1; j < enabledCalendars.length; j++) {
			const pair = getConflictPair(enabledCalendars[i], enabledCalendars[j]);
			if (!pair) continue;
			const [aConflict, bConflict] = toSymmetricConflicts(pair);
			if (aConflict.calendarId === calendarId) return aConflict;
			if (bConflict.calendarId === calendarId) return bConflict;
		}
	}
	return null;
}

export function describeConflict(conflict: NormalizationConflict): string {
	const detail = getConflictDetail(conflict.reason);
	return `Conflicts with "${conflict.otherCalendarName}" — both index "${conflict.sharedDirectory}" but ${detail}. Sort date writes are paused on both calendars to prevent corruption. Pick a single strategy or choose distinct directories.`;
}

function getConflictDetail(reason: NormalizationConflictReason): string {
	switch (reason) {
		case "different-strategy":
			return "use different sort normalization strategies";
		case "different-prop":
			return "write the sort date to different properties";
	}
}
