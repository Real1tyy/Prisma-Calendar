import type { SingleCalendarConfig } from "../types";
import { shiftISO } from "./obsidian-fm";

export const applyStartEndOffsets = (
	fm: Record<string, unknown>,
	settings: SingleCalendarConfig,
	startOffset?: number,
	endOffset?: number
) => {
	const { startProp, endProp } = settings;
	if (fm[startProp]) fm[startProp] = shiftISO(fm[startProp], startOffset);
	if (fm[endProp]) fm[endProp] = shiftISO(fm[endProp], endOffset);
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
	const { titleProp, startProp, endProp, allDayProp, zettelIdProp } = settings;
	if (titleProp && data.title) fm[titleProp] = data.title;
	fm[startProp] = data.start;
	if (endProp && data.end) fm[endProp] = data.end;
	if (allDayProp && typeof data.allDay !== "undefined") fm[allDayProp] = data.allDay;
	if (zettelIdProp && typeof data.zettelId !== "undefined") fm[zettelIdProp] = data.zettelId;
};
