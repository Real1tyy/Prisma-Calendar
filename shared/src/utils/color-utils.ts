import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import namesPlugin from "colord/plugins/names";

// names: settings colors pass ColorSchema (any CSS.supports color), so named
// colors like "yellow" must parse or the contrast pick silently degrades.
extend([a11yPlugin, namesPlugin]);

export interface RgbColor {
	r: number;
	g: number;
	b: number;
}

/**
 * Picks the text color to render on the background, by WCAG contrast ratio.
 * RGB distance is the wrong axis for this: yellow is far from white in RGB
 * space yet nearly as luminous, so white text on it is unreadable
 * (contrast ≈ 1.07:1). Falls back to `primary` when the background can't be
 * parsed.
 *
 * With `minContrast`, `primary` wins whenever it meets that floor — the
 * alternative is a readability fallback, not a competitor (a bare argmax
 * flips mid-tone backgrounds like pure red where the primary is perfectly
 * readable). Without it, the higher-contrast color wins; ties prefer primary.
 */
export function pickReadableTextColor(
	backgroundColor: string,
	primary: string,
	alternative: string,
	minContrast?: number
): string {
	const background = colord(backgroundColor);
	if (!background.isValid()) return primary;
	const primaryContrast = background.contrast(primary);
	if (minContrast !== undefined && primaryContrast >= minContrast) return primary;
	return primaryContrast >= background.contrast(alternative) ? primary : alternative;
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

export function buildColorGradient(colors: string[]): string {
	const segmentSize = 100 / colors.length;
	const stops = colors.map((color, i) => `${color} ${i * segmentSize}%, ${color} ${(i + 1) * segmentSize}%`).join(", ");
	return `linear-gradient(90deg, ${stops})`;
}

export function hexToRgb(hex: string): RgbColor | null {
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
