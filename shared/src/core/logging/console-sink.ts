import { isAtLeast, type LogEntry, type LogLevel, type LogSink } from "./types";

export type ConsoleLike = Pick<Console, "debug" | "info" | "warn" | "error">;

export const DEFAULT_CONSOLE_MIRROR_LEVEL: LogLevel = "warn";

export interface ConsoleSinkOptions {
	minLevel?: LogLevel;
	/** Injected for tests; defaults to the global console. */
	console?: ConsoleLike;
}

/**
 * Mirrors entries to the developer console, gated by its own threshold so a
 * `debug` service level for the in-memory viewer does not also flood the
 * console. Off by default for anything below `warn`: the console is the one
 * sink a user never asked for.
 */
export class ConsoleSink implements LogSink {
	private minLevel: LogLevel;
	private readonly target: ConsoleLike;

	constructor(options: ConsoleSinkOptions = {}) {
		this.minLevel = options.minLevel ?? DEFAULT_CONSOLE_MIRROR_LEVEL;
		this.target = options.console ?? console;
	}

	getMinLevel(): LogLevel {
		return this.minLevel;
	}

	setMinLevel(level: LogLevel): void {
		this.minLevel = level;
	}

	write(entry: LogEntry): void {
		if (!isAtLeast(entry.level, this.minLevel)) return;
		const line = `[${entry.scope}] ${entry.message}`;
		if (entry.data === undefined) {
			this.target[entry.level](line);
		} else {
			this.target[entry.level](line, entry.data);
		}
	}
}
