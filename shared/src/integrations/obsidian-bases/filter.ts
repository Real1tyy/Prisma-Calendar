import type {
	BaseFilterGroup,
	BaseFilterNode,
	ComparisonOperator,
	FileFunctionFilter,
	FilePathFilter,
	FilterValue,
	NoteComparisonFilter,
	NoteContainsFilter,
	NoteLinkComparisonFilter,
	NoteSelfLinkFilter,
	RawFilter,
	ReverseContainsFilter,
} from "./schema";

function compare(property: string, operator: ComparisonOperator, value: FilterValue): NoteComparisonFilter {
	return { type: "noteComparison", property, operator, value };
}

export const Filter = {
	// ── Note property comparisons ───────────────────────────────────────

	compare,

	eq(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, "==", value);
	},

	neq(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, "!=", value);
	},

	gt(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, ">", value);
	},

	gte(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, ">=", value);
	},

	lt(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, "<", value);
	},

	lte(property: string, value: FilterValue): NoteComparisonFilter {
		return compare(property, "<=", value);
	},

	// ── Contains filters ────────────────────────────────────────────────

	contains(property: string, value: string): NoteContainsFilter {
		return { type: "noteContains", property, value };
	},

	selfLink(property: string): NoteSelfLinkFilter {
		return { type: "noteSelfLink", property };
	},

	reverseContains(property: string): ReverseContainsFilter {
		return { type: "reverseContains", property };
	},

	// ── Link comparisons ───────────────────────────────────────────────

	eqLink(property: string, path: string, displayName?: string): NoteLinkComparisonFilter {
		return { type: "noteLinkComparison", property, operator: "==", path, ...(displayName && { displayName }) };
	},

	neqLink(property: string, path: string, displayName?: string): NoteLinkComparisonFilter {
		return { type: "noteLinkComparison", property, operator: "!=", path, ...(displayName && { displayName }) };
	},

	// ── File filters ────────────────────────────────────────────────────

	inFolder(folder: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "inFolder", args: [folder] };
	},

	hasTag(...tags: string[]): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasTag", args: tags };
	},

	hasLink(target: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasLink", args: [target] };
	},

	hasProperty(property: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasProperty", args: [property] };
	},

	filePath(path: string): FilePathFilter {
		return { type: "filePath", operator: "==", path };
	},

	filePathNot(path: string): FilePathFilter {
		return { type: "filePath", operator: "!=", path };
	},

	// ── Logical operators ───────────────────────────────────────────────

	and(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "and", children };
	},

	or(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "or", children };
	},

	not(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "not", children };
	},

	// ── Escape hatch ────────────────────────────────────────────────────

	raw(expression: string): RawFilter {
		return { type: "raw", expression };
	},
};
