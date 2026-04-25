import { type Command, ensureISOSuffix } from "@real1ty-obsidian-plugins";
import { Notice, TFile } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import type { Frontmatter } from "../../types";
import type { CalendarBundle } from "../calendar-bundle";
import { CreateEventCommand, DeleteEventCommand, type EventData } from "../commands/lifecycle-commands";
import { EditEventCommand } from "../commands/update-commands";
import { resolveBundleOrNotice } from "./bundle-resolver";
import { buildFrontmatterFromInput, patchEditFrontmatter } from "./frontmatter-helpers";
import type { PrismaCreateEventInput, PrismaDeleteEventInput, PrismaEditEventInput } from "./types";

export function buildCreateEventCommand(
	plugin: CustomCalendarPlugin,
	input: PrismaCreateEventInput
): { command: Command; bundle: CalendarBundle } | null {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return null;

	const frontmatter = buildFrontmatterFromInput(bundle, input);
	const normalizedStart = input.start ? ensureISOSuffix(input.start) : "";
	const normalizedEnd = input.end ? ensureISOSuffix(input.end) : null;
	const settings = bundle.settingsStore.currentSettings;

	const commandEventData: EventData = {
		filePath: null,
		title: input.title,
		start: normalizedStart,
		end: normalizedEnd ?? undefined,
		allDay: input.allDay ?? false,
		preservedFrontmatter: frontmatter,
	};

	const command = new CreateEventCommand(plugin.app, bundle, commandEventData, settings.directory);
	return { command, bundle };
}

export function buildEditEventCommand(
	plugin: CustomCalendarPlugin,
	input: PrismaEditEventInput
): { command: Command; bundle: CalendarBundle } | null {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return null;

	const file = plugin.app.vault.getAbstractFileByPath(input.filePath);
	if (!(file instanceof TFile)) {
		new Notice(`File not found: ${input.filePath}`);
		return null;
	}

	const metadata = plugin.app.metadataCache.getFileCache(file);
	const frontmatter: Frontmatter = metadata?.frontmatter ? { ...metadata.frontmatter } : {};
	const settings = bundle.settingsStore.currentSettings;

	patchEditFrontmatter(frontmatter, settings, bundle, input);

	const existingAllDay = frontmatter[settings.allDayProp] === true;
	const existingStart = existingAllDay
		? frontmatter[settings.dateProp]
			? `${String(frontmatter[settings.dateProp])}T00:00:00`
			: ""
		: (frontmatter[settings.startProp] as string);
	const existingEnd = frontmatter[settings.endProp] as string | undefined;

	const eventData: EventData = {
		filePath: file.path,
		title: input.title ?? file.basename,
		start: existingStart,
		end: existingEnd,
		allDay: existingAllDay,
		preservedFrontmatter: frontmatter,
	};

	const command = new EditEventCommand(bundle.fileRepository, file.path, eventData);
	return { command, bundle };
}

export function buildDeleteEventCommand(
	plugin: CustomCalendarPlugin,
	input: PrismaDeleteEventInput
): { command: Command; bundle: CalendarBundle } | null {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return null;

	const file = plugin.app.vault.getAbstractFileByPath(input.filePath);
	if (!(file instanceof TFile)) {
		new Notice(`File not found: ${input.filePath}`);
		return null;
	}

	const command = new DeleteEventCommand(bundle.fileRepository, file.path);
	return { command, bundle };
}
