import { cls, tid } from "@real1ty-obsidian-plugins";
import { GridLayout, useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useRef } from "react";

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
	const calendarRef = useRef<DailyCalendarHandle | null>(null);
	const statsRef = useRef<DailyStatsHandle | null>(null);

	const cells = useMemo(
		() => [
			{
				id: "calendar",
				label: "Calendar",
				row: 0,
				col: 0,
				render: (cellEl: HTMLElement) => {
					calendarRef.current = createDailyCalendar(cellEl, app, bundle, {
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
					statsRef.current = renderDailyStatsInto(cellEl, bundle);
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
