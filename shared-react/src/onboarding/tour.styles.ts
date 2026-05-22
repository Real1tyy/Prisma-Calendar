import type { Options } from "react-joyride";

/** Above Obsidian's workspace + popovers, so the spotlight overlay sits on top. */
export const TOUR_Z_INDEX = 9999;

/**
 * react-joyride theming expressed with Obsidian CSS variables, so the overlay,
 * spotlight, and arrow match light/dark themes with zero vendored CSS. The
 * tooltip body itself is rendered by {@link TourTooltip}; these options cover the
 * chrome joyride still draws (backdrop, spotlight cutout, arrow) plus behaviour.
 */
export function buildTourJoyrideOptions(): Partial<Options> {
	return {
		arrowColor: "var(--background-primary)",
		backgroundColor: "var(--background-primary)",
		primaryColor: "var(--interactive-accent)",
		textColor: "var(--text-normal)",
		overlayColor: "rgba(0, 0, 0, 0.5)",
		spotlightRadius: 8,
		zIndex: TOUR_Z_INDEX,
		width: 380,
		skipBeacon: true,
		showProgress: false,
		disableFocusTrap: true,
		closeButtonAction: "skip",
		overlayClickAction: false,
		targetWaitTimeout: 4000,
	};
}

/**
 * Self-contained tooltip stylesheet injected via `useScopedStyles("tour", …)`.
 * Keyed off the resolved CSS prefix so every adopting plugin gets the same
 * native look without copying any SCSS.
 */
export function buildTourStyles(p: string): string {
	return `
.${p}tour-tooltip {
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	width: 100%;
	max-width: 380px;
	padding: 1rem 1.1rem;
	border: 1px solid var(--background-modifier-border);
	border-radius: 12px;
	background: var(--background-primary);
	color: var(--text-normal);
	box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
}

.${p}tour-title {
	margin: 0;
	padding-right: 1.5rem;
	font-size: 1.05rem;
	font-weight: 700;
	line-height: 1.25;
	color: var(--text-normal);
}

.${p}tour-body {
	margin: 0;
	font-size: 0.92rem;
	line-height: 1.5;
	color: var(--text-muted);
}

.${p}tour-body a {
	color: var(--interactive-accent);
}

.${p}tour-close {
	position: absolute;
	top: 0.5rem;
	right: 0.5rem;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.75rem;
	height: 1.75rem;
	padding: 0;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--text-muted);
	font-size: 1.1rem;
	line-height: 1;
	cursor: pointer;
	box-shadow: none;
}

.${p}tour-close:hover {
	background: var(--background-modifier-hover);
	color: var(--text-normal);
}

.${p}tour-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	margin-top: 0.25rem;
}

.${p}tour-progress {
	font-size: 0.8rem;
	color: var(--text-faint);
	font-variant-numeric: tabular-nums;
}

.${p}tour-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	margin-left: auto;
}

.${p}tour-btn {
	padding: 0.4rem 0.9rem;
	font-size: 0.9rem;
	font-weight: 600;
	border-radius: 8px;
	cursor: pointer;
}

.${p}tour-btn-skip {
	background: transparent;
	color: var(--text-muted);
	box-shadow: none;
}

.${p}tour-btn-skip:hover {
	color: var(--text-normal);
}
`;
}
