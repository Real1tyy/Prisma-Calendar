import { describe, expect, it } from "vitest";

import { toSafeLocalISO, toSafeLocalISOOrNull } from "../../src/utils/virtual-event-conversion";

describe("toSafeLocalISO", () => {
	it("should convert a Date object to local ISO string", () => {
		const date = new Date(2025, 2, 15, 9, 30, 0); // March 15, 2025 09:30:00 local
		const result = toSafeLocalISO(date);
		expect(result).toBe("2025-03-15T09:30:00");
	});

	it("should convert a local ISO string to local ISO string (pass-through)", () => {
		const result = toSafeLocalISO("2025-03-15T09:30:00");
		expect(result).toBe("2025-03-15T09:30:00");
	});

	it("should handle midnight Date for all-day events", () => {
		const date = new Date(2025, 2, 15, 0, 0, 0); // Midnight local
		const result = toSafeLocalISO(date);
		expect(result).toBe("2025-03-15T00:00:00");
	});

	it("should return empty string for null", () => {
		expect(toSafeLocalISO(null)).toBe("");
	});

	it("should return empty string for undefined", () => {
		expect(toSafeLocalISO(undefined)).toBe("");
	});

	it("should return empty string for empty string", () => {
		expect(toSafeLocalISO("")).toBe("");
	});

	it("should return empty string for unparseable string", () => {
		expect(toSafeLocalISO("not-a-date")).toBe("");
	});

	it("should preserve seconds in the output", () => {
		const date = new Date(2025, 2, 15, 9, 30, 45);
		const result = toSafeLocalISO(date);
		expect(result).toBe("2025-03-15T09:30:45");
	});

	it("should zero-pad single-digit components", () => {
		const date = new Date(2025, 0, 5, 3, 7, 9); // Jan 5, 03:07:09
		const result = toSafeLocalISO(date);
		expect(result).toBe("2025-01-05T03:07:09");
	});
});

describe("toSafeLocalISOOrNull", () => {
	it("should convert a Date object to local ISO string", () => {
		const date = new Date(2025, 2, 15, 14, 0, 0);
		const result = toSafeLocalISOOrNull(date);
		expect(result).toBe("2025-03-15T14:00:00");
	});

	it("should return null for null input", () => {
		expect(toSafeLocalISOOrNull(null)).toBeNull();
	});

	it("should return null for undefined input", () => {
		expect(toSafeLocalISOOrNull(undefined)).toBeNull();
	});

	it("should return null for unparseable string", () => {
		expect(toSafeLocalISOOrNull("garbage")).toBeNull();
	});

	it("should return null for empty string", () => {
		expect(toSafeLocalISOOrNull("")).toBeNull();
	});

	it("should convert a valid ISO string to local ISO", () => {
		const result = toSafeLocalISOOrNull("2025-06-01T18:30:00");
		expect(result).toBe("2025-06-01T18:30:00");
	});
});
