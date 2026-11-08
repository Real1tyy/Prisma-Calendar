import { loadCachedImage } from "@real1ty/obsidian-plugins-react";
import { addIcon } from "obsidian";

import { PRISMA_LOGO_SRC } from "../constants";

/** The brand logo as an Obsidian icon — shown beside "Prisma Calendar" in the settings sidebar. */
export const PRISMA_LOGO_ICON = "prisma-calendar-logo";

/** `addIcon` content lives in a 0 0 100 100 viewBox; the raster is contained in it, unstretched. */
export function brandIconSvg(href: string): string {
	return `<image href="${href}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>`;
}

/**
 * Register only cached/fetched bytes: a remote SVG image would start a second network
 * request even when the shared cache already has an offline copy.
 */
export function registerPrismaLogoIcon(): () => void {
	addIcon(PRISMA_LOGO_ICON, "<g/>");
	let objectUrl: string | null = null;
	let disposed = false;
	void loadCachedImage(PRISMA_LOGO_SRC).then((blob) => {
		if (!blob || disposed) return;
		objectUrl = URL.createObjectURL(blob);
		addIcon(PRISMA_LOGO_ICON, brandIconSvg(objectUrl));
	});
	return () => {
		disposed = true;
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	};
}
