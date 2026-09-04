import type { LogService } from "./log-service";
import type { LogLevel } from "./types";

/**
 * The module-level `log` a plugin's code imports. Call sites are deep in
 * classes with no plugin reference (parsers, sync clients, frontmatter
 * helpers), so threading a `LogService` through every constructor would
 * churn the whole tree; instead the plugin binds its service at `onload` and
 * unbinds at `onunload`. Unbound, every call is a no-op — which is also what
 * keeps unit tests silent without mocking.
 */
export class PluginLog {
	private service: LogService | null = null;

	get isBound(): boolean {
		return this.service !== null;
	}

	bind(service: LogService): void {
		this.service = service;
	}

	unbind(): void {
		this.service = null;
	}

	debug(scope: string, message: string, data?: unknown): void {
		this.service?.log("debug", scope, message, data);
	}

	info(scope: string, message: string, data?: unknown): void {
		this.service?.log("info", scope, message, data);
	}

	warn(scope: string, message: string, data?: unknown): void {
		this.service?.log("warn", scope, message, data);
	}

	error(scope: string, message: string, data?: unknown): void {
		this.service?.log("error", scope, message, data);
	}

	log(level: LogLevel, scope: string, message: string, data?: unknown): void {
		this.service?.log(level, scope, message, data);
	}
}
