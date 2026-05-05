import { type RefObject, useEffect } from "react";

/**
 * Focus the referenced element whenever the active index matches the row's
 * own index. Used by keyboard-navigated lists (menus, autocomplete) where the
 * parent owns selection state and children just react to it.
 */
export function useFocusOnIndex(ref: RefObject<HTMLElement | null>, index: number, focusIndex: number): void {
	useEffect(() => {
		if (focusIndex === index) ref.current?.focus();
	}, [ref, focusIndex, index]);
}
