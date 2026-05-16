export function buildPageBannerStyles(p: string): string {
	return `
.${p}page-banner { margin-bottom: 16px; }
.${p}page-banner-row { display: flex; align-items: center; gap: 8px; }
.${p}page-banner-title-group { flex: 1; min-width: 0; }
.${p}page-banner-title { margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--text-normal); }
.${p}page-banner-subtitle { font-size: var(--font-ui-small); color: var(--text-muted); margin-top: 2px; }
.${p}page-banner-actions { display: flex; gap: 4px; flex-shrink: 0; }
.${p}page-banner-action-btn svg { width: 16px; height: 16px; }
.${p}page-banner-back { flex-shrink: 0; }
.${p}page-banner-back svg { width: 16px; height: 16px; }
.${p}page-banner-right { flex-shrink: 0; margin-left: auto; }
.${p}page-banner-breadcrumbs {
	display: flex; align-items: center; gap: 4px; margin-bottom: 8px;
	font-size: var(--font-ui-smaller); color: var(--text-muted);
}
.${p}page-banner-breadcrumb { display: inline-flex; align-items: center; gap: 4px; }
.${p}page-banner-breadcrumb-link {
	background: none; border: none; padding: 0; cursor: pointer;
	color: var(--text-accent); font-size: inherit;
}
.${p}page-banner-breadcrumb-link:hover { text-decoration: underline; }
.${p}page-banner-breadcrumb-separator { color: var(--text-faint); }
`;
}
