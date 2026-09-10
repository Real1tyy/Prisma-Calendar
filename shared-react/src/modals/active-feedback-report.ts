/**
 * The report that is on screen right now, if any.
 *
 * A command fires from outside React and has no handle on the mounted modal, so
 * without this the capture commands would photograph the very form that is
 * covering the bug. The modal registers itself while mounted and the commands
 * ask here first: an open report is *put away* and the capture proceeds through
 * the normal minimize → bar → resume loop
 * ([[spec-feedback-commands-and-screenshot-capture]] R9).
 */
export interface ActiveFeedbackReport {
	/** Puts the report away and raises the capture bar — the form's own camera path, driven from outside. */
	requestCapture: () => void;
}

let active: ActiveFeedbackReport | null = null;

/** Returns the unregister function, so the modal can hand it straight to `useEffect`. */
export function registerActiveFeedbackReport(report: ActiveFeedbackReport): () => void {
	active = report;
	return () => {
		if (active === report) active = null;
	};
}

export function getActiveFeedbackReport(): ActiveFeedbackReport | null {
	return active;
}
