import { z } from "zod";
import type { CONTEXT_MENU_BUTTON_LABELS } from "../constants";
import { CONTEXT_MENU_ITEM_IDS, TOOLBAR_BUTTON_IDS } from "../constants";
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

export const DAY_CELL_COLORING_OPTIONS: Record<string, string> = {
	off: "Off",
	uniform: "Uniform",
	boundary: "Month boundary",
};

export const FIRST_DAY_OPTIONS: Record<number, string> = Object.entries(WEEKDAY_TO_NUMBER).reduce(
	(acc, [weekday, number]) => {
		acc[number] = WEEKDAY_OPTIONS[weekday as Weekday];
		return acc;
	},
	{} as Record<number, string>
);

export const LOCALE_OPTIONS: Record<string, string> = {
	en: "English",
	fr: "French (Français)",
	de: "German (Deutsch)",
	es: "Spanish (Español)",
	it: "Italian (Italiano)",
	"pt-br": "Portuguese - Brazil (Português)",
	nl: "Dutch (Nederlands)",
	ja: "Japanese (日本語)",
	ko: "Korean (한국어)",
	"zh-cn": "Chinese - Simplified (简体中文)",
	"zh-tw": "Chinese - Traditional (繁體中文)",
	ru: "Russian (Русский)",
	ar: "Arabic (العربية)",
	pl: "Polish (Polski)",
	tr: "Turkish (Türkçe)",
	sv: "Swedish (Svenska)",
	da: "Danish (Dansk)",
	fi: "Finnish (Suomi)",
	nb: "Norwegian (Norsk bokmål)",
};

export type ContextMenuItem = keyof typeof CONTEXT_MENU_BUTTON_LABELS;

export const ContextMenuItemSchema = z.enum(CONTEXT_MENU_ITEM_IDS as [ContextMenuItem, ...ContextMenuItem[]]);

export const ToolbarButtonSchema = z.enum(TOOLBAR_BUTTON_IDS as [string, ...string[]]);
