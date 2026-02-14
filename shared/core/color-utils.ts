import { colord } from "colord";

const VERY_CLOSE_SHADE_DISTANCE = 48;

/**
 * True when two colors are very close in shade (RGB distance).
 * Used to switch to alternative text color only when default text color
 * is nearly the same color as the event background.
 */
export function hasVeryCloseShade(foregroundColor: string, backgroundColor: string): boolean {
	const foreground = colord(foregroundColor);
	const background = colord(backgroundColor);
	if (!foreground.isValid() || !background.isValid()) return false;

	const fg = foreground.toRgb();
	const bg = background.toRgb();
	const distance = Math.sqrt(
		(fg.r - bg.r) * (fg.r - bg.r) + (fg.g - bg.g) * (fg.g - bg.g) + (fg.b - bg.b) * (fg.b - bg.b)
	);

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
