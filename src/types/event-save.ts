import type { Frontmatter } from "./index";

interface BaseEventFields {
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	preservedFrontmatter: Frontmatter;
}

export interface CreateEventData extends BaseEventFields {
	virtual: boolean;
}

export interface UpdateEventData extends BaseEventFields {
	filePath: string;
}

export interface EventSaveData extends BaseEventFields {
	filePath: string | null;
	virtual: boolean;
}
