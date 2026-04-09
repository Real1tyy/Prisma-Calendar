import type { SerializableSchema } from "@real1ty-obsidian-plugins";
import { withSerialize } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type { Frontmatter } from "../types";

/**
 * Passthrough schema for event frontmatter.
 * Accepts any Record<string, unknown> and stores it as-is —
 * property name mapping is handled by consumers via settings props.
 */
const FrontmatterPassthroughSchema = z.record(z.string(), z.unknown());

export function createEventSchema(): SerializableSchema<Frontmatter> {
	return withSerialize(FrontmatterPassthroughSchema) as SerializableSchema<Frontmatter>;
}
