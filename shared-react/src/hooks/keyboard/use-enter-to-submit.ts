import { useCallback, useRef, type KeyboardEvent } from "react";

/**
 * Returns a React `onKeyDown` handler that fires `submit` when the user
 * presses Enter inside the bound element, mirroring native form semantics:
 *
 *   - skips `<textarea>` (Enter inserts a newline)
 *   - skips `<button>` (Enter triggers click)
 *   - skips `<select>` (Enter confirms the option)
 *   - respects React synthetic `stopPropagation` from descendant inputs that
 *     handle Enter themselves (chip / tag inputs, autocomplete pickers)
 *
 * The returned handler has stable identity across renders — `submit` is read
 * through a ref so memoized children that receive the handler never re-render
 * just because the parent's submit closure changed.
 */
export function useEnterToSubmit<T extends HTMLElement = HTMLDivElement>(
	submit: () => void
): (event: KeyboardEvent<T>) => void {
	const submitRef = useRef(submit);
	submitRef.current = submit;

	return useCallback((event: KeyboardEvent<T>) => {
		if (event.key !== "Enter") return;
		const target = event.target as HTMLElement | null;
		if (target instanceof HTMLTextAreaElement) return;
		if (target instanceof HTMLButtonElement) return;
		if (target instanceof HTMLSelectElement) return;
		event.preventDefault();
		submitRef.current();
	}, []);
}
