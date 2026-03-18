import { injectStyleSheet } from "../styles/inject";

function buildPageHeaderStyles(p: string): string {
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

/* ─── Action Manager Modal ─── */

.modal:has(.${p}action-manager-modal) {
	width: 420px;
}

.modal:has(.${p}action-manager-modal) .modal-title {
	text-align: center;
}

.${p}action-manager-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.${p}action-manager-row {
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

.${p}action-manager-row[draggable="true"] {
	cursor: grab;
}

.${p}action-manager-row-hidden {
	opacity: 0.5;
}

.${p}action-manager-row-dragging {
	opacity: 0.4;
}

.${p}action-manager-row-dragover {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.06);
}

.${p}action-manager-drag {
	display: flex;
	align-items: center;
	min-width: 18px;
	flex-shrink: 0;
}

.${p}action-manager-grip {
	color: var(--text-faint);
	display: flex;
	align-items: center;
}

.${p}action-manager-grip svg {
	width: 14px;
	height: 14px;
}

.${p}action-manager-arrows {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 22px;
	flex-shrink: 0;
}

.${p}action-manager-drag-btn {
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

.${p}action-manager-drag-btn:hover {
	color: var(--text-normal);
	background: var(--background-modifier-hover);
}

.${p}action-manager-drag-btn svg {
	width: 14px;
	height: 14px;
}

.${p}action-manager-label {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}

.${p}action-manager-icon {
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.${p}action-manager-icon svg {
	width: 16px;
	height: 16px;
}

.${p}action-manager-label-text {
	font-size: var(--font-ui-medium);
	font-weight: 500;
	color: var(--text-normal);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.${p}action-manager-label-original {
	font-size: 0.7em;
	color: var(--text-faint);
	font-style: italic;
	white-space: nowrap;
}

.${p}action-manager-controls {
	display: flex;
	gap: 4px;
	flex-shrink: 0;
}

.${p}action-manager-btn {
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

.${p}action-manager-btn:hover:not([disabled]) {
	color: var(--text-normal);
	border-color: var(--background-modifier-border);
}

.${p}action-manager-btn[disabled] {
	opacity: 0.3;
	cursor: not-allowed;
}

.${p}action-manager-btn svg {
	width: 14px;
	height: 14px;
}

/* ─── Action Manager Edit Form ─── */

.${p}action-manager-edit-form {
	width: 100%;
	padding: 8px 0 0 26px;
	border-top: 1px solid var(--background-modifier-border);
	margin-top: 6px;
}

/* ─── Action Rename Modal ─── */

.modal:has(.${p}action-rename-modal) {
	width: 300px;
}

.modal:has(.${p}action-rename-modal) .modal-title {
	text-align: center;
}

.${p}action-rename-input {
	width: 100%;
	padding: 8px 12px;
	font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	color: var(--text-normal);
	margin-bottom: 12px;
}

.${p}action-rename-input:focus {
	border-color: var(--interactive-accent);
	outline: none;
}

.${p}action-rename-actions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
}

.${p}action-rename-btn {
	padding: 6px 16px;
	font-size: var(--font-ui-small);
	font-weight: 600;
	border-radius: 6px;
	cursor: pointer;
	border: none;
	box-shadow: none;
}

.${p}action-rename-btn-save {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}
`;
}

export function injectPageHeaderStyles(prefix: string): void {
	injectStyleSheet(`${prefix}page-header-styles`, buildPageHeaderStyles(prefix));
}
