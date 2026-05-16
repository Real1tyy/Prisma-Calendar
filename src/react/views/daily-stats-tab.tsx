import { cls, tid } from "@real1ty-obsidian-plugins";
import { Cell, GridLayout, ImperativeCellHost, useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useCallback, useImperativeHandle, useRef } from "react";

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

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => calendarRef.current?.prev(),
			next: () => calendarRef.current?.next(),
		}),
		[]
	);

	const renderCalendar = useCallback(
		(el: HTMLElement) => {
			calendarRef.current = createDailyCalendar(el, app, bundle, {
				onDateChange: (date) => statsHandleRef.current?.setDate(date),
			});
		},
		[app, bundle]
	);
	const cleanupCalendar = useCallback(() => {
		calendarRef.current?.destroy();
		calendarRef.current = null;
	}, []);
	const renderStats = useCallback(
		(el: HTMLElement) => {
			statsHandleRef.current = mountIntervalStatsCell(el, app, bundle, DAILY_STATS_CONFIG);
		},
		[app, bundle]
	);
	const cleanupStats = useCallback(() => {
		statsHandleRef.current?.unmount();
		statsHandleRef.current = null;
	}, []);

	return (
		<GridLayout
			app={app}
			cssPrefix={cls("daily-stats-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("daily-stats-tab")}
		>
			<Cell id="calendar" label="Calendar">
				<ImperativeCellHost render={renderCalendar} cleanup={cleanupCalendar} />
			</Cell>
			<Cell id="stats" label="Statistics">
				<ImperativeCellHost render={renderStats} cleanup={cleanupStats} />
			</Cell>
		</GridLayout>
	);
});
