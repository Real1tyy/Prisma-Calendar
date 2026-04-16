import { describe, expect, it } from "vitest";

import { formatMsToHHMMSS, formatMsToMMSS, parseAsLocalDate } from "../../src/utils/date/date";

describe("formatMsToHHMMSS", () => {
	it("should format 0 as 00:00:00", () => {
		expect(formatMsToHHMMSS(0)).toBe("00:00:00");
	});

	it("should format seconds correctly", () => {
		expect(formatMsToHHMMSS(1000)).toBe("00:00:01");
		expect(formatMsToHHMMSS(45000)).toBe("00:00:45");
		expect(formatMsToHHMMSS(59000)).toBe("00:00:59");
	});

	it("should format minutes correctly", () => {
		expect(formatMsToHHMMSS(60000)).toBe("00:01:00");
		expect(formatMsToHHMMSS(185000)).toBe("00:03:05");
		expect(formatMsToHHMMSS(3599000)).toBe("00:59:59");
	});

	it("should format hours correctly", () => {
		expect(formatMsToHHMMSS(3600000)).toBe("01:00:00");
		expect(formatMsToHHMMSS(3723000)).toBe("01:02:03");
		expect(formatMsToHHMMSS(36000000)).toBe("10:00:00");
	});

	it("should handle large values", () => {
		expect(formatMsToHHMMSS(86400000)).toBe("24:00:00");
		expect(formatMsToHHMMSS(360000000)).toBe("100:00:00");
	});

	it("should truncate milliseconds (not round)", () => {
		expect(formatMsToHHMMSS(1500)).toBe("00:00:01");
		expect(formatMsToHHMMSS(999)).toBe("00:00:00");
	});
});

describe("formatMsToMMSS", () => {
	it("should format 0 as 00:00", () => {
		expect(formatMsToMMSS(0)).toBe("00:00");
	});

	it("should format seconds correctly", () => {
		expect(formatMsToMMSS(1000)).toBe("00:01");
		expect(formatMsToMMSS(30000)).toBe("00:30");
		expect(formatMsToMMSS(59000)).toBe("00:59");
	});

	it("should format minutes correctly", () => {
		expect(formatMsToMMSS(60000)).toBe("01:00");
		expect(formatMsToMMSS(125000)).toBe("02:05");
	});

	it("should handle large minute values (no hour conversion)", () => {
		expect(formatMsToMMSS(3600000)).toBe("60:00");
		expect(formatMsToMMSS(7200000)).toBe("120:00");
	});

	it("should truncate milliseconds (not round)", () => {
		expect(formatMsToMMSS(1500)).toBe("00:01");
		expect(formatMsToMMSS(999)).toBe("00:00");
	});
});

describe("parseAsLocalDate", () => {
	describe("Timezone stripping", () => {
		it("should strip Z timezone indicator", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00Z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});

		it("should strip positive timezone offset with colon (+HH:MM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00+01:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});

		it("should strip negative timezone offset with colon (-HH:MM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00-05:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});

		it("should handle lowercase z", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});
	});

	describe("Date formats", () => {
		it("should parse full ISO datetime with seconds", () => {
			const result = parseAsLocalDate("2024-01-15T15:30:45Z");
			expect(result).not.toBeNull();
			expect(result?.getFullYear()).toBe(2024);
			expect(result?.getMonth()).toBe(0);
			expect(result?.getDate()).toBe(15);
			expect(result?.getHours()).toBe(15);
			expect(result?.getMinutes()).toBe(30);
		});

		it("should parse date-only format", () => {
			const result = parseAsLocalDate("2024-01-15");
			expect(result).not.toBeNull();
			expect(result?.getFullYear()).toBe(2024);
		});

		it("should parse datetime without timezone", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});
	});

	describe("Invalid inputs", () => {
		it("should return null for invalid date string", () => {
			expect(parseAsLocalDate("invalid-date")).toBeNull();
		});

		it("should return null for empty string", () => {
			expect(parseAsLocalDate("")).toBeNull();
		});
	});

	describe("Consistency", () => {
		it("should produce same local time regardless of timezone in input", () => {
			const utcDate = parseAsLocalDate("2024-01-15T15:00:00Z");
			const plusOneDate = parseAsLocalDate("2024-01-15T15:00:00+01:00");
			const noTzDate = parseAsLocalDate("2024-01-15T15:00:00");

			expect(utcDate?.getHours()).toBe(15);
			expect(plusOneDate?.getHours()).toBe(15);
			expect(noTzDate?.getHours()).toBe(15);
		});
	});
});
