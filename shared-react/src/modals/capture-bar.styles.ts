/**
 * The capture bar floats above everything Obsidian draws, so it sits at the
 * bottom centre — out of the way of the content the user came here to
 * photograph — and borrows the modal shadow so it reads as part of the app
 * rather than an OS overlay.
 */
export function buildCaptureBarStyles(p: string): string {
	return `
.${p}capture-bar-root {
	align-items: center;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 999px;
	bottom: 2.5rem;
	box-shadow: var(--shadow-s);
	display: flex;
	gap: 0.75rem;
	left: 50%;
	padding: 0.5rem 0.75rem 0.5rem 1.1rem;
	position: fixed;
	transform: translateX(-50%);
	z-index: var(--layer-notice, 100);
}
.${p}capture-bar-hint {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
}
.${p}capture-bar-shutter {
	align-items: center;
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	display: flex;
	font-weight: 600;
	gap: 0.45rem;
}
.${p}capture-bar-shutter-dot {
	background: currentColor;
	border-radius: 50%;
	display: inline-block;
	height: 0.65rem;
	width: 0.65rem;
}
`;
}
