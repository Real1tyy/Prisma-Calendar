import { ensureISOSuffix } from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";
import { DateTime } from "luxon";

import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { stripZ } from "../iso";
import { isAllDayFrontmatterValue } from "./predicates";

const normalizesTimedEvents = (mode: string): boolean =>
	["startDate", "endDate", "allStartDate", "allEndDate"].includes(mode);

const normalizesAllDayEvents = (mode: string): boolean => ["allDayOnly", "allStartDate", "allEndDate"].includes(mode);

/**
 * Computes the normalized sort date value for an event.
 * Returns the target property name and the expected value, or undefined if sorting doesn't apply.
 */
export const computeSortDateValue = (
	settings: SingleCalendarConfig,
	start: string,
	end?: string,
	allDay?: boolean
): { targetProp: string; value: string } | undefined => {
	const mode = settings.sortingStrategy;
	if (mode === "none") return undefined;

	const targetProp = settings.sortDateProp;
	if (!targetProp) return undefined;

	if (allDay) {
		if (!normalizesAllDayEvents(mode)) return undefined;
		const dateOnly = start.split("T")[0];
		return { targetProp, value: `${dateOnly}T00:00:00` };
	}

	if (!normalizesTimedEvents(mode)) return undefined;

	const value = mode === "startDate" || mode === "allStartDate" ? stripZ(start) : stripZ(end || start);
	return { targetProp, value };
};

const shiftISO = (iso: unknown, duration?: DurationLike) => {
	if (!iso || typeof iso !== "string" || !duration) return iso;
	const stripped = stripZ(iso);
	const dt = DateTime.fromISO(stripped);
	if (!dt.isValid) return iso;
	const shifted = dt.plus(duration);
	if (!stripped.includes("T")) {
		return shifted.toISODate();
	}
	const bare = shifted.toISO({ suppressMilliseconds: true, includeOffset: false });
	return iso.endsWith("Z") ? ensureISOSuffix(bare ?? "") : bare;
};

export const applyStartEndOffsets = (
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	startOffset?: DurationLike,
	endOffset?: DurationLike
) => {
	const { startProp, endProp, dateProp, allDayProp } = settings;

	if (isAllDayFrontmatterValue(fm[allDayProp])) {
		if (fm[dateProp]) {
			fm[dateProp] = shiftISO(fm[dateProp], startOffset);
		}
	} else {
		if (fm[startProp]) fm[startProp] = shiftISO(fm[startProp], startOffset);
		if (fm[endProp]) fm[endProp] = shiftISO(fm[endProp], endOffset);
	}
};

export const setEventBasics = (
	fm: Frontmatter,
	settings: SingleCalendarConfig,
	data: {
		title?: string | undefined;
		start: string;
		end?: string | undefined;
		allDay?: boolean | undefined;
		zettelId?: number | undefined;
	}
) => {
	const { titleProp, startProp, endProp, dateProp, allDayProp, zettelIdProp } = settings;

	if (titleProp && data.title) fm[titleProp] = data.title;

	if (data.allDay !== undefined) fm[allDayProp] = data.allDay;

	const dateOnly = data.start.split("T")[0];

	if (data.allDay) {
		fm[dateProp] = dateOnly;
		fm[startProp] = "";
		fm[endProp] = "";
	} else {
		fm[startProp] = ensureISOSuffix(data.start);
		if (data.end) fm[endProp] = ensureISOSuffix(data.end);
		fm[dateProp] = "";
	}

	const sortResult = computeSortDateValue(settings, data.start, data.end, data.allDay);
	if (sortResult) fm[sortResult.targetProp] = sortResult.value;

	if (zettelIdProp && data.zettelId) fm[zettelIdProp] = data.zettelId;
};

export const setUntrackedEventBasics = (fm: Frontmatter, settings: SingleCalendarConfig): void => {
	fm[settings.startProp] = "";
	fm[settings.endProp] = "";
	fm[settings.dateProp] = "";
	fm[settings.allDayProp] = "";
};
