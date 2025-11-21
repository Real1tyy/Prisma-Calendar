import type { Calendar } from "@fullcalendar/core";
import { addCls, formatDuration, removeCls } from "@real1ty-obsidian-plugins/utils";
import { Menu } from "obsidian";
import type { CalendarSettingsStore } from "../core/settings-store";

export class ZoomManager {
	private calendar: Calendar | null = null;
	private settingsStore: CalendarSettingsStore;
	private container: HTMLElement | null = null;
	private wheelListener?: (e: WheelEvent) => void;
	private currentZoomLevel: number;
	private onZoomChangeCallback?: () => void;

	constructor(settingsStore: CalendarSettingsStore) {
		this.settingsStore = settingsStore;
		this.currentZoomLevel = settingsStore.currentSettings.slotDurationMinutes;
	}

	initialize(calendar: Calendar, container: HTMLElement): void {
		this.calendar = calendar;
		this.container = container;
		this.setupZoomListener();
		this.updateZoomLevelButton();
	}

	destroy(): void {
		this.removeZoomListener();
		this.calendar = null;
		this.container = null;
	}

	private get zoomLevels(): number[] {
		return this.settingsStore.currentSettings.zoomLevels;
	}

	private getZoomLevelText(): string {
		return `Zoom: ${this.currentZoomLevel}min`;
	}

	updateZoomLevelButton(): void {
		const button = this.calendar?.el?.querySelector(".fc-zoomLevel-button");
		if (!button) return;

		const currentView = this.calendar?.view?.type;
		const isTimeGridView = currentView?.includes("timeGrid");

		if (isTimeGridView) {
			const newText = this.getZoomLevelText();

			// Only update if text has changed to prevent unnecessary DOM manipulation
			if (button.textContent !== newText) {
				button.textContent = newText;
			}

			removeCls(button as HTMLElement, "zoom-button-hidden");
			addCls(button as HTMLElement, "zoom-button-visible");
		} else {
			removeCls(button as HTMLElement, "zoom-button-visible");
			addCls(button as HTMLElement, "zoom-button-hidden");
		}
	}

	private getCurrentZoomIndex(): number {
		const exactIndex = this.zoomLevels.indexOf(this.currentZoomLevel);

		if (exactIndex !== -1) {
			return exactIndex;
		}

		return Math.floor(this.zoomLevels.length / 2);
	}

	private setZoomLevel(zoomIndex: number): void {
		const clampedIndex = Math.max(0, Math.min(this.zoomLevels.length - 1, zoomIndex));
		const newSlotDuration = this.zoomLevels[clampedIndex];

		this.currentZoomLevel = newSlotDuration;
		this.applyZoomToCalendar();
		this.updateZoomLevelButton();
		this.onZoomChangeCallback?.();
	}

	private applyZoomToCalendar(): void {
		if (!this.calendar) return;

		this.calendar.setOption("slotDuration", formatDuration(this.currentZoomLevel));
		this.calendar.setOption("snapDuration", formatDuration(this.currentZoomLevel));
	}

	private setupZoomListener(): void {
		if (!this.container) return;

		this.wheelListener = (e: WheelEvent) => {
			// Only handle CTRL + wheel events
			if (!e.ctrlKey) return;

			// Only allow zooming on time-based views (timeGridDay, timeGridWeek)
			const currentView = this.calendar?.view?.type;
			if (!currentView || !currentView.includes("timeGrid")) {
				return; // Don't zoom on month/list views
			}

			// Prevent default browser zoom
			e.preventDefault();
			e.stopPropagation();

			const currentZoomIndex = this.getCurrentZoomIndex();

			// Determine zoom direction
			// Positive deltaY = scroll down = zoom out (larger slots)
			// Negative deltaY = scroll up = zoom in (smaller slots)
			const zoomDirection = e.deltaY > 0 ? 1 : -1;
			const newZoomIndex = currentZoomIndex + zoomDirection;

			this.setZoomLevel(newZoomIndex);
		};

		// Add listener to the calendar container
		this.container.addEventListener("wheel", this.wheelListener, { passive: false });
	}

	private removeZoomListener(): void {
		if (this.wheelListener && this.container) {
			this.container.removeEventListener("wheel", this.wheelListener);
			this.wheelListener = undefined;
		}
	}

	getCurrentZoomLevel(): number {
		return this.currentZoomLevel;
	}

	setCurrentZoomLevel(zoomLevel: number): void {
		this.currentZoomLevel = zoomLevel;
		this.applyZoomToCalendar();
		this.updateZoomLevelButton();
		this.onZoomChangeCallback?.();
	}

	setOnZoomChangeCallback(callback: () => void): void {
		this.onZoomChangeCallback = callback;
	}

	createZoomLevelButton(): { text: string; click: (e: MouseEvent) => void } {
		return {
			text: this.getZoomLevelText(), // Return current zoom level text immediately
			click: (e: MouseEvent) => {
				this.showZoomMenu(e);
			},
		};
	}

	private showZoomMenu(e: MouseEvent): void {
		const menu = new Menu();

		const currentZoomIndex = this.getCurrentZoomIndex();

		this.zoomLevels.forEach((zoomLevel, index) => {
			menu.addItem((item) => {
				item
					.setTitle(`${zoomLevel} min`)
					.setIcon(index === currentZoomIndex ? "check" : "")
					.onClick(() => {
						this.setZoomLevel(index);
					});
			});
		});

		// Show menu at button position
		const target = e.target as HTMLElement;
		const rect = target.getBoundingClientRect();
		menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
	}
}
