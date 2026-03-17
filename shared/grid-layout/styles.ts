import { injectStyleSheet } from "../styles/inject";

function buildGridStyles(p: string): string {
	return `
.${p}grid {
	position: relative;
	display: grid;
	grid-template-columns: var(--grid-columns, repeat(2, 1fr));
	grid-template-rows: var(--grid-rows, repeat(2, 1fr));
	gap: var(--grid-gap, 12px);
	padding: 12px;
	width: 100%;
	height: 100%;
}
.${p}grid-cell {
	grid-row: var(--cell-row);
	grid-column: var(--cell-col);
	overflow: hidden;
	min-height: 0;
	min-width: 0;
	display: flex;
	flex-direction: column;
}
.${p}grid-cell-divider {
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	padding: 12px;
	background: var(--background-secondary);
}
.${p}grid-cell-enlargeable {
	position: relative;
}
.${p}grid-cell-enlarge {
	position: absolute;
	top: 8px;
	right: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: var(--background-primary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	color: var(--text-muted);
	cursor: pointer;
	opacity: 0;
	transition: opacity 150ms ease, color 150ms ease, border-color 150ms ease;
	box-shadow: none;
	padding: 0;
	z-index: 1;
}
.${p}grid-cell-enlargeable:hover .${p}grid-cell-enlarge {
	opacity: 1;
}
.${p}grid-cell-enlarge:hover {
	color: var(--text-normal);
	border-color: var(--interactive-accent);
}
.${p}grid-cell-enlarge svg {
	width: 14px;
	height: 14px;
}
.${p}grid-cell-swap {
	position: absolute;
	top: 8px;
	left: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: var(--background-primary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	color: var(--text-muted);
	cursor: pointer;
	opacity: 0;
	transition: opacity 150ms ease, color 150ms ease, border-color 150ms ease;
	box-shadow: none;
	padding: 0;
	z-index: 1;
}
.${p}grid-cell-enlargeable:hover .${p}grid-cell-swap {
	opacity: 1;
}
.${p}grid-cell-swap:hover {
	color: var(--text-normal);
	border-color: var(--interactive-accent);
}
.${p}grid-cell-swap svg {
	width: 14px;
	height: 14px;
}
.modal:has(.${p}grid-picker-modal) {
	width: 340px;
}
.${p}grid-picker-modal {
	padding: 4px 0;
}
.${p}grid-picker-list {
	display: flex;
	flex-direction: column;
	gap: 6px;
}
.${p}grid-picker-item {
	display: flex;
	align-items: center;
	width: 100%;
	padding: 10px 16px;
	text-align: left;
	font-size: var(--font-ui-medium);
	font-weight: 500;
	color: var(--text-normal);
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	cursor: pointer;
	box-shadow: none;
	transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}
.${p}grid-picker-item:hover {
	background: hsla(var(--color-accent-hsl), 0.1);
	border-color: var(--interactive-accent);
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}
.${p}grid-picker-item-current {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.08);
	cursor: default;
}
.${p}grid-picker-item-current:hover {
	background: hsla(var(--color-accent-hsl), 0.08);
	box-shadow: none;
}
.${p}grid-picker-item-used {
	opacity: 0.6;
}
.${p}grid-picker-item-used:hover {
	opacity: 1;
}
.${p}grid-picker-item-label {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1;
}
.${p}grid-picker-item-badge {
	font-size: 0.7em;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	padding: 2px 8px;
	border-radius: 4px;
	background: hsla(var(--color-accent-hsl), 0.15);
	color: var(--text-accent);
	line-height: 1.3;
}
.${p}grid-edit-btn {
	position: absolute;
	top: -4px;
	right: -4px;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 30px;
	height: 30px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	color: var(--text-muted);
	cursor: pointer;
	opacity: 0;
	transition: opacity 150ms ease, color 150ms ease, border-color 150ms ease;
	box-shadow: none;
	padding: 0;
	z-index: 2;
}
.${p}grid:hover .${p}grid-edit-btn {
	opacity: 1;
}
.${p}grid-edit-btn:hover {
	color: var(--text-normal);
	border-color: var(--interactive-accent);
}
.${p}grid-edit-btn svg {
	width: 15px;
	height: 15px;
}
.modal:has(.${p}grid-editor-modal) {
	width: 480px;
}
.modal:has(.${p}grid-editor-modal) .modal-title {
	text-align: center;
}
.${p}grid-editor-modal {
	padding: 4px 0;
}
.${p}grid-editor-controls {
	display: flex;
	gap: 16px;
	justify-content: center;
	margin-bottom: 16px;
}
.${p}grid-editor-dim-row {
	display: flex;
	align-items: center;
	gap: 8px;
}
.${p}grid-editor-dim-label {
	font-size: var(--font-ui-small);
	font-weight: 600;
	color: var(--text-muted);
	text-transform: uppercase;
	letter-spacing: 0.04em;
	min-width: 60px;
}
.${p}grid-editor-dim-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	color: var(--text-muted);
	cursor: pointer;
	box-shadow: none;
	padding: 0;
	transition: color 120ms ease, border-color 120ms ease;
}
.${p}grid-editor-dim-btn:hover:not([disabled]) {
	color: var(--text-normal);
	border-color: var(--interactive-accent);
}
.${p}grid-editor-dim-btn[disabled] {
	opacity: 0.3;
	cursor: not-allowed;
}
.${p}grid-editor-dim-btn svg {
	width: 14px;
	height: 14px;
}
.${p}grid-editor-dim-value {
	font-size: var(--font-ui-medium);
	font-weight: 700;
	color: var(--text-normal);
	min-width: 20px;
	text-align: center;
}
.${p}grid-editor-preview {
	display: grid;
	grid-template-columns: repeat(var(--editor-columns, 2), 1fr);
	grid-template-rows: repeat(var(--editor-rows, 2), 1fr);
	gap: 6px;
	margin-bottom: 16px;
	min-height: 200px;
}
.${p}grid-editor-cell {
	grid-row: var(--editor-cell-row);
	grid-column: var(--editor-cell-col);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 12px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	min-height: 50px;
}
.${p}grid-editor-cell-label {
	font-size: var(--font-ui-small);
	font-weight: 500;
	color: var(--text-normal);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.${p}grid-editor-cell-remove {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	flex-shrink: 0;
	background: none;
	border: 1px solid transparent;
	border-radius: 4px;
	color: var(--text-faint);
	cursor: pointer;
	box-shadow: none;
	padding: 0;
	transition: color 120ms ease, border-color 120ms ease;
}
.${p}grid-editor-cell-remove:hover {
	color: var(--text-error);
	border-color: var(--text-error);
}
.${p}grid-editor-cell-remove svg {
	width: 14px;
	height: 14px;
}
.${p}grid-editor-empty {
	grid-row: var(--editor-cell-row);
	grid-column: var(--editor-cell-col);
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2px dashed var(--background-modifier-border);
	border-radius: 8px;
	min-height: 50px;
}
.${p}grid-editor-empty-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	background: none;
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	color: var(--text-faint);
	cursor: pointer;
	box-shadow: none;
	padding: 0;
	transition: color 120ms ease, border-color 120ms ease, background 120ms ease;
}
.${p}grid-editor-empty-btn:hover {
	color: var(--text-normal);
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.08);
}
.${p}grid-editor-empty-btn svg {
	width: 16px;
	height: 16px;
}
.${p}grid-editor-actions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
}
.${p}grid-editor-btn {
	padding: 8px 20px;
	font-size: var(--font-ui-small);
	font-weight: 600;
	border-radius: 6px;
	cursor: pointer;
	border: none;
	box-shadow: none;
	transition: opacity 120ms ease;
}
.${p}grid-editor-btn:hover {
	opacity: 0.85;
}
.${p}grid-editor-btn-cancel {
	background: var(--background-secondary);
	color: var(--text-muted);
	border: 1px solid var(--background-modifier-border);
}
.${p}grid-editor-btn-apply {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}
.modal:has(.${p}grid-enlarge-modal) .modal-content {
	display: flex;
	flex-direction: column;
	min-height: 0;
	flex: 1;
}
`;
}

export function injectGridStyles(prefix: string): void {
	injectStyleSheet(`${prefix}grid-styles`, buildGridStyles(prefix));
}
