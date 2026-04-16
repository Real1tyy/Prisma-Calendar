import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PluginApiGateway } from "../../src/integrations/api-gateway/plugin-api-gateway";
import type { ActionDefMap } from "../../src/integrations/api-gateway/types";
import { createMockApp, Plugin } from "../../src/testing";

function createPlugin() {
	const app = createMockApp();
	return new Plugin(app, { id: "test-plugin", name: "Test Plugin" });
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
			await new Promise((resolve) => setTimeout(resolve, 0));

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

			await new Promise((resolve) => setTimeout(resolve, 0));

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

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(actions.greet.handler).not.toHaveBeenCalled();
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

			await new Promise((resolve) => setTimeout(resolve, 0));

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

			await new Promise((resolve) => setTimeout(resolve, 0));

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

			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
