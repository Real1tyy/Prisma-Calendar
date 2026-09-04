import type { App } from "obsidian";

/**
 * Vault-wide anonymous id every plugin's submissions share. Deliberately NOT the
 * license device id: that one is per-plugin and joins to an activation record
 * server-side, which would make an "anonymous" review trivially attributable.
 * This id exists only so the server can collapse duplicate submissions.
 */
export const ANONYMOUS_CLIENT_ID_STORAGE_KEY = "mvp-anonymous-client-id";

/** Read a stable id out of vault-local storage, generating and persisting one on first use. */
export function getOrCreateStoredId(app: App, storageKey: string): string {
	// `loadLocalStorage` is typed `any` by Obsidian — narrow before trusting it.
	const stored: unknown = app.loadLocalStorage(storageKey);
	if (typeof stored === "string" && stored) return stored;

	const id = crypto.randomUUID();
	app.saveLocalStorage(storageKey, id);
	return id;
}

export function getOrCreateAnonymousClientId(app: App): string {
	return getOrCreateStoredId(app, ANONYMOUS_CLIENT_ID_STORAGE_KEY);
}
