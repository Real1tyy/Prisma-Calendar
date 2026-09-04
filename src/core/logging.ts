import {
	createVaultLogFileSystem,
	FileSink,
	LoggingController,
	LogService,
	PluginLog,
	type FlushScheduler,
} from "@real1ty/obsidian-plugins";
import type { Plugin } from "obsidian";

/** Sub-folder of the plugin directory the file sink writes into. */
export const LOG_DIR_NAME = "logs";

/**
 * The plugin-wide logger every module writes to: `log.warn("recurring", …)`
 * in place of `console.warn`. Bound to the plugin's `LogService` in `onload`
 * and unbound in `onunload`; a no-op in between sessions and under unit tests.
 * Scope vocabulary: [[decision-logging-convention-levels-scopes-and-the-service-over-console]].
 */
export const log = new PluginLog();

export interface PrismaLogging {
	service: LogService;
	controller: LoggingController;
}

export interface PrismaLoggingOptions {
	now?: () => number;
	/** Injected under test so file flushes do not depend on a real timer. */
	schedule?: FlushScheduler;
}

type LoggingHost = Pick<Plugin, "app" | "manifest">;

function logDirectory(plugin: LoggingHost): string {
	const pluginDir = plugin.manifest.dir ?? `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
	return `${pluginDir}/${LOG_DIR_NAME}`;
}

/**
 * Builds the service + controller pair and teaches the controller how to make
 * a file sink over the vault adapter. Settings are applied by the caller (the
 * plugin watches its `logging` key), so this stays free of settings-store
 * coupling and is constructible before settings have loaded.
 */
export function createPrismaLogging(plugin: LoggingHost, options: PrismaLoggingOptions = {}): PrismaLogging {
	const now = options.now ?? (() => Date.now());
	const service = new LogService({ now });
	const dir = logDirectory(plugin);
	const controller = new LoggingController({
		service,
		createFileSink: (settings, onError) =>
			new FileSink({
				fs: createVaultLogFileSystem(plugin.app.vault.adapter),
				now,
				dir,
				maxFileSizeKb: settings.maxFileSizeKb,
				maxFiles: settings.maxFiles,
				maxAgeDays: settings.maxAgeDays,
				onError,
				...(options.schedule !== undefined ? { schedule: options.schedule } : {}),
			}),
	});
	return { service, controller };
}
