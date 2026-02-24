import { Notice } from "obsidian";
import type { ActionDefMap, InferWindowApi, PluginApiGatewayOptions, UrlAccessibleActions } from "./types";

/**
 * Shared utility that wires up a typed `window[globalKey]` API and an optional
 * `obsidian://protocolKey` protocol handler from a single action definition map.
 *
 * Usage:
 * ```ts
 * const gateway = new PluginApiGateway({
 *   plugin: this,
 *   globalKey: "PrismaCalendar",
 *   protocolKey: "prisma-calendar",
 *   actions: { ... },
 * });
 * gateway.expose();   // onload
 * gateway.unexpose(); // onunload
 * ```
 */
export class PluginApiGateway<TActions extends ActionDefMap> {
	private readonly plugin: PluginApiGatewayOptions<TActions>["plugin"];
	private readonly globalKey: string;
	private readonly protocolKey: string | undefined;
	private readonly actions: TActions;
	private api: InferWindowApi<TActions> | null = null;

	constructor(options: PluginApiGatewayOptions<TActions>) {
		this.plugin = options.plugin;
		this.globalKey = options.globalKey;
		this.protocolKey = options.protocolKey;
		this.actions = options.actions;
	}

	// ─── Public API ──────────────────────────────────────────────

	/**
	 * Assigns the typed API to `window[globalKey]` and registers the
	 * `obsidian://protocolKey` handler if `protocolKey` was provided.
	 */
	expose(): void {
		this.api = this.buildApi();
		(window as unknown as Record<string, unknown>)[this.globalKey] = this.api;

		if (this.protocolKey) {
			this.plugin.registerObsidianProtocolHandler(this.protocolKey, (params) => {
				void this.dispatchProtocol(params);
			});
		}
	}

	/**
	 * Removes `window[globalKey]`. Protocol handler cleanup is automatic
	 * when Obsidian unloads the plugin.
	 */
	unexpose(): void {
		delete (window as unknown as Record<string, unknown>)[this.globalKey];
		this.api = null;
	}

	/**
	 * Returns the typed API object (for internal or test use).
	 */
	getApi(): InferWindowApi<TActions> {
		if (!this.api) {
			this.api = this.buildApi();
		}
		return this.api;
	}

	/**
	 * Generates a typed `obsidian://protocolKey?call=actionName&key=value...` URL.
	 * Only available for actions that define `parseParams`.
	 */
	buildUrl<K extends UrlAccessibleActions<TActions> & string>(
		call: K,
		params?: Record<string, string | number | boolean>
	): string {
		if (!this.protocolKey) {
			throw new Error("Cannot build URL: no protocolKey configured");
		}

		const searchParams = new URLSearchParams();
		searchParams.set("call", call);

		if (params) {
			for (const [key, value] of Object.entries(params)) {
				searchParams.set(key, String(value));
			}
		}

		return `obsidian://${this.protocolKey}?${searchParams.toString()}`;
	}

	// ─── Internals ───────────────────────────────────────────────

	private buildApi(): InferWindowApi<TActions> {
		const api = {} as Record<string, unknown>;
		for (const [name, def] of Object.entries(this.actions)) {
			api[name] = def.handler;
		}
		return api as InferWindowApi<TActions>;
	}

	private async dispatchProtocol(params: Record<string, string>): Promise<void> {
		console.debug("[PluginApiGateway] Raw protocol params:", JSON.stringify(params));
		const call = params.call;
		if (!call) {
			new Notice("Protocol URL missing 'call' parameter");
			return;
		}

		const actionDef = this.actions[call];
		if (!actionDef) {
			new Notice(`Unknown action: ${call}`);
			return;
		}

		if (!actionDef.parseParams) {
			new Notice(`Action "${call}" is not URL-accessible`);
			return;
		}

		try {
			const typedParams = actionDef.parseParams(params);
			await actionDef.handler(typedParams);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Protocol error: ${message}`);
			console.error(`[PluginApiGateway] Protocol dispatch error for "${call}":`, error);
		}
	}
}
