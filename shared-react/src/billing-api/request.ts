import {
	billingApiRequest as sendBillingApiRequest,
	type BillingApiRequestInit,
} from "@real1ty/obsidian-plugins/billing-api";

/**
 * A non-2xx answer from the billing API, thrown so TanStack Query reports it as
 * the query's `error`. `body` is the server's parsed refusal, typed by the
 * generated hook as the union of that route's declared error bodies.
 */
export class BillingApiError<Body = unknown> extends Error {
	constructor(
		readonly status: number,
		readonly body: Body
	) {
		super(`Billing API answered HTTP ${status}`);
		this.name = "BillingApiError";
	}
}

/** Orval types each hook's `error` through this alias. */
export type ErrorType<Body> = BillingApiError<Body>;

/**
 * The mutator behind the generated TanStack Query hooks
 * ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).
 *
 * Same transport as the imperative client in `@real1ty/obsidian-plugins` —
 * Obsidian's `requestUrl`, the same base URL and E2E override — but where that
 * client hands back every status as a value, a hook needs a failure to throw.
 */
export async function billingApiRequest<T>(url: string, init: BillingApiRequestInit): Promise<T> {
	const response = await sendBillingApiRequest<{ status: number; data: unknown }>(url, init);
	if (response.status < 200 || response.status >= 300) throw new BillingApiError(response.status, response.data);
	return response.data as T;
}
