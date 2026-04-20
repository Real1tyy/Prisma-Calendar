import { describe, expect, it } from "vitest";

import {
	applyTransferredSettings,
	createTransferableSettingsSnapshot,
	SETTINGS_TRANSFER_DEFAULT_FILENAME,
} from "../../src/core/settings";

interface TestSettings {
	version: string;
	enabled: boolean;
	maxItems: number;
	tags: string[];
	nested: {
		theme: "light" | "dark";
		timeout: number;
	};
	calendars: Array<{
		id: string;
		name: string;
		enabled: boolean;
		templatePath?: string;
		tabState?: Record<string, unknown>;
	}>;
	licenseKeySecretName: string;
	[key: string]: unknown;
}

const DEFAULTS: TestSettings = {
	version: "1.0.0",
	enabled: true,
	maxItems: 10,
	tags: [],
	nested: {
		theme: "light",
		timeout: 5000,
	},
	calendars: [{ id: "default", name: "Calendar", enabled: true }],
	licenseKeySecretName: "",
};

describe("SETTINGS_TRANSFER_DEFAULT_FILENAME", () => {
	it("exports a stable filename", () => {
		expect(SETTINGS_TRANSFER_DEFAULT_FILENAME).toBe("plugin-settings.json");
	});
});

describe("createTransferableSettingsSnapshot", () => {
	it("drops blocklisted keys", () => {
		const snapshot = createTransferableSettingsSnapshot({ ...DEFAULTS, licenseKeySecretName: "secret" }, DEFAULTS, {
			nonTransferableKeys: ["licenseKeySecretName"],
		});
		expect(snapshot).not.toHaveProperty("licenseKeySecretName");
		expect(snapshot).toHaveProperty("version", "1.0.0");
	});

	it("coerces a wrong-typed scalar back to its default", () => {
		const snapshot = createTransferableSettingsSnapshot(
			{ ...DEFAULTS, maxItems: "not a number" as unknown as number },
			DEFAULTS
		);
		expect(snapshot.maxItems).toBe(10);
	});

	it("uses the first array element as the item template and maps through it", () => {
		const settings = {
			...DEFAULTS,
			calendars: [
				{ id: "a", name: "A", enabled: false },
				{ id: "b", name: 42 as unknown as string, enabled: true },
			],
		};
		const snapshot = createTransferableSettingsSnapshot(settings, DEFAULTS) as typeof DEFAULTS;
		expect(snapshot.calendars).toHaveLength(2);
		expect(snapshot.calendars[0]).toEqual({ id: "a", name: "A", enabled: false });
		expect(snapshot.calendars[1]?.name).toBe("Calendar");
	});
});

describe("applyTransferredSettings", () => {
	it("restores transferable keys to their defaults when absent from the payload", () => {
		const current: TestSettings = { ...DEFAULTS, enabled: false, maxItems: 99, tags: ["x"] };
		const restored = applyTransferredSettings(current, {}, DEFAULTS);
		expect(restored.enabled).toBe(true);
		expect(restored.maxItems).toBe(10);
		expect(restored.tags).toEqual([]);
	});

	it("applies scalar overrides that match the baseline type", () => {
		const restored = applyTransferredSettings(DEFAULTS, { enabled: false, maxItems: 50 }, DEFAULTS);
		expect(restored.enabled).toBe(false);
		expect(restored.maxItems).toBe(50);
	});

	it("drops scalar overrides whose type does not match the baseline", () => {
		const restored = applyTransferredSettings(DEFAULTS, { maxItems: "lots" }, DEFAULTS);
		expect(restored.maxItems).toBe(10);
	});

	it("preserves non-transferable keys on current", () => {
		const current: TestSettings = { ...DEFAULTS, licenseKeySecretName: "KEEP-ME" };
		const restored = applyTransferredSettings(current, { licenseKeySecretName: "SHOULD-BE-IGNORED" }, DEFAULTS, {
			nonTransferableKeys: ["licenseKeySecretName"],
		});
		expect(restored.licenseKeySecretName).toBe("KEEP-ME");
	});

	it("validates payload shape and throws on non-object input", () => {
		expect(() => applyTransferredSettings(DEFAULTS, [1, 2, 3], DEFAULTS)).toThrow(/JSON object/i);
		expect(() => applyTransferredSettings(DEFAULTS, "oops", DEFAULTS)).toThrow(/JSON object/i);
		expect(() => applyTransferredSettings(DEFAULTS, null, DEFAULTS)).toThrow(/JSON object/i);
	});

	it("recursively merges nested objects, filling missing leaves with defaults", () => {
		const current: TestSettings = {
			...DEFAULTS,
			nested: { theme: "dark", timeout: 12345 },
		};
		const restored = applyTransferredSettings(current, { nested: { theme: "dark" } }, DEFAULTS);
		expect(restored.nested).toEqual({ theme: "dark", timeout: 5000 });
	});

	it("maps imported array items through the baseline template", () => {
		const payload = {
			calendars: [
				{ id: "a", name: "Home", enabled: true },
				{ id: "b", name: "Work", enabled: false },
				{ id: "c", name: 999 /* wrong type, should fall back */, enabled: true },
			],
		};
		const restored = applyTransferredSettings(DEFAULTS, payload, DEFAULTS);
		expect(restored.calendars).toHaveLength(3);
		expect(restored.calendars[0]).toEqual({ id: "a", name: "Home", enabled: true });
		expect(restored.calendars[2]?.name).toBe("Calendar");
	});

	it("round-trips a full snapshot back into the original settings", () => {
		const settings: TestSettings = {
			...DEFAULTS,
			enabled: false,
			maxItems: 25,
			tags: ["alpha", "beta"],
			nested: { theme: "dark", timeout: 9000 },
			calendars: [
				{ id: "a", name: "Home", enabled: true },
				{ id: "b", name: "Work", enabled: false },
			],
		};
		const snapshot = createTransferableSettingsSnapshot(settings, DEFAULTS);
		const restored = applyTransferredSettings(DEFAULTS, snapshot, DEFAULTS);
		expect(restored).toEqual(settings);
	});

	it("preserves optional fields absent from defaults during export and import", () => {
		const settings: TestSettings = {
			...DEFAULTS,
			calendars: [
				{
					id: "a",
					name: "Home",
					enabled: true,
					templatePath: "Templates/Event.md",
					tabState: { visibleTabs: ["calendar", "timeline"], renames: { calendar: "Cal" } },
				},
			],
		};
		const snapshot = createTransferableSettingsSnapshot(settings, DEFAULTS);
		const cal = (snapshot.calendars as Array<Record<string, unknown>>)[0];
		expect(cal?.templatePath).toBe("Templates/Event.md");
		expect(cal?.tabState).toEqual({ visibleTabs: ["calendar", "timeline"], renames: { calendar: "Cal" } });

		const restored = applyTransferredSettings(DEFAULTS, snapshot, DEFAULTS);
		expect(restored.calendars[0]?.templatePath).toBe("Templates/Event.md");
		expect(restored.calendars[0]?.tabState).toEqual({
			visibleTabs: ["calendar", "timeline"],
			renames: { calendar: "Cal" },
		});
	});

	it("round-trips settings with optional fields not present in defaults", () => {
		const settings: TestSettings = {
			...DEFAULTS,
			enabled: false,
			maxItems: 25,
			calendars: [
				{
					id: "a",
					name: "Home",
					enabled: true,
					templatePath: "Templates/Event.md",
					tabState: { active: "timeline" },
				},
			],
		};
		const snapshot = createTransferableSettingsSnapshot(settings, DEFAULTS);
		const restored = applyTransferredSettings(DEFAULTS, snapshot, DEFAULTS);
		expect(restored).toEqual(settings);
	});
});
