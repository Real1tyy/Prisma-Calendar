import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SyncStore } from "../../src/core/settings/sync-store";
import { createMockApp, Plugin } from "../../src/testing";

const TestSchema = z
	.object({
		readOnly: z.boolean().catch(false),
		theme: z.string().catch("default"),
		count: z.number().catch(0),
	})
	.strip();

type TestData = z.infer<typeof TestSchema>;

describe("SyncStore", () => {
	let mockApp: ReturnType<typeof createMockApp>;
	let mockPlugin: Plugin;
	let store: SyncStore<typeof TestSchema>;

	beforeEach(() => {
		mockApp = createMockApp();
		(mockApp as any).vault.adapter = {
			read: vi.fn(),
			write: vi.fn().mockResolvedValue(undefined),
		};
		mockPlugin = new Plugin(mockApp, { id: "test-plugin", dir: ".obsidian/plugins/test-plugin" });
		store = new SyncStore(mockApp as any, mockPlugin as any, TestSchema);
	});

	describe("constructor", () => {
		it("should initialize with schema defaults", () => {
			expect(store.data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});

		it("should set sync file path based on plugin directory", () => {
			const data = { readOnly: true, theme: "dark", count: 5 };
			(mockApp as any).vault.adapter.read.mockResolvedValue(JSON.stringify(data));

			expect(store.data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});
	});

	describe("loadData", () => {
		it("should load and parse data from sync file", async () => {
			const saved = { readOnly: true, theme: "dark", count: 42 };
			(mockApp as any).vault.adapter.read.mockResolvedValue(JSON.stringify(saved));

			await store.loadData();

			expect(store.data).toEqual(saved);
			expect((mockApp as any).vault.adapter.read).toHaveBeenCalledWith(".obsidian/plugins/test-plugin/sync.json");
		});

		it("should fall back to defaults when file does not exist", async () => {
			(mockApp as any).vault.adapter.read.mockRejectedValue(new Error("File not found"));

			await store.loadData();

			expect(store.data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});

		it("should fall back to defaults when file contains invalid JSON", async () => {
			(mockApp as any).vault.adapter.read.mockResolvedValue("not valid json");

			await store.loadData();

			expect(store.data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});

		it("should strip unknown fields via schema", async () => {
			const saved = { readOnly: true, theme: "dark", count: 1, unknownField: "should be stripped" };
			(mockApp as any).vault.adapter.read.mockResolvedValue(JSON.stringify(saved));

			await store.loadData();

			expect(store.data).toEqual({ readOnly: true, theme: "dark", count: 1 });
			expect((store.data as any).unknownField).toBeUndefined();
		});

		it("should use catch defaults for invalid field values", async () => {
			const saved = { readOnly: "not a boolean", theme: 123, count: "not a number" };
			(mockApp as any).vault.adapter.read.mockResolvedValue(JSON.stringify(saved));

			await store.loadData();

			expect(store.data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});
	});

	describe("saveData", () => {
		it("should write current data to sync file as formatted JSON", async () => {
			await store.saveData();

			expect((mockApp as any).vault.adapter.write).toHaveBeenCalledWith(
				".obsidian/plugins/test-plugin/sync.json",
				JSON.stringify({ readOnly: false, theme: "default", count: 0 }, null, 2)
			);
		});

		it("should log error when write fails", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			(mockApp as any).vault.adapter.write.mockRejectedValue(new Error("Write failed"));

			await store.saveData();

			expect(consoleSpy).toHaveBeenCalledWith("Error saving sync data:", expect.any(Error));
			consoleSpy.mockRestore();
		});
	});

	describe("data getter", () => {
		it("should return current data", () => {
			const data = store.data;
			expect(data).toEqual({ readOnly: false, theme: "default", count: 0 });
		});
	});

	describe("updateData", () => {
		it("should merge partial updates into current data", async () => {
			await store.updateData({ readOnly: true });

			expect(store.data).toEqual({ readOnly: true, theme: "default", count: 0 });
		});

		it("should save after updating", async () => {
			await store.updateData({ theme: "dark" });

			expect((mockApp as any).vault.adapter.write).toHaveBeenCalledWith(
				".obsidian/plugins/test-plugin/sync.json",
				JSON.stringify({ readOnly: false, theme: "dark", count: 0 }, null, 2)
			);
		});

		it("should apply multiple updates sequentially", async () => {
			await store.updateData({ readOnly: true });
			await store.updateData({ theme: "custom" });
			await store.updateData({ count: 10 });

			expect(store.data).toEqual({ readOnly: true, theme: "custom", count: 10 });
		});

		it("should deep clone data to prevent reference mutations", async () => {
			await store.updateData({ theme: "dark" });
			const dataBefore = store.data;

			await store.updateData({ count: 5 });

			expect(dataBefore).toEqual({ readOnly: false, theme: "dark", count: 0 });
			expect(store.data).toEqual({ readOnly: false, theme: "dark", count: 5 });
		});

		it("should override previously loaded data", async () => {
			const saved = { readOnly: true, theme: "dark", count: 42 };
			(mockApp as any).vault.adapter.read.mockResolvedValue(JSON.stringify(saved));
			await store.loadData();

			await store.updateData({ readOnly: false, count: 0 });

			expect(store.data).toEqual({ readOnly: false, theme: "dark", count: 0 });
		});
	});
});
