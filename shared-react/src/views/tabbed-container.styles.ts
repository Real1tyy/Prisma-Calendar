export function buildTabbedContainerStyles(p: string): string {
	return `
.${p}tabbed-container { display: flex; flex-direction: column; height: 100%; }
.${p}tab-bar {
	display: flex; align-items: center; gap: 2px; padding: 2px; margin: 0 4px;
	border-radius: 8px; background: var(--background-modifier-hover); flex-shrink: 0;
}
.${p}tab {
	padding: 4px 12px; font-size: var(--font-ui-smaller); font-weight: 500;
	color: var(--text-muted); background: none; border: none; border-radius: 6px;
	cursor: pointer; box-shadow: none; white-space: nowrap; line-height: 1.4;
	transition: color 150ms ease, background 150ms ease, box-shadow 150ms ease;
}
.${p}tab:hover { color: var(--text-normal); background: hsla(var(--color-accent-hsl), 0.08); }
.${p}tab-active {
	color: var(--text-on-accent); background: var(--interactive-accent);
	font-weight: 600; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.${p}tab-active:hover { color: var(--text-on-accent); background: var(--interactive-accent-hover); }
.${p}tab-icon { display: inline-flex; align-items: center; margin-right: 4px; }
.${p}tab-icon svg { width: 14px; height: 14px; }
.${p}tab-close {
	display: inline-flex; align-items: center; margin-left: 6px; padding: 2px;
	border-radius: 4px; cursor: pointer; color: var(--text-faint);
	transition: color 100ms ease, background 100ms ease;
}
.${p}tab-close:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
.${p}tab-close svg { width: 12px; height: 12px; }
.${p}tab-content { flex: 1; overflow-y: auto; min-height: 0; }
.${p}tab-panel { padding: 0; height: 100%; }
.${p}tab-panel-hidden { display: none; }
`;
}
