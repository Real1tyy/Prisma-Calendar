import type { ColorRule } from "@real1ty-obsidian-plugins";
import { cls, SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import { DEFAULT_EVENT_COLOR } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import { COLOR_MODE_OPTIONS } from "../../types/index";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

interface ExampleItem {
	expression: string;
	description: string;
	color?: string;
}

export function swapRulePositions<T>(items: T[], fromIndex: number, direction: "up" | "down"): T[] {
	const result = [...items];
	const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
	if (toIndex < 0 || toIndex >= result.length) return result;
	[result[fromIndex], result[toIndex]] = [result[toIndex], result[fromIndex]];
	return result;
}

function renderExamplesList(container: HTMLElement, title: string, examples: ExampleItem[]): void {
	const examplesContainer = container.createDiv(cls("settings-info-box"));
	examplesContainer.createEl("strong", { text: title });
	const list = examplesContainer.createEl("ul");

	for (const example of examples) {
		const li = list.createEl("li", { cls: cls("color-example-item") });

		li.createEl("code", {
			text: example.expression,
			cls: cls("settings-info-box-example"),
		});

		li.createSpan({ text: "→", cls: cls("color-arrow") });

		if (example.color) {
			const colorSpan = li.createEl("span", { cls: cls("color-example-dot") });
			colorSpan.style.setProperty("--example-color", example.color);
		}

		li.createSpan({
			text: example.description,
			cls: cls("color-example-description"),
		});
	}
}

const COLOR_RULE_EXAMPLES: ExampleItem[] = [
	{ expression: "Priority === 'High'", color: "#ef4444", description: "High priority events in red" },
	{ expression: "Status === 'Done'", color: "#22c55e", description: "Completed events in green" },
	{ expression: "Project === 'Work'", color: "#3b82f6", description: "Work projects in blue" },
	{ expression: "Type === 'Meeting'", color: "#f59e0b", description: "Meetings in orange" },
];

const FILTER_EXAMPLES: ExampleItem[] = [
	{ expression: "Status !== 'Inbox'", description: "Exclude inbox items" },
	{ expression: "Priority === 'High'", description: "Only high priority events" },
	{ expression: "Status === 'Done' || Status === 'In Progress'", description: "Active or completed events" },
	{ expression: "!_Archived", description: "Exclude archived events" },
	{ expression: "Array.isArray(Project) && Project.length > 0", description: "Events with projects assigned" },
];

const UNTRACKED_FILTER_EXAMPLES: ExampleItem[] = [
	{ expression: "Status !== 'Inbox'", description: "Exclude inbox items" },
	{ expression: "Type === 'Task'", description: "Only show tasks" },
	{ expression: "!_Archived", description: "Exclude archived events" },
];

const FILTER_PRESET_EXAMPLES: ExampleItem[] = [
	{ expression: "Status === 'Done'", description: "Done tasks preset" },
	{ expression: "Priority === 'High'", description: "High priority preset" },
	{ expression: "Project === 'Work'", description: "Work projects preset" },
	{ expression: "!_Archived", description: "Not archived preset" },
];

export class RulesSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.addColorSettings(containerEl);
		this.addFilterSettings(containerEl);
		this.addUntrackedFilterSettings(containerEl);
		this.addFilterPresetSettings(containerEl);
	}

	private addColorSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Event colors").setHeading();

		this.ui.addDropdown(containerEl, {
			key: "colorMode",
			name: "Color mode",
			desc: "Controls how many matched color rules are applied to each event. Multiple colors split the event width into equal segments.",
			options: COLOR_MODE_OPTIONS,
		});

		this.ui.addSchemaField(
			containerEl,
			{ showEventColorDots: S.showEventColorDots },
			{ label: "Show overflow color dots" }
		);

		this.ui.addColorPicker(containerEl, {
			key: "defaultNodeColor",
			name: "Default event color",
			desc: "Default color for events when no color rules match",
			fallback: DEFAULT_EVENT_COLOR,
		});

		const colorRulesContainer = containerEl.createDiv();

		const desc = colorRulesContainer.createDiv();
		desc.createEl("p", {
			text: "Define color rules based on frontmatter properties. Rules are evaluated in order - the first matching rule determines the event color.",
		});

		renderExamplesList(desc, "Example color rules:", COLOR_RULE_EXAMPLES);

		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "⚠️ important:" });
		warningContainer.createEl("p", {
			text: "Use property names directly — invalid expressions will be ignored",
		});

		const colorRulesListContainer = colorRulesContainer.createDiv();

		this.renderColorRulesList(colorRulesListContainer);

		new Setting(colorRulesContainer)
			.setName("Add color rule")
			.setDesc("Add a new color rule")
			.addButton((button) => {
				button.setButtonText("Add rule");
				button.buttonEl.setAttribute("data-testid", "prisma-rules-add-color-rule");
				button.onClick(async () => {
					const newRule: ColorRule = {
						id: `color-rule-${Date.now()}`,
						expression: "",
						color: "hsl(200, 70%, 50%)",
						enabled: true,
					};

					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: [...s.colorRules, newRule],
					}));

					this.renderColorRulesList(colorRulesListContainer);
				});
			});
	}

	private renderColorRulesList(container: HTMLElement): void {
		container.empty();
		const { colorRules } = this.settingsStore.currentSettings;

		if (colorRules.length === 0) {
			const emptyState = container.createDiv();
			emptyState.textContent = "No color rules defined. Click 'add rule' to create one.";
			return;
		}

		colorRules.forEach((rule, index) => {
			const ruleContainer = container.createDiv(cls("color-rule-item"));

			const mainRow = ruleContainer.createDiv(cls("color-rule-main-row"));

			const leftSection = mainRow.createDiv(cls("color-rule-left"));

			leftSection.createEl("span", {
				text: `#${index + 1}`,
				cls: cls("color-rule-order"),
			});

			const enableToggle = leftSection.createEl("input", { type: "checkbox" });
			enableToggle.checked = rule.enabled;
			enableToggle.onchange = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, enabled: enableToggle.checked } : r)),
				}));
			};

			const expressionInput = leftSection.createEl("input", {
				type: "text",
				value: rule.expression,
				placeholder: "Priority === 'High'",
				cls: cls("color-rule-expression-input"),
				attr: { "data-testid": `prisma-rules-color-expression-${index}` },
			});

			const updateExpression = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, expression: expressionInput.value } : r)),
				}));
			};

			expressionInput.addEventListener("blur", () => {
				void updateExpression();
			});
			expressionInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void updateExpression();
				}
			});

			const rightSection = mainRow.createDiv(cls("color-rule-right"));

			const colorInput = rightSection.createEl("input", {
				type: "color",
				value: rule.color,
				cls: cls("color-rule-picker"),
				attr: { "data-testid": `prisma-rules-color-picker-${index}` },
			});
			colorInput.addEventListener("input", (e) => {
				const target = e.target as HTMLInputElement;
				void this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, color: target.value } : r)),
				}));
			});

			const controlsSection = rightSection.createDiv(cls("color-rule-controls"));

			if (index > 0) {
				const moveUpButton = controlsSection.createEl("button", {
					text: "↑",
					attr: { title: "Move up" },
					cls: cls("color-rule-btn"),
				});
				moveUpButton.onclick = async () => {
					const ruleIndex = this.settingsStore.currentSettings.colorRules.findIndex((r) => r.id === rule.id);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: swapRulePositions(s.colorRules, ruleIndex, "up"),
					}));
					this.renderColorRulesList(container);
				};
			}

			if (index < colorRules.length - 1) {
				const moveDownButton = controlsSection.createEl("button", {
					text: "↓",
					attr: { title: "Move down" },
					cls: cls("color-rule-btn"),
				});
				moveDownButton.onclick = async () => {
					const ruleIndex = this.settingsStore.currentSettings.colorRules.findIndex((r) => r.id === rule.id);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: swapRulePositions(s.colorRules, ruleIndex, "down"),
					}));
					this.renderColorRulesList(container);
				};
			}

			const deleteButton = controlsSection.createEl("button", {
				text: "×",
				attr: { title: "Delete rule" },
				cls: `${cls("color-rule-btn")} ${cls("color-rule-btn-delete")}`,
			});
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.filter((r) => r.id !== rule.id),
				}));
				this.renderColorRulesList(container);
			};
		});
	}

	private addFilterSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Event filtering").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Filter events based on their frontmatter properties using JavaScript expressions. Each expression should evaluate to true/false. Events must pass all filters to be included.",
		});

		renderExamplesList(desc, "Example filter expressions", FILTER_EXAMPLES);

		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "⚠️ important:" });
		warningContainer.createEl("p", {
			text: "Use property names directly (e.g., status, priority). Invalid expressions will be ignored and logged to console.",
		});

		this.ui.addSchemaField(
			containerEl,
			{ filterExpressions: S.filterExpressions },
			{ placeholder: "Status !== 'Inbox'\nPriority === 'High'" }
		);
	}

	private addUntrackedFilterSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Untracked event filtering").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Filter untracked events (events without dates) based on their frontmatter properties. This works the same as event filtering but only applies to untracked events in the dropdown.",
		});

		renderExamplesList(desc, "Example filter expressions", UNTRACKED_FILTER_EXAMPLES);

		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "⚠️ important:" });
		warningContainer.createEl("p", {
			text: "Use property names directly. Invalid expressions will be ignored and logged to console.",
		});

		this.ui.addSchemaField(
			containerEl,
			{ untrackedFilterExpressions: S.untrackedFilterExpressions },
			{ placeholder: "Status !== 'Inbox'\nType === 'Task'" }
		);
	}

	private addFilterPresetSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Filter presets").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Create named filter presets for quick access via a dropdown in the toolbar. These presets auto-fill the filter expression input.",
		});

		renderExamplesList(desc, "Example filter presets", FILTER_PRESET_EXAMPLES);

		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "💡 tip:" });
		warningContainer.createEl("p", {
			text: "Filter presets appear in a dropdown next to the zoom button. Click a preset to instantly apply its filter expression.",
		});

		const presetsListContainer = containerEl.createDiv();
		this.renderFilterPresetsList(presetsListContainer);

		new Setting(containerEl)
			.setName("Add filter preset")
			.setDesc("Add a new filter preset")
			.addButton((button) => {
				button.setButtonText("Add preset");
				button.onClick(async () => {
					const newPreset = {
						name: "",
						expression: "",
					};

					await this.settingsStore.updateSettings((s) => ({
						...s,
						filterPresets: [...s.filterPresets, newPreset],
					}));

					this.renderFilterPresetsList(presetsListContainer);
				});
			});
	}

	private renderFilterPresetsList(container: HTMLElement): void {
		container.empty();
		const { filterPresets } = this.settingsStore.currentSettings;

		if (filterPresets.length === 0) {
			const emptyState = container.createDiv();
			emptyState.textContent = "No filter presets defined. Click 'add preset' to create one.";
			return;
		}

		filterPresets.forEach((preset, index) => {
			const presetContainer = container.createDiv(cls("filter-preset-item"));

			const nameInput = presetContainer.createEl("input", {
				type: "text",
				value: preset.name,
				placeholder: "Preset name (e.g., 'Done', 'High Priority')",
				cls: cls("filter-preset-name-input"),
			});

			const updateName = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					filterPresets: s.filterPresets.map((p, i) => (i === index ? { ...p, name: nameInput.value } : p)),
				}));
			};

			nameInput.addEventListener("blur", () => {
				void updateName();
			});
			nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void updateName();
				}
			});

			const expressionInput = presetContainer.createEl("input", {
				type: "text",
				value: preset.expression,
				placeholder: "Filter expression (e.g., Status === 'Done')",
				cls: cls("filter-preset-expression-input"),
			});

			const updateExpression = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					filterPresets: s.filterPresets.map((p, i) => (i === index ? { ...p, expression: expressionInput.value } : p)),
				}));
			};

			expressionInput.addEventListener("blur", () => {
				void updateExpression();
			});
			expressionInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void updateExpression();
				}
			});

			const deleteButton = presetContainer.createEl("button", {
				text: "×",
				attr: { title: "Delete preset" },
				cls: cls("filter-preset-btn-delete"),
			});
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					filterPresets: s.filterPresets.filter((_, i) => i !== index),
				}));
				this.renderFilterPresetsList(container);
			};
		});
	}
}
