import { normalizePath, Setting } from "obsidian";
import type { CalendarSettingsStore } from "../core/settings-store";
import { CALENDAR_VIEW_OPTIONS, type CalendarViewType, DENSITY_OPTIONS, FIRST_DAY_OPTIONS } from "../types/index";
import { DEFAULT_EVENT_COLOR } from "../types/settings";
import type { ColorRule } from "../utils/colors";

export class SingleCalendarSettings {
	private settingsStore: CalendarSettingsStore;
	private activeSection: "general" | "properties" | "calendar" | "rules" = "general";

	constructor(settingsStore: CalendarSettingsStore) {
		this.settingsStore = settingsStore;
	}

	display(containerEl: HTMLElement): void {
		containerEl.empty();

		this.createSectionNavigation(containerEl);
		this.renderActiveSection(containerEl);
	}

	private createSectionNavigation(containerEl: HTMLElement): void {
		const navContainer = containerEl.createDiv("settings-nav");
		const buttonContainer = navContainer.createDiv("nav-buttons");

		const sections = [
			{ id: "general" as const, label: "General" },
			{ id: "properties" as const, label: "Properties" },
			{ id: "calendar" as const, label: "Calendar" },
			{ id: "rules" as const, label: "Rules" },
		];

		sections.forEach((section) => {
			const button = buttonContainer.createEl("button", { text: section.label });
			if (this.activeSection === section.id) {
				button.addClass("active");
			}

			button.addEventListener("click", () => {
				this.activeSection = section.id;
				this.display(containerEl); // Re-render with new active section
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
	}

	private addPropertiesSettings(containerEl: HTMLElement): void {
		this.addFrontmatterSettings(containerEl);
		this.addFrontmatterDisplaySettings(containerEl);
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

		new Setting(containerEl).setName("Calendar directory").setHeading();

		new Setting(containerEl)
			.setName("Directory")
			.setDesc("Folder to scan for calendar events and create new events in")
			.addText((text) => {
				text.setValue(settings.directory);
				text.setPlaceholder("e.g., tasks, calendar, events");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						directory: normalizePath(value),
					}));
				});
			});

		new Setting(containerEl)
			.setName("Template path")
			.setDesc("Path to Templater template file for new events (optional, requires Templater plugin)")
			.addText((text) => {
				text.setValue(settings.templatePath || "");
				text.setPlaceholder("e.g., Templates/event-template.md");
				text.onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({
						...s,
						templatePath: value ? normalizePath(value) : undefined,
					}));
				});
			});
	}

	private addFrontmatterSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Frontmatter properties").setHeading();

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
			.setDesc("Frontmatter property name for event end date/time (for timed events)")
			.addText((text) =>
				text
					.setPlaceholder("End Date")
					.setValue(settings.endProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							endProp: value || "End Date",
						}));
					})
			);

		new Setting(containerEl)
			.setName("Date property")
			.setDesc("Frontmatter property name for all-day events (date only, no time)")
			.addText((text) =>
				text
					.setPlaceholder("Date")
					.setValue(settings.dateProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							dateProp: value || "Date",
						}));
					})
			);

		new Setting(containerEl)
			.setName("All-day property")
			.setDesc("Frontmatter property name for all-day flag (optional)")
			.addText((text) =>
				text
					.setPlaceholder("All Day")
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
			.setName("Skip property")
			.setDesc("Frontmatter property name to hide events from calendar (when set to true)")
			.addText((text) =>
				text
					.setPlaceholder("Skip")
					.setValue(settings.skipProp || "")
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({ ...s, skipProp: value || "Skip" }));
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
			.setDesc("Frontmatter property name for recurring event specification (weekdays for weekly/bi-weekly events)")
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

		new Setting(containerEl)
			.setName("Source property")
			.setDesc("Frontmatter property name for linking recurring event instances to their source event file")
			.addText((text) =>
				text
					.setPlaceholder("Source")
					.setValue(settings.sourceProp)
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							sourceProp: value || "Source",
						}));
					})
			);

		// Add description for event types
		const eventTypesDesc = containerEl.createDiv("settings-info-box");

		eventTypesDesc.createEl("h4", { text: "Event types" });
		eventTypesDesc.createEl("p", {
			text: "There are two types of events: timed events and all-day events. Each uses different properties.",
		});

		const timedExample = eventTypesDesc.createDiv();
		timedExample.createEl("strong", { text: "Timed event example:" });
		timedExample.createEl("pre", {
			text: `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.allDayProp}: false
---

# Team Meeting`,
			cls: "settings-info-box-example",
		});

		const allDayExample = eventTypesDesc.createDiv();
		allDayExample.createEl("strong", { text: "All-day event example:" });
		allDayExample.createEl("pre", {
			text: `---
${settings.dateProp}: 2024-01-15
${settings.allDayProp}: true
---

# Conference Day`,
			cls: "settings-info-box-example",
		});

		// Add description for recurring events
		const recurringDesc = containerEl.createDiv("settings-info-box");

		recurringDesc.createEl("h4", { text: "Recurring events" });
		recurringDesc.createEl("p", {
			text: "To create recurring events, add the RRule property to any event file's frontmatter. The plugin will automatically detect these and create recurring instances.",
		});

		const recurringExample = recurringDesc.createDiv();
		recurringExample.createEl("strong", { text: "Example:" });
		recurringExample.createEl("pre", {
			text: `---
${settings.startProp}: 2024-01-15T09:00
${settings.endProp}: 2024-01-15T10:30
${settings.rruleProp}: weekly
${settings.rruleSpecProp}: monday, wednesday, friday
---

# Weekly Team Meeting`,
			cls: "settings-info-box-example",
		});

		const typesContainer = recurringDesc.createDiv();
		typesContainer.createEl("strong", { text: "Supported RRule types" });
		const typesList = typesContainer.createEl("ul");
		["daily", "weekly", "bi-weekly", "monthly", "bi-monthly", "yearly"].forEach((type) => {
			typesList.createEl("li", { text: type });
		});

		const specContainer = recurringDesc.createDiv();
		specContainer.createEl("strong", { text: "RRuleSpec (for weekly/bi-weekly)" });
		specContainer.createEl("p", {
			text: "Comma-separated weekdays: sunday, monday, tuesday, wednesday, thursday, friday, saturday",
		});
	}

	private addRecurringEventSettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Recurring events").setHeading();

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

		new Setting(containerEl).setName("Parsing").setHeading();

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

		new Setting(containerEl).setName("User interface").setHeading();

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
			.setName("Past event contrast")
			.setDesc("Visual contrast of past events (0% = invisible, 100% = normal)")
			.addSlider((slider) => {
				slider
					.setLimits(0, 100, 1)
					.setValue(settings.pastEventContrast)
					.setDynamicTooltip()
					.onChange(async (value) => {
						await this.settingsStore.updateSettings((s) => ({
							...s,
							pastEventContrast: value,
						}));
					});
			});

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
			.setDesc("Available zoom levels for CTRL+scroll zooming. Enter comma-separated values (1-60 minutes each)")
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

		// Event overlap settings section
		new Setting(containerEl).setName("Event overlap").setHeading();

		new Setting(containerEl)
			.setName("Allow event overlap")
			.setDesc(
				"Allow events to visually overlap in all calendar views. When disabled, overlapping events display side-by-side in columns."
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.eventOverlap).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, eventOverlap: value }));
				})
			);

		new Setting(containerEl)
			.setName("Allow slot event overlap")
			.setDesc(
				"Allow events to overlap within the same time slot in time grid views. Only affects events that share exact slot boundaries."
			)
			.addToggle((toggle) =>
				toggle.setValue(settings.slotEventOverlap).onChange(async (value) => {
					await this.settingsStore.updateSettings((s) => ({ ...s, slotEventOverlap: value }));
				})
			);

		new Setting(containerEl)
			.setName("Event stack limit")
			.setDesc("Maximum number of events to stack vertically before showing '+ more' link (1-10)")
			.addText((text) =>
				text
					.setPlaceholder("3")
					.setValue(settings.eventMaxStack.toString())
					.onChange(async (value) => {
						const stackLimit = parseInt(value, 10);
						if (!Number.isNaN(stackLimit) && stackLimit >= 1 && stackLimit <= 10) {
							await this.settingsStore.updateSettings((s) => ({
								...s,
								eventMaxStack: stackLimit,
							}));
						}
					})
			);
	}

	private addFrontmatterDisplaySettings(containerEl: HTMLElement): void {
		const settings = this.settingsStore.currentSettings;

		new Setting(containerEl).setName("Frontmatter display").setHeading();

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
				text.setValue(settings.frontmatterDisplayProperties.join(", "));
				text.onChange(async (value) => {
					const properties = value
						.split(",")
						.map((prop) => prop.trim())
						.filter((prop) => prop.length > 0);
					await this.settingsStore.updateSettings((s) => ({
						...s,
						frontmatterDisplayProperties: properties,
					}));
				});
				text.inputEl.rows = 3;
				text.inputEl.cols = 50;
			});

		// Add example display
		const exampleContainer = containerEl.createDiv("frontmatter-display-example");
		exampleContainer.createEl("p", {
			text: "Example display in calendar:",
			cls: "setting-item-description",
		});

		const exampleBox = exampleContainer.createDiv("example-event-box");
		exampleBox.createEl("div", { text: "Meeting with Team", cls: "title" });
		const propertiesContainer = exampleBox.createDiv("properties");
		propertiesContainer.createEl("div", { text: "status: In Progress" });
		propertiesContainer.createEl("div", { text: "priority: High" });
		propertiesContainer.createEl("div", { text: "project: Q4 Planning" });
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
				const color = value || DEFAULT_EVENT_COLOR;
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
