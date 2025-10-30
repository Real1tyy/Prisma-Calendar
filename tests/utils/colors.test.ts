import { describe, expect, it } from "vitest";
import { generateColors } from "../../src/utils/colors";

describe("generateColors", () => {
	it("should generate the correct number of colors", () => {
		const colors = generateColors(5);
		expect(colors).toHaveLength(5);
	});

	it("should return empty array for zero count", () => {
		const colors = generateColors(0);
		expect(colors).toEqual([]);
	});

	it("should return empty array for negative count", () => {
		const colors = generateColors(-5);
		expect(colors).toEqual([]);
	});

	it("should generate single color for count of 1", () => {
		const colors = generateColors(1);
		expect(colors).toHaveLength(1);
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
	});

	it("should generate evenly distributed hues", () => {
		const colors = generateColors(4);

		// For 4 colors, hues should be: 0, 90, 180, 270
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
		expect(colors[1]).toBe("hsl(90, 70%, 60%)");
		expect(colors[2]).toBe("hsl(180, 70%, 60%)");
		expect(colors[3]).toBe("hsl(270, 70%, 60%)");
	});

	it("should use default saturation and lightness", () => {
		const colors = generateColors(2);

		expect(colors[0]).toBe("hsl(0, 70%, 60%)");
		expect(colors[1]).toBe("hsl(180, 70%, 60%)");
	});

	it("should accept custom saturation", () => {
		const colors = generateColors(2, 50);

		expect(colors[0]).toBe("hsl(0, 50%, 60%)");
		expect(colors[1]).toBe("hsl(180, 50%, 60%)");
	});

	it("should accept custom lightness", () => {
		const colors = generateColors(2, 70, 80);

		expect(colors[0]).toBe("hsl(0, 70%, 80%)");
		expect(colors[1]).toBe("hsl(180, 70%, 80%)");
	});

	it("should accept custom saturation and lightness", () => {
		const colors = generateColors(3, 100, 50);

		expect(colors[0]).toBe("hsl(0, 100%, 50%)");
		expect(colors[1]).toBe("hsl(120, 100%, 50%)");
		expect(colors[2]).toBe("hsl(240, 100%, 50%)");
	});

	it("should generate valid HSL color strings", () => {
		const colors = generateColors(10);

		for (const color of colors) {
			// Check that each color matches HSL format
			expect(color).toMatch(/^hsl\(\d+(\.\d+)?, \d+%, \d+%\)$/);
		}
	});

	it("should handle large count", () => {
		const colors = generateColors(100);
		expect(colors).toHaveLength(100);

		// First color should be at hue 0
		expect(colors[0]).toBe("hsl(0, 70%, 60%)");

		// Last color should be at hue 356.4 (99 * 360 / 100)
		expect(colors[99]).toBe("hsl(356.4, 70%, 60%)");
	});

	it("should generate distinct colors for reasonable count", () => {
		const colors = generateColors(12);

		// All colors should be unique
		const uniqueColors = new Set(colors);
		expect(uniqueColors.size).toBe(12);
	});

	it("should handle fractional hue values", () => {
		const colors = generateColors(7);

		// For 7 colors, hues are: 0, 51.42857..., 102.857..., etc.
		expect(colors[0]).toMatch(/^hsl\(0, 70%, 60%\)$/);
		expect(colors[1]).toMatch(/^hsl\(51\.\d+, 70%, 60%\)$/);
	});

	it("should work with edge case saturation values", () => {
		const colorsMin = generateColors(2, 0);
		expect(colorsMin[0]).toBe("hsl(0, 0%, 60%)");

		const colorsMax = generateColors(2, 100);
		expect(colorsMax[0]).toBe("hsl(0, 100%, 60%)");
	});

	it("should work with edge case lightness values", () => {
		const colorsMin = generateColors(2, 70, 0);
		expect(colorsMin[0]).toBe("hsl(0, 70%, 0%)");

		const colorsMax = generateColors(2, 70, 100);
		expect(colorsMax[0]).toBe("hsl(0, 70%, 100%)");
	});

	it("should maintain consistent distribution regardless of count", () => {
		const colors6 = generateColors(6);
		const colors12 = generateColors(12);

		// First color should always start at hue 0
		expect(colors6[0]).toBe("hsl(0, 70%, 60%)");
		expect(colors12[0]).toBe("hsl(0, 70%, 60%)");

		// Every other color in colors12 should match colors6 distribution pattern
		expect(colors12[0]).toBe(colors6[0]); // Both at 0 degrees
		expect(colors12[2]).toBe(colors6[1]); // Both at 60 degrees
		expect(colors12[4]).toBe(colors6[2]); // Both at 120 degrees
	});
});
