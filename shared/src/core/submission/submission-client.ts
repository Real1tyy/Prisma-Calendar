import { submitPluginFeedback, submitReview } from "../../billing-api/generated/client";
import type { BillingApiRequestOptions } from "../../billing-api/request";
import type {
	SubmissionBodies,
	SubmissionClientOptions,
	SubmissionContext,
	SubmissionContextField,
	SubmissionError,
	SubmissionFailure,
	SubmissionKind,
	SubmissionPayloads,
	SubmissionResult,
} from "./types";

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 500;
const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR_FLOOR = 500;

const OFFLINE_MESSAGE = "You appear to be offline. Reconnect and try again — nothing was lost.";
const TIMEOUT_MESSAGE = "The request timed out. Please try again.";
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

/**
 * Each listed key must exist on both the caller's payload and the server's
 * generated request body, so naming a field the server would refuse is a
 * compile error rather than a production `400`
 * ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).
 */
export type PayloadFieldsAgainst<Bodies extends { [K in SubmissionKind]: object }> = {
	readonly [K in SubmissionKind]: readonly (keyof SubmissionPayloads[K] & keyof Bodies[K])[];
};

export type SubmissionPayloadFields = PayloadFieldsAgainst<SubmissionBodies>;

/**
 * The wire body is assembled from these explicit lists rather than spread from
 * the caller's objects, so a future payload type cannot widen it by accident:
 * anything not named here does not leave the device. The list is the contract
 * the user-facing docs describe — extending it is a privacy decision, not a
 * refactor ([[spec-in-app-rating-and-review]]).
 */
export const SUBMISSION_PAYLOAD_FIELDS = {
	review: ["rating", "text"],
	feedback: ["type", "text", "health", "debugBundle", "screenshots"],
} as const satisfies SubmissionPayloadFields;

const SUBMISSION_CONTEXT_FIELDS = [
	"pluginId",
	"pluginVersion",
	"obsidianVersion",
	"platform",
	"clientId",
	"licenseKey",
] as const satisfies readonly (SubmissionContextField & keyof SubmissionBodies[SubmissionKind])[];

type SubmitRoute<K extends SubmissionKind> = (
	body: SubmissionBodies[K],
	options: BillingApiRequestOptions
) => Promise<{ status: number; data: unknown }>;

const SUBMIT_ROUTES: { [K in SubmissionKind]: SubmitRoute<K> } = {
	review: submitReview,
	feedback: submitPluginFeedback,
};

const TIMED_OUT = Symbol("submission-timed-out");

/** Long enough for a Zod issue list, short enough that the modal stays readable. */
const SERVER_DETAIL_MAX_CHARS = 200;

export function buildSubmissionBody<K extends SubmissionKind>(
	kind: K,
	payload: SubmissionPayloads[K],
	context: SubmissionContext
): SubmissionBodies[K] {
	const body: Record<string, unknown> = { kind };
	for (const field of SUBMISSION_CONTEXT_FIELDS) {
		const value = context[field];
		if (value !== undefined) body[field] = value;
	}
	const fields = SUBMISSION_PAYLOAD_FIELDS[kind] as readonly (keyof SubmissionPayloads[K])[];
	for (const field of fields) {
		const value = payload[field];
		if (value !== undefined) body[field as string] = value;
	}
	// The key-by-key copy is what keeps unknown keys off the wire, and the field
	// lists are typed against the generated body, so the shape is checked there.
	return body as unknown as SubmissionBodies[K];
}

/**
 * Condense the server's refusal into one sentence-worth of explanation.
 *
 * Our API answers a rejected submission two ways — Hono's `zValidator` emits
 * `{ error: { issues: [...] } }`, everything else emits `{ error: "…" }` — and a
 * body that is neither is still better shown than dropped. This is what turns
 * "HTTP 400" into "message: Required", which is the difference between a user
 * filing a useful report and having nothing to say.
 *
 * Accepts the raw text or the already-parsed body the billing-API client hands back.
 */
export function describeServerDetail(body: unknown): string | undefined {
	const raw = typeof body === "string" ? body.trim() : body === undefined || body === null ? "" : JSON.stringify(body);
	if (!raw) return undefined;
	const detail = (parseServerDetail(raw) ?? raw).replace(/\s+/g, " ").trim();
	if (!detail) return undefined;
	return detail.length > SERVER_DETAIL_MAX_CHARS ? `${detail.slice(0, SERVER_DETAIL_MAX_CHARS)}…` : detail;
}

function parseServerDetail(body: string): string | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return undefined;
	}
	if (typeof parsed !== "object" || parsed === null) return undefined;
	const { error, message } = parsed as { error?: unknown; message?: unknown };
	if (typeof error === "string") return error;
	if (typeof message === "string") return message;
	return describeIssues(error);
}

function describeIssues(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	const { issues } = error as { issues?: unknown };
	if (!Array.isArray(issues) || issues.length === 0) return undefined;
	return issues
		.map((issue) => {
			const { path, message } = (issue ?? {}) as { path?: unknown; message?: unknown };
			const where = Array.isArray(path) && path.length > 0 ? path.join(".") : "body";
			return typeof message === "string" ? `${where}: ${message}` : where;
		})
		.join("; ");
}

function fail(failure: SubmissionFailure, status: number | null, message: string, detail?: string): SubmissionError {
	return { ok: false, failure, status, message, ...(detail !== undefined ? { detail } : {}) };
}

/**
 * The server keeps a fixed list of the plugins it accepts submissions for, so a
 * plugin missing from it would only ever get a `400`. Refused before any request,
 * with a sentence that says why.
 */
export function unsupportedPluginError(slug: string): SubmissionError {
	return fail(
		"unsupported",
		null,
		`Sending from ${slug} isn't available yet. Please use the Help Center link instead — nothing was lost.`
	);
}

function isRetryable(error: SubmissionError): boolean {
	if (error.failure === "network" || error.failure === "timeout") return true;
	return (
		error.failure === "server" &&
		error.status !== null &&
		(error.status === TOO_MANY_REQUESTS || error.status >= SERVER_ERROR_FLOOR)
	);
}

function describeError(error: unknown): string {
	return error instanceof Error && error.message ? `${NETWORK_MESSAGE} (${error.message})` : NETWORK_MESSAGE;
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * A timed-out request is abandoned, not cancelled — `requestUrl` exposes no
 * abort signal. The response is simply ignored, so a late 200 for a submission
 * the user already retried is a duplicate the server dedups on `clientId`.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
	let timer: number | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<typeof TIMED_OUT>((resolve) => {
				timer = window.setTimeout(() => resolve(TIMED_OUT), ms);
			}),
		]);
	} finally {
		if (timer !== undefined) window.clearTimeout(timer);
	}
}

/**
 * Posts user-initiated submissions (ratings, feedback) to our API through the
 * generated billing-API client.
 *
 * Its contract is that it never throws: every failure mode — offline, network,
 * timeout, non-2xx — comes back as a typed {@link SubmissionResult} the UI
 * renders as a retryable message. Transient failures are retried with
 * exponential backoff; a 4xx is the server's verdict and is returned as-is.
 */
export class SubmissionClient {
	constructor(
		private readonly context: SubmissionContext,
		private readonly options: SubmissionClientOptions = {}
	) {}

	async submit<K extends SubmissionKind>(kind: K, payload: SubmissionPayloads[K]): Promise<SubmissionResult> {
		try {
			return await this.attempt(kind, payload);
		} catch (error) {
			return fail("network", null, describeError(error));
		}
	}

	private async attempt<K extends SubmissionKind>(kind: K, payload: SubmissionPayloads[K]): Promise<SubmissionResult> {
		if (!this.online()) return fail("offline", null, OFFLINE_MESSAGE);

		const body = buildSubmissionBody(kind, payload, this.context);
		const maxAttempts = Math.max(1, this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
		const baseDelay = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

		let result: SubmissionResult = fail("network", null, NETWORK_MESSAGE);
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			result = await this.send(kind, body);
			if (result.ok || !isRetryable(result)) return result;
			if (attempt < maxAttempts) await delay(baseDelay * 2 ** (attempt - 1));
		}
		return result;
	}

	private async send<K extends SubmissionKind>(kind: K, body: SubmissionBodies[K]): Promise<SubmissionResult> {
		const route: SubmitRoute<K> = SUBMIT_ROUTES[kind];
		try {
			const response = await withTimeout(
				route(body, this.requestOptions()),
				this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS
			);
			if (response === TIMED_OUT) return fail("timeout", null, TIMEOUT_MESSAGE);
			if (response.status >= 200 && response.status < 300) return { ok: true, status: response.status };
			const detail = describeServerDetail(response.data);
			const because = detail === undefined ? "" : ` — ${detail}`;
			return fail(
				"server",
				response.status,
				`The server couldn't accept this (HTTP ${response.status})${because}. Please try again.`,
				detail
			);
		} catch (error) {
			return fail("network", null, describeError(error));
		}
	}

	private requestOptions(): BillingApiRequestOptions {
		const { baseUrl, transport } = this.options;
		return { ...(baseUrl !== undefined ? { baseUrl } : {}), ...(transport !== undefined ? { transport } : {}) };
	}

	/**
	 * Only a *definitive* offline reading short-circuits the request. `onLine`
	 * can be absent on a partial navigator, and an unknown state must still try.
	 */
	private online(): boolean {
		if (this.options.isOnline !== undefined) return this.options.isOnline();
		return typeof navigator === "undefined" || navigator.onLine;
	}
}
