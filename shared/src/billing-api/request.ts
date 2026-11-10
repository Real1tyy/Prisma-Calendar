import { resolveApiBaseUrl } from "./base-url";
import { requestUrlTransport, type HttpTransport } from "./transport";

/**
 * Per-call options every generated billing-API function accepts as its last
 * argument. `headers` is the auth seam: a route that needs `Authorization`
 * passes it here, and it reaches the wire unchanged.
 */
export interface BillingApiRequestOptions {
	baseUrl?: string;
	transport?: HttpTransport;
	headers?: Record<string, string>;
}

/** What Orval hands the mutator: the caller's options plus the method, headers and body it built. */
export type BillingApiRequestInit = RequestInit & {
	baseUrl?: string;
	transport?: HttpTransport;
};

/**
 * The single transport every generated billing-API function calls
 * ([[spec-typed-billing-api-client-generated-from-the-published-openapi-spec]]).
 *
 * It never throws on an HTTP status. The result is the generated, status-discriminated
 * `{ status, data, headers }` union, so a caller narrows on `status` instead of catching.
 * A transport failure (offline, DNS) still rejects; that is the caller's to classify.
 *
 * `data` is the parsed JSON body. A body that isn't JSON (a proxy's HTML error page,
 * a plain-text 502) arrives as its raw text so it can still be shown to the user, and
 * an empty body arrives as `undefined`. The generated types describe what the server
 * promises; on a non-2xx path, treat `data` as evidence, not as a guarantee.
 */
export async function billingApiRequest<T>(url: string, init: BillingApiRequestInit): Promise<T> {
	const transport = init.transport ?? requestUrlTransport;
	const response = await transport({
		url: new URL(url, resolveApiBaseUrl(init.baseUrl)).toString(),
		method: init.method ?? "GET",
		headers: flattenHeaders(init.headers),
		...(typeof init.body === "string" ? { body: init.body } : {}),
	});
	return {
		status: response.status,
		data: parseBody(response.body),
		headers: new Headers(response.headers ?? {}),
	} as T;
}

function flattenHeaders(headers: BillingApiRequestInit["headers"]): Record<string, string> {
	if (headers === undefined) return {};
	if (headers instanceof Headers) return Object.fromEntries(headers.entries());
	if (Array.isArray(headers)) return Object.fromEntries(headers);
	// Orval's own header merge can hand over a repeated header as an array.
	const flat: Record<string, string> = {};
	for (const [name, value] of Object.entries(headers as Record<string, string | readonly string[]>)) {
		flat[name] = typeof value === "string" ? value : value.join(", ");
	}
	return flat;
}

function parseBody(body: string | undefined): unknown {
	if (body === undefined || body.trim() === "") return undefined;
	try {
		return JSON.parse(body) as unknown;
	} catch {
		return body;
	}
}
