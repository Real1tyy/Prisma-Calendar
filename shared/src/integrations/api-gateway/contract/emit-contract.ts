import { z } from "zod";

import { canDeriveUrlCoercer } from "../derive-url-coercer";
import type { HttpMethod } from "../http-types";
import type { ActionDef, ActionDefMap } from "../types";
import type { JsonSchemaFragment, PluginApiContract, PluginApiContractAction } from "./types";

function isUrlAccessible(def: ActionDef): boolean {
	if (def.parseParams !== undefined) return true;
	if (!def.input) return false;
	return canDeriveUrlCoercer(def.input);
}

function camelToKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Mirrors `PluginApiGateway.buildHttpRoutes()` so the contract records the
 * same method/path the gateway would expose if HTTP were enabled. Keeping the
 * two derivations in sync is enforced by `shared/tests/api-gateway/contract/*`.
 */
function deriveHttp(name: string, def: ActionDef): { method: HttpMethod; path: string } | undefined {
	if (def.http?.disabled) return undefined;
	const hasUrlInputs = def.parseParams !== undefined || (def.input !== undefined && canDeriveUrlCoercer(def.input));
	const method: HttpMethod = def.http?.method ?? (hasUrlInputs || def.http?.parseBody ? "POST" : "GET");
	const path = def.http?.path ?? `/${camelToKebab(name)}`;
	return { method, path };
}

/**
 * Converts a Zod schema to a JSON Schema fragment via `z.toJSONSchema()`
 * (Zod 4 native — no extra dependency). Strips Zod's `~standard` marker so
 * the committed artifact stays free of internal metadata.
 *
 * Returns `null` for missing schemas — preserved in the output so a deliberate
 * "no schema declared" is distinguishable from a forgotten emission step.
 */
function toJsonSchema(schema: z.ZodType | undefined): JsonSchemaFragment | null {
	if (!schema) return null;
	const raw = z.toJSONSchema(schema, { target: "draft-2020-12", unrepresentable: "any" }) as Record<string, unknown>;
	// `~standard` is Zod-internal handshake metadata; not part of the contract.
	const { ["~standard"]: _ignore, ...rest } = raw;
	return sortKeysDeep(rest);
}

/**
 * Stable key ordering — load-bearing for drift detection. Without it,
 * `JSON.stringify` order would depend on Zod's internal property insertion,
 * which can shift between minor versions and produce phantom diffs.
 */
function sortKeysDeep<T>(value: T): T {
	if (Array.isArray(value)) {
		return value.map((v) => sortKeysDeep(v)) as unknown as T;
	}
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
		const out: Record<string, unknown> = {};
		for (const [k, v] of entries) out[k] = sortKeysDeep(v);
		return out as unknown as T;
	}
	return value;
}

/**
 * Walks an ActionDefMap and produces a deterministic contract document.
 *
 * The document is the canonical artifact committed to the repo under
 * `{plugin}/api-contract.json`. It is consumed by:
 *   - the drift checker (`compareContracts`, `assertNoContractDrift`)
 *   - future `.d.ts` emitters
 *   - any external consumer that wants to discover the API without depending
 *     on the plugin's source tree.
 */
export function emitContract(options: {
	globalKey: string;
	pluginVersion: string;
	actions: ActionDefMap;
}): PluginApiContract {
	const sortedNames = Object.keys(options.actions).sort();
	const actions: Record<string, PluginApiContractAction> = {};

	for (const name of sortedNames) {
		const def = options.actions[name];
		const http = deriveHttp(name, def);
		const entry: PluginApiContractAction = {
			description: def.description ?? "",
			urlAccessible: isUrlAccessible(def),
			input: toJsonSchema(def.input),
			output: toJsonSchema(def.output),
		};
		if (http) entry.http = http;
		actions[name] = entry;
	}

	return {
		contractVersion: 1,
		globalKey: options.globalKey,
		pluginVersion: options.pluginVersion,
		actions,
	};
}

/**
 * Serialises a contract to its canonical on-disk JSON form. Tab indentation +
 * trailing newline matches the repo Prettier config (`useTabs: true`) so a
 * post-emit Prettier pass is a no-op and committed artifacts round-trip
 * without diff churn.
 */
export function serializeContract(contract: PluginApiContract): string {
	return `${JSON.stringify(contract, null, "\t")}\n`;
}
