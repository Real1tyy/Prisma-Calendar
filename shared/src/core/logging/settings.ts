import { z } from "zod";

import { DEFAULT_CONSOLE_MIRROR_LEVEL } from "./console-sink";
import { LOG_LEVELS } from "./types";

export const DEFAULT_LOG_LEVEL = "info" as const;

const LEVEL_LABELS: Record<(typeof LOG_LEVELS)[number], string> = {
	debug: "Debug (everything)",
	info: "Info",
	warn: "Warnings",
	error: "Errors only",
};

/**
 * The universal Logging settings every plugin carries under a `logging` key.
 * Defaults are the privacy-preserving ones: nothing touches disk and the
 * console only sees warnings, so a user who never opens the section pays
 * nothing. See [[spec-logging-config-sinks-and-instrumentation]].
 */
export const LoggingSettingsSchema = z.object({
	minLevel: z
		.enum(LOG_LEVELS)
		.catch(DEFAULT_LOG_LEVEL)
		.describe(
			"Lowest level kept in the in-app log. Lower it to Debug while reproducing a problem, then raise it back — Debug is chatty."
		)
		.meta({ title: "Minimum level", enumLabels: LEVEL_LABELS }),
	consoleMirror: z
		.boolean()
		.catch(true)
		.describe("Also print entries to the developer console (Ctrl/Cmd+Shift+I).")
		.meta({ title: "Mirror to developer console" }),
	consoleMirrorLevel: z
		.enum(LOG_LEVELS)
		.catch(DEFAULT_CONSOLE_MIRROR_LEVEL)
		.describe("Lowest level mirrored to the developer console.")
		.meta({ title: "Console level", enumLabels: LEVEL_LABELS }),
	fileLogging: z
		.boolean()
		.catch(false)
		.describe(
			"Write entries to a log file inside the plugin folder so they survive a restart. Off by default — the file can contain note paths and property values."
		)
		.meta({ title: "Write log files" }),
	maxFileSizeKb: z
		.number()
		.int()
		.min(64)
		.max(10240)
		.catch(512)
		.describe("When the current log file grows past this size it is rotated into a dated file.")
		.meta({ title: "Rotate after (KB)", widget: "number" }),
	maxFiles: z
		.number()
		.int()
		.min(0)
		.max(50)
		.catch(5)
		.describe("How many rotated files to keep. Older ones are deleted automatically.")
		.meta({ title: "Keep rotated files", widget: "number" }),
	maxAgeDays: z
		.number()
		.int()
		.min(1)
		.max(365)
		.catch(14)
		.describe("Rotated files older than this are deleted automatically.")
		.meta({ title: "Delete rotated files after (days)", widget: "number" }),
});

export type LoggingSettings = z.infer<typeof LoggingSettingsSchema>;

/** The primary fields a user reaches for; the rest are rotation/retention tuning behind "advanced". */
export const LOGGING_BASIC_FIELDS = ["minLevel", "consoleMirror", "consoleMirrorLevel", "fileLogging"] as const;
export const LOGGING_ADVANCED_FIELDS = ["maxFileSizeKb", "maxFiles", "maxAgeDays"] as const;
