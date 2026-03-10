export const TIME_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];

export interface MoveByResult {
	value: number;
	unit: TimeUnit;
}
