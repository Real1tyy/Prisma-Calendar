import { cls } from "@real1ty-obsidian-plugins";
import { PRO_PURCHASE_URL } from "../../core/license";

export function renderProUpgradeBanner(containerEl: HTMLElement, featureName: string, description: string): void {
	const banner = containerEl.createDiv(cls("pro-upgrade-banner"));

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

	const link = banner.createEl("a", {
		text: "Learn more about Pro",
		cls: cls("pro-upgrade-link"),
		href: PRO_PURCHASE_URL,
	});
	link.setAttr("target", "_blank");
	link.setAttr("rel", "noopener noreferrer");
}
