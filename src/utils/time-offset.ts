import type { MoveByResult, TimeUnit } from "../components/move-by-modal";

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface TimeOffset {
	offsetMs: number;
	unit: TimeUnit;
}

export function calculateTimeOffset(moveBy: MoveByResult): TimeOffset {
	const { value, unit } = moveBy;

	let offsetMs = 0;

	switch (unit) {
		case "minutes":
			offsetMs = value * MS_PER_MINUTE;
			break;
		case "hours":
			offsetMs = value * MS_PER_HOUR;
			break;
		case "days":
			offsetMs = value * MS_PER_DAY;
			break;
		case "weeks":
			offsetMs = value * MS_PER_WEEK;
			break;
		case "months":
			// Approximate: 30 days per month
			offsetMs = value * 30 * MS_PER_DAY;
			break;
		case "years":
			// Approximate: 365 days per year
			offsetMs = value * 365 * MS_PER_DAY;
			break;
	}

	return { offsetMs, unit };
}

export function isTimeUnitAllowedForAllDay(unit: TimeUnit): boolean {
	return unit === "days" || unit === "weeks" || unit === "months" || unit === "years";
}
