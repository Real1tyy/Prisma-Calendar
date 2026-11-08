import { AppContext, ImageLightbox } from "@real1ty/obsidian-plugins-react";
import { Scope } from "obsidian";
import { memo, useCallback, useContext, useEffect, useState } from "react";

import { cls, DOCS_BASE_URL, tid } from "../constants";

const LABEL = "Prisma Calendar logo";

// The real brand raster — the same `docs-site/static/brand/prisma_logo.png` the docs
// site, the README and showrunner's release cards use — served from the deployed docs
// site rather than inlined. Inlining it as base64 adds ~476 KB to a main.js already
// near Obsidian Sync Standard's 5 MB cap; this is the pattern the Pro feature previews
// follow for the same reason (see `core/pro-feature-previews.ts`).
export const PRISMA_LOGO_SRC = `${DOCS_BASE_URL}/brand/prisma_logo.png`;

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
				{/* alt="" — the button carries the name; offline, an empty alt also keeps
				    a failed load from painting a broken-image glyph in the header. */}
				<img src={PRISMA_LOGO_SRC} alt="" />
			</button>
			{enlarged && <ImageLightbox src={PRISMA_LOGO_SRC} label={LABEL} onClose={close} />}
		</>
	);
});
