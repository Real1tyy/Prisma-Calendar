import { cls, createGridLayout, type GridLayoutHandle, tid } from "@real1ty-obsidian-plugins";
import { useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useEffect, useImperativeHandle, useRef } from "react";

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
	const containerRef = useRef<HTMLDivElement>(null);
	const calendarRef = useRef<DailyCalendarHandle | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let gridHandle: GridLayoutHandle | null = null;
		let statsHandle: MonthlyStatsHandle | null = null;

		gridHandle = createGridLayout(el, {
			cssPrefix: cls("monthly-calendar-stats-"),
			columns: 2,
			rows: 1,
			gap: "12px",
			dividers: true,
			cells: [
				{
					id: "calendar",
					label: "Calendar",
					row: 0,
					col: 0,
					render: (cellEl) => {
						calendarRef.current = createDailyCalendar(cellEl, app, bundle, {
							initialView: "dayGridMonth",
							onDateChange: (date) => statsHandle?.setDate(date),
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
					render: (cellEl) => {
						statsHandle = renderMonthlyStatsInto(cellEl, bundle);
					},
					cleanup: () => {
						statsHandle?.destroy();
						statsHandle = null;
					},
				},
			],
		});

		return () => {
			gridHandle?.destroy();
			gridHandle = null;
		};
	}, [app, bundle]);

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => calendarRef.current?.prev(),
			next: () => calendarRef.current?.next(),
		}),
		[]
	);

	return (
		<div
			ref={containerRef}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("monthly-calendar-stats-tab")}
		/>
	);
});
