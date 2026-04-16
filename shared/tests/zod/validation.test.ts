import { describe, expect, it } from "vitest";

import { createDateTransforms, parseISODateStart, requiredDateTransform } from "../../src/utils/zod/validation";

describe("parseISODateStart timezone behavior", () => {
	it("parses date in local timezone by default", () => {
		const result = requiredDateTransform.safeParse("2026-03-15");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.day).toBe(15);
			expect(result.data.month).toBe(3);
			expect(result.data.year).toBe(2026);
		}
	});

	it("produces start of day for the correct date", () => {
		const result = requiredDateTransform.safeParse("2026-12-31");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.day).toBe(31);
			expect(result.data.hour).toBe(0);
			expect(result.data.minute).toBe(0);
		}
	});

	it("rejects invalid date strings", () => {
		const result = requiredDateTransform.safeParse("not-a-date");
		expect(result.success).toBe(false);
	});
});

describe("parseISODateStart configurable timezone", () => {
	it("defaults to local timezone when no zone specified", () => {
		const dt = parseISODateStart("2026-06-15");
		expect(dt).toBeDefined();
		expect(dt!.day).toBe(15);
	});

	it("parses in explicit UTC timezone", () => {
		const dt = parseISODateStart("2026-06-15", "utc");
		expect(dt).toBeDefined();
		expect(dt!.day).toBe(15);
		expect(dt!.zoneName).toBe("UTC");
	});

	it("parses in explicit IANA timezone", () => {
		const dt = parseISODateStart("2026-06-15", "America/New_York");
		expect(dt).toBeDefined();
		expect(dt!.day).toBe(15);
		expect(dt!.zoneName).toBe("America/New_York");
	});

	it("returns undefined for invalid date", () => {
		expect(parseISODateStart("invalid")).toBeUndefined();
	});
});

describe("createDateTransforms", () => {
	it("creates transforms with default local timezone", () => {
		const { requiredDateTransform: req } = createDateTransforms();
		const result = req.safeParse("2026-03-15");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.day).toBe(15);
		}
	});

	it("creates transforms with explicit UTC timezone", () => {
		const { requiredDateTransform: req } = createDateTransforms("utc");
		const result = req.safeParse("2026-03-15");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.day).toBe(15);
			expect(result.data.zoneName).toBe("UTC");
		}
	});

	it("creates optional transform with explicit timezone", () => {
		const { optionalDateTransform: opt } = createDateTransforms("America/Chicago");
		const result = opt.safeParse("2026-07-04");
		expect(result.success).toBe(true);
		if (result.success && result.data) {
			expect(result.data.day).toBe(4);
			expect(result.data.zoneName).toBe("America/Chicago");
		}
	});
});
