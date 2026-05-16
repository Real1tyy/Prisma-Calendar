import { type ChartDataItem, cls, tid } from "@real1ty-obsidian-plugins";
import { Cell, GridLayout, useApp, usePersistedGridStateById } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, type ReactElement, useMemo } from "react";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { useBundleChanges } from "../../react/hooks/use-bundle-changes";
import { openEventSeriesModal } from "../../react/modals/event-list";
import { removeZettelId } from "../../utils/events/zettel-id";
import { getCategoriesFromFilePath } from "../../utils/obsidian";
import { formatRecurrenceLabel, isPresetType } from "../../utils/dates/recurring";
import { useBundle } from "../contexts/bundle-context";
import { DashboardChart } from "./dashboard/dashboard-chart";
import { DashboardRanking } from "./dashboard/dashboard-ranking";
import { DashboardTable } from "./dashboard/dashboard-table";
import {
	buildChartDataFromItems,
	type ColumnDef,
	type DashboardItem,
	type StatEntry,
} from "./dashboard/dashboard-types";
import { ProGatedContent } from "./pro-gated-content";

const DASHBOARD_CSS_PREFIX = cls("dashboard-");
const REFRESH_DEBOUNCE_MS = 300;
const TOOLTIP_FORMATTER = (label: string, value: number, percentage: string): string =>
	`${label}: ${value} event${value === 1 ? "" : "s"} (${percentage}%)`;
const DASHBOARD_GRID_DEFAULTS = { columns: 2, rows: 2, rowSizes: [0.65, 0.35] };

interface DashboardData {
	items: DashboardItem[];
	columns: ColumnDef[];
	chartData: ChartDataItem[];
	stats: StatEntry[];
	onItemClick?: (item: DashboardItem) => void;
	emptyMessage: string;
}

interface DashboardSectionProps {
	id: string;
	buildData: () => DashboardData;
}

const DashboardSection = memo(function DashboardSection({ id, buildData }: DashboardSectionProps) {
	const app = useApp();
	const bundle = useBundle();
	const extra = useMemo(() => [bundle.categoryTracker.categories$], [bundle]);
	const renderToken = useBundleChanges(bundle, { debounceMs: REFRESH_DEBOUNCE_MS, extra });
	const data = useMemo(() => {
		void renderToken;
		return buildData();
	}, [buildData, renderToken]);

	const gridState = usePersistedGridStateById(bundle.settingsStore, "dashboardGridState", id, DASHBOARD_GRID_DEFAULTS);

	return (
		<GridLayout
			app={app}
			cssPrefix={DASHBOARD_CSS_PREFIX}
			columns={2}
			rows={2}
			gap="12px"
			dividers
			resizable="track"
			{...gridState}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("dashboard", id)}
		>
			<Cell id="chart" label="Chart">
				<div data-testid={tid("dashboard-cell-chart")} style={{ width: "100%", height: "100%" }}>
					<DashboardChart chartData={data.chartData} chartId={id} tooltipFormatter={TOOLTIP_FORMATTER} />
				</div>
			</Cell>
			<Cell id="ranking" label="Top Items">
				<div data-testid={tid("dashboard-cell-ranking")} style={{ width: "100%", height: "100%" }}>
					<DashboardRanking items={data.items} stats={data.stats} />
				</div>
			</Cell>
			<Cell id="table" label="Table" colSpan={2}>
				<div data-testid={tid("dashboard-cell-table")} style={{ width: "100%", height: "100%" }}>
					<DashboardTable
						items={data.items}
						columns={data.columns}
						{...(data.onItemClick ? { onItemClick: data.onItemClick } : {})}
						emptyMessage={data.emptyMessage}
					/>
				</div>
			</Cell>
		</GridLayout>
	);
});

interface GatedSectionProps extends DashboardSectionProps {
	previewKey: "DASHBOARD";
}

const GatedDashboardSection = memo(function GatedDashboardSection(props: GatedSectionProps) {
	return (
		<ProGatedContent
			featureName={PRO_FEATURES.DASHBOARD}
			description="Get a comprehensive overview of your calendar with charts, rankings, and key statistics — all in one place. Organized by name, category and recurring event series. "
			previewKey={props.previewKey}
		>
			<DashboardSection {...props} />
		</ProGatedContent>
	);
});

function buildByNameData(app: App, bundle: CalendarBundle): () => DashboardData {
	return () => {
		const nameSeries = bundle.nameSeriesTracker.getNameBasedSeries();

		const items: DashboardItem[] = Array.from(nameSeries.entries()).map(([nameKey, files]) => ({
			key: nameKey,
			title: nameKey.charAt(0).toUpperCase() + nameKey.slice(1),
			count: files.size,
			extraProps: {},
		}));

		const totalEvents = items.reduce((sum, i) => sum + i.count, 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "count", label: "Events", align: "center" as const },
			],
			chartData: buildChartDataFromItems(items),
			stats: [
				{ label: "Series", value: items.length },
				{ label: "Total Events", value: totalEvents },
				{ label: "Avg / Series", value: items.length > 0 ? Math.round(totalEvents / items.length) : 0 },
			],
			onItemClick: (item: DashboardItem) => {
				openEventSeriesModal(app, bundle, item.key, null);
			},
			emptyMessage: "No name-based series found.",
		};
	};
}

function buildByCategoryData(app: App, bundle: CalendarBundle): () => DashboardData {
	return () => {
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
				extraProps: { timed: stats.timed, timedPct, allDay: stats.allDay, allDayPct },
			};
		});

		const totalEvents = items.reduce((sum, i) => sum + i.count, 0);
		const totalTimed = items.reduce((sum, i) => sum + (i.extraProps["timed"] as number), 0);
		const totalAllDay = items.reduce((sum, i) => sum + (i.extraProps["allDay"] as number), 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Category" },
				{ key: "count", label: "Total", align: "center" as const },
				{ key: "timed", label: "Timed", align: "center" as const },
				{ key: "timedPct", label: "Timed %", align: "center" as const },
				{ key: "allDay", label: "All-day", align: "center" as const },
				{ key: "allDayPct", label: "All-day %", align: "center" as const },
			],
			chartData: buildChartDataFromItems(items),
			stats: [
				{ label: "Categories", value: items.length },
				{ label: "Total Events", value: totalEvents },
				{ label: "Timed", value: totalTimed },
				{ label: "All-day", value: totalAllDay },
			],
			onItemClick: (item: DashboardItem) => {
				openEventSeriesModal(app, bundle, null, null, [item.key]);
			},
			emptyMessage: "No categories found. Add a category property to your events.",
		};
	};
}

function buildRecurringData(app: App, bundle: CalendarBundle): () => DashboardData {
	return () => {
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
					category: categories.join(", ") || "—",
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

		const enabledCount = allRecurring.filter((e) => !e.metadata.skip).length;
		const totalInstances = items.reduce((sum, i) => sum + i.count, 0);

		return {
			items,
			columns: [
				{ key: "title", label: "Name" },
				{ key: "type", label: "Type" },
				{ key: "count", label: "Instances", align: "center" as const },
				{ key: "category", label: "Category" },
				{ key: "status", label: "Status", align: "center" as const },
			],
			chartData,
			stats: [
				{ label: "Rules", value: allRecurring.length },
				{ label: "Enabled", value: enabledCount },
				{ label: "Disabled", value: allRecurring.length - enabledCount },
				{ label: "Instances", value: totalInstances },
			],
			onItemClick: (item: DashboardItem) => {
				openEventSeriesModal(app, bundle, item.title.toLowerCase(), item.key);
			},
			emptyMessage: "No recurring events found.",
		};
	};
}

export interface DashboardChildSpec {
	id: string;
	label: string;
	component: () => ReactElement;
}

export function buildDashboardChildren(app: App, bundle: CalendarBundle): DashboardChildSpec[] {
	return [
		{
			id: "dashboard-by-name",
			label: "By Name",
			component: () => (
				<GatedDashboardSection id="dashboard-by-name" buildData={buildByNameData(app, bundle)} previewKey="DASHBOARD" />
			),
		},
		{
			id: "dashboard-by-category",
			label: "By Category",
			component: () => (
				<GatedDashboardSection
					id="dashboard-by-category"
					buildData={buildByCategoryData(app, bundle)}
					previewKey="DASHBOARD"
				/>
			),
		},
		{
			id: "dashboard-recurring",
			label: "Recurring",
			component: () => (
				<GatedDashboardSection
					id="dashboard-recurring"
					buildData={buildRecurringData(app, bundle)}
					previewKey="DASHBOARD"
				/>
			),
		},
	];
}
