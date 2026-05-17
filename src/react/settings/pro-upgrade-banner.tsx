import { buildUtmUrl } from "@real1ty-obsidian-plugins";
import { memo, useCallback } from "react";

import { cls, tid } from "../../constants";
import { PRO_PURCHASE_URL } from "../../core/license";
import {
	getFeatureDocUrl,
	getFeaturePreviewSrc,
	getFeaturePurchaseUrl,
	type ProFeatureKey,
} from "../../core/pro-feature-previews";

const FREE_VS_PRO_URL = "https://real1tyy.github.io/Prisma-Calendar/features/free-vs-pro";

interface ProUpgradeBannerProps {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey | undefined;
}

export const ProUpgradeBanner = memo(function ProUpgradeBanner({
	featureName,
	description,
	previewKey,
}: ProUpgradeBannerProps) {
	const purchaseUrl = previewKey ? getFeaturePurchaseUrl(previewKey) : PRO_PURCHASE_URL;
	const previewSrc = previewKey ? getFeaturePreviewSrc(previewKey) : null;
	const docUrl = previewKey ? getFeatureDocUrl(previewKey) : null;
	const learnMoreUrl = buildUtmUrl(FREE_VS_PRO_URL, "prisma-calendar", "plugin", "pro_gate", "learn_more");

	const handleImageClick = useCallback(() => {
		if (previewSrc) openImageLightbox(previewSrc, featureName);
	}, [previewSrc, featureName]);

	return (
		<div className={cls("pro-upgrade-banner")} {...(previewKey ? { "data-testid": tid("pro-gate", previewKey) } : {})}>
			{previewSrc && (
				<div className={cls("pro-upgrade-preview")} onClick={handleImageClick}>
					<img
						className={cls("pro-upgrade-preview-img")}
						src={previewSrc}
						alt={`${featureName} preview`}
						loading="lazy"
						draggable={false}
					/>
				</div>
			)}
			<span className={cls("pro-upgrade-badge")}>PRO</span>
			<h3 className={cls("pro-upgrade-title")}>{featureName}</h3>
			<p className={cls("pro-upgrade-description")}>{description}</p>
			<p className={cls("pro-upgrade-trial")}>
				Try every Pro feature with a 30-day free trial &mdash; cancel anytime.{" "}
				<a className={cls("pro-upgrade-learn-more")} href={learnMoreUrl} target="_blank" rel="noopener">
					Learn more about Pro
				</a>
			</p>
			<div className={cls("pro-upgrade-actions")}>
				{docUrl && (
					<a className={cls("pro-upgrade-doc-link")} href={docUrl} target="_blank" rel="noopener">
						View full feature documentation &rarr;
					</a>
				)}
				<a className={cls("pro-upgrade-link")} href={purchaseUrl} target="_blank" rel="noopener">
					Start your free trial
				</a>
			</div>
		</div>
	);
});

function openImageLightbox(src: string, alt: string): void {
	const overlay = activeDocument.createElement("div");
	overlay.className = cls("pro-lightbox-overlay");

	const img = activeDocument.createElement("img");
	img.className = cls("pro-lightbox-img");
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
			activeDocument.removeEventListener("keydown", handler);
		}
	};
	activeDocument.addEventListener("keydown", handler);
	activeDocument.body.appendChild(overlay);
}
