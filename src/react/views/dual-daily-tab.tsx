import { cls, tid } from "../../constants";
import { Cell, GridLayout, ImperativeCellHost, useApp, usePersistedGridState } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { type RefObject, memo, type Ref, useImperativeHandle, useMemo, useRef, useCallback } from "react";

import {
	createDailyCalendar,
	type DailyCalendarHandle,
	type DailyDragState,
} from "../../components/views/daily-calendar";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { useBundle } from "../contexts/bundle-context";

type Side = "left" | "right";

interface CalendarSide {
	ref: RefObject<DailyCalendarHandle | null>;
	render: (el: HTMLElement) => void;
	cleanup: () => void;
}

function useCalendarSide(
	side: Side,
	app: App,
	bundle: CalendarBundle,
	sharedDragState: DailyDragState,
	focusedSideRef: RefObject<Side>
): CalendarSide {
	const ref = useRef<DailyCalendarHandle | null>(null);
	const render = useCallback(
		(el: HTMLElement) => {
			ref.current = createDailyCalendar(el, app, bundle, { sharedDragState });
			el.addEventListener("pointerdown", () => {
				focusedSideRef.current = side;
			});
		},
		[side, app, bundle, sharedDragState, focusedSideRef]
	);
	const cleanup = useCallback(() => {
		ref.current?.destroy();
		ref.current = null;
	}, []);
	return { ref, render, cleanup };
}

export interface DualDailyTabHandle {
	prev(): void;
	next(): void;
}

interface DualDailyTabProps {
	handleRef?: Ref<DualDailyTabHandle>;
}

export const DualDailyTab = memo(function DualDailyTab({ handleRef }: DualDailyTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const focusedSideRef = useRef<Side>("left");
	const sharedDragState = useMemo<DailyDragState>(() => ({ current: null }), []);

	const left = useCalendarSide("left", app, bundle, sharedDragState, focusedSideRef);
	const right = useCalendarSide("right", app, bundle, sharedDragState, focusedSideRef);

	const gridState = usePersistedGridState(bundle.settingsStore, "dualDailyGridState");

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => (focusedSideRef.current === "left" ? left.ref.current : right.ref.current)?.prev(),
			next: () => (focusedSideRef.current === "left" ? left.ref.current : right.ref.current)?.next(),
		}),
		[left, right]
	);

	return (
		<GridLayout
			app={app}
			cssPrefix={cls("dual-daily-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			resizable="track"
			{...gridState}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("dual-daily")}
		>
			<Cell id="left-calendar" label="Calendar Left">
				<ImperativeCellHost render={left.render} cleanup={left.cleanup} />
			</Cell>
			<Cell id="right-calendar" label="Calendar Right">
				<ImperativeCellHost render={right.render} cleanup={right.cleanup} />
			</Cell>
		</GridLayout>
	);
});
