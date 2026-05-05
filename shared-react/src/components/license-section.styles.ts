export function buildLicenseStyles(p: string): string {
	return `
.${p}license-activations-badge {
	display: inline-block; margin-left: 8px; padding: 2px 8px; font-size: 0.8em;
	border-radius: 10px; background: var(--background-modifier-hover); color: var(--text-muted);
}
`;
}
