export function buildLogsViewerStyles(p: string): string {
	return `
.${p}logs-viewer { display: flex; flex-direction: column; gap: 8px; height: 100%; padding: 8px 12px; }
.${p}logs-viewer-toolbar { display: flex; flex-direction: column; gap: 6px; }
.${p}logs-viewer-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.${p}logs-viewer-field { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
.${p}logs-viewer-field-grow { flex: 1 1 200px; }
.${p}logs-viewer-field-grow input { width: 100%; }
.${p}logs-viewer-counts { color: var(--text-muted); font-size: var(--font-ui-smaller); }

.${p}logs-viewer-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.${p}logs-viewer-chip {
	padding: 2px 8px; border-radius: var(--radius-s); cursor: pointer;
	border: 1px solid var(--background-modifier-border); background: var(--background-secondary);
	color: var(--text-muted); font-size: var(--font-ui-smaller);
}
.${p}logs-viewer-chip[data-kind="level"] { text-transform: uppercase; }
.${p}logs-viewer-chip[aria-pressed="true"] { color: var(--text-normal); border-color: var(--interactive-accent); }
.${p}logs-viewer-chip[data-kind="level"][data-value="warn"][aria-pressed="true"] { color: var(--text-warning); }
.${p}logs-viewer-chip[data-kind="level"][data-value="error"][aria-pressed="true"] { color: var(--text-error); }

.${p}logs-viewer-pending {
	align-self: flex-start; padding: 2px 10px; border-radius: var(--radius-s); cursor: pointer;
	border: 1px solid var(--interactive-accent); background: var(--background-secondary); color: var(--text-accent);
	font-size: var(--font-ui-smaller);
}

.${p}logs-viewer-list { flex: 1 1 auto; min-height: 120px; border-top: 1px solid var(--background-modifier-border); }
.${p}logs-viewer-row { border-bottom: 1px solid var(--background-modifier-border); font-size: var(--font-ui-smaller); }
.${p}logs-viewer-row-main { display: flex; align-items: center; gap: 8px; padding: 4px 2px; }
.${p}logs-viewer-row-select { flex: 0 0 auto; }
.${p}logs-viewer-row-time { flex: 0 0 auto; color: var(--text-faint); font-family: var(--font-monospace); }
.${p}logs-viewer-row-level { flex: 0 0 52px; text-transform: uppercase; color: var(--text-muted); }
.${p}logs-viewer-row-level[data-level="warn"] { color: var(--text-warning); }
.${p}logs-viewer-row-level[data-level="error"] { color: var(--text-error); }
.${p}logs-viewer-row-scope { flex: 0 0 auto; color: var(--text-accent); }
.${p}logs-viewer-row-message {
	flex: 1 1 auto; min-width: 0; padding: 0; border: 0; background: none; cursor: pointer;
	color: var(--text-normal); text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.${p}logs-viewer-row-message:disabled { cursor: default; }
.${p}logs-viewer-row-caret { color: var(--text-faint); }
.${p}logs-viewer-row-copy { flex: 0 0 auto; font-size: var(--font-ui-smaller); }
.${p}logs-viewer-row-data {
	margin: 0 0 6px 28px; padding: 6px 8px; border-radius: var(--radius-s);
	background: var(--background-secondary); font-size: var(--font-ui-smaller); white-space: pre-wrap;
	overflow-wrap: anywhere; max-height: 320px; overflow: auto;
}

.${p}logs-viewer-empty { flex: 1 1 auto; margin: 0; padding: 24px 0; color: var(--text-muted); text-align: center; }
`;
}
