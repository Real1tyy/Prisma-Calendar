/**
 * Shape of the committed `api-contract.json` artifact.
 *
 * The contract document is deterministic: action keys are sorted, no timestamps,
 * stable JSON Schema dialect (Draft 2020-12 — Zod 4's default). Determinism is
 * load-bearing: any drift triggers CI, and non-deterministic output would
 * generate phantom diffs.
 */
export interface PluginApiContract {
	contractVersion: 1;
	globalKey: string;
	pluginVersion: string;
	actions: Record<string, PluginApiContractAction>;
}

export interface PluginApiContractAction {
	description: string;
	urlAccessible: boolean;
	http?: {
		method: string;
		path: string;
	};
	/** Zod input schema converted via `z.toJSONSchema()`. Null when the action has no declared input schema. */
	input: JsonSchemaFragment | null;
	/** Zod output schema converted via `z.toJSONSchema()`. Null when the action has no declared output schema. */
	output: JsonSchemaFragment | null;
}

/**
 * A JSON Schema fragment. We deliberately type it loosely — the schema
 * dialect is Zod 4's default (Draft 2020-12), and the consumer is the drift
 * checker which compares fragments by structural equality.
 */
export type JsonSchemaFragment = Record<string, unknown>;
