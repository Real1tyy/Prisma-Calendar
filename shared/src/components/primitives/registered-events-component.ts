import type { EventRef } from "obsidian";

/**
 * Base class that provides event registration and automatic cleanup.
 * Similar to ItemView's registerEvent/registerDomEvent pattern.
 *
 * Subclasses should call cleanupEvents() in their destroy/cleanup method.
 */
export abstract class RegisteredEventsComponent {
	protected eventRefs: EventRef[] = [];
	protected eventCleanupFunctions: Array<() => void> = [];

	/**
	 * Register an Obsidian event (workspace, vault, metadataCache, etc.)
	 * Event will be automatically cleaned up when destroy() is called
	 */
	protected registerEvent<T extends PropertyKey>(
		emitter: {
			on(event: T, callback: (...args: unknown[]) => void): void;
			off(event: T, callback: (...args: unknown[]) => void): void;
		},
		event: T,
		callback: (...args: unknown[]) => void
	): void {
		emitter.on(event, callback);
		this.eventCleanupFunctions.push(() => {
			emitter.off(event, callback);
		});
	}

	/**
	 * Register a DOM event (window, document, or element)
	 * Event will be automatically cleaned up when destroy() is called
	 */
	protected registerDomEvent<K extends keyof WindowEventMap>(
		target: Window | Document | HTMLElement,
		event: K,
		callback: (evt: WindowEventMap[K]) => void
	): void {
		target.addEventListener(event, callback as EventListener);
		this.eventCleanupFunctions.push(() => {
			target.removeEventListener(event, callback as EventListener);
		});
	}

	/**
	 * Clean up all registered events.
	 * Should be called by subclass destroy() method.
	 */
	protected cleanupEvents(): void {
		for (const cleanup of this.eventCleanupFunctions) {
			cleanup();
		}
		this.eventCleanupFunctions = [];
	}
}
