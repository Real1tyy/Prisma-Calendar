import {
	buildDebugBundle,
	getOrCreateAnonymousClientId,
	getPlatformId,
	SubmissionClient,
	type DebugBundle,
	type DebugEnvironment,
	type FeedbackSubmission,
	type LogService,
	type PluginSlug,
	type SubmissionContext,
	type SubmissionResult,
} from "@real1ty/obsidian-plugins";
import { apiVersion } from "obsidian";
import { memo, useCallback, useMemo } from "react";

import { useApp } from "../../contexts/app-context";
import { useCssPrefix } from "../../contexts/theme-context";
import { showFeedbackReactModal } from "../../modals/feedback-modal";
import { SettingItem } from "../../primitives/layout/setting-item";
import { testIdAttr } from "../../utils/test-id";

interface FeedbackActionProps {
	slug: PluginSlug;
	pluginDisplayName: string;
	pluginVersion: string;
	/** UTM-tracked privacy page, threaded through to the modal's disclaimer. */
	privacyUrl?: string | undefined;
	/** The plugin's log buffer. Absent means there is no debug context to offer. */
	logService?: LogService | undefined;
	fieldTestId?: string | undefined;
	buttonTestId?: string | undefined;
}

/**
 * The universal "send feedback" row on the General surface — bug reports,
 * feature requests, questions and general notes, all through one route.
 *
 * Deliberately anonymous: unlike a review, a report carries no license key, so
 * the payload is the description, the environment, and whatever the user chose
 * to attach ([[spec-in-app-feedback-and-bug-reports]]).
 */
export const FeedbackAction = memo(function FeedbackAction({
	slug,
	pluginDisplayName,
	pluginVersion,
	privacyUrl,
	logService,
	fieldTestId,
	buttonTestId,
}: FeedbackActionProps) {
	const app = useApp();
	const cssPrefix = useCssPrefix();

	const environment: DebugEnvironment = useMemo(
		() => ({ pluginId: slug, pluginVersion, obsidianVersion: apiVersion, platform: getPlatformId() }),
		[slug, pluginVersion]
	);

	const captureDebugBundle = useCallback((): DebugBundle => {
		// A user gesture, so reading the wall clock here is correct — the bundle
		// is a snapshot of "now", not an automatic write.
		return buildDebugBundle({ entries: logService?.snapshot() ?? [], environment, now: Date.now() });
	}, [environment, logService]);

	const submit = useCallback(
		async (submission: FeedbackSubmission): Promise<SubmissionResult> => {
			const context: SubmissionContext = { ...environment, clientId: getOrCreateAnonymousClientId(app) };
			return new SubmissionClient(context).submit("feedback", submission);
		},
		[app, environment]
	);

	const openFeedback = useCallback(() => {
		showFeedbackReactModal(app, {
			cssPrefix,
			pluginDisplayName,
			privacyUrl,
			...(logService !== undefined ? { captureDebugBundle } : {}),
			submit,
		});
	}, [app, captureDebugBundle, cssPrefix, logService, pluginDisplayName, privacyUrl, submit]);

	return (
		<SettingItem
			name="Something broken, missing, or unclear?"
			description="Report a bug, request a feature, or ask a question without leaving Obsidian. Bug reports can carry the diagnostic context that makes them fixable."
			testId={fieldTestId}
		>
			<button type="button" onClick={openFeedback} {...testIdAttr(buttonTestId)}>
				Send feedback
			</button>
		</SettingItem>
	);
});
