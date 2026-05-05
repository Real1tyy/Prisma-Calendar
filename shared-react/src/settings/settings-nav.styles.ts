export function buildSettingsNavStyles(p: string): string {
	return `
.${p}settings-nav {
	margin-bottom: 24px; border-bottom: 1px solid var(--background-modifier-border); padding-bottom: 16px;
}
.${p}nav-buttons { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.${p}nav-buttons button {
	padding: 8px 16px; border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background-color: var(--background-secondary); color: var(--text-normal); cursor: pointer;
	font-size: var(--font-ui-small); transition: all 0.2s ease;
}
.${p}nav-buttons button.${p}active {
	background-color: var(--interactive-accent); color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}
.${p}nav-buttons button:hover:not(.${p}active) { background-color: var(--background-modifier-hover); }
.${p}settings-nav-badge {
	margin-left: 6px; padding: 1px 6px; font-size: 0.75em; border-radius: 10px;
	background: var(--background-modifier-hover); color: var(--text-muted);
}
.${p}settings-search { margin-left: auto; flex-shrink: 0; }
.${p}settings-search-input {
	padding: 6px 10px; border: 1px solid var(--background-modifier-border); border-radius: 6px;
	background-color: var(--background-secondary); color: var(--text-normal);
	font-size: var(--font-ui-small); width: 150px; transition: width 0.2s ease;
}
.${p}settings-search-input:focus {
	border-color: var(--interactive-accent);
	box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2); width: 200px;
}
.${p}settings-search-hidden.setting-item { display: none; }
.${p}settings-search-no-results {
	padding: 24px; text-align: center; color: var(--text-muted); font-style: italic;
}
.${p}settings-footer { margin-top: 2rem; text-align: center; font-size: var(--font-ui-smaller); color: var(--text-faint); }
.${p}settings-footer-links { display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap; }
.${p}settings-support-link { text-decoration: none; color: var(--text-accent); }
.${p}settings-support-link:hover { text-decoration: underline; }
`;
}
