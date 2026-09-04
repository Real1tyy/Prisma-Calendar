export function buildPrivacyDisclaimerStyles(p: string): string {
	return `
.${p}privacy-disclaimer {
	margin: 8px 0 12px; padding: 8px 12px;
	border-left: 3px solid var(--interactive-accent); border-radius: var(--radius-s);
	background: var(--background-secondary); color: var(--text-muted); font-size: var(--font-ui-small);
}
.${p}privacy-disclaimer-inline { margin: 4px 0 8px; padding: 0; border-left: 0; background: transparent; }
.${p}privacy-disclaimer-summary { margin: 0; line-height: 1.4; }
.${p}privacy-disclaimer-link { white-space: nowrap; }
.${p}privacy-disclaimer-example { margin-top: 8px; }
.${p}privacy-disclaimer-example summary { cursor: pointer; color: var(--text-normal); }
.${p}privacy-disclaimer-example p { margin: 6px 0 0; line-height: 1.4; }
.${p}privacy-disclaimer-example code { overflow-wrap: anywhere; }
.${p}privacy-disclaimer .setting-item { border-top: 0; padding-top: 8px; padding-bottom: 0; }
`;
}
