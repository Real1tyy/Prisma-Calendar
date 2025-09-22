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
				version: 1,
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

		it("should reject invalid settings", () => {
			// Invalid version
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					version: -1,
				}).success
			).toBe(false);

			// Invalid defaultView
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							defaultView: "invalidView",
						},
					],
				}).success
			).toBe(false);

			// Invalid timezone
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							timezone: "Invalid/Timezone",
						},
					],
				}).success
			).toBe(false);

			// Invalid density
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							density: "invalid",
						},
					],
				}).success
			).toBe(false);

			// Invalid hour range
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							hourStart: 25,
						},
					],
				}).success
			).toBe(false);

			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							hourEnd: 0,
						},
					],
				}).success
			).toBe(false);

			// Invalid defaultDurationMinutes
			expect(
				CustomCalendarSettingsSchema.safeParse({
					...defaultSettings,
					calendars: [
						{
							...defaultSettings.calendars[0],
							defaultDurationMinutes: -1,
						},
					],
				}).success
			).toBe(false);
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
						timezone: "UTC",
					},
				],
			};
			const result = CustomCalendarSettingsSchema.parse(partialSettings);
			expect(result.calendars[0].timezone).toBe("UTC");
			expect(result.calendars[0].startProp).toBe("Start Date"); // default
			expect(result.version).toBe(1); // default
		});
	});

	describe("CustomCalendarSettingsSchema validation", () => {
		it("should validate correct settings", () => {
			const defaultSettings = CustomCalendarSettingsSchema.parse({});
			expect(() => CustomCalendarSettingsSchema.parse(defaultSettings)).not.toThrow();
		});

		it("should throw on invalid settings", () => {
			const defaultSettings = CustomCalendarSettingsSchema.parse({});
			expect(() =>
				CustomCalendarSettingsSchema.parse({
					...defaultSettings,
					version: "invalid",
				})
			).toThrow();
		});
	});
});
