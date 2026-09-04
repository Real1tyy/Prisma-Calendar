export const SUBMISSION_API_BASE_URL = "https://api.matejvavroproductivity.com";

/**
 * Endpoint paths are configuration so the worker's final path can be flipped
 * here without reshaping the client ([[spec-in-app-rating-and-review]]). New
 * submission kinds (feedback, bug reports) register their path here and their
 * payload in {@link SubmissionPayloads} + `SUBMISSION_PAYLOAD_FIELDS`.
 */
export const SUBMISSION_ENDPOINTS = {
	review: "/api/review",
} as const;

export type SubmissionKind = keyof typeof SUBMISSION_ENDPOINTS;

/** Ratings use full- or half-star increments from 0.5 through 5. */
export type StarRating = 0.5 | 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | 4.5 | 5;

export interface ReviewSubmission {
	rating: StarRating;
	text?: string;
}

export interface SubmissionPayloads {
	review: ReviewSubmission;
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
