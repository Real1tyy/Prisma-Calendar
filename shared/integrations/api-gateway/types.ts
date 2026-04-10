import type { Plugin } from "obsidian";

import type { HttpActionConfig, HttpServerConfig } from "./http-types";

/** Handler function for an action. Always accepts params (void for no-input actions). */
export type ActionHandler<TParams = void, TReturn = void> = (params: TParams) => TReturn | Promise<TReturn>;

/**
 * Definition of a single action in the API gateway.
 * - `handler`: the function that executes the action
 * - `parseParams`: optional converter from URL query params to typed params.
 *   If omitted, the action is window-API-only (not URL-accessible).
 * - `http`: optional HTTP transport configuration. Controls how (or whether)
 *   this action is exposed over the HTTP server.
 */
export interface ActionDef<TParams = void, TReturn = void> {
	handler: ActionHandler<TParams, TReturn>;
	parseParams?: (raw: Record<string, string>) => TParams;
	http?: HttpActionConfig;
}

/**
 * Map of action name → action definition.
 */
export type ActionDefMap = Record<string, ActionDef<any, any>>;

/**
 * Extracts the typed window API shape from an ActionDefMap.
 * Each key maps to the handler's signature.
 */
export type InferWindowApi<TActions extends ActionDefMap> = {
	[K in keyof TActions]: TActions[K]["handler"];
};

/**
 * Names of actions that have `parseParams` defined (URL-accessible actions).
 */
export type UrlAccessibleActions<TActions extends ActionDefMap> = {
	[K in keyof TActions]: TActions[K]["parseParams"] extends undefined ? never : K;
}[keyof TActions];

/**
 * Constructor options for PluginApiGateway.
 */
export interface PluginApiGatewayOptions<TActions extends ActionDefMap> {
	plugin: Plugin;
	globalKey: string;
	protocolKey?: string;
	actions: TActions;
	http?: HttpServerConfig & {
		enabled?: boolean;
	};
}
