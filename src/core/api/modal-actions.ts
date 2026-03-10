import { Notice, TFile } from "obsidian";

import { EventCreateModal, EventEditModal, UntrackedEventCreateModal } from "../../components/modals";
import type CustomCalendarPlugin from "../../main";
import { roundToNearestHour, toLocalISOString } from "../../utils/format";
import { openFileInNewTab } from "../../utils/obsidian";
import { AddZettelIdCommand } from "../commands/update-commands";
import { MinimizedModalManager } from "../minimized-modal-manager";
import { isCalendarViewFocused, resolveBundleOrNotice } from "./bundle-resolver";
import { createUntrackedEvent } from "./event-crud";

export function openCreateUntrackedEventModal(plugin: CustomCalendarPlugin): void {
	const bundle = resolveBundleOrNotice(plugin);
	if (!bundle) return;
	new UntrackedEventCreateModal(plugin.app, async (title) => {
		const filePath = await createUntrackedEvent(plugin, title, bundle.calendarId);
		if (filePath && !isCalendarViewFocused(plugin)) {
			await openFileInNewTab(plugin.app, filePath);
		}
	}).open();
}

export async function openCreateEventModal(
	plugin: CustomCalendarPlugin,
	calendarId?: string,
	autoStartStopwatch = false,
	openCreatedInNewTab = false
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) return false;

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
	void plugin.rememberLastUsedCalendar(bundle.calendarId);
	return true;
}

export async function openEditActiveNoteModal(plugin: CustomCalendarPlugin, calendarId?: string): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) {
		return false;
	}

	const activeFile = plugin.app.workspace.getActiveFile();
	if (!(activeFile instanceof TFile)) {
		new Notice("No file is currently open");
		return false;
	}

	const settings = bundle.settingsStore.currentSettings;
	if (settings.directory && !activeFile.path.startsWith(settings.directory)) {
		new Notice("Active note is outside the selected calendar directory");
		return false;
	}

	const metadata = plugin.app.metadataCache.getFileCache(activeFile);
	const frontmatter = metadata?.frontmatter ?? {};
	const allDayValue = frontmatter[settings.allDayProp];
	const allDay = allDayValue === true || allDayValue === "true";

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

	new EventEditModal(plugin.app, bundle, eventData).open();
	void plugin.rememberLastUsedCalendar(bundle.calendarId);
	return true;
}

export async function addZettelIdToActiveNote(plugin: CustomCalendarPlugin, calendarId?: string): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, calendarId);
	if (!bundle) {
		return false;
	}

	const activeFile = plugin.app.workspace.getActiveFile();
	if (!(activeFile instanceof TFile)) {
		new Notice("No file is currently open");
		return false;
	}

	const command = new AddZettelIdCommand(plugin.app, bundle, activeFile.path);
	await bundle.commandManager.executeCommand(command);

	if (command.getRenamedFilePath()) {
		new Notice("ZettelID added and file renamed");
	} else {
		new Notice("ZettelID already present");
	}

	void plugin.rememberLastUsedCalendar(bundle.calendarId);
	return true;
}
