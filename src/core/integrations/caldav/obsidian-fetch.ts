import { type RequestUrlResponse, requestUrl } from "obsidian";

const initialFetch = globalThis.fetch;

/**
 * Response wrapper that makes Obsidian's RequestUrlResponse compatible with the Fetch API Response interface.
 * This allows libraries like tsdav that expect standard fetch to work with Obsidian's requestUrl.
 */
class ObsidianResponse {
	readonly body: ReadableStream<Uint8Array> | null = null;
	readonly bodyUsed = false;
	readonly redirected = false;
	readonly type: ResponseType = "basic";
	readonly url: string;

	constructor(
		private res: RequestUrlResponse,
		requestUrl: string
	) {
		this.url = requestUrl;
	}

	get status(): number {
		return this.res.status;
	}

	get statusText(): string {
		return this.res.status >= 200 && this.res.status < 300 ? "OK" : "Error";
	}

	get ok(): boolean {
		return this.res.status >= 200 && this.res.status < 300;
	}

	get headers(): Headers {
		return new Headers(this.res.headers);
	}

	text(): Promise<string> {
		return Promise.resolve(this.res.text);
	}

	json(): Promise<unknown> {
		return Promise.resolve(JSON.parse(this.res.text));
	}

	arrayBuffer(): Promise<ArrayBuffer> {
		return Promise.resolve(this.res.arrayBuffer);
	}

	blob(): Promise<Blob> {
		return Promise.resolve(new Blob([this.res.arrayBuffer]));
	}

	formData(): Promise<FormData> {
		return Promise.reject(new Error("formData() not supported"));
	}

	clone(): ObsidianResponse {
		return new ObsidianResponse(this.res, this.url);
	}

	bytes(): Promise<Uint8Array> {
		return Promise.resolve(new Uint8Array(this.res.arrayBuffer));
	}
}

/**
 * Fetch implementation using Obsidian's requestUrl API.
 * This bypasses CORS restrictions because requestUrl makes requests from
 * the Node.js/main process side rather than the browser renderer.
 */
async function obsidianFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
	const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

	const parsed = (() => {
		try {
			return new URL(url);
		} catch {
			return null;
		}
	})();

	const protocol = parsed?.protocol ?? "";
	if (protocol && protocol !== "http:" && protocol !== "https:") {
		const fallbackFetch = originalFetch ?? initialFetch;
		return fallbackFetch(input as never, init as never);
	}

	// Convert Headers to plain object if needed
	let headers: Record<string, string> | undefined;
	if (init?.headers) {
		if (init.headers instanceof Headers) {
			headers = {};
			init.headers.forEach((value, key) => {
				headers![key] = value;
			});
		} else if (Array.isArray(init.headers)) {
			headers = {};
			for (const [key, value] of init.headers) {
				headers[key] = value;
			}
		} else {
			headers = init.headers;
		}
	}

	// Convert body to string if needed
	let body: string | undefined;
	if (init?.body) {
		if (typeof init.body === "string") {
			body = init.body;
		} else if (init.body instanceof ArrayBuffer) {
			body = new TextDecoder().decode(init.body);
		} else if (init.body instanceof Uint8Array) {
			body = new TextDecoder().decode(init.body);
		}
	}

	const res = await requestUrl({
		url,
		method: init?.method ?? "GET",
		headers,
		body,
		throw: false,
	});

	return new ObsidianResponse(res, url) as unknown as Response;
}

let originalFetch: typeof globalThis.fetch | undefined;

/**
 * Patches globalThis.fetch with Obsidian's fetch implementation.
 * Call this before importing/using libraries that use fetch (like tsdav).
 */
export function patchGlobalFetch(): () => void {
	const prev = globalThis.fetch;
	if (!originalFetch) {
		originalFetch = prev;
	}

	globalThis.fetch = obsidianFetch as typeof globalThis.fetch;

	return () => {
		globalThis.fetch = prev;
	};
}
