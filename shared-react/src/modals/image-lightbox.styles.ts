/**
 * Stylesheet for the full-viewport image preview. Sits above Obsidian's modal
 * layer (`--layer-modal` is 100) because it is opened *from* a modal and must
 * cover it. Colours come from theme variables so it adapts to light/dark.
 */
export function buildImageLightboxStyles(p: string): string {
	return `
.${p}image-lightbox {
	position: fixed;
	inset: 0;
	z-index: 300;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 3rem;
	background: rgba(0, 0, 0, 0.82);
	backdrop-filter: blur(2px);
	cursor: zoom-out;
}
.${p}image-lightbox-image {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
	border-radius: var(--radius-m);
	box-shadow: 0 0.5rem 2rem rgba(0, 0, 0, 0.55);
	cursor: default;
}
.${p}image-lightbox button.${p}image-lightbox-close {
	position: absolute;
	top: 1rem;
	right: 1rem;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 2.4rem;
	height: 2.4rem;
	padding: 0;
	font-size: var(--font-ui-medium);
	line-height: 1;
	color: var(--text-on-accent);
	background: rgba(255, 255, 255, 0.14);
	border: 1px solid rgba(255, 255, 255, 0.28);
	border-radius: 50%;
	cursor: pointer;
}
.${p}image-lightbox button.${p}image-lightbox-close:hover {
	background: rgba(255, 255, 255, 0.26);
}
.${p}image-lightbox button.${p}image-lightbox-close:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}
`;
}
