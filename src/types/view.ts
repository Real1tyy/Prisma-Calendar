import { z } from "zod";
import type { CONTEXT_MENU_BUTTON_LABELS } from "../constants";
import { CONTEXT_MENU_ITEM_IDS } from "../constants";
import type { Weekday } from "../utils/date-recurrence";
import { WEEKDAY_TO_NUMBER } from "../utils/date-recurrence";
import { WEEKDAY_OPTIONS } from "./recurring-event";

export const CALENDAR_VIEW_OPTIONS = {
	dayGridMonth: "Month",
	timeGridWeek: "Week (Time)",
	timeGridDay: "Day (Time)",
	listWeek: "Week (List)",
} as const;

export type CalendarViewType = keyof typeof CALENDAR_VIEW_OPTIONS;

export const CalendarViewTypeSchema = z.enum(
	Object.keys(CALENDAR_VIEW_OPTIONS) as [CalendarViewType, ...CalendarViewType[]]
);

export const DENSITY_OPTIONS: Record<string, string> = {
	comfortable: "Comfortable",
	compact: "Compact",
};

export const FIRST_DAY_OPTIONS: Record<number, string> = Object.entries(WEEKDAY_TO_NUMBER).reduce(
	(acc, [weekday, number]) => {
		acc[number] = WEEKDAY_OPTIONS[weekday as Weekday];
		return acc;
	},
	{} as Record<number, string>
);

export type ContextMenuItem = keyof typeof CONTEXT_MENU_BUTTON_LABELS;

export const ContextMenuItemSchema = z.enum(CONTEXT_MENU_ITEM_IDS as [ContextMenuItem, ...ContextMenuItem[]]);
