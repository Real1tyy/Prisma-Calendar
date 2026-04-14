import { useDomEvent } from "./use-dom-event";

/**
 * Mounts a `keydown` listener on `target` that fires only when `key` matches.
 * Swallows auto-repeat events unless `allowRepeat` is true.
 *
 * Building block for higher-level keyboard hooks (`useEscapeKey`, `useEnterKey`,
 * etc.). Using this primitive instead of raw `useDomEvent` removes the
 * `e.key === ...` branch from every caller.
 */
export function useKeyDown(
	target: Window | Document | HTMLElement | null | undefined,
	key: string,
	handler: (e: KeyboardEvent) => void,
	options: { allowRepeat?: boolean } = {}
): void {
	useDomEvent(target, "keydown", (e) => {
		if (e.key !== key) return;
		if (e.repeat && !options.allowRepeat) return;
		handler(e);
	});
}
