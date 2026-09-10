/**
 * The window row every preserved form gets: it is lifted out of the content flow
 * into the modal's own title row, immediately left of Obsidian's close button,
 * because these controls act on the window rather than on the form.
 *
 * One scope for every form (`preserved-form`) rather than one per form name —
 * only one modal is open at a time, and a literal scope is what keeps the class
 * and testid names statically discoverable.
 */
export function buildPreservedFormStyles(p: string): string {
	return `
.${p}preserved-form-window-actions {
	align-items: center;
	display: flex;
	gap: 0.25rem;
	position: absolute;
	right: 2.9rem;
	top: 0.55rem;
}
.modal button.${p}preserved-form-window-action {
	align-items: center;
	background: transparent;
	box-shadow: none;
	color: var(--text-muted);
	display: flex;
	font-size: var(--font-ui-smaller);
	line-height: 1;
	padding: 0.3rem 0.5rem;
}
.modal button.${p}preserved-form-window-action:hover {
	background: var(--background-modifier-hover);
	color: var(--text-normal);
}
`;
}
