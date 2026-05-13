import { calculateEventStatistics } from "@real1ty-obsidian-plugins";
import { useSettingsFields } from "@real1ty-obsidian-plugins-react";
import { DateTime } from "luxon";
import { useMemo, useRef } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { EventSeriesEventRow } from "./event-series-event-row";
import type { EventListOptions, EventRowItem } from "./event-series-types";

export function EventSeriesInstancesList({
	items,
	options,
	searchQuery,
	onSearchChange,
	bundle,
	showSearch = true,
}: {
	items: EventRowItem[];
	options: EventListOptions;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	bundle: CalendarBundle;
	showSearch?: boolean;
}) {
	const searchRef = useRef<HTMLInputElement>(null);

	const [multiColorSettings] = useSettingsFields(bundle.settingsStore, ["colorMode", "showEventColorDots"]);

	const stats = useMemo(() => calculateEventStatistics(items, DateTime.now()), [items]);

	const filtered = useMemo(() => {
		const today = DateTime.now().startOf("day");
		const result = items.filter((item) => {
			if (options.hidePast && item.date < today) return false;
			if (options.hideSkipped && item.skipped) return false;
			if (showSearch && searchQuery.trim()) {
				const q = searchQuery.toLowerCase().trim();
				if (!item.title.toLowerCase().includes(q)) return false;
			}
			return true;
		});

		result.sort((a, b) =>
			options.hidePast ? a.date.toMillis() - b.date.toMillis() : b.date.toMillis() - a.date.toMillis()
		);
		return result;
	}, [items, options.hidePast, options.hideSkipped, searchQuery, showSearch]);

	const todayStart = DateTime.now().startOf("day");

	return (
		<>
			{options.title && (
				<div className="prisma-recurring-events-list-header">
					<h2
						className="prisma-recurring-events-source-title"
						data-testid="prisma-series-title"
						onClick={options.onTitleClick}
						style={options.onTitleClick ? { cursor: "pointer" } : undefined}
					>
						{options.title}
					</h2>
				</div>
			)}

			{options.extraInfo}

			<div className="prisma-recurring-events-stats">
				<p className="prisma-recurring-events-stats-text" data-testid="prisma-series-stats-primary">
					Total: {stats.total} &bull; Past: {stats.past} &bull; Skipped: {stats.skipped} &bull; Completed:{" "}
					{stats.completedPercentage}%
				</p>
				<p className="prisma-recurring-events-stats-text-secondary" data-testid="prisma-series-stats-secondary">
					This year: {stats.thisYear} &bull; This month: {stats.thisMonth} &bull; This week: {stats.thisWeek}
					{stats.frequency ? ` • Frequency: ${stats.frequency}` : ""}
				</p>
			</div>

			<div className="prisma-recurring-events-filters">
				<div className="prisma-recurring-events-filter-toggle setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Hide past events</div>
					</div>
					<div className="setting-item-control">
						<div
							className={`checkbox-container${options.hidePast ? " is-enabled" : ""}`}
							data-testid="prisma-series-hide-past"
							onClick={() => options.onHidePastChange(!options.hidePast)}
						/>
					</div>
				</div>
				<div className="prisma-recurring-events-filter-toggle setting-item">
					<div className="setting-item-info">
						<div className="setting-item-name">Hide skipped events</div>
					</div>
					<div className="setting-item-control">
						<div
							className={`checkbox-container${options.hideSkipped ? " is-enabled" : ""}`}
							data-testid="prisma-series-hide-skipped"
							onClick={() => options.onHideSkippedChange(!options.hideSkipped)}
						/>
					</div>
				</div>
			</div>

			{showSearch && (
				<div className="prisma-generic-event-list-search">
					<input
						ref={searchRef}
						type="text"
						placeholder="Search instances... (Ctrl/Cmd+F)"
						className="prisma-generic-event-search-input"
						data-testid="prisma-series-search"
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
					/>
				</div>
			)}

			<div className="prisma-recurring-events-list-container" data-testid="prisma-series-list-container">
				{filtered.length === 0 ? (
					<p className="prisma-recurring-events-list-empty">No events found</p>
				) : (
					filtered.map((item) => (
						<EventSeriesEventRow
							key={item.filePath + item.date.toISO()}
							item={item}
							isPast={item.date < todayStart}
							settings={multiColorSettings}
							onClick={() => {
								void bundle.plugin.app.workspace.openLinkText(item.filePath, "", false);
							}}
						/>
					))
				)}
			</div>
		</>
	);
}
