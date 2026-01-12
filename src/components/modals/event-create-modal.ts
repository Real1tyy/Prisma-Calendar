import { MinimizedModalManager } from "../../core/minimized-modal-manager";
import { autoAssignCategories } from "../../utils/calendar-events";
import { BaseEventModal } from "./base-event-modal";

export class EventCreateModal extends BaseEventModal {
	private autoStartStopwatch = false;

	setAutoStartStopwatch(autoStart: boolean): void {
		this.autoStartStopwatch = autoStart;
	}

	protected getModalTitle(): string {
		return "Create Event";
	}

	protected getSaveButtonText(): string {
		return "Create";
	}

	protected getModalType(): "create" | "edit" {
		return "create";
	}

	protected initialize(): Promise<void> {
		// No initialization needed for create mode
		return Promise.resolve();
	}

	onOpen(): void {
		super.onOpen();

		this.setupTitleBlurListener();

		if (this.autoStartStopwatch && this.stopwatch) {
			this.stopwatch.expand();
			requestAnimationFrame(() => {
				setTimeout(() => {
					this.stopwatch?.start();
				}, 100);
			});
		}
	}

	private setupTitleBlurListener(): void {
		this.titleInput.addEventListener("blur", () => {
			this.applyAutoCategories();
		});
	}

	private applyAutoCategories(): void {
		const eventName = this.titleInput.value.trim();
		if (!eventName) return;

		const settings = this.bundle.settingsStore.currentSettings;

		// Only auto-assign if at least one feature is enabled
		if (
			!settings.autoAssignCategoryByName &&
			(!settings.categoryAssignmentPresets || settings.categoryAssignmentPresets.length === 0)
		) {
			return;
		}

		const availableCategories = this.bundle.categoryTracker.getCategories();
		const autoAssignedCategories = autoAssignCategories(eventName, settings, availableCategories);

		if (autoAssignedCategories.length > 0) {
			this.selectedCategories = autoAssignedCategories;
			this.renderCategories();
		}
	}

	protected applyDefaultPreset(): void {
		const settings = this.bundle.settingsStore.currentSettings;

		if (settings.defaultPresetId) {
			const presets = settings.eventPresets || [];
			const defaultPreset = presets.find((p) => p.id === settings.defaultPresetId);

			if (defaultPreset) {
				this.applyPreset(defaultPreset);

				// Also set the selector to show the selected preset
				if (this.presetSelector) {
					this.presetSelector.value = defaultPreset.id;
				}
			}
		}
	}

	public saveEvent(): void {
		// Apply auto-categories before building event data
		// This ensures categories are assigned even if user submits without blur
		this.applyAutoCategories();

		const eventData = this.buildEventData();

		this.bundle
			.createEvent(eventData)
			.then((filePath) => {
				if (filePath) {
					this.setEventExtendedProp("filePath", filePath);

					if (this.isStopwatchActive()) {
						const state = MinimizedModalManager.getState();
						if (state && state.modalType === "create") {
							state.modalType = "edit";
							state.filePath = filePath;
							MinimizedModalManager.saveState(state, this.bundle);
						}
					}
				}
			})
			.catch((error) => {
				console.error("Error creating event:", error);
			});

		this.close();
	}
}
