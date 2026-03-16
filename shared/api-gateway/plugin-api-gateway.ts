import { Notice } from "obsidian";

import { DEFAULT_BASE_PATH, DEFAULT_HOST, HttpApiServer } from "./http-api-server";
import type { HttpRoute, HttpServerConfig } from "./http-types";
import type { ActionDefMap, InferWindowApi, PluginApiGatewayOptions, UrlAccessibleActions } from "./types";

function camelToKebab(str: string): string {
	return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Shared utility that wires up a typed `window[globalKey]` API, an optional
 * `obsidian://protocolKey` protocol handler, and an optional HTTP server
 * from a single action definition map.
 *
 * Usage:
 * ```ts
 * const gateway = new PluginApiGateway({
 *   plugin: this,
 *   globalKey: "PrismaCalendar",
 *   protocolKey: "prisma-calendar",
 *   actions: { ... },
 *   http: { enabled: true, port: 27124 },
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
	private readonly httpConfig: (HttpServerConfig & { enabled?: boolean }) | undefined;
	private api: InferWindowApi<TActions> | null = null;
	private httpServer: HttpApiServer | null = null;
	private isExposed = false;
	private pendingHttpRoutes: HttpRoute[] = [];

	constructor(options: PluginApiGatewayOptions<TActions>) {
		this.plugin = options.plugin;
		this.globalKey = options.globalKey;
		this.protocolKey = options.protocolKey;
		this.actions = options.actions;
		this.httpConfig = options.http;
	}

	// ─── Public API ──────────────────────────────────────────────

	/**
	 * Assigns the typed API to `window[globalKey]`, registers the
	 * `obsidian://protocolKey` handler if configured, and starts the
	 * HTTP server if enabled. No-op if already exposed.
	 */
	expose(): void {
		if (this.isExposed) return;
		this.isExposed = true;

		this.api = this.buildApi();

		const globalObj = window as unknown as Record<string, unknown>;
		if (globalObj[this.globalKey] !== undefined) {
			console.warn(`[PluginApiGateway] window.${this.globalKey} already exists and will be overwritten`);
		}
		globalObj[this.globalKey] = this.api;

		if (this.protocolKey) {
			this.plugin.registerObsidianProtocolHandler(this.protocolKey, (params) => {
				void this.dispatchProtocol(params);
			});
		}

		if (this.httpConfig?.enabled) {
			this.httpServer = new HttpApiServer(this.httpConfig);
			this.buildHttpRoutes();

			if (this.pendingHttpRoutes.length > 0) {
				this.httpServer.addRoutes(this.pendingHttpRoutes);
				this.pendingHttpRoutes = [];
			}

			void this.httpServer
				.start()
				.then(() => {
					const host = this.httpConfig!.host ?? DEFAULT_HOST;
					const base = this.httpConfig!.basePath ?? DEFAULT_BASE_PATH;
					console.log(`[PluginApiGateway] HTTP server started at http://${host}:${this.httpConfig!.port}${base}`);
				})
				.catch((error) => {
					console.error("[PluginApiGateway] Failed to start HTTP server:", error);
					new Notice("Failed to start plugin HTTP API server");
				});
		}
	}

	/**
	 * Removes `window[globalKey]` and stops the HTTP server.
	 * Protocol handler cleanup is automatic when Obsidian unloads the plugin.
	 * No-op if not exposed.
	 */
	unexpose(): void {
		if (!this.isExposed) return;
		this.isExposed = false;

		if (this.httpServer) {
			const server = this.httpServer;
			this.httpServer = null;
			void server.stop().catch((error) => {
				console.error("[PluginApiGateway] Failed to stop HTTP server:", error);
			});
		}

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

	/**
	 * Returns the HTTP server instance if running, for adding custom routes.
	 */
	getHttpServer(): HttpApiServer | null {
		return this.httpServer;
	}

	/**
	 * Adds routes to the HTTP server. Can be called before or after expose().
	 * Routes added before expose() are queued and registered when the server starts.
	 */
	addHttpRoutes(routes: HttpRoute[]): void {
		if (this.httpServer) {
			this.httpServer.addRoutes(routes);
		} else {
			this.pendingHttpRoutes.push(...routes);
		}
	}

	// ─── Internals ───────────────────────────────────────────────

	private buildApi(): InferWindowApi<TActions> {
		const api = {} as Record<string, unknown>;
		for (const [name, def] of Object.entries(this.actions)) {
			api[name] = def.handler;
		}
		return api as InferWindowApi<TActions>;
	}

	private buildHttpRoutes(): void {
		if (!this.httpServer) return;

		for (const [name, def] of Object.entries(this.actions)) {
			if (def.http?.disabled) continue;

			const method = def.http?.method ?? (def.parseParams || def.http?.parseBody ? "POST" : "GET");
			const path = def.http?.path ?? `/${camelToKebab(name)}`;

			const route: HttpRoute = {
				method,
				path,
				handler: async (req) => {
					try {
						const params = this.resolveHandlerParams(def, req);
						const result = await def.handler(params);
						return { status: 200, body: result === undefined ? { success: true } : result };
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						return { status: 400, body: { error: message } };
					}
				},
			};

			this.httpServer.addRoute(route);
		}
	}

	/**
	 * Resolves handler params from route/query params and body.
	 * - `parseBody` defined → body-driven; merged with `parseParams` if both present
	 * - `parseParams` defined → query/route-param driven
	 * - neither → raw body passthrough
	 */
	private resolveHandlerParams(
		def: ActionDefMap[string],
		req: { query: Record<string, string>; params: Record<string, string>; body: unknown }
	): unknown {
		const routeParams = def.parseParams ? def.parseParams({ ...req.query, ...req.params }) : undefined;

		const bodyParams = def.http?.parseBody && req.body !== undefined ? def.http.parseBody(req.body) : undefined;

		if (routeParams && bodyParams && typeof routeParams === "object" && typeof bodyParams === "object") {
			return { ...routeParams, ...bodyParams };
		}

		if (bodyParams !== undefined) return bodyParams;
		if (routeParams !== undefined) return routeParams;
		if (req.body !== undefined) return req.body;

		return undefined;
	}

	private async dispatchProtocol(params: Record<string, string>): Promise<void> {
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
