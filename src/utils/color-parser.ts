export function parseColor(color: string): { h: number; s: number; l: number } | null {
	if (color.startsWith("hsl")) {
		const match = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/);
		if (match) {
			return {
				h: parseInt(match[1], 10),
				s: parseInt(match[2], 10),
				l: parseInt(match[3], 10),
			};
		}
	} else if (color.startsWith("#")) {
		return hexToHsl(color);
	} else if (color.startsWith("rgb")) {
		const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
		if (match) {
			const r = parseInt(match[1], 10);
			const g = parseInt(match[2], 10);
			const b = parseInt(match[3], 10);
			return rgbToHsl(r, g, b);
		}
	}
	return null; // Basic color names not supported for now
}

export function hslToString(hsl: { h: number; s: number; l: number }): string {
	return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
	let r = 0,
		g = 0,
		b = 0;
	if (hex.length === 4) {
		r = parseInt(hex[1] + hex[1], 16);
		g = parseInt(hex[2] + hex[2], 16);
		b = parseInt(hex[3] + hex[3], 16);
	} else if (hex.length === 7) {
		r = parseInt(hex.substring(1, 3), 16);
		g = parseInt(hex.substring(3, 5), 16);
		b = parseInt(hex.substring(5, 7), 16);
	}
	return rgbToHsl(r, g, b);
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return {
		h: Math.round(h * 360),
		s: Math.round(s * 100),
		l: Math.round(l * 100),
	};
}
