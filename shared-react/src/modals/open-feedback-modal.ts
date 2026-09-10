import {
	buildDebugBundle,
	createScreenCapture,
	createWindowCapture,
	FEEDBACK_MAX_SCREENSHOT_BYTES,
	getElectronWindow,
	getOrCreateAnonymousClientId,
	getPlatformId,
	SubmissionClient,
	type DebugBundle,
	type DebugEnvironment,
	type FeedbackSubmission,
	type LicenseManager,
	type LogService,
	type PluginSlug,
	type ScreenCapture,
	type SubmissionContext,
	type SubmissionResult,
} from "@real1ty/obsidian-plugins";
import { apiVersion, Notice, type App } from "obsidian";

import { getAttributableLicenseKey } from "../utils/license-attribution";
import { showCaptureBar } from "./capture-bar";
import { showFeedbackReactModal, type FeedbackFormState } from "./feedback-modal";
import { FeedbackSession } from "./feedback-session";

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
 * Builds the feedback flow, fully wired: debug bundle from the plugin's own log
 * buffer, license attribution for a verified Pro install, submission through the
 * shared client, and — on desktop — window capture behind the minimize/capture
 * loop.
 *
 * Lives apart from the settings row because there are two entry points into the
 * same flow — the General section's button and a command the user can bind a
 * hotkey to — and the wiring must not differ between them
 * ([[spec-in-app-feedback-and-bug-reports]]).
 *
 * The session is cheap and holds no state of its own — the minimized report
 * lives in the shared slot — so a command can build one per invocation and
 * still find the report the last one minimized.
 */
export function createFeedbackSession({
	app,
	slug,
	pluginDisplayName,
	pluginVersion,
	cssPrefix,
	privacyUrl,
	logService,
	licenseManager,
}: OpenFeedbackOptions): FeedbackSession {
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

	// Read once per modal open rather than per session: entitlement can change
	// while a report is minimized, and the checkbox must reflect what is true now.
	const showModal = async (props: {
		initialState: Partial<FeedbackFormState>;
		onMinimize: (state: FeedbackFormState) => void;
		onCapture: ((state: FeedbackFormState) => void) | undefined;
	}) => {
		const licenseKey = await getAttributableLicenseKey(licenseManager);
		return showFeedbackReactModal(app, {
			cssPrefix,
			pluginDisplayName,
			privacyUrl,
			licenseAttributionAvailable: licenseKey !== null,
			...(logService !== undefined ? { captureDebugBundle } : {}),
			submit,
			initialState: props.initialState,
			onMinimize: props.onMinimize,
			onCapture: props.onCapture,
		});
	};

	return new FeedbackSession({
		showModal,
		showCaptureBar: ({ onCapture, onCancel }) => showCaptureBar({ cssPrefix, onCapture, onCancel }),
		capture: buildScreenCapture(),
		notify: (message) => {
			new Notice(message);
		},
	});
}

/** Null on mobile and in every non-Electron runtime, which is what hides the capture affordances. */
function buildScreenCapture(): ScreenCapture | null {
	if (getElectronWindow() === null) return null;
	return createScreenCapture(createWindowCapture(getElectronWindow, { maxBytes: FEEDBACK_MAX_SCREENSHOT_BYTES }));
}

/**
 * Opens "Send feedback" — the General-section button and the command of the same
 * name land in the same place, on the general type. A bug report is its own
 * entry point (`Report a bug`), so the words on the button now mean one thing
 * wherever they are clicked; the user can still switch type in the form.
 */
export async function openFeedbackModal(options: OpenFeedbackOptions): Promise<void> {
	await createFeedbackSession(options).open({ type: "general", includeDebug: false });
}
