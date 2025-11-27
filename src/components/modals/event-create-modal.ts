import { BaseEventModal } from "./base-event-modal";

export class EventCreateModal extends BaseEventModal {
	protected getModalTitle(): string {
		return "Create Event";
	}

	protected getSaveButtonText(): string {
		return "Create";
	}

	protected initialize(): Promise<void> {
		// No initialization needed for create mode
		return Promise.resolve();
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
}
