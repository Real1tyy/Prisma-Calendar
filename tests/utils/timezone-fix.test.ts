import { describe, expect, it } from "vitest";
import { toLocalISOString } from "../../src/utils/format";

describe("Timezone Fix - Last Day of Week Bug", () => {
	it("should convert Date to ISO string without timezone conversion", () => {
		// Simulate a scenario where the last day of the week ends at midnight local time
		// This was causing events after 3 PM to disappear in certain timezones
		const localMidnight = new Date(2025, 0, 4, 23, 59, 59, 999); // Jan 4, 2025 23:59:59.999 local

		const isoString = toLocalISOString(localMidnight);

		// Should preserve local time components, not convert to UTC
		expect(isoString).toBe("2025-01-04T23:59:59.999Z");

		// Verify that standard toISOString() would have converted to UTC (demonstrating the bug)
		const standardIsoString = localMidnight.toISOString();
		// In UTC-5 timezone, this would become 2025-01-05T04:59:59.999Z
		// In UTC+1 timezone, this would become 2025-01-04T22:59:59.999Z
		// The exact value depends on the system timezone, but it will be different from local time
		expect(standardIsoString).not.toBe(isoString);
	});

	it("should handle events at 3 PM on the last day of the week", () => {
		// This was the specific time mentioned in the bug report
		const saturday3PM = new Date(2025, 0, 4, 15, 0, 0, 0); // Jan 4, 2025 15:00 local

		const isoString = toLocalISOString(saturday3PM);

		// Should preserve 15:00 local time
		expect(isoString).toBe("2025-01-04T15:00:00.000Z");
	});

	it("should handle week end boundary correctly", () => {
		// Week ending at Sunday midnight (when week starts on Monday)
		const sundayMidnight = new Date(2025, 0, 5, 0, 0, 0, 0); // Jan 5, 2025 00:00 local

		const isoString = toLocalISOString(sundayMidnight);

		// Should be exactly midnight local time
		expect(isoString).toBe("2025-01-05T00:00:00.000Z");
	});

	it("should preserve all time components without timezone offset", () => {
		const testDate = new Date(2025, 5, 15, 18, 30, 45, 123); // Jun 15, 2025 18:30:45.123 local

		const isoString = toLocalISOString(testDate);

		expect(isoString).toBe("2025-06-15T18:30:45.123Z");

		// Verify components are preserved
		const parsed = new Date(isoString.replace(/Z$/, ""));
		expect(parsed.getFullYear()).toBe(2025);
		expect(parsed.getMonth()).toBe(5); // June (0-indexed)
		expect(parsed.getDate()).toBe(15);
		expect(parsed.getHours()).toBe(18);
		expect(parsed.getMinutes()).toBe(30);
		expect(parsed.getSeconds()).toBe(45);
		expect(parsed.getMilliseconds()).toBe(123);
	});
});
