import { injectStyleSheet } from "../styles/inject";

function buildWhatsNewStyles(p: string): string {
	return `
.modal-container.mod-dim .modal:has(.${p}-whats-new-modal) {
	max-width: 750px;
	width: 90%;
}
.${p}-whats-new-plugin-name {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
	font-weight: 600;
}
.${p}-whats-new-plugin-name:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}-whats-new-plugin-name::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}-whats-new-plugin-name:hover::after {
	width: 100%;
}
.${p}-whats-new-subtitle {
	color: var(--text-muted);
	font-size: 0.9rem;
	margin: 0 0 1rem;
}
.${p}-whats-new-support {
	margin: 0 0 1rem;
	padding: 1rem;
	background-color: var(--background-secondary);
	border-radius: 8px;
}
.${p}-whats-new-support h3 {
	margin-top: 0;
	margin-bottom: 0.5rem;
	font-size: 1rem;
}
.${p}-whats-new-support p {
	margin: 0.5rem 0;
	color: var(--text-normal);
}
.${p}-whats-new-support a {
	color: var(--link-color);
	text-decoration: none;
	transition: all 0.2s ease;
	position: relative;
}
.${p}-whats-new-support a:hover {
	color: var(--link-color-hover);
	text-decoration: none;
}
.${p}-whats-new-support a::after {
	content: "";
	position: absolute;
	bottom: -2px;
	left: 0;
	width: 0;
	height: 2px;
	background-color: var(--interactive-accent);
	transition: width 0.3s ease;
}
.${p}-whats-new-support a:hover::after {
	width: 100%;
}
.${p}-whats-new-content {
	max-height: 400px;
	overflow-y: auto;
	margin-bottom: 1rem;
	padding-right: 0.5rem;
	border-radius: 8px;
}
.${p}-whats-new-content h2 {
	font-size: 1.3rem;
	margin-top: 1.5rem;
	margin-bottom: 0.5rem;
	color: var(--text-accent);
}
.${p}-whats-new-content h3 {
	font-size: 1.1rem;
	margin-top: 1rem;
	margin-bottom: 0.5rem;
}
.${p}-whats-new-content ul {
	padding-left: 1.5rem;
}
.${p}-whats-new-content li {
	margin-bottom: 0.5rem;
	line-height: 1.6;
}
.${p}-whats-new-content code {
	background: var(--code-background);
	padding: 0.2em 0.4em;
	border-radius: 3px;
	font-size: 0.9em;
}
.${p}-whats-new-content pre {
	background: var(--code-background);
	padding: 1rem;
	border-radius: 6px;
	overflow-x: auto;
}
.${p}-whats-new-content a.external-link {
	color: var(--link-external-color);
}
.${p}-whats-new-content a.external-link::after {
	content: "\\2197";
	margin-left: 0.2em;
	font-size: 0.8em;
}
.${p}-whats-new-empty {
	text-align: center;
	color: var(--text-muted);
	padding: 2rem;
	font-style: italic;
}
.${p}-whats-new-sticky-footer {
	position: sticky;
	bottom: 0;
	background: var(--background-primary);
	padding-top: 0.75rem;
	margin-top: 0;
	z-index: 10;
	border-top: 1px solid var(--background-modifier-border);
}
.${p}-whats-new-buttons {
	display: flex;
	gap: 0.5rem;
	justify-content: space-between;
	flex-wrap: wrap;
	padding-bottom: 0.5rem;
	width: 100%;
}
.${p}-whats-new-buttons button {
	flex: 1;
	min-width: 0;
	padding: 0.5rem 1rem;
	border-radius: 4px;
	cursor: pointer;
	border: 1px solid var(--background-modifier-border);
	background: var(--interactive-normal);
	color: var(--text-normal);
	transition: all 0.2s ease;
	text-align: center;
}
.${p}-whats-new-buttons button:hover {
	background: var(--interactive-hover);
	border-color: var(--interactive-accent);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
}
.${p}-whats-new-buttons button:active {
	transform: translateY(0);
	box-shadow: 0 1px 4px rgb(0 0 0 / 10%);
}
`;
}

export function injectWhatsNewStyles(prefix: string): void {
	injectStyleSheet(`${prefix}-whats-new-styles`, buildWhatsNewStyles(prefix));
}
