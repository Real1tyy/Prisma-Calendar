import { cls, tid } from "@real1ty-obsidian-plugins";
import { GridLayout, useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useRef } from "react";

import { createDailyCalendar, type DailyCalendarHandle } from "../../components/views/daily-calendar";
import { type MonthlyStatsHandle, renderMonthlyStatsInto } from "../../components/views/monthly-stats-renderer";
import { useBundle } from "../contexts/bundle-context";

export interface MonthlyCalendarStatsTabHandle {
	prev(): void;
	next(): void;
}

interface MonthlyCalendarStatsTabProps {
	handleRef?: Ref<MonthlyCalendarStatsTabHandle>;
}

export const MonthlyCalendarStatsTab = memo(function MonthlyCalendarStatsTab({
	handleRef,
}: MonthlyCalendarStatsTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const calendarRef = useRef<DailyCalendarHandle | null>(null);
	const statsRef = useRef<MonthlyStatsHandle | null>(null);

	const cells = useMemo(
		() => [
			{
				id: "calendar",
				label: "Calendar",
				row: 0,
				col: 0,
				render: (cellEl: HTMLElement) => {
					calendarRef.current = createDailyCalendar(cellEl, app, bundle, {
						initialView: "dayGridMonth",
						onDateChange: (date) => statsRef.current?.setDate(date),
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
					statsRef.current = renderMonthlyStatsInto(cellEl, bundle);
				},
				cleanup: () => {
					statsRef.current?.destroy();
					statsRef.current = null;
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
			cssPrefix={cls("monthly-calendar-stats-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			cells={cells}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("monthly-calendar-stats-tab")}
		/>
	);
});
