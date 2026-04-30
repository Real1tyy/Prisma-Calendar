import { memo, useCallback } from "react";

import { PRO_PURCHASE_URL } from "../../core/license";
import {
	getFeatureDocUrl,
	getFeaturePreviewSrc,
	getFeaturePurchaseUrl,
	type ProFeatureKey,
} from "../../core/pro-feature-previews";

interface ProUpgradeBannerProps {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey;
}

export const ProUpgradeBanner = memo(function ProUpgradeBanner({
	featureName,
	description,
	previewKey,
}: ProUpgradeBannerProps) {
	const purchaseUrl = previewKey ? getFeaturePurchaseUrl(previewKey) : PRO_PURCHASE_URL;
	const previewSrc = previewKey ? getFeaturePreviewSrc(previewKey) : null;
	const docUrl = previewKey ? getFeatureDocUrl(previewKey) : null;

	const handleImageClick = useCallback(() => {
		if (previewSrc) openImageLightbox(previewSrc, featureName);
	}, [previewSrc, featureName]);

	return (
		<div
			className="prisma-pro-upgrade-banner"
			{...(previewKey ? { "data-testid": `prisma-pro-gate-${previewKey}` } : {})}
		>
			{previewSrc && (
				<div className="prisma-pro-upgrade-preview" onClick={handleImageClick}>
					<img
						className="prisma-pro-upgrade-preview-img"
						src={previewSrc}
						alt={`${featureName} preview`}
						loading="lazy"
						draggable={false}
					/>
				</div>
			)}
			<span className="prisma-pro-upgrade-badge">PRO</span>
			<h3 className="prisma-pro-upgrade-title">{featureName}</h3>
			<p className="prisma-pro-upgrade-description">{description}</p>
			<p className="prisma-pro-upgrade-trial">Try every Pro feature with a 30-day free trial — cancel anytime.</p>
			<div className="prisma-pro-upgrade-actions">
				{docUrl && (
					<a className="prisma-pro-upgrade-doc-link" href={docUrl} target="_blank" rel="noopener">
						View full feature documentation &rarr;
					</a>
				)}
				<a className="prisma-pro-upgrade-link" href={purchaseUrl} target="_blank" rel="noopener">
					Start your free trial
				</a>
			</div>
		</div>
	);
});

function openImageLightbox(src: string, alt: string): void {
	const overlay = document.createElement("div");
	overlay.className = "prisma-pro-lightbox-overlay";

	const img = document.createElement("img");
	img.className = "prisma-pro-lightbox-img";
	img.src = src;
	img.alt = alt;
	img.draggable = false;
	overlay.appendChild(img);

	const close = (): void => overlay.remove();
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});
	const handler = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			close();
			document.removeEventListener("keydown", handler);
		}
	};
	document.addEventListener("keydown", handler);
	document.body.appendChild(overlay);
}
