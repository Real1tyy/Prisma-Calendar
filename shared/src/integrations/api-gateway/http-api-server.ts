import http from "node:http";

import { stripTrailingChars } from "../../utils/string/string";
import {
	DEFAULT_BASE_PATH,
	DEFAULT_CORS,
	DEFAULT_HOST,
	type HttpApiServerLike,
	type HttpMethod,
	type HttpResponse,
	type HttpRoute,
	type HttpServerConfig,
	type ParsedHttpRequest,
} from "./http-types";

/**
 * Minimal structural types for the slice of `node:http` this server touches.
 *
 * Declared locally rather than taken from `@types/node`: the published plugin
 * mirrors do not carry that package, so `http.IncomingMessage` & friends resolve
 * to nothing there and every `req`/`res` member access degrades to an implicit
 * any — which is what Obsidian's review reports as a wall of unsafe-member-access
 * errors. Typing the surface here keeps the file sound in both trees.
 */
interface NodeIncomingMessage {
	method?: string;
	url?: string;
	headers: Record<string, string | string[] | undefined>;
	on(event: "data", listener: (chunk: Uint8Array) => void): void;
	on(event: "end", listener: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	destroy(): void;
}

interface NodeServerResponse {
	setHeader(name: string, value: string): void;
	writeHead(status: number): void;
	end(body?: string): void;
}

interface NodeServer {
	listen(port: number, host: string, listener: () => void): void;
	close(callback: () => void): void;
	on(event: "error", listener: (error: Error) => void): void;
	removeListener(event: "error", listener: (error: Error) => void): void;
	address(): { port: number } | string | null;
}

interface NodeHttpModule {
	createServer(handler: (req: NodeIncomingMessage, res: NodeServerResponse) => void): NodeServer;
}

const nodeHttp = http as unknown as NodeHttpModule;

function concatChunks(chunks: Uint8Array[], totalSize: number): Uint8Array {
	const merged = new Uint8Array(totalSize);
	let offset = 0;
	for (const chunk of chunks) {
		merged.set(chunk, offset);
		offset += chunk.length;
	}
	return merged;
}

interface CompiledRoute {
	method: HttpMethod;
	path: string;
	regex: RegExp;
	paramNames: string[];
	handler: (req: ParsedHttpRequest) => Promise<HttpResponse>;
}

const BODY_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH"]);
const MAX_BODY_SIZE = 1_048_576; // 1 MB
const INTROSPECTION_PATH = "/_routes";

function normalizeBasePath(basePath: string): string {
	if (!basePath) return "";
	const trimmed = stripTrailingChars(basePath, "/");
	return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export class HttpApiServer implements HttpApiServerLike {
	private server: NodeServer | null = null;
	private readonly compiledRoutes: CompiledRoute[] = [];
	private readonly config: Required<HttpServerConfig>;

	constructor(config: HttpServerConfig) {
		this.config = {
			port: config.port,
			host: config.host ?? DEFAULT_HOST,
			basePath: normalizeBasePath(config.basePath ?? DEFAULT_BASE_PATH),
			cors: config.cors ?? DEFAULT_CORS,
		};
	}

	// ─── Route Registration ─────────────────────────────────────

	addRoute(route: HttpRoute): void {
		this.compiledRoutes.push(this.compileRoute(route));
	}

	addRoutes(routes: HttpRoute[]): void {
		for (const route of routes) {
			this.addRoute(route);
		}
	}

	getRouteList(): Array<{ method: string; path: string }> {
		return this.compiledRoutes.map((r) => ({ method: r.method, path: r.path }));
	}

	// ─── Lifecycle ──────────────────────────────────────────────

	async start(): Promise<void> {
		if (this.server) return;

		const server = nodeHttp.createServer((req, res) => {
			void this.handleRequest(req, res);
		});
		this.server = server;

		return new Promise((resolve, reject) => {
			server.on("error", reject);
			server.listen(this.config.port, this.config.host, () => {
				server.removeListener("error", reject);
				resolve();
			});
		});
	}

	async stop(): Promise<void> {
		const server = this.server;
		if (!server) return;

		return new Promise((resolve) => {
			server.close(() => {
				this.server = null;
				resolve();
			});
		});
	}

	isRunning(): boolean {
		return this.server !== null;
	}

	/** Returns the actual port the server is listening on, or -1 if not running. Useful when port 0 was requested. */
	getPort(): number {
		const addr = this.server?.address();
		if (addr && typeof addr === "object") return addr.port;
		return -1;
	}

	// ─── Request Handling ───────────────────────────────────────

	private async handleRequest(req: NodeIncomingMessage, res: NodeServerResponse): Promise<void> {
		if (this.config.cors) {
			res.setHeader("Access-Control-Allow-Origin", "*");
			res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
			res.setHeader("Access-Control-Allow-Headers", "Content-Type");
		}

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			res.end();
			return;
		}

		const method = (req.method ?? "GET").toUpperCase() as HttpMethod;
		const url = new URL(req.url ?? "/", `http://${this.config.host}:${this.config.port}`);

		const pathname = this.stripBasePath(url.pathname);
		if (pathname === null) {
			this.sendJson(res, 404, { error: "Not found" });
			return;
		}

		const query = Object.fromEntries(url.searchParams.entries());

		if (pathname === INTROSPECTION_PATH && method === "GET") {
			this.sendJson(res, 200, { routes: this.getRouteList() });
			return;
		}

		const match = this.matchRoute(method, pathname);
		if (!match) {
			this.sendJson(res, 404, { error: "Not found" });
			return;
		}

		let body: unknown = undefined;
		if (BODY_METHODS.has(method)) {
			try {
				body = await this.readBody(req);
			} catch (error) {
				const message = error instanceof Error ? error.message : "Invalid request body";
				this.sendJson(res, 400, { error: message });
				return;
			}
		}

		const parsed: ParsedHttpRequest = {
			method,
			path: pathname,
			params: match.params,
			query,
			body,
		};

		try {
			const result = await match.route.handler(parsed);
			if (result.headers) {
				for (const [key, value] of Object.entries(result.headers)) {
					res.setHeader(key, value);
				}
			}
			this.sendJson(res, result.status, result.body);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Internal server error";
			console.error(`[HttpApiServer] Handler error for ${method} ${pathname}:`, error);
			this.sendJson(res, 500, { error: message });
		}
	}

	// ─── Base Path ──────────────────────────────────────────────

	private stripBasePath(pathname: string): string | null {
		const { basePath } = this.config;
		if (!basePath) return pathname;
		if (pathname === basePath) return "/";
		if (pathname.startsWith(basePath + "/")) return pathname.slice(basePath.length) || "/";
		return null;
	}

	// ─── Route Matching ─────────────────────────────────────────

	private matchRoute(
		method: HttpMethod,
		pathname: string
	): { route: CompiledRoute; params: Record<string, string> } | null {
		for (const route of this.compiledRoutes) {
			if (route.method !== method) continue;

			const match = route.regex.exec(pathname);
			if (!match) continue;

			const params: Record<string, string> = {};
			for (let i = 0; i < route.paramNames.length; i++) {
				params[route.paramNames[i]] = decodeURIComponent(match[i + 1]);
			}

			return { route, params };
		}
		return null;
	}

	private compileRoute(route: HttpRoute): CompiledRoute {
		const paramNames: string[] = [];
		const regexParts = route.path.split("/").map((segment) => {
			if (segment.startsWith(":")) {
				paramNames.push(segment.slice(1));
				return "([^/]+)";
			}
			return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		});

		const regex = new RegExp(`^${regexParts.join("/")}$`);

		return {
			method: route.method,
			path: route.path,
			regex,
			paramNames,
			handler: route.handler,
		};
	}

	// ─── Helpers ────────────────────────────────────────────────

	/** Reads and parses a JSON request body. This server is JSON-only. */
	private readBody(req: NodeIncomingMessage): Promise<unknown> {
		const rawContentType = req.headers["content-type"];
		const contentType = Array.isArray(rawContentType) ? (rawContentType[0] ?? "") : (rawContentType ?? "");
		if (contentType && !contentType.includes("application/json")) {
			return Promise.reject(new Error("Unsupported Content-Type; expected application/json"));
		}

		return new Promise((resolve, reject) => {
			const chunks: Uint8Array[] = [];
			let size = 0;

			req.on("data", (chunk) => {
				size += chunk.length;
				if (size > MAX_BODY_SIZE) {
					req.destroy();
					reject(new Error("Request body too large"));
					return;
				}
				chunks.push(chunk);
			});

			req.on("end", () => {
				const raw = new TextDecoder("utf-8").decode(concatChunks(chunks, size)).trim();
				if (!raw) {
					resolve(undefined);
					return;
				}
				try {
					resolve(JSON.parse(raw));
				} catch {
					reject(new Error("Invalid JSON body"));
				}
			});

			req.on("error", reject);
		});
	}

	private sendJson(res: NodeServerResponse, status: number, body: unknown): void {
		res.setHeader("Content-Type", "application/json");
		res.writeHead(status);
		res.end(JSON.stringify(body));
	}
}
