import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { memo, useEffect, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { IntervalStatsView, type IntervalStatsConfig } from "./interval-stats-view";

export interface IntervalStatsCellHandle {
	unmount: () => void;
	setDate: (date: Date) => void;
}

interface DateHostRef {
	setDate(date: Date): void;
}

interface IntervalStatsHostProps {
	bundle: CalendarBundle;
	config: IntervalStatsConfig;
	hostRef: { current: DateHostRef | null };
}

const IntervalStatsHost = memo(function IntervalStatsHost({ bundle, config, hostRef }: IntervalStatsHostProps) {
	const [date, setDate] = useState(() => new Date());
	useEffect(() => {
		hostRef.current = { setDate };
		return () => {
			hostRef.current = null;
		};
	}, [hostRef]);
	return <IntervalStatsView bundle={bundle} config={config} date={date} />;
});

export function mountIntervalStatsCell(
	cellEl: HTMLElement,
	app: App,
	bundle: CalendarBundle,
	config: IntervalStatsConfig
): IntervalStatsCellHandle {
	const hostRef: { current: DateHostRef | null } = { current: null };
	const unmount = renderReactInline(
		cellEl,
		<IntervalStatsHost bundle={bundle} config={config} hostRef={hostRef} />,
		app
	);
	return {
		unmount,
		setDate: (date) => hostRef.current?.setDate(date),
	};
}
