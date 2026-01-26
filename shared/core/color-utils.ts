import { colord } from "colord";

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
