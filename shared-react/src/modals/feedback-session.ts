import { acceptScreenshot, type ScreenCapture } from "@real1ty/obsidian-plugins";

import type { AttachedScreenshot, FeedbackFormState, FeedbackModalHandle } from "./feedback-modal";
import { MinimizedModals } from "./minimized-modal-slot";

/** The one label under which a report occupies the shared minimized slot. */
export const MINIMIZED_FEEDBACK_LABEL = "Feedback report";

export interface ShowFeedbackModal {
	(props: {
		initialState: Partial<FeedbackFormState>;
		onMinimize: (state: FeedbackFormState) => void;
		onCapture: ((state: FeedbackFormState) => void) | undefined;
	}): Promise<FeedbackModalHandle>;
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
		// Opening a fresh report abandons a minimized one rather than stacking a
		// second: one report at a time is the whole model, and the user asking for
		// a new one has said which they mean.
		MinimizedModals.clear();
		await this.show(initialState);
	}

	/**
	 * The one-shot command: capture first, *then* build a report around the
	 * image, so what is attached is the screen the user was looking at when they
	 * hit the hotkey — not the modal that would otherwise be covering it.
	 */
	async captureAndOpen(): Promise<void> {
		const captured = await this.captureInto({ type: "bug", includeDebug: true, screenshots: [], attachError: null });
		await this.open(captured);
	}

	/** The capture command, active only while a report is minimized. */
	async captureIntoMinimized(): Promise<void> {
		const state = minimizedFeedback();
		if (state === null) {
			this.deps.notify("No minimized report to add a screenshot to.");
			return;
		}
		MinimizedModals.clear();
		await this.show(await this.captureInto(state));
	}

	private async show(initialState: Partial<FeedbackFormState>): Promise<void> {
		let handle: FeedbackModalHandle | null = null;
		handle = await this.deps.showModal({
			initialState,
			onMinimize: (state) => {
				handle?.close();
				this.minimize(state);
				this.deps.notify("Report minimized — restore it from the command palette when you're ready.");
			},
			onCapture:
				this.deps.capture === null
					? undefined
					: (state) => {
							handle?.close();
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
		this.deps.showCaptureBar({
			onCapture: () => void this.captureIntoMinimized(),
			onCancel: () => MinimizedModals.restore(),
		});
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
