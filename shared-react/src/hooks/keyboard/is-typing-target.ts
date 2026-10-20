/** True when a key event lands in a field whose keys belong to the caret. */
export function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
	return target.isContentEditable;
}
