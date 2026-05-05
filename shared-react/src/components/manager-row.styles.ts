export function buildManagerRowStyles(p: string, rp: string): string {
	return `
.${p}${rp}-row {
	display: flex; align-items: center; gap: 6px; padding: 8px 10px;
	background: var(--background-secondary); border: 1px solid var(--background-modifier-border);
	border-radius: 8px; transition: opacity 150ms ease, border-color 150ms ease, background 150ms ease;
	flex-wrap: wrap;
}
.${p}${rp}-row[draggable="true"] { cursor: grab; }
.${p}${rp}-row-hidden { opacity: 0.5; }
.${p}${rp}-label { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
.${p}${rp}-icon { display: flex; align-items: center; flex-shrink: 0; }
.${p}${rp}-icon svg { width: 16px; height: 16px; }
.${p}${rp}-label-text {
	font-size: var(--font-ui-medium); font-weight: 500; color: var(--text-normal);
	overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${p}${rp}-label-original { font-size: 0.7em; color: var(--text-faint); font-style: italic; white-space: nowrap; }
.${p}${rp}-controls { display: flex; gap: 4px; flex-shrink: 0; }
.${p}${rp}-btn {
	display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
	background: none; border: 1px solid transparent; border-radius: 6px;
	color: var(--text-faint); cursor: pointer; padding: 0; box-shadow: none;
	transition: color 120ms ease, border-color 120ms ease;
}
.${p}${rp}-btn:hover:not([disabled]) { color: var(--text-normal); border-color: var(--background-modifier-border); }
.${p}${rp}-btn[disabled] { opacity: 0.3; cursor: not-allowed; }
.${p}${rp}-btn svg { width: 14px; height: 14px; }
`;
}
