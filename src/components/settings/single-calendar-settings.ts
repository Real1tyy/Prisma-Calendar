import { addCls, cls, removeCls } from "@real1ty-obsidian-plugins";
import { TextComponent, type App } from "obsidian";
import type { CalendarSettingsStore, SettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import {
	BasesSettings,
	CalendarSettings,
	CategoriesSettings,
	ConfigurationSettings,
	EventGroupsSettings,
	GeneralSettings,
	IntegrationsSettings,
	NotificationsSettings,
	PropertiesSettings,
	RulesSettings,
} from ".";

const MIN_SEARCH_LENGTH = 2;

interface SettingsSection {
	id: string;
	label: string;
	settings: { display: (containerEl: HTMLElement) => void };
}

export class SingleCalendarSettings {
	private activeSectionIndex = 0;
	private searchQuery = "";
	private sections: SettingsSection[];
	private contentContainer: HTMLElement | null = null;
	private navButtons: HTMLElement[] = [];
	private searchInput: TextComponent | null = null;

	constructor(
		settingsStore: CalendarSettingsStore,
		app: App,
		plugin: CustomCalendarPlugin,
		mainSettingsStore: SettingsStore
	) {
		this.sections = [
			{ id: "general", label: "General", settings: new GeneralSettings(settingsStore, app, plugin) },
			{ id: "properties", label: "Properties", settings: new PropertiesSettings(settingsStore) },
			{ id: "calendar", label: "Calendar", settings: new CalendarSettings(settingsStore) },
			{ id: "event-groups", label: "Event Groups", settings: new EventGroupsSettings(settingsStore) },
			{ id: "configuration", label: "Configuration", settings: new ConfigurationSettings(settingsStore) },
			{ id: "notifications", label: "Notifications", settings: new NotificationsSettings(settingsStore) },
			{ id: "rules", label: "Rules", settings: new RulesSettings(settingsStore) },
			{ id: "categories", label: "Categories", settings: new CategoriesSettings(settingsStore, plugin) },
			{ id: "bases", label: "Bases", settings: new BasesSettings(settingsStore) },
			{
				id: "integrations",
				label: "Integrations",
				settings: new IntegrationsSettings(settingsStore, app, plugin, mainSettingsStore),
			},
		];
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();

		this.createNavBar(containerEl);
		this.contentContainer = containerEl.createDiv(cls("settings-content"));
		this.renderContent();
	}

	private createNavBar(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv(cls("settings-nav"));
		const buttonContainer = navContainer.createDiv(cls("nav-buttons"));

		this.navButtons = [];
		this.sections.forEach((section, index) => {
			const button = buttonContainer.createEl("button", {
				text: section.label,
			});
			if (!this.searchQuery && this.activeSectionIndex === index) {
				addCls(button, "active");
			}

			button.addEventListener("click", () => {
				this.activeSectionIndex = index;
				this.searchQuery = "";
				if (this.searchInput) this.searchInput.setValue("");
				this.updateNavActiveState();
				this.renderContent();
			});

			this.navButtons.push(button);
		});

		const searchContainer = navContainer.createDiv(cls("settings-search"));
		this.searchInput = new TextComponent(searchContainer);
		this.searchInput.setPlaceholder("Search settings...");
		this.searchInput.setValue(this.searchQuery);
		addCls(this.searchInput.inputEl, "settings-search-input");

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
				addCls(button, "active");
			} else {
				removeCls(button, "active");
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
			this.sections[this.activeSectionIndex].settings.display(this.contentContainer);
		}
	}

	private renderAllSectionsFiltered(containerEl: HTMLElement, query: string): void {
		let hasAnyMatch = false;

		for (const section of this.sections) {
			const sectionWrapper = containerEl.createDiv(cls("settings-search-section"));
			const contentContainer = sectionWrapper.createDiv();

			section.settings.display(contentContainer);

			const settingItems = contentContainer.querySelectorAll<HTMLElement>(".setting-item");
			let sectionHasMatch = false;

			// First pass: determine which non-heading items match (only match on name + description)
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

			// Second pass: show/hide items. Keep headings visible if any following item (before the next heading) matches.
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

			// Hide non-setting-item elements (info boxes, descriptions) that don't contain matches
			const allChildren = contentContainer.children;
			for (let i = 0; i < allChildren.length; i++) {
				const child = allChildren[i] as HTMLElement;
				if (child.classList.contains("setting-item")) continue;
				const text = child.textContent?.toLowerCase() ?? "";
				child.style.display = text.includes(query) ? "" : "none";
			}
		}

		if (!hasAnyMatch) {
			const noResults = containerEl.createDiv(cls("settings-search-no-results"));
			noResults.textContent = `No settings found for "${this.searchQuery}"`;
		}
	}
}
