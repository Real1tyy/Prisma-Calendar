/**
 * Self-contained stylesheet for the shared Help Center modal. Mirrors the
 * what's-new modal's structure (centred title, flex column, tab bar) so the two
 * in-app help surfaces feel like one family across every plugin. The FAQ and
 * troubleshooting panels render the plugin's bundled documentation Markdown —
 * including the `<details>` collapsibles the docs use — so the `doc` rules style
 * rendered Markdown rather than bespoke components. All colours come from
 * Obsidian theme variables so it adapts to light/dark and custom themes.
 */
export function buildHelpCenterStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}help-center-modal {
	max-width: 760px;
	width: 90%;
	height: 80vh;
}
.${p}help-center-modal .modal-title {
	text-align: center;
	width: 100%;
}
.${p}help-center-modal .modal-content {
	display: flex;
	flex-direction: column;
	overflow: hidden;
	height: 100%;
}
.${p}help-center-modal .modal-content > [data-testid] {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: hidden;
}
.${p}help-center-tabs {
	display: flex;
	gap: 0.4rem;
	flex-wrap: wrap;
	flex-shrink: 0;
	margin-bottom: 1rem;
	border-bottom: 1px solid var(--background-modifier-border);
	padding-bottom: 0.6rem;
}
.${p}help-center-tab {
	padding: 0.4rem 0.9rem;
	border-radius: 6px;
	cursor: pointer;
	border: 1px solid transparent;
	background: transparent;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	transition: all 0.15s ease;
}
.${p}help-center-tab:hover {
	background: var(--background-modifier-hover);
	color: var(--text-normal);
}
.${p}help-center-tab-active {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}
.${p}help-center-tab-active:hover {
	background: var(--interactive-accent-hover);
	color: var(--text-on-accent);
}
.${p}help-center-panel {
	flex: 1;
	min-height: 0;
	overflow-y: auto;
	padding-right: 0.5rem;
}
.${p}help-center-doc {
	line-height: 1.6;
	color: var(--text-normal);
}
.${p}help-center-doc h1 {
	font-size: 1.5rem;
	margin: 0.2rem 0 1rem;
	color: var(--text-accent);
}
.${p}help-center-doc h2 {
	font-size: 1.2rem;
	margin-top: 1.4rem;
	margin-bottom: 0.5rem;
	color: var(--text-accent);
}
.${p}help-center-doc h3 {
	font-size: 1.05rem;
	margin-top: 1rem;
	margin-bottom: 0.4rem;
}
.${p}help-center-doc ul,
.${p}help-center-doc ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.${p}help-center-doc li { margin-bottom: 0.35rem; }
.${p}help-center-doc p { margin: 0.6rem 0; }
.${p}help-center-doc code {
	background: var(--code-background);
	padding: 0.2em 0.4em;
	border-radius: 3px;
	font-size: 0.9em;
}
.${p}help-center-doc pre {
	background: var(--code-background);
	padding: 1rem;
	border-radius: 6px;
	overflow-x: auto;
}
.${p}help-center-modal .${p}help-center-doc a { color: var(--link-color); }
.${p}help-center-doc a.external-link::after {
	content: "\\2197";
	margin-left: 0.2em;
	font-size: 0.8em;
}
.${p}help-center-doc details {
	border: 1px solid var(--background-modifier-border);
	border-radius: 8px;
	margin-bottom: 0.6rem;
	background: var(--background-secondary);
	padding: 0 1rem;
}
.${p}help-center-doc details[open] {
	padding-bottom: 0.6rem;
}
.${p}help-center-doc summary {
	cursor: pointer;
	padding: 0.7rem 0;
	font-weight: 500;
	list-style-position: inside;
}
.${p}help-center-doc summary:hover {
	color: var(--text-accent);
}
.${p}help-center-doc blockquote {
	border-left: 3px solid var(--interactive-accent);
	margin: 0.6rem 0;
	padding: 0.2rem 0 0.2rem 1rem;
	color: var(--text-muted);
}
.${p}help-center-get-help p { line-height: 1.6; color: var(--text-normal); }
.${p}help-center-actions {
	display: flex;
	gap: 0.5rem;
	flex-wrap: wrap;
	margin-top: 1rem;
}
.${p}help-center-actions button {
	flex: 1;
	min-width: 140px;
	padding: 0.6rem 1rem;
	border-radius: 6px;
	cursor: pointer;
	border: 1px solid var(--background-modifier-border);
	background: var(--interactive-normal);
	color: var(--text-normal);
	transition: all 0.2s ease;
}
.${p}help-center-actions button:hover {
	background: var(--interactive-hover);
	border-color: var(--interactive-accent);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.${p}help-center-actions button.${p}help-center-action-primary {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}
.${p}help-center-actions button.${p}help-center-action-primary:hover {
	background: var(--interactive-accent-hover);
}
`;
}
