import { Setting } from "obsidian";
import type { CalendarSettingsStore } from "../core/settings-store";
import {
	CALENDAR_VIEW_OPTIONS,
	type CalendarViewType,
	DENSITY_OPTIONS,
	FIRST_DAY_OPTIONS,
} from "../types/index";
import { DEFAULT_EVENT_COLOR } from "../types/settings-schemas";
import type { ColorRule } from "../utils/color-evaluator";

export class SingleCalendarSettings {
	private settingsStore: CalendarSettingsStore;
	private activeSection: "general" | "properties" | "calendar" | "rules" = "general";

	constructor(settingsStore: CalendarSettingsStore) {
		this.settingsStore = settingsStore;
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();

		containerEl.createEl("h2", { text: "Calendar Settings" });

		this.createSectionNavigation(containerEl);
		this.renderActiveSection(containerEl);
	}

	private createSectionNavigation(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv("settings-nav");
		navContainer.style.marginBottom = "24px";
		navContainer.style.borderBottom = "1px solid var(--background-modifier-border)";
		navContainer.style.paddingBottom = "16px";

		const sections = [
			{ id: "general" as const, label: "General Settings" },
			{ id: "properties" as const, label: "Properties Settings" },
			{ id: "calendar" as const, label: "Calendar Settings" },
			{ id: "rules" as const, label: "Rules Settings" },
		];

		const buttonContainer = navContainer.createDiv("nav-buttons");
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "8px";
		buttonContainer.style.flexWrap = "wrap";

		sections.forEach((section) => {
			const button = buttonContainer.createEl("button", { text: section.label });
			button.style.padding = "8px 16px";
			button.style.border = "1px solid var(--background-modifier-border)";
			button.style.borderRadius = "6px";
			button.style.backgroundColor =
				this.activeSection === section.id
					? "var(--interactive-accent)"
					: "var(--background-secondary)";
			button.style.color =
				this.activeSection === section.id ? "var(--text-on-accent)" : "var(--text-normal)";
			button.style.cursor = "pointer";
			button.style.transition = "all 0.2s ease";

			button.addEventListener("click", () => {
				this.activeSection = section.id;
				this.display(containerEl); // Re-render with new active section
			});

			// Hover effects
			button.addEventListener("mouseenter", () => {
				if (this.activeSection !== section.id) {
					button.style.backgroundColor = "var(--background-modifier-hover)";
				}
			});

			button.addEventListener("mouseleave", () => {
				if (this.activeSection !== section.id) {
					button.style.backgroundColor = "var(--background-secondary)";
				}
			});
		});
	}

	private renderActiveSection(containerEl: HTMLElement): void {
		// Create container for active section content
		const contentContainer = containerEl.createDiv("settings-content");

		switch (this.activeSection) {
			case "general":
				this.addGeneralSettings(contentContainer);
				break;
			case "properties":
				this.addPropertiesSettings(contentContainer);
				break;
			case "calendar":
				this.addCalendarSettings(contentContainer);
				break;
			case "rules":
				this.addRulesSettings(contentContainer);
				break;
		}
	}

	private addGeneralSettings(containerEl: HTMLElement): void {
		this.addDirectorySettings(containerEl);
		this.addParsingSettings(containerEl);
		this.addTimezoneSettings(containerEl);
	}

	private addPropertiesSettings(containerEl: HTMLElement): void {
		this.addFrontmatterSettings(containerEl);
		this.addThermometerSettings(containerEl);
	}

	private addCalendarSettings(containerEl: HTMLElement): void {
		this.addRecurringEventSettings(containerEl);
		this.addUISettings(containerEl);
	}

	private addRulesSettings(containerEl: HTMLElement): void {
		this.addColorSettings(containerEl);
		this.addFilterSettings(containerEl);
	}

	private addDirectorySettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Calendar Directory" });

		new Setting(containerEl)
			.setName("Directory")
			.setDesc("Folder to scan for calendar events and create new events in")
			.addText((text) => {
				text.setValue(settings.directory);
				text.setPlaceholder("e.g., tasks, calendar, events");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, directory: value }));
				});
			});

		new Setting(containerEl)
			.setName("Template path")
			.setDesc(
				"Path to Templater template file for new events (optional, requires Templater plugin)"
			)
			.addText((text) => {
				text.setValue(settings.templatePath || "");
				text.setPlaceholder("e.g., Templates/event-template.md");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						templatePath: value || undefined,
					}));
				});
			});
	}

	private addFrontmatterSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Frontmatter Properties" });

		new Setting(containerEl)
			.setName("Start property")
			.setDesc("Frontmatter property name for event start date/time")
			.addText((text) =>
				text
					.setPlaceholder("Start")
					.setValue(settings.startProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							startProp: value || "Start",
						}));
					})
			);

		new Setting(containerEl)
			.setName("End property")
			.setDesc("Frontmatter property name for event end date/time (optional)")
			.addText((text) =>
				text
					.setPlaceholder("End")
					.setValue(settings.endProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							endProp: value || "End",
						}));
					})
			);

		new Setting(containerEl)
			.setName("All-day property")
			.setDesc("Frontmatter property name for all-day flag (optional)")
			.addText((text) =>
				text
					.setPlaceholder("AllDay")
					.setValue(settings.allDayProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, allDayProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("Title property")
			.setDesc("Frontmatter property name for event title (optional, defaults to file name)")
			.addText((text) =>
				text
					.setPlaceholder("Title")
					.setValue(settings.titleProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, titleProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("Timezone property")
			.setDesc("Frontmatter property name for event-specific timezone (optional)")
			.addText((text) =>
				text
					.setPlaceholder("Timezone")
					.setValue(settings.timezoneProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, timezoneProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("ZettelID property")
			.setDesc(
				"Frontmatter property name for auto-generated ZettelID (optional, generates timestamp-based ID on creation/cloning)"
			)
			.addText((text) =>
				text
					.setPlaceholder("ZettelID")
					.setValue(settings.zettelIdProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, zettelIdProp: value }));
					})
			);

		new Setting(containerEl)
			.setName("RRule property")
			.setDesc("Frontmatter property name for recurring event type (daily, weekly, monthly, etc.)")
			.addText((text) =>
				text
					.setPlaceholder("RRule")
					.setValue(settings.rruleProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleProp: value || "RRule",
						}));
					})
			);

		new Setting(containerEl)
			.setName("RRule specification property")
			.setDesc(
				"Frontmatter property name for recurring event specification (weekdays for weekly/bi-weekly events)"
			)
			.addText((text) =>
				text
					.setPlaceholder("RRuleSpec")
					.setValue(settings.rruleSpecProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleSpecProp: value || "RRuleSpec",
						}));
					})
			);

		new Setting(containerEl)
			.setName("RRule ID property")
			.setDesc("Frontmatter property name for recurring event unique identifier")
			.addText((text) =>
				text
					.setPlaceholder("RRuleID")
					.setValue(settings.rruleIdProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							rruleIdProp: value || "RRuleID",
						}));
					})
			);

		// Add description for recurring events
		const recurringDesc = containerEl.createDiv();
		recurringDesc.style.marginTop = "16px";
		recurringDesc.style.padding = "12px";
		recurringDesc.style.backgroundColor = "var(--background-secondary)";
		recurringDesc.style.borderRadius = "8px";
		recurringDesc.style.border = "1px solid var(--background-modifier-border)";

		recurringDesc.createEl("h4", { text: "Node-Based Recurring Events" });
		recurringDesc.createEl("p", {
			text: "To create recurring events, add the RRule property to any event file's frontmatter. The plugin will automatically detect these and create recurring instances.",
		});

		const exampleContainer = recurringDesc.createDiv();
		exampleContainer.createEl("strong", { text: "Example:" });
		const exampleCode = exampleContainer.createEl("pre");
		exampleCode.style.backgroundColor = "var(--background-primary)";
		exampleCode.style.padding = "8px";
		exampleCode.style.borderRadius = "4px";
		exampleCode.style.marginTop = "8px";
		exampleCode.style.fontSize = "12px";
		exampleCode.textContent = `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.rruleProp}: weekly
${settings.rruleSpecProp}: monday, wednesday, friday
---

# Weekly Team Meeting`;

		const typesContainer = recurringDesc.createDiv();
		typesContainer.style.marginTop = "12px";
		typesContainer.createEl("strong", { text: "Supported RRule types:" });
		const typesList = typesContainer.createEl("ul");
		typesList.style.marginTop = "4px";
		["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "yearly"].forEach((type) => {
			typesList.createEl("li", { text: type });
		});

		const specContainer = recurringDesc.createDiv();
		specContainer.style.marginTop = "8px";
		specContainer.createEl("strong", { text: "RRuleSpec (for weekly/bi-weekly):" });
		specContainer.createEl("p", {
			text: "Comma-separated weekdays: sunday, monday, tuesday, wednesday, thursday, friday, saturday",
		});
	}

	private addRecurringEventSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Recurring Event Settings" });

		new Setting(containerEl)
			.setName("Future instances count")
			.setDesc("Maximum number of future recurring event instances to generate (1-52)")
			.addText((text) =>
				text
					.setPlaceholder("12")
					.setValue(settings.futureInstancesCount.toString())
					.onChange(async (value) => {
						const count = parseInt(value, 10);
						if (!Number.isNaN(count) && count >= 1 && count <= 52) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								futureInstancesCount: count,
							}));
						}
					})
			);
	}

	private addParsingSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Parsing Settings" });

		new Setting(containerEl)
			.setName("Default duration (minutes)")
			.setDesc("Default event duration when only start time is provided")
			.addText((text) =>
				text
					.setPlaceholder("60")
					.setValue(settings.defaultDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration > 0) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								defaultDurationMinutes: duration,
							}));
						}
					})
			);
	}

	private addUISettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "UI Settings" });

		new Setting(containerEl)
			.setName("Default view")
			.setDesc("The calendar view to show when opening")
			.addDropdown((dropdown) => {
				Object.entries(CALENDAR_VIEW_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.defaultView).onChange(async (value: string) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						defaultView: value as CalendarViewType,
					}));
				});
			});

		new Setting(containerEl)
			.setName("Hide weekends")
			.setDesc("Hide Saturday and Sunday in calendar views")
			.addToggle((toggle) =>
				toggle.setValue(settings.hideWeekends).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, hideWeekends: value }));
				})
			);

		new Setting(containerEl)
			.setName("Enable event preview")
			.setDesc("Show preview of event notes when hovering over events in the calendar")
			.addToggle((toggle) =>
				toggle.setValue(settings.enableEventPreview).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, enableEventPreview: value }));
				})
			);

		new Setting(containerEl)
			.setName("Show current time indicator")
			.setDesc("Display a line showing the current time in weekly and daily calendar views")
			.addToggle((toggle) =>
				toggle.setValue(settings.nowIndicator).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, nowIndicator: value }));
				})
			);

		new Setting(containerEl)
			.setName("First day of week")
			.setDesc("Which day should be the first day of the week in calendar views")
			.addDropdown((dropdown) => {
				Object.entries(FIRST_DAY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.firstDayOfWeek.toString()).onChange(async (value: string) => {
					const dayNumber = parseInt(value, 10);
					if (!Number.isNaN(dayNumber) && dayNumber >= 0 && dayNumber <= 6) {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							firstDayOfWeek: dayNumber,
						}));
					}
				});
			});

		new Setting(containerEl)
			.setName("Day start hour")
			.setDesc("First hour to show in time grid views")
			.addText((text) =>
				text
					.setPlaceholder("7")
					.setValue(settings.hourStart.toString())
					.onChange(async (value) => {
						const hour = parseInt(value, 10);
						if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
							await this.settingsStore.updateSettings((s) => ({ ...s, hourStart: hour }));
						}
					})
			);

		new Setting(containerEl)
			.setName("Day end hour")
			.setDesc("Last hour to show in time grid views")
			.addText((text) =>
				text
					.setPlaceholder("22")
					.setValue(settings.hourEnd.toString())
					.onChange(async (value) => {
						const hour = parseInt(value, 10);
						if (!Number.isNaN(hour) && hour >= 1 && hour <= 24) {
							await this.settingsStore.updateSettings((s) => ({ ...s, hourEnd: hour }));
						}
					})
			);

		new Setting(containerEl)
			.setName("Slot duration (minutes)")
			.setDesc("Duration of time slots in the calendar grid (1-60 minutes)")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(settings.slotDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration >= 1 && duration <= 60) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								slotDurationMinutes: duration,
							}));
						}
					})
			);

		new Setting(containerEl)
			.setName("Snap duration (minutes)")
			.setDesc("Snap interval when dragging or resizing events (1-60 minutes)")
			.addText((text) =>
				text
					.setPlaceholder("10")
					.setValue(settings.snapDurationMinutes.toString())
					.onChange(async (value) => {
						const duration = parseInt(value, 10);
						if (!Number.isNaN(duration) && duration >= 1 && duration <= 60) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								snapDurationMinutes: duration,
							}));
						}
					})
			);

		new Setting(containerEl)
			.setName("Zoom levels (minutes)")
			.setDesc(
				"Available zoom levels for CTRL+scroll zooming. Enter comma-separated values (1-60 minutes each)"
			)
			.addTextArea((text) => {
				text.setPlaceholder("1, 2, 3, 5, 10, 15, 20, 30, 45, 60");
				text.setValue(settings.zoomLevels.join(", "));
				text.onChange(async (value) => {
					const levels = value
						.split(",")
						.map((level) => parseInt(level.trim(), 10))
						.filter((level) => !Number.isNaN(level) && level >= 1 && level <= 60)
						.sort((a, b) => a - b); // Sort ascending

					if (levels.length > 0) {
						await this.settingsStore.updateSettings((s) => ({ ...s, zoomLevels: levels }));
					}
				});
				text.inputEl.rows = 2;
			});

		new Setting(containerEl)
			.setName("Display density")
			.setDesc("How compact to make the calendar display")
			.addDropdown((dropdown) => {
				Object.entries(DENSITY_OPTIONS).forEach(([value, label]) => {
					dropdown.addOption(value, label);
				});

				dropdown.setValue(settings.density).onChange(async (value: string) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						density: value as "comfortable" | "compact",
					}));
				});
			});
	}

	private addThermometerSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Thermometer Properties" });

		const desc = containerEl.createDiv();
		desc.createEl("p", {
			text: "Display additional frontmatter properties in calendar events. Properties will appear below the event title in a 'key: value' format. If the event is too small to show all properties, the content will be scrollable.",
		});
		desc.createEl("p", {
			text: "Enter comma-separated property names (e.g., status, priority, project, tags). Only properties that exist in the note's frontmatter will be displayed.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Display properties")
			.setDesc("Comma-separated list of frontmatter property names to display in events")
			.addTextArea((text) => {
				text.setPlaceholder("status, priority, project, tags, category");
				text.setValue(settings.thermometerProperties.join(", "));
				text.onChange(async (value) => {
					const properties = value
						.split(",")
						.map((prop) => prop.trim())
						.filter((prop) => prop.length > 0);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						thermometerProperties: properties,
					}));
				});
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
			});

		// Add example display
		const exampleContainer = containerEl.createDiv("thermometer-example");
		exampleContainer.createEl("p", {
			text: "Example display in calendar:",
			cls: "setting-item-description",
		});
		const exampleBox = exampleContainer.createDiv("example-event-box");
		exampleBox.innerHTML = `
			<div style="border: 1px solid var(--background-modifier-border); padding: 8px; border-radius: 4px; max-width: 300px;">
				<div style="font-weight: 500;">Meeting with Team</div>
				<div style="font-size: 0.9em; color: var(--text-muted); margin-top: 4px;">
					<div>status: In Progress</div>
					<div>priority: High</div>
					<div>project: Q4 Planning</div>
				</div>
			</div>
		`;
	}

	private addColorSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Event Colors" });

		// Default color setting with color picker and preview
		const defaultColorSetting = new Setting(containerEl)
			.setName("Default event color")
			.setDesc("Default color for events when no color rules match");

		// Add color preview
		const previewContainer = defaultColorSetting.settingEl.createDiv();
		previewContainer.style.display = "flex";
		previewContainer.style.alignItems = "center";
		previewContainer.style.gap = "12px";
		previewContainer.style.marginTop = "8px";

		const colorPreview = previewContainer.createEl("div");
		colorPreview.style.width = "24px";
		colorPreview.style.height = "24px";
		colorPreview.style.backgroundColor = settings.defaultEventColor;
		colorPreview.style.border = "1px solid var(--background-modifier-border)";
		colorPreview.style.borderRadius = "6px";
		colorPreview.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)";

		const previewLabel = previewContainer.createSpan();
		previewLabel.textContent = settings.defaultEventColor;
		previewLabel.style.fontFamily = "var(--font-monospace)";
		previewLabel.style.fontSize = "12px";
		previewLabel.style.color = "var(--text-muted)";

		// Add color picker
		defaultColorSetting.addColorPicker((colorPicker) => {
			colorPicker.setValue(settings.defaultEventColor);
			colorPicker.onChange(async (value) => {
				const color = value || DEFAULT_EVENT_COLOR;
				await this.settingsStore.updateSettings((s) => ({ ...s, defaultEventColor: color }));

				// Update preview
				colorPreview.style.backgroundColor = color;
				previewLabel.textContent = color;
			});
		});

		// Color rules section
		const colorRulesContainer = containerEl.createDiv();
		colorRulesContainer.style.marginTop = "16px";

		const desc = colorRulesContainer.createDiv();
		desc.style.marginBottom = "16px";
		desc.createEl("p", {
			text: "Define color rules based on frontmatter properties. Rules are evaluated in order - the first matching rule determines the event color.",
		});

		// Examples section
		const examplesContainer = desc.createDiv();
		examplesContainer.style.marginTop = "12px";
		examplesContainer.style.padding = "12px";
		examplesContainer.style.backgroundColor = "var(--background-secondary)";
		examplesContainer.style.borderRadius = "8px";
		examplesContainer.style.border = "1px solid var(--background-modifier-border)";

		examplesContainer.createEl("strong", { text: "Example color rules:" });
		const examplesList = examplesContainer.createEl("ul");
		examplesList.style.marginTop = "8px";
		examplesList.style.marginBottom = "0";

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
			li.style.marginBottom = "4px";

			const expressionCode = li.createEl("code");
			expressionCode.textContent = example.expression;
			expressionCode.style.backgroundColor = "var(--background-primary)";
			expressionCode.style.padding = "2px 4px";
			expressionCode.style.borderRadius = "3px";

			li.createSpan({ text: " → " });

			const colorSpan = li.createEl("span");
			colorSpan.style.display = "inline-block";
			colorSpan.style.width = "16px";
			colorSpan.style.height = "16px";
			colorSpan.style.backgroundColor = example.color;
			colorSpan.style.border = "1px solid var(--background-modifier-border)";
			colorSpan.style.borderRadius = "3px";
			colorSpan.style.marginRight = "8px";
			colorSpan.style.verticalAlign = "middle";

			li.createSpan({ text: example.description, cls: "setting-item-description" });
		});

		// Warning section
		const warningContainer = desc.createDiv();
		warningContainer.style.marginTop = "12px";
		warningContainer.style.padding = "12px";
		warningContainer.style.backgroundColor = "var(--background-modifier-error-rgb)";
		warningContainer.style.borderRadius = "8px";
		warningContainer.style.border = "1px solid var(--background-modifier-error)";

		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use 'fm' to access frontmatter properties. Invalid expressions will be ignored. Colors can be CSS color names, hex codes, or HSL values.",
		});

		// Color rules list
		const colorRulesListContainer = colorRulesContainer.createDiv();
		colorRulesListContainer.style.marginTop = "16px";

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
			emptyState.style.textAlign = "center";
			emptyState.style.padding = "20px";
			emptyState.style.color = "var(--text-muted)";
			emptyState.style.fontStyle = "italic";
			emptyState.textContent = "No color rules defined. Click 'Add Rule' to create one.";
			return;
		}

		colorRules.forEach((rule, index) => {
			const ruleContainer = container.createDiv();
			ruleContainer.style.border = "1px solid var(--background-modifier-border)";
			ruleContainer.style.borderRadius = "8px";
			ruleContainer.style.padding = "16px";
			ruleContainer.style.marginBottom = "12px";
			ruleContainer.style.backgroundColor = "var(--background-secondary)";

			// Rule header with enable/disable toggle and delete button
			const headerContainer = ruleContainer.createDiv();
			headerContainer.style.display = "flex";
			headerContainer.style.justifyContent = "space-between";
			headerContainer.style.alignItems = "center";
			headerContainer.style.marginBottom = "12px";

			const leftSection = headerContainer.createDiv();
			leftSection.style.display = "flex";
			leftSection.style.alignItems = "center";
			leftSection.style.gap = "12px";

			// Rule order indicator
			const orderIndicator = leftSection.createEl("span");
			orderIndicator.textContent = `#${index + 1}`;
			orderIndicator.style.fontSize = "12px";
			orderIndicator.style.fontWeight = "bold";
			orderIndicator.style.color = "var(--text-muted)";
			orderIndicator.style.minWidth = "24px";

			// Color preview
			const colorPreview = leftSection.createEl("div");
			colorPreview.style.width = "20px";
			colorPreview.style.height = "20px";
			colorPreview.style.backgroundColor = rule.color;
			colorPreview.style.border = "1px solid var(--background-modifier-border)";
			colorPreview.style.borderRadius = "4px";

			// Enable/disable toggle
			const enableToggle = leftSection.createEl("input");
			enableToggle.type = "checkbox";
			enableToggle.checked = rule.enabled;
			enableToggle.onchange = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) =>
						r.id === rule.id ? { ...r, enabled: enableToggle.checked } : r
					),
				}));
			};

			const rightSection = headerContainer.createDiv();
			rightSection.style.display = "flex";
			rightSection.style.gap = "8px";

			// Move up button
			if (index > 0) {
				const moveUpButton = rightSection.createEl("button");
				moveUpButton.textContent = "↑";
				moveUpButton.title = "Move up";
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

			// Move down button
			if (index < colorRules.length - 1) {
				const moveDownButton = rightSection.createEl("button");
				moveDownButton.textContent = "↓";
				moveDownButton.title = "Move down";
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

			// Delete button
			const deleteButton = rightSection.createEl("button");
			deleteButton.textContent = "×";
			deleteButton.title = "Delete rule";
			deleteButton.style.color = "var(--text-error)";
			deleteButton.onclick = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.filter((r) => r.id !== rule.id),
				}));
				this.renderColorRulesList(container);
			};

			// Expression input
			const expressionContainer = ruleContainer.createDiv();
			expressionContainer.style.marginBottom = "12px";

			const expressionLabel = expressionContainer.createEl("label");
			expressionLabel.textContent = "Expression:";
			expressionLabel.style.display = "block";
			expressionLabel.style.marginBottom = "4px";
			expressionLabel.style.fontWeight = "500";

			const expressionInput = expressionContainer.createEl("input");
			expressionInput.type = "text";
			expressionInput.value = rule.expression;
			expressionInput.placeholder = "fm.Priority === 'High'";
			expressionInput.style.width = "100%";
			expressionInput.style.fontFamily = "var(--font-monospace)";

			expressionInput.oninput = async () => {
				await this.settingsStore.updateSettings((s) => ({
					...s,
					colorRules: s.colorRules.map((r) =>
						r.id === rule.id ? { ...r, expression: expressionInput.value } : r
					),
				}));
			};

			// Color input with color picker
			const colorContainer = ruleContainer.createDiv();
			colorContainer.style.display = "flex";
			colorContainer.style.gap = "12px";
			colorContainer.style.alignItems = "center";
			colorContainer.style.marginTop = "8px";

			const colorLabel = colorContainer.createEl("label");
			colorLabel.textContent = "Color:";
			colorLabel.style.fontWeight = "500";
			colorLabel.style.minWidth = "50px";

			// Create a wrapper for the color picker and preview
			const colorPickerContainer = colorContainer.createDiv();
			colorPickerContainer.style.display = "flex";
			colorPickerContainer.style.alignItems = "center";
			colorPickerContainer.style.gap = "8px";
			colorPickerContainer.style.flex = "1";

			// Color value display
			const colorValueDisplay = colorPickerContainer.createSpan();
			colorValueDisplay.textContent = rule.color;
			colorValueDisplay.style.fontFamily = "var(--font-monospace)";
			colorValueDisplay.style.fontSize = "12px";
			colorValueDisplay.style.color = "var(--text-muted)";
			colorValueDisplay.style.minWidth = "100px";

			// Create a Setting specifically for the color picker
			const colorPickerSetting = new Setting(colorPickerContainer);
			colorPickerSetting.settingEl.style.border = "none";
			colorPickerSetting.settingEl.style.padding = "0";
			colorPickerSetting.addColorPicker((colorPicker) => {
				colorPicker.setValue(rule.color);
				colorPicker.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						colorRules: s.colorRules.map((r) => (r.id === rule.id ? { ...r, color: value } : r)),
					}));

					// Update color preview and value display
					colorPreview.style.backgroundColor = value;
					colorValueDisplay.textContent = value;
				});
			});
		});
	}

	private addFilterSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Event Filtering" });

		const desc = containerEl.createDiv();
		desc.style.marginBottom = "16px";
		desc.createEl("p", {
			text: "Filter events based on their frontmatter properties using JavaScript expressions. Each expression should evaluate to true/false. Events must pass ALL filters to be included.",
		});

		// Examples section
		const examplesContainer = desc.createDiv();
		examplesContainer.style.marginTop = "12px";
		examplesContainer.style.padding = "12px";
		examplesContainer.style.backgroundColor = "var(--background-secondary)";
		examplesContainer.style.borderRadius = "8px";
		examplesContainer.style.border = "1px solid var(--background-modifier-border)";

		examplesContainer.createEl("strong", { text: "Examples:" });
		const examplesList = examplesContainer.createEl("ul");
		examplesList.style.marginTop = "8px";
		examplesList.style.marginBottom = "0";

		const examples = [
			"fm.Status !== 'Inbox'",
			"fm.Priority === 'High'",
			"fm.Status === 'Done' || fm.Status === 'In Progress'",
			"!fm._Archived",
			"Array.isArray(fm.Project) && fm.Project.length > 0",
		];

		examples.forEach((example) => {
			const li = examplesList.createEl("li");
			const code = li.createEl("code");
			code.textContent = example;
			code.style.backgroundColor = "var(--background-primary)";
			code.style.padding = "2px 4px";
			code.style.borderRadius = "3px";
		});

		// Warning section
		const warningContainer = desc.createDiv();
		warningContainer.style.marginTop = "12px";
		warningContainer.style.padding = "12px";
		warningContainer.style.backgroundColor = "var(--background-modifier-error-rgb)";
		warningContainer.style.borderRadius = "8px";
		warningContainer.style.border = "1px solid var(--background-modifier-error)";

		warningContainer.createEl("strong", { text: "⚠️ Important:" });
		warningContainer.createEl("p", {
			text: "Use 'fm' to access frontmatter properties (e.g., fm.Status, fm.Priority). Invalid expressions will be ignored and logged to console.",
		});

		new Setting(containerEl)
			.setName("Filter expressions")
			.setDesc("JavaScript expressions to filter events (one per line)")
			.addTextArea((text) => {
				text.setPlaceholder("fm.Status !== 'Inbox'\nfm.Priority === 'High'");
				text.setValue(settings.filterExpressions.join("\n"));
				text.onChange(async (value) => {
					const expressions = value
						.split("\n")
						.map((expr) => expr.trim())
						.filter((expr) => expr.length > 0);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						filterExpressions: expressions,
					}));
				});
				text.inputEl.rows = 5;
				text.inputEl.style.fontFamily = "var(--font-monospace)";
			});
	}

	private addTimezoneSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		containerEl.createEl("h3", { text: "Timezone Settings" });

		new Setting(containerEl)
			.setName("Default timezone")
			.setDesc("Default timezone for events (use 'system' for local timezone)")
			.addText((text) =>
				text
					.setPlaceholder("system")
					.setValue(settings.timezone)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							timezone: value || "system",
						}));
					})
			);
	}
}
