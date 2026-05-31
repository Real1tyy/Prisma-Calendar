export function buildLicenseStyles(p: string): string {
	return `
.${p}license-activations-badge {
	display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 0.8em;
	border-radius: 10px; background: var(--background-modifier-hover); color: var(--text-muted);
}
.${p}license-sub-line { margin-top: 4px; font-size: 0.85em; color: var(--text-muted); }
.${p}license-grace-nudge { margin-top: 4px; font-size: 0.85em; color: var(--text-warning); }
`;
}
