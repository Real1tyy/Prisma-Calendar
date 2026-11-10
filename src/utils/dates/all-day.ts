import { WALL_CLOCK_PARSE_OPTS } from "@real1ty/obsidian-plugins";
import { DateTime } from "luxon";

import { stripZ, toInternalISO } from "./iso";

export function allDayEnd(start: string, end?: string | null): string {
	const day = DateTime.fromISO(stripZ(start), WALL_CLOCK_PARSE_OPTS).startOf("day");
	const candidate = end ? DateTime.fromISO(stripZ(end), WALL_CLOCK_PARSE_OPTS).startOf("day") : null;
	return toInternalISO(candidate?.isValid && candidate > day ? candidate : day.plus({ days: 1 }));
}
