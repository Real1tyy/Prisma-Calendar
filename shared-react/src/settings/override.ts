import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import type { ReactNode } from "react";

/**
 * Field-level override: tune rendering for a specific field without writing JSX.
 * `render` is the escape hatch — fully takes over the control when provided.
 * `widget` picks a non-default control (e.g. `"textarea"` for a long string).
 */
export interface SchemaFieldOverride {
	label?: string;
	description?: string;
	placeholder?: string;
	options?: Record<string, string>;
	min?: number;
	max?: number;
	step?: number;
	rows?: number;
	widget?: string;
	hidden?: boolean;
	render?: (props: {
		value: unknown;
		onChange: (next: unknown) => void;
		descriptor: SchemaFieldDescriptor;
	}) => ReactNode;
}
