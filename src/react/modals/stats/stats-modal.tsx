import { toLocalISOString } from "@real1ty-obsidian-plugins";
import { showReactModal, useArrowLeft, useArrowRight, useSettingsStore } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useCallback, useEffect, useRef, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { AggregationMode, Stats } from "../../../utils/stats";
import {
	aggregateDailyStats,
	aggregateMonthlyStats,
	aggregateStats,
	aggregateWeeklyStats,
	formatDuration,
	formatDurationAsDecimalHours,
	getDayBounds,
	getMonthBounds,
	getWeekBounds,
} from "../../../utils/stats";
import { useBundleChanges } from "../../hooks/use-bundle-changes";
import { CapacityLabel } from "../../views/stats/capacity-label";
import { StatsChart } from "../../views/stats/stats-chart";
import { StatsTable } from "../../views/stats/stats-table";

type StatsRange = "daily" | "weekly" | "monthly" | "alltime";

const REFRESH_DEBOUNCE_MS = 100;

interface IntervalConfig {
	getBounds(date: Date): { start: Date; end: Date };
	navigate(date: Date, direction: number): Date;
	navigateFast(date: Date, direction: number): Date;
	aggregateStats(events: CalendarEvent[], date: Date, mode: AggregationMode, categoryProp: string): Stats;
	formatDateRange(start: Date, end: Date, locale?: string): string;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
}

function addMonths(date: Date, months: number): Date {
	const result = new Date(date);
	result.setMonth(result.getMonth() + months);
	return result;
}

function addYears(date: Date, years: number): Date {
	const result = new Date(date);
	result.setFullYear(result.getFullYear() + years);
	return result;
}

const INTERVAL_CONFIGS: Record<Exclude<StatsRange, "alltime">, IntervalConfig> = {
	daily: {
		getBounds: getDayBounds,
		navigate: (date, direction) => addDays(date, direction),
		navigateFast: (date, direction) => addDays(date, 10 * direction),
		aggregateStats: aggregateDailyStats,
		formatDateRange: (start, _end, locale) =>
			start.toLocaleDateString(locale, { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
	},
	weekly: {
		getBounds: getWeekBounds,
		navigate: (date, direction) => addDays(date, 7 * direction),
		navigateFast: (date, direction) => addDays(date, 28 * direction),
		aggregateStats: aggregateWeeklyStats,
		formatDateRange: (start, end, locale) => {
			const fmt = (d: Date): string =>
				d.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" });
			return `${fmt(start)} - ${fmt(end)}`;
		},
	},
	monthly: {
		getBounds: getMonthBounds,
		navigate: (date, direction) => addMonths(date, direction),
		navigateFast: (date, direction) => addYears(date, direction),
		aggregateStats: aggregateMonthlyStats,
		formatDateRange: (start, _end, locale) => start.toLocaleDateString(locale, { month: "long", year: "numeric" }),
	},
};

interface StatsModalContentProps {
	bundle: CalendarBundle;
	range: StatsRange;
	initialDate?: Date;
}

interface StatsData {
	stats: Stats;
	filteredEvents: CalendarEvent[];
	start: Date;
	end: Date;
}

export const StatsModalContent = memo(function StatsModalContent({
	bundle,
	range,
	initialDate,
}: StatsModalContentProps) {
	const [settings] = useSettingsStore(bundle.settingsStore);
	const [aggregationMode, setAggregationMode] = useState<AggregationMode>(settings.defaultAggregationMode);
	const [showDecimalHours, setShowDecimalHours] = useState(settings.showDecimalHours);
	const [includeSkipped, setIncludeSkipped] = useState(false);
	const [currentDate, setCurrentDate] = useState(() => initialDate ?? new Date());
	const [statsData, setStatsData] = useState<StatsData | null>(null);
	const renderTokenRef = useRef(0);

	const config = range !== "alltime" ? INTERVAL_CONFIGS[range] : null;

	const navigateBy = useCallback(
		(e: KeyboardEvent, direction: -1 | 1): void => {
			if (!config) return;
			e.preventDefault();
			setCurrentDate((d) => (e.shiftKey ? config.navigateFast(d, direction) : config.navigate(d, direction)));
		},
		[config]
	);
	useArrowLeft((e) => navigateBy(e, -1), undefined, { enabled: !!config });
	useArrowRight((e) => navigateBy(e, 1), undefined, { enabled: !!config });

	const changeToken = useBundleChanges(bundle, { debounceMs: REFRESH_DEBOUNCE_MS });

	useEffect(() => {
		const token = ++renderTokenRef.current;

		async function load(): Promise<void> {
			let events: CalendarEvent[];
			let start: Date;
			let end: Date;

			if (config) {
				const bounds = config.getBounds(currentDate);
				start = bounds.start;
				end = bounds.end;
				const query = { start: toLocalISOString(start), end: toLocalISOString(end) };
				const fetched = await bundle.eventStore.getEvents(query);
				if (token !== renderTokenRef.current) return;
				events = includeSkipped ? [...fetched, ...bundle.eventStore.getSkippedEvents(query)] : fetched;
			} else {
				const allEvents = bundle.eventStore.getAllEvents();
				events = includeSkipped ? allEvents : allEvents.filter((e) => !e.skipped);
				start = new Date(0);
				end = new Date();
			}

			const stats = config
				? config.aggregateStats(events, currentDate, aggregationMode, settings.categoryProp)
				: aggregateStats(events, undefined, undefined, aggregationMode, settings.categoryProp);

			setStatsData({ stats, filteredEvents: events, start, end });
		}

		void load();
	}, [bundle, config, currentDate, aggregationMode, includeSkipped, settings.categoryProp, changeToken]);

	const toggleAggregation = useCallback(() => {
		setAggregationMode((m) => (m === "name" ? "category" : "name"));
	}, []);

	const toggleDecimalHours = useCallback(() => {
		setShowDecimalHours((v) => !v);
	}, []);

	if (!statsData) return null;

	const { stats, filteredEvents, start, end } = statsData;
	const eventCount = stats.entries.reduce((sum, e) => sum + e.count, 0);
	const colorResolver =
		aggregationMode === "category" ? (label: string) => bundle.categoryTracker.getCategoryColor(label) : undefined;

	return (
		<div className="prisma-stats-content">
			{config ? (
				<NavigableHeader
					config={config}
					currentDate={currentDate}
					locale={settings.locale}
					totalDuration={stats.totalDuration}
					eventCount={eventCount}
					showDecimalHours={showDecimalHours}
					aggregationMode={aggregationMode}
					includeSkipped={includeSkipped}
					onNavigate={setCurrentDate}
					onToggleDecimalHours={toggleDecimalHours}
					onToggleAggregation={toggleAggregation}
					onToggleSkipped={setIncludeSkipped}
				/>
			) : (
				<AllTimeHeader
					totalDuration={stats.totalDuration}
					eventCount={eventCount}
					showDecimalHours={showDecimalHours}
					aggregationMode={aggregationMode}
					includeSkipped={includeSkipped}
					onToggleDecimalHours={toggleDecimalHours}
					onToggleAggregation={toggleAggregation}
					onToggleSkipped={setIncludeSkipped}
				/>
			)}

			{settings.capacityTrackingEnabled && config && (
				<CapacityLabel
					events={filteredEvents}
					start={start}
					end={end}
					hourStart={settings.hourStart}
					hourEnd={settings.hourEnd}
					showDecimalHours={showDecimalHours}
				/>
			)}

			{stats.entries.length === 0 ? (
				<div className="prisma-stats-empty" data-testid="prisma-stats-empty">
					No events found for this period.
				</div>
			) : (
				<>
					<StatsChart entries={stats.entries} colorResolver={colorResolver} />
					<StatsTable
						entries={stats.entries}
						totalDuration={stats.totalDuration}
						showDecimalHours={showDecimalHours}
						aggregationMode={aggregationMode}
					/>
				</>
			)}
		</div>
	);
});

interface NavigableHeaderProps {
	config: IntervalConfig;
	currentDate: Date;
	locale: string | undefined;
	totalDuration: number;
	eventCount: number;
	showDecimalHours: boolean;
	aggregationMode: AggregationMode;
	includeSkipped: boolean;
	onNavigate: (date: Date) => void;
	onToggleDecimalHours: () => void;
	onToggleAggregation: () => void;
	onToggleSkipped: (value: boolean) => void;
}

const NavigableHeader = memo(function NavigableHeader({
	config,
	currentDate,
	locale,
	totalDuration,
	eventCount,
	showDecimalHours,
	aggregationMode,
	includeSkipped,
	onNavigate,
	onToggleDecimalHours,
	onToggleAggregation,
	onToggleSkipped,
}: NavigableHeaderProps) {
	const { start, end } = config.getBounds(currentDate);
	const formatDur = showDecimalHours ? formatDurationAsDecimalHours : formatDuration;

	return (
		<div className="prisma-stats-header">
			<div className="prisma-stats-nav-group">
				<button
					className="prisma-stats-nav-button prisma-stats-nav-button-fast"
					data-testid="prisma-stats-modal-fast-prev"
					aria-label="Fast previous"
					onClick={() => onNavigate(config.navigateFast(currentDate, -1))}
				>
					«
				</button>
				<button
					className="prisma-stats-nav-button"
					data-testid="prisma-stats-modal-prev"
					aria-label="Previous"
					onClick={() => onNavigate(config.navigate(currentDate, -1))}
				>
					‹
				</button>
			</div>

			<button
				className="prisma-stats-header-stat prisma-stats-duration-toggle"
				data-testid="prisma-stats-modal-total-duration"
				onClick={onToggleDecimalHours}
			>
				⏱ {formatDur(totalDuration)}
			</button>

			<div className="prisma-stats-middle-section">
				<div className="prisma-stats-week-label" data-testid="prisma-stats-modal-period-label">
					{config.formatDateRange(start, end, locale)}
				</div>
				<div className="prisma-stats-controls-row">
					<SkipCheckbox checked={includeSkipped} onChange={onToggleSkipped} />
					<button
						className="prisma-stats-today-button"
						data-testid="prisma-stats-modal-today"
						onClick={() => onNavigate(new Date())}
					>
						Today
					</button>
					<AggregationToggle mode={aggregationMode} onToggle={onToggleAggregation} />
				</div>
			</div>

			<div className="prisma-stats-header-stat">📅 {eventCount} events</div>

			<div className="prisma-stats-nav-group">
				<button
					className="prisma-stats-nav-button"
					data-testid="prisma-stats-modal-next"
					aria-label="Next"
					onClick={() => onNavigate(config.navigate(currentDate, 1))}
				>
					›
				</button>
				<button
					className="prisma-stats-nav-button prisma-stats-nav-button-fast"
					data-testid="prisma-stats-modal-fast-next"
					aria-label="Fast next"
					onClick={() => onNavigate(config.navigateFast(currentDate, 1))}
				>
					»
				</button>
			</div>
		</div>
	);
});

interface AllTimeHeaderProps {
	totalDuration: number;
	eventCount: number;
	showDecimalHours: boolean;
	aggregationMode: AggregationMode;
	includeSkipped: boolean;
	onToggleDecimalHours: () => void;
	onToggleAggregation: () => void;
	onToggleSkipped: (value: boolean) => void;
}

const AllTimeHeader = memo(function AllTimeHeader({
	totalDuration,
	eventCount,
	showDecimalHours,
	aggregationMode,
	includeSkipped,
	onToggleDecimalHours,
	onToggleAggregation,
	onToggleSkipped,
}: AllTimeHeaderProps) {
	const formatDur = showDecimalHours ? formatDurationAsDecimalHours : formatDuration;

	return (
		<div className="prisma-stats-header">
			<button className="prisma-stats-header-stat prisma-stats-duration-toggle" onClick={onToggleDecimalHours}>
				⏱ {formatDur(totalDuration)}
			</button>
			<div className="prisma-stats-middle-section">
				<div className="prisma-stats-week-label">All time</div>
				<div className="prisma-stats-controls-row">
					<SkipCheckbox checked={includeSkipped} onChange={onToggleSkipped} />
					<AggregationToggle mode={aggregationMode} onToggle={onToggleAggregation} />
				</div>
			</div>
			<div className="prisma-stats-header-stat">📅 {eventCount} events</div>
		</div>
	);
});

const SkipCheckbox = memo(function SkipCheckbox({
	checked,
	onChange,
}: {
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="prisma-stats-skip-checkbox-container">
			<label className="prisma-stats-skip-checkbox-label">
				<input
					type="checkbox"
					className="prisma-stats-skip-checkbox"
					checked={checked}
					onChange={(e) => onChange(e.target.checked)}
				/>
				<span className="prisma-stats-skip-checkbox-text">Include skipped events</span>
			</label>
		</div>
	);
});

const AggregationToggle = memo(function AggregationToggle({
	mode,
	onToggle,
}: {
	mode: AggregationMode;
	onToggle: () => void;
}) {
	return (
		<div className="prisma-stats-aggregation-toggle">
			<span className="prisma-stats-mode-label">Group by:</span>
			<button className="prisma-stats-mode-button-compact" onClick={onToggle}>
				{mode === "name" ? "Event Name" : "Category"}
			</button>
		</div>
	);
});

export function showStatsModal(app: App, bundle: CalendarBundle, range: StatsRange, initialDate?: Date): void {
	showReactModal({
		app,
		cls: "prisma-weekly-stats-modal",
		render: () => <StatsModalContent bundle={bundle} range={range} {...(initialDate ? { initialDate } : {})} />,
	});
}
