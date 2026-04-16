import http from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { HttpApiServer } from "../../src/integrations/api-gateway/http-api-server";
import type { HttpRoute, ParsedHttpRequest } from "../../src/integrations/api-gateway/http-types";

// ─── Helpers ────────────────────────────────────────────────────

const servers: HttpApiServer[] = [];

async function createServer(
	routes: HttpRoute[],
	config: { basePath?: string; cors?: boolean } = {}
): Promise<{ server: HttpApiServer; port: number }> {
	const server = new HttpApiServer({ port: 0, ...config });
	server.addRoutes(routes);
	await server.start();
	servers.push(server);
	return { server, port: server.getPort() };
}

afterEach(async () => {
	await Promise.all(servers.map((s) => s.stop()));
	servers.length = 0;
});

function fetch(
	port: number,
	method: string,
	path: string,
	body?: unknown,
	headers?: Record<string, string>
): Promise<{ status: number; body: unknown; headers: http.IncomingHttpHeaders }> {
	return new Promise((resolve, reject) => {
		const hdrs: Record<string, string> = { ...headers };
		const payload = body !== undefined ? JSON.stringify(body) : undefined;
		if (payload) {
			hdrs["content-type"] ??= "application/json";
			hdrs["content-length"] = String(Buffer.byteLength(payload));
		}

		const req = http.request({ hostname: "127.0.0.1", port, path, method, headers: hdrs }, (res) => {
			const chunks: Buffer[] = [];
			res.on("data", (c: Buffer) => chunks.push(c));
			res.on("end", () => {
				const raw = Buffer.concat(chunks).toString("utf-8");
				let parsed: unknown;
				try {
					parsed = JSON.parse(raw);
				} catch {
					parsed = raw;
				}
				resolve({ status: res.statusCode!, body: parsed, headers: res.headers });
			});
		});

		req.on("error", reject);
		if (payload) req.write(payload);
		req.end();
	});
}

function fetchRaw(
	port: number,
	method: string,
	path: string,
	rawBody: string,
	headers: Record<string, string>
): Promise<{ status: number; body: unknown }> {
	return new Promise((resolve, reject) => {
		const req = http.request({ hostname: "127.0.0.1", port, path, method, headers }, (res) => {
			const chunks: Buffer[] = [];
			res.on("data", (c: Buffer) => chunks.push(c));
			res.on("end", () => {
				const raw = Buffer.concat(chunks).toString("utf-8");
				let parsed: unknown;
				try {
					parsed = JSON.parse(raw);
				} catch {
					parsed = raw;
				}
				resolve({ status: res.statusCode!, body: parsed });
			});
		});
		req.on("error", reject);
		req.write(rawBody);
		req.end();
	});
}

function echoRoute(method: "GET" | "POST" | "PUT" | "DELETE", path: string): HttpRoute {
	return {
		method,
		path,
		handler: async (req: ParsedHttpRequest) => ({
			status: 200,
			body: { params: req.params, query: req.query, body: req.body, path: req.path },
		}),
	};
}

// ─── Tests ──────────────────────────────────────────────────────

describe("HttpApiServer", () => {
	describe("route matching", () => {
		it("matches a static GET route", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "GET", "/items");

			expect(res.status).toBe(200);
			expect((res.body as any).path).toBe("/items");
		});

		it("extracts single path param", async () => {
			const { port } = await createServer([echoRoute("GET", "/items/:id")]);
			const res = await fetch(port, "GET", "/items/abc-123");

			expect(res.status).toBe(200);
			expect((res.body as any).params).toEqual({ id: "abc-123" });
		});

		it("extracts multiple path params", async () => {
			const { port } = await createServer([echoRoute("GET", "/projects/:projectId/tasks/:taskId")]);
			const res = await fetch(port, "GET", "/projects/proj-1/tasks/task-42");

			expect(res.status).toBe(200);
			expect((res.body as any).params).toEqual({ projectId: "proj-1", taskId: "task-42" });
		});

		it("decodes URL-encoded path params", async () => {
			const { port } = await createServer([echoRoute("GET", "/items/:id")]);
			const res = await fetch(port, "GET", "/items/hello%20world");

			expect((res.body as any).params).toEqual({ id: "hello world" });
		});

		it("passes query params to handler", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "GET", "/items?status=active&limit=10");

			expect((res.body as any).query).toEqual({ status: "active", limit: "10" });
		});

		it("returns 404 for unmatched path", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "GET", "/nonexistent");

			expect(res.status).toBe(404);
			expect((res.body as any).error).toBe("Not found");
		});

		it("returns 404 for wrong HTTP method", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "DELETE", "/items");

			expect(res.status).toBe(404);
		});

		it("does not match partial path segments", async () => {
			const { port } = await createServer([echoRoute("GET", "/api")]);
			const res = await fetch(port, "GET", "/api2");

			expect(res.status).toBe(404);
		});

		it("matches routes with special regex characters in static segments", async () => {
			const { port } = await createServer([echoRoute("GET", "/items/_schema")]);
			const res = await fetch(port, "GET", "/items/_schema");

			expect(res.status).toBe(200);
		});
	});

	describe("request body", () => {
		it("parses JSON body on POST", async () => {
			const { port } = await createServer([echoRoute("POST", "/items")]);
			const res = await fetch(port, "POST", "/items", { name: "Test", value: 42 });

			expect(res.status).toBe(200);
			expect((res.body as any).body).toEqual({ name: "Test", value: 42 });
		});

		it("parses JSON body on PUT with path params", async () => {
			const { port } = await createServer([echoRoute("PUT", "/items/:id")]);
			const res = await fetch(port, "PUT", "/items/abc", { data: { status: "done" } });

			expect(res.status).toBe(200);
			expect((res.body as any).body).toEqual({ data: { status: "done" } });
			expect((res.body as any).params).toEqual({ id: "abc" });
		});

		it("body is undefined for GET requests", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "GET", "/items");

			expect((res.body as any).body).toBeUndefined();
		});

		it("returns 400 for invalid JSON body", async () => {
			const { port } = await createServer([echoRoute("POST", "/items")]);
			const res = await fetchRaw(port, "POST", "/items", "not json {{{", { "content-type": "application/json" });

			expect(res.status).toBe(400);
			expect((res.body as any).error).toBe("Invalid JSON body");
		});

		it("rejects non-JSON content type", async () => {
			const { port } = await createServer([echoRoute("POST", "/items")]);
			const res = await fetchRaw(port, "POST", "/items", "hello", { "content-type": "text/plain" });

			expect(res.status).toBe(400);
			expect((res.body as any).error).toContain("Unsupported Content-Type");
		});

		it("accepts POST with no content-type header", async () => {
			const { port } = await createServer([echoRoute("POST", "/items")]);
			const res = await fetchRaw(port, "POST", "/items", '{"ok":true}', {});

			expect(res.status).toBe(200);
			expect((res.body as any).body).toEqual({ ok: true });
		});
	});

	describe("basePath", () => {
		it("strips basePath prefix from requests", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { basePath: "/api/v1" });
			const res = await fetch(port, "GET", "/api/v1/items");

			expect(res.status).toBe(200);
			expect((res.body as any).path).toBe("/items");
		});

		it("normalizes basePath with trailing slash", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { basePath: "/api/" });
			const res = await fetch(port, "GET", "/api/items");

			expect(res.status).toBe(200);
		});

		it("returns 404 for requests outside basePath", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { basePath: "/api" });
			const res = await fetch(port, "GET", "/items");

			expect(res.status).toBe(404);
		});

		it("does not match basePath as prefix of longer segment", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { basePath: "/api" });
			const res = await fetch(port, "GET", "/api2/items");

			expect(res.status).toBe(404);
		});

		it("matches exact basePath as root", async () => {
			const { port } = await createServer([echoRoute("GET", "/")], { basePath: "/api" });
			const res = await fetch(port, "GET", "/api");

			expect(res.status).toBe(200);
			expect((res.body as any).path).toBe("/");
		});

		it("path params work with basePath", async () => {
			const { port } = await createServer([echoRoute("GET", "/items/:id")], { basePath: "/api" });
			const res = await fetch(port, "GET", "/api/items/xyz");

			expect(res.status).toBe(200);
			expect((res.body as any).params).toEqual({ id: "xyz" });
		});
	});

	describe("introspection", () => {
		it("returns route list at /_routes", async () => {
			const { port } = await createServer([
				echoRoute("GET", "/items"),
				echoRoute("POST", "/items"),
				echoRoute("GET", "/items/:id"),
			]);
			const res = await fetch(port, "GET", "/_routes");

			expect(res.status).toBe(200);
			expect((res.body as any).routes).toEqual([
				{ method: "GET", path: "/items" },
				{ method: "POST", path: "/items" },
				{ method: "GET", path: "/items/:id" },
			]);
		});

		it("introspection works under basePath", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { basePath: "/api" });
			const res = await fetch(port, "GET", "/api/_routes");

			expect(res.status).toBe(200);
			expect((res.body as any).routes).toHaveLength(1);
		});

		it("user-defined GET / is not blocked by introspection", async () => {
			const { port } = await createServer([
				{ method: "GET", path: "/", handler: async () => ({ status: 200, body: { custom: true } }) },
			]);
			const res = await fetch(port, "GET", "/");

			expect(res.status).toBe(200);
			expect((res.body as any).custom).toBe(true);
		});
	});

	describe("CORS", () => {
		it("sets CORS headers when enabled (default)", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")]);
			const res = await fetch(port, "GET", "/items");

			expect(res.headers["access-control-allow-origin"]).toBe("*");
		});

		it("responds 204 to OPTIONS preflight", async () => {
			const { port } = await createServer([echoRoute("POST", "/items")]);
			const res = await new Promise<{ status: number; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
				const req = http.request({ hostname: "127.0.0.1", port, path: "/items", method: "OPTIONS" }, (r) => {
					r.resume();
					r.on("end", () => resolve({ status: r.statusCode!, headers: r.headers }));
				});
				req.on("error", reject);
				req.end();
			});

			expect(res.status).toBe(204);
			expect(res.headers["access-control-allow-methods"]).toContain("POST");
		});

		it("omits CORS headers when disabled", async () => {
			const { port } = await createServer([echoRoute("GET", "/items")], { cors: false });
			const res = await fetch(port, "GET", "/items");

			expect(res.headers["access-control-allow-origin"]).toBeUndefined();
		});
	});

	describe("handler errors", () => {
		it("returns 500 when handler throws", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const { port } = await createServer([
				{
					method: "GET",
					path: "/fail",
					handler: async () => {
						throw new Error("Something broke");
					},
				},
			]);
			const res = await fetch(port, "GET", "/fail");

			expect(res.status).toBe(500);
			expect((res.body as any).error).toBe("Something broke");
			consoleSpy.mockRestore();
		});

		it("handler can return custom status codes", async () => {
			const { port } = await createServer([
				{ method: "GET", path: "/items/:id", handler: async () => ({ status: 404, body: { error: "Not found" } }) },
			]);
			const res = await fetch(port, "GET", "/items/missing");

			expect(res.status).toBe(404);
			expect((res.body as any).error).toBe("Not found");
		});

		it("handler can set custom response headers", async () => {
			const { port } = await createServer([
				{
					method: "GET",
					path: "/download",
					handler: async () => ({ status: 200, body: { ok: true }, headers: { "x-custom": "value" } }),
				},
			]);
			const res = await fetch(port, "GET", "/download");

			expect(res.headers["x-custom"]).toBe("value");
		});
	});

	describe("lifecycle", () => {
		it("start is idempotent", async () => {
			const server = new HttpApiServer({ port: 0 });
			await server.start();
			servers.push(server);

			const port1 = server.getPort();
			await server.start();
			const port2 = server.getPort();

			expect(port1).toBe(port2);
			expect(port1).toBeGreaterThan(0);
		});

		it("stop is idempotent", async () => {
			const server = new HttpApiServer({ port: 0 });
			await server.start();

			await server.stop();
			await server.stop();

			expect(server.isRunning()).toBe(false);
		});

		it("reports running state correctly", async () => {
			const server = new HttpApiServer({ port: 0 });
			expect(server.isRunning()).toBe(false);

			await server.start();
			expect(server.isRunning()).toBe(true);

			await server.stop();
			expect(server.isRunning()).toBe(false);
		});

		it("getPort returns -1 when not running", () => {
			const server = new HttpApiServer({ port: 0 });
			expect(server.getPort()).toBe(-1);
		});

		it("getRouteList returns registered routes", () => {
			const server = new HttpApiServer({ port: 0 });
			server.addRoute(echoRoute("GET", "/items"));
			server.addRoute(echoRoute("POST", "/items"));

			expect(server.getRouteList()).toEqual([
				{ method: "GET", path: "/items" },
				{ method: "POST", path: "/items" },
			]);
		});
	});
});
