import { requestUrl, type RequestUrlResponse } from "obsidian";

// Captured lazily so importing this module from a node-environment test
// runner (where `window` is undefined at module-load) doesn't crash before
// the test setup polyfill installs the `window = globalThis` alias. Runtime
// call sites below use `window.fetch` directly — they only execute from
// inside Obsidian, where `window` is always defined.
const initialFetch: typeof fetch | undefined = typeof window !== "undefined" ? window.fetch : undefined;

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
		const fallbackFetch = originalFetch ?? initialFetch ?? window.fetch;
		return fallbackFetch(input, init);
	}

	// Convert Headers to plain object if needed
	let headers: Record<string, string> | undefined;
	if (init?.headers instanceof Headers) {
		const obj: Record<string, string> = {};
		init.headers.forEach((value, key) => {
			obj[key] = value;
		});
		headers = obj;
	} else if (Array.isArray(init?.headers)) {
		headers = Object.fromEntries(init.headers);
	} else if (init?.headers) {
		headers = init.headers;
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
		...(headers ? { headers } : {}),
		...(body ? { body } : {}),
		throw: false,
	});

	return new ObsidianResponse(res, url) as unknown as Response;
}

let originalFetch: typeof fetch | undefined;

/**
 * Patches globalThis.fetch with Obsidian's fetch implementation.
 * Call this before importing/using libraries that use fetch (like tsdav).
 */
export function patchGlobalFetch(): () => void {
	const prev = window.fetch;
	if (!originalFetch) {
		originalFetch = prev;
	}

	window.fetch = obsidianFetch;

	return () => {
		window.fetch = prev;
	};
}
