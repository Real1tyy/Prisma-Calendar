import { injectStyleSheet } from "../../utils/styles/inject";

function buildContextMenuStyles(p: string): string {
	return `
/* ─── Item Manager Modal ─── */

.modal:has(.${p}item-manager-modal) {
	width: 420px;
}

.modal:has(.${p}item-manager-modal) .modal-title {
	text-align: center;
}

.${p}item-manager-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.${p}item-manager-row {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 10px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	transition: opacity 150ms ease, border-color 150ms ease, background 150ms ease;
	flex-wrap: wrap;
}

.${p}item-manager-row[draggable="true"] {
	cursor: grab;
}

.${p}item-manager-row-hidden {
	opacity: 0.5;
}

.${p}item-manager-row-dragging {
	opacity: 0.4;
}

.${p}item-manager-row-dragover {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.06);
}

.${p}item-manager-drag {
	display: flex;
	align-items: center;
	min-width: 18px;
	flex-shrink: 0;
}

.${p}item-manager-grip {
	color: var(--text-faint);
	display: flex;
	align-items: center;
}

.${p}item-manager-grip svg {
	width: 14px;
	height: 14px;
}

.${p}item-manager-arrows {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 22px;
	flex-shrink: 0;
}

.${p}item-manager-drag-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 16px;
	background: none;
	border: none;
	border-radius: 3px;
	color: var(--text-faint);
	cursor: pointer;
	padding: 0;
	box-shadow: none;
	transition: color 100ms ease, background 100ms ease;
}

.${p}item-manager-drag-btn:hover {
	color: var(--text-normal);
	background: var(--background-modifier-hover);
}

.${p}item-manager-drag-btn svg {
	width: 14px;
	height: 14px;
}

.${p}item-manager-label {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.${p}item-manager-icon {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.${p}item-manager-icon svg {
	width: 16px;
	height: 16px;
}

.${p}item-manager-label-text {
	font-size: var(--font-ui-medium);
	font-weight: 500;
	color: var(--text-normal);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.${p}item-manager-label-original {
	font-size: 0.7em;
	color: var(--text-faint);
	font-style: italic;
	white-space: nowrap;
}

.${p}item-manager-controls {
	display: flex;
	gap: 4px;
	flex-shrink: 0;
}

.${p}item-manager-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: none;
	border: 1px solid transparent;
	border-radius: 6px;
	color: var(--text-faint);
	cursor: pointer;
	padding: 0;
	box-shadow: none;
	transition: color 120ms ease, border-color 120ms ease;
}

.${p}item-manager-btn:hover:not([disabled]) {
	color: var(--text-normal);
	border-color: var(--background-modifier-border);
}

.${p}item-manager-btn[disabled] {
	opacity: 0.3;
	cursor: not-allowed;
}

.${p}item-manager-btn svg {
	width: 14px;
	height: 14px;
}

/* ─── Item Manager Sections ─── */

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

/* ─── Item Manager Edit Form ─── */

.${p}item-manager-edit-form {
	width: 100%;
	padding: 8px 0 0 26px;
	border-top: 1px solid var(--background-modifier-border);
	margin-top: 6px;
}
`;
}

export function injectContextMenuStyles(prefix: string): void {
	injectStyleSheet(`${prefix}context-menu-styles`, buildContextMenuStyles(prefix));
}
