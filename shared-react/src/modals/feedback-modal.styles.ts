/**
 * Self-contained stylesheet for the shared feedback modal. Sized and spaced like
 * the Help Center and what's-new modals so the in-app outreach surfaces read as
 * one family across every plugin — a form the user is asked to write prose into
 * earns the same width and type scale as the surfaces they read. Colours come
 * from Obsidian theme variables so it adapts to light/dark and custom themes.
 */
export function buildFeedbackStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}feedback-modal {
	max-width: 680px;
	width: 92%;
}
.${p}feedback-modal .modal-title {
	text-align: center;
	width: 100%;
	font-size: var(--font-ui-large);
}
.${p}feedback-modal .modal-content {
	font-size: var(--font-ui-medium);
}
.${p}feedback-window-actions {
	display: flex;
	gap: 0.25rem;
	justify-content: flex-end;
	margin: -0.5rem 0 0.25rem;
}
.${p}feedback-modal button.${p}feedback-window-action {
	background: transparent;
	box-shadow: none;
	color: var(--text-muted);
	font-size: var(--font-ui-medium);
	line-height: 1;
	padding: 0.3rem 0.45rem;
}
.${p}feedback-modal button.${p}feedback-window-action:hover {
	background: var(--background-modifier-hover);
	color: var(--text-normal);
}
.${p}feedback-intro {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	margin: 0 0 1.1rem;
	text-align: center;
}
.${p}feedback-types {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-bottom: 1.1rem;
}
.${p}feedback-modal button.${p}feedback-type {
	flex: 1 1 0;
	padding: 0.6rem 0.75rem;
	font-size: var(--font-ui-small);
	white-space: nowrap;
}
.${p}feedback-modal button.${p}feedback-type-active {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
	font-weight: 600;
}
.${p}feedback-text {
	width: 100%;
	min-height: 9.5rem;
	padding: 0.7rem 0.8rem;
	font-size: var(--font-ui-medium);
	line-height: 1.5;
	resize: vertical;
	margin-bottom: 1rem;
}
.${p}feedback-option {
	align-items: flex-start;
	color: var(--text-normal);
	display: flex;
	font-size: var(--font-ui-small);
	gap: 0.6rem;
	line-height: 1.45;
	margin: 0 0 0.75rem;
}
.${p}feedback-option input {
	margin-top: 0.2rem;
	flex: 0 0 auto;
}
.${p}feedback-disclosure {
	color: var(--text-muted);
	cursor: pointer;
	font-size: var(--font-ui-small);
}
.${p}feedback-bundle-preview {
	background: var(--background-secondary);
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	font-size: var(--font-ui-smaller);
	line-height: 1.45;
	margin: 0.5rem 0 1rem;
	max-height: 15rem;
	overflow: auto;
	padding: 0.75rem;
	white-space: pre-wrap;
	word-break: break-word;
}
.${p}feedback-attachments {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6rem;
	margin-bottom: 0.75rem;
}
.${p}feedback-thumb {
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	overflow: hidden;
	position: relative;
}
.${p}feedback-modal button.${p}feedback-thumb-open {
	display: block;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;
	box-shadow: none;
	cursor: zoom-in;
	line-height: 0;
}
.${p}feedback-modal button.${p}feedback-thumb-open:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: -2px;
}
.${p}feedback-thumb img {
	display: block;
	height: 5.5rem;
	object-fit: cover;
	width: 7.5rem;
}
.${p}feedback-modal button.${p}feedback-thumb-remove {
	position: absolute;
	right: 0.2rem;
	top: 0.2rem;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.5rem;
	height: 1.5rem;
	padding: 0;
	font-size: var(--font-ui-smaller);
	line-height: 1;
	border-radius: 50%;
	cursor: pointer;
}
.${p}feedback-attach-row {
	align-items: center;
	display: flex;
	flex-wrap: wrap;
	gap: 0.7rem;
	margin-bottom: 1rem;
}
.${p}feedback-attach-hint {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
}
.${p}feedback-attach-input {
	display: none;
}
.${p}feedback-error {
	color: var(--text-error);
	font-size: var(--font-ui-small);
	margin: 0 0 0.9rem;
}
.${p}feedback-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.6rem;
	margin-top: 1.2rem;
}
.${p}feedback-modal .${p}feedback-actions button {
	padding: 0.55rem 1.4rem;
	font-size: var(--font-ui-small);
}
.${p}feedback-thanks {
	text-align: center;
	padding: 1.5rem 0 0.6rem;
}
.${p}feedback-thanks-title {
	font-size: var(--font-ui-large);
	font-weight: 600;
	margin-bottom: 0.6rem;
}
.${p}feedback-thanks-body {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	line-height: 1.5;
	margin: 0 auto 1.4rem;
	max-width: 28rem;
}
`;
}
