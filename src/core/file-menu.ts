import { Notice, TFile, type App, type MenuItem } from "obsidian";

import { CONTEXT_MENU_BUTTON_LABELS } from "../context-menu-items";
import type CustomCalendarPlugin from "../main";
import { openEventEditModal } from "../react/modals/event/event-edit-modal";
import { toEventModalData } from "../react/modals/event/shared-modal-helpers";
import type { CalendarEvent } from "../types/calendar";
import { parseCustomDoneProperty } from "../utils/events/frontmatter";
import type { CalendarBundle } from "./calendar-bundle";
import { markAsDone, markAsUndone, toggleSkip } from "./commands";
import { MinimizedModalManager } from "./minimized-modal-manager";

/**
 * The section Prisma's items are filed under in Obsidian's native file menu.
 * A named section keeps them grouped and separated from Obsidian's own entries
 * instead of interleaving with "Open in new tab", "Rename", "Delete", …
 */
const FILE_MENU_SECTION = "prisma-calendar";

/** Kept in lockstep with `FileMenuItemKey` in `e2e/fixtures/testids.ts`. */
export type FileMenuItemId = "editEvent" | "triggerStopwatch" | "markDone" | "skipEvent";

export interface FileMenuItemDescriptor {
	id: FileMenuItemId;
	label: string;
	icon: string;
	onSelect: () => void | Promise<void>;
}

/**
 * The bundle a right-clicked file belongs to, plus the indexed event it
 * resolves to. `null` whenever the file is outside every calendar's directory
 * or isn't a tracked event.
 */
interface FileMenuTarget {
	bundle: CalendarBundle;
	event: CalendarEvent;
}

/**
 * True when `filePath` lives under `directory`. Compares on a trailing
 * separator so a calendar rooted at `Tasks` doesn't claim `TasksArchive/x.md`.
 * An empty directory means the calendar indexes the whole vault.
 */
function isPathInDirectory(filePath: string, directory: string): boolean {
	if (!directory) return true;
	return filePath.startsWith(`${directory}/`);
}

/**
 * Resolve which calendar owns a file. Folders may overlap or nest, so the
 * order of `plugin.calendarBundles` (i.e. the order calendars are configured)
 * decides: the first bundle whose directory contains the file wins, and the
 * file is only a menu target if *that* bundle has it indexed as an event.
 */
function resolveFileMenuTarget(bundles: readonly CalendarBundle[], filePath: string): FileMenuTarget | null {
	for (const bundle of bundles) {
		const settings = bundle.settingsStore.currentSettings;
		if (!isPathInDirectory(filePath, settings.directory)) continue;

		const event = bundle.eventStore.getEventByPath(filePath);
		return event ? { bundle, event } : null;
	}
	return null;
}

/**
 * Mirrors the in-calendar menu's done check, but reads the event store's cached
 * frontmatter rather than the vault so the builder stays pure and synchronous.
 */
function isEventDone(event: CalendarEvent, bundle: CalendarBundle): boolean {
	const settings = bundle.settingsStore.currentSettings;
	const customProp = parseCustomDoneProperty(settings.customDoneProperty);
	if (customProp) return event.meta[customProp.key] === customProp.value;
	return event.meta[settings.statusProperty] === settings.doneValue;
}

/**
 * Given a file path and the plugin's calendars, decide which Prisma actions
 * belong in Obsidian's native file menu — the whole decision surface of the
 * integration, deliberately free of `Menu`/DOM so it is directly testable. The
 * `file-menu` listener is a thin adapter that renders whatever this returns.
 *
 * Returns an empty list when the file isn't an indexed event, or when the
 * owning calendar has the integration switched off.
 */
export function buildFileMenuItems(
	app: App,
	bundles: readonly CalendarBundle[],
	filePath: string
): FileMenuItemDescriptor[] {
	const target = resolveFileMenuTarget(bundles, filePath);
	if (!target) return [];

	const { bundle, event } = target;
	const settings = bundle.settingsStore.currentSettings;
	if (!settings.showFileMenuActions) return [];

	const items: FileMenuItemDescriptor[] = [
		{
			id: "editEvent",
			label: CONTEXT_MENU_BUTTON_LABELS.editEvent,
			icon: "pencil",
			onSelect: () => openEventEditModal(app, bundle, toEventModalData(event)),
		},
	];

	if (settings.showStopwatch) {
		items.push({
			id: "triggerStopwatch",
			label: CONTEXT_MENU_BUTTON_LABELS.triggerStopwatch,
			icon: "timer",
			onSelect: () => MinimizedModalManager.startStopwatchSession(app, bundle, toEventModalData(event)),
		});
	}

	const done = isEventDone(event, bundle);
	items.push(
		{
			id: "markDone",
			label: done ? "Mark as undone" : "Mark as done",
			icon: "check",
			onSelect: () =>
				runEventCommand(bundle, () => (done ? markAsUndone : markAsDone)(bundle, filePath), {
					success: `Event marked as ${done ? "undone" : "done"}`,
					error: `Failed to mark event as ${done ? "undone" : "done"}`,
				}),
		},
		{
			id: "skipEvent",
			label: event.skipped ? "Unskip event" : CONTEXT_MENU_BUTTON_LABELS.skipEvent,
			icon: "eye-off",
			onSelect: () =>
				runEventCommand(bundle, () => toggleSkip(bundle, filePath), {
					success: "Event skip toggled",
					error: "Failed to toggle skip event",
				}),
		}
	);

	return items;
}

async function runEventCommand(
	bundle: CalendarBundle,
	createCommand: () => Parameters<CalendarBundle["commandManager"]["executeCommand"]>[0],
	messages: { success: string; error: string }
): Promise<void> {
	try {
		await bundle.commandManager.executeCommand(createCommand());
		new Notice(messages.success);
	} catch (error) {
		console.error(messages.error, error);
		new Notice(messages.error);
	}
}

type MenuItemWithDom = MenuItem & { dom?: HTMLElement };

/**
 * Wire Prisma's event actions into Obsidian's own right-click menu for files.
 * Registered through `Plugin.registerEvent` so it is torn down on unload.
 */
export function registerFileMenuActions(plugin: CustomCalendarPlugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on("file-menu", (menu, file) => {
			if (!(file instanceof TFile)) return;

			for (const descriptor of buildFileMenuItems(plugin.app, plugin.calendarBundles, file.path)) {
				menu.addItem((item) => {
					item
						.setTitle(descriptor.label)
						.setIcon(descriptor.icon)
						.setSection(FILE_MENU_SECTION)
						.onClick(() => void descriptor.onSelect());
					(item as MenuItemWithDom).dom?.setAttribute("data-testid", `prisma-file-menu-item-${descriptor.id}`);
				});
			}
		})
	);
}
