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

export class Filter {
	// ── Note property comparisons ───────────────────────────────────────

	static compare(property: string, operator: ComparisonOperator, value: FilterValue): NoteComparisonFilter {
		return { type: "noteComparison", property, operator, value };
	}

	static eq(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, "==", value);
	}

	static neq(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, "!=", value);
	}

	static gt(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, ">", value);
	}

	static gte(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, ">=", value);
	}

	static lt(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, "<", value);
	}

	static lte(property: string, value: FilterValue): NoteComparisonFilter {
		return Filter.compare(property, "<=", value);
	}

	// ── Contains filters ────────────────────────────────────────────────

	static contains(property: string, value: string): NoteContainsFilter {
		return { type: "noteContains", property, value };
	}

	static selfLink(property: string): NoteSelfLinkFilter {
		return { type: "noteSelfLink", property };
	}

	static reverseContains(property: string): ReverseContainsFilter {
		return { type: "reverseContains", property };
	}

	// ── Link comparisons ───────────────────────────────────────────────

	static eqLink(property: string, path: string, displayName?: string): NoteLinkComparisonFilter {
		return { type: "noteLinkComparison", property, operator: "==", path, ...(displayName && { displayName }) };
	}

	static neqLink(property: string, path: string, displayName?: string): NoteLinkComparisonFilter {
		return { type: "noteLinkComparison", property, operator: "!=", path, ...(displayName && { displayName }) };
	}

	// ── File filters ────────────────────────────────────────────────────

	static inFolder(folder: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "inFolder", args: [folder] };
	}

	static hasTag(...tags: string[]): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasTag", args: tags };
	}

	static hasLink(target: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasLink", args: [target] };
	}

	static hasProperty(property: string): FileFunctionFilter {
		return { type: "fileFunction", fn: "hasProperty", args: [property] };
	}

	static filePath(path: string): FilePathFilter {
		return { type: "filePath", operator: "==", path };
	}

	static filePathNot(path: string): FilePathFilter {
		return { type: "filePath", operator: "!=", path };
	}

	// ── Logical operators ───────────────────────────────────────────────

	static and(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "and", children };
	}

	static or(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "or", children };
	}

	static not(...children: BaseFilterNode[]): BaseFilterGroup {
		return { type: "group", operator: "not", children };
	}

	// ── Escape hatch ────────────────────────────────────────────────────

	static raw(expression: string): RawFilter {
		return { type: "raw", expression };
	}
}
