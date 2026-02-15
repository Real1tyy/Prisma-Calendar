import type { App } from "obsidian";

/**
 * Manages secure storage of sensitive data using Obsidian's SecretStorage API.
 * Secrets are stored centrally and can be shared across plugins.
 */
export class SecretManager {
	constructor(private app: App) {}

	getSecret(secretName: string): string {
		return this.app.secretStorage.getSecret(secretName) ?? "";
	}
}
