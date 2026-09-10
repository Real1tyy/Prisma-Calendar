import type { DebugBundle } from "../logging/debug-bundle";

export const SUBMISSION_API_BASE_URL = "https://api.matejvavroproductivity.com";

/**
 * Endpoint paths are configuration so the worker's final path can be flipped
 * here without reshaping the client ([[spec-in-app-rating-and-review]]). New
 * submission kinds (feedback, bug reports) register their path here and their
 * payload in {@link SubmissionPayloads} + `SUBMISSION_PAYLOAD_FIELDS`.
 */
export const SUBMISSION_ENDPOINTS = {
	review: "/api/review",
	// `/api/feedback` is the website's own proxy; the plugin route the worker
	// serves is `/api/feedback/plugin`. Posting to the proxy from here silently
	// files reports through the wrong door, so the suffix is load-bearing.
	feedback: "/api/feedback/plugin",
} as const;

export type SubmissionKind = keyof typeof SUBMISSION_ENDPOINTS;

/** Ratings use full- or half-star increments from 0.5 through 5. */
export type StarRating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface ReviewSubmission {
	rating: StarRating;
	text?: string;
}

/**
 * What a user can send. Deliberately not "question": submission is one-way, so
 * a type that asks for an answer promises a reply we have no channel to send.
 * Questions are routed to the docs and the Help Center instead.
 *
 * One route with a discriminator rather than three routes — the payload shape
 * is identical and the server's triage is a column, not an endpoint
 * ([[spec-in-app-feedback-and-bug-reports]]).
 */
export const FEEDBACK_TYPES = ["bug", "feature", "general"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** What the modal holds while the user is still deciding — the name labels the thumbnail. */
export interface ScreenshotAttachment {
	name: string;
	mimeType: string;
	/** Base64 image bytes, without the `data:` URL prefix. */
	dataBase64: string;
	byteSize: number;
}

/**
 * What actually ships. The file name is dropped rather than redacted: it can be
 * a full vault path or a note title, it tells us nothing the image doesn't, and
 * a field that never leaves cannot leak.
 */
export type FeedbackScreenshot = Omit<ScreenshotAttachment, "name">;

export interface FeedbackSubmission {
	type: FeedbackType;
	text: string;
	/** Attached only when the user leaves "Include debug info" on. */
	debugBundle?: DebugBundle;
	screenshots?: FeedbackScreenshot[];
}

export interface SubmissionPayloads {
	review: ReviewSubmission;
	feedback: FeedbackSubmission;
}

/**
 * Plugin/runtime context stamped onto every submission. The license key is
 * included when the user has one so a submission can be attributed to a known
 * customer; nothing else identifying is — no vault content, no name, no email.
 * Whatever is here must be reflected in the user-facing docs.
 */
export interface SubmissionContext {
	pluginId: string;
	pluginVersion: string;
	obsidianVersion: string;
	platform: string;
	clientId: string;
	/** Present only for a licensed install — absent on the free tier. */
	licenseKey?: string;
}

export type SubmissionFailure = "offline" | "network" | "timeout" | "server";

export interface SubmissionSuccess {
	readonly ok: true;
	readonly status: number;
}

export interface SubmissionError {
	readonly ok: false;
	readonly failure: SubmissionFailure;
	/** HTTP status when the server answered; `null` when the request never landed. */
	readonly status: number | null;
	/** User-facing sentence, safe to render straight into the modal. */
	readonly message: string;
	/**
	 * The server's own account of the refusal, condensed from the response body
	 * and already folded into {@link message}. Separate so a caller can log or
	 * assert on it without parsing the sentence. Absent when the body was empty
	 * or unreadable.
	 */
	readonly detail?: string;
}

export type SubmissionResult = SubmissionSuccess | SubmissionError;

export interface SubmissionRequest {
	url: string;
	method: "POST";
	headers: Record<string, string>;
	body: string;
}

export interface SubmissionResponse {
	status: number;
	/**
	 * Raw response body. Carried for the failure path only: a 4xx from our API
	 * names the field it rejected, and dropping it leaves the user staring at a
	 * bare status code with nothing to act on.
	 */
	body?: string;
}

/** Injectable HTTP seam — defaults to Obsidian's `requestUrl` (no CORS, works on mobile). */
export type SubmissionTransport = (request: SubmissionRequest) => Promise<SubmissionResponse>;

export interface SubmissionClientOptions {
	baseUrl?: string;
	timeoutMs?: number;
	maxAttempts?: number;
	retryDelayMs?: number;
	transport?: SubmissionTransport;
	isOnline?: () => boolean;
}
