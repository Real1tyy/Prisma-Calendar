import { serializeFrontmatterValue } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice } from "obsidian";

import { type EventFormState, extractPresetFromState } from "../../../components/modals/event/event-form-state";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { FREE_MAX_EVENT_PRESETS } from "../../../core/license";
import { MinimizedModalManager, type MinimizedModalState } from "../../../core/minimized-modal-manager";
import type { Frontmatter } from "../../../types";
import type { EventPreset } from "../../../types/settings";
import type { EventFormValues } from "../../event-form/event-form";
import type { EventModalData } from "./event-create-modal";
import { openSavePresetModal } from "./save-preset-modal";

const IDLE_STOPWATCH = {
	state: "idle" as const,
	startTime: null,
	breakStartTime: null,
	sessionStartTime: null,
	totalBreakMs: 0,
};

export function saveMinimizedModalState(
	values: EventFormValues,
	modalType: "create" | "edit",
	filePath: string | null,
	originalFrontmatter: Frontmatter,
	bundle: CalendarBundle
): void {
	const state: MinimizedModalState = {
		formState: values.formState,
		...(Object.keys(values.customProperties).length > 0 && {
			customProperties: values.customProperties as Record<string, unknown>,
		}),
		stopwatch: values.stopwatchSnapshot ?? IDLE_STOPWATCH,
		modalType,
		filePath,
		originalFrontmatter,
		calendarId: bundle.calendarId,
	};
	MinimizedModalManager.saveState(state, bundle);
	new Notice("Modal minimized. Run command: restore minimized event modal");
}

export function openSavePresetFlow(
	app: App,
	bundle: CalendarBundle,
	state: EventFormState,
	customProps: Record<string, unknown>
): void {
	const settings = bundle.settingsStore.currentSettings;
	const existingPresets = settings.eventPresets;
	const atFreeLimit = !bundle.plugin.isProEnabled && existingPresets.length >= FREE_MAX_EVENT_PRESETS;

	void openSavePresetModal(app, existingPresets, atFreeLimit).then((result) => {
		if (!result) return;
		const { name: presetName, overridePresetId } = result;
		const now = Date.now();

		const preset: EventPreset = {
			...extractPresetFromState(state),
			...(Object.keys(customProps).length > 0 && { customProperties: customProps }),
			id: overridePresetId || `preset-${now}`,
			name: presetName,
			createdAt: now,
		} as EventPreset;

		if (overridePresetId) {
			const existing = existingPresets.find((p) => p.id === overridePresetId);
			if (existing) {
				preset.createdAt = existing.createdAt;
				preset.updatedAt = now;
			}
		}

		const updatedPresets = overridePresetId
			? existingPresets.map((p) => (p.id === overridePresetId ? preset : p))
			: [...existingPresets, preset];

		void bundle.settingsStore.updateSettings((s) => ({ ...s, eventPresets: updatedPresets }));
		new Notice(overridePresetId ? `Preset "${presetName}" updated!` : `Preset "${presetName}" saved!`);
	});
}

export function setExtendedPropSafe(eventData: EventModalData, name: string, value: unknown): void {
	if (typeof eventData.setExtendedProp === "function") {
		eventData.setExtendedProp(name, value);
	} else if (eventData.extendedProps && typeof eventData.extendedProps === "object") {
		eventData.extendedProps[name] = value;
	}
}

export function serializeProps(props: Record<string, unknown>): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [k, v] of Object.entries(props)) {
		result[k] = serializeFrontmatterValue(v);
	}
	return result;
}
