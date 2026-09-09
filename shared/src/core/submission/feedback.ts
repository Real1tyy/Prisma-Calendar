import type { DebugBundle } from "../logging/debug-bundle";
import { redact, redactText } from "../logging/redact";
import type { FeedbackSubmission, FeedbackType, ScreenshotAttachment } from "./types";

/**
 * Caps exist because the backend is small and a screenshot is the one thing a
 * user can attach that is orders of magnitude larger than everything else. They
 * are enforced at attach time so the user hears "that one is too big" while
 * they can still do something about it, not after a failed POST.
 */
export const FEEDBACK_MAX_TEXT_CHARS = 4000;
export const FEEDBACK_MAX_SCREENSHOTS = 3;
export const FEEDBACK_MAX_SCREENSHOT_BYTES = 2_000_000;
export const FEEDBACK_MAX_ATTACHMENT_BYTES = 5_000_000;

function megabytes(bytes: number): string {
	return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export type ScreenshotAcceptance =
	| { readonly ok: true; readonly screenshots: ScreenshotAttachment[] }
	| { readonly ok: false; readonly message: string };

/**
 * Decides whether one more image fits, returning the new list or the sentence
 * to show the user. Pure so the modal owns no cap arithmetic of its own.
 */
export function acceptScreenshot(
	attached: readonly ScreenshotAttachment[],
	candidate: ScreenshotAttachment
): ScreenshotAcceptance {
	if (!candidate.mimeType.startsWith("image/")) {
		return { ok: false, message: `${candidate.name} isn't an image — only screenshots can be attached.` };
	}
	if (attached.length >= FEEDBACK_MAX_SCREENSHOTS) {
		return { ok: false, message: `You can attach up to ${FEEDBACK_MAX_SCREENSHOTS} screenshots.` };
	}
	if (candidate.byteSize > FEEDBACK_MAX_SCREENSHOT_BYTES) {
		return {
			ok: false,
			message: `${candidate.name} is ${megabytes(candidate.byteSize)} — each screenshot must stay under ${megabytes(FEEDBACK_MAX_SCREENSHOT_BYTES)}.`,
		};
	}
	const total = attached.reduce((sum, shot) => sum + shot.byteSize, 0) + candidate.byteSize;
	if (total > FEEDBACK_MAX_ATTACHMENT_BYTES) {
		return {
			ok: false,
			message: `Attachments would total ${megabytes(total)} — the limit is ${megabytes(FEEDBACK_MAX_ATTACHMENT_BYTES)}.`,
		};
	}
	return { ok: true, screenshots: [...attached, candidate] };
}

export interface FeedbackDraft {
	type: FeedbackType;
	text: string;
	debugBundle?: DebugBundle | undefined;
	screenshots?: readonly ScreenshotAttachment[] | undefined;
}

/**
 * The one gate every feedback payload passes on its way off the device.
 *
 * Redaction lives here rather than in the bundle builder so there is exactly
 * one place to audit: the bundle is deep-redacted (paths hashed, frontmatter
 * values elided, secrets gone), the user's own prose keeps its detail but still
 * loses anything credential-shaped, and a screenshot arrives stripped of the
 * file name it was attached under. See [[decision-observability-privacy-posture]].
 */
export function buildFeedbackSubmission({ type, text, debugBundle, screenshots }: FeedbackDraft): FeedbackSubmission {
	const trimmed = text.trim().slice(0, FEEDBACK_MAX_TEXT_CHARS);
	return {
		type,
		// The user wrote this deliberately, so paths and note names stay; rule 1
		// (secrets) is not optional and applies anyway.
		text: redactText(trimmed, { fullDetail: true }),
		// `redact` preserves JSON-ish structure, so the bundle keeps its shape.
		...(debugBundle !== undefined ? { debugBundle: redact(debugBundle) as DebugBundle } : {}),
		...(screenshots !== undefined && screenshots.length > 0
			? {
					screenshots: screenshots.map(({ mimeType, dataBase64, byteSize }) => ({
						mimeType,
						dataBase64,
						byteSize,
					})),
				}
			: {}),
	};
}
