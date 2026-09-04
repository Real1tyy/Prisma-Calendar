import { describeError } from "../../utils/errors";
import { ConsoleSink } from "./console-sink";
import type { LogService } from "./log-service";
import type { LoggingSettings } from "./settings";
import type { LogSink } from "./types";

/** What the controller needs from a file sink — `FileSink` in production, a fake under test. */
export interface FileSinkLike extends LogSink {
	start(): Promise<void>;
	dispose(): Promise<void>;
}

export type FileSinkFactory = (settings: LoggingSettings, onError: (error: unknown) => void) => FileSinkLike;

export interface LoggingControllerOptions {
	service: LogService;
	createFileSink: FileSinkFactory;
	/** Injected for tests; defaults to a sink over the global console. */
	consoleSink?: ConsoleSink;
}

/** Scope the controller logs its own lifecycle under. */
export const LOGGING_SCOPE = "logging";

function fileConfigChanged(previous: LoggingSettings | null, next: LoggingSettings): boolean {
	if (previous === null) return true;
	return (
		previous.fileLogging !== next.fileLogging ||
		previous.maxFileSizeKb !== next.maxFileSizeKb ||
		previous.maxFiles !== next.maxFiles ||
		previous.maxAgeDays !== next.maxAgeDays
	);
}

/**
 * Reconciles a `LogService`'s threshold and sinks with a `LoggingSettings`
 * snapshot, so a settings change re-configures logging live without a
 * reload. The plugin owns the settings watch and the file sink factory (that
 * is where the vault adapter and the plugin directory live); the controller
 * owns which sinks are registered at any moment.
 */
export class LoggingController {
	private readonly service: LogService;
	private readonly createFileSink: FileSinkFactory;
	private readonly consoleSink: ConsoleSink;
	private removeConsoleSink: (() => void) | null = null;
	private fileSink: FileSinkLike | null = null;
	private removeFileSink: (() => void) | null = null;
	/** Every replaced sink's flush, chained so `dispose` can wait for all of them. */
	private pendingTeardown: Promise<void> = Promise.resolve();
	private applied: LoggingSettings | null = null;

	constructor(options: LoggingControllerOptions) {
		this.service = options.service;
		this.createFileSink = options.createFileSink;
		this.consoleSink = options.consoleSink ?? new ConsoleSink();
	}

	get hasFileSink(): boolean {
		return this.fileSink !== null;
	}

	get hasConsoleSink(): boolean {
		return this.removeConsoleSink !== null;
	}

	apply(settings: LoggingSettings): void {
		this.service.setLevel(settings.minLevel);
		this.consoleSink.setMinLevel(settings.consoleMirrorLevel);

		if (settings.consoleMirror && this.removeConsoleSink === null) {
			this.removeConsoleSink = this.service.addSink(this.consoleSink);
		} else if (!settings.consoleMirror && this.removeConsoleSink !== null) {
			this.removeConsoleSink();
			this.removeConsoleSink = null;
		}

		if (fileConfigChanged(this.applied, settings)) {
			void this.teardownFileSink();
			if (settings.fileLogging) this.startFileSink(settings);
		}

		this.applied = settings;
	}

	/** Flush the file sink and unregister everything; the service itself is left to its owner. */
	async dispose(): Promise<void> {
		this.removeConsoleSink?.();
		this.removeConsoleSink = null;
		await this.teardownFileSink();
		this.applied = null;
	}

	private startFileSink(settings: LoggingSettings): void {
		const sink = this.createFileSink(settings, (error) => this.disableFileSink(sink, error));
		this.fileSink = sink;
		this.removeFileSink = this.service.addSink(sink);
		this.service.info(LOGGING_SCOPE, "File logging enabled", {
			maxFileSizeKb: settings.maxFileSizeKb,
			maxFiles: settings.maxFiles,
			maxAgeDays: settings.maxAgeDays,
		});
		void sink.start();
	}

	private disableFileSink(sink: FileSinkLike, error: unknown): void {
		if (this.fileSink !== sink) return;
		this.removeFileSink?.();
		this.removeFileSink = null;
		this.fileSink = null;
		this.service.error(LOGGING_SCOPE, "File logging disabled after a write failure", {
			error: describeError(error),
		});
	}

	private teardownFileSink(): Promise<void> {
		const sink = this.fileSink;
		if (sink === null) return this.pendingTeardown;
		this.removeFileSink?.();
		this.removeFileSink = null;
		this.fileSink = null;
		const disposal = sink.dispose().catch((error: unknown) => {
			this.service.warn(LOGGING_SCOPE, "File sink did not flush cleanly", { error: describeError(error) });
		});
		this.pendingTeardown = this.pendingTeardown.then(() => disposal);
		return this.pendingTeardown;
	}
}
