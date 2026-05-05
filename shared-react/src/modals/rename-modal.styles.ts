export function buildRenameStyles(p: string): string {
	return `
.${p}rename-input {
	width: 100%; padding: 8px 12px; font-size: var(--font-ui-medium);
	border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background: var(--background-secondary); color: var(--text-normal); margin-bottom: 12px;
}
.${p}rename-input:focus { border-color: var(--interactive-accent); outline: none; }
`;
}
