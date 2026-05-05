export function buildPageHeaderStyles(p: string): string {
	return `
.${p}page-header { margin-bottom: 16px; }
.${p}page-header-row { display: flex; align-items: center; gap: 8px; }
.${p}page-header-title-group { flex: 1; min-width: 0; }
.${p}page-header-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--text-normal); }
.${p}page-header-subtitle { font-size: var(--font-ui-small); color: var(--text-muted); margin-top: 2px; }
.${p}page-header-actions { display: flex; gap: 4px; flex-shrink: 0; }
.${p}page-header-action-btn svg { width: 16px; height: 16px; }
.${p}page-header-back { flex-shrink: 0; }
.${p}page-header-back svg { width: 16px; height: 16px; }
.${p}page-header-right { flex-shrink: 0; margin-left: auto; }
.${p}page-header-breadcrumbs {
	display: flex; align-items: center; gap: 4px; margin-bottom: 8px;
	font-size: var(--font-ui-smaller); color: var(--text-muted);
}
.${p}page-header-breadcrumb { display: inline-flex; align-items: center; gap: 4px; }
.${p}page-header-breadcrumb-link {
	background: none; border: none; padding: 0; cursor: pointer;
	color: var(--text-accent); font-size: inherit;
}
.${p}page-header-breadcrumb-link:hover { text-decoration: underline; }
.${p}page-header-breadcrumb-separator { color: var(--text-faint); }
`;
}
