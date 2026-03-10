import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import { SETTINGS_DEFAULTS } from "../../constants";
import type { CalendarSettingsStore } from "../../core/settings-store";
import type { SingleCalendarConfigSchema } from "../../types/settings";

export class EventGroupsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;
	private currentContainer: HTMLElement | null = null;

	constructor(private settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.currentContainer = containerEl;
		this.addRecurringEventSettings(containerEl);
	}

	private rerender(): void {
		if (this.currentContainer) {
			this.currentContainer.empty();
			this.display(this.currentContainer);
		}
	}

	private addRecurringEventSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Recurring events").setHeading();

		this.ui.addSlider(containerEl, {
			key: "futureInstancesCount",
			name: "Future instances count",
			desc: "Maximum number of future recurring event instances to generate (1-52)",
			min: 1,
			max: 52,
			step: 1,
		});

		this.ui.addMutuallyExclusiveToggles(
			containerEl,
			{
				toggleA: {
					key: "propagateFrontmatterToInstances",
					name: "Propagate frontmatter to instances",
					desc: "Automatically propagate frontmatter changes from recurring event sources to all physical instances. When you update custom properties (like category, priority, status) in a source event, all existing instances are updated immediately.",
				},
				toggleB: {
					key: "askBeforePropagatingFrontmatter",
					name: "Ask before propagating",
					desc: "Show a confirmation modal before propagating frontmatter changes to instances. Allows you to review changes before applying them.",
				},
			},
			() => this.rerender()
		);

		new Setting(containerEl).setName("Name series propagation").setHeading();

		this.ui.addMutuallyExclusiveToggles(
			containerEl,
			{
				toggleA: {
					key: "propagateFrontmatterToNameSeries",
					name: "Propagate frontmatter to name series",
					desc: "Automatically propagate frontmatter changes across events that share the same title. When you update custom properties on one event, all other events with the same name are updated immediately.",
				},
				toggleB: {
					key: "askBeforePropagatingToNameSeries",
					name: "Ask before propagating to name series",
					desc: "Show a confirmation modal before propagating frontmatter changes to name series members. Allows you to review changes before applying them.",
				},
			},
			() => this.rerender()
		);

		new Setting(containerEl).setName("Category series propagation").setHeading();

		this.ui.addMutuallyExclusiveToggles(
			containerEl,
			{
				toggleA: {
					key: "propagateFrontmatterToCategorySeries",
					name: "Propagate frontmatter to category series",
					desc: "Automatically propagate frontmatter changes across events that share the same category. When you update custom properties on one event, all other events with the same category are updated immediately.",
				},
				toggleB: {
					key: "askBeforePropagatingToCategorySeries",
					name: "Ask before propagating to category series",
					desc: "Show a confirmation modal before propagating frontmatter changes to category series members. Allows you to review changes before applying them.",
				},
			},
			() => this.rerender()
		);

		new Setting(containerEl).setName("Shared propagation settings").setHeading();

		this.ui.addText(containerEl, {
			key: "excludedRecurringPropagatedProps",
			name: "Excluded properties",
			desc: "Comma-separated list of frontmatter property names to exclude from propagation. Applies to all propagation types: recurring instances, name series, and category series.",
			placeholder: "Property1, Property2, Property3",
		});

		this.ui.addSlider(containerEl, {
			key: "propagationDebounceMs",
			name: "Propagation debounce delay",
			desc: "Delay in milliseconds before propagating frontmatter changes. Multiple rapid changes within this window will be accumulated and applied together. Applies to all propagation types.",
			min: 100,
			max: 10000,
			step: 100,
		});

		new Setting(containerEl).setName("Event markers").setHeading();

		this.ui.addToggle(containerEl, {
			key: "showSourceRecurringMarker",
			name: "Show source recurring marker",
			desc: "Display a marker indicator on source recurring events (the original event that generates instances).",
		});

		this.ui.addText(containerEl, {
			key: "sourceRecurringMarker",
			name: "Source recurring marker",
			desc: "Symbol/emoji to display on source recurring events in the top-right corner.",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_SOURCE_RECURRING_MARKER,
		});

		this.ui.addToggle(containerEl, {
			key: "showPhysicalRecurringMarker",
			name: "Show physical recurring marker",
			desc: "Display a marker indicator on physical recurring instance events (actual instances created from source).",
		});

		this.ui.addText(containerEl, {
			key: "physicalRecurringMarker",
			name: "Physical recurring marker",
			desc: "Symbol/emoji to display on physical recurring instance events in the top-right corner.",
			placeholder: SETTINGS_DEFAULTS.DEFAULT_PHYSICAL_RECURRING_MARKER,
		});
	}
}
