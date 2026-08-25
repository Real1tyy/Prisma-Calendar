export function buildPropertyOrderTableStyles(p: string): string {
	return `
.${p}property-order-list { display: flex; flex-direction: column; gap: 4px; }
.${p}property-order-row {
	display: flex; align-items: center; gap: 8px; padding: 6px 10px;
	background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
	border-radius: 8px; transition: opacity 150ms ease, border-color 150ms ease, background 150ms ease;
}
.${p}property-order-row[draggable="true"] { cursor: grab; }
.${p}property-order-row-dragging { opacity: 0.4; }
.${p}property-order-row-dragover {
	border-color: var(--interactive-accent);
	background: hsla(var(--color-accent-hsl), 0.06);
}
.${p}property-order-grip { color: var(--text-faint); display: flex; align-items: center; flex-shrink: 0; }
.${p}property-order-grip svg { width: 14px; height: 14px; }
.${p}property-order-arrows { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
.${p}property-order-move-btn {
	display: flex; align-items: center; justify-content: center;
	width: 22px; height: 16px; background: none; border: none; border-radius: 3px;
	color: var(--text-faint); cursor: pointer; padding: 0; box-shadow: none;
	transition: color 100ms ease, background 100ms ease;
}
.${p}property-order-move-btn:hover:not([disabled]) { color: var(--text-normal); background: var(--background-modifier-hover); }
.${p}property-order-move-btn[disabled] { opacity: 0.3; cursor: not-allowed; }
.${p}property-order-move-btn svg { width: 14px; height: 14px; }
.${p}property-order-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.${p}property-order-label {
	font-size: var(--font-ui-medium); font-weight: 500; color: var(--text-normal);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${p}property-order-description {
	font-size: var(--font-ui-smaller); color: var(--text-muted);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${p}property-order-name-input { flex-shrink: 0; width: 200px; }
.${p}property-order-name-input input { width: 100%; }
`;
}
