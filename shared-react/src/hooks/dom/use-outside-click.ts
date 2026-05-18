import { useEffect, useRef, type RefObject } from "react";

export interface UseOutsideClickOptions {
	/** Pointer event phase to listen on. Defaults to `mousedown` so dismissal beats the click target. */
	event?: "mousedown" | "click";
	/** When false the listener is detached entirely. Defaults to true. */
	enabled?: boolean;
	/** Return true to skip dismissal for this event (e.g. mid-drag, ignore window). */
	shouldIgnore?: (event: MouseEvent) => boolean;
}

/**
 * Fire `onOutside` when a pointer event lands outside every supplied ref's
 * subtree. The canonical "dismiss popover on outside click" hook — matches the
 * `useEscapeKey` shape so popovers can compose both without reinventing either.
 *
 * `refs` is an array so consumers with anchor + portal (a trigger button and a
 * floating menu) can register both at once. A single-ref consumer just passes
 * `[ref]`.
 *
 * Callback, refs, and `shouldIgnore` are read through a ref, so passing fresh
 * values each render does not re-attach the document listener — same discipline
 * as `useDomEvent` and `useSubscription`. Resubscription is keyed only on
 * `enabled` and `event`.
 */
export function useOutsideClick(
	refs: ReadonlyArray<RefObject<HTMLElement | null>>,
	onOutside: (event: MouseEvent) => void,
	options?: UseOutsideClickOptions
): void {
	const { event = "mousedown", enabled = true, shouldIgnore } = options ?? {};

	const refsRef = useRef(refs);
	const onOutsideRef = useRef(onOutside);
	const shouldIgnoreRef = useRef(shouldIgnore);
	useEffect(() => {
		refsRef.current = refs;
		onOutsideRef.current = onOutside;
		shouldIgnoreRef.current = shouldIgnore;
	});

	useEffect(() => {
		if (!enabled) return;
		const handler = (e: MouseEvent) => {
			if (shouldIgnoreRef.current?.(e)) return;
			const target = e.target as Node | null;
			if (!target) return;
			for (const ref of refsRef.current) {
				if (ref.current?.contains(target)) return;
			}
			onOutsideRef.current(e);
		};
		document.addEventListener(event, handler);
		return () => document.removeEventListener(event, handler);
	}, [enabled, event]);
}
