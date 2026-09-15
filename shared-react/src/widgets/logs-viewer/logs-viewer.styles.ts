/**
 * One color per level, used by the level chips, the row's severity badge and
 * its left accent — so a level reads the same everywhere it appears.
 */
function levelColors(selector: string): string {
	return `
${selector}[data-level="debug"] { --log-color: var(--color-blue); --log-tint: rgba(var(--color-blue-rgb), 0.14); }
${selector}[data-level="info"] { --log-color: var(--color-green); --log-tint: rgba(var(--color-green-rgb), 0.14); }
${selector}[data-level="warn"] { --log-color: var(--color-yellow); --log-tint: rgba(var(--color-yellow-rgb), 0.16); }
${selector}[data-level="error"] { --log-color: var(--color-red); --log-tint: rgba(var(--color-red-rgb), 0.16); }`;
}

export function buildLogsViewerStyles(p: string): string {
	const v = `.${p}logs-viewer`;
	return `
${v} { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 8px 12px; outline: none; }
${v}-embedded { height: auto; padding: 0; }
${v}-toolbar { display: flex; flex-direction: column; gap: 6px; }
${v}-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; }
${v}-label { color: var(--text-muted); font-size: var(--font-ui-smaller); font-weight: var(--font-semibold); }
${v}-divider { width: 1px; align-self: stretch; margin: 2px 4px; background: var(--background-modifier-border); }
${v}-field { display: flex; align-items: center; gap: 4px; color: var(--text-muted); font-size: var(--font-ui-smaller); }
${v}-field .setting-input { width: auto; }
${v}-search { flex: 1 1 240px; }
${v}-search input { width: 100%; }

${v}-chips { display: flex; flex-wrap: wrap; gap: 4px; }
${v}-chip {
	height: auto; padding: 2px 8px; border-radius: var(--radius-s); cursor: pointer; box-shadow: none;
	border: 1px solid var(--background-modifier-border); background: var(--background-secondary);
	color: var(--text-faint); font-size: var(--font-ui-smaller);
}
${v}-chip[aria-pressed="true"] { color: var(--text-normal); border-color: var(--interactive-accent); }
${v}-chip[data-kind="level"] { font-family: var(--font-monospace); text-transform: uppercase; }
${levelColors(`${v}-chip`)}
${v}-chip[data-kind="level"][aria-pressed="true"] { color: var(--log-color); border-color: var(--log-color); background: var(--log-tint); }

${v}-range { position: relative; flex: 1 1 200px; min-width: 160px; height: 18px; margin: 0 6px; }
${v}-range::before {
	content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%);
	border-radius: 2px; background: var(--background-modifier-border);
}
${v}-range-fill {
	position: absolute; top: 50%; height: 4px; transform: translateY(-50%); border-radius: 2px;
	background: var(--interactive-accent); pointer-events: none;
}
${v}-range input[type="range"] {
	position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; background: transparent;
	pointer-events: none; -webkit-appearance: none; appearance: none;
}
${v}-range input[type="range"]::-webkit-slider-runnable-track { background: transparent; }
${v}-range input[type="range"]::-webkit-slider-thumb { pointer-events: auto; cursor: ew-resize; }

${v}-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-height: 28px; }
${v}-counts { color: var(--text-muted); font-size: var(--font-ui-smaller); font-variant-numeric: tabular-nums; }
${v}-pending {
	padding: 2px 10px; border-radius: var(--radius-s); cursor: pointer;
	border: 1px solid var(--interactive-accent); background: var(--background-secondary); color: var(--text-accent);
	font-size: var(--font-ui-smaller);
}

${v}-list {
	flex: 1 1 auto; min-height: 120px; border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s); background: var(--background-primary);
	font-family: var(--font-monospace); font-size: var(--font-ui-smaller);
}
${v}-embedded ${v}-list { flex: 0 0 auto; height: 360px; }

${v}-row { border-bottom: 1px solid var(--background-modifier-border); border-left: 3px solid var(--log-color); }
${levelColors(`${v}-row`)}
${v}-row[data-level="warn"], ${v}-row[data-level="error"] { background: var(--log-tint); }
${v}-row-main { display: flex; align-items: center; gap: 10px; padding: 3px 6px; min-height: 28px; }
${v}-row-main:hover { background: var(--background-modifier-hover); }
${v}-row-select { flex: 0 0 auto; margin: 0; }
${v}-row-time { flex: 0 0 auto; color: var(--text-faint); font-variant-numeric: tabular-nums; }
${v}-row-level {
	flex: 0 0 52px; padding: 0 4px; border-radius: var(--radius-s); text-align: center;
	font-weight: var(--font-semibold); color: var(--log-color); background: var(--log-tint);
}
${levelColors(`${v}-row-level`)}
${v}-row-scope {
	flex: 0 0 auto; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-accent);
}
${v}-row-message {
	flex: 1 1 auto; min-width: 0; display: flex; align-items: baseline; gap: 8px;
	cursor: pointer; overflow: hidden; white-space: nowrap; text-align: left;
}
${v}-row-message:focus-visible { outline: 1px solid var(--interactive-accent); outline-offset: 1px; }
${v}-row-body { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text-normal); }
${v}-row[data-level="warn"] ${v}-row-body, ${v}-row[data-level="error"] ${v}-row-body { color: var(--log-color); }
${v}-row-inline-data { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; color: var(--text-faint); }
${v}-row-copy { flex: 0 0 auto; opacity: 0.4; }
${v}-row-main:hover ${v}-row-copy, ${v}-row-copy:focus-visible { opacity: 1; }
${v}-match { padding: 0; border-radius: 2px; background: var(--text-highlight-bg); color: inherit; }

${v}-row-data { display: flex; flex-direction: column; gap: 6px; margin: 0 6px 6px 30px; padding: 6px 10px; border-radius: var(--radius-s); background: var(--background-secondary); }
${v}-record { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 0; }
${v}-record dt { color: var(--text-muted); }
${v}-record dd { margin: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
${v}-record-attributes { padding-top: 6px; border-top: 1px dashed var(--background-modifier-border); }
${v}-attribute { display: contents; }
${v}-attribute dt { color: var(--text-accent); }
${v}-attribute-json { margin: 0; max-height: 240px; overflow: auto; font-size: inherit; }

${v}-empty { flex: 1 1 auto; margin: 0; padding: 24px 0; color: var(--text-muted); text-align: center; }
`;
}
