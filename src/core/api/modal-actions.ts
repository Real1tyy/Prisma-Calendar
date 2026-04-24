import { roundToNearestHour, toLocalISOString } from "@real1ty-obsidian-plugins";
import { Notice, TFile } from "obsidian";

import { EventCreateModal, EventEditModal, showUntrackedEventCreateModal } from "../../components/modals";
import type CustomCalendarPlugin from "../../main";
import type { Frontmatter } from "../../types";
import { isAllDayFrontmatterValue } from "../../utils/frontmatter/predicates";
import { openFileInNewTab } from "../../utils/obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import { CloneEventCommand } from "../commands/lifecycle-commands";
import { AddZettelIdCommand } from "../commands/update-commands";
import { MinimizedModalManager } from "../minimized-modal-manager";
import { isCalendarViewFocused, resolveBundleOrNotice } from "./bundle-resolver";
import { createUntrackedEvent } from "./event-crud";

// ─── Shared Helpers ──────────────────────────────────────────

function resolveActiveFileWithBundle(
	plugin: CustomCalendarPlugin,
	calendarId?: string
): { bundle: CalendarBundle; activeFile: TFile } | null {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) return null;

	const activeFile = plugin.app.workspace.getActiveFile();
	if (!(activeFile instanceof TFile)) {
		new Notice("No file is currently open");
		return null;
	}

	return { bundle, activeFile };
}

async function withBundle(
	plugin: CustomCalendarPlugin,
	calendarId: string | undefined,
	action: (bundle: CalendarBundle) => Promise<boolean> | boolean
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) return false;
	const result = await action(bundle);
	void plugin.rememberLastUsedCalendar(bundle.calendarId);
	return result;
}

async function withActiveFileBundle(
	plugin: CustomCalendarPlugin,
	calendarId: string | undefined,
	action: (bundle: CalendarBundle, activeFile: TFile) => Promise<boolean> | boolean
): Promise<boolean> {
	const resolved = resolveActiveFileWithBundle(plugin, calendarId);
	if (!resolved) return false;
	const result = await action(resolved.bundle, resolved.activeFile);
	void plugin.rememberLastUsedCalendar(resolved.bundle.calendarId);
	return result;
}

// ─── Modal Actions ───────────────────────────────────────────

export async function triggerCurrentEventStopwatch(
	plugin: CustomCalendarPlugin,
	calendarId?: string
): Promise<boolean> {
	return withActiveFileBundle(plugin, calendarId, async (bundle, activeFile) => {
		if (!bundle.settingsStore.currentSettings.showStopwatch) {
			new Notice("Enable time tracker in settings to use this action");
			return false;
		}

		const command = new AddZettelIdCommand(plugin.app, bundle, activeFile.path);
		await bundle.commandManager.executeCommand(command);

		return openEditActiveNoteModal(plugin, calendarId, {
			configureModal: (modal) => {
				MinimizedModalManager.stopAndSaveCurrentEvent(plugin.app, plugin.calendarBundles);
				modal.setStartStopwatchAndMinimize();
			},
		});
	});
}

export function openCreateUntrackedEventModal(plugin: CustomCalendarPlugin): void {
	const bundle = resolveBundleOrNotice(plugin);
	if (!bundle) return;
	showUntrackedEventCreateModal(plugin.app, async (title) => {
		const filePath = await createUntrackedEvent(plugin, title, bundle.calendarId);
		if (filePath && !isCalendarViewFocused(plugin)) {
			await openFileInNewTab(plugin.app, filePath);
		}
	});
}

export async function openCreateEventModal(
	plugin: CustomCalendarPlugin,
	calendarId?: string,
	autoStartStopwatch = false,
	openCreatedInNewTab = false
): Promise<boolean> {
	return withBundle(plugin, calendarId, (bundle) => {
		if (autoStartStopwatch && MinimizedModalManager.hasMinimizedModal()) {
			MinimizedModalManager.stopAndSaveCurrentEvent(plugin.app, plugin.calendarBundles);
		}

		const settings = bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);
		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		const modal = new EventCreateModal(plugin.app, bundle, newEvent);
		if (autoStartStopwatch) {
			modal.setAutoStartStopwatch(true);
		}
		if (openCreatedInNewTab && !isCalendarViewFocused(plugin)) {
			modal.setOpenCreatedInNewTab(true);
		}
		modal.open();
		return true;
	});
}

interface OpenEditActiveNoteOptions {
	configureModal?: (modal: EventEditModal) => void;
}

export async function openEditActiveNoteModal(
	plugin: CustomCalendarPlugin,
	calendarId?: string,
	options?: OpenEditActiveNoteOptions
): Promise<boolean> {
	return withActiveFileBundle(plugin, calendarId, (bundle, activeFile) => {
		const settings = bundle.settingsStore.currentSettings;
		if (settings.directory && !activeFile.path.startsWith(settings.directory)) {
			new Notice("Active note is outside the selected planning system directory");
			return false;
		}

		const metadata = plugin.app.metadataCache.getFileCache(activeFile);
		const frontmatter = (metadata?.frontmatter as Frontmatter) ?? {};
		const allDay = isAllDayFrontmatterValue(frontmatter[settings.allDayProp]);

		const now = new Date();
		const roundedStart = roundToNearestHour(now);
		const defaultEnd = new Date(roundedStart);
		defaultEnd.setMinutes(defaultEnd.getMinutes() + settings.defaultDurationMinutes);

		const startValue = allDay
			? (frontmatter[settings.dateProp] as string | undefined)
				? `${String(frontmatter[settings.dateProp])}T00:00:00`
				: toLocalISOString(roundedStart)
			: ((frontmatter[settings.startProp] as string | undefined) ?? toLocalISOString(roundedStart));
		const endValue = allDay
			? null
			: ((frontmatter[settings.endProp] as string | undefined) ?? toLocalISOString(defaultEnd));

		const eventData = {
			title: activeFile.basename,
			start: startValue,
			end: endValue,
			allDay,
			extendedProps: {
				filePath: activeFile.path,
			},
		};

		const modal = new EventEditModal(plugin.app, bundle, eventData);
		options?.configureModal?.(modal);
		modal.open();
		return true;
	});
}

export async function addZettelIdToActiveNote(plugin: CustomCalendarPlugin, calendarId?: string): Promise<boolean> {
	return withActiveFileBundle(plugin, calendarId, async (bundle, activeFile) => {
		const command = new AddZettelIdCommand(plugin.app, bundle, activeFile.path);
		await bundle.commandManager.executeCommand(command);

		if (command.getRenamedFilePath()) {
			new Notice("ZettelID added and file renamed");
		} else {
			new Notice("ZettelID already present");
		}

		return true;
	});
}

export async function duplicateCurrentEvent(plugin: CustomCalendarPlugin, calendarId?: string): Promise<boolean> {
	return withActiveFileBundle(plugin, calendarId, async (bundle, activeFile) => {
		const command = new CloneEventCommand(plugin.app, bundle, activeFile.path);
		await bundle.commandManager.executeCommand(command);

		const createdPath = command.getCreatedFilePath();
		if (createdPath) {
			new Notice("Note duplicated");
			await openFileInNewTab(plugin.app, createdPath);
		}

		return true;
	});
}
