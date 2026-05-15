import type { z } from "zod";

import type { HttpActionConfig } from "../http-types";
import type { ActionDef } from "../types";

/**
 * Typed DSL for declaring a contract-tested action.
 *
 * `defineAction` is a thin wrapper around the `ActionDef` literal — no runtime
 * cost — that exists to:
 *   1. force a description on every action (CI surfaces missing ones),
 *   2. tie input/output Zod schemas to the handler's TS types,
 *   3. give the emitter a stable hook for JSON Schema generation.
 *
 * @example
 *   defineAction({
 *     description: "Create a new event. Returns the created file path or null.",
 *     input: CreateEventInputSchema,
 *     output: z.string().nullable(),
 *     handler: (input) => createEvent(plugin, input),
 *     parseParams: (raw) => ({ title: raw.title }),
 *   });
 */
export function defineAction<TInput, TOutput>(def: {
	description: string;
	input?: z.ZodType<TInput>;
	output?: z.ZodType<TOutput>;
	handler: (params: TInput) => TOutput | Promise<TOutput>;
	parseParams?: (raw: Record<string, string>) => TInput;
	http?: HttpActionConfig;
}): ActionDef<TInput, TOutput> {
	const action: ActionDef<TInput, TOutput> = {
		description: def.description,
		handler: def.handler,
	};
	if (def.input !== undefined) action.input = def.input;
	if (def.output !== undefined) action.output = def.output;
	if (def.parseParams !== undefined) action.parseParams = def.parseParams;
	if (def.http !== undefined) action.http = def.http;
	return action;
}
