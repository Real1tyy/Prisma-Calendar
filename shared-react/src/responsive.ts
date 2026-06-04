/**
 * Viewport-width breakpoint for `shared-react` components that change layout on
 * small screens. Mirrors each plugin's local `MOBILE_BREAKPOINT_PX` and the
 * `@media (max-width: …)` SCSS partials — keep them in sync. (A single shared
 * source of truth is the natural cleanup but is blocked in worktrees: a new
 * `shared/` export isn't visible to consumers that resolve `shared` from main's
 * built dist — do it directly on main. See the mobile spec §6.4.)
 *
 * See docs/decisions/2026-05-21-mobile-responsiveness-strategy.md for the model.
 */
export const MOBILE_BREAKPOINT_PX = 768;

/** Media query matching phone / narrow-pane widths (at or below the breakpoint). */
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT_PX}px)`;
