import type { Frontmatter } from "./index";

export interface EventSaveData {
	filePath: string | null;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	preservedFrontmatter: Frontmatter;
}
