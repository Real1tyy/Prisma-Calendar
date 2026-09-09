import type { LicenseManager, LogService, PluginSlug } from "@real1ty/obsidian-plugins";
import { memo, useCallback } from "react";

import { useApp } from "../../contexts/app-context";
import { useCssPrefix } from "../../contexts/theme-context";
import { openFeedbackModal } from "../../modals/open-feedback-modal";
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
	/**
	 * Present whenever the plugin configures licensing — regardless of whether
	 * the License card itself is shown. A licensed report can carry the key so
	 * it can be attributed to the customer who sent it.
	 */
	licenseManager?: LicenseManager | undefined;
	fieldTestId?: string | undefined;
	buttonTestId?: string | undefined;
}

/**
 * The universal "send feedback" row on the General surface — bug reports,
 * feature requests and general notes, all through one route.
 *
 * Deliberately thin: the wiring lives in `openFeedbackModal` so this row and the
 * plugin's hotkey-bindable command open exactly the same modal
 * ([[spec-in-app-feedback-and-bug-reports]]).
 */
export const FeedbackAction = memo(function FeedbackAction({
	slug,
	pluginDisplayName,
	pluginVersion,
	privacyUrl,
	logService,
	licenseManager,
	fieldTestId,
	buttonTestId,
}: FeedbackActionProps) {
	const app = useApp();
	const cssPrefix = useCssPrefix();

	const openFeedback = useCallback(() => {
		void openFeedbackModal({
			app,
			slug,
			pluginDisplayName,
			pluginVersion,
			cssPrefix,
			privacyUrl,
			logService,
			licenseManager,
		});
	}, [app, cssPrefix, licenseManager, logService, pluginDisplayName, pluginVersion, privacyUrl, slug]);

	return (
		<SettingItem
			name="Something broken, or something missing?"
			description="Report a bug or request a feature without leaving Obsidian. Bug reports can carry the diagnostic context that makes them fixable."
			testId={fieldTestId}
		>
			<button type="button" onClick={openFeedback} {...testIdAttr(buttonTestId)}>
				Send feedback
			</button>
		</SettingItem>
	);
});
