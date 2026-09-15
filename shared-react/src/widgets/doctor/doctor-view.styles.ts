export function buildDoctorStyles(p: string): string {
	return `
.modal.${p}doctor-modal { width: calc(var(--dialog-width) * 1.3); max-width: 95vw; }
.${p}doctor { display: flex; flex-direction: column; gap: 12px; }
.${p}doctor-summary {
	display: flex; align-items: center; gap: 8px;
	padding: 10px 12px; border-radius: var(--radius-s); background: var(--background-secondary);
	font-size: var(--font-ui-medium);
}
.${p}doctor-summary-ok { color: var(--text-success); }
.${p}doctor-summary-warn { color: var(--text-warning); }
.${p}doctor-summary-fail { color: var(--text-error); }
.${p}doctor-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.${p}doctor-checks { display: flex; flex-direction: column; }
.${p}doctor-check {
	display: flex; align-items: flex-start; gap: 10px;
	padding: 10px 0; border-top: 1px solid var(--background-modifier-border);
}
.${p}doctor-check:first-child { border-top: 0; }
.${p}doctor-status { flex: 0 0 auto; font-size: var(--font-ui-medium); line-height: 1.4; }
.${p}doctor-status-ok { color: var(--text-success); }
.${p}doctor-status-warn { color: var(--text-warning); }
.${p}doctor-status-fail { color: var(--text-error); }
.${p}doctor-check-body { flex: 1 1 auto; min-width: 0; }
.${p}doctor-check-label { font-weight: var(--font-semibold); }
.${p}doctor-check-detail { color: var(--text-muted); font-size: var(--font-ui-small); overflow-wrap: anywhere; }
.${p}doctor-check-fix { flex: 0 0 auto; }
.${p}doctor-empty { color: var(--text-muted); font-size: var(--font-ui-small); }
.${p}doctor-logs { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--background-modifier-border); }
.${p}doctor-logs-toggle {
	display: flex; align-items: center; gap: 8px; width: 100%; height: auto; padding: 6px 4px;
	background: none; box-shadow: none; border: 0; cursor: pointer; text-align: left;
}
.${p}doctor-logs-toggle:hover { background: var(--background-modifier-hover); }
.${p}doctor-logs-caret { display: flex; color: var(--text-muted); }
.${p}doctor-logs-heading { font-weight: var(--font-semibold); }
.${p}doctor-logs-hint { color: var(--text-muted); font-size: var(--font-ui-smaller); }
`;
}
