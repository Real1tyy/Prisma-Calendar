/**
 * Single source of truth for "should the calendar render its mobile layout?".
 *
 * Mobile-ness is two orthogonal signals, not one width threshold:
 *   - **Platform / input model** — Obsidian's `Platform.isMobile` is true on
 *     phone and tablet apps *and* whenever `app.emulateMobile(true)` is active.
 *     This is the authentic "is this a mobile experience?" signal.
 *   - **Layout width** — a narrow desktop pane (e.g. the calendar pinned in a
 *     side dock) wants the compact layout even though it's a mouse user.
 *
 * The view treats both as mobile. See
 * docs/decisions/2026-05-21-mobile-responsiveness-strategy.md for the model and
 * the deferred refinements (per-pane container queries, tablet-specific layout).
 */

/** Width (CSS px) at or below which the compact mobile layout applies. */
export const MOBILE_BREAKPOINT_PX = 768;

export interface MobileLayoutInput {
	/** Obsidian's platform signal — pass `Platform.isMobile`. */
	isPlatformMobile: boolean;
	/** Available layout width in CSS px (typically `window.innerWidth`). */
	width: number;
	/** Width at or below which the narrow layout applies. Defaults to {@link MOBILE_BREAKPOINT_PX}. */
	breakpoint?: number;
}

export function shouldUseMobileLayout({
	isPlatformMobile,
	width,
	breakpoint = MOBILE_BREAKPOINT_PX,
}: MobileLayoutInput): boolean {
	return isPlatformMobile || width <= breakpoint;
}
