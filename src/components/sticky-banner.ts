import { addCls, cls } from "@real1ty-obsidian-plugins";

export interface StickyBannerHandle {
	destroy(): void;
}

export function createStickyBanner(container: HTMLElement, message: string, onCancel: () => void): StickyBannerHandle {
	const bannerEl = container.createDiv(cls("prereq-selection-banner"));

	const textEl = bannerEl.createDiv(cls("prereq-selection-banner-text"));
	textEl.setText(message);

	const cancelBtn = bannerEl.createEl("button", { text: "Cancel" });
	addCls(cancelBtn, "prereq-selection-btn");
	cancelBtn.addEventListener("click", onCancel);

	const escapeHandler = (e: KeyboardEvent): void => {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			onCancel();
		}
	};
	document.addEventListener("keydown", escapeHandler, true);

	return {
		destroy() {
			bannerEl.remove();
			document.removeEventListener("keydown", escapeHandler, true);
		},
	};
}
