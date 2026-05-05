export function buildManagerEditFormStyles(p: string, fp: string): string {
	return `
.${p}${fp}-edit-form {
	width: 100%; padding: 8px 0 0 26px;
	border-top: 1px solid var(--background-modifier-border); margin-top: 6px;
}
`;
}
