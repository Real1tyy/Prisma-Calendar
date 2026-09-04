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
	gap: 0;
	margin-bottom: 1rem;
}
.${p}review-modal button.${p}review-star-half {
	appearance: none;
	align-items: center;
	background: transparent;
	border: 0;
	border-radius: 0;
	box-shadow: none;
	color: #c89b2b;
	cursor: pointer;
	display: inline-flex;
	filter: none;
	font-size: 2.15rem;
	height: 2.35rem;
	justify-content: flex-start;
	line-height: 1;
	min-width: 0;
	opacity: 0.62;
	overflow: hidden;
	padding: 0;
	width: 1.075rem;
	transition: color 0.12s ease, filter 0.12s ease, opacity 0.12s ease;
}
.${p}review-star-half span {
	display: block;
	flex: 0 0 2.15rem;
	width: 2.15rem;
}
.${p}review-star-right {
	margin-right: 0.28rem;
}
.${p}review-star-right span {
	transform: translateX(-1.075rem);
}
.${p}review-modal button.${p}review-star-half:hover {
	background: transparent;
	color: #ffd54a;
	filter: drop-shadow(0 0 0.22rem rgba(255, 193, 7, 0.58));
	opacity: 1;
}
.${p}review-modal button.${p}review-star-half.${p}review-star-filled {
	color: #ffc107;
	filter: drop-shadow(0 0 0.16rem rgba(255, 193, 7, 0.42));
	opacity: 1;
}
.${p}review-modal button.${p}review-star-half:focus-visible {
	background: transparent;
	border-radius: 3px;
	outline: 2px solid #ffc107;
	outline-offset: 2px;
}
.${p}review-text {
	width: 100%;
	min-height: 6rem;
	resize: vertical;
	margin-bottom: 0.8rem;
}
.${p}review-license-option {
	align-items: flex-start;
	color: var(--text-muted);
	display: flex;
	font-size: var(--font-ui-smaller);
	gap: 0.5rem;
	margin: 0 0 0.8rem;
}
.${p}review-license-option input {
	margin-top: 0.15rem;
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
