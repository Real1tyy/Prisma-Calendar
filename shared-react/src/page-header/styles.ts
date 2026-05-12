import { buildManagerRowStyles } from "../components/manager-row.styles";

export function buildPageHeaderStyles(p: string): string {
	return `
/* ─── Header Settings Button ─── */

.${p}header-settings {
	padding: 4px 8px;
	color: var(--text-faint);
	opacity: 0.5;
}

.${p}header-settings:hover {
	opacity: 1;
	color: var(--text-normal);
}

.${p}header-settings svg {
	width: 12px;
	height: 12px;
}

.${p}page-header-host {
	display: contents;
}

.${p}page-header-actions {
	display: contents;
}

/* ─── Action Manager Modal ─── */

.modal.${p}action-manager-modal,
.modal:has(.${p}action-manager-modal) {
	--modal-width: 560px;
	width: 560px;
}

.modal.${p}action-manager-modal .modal-title,
.modal:has(.${p}action-manager-modal) .modal-title {
	text-align: center;
}

.${p}action-manager-search {
	margin-bottom: 8px;
}

.${p}action-manager-search-input {
	width: 100%;
	padding: 8px 12px;
	font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	color: var(--text-normal);
}

.${p}action-manager-search-input:focus {
	border-color: var(--interactive-accent);
	outline: none;
}

.${p}action-manager-empty {
	text-align: center;
	padding: 16px;
	color: var(--text-faint);
	font-size: var(--font-ui-medium);
}

/* ─── Shared row scaffolding (list/row/drag/grip/arrows/label/controls) ─── */
${buildManagerRowStyles(p, "action-manager")}

/* ─── Action Manager Edit Form ─── */

.${p}action-manager-edit-form {
	width: 100%;
	padding: 8px 0 0 26px;
	border-top: 1px solid var(--background-modifier-border);
	margin-top: 6px;
}
`;
}
