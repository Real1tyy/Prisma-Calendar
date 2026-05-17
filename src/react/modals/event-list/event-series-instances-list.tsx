import { calculateEventStatistics } from "@real1ty-obsidian-plugins";
import { cls, tid } from "../../../constants";
import { useSettingsFields } from "@real1ty-obsidian-plugins-react";
import { DateTime } from "luxon";
import { useDeferredValue, useMemo, useRef } from "react";

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

	const deferredSearchQuery = useDeferredValue(searchQuery);

	const stats = useMemo(() => calculateEventStatistics(items, DateTime.now()), [items]);

	const filtered = useMemo(() => {
		const today = DateTime.now().startOf("day");
		const result = items.filter((item) => {
			if (options.hidePast && item.date < today) return false;
			if (options.hideSkipped && item.skipped) return false;
			if (showSearch && deferredSearchQuery.trim()) {
				const q = deferredSearchQuery.toLowerCase().trim();
				if (!item.title.toLowerCase().includes(q)) return false;
			}
			return true;
		});

		result.sort((a, b) =>
			options.hidePast ? a.date.toMillis() - b.date.toMillis() : b.date.toMillis() - a.date.toMillis()
		);
		return result;
	}, [items, options.hidePast, options.hideSkipped, deferredSearchQuery, showSearch]);

	const todayStart = DateTime.now().startOf("day");

	return (
		<>
			{options.title && (
				<div className={cls("recurring-events-list-header")}>
					<h2
						className={cls("recurring-events-source-title")}
						data-testid={tid("series-title")}
						onClick={options.onTitleClick}
						style={options.onTitleClick ? { cursor: "pointer" } : undefined}
					>
						{options.title}
					</h2>
				</div>
			)}

			{options.extraInfo}

			<div className={cls("recurring-events-stats")}>
				<p className={cls("recurring-events-stats-text")} data-testid={tid("series-stats-primary")}>
					Total: {stats.total} &bull; Past: {stats.past} &bull; Skipped: {stats.skipped} &bull; Completed:{" "}
					{stats.completedPercentage}%
				</p>
				<p className={cls("recurring-events-stats-text-secondary")} data-testid={tid("series-stats-secondary")}>
					This year: {stats.thisYear} &bull; This month: {stats.thisMonth} &bull; This week: {stats.thisWeek}
					{stats.frequency ? ` • Frequency: ${stats.frequency}` : ""}
				</p>
			</div>

			<div className={cls("recurring-events-filters")}>
				<div className={`${cls("recurring-events-filter-toggle")} setting-item`}>
					<div className="setting-item-info">
						<div className="setting-item-name">Hide past events</div>
					</div>
					<div className="setting-item-control">
						<div
							className={`checkbox-container${options.hidePast ? " is-enabled" : ""}`}
							data-testid={tid("series-hide-past")}
							onClick={() => options.onHidePastChange(!options.hidePast)}
						/>
					</div>
				</div>
				<div className={`${cls("recurring-events-filter-toggle")} setting-item`}>
					<div className="setting-item-info">
						<div className="setting-item-name">Hide skipped events</div>
					</div>
					<div className="setting-item-control">
						<div
							className={`checkbox-container${options.hideSkipped ? " is-enabled" : ""}`}
							data-testid={tid("series-hide-skipped")}
							onClick={() => options.onHideSkippedChange(!options.hideSkipped)}
						/>
					</div>
				</div>
			</div>

			{showSearch && (
				<div className={cls("generic-event-list-search")}>
					<input
						ref={searchRef}
						type="text"
						placeholder="Search instances... (Ctrl/Cmd+F)"
						className={cls("generic-event-search-input")}
						data-testid={tid("series-search")}
						value={searchQuery}
						onChange={(e) => onSearchChange(e.target.value)}
					/>
				</div>
			)}

			<div className={cls("recurring-events-list-container")} data-testid={tid("series-list-container")}>
				{filtered.length === 0 ? (
					<p className={cls("recurring-events-list-empty")}>No events found</p>
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
