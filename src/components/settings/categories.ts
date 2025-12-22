import { cls } from "@real1ty-obsidian-plugins/utils";
import Chart from "chart.js/auto";
import { Setting } from "obsidian";
import type { Subscription } from "rxjs";
import type { CategoryTracker } from "../../core/category-tracker";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type CustomCalendarPlugin from "../../main";

interface CategoryInfo {
	name: string;
	count: number;
	color: string;
}

export class CategoriesSettings {
	private chart: Chart | null = null;
	private categoriesSubscription: Subscription | null = null;
	private chartContainer: HTMLElement | null = null;
	private categoriesListContainer: HTMLElement | null = null;
	private categoryTracker: CategoryTracker | null = null;
	private categoryProp: string;

	constructor(
		private settingsStore: CalendarSettingsStore,
		private plugin: CustomCalendarPlugin
	) {}

	display(containerEl: HTMLElement): void {
		containerEl.empty();
		this.categoriesSubscription?.unsubscribe();
		this.chart?.destroy();
		this.chart = null;
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
			this.updateChart(this.categoryTracker!, this.categoryProp);
		});

		const chartSection = containerEl.createDiv(cls("categories-chart-section"));
		chartSection.createEl("h3", { text: "Category distribution" });
		this.chartContainer = chartSection.createDiv(cls("categories-chart-container"));
		const canvas = this.chartContainer.createEl("canvas");
		canvas.setAttribute("id", cls("categories-chart"));
		this.updateChart(this.categoryTracker, this.categoryProp);
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

		const categoriesInfo: CategoryInfo[] = categories.map((category) => {
			const files = categoryTracker.getEventsWithCategory(category);
			const count = files.size;
			const color = this.getCategoryColor(category, settings.colorRules, categoryProp);
			return { name: category, count, color };
		});

		categoriesInfo.sort((a, b) => b.count - a.count);

		categoriesInfo.forEach((categoryInfo) => {
			const categoryItem = container.createDiv(cls("category-item"));

			const leftSection = categoryItem.createDiv(cls("category-item-left"));
			const colorDot = leftSection.createEl("span", { cls: cls("category-color-dot") });
			colorDot.style.setProperty("--category-color", categoryInfo.color);

			const nameContainer = leftSection.createDiv(cls("category-name-container"));
			nameContainer.createEl("span", {
				text: categoryInfo.name,
				cls: cls("category-name"),
			});
			nameContainer.createEl("span", {
				text: `(${categoryInfo.count} ${categoryInfo.count === 1 ? "event" : "events"})`,
				cls: cls("category-count"),
			});

			const rightSection = categoryItem.createDiv(cls("category-item-right"));
			new Setting(rightSection).addColorPicker((colorPicker) => {
				colorPicker.setValue(categoryInfo.color);
				colorPicker.onChange(async (value) => {
					await this.updateCategoryColor(categoryInfo.name, value);
				});
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
			this.updateChart(this.categoryTracker, this.categoryProp);
		}
	}

	private updateChart(categoryTracker: CategoryTracker, categoryProp: string): void {
		if (!this.chartContainer) return;

		const canvas = this.chartContainer.querySelector("canvas");
		if (!canvas) return;

		const categories = categoryTracker.getCategories();
		if (categories.length === 0) {
			if (this.chart) {
				this.chart.destroy();
				this.chart = null;
			}
			return;
		}

		const settings = this.settingsStore.currentSettings;
		const categoriesInfo: CategoryInfo[] = categories.map((category) => {
			const files = categoryTracker.getEventsWithCategory(category);
			const count = files.size;
			const color = this.getCategoryColor(category, settings.colorRules, categoryProp);
			return { name: category, count, color };
		});

		categoriesInfo.sort((a, b) => b.count - a.count);

		const totalCount = categoriesInfo.reduce((sum, info) => sum + info.count, 0);
		const labels = categoriesInfo.map((info) => info.name);
		const data = categoriesInfo.map((info) => info.count);
		const colors = categoriesInfo.map((info) => info.color);

		if (this.chart) {
			this.chart.destroy();
		}

		this.chart = new Chart(canvas, {
			type: "pie",
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: colors,
						borderWidth: 2,
						borderColor: "#ffffff",
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: { left: 20, right: 20 },
				},
				plugins: {
					legend: {
						position: "right",
						align: "start",
						maxWidth: 350,
						labels: {
							font: {
								size: 14,
							},
							padding: 8,
							color: "#ffffff",
							boxWidth: 12,
							boxHeight: 12,
							generateLabels: (chart) => {
								return (
									chart.data.labels?.map((label, i) => {
										const value = chart.data.datasets[0].data[i] as number;
										const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : "0.0";
										const labelText = `${String(label)} (${percentage}%)`;
										return {
											text: labelText.length > 35 ? `${labelText.substring(0, 32)}...` : labelText,
											fillStyle: (chart.data.datasets[0].backgroundColor as string[])[i],
											fontColor: "#ffffff",
											hidden: false,
											index: i,
										};
									}) || []
								);
							},
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed;
								const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : "0.0";
								return `${context.label}: ${value} ${value === 1 ? "event" : "events"} (${percentage}%)`;
							},
						},
					},
				},
			},
		});
	}

	destroy(): void {
		this.categoriesSubscription?.unsubscribe();
		this.categoriesSubscription = null;
		this.chart?.destroy();
		this.chart = null;
	}
}
