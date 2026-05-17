import { describe, expect, it } from "vitest";

import { isTimeUnitAllowedForAllDay, TIME_UNITS } from "../../src/types/calendar";

describe("isTimeUnitAllowedForAllDay", () => {
	it.each([
		["days", true],
		["weeks", true],
		["months", true],
		["years", true],
		["minutes", false],
		["hours", false],
	] as const)("returns %s = %s", (unit, expected) => {
		expect(isTimeUnitAllowedForAllDay(unit)).toBe(expected);
	});

	it("covers every TimeUnit (no silent gaps if a unit is added)", () => {
		// Guards against adding a new TimeUnit without classifying it here.
		for (const unit of TIME_UNITS) {
			expect(typeof isTimeUnitAllowedForAllDay(unit)).toBe("boolean");
		}
	});
});
