import { Filter } from "./filter";
import type { BaseFilterNode, BaseFormula } from "./schema";

export const BasePresets = {
	archivedFilter(prop: string, exclude = true): BaseFilterNode {
		return exclude ? Filter.neq(prop, true) : Filter.eq(prop, true);
	},

	dateRange(prop: string, start: string, end: string): BaseFilterNode {
		return Filter.and(Filter.gt(prop, start), Filter.lt(prop, end));
	},

	filePathList(paths: string[]): BaseFilterNode {
		if (paths.length === 0) {
			return Filter.filePath("");
		}
		return Filter.or(...paths.map((p) => Filter.filePath(p)));
	},

	relativeDateFormula(name: string, property: string): BaseFormula {
		const ref = `note["${property}"]`;
		return {
			name,
			expression: `date(if(${ref}.toString().contains("T"),${ref}.slice(0, 19).replace("T", " "),${ref})).relative()`,
		};
	},
} as const;

export const OrderRef = {
	fileName: "file.name" as const,
	fileBasename: "file.basename" as const,
	filePath: "file.path" as const,
	fileFolder: "file.folder" as const,
	fileExt: "file.ext" as const,
	fileSize: "file.size" as const,
	fileCtime: "file.ctime" as const,
	fileMtime: "file.mtime" as const,

	note(property: string): string {
		return `note.${property}`;
	},

	formula(name: string): string {
		return `formula.${name}`;
	},
} as const;

export const ColumnRef = {
	note(property: string): string {
		return `note.${property}`;
	},

	formula(name: string): string {
		return `formula.${name}`;
	},
} as const;
