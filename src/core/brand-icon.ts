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
 * Obsidian copies the registered SVG when it creates the settings sidebar row.
 * Finish registration before adding the tab, or that row keeps an empty placeholder.
 * Cached bytes avoid a network wait; cold requests have the shared loader's timeout.
 */
export async function registerPrismaLogoIcon(): Promise<() => void> {
	const blob = await loadCachedImage(PRISMA_LOGO_SRC);
	const objectUrl = blob ? URL.createObjectURL(blob) : null;
	addIcon(PRISMA_LOGO_ICON, objectUrl ? brandIconSvg(objectUrl) : "<g/>");
	return () => {
		if (objectUrl) URL.revokeObjectURL(objectUrl);
	};
}
