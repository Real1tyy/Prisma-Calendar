/**
 * Self-contained stylesheet for the shared feedback modal, mirroring the review
 * modal's shell so the two in-app outreach surfaces read as one family across
 * every plugin. Colours come from Obsidian theme variables so it adapts to
 * light/dark and custom themes.
 */
export function buildFeedbackStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}feedback-modal {
	max-width: 560px;
	width: 92%;
}
.${p}feedback-modal .modal-title {
	text-align: center;
	width: 100%;
}
.${p}feedback-types {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4rem;
	margin-bottom: 0.9rem;
}
.${p}feedback-modal button.${p}feedback-type {
	flex: 1 1 auto;
	font-size: var(--font-ui-small);
	white-space: nowrap;
}
.${p}feedback-modal button.${p}feedback-type-active {
	background: var(--interactive-accent);
	color: var(--text-on-accent);
}
.${p}feedback-text {
	width: 100%;
	min-height: 7rem;
	resize: vertical;
	margin-bottom: 0.8rem;
}
.${p}feedback-option {
	align-items: flex-start;
	color: var(--text-muted);
	display: flex;
	font-size: var(--font-ui-smaller);
	gap: 0.5rem;
	margin: 0 0 0.6rem;
}
.${p}feedback-option input {
	margin-top: 0.15rem;
}
.${p}feedback-bundle-preview {
	background: var(--background-secondary);
	border-radius: var(--radius-s);
	font-size: var(--font-ui-smaller);
	margin: 0 0 0.8rem;
	max-height: 12rem;
	overflow: auto;
	padding: 0.5rem;
	white-space: pre-wrap;
	word-break: break-word;
}
.${p}feedback-attachments {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
	margin-bottom: 0.6rem;
}
.${p}feedback-thumb {
	border: 1px solid var(--background-modifier-border);
	border-radius: var(--radius-s);
	overflow: hidden;
	position: relative;
}
.${p}feedback-thumb img {
	display: block;
	height: 4.5rem;
	object-fit: cover;
	width: 6rem;
}
.${p}feedback-modal button.${p}feedback-thumb-remove {
	font-size: var(--font-ui-smaller);
	padding: 0.1rem 0.4rem;
	position: absolute;
	right: 0.15rem;
	top: 0.15rem;
}
.${p}feedback-attach-row {
	align-items: center;
	display: flex;
	gap: 0.6rem;
	margin-bottom: 0.8rem;
}
.${p}feedback-attach-hint {
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}
.${p}feedback-attach-input {
	display: none;
}
.${p}feedback-error {
	color: var(--text-error);
	font-size: var(--font-ui-small);
	margin: 0 0 0.8rem;
}
.${p}feedback-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}
.${p}feedback-thanks {
	text-align: center;
	padding: 1rem 0 0.4rem;
}
.${p}feedback-thanks-title {
	font-size: var(--font-ui-large);
	font-weight: 600;
	margin-bottom: 0.4rem;
}
.${p}feedback-thanks-body {
	color: var(--text-muted);
	margin-bottom: 1rem;
}
`;
}
