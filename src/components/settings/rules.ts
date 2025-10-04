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

		// Default color setting with color picker and preview
		const defaultColorSetting = new Setting(containerEl)
			.setName("Default event color")
			.setDesc("Default color for events when no color rules match");

		// Add color preview
		const previewContainer = defaultColorSetting.settingEl.createDiv("color-preview-container");
		const colorPreview = previewContainer.createDiv("color-preview-box");
		colorPreview.style.setProperty("--preview-color", settings.defaultEventColor);

		const previewLabel = previewContainer.createSpan({
			text: settings.defaultEventColor,
			cls: "color-preview-label",
		});

		// Add color picker
		defaultColorSetting.addColorPicker((colorPicker) => {
			colorPicker.setValue(settings.defaultEventColor);
			colorPicker.onChange(async (value) => {
				const color = value || SETTINGS_DEFAULTS.DEFAULT_EVENT_COLOR;
				await this.settingsStore.updateSettings((s) => ({ ...s, defaultEventColor: color }));

				// Update preview
				colorPreview.style.setProperty("--preview-color", color);
				previewLabel.textContent = color;
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
				color: "red",
				description: "High priority events in red",
			},
			{
				expression: "fm.Status === 'Done'",
				color: "#22c55e",
				description: "Completed events in green",
			},
			{
				expression: "fm.Project === 'Work'",
				color: "hsl(210, 70%, 50%)",
				description: "Work projects in blue",
			},
			{ expression: "fm.Type === 'Meeting'", color: "#f59e0b", description: "Meetings in orange" },
		];

		examples.forEach((example) => {
			const li = examplesList.createEl("li");

			const expressionCode = li.createEl("code", { text: example.expression });
			expressionCode.addClass("settings-info-box-example");

			li.createSpan({ text: " → " });

			const colorSpan = li.createEl("span", { cls: "color-example-dot" });
			colorSpan.style.setProperty("--example-color", example.color);

			li.createSpan({ text: example.description, cls: "setting-item-description" });
		});

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
			const headerContainer = ruleContainer.createDiv("color-rule-header");
			const leftSection = headerContainer.createDiv("color-rule-header-left");
			leftSection.createEl("span", {
				text: `#${index + 1}`,
				cls: "color-rule-order",
			});
			const colorPreview = leftSection.createDiv("color-rule-preview");
			colorPreview.style.setProperty("--preview-color", rule.color);

			const enableToggle = leftSection.createEl("input");
			enableToggle.type = "checkbox";
			enableToggle.checked = rule.enabled;
			enableToggle.onchange = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, enabled: enableToggle.checked } : r)),
				}));
			};

			const rightSection = headerContainer.createDiv("color-rule-header-right");

			if (index > 0) {
				const moveUpButton = rightSection.createEl("button", {
					text: "↑",
					attr: { title: "Move up" },
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
				const moveDownButton = rightSection.createEl("button", {
					text: "↓",
					attr: { title: "Move down" },
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

			const deleteButton = rightSection.createEl("button", {
				text: "×",
				attr: { title: "Delete rule" },
			});
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.filter((r) => r.id !== rule.id),
				}));
				this.renderColorRulesList(container);
			};

			const expressionContainer = ruleContainer.createDiv("color-rule-input-group");
			expressionContainer.createEl("label", { text: "Expression:" });
			const expressionInput = expressionContainer.createEl("input", {
				type: "text",
				value: rule.expression,
				placeholder: "fm.Priority === 'High'",
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

			const colorContainer = ruleContainer.createDiv("color-rule-color-input");
			colorContainer.createEl("label", { text: "Color:" });
			const colorPickerContainer = colorContainer.createDiv("color-picker-container");

			const colorValueDisplay = colorPickerContainer.createSpan({
				text: rule.color,
				cls: "color-preview-label",
			});

			new Setting(colorPickerContainer).addColorPicker((colorPicker) => {
				colorPicker.setValue(rule.color);
				colorPicker.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, color: value } : r)),
					}));
					colorPreview.style.setProperty("--preview-color", value);
					colorValueDisplay.textContent = value;
				});
			});
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
