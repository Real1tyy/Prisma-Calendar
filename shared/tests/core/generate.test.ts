import { describe, expect, it } from "vitest";

import { generateZettelId } from "../../src/utils/generate";

describe("generateZettelId", () => {
	it("returns a number", () => {
		const id = generateZettelId();
		expect(typeof id).toBe("number");
	});

	it("matches YYYYMMDDHHmmss format (14 digits)", () => {
		const id = generateZettelId();
		const idString = String(id);
		expect(idString).toMatch(/^\d{14}$/);
	});

	it("starts with the current year", () => {
		const id = generateZettelId();
		const idString = String(id);
		const currentYear = new Date().getFullYear();
		expect(idString.startsWith(String(currentYear))).toBe(true);
	});

	it("contains a valid month (01-12)", () => {
		const id = generateZettelId();
		const idString = String(id);
		const month = Number(idString.slice(4, 6));
		expect(month).toBeGreaterThanOrEqual(1);
		expect(month).toBeLessThanOrEqual(12);
	});

	it("contains a valid day (01-31)", () => {
		const id = generateZettelId();
		const idString = String(id);
		const day = Number(idString.slice(6, 8));
		expect(day).toBeGreaterThanOrEqual(1);
		expect(day).toBeLessThanOrEqual(31);
	});

	it("contains valid hours (00-23)", () => {
		const id = generateZettelId();
		const idString = String(id);
		const hours = Number(idString.slice(8, 10));
		expect(hours).toBeGreaterThanOrEqual(0);
		expect(hours).toBeLessThanOrEqual(23);
	});

	it("contains valid minutes (00-59)", () => {
		const id = generateZettelId();
		const idString = String(id);
		const minutes = Number(idString.slice(10, 12));
		expect(minutes).toBeGreaterThanOrEqual(0);
		expect(minutes).toBeLessThanOrEqual(59);
	});

	it("contains valid seconds (00-59)", () => {
		const id = generateZettelId();
		const idString = String(id);
		const seconds = Number(idString.slice(12, 14));
		expect(seconds).toBeGreaterThanOrEqual(0);
		expect(seconds).toBeLessThanOrEqual(59);
	});

	it("generates the same value for calls within the same second", () => {
		const id1 = generateZettelId();
		const id2 = generateZettelId();
		expect(id1).toBe(id2);
	});
});
