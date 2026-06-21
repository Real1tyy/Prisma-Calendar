export function buildLicenseStyles(p: string): string {
	return `
.${p}license-activations-badge {
	display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 0.8em;
	border-radius: 10px; background: var(--background-modifier-hover); color: var(--text-muted);
}
.${p}license-sub-line { margin-top: 4px; font-size: 0.85em; color: var(--text-muted); }
.${p}license-grace-nudge { margin-top: 4px; font-size: 0.85em; color: var(--text-warning); }
.${p}license-activate-row { display: flex; gap: 8px; align-items: center; }
.${p}license-activate-input { flex: 1 1 auto; min-width: 180px; }
.${p}license-status-alert {
	display: block; font-weight: 600; font-size: 1.05em; color: var(--text-error); margin-bottom: 2px;
}
`;
}
