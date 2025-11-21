import { SettingsUIBuilder } from "@real1ty-obsidian-plugins/utils";
import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";
import type { ColorRule } from "../../utils/colors";
import { cls } from "../../utils/css-utils";

export class RulesSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as any);
	}

	display(containerEl: HTMLElement): void {
		this.addColorSettings(containerEl);
		this.addFilterSettings(containerEl);
		this.addFilterPresetSettings(containerEl);
	}

	private addColorSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Event colors").setHeading();

		// Default color setting with color picker
		new Setting(containerEl)
			.setName("Default event color")
			.setDesc("Default color for events when no color rules match")
			.addColorPicker((colorPicker) => {
				colorPicker.setValue(settings.defaultEventColor);
				colorPicker.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						defaultEventColor: value || SETTINGS_DEFAULTS.DEFAULT_EVENT_COLOR,
					}));
				});
			});

		// Color rules section
		const colorRulesContainer = containerEl.createDiv();

		const desc = colorRulesContainer.createDiv();
		desc.createEl("p", {
			text: "Define color rules based on frontmatter properties. Rules are evaluated in order - the first matching rule determines the event color.",
		});

		// Examples section
		const examplesContainer = desc.createDiv(cls("settings-info-box"));

		examplesContainer.createEl("strong", { text: "Example color rules:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{
				expression: "Priority === 'High'",
				color: "#ef4444",
				description: "High priority events in red",
			},
			{
				expression: "Status === 'Done'",
				color: "#22c55e",
				description: "Completed events in green",
			},
			{
				expression: "Project === 'Work'",
				color: "#3b82f6",
				description: "Work projects in blue",
			},
			{
				expression: "Type === 'Meeting'",
				color: "#f59e0b",
				description: "Meetings in orange",
			},
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", { cls: cls("color-example-item") });

			li.createEl("code", { text: example.expression, cls: cls("settings-info-box-example") });

			li.createSpan({ text: "→", cls: cls("color-arrow") });

			const colorSpan = li.createEl("span", { cls: cls("color-example-dot") });
			colorSpan.style.setProperty("--example-color", example.color);

			li.createSpan({ text: example.description, cls: cls("color-example-description") });
		}

		// Warning section
		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use property names directly (e.g., Priority, Status). Invalid expressions will be ignored. Colors can be CSS color names, hex codes, or HSL values.",
		});

		// Color rules list
		const colorRulesListContainer = colorRulesContainer.createDiv();

		this.renderColorRulesList(colorRulesListContainer);

		// Add new color rule button
		new Setting(colorRulesContainer)
			.setName("Add color rule")
			.setDesc("Add a new color rule")
			.addButton((button) => {
				button.setButtonText("Add Rule");
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

					// Re-render the list
					this.renderColorRulesList(colorRulesListContainer);
				});
			});
	}

	private renderColorRulesList(container: HTMLElement): void {
		container.empty();
		const { colorRules } = this.settingsStore.currentSettings;

		if (colorRules.length === 0) {
			const emptyState = container.createDiv();
			emptyState.textContent = "No color rules defined. Click 'Add Rule' to create one.";
			return;
		}

		colorRules.forEach((rule, index) => {
			const ruleContainer = container.createDiv(cls("color-rule-item"));

			// Single row with all controls
			const mainRow = ruleContainer.createDiv(cls("color-rule-main-row"));

			// Left section: order, checkbox, expression
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
			});

			const updateExpression = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, expression: expressionInput.value } : r)),
				}));
			};

			expressionInput.addEventListener("blur", updateExpression);
			expressionInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					updateExpression();
				}
			});

			// Right section: color picker + controls
			const rightSection = mainRow.createDiv(cls("color-rule-right"));

			// Integrated color picker using Setting
			const colorPickerWrapper = rightSection.createDiv(cls("color-rule-picker-wrapper"));
			new Setting(colorPickerWrapper).addColorPicker((colorPicker) => {
				colorPicker.setValue(rule.color);
				colorPicker.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, color: value } : r)),
					}));
				});
			});

			// Control buttons
			const controlsSection = rightSection.createDiv(cls("color-rule-controls"));

			if (index > 0) {
				const moveUpButton = controlsSection.createEl("button", {
					text: "↑",
					attr: { title: "Move up" },
					cls: cls("color-rule-btn"),
				});
				moveUpButton.onclick = async () => {
					await this.settingsStore.updateSettings((s) => {
						const currentRules = [...s.colorRules];
						const ruleIndex = currentRules.findIndex((r) => r.id === rule.id);
						if (ruleIndex > 0) {
							[currentRules[ruleIndex], currentRules[ruleIndex - 1]] = [
								currentRules[ruleIndex - 1],
								currentRules[ruleIndex],
							];
						}
						return { ...s, colorRules: currentRules };
					});
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
					await this.settingsStore.updateSettings((s) => {
						const currentRules = [...s.colorRules];
						const ruleIndex = currentRules.findIndex((r) => r.id === rule.id);
						if (ruleIndex !== -1 && ruleIndex < currentRules.length - 1) {
							[currentRules[ruleIndex], currentRules[ruleIndex + 1]] = [
								currentRules[ruleIndex + 1],
								currentRules[ruleIndex],
							];
						}
						return { ...s, colorRules: currentRules };
					});
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
			text: "Filter events based on their frontmatter properties using JavaScript expressions. Each expression should evaluate to true/false. Events must pass ALL filters to be included.",
		});

		// Examples section
		const examplesContainer = desc.createDiv(cls("settings-info-box"));

		examplesContainer.createEl("strong", { text: "Example filter expressions:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{ expression: "Status !== 'Inbox'", description: "Exclude inbox items" },
			{ expression: "Priority === 'High'", description: "Only high priority events" },
			{ expression: "Status === 'Done' || Status === 'In Progress'", description: "Active or completed events" },
			{ expression: "!_Archived", description: "Exclude archived events" },
			{ expression: "Array.isArray(Project) && Project.length > 0", description: "Events with projects assigned" },
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", { cls: cls("color-example-item") });

			li.createEl("code", { text: example.expression, cls: cls("settings-info-box-example") });

			li.createSpan({ text: "→", cls: cls("color-arrow") });

			li.createSpan({ text: example.description, cls: cls("color-example-description") });
		}

		// Warning section
		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use property names directly (e.g., Status, Priority). Invalid expressions will be ignored and logged to console.",
		});

		this.ui.addTextArray(containerEl, {
			key: "filterExpressions",
			name: "Filter expressions",
			desc: "JavaScript expressions to filter events (one per line). Changes apply when you click outside or press Ctrl/Cmd+Enter. Note: Expect a brief lag when applying changes as it triggers full re-indexing.",
			placeholder: "Status !== 'Inbox'\nPriority === 'High'",
			multiline: true,
		});
	}

	private addFilterPresetSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Filter presets").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Create named filter presets for quick access via a dropdown in the calendar toolbar. These presets auto-fill the filter expression input.",
		});

		// Examples section
		const examplesContainer = desc.createDiv(cls("settings-info-box"));

		examplesContainer.createEl("strong", { text: "Example filter presets:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{ expression: "Status === 'Done'", description: "Done tasks preset" },
			{ expression: "Priority === 'High'", description: "High priority preset" },
			{ expression: "Project === 'Work'", description: "Work projects preset" },
			{ expression: "!_Archived", description: "Not archived preset" },
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", { cls: cls("color-example-item") });

			li.createEl("code", { text: example.expression, cls: cls("settings-info-box-example") });

			li.createSpan({ text: "→", cls: cls("color-arrow") });

			li.createSpan({ text: example.description, cls: cls("color-example-description") });
		}

		// Warning section
		const warningContainer = desc.createDiv(cls("settings-warning-box"));
		warningContainer.createEl("strong", { text: "💡 Tip:" });
		warningContainer.createEl("p", {
			text: "Filter presets appear in a dropdown next to the zoom button. Click a preset to instantly apply its filter expression.",
		});

		// Presets list
		const presetsListContainer = containerEl.createDiv();
		this.renderFilterPresetsList(presetsListContainer);

		// Add new preset button
		new Setting(containerEl)
			.setName("Add filter preset")
			.setDesc("Add a new filter preset")
			.addButton((button) => {
				button.setButtonText("Add Preset");
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
			emptyState.textContent = "No filter presets defined. Click 'Add Preset' to create one.";
			return;
		}

		filterPresets.forEach((preset, index) => {
			const presetContainer = container.createDiv(cls("filter-preset-item"));

			// Name input
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

			nameInput.addEventListener("blur", updateName);
			nameInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					updateName();
				}
			});

			// Expression input
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

			expressionInput.addEventListener("blur", updateExpression);
			expressionInput.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter") {
					e.preventDefault();
					updateExpression();
				}
			});

			// Delete button
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
