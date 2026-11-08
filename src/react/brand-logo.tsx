import { AppContext, ImageLightbox } from "@real1ty/obsidian-plugins-react";
import { Scope } from "obsidian";
import { memo, useCallback, useContext, useEffect, useState } from "react";

import { cls, tid } from "../constants";

const LABEL = "Prisma Calendar logo";

// Namespaced so the gradient cannot collide with another plugin's defs — every
// plugin's settings tab lives under one document, where `<defs>` ids are global.
const GRADIENT_ID = "prisma-logo-gradient";

// The mark is authored as markup rather than JSX so that one string is both what
// renders inline and what the lightbox enlarges; a second, JSX copy of the same
// geometry is exactly the kind of duplicate that drifts.
//
// `gradientUnits="userSpaceOnUse"` makes every shape sample ONE sweep across the
// whole mark — with the default object-bounding-box units each ring would restart
// the gradient inside its own 10×17 box and come out a different colour from the
// card beneath it.
//
// The binder rings are painted BEFORE the card so the card covers their lower
// halves. Drawn after, their white stroke runs across the card's top edge and —
// at the sizes this renders (34px in the settings header) — reads as two white
// blobs rather than as rings.
const PRISMA_LOGO_SVG = [
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
	`<defs><linearGradient id="${GRADIENT_ID}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="64" y2="64">`,
	'<stop offset="0%" stop-color="#ef6a8e"/>',
	'<stop offset="50%" stop-color="#9b53c4"/>',
	'<stop offset="100%" stop-color="#5b46e0"/>',
	"</linearGradient></defs>",
	`<rect x="14" y="3" width="10" height="17" rx="5" fill="url(#${GRADIENT_ID})" stroke="#fff" stroke-width="2.5"/>`,
	`<rect x="40" y="3" width="10" height="17" rx="5" fill="url(#${GRADIENT_ID})" stroke="#fff" stroke-width="2.5"/>`,
	`<rect x="2" y="10" width="60" height="52" rx="13" fill="url(#${GRADIENT_ID})"/>`,
	// The "P": a stem plus a stroked bowl, so the counter stays a true hole.
	// Stroke geometry puts the glyph at x 18–46 — centred on the card's 32.
	'<rect x="18" y="20" width="8" height="36" rx="1" fill="#fff"/>',
	'<path d="M22 24 H34 a8 8 0 0 1 0 16 H22" fill="none" stroke="#fff" stroke-width="8"/>',
	"</svg>",
].join("");

/** The mark as a data URL — vector, so it stays crisp at any size the lightbox picks. */
export const PRISMA_LOGO_SRC = `data:image/svg+xml,${encodeURIComponent(PRISMA_LOGO_SVG)}`;

interface PrismaLogoProps {
	/** Placement class supplying the size — the base class sets none. */
	className?: string | undefined;
}

export const PrismaLogo = memo(function PrismaLogo({ className }: PrismaLogoProps) {
	const [enlarged, setEnlarged] = useState(false);
	const close = useCallback(() => setEnlarged(false), []);
	// Nullable on purpose: the RTL suite and the preview tool render this component
	// with no Obsidian app around it, and the keymap guard below is the only thing
	// that needs one.
	const app = useContext(AppContext);

	useEffect(() => {
		if (!enlarged || app === null) return;
		// Obsidian's Settings window closes on Escape through its KEYMAP, not through a
		// DOM listener — so the lightbox's own document-level Escape guard cannot stop
		// it, and dismissing the preview would take the whole settings screen with it.
		// A pushed scope sits ahead of that handler: close the preview, swallow the key.
		// (Caught by the e2e spec, which asserts the settings tab survives the Escape.)
		const scope = new Scope(app.scope);
		scope.register([], "Escape", () => {
			close();
			return false;
		});
		app.keymap.pushScope(scope);
		return () => app.keymap.popScope(scope);
	}, [enlarged, app, close]);

	return (
		<>
			<button
				type="button"
				className={className ? `${cls("logo")} ${className}` : cls("logo")}
				data-testid={tid("logo")}
				aria-label={LABEL}
				title={LABEL}
				onClick={() => setEnlarged(true)}
			>
				<img src={PRISMA_LOGO_SRC} alt="" />
			</button>
			{enlarged && <ImageLightbox src={PRISMA_LOGO_SRC} label={LABEL} onClose={close} />}
		</>
	);
});
