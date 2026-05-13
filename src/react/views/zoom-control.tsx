import { cls, tid } from "@real1ty-obsidian-plugins";
import { type SnapshotSubscribable, useExternalSnapshot, useSchemaField } from "@real1ty-obsidian-plugins-react";
import { Menu } from "obsidian";
import { memo, useCallback, useEffect, useRef } from "react";

import type { CalendarSettingsStore } from "../../core/settings-store";

interface ZoomControlProps {
	settingsStore: CalendarSettingsStore;
	viewType$: SnapshotSubscribable<string>;
	container: HTMLElement;
	viewContainerEl: HTMLElement;
	onZoomChange?: () => void;
}

export const ZoomControl = memo(function ZoomControl({
	settingsStore,
	viewType$,
	container,
	viewContainerEl,
	onZoomChange,
}: ZoomControlProps) {
	const [slotDurationMinutes] = useSchemaField(settingsStore, "slotDurationMinutes");
	const viewType = useExternalSnapshot(viewType$);
	const isTimeGridView = viewType.includes("timeGrid");

	const setZoom = useCallback(
		(level: number) => {
			if (level === settingsStore.currentSettings.slotDurationMinutes) return;
			const captured = captureScrollCenter(viewContainerEl);
			void settingsStore.updateSettings((s) => ({ ...s, slotDurationMinutes: level }));
			if (captured) {
				requestAnimationFrame(() => restoreScrollCenter(captured, viewContainerEl));
			}
			onZoomChange?.();
		},
		[settingsStore, viewContainerEl, onZoomChange]
	);

	// Wheel handler reads from the store directly (always fresh). React refs only
	// update on commit, leaving rapid back-to-back wheel events with a stale closure.
	const setZoomRef = useRef(setZoom);
	setZoomRef.current = setZoom;

	useEffect(() => {
		const wheelListener = (e: WheelEvent) => {
			if (!e.ctrlKey) return;
			if (!viewType$.getValue().includes("timeGrid")) return;

			e.preventDefault();
			e.stopPropagation();

			const current = settingsStore.currentSettings;
			const zoomLevels = current.zoomLevels;
			if (zoomLevels.length === 0) return;

			const exactIndex = zoomLevels.indexOf(current.slotDurationMinutes);
			const currentIndex = exactIndex !== -1 ? exactIndex : Math.floor(zoomLevels.length / 2);

			const direction = e.deltaY > 0 ? 1 : -1;
			const newIndex = Math.max(0, Math.min(zoomLevels.length - 1, currentIndex + direction));
			const newLevel = zoomLevels[newIndex];

			setZoomRef.current(newLevel);
		};

		container.addEventListener("wheel", wheelListener, { passive: false });
		return () => container.removeEventListener("wheel", wheelListener);
	}, [container, settingsStore, viewType$]);

	const openMenu = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const current = settingsStore.currentSettings;
			const menu = new Menu();
			current.zoomLevels.forEach((level) => {
				menu.addItem((item) =>
					item
						.setTitle(`${level} min`)
						.setIcon(level === current.slotDurationMinutes ? "check" : "")
						.onClick(() => setZoom(level))
				);
			});
			const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
			menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
		},
		[settingsStore, setZoom]
	);

	if (!isTimeGridView) return null;

	return (
		<button
			type="button"
			className={`${cls("fc-zoom-button")} fc-button fc-button-primary`}
			onClick={openMenu}
			data-testid={tid("zoom-button")}
			aria-label="Zoom level"
		>
			<span>{`Zoom: ${slotDurationMinutes}min`}</span>
		</button>
	);
});

function captureScrollCenter(viewContainerEl: HTMLElement): { scrollable: HTMLElement; centerRatio: number } | null {
	const scrollable = (viewContainerEl.querySelector(".prisma-tab-content") ??
		viewContainerEl.querySelector(".view-content")) as HTMLElement | null;
	const slotsTable = viewContainerEl.querySelector(".fc-timegrid-slots") as HTMLElement | null;
	if (!scrollable || !slotsTable) return null;

	const slotsRect = slotsTable.getBoundingClientRect();
	const scrollableRect = scrollable.getBoundingClientRect();
	const viewportCenterY = scrollableRect.top + scrollableRect.height / 2;
	const centerRatio = (viewportCenterY - slotsRect.top) / slotsRect.height;
	return { scrollable, centerRatio };
}

function restoreScrollCenter(
	{ scrollable, centerRatio }: { scrollable: HTMLElement; centerRatio: number },
	viewContainerEl: HTMLElement
): void {
	const newSlotsTable = viewContainerEl.querySelector(".fc-timegrid-slots");
	if (!newSlotsTable) return;

	const newSlotsRect = newSlotsTable.getBoundingClientRect();
	const newScrollableRect = scrollable.getBoundingClientRect();
	const targetSlotsY = centerRatio * newSlotsRect.height;
	const slotsOffsetFromScrollable = newSlotsRect.top - newScrollableRect.top + scrollable.scrollTop;
	scrollable.scrollTop = slotsOffsetFromScrollable + targetSlotsY - newScrollableRect.height / 2;
}
