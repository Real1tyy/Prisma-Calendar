import { memo } from "react";

import { cls, tid } from "../../constants";

// The brand mark ships as vector rather than as the raster in the docs-site's
// `static/brand/`: an Obsidian plugin bundles to one `main.js`, so a PNG could only
// travel as a data URI — 366 KB added to every load, for a mark that renders in under
// a kilobyte here and stays crisp at any DPI.
// Namespaced so the gradient cannot collide with another plugin's defs in the shared
// settings DOM, where every plugin's tab lives under the same document.
const GRADIENT_ID = "prisma-logo-gradient";

export const PrismaLogo = memo(function PrismaLogo() {
	return (
		// Decorative: the pitch line beside it already names Prisma, so announcing the
		// mark again would only repeat it.
		<svg
			className={cls("settings-hero-logo")}
			data-testid={tid("settings-hero-logo")}
			viewBox="0 0 64 64"
			xmlns="http://www.w3.org/2000/svg"
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0%" stopColor="#ef6a8e" />
					<stop offset="50%" stopColor="#9b53c4" />
					<stop offset="100%" stopColor="#5b46e0" />
				</linearGradient>
			</defs>

			<rect x="2" y="10" width="60" height="52" rx="13" fill={`url(#${GRADIENT_ID})`} />

			{/* Binder rings, drawn over the card's top edge. `y` clears the 4px stroke's
			    own half-width, which is centred on the path and would otherwise be
			    clipped by the viewBox. */}
			<rect x="14" y="3" width="10" height="17" rx="5" fill="none" stroke="#fff" strokeWidth="4" />
			<rect x="40" y="3" width="10" height="17" rx="5" fill="none" stroke="#fff" strokeWidth="4" />

			{/* The "P": a stem plus a stroked bowl, so the counter stays a true hole.
			    Stroke geometry puts the glyph at x 18–46 — centred on the card's 32. */}
			<rect x="18" y="20" width="8" height="36" rx="1" fill="#fff" />
			<path d="M22 24 H34 a8 8 0 0 1 0 16 H22" fill="none" stroke="#fff" strokeWidth="8" />
		</svg>
	);
});
