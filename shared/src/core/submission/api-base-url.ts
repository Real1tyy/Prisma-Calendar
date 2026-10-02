import { isE2E } from "../../utils/e2e";
import { SUBMISSION_API_BASE_URL } from "./types";

/**
 * Base URL of our API, shared by submissions and the release-info lookups. The
 * E2E override lets a spec point every client at a loopback stub server —
 * `requestUrl` is served by Electron's main process, so Playwright route
 * interception can't reach it. Inert outside the harness, exactly like the
 * license manager's `__setProForTesting` seam.
 */
export function resolveApiBaseUrl(explicit?: string): string {
	if (explicit !== undefined) return explicit;
	if (isE2E()) {
		const override: unknown = (window as unknown as { __submissionApiBaseUrl?: unknown }).__submissionApiBaseUrl;
		if (typeof override === "string" && override) return override;
	}
	return SUBMISSION_API_BASE_URL;
}
