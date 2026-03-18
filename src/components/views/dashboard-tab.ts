import type { TabDefinition } from "@real1ty-obsidian-plugins";
import { cls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { formatRecurrenceLabel, isPresetType } from "../../types/recurring-event";
import { removeZettelId } from "../../utils/event-naming";
import { getCategoriesFromFilePath } from "../../utils/obsidian";
import { EventSeriesModal } from "../list-modals/event-series-modal";
import {
	buildChartDataFromItems,
	type DashboardItem,
	type DashboardSectionHandle,
	renderDashboardSection,
} from "./dashboard-section";

interface DashboardHandle {
	destroy: () => void;
}

export function createDashboardTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let dashboardHandle: DashboardHandle | null = null;

	return {
		id: "dashboard",
		label: "Dashboard",
		render: (el) => {
			dashboardHandle = renderDashboardInto(el, app, bundle);
		},
		cleanup: () => {
			dashboardHandle?.destroy();
			dashboardHandle = null;
		},
	};
}

function renderDashboardInto(container: HTMLElement, app: App, bundle: CalendarBundle): DashboardHandle {
	const subscriptions: Subscription[] = [];
	let sectionHandles: DashboardSectionHandle[] = [];

	const scrollContainer = container.createDiv(cls("dashboard-container"));

	function destroySections(): void {
		for (const handle of sectionHandles) {
			handle.destroy();
		}
		sectionHandles = [];
	}

	function render(): void {
		destroySections();
		scrollContainer.empty();

		renderRecurringSection();
		renderCategoriesSection();
		renderNameSeriesSection();
	}

	function renderRecurringSection(): void {
		const allRecurring = bundle.recurringEventManager.getAllRecurringEvents();
		const settings = bundle.settingsStore.currentSettings;

		const items: DashboardItem[] = allRecurring.map((event) => {
			const displayTitle = removeZettelId(event.title);
			const categories = getCategoriesFromFilePath(app, event.sourceFilePath, settings.categoryProp);
			const instanceCount = bundle.recurringEventManager.getInstanceCountByRRuleId(event.rRuleId);

			const categoryColor = categories.length > 0 ? bundle.categoryTracker.getCategoryColor(categories[0]) : undefined;

			const recurrenceType = event.rrules.type;
			const badgeLabel = formatRecurrenceLabel(recurrenceType);
			const isDisabled = !!event.metadata.skip;

			return {
				key: event.rRuleId,
				title: displayTitle,
				count: instanceCount,
				...(categoryColor ? { color: categoryColor } : {}),
				extraProps: {
					type: badgeLabel,
					typeSort: isPresetType(recurrenceType) ? recurrenceType : "custom",
					category: categories.join(", ") || "\u2014",
					status: isDisabled ? "Disabled" : "Enabled",
				},
			};
		});

		const typeCounts = new Map<string, number>();
		for (const event of allRecurring) {
			const label = formatRecurrenceLabel(event.rrules.type);
			typeCounts.set(label, (typeCounts.get(label) ?? 0) + 1);
		}
		const chartData = buildChartDataFromItems(
			Array.from(typeCounts.entries()).map(([label, count]) => ({
				key: label,
				title: label,
				count,
				extraProps: {},
			}))
		);

		const handle = renderDashboardSection(scrollContainer, {
			title: "Recurring Events",
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "type", label: "Type" },
				{ key: "count", label: "Instances", align: "center" },
				{ key: "category", label: "Category" },
				{ key: "status", label: "Status", align: "center" },
			],
			chartData,
			chartTooltipFormatter: (label, value, percentage) =>
				`${label}: ${value} event${value === 1 ? "" : "s"} (${percentage}%)`,
			onItemClick: (item) => {
				new EventSeriesModal(app, bundle, item.title.toLowerCase(), item.key).open();
			},
			emptyMessage: "No recurring events found.",
		});
		sectionHandles.push(handle);
	}

	function renderCategoriesSection(): void {
		const categories = bundle.categoryTracker.getCategories();

		const items: DashboardItem[] = categories.map((categoryName) => {
			const stats = bundle.categoryTracker.getCategoryStats(categoryName);
			const color = bundle.categoryTracker.getCategoryColor(categoryName);
			const total = stats.total;
			const timedPct = total > 0 ? `${((stats.timed / total) * 100).toFixed(0)}%` : "0%";
			const allDayPct = total > 0 ? `${((stats.allDay / total) * 100).toFixed(0)}%` : "0%";

			return {
				key: categoryName,
				title: categoryName,
				count: total,
				color,
				extraProps: {
					timed: stats.timed,
					timedPct,
					allDay: stats.allDay,
					allDayPct,
				},
			};
		});

		const chartData = buildChartDataFromItems(items);

		const handle = renderDashboardSection(scrollContainer, {
			title: "Categories",
			items,
			columns: [
				{ key: "title", label: "Category" },
				{ key: "count", label: "Total", align: "center" },
				{ key: "timed", label: "Timed", align: "center" },
				{ key: "timedPct", label: "Timed %", align: "center" },
				{ key: "allDay", label: "All-day", align: "center" },
				{ key: "allDayPct", label: "All-day %", align: "center" },
			],
			chartData,
			chartTooltipFormatter: (label, value, percentage) =>
				`${label}: ${value} event${value === 1 ? "" : "s"} (${percentage}%)`,
			onItemClick: (item) => {
				new EventSeriesModal(app, bundle, null, null, [item.key]).open();
			},
			emptyMessage: "No categories found. Add a category property to your events.",
		});
		sectionHandles.push(handle);
	}

	function renderNameSeriesSection(): void {
		const settings = bundle.settingsStore.currentSettings;
		if (!settings.enableNameSeriesTracking) return;

		const nameSeries = bundle.nameSeriesTracker.getNameBasedSeries();

		const items: DashboardItem[] = Array.from(nameSeries.entries()).map(([nameKey, files]) => ({
			key: nameKey,
			title: nameKey.charAt(0).toUpperCase() + nameKey.slice(1),
			count: files.size,
			extraProps: {},
		}));

		const chartData = buildChartDataFromItems(items);

		const handle = renderDashboardSection(scrollContainer, {
			title: "By Name",
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "count", label: "Events", align: "center" },
			],
			chartData,
			chartTooltipFormatter: (label, value, percentage) =>
				`${label}: ${value} event${value === 1 ? "" : "s"} (${percentage}%)`,
			onItemClick: (item) => {
				new EventSeriesModal(app, bundle, item.key, null).open();
			},
			emptyMessage: "No name-based series found.",
		});
		sectionHandles.push(handle);
	}

	render();

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;
	function debouncedRender(): void {
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => render(), 300);
	}

	subscriptions.push(bundle.categoryTracker.categories$.subscribe(() => debouncedRender()));
	subscriptions.push(bundle.eventStore.subscribe(() => debouncedRender()));
	subscriptions.push(bundle.recurringEventManager.subscribe(() => debouncedRender()));

	return {
		destroy: () => {
			if (debounceTimer) clearTimeout(debounceTimer);
			destroySections();
			for (const sub of subscriptions) {
				sub.unsubscribe();
			}
		},
	};
}
