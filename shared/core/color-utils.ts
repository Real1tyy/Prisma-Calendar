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
 * Generates an array of evenly distributed HSL colors for visualization.
 * Uses the HSL color space to create visually distinct colors by distributing
 * them evenly around the color wheel.
 *
 * @param count - Number of colors to generate
 * @param saturation - Saturation percentage (0-100), defaults to 70
 * @param lightness - Lightness percentage (0-100), defaults to 60
 * @returns Array of HSL color strings
 */
export function generateColors(count: number, saturation = 70, lightness = 60): string[] {
	if (count <= 0) return [];
	const colors: string[] = [];
	for (let i = 0; i < count; i++) {
		const hue = (i * 360) / count;
		colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
	}
	return colors;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
	const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result
		? {
				r: Number.parseInt(result[1], 16),
				g: Number.parseInt(result[2], 16),
				b: Number.parseInt(result[3], 16),
			}
		: null;
}
