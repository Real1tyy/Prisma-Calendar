import { injectStyleSheet } from "../styles/inject";

function buildTabStyles(p: string): string {
	return `
.${p}tab-bar {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 2px;
	margin: 0 4px;
	border-radius: 8px;
	background: var(--background-modifier-hover);
	flex-shrink: 0;
}
.${p}tab {
	padding: 4px 12px;
	font-size: var(--font-ui-smaller);
	font-weight: 500;
	color: var(--text-muted);
	background: none;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
	box-shadow: none;
	white-space: nowrap;
	line-height: 1.4;
}
.${p}tab:hover {
	color: var(--text-normal);
	background: hsla(var(--color-accent-hsl), 0.08);
}
.${p}tab-active {
	color: var(--text-on-accent);
	background: var(--interactive-accent);
	font-weight: 600;
	box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.${p}tab-active:hover {
	color: var(--text-on-accent);
	background: var(--interactive-accent-hover);
}
.${p}tab-content {
	flex: 1;
	overflow-y: auto;
	min-height: 0;
}
.${p}tab-panel {
	padding: 0;
	height: 100%;
}
.${p}tab-panel-hidden {
	display: none;
}
.${p}tab-settings {
	padding: 4px 8px;
	color: var(--text-faint);
	opacity: 0.5;
}
.${p}tab-settings:hover {
	opacity: 1;
	color: var(--text-normal);
}
.${p}tab-settings svg {
	width: 12px;
	height: 12px;
}
.modal:has(.${p}tab-rename-modal) {
	width: 300px;
}
.modal:has(.${p}tab-rename-modal) .modal-title {
	text-align: center;
}
.${p}tab-rename-input {
	width: 100%;
	padding: 8px 12px;
	font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background: var(--background-secondary);
	color: var(--text-normal);
	margin-bottom: 12px;
}
.${p}tab-rename-input:focus {
	border-color: var(--interactive-accent);
	outline: none;
}
.${p}tab-rename-actions {
	display: flex;
	gap: 8px;
	justify-content: flex-end;
}
.${p}tab-rename-btn {
	padding: 6px 16px;
	font-size: var(--font-ui-small);
	font-weight: 600;
	border-radius: 6px;
	cursor: pointer;
	border: none;
	box-shadow: none;
}
.${p}tab-rename-btn-reset {
	background: var(--background-secondary);
	color: var(--text-muted);
	border: 1px solid var(--background-modifier-border);
}
.${p}tab-rename-btn-save {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}
.modal:has(.${p}tab-manager-modal) {
	width: 420px;
}
.modal:has(.${p}tab-manager-modal) .modal-title {
	text-align: center;
}
.${p}tab-manager-list {
	display: flex;
	flex-direction: column;
	gap: 4px;
}
.${p}tab-manager-row {
	display: flex;
	align-items: center;
	gap: 6px;
	padding: 8px 10px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	transition: opacity 150ms ease, border-color 150ms ease, background 150ms ease;
}
.${p}tab-manager-row[draggable="true"] {
	cursor: grab;
}
.${p}tab-manager-row-hidden {
	opacity: 0.5;
}
.${p}tab-manager-row-dragging {
	opacity: 0.4;
}
.${p}tab-manager-row-dragover {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.06);
}
.${p}tab-manager-drag {
	display: flex;
	align-items: center;
	min-width: 18px;
	flex-shrink: 0;
}
.${p}tab-manager-grip {
	color: var(--text-faint);
	display: flex;
	align-items: center;
}
.${p}tab-manager-grip svg {
	width: 14px;
	height: 14px;
}
.${p}tab-manager-arrows {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 22px;
	flex-shrink: 0;
}
.${p}tab-manager-drag-btn {
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
.${p}tab-manager-drag-btn:hover {
	color: var(--text-normal);
	background: var(--background-modifier-hover);
}
.${p}tab-manager-drag-btn svg {
	width: 14px;
	height: 14px;
}
.${p}tab-manager-label {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
}
.${p}tab-manager-label-text {
	font-size: var(--font-ui-medium);
	font-weight: 500;
	color: var(--text-normal);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.${p}tab-manager-label-original {
	font-size: 0.7em;
	color: var(--text-faint);
	font-style: italic;
	white-space: nowrap;
}
.${p}tab-manager-controls {
	display: flex;
	gap: 4px;
	flex-shrink: 0;
}
.${p}tab-manager-btn {
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
.${p}tab-manager-btn:hover:not([disabled]) {
	color: var(--text-normal);
	border-color: var(--background-modifier-border);
}
.${p}tab-manager-btn[disabled] {
	opacity: 0.3;
	cursor: not-allowed;
}
.${p}tab-manager-btn svg {
	width: 14px;
	height: 14px;
}
.${p}tab-manager-settings-toggle {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	margin-bottom: 8px;
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}
.${p}tab-group {
	display: inline-flex;
	align-items: center;
	gap: 0;
	padding-right: 6px;
}
.${p}tab-group-chevron {
	display: inline-flex;
	align-items: center;
	opacity: 0.4;
	margin-left: 4px;
	transition: opacity 150ms ease;
}
.${p}tab-group:hover .${p}tab-group-chevron {
	opacity: 0.9;
}
.${p}tab-group-chevron svg {
	width: 10px;
	height: 10px;
}
.${p}tab-manager-group-toggle {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	background: none;
	border: none;
	border-radius: 3px;
	color: var(--text-faint);
	cursor: pointer;
	padding: 0;
	box-shadow: none;
	flex-shrink: 0;
	transition: color 100ms ease;
}
.${p}tab-manager-group-toggle:hover {
	color: var(--text-normal);
}
.${p}tab-manager-group-toggle svg {
	width: 14px;
	height: 14px;
}
.${p}tab-manager-children {
	display: flex;
	flex-direction: column;
	gap: 3px;
	margin-left: 24px;
	padding-left: 8px;
	border-left: 2px solid var(--background-modifier-border);
}
.${p}tab-manager-children .${p}tab-manager-row {
	background: var(--background-primary);
	padding: 6px 10px;
	border-radius: 6px;
}
.${p}tab-manager-children .${p}tab-manager-row-hidden {
	opacity: 0.5;
}
.${p}tab-manager-children .${p}tab-manager-row-dragging {
	opacity: 0.4;
}
.${p}tab-manager-children .${p}tab-manager-row-dragover {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.06);
}
`;
}

export function injectTabStyles(prefix: string): void {
	injectStyleSheet(`${prefix}tab-styles`, buildTabStyles(prefix));
}
