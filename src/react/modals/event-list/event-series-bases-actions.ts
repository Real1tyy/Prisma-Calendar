import { cls, showModal } from "@real1ty-obsidian-plugins";

import {
	type EventSeriesBasesViewConfig,
	showEventSeriesBasesViewModal,
	showHeatmapModal,
	showTimelineModal,
} from "../../../components/modals";
import { renderProUpgradeBanner } from "../../../components/settings/pro-upgrade-banner";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { PRO_FEATURES } from "../../../core/license";
import type { CalendarEvent } from "../../../types/calendar";
import { removeZettelId } from "../../../utils/events/zettel-id";

export interface EventSeriesBasesFooterActions {
	openTimeline: () => void;
	openHeatmap: () => void;
	openBasesView: (viewType: "table" | "cards" | "list") => void;
}

type SeriesViewPayload = {
	events: CalendarEvent[];
	title: string;
	categoryColor?: string;
};

function showHeatmapProGate(bundle: CalendarBundle): void {
	showModal({
		app: bundle.plugin.app,
		cls: cls("heatmap-pro-gate-modal"),
		render: (el) => {
			renderProUpgradeBanner(
				el,
				PRO_FEATURES.HEATMAP,
				"Visualize your events over time with an interactive heatmap. See patterns, streaks, and activity density at a glance.",
				"HEATMAP"
			);
		},
	});
}

function openHeatmapFromPayload(bundle: CalendarBundle, payload: SeriesViewPayload | null): void {
	if (!bundle.plugin.licenseManager.isPro) {
		showHeatmapProGate(bundle);
		return;
	}
	if (payload && payload.events.length > 0) {
		showHeatmapModal(bundle.plugin.app, bundle, {
			events: payload.events,
			title: payload.title,
			...(payload.categoryColor ? { categoryColor: payload.categoryColor } : {}),
		});
	}
}

function openTimelineFromPayload(bundle: CalendarBundle, payload: SeriesViewPayload | null): void {
	if (payload && payload.events.length > 0) {
		showTimelineModal(bundle.plugin.app, bundle, { events: payload.events, title: payload.title });
	}
}

export function createRecurringSeriesBasesActions(
	bundle: CalendarBundle,
	rruleId: string
): EventSeriesBasesFooterActions {
	const resolvePayload = (label: string): SeriesViewPayload | null => {
		const series = bundle.recurringEventManager.getRecurringEventSeries(rruleId);
		if (!series) return null;
		return {
			events: series.instances.map((i) => i.event),
			title: `${label} for Recurring - ${removeZettelId(series.sourceTitle)}`,
		};
	};
	return {
		openTimeline: () => openTimelineFromPayload(bundle, resolvePayload("Timeline")),
		openHeatmap: () => openHeatmapFromPayload(bundle, resolvePayload("Heatmap")),
		openBasesView: (viewType) => {
			const settings = bundle.settingsStore.currentSettings;
			const series = bundle.recurringEventManager.getRecurringEventSeries(rruleId);
			const displayTitle = series ? removeZettelId(series.sourceTitle) : rruleId;
			const config: EventSeriesBasesViewConfig = {
				mode: "recurring",
				filterValue: rruleId,
				displayTitle,
				viewType,
			};
			showEventSeriesBasesViewModal(bundle.plugin.app, settings, config);
		},
	};
}

export function createNameSeriesBasesActions(bundle: CalendarBundle, nameKey: string): EventSeriesBasesFooterActions {
	const resolvePayload = (label: string): SeriesViewPayload | null => {
		const events = bundle.nameSeriesTracker.getEventsInNameSeries(nameKey);
		const displayName = events.length > 0 ? removeZettelId(events[0].title) : nameKey;
		return { events, title: `${label} for Name - ${displayName}` };
	};
	return {
		openTimeline: () => openTimelineFromPayload(bundle, resolvePayload("Timeline")),
		openHeatmap: () => openHeatmapFromPayload(bundle, resolvePayload("Heatmap")),
		openBasesView: (viewType) => {
			const settings = bundle.settingsStore.currentSettings;
			const nameEvents = bundle.nameSeriesTracker.getEventsInNameSeries(nameKey);
			const displayTitle = nameEvents.length > 0 ? removeZettelId(nameEvents[0].title) : nameKey;
			const config: EventSeriesBasesViewConfig = {
				mode: "name",
				filterValue: displayTitle,
				displayTitle,
				viewType,
			};
			showEventSeriesBasesViewModal(bundle.plugin.app, settings, config);
		},
	};
}

export function createCategorySeriesBasesActions(
	bundle: CalendarBundle,
	categoryValue: string
): EventSeriesBasesFooterActions {
	const resolvePayload = (label: string): SeriesViewPayload => ({
		events: bundle.categoryTracker.getEventsWithCategory(categoryValue),
		title: `${label} for Category - ${categoryValue}`,
		categoryColor: bundle.categoryTracker.getCategoryColor(categoryValue),
	});
	return {
		openTimeline: () => openTimelineFromPayload(bundle, resolvePayload("Timeline")),
		openHeatmap: () => openHeatmapFromPayload(bundle, resolvePayload("Heatmap")),
		openBasesView: (viewType) => {
			const settings = bundle.settingsStore.currentSettings;
			const config: EventSeriesBasesViewConfig = {
				mode: "category",
				filterValue: categoryValue,
				viewType,
			};
			showEventSeriesBasesViewModal(bundle.plugin.app, settings, config);
		},
	};
}
