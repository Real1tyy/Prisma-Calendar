import { z } from "zod";

// ── Scalar schemas ──────────────────────────────────────────────────────

export const BaseViewTypeSchema = z.enum(["table", "board", "calendar", "gallery", "cards", "list"]);
export const SortDirectionSchema = z.enum(["ASC", "DESC"]);
export const LogicalOperatorSchema = z.enum(["and", "or", "not"]);
export const ComparisonOperatorSchema = z.enum(["==", "!=", ">", ">=", "<", "<="]);
export const FilterValueSchema = z.union([z.string(), z.number(), z.boolean()]);

// ── Filter leaf schemas ─────────────────────────────────────────────────

export const NoteComparisonFilterSchema = z.object({
	type: z.literal("noteComparison"),
	property: z.string().min(1),
	operator: ComparisonOperatorSchema,
	value: FilterValueSchema,
});

export const NoteContainsFilterSchema = z.object({
	type: z.literal("noteContains"),
	property: z.string().min(1),
	value: z.string(),
});

export const NoteSelfLinkFilterSchema = z.object({
	type: z.literal("noteSelfLink"),
	property: z.string().min(1),
});

export const ReverseContainsFilterSchema = z.object({
	type: z.literal("reverseContains"),
	property: z.string().min(1),
});

export const FilePathFilterSchema = z.object({
	type: z.literal("filePath"),
	operator: z.enum(["==", "!="]),
	path: z.string(),
});

export const FileFunctionFilterSchema = z.object({
	type: z.literal("fileFunction"),
	fn: z.enum(["inFolder", "hasTag", "hasLink", "hasProperty"]),
	args: z.array(z.string()).min(1),
});

export const NoteLinkComparisonFilterSchema = z.object({
	type: z.literal("noteLinkComparison"),
	property: z.string().min(1),
	operator: z.enum(["==", "!="]),
	path: z.string().min(1),
	displayName: z.string().optional(),
});

export const RawFilterSchema = z.object({
	type: z.literal("raw"),
	expression: z.string().min(1),
});

export const BaseFilterLeafSchema = z.discriminatedUnion("type", [
	NoteComparisonFilterSchema,
	NoteContainsFilterSchema,
	NoteSelfLinkFilterSchema,
	NoteLinkComparisonFilterSchema,
	ReverseContainsFilterSchema,
	FilePathFilterSchema,
	FileFunctionFilterSchema,
	RawFilterSchema,
]);

// ── Recursive filter node schema ────────────────────────────────────────

type FilterNodeInput =
	| z.infer<typeof BaseFilterLeafSchema>
	| { type: "group"; operator: "and" | "or" | "not"; children: FilterNodeInput[] };

export const BaseFilterGroupSchema = z.object({
	type: z.literal("group"),
	operator: LogicalOperatorSchema,
	children: z.array(z.lazy((): z.ZodType<FilterNodeInput> => BaseFilterNodeSchema)).min(1),
});

export const BaseFilterNodeSchema: z.ZodType<FilterNodeInput> = z.union([BaseFilterLeafSchema, BaseFilterGroupSchema]);

// ── Structural schemas ──────────────────────────────────────────────────

export const BaseFormulaSchema = z.object({
	name: z.string().min(1),
	expression: z.string().min(1),
});

export const BasePropertyConfigSchema = z.object({
	key: z.string().min(1),
	displayName: z.string().optional(),
});

export const BaseSortSchema = z.object({
	property: z.string().min(1),
	direction: SortDirectionSchema,
});

export const BaseGroupBySchema = z.object({
	property: z.string().min(1),
	direction: SortDirectionSchema,
});

export const BaseViewSchema = z.object({
	type: BaseViewTypeSchema,
	name: z.string().optional(),
	filter: BaseFilterNodeSchema.optional(),
	order: z.array(z.string().min(1)).optional(),
	sort: z.array(BaseSortSchema).optional(),
	rawSort: z.string().optional(),
	columnSize: z.record(z.string(), z.number().positive()).optional(),
	groupBy: BaseGroupBySchema.optional(),
	limit: z.number().int().positive().optional(),
	summaries: z.record(z.string(), z.string()).optional(),
});

export const BaseDefinitionSchema = z.object({
	filter: BaseFilterNodeSchema.optional(),
	formulas: z.array(BaseFormulaSchema).optional(),
	rawFormulas: z.string().optional(),
	properties: z.array(BasePropertyConfigSchema).optional(),
	summaries: z.record(z.string(), z.string()).optional(),
	views: z.array(BaseViewSchema).min(1),
});

export type BaseViewType = z.infer<typeof BaseViewTypeSchema>;
export type SortDirection = z.infer<typeof SortDirectionSchema>;
export type LogicalOperator = z.infer<typeof LogicalOperatorSchema>;
export type ComparisonOperator = z.infer<typeof ComparisonOperatorSchema>;
export type FilterValue = z.infer<typeof FilterValueSchema>;

export type NoteComparisonFilter = z.infer<typeof NoteComparisonFilterSchema>;
export type NoteContainsFilter = z.infer<typeof NoteContainsFilterSchema>;
export type NoteSelfLinkFilter = z.infer<typeof NoteSelfLinkFilterSchema>;
export type ReverseContainsFilter = z.infer<typeof ReverseContainsFilterSchema>;
export type FilePathFilter = z.infer<typeof FilePathFilterSchema>;
export type FileFunctionFilter = z.infer<typeof FileFunctionFilterSchema>;
export type NoteLinkComparisonFilter = z.infer<typeof NoteLinkComparisonFilterSchema>;
export type RawFilter = z.infer<typeof RawFilterSchema>;
export type BaseFilterLeaf = z.infer<typeof BaseFilterLeafSchema>;
export type BaseFilterGroup = z.infer<typeof BaseFilterGroupSchema>;
export type BaseFilterNode = z.infer<typeof BaseFilterNodeSchema>;
export type BaseFormula = z.infer<typeof BaseFormulaSchema>;
export type BasePropertyConfig = z.infer<typeof BasePropertyConfigSchema>;
export type BaseSort = z.infer<typeof BaseSortSchema>;
export type BaseGroupBy = z.infer<typeof BaseGroupBySchema>;
export type BaseView = z.infer<typeof BaseViewSchema>;
export type BaseDefinition = z.infer<typeof BaseDefinitionSchema>;

export type FieldKey<T> = Extract<keyof T, string>;
