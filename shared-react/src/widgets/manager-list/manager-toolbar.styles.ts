export function buildManagerToolbarStyles(p: string, rp: string): string {
	return `
.${p}${rp}-toolbar {
	display: flex;
	align-items: center;
	gap: 12px;
	margin-bottom: 8px;
}
.${p}${rp}-toolbar > .setting-item {
	flex: 1 1 auto;
	min-width: 0;
	border: none;
	padding-top: 8px;
	padding-bottom: 8px;
}
.${p}${rp}-toolbar > .${p}reset-to-defaults-btn {
	flex: 0 0 auto;
}
`;
}
