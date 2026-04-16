import { colord } from "colord";

const VERY_CLOSE_SHADE_DISTANCE = 48;

export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

/**
 * Parses a color string into RGB components.
 * Returns null if the color is invalid.
 */
export function parseColorToRgb(color: string): RgbColor | null {
	const parsed = colord(color);
	if (!parsed.isValid()) return null;
	return parsed.toRgb();
}

/**
 * Calculates the Euclidean distance between two RGB colors.
 */
function calculateRgbDistance(rgb1: RgbColor, rgb2: RgbColor): number {
	return Math.sqrt(
		(rgb1.r - rgb2.r) * (rgb1.r - rgb2.r) +
			(rgb1.g - rgb2.g) * (rgb1.g - rgb2.g) +
			(rgb1.b - rgb2.b) * (rgb1.b - rgb2.b)
	);
}

/**
 * True when two colors are very close in shade (RGB distance).
 * Used to switch to alternative text color only when default text color
 * is nearly the same color as the event background.
 */
export function hasVeryCloseShade(foregroundColor: string, backgroundColor: string): boolean {
	const foregroundRgb = parseColorToRgb(foregroundColor);
	const backgroundRgb = parseColorToRgb(backgroundColor);
	if (!foregroundRgb || !backgroundRgb) return false;

	const distance = calculateRgbDistance(foregroundRgb, backgroundRgb);
	return distance <= VERY_CLOSE_SHADE_DISTANCE;
}

/**
 * Like hasVeryCloseShade but accepts a pre-parsed foreground RGB value.
 * Avoids re-parsing the same foreground color for every event.
 */
export function hasVeryCloseShadeFromRgb(foregroundRgb: RgbColor, backgroundColor: string): boolean {
	const backgroundRgb = parseColorToRgb(backgroundColor);
	if (!backgroundRgb) return false;

	const distance = calculateRgbDistance(foregroundRgb, backgroundRgb);
	return distance <= VERY_CLOSE_SHADE_DISTANCE;
}

export function parseColor(color: string): { h: number; s: number; l: number } | null {
	const parsed = colord(color);
	if (!parsed.isValid()) {
		return null;
	}
	return parsed.toHsl();
}

/**
 * A curated palette of 20 visually distinct, vibrant colors for charts and
 * visualizations. When more than 20 colors are needed, the palette cycles
 * with shifted lightness to stay distinguishable.
 */
const COLOR_PALETTE: readonly string[] = [
	"hsl(210, 75%, 55%)", // Blue
	"hsl(340, 75%, 55%)", // Rose
	"hsl(160, 70%, 45%)", // Teal
	"hsl(30, 85%, 55%)", // Orange
	"hsl(270, 65%, 58%)", // Purple
	"hsl(50, 80%, 50%)", // Gold
	"hsl(190, 70%, 48%)", // Cyan
	"hsl(0, 70%, 55%)", // Red
	"hsl(140, 60%, 45%)", // Green
	"hsl(300, 55%, 55%)", // Magenta
	"hsl(220, 60%, 65%)", // Periwinkle
	"hsl(15, 75%, 50%)", // Vermilion
	"hsl(175, 65%, 42%)", // Dark teal
	"hsl(45, 90%, 52%)", // Amber
	"hsl(255, 55%, 62%)", // Lavender
	"hsl(95, 55%, 48%)", // Olive green
	"hsl(330, 60%, 50%)", // Raspberry
	"hsl(200, 65%, 50%)", // Steel blue
	"hsl(75, 60%, 48%)", // Chartreuse
	"hsl(355, 60%, 48%)", // Crimson
];

/**
 * Generates an array of visually distinct colors for charts and visualizations.
 * Uses a curated palette for the best visual variety. When more colors are
 * needed than the palette contains, cycles with adjusted lightness.
 *
 * @param count - Number of colors to generate
 * @returns Array of HSL color strings
 */
export function generateColors(count: number): string[] {
	if (count <= 0) return [];

	return Array.from({ length: count }, (_, i) => {
		const paletteIndex = i % COLOR_PALETTE.length;
		const cycle = Math.floor(i / COLOR_PALETTE.length);
		const base = COLOR_PALETTE[paletteIndex];

		if (cycle === 0) return base;

		const lightnessShift = cycle * 12;
		return base.replace(/(\d+)%\)$/, (_, l) => `${Math.min(Number(l) + lightnessShift, 85)}%)`);
	});
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const short = /^#?([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
	if (short) {
		return {
			r: Number.parseInt(short[1] + short[1], 16),
			g: Number.parseInt(short[2] + short[2], 16),
			b: Number.parseInt(short[3] + short[3], 16),
		};
	}
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: Number.parseInt(result[1], 16),
				g: Number.parseInt(result[2], 16),
				b: Number.parseInt(result[3], 16),
			}
		: null;
}
