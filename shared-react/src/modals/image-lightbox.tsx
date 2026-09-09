import { memo, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useOwnerDocument } from "../contexts/theme-context";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { buildImageLightboxStyles } from "./image-lightbox.styles";

export interface ImageLightboxProps {
	/** Fully-formed `src` — a data URL or a resource path. */
	src: string;
	/** Describes the image for screen readers and as the `img` alt. */
	label: string;
	onClose: () => void;
}

/**
 * Full-viewport preview for an image that is otherwise a thumbnail. Closes on
 * the ✕, on a backdrop click, and on Escape.
 *
 * Portalled to the owner document's body rather than rendered in place: the host
 * is usually an Obsidian `Modal`, whose stacking context and transform would
 * otherwise trap a `position: fixed` overlay inside the dialog. The *owner*
 * document (not the global one) is what keeps this working in a popped-out
 * window.
 */
export const ImageLightbox = memo(function ImageLightbox({ src, label, onClose }: ImageLightboxProps) {
	const { cls, tid } = useScopedStyles("image-lightbox", buildImageLightboxStyles);
	const ownerDocument = useOwnerDocument();
	const closeRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		closeRef.current?.focus();
	}, []);

	useEffect(() => {
		// Capture phase, and immediate propagation stopped: Obsidian's modal binds
		// its own Escape handler, so without this the first Escape would dismiss
		// the whole feedback modal — losing the user's text — instead of just the
		// preview they opened.
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			event.stopImmediatePropagation();
			onClose();
		};
		ownerDocument.addEventListener("keydown", onKeyDown, true);
		return () => ownerDocument.removeEventListener("keydown", onKeyDown, true);
	}, [onClose, ownerDocument]);

	// A backdrop click closes; a click that started on the image itself does not.
	const handleBackdropClick = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (event.target === event.currentTarget) onClose();
		},
		[onClose]
	);

	return createPortal(
		<div
			className={cls()}
			role="dialog"
			aria-modal="true"
			aria-label={label}
			onClick={handleBackdropClick}
			data-testid={tid()}
		>
			<button
				ref={closeRef}
				type="button"
				className={cls("close")}
				aria-label="Close preview"
				onClick={onClose}
				data-testid={tid("close")}
			>
				✕
			</button>
			<img className={cls("image")} src={src} alt={label} data-testid={tid("image")} />
		</div>,
		ownerDocument.body
	);
});
