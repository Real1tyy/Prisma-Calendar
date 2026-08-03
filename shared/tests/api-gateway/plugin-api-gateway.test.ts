import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineAction } from "../../src/integrations/api-gateway/contract/define-action";
import type { HttpApiServerLike, HttpRoute, HttpServerConfig } from "../../src/integrations/api-gateway/http-types";
import { PluginApiGateway } from "../../src/integrations/api-gateway/plugin-api-gateway";
import type { ActionDefMap } from "../../src/integrations/api-gateway/types";
import { createMockApp, Plugin } from "../../src/testing";

function createPlugin() {
	const app = createMockApp();
	return new Plugin(app, { id: "test-plugin", name: "Test Plugin" });
}

/**
 * Stand-in for `HttpApiServer`, which cannot be used here: it imports `node:http`
 * and binds a real socket. Injecting the server is what makes this path testable
 * at the unit tier at all — see [[spec-no-node-builtins-in-bundles]].
 */
class FakeHttpServer implements HttpApiServerLike {
	readonly routes: HttpRoute[] = [];
	started = false;
	stopped = false;

	constructor(readonly config: HttpServerConfig) {}

	addRoute(route: HttpRoute): void {
		this.routes.push(route);
	}

	addRoutes(routes: HttpRoute[]): void {
		this.routes.push(...routes);
	}

	async start(): Promise<void> {
		this.started = true;
	}

	async stop(): Promise<void> {
		this.stopped = true;
	}
}

function createFakeServerFactory() {
	const created: FakeHttpServer[] = [];
	const createServer = vi.fn((config: HttpServerConfig) => {
		const server = new FakeHttpServer(config);
		created.push(server);
		return server;
	});
	return { created, createServer };
}

function routeKey(route: HttpRoute): string {
	return `${route.method} ${route.path}`;
}

function createActions(): ActionDefMap {
	return {
		greet: {
			handler: vi.fn(),
			parseParams: (raw: Record<string, string>) => ({ name: raw.name ?? "World" }),
		},
		farewell: {
			handler: vi.fn(),
			parseParams: (raw: Record<string, string>) => ({ name: raw.name ?? "World" }),
		},
		windowOnly: {
			handler: vi.fn(),
			// No parseParams — window-API-only
		},
	};
}

describe("PluginApiGateway", () => {
	let plugin: Plugin;
	let actions: ActionDefMap;

	beforeEach(() => {
		plugin = createPlugin();
		actions = createActions();
	});

	afterEach(() => {
		// Clean up any window keys
		delete (window as unknown as Record<string, unknown>)["TestApi"];
	});

	describe("expose", () => {
		it("should assign the API to window[globalKey]", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			gateway.expose();

			const api = (window as unknown as Record<string, unknown>)["TestApi"] as Record<string, unknown>;
			expect(api).toBeDefined();
			expect(typeof api.greet).toBe("function");
			expect(typeof api.farewell).toBe("function");
			expect(typeof api.windowOnly).toBe("function");
		});

		it("should register protocol handler when protocolKey is provided", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			gateway.expose();

			expect(plugin.registerObsidianProtocolHandler).toHaveBeenCalledWith("test-plugin", expect.any(Function));
		});

		it("should not register protocol handler when protocolKey is omitted", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			gateway.expose();

			expect(plugin.registerObsidianProtocolHandler).not.toHaveBeenCalled();
		});
	});

	describe("unexpose", () => {
		it("should remove the API from window[globalKey]", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			gateway.expose();
			expect((window as unknown as Record<string, unknown>)["TestApi"]).toBeDefined();

			gateway.unexpose();
			expect((window as unknown as Record<string, unknown>)["TestApi"]).toBeUndefined();
		});
	});

	describe("getApi", () => {
		it("should return the API object with all action handlers", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			const api = gateway.getApi();
			expect(typeof api.greet).toBe("function");
			expect(typeof api.farewell).toBe("function");
			expect(typeof api.windowOnly).toBe("function");
		});

		it("should return the same handlers defined in actions", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			const api = gateway.getApi();
			api.greet({ name: "Alice" });
			expect(actions.greet.handler).toHaveBeenCalledWith({ name: "Alice" });
		});
	});

	describe("buildUrl", () => {
		it("should generate a valid obsidian:// URL", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			const url = gateway.buildUrl("greet", { name: "Alice" });
			expect(url).toBe("obsidian://test-plugin?call=greet&name=Alice");
		});

		it("should generate URL with only the call param when no params provided", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			const url = gateway.buildUrl("greet");
			expect(url).toBe("obsidian://test-plugin?call=greet");
		});

		it("should convert boolean and number params to strings", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			const url = gateway.buildUrl("greet", { enabled: true, count: 5 });
			expect(url).toContain("enabled=true");
			expect(url).toContain("count=5");
		});

		it("should throw when no protocolKey is configured", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			expect(() => gateway.buildUrl("greet")).toThrow("Cannot build URL: no protocolKey configured");
		});
	});

	describe("protocol dispatch", () => {
		it("should dispatch to the correct action handler", async () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			gateway.expose();

			// Extract the registered callback
			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			protocolCallback({ call: "greet", name: "Bob" });

			// Allow async dispatch to settle
			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(actions.greet.handler).toHaveBeenCalledWith({ name: "Bob" });
		});

		it("should not call handler for missing call parameter", async () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			gateway.expose();

			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			protocolCallback({});

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(actions.greet.handler).not.toHaveBeenCalled();
			expect(actions.farewell.handler).not.toHaveBeenCalled();
		});

		it("should not call handler for unknown action", async () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			gateway.expose();

			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			protocolCallback({ call: "nonexistent" });

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(actions.greet.handler).not.toHaveBeenCalled();
		});

		it("should dispatch via a derived URL coercer when parseParams is absent but input schema is present", async () => {
			const handler = vi.fn();
			const schemaActions: ActionDefMap = {
				createTask: defineAction({
					description: "Create a task.",
					input: z.object({
						title: z.string(),
						priority: z.number().optional(),
						tags: z.array(z.string()).optional(),
					}),
					output: z.boolean(),
					handler,
				}),
			};

			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions: schemaActions,
			});

			gateway.expose();
			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			protocolCallback({ call: "createTask", title: "Write spec", priority: "3", tags: "a,b" });
			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(handler).toHaveBeenCalledWith({ title: "Write spec", priority: 3, tags: ["a", "b"] });
		});

		it("should not dispatch to window-only actions via protocol", async () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions,
			});

			gateway.expose();

			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			protocolCallback({ call: "windowOnly" });

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(actions.windowOnly.handler).not.toHaveBeenCalled();
		});

		it("should handle errors in parseParams gracefully", async () => {
			const errorActions: ActionDefMap = {
				broken: {
					handler: vi.fn(),
					parseParams: () => {
						throw new Error("Bad params");
					},
				},
			};

			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions: errorActions,
			});

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			gateway.expose();

			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			// Should not throw
			protocolCallback({ call: "broken" });

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(errorActions.broken.handler).not.toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("should handle errors in handler gracefully", async () => {
			const errorActions: ActionDefMap = {
				failing: {
					handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
					parseParams: (raw: Record<string, string>) => raw,
				},
			};

			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				protocolKey: "test-plugin",
				actions: errorActions,
			});

			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			gateway.expose();

			const registerCall = plugin.registerObsidianProtocolHandler.mock.calls[0];
			const protocolCallback = registerCall[1] as (params: Record<string, string>) => void;

			// Should not throw
			protocolCallback({ call: "failing" });

			await new Promise((resolve) => window.setTimeout(resolve, 0));

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});

	describe("http transport", () => {
		it("should not create a server when no http config is given", () => {
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
			});

			gateway.expose();

			expect(gateway.getHttpServer()).toBeNull();
		});

		it("should not create a server when http is configured but disabled", () => {
			const { createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
				http: { enabled: false, port: 27124, createServer },
			});

			gateway.expose();

			expect(createServer).not.toHaveBeenCalled();
			expect(gateway.getHttpServer()).toBeNull();
		});

		it("should build the server through the injected factory with the http config", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
				http: { enabled: true, port: 27124, host: "0.0.0.0", createServer },
			});

			gateway.expose();

			expect(createServer).toHaveBeenCalledTimes(1);
			expect(created).toHaveLength(1);
			expect(created[0].config.port).toBe(27124);
			expect(created[0].config.host).toBe("0.0.0.0");
			expect(created[0].started).toBe(true);
			expect(gateway.getHttpServer()).toBe(created[0]);
		});

		it("should register one kebab-cased route per action", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();

			expect(created[0].routes.map(routeKey)).toEqual(["POST /greet", "POST /farewell", "GET /window-only"]);
		});

		it("should skip actions that opt out of the http transport", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions: {
					visible: { handler: vi.fn() },
					hidden: { handler: vi.fn(), http: { disabled: true } },
				},
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();

			expect(created[0].routes.map(routeKey)).toEqual(["GET /visible"]);
		});

		it("should flush routes queued before expose", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions: { visible: { handler: vi.fn() } },
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.addHttpRoutes([{ method: "GET", path: "/custom", handler: async () => ({ status: 200, body: {} }) }]);
			gateway.expose();

			expect(created[0].routes.map(routeKey)).toEqual(["GET /visible", "GET /custom"]);
		});

		it("should pass routes straight through once the server is running", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions: { visible: { handler: vi.fn() } },
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();
			gateway.addHttpRoutes([{ method: "GET", path: "/late", handler: async () => ({ status: 200, body: {} }) }]);

			expect(created[0].routes.map(routeKey)).toEqual(["GET /visible", "GET /late"]);
		});

		it("should stop and release the server on unexpose", () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();
			gateway.unexpose();

			expect(created[0].stopped).toBe(true);
			expect(gateway.getHttpServer()).toBeNull();
		});

		it("should dispatch an action through its generated route handler", async () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions,
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();
			const greetRoute = created[0].routes.find((route) => route.path === "/greet");

			const response = await greetRoute!.handler({
				method: "POST",
				path: "/greet",
				params: {},
				query: { name: "Alice" },
				body: undefined,
			});

			expect(actions.greet.handler).toHaveBeenCalledWith({ name: "Alice" });
			expect(response.status).toBe(200);
		});

		it("should answer 400 when the action handler throws", async () => {
			const { created, createServer } = createFakeServerFactory();
			const gateway = new PluginApiGateway({
				plugin: plugin as any,
				globalKey: "TestApi",
				actions: {
					failing: {
						handler: vi.fn().mockRejectedValue(new Error("Handler failed")),
						parseParams: (raw: Record<string, string>) => raw,
					},
				},
				http: { enabled: true, port: 27124, createServer },
			});

			gateway.expose();
			const response = await created[0].routes[0].handler({
				method: "POST",
				path: "/failing",
				params: {},
				query: {},
				body: undefined,
			});

			expect(response.status).toBe(400);
			expect(response.body).toEqual({ error: "Handler failed" });
		});
	});
});
