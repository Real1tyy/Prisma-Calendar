import { requestUrl } from "obsidian";

export interface HttpRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
	body?: string;
}

export interface HttpResponse {
	status: number;
	/**
	 * Raw response body. Carried for the failure path too: a 4xx from our API
	 * names the field it rejected, and dropping it leaves the user staring at a
	 * bare status code with nothing to act on.
	 */
	body?: string;
	headers?: Record<string, string>;
}

/** Injectable HTTP seam: tests pass a fake, production uses {@link requestUrlTransport}. */
export type HttpTransport = (request: HttpRequest) => Promise<HttpResponse>;

/**
 * Obsidian's `requestUrl`: no CORS, works on mobile. `throw: false` keeps a 4xx
 * a value rather than an exception, so the caller decides what a status means.
 */
export const requestUrlTransport: HttpTransport = async (request) => {
	const response = await requestUrl({ ...request, throw: false });
	return { status: response.status, headers: response.headers, ...readBody(response) };
};

/**
 * `text` is a getter that decodes the body on access and throws on anything it
 * cannot read. A body we failed to read is a missing explanation, never a
 * failed request, so the throw is swallowed and the status stands alone.
 */
function readBody(response: { text?: string }): { body?: string } {
	try {
		const text = response.text;
		return typeof text === "string" ? { body: text } : {};
	} catch {
		return {};
	}
}
