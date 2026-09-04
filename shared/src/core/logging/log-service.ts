import { Subject, type Observable } from "rxjs";

import { MemorySink } from "./memory-sink";
import { redactText, scrubSecrets } from "./redact";
import { DEFAULT_LOG_LEVEL } from "./settings";
import {
	LOG_LEVEL_SEVERITY,
	type LogChange,
	type LogEntry,
	type LogFilter,
	type LogLevel,
	type LogSink,
} from "./types";

export interface LogServiceOptions {
	/**
	 * Required, not defaulted: keeping `Date.now()` out of this module is what
	 * makes the buffer deterministic under test. Plugins pass `() => Date.now()`
	 * at their boundary.
	 */
	now: () => number;
	capacity?: number;
	level?: LogLevel;
}

/**
 * Leveled, structured log service — one instance per plugin.
 *
 * The write side is the whole codebase (`log.warn("indexer", …)` in place of
 * `console.warn`); the read side is the logs viewer, Doctor, and debug export,
 * all served from the always-present `MemorySink`. Every entry that clears the
 * threshold is also fanned out to the registered sinks (console mirror, file).
 * See [[spec-in-memory-log-service]] and [[spec-logging-config-sinks-and-instrumentation]].
 */
export class LogService {
	readonly memory: MemorySink;
	private readonly sinks: LogSink[] = [];
	private readonly now: () => number;
	private readonly changes = new Subject<LogChange>();
	private level: LogLevel;
	private seq = 0;

	/** Emits per retained append and per `clear`, so consumers update without polling. */
	readonly changes$: Observable<LogChange> = this.changes.asObservable();

	constructor(options: LogServiceOptions) {
		this.now = options.now;
		this.memory = new MemorySink(options.capacity);
		this.level = options.level ?? DEFAULT_LOG_LEVEL;
	}

	get capacity(): number {
		return this.memory.capacity;
	}

	getLevel(): LogLevel {
		return this.level;
	}

	setLevel(level: LogLevel): void {
		this.level = level;
	}

	get size(): number {
		return this.memory.size;
	}

	/** Register a sink; returns its unregister. Registering the same sink twice is a no-op. */
	addSink(sink: LogSink): () => void {
		if (!this.sinks.includes(sink)) this.sinks.push(sink);
		return () => this.removeSink(sink);
	}

	removeSink(sink: LogSink): void {
		const index = this.sinks.indexOf(sink);
		if (index !== -1) this.sinks.splice(index, 1);
	}

	get sinkCount(): number {
		return this.sinks.length;
	}

	debug(scope: string, message: string, data?: unknown): void {
		this.log("debug", scope, message, data);
	}

	info(scope: string, message: string, data?: unknown): void {
		this.log("info", scope, message, data);
	}

	warn(scope: string, message: string, data?: unknown): void {
		this.log("warn", scope, message, data);
	}

	error(scope: string, message: string, data?: unknown): void {
		this.log("error", scope, message, data);
	}

	log(level: LogLevel, scope: string, message: string, data?: unknown): void {
		try {
			if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[this.level]) return;

			const entry: LogEntry = {
				seq: this.seq++,
				ts: this.now(),
				level,
				scope,
				message: redactText(message, { fullDetail: true }),
				// Never let a credential into the buffer — see [[decision-observability-privacy-posture]].
				...(data === undefined ? {} : { data: scrubSecrets(data) }),
			};
			this.memory.write(entry);
			for (const sink of this.sinks) {
				try {
					sink.write(entry);
				} catch {
					// One broken sink must not starve the others, and there is no
					// safe place to report it from inside the write path.
				}
			}
			this.changes.next({ type: "append", entry });
		} catch {
			// A logging failure must never break the feature being logged, and the
			// only place left to report it would be the buffer we just failed to
			// write to. Losing the entry is the lesser harm.
		}
	}

	/** Full buffer, oldest-first. A fresh array each call — later appends can't mutate it. */
	snapshot(): LogEntry[] {
		return this.memory.snapshot();
	}

	entries(filter?: LogFilter): LogEntry[] {
		return this.memory.entries(filter);
	}

	clear(): void {
		this.memory.clear();
		this.changes.next({ type: "clear" });
	}

	/** Complete the change stream on plugin unload so subscribers tear down. */
	destroy(): void {
		this.sinks.length = 0;
		this.changes.complete();
	}
}
