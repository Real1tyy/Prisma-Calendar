import { nanoid } from "nanoid";
import type { SingleCalendarConfig } from "../types";

export const isAllDayEvent = (allDayValue: unknown): boolean => {
	return allDayValue === true || (typeof allDayValue === "string" && allDayValue.toLowerCase() === "true");
};

export const applyStartEndOffsets = (
	fm: Record<string, unknown>,
	settings: SingleCalendarConfig,
	startOffset?: number,
	endOffset?: number
) => {
	const { startProp, endProp, dateProp, allDayProp } = settings;

	if (isAllDayEvent(fm[allDayProp])) {
		// ALL-DAY EVENT: Only shift the date property
		if (fm[dateProp]) {
			fm[dateProp] = shiftISO(fm[dateProp], startOffset);
		}
	} else {
		// TIMED EVENT: Shift start and end properties
		if (fm[startProp]) fm[startProp] = shiftISO(fm[startProp], startOffset);
		if (fm[endProp]) fm[endProp] = shiftISO(fm[endProp], endOffset);
	}
};

export const setEventBasics = (
	fm: Record<string, unknown>,
	settings: SingleCalendarConfig,
	data: {
		title?: string;
		start: string;
		end?: string;
		allDay?: boolean;
		zettelId?: number;
	}
) => {
	const { titleProp, startProp, endProp, dateProp, allDayProp, zettelIdProp } = settings;

	if (titleProp && data.title) fm[titleProp] = data.title;

	if (data.allDay !== undefined) fm[allDayProp] = data.allDay;

	if (data.allDay) {
		// ALL-DAY EVENT: Use dateProp, clear startProp/endProp
		const dateOnly = data.start.split("T")[0];
		fm[dateProp] = dateOnly;
		delete fm[startProp];
		delete fm[endProp];
	} else {
		// TIMED EVENT: Use startProp/endProp, clear dateProp
		fm[startProp] = data.start;
		if (data.end) fm[endProp] = data.end;
		delete fm[dateProp];
	}

	if (zettelIdProp && data.zettelId) fm[zettelIdProp] = data.zettelId;
};

export const generateUniqueRruleId = (): string => {
	return `${Date.now()}-${nanoid(5)}`;
};

// Safe ISO shift (stays ISO even if undefined)
export const shiftISO = (iso: unknown, offsetMs?: number) => {
	if (!iso || typeof iso !== "string" || !offsetMs) return iso;
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	d.setTime(d.getTime() + offsetMs);
	return d.toISOString();
};
