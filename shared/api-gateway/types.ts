import type { Plugin } from "obsidian";

/**
 * Handler function for an action. If TParams is void, the handler takes no arguments.
 */
export type ActionHandler<TParams = void> = TParams extends void
	? () => void | Promise<void>
	: (params: TParams) => void | Promise<void>;

/**
 * Definition of a single action in the API gateway.
 * - `handler`: the function that executes the action
 * - `parseParams`: optional converter from URL query params to typed params.
 *   If omitted, the action is window-API-only (not URL-accessible).
 */
export interface ActionDef<TParams = void> {
	handler: ActionHandler<TParams>;
	parseParams?: (raw: Record<string, string>) => TParams;
}

/**
 * Map of action name → action definition.
 */
export type ActionDefMap = Record<string, ActionDef<any>>;

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
}
