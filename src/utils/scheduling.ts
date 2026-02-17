/**
 * Waits for the next full render cycle to complete.
 *
 * Electron/Chromium guarantee: by the time the second RAF fires,
 * any RAF-based re-renders (e.g. FullCalendar's setOption rerender)
 * that were queued before this call have already executed and painted.
 *
 * Use this instead of setTimeout(fn, 0) when you need to read or
 * write DOM that another library (FullCalendar) is about to create
 * via its own requestAnimationFrame.
 */
export function afterRender(): Promise<void> {
	return new Promise<void>((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}
