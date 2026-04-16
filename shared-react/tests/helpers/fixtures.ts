import type { SchemaFieldDescriptor } from "@real1ty-obsidian-plugins";
import { introspectField, introspectShape } from "@real1ty-obsidian-plugins";
import { z } from "zod";

/**
 * Small Zod schema used across schema-renderer tests. Covers every descriptor
 * branch the built-in dispatch knows how to render without tying tests to any
 * real plugin settings shape.
 */
export const ExampleSchema = z.object({
	title: z.string().default("Untitled").describe("Human-readable title"),
	count: z.number().min(0).max(10).default(0).describe("Bounded counter"),
	rating: z.number().default(0).describe("Unbounded number"),
	enabled: z.boolean().default(false).describe("Feature flag"),
	mode: z.enum(["light", "dark", "auto"]).default("auto").describe("UI mode"),
	tags: z.array(z.string()).default([]).describe("Freeform tags"),
	scores: z.array(z.number()).default([]).describe("Numeric tags"),
	bio: z.string().optional().describe("Optional bio"),
});

export type ExampleSettings = z.infer<typeof ExampleSchema>;

export const EXAMPLE_DEFAULTS: ExampleSettings = {
	title: "Untitled",
	count: 0,
	rating: 0,
	enabled: false,
	mode: "auto",
	tags: [],
	scores: [],
};

export function describeExample(): SchemaFieldDescriptor[] {
	return introspectShape(ExampleSchema.shape);
}

export function descriptorFor(key: keyof typeof ExampleSchema.shape): SchemaFieldDescriptor {
	return introspectField(key as string, ExampleSchema.shape[key] as never);
}
