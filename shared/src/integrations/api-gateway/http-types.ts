export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface HttpRoute {
	method: HttpMethod;
	path: string;
	handler: (req: ParsedHttpRequest) => Promise<HttpResponse>;
}

export interface ParsedHttpRequest {
	method: HttpMethod;
	path: string;
	params: Record<string, string>;
	query: Record<string, string>;
	body: unknown;
}

export interface HttpResponse {
	status: number;
	body: unknown;
	headers?: Record<string, string>;
}

export interface HttpServerConfig {
	port: number;
	host?: string;
	basePath?: string;
	cors?: boolean;
}

export interface HttpActionConfig {
	method?: HttpMethod;
	path?: string;
	parseBody?: (body: unknown) => unknown;
	disabled?: boolean;
}

export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_BASE_PATH = "";
export const DEFAULT_CORS = true;

/**
 * The slice of `HttpApiServer` that `PluginApiGateway` drives.
 *
 * The gateway talks to the server through this interface and never imports the
 * implementation, because `HttpApiServer` imports `node:http` — and Rollup hoists
 * external imports to a top-level `require()` in the CJS bundle whether or not the
 * binding is read. A static edge from the gateway would therefore put
 * `require("node:http")` at the top of every plugin's `main.js`, breaking load on
 * mobile. See [[spec-no-node-builtins-in-bundles]].
 */
export interface HttpApiServerLike {
	addRoute(route: HttpRoute): void;
	addRoutes(routes: HttpRoute[]): void;
	start(): Promise<void>;
	stop(): Promise<void>;
}
