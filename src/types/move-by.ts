export const TIME_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];

const ALL_DAY_UNITS = new Set<TimeUnit>(["days", "weeks", "months", "years"]);

export const isTimeUnitAllowedForAllDay = (unit: TimeUnit): boolean => ALL_DAY_UNITS.has(unit);

export interface MoveByResult {
	value: number;
	unit: TimeUnit;
}
