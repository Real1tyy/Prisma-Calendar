import { cls, tid } from "@real1ty-obsidian-plugins";
import { GridLayout, useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useRef } from "react";

import {
	createDailyCalendar,
	type DailyCalendarHandle,
	type DailyDragState,
} from "../../components/views/daily-calendar";
import { useBundle } from "../contexts/bundle-context";

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
	const leftCalRef = useRef<DailyCalendarHandle | null>(null);
	const rightCalRef = useRef<DailyCalendarHandle | null>(null);
	const focusedSideRef = useRef<"left" | "right">("left");

	const cells = useMemo(() => {
		const sharedDragState: DailyDragState = { current: null };
		return [
			{
				id: "left-calendar",
				label: "Calendar Left",
				row: 0,
				col: 0,
				render: (cellEl: HTMLElement) => {
					leftCalRef.current = createDailyCalendar(cellEl, app, bundle, { sharedDragState });
					cellEl.addEventListener("pointerdown", () => {
						focusedSideRef.current = "left";
					});
				},
				cleanup: () => {
					leftCalRef.current?.destroy();
					leftCalRef.current = null;
				},
			},
			{
				id: "right-calendar",
				label: "Calendar Right",
				row: 0,
				col: 1,
				render: (cellEl: HTMLElement) => {
					rightCalRef.current = createDailyCalendar(cellEl, app, bundle, { sharedDragState });
					cellEl.addEventListener("pointerdown", () => {
						focusedSideRef.current = "right";
					});
				},
				cleanup: () => {
					rightCalRef.current?.destroy();
					rightCalRef.current = null;
				},
			},
		];
	}, [app, bundle]);

	useImperativeHandle(
		handleRef,
		() => ({
			prev: () => (focusedSideRef.current === "left" ? leftCalRef.current : rightCalRef.current)?.prev(),
			next: () => (focusedSideRef.current === "left" ? leftCalRef.current : rightCalRef.current)?.next(),
		}),
		[]
	);

	return (
		<GridLayout
			app={app}
			cssPrefix={cls("dual-daily-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			cells={cells}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("dual-daily")}
		/>
	);
});
