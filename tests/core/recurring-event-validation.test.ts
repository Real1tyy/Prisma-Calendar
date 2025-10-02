import { describe, expect, it } from "vitest";
import { RRuleFrontmatterSchema } from "../../src/types/recurring-event-schemas";

describe("RRuleFrontmatterSchema validation", () => {
	describe("allDay and time field validation", () => {
		it("should accept allDay false with both startTime and endTime defined", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "wednesday",
				startTime: "2024-01-01T10:45:00",
				endTime: "2024-01-01T12:30:00",
				allDay: false,
			});

			expect(result.success).toBe(true);
		});

		it("should reject allDay false with missing startTime", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "friday, saturday, sunday",
				startTime: undefined,
				endTime: "2024-01-01T12:30:00",
				allDay: false,
			});

			expect(result.success).toBe(false);
		});

		it("should reject allDay false with missing endTime", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "friday, saturday, sunday",
				startTime: "2024-01-01T10:45:00",
				endTime: undefined,
				allDay: false,
			});

			expect(result.success).toBe(false);
		});

		it("should reject allDay false with both times missing", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "friday, saturday, sunday",
				startTime: undefined,
				endTime: undefined,
				allDay: false,
			});

			expect(result.success).toBe(false);
		});

		it("should accept allDay true with date defined", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "friday, saturday, sunday",
				date: "2024-01-15",
				startTime: undefined,
				endTime: undefined,
				allDay: true,
			});

			expect(result.success).toBe(true);
		});

		it("should reject allDay true with startTime defined but no date", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "wednesday",
				date: undefined,
				startTime: "2024-01-01T10:45:00",
				endTime: undefined,
				allDay: true,
			});

			expect(result.success).toBe(false);
		});

		it("should reject allDay true without date", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "wednesday",
				date: undefined,
				startTime: undefined,
				endTime: undefined,
				allDay: true,
			});

			expect(result.success).toBe(false);
		});

		it("should ignore startTime/endTime when allDay is true and date is provided", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "wednesday",
				date: "2024-01-15",
				startTime: "2024-01-01T10:45:00",
				endTime: "2024-01-01T12:30:00",
				allDay: true,
			});

			// Should succeed - we ignore startTime/endTime when allDay is true
			expect(result.success).toBe(true);
		});
	});

	describe("null value handling", () => {
		it("should accept null weekdays and transform to undefined", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "daily",
				weekdays: null,
				startTime: "2024-01-01T10:45:00",
				endTime: "2024-01-01T12:30:00",
				allDay: false,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.weekdays).toEqual([]);
			}
		});

		it("should accept null startTime and endTime when allDay is true and date is provided", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "daily",
				weekdays: null,
				date: "2024-01-15",
				startTime: null,
				endTime: null,
				allDay: true,
			});

			expect(result.success).toBe(true);
		});

		it("should reject null startTime when allDay is false", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "monday",
				startTime: null,
				endTime: "2024-01-01T12:30:00",
				allDay: false,
			});

			expect(result.success).toBe(false);
		});

		it("should reject null endTime when allDay is false", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "monday",
				startTime: "2024-01-01T10:45:00",
				endTime: null,
				allDay: false,
			});

			expect(result.success).toBe(false);
		});
	});

	describe("timezone preservation in time transformation", () => {
		it("should preserve original time component from ISO string without timezone conversion", () => {
			// Test the specific bug where 08:45 UTC was being converted to 10:45 local time
			const result = RRuleFrontmatterSchema.safeParse({
				type: "weekly",
				weekdays: "wednesday,friday",
				startTime: "2025-09-14T08:45:00.277Z", // 08:45 UTC
				endTime: "2025-09-14T10:45:00.278Z", // 10:45 UTC
				allDay: false,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.startTime?.toFormat("HH:mm")).toBe("08:45");
				expect(result.data.endTime?.toFormat("HH:mm")).toBe("10:45");
			}
		});

		it("should handle different timezone ISO strings correctly", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "daily",
				weekdays: null,
				startTime: "2025-09-14T14:30:00.000+05:00", // 2:30 PM in +05:00 timezone
				endTime: "2025-09-14T16:15:00.000+05:00", // 4:15 PM in +05:00 timezone
				allDay: false,
			});

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.startTime?.toFormat("HH:mm")).toBe("14:30");
				expect(result.data.endTime?.toFormat("HH:mm")).toBe("16:15");
			}
		});

		it("should reject plain HH:mm format strings", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "monthly",
				weekdays: null,
				startTime: "08:45", // Plain HH:mm format - should be rejected
				endTime: "10:45",
				allDay: false,
			});

			// Plain HH:mm format should be rejected - requires full datetime
			expect(result.success).toBe(false);
		});

		it("should accept various datetime formats with date components", () => {
			// Test space-separated format
			const result1 = RRuleFrontmatterSchema.safeParse({
				type: "monthly",
				weekdays: null,
				startTime: "2025-09-15 08:45",
				endTime: "2025-09-15 10:45",
				allDay: false,
			});
			expect(result1.success).toBe(true);
			if (result1.success) {
				expect(result1.data.startTime?.toFormat("HH:mm")).toBe("08:45");
				expect(result1.data.endTime?.toFormat("HH:mm")).toBe("10:45");
			}

			// Test ISO format with seconds
			const result2 = RRuleFrontmatterSchema.safeParse({
				type: "monthly",
				weekdays: null,
				startTime: "2025-09-15T08:45:30",
				endTime: "2025-09-15T10:45:30",
				allDay: false,
			});
			expect(result2.success).toBe(true);
			if (result2.success) {
				expect(result2.data.startTime?.toFormat("HH:mm")).toBe("08:45");
				expect(result2.data.endTime?.toFormat("HH:mm")).toBe("10:45");
			}
		});

		it("should return undefined for truly invalid time strings", () => {
			const result = RRuleFrontmatterSchema.safeParse({
				type: "monthly",
				weekdays: null,
				startTime: "invalid-time", // Invalid format
				endTime: "25:99", // Invalid time values
				allDay: false,
			});

			// This should fail validation because times are undefined after transformation
			expect(result.success).toBe(false);
		});
	});
});
