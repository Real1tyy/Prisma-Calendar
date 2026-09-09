import {
	buildDebugBundle,
	getOrCreateAnonymousClientId,
	getPlatformId,
	SubmissionClient,
	type DebugBundle,
	type DebugEnvironment,
	type FeedbackSubmission,
	type LicenseManager,
	type LogService,
	type PluginSlug,
	type SubmissionContext,
	type SubmissionResult,
} from "@real1ty/obsidian-plugins";
import { apiVersion, type App } from "obsidian";

import { getAttributableLicenseKey } from "../utils/license-attribution";
import { showFeedbackReactModal } from "./feedback-modal";

export interface OpenFeedbackOptions {
	app: App;
	slug: PluginSlug;
	pluginDisplayName: string;
	pluginVersion: string;
	/** Trailing-dash CSS prefix, e.g. `"prisma-"`. */
	cssPrefix: string;
	/** The plugin's privacy page, already UTM-tracked. Omitted ⇒ no disclaimer. */
	privacyUrl?: string | undefined;
	/** The plugin's log buffer. Omitted ⇒ no debug context to offer, so no checkbox. */
	logService?: LogService | undefined;
	/** Present whenever the plugin configures licensing, so a Pro report can be attributed. */
	licenseManager?: LicenseManager | undefined;
}

/**
 * Opens the feedback modal, fully wired: debug bundle from the plugin's own log
 * buffer, license attribution for a verified Pro install, submission through the
 * shared client.
 *
 * Lives apart from the settings row because there are two entry points into the
 * same flow — the General section's button and a command the user can bind a
 * hotkey to — and the wiring must not differ between them
 * ([[spec-in-app-feedback-and-bug-reports]]).
 *
 * Async because the license key is read from secret storage before the modal
 * opens; it decides whether the attribution checkbox is offered at all.
 */
export async function openFeedbackModal({
	app,
	slug,
	pluginDisplayName,
	pluginVersion,
	cssPrefix,
	privacyUrl,
	logService,
	licenseManager,
}: OpenFeedbackOptions): Promise<void> {
	const environment: DebugEnvironment = {
		pluginId: slug,
		pluginVersion,
		obsidianVersion: apiVersion,
		platform: getPlatformId(),
	};

	// A user gesture, so reading the wall clock here is correct — the bundle is a
	// snapshot of "now", not an automatic write.
	const captureDebugBundle = (): DebugBundle =>
		buildDebugBundle({ entries: logService?.snapshot() ?? [], environment, now: Date.now() });

	const submit = async (submission: FeedbackSubmission, includeLicenseKey: boolean): Promise<SubmissionResult> => {
		// Re-check entitlement and the secret at send time. If either changed
		// while the modal was open, the key stays on the device.
		const licenseKey = includeLicenseKey ? await getAttributableLicenseKey(licenseManager) : null;
		const context: SubmissionContext = {
			...environment,
			clientId: getOrCreateAnonymousClientId(app),
			...(licenseKey !== null ? { licenseKey } : {}),
		};
		return new SubmissionClient(context).submit("feedback", submission);
	};

	const licenseKey = await getAttributableLicenseKey(licenseManager);

	showFeedbackReactModal(app, {
		cssPrefix,
		pluginDisplayName,
		privacyUrl,
		licenseAttributionAvailable: licenseKey !== null,
		...(logService !== undefined ? { captureDebugBundle } : {}),
		submit,
	});
}
