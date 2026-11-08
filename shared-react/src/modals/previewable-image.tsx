import { memo, useCallback, useState, type KeyboardEvent } from "react";

import { useCachedImageSrc } from "../hooks/dom/use-cached-image";
import { useScopedStyles } from "../hooks/styles/use-styles";
import { ImageLightbox } from "./image-lightbox";

export interface PreviewableImageProps {
	/** Remote image URL — fetched once, kept in Cache Storage, shown offline afterwards. */
	src: string;
	/** Accessible name of the control and the label of the enlarged preview. */
	label: string;
	/** Placement classes on the clickable element; the shared styles set no size. */
	className?: string | undefined;
	imageClassName?: string | undefined;
	/** Overrides the scoped `previewable-image` testid when a placement already owns one. */
	testId?: string | undefined;
	loading?: "eager" | "lazy" | undefined;
}

/**
 * A remote image that opens full-size on click: cached for offline use, hidden when it
 * cannot load (Electron paints a broken-image frame even for `alt=""`), and dismissed by
 * Escape, the ✕ or a backdrop click without closing whatever it was opened from.
 *
 * The keyed child resets failed loads and open previews when the source changes.
 */
export const PreviewableImage = memo(function PreviewableImage(props: PreviewableImageProps) {
	return <PreviewableImageContent key={props.src} {...props} />;
});

function PreviewableImageContent({ src, label, className, imageClassName, testId, loading }: PreviewableImageProps) {
	const { cls, tid } = useScopedStyles("previewable-image", buildPreviewableImageStyles);
	const resolvedSrc = useCachedImageSrc(src);
	const [enlarged, setEnlarged] = useState(false);
	const [failed, setFailed] = useState(false);
	const open = useCallback(() => setEnlarged(true), []);
	const close = useCallback(() => setEnlarged(false), []);
	const onKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (event.key !== "Enter" && event.key !== " ") return;
			event.preventDefault();
			open();
		},
		[open]
	);

	if (failed || resolvedSrc === null) return null;

	return (
		<>
			<div
				role="button"
				tabIndex={0}
				className={className ? `${cls()} ${className}` : cls()}
				aria-label={label}
				title={label}
				onClick={open}
				onKeyDown={onKeyDown}
				data-testid={testId ?? tid()}
			>
				{/* alt="" — the control carries the accessible name. */}
				<img
					className={imageClassName ? `${cls("img")} ${imageClassName}` : cls("img")}
					src={resolvedSrc}
					alt=""
					draggable={false}
					loading={loading}
					onError={() => setFailed(true)}
				/>
			</div>
			{enlarged && <ImageLightbox src={resolvedSrc} label={label} onClose={close} />}
		</>
	);
}

function buildPreviewableImageStyles(p: string): string {
	return `
.${p}previewable-image {
	cursor: zoom-in;
}
.${p}previewable-image:focus-visible {
	outline: 2px solid var(--interactive-accent);
	outline-offset: 2px;
}
.${p}previewable-image-img {
	display: block;
	max-width: 100%;
}
`;
}
