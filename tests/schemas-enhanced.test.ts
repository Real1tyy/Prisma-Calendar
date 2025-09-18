import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EventFrontmatterSchema, type ParsedEventFrontmatter } from "../src/types/event-schemas";
import {
	type RRuleFrontmatter,
	RRuleFrontmatterSchema,
} from "../src/types/recurring-event-schemas";
import {
	type CustomCalendarSettings,
	CustomCalendarSettingsSchema,
	type SingleCalendarConfig,
	SingleCalendarConfigSchema,
} from "../src/types/settings-schemas";
import { MockFixtures, TestScenarios } from "./fixtures/index";

describe("Schema Validation - Enhanced Tests", () => {
	describe("Settings Schema Invariants", () => {
		// Test that valid mock data always passes validation
		it("should validate mock CustomCalendarSettings", () => {
			const settings = MockFixtures.customCalendarSettings();
			const result = CustomCalendarSettingsSchema.safeParse(settings);
			expect(result.success).toBe(true);
		});

		it("should validate mock SingleCalendarConfig", () => {
			const config = MockFixtures.singleCalendarConfig();
			const result = SingleCalendarConfigSchema.safeParse(config);
			expect(result.success).toBe(true);
		});

		// Test that schema parsing is idempotent
		it("should be idempotent for settings parsing", () => {
			const settings = MockFixtures.customCalendarSettings();
			const parsed1 = CustomCalendarSettingsSchema.parse(settings);
			const parsed2 = CustomCalendarSettingsSchema.parse(parsed1);
			expect(parsed1).toEqual(parsed2);
		});

		// Test edge cases
		it("should handle valid edge cases", () => {
			const edgeCases = TestScenarios.settingsEdgeCases();

			for (const edgeCase of edgeCases) {
				const result = CustomCalendarSettingsSchema.safeParse(edgeCase);
				expect(result.success).toBe(true);
			}
		});

		// Test invalid data scenarios
		it("should reject invalid settings configurations", () => {
			const invalidScenarios = TestScenarios.invalidDataScenarios().invalidSettings;

			for (const invalidSettings of invalidScenarios) {
				const result = CustomCalendarSettingsSchema.safeParse(invalidSettings);
				expect(result.success).toBe(false);
			}
		});

		// Test that default values are applied correctly
		it("should apply default values for missing properties", () => {
			const partialSettings = {
				calendars: [
					{
						id: "test",
						name: "Test Calendar",
						enabled: true,
					},
				],
			};

			const result = CustomCalendarSettingsSchema.safeParse(partialSettings);

			expect(result.success).toBe(true);
			if (result.success) {
				expect(typeof result.data.version).toBe("number");
				expect(result.data.version).toBeGreaterThan(0);
				expect(result.data.calendars[0]).toHaveProperty("defaultView");
				expect(result.data.calendars[0]).toHaveProperty("hourStart");
				expect(result.data.calendars[0]).toHaveProperty("hourEnd");
				expect(Array.isArray(result.data.calendars[0].zoomLevels)).toBe(true);
			}
		});
	});

	describe("Event Frontmatter Schema Invariants", () => {
		// Test that valid event frontmatter always passes validation
		it("should validate mock event frontmatter", () => {
			const frontmatter = MockFixtures.eventFrontmatter();
			const result = EventFrontmatterSchema.safeParse(frontmatter);
			expect(result.success).toBe(true);
		});

		// Test schema refinements (business rules)
		it("should enforce all-day event constraints", () => {
			// All-day event should not have end time
			const allDayEvent = {
				startTime: "2024-01-15T10:00:00",
				allDay: true,
				title: "All Day Event",
			};

			const result1 = EventFrontmatterSchema.safeParse(allDayEvent);
			expect(result1.success).toBe(true);

			// All-day event with end time should fail
			const allDayWithEnd = {
				startTime: "2024-01-15T10:00:00",
				endTime: "2024-01-15T11:00:00",
				allDay: true,
				title: "Invalid All Day Event",
			};

			const result2 = EventFrontmatterSchema.safeParse(allDayWithEnd);
			expect(result2.success).toBe(false);
		});

		// Test invalid frontmatter scenarios
		it("should reject invalid event frontmatter", () => {
			const invalidScenarios = TestScenarios.invalidDataScenarios().invalidEventFrontmatter;

			for (const invalidFrontmatter of invalidScenarios) {
				const result = EventFrontmatterSchema.safeParse(invalidFrontmatter);
				expect(result.success).toBe(false);
			}
		});

		// Test date parsing robustness
		it("should handle various date formats", () => {
			const validDateFormats = [
				"2024-01-15T10:00:00Z",
				"2024-01-15T10:00:00.000Z",
				"2024-01-15 10:00",
			];

			for (const dateString of validDateFormats) {
				const frontmatter = {
					startTime: dateString,
					allDay: false,
					title: "Test Event",
				};

				const result = EventFrontmatterSchema.safeParse(frontmatter);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(typeof result.data.startTime).toBe("object");
				}
			}
		});
	});

	describe("RRule Frontmatter Schema Invariants", () => {
		// Test that valid RRule frontmatter always passes validation
		it("should validate mock RRule frontmatter", () => {
			const frontmatter = MockFixtures.rruleFrontmatter();
			const result = RRuleFrontmatterSchema.safeParse(frontmatter);
			expect(result.success).toBe(true);
		});

		// Test RRule business rules
		it("should enforce RRule constraints", () => {
			// All-day recurring event should not have end time
			const allDayRRule = {
				type: "daily" as const,
				weekdays: null,
				startTime: "2024-01-15T10:00:00",
				allDay: true,
			};

			const result1 = RRuleFrontmatterSchema.safeParse(allDayRRule);
			expect(result1.success).toBe(true);

			// Non-all-day recurring event should have end time
			const nonAllDayRRule = {
				type: "daily" as const,
				weekdays: null,
				startTime: "2024-01-15T10:00:00",
				endTime: "2024-01-15T11:00:00",
				allDay: false,
			};

			const result2 = RRuleFrontmatterSchema.safeParse(nonAllDayRRule);
			expect(result2.success).toBe(true);

			// Non-all-day without end time should fail
			const invalidRRule = {
				type: "daily" as const,
				weekdays: null,
				startTime: "2024-01-15T10:00:00",
				allDay: false,
			};

			const result3 = RRuleFrontmatterSchema.safeParse(invalidRRule);
			expect(result3.success).toBe(false);
		});

		// Test weekday parsing
		it("should parse weekdays correctly", () => {
			const weekdayRRule = {
				type: "weekly" as const,
				weekdays: "monday,tuesday,friday",
				startTime: "2024-01-15T10:00:00",
				endTime: "2024-01-15T11:00:00",
				allDay: false,
			};

			const result = RRuleFrontmatterSchema.safeParse(weekdayRRule);
			expect(result.success).toBe(true);

			if (result.success) {
				expect(Array.isArray(result.data.weekdays)).toBe(true);
				expect(result.data.weekdays).toContain("monday");
				expect(result.data.weekdays).toContain("tuesday");
				expect(result.data.weekdays).toContain("friday");
			}
		});
	});

	describe("Schema Transformation Invariants", () => {
		// Test that transformations are consistent
		it("should have consistent string transformations", () => {
			const testCases = [
				{ input: "  test  ", expected: "test" },
				{ input: "", expected: undefined },
				{ input: "   ", expected: undefined },
				{ input: "valid", expected: "valid" },
			];

			const titleSchema = z
				.unknown()
				.transform((value) => {
					if (typeof value === "string" && value.trim()) {
						return value.trim();
					}
					return undefined;
				})
				.pipe(z.string().optional());

			for (const testCase of testCases) {
				const result = titleSchema.safeParse(testCase.input);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data).toBe(testCase.expected);
				}
			}
		});

		// Test boolean transformations
		it("should handle various boolean representations", () => {
			const testCases = [
				{ input: true, expected: true },
				{ input: false, expected: false },
				{ input: "true", expected: true },
				{ input: "false", expected: false },
				{ input: "yes", expected: true },
				{ input: "no", expected: false },
				{ input: "1", expected: true },
				{ input: "0", expected: false },
				{ input: null, expected: false },
				{ input: undefined, expected: false },
			];

			const booleanSchema = z
				.unknown()
				.transform((value) => {
					if (typeof value === "boolean") return value;
					if (typeof value === "string") {
						const lower = value.toLowerCase().trim();
						return lower === "true" || lower === "yes" || lower === "1";
					}
					return false;
				})
				.pipe(z.boolean());

			for (const testCase of testCases) {
				const result = booleanSchema.safeParse(testCase.input);
				expect(result.success).toBe(true);
				if (result.success) {
					expect(result.data).toBe(testCase.expected);
				}
			}
		});
	});

	describe("Schema Performance", () => {
		// Test that schema validation is performant
		it("should validate large datasets efficiently", () => {
			const settingsArray = Array.from({ length: 100 }, () =>
				MockFixtures.customCalendarSettings()
			);

			const startTime = performance.now();

			const results = settingsArray.map((settings) =>
				CustomCalendarSettingsSchema.safeParse(settings)
			);

			const endTime = performance.now();
			const duration = endTime - startTime;

			// Should complete validation within reasonable time (100ms for 100 items)
			expect(duration).toBeLessThan(100);
			expect(results.every((r) => r.success)).toBe(true);
		});
	});

	describe("Schema Error Messages", () => {
		// Test that error messages are helpful
		it("should provide meaningful error messages for invalid data", () => {
			const invalidSettings = {
				calendars: [], // Empty array should be invalid
			};

			const result = CustomCalendarSettingsSchema.safeParse(invalidSettings);
			expect(result.success).toBe(false);

			if (!result.success) {
				const errorMessage = result.error.message;
				expect(errorMessage).toContain("calendars");
				expect(errorMessage.length).toBeGreaterThan(10);
			}
		});

		// Test error message consistency
		it("should provide consistent error messages for the same invalid data", () => {
			const invalidData = { calendars: [] };

			const result1 = CustomCalendarSettingsSchema.safeParse(invalidData);
			const result2 = CustomCalendarSettingsSchema.safeParse(invalidData);

			expect(result1.success).toBe(false);
			expect(result2.success).toBe(false);

			if (!result1.success && !result2.success) {
				expect(result1.error.message).toBe(result2.error.message);
			}
		});
	});
});
