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

async function getAttributableLicenseKey(licenseManager: LicenseManager | undefined): Promise<string | null> {
	if (licenseManager?.isPro !== true) return null;
	try {
		return (await licenseManager.getLicenseKey()) || null;
	} catch {
		// Secret storage must never be able to block the universal Review flow.
		// A failed read degrades to an anonymous submission without exposing the
		// secret name, key, or storage error.
		return null;
	}
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

	const submit = useCallback(
		async (submission: ReviewSubmission, includeLicenseKey: boolean): Promise<SubmissionResult> => {
			// Re-check entitlement and the secret at send time. If either changed
			// while the modal was open, the key stays on the device.
			const licenseKey = includeLicenseKey ? await getAttributableLicenseKey(licenseManager) : null;
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

	const openReview = useCallback(async () => {
		// Reading the secret is asynchronous. The opt-in only appears when both
		// the verified entitlement and an entered key exist.
		const licenseKey = await getAttributableLicenseKey(licenseManager);
		showReviewReactModal(app, {
			cssPrefix,
			pluginDisplayName,
			licenseAttributionAvailable: licenseKey !== null,
			submit,
		});
	}, [app, cssPrefix, licenseManager, pluginDisplayName, submit]);

	return (
		<SettingItem
			name={`Enjoying ${pluginDisplayName}?`}
			description="Leave a star rating and a few words. It takes ten seconds and it genuinely shapes what gets built next."
			testId={fieldTestId}
		>
			<button type="button" className="mod-cta" onClick={() => void openReview()} {...testIdAttr(buttonTestId)}>
				Review
			</button>
		</SettingItem>
	);
});
