export function buildManagerToolbarStyles(p: string, rp: string): string {
	return `
.${p}${rp}-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 8px 0;
	margin-bottom: 8px;
}
.${p}${rp}-toolbar-label {
	flex: 1 1 auto;
	min-width: 0;
	font-size: var(--font-ui-small);
	font-weight: 500;
	color: var(--text-normal);
}
.${p}${rp}-toolbar-toggle {
	display: inline-flex;
	align-items: center;
	flex-shrink: 0;
}
`;
}
