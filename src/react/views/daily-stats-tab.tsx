import { cls, tid } from "@real1ty-obsidian-plugins";
import { GridLayout, useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useRef } from "react";

import { createDailyCalendar, type DailyCalendarHandle } from "../../components/views/daily-calendar";
import { useBundle } from "../contexts/bundle-context";
import { type IntervalStatsCellHandle, mountIntervalStatsCell } from "./stats/interval-stats-cell";
import { DAILY_STATS_CONFIG } from "./stats/stats-configs";

export interface DailyStatsTabHandle {
	prev(): void;
	next(): void;
}

interface DailyStatsTabProps {
	handleRef?: Ref<DailyStatsTabHandle>;
}

export const DailyStatsTab = memo(function DailyStatsTab({ handleRef }: DailyStatsTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const calendarRef = useRef<DailyCalendarHandle | null>(null);
	const statsHandleRef = useRef<IntervalStatsCellHandle | null>(null);

	const cells = useMemo(
		() => [
			{
				id: "calendar",
				label: "Calendar",
				row: 0,
				col: 0,
				render: (cellEl: HTMLElement) => {
					calendarRef.current = createDailyCalendar(cellEl, app, bundle, {
						onDateChange: (date) => statsHandleRef.current?.setDate(date),
					});
				},
				cleanup: () => {
					calendarRef.current?.destroy();
					calendarRef.current = null;
				},
			},
			{
				id: "stats",
				label: "Statistics",
				row: 0,
				col: 1,
				render: (cellEl: HTMLElement) => {
					statsHandleRef.current = mountIntervalStatsCell(cellEl, app, bundle, DAILY_STATS_CONFIG);
				},
				cleanup: () => {
					statsHandleRef.current?.unmount();
					statsHandleRef.current = null;
				},
			},
		],
		[app, bundle]
	);

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => calendarRef.current?.prev(),
			next: () => calendarRef.current?.next(),
		}),
		[]
	);

	return (
		<GridLayout
			app={app}
			cssPrefix={cls("daily-stats-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			cells={cells}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("daily-stats-tab")}
		/>
	);
});
