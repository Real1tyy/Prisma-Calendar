import { cls, createGridLayout, type GridLayoutHandle, tid } from "@real1ty-obsidian-plugins";
import { useApp } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useEffect, useImperativeHandle, useRef } from "react";

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
	const containerRef = useRef<HTMLDivElement>(null);
	const leftCalRef = useRef<DailyCalendarHandle | null>(null);
	const rightCalRef = useRef<DailyCalendarHandle | null>(null);
	const focusedSideRef = useRef<"left" | "right">("left");

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let gridHandle: GridLayoutHandle | null = null;
		const sharedDragState: DailyDragState = { current: null };

		gridHandle = createGridLayout(el, {
			cssPrefix: cls("dual-daily-"),
			columns: 2,
			rows: 1,
			gap: "12px",
			dividers: true,
			cells: [
				{
					id: "left-calendar",
					label: "Calendar Left",
					row: 0,
					col: 0,
					render: (cellEl) => {
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
					render: (cellEl) => {
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
			prev: () => (focusedSideRef.current === "left" ? leftCalRef.current : rightCalRef.current)?.prev(),
			next: () => (focusedSideRef.current === "left" ? leftCalRef.current : rightCalRef.current)?.next(),
		}),
		[]
	);

	return <div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid={tid("dual-daily")} />;
});
