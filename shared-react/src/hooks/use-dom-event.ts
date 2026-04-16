import { useEffect, useRef } from "react";

/**
 * Subscribe to a DOM event for the lifetime of the component. Replaces the
 * imperative `RegisteredEventsComponent.registerDomEvent` pattern — one concern
 * per hook call, cleanup is automatic.
 *
 * The latest callback is read through a ref, so passing a new function does not
 * re-subscribe; re-subscription only happens when `target` or `event` changes.
 */
export function useDomEvent<K extends keyof WindowEventMap>(
	target: Window | Document | HTMLElement | null | undefined,
	event: K,
	callback: (evt: WindowEventMap[K]) => void
): void {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!target) return;
		const listener = (evt: Event) => callbackRef.current(evt as WindowEventMap[K]);
		target.addEventListener(event, listener);
		return () => target.removeEventListener(event, listener);
	}, [target, event]);
}
