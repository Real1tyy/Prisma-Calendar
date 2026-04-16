import { describe, expect, it } from "vitest";

import {
	generateColors,
	hasVeryCloseShade,
	hasVeryCloseShadeFromRgb,
	hexToRgb,
	parseColor,
	parseColorToRgb,
	type RgbColor,
} from "../../src/utils/color-utils";

describe("generateColors", () => {
	it("should generate correct number of colors", () => {
		const colors = generateColors(5);
		expect(colors).toHaveLength(5);
	});

	it("should return empty array for count 0", () => {
		const colors = generateColors(0);
		expect(colors).toEqual([]);
	});

	it("should return empty array for negative count", () => {
		const colors = generateColors(-5);
		expect(colors).toEqual([]);
	});

	it("should return curated palette colors for small counts", () => {
		const colors = generateColors(3);
		expect(colors[0]).toBe("hsl(210, 75%, 55%)"); // Blue
		expect(colors[1]).toBe("hsl(340, 75%, 55%)"); // Rose
		expect(colors[2]).toBe("hsl(160, 70%, 45%)"); // Teal
	});

	it("should generate single color", () => {
		const colors = generateColors(1);
		expect(colors).toHaveLength(1);
		expect(colors[0]).toBe("hsl(210, 75%, 55%)");
	});

	it("should handle large counts by cycling with shifted lightness", () => {
		const colors = generateColors(25);
		expect(colors).toHaveLength(25);
		// First 20 are the base palette
		expect(colors[0]).toBe("hsl(210, 75%, 55%)");
		// 21st wraps around with lightness shift
		expect(colors[20]).toBe("hsl(210, 75%, 67%)");
	});

	it("should generate valid HSL format", () => {
		const colors = generateColors(10);
		const hslRegex = /^hsl\(\d+, \d+%, \d+%\)$/;
		for (const color of colors) {
			expect(color).toMatch(hslRegex);
		}
	});

	it("should generate distinct colors within palette size", () => {
		const colors = generateColors(20);
		const uniqueColors = new Set(colors);
		expect(uniqueColors.size).toBe(20);
	});

	it("should not exceed 85% lightness when cycling", () => {
		const colors = generateColors(60); // 3 full cycles
		for (const color of colors) {
			const match = color.match(/(\d+)%\)$/);
			expect(match).not.toBeNull();
			expect(Number(match![1])).toBeLessThanOrEqual(85);
		}
	});
});

describe("hasVeryCloseShadeFromRgb", () => {
	it("should return true for identical colors", () => {
		const foreground: RgbColor = { r: 100, g: 100, b: 100 };
		expect(hasVeryCloseShadeFromRgb(foreground, "rgb(100, 100, 100)")).toBe(true);
	});

	it("should return false for very different colors", () => {
		const foreground: RgbColor = { r: 0, g: 0, b: 0 };
		expect(hasVeryCloseShadeFromRgb(foreground, "#ffffff")).toBe(false);
	});

	it("should return true for colors within threshold distance", () => {
		const foreground: RgbColor = { r: 100, g: 100, b: 100 };
		expect(hasVeryCloseShadeFromRgb(foreground, "rgb(110, 110, 110)")).toBe(true);
	});

	it("should return false for invalid background color", () => {
		const foreground: RgbColor = { r: 100, g: 100, b: 100 };
		expect(hasVeryCloseShadeFromRgb(foreground, "not-a-color")).toBe(false);
	});
});

describe("hasVeryCloseShade", () => {
	it("should return true for identical hex colors", () => {
		expect(hasVeryCloseShade("#333333", "#333333")).toBe(true);
	});

	it("should return false for black and white", () => {
		expect(hasVeryCloseShade("#000000", "#ffffff")).toBe(false);
	});

	it("should return false when foreground is invalid", () => {
		expect(hasVeryCloseShade("invalid", "#000000")).toBe(false);
	});

	it("should return false when background is invalid", () => {
		expect(hasVeryCloseShade("#000000", "invalid")).toBe(false);
	});
});

describe("parseColor", () => {
	it("should parse a valid hex color to HSL", () => {
		const result = parseColor("#ff0000");
		expect(result).not.toBeNull();
		expect(result!.h).toBeCloseTo(0, 0);
		expect(result!.s).toBeGreaterThan(0);
		expect(result!.l).toBeGreaterThan(0);
	});

	it("should return null for named colors without the names plugin", () => {
		const result = parseColor("blue");
		expect(result).toBeNull();
	});

	it("should return null for invalid color string", () => {
		expect(parseColor("not-a-color")).toBeNull();
	});

	it("should parse HSL color strings", () => {
		const result = parseColor("hsl(120, 50%, 50%)");
		expect(result).not.toBeNull();
		expect(result!.h).toBeCloseTo(120, 0);
	});
});

describe("parseColorToRgb", () => {
	it("should parse hex color to RGB", () => {
		const result = parseColorToRgb("#ff8000");
		expect(result).not.toBeNull();
		expect(result!.r).toBe(255);
		expect(result!.g).toBe(128);
		expect(result!.b).toBe(0);
	});

	it("should return null for invalid color", () => {
		expect(parseColorToRgb("not-valid")).toBeNull();
	});
});

describe("hexToRgb", () => {
	it("should convert a valid 6-digit hex to RGB", () => {
		const result = hexToRgb("#ff8040");
		expect(result).toEqual({ r: 255, g: 128, b: 64 });
	});

	it("should handle hex without hash prefix", () => {
		const result = hexToRgb("00ff00");
		expect(result).toEqual({ r: 0, g: 255, b: 0 });
	});

	it("should return null for invalid hex string", () => {
		expect(hexToRgb("xyz")).toBeNull();
	});

	it("should parse 3-digit shorthand hex", () => {
		expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
	});

	it("should handle lowercase and uppercase hex", () => {
		const lower = hexToRgb("#aabbcc");
		const upper = hexToRgb("#AABBCC");
		expect(lower).toEqual(upper);
		expect(lower).toEqual({ r: 170, g: 187, b: 204 });
	});

	it("should parse black", () => {
		expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
	});

	it("should parse white", () => {
		expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
	});

	it("should parse 3-digit hex without hash", () => {
		expect(hexToRgb("f00")).toEqual({ r: 255, g: 0, b: 0 });
	});

	it("should parse 3-digit hex mixed case", () => {
		expect(hexToRgb("#0Af")).toEqual({ r: 0, g: 170, b: 255 });
	});

	it("should return null for empty string", () => {
		expect(hexToRgb("")).toBeNull();
	});
});
