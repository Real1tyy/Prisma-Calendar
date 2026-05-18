import { useSettingsStore } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import {
	buildStatsSnapshot,
	pickDurationFormatter,
	type AggregationMode,
	type Stats,
	type StatsInterval,
} from "../../../utils/stats";
import { useBundleChanges } from "../../hooks/use-bundle-changes";
import { CapacityLabel } from "./capacity-label";
import { StatsChart } from "./stats-chart";
import { StatsTable } from "./stats-table";

export interface IntervalStatsConfig {
	interval: StatsInterval;
	formatDate: (date: Date, locale: string | undefined) => string;
	emptyMessage: string;
	includeCapacity?: boolean;
}

interface IntervalStatsViewProps {
	bundle: CalendarBundle;
	config: IntervalStatsConfig;
	date: Date;
}

interface StatsData {
	stats: Stats;
	filteredEvents: CalendarEvent[];
	start: Date;
	end: Date;
}

const REFRESH_DEBOUNCE_MS = 100;

export const IntervalStatsView = memo(function IntervalStatsView({ bundle, config, date }: IntervalStatsViewProps) {
	const [settings] = useSettingsStore(bundle.settingsStore);
	const [aggregationMode, setAggregationMode] = useState<AggregationMode>(settings.defaultAggregationMode);
	const [showDecimalHours, setShowDecimalHours] = useState(settings.showDecimalHours);
	const [includeSkipped, setIncludeSkipped] = useState(false);
	const [statsData, setStatsData] = useState<StatsData | null>(null);
	const renderTokenRef = useRef(0);

	const changeToken = useBundleChanges(bundle, { debounceMs: REFRESH_DEBOUNCE_MS });

	useEffect(() => {
		const token = ++renderTokenRef.current;

		async function load(): Promise<void> {
			const snapshot = await buildStatsSnapshot(bundle.eventStore, {
				date,
				interval: config.interval,
				mode: aggregationMode,
				categoryProp: settings.categoryProp,
				includeSkipped,
			});

			if (token !== renderTokenRef.current) return;

			setStatsData({
				stats: snapshot.stats,
				filteredEvents: snapshot.filteredEvents,
				start: snapshot.bounds.start,
				end: snapshot.bounds.end,
			});
		}

		void load();
	}, [bundle, config.interval, date, aggregationMode, includeSkipped, settings.categoryProp, changeToken]);

	const toggleAggregation = useCallback(() => {
		setAggregationMode((m) => (m === "name" ? "category" : "name"));
	}, []);

	const toggleDecimalHours = useCallback(() => {
		setShowDecimalHours((v) => !v);
	}, []);

	const dateLabel = useMemo(() => config.formatDate(date, settings.locale), [config, date, settings.locale]);

	if (!statsData) return null;

	const { stats, filteredEvents, start, end } = statsData;
	const eventCount = stats.entries.reduce((sum, e) => sum + e.count, 0);
	const colorResolver =
		aggregationMode === "category" ? (label: string) => bundle.categoryTracker.getCategoryColor(label) : undefined;

	return (
		<div className="prisma-interval-stats-view">
			<StatsHeaderBar
				model={{
					dateLabel,
					totalDuration: stats.totalDuration,
					eventCount,
					showDecimalHours,
					aggregationMode,
					includeSkipped,
				}}
				controller={{
					onToggleDecimalHours: toggleDecimalHours,
					onToggleAggregation: toggleAggregation,
					onToggleSkipped: setIncludeSkipped,
				}}
			/>

			<div className="prisma-stats-content">
				{config.includeCapacity && settings.capacityTrackingEnabled && (
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
						{config.emptyMessage}
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
		</div>
	);
});

interface StatsHeaderBarModel {
	dateLabel: string;
	totalDuration: number;
	eventCount: number;
	showDecimalHours: boolean;
	aggregationMode: AggregationMode;
	includeSkipped: boolean;
}

interface StatsHeaderBarController {
	onToggleDecimalHours: () => void;
	onToggleAggregation: () => void;
	onToggleSkipped: (value: boolean) => void;
}

interface StatsHeaderBarProps {
	model: StatsHeaderBarModel;
	controller: StatsHeaderBarController;
}

const StatsHeaderBar = memo(function StatsHeaderBar({ model, controller }: StatsHeaderBarProps) {
	const { dateLabel, totalDuration, eventCount, showDecimalHours, aggregationMode, includeSkipped } = model;
	const { onToggleDecimalHours, onToggleAggregation, onToggleSkipped } = controller;
	const formatDur = pickDurationFormatter({ showDecimalHours });

	return (
		<div className="prisma-daily-stats-header-bar">
			<div className="prisma-daily-stats-header-left">
				<button
					className="prisma-stats-header-stat prisma-stats-duration-toggle"
					data-testid="prisma-stats-total-duration"
					onClick={onToggleDecimalHours}
				>
					⏱ {formatDur(totalDuration)}
				</button>
				<div className="prisma-stats-header-stat" data-testid="prisma-stats-total-count">
					📅 {eventCount} events
				</div>
			</div>

			<div className="prisma-stats-tab-date-label" data-testid="prisma-stats-date-label">
				{dateLabel}
			</div>

			<div className="prisma-daily-stats-header-right">
				<label className="prisma-stats-skip-checkbox-label">
					<input
						type="checkbox"
						className="prisma-stats-skip-checkbox"
						data-testid="prisma-stats-skip-checkbox"
						checked={includeSkipped}
						onChange={(e) => onToggleSkipped(e.target.checked)}
					/>
					<span className="prisma-stats-skip-checkbox-text">Include skipped</span>
				</label>

				<div className="prisma-stats-aggregation-toggle">
					<span className="prisma-stats-mode-label">Group by:</span>
					<button
						className="prisma-stats-mode-button-compact"
						data-testid="prisma-stats-mode-button"
						onClick={onToggleAggregation}
					>
						{aggregationMode === "name" ? "Event Name" : "Category"}
					</button>
				</div>
			</div>
		</div>
	);
});
