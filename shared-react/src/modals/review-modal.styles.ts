/**
 * Self-contained stylesheet for the shared review modal, mirroring the help-center
 * modal's shell so the two in-app outreach surfaces read as one family across every
 * plugin. Colours come from Obsidian theme variables so it adapts to light/dark
 * and custom themes.
 */
export function buildReviewStyles(p: string): string {
	return `
.modal-container.mod-dim .modal.${p}review-modal {
	max-width: 480px;
	width: 90%;
}
.${p}review-modal .modal-title {
	text-align: center;
	width: 100%;
}
.${p}review-intro {
	color: var(--text-muted);
	font-size: var(--font-ui-small);
	margin: 0 0 1rem;
	text-align: center;
}
.${p}review-stars {
	display: flex;
	justify-content: center;
	gap: 0.3rem;
	margin-bottom: 1rem;
}
.${p}review-star {
	background: transparent;
	border: none;
	box-shadow: none;
	cursor: pointer;
	font-size: 2rem;
	line-height: 1;
	padding: 0.1rem 0.2rem;
	color: var(--text-faint);
	transition: color 0.12s ease, transform 0.12s ease;
}
.${p}review-star:hover {
	transform: scale(1.1);
	color: var(--text-accent);
}
.${p}review-star-filled {
	color: var(--text-accent);
}
.${p}review-star:focus-visible {
	outline: 2px solid var(--interactive-accent);
	border-radius: 4px;
}
.${p}review-text {
	width: 100%;
	min-height: 6rem;
	resize: vertical;
	margin-bottom: 0.8rem;
}
.${p}review-error {
	color: var(--text-error);
	font-size: var(--font-ui-small);
	margin: 0 0 0.8rem;
}
.${p}review-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.5rem;
}
.${p}review-thanks {
	text-align: center;
	padding: 1rem 0 0.4rem;
}
.${p}review-thanks-title {
	font-size: var(--font-ui-large);
	font-weight: 600;
	margin-bottom: 0.4rem;
}
.${p}review-thanks-body {
	color: var(--text-muted);
	margin-bottom: 1rem;
}
`;
}
