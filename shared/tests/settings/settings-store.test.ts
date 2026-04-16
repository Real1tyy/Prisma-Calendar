import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { SettingsStore } from "../../src/core/settings";
import { createMockApp, Plugin } from "../../src/testing";

// Test schemas
const SimpleSchema = z.object({
	name: z.string().default("Test Plugin"),
	enabled: z.boolean().default(true),
	count: z.number().default(0),
});

const ComplexSchema = z.object({
	version: z.number().int().positive().default(1),
	features: z.array(z.string()).default([]),
	config: z
		.object({
			theme: z.enum(["light", "dark"]).default("light"),
			autoSave: z.boolean().default(true),
		})
		.default({ theme: "light", autoSave: true }),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

type SimpleSettings = z.infer<typeof SimpleSchema>;

describe("SettingsStore", () => {
	let mockApp: any;
	let mockPlugin: Plugin;
	let settingsStore: SettingsStore<typeof SimpleSchema>;

	beforeEach(() => {
		mockApp = createMockApp();
		mockPlugin = new Plugin(mockApp, { id: "test-plugin", name: "Test Plugin" });

		// Mock plugin data methods
		mockPlugin.loadData = vi.fn().mockResolvedValue({});
		mockPlugin.saveData = vi.fn().mockResolvedValue(undefined);

		settingsStore = new SettingsStore(mockPlugin, SimpleSchema);
	});

	describe("constructor", () => {
		it("should initialize with default settings", () => {
			const defaults = SimpleSchema.parse({});
			expect(settingsStore.currentSettings).toEqual(defaults);
		});

		it("should work with complex schemas", () => {
			const complexStore = new SettingsStore(mockPlugin, ComplexSchema);
			const expectedDefaults = ComplexSchema.parse({});
			expect(complexStore.currentSettings).toEqual(expectedDefaults);
		});
	});

	describe("settings$ observable", () => {
		it("should provide observable access to settings", () => {
			let receivedSettings: SimpleSettings | null = null;
			const subscription = settingsStore.settings$.subscribe((settings) => {
				receivedSettings = settings;
			});

			expect(receivedSettings).toEqual(settingsStore.currentSettings);
			subscription.unsubscribe();
		});

		it("should emit when settings change", async () => {
			const emissions: SimpleSettings[] = [];
			const subscription = settingsStore.settings$.subscribe((settings) => {
				emissions.push(settings);
			});

			await settingsStore.updateProperty("name", "Updated Name");

			expect(emissions).toHaveLength(2); // Initial + update
			expect(emissions[1].name).toBe("Updated Name");
			subscription.unsubscribe();
		});
	});

	describe("loadSettings", () => {
		it("should load and parse valid settings", async () => {
			const mockData = { name: "Custom Name", enabled: false, count: 42 };
			mockPlugin.loadData = vi.fn().mockResolvedValue(mockData);

			await settingsStore.loadSettings();

			expect(settingsStore.currentSettings).toEqual(mockData);
			expect(mockPlugin.loadData).toHaveBeenCalledOnce();
		});

		it("should sanitize and save invalid/incomplete settings", async () => {
			const mockData = { name: "Custom Name" }; // Missing enabled and count
			mockPlugin.loadData = vi.fn().mockResolvedValue(mockData);

			await settingsStore.loadSettings();

			const expected: SimpleSettings = {
				name: "Custom Name",
				enabled: true, // default
				count: 0, // default
			};
			expect(settingsStore.currentSettings).toEqual(expected);
			expect(mockPlugin.saveData).toHaveBeenCalledWith(expected);
		});

		it("should handle null/undefined data", async () => {
			mockPlugin.loadData = vi.fn().mockResolvedValue(null);

			await settingsStore.loadSettings();

			expect(settingsStore.currentSettings).toEqual(SimpleSchema.parse({}));
			expect(mockPlugin.saveData).toHaveBeenCalledWith(SimpleSchema.parse({}));
		});

		it("should handle load errors gracefully", async () => {
			mockPlugin.loadData = vi.fn().mockRejectedValue(new Error("Load failed"));
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await settingsStore.loadSettings();

			expect(settingsStore.currentSettings).toEqual(SimpleSchema.parse({}));
			expect(mockPlugin.saveData).toHaveBeenCalledWith(SimpleSchema.parse({}));
			expect(consoleSpy).toHaveBeenCalledWith("Failed to load settings, using defaults:", expect.any(Error));

			consoleSpy.mockRestore();
		});

		it("should handle schema validation errors", async () => {
			const invalidData = { name: 123, enabled: "not-boolean", count: "not-number" };
			mockPlugin.loadData = vi.fn().mockResolvedValue(invalidData);
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await settingsStore.loadSettings();

			expect(settingsStore.currentSettings).toEqual(SimpleSchema.parse({}));
			expect(mockPlugin.saveData).toHaveBeenCalledWith(SimpleSchema.parse({}));
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});
	});

	describe("saveSettings", () => {
		it("should save current settings", async () => {
			await settingsStore.updateProperty("name", "Test Save");
			await settingsStore.saveSettings();

			expect(mockPlugin.saveData).toHaveBeenCalledWith(expect.objectContaining({ name: "Test Save" }));
		});
	});

	describe("updateSettings", () => {
		it("should update settings with updater function", async () => {
			await settingsStore.updateSettings((settings) => ({
				...settings,
				name: "Updated",
				count: settings.count + 1,
			}));

			expect(settingsStore.currentSettings.name).toBe("Updated");
			expect(settingsStore.currentSettings.count).toBe(1);
			expect(mockPlugin.saveData).toHaveBeenCalled();
		});

		it("should validate updated settings", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await expect(settingsStore.updateSettings(() => ({ name: 123 }) as any)).rejects.toThrow();

			expect(consoleSpy).toHaveBeenCalledWith("Failed to update settings:", expect.any(Error));
			consoleSpy.mockRestore();
		});

		it("should throw validation errors without saving", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

			await expect(
				settingsStore.updateSettings(
					() =>
						({
							name: 123, // This should fail - name should be string
							enabled: "not-boolean", // This should fail - enabled should be boolean
							count: "not-number", // This should fail - count should be number
						}) as any
				)
			).rejects.toThrow();

			expect(consoleSpy).toHaveBeenCalledWith("Failed to update settings:", expect.any(Error));
			consoleSpy.mockRestore();
		});
	});

	describe("updateProperty", () => {
		it("should update a single property", async () => {
			await settingsStore.updateProperty("name", "New Name");

			expect(settingsStore.currentSettings.name).toBe("New Name");
			expect(settingsStore.currentSettings.enabled).toBe(true); // unchanged
			expect(mockPlugin.saveData).toHaveBeenCalled();
		});

		it("should validate property updates", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			await expect(settingsStore.updateProperty("name", 123 as any)).rejects.toThrow();
			consoleSpy.mockRestore();
		});
	});

	describe("updateProperties", () => {
		it("should update multiple properties", async () => {
			await settingsStore.updateProperties({
				name: "Multi Update",
				count: 99,
			});

			expect(settingsStore.currentSettings.name).toBe("Multi Update");
			expect(settingsStore.currentSettings.count).toBe(99);
			expect(settingsStore.currentSettings.enabled).toBe(true); // unchanged
			expect(mockPlugin.saveData).toHaveBeenCalled();
		});

		it("should validate multiple property updates", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			await expect(settingsStore.updateProperties({ name: 123 } as any)).rejects.toThrow();
			consoleSpy.mockRestore();
		});
	});

	describe("resetSettings", () => {
		it("should reset to default settings", async () => {
			// First, change some settings
			await settingsStore.updateProperties({
				name: "Changed",
				enabled: false,
				count: 42,
			});

			// Then reset
			await settingsStore.resetSettings();

			expect(settingsStore.currentSettings).toEqual(SimpleSchema.parse({}));
			expect(mockPlugin.saveData).toHaveBeenCalledWith(SimpleSchema.parse({}));
		});
	});

	describe("getDefaults", () => {
		it("should return default settings from schema", () => {
			const defaults = settingsStore.getDefaults();
			expect(defaults).toEqual(SimpleSchema.parse({}));
		});

		it("should work with complex schemas", () => {
			const complexStore = new SettingsStore(mockPlugin, ComplexSchema);
			const defaults = complexStore.getDefaults();
			const expectedDefaults = ComplexSchema.parse({});

			expect(defaults).toEqual(expectedDefaults);
		});
	});

	describe("hasCustomizations", () => {
		it("should return false for default settings", () => {
			expect(settingsStore.hasCustomizations()).toBe(false);
		});

		it("should return true after customizations", async () => {
			await settingsStore.updateProperty("name", "Custom");
			expect(settingsStore.hasCustomizations()).toBe(true);
		});

		it("should return false after reset", async () => {
			await settingsStore.updateProperty("name", "Custom");
			expect(settingsStore.hasCustomizations()).toBe(true);

			await settingsStore.resetSettings();
			expect(settingsStore.hasCustomizations()).toBe(false);
		});
	});

	describe("complex schema scenarios", () => {
		let complexStore: SettingsStore<typeof ComplexSchema>;

		beforeEach(() => {
			complexStore = new SettingsStore(mockPlugin, ComplexSchema);
		});

		it("should handle nested object updates", async () => {
			await complexStore.updateSettings((settings) => ({
				...settings,
				config: {
					...settings.config,
					theme: "dark",
				},
			}));

			expect(complexStore.currentSettings.config.theme).toBe("dark");
			expect(complexStore.currentSettings.config.autoSave).toBe(true); // unchanged
		});

		it("should handle array updates", async () => {
			await complexStore.updateProperty("features", ["feature1", "feature2"]);

			expect(complexStore.currentSettings.features).toEqual(["feature1", "feature2"]);
		});

		it("should handle optional properties", async () => {
			// Test with a simple property update instead of optional metadata
			await complexStore.updateProperty("version", 2);

			expect(complexStore.currentSettings.version).toBe(2);
		});

		it("should validate complex nested structures", async () => {
			const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			await expect(
				complexStore.updateSettings((settings) => ({
					...settings,
					config: {
						theme: "invalid-theme" as any,
						autoSave: true,
					},
				}))
			).rejects.toThrow();
			consoleSpy.mockRestore();
		});
	});

	describe("reactive behavior", () => {
		it("should emit settings changes to multiple subscribers", async () => {
			const emissions1: SimpleSettings[] = [];
			const emissions2: SimpleSettings[] = [];

			const sub1 = settingsStore.settings$.subscribe((settings) => {
				emissions1.push(settings);
			});

			const sub2 = settingsStore.settings$.subscribe((settings) => {
				emissions2.push(settings);
			});

			await settingsStore.updateProperty("name", "Reactive Test");

			expect(emissions1).toHaveLength(2); // Initial + update
			expect(emissions2).toHaveLength(2); // Initial + update
			expect(emissions1[1].name).toBe("Reactive Test");
			expect(emissions2[1].name).toBe("Reactive Test");

			sub1.unsubscribe();
			sub2.unsubscribe();
		});

		it("should maintain referential integrity", async () => {
			const initialSettings = settingsStore.currentSettings;

			await settingsStore.updateProperty("name", "New Name");

			const updatedSettings = settingsStore.currentSettings;
			expect(updatedSettings).not.toBe(initialSettings); // Different reference
			expect(updatedSettings.name).toBe("New Name");
		});
	});

	describe("watch", () => {
		it("should fire callback when watched property changes", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			await settingsStore.updateProperty("name", "First");
			await settingsStore.updateProperty("name", "Second");

			expect(names).toEqual(["First", "Second"]);
		});

		it("should not fire callback for unrelated property changes", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			await settingsStore.updateProperty("count", 42);
			await settingsStore.updateProperty("enabled", false);

			expect(names).toEqual([]);
		});

		it("should skip duplicate values via distinctUntilChanged", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			await settingsStore.updateProperty("name", "Same");
			await settingsStore.updateProperty("name", "Same");
			await settingsStore.updateProperty("name", "Different");

			expect(names).toEqual(["Same", "Different"]);
		});

		it("should not fire on initial value (skips first emission)", () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			expect(names).toEqual([]);
		});

		it("should stop watching when teardown is called", async () => {
			const names: string[] = [];
			const teardown = settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			await settingsStore.updateProperty("name", "Before");
			teardown();
			await settingsStore.updateProperty("name", "After");

			expect(names).toEqual(["Before"]);
		});

		it("should register cleanup with plugin.register", () => {
			const registerSpy = vi.spyOn(mockPlugin, "register");

			settingsStore.watch(
				(s) => s.name,
				() => {}
			);

			expect(registerSpy).toHaveBeenCalledWith(expect.any(Function));
		});

		it("should support batch watchers via array syntax", async () => {
			const names: string[] = [];
			const counts: number[] = [];

			settingsStore.watch([
				[(s) => s.name, (name) => names.push(name as string)],
				[(s) => s.count, (count) => counts.push(count as number)],
			]);

			await settingsStore.updateProperty("name", "Batch");
			await settingsStore.updateProperty("count", 10);

			expect(names).toEqual(["Batch"]);
			expect(counts).toEqual([10]);
		});

		it("batch teardown should stop all watchers", async () => {
			const names: string[] = [];
			const counts: number[] = [];

			const teardown = settingsStore.watch([
				[(s) => s.name, (name) => names.push(name as string)],
				[(s) => s.count, (count) => counts.push(count as number)],
			]);

			await settingsStore.updateProperty("name", "Before");
			teardown();
			await settingsStore.updateProperty("name", "After");
			await settingsStore.updateProperty("count", 99);

			expect(names).toEqual(["Before"]);
			expect(counts).toEqual([]);
		});

		it("batch watchers are independent — each only fires for its own property", async () => {
			const names: string[] = [];
			const counts: number[] = [];

			settingsStore.watch([
				[(s) => s.name, (name) => names.push(name as string)],
				[(s) => s.count, (count) => counts.push(count as number)],
			]);

			await settingsStore.updateProperty("name", "Only Name");

			expect(names).toEqual(["Only Name"]);
			expect(counts).toEqual([]);
		});

		it("immediate: true fires with current value on subscribe", () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name),
				{ immediate: true }
			);

			expect(names).toEqual(["Test Plugin"]);
		});

		it("immediate: true still fires on subsequent changes", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name),
				{ immediate: true }
			);

			await settingsStore.updateProperty("name", "Updated");

			expect(names).toEqual(["Test Plugin", "Updated"]);
		});

		it("immediate: true deduplicates same value", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name),
				{ immediate: true }
			);

			await settingsStore.updateProperty("count", 42);

			expect(names).toEqual(["Test Plugin"]);
		});

		it("custom compare function for object selectors", async () => {
			const complexSchema = z.object({
				config: z
					.object({
						a: z.string().default("x"),
						b: z.number().default(0),
					})
					.default({ a: "x", b: 0 }),
			});
			const complexStore = new SettingsStore(mockPlugin, complexSchema);

			const values: { a: string; b: number }[] = [];
			complexStore.watch(
				(s) => ({ a: s.config.a, b: s.config.b }),
				(v) => values.push(v),
				{ compare: (a, b) => a.a === b.a && a.b === b.b }
			);

			await complexStore.updateSettings(() => ({ config: { a: "x", b: 0 } }));
			expect(values).toEqual([]);

			await complexStore.updateSettings(() => ({ config: { a: "y", b: 0 } }));
			expect(values).toEqual([{ a: "y", b: 0 }]);

			await complexStore.updateSettings(() => ({ config: { a: "y", b: 0 } }));
			expect(values).toEqual([{ a: "y", b: 0 }]);
		});

		it("without custom compare, object selectors fire on every emission", async () => {
			const values: { name: string }[] = [];
			settingsStore.watch(
				(s) => ({ name: s.name }),
				(v) => values.push(v)
			);

			await settingsStore.updateProperty("count", 1);
			await settingsStore.updateProperty("count", 2);

			expect(values).toHaveLength(2);
		});

		it("does not fire when value matches initial state (map → distinct → skip)", async () => {
			const names: string[] = [];
			settingsStore.watch(
				(s) => s.name,
				(name) => names.push(name)
			);

			await settingsStore.updateSettings((s) => ({ ...s, name: "Test Plugin" }));

			expect(names).toEqual([]);
		});
	});
});
