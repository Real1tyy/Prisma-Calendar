import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils";
import { nanoid } from "nanoid";
import { Setting } from "obsidian";
import type { Subscription } from "rxjs";
import type { CategoryInfo, CategoryTracker } from "../../core/category-tracker";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";
import type { CategoryAssignmentPreset, SingleCalendarConfigSchema } from "../../types/settings";
import { type ChartDataItem, createChartCanvas, PieChartBuilder } from "../../utils/chart-utils";
import { CategoryEventsModal } from "../modals/category-events-modal";

interface CategoryInfoWithCount extends CategoryInfo {
	count: number;
}

export class CategoriesSettings {
	private chartBuilder: PieChartBuilder | null = null;
	private categoriesSubscription: Subscription | null = null;
	private chartContainer: HTMLElement | null = null;
	private categoriesListContainer: HTMLElement | null = null;
	private categoryTracker: CategoryTracker | null = null;
	private categoryProp: string;
	private categoryAssignmentPresetsContainer: HTMLElement | null = null;
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private plugin: CustomCalendarPlugin
	) {
		this.ui = new SettingsUIBuilder(this.settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();
		this.categoriesSubscription?.unsubscribe();
		this.chartBuilder?.destroy();
		this.chartBuilder = null;
		this.chartContainer = null;
		this.categoriesListContainer = null;

		const bundle = this.plugin.calendarBundles.find((b) => b.calendarId === this.settingsStore.calendarId);
		if (!bundle) {
			containerEl.createEl("p", {
				text: "Calendar bundle not found. Please refresh the settings.",
				cls: "setting-item-description",
			});
			return;
		}

		this.categoryTracker = bundle.categoryTracker;
		const settings = this.settingsStore.currentSettings;
		this.categoryProp = settings.categoryProp;

		new Setting(containerEl).setName("Categories").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: `Categories are automatically detected from the "${this.categoryProp}" property in your events. Configure colors for each category below.`,
		});

		this.categoriesListContainer = containerEl.createDiv();
		this.renderCategoriesList(this.categoriesListContainer, this.categoryTracker, this.categoryProp);

		this.categoriesSubscription = this.categoryTracker.categories$.subscribe(() => {
			this.renderCategoriesList(this.categoriesListContainer!, this.categoryTracker!, this.categoryProp);
			const canvas = this.chartContainer?.querySelector("canvas");
			if (canvas) {
				this.updateChart(this.categoryTracker!, this.categoryProp, canvas as HTMLCanvasElement);
			}
		});

		const chartSection = containerEl.createDiv(cls("categories-chart-section"));
		chartSection.createEl("h3", { text: "Category distribution" });
		this.chartContainer = chartSection.createDiv(cls("categories-chart-container"));
		const canvas = createChartCanvas(this.chartContainer, "categories-chart");
		this.updateChart(this.categoryTracker, this.categoryProp, canvas);

		this.addAutoAssignmentSettings(containerEl);
	}

	private addAutoAssignmentSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Auto-assign categories").setHeading();

		const descContainer = containerEl.createDiv();
		descContainer.createEl("p", {
			text: "Automatically assign categories to events during creation based on the event name.",
		});

		// Auto-assign when name matches category
		this.ui.addToggle(containerEl, {
			key: "autoAssignCategoryByName",
			name: "Auto-assign when name matches category",
			desc: "Automatically assign a category when the event name (without ZettelID) matches a category name (case-insensitive). Example: creating an event named 'Health' will auto-assign the 'health' category.",
		});

		// Custom assignment presets
		new Setting(containerEl)
			.setName("Custom category assignment presets")
			.setDesc(
				"Define custom rules to auto-assign categories based on event names. Each preset can assign multiple categories to events with a specific name."
			);

		const examplesContainer = containerEl.createDiv(cls("settings-info-box"));
		examplesContainer.createEl("strong", { text: "Example:" });
		const examplesList = examplesContainer.createEl("ul");
		examplesList.createEl("li", {
			text: "Event name: 'Coding' → Auto-assign categories: Software, Business",
		});

		this.categoryAssignmentPresetsContainer = containerEl.createDiv();
		this.renderCategoryAssignmentPresets(this.categoryAssignmentPresetsContainer);

		// Add preset button
		const addButton = containerEl.createEl("button", {
			text: "Add preset",
			cls: cls("settings-button"),
		});
		addButton.addEventListener("click", () => {
			void this.addCategoryAssignmentPreset();
		});
	}

	private renderCategoryAssignmentPresets(container: HTMLElement): void {
		container.empty();

		const settings = this.settingsStore.currentSettings;
		const presets = settings.categoryAssignmentPresets || [];

		if (presets.length === 0) {
			const emptyState = container.createDiv(cls("category-assignment-empty"));
			emptyState.textContent = "No custom category assignment presets defined.";
			return;
		}

		const availableCategories = this.categoryTracker?.getCategories() || [];

		for (const preset of presets) {
			const presetContainer = container.createDiv(cls("category-assignment-preset"));

			// Event name input
			const nameInput = presetContainer.createEl("input", {
				type: "text",
				value: preset.eventName,
				placeholder: "Event name (e.g., Coding)",
				cls: cls("category-assignment-name-input"),
			});
			nameInput.addEventListener("change", async () => {
				await this.updateCategoryAssignmentPreset(preset.id, {
					...preset,
					eventName: nameInput.value.trim(),
				});
			});

			// Categories dropdown (multi-select)
			const categoriesContainer = presetContainer.createDiv(cls("category-assignment-categories"));

			const categoriesSelectContainer = categoriesContainer.createDiv(cls("category-assignment-select-container"));

			// Display selected categories as tags
			const selectedContainer = categoriesSelectContainer.createDiv(cls("category-assignment-selected"));
			this.renderSelectedCategories(selectedContainer, preset);

			// Add category dropdown
			const addCategoryDropdown = categoriesSelectContainer.createEl("select", {
				cls: cls("category-assignment-add-dropdown"),
			});
			const defaultOption = addCategoryDropdown.createEl("option", {
				text: "Add category...",
				value: "",
			});
			addCategoryDropdown.appendChild(defaultOption);

			for (const category of availableCategories) {
				if (!preset.categories.includes(category)) {
					const option = addCategoryDropdown.createEl("option", {
						text: category,
						value: category,
					});
					addCategoryDropdown.appendChild(option);
				}
			}

			addCategoryDropdown.addEventListener("change", async () => {
				const selectedCategory = addCategoryDropdown.value;
				if (selectedCategory && !preset.categories.includes(selectedCategory)) {
					await this.updateCategoryAssignmentPreset(preset.id, {
						...preset,
						categories: [...preset.categories, selectedCategory],
					});
					this.renderCategoryAssignmentPresets(this.categoryAssignmentPresetsContainer!);
				}
			});

			// Delete preset button
			const deleteButton = presetContainer.createEl("button", {
				text: "Delete",
				cls: `${cls("settings-button")} ${cls("settings-button-danger")}`,
			});
			deleteButton.addEventListener("click", async () => {
				await this.deleteCategoryAssignmentPreset(preset.id);
			});
		}
	}

	private renderSelectedCategories(container: HTMLElement, preset: CategoryAssignmentPreset): void {
		container.empty();

		if (preset.categories.length === 0) {
			container.createEl("span", {
				text: "No categories selected",
				cls: cls("category-assignment-empty-selection"),
			});
			return;
		}

		for (const category of preset.categories) {
			const tag = container.createDiv(cls("category-assignment-tag"));
			tag.createEl("span", { text: category });

			const removeButton = tag.createEl("button", {
				text: "×",
				cls: cls("category-assignment-tag-remove"),
			});
			removeButton.addEventListener("click", async () => {
				await this.updateCategoryAssignmentPreset(preset.id, {
					...preset,
					categories: preset.categories.filter((c) => c !== category),
				});
				this.renderCategoryAssignmentPresets(this.categoryAssignmentPresetsContainer!);
			});
		}
	}

	private async addCategoryAssignmentPreset(): Promise<void> {
		const newPreset: CategoryAssignmentPreset = {
			id: nanoid(),
			eventName: "",
			categories: [],
		};

		await this.settingsStore.updateSettings((s) => ({
			...s,
			categoryAssignmentPresets: [...(s.categoryAssignmentPresets || []), newPreset],
		}));

		if (this.categoryAssignmentPresetsContainer) {
			this.renderCategoryAssignmentPresets(this.categoryAssignmentPresetsContainer);
		}
	}

	private async updateCategoryAssignmentPreset(id: string, updatedPreset: CategoryAssignmentPreset): Promise<void> {
		await this.settingsStore.updateSettings((s) => ({
			...s,
			categoryAssignmentPresets: (s.categoryAssignmentPresets || []).map((preset) =>
				preset.id === id ? updatedPreset : preset
			),
		}));
	}

	private async deleteCategoryAssignmentPreset(id: string): Promise<void> {
		await this.settingsStore.updateSettings((s) => ({
			...s,
			categoryAssignmentPresets: (s.categoryAssignmentPresets || []).filter((preset) => preset.id !== id),
		}));

		if (this.categoryAssignmentPresetsContainer) {
			this.renderCategoryAssignmentPresets(this.categoryAssignmentPresetsContainer);
		}
	}

	private renderCategoriesList(container: HTMLElement, categoryTracker: CategoryTracker, categoryProp: string): void {
		container.empty();

		const categories = categoryTracker.getCategories();
		const settings = this.settingsStore.currentSettings;

		if (categories.length === 0) {
			const emptyState = container.createDiv(cls("categories-empty-state"));
			emptyState.textContent = `No categories found. Add a "${categoryProp}" property to your events to see them here.`;
			return;
		}

		const categoriesInfo: CategoryInfoWithCount[] = categories.map((category) => {
			const files = categoryTracker.getEventsWithCategory(category);
			const count = files.size;
			const color = this.getCategoryColor(category, settings.colorRules, categoryProp);
			return { name: category, count, color };
		});

		categoriesInfo.sort((a, b) => b.count - a.count);

		const totalCount = categoriesInfo.reduce((sum, info) => sum + info.count, 0);

		categoriesInfo.forEach((categoryInfo) => {
			const categoryItem = container.createDiv(cls("category-settings-item"));

			const leftSection = categoryItem.createDiv(cls("category-settings-item-left"));
			const colorDot = leftSection.createEl("span", { cls: cls("category-settings-color-dot") });
			colorDot.style.setProperty("--category-color", categoryInfo.color);

			const nameContainer = leftSection.createDiv(cls("category-settings-name-container"));
			nameContainer.createEl("span", {
				text: categoryInfo.name,
				cls: cls("category-settings-name"),
			});
			const percentage = totalCount > 0 ? ((categoryInfo.count / totalCount) * 100).toFixed(1) : "0.0";
			nameContainer.createEl("span", {
				text: `(${categoryInfo.count} ${categoryInfo.count === 1 ? "event" : "events"} - ${percentage}%)`,
				cls: cls("category-settings-count"),
			});

			nameContainer.addEventListener("click", () => {
				this.openCategoryEventsModal(categoryInfo.name);
			});

			const rightSection = categoryItem.createDiv(cls("category-settings-item-right"));
			const colorInput = rightSection.createEl("input", {
				type: "color",
				value: categoryInfo.color,
			});
			colorInput.addEventListener("change", (event) => {
				const target = event.target as HTMLInputElement;
				void this.updateCategoryColor(categoryInfo.name, target.value);
			});
		});
	}

	private getCategoryColor(
		category: string,
		colorRules: Array<{ id: string; expression: string; color: string; enabled: boolean }>,
		categoryProp: string
	): string {
		const settings = this.settingsStore.currentSettings;
		const expectedExpression = this.getCategoryExpression(category, categoryProp);

		for (const rule of colorRules) {
			if (rule.enabled && rule.expression === expectedExpression) {
				return rule.color;
			}
		}

		return settings.defaultNodeColor;
	}

	private getCategoryExpression(category: string, categoryProp: string): string {
		const escapedCategory = category.replace(/'/g, "\\'");
		return `${categoryProp}.includes('${escapedCategory}')`;
	}

	private async updateCategoryColor(category: string, color: string): Promise<void> {
		if (!this.categoryTracker) return;

		const settings = this.settingsStore.currentSettings;
		const expectedExpression = this.getCategoryExpression(category, this.categoryProp);
		const existingRuleIndex = settings.colorRules.findIndex((rule) => rule.expression === expectedExpression);

		if (existingRuleIndex !== -1) {
			await this.settingsStore.updateSettings((s) => ({
				...s,
				colorRules: s.colorRules.map((rule, index) => (index === existingRuleIndex ? { ...rule, color } : rule)),
			}));
		} else {
			const newRule = {
				id: `category-color-${category}-${Date.now()}`,
				expression: expectedExpression,
				color,
				enabled: true,
			};

			await this.settingsStore.updateSettings((s) => ({
				...s,
				colorRules: [...s.colorRules, newRule],
			}));
		}

		if (this.categoriesListContainer && this.categoryTracker) {
			this.renderCategoriesList(this.categoriesListContainer, this.categoryTracker, this.categoryProp);
			const canvas = this.chartContainer?.querySelector("canvas");
			if (canvas) {
				this.updateChart(this.categoryTracker, this.categoryProp, canvas as HTMLCanvasElement);
			}
		}
	}

	private updateChart(categoryTracker: CategoryTracker, categoryProp: string, canvas: HTMLCanvasElement): void {
		const categories = categoryTracker.getCategories();
		if (categories.length === 0) {
			this.chartBuilder?.destroy();
			this.chartBuilder = null;
			return;
		}

		const settings = this.settingsStore.currentSettings;
		const chartData: ChartDataItem[] = categories.map((category) => {
			const files = categoryTracker.getEventsWithCategory(category);
			const count = files.size;
			const color = this.getCategoryColor(category, settings.colorRules, categoryProp);
			return { label: category, value: count, color };
		});

		chartData.sort((a, b) => b.value - a.value);

		this.chartBuilder = new PieChartBuilder(canvas, chartData, {
			tooltipFormatter: (label, value, percentage) => {
				return `${label}: ${value} ${value === 1 ? "event" : "events"} (${percentage}%)`;
			},
		});

		this.chartBuilder.render();
	}

	private openCategoryEventsModal(categoryName: string): void {
		const settings = this.settingsStore.currentSettings;
		const modal = new CategoryEventsModal(this.plugin.app, categoryName, settings);
		modal.open();
	}

	destroy(): void {
		this.categoriesSubscription?.unsubscribe();
		this.categoriesSubscription = null;
		this.chartBuilder?.destroy();
		this.chartBuilder = null;
	}
}
