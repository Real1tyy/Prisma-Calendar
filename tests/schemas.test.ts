import { describe, expect, it } from "vitest";

import { CustomCalendarSettingsSchema } from "../src/types/index";

describe("Calendar Schemas", () => {
	it("should normalize calendar directory paths", () => {
		const defaultSettings = CustomCalendarSettingsSchema.parse({});
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
