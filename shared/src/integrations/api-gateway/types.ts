import type { Plugin } from "obsidian";
import type { z } from "zod";

import type { HttpActionConfig, HttpApiServerLike, HttpServerConfig } from "./http-types";

/** Handler function for an action. Always accepts params (void for no-input actions). */
export type ActionHandler<TParams = void, TReturn = void> = (params: TParams) => TReturn | Promise<TReturn>;

/**
 * Definition of a single action in the API gateway.
 * - `handler`: the function that executes the action
 * - `parseParams`: optional converter from URL query params to typed params.
 *   If omitted, the action is window-API-only (not URL-accessible).
 * - `http`: optional HTTP transport configuration.
 * - `description` / `input` / `output`: optional contract metadata read by
 *   `emitContract()` to produce the committed JSON Schema artifact. Has no
 *   runtime effect — purely documentation + drift detection.
 *   See `docs/decisions/2026-05-14-plugin-api-contract-testing.md`.
 */
export interface ActionDef<TParams = void, TReturn = void> {
	handler: ActionHandler<TParams, TReturn>;
	parseParams?: (raw: Record<string, string>) => TParams;
	http?: HttpActionConfig;
	description?: string;
	input?: z.ZodType<TParams>;
	output?: z.ZodType<TReturn>;
}

/**
 * Map of action name → action definition.
 *
 * WHY (no-explicit-any): `any` is load-bearing here for variance — `ActionDef`'s
 * `TParams` sits in a contravariant position (function parameter), so `unknown`
 * would prevent concrete handlers like `(p: { id: string }) => string` from
 * being assignable. The map intentionally erases the per-action generics;
 * consumers narrow via `InferWindowApi<TActions>` which preserves the original
 * handler signature.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- load-bearing for variance, see the WHY comment above
export type AnyActionDef = ActionDef<any, any>;

export type ActionDefMap = Record<string, AnyActionDef>;

/**
 * Extracts the typed window API shape from an ActionDefMap.
 * Each key maps to the handler's signature.
 */
export type InferWindowApi<TActions extends ActionDefMap> = {
	[K in keyof TActions]: TActions[K]["handler"];
};

/**
 * Names of URL-accessible actions — either an explicit `parseParams` is
 * provided, or an `input` Zod schema is present and the gateway can derive
 * a coercer from it. Both produce a callable `obsidian://protocolKey?...` URL.
 */
export type UrlAccessibleActions<TActions extends ActionDefMap> = {
	[K in keyof TActions]: TActions[K]["parseParams"] extends undefined
		? TActions[K]["input"] extends undefined
			? never
			: K
		: K;
}[keyof TActions];

/**
 * Constructor options for PluginApiGateway.
 */
export interface PluginApiGatewayOptions<TActions extends ActionDefMap> {
	plugin: Plugin;
	globalKey: string;
	protocolKey?: string;
	actions: TActions;
	/**
	 * Opt-in HTTP transport. `createServer` is required rather than defaulted to
	 * `HttpApiServer` on purpose: the implementation imports `node:http`, so a
	 * default would re-link the desktop-only dependency into every plugin bundle
	 * that touches the gateway. Requiring the factory keeps that dependency
	 * visible at the call site, which imports it from the deep subpath:
	 *
	 * ```ts
	 * import { HttpApiServer } from "@real1ty/obsidian-plugins/integrations/api-gateway/http-api-server";
	 *
	 * http: { enabled: true, port: 27124, createServer: (config) => new HttpApiServer(config) }
	 * ```
	 *
	 * A plugin doing this must declare `isDesktopOnly: true` in its manifest.
	 */
	http?: HttpServerConfig & {
		enabled?: boolean;
		createServer: (config: HttpServerConfig) => HttpApiServerLike;
	};
}
