import { requestUrl } from "obsidian";

import { isE2E } from "../../utils/e2e";
import {
	SUBMISSION_API_BASE_URL,
	SUBMISSION_ENDPOINTS,
	type SubmissionClientOptions,
	type SubmissionContext,
	type SubmissionError,
	type SubmissionFailure,
	type SubmissionKind,
	type SubmissionPayloads,
	type SubmissionRequest,
	type SubmissionResult,
	type SubmissionTransport,
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
 * The wire body is assembled from these explicit lists rather than spread from
 * the caller's objects, so a future payload type cannot widen it by accident:
 * anything not named here does not leave the device. The list is the contract
 * the user-facing docs describe — extending it is a privacy decision, not a
 * refactor ([[spec-in-app-rating-and-review]]).
 */
const SUBMISSION_PAYLOAD_FIELDS: { readonly [K in SubmissionKind]: readonly (keyof SubmissionPayloads[K])[] } = {
	review: ["rating", "text"],
	feedback: ["type", "text", "debugBundle", "screenshots"],
};

const SUBMISSION_CONTEXT_FIELDS = [
	"pluginId",
	"pluginVersion",
	"obsidianVersion",
	"platform",
	"clientId",
	"licenseKey",
] as const;

const TIMED_OUT = Symbol("submission-timed-out");

export function buildSubmissionBody<K extends SubmissionKind>(
	kind: K,
	payload: SubmissionPayloads[K],
	context: SubmissionContext
): Record<string, unknown> {
	const body: Record<string, unknown> = { kind };
	for (const field of SUBMISSION_CONTEXT_FIELDS) {
		const value = context[field];
		if (value !== undefined) body[field] = value;
	}
	for (const field of SUBMISSION_PAYLOAD_FIELDS[kind]) {
		const value = payload[field];
		if (value !== undefined) body[field as string] = value;
	}
	return body;
}

/**
 * Base URL resolution. The E2E override lets a spec point the client at a
 * loopback stub server — `requestUrl` is served by Electron's main process, so
 * Playwright route interception can't reach it. Inert outside the harness,
 * exactly like the license manager's `__setProForTesting` seam.
 */
function resolveBaseUrl(explicit: string | undefined): string {
	if (explicit !== undefined) return explicit;
	if (isE2E()) {
		const override: unknown = (window as unknown as { __submissionApiBaseUrl?: unknown }).__submissionApiBaseUrl;
		if (typeof override === "string" && override) return override;
	}
	return SUBMISSION_API_BASE_URL;
}

const defaultTransport: SubmissionTransport = async (request) => {
	const response = await requestUrl({ ...request, throw: false });
	return { status: response.status };
};

function fail(failure: SubmissionFailure, status: number | null, message: string): SubmissionError {
	return { ok: false, failure, status, message };
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
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A timed-out request is abandoned, not cancelled — `requestUrl` exposes no
 * abort signal. The response is simply ignored, so a late 200 for a submission
 * the user already retried is a duplicate the server dedups on `clientId`.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<typeof TIMED_OUT>((resolve) => {
				timer = setTimeout(() => resolve(TIMED_OUT), ms);
			}),
		]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

/**
 * Posts user-initiated submissions (ratings, and later feedback) to our API.
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

		const request: SubmissionRequest = {
			url: new URL(SUBMISSION_ENDPOINTS[kind], resolveBaseUrl(this.options.baseUrl)).toString(),
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(buildSubmissionBody(kind, payload, this.context)),
		};

		const maxAttempts = Math.max(1, this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
		const baseDelay = this.options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

		let result: SubmissionResult = fail("network", null, NETWORK_MESSAGE);
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			result = await this.send(request);
			if (result.ok || !isRetryable(result)) return result;
			if (attempt < maxAttempts) await delay(baseDelay * 2 ** (attempt - 1));
		}
		return result;
	}

	private async send(request: SubmissionRequest): Promise<SubmissionResult> {
		const transport = this.options.transport ?? defaultTransport;
		try {
			const response = await withTimeout(transport(request), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
			if (response === TIMED_OUT) return fail("timeout", null, TIMEOUT_MESSAGE);
			if (response.status >= 200 && response.status < 300) return { ok: true, status: response.status };
			return fail(
				"server",
				response.status,
				`The server couldn't accept this (HTTP ${response.status}). Please try again.`
			);
		} catch (error) {
			return fail("network", null, describeError(error));
		}
	}

	/**
	 * Only a *definitive* offline reading short-circuits the request. `onLine`
	 * can be absent on a partial navigator, and an unknown state must still try.
	 */
	private online(): boolean {
		if (this.options.isOnline !== undefined) return this.options.isOnline();
		return typeof navigator === "undefined" || navigator.onLine !== false;
	}
}
