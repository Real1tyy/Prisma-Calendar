import { type ActionDefMap, defineAction } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type CustomCalendarPlugin from "../../main";

export const GLOBAL_KEY = "PrismaCalendar";

import { SingleCalendarConfigSchema } from "../../types/settings";
import { aiQuery } from "./ai-operations";
import { batchDelete, batchMarkAsDone, batchMarkAsUndone, batchToggleSkip } from "./batch-operations";
import {
	getCalendarInfo,
	getSettings,
	getStatistics,
	listCalendars,
	refreshCalendar,
	updateSettings,
} from "./calendar-metadata";
import {
	convertFileToEvent,
	createEvent,
	createUntrackedEvent,
	deleteEvent,
	editEvent,
	makeEventReal,
	makeEventVirtual,
	moveEventToCalendar,
} from "./event-crud";
import { activateLicense } from "./license-activation";
import {
	addZettelIdToActiveNote,
	duplicateCurrentEvent,
	openCreateEventModal,
	openEditActiveNoteModal,
} from "./modal-actions";
import { navigateToDate } from "./navigation";
import { getAllEvents, getCategories, getEventByPath, getEvents, getUntrackedEvents } from "./read-operations";
import { cloneEvent, markAsDone, markAsUndone, moveEvent, toggleSkip } from "./status-lifecycle";
import {
	PrismaActivateInputSchema,
	PrismaAIQueryInputSchema,
	PrismaAIQueryResultSchema,
	PrismaBatchInputSchema,
	PrismaCalendarIdInputSchema,
	PrismaCalendarInfoSchema,
	PrismaCategoryOutputSchema,
	PrismaCloneEventInputSchema,
	PrismaConvertEventInputSchema,
	PrismaCreateEventInputSchema,
	PrismaDeleteEventInputSchema,
	PrismaEditEventInputSchema,
	PrismaEventOutputSchema,
	PrismaFilePathInputSchema,
	PrismaGetEventsInputSchema,
	PrismaMakeRealInputSchema,
	PrismaMakeVirtualInputSchema,
	PrismaMoveEventInputSchema,
	PrismaMoveEventToCalendarInputSchema,
	PrismaMoveEventToCalendarResultSchema,
	PrismaNavigateInputSchema,
	PrismaOpenCreateEventModalInputSchema,
	PrismaStatisticsInputSchema,
	PrismaStatisticsOutputSchema,
	PrismaUpdateSettingsInputSchema,
} from "./types";

// Re-used schemas — declared once so every action that returns the same shape
// keeps a single source of truth for drift detection.
const BooleanResult = z.boolean();
const FilePathResult = z.string().nullable();

const UntrackedEventInputSchema = z.object({
	title: z.string(),
	calendarId: z.string().optional(),
});

export function buildActions(plugin: CustomCalendarPlugin): ActionDefMap {
	return {
		activate: defineAction({
			description: "Activate the Pro license by key. Persists the key to plugin settings.",
			input: PrismaActivateInputSchema,
			handler: async (input) => {
				await activateLicense(plugin, input.key);
			},
		}),
		isPro: defineAction({
			description: "Return true if the Pro license is currently active.",
			output: BooleanResult,
			handler: () => plugin.isProEnabled,
		}),
		openCreateEventModal: defineAction({
			description: "Open the modal that creates a new tracked event. Fire-and-forget — does not wait for submission.",
			input: PrismaOpenCreateEventModalInputSchema,
			handler: (input) => {
				void openCreateEventModal(
					plugin,
					input.calendarId,
					input.autoStartStopwatch ?? false,
					input.openCreatedInNewTab ?? false
				);
			},
		}),
		openEditActiveNoteModal: defineAction({
			description: "Open the edit modal for the currently active note's event.",
			input: PrismaCalendarIdInputSchema,
			handler: async (input) => {
				await openEditActiveNoteModal(plugin, input.calendarId);
			},
		}),

		// ── CRUD ────────────────────────────────────────────────────

		createUntrackedEvent: defineAction({
			description:
				"Create an untracked event note in the specified calendar. Returns the created file path, or null if creation failed.",
			input: UntrackedEventInputSchema,
			output: FilePathResult,
			handler: async (input) => await createUntrackedEvent(plugin, input.title, input.calendarId),
		}),
		createEvent: defineAction({
			description:
				"Create a new tracked event with the given title, start/end, and optional metadata. Returns the created file path, or null if creation failed.",
			input: PrismaCreateEventInputSchema,
			output: FilePathResult,
			handler: async (input) => await createEvent(plugin, input),
		}),
		editEvent: defineAction({
			description:
				"Edit fields of an existing event identified by filePath. Returns true on success, false if the event was not found.",
			input: PrismaEditEventInputSchema,
			output: BooleanResult,
			handler: async (input) => await editEvent(plugin, input),
		}),
		deleteEvent: defineAction({
			description:
				"Delete the event note at the given filePath. Returns true on success, false if the file did not exist.",
			input: PrismaDeleteEventInputSchema,
			output: BooleanResult,
			handler: async (input) => await deleteEvent(plugin, input),
		}),
		convertFileToEvent: defineAction({
			description:
				"Convert an existing file (e.g., a plain note) into a calendar event with the supplied metadata. Returns true on success.",
			input: PrismaConvertEventInputSchema,
			output: BooleanResult,
			handler: async (input) => await convertFileToEvent(plugin, input),
		}),
		makeEventVirtual: defineAction({
			description: "Convert a real event note to a virtual instance. Returns true on success.",
			input: PrismaMakeVirtualInputSchema,
			output: BooleanResult,
			handler: async (input) => await makeEventVirtual(plugin, input),
		}),
		makeEventReal: defineAction({
			description: "Promote a virtual event instance to a real note. Returns true on success.",
			input: PrismaMakeRealInputSchema,
			output: BooleanResult,
			handler: async (input) => await makeEventReal(plugin, input),
		}),
		moveEventToCalendar: defineAction({
			description:
				"Move an event note from its current calendar to targetCalendarId. Returns a result envelope with success/movedFilePath/error fields.",
			input: PrismaMoveEventToCalendarInputSchema,
			output: PrismaMoveEventToCalendarResultSchema,
			handler: async (input) => await moveEventToCalendar(plugin, input),
		}),
		addZettelIdToActiveNote: defineAction({
			description: "Add a unique Zettel ID to the active note's frontmatter. Returns true on success.",
			input: PrismaCalendarIdInputSchema,
			output: BooleanResult,
			handler: async (input) => await addZettelIdToActiveNote(plugin, input.calendarId),
		}),
		duplicateCurrentEvent: defineAction({
			description: "Duplicate the event associated with the active note. Returns true on success.",
			input: PrismaCalendarIdInputSchema,
			output: BooleanResult,
			handler: async (input) => await duplicateCurrentEvent(plugin, input.calendarId),
		}),
		navigateToDate: defineAction({
			description: "Navigate the calendar to a specific date and optional view. Returns true if a view changed.",
			input: PrismaNavigateInputSchema,
			output: BooleanResult,
			handler: async (input) => await navigateToDate(plugin, input),
		}),

		// ── Read Operations ──────────────────────────────────

		getEvents: defineAction({
			description: "Return all events whose timed range overlaps [start, end). Both timestamps are ISO strings.",
			input: PrismaGetEventsInputSchema,
			output: z.array(PrismaEventOutputSchema),
			handler: async (input) => await getEvents(plugin, input),
		}),
		getEventByPath: defineAction({
			description: "Look up a single event by its file path. Returns the event payload, or null if not found.",
			input: PrismaFilePathInputSchema,
			output: PrismaEventOutputSchema.nullable(),
			handler: (input) => getEventByPath(plugin, input),
		}),
		getAllEvents: defineAction({
			description: "Return every event known to the calendar (tracked + untracked).",
			input: PrismaCalendarIdInputSchema.optional(),
			output: z.array(PrismaEventOutputSchema),
			handler: (input) => getAllEvents(plugin, input),
		}),
		getCategories: defineAction({
			description: "Return all distinct categories with their colours for the active calendar.",
			input: PrismaCalendarIdInputSchema.optional(),
			output: z.array(PrismaCategoryOutputSchema),
			handler: (input) => getCategories(plugin, input),
		}),
		getUntrackedEvents: defineAction({
			description: "Return the subset of events that are untracked (no Start Date).",
			input: PrismaCalendarIdInputSchema.optional(),
			output: z.array(PrismaEventOutputSchema),
			handler: (input) => getUntrackedEvents(plugin, input),
		}),

		// ── Status & Lifecycle Operations ────────────────────

		markAsDone: defineAction({
			description: "Stamp the event with completion frontmatter. Returns true on success.",
			input: PrismaFilePathInputSchema,
			output: BooleanResult,
			handler: async (input) => await markAsDone(plugin, input),
		}),
		markAsUndone: defineAction({
			description: "Clear completion frontmatter from the event. Returns true on success.",
			input: PrismaFilePathInputSchema,
			output: BooleanResult,
			handler: async (input) => await markAsUndone(plugin, input),
		}),
		toggleSkip: defineAction({
			description: "Toggle the skipped state of the event. Returns true on success.",
			input: PrismaFilePathInputSchema,
			output: BooleanResult,
			handler: async (input) => await toggleSkip(plugin, input),
		}),
		cloneEvent: defineAction({
			description:
				"Clone an event, optionally offsetting the clone's start by offsetMs. Returns the new file path or null.",
			input: PrismaCloneEventInputSchema,
			output: FilePathResult,
			handler: async (input) => await cloneEvent(plugin, input),
		}),
		moveEvent: defineAction({
			description: "Shift an event's start (and end if timed) by offsetMs milliseconds. Returns true on success.",
			input: PrismaMoveEventInputSchema,
			output: BooleanResult,
			handler: async (input) => await moveEvent(plugin, input),
		}),

		// ── Batch Operations ─────────────────────────────────

		batchMarkAsDone: defineAction({
			description: "Mark every event note at the given filePaths as done. Returns true if all succeeded.",
			input: PrismaBatchInputSchema,
			output: BooleanResult,
			handler: async (input) => await batchMarkAsDone(plugin, input),
		}),
		batchMarkAsUndone: defineAction({
			description: "Clear the done status from every event note at the given filePaths. Returns true if all succeeded.",
			input: PrismaBatchInputSchema,
			output: BooleanResult,
			handler: async (input) => await batchMarkAsUndone(plugin, input),
		}),
		batchDelete: defineAction({
			description: "Delete every event note at the given filePaths. Returns true if all succeeded.",
			input: PrismaBatchInputSchema,
			output: BooleanResult,
			handler: async (input) => await batchDelete(plugin, input),
		}),
		batchToggleSkip: defineAction({
			description: "Toggle the skipped flag on every event note at the given filePaths. Returns true if all succeeded.",
			input: PrismaBatchInputSchema,
			output: BooleanResult,
			handler: async (input) => await batchToggleSkip(plugin, input),
		}),

		// ── Calendar Metadata & Control ──────────────────────

		refreshCalendar: defineAction({
			description: "Force a refresh of the calendar view, re-reading events from disk.",
			input: PrismaCalendarIdInputSchema,
			handler: (input) => {
				refreshCalendar(plugin, input);
			},
		}),
		getCalendarInfo: defineAction({
			description: "Return summary info for one calendar bundle. Returns null if the calendarId is unknown.",
			input: PrismaCalendarIdInputSchema,
			output: PrismaCalendarInfoSchema.nullable(),
			handler: (input) => getCalendarInfo(plugin, input),
		}),
		listCalendars: defineAction({
			description: "List all calendar bundles configured in the plugin.",
			output: z.array(PrismaCalendarInfoSchema),
			handler: () => listCalendars(plugin),
		}),

		// ── Statistics ───────────────────────────────────────

		getStatistics: defineAction({
			description:
				"Aggregate statistics for the given date and interval. Returns null if the calendar can't be resolved or the date is invalid.",
			input: PrismaStatisticsInputSchema,
			output: PrismaStatisticsOutputSchema.nullable(),
			handler: async (input) => await getStatistics(plugin, input),
		}),

		// ── Settings ────────────────────────────────────────

		getSettings: defineAction({
			description: "Return the full settings snapshot for the resolved calendar bundle. Returns null if not found.",
			input: PrismaCalendarIdInputSchema,
			output: SingleCalendarConfigSchema.nullable(),
			handler: (input) => getSettings(plugin, input),
		}),
		updateSettings: defineAction({
			description:
				"Apply a partial patch to the resolved calendar's settings. Returns true on success. Window-API only — URL transport cannot represent the nested settings object.",
			input: PrismaUpdateSettingsInputSchema,
			output: BooleanResult,
			handler: async (input) => await updateSettings(plugin, input),
		}),

		// ── AI Operations ─────────────────────────────────────

		aiQuery: defineAction({
			description: "Run an AI query against the calendar with optional execute=true to apply the resulting operations.",
			input: PrismaAIQueryInputSchema,
			output: PrismaAIQueryResultSchema,
			handler: async (input) => await aiQuery(plugin, input),
		}),
	};
}
