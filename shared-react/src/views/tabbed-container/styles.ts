import { buildManagerRowStyles } from "../../widgets/manager-list/manager-row.styles";
import { buildManagerToolbarStyles } from "../../widgets/manager-list/manager-toolbar.styles";

export function buildTabbedContainerStyles(p: string): string {
	return `
.${p}tabbed-container {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 0;
}
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
	display: inline-flex;
	align-items: center;
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
.${p}tab-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 14px;
	height: 14px;
	flex-shrink: 0;
	margin-right: 5px;
	vertical-align: middle;
}
.${p}tab-icon svg {
	width: 13px;
	height: 13px;
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
.${p}tab-group-dropdown {
	position: fixed;
	z-index: var(--layer-popover, 50);
	min-width: 160px;
	padding: 4px;
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	display: flex;
	flex-direction: column;
	gap: 1px;
}
.${p}tab-group-dropdown-item {
	padding: 6px 10px;
	font-size: var(--font-ui-small);
	color: var(--text-normal);
	background: none;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	text-align: left;
	box-shadow: none;
}
.${p}tab-group-dropdown-item:hover {
	background: var(--background-modifier-hover);
}

.modal:has(.${p}tab-manager-modal) {
	width: 480px;
}
.modal:has(.${p}tab-manager-modal) .modal-title {
	text-align: center;
}

/* ─── Shared row scaffolding (list/row/drag/grip/arrows/label/controls) ─── */
${buildManagerRowStyles(p, "tab-manager")}

/* ─── Tab-manager specific row extras ─── */
.${p}tab-manager-settings-toggle {
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 10px;
	margin-bottom: 8px;
	font-size: var(--font-ui-small);
	color: var(--text-muted);
}
${buildManagerToolbarStyles(p, "tab-manager")}
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
.${p}tab-manager-row:has(.${p}tab-manager-edit-form) {
	flex-wrap: wrap;
}
.${p}tab-manager-edit-form {
	flex-basis: 100%;
	padding-top: 8px;
}
.${p}tab-manager-edit-form .setting-item {
	padding: 6px 0;
	border-top: none;
}
`;
}
