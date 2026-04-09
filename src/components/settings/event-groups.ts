import { SettingsUIBuilder } from "@real1ty-obsidian-plugins";
import { Setting } from "obsidian";

import type { CalendarSettingsStore } from "../../core/settings-store";
import { SingleCalendarConfigSchema } from "../../types/settings";

const S = SingleCalendarConfigSchema.shape;

const EXCLUDED_PROPS_OVERRIDES = { label: "Excluded properties", placeholder: "Property1, Property2, Property3" };

export class EventGroupsSettings {
	private ui: SettingsUIBuilder<typeof SingleCalendarConfigSchema>;
	private currentContainer: HTMLElement | null = null;

	constructor(settingsStore: CalendarSettingsStore) {
		this.ui = new SettingsUIBuilder(settingsStore as never);
	}

	display(containerEl: HTMLElement): void {
		this.currentContainer = containerEl;
		this.addRecurringEventSettings(containerEl);
	}

	private rerender(): void {
		if (!this.currentContainer) return;

		const scrollParent = this.findScrollParent(this.currentContainer);
		const savedScrollTop = scrollParent?.scrollTop ?? 0;

		this.currentContainer.empty();
		this.display(this.currentContainer);

		if (scrollParent) {
			scrollParent.scrollTop = savedScrollTop;
		}
	}

	private findScrollParent(el: HTMLElement): HTMLElement | null {
		let parent = el.parentElement;
		while (parent) {
			if (parent.scrollHeight > parent.clientHeight) return parent;
			parent = parent.parentElement;
		}
		return null;
	}

	private addRecurringEventSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Recurring events").setHeading();

		this.ui.addSchemaField(containerEl, { futureInstancesCount: S.futureInstancesCount });

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

		this.ui.addSchemaField(
			containerEl,
			{ excludedRecurringInstanceProps: S.excludedRecurringInstanceProps },
			EXCLUDED_PROPS_OVERRIDES
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

		this.ui.addSchemaField(
			containerEl,
			{ excludedNameSeriesProps: S.excludedNameSeriesProps },
			EXCLUDED_PROPS_OVERRIDES
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

		this.ui.addSchemaField(
			containerEl,
			{ excludedCategorySeriesProps: S.excludedCategorySeriesProps },
			EXCLUDED_PROPS_OVERRIDES
		);

		new Setting(containerEl).setName("Event markers").setHeading();

		this.ui.addSchemaField(containerEl, { showSourceRecurringMarker: S.showSourceRecurringMarker });
		this.ui.addSchemaField(containerEl, { sourceRecurringMarker: S.sourceRecurringMarker });
		this.ui.addSchemaField(containerEl, { showPhysicalRecurringMarker: S.showPhysicalRecurringMarker });
		this.ui.addSchemaField(containerEl, { physicalRecurringMarker: S.physicalRecurringMarker });
	}
}
