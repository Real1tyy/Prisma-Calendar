import type { Calendar, EventApi } from "@fullcalendar/core";
import type { Command } from "@real1ty-obsidian-plugins";
import {
	addCls,
	cls,
	getWeekDirection,
	pluralize,
	removeCls,
	runBatchOperation,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { type App, Modal, Notice } from "obsidian";

import type { CalendarBundle } from "../core/calendar-bundle";
import { BatchCommandFactory } from "../core/commands/batch-commands";
import type { CalendarEvent } from "../types/calendar";
import { isTimeUnitAllowedForAllDay } from "../types/calendar";
import { isBatchSelectable, isVirtualEvent } from "../utils/event-classification";
import { parseFCExtendedProps } from "../utils/extended-props";
import { showMoveByModal } from "./modals";

export class BatchSelectionManager {
	private selectedEvents = new Map<string, CalendarEvent>();
	private isSelectionMode = false;
	private onSelectionChangeCallback: () => void = () => {};
	private batchCommandFactory: BatchCommandFactory;
	private clickHandlers = new Map<HTMLElement, (e: Event) => void>();

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		private app: App,
		private calendar: Calendar,
		private bundle: CalendarBundle
	) {
		this.batchCommandFactory = new BatchCommandFactory(app, bundle);
	}

	// ─── Selection Mode ───────────────────────────────────────────

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

	refreshSelectionStyling(): void {
		if (this.isSelectionMode) {
			this.removeSelectionStylingFromEvents();
			this.addSelectionStylingToEvents();
		}
	}

	private addSelectionStylingToEvents(): void {
		this.forEachEventElement(this.calendar.el, (eventEl, eventId) => {
			addCls(eventEl, "batch-selectable");
			if (this.selectedEvents.has(eventId)) {
				addCls(eventEl, "batch-selected");
			}

			const clickHandler = (e: Event) => {
				e.preventDefault();
				e.stopPropagation();
				const isSelected = this.selectedEvents.has(eventId);
				this.toggleEventSelection(eventId, !isSelected);
			};

			eventEl.addEventListener("click", clickHandler);
			this.clickHandlers.set(eventEl, clickHandler);
		});
	}

	private removeSelectionStylingFromEvents(): void {
		this.forEachEventElement(this.calendar.el, (eventEl) => {
			const clickHandler = this.clickHandlers.get(eventEl);
			if (clickHandler) {
				eventEl.removeEventListener("click", clickHandler);
				this.clickHandlers.delete(eventEl);
			}
			removeCls(eventEl, "batch-selectable", "batch-selected");
		});
	}

	// ─── Event Selection ──────────────────────────────────────────

	handleEventClick(eventId: string): void {
		if (!this.isSelectionMode) return;

		const isSelected = this.selectedEvents.has(eventId);
		this.toggleEventSelection(eventId, !isSelected);
	}

	handleEventMount(eventId: string, element: HTMLElement): void {
		element.dataset["eventId"] = eventId;
	}

	selectAllVisibleEvents(): void {
		const events = this.calendar.getEvents();

		events
			.filter((fcEvent) => isBatchSelectable(fcEvent))
			.forEach((fcEvent) => {
				const eventData = this.mapFCEventToCalendarEvent(fcEvent);
				this.selectedEvents.set(fcEvent.id, eventData);
				this.updateEventSelectionUI(fcEvent.id, true);
			});

		this.triggerSelectionChange();
		new Notice(`Selected ${this.selectedEvents.size} events`);
	}

	unselectEvent(eventId: string): void {
		if (this.selectedEvents.has(eventId)) {
			this.toggleEventSelection(eventId, false);
		}
	}

	clearSelection(): void {
		const eventIds = Array.from(this.selectedEvents.keys());
		this.selectedEvents.clear();

		eventIds.forEach((eventId) => {
			this.updateEventSelectionUI(eventId, false);
		});

		this.triggerSelectionChange();
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
			addCls(eventEl, "batch-selected");
		} else {
			removeCls(eventEl, "batch-selected");
		}
	}

	private triggerSelectionChange(): void {
		this.onSelectionChangeCallback();
	}

	// ─── Batch Operations ─────────────────────────────────────────

	executeDelete(): void {
		this.executeWithConfirmation(
			"Delete",
			(count) => `Are you sure you want to delete ${count} event${pluralize(count)}? This action can be undone.`,
			(filePaths) => this.batchCommandFactory.createDelete(filePaths),
			(count) => `Deleted ${count} event${pluralize(count)}`,
			"Failed to delete events"
		);
	}

	async executeDuplicate(): Promise<void> {
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createDuplicate(filePaths),
			(count) => `Duplicated ${count} event${pluralize(count)}`,
			"Failed to duplicate events"
		);
	}

	async executeClone(weeks: number): Promise<void> {
		const direction = getWeekDirection(weeks);
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createClone(filePaths, weeks),
			(count) => `Cloned ${count} event${pluralize(count)} to ${direction} week`,
			"Failed to clone events"
		);
	}

	async executeMove(weeks: number): Promise<void> {
		const direction = getWeekDirection(weeks);
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createMove(filePaths, weeks),
			(count) => `Moved ${count} event${pluralize(count)} to ${direction} week`,
			"Failed to move events"
		);
	}

	async executeOpenAll(): Promise<void> {
		if (this.returnIfEmpty()) return;

		try {
			const selectedEventsArray = Array.from(this.selectedEvents.values());
			await runBatchOperation(selectedEventsArray, "Open files", async (event) => {
				await this.app.workspace.openLinkText(event.ref.filePath, "", true);
			});
			this.clearSelection();
		} catch (error) {
			console.error("[BatchSelection] Failed to open files:", error);
			new Notice("Failed to open files");
		}
	}

	async executeSkip(): Promise<void> {
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createSkip(filePaths),
			(count) => `Toggled skip for ${count} event${pluralize(count)}`,
			"Failed to skip events"
		);
	}

	async executeMarkAsDone(): Promise<void> {
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createMarkAsDone(filePaths),
			(count) => `Marked ${count} event${pluralize(count)} as done`,
			"Failed to mark events as done"
		);
	}

	async executeMarkAsNotDone(): Promise<void> {
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createMarkAsNotDone(filePaths),
			(count) => `Marked ${count} event${pluralize(count)} as not done`,
			"Failed to mark events as not done"
		);
	}

	executeMoveBy(): void {
		if (this.returnIfEmpty()) return;

		const selectedEventsArray = Array.from(this.selectedEvents.values());

		// Check if any selected events are all-day
		const hasAllDayEvents = selectedEventsArray.some((event) => event.allDay);

		showMoveByModal(this.app, (result) => {
			void (async () => {
				if (hasAllDayEvents && !isTimeUnitAllowedForAllDay(result.unit)) {
					console.warn(
						`[BatchSelection] Skipping MoveBy operation: Time unit "${result.unit}" is not allowed for all-day events. Only days, weeks, months, and years are supported.`
					);
					new Notice(`Cannot move all-day events by ${result.unit}. Please use days, weeks, months, or years.`, 5000);
					return;
				}

				const offset = { [result.unit]: result.value };
				await this.executeWithSelection(
					(filePaths) => this.batchCommandFactory.createMoveBy(filePaths, offset),
					(count) => `Moved ${count} event${pluralize(count)} by ${result.value} ${result.unit}`,
					"Failed to move events by custom offset"
				);
			})();
		});
	}

	executeAssignCategories(categories: string[]): void {
		void this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createAssignCategories(filePaths, categories),
			(count) => `Assigned categories to ${count} event${pluralize(count)}`,
			"Failed to assign categories"
		);
	}

	executeUpdateFrontmatter(propertyUpdates: Map<string, string | null>): void {
		void this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createUpdateFrontmatter(filePaths, propertyUpdates),
			(count) => `Updated frontmatter for ${count} event${pluralize(count)}`,
			"Failed to update frontmatter"
		);
	}

	async executeMakeVirtual(): Promise<void> {
		await this.executeWithSelection(
			(filePaths) => this.batchCommandFactory.createMakeVirtual(filePaths),
			(count) => `Converted ${count} event${pluralize(count)} to virtual`,
			"Failed to make events virtual"
		);
	}

	async executeMakeReal(): Promise<void> {
		const virtualEventIds = Array.from(this.selectedEvents.values())
			.map((event) => {
				const fcEvent = this.calendar.getEventById(event.id);
				return fcEvent && isVirtualEvent(fcEvent) ? parseFCExtendedProps(fcEvent).virtualEventId : undefined;
			})
			.filter((id): id is string => id !== undefined);

		if (virtualEventIds.length === 0) {
			new Notice("No virtual events selected");
			return;
		}

		await this.executeCommand(
			this.batchCommandFactory.createMakeReal(virtualEventIds),
			virtualEventIds.length,
			(count) => `Converted ${count} event${pluralize(count)} to real`,
			"Failed to make events real"
		);
	}

	// ─── Command Execution ────────────────────────────────────────

	private async executeWithSelection<T extends Command>(
		commandFactory: (filePaths: string[]) => T,
		successMessage: (count: number) => string,
		errorMessage: string,
		postHook?: () => void
	): Promise<void> {
		if (this.returnIfEmpty()) return;

		const filePaths = Array.from(this.selectedEvents.values()).map((event) => event.ref.filePath);
		await this.executeCommand(commandFactory(filePaths), filePaths.length, successMessage, errorMessage, postHook);
	}

	private async executeCommand(
		command: Command,
		count: number,
		successMessage: (count: number) => string,
		errorMessage: string,
		postHook?: () => void
	): Promise<void> {
		try {
			await this.bundle.commandManager.executeCommand(command);
			new Notice(successMessage(count));
			this.clearSelection();
			if (postHook) postHook();
		} catch (error) {
			console.error(`[BatchSelection] Failed operation: ${errorMessage}`, error);

			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg.includes("Completed")) {
				new Notice(errorMsg, 6000);
				this.clearSelection();
			} else {
				new Notice(errorMsg);
			}
		}
	}

	private executeWithConfirmation<T extends Command>(
		confirmationTitle: string,
		confirmationMessage: (count: number) => string,
		commandFactory: (filePaths: string[]) => T,
		successMessage: (count: number) => string,
		errorMessage: string
	): void {
		if (this.returnIfEmpty()) return;

		const confirmModal = new Modal(this.app);
		const { contentEl } = confirmModal;

		contentEl.createEl("h2", { text: confirmationTitle });
		contentEl.createEl("p", {
			text: confirmationMessage(this.selectedEvents.size),
		});

		const buttonContainer = contentEl.createDiv(cls("modal-button-container"));
		buttonContainer.setAttribute("data-testid", "prisma-batch-confirm-modal");
		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.setAttribute("data-testid", "prisma-batch-confirm-cancel");
		cancelBtn.onclick = () => confirmModal.close();

		const confirmBtn = buttonContainer.createEl("button", {
			text: confirmationTitle,
			cls: "mod-warning",
		});
		confirmBtn.setAttribute("data-testid", "prisma-batch-confirm-submit");
		confirmBtn.onclick = async () => {
			confirmModal.close();

			// Use the same logic as executeWithSelection
			if (this.returnIfEmpty()) return;

			try {
				const filePaths = Array.from(this.selectedEvents.values()).map((event) => event.ref.filePath);
				const command = commandFactory(filePaths);

				await this.bundle.commandManager.executeCommand(command);

				new Notice(successMessage(filePaths.length));
				this.clearSelection();
			} catch (error) {
				console.error(`[BatchSelection] Failed operation: ${errorMessage}`, error);

				// Check if this is a partial failure (some succeeded)
				const errorMsg = error instanceof Error ? error.message : String(error);
				if (errorMsg.includes("Completed")) {
					// Partial success - show the detailed message
					new Notice(errorMsg, 6000);
					this.clearSelection();
				} else {
					// Complete failure
					new Notice(errorMsg);
				}
			}
		};

		confirmModal.open();
	}

	// ─── Public Query API ──────────────────────────────────────────

	setOnSelectionChangeCallback(callback: () => void): void {
		this.onSelectionChangeCallback = callback;
	}

	isInSelectionMode(): boolean {
		return this.isSelectionMode;
	}

	getSelectionCountText(): string {
		const count = this.selectedEvents.size;
		return count === 0 ? "No selected" : `${count} event${count === 1 ? "" : "s"} selected`;
	}

	getSelectionCount(): number {
		return this.selectedEvents.size;
	}

	getSelectedEvents(): CalendarEvent[] {
		return Array.from(this.selectedEvents.values());
	}

	// ─── Utilities ────────────────────────────────────────────────

	private getEventData(eventId: string): CalendarEvent | null {
		const fcEvent = this.calendar.getEventById(eventId);
		if (!fcEvent) return null;

		return this.mapFCEventToCalendarEvent(fcEvent);
	}

	private mapFCEventToCalendarEvent(fcEvent: EventApi): CalendarEvent {
		const ep = parseFCExtendedProps(fcEvent);
		const filePath = ep.filePath;
		const title = ep.originalTitle || fcEvent.title;
		const start = fcEvent.start ? toLocalISOString(fcEvent.start) : "";
		const virtualKind = ep.virtualKind;
		const skipped = ep.skipped;
		const meta = ep.frontmatterDisplayData;

		const baseEvent = {
			id: fcEvent.id,
			ref: { filePath },
			title,
			start,
			virtualKind,
			skipped,
			metadata: {},
			meta,
		};

		return fcEvent.allDay
			? {
					...baseEvent,
					type: "allDay" as const,
					allDay: true,
				}
			: {
					...baseEvent,
					type: "timed" as const,
					end: fcEvent.end ? toLocalISOString(fcEvent.end) : start,
					allDay: false,
				};
	}

	private returnIfEmpty(): boolean {
		if (this.selectedEvents.size === 0) {
			new Notice("No events selected");
			return true;
		}
		return false;
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
			const eventId = el.dataset["eventId"];
			if (eventId) {
				callback(el, eventId);
			}
		}
	}
}
