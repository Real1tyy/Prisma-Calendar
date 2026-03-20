import { cls } from "@real1ty-obsidian-plugins";

import { PRO_PURCHASE_URL } from "../../core/license";
import {
	getFeatureDocUrl,
	getFeaturePreviewSrc,
	getFeaturePurchaseUrl,
	type ProFeatureKey,
} from "../../core/pro-feature-previews";

export function renderProUpgradeBanner(
	containerEl: HTMLElement,
	featureName: string,
	description: string,
	previewKey?: ProFeatureKey
): void {
	const banner = containerEl.createDiv(cls("pro-upgrade-banner"));

	if (previewKey) {
		const previewSrc = getFeaturePreviewSrc(previewKey);
		if (previewSrc) {
			const imgContainer = banner.createDiv(cls("pro-upgrade-preview"));
			const img = imgContainer.createEl("img", {
				cls: cls("pro-upgrade-preview-img"),
				attr: { src: previewSrc, alt: `${featureName} preview`, loading: "lazy" },
			});
			img.setAttr("draggable", "false");
			imgContainer.addEventListener("click", () => openImageLightbox(previewSrc, featureName));
		}
	}

	banner.createEl("span", {
		text: "PRO",
		cls: cls("pro-upgrade-badge"),
	});

	banner.createEl("h3", {
		text: featureName,
		cls: cls("pro-upgrade-title"),
	});

	banner.createEl("p", {
		text: description,
		cls: cls("pro-upgrade-description"),
	});

	const actions = banner.createDiv(cls("pro-upgrade-actions"));

	if (previewKey) {
		const docLink = actions.createEl("a", {
			text: "View full feature documentation →",
			cls: cls("pro-upgrade-doc-link"),
			href: getFeatureDocUrl(previewKey),
		});
		docLink.setAttr("target", "_blank");
		docLink.setAttr("rel", "noopener");
	}

	const purchaseUrl = previewKey ? getFeaturePurchaseUrl(previewKey) : PRO_PURCHASE_URL;
	const proLink = actions.createEl("a", {
		text: "Get Prisma Calendar Pro",
		cls: cls("pro-upgrade-link"),
		href: purchaseUrl,
	});
	proLink.setAttr("target", "_blank");
	proLink.setAttr("rel", "noopener");
}

function openImageLightbox(src: string, alt: string): void {
	const overlay = document.body.createDiv(cls("pro-lightbox-overlay"));

	const img = overlay.createEl("img", {
		cls: cls("pro-lightbox-img"),
		attr: { src, alt },
	});
	img.setAttr("draggable", "false");

	const close = (): void => overlay.remove();
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close();
	});
	document.addEventListener("keydown", function handler(e) {
		if (e.key === "Escape") {
			close();
			document.removeEventListener("keydown", handler);
		}
	});
}
