import { buildManagerToolbarStyles } from "../../widgets/manager-list/manager-toolbar.styles";

/**
 * Section-only styles for the customizable context-menu item manager modal.
 * Row, grip, arrow, label, button, and edit-form styles are injected by the
 * shared `ManagerRow` / `ManagerEditForm` components — keep them out of here
 * to avoid double-styling.
 */
export function buildCustomizableMenuStyles(prefix: string): string {
	const p = prefix;
	return `
.modal.${p}item-manager-modal {
	width: 480px;
}

.modal.${p}item-manager-modal .modal-title {
	text-align: center;
}

.${p}modal-search {
	margin-bottom: 8px;
}

.${p}modal-search-input {
	width: 100%;
	padding: 8px 12px;
	font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	color: var(--text-normal);
}

.${p}modal-search-input:focus {
	border-color: var(--interactive-accent);
	outline: none;
}

.${p}modal-search-input::placeholder {
	color: var(--text-faint);
}

.${p}item-manager-section {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.${p}item-manager-section + .${p}item-manager-section {
	margin-top: 12px;
}

.${p}item-manager-section-header {
	font-size: var(--font-ui-small);
	font-weight: 600;
	color: var(--text-muted);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding: 4px 4px 2px;
}

.${p}item-manager-search-empty {
	color: var(--text-muted);
	padding: 12px;
	text-align: center;
}

${buildManagerToolbarStyles(p, "item-manager")}
`;
}
