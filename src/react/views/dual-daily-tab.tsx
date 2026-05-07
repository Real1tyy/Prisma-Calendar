import type { App } from "obsidian";
import { memo, type Ref, useImperativeHandle, useRef, useState } from "react";

import type { DailyDragState } from "../../components/views/daily-calendar";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { DailyCalendarTab, type DailyCalendarTabHandle } from "./daily-calendar-tab";

export interface DualDailyTabHandle {
	prev(): void;
	next(): void;
}

interface DualDailyTabProps {
	app: App;
	bundle: CalendarBundle;
	handleRef?: Ref<DualDailyTabHandle>;
}

export const DualDailyTab = memo(function DualDailyTab({ app, bundle, handleRef }: DualDailyTabProps) {
	const sharedDragStateRef = useRef<DailyDragState>({ current: null });
	const [focusedSide, setFocusedSide] = useState<"left" | "right">("left");
	const focusedSideRef = useRef<"left" | "right">("left");
	const leftRef = useRef<DailyCalendarTabHandle>(null);
	const rightRef = useRef<DailyCalendarTabHandle>(null);

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => (focusedSideRef.current === "left" ? leftRef.current : rightRef.current)?.prev(),
			next: () => (focusedSideRef.current === "left" ? leftRef.current : rightRef.current)?.next(),
		}),
		[]
	);

	const focus = (side: "left" | "right") => {
		focusedSideRef.current = side;
		setFocusedSide(side);
	};

	return (
		<div
			className="prisma-dual-daily-grid"
			data-testid="prisma-dual-daily"
			style={{
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: "12px",
				minHeight: "100%",
			}}
		>
			<div
				className="prisma-dual-daily-left"
				onPointerDown={() => focus("left")}
				data-focused={focusedSide === "left" ? "" : undefined}
				style={{ minHeight: "100%" }}
			>
				<DailyCalendarTab app={app} bundle={bundle} sharedDragState={sharedDragStateRef.current} handleRef={leftRef} />
			</div>
			<div
				className="prisma-dual-daily-right"
				onPointerDown={() => focus("right")}
				data-focused={focusedSide === "right" ? "" : undefined}
				style={{ minHeight: "100%" }}
			>
				<DailyCalendarTab app={app} bundle={bundle} sharedDragState={sharedDragStateRef.current} handleRef={rightRef} />
			</div>
		</div>
	);
});
