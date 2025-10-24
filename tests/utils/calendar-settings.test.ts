import { describe, expect, it } from "vitest";
import type { SingleCalendarConfig } from "../../src/types";
import { createDefaultCalendarConfig, duplicateCalendarConfig } from "../../src/utils/calendar-settings";

describe("Calendar Settings Utils", () => {
	describe("createDefaultCalendarConfig", () => {
		it("should create a default calendar config", () => {
			const config = createDefaultCalendarConfig("test-id", "Test Calendar");

			expect(config.id).toBe("test-id");
			expect(config.name).toBe("Test Calendar");
			expect(config.enabled).toBe(true);
			expect(config.directory).toBe("");
		});
	});

	describe("duplicateCalendarConfig", () => {
		it("should duplicate calendar config with new id and name", () => {
			const source: SingleCalendarConfig = {
				...createDefaultCalendarConfig("original", "Original Calendar"),
				directory: "some/path",
				startProp: "start",
				endProp: "end",
			};

			const duplicated = duplicateCalendarConfig(source, "new-id", "New Calendar");

			expect(duplicated.id).toBe("new-id");
			expect(duplicated.name).toBe("New Calendar");
			expect(duplicated.startProp).toBe("start");
			expect(duplicated.endProp).toBe("end");
		});

		it("should reset directory to empty string when duplicating", () => {
			const source: SingleCalendarConfig = {
				...createDefaultCalendarConfig("original", "Original Calendar"),
				directory: "some/path/to/events",
			};

			const duplicated = duplicateCalendarConfig(source, "new-id", "Duplicated Calendar");

			expect(source.directory).toBe("some/path/to/events"); // Original unchanged
			expect(duplicated.directory).toBe(""); // Duplicated has empty directory
		});

		it("should preserve all other settings except id, name, and directory", () => {
			const source: SingleCalendarConfig = {
				...createDefaultCalendarConfig("original", "Original Calendar"),
				directory: "events/",
				startProp: "customStart",
				endProp: "customEnd",
				dateProp: "customDate",
				titleProp: "customTitle",
				defaultDurationMinutes: 45,
				filterExpressions: ["status !== 'done'"],
				colorRules: [
					{
						id: "rule-1",
						expression: "priority === 'high'",
						enabled: true,
						color: "#ff0000",
					},
				],
			};

			const duplicated = duplicateCalendarConfig(source, "new-id", "New Calendar");

			// Changed properties
			expect(duplicated.id).toBe("new-id");
			expect(duplicated.name).toBe("New Calendar");
			expect(duplicated.directory).toBe("");

			// Preserved properties
			expect(duplicated.startProp).toBe("customStart");
			expect(duplicated.endProp).toBe("customEnd");
			expect(duplicated.dateProp).toBe("customDate");
			expect(duplicated.titleProp).toBe("customTitle");
			expect(duplicated.defaultDurationMinutes).toBe(45);
			expect(duplicated.filterExpressions).toEqual(["status !== 'done'"]);
			expect(duplicated.colorRules).toEqual([
				{
					id: "rule-1",
					expression: "priority === 'high'",
					enabled: true,
					color: "#ff0000",
				},
			]);
		});
	});
});
