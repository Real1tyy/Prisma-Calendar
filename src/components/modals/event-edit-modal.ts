import { parsePositiveInt, serializeFrontmatterValue } from "@real1ty-obsidian-plugins/utils";
import { MinimizedModalManager } from "../../core/minimized-modal-manager";
import { WEEKDAY_SUPPORTED_TYPES } from "../../types/recurring-event";
import { extractZettelId, removeZettelId } from "../../utils/calendar-events";
import type { RecurrenceType, Weekday } from "../../utils/date-recurrence";
import { categorizeProperties } from "../../utils/format";
import { BaseEventModal } from "./base-event-modal";

export class EventEditModal extends BaseEventModal {
	private originalZettelId: string | null = null;
	private displayTitle = "";

	protected getModalTitle(): string {
		return "Edit Event";
	}

	protected getSaveButtonText(): string {
		return "Save";
	}

	protected getModalType(): "create" | "edit" {
		return "edit";
	}

	protected initialize(): Promise<void> {
		this.loadExistingFrontmatter();

		// Extract and store ZettelID from the original title
		if (this.event.title) {
			const zettelId = extractZettelId(this.event.title);
			if (zettelId) {
				this.originalZettelId = `-${zettelId}`; // Store "-20250103123456" format
				this.displayTitle = removeZettelId(this.event.title);
			} else {
				this.displayTitle = this.event.title;
			}
		}

		return Promise.resolve();
	}

	private loadRecurringEventData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const rruleType = this.originalFrontmatter[settings.rruleProp] as RecurrenceType | undefined;

		if (rruleType) {
			// Event has recurring rule
			this.recurringCheckbox.checked = true;
			this.recurringContainer.classList.remove("prisma-hidden");
			this.rruleSelect.value = rruleType;

			// Load weekdays if applicable
			if ((WEEKDAY_SUPPORTED_TYPES as readonly string[]).includes(rruleType)) {
				this.weekdayContainer.classList.remove("prisma-hidden");

				const rruleSpec = this.originalFrontmatter[settings.rruleSpecProp] as string | undefined;
				if (rruleSpec) {
					const weekdays = rruleSpec.split(",").map((day) => day.trim().toLowerCase());

					for (const weekday of weekdays) {
						const checkbox = this.weekdayCheckboxes.get(weekday as Weekday);
						if (checkbox) {
							checkbox.checked = true;
						}
					}
				}
			}

			const futureCount = this.originalFrontmatter[settings.futureInstancesCountProp];
			const parsed = parsePositiveInt(futureCount, 0);
			if (parsed > 0) {
				this.futureInstancesCountInput.value = String(parsed);
			}

			const generatePast = this.originalFrontmatter[settings.generatePastEventsProp];
			if (generatePast === true) {
				this.generatePastEventsCheckbox.checked = true;
			}
		}
	}

	private loadCustomPropertiesData(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		// Categorize properties using shared utility
		// Use event.allDay if available, otherwise check the checkbox state
		const isAllDay = this.event.allDay ?? this.allDayCheckbox?.checked ?? false;
		const { displayProperties, otherProperties } = categorizeProperties(this.originalFrontmatter, settings, isAllDay);

		// Load display properties
		for (const [key, value] of displayProperties) {
			this.originalCustomPropertyKeys.add(key);
			const stringValue = serializeFrontmatterValue(value);
			this.addCustomProperty(key, stringValue, "display");
		}

		// Load other properties
		for (const [key, value] of otherProperties) {
			this.originalCustomPropertyKeys.add(key);
			const stringValue = serializeFrontmatterValue(value);
			this.addCustomProperty(key, stringValue, "other");
		}
	}

	onOpen(): void {
		// Call parent onOpen first
		super.onOpen();

		// Update the title input with the display title (without ZettelID)
		if (this.displayTitle && this.titleInput) {
			this.titleInput.value = this.displayTitle;
		}

		this.loadRecurringEventData();
		this.loadBreakData();
		this.loadMarkAsDoneData();
		this.loadSkipData();
		this.loadNotificationData();
		this.loadCustomPropertiesData();
	}

	private loadBreakData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.breakProp || !this.breakInput) return;

		const breakValue = this.originalFrontmatter[settings.breakProp];
		if (typeof breakValue === "number" && breakValue > 0) {
			this.breakInput.value = breakValue.toString();
		}
	}

	private loadMarkAsDoneData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.statusProperty || !this.markAsDoneCheckbox) return;

		const statusValue = this.originalFrontmatter[settings.statusProperty];
		const isDone = statusValue === settings.doneValue;
		this.markAsDoneCheckbox.checked = isDone;
		this.initialMarkAsDoneState = isDone;
	}

	private loadSkipData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.skipProp || !this.skipCheckbox) return;

		const skipValue = this.originalFrontmatter[settings.skipProp];
		if (skipValue === true) {
			this.skipCheckbox.checked = true;
		}
	}

	private loadNotificationData(): void {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.enableNotifications || !this.notificationInput) return;

		const isAllDay = this.event.allDay ?? false;
		const propName = isAllDay ? settings.daysBeforeProp : settings.minutesBeforeProp;
		const notifyValue = this.originalFrontmatter[propName];

		if (typeof notifyValue === "number" && notifyValue >= 0) {
			this.notificationInput.value = notifyValue.toString();
		}
	}

	public saveEvent(): void {
		// Reconstruct the title with ZettelID before saving
		const userTitle = this.titleInput.value;
		let finalTitle = userTitle;

		// If there was a ZettelID, append it back
		if (this.originalZettelId) {
			finalTitle = `${userTitle}${this.originalZettelId}`;
		}

		// Temporarily update the input value with the full title for building event data
		const originalInputValue = this.titleInput.value;
		this.titleInput.value = finalTitle;

		const eventData = this.buildEventData();

		// Restore the input value
		this.titleInput.value = originalInputValue;

		this.bundle
			.updateEvent(eventData)
			.then((newFilePath) => {
				// If the user changed the title, the file may have been renamed.
				// We must update the file path to prevent "invalid path" errors when
				// minimizing or restoring the modal, especially when the time tracker is active.
				if (newFilePath && newFilePath !== eventData.filePath) {
					this.setEventExtendedProp("filePath", newFilePath);

					// Also update the minimized modal state if time tracker is active,
					// so restoring the modal uses the correct (renamed) file path.
					if (this.isStopwatchActive()) {
						const state = MinimizedModalManager.getState();
						if (state && state.modalType === "edit") {
							state.filePath = newFilePath;
							MinimizedModalManager.saveState(state, this.bundle);
						}
					}
				}
			})
			.catch((error) => {
				console.error("Error updating event:", error);
			});

		this.close();
	}
}
