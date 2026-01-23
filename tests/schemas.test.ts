import { beforeAll, describe, expect, it } from "vitest";
import { CustomCalendarSettingsSchema } from "../src/types/index";

// Mock CSS.supports for color validation tests
beforeAll(() => {
	// @ts-expect-error - Mock global CSS object
	global.CSS = {
		supports: (propertyOrCondition: string, value?: string) => {
			// Handle both overloads of CSS.supports
			if (value !== undefined) {
				// Two-parameter version: supports(property, value)
				if (propertyOrCondition === "color") {
					return /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-zA-Z]+)/.test(value);
				}
				return false;
			} else {
				// Single-parameter version: supports(conditionText)
				return false;
			}
		},
	};
});

describe("Calendar Schemas", () => {
	describe("CustomCalendarSettingsSchema", () => {
		const defaultSettings = CustomCalendarSettingsSchema.parse({});

		it("should validate minimal valid settings", () => {
			const minimal = {
				version: "1.1.0",
				calendars: [
					{
						id: "default",
						name: "Main Calendar",
						enabled: true,
						directory: "",
						startProp: "Start Date",
						timezone: "system",
						defaultDurationMinutes: 60,
						defaultView: "dayGridMonth" as const,
						hideWeekends: false,
						hourStart: 7,
						hourEnd: 23,
						density: "comfortable" as const,
					},
				],
			};

			expect(CustomCalendarSettingsSchema.safeParse(minimal).success).toBe(true);
		});

		it("should accept invalid settings and replace with defaults", () => {
			// Invalid version - should be caught and replaced with default ("1.1.0")
			const result1 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				version: -1,
			});
			expect(result1.success).toBe(true);
			if (result1.success) {
				expect(result1.data.version).toBe("1.1.0");
			}

			// Invalid defaultView - should be caught and replaced with default
			const result2 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						defaultView: "invalidView",
					},
				],
			});
			expect(result2.success).toBe(true);
			if (result2.success) {
				expect(result2.data.calendars[0].defaultView).toBe(defaultSettings.calendars[0].defaultView);
			}

			// Invalid density - should be caught and replaced with default
			const result3 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						density: "invalid",
					},
				],
			});
			expect(result3.success).toBe(true);
			if (result3.success) {
				expect(result3.data.calendars[0].density).toBe(defaultSettings.calendars[0].density);
			}

			// Invalid hour range - should be caught and replaced with default
			const result4 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						hourStart: 25,
					},
				],
			});
			expect(result4.success).toBe(true);
			if (result4.success) {
				expect(result4.data.calendars[0].hourStart).toBe(defaultSettings.calendars[0].hourStart);
			}

			const result5 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						hourEnd: 0,
					},
				],
			});
			expect(result5.success).toBe(true);
			if (result5.success) {
				expect(result5.data.calendars[0].hourEnd).toBe(defaultSettings.calendars[0].hourEnd);
			}

			// Invalid defaultDurationMinutes - should be caught and replaced with default
			const result6 = CustomCalendarSettingsSchema.safeParse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						defaultDurationMinutes: -1,
					},
				],
			});
			expect(result6.success).toBe(true);
			if (result6.success) {
				expect(result6.data.calendars[0].defaultDurationMinutes).toBe(
					defaultSettings.calendars[0].defaultDurationMinutes
				);
			}
		});

		it("should handle optional fields", () => {
			const settingsWithOptionals = {
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						endProp: "End Date",
						allDayProp: "AllDay",
						rruleProp: "RRULE",
						titleProp: "Title",
						timezoneProp: "Timezone",
					},
				],
			};

			expect(CustomCalendarSettingsSchema.safeParse(settingsWithOptionals).success).toBe(true);
		});

		it("should merge partial settings with defaults", () => {
			const partialSettings = {
				calendars: [
					{
						id: "default",
						name: "Main Calendar",
						enabled: true,
					},
				],
			};
			const result = CustomCalendarSettingsSchema.parse(partialSettings);
			expect(result.calendars[0].startProp).toBe("Start Date"); // default
			expect(result.version).toBe("1.1.0"); // default
		});

		it("should normalize calendar directory paths", () => {
			const result = CustomCalendarSettingsSchema.parse({
				...defaultSettings,
				calendars: [
					{
						...defaultSettings.calendars[0],
						directory: "/4. Calendar/",
					},
				],
			});

			expect(result.calendars[0].directory).toBe("4. Calendar");
		});
	});

	describe("CustomCalendarSettingsSchema validation", () => {
		it("should validate correct settings", () => {
			const defaultSettings = CustomCalendarSettingsSchema.parse({});
			expect(() => CustomCalendarSettingsSchema.parse(defaultSettings)).not.toThrow();
		});

		it("should catch invalid settings and replace with defaults", () => {
			const defaultSettings = CustomCalendarSettingsSchema.parse({});
			const result = CustomCalendarSettingsSchema.parse({
				...defaultSettings,
				version: null,
			});
			// Should not throw, but replace null version with default ("1.1.0")
			expect(result.version).toBe("1.1.0");
		});
	});
});
