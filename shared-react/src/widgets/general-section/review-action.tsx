import {
	getOrCreateAnonymousClientId,
	getPlatformId,
	SubmissionClient,
	type LicenseManager,
	type PluginSlug,
	type ReviewSubmission,
	type SubmissionContext,
	type SubmissionResult,
} from "@real1ty/obsidian-plugins";
import { apiVersion } from "obsidian";
import { memo, useCallback } from "react";

import { useApp } from "../../contexts/app-context";
import { useCssPrefix } from "../../contexts/theme-context";
import { showReviewReactModal } from "../../modals/review-modal";
import { SettingItem } from "../../primitives/layout/setting-item";
import { testIdAttr } from "../../utils/test-id";

interface ReviewActionProps {
	slug: PluginSlug;
	pluginDisplayName: string;
	pluginVersion: string;
	/**
	 * Present whenever the plugin configures licensing — regardless of whether
	 * the License card itself is shown. A licensed submission carries the key so
	 * it can be attributed to the customer who sent it.
	 */
	licenseManager?: LicenseManager | undefined;
	fieldTestId?: string | undefined;
	buttonTestId?: string | undefined;
}

/**
 * The universal "leave a rating" row on the General surface. Deliberately
 * button-initiated with no timed prompt — a nag would cost more goodwill than
 * the ratings are worth ([[spec-in-app-rating-and-review]]).
 */
export const ReviewAction = memo(function ReviewAction({
	slug,
	pluginDisplayName,
	pluginVersion,
	licenseManager,
	fieldTestId,
	buttonTestId,
}: ReviewActionProps) {
	const app = useApp();
	const cssPrefix = useCssPrefix();

	// Built per submission rather than per click: reading the key goes through
	// Obsidian's async secret storage, and a key activated while the modal is
	// open should still land on the submission.
	const submit = useCallback(
		async (submission: ReviewSubmission): Promise<SubmissionResult> => {
			const licenseKey = (await licenseManager?.getLicenseKey()) ?? null;
			const context: SubmissionContext = {
				pluginId: slug,
				pluginVersion,
				obsidianVersion: apiVersion,
				platform: getPlatformId(),
				clientId: getOrCreateAnonymousClientId(app),
				...(licenseKey !== null ? { licenseKey } : {}),
			};
			return new SubmissionClient(context).submit("review", submission);
		},
		[app, slug, pluginVersion, licenseManager]
	);

	const openReview = useCallback(() => {
		showReviewReactModal(app, { cssPrefix, pluginDisplayName, submit });
	}, [app, cssPrefix, pluginDisplayName, submit]);

	return (
		<SettingItem
			name={`Enjoying ${pluginDisplayName}?`}
			description="Leave a star rating and a few words. It takes ten seconds and it genuinely shapes what gets built next."
			testId={fieldTestId}
		>
			<button type="button" className="mod-cta" onClick={openReview} {...testIdAttr(buttonTestId)}>
				Review
			</button>
		</SettingItem>
	);
});
