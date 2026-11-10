import type { HttpTransport } from "../../billing-api/transport";
import { BILLING_API_OPERATIONS } from "../../generated/billing-api-operations/operations";
import {
	ReviewRequestPluginId,
	type PluginFeedbackRequest,
	type PluginFeedbackRequestScreenshotsItem,
	type PluginFeedbackRequestType,
	type ReviewRequest,
} from "../../generated/billing-api/model";
import type { DebugBundle } from "../logging/debug-bundle";

/**
 * Every wire shape here is derived from the billing API's generated model
 * ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).
 * What stays hand-written is only where the client is deliberately narrower
 * than the server (the star steps, the feedback types it offers) or richer
 * (a screenshot's display name, which never leaves the device).
 *
 * Requests go through the generated client; this table names the same routes
 * for code that only needs the path (the showrunner mock).
 */
export const SUBMISSION_ENDPOINTS = {
	review: BILLING_API_OPERATIONS.submitReview.path,
	feedback: BILLING_API_OPERATIONS.submitPluginFeedback.path,
} as const;

export type SubmissionKind = keyof typeof SUBMISSION_ENDPOINTS;

/** The request body the server accepts for each kind, exactly as the published spec declares it. */
export interface SubmissionBodies {
	review: ReviewRequest;
	feedback: PluginFeedbackRequest;
}

/** Ratings use full- or half-star increments from 0.5 through 5. */
export type StarRating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export type ReviewSubmission = Pick<ReviewRequest, "text"> & { rating: StarRating };

/**
 * What a user can send. Deliberately not "question": submission is one-way, so
 * a type that asks for an answer promises a reply we have no channel to send.
 * Questions are routed to the docs and the Help Center instead. The server still
 * accepts `question` for older builds; this list is the subset the UI offers.
 *
 * One route with a discriminator rather than three routes — the payload shape
 * is identical and the server's triage is a column, not an endpoint
 * ([[spec-in-app-feedback-and-bug-reports]]).
 */
export const FEEDBACK_TYPES = ["bug", "feature", "general"] as const satisfies readonly PluginFeedbackRequestType[];

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/**
 * What actually ships. The file name is dropped rather than redacted: it can be
 * a full vault path or a note title, it tells us nothing the image doesn't, and
 * a field that never leaves cannot leak.
 */
export type FeedbackScreenshot = PluginFeedbackRequestScreenshotsItem;

/** What the modal holds while the user is still deciding — the name labels the thumbnail. */
export type ScreenshotAttachment = FeedbackScreenshot & { name: string };

/**
 * `health` is the Doctor's verdict and `debugBundle` the raw evidence; each is
 * attached only when the user leaves its checkbox on
 * ([[spec-doctor-health-and-quick-debug-export]]).
 */
export type FeedbackSubmission = Pick<PluginFeedbackRequest, "text" | "health" | "screenshots"> & {
	type: FeedbackType;
	debugBundle?: DebugBundle;
};

export interface SubmissionPayloads {
	review: ReviewSubmission;
	feedback: FeedbackSubmission;
}

/** The context keys both submission bodies share. */
export type SubmissionContextField =
	| "pluginId"
	| "pluginVersion"
	| "obsidianVersion"
	| "platform"
	| "clientId"
	| "licenseKey";

/**
 * Plugin/runtime context stamped onto every submission. The license key is
 * included when the user has one so a submission can be attributed to a known
 * customer; nothing else identifying is — no vault content, no name, no email.
 * Whatever is here must be reflected in the user-facing docs.
 */
export type SubmissionContext = Pick<ReviewRequest, SubmissionContextField> &
	Pick<PluginFeedbackRequest, SubmissionContextField>;

export type SubmissionPluginId = SubmissionContext["pluginId"];

const SUBMISSION_PLUGIN_IDS: ReadonlySet<string> = new Set(Object.values(ReviewRequestPluginId));

/**
 * Whether the server knows this plugin. A plugin slug it doesn't list is a
 * guaranteed `400`, so callers refuse it locally with a sentence the user can read.
 */
export function isSubmissionPluginId(slug: string): slug is SubmissionPluginId {
	return SUBMISSION_PLUGIN_IDS.has(slug);
}

export type SubmissionFailure = "offline" | "network" | "timeout" | "server" | "unsupported";

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

export interface SubmissionClientOptions {
	baseUrl?: string;
	timeoutMs?: number;
	maxAttempts?: number;
	retryDelayMs?: number;
	transport?: HttpTransport;
	isOnline?: () => boolean;
}
