import type { CustomButtonInput, EventInput } from "@fullcalendar/core";
import type { Frontmatter } from "./index";

export interface PrismaExtendedProps {
	filePath: string;
	folder: string;
	originalTitle: string;
	frontmatterDisplayData: Frontmatter;
	isVirtual: boolean;
}

export interface PrismaEventInput extends EventInput {
	extendedProps: PrismaExtendedProps;
}

export interface FlexibleExtendedProps {
	filePath?: string;
	folder?: string;
	originalTitle?: string;
	frontmatterDisplayData?: Frontmatter;
	isVirtual?: boolean;
}

export interface CalendarEventData {
	title: string;
	start: Date | null;
	end: Date | null;
	allDay: boolean;
	extendedProps: FlexibleExtendedProps;
}

export interface EventMountInfo {
	el: HTMLElement;
	event: CalendarEventData;
}

export interface EventUpdateInfo {
	event: CalendarEventData & { start: Date };
	oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay"> & { start: Date };
	revert: () => void;
}

// Extended button input with className support (FullCalendar accepts it at runtime but doesn't type it)
export interface ExtendedButtonInput extends CustomButtonInput {
	className?: string;
}
