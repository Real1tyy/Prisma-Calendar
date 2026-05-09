import { createGridLayout, type GridLayoutHandle } from "@real1ty-obsidian-plugins";
import { useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useEffect, useImperativeHandle, useRef } from "react";

import { createDailyCalendar, type DailyCalendarHandle } from "../../components/views/daily-calendar";
import { type DailyStatsHandle, renderDailyStatsInto } from "../../components/views/daily-stats-renderer";
import { useBundle } from "../contexts/bundle-context";

export interface DailyStatsTabHandle {
	prev(): void;
	next(): void;
}

interface DailyStatsTabProps {
	handleRef?: Ref<DailyStatsTabHandle>;
}

// TODO(e2e): Stats range buttons (daily/weekly/monthly/alltime) are rendered
// across separate stats modals (weekly-stats/*-stats-modal.ts) — no single
// toolbar exists. Stamping requires deciding on the modal vs inline toolbar
// story first; left unstamped for now.
export const DailyStatsTab = memo(function DailyStatsTab({ handleRef }: DailyStatsTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const containerRef = useRef<HTMLDivElement>(null);
	const calendarRef = useRef<DailyCalendarHandle | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let gridHandle: GridLayoutHandle | null = null;
		let statsHandle: DailyStatsHandle | null = null;

		gridHandle = createGridLayout(el, {
			cssPrefix: "prisma-daily-stats-",
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
						statsHandle = renderDailyStatsInto(cellEl, bundle);
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

	return <div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid="prisma-daily-stats-tab" />;
});
