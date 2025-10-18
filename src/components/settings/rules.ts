import { Setting } from "obsidian";
import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { ColorRule } from "../../utils/colors";

export class RulesSettings {
	constructor(private settingsStore: CalendarSettingsStore) {}

	display(containerEl: HTMLElement): void {
		this.addColorSettings(containerEl);
		this.addFilterSettings(containerEl);
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
		const examplesContainer = desc.createDiv("settings-info-box");

		examplesContainer.createEl("strong", { text: "Example color rules:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			{
				expression: "fm.Priority === 'High'",
				color: "#ef4444",
				description: "High priority events in red",
			},
			{
				expression: "fm.Status === 'Done'",
				color: "#22c55e",
				description: "Completed events in green",
			},
			{
				expression: "fm.Project === 'Work'",
				color: "#3b82f6",
				description: "Work projects in blue",
			},
			{
				expression: "fm.Type === 'Meeting'",
				color: "#f59e0b",
				description: "Meetings in orange",
			},
		];

		for (const example of examples) {
			const li = examplesList.createEl("li", { cls: "color-example-item" });

			li.createEl("code", { text: example.expression, cls: "settings-info-box-example" });

			li.createSpan({ text: "→", cls: "color-arrow" });

			const colorSpan = li.createEl("span", { cls: "color-example-dot" });
			colorSpan.style.setProperty("--example-color", example.color);

			li.createSpan({ text: example.description, cls: "color-example-description" });
		}

		// Warning section
		const warningContainer = desc.createDiv("settings-warning-box");
		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use 'fm' to access frontmatter properties. Invalid expressions will be ignored. Colors can be CSS color names, hex codes, or HSL values.",
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
			const ruleContainer = container.createDiv("color-rule-item");

			// Single row with all controls
			const mainRow = ruleContainer.createDiv("color-rule-main-row");

			// Left section: order, checkbox, expression
			const leftSection = mainRow.createDiv("color-rule-left");

			leftSection.createEl("span", {
				text: `#${index + 1}`,
				cls: "color-rule-order",
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
				placeholder: "fm.Priority === 'High'",
				cls: "color-rule-expression-input",
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
			const rightSection = mainRow.createDiv("color-rule-right");

			// Integrated color picker using Setting
			const colorPickerWrapper = rightSection.createDiv("color-rule-picker-wrapper");
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
			const controlsSection = rightSection.createDiv("color-rule-controls");

			if (index > 0) {
				const moveUpButton = controlsSection.createEl("button", {
					text: "↑",
					attr: { title: "Move up" },
					cls: "color-rule-btn",
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
					cls: "color-rule-btn",
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
				cls: "color-rule-btn color-rule-btn-delete",
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
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Event filtering").setHeading();

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Filter events based on their frontmatter properties using JavaScript expressions. Each expression should evaluate to true/false. Events must pass ALL filters to be included.",
		});

		// Examples section
		const examplesContainer = desc.createDiv("settings-info-box");

		examplesContainer.createEl("strong", { text: "Examples:" });
		const examplesList = examplesContainer.createEl("ul");

		const examples = [
			"fm.Status !== 'Inbox'",
			"fm.Priority === 'High'",
			"fm.Status === 'Done' || fm.Status === 'In Progress'",
			"!fm._Archived",
			"Array.isArray(fm.Project) && fm.Project.length > 0",
		];

		examples.forEach((example) => {
			const li = examplesList.createEl("li");
			const code = li.createEl("code", { text: example });
			code.addClass("settings-info-box-example");
		});

		// Warning section
		const warningContainer = desc.createDiv("settings-warning-box");
		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use 'fm' to access frontmatter properties (e.g., fm.Status, fm.Priority). Invalid expressions will be ignored and logged to console.",
		});

		new Setting(containerEl)
			.setName("Filter expressions")
			.setDesc(
				"JavaScript expressions to filter events (one per line). Changes apply when you click outside or press Ctrl/Cmd+Enter. Note: Expect a brief lag when applying changes as it triggers full re-indexing."
			)
			.addTextArea((text) => {
				text.setPlaceholder("fm.Status !== 'Inbox'\nfm.Priority === 'High'");
				text.setValue(settings.filterExpressions.join("\n"));

				const updateFilterExpressions = async (value: string) => {
					const expressions = value
						.split("\n")
						.map((expr) => expr.trim())
						.filter((expr) => expr.length > 0);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						filterExpressions: expressions,
					}));
				};

				text.inputEl.addEventListener("blur", () => {
					updateFilterExpressions(text.inputEl.value);
				});

				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
						e.preventDefault();
						updateFilterExpressions(text.inputEl.value);
					}
				});

				text.inputEl.rows = 5;
				text.inputEl.addClass("settings-info-box-example");
			});
	}
}
