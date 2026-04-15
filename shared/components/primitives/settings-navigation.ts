import { TextComponent } from "obsidian";

import { createCssUtils } from "../../utils/css-utils";
import { injectStyleSheet } from "../../utils/styles/inject";

const MIN_SEARCH_LENGTH = 2;

export interface SettingsSection {
	id: string;
	label: string;
	display(containerEl: HTMLElement): void;
	hide?(): void;
}

export interface SettingsFooterLink {
	text: string;
	href: string;
}

export interface SettingsNavigationConfig {
	cssPrefix: string;
	sections: SettingsSection[];
	footerLinks?: SettingsFooterLink[];
}

function buildStyleRules(prefix: string): string {
	const p = prefix;
	return `
.${p}settings-nav {
	margin-bottom: 24px;
	border-bottom: 1px solid var(--background-modifier-border);
	padding-bottom: 16px;
}

.${p}nav-buttons {
	display: flex;
	align-items: center;
	gap: 8px;
	flex-wrap: wrap;
}

.${p}nav-buttons button {
	padding: 8px 16px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background-color: var(--background-secondary);
	color: var(--text-normal);
	cursor: pointer;
	transition: all 0.2s ease;
	font-size: var(--font-ui-small);
}

.${p}nav-buttons button.${p}active {
	background-color: var(--interactive-accent);
	color: var(--text-on-accent);
	border-color: var(--interactive-accent);
}

.${p}nav-buttons button:hover:not(.${p}active) {
	background-color: var(--background-modifier-hover);
}

.${p}settings-search {
	margin-left: auto;
	flex-shrink: 0;
}

.${p}settings-search-input {
	padding: 6px 10px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 6px;
	background-color: var(--background-secondary);
	color: var(--text-normal);
	font-size: var(--font-ui-small);
	width: 150px;
	transition: width 0.2s ease;
}

.${p}settings-search-input:focus {
	border-color: var(--interactive-accent);
	box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.2);
	width: 200px;
}

.${p}settings-search-section {
	margin-bottom: 8px;
}

.${p}settings-search-no-results {
	padding: 24px;
	text-align: center;
	color: var(--text-muted);
	font-style: italic;
}

.${p}settings-footer {
	margin-top: 2rem;
	text-align: center;
	font-size: var(--font-ui-smaller);
	color: var(--text-faint);
}

.${p}settings-footer-links {
	display: flex;
	justify-content: center;
	gap: 1rem;
	flex-wrap: wrap;
}

.${p}settings-support-link {
	text-decoration: none;
	color: var(--text-accent);
}

.${p}settings-support-link:hover {
	text-decoration: underline;
}
`;
}

function injectStyles(prefix: string): void {
	injectStyleSheet(`${prefix}settings-nav-styles`, buildStyleRules(prefix));
}

export class SettingsNavigation {
	private activeSectionIndex = 0;
	private searchQuery = "";
	private sections: SettingsSection[];
	private footerLinks: SettingsFooterLink[];
	private contentContainer: HTMLElement | null = null;
	private navButtons: HTMLElement[] = [];
	private searchInput: TextComponent | null = null;
	private css;
	private cssPrefix: string;

	constructor(config: SettingsNavigationConfig) {
		this.sections = config.sections;
		this.footerLinks = config.footerLinks ?? [];
		this.cssPrefix = config.cssPrefix;
		this.css = createCssUtils(config.cssPrefix);
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();
		injectStyles(this.cssPrefix);
		this.createNavBar(containerEl);
		this.contentContainer = containerEl.createDiv(this.css.cls("settings-content"));
		this.renderContent();

		if (this.footerLinks.length > 0) {
			this.renderFooter(containerEl);
		}
	}

	hide(): void {
		this.sections[this.activeSectionIndex].hide?.();
	}

	private createNavBar(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv(this.css.cls("settings-nav"));
		const buttonContainer = navContainer.createDiv(this.css.cls("nav-buttons"));

		this.navButtons = [];
		this.sections.forEach((section, index) => {
			const button = buttonContainer.createEl("button", {
				text: section.label,
			});
			button.setAttribute("data-testid", `${this.cssPrefix}settings-tab-${section.id}`);
			if (!this.searchQuery && this.activeSectionIndex === index) {
				this.css.addCls(button, "active");
			}

			button.addEventListener("click", () => {
				this.sections[this.activeSectionIndex].hide?.();
				this.activeSectionIndex = index;
				this.searchQuery = "";
				if (this.searchInput) this.searchInput.setValue("");
				this.updateNavActiveState();
				this.renderContent();
			});

			this.navButtons.push(button);
		});

		const searchContainer = buttonContainer.createDiv(this.css.cls("settings-search"));
		this.searchInput = new TextComponent(searchContainer);
		this.searchInput.setPlaceholder("Search settings...");
		this.searchInput.setValue(this.searchQuery);
		this.css.addCls(this.searchInput.inputEl, "settings-search-input");

		let debounceTimer: ReturnType<typeof setTimeout> | null = null;

		const applySearch = () => {
			const value = this.searchInput!.inputEl.value;
			if (value === this.searchQuery) return;
			this.searchQuery = value;
			this.updateNavActiveState();
			this.renderContent();
		};

		this.searchInput.inputEl.addEventListener("input", () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(applySearch, 300);
		});

		this.searchInput.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				if (debounceTimer) clearTimeout(debounceTimer);
				applySearch();
			}
		});

		this.searchInput.inputEl.addEventListener("blur", () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			applySearch();
		});
	}

	private updateNavActiveState(): void {
		this.navButtons.forEach((button, index) => {
			if (!this.searchQuery && this.activeSectionIndex === index) {
				this.css.addCls(button, "active");
			} else {
				this.css.removeCls(button, "active");
			}
		});
	}

	private renderContent(): void {
		if (!this.contentContainer) return;
		this.contentContainer.empty();

		const query = this.searchQuery.trim();
		if (query.length >= MIN_SEARCH_LENGTH) {
			this.renderAllSectionsFiltered(this.contentContainer, query.toLowerCase());
		} else {
			this.sections[this.activeSectionIndex].display(this.contentContainer);
		}
	}

	private renderAllSectionsFiltered(containerEl: HTMLElement, query: string): void {
		let hasAnyMatch = false;

		for (const section of this.sections) {
			const sectionWrapper = containerEl.createDiv(this.css.cls("settings-search-section"));
			const contentContainer = sectionWrapper.createDiv();

			section.display(contentContainer);

			const settingItems = contentContainer.querySelectorAll<HTMLElement>(".setting-item");
			let sectionHasMatch = false;

			const matchStates = new Map<HTMLElement, boolean>();
			settingItems.forEach((item) => {
				if (item.classList.contains("setting-item-heading")) return;
				const name = item.querySelector(".setting-item-name")?.textContent ?? "";
				const desc = item.querySelector(".setting-item-description")?.textContent ?? "";
				const matches = (name + " " + desc).toLowerCase().includes(query);
				matchStates.set(item, matches);
				if (matches) sectionHasMatch = true;
			});

			if (!sectionHasMatch) {
				sectionWrapper.remove();
				continue;
			}

			hasAnyMatch = true;

			let currentHeading: HTMLElement | null = null;
			let headingHasVisibleChild = false;

			settingItems.forEach((item) => {
				if (item.classList.contains("setting-item-heading")) {
					if (currentHeading) {
						currentHeading.style.display = headingHasVisibleChild ? "" : "none";
					}
					currentHeading = item;
					headingHasVisibleChild = false;
				} else {
					const matches = matchStates.get(item) ?? false;
					item.style.display = matches ? "" : "none";
					if (matches) headingHasVisibleChild = true;
				}
			});

			if (currentHeading) {
				(currentHeading as HTMLElement).style.display = headingHasVisibleChild ? "" : "none";
			}

			const allChildren = contentContainer.children;
			for (let i = 0; i < allChildren.length; i++) {
				const child = allChildren[i] as HTMLElement;
				if (child.classList.contains("setting-item")) continue;
				const text = child.textContent?.toLowerCase() ?? "";
				child.style.display = text.includes(query) ? "" : "none";
			}
		}

		if (!hasAnyMatch) {
			const noResults = containerEl.createDiv(this.css.cls("settings-search-no-results"));
			noResults.textContent = `No settings found for "${this.searchQuery}"`;
		}
	}

	private renderFooter(containerEl: HTMLElement): void {
		const footerEl = containerEl.createDiv({
			cls: `setting-item ${this.css.cls("settings-footer")}`,
		});

		const linksContainer = footerEl.createDiv(this.css.cls("settings-footer-links"));

		for (const link of this.footerLinks) {
			linksContainer.createEl("a", {
				text: link.text,
				href: link.href,
				cls: this.css.cls("settings-support-link"),
			});
		}
	}
}
