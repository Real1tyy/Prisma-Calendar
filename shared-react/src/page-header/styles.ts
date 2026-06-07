import { buildManagerRowStyles } from "../widgets/manager-list/manager-row.styles";
import { buildManagerToolbarStyles } from "../widgets/manager-list/manager-toolbar.styles";

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

/* The page header owns this pane's action area. Give it a dominant flex-grow so it
   claims the header width left of it (the title shrinks to its content), and
   right-align its buttons so the row sits at the top-right with Manage at the far
   edge — the layout Obsidian had before. The fit logic in action-bar.tsx trims
   trailing actions to what fits. Scoped via :has() so only our pane is affected. */
.view-actions:has(> .${p}page-header-host) {
	flex: 1000 1 auto;
	min-width: 0;
	justify-content: flex-end;
}

.${p}page-header-host {
	display: contents;
}

.${p}page-header-actions {
	display: contents;
}

/* Buttons the fit logic marks as overflowing the header are removed from the row.
   They stay reachable through the overflow trigger below (and the action manager). */
.${p}page-header-actions [data-ph-overflow="true"] {
	display: none;
}

/* Overflow trigger — opens a menu of the actions trimmed off the bar. Always
   rendered so the fit measurement stays stable; revealed only while the container
   reports overflow (set imperatively by the fit logic). */
.${p}page-header-overflow {
	display: none;
}

.${p}page-header-actions[data-ph-overflow-active="true"] .${p}page-header-overflow {
	display: inline-flex;
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

${buildManagerToolbarStyles(p, "action-manager")}

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
