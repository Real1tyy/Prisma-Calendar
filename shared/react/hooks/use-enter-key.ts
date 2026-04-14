import { useKeyDown } from "./use-key-down";

export interface UseEnterKeyOptions {
	/** When true, only fire on Ctrl+Enter / Cmd+Enter. Default: false. */
	requireModifier?: boolean;
	/** Allow key auto-repeat. Default: false. */
	allowRepeat?: boolean;
}

/**
 * Fires `handler` when the user presses Enter on `target`. Defaults to the
 * document — pass a specific element for scoped "submit" semantics inside
 * inline editors or forms.
 *
 * With `requireModifier`, only Ctrl+Enter / Cmd+Enter triggers — matches the
 * existing commit-on-modifier convention used by `TextInput`.
 */
export function useEnterKey(
	handler: (e: KeyboardEvent) => void,
	target: Window | Document | HTMLElement | null = typeof document !== "undefined" ? document : null,
	options: UseEnterKeyOptions = {}
): void {
	const { requireModifier = false, allowRepeat = false } = options;
	useKeyDown(
		target,
		"Enter",
		(e) => {
			if (requireModifier && !(e.ctrlKey || e.metaKey)) return;
			handler(e);
		},
		{ allowRepeat }
	);
}
