import type { Calendar } from "@fullcalendar/core";
import {
	type BatchOperationOptions,
	getWeekDirection,
	pluralize,
	runBatchOperation,
} from "@real1ty-obsidian-plugins/utils";
import { type App, Modal, Notice } from "obsidian";
import type { EventContextMenu } from "./event-context-menu";

export interface SelectedEvent {
	id: string;
	filePath: string;
	title: string;
	start: string;
	end?: string;
	allDay: boolean;
}

export class BatchSelectionManager {
	private app: App;
	private calendar: Calendar;
	private eventContextMenu!: EventContextMenu; // Will be set later to avoid circular dependency
	private selectedEvents = new Map<string, SelectedEvent>();
	private isSelectionMode = false;
	private onSelectionChangeCallback: () => void = () => {};

	constructor(app: App, calendar: Calendar) {
		this.app = app;
		this.calendar = calendar;
	}

	setEventContextMenu(eventContextMenu: EventContextMenu): void {
		this.eventContextMenu = eventContextMenu;
	}

	setOnSelectionChangeCallback(callback: () => void): void {
		this.onSelectionChangeCallback = callback;
	}

	isInSelectionMode(): boolean {
		return this.isSelectionMode;
	}

	handleEventClick(eventId: string): void {
		if (!this.isSelectionMode) return;

		const isSelected = this.selectedEvents.has(eventId);
		this.toggleEventSelection(eventId, !isSelected);
	}

	handleEventMount(eventId: string, element: HTMLElement): void {
		element.dataset.eventId = eventId;
	}

	toggleSelectionMode(): void {
		const currentView = this.calendar?.view?.type;
		if (currentView?.includes("list")) {
			new Notice("Batch selection is not available in list view");
			if (this.isSelectionMode) {
				this.isSelectionMode = false; // Ensure we exit if already in
			}
			return;
		}

		this.isSelectionMode = !this.isSelectionMode;

		if (this.isSelectionMode) {
			this.addSelectionStylingToEvents();
		} else {
			this.clearSelection();
			this.removeSelectionStylingFromEvents();
		}
		this.triggerSelectionChange(); // Notify for toolbar update
	}

	private addSelectionStylingToEvents(): void {
		this.forEachEventElement(this.calendar.el, (eventEl, eventId) => {
			eventEl.classList.add("batch-selectable");
			if (this.selectedEvents.has(eventId)) {
				eventEl.classList.add("batch-selected");
			}

			const clickHandler = (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				const isSelected = this.selectedEvents.has(eventId);
				this.toggleEventSelection(eventId, !isSelected);
			};

			eventEl.addEventListener("click", clickHandler);
			(eventEl as any)._batchClickHandler = clickHandler;
		});
	}

	private removeSelectionStylingFromEvents(): void {
		this.forEachEventElement(this.calendar.el, (eventEl) => {
			const clickHandler = (eventEl as any)._batchClickHandler;
			if (clickHandler) {
				eventEl.removeEventListener("click", clickHandler);
				delete (eventEl as any)._batchClickHandler;
			}
			eventEl.classList.remove("batch-selectable", "batch-selected");
		});
	}

	private getEventData(eventId: string): SelectedEvent | null {
		const fcEvent = this.calendar.getEventById(eventId);
		if (!fcEvent) return null;

		return this.mapFCEventToSelectedEvent(fcEvent);
	}

	private mapFCEventToSelectedEvent(fcEvent: any): SelectedEvent {
		return {
			id: fcEvent.id,
			filePath: fcEvent.extendedProps.filePath,
			title: fcEvent.extendedProps.originalTitle || fcEvent.title,
			start: fcEvent.start?.toISOString() || "",
			end: fcEvent.end?.toISOString(),
			allDay: fcEvent.allDay,
		};
	}

	private toggleEventSelection(eventId: string, isSelected: boolean): void {
		if (isSelected) {
			const eventData = this.getEventData(eventId);
			if (eventData) {
				this.selectedEvents.set(eventId, eventData);
			}
		} else {
			this.selectedEvents.delete(eventId);
		}

		this.updateEventSelectionUI(eventId, isSelected);
		this.triggerSelectionChange();
	}

	private updateEventSelectionUI(eventId: string, isSelected: boolean): void {
		const eventEl = this.findEventElement(this.calendar.el, eventId);

		if (!eventEl) {
			return;
		}

		if (isSelected) {
			eventEl.classList.add("batch-selected");
		} else {
			eventEl.classList.remove("batch-selected");
		}
	}

	public selectAllVisibleEvents(): void {
		const events = this.calendar.getEvents();

		events
			.filter((fcEvent) => !fcEvent.extendedProps.isVirtual)
			.forEach((fcEvent) => {
				const eventData = this.mapFCEventToSelectedEvent(fcEvent);
				this.selectedEvents.set(fcEvent.id, eventData);
				this.updateEventSelectionUI(fcEvent.id, true);
			});

		this.triggerSelectionChange();
		new Notice(`Selected ${this.selectedEvents.size} events`);
	}

	public clearSelection(): void {
		const eventIds = Array.from(this.selectedEvents.keys());
		this.selectedEvents.clear();

		eventIds.forEach((eventId) => {
			this.updateEventSelectionUI(eventId, false);
		});

		this.triggerSelectionChange();
	}

	private triggerSelectionChange(): void {
		this.onSelectionChangeCallback();
	}

	public getSelectionCountText(): string {
		const count = this.selectedEvents.size;
		return count === 0 ? "No events selected" : `${count} event${count === 1 ? "" : "s"} selected`;
	}

	public async executeDelete(): Promise<void> {
		await this.confirmAndExecuteBatch(
			"Delete Events",
			`Are you sure you want to delete ${this.selectedEvents.size} event${pluralize(
				this.selectedEvents.size
			)}? This action cannot be undone.`,
			"Delete",
			async (sel) => {
				await this.eventContextMenu.deleteEvent(this.toCtxEvent(sel));
			}
		);
	}

	public async executeDuplicate(): Promise<void> {
		await this.runBatch(
			"Duplicate events",
			async (sel) => {
				await this.eventContextMenu.duplicateEvent(this.toCtxEvent(sel));
			},
			{ callOnComplete: true }
		);
	}

	public async executeClone(weeks: number): Promise<void> {
		const direction = getWeekDirection(weeks);
		await this.runBatch(`Clone to ${direction} week`, async (sel) => {
			await this.eventContextMenu.cloneEventByWeeks(this.toCtxEvent(sel), weeks);
		});
	}

	public async executeMove(weeks: number): Promise<void> {
		const direction = getWeekDirection(weeks);
		await this.runBatch(`Move to ${direction} week`, async (sel) => {
			await this.eventContextMenu.moveEventByWeeks(this.toCtxEvent(sel), weeks);
		});
	}

	public async executeOpenAll(): Promise<void> {
		await this.runBatch(
			"Open files",
			async (sel) => {
				await this.app.workspace.openLinkText(sel.filePath, "", true);
			},
			{ closeAfter: false, callOnComplete: false }
		);
	}

	private async runBatch(
		operationLabel: string,
		handler: (selected: SelectedEvent) => Promise<void>,
		opts: BatchOperationOptions = { closeAfter: false, callOnComplete: true }
	): Promise<void> {
		if (this.selectedEvents.size === 0) {
			new Notice("No events selected");
			return;
		}

		const selectedEventsArray = Array.from(this.selectedEvents.values());
		await runBatchOperation(selectedEventsArray, operationLabel, handler);

		if (opts.callOnComplete) {
			this.clearSelection();
			this.calendar.refetchEvents();
		}
	}

	private confirmAndExecuteBatch(
		title: string,
		message: string,
		operationLabel: string,
		handler: (selected: SelectedEvent) => Promise<void>
	): void {
		if (this.selectedEvents.size === 0) {
			new Notice("No events selected");
			return;
		}

		const confirmModal = new Modal(this.app);
		const { contentEl } = confirmModal;

		contentEl.createEl("h2", { text: title });
		contentEl.createEl("p", { text: message });

		const buttonContainer = contentEl.createDiv("modal-button-container");

		buttonContainer.createEl("button", { text: "Cancel" }).onclick = () => confirmModal.close();

		const confirmBtn = buttonContainer.createEl("button", {
			text: "Confirm",
			cls: "mod-warning",
		});
		confirmBtn.onclick = async () => {
			confirmModal.close();
			await this.runBatch(operationLabel, handler);
		};

		confirmModal.open();
	}

	private toCtxEvent(selectedEvent: SelectedEvent): any {
		return {
			id: selectedEvent.id,
			title: selectedEvent.title,
			start: new Date(selectedEvent.start),
			end: selectedEvent.end ? new Date(selectedEvent.end) : null,
			allDay: selectedEvent.allDay,
			extendedProps: {
				filePath: selectedEvent.filePath,
				originalTitle: selectedEvent.title,
			},
		};
	}

	refreshSelectionStyling(): void {
		if (this.isSelectionMode) {
			this.removeSelectionStylingFromEvents();
			setTimeout(() => {
				this.addSelectionStylingToEvents();
			}, 100);
		}
	}

	private findEventElement(calendarEl: HTMLElement | null, eventId: string): HTMLElement | null {
		if (!calendarEl) return null;
		return calendarEl.querySelector(`[data-event-id="${CSS.escape(eventId)}"]`);
	}

	private forEachEventElement(
		calendarEl: HTMLElement | null,
		callback: (eventEl: HTMLElement, eventId: string) => void
	): void {
		if (!calendarEl) return;

		const elements = calendarEl.querySelectorAll<HTMLElement>("[data-event-id]");
		for (let i = 0; i < elements.length; i++) {
			const el = elements[i];
			const eventId = el.dataset.eventId;
			if (eventId) {
				callback(el, eventId);
			}
		}
	}
}
