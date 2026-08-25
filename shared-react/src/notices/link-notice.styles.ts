export function buildLinkNoticeStyles(p: string): string {
	return `
.${p}link-notice { display: flex; flex-direction: column; gap: 8px; }
.${p}link-notice-message { white-space: pre-wrap; }
.${p}link-notice-actions { display: flex; flex-wrap: wrap; gap: 14px; }
.${p}link-notice-link {
	color: var(--text-accent); font-weight: 600; text-decoration: none; cursor: pointer;
}
.${p}link-notice-link:hover { color: var(--text-accent-hover); text-decoration: underline; }
`;
}
