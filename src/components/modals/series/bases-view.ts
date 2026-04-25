import {
	BaseBuilder,
	type BaseFilterNode,
	BaseRenderer,
	type BaseViewType,
	cls,
	ColumnRef,
	Filter,
	showModal,
} from "@real1ty-obsidian-plugins";
import { type App, Component, MarkdownRenderer } from "obsidian";

import type { SingleCalendarConfig } from "../../../types/settings";

interface BasesViewConfig {
	app: App;
	title: string;
	viewName: string;
	filters: BaseFilterNode[];
	settings: SingleCalendarConfig;
	viewType?: BaseViewType;
}

function buildBasesMarkdown(config: BasesViewConfig): string {
	const { directory, sortDateProp, statusProperty, basesViewProperties, calendarTitleProp } = config.settings;
	const nameColumn = calendarTitleProp;
	const viewType = config.viewType ?? (config.settings.basesViewType as BaseViewType);

	const def = BaseBuilder.create()
		.addView({
			type: viewType,
			name: config.viewName,
			filter: Filter.and(Filter.inFolder(directory), ...config.filters),
			order: [nameColumn, sortDateProp, statusProperty, ...basesViewProperties].filter(Boolean),
			sort: [{ property: sortDateProp, direction: "DESC" }],
			columnSize: { [ColumnRef.note(sortDateProp)]: 170 },
		})
		.build();

	return BaseRenderer.renderCodeBlock(def);
}

function renderBasesView(el: HTMLElement, config: BasesViewConfig): { component: Component } {
	const component = new Component();
	component.load();

	el.createEl("h2", { text: config.title });
	const markdownContainerEl = el.createDiv({ cls: cls("bases-markdown-container") });

	const markdown = buildBasesMarkdown(config);
	void MarkdownRenderer.render(config.app, markdown, markdownContainerEl, "", component);

	return { component };
}

function showBasesViewModal(config: BasesViewConfig): void {
	let component: Component | null = null;

	showModal({
		app: config.app,
		cls: cls("category-modal"),
		render: (el) => {
			const result = renderBasesView(el, config);
			component = result.component;
		},
		cleanup: () => {
			component?.unload();
			component = null;
		},
	});
}

export function showCategoryEventsModal(app: App, categoryName: string, settings: SingleCalendarConfig): void {
	showBasesViewModal({
		app,
		title: `Category: ${categoryName}`,
		viewName: categoryName,
		filters: [Filter.contains(settings.categoryProp, categoryName)],
		settings,
	});
}

export function showIntervalEventsModal(
	app: App,
	intervalLabel: string,
	startDate: string,
	endDate: string,
	settings: SingleCalendarConfig
): void {
	showBasesViewModal({
		app,
		title: `Events: ${intervalLabel}`,
		viewName: intervalLabel,
		filters: [Filter.gt(settings.sortDateProp, startDate), Filter.lt(settings.sortDateProp, endDate)],
		settings,
	});
}

export interface EventSeriesBasesViewConfig {
	mode: "recurring" | "name" | "category";
	filterValue: string;
	displayTitle?: string;
	viewType: "table" | "cards" | "list";
}

export function showEventSeriesBasesViewModal(
	app: App,
	settings: SingleCalendarConfig,
	config: EventSeriesBasesViewConfig
): void {
	const label = config.displayTitle ?? config.filterValue;

	let title: string;
	let filters: BaseFilterNode[];

	switch (config.mode) {
		case "recurring":
			title = `Recurring: ${label}`;
			filters = [Filter.eq(settings.rruleIdProp, config.filterValue)];
			break;
		case "name":
			title = `Series: ${label}`;
			filters = [Filter.contains(settings.calendarTitleProp, config.filterValue)];
			break;
		case "category":
			title = `Category: ${label}`;
			filters = [Filter.contains(settings.categoryProp, config.filterValue)];
			break;
	}

	showBasesViewModal({
		app,
		title,
		viewName: config.displayTitle ?? config.filterValue,
		filters,
		settings,
		viewType: config.viewType,
	});
}
