import { acceptScreenshot, type ScreenCapture } from "@real1ty/obsidian-plugins";

import { getActiveFeedbackReport } from "./active-feedback-report";
import type { AttachedScreenshot, FeedbackFormState } from "./feedback-modal";
import { MinimizedModals } from "./minimized-modal-slot";

/** The one label under which a report occupies the shared minimized slot. */
export const MINIMIZED_FEEDBACK_LABEL = "Feedback report";

export interface ShowFeedbackModal {
	(props: {
		initialState: Partial<FeedbackFormState>;
		onCapture: ((state: FeedbackFormState) => void) | undefined;
	}): Promise<void>;
}

export interface ShowCaptureBar {
	(props: { onCapture: () => void; onCancel: () => void }): { close: () => void };
}

export interface FeedbackSessionDeps {
	showModal: ShowFeedbackModal;
	showCaptureBar: ShowCaptureBar;
	/** Null where the platform can't capture — mobile — which hides every capture affordance. */
	capture: ScreenCapture | null;
	notify: (message: string) => void;
	/**
	 * Brings the app's own window forward. A report opened from the settings
	 * window belongs to that window, so without this the capture bar and the
	 * returning report end up behind it.
	 */
	focusApp?: (() => void) | undefined;
	newId?: (() => string) | undefined;
}

/**
 * Owns the minimize → navigate → capture → resume loop.
 *
 * The report's state lives here and in the shared minimized slot, never in the
 * mounted modal — the modal is torn down and rebuilt on every leg of the flow,
 * so anything that only existed inside it would be lost the first time the user
 * went to look at the bug ([[spec-feedback-commands-and-screenshot-capture]]).
 *
 * Pure of Obsidian: everything platform-shaped arrives as a dep, which is what
 * makes the whole flow assertable without an app.
 */
export class FeedbackSession {
	constructor(private readonly deps: FeedbackSessionDeps) {}

	get canCapture(): boolean {
		return this.deps.capture !== null;
	}

	async open(initialState: Partial<FeedbackFormState> = {}): Promise<void> {
		// A report the user walked away from is still theirs: asking for feedback
		// again brings it back rather than replacing it with an empty form and
		// throwing away what they had written. Clear is how you start over.
		if (hasMinimizedFeedback()) {
			MinimizedModals.restore();
			return;
		}
		await this.show(initialState);
	}

	/**
	 * The one-shot command: capture first, *then* build a report around the
	 * image, so what is attached is the screen the user was looking at when they
	 * hit the hotkey — not the modal that would otherwise be covering it.
	 *
	 * With a report already on screen there is nothing to be one-shot about: that
	 * form is in front of the bug, so the command drives its minimize-and-capture
	 * path instead of photographing it and starting a second report.
	 */
	async captureAndOpen(): Promise<void> {
		const onScreen = getActiveFeedbackReport();
		if (onScreen !== null) {
			onScreen.requestCapture();
			return;
		}
		if (minimizedFeedback() !== null) {
			await this.captureIntoMinimized();
			return;
		}
		const captured = await this.captureInto({ type: "bug", includeDebug: true, screenshots: [], attachError: null });
		await this.open(captured);
	}

	/**
	 * The capture command, active only while a report is minimized. Raises the
	 * bar rather than shooting on the spot: the user pressed a hotkey, they have
	 * not necessarily arrived at the view they mean to show yet.
	 */
	async captureIntoMinimized(): Promise<void> {
		if (minimizedFeedback() === null) {
			this.deps.notify("No minimized report to add a screenshot to.");
			return;
		}
		this.beginCapture();
	}

	// Leaving, restoring and clearing are the shell's job, not this session's
	// ([[knowledge-preserved-form-state]]) — what is left here is the capture
	// loop, which is the only thing that puts the report down deliberately.
	//
	// The form takes itself off the screen before calling this: the session holds
	// no handle on it, because a restored report is re-opened by the shell and any
	// handle from the original open would be stale.
	private async show(initialState: Partial<FeedbackFormState>): Promise<void> {
		await this.deps.showModal({
			initialState,
			onCapture:
				this.deps.capture === null
					? undefined
					: (state) => {
							this.minimize(state);
							this.beginCapture();
						},
		});
	}

	private minimize(state: FeedbackFormState): void {
		MinimizedModals.save<FeedbackFormState>({
			label: MINIMIZED_FEEDBACK_LABEL,
			state,
			restore: (restored) => void this.show(restored),
		});
	}

	/**
	 * Hands the screen to the user with only a capture bar on it. The report is
	 * already minimized by the time this runs, so nothing of ours is in frame
	 * except the bar — which takes itself out before the shutter fires.
	 */
	private beginCapture(): void {
		// The whole flow from here belongs to the app's window: it is the app the
		// user is about to photograph, and a bar behind the settings window is a
		// bar that does not exist as far as they are concerned.
		this.deps.focusApp?.();
		this.deps.showCaptureBar({
			onCapture: () => void this.captureNow(),
			onCancel: () => MinimizedModals.restore(),
		});
	}

	/** The shutter: capture, fold the image into the parked report, bring it back. */
	private async captureNow(): Promise<void> {
		const state = minimizedFeedback();
		if (state === null) return;
		MinimizedModals.clear();
		// Focused *before* the capture, not after: bringing a window forward is an
		// OS round-trip, and Obsidian builds a modal against whichever window is
		// active at that moment. Asking first gives the focus the whole capture to
		// land, so the report that follows is built against the app's window.
		this.deps.focusApp?.();
		await this.show(await this.captureInto(state));
	}

	/** Captures and folds the image into the report, or leaves it untouched and says why. */
	private async captureInto(state: Partial<FeedbackFormState>): Promise<Partial<FeedbackFormState>> {
		const capture = this.deps.capture;
		if (capture === null) return { ...state, attachError: "Screen capture isn't available on this platform." };

		const attached = state.screenshots ?? [];
		const result = await capture(`Screenshot ${attached.length + 1}`);
		if (!result.ok) return { ...state, attachError: result.message };

		const candidate: AttachedScreenshot = { ...result.screenshot, id: this.mintId() };
		const accepted = acceptScreenshot(attached, candidate);
		return accepted.ok
			? { ...state, screenshots: accepted.screenshots, attachError: null }
			: { ...state, attachError: accepted.message };
	}

	private mintId(): string {
		return (this.deps.newId ?? (() => crypto.randomUUID()))();
	}
}

/** Whether the minimized slot is holding a report, which is what gates the capture/restore commands. */
export function hasMinimizedFeedback(): boolean {
	return MinimizedModals.label() === MINIMIZED_FEEDBACK_LABEL;
}

function minimizedFeedback(): FeedbackFormState | null {
	const entry = MinimizedModals.get<FeedbackFormState>();
	return entry?.label === MINIMIZED_FEEDBACK_LABEL ? entry.state : null;
}
