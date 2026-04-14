import { useEffect, useRef } from "react";

/**
 * Minimal emitter shape — matches Obsidian's `Events`, `Workspace`, `Vault`,
 * `MetadataCache`. Structural typing avoids forcing the `obsidian` import on
 * consumers.
 */
export interface Emitterlike<E extends PropertyKey = string> {
	on(event: E, callback: (...args: unknown[]) => void): void;
	off(event: E, callback: (...args: unknown[]) => void): void;
}

/**
 * Subscribe to an Obsidian-style event for the lifetime of the component.
 * Replaces `RegisteredEventsComponent.registerEvent`.
 *
 * The latest callback is read through a ref, so passing a new function does not
 * re-subscribe; re-subscription only happens when `emitter` or `event` changes.
 */
export function useObsidianEvent<E extends PropertyKey>(
	emitter: Emitterlike<E> | null | undefined,
	event: E,
	callback: (...args: unknown[]) => void
): void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!emitter) return;
		const listener = (...args: unknown[]) => callbackRef.current(...args);
		emitter.on(event, listener);
		return () => emitter.off(event, listener);
	}, [emitter, event]);
}
