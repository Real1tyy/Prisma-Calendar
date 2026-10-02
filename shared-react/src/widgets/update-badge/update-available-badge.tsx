import { changelogSectionUrl, type ReleaseCheckService } from "@real1ty/obsidian-plugins";
import { memo, useCallback } from "react";

import { useScopedCls } from "../../contexts/theme-context";
import { useReleaseCheck } from "../../hooks/services/use-release-check";
import { openExternal } from "../../utils/open-external";

export interface UpdateAvailableBadgeProps {
	service: ReleaseCheckService | null | undefined;
	/**
	 * Optional override for the click target. Defaults to the release page URL
	 * returned by GitHub. Pass `null` to render a non-clickable pill.
	 */
	hrefOverride?: string | null;
	/**
	 * The plugin's published changelog page. When set, the badge opens the new
	 * version's own section (`?version=X.Y.Z`) — notes plus its release video —
	 * rather than the GitHub release. `hrefOverride` still wins.
	 */
	changelogUrl?: string;
	/** Optional label override. Defaults to "Update available". */
	label?: string;
	/** Optional test id for E2E assertions. */
	testId?: string;
}

export const UpdateAvailableBadge = memo(function UpdateAvailableBadge({
	service,
	hrefOverride,
	changelogUrl,
	label = "Update available",
	testId,
}: UpdateAvailableBadgeProps) {
	const cls = useScopedCls("update-available-badge");
	const notice = useReleaseCheck(service);

	const handleClick = useCallback(() => {
		if (!notice) return;
		const releaseNotes = changelogUrl !== undefined ? changelogSectionUrl(changelogUrl, notice.version) : notice.url;
		const url = hrefOverride ?? releaseNotes;
		if (!url) return;
		openExternal(url);
	}, [notice, hrefOverride, changelogUrl]);

	if (!notice) return null;

	const title = `Version ${notice.version} is available — click to view the release notes`;

	if (hrefOverride === null) {
		return (
			<span className={cls()} title={title} data-testid={testId}>
				{label}
			</span>
		);
	}

	return (
		<button
			type="button"
			className={cls()}
			onClick={handleClick}
			title={title}
			data-testid={testId}
			aria-label={`${label}: version ${notice.version}`}
		>
			<span className={cls("dot")} aria-hidden="true" />
			<span className={cls("label")}>{label}</span>
			<span className={cls("version")}>{`v${notice.version}`}</span>
		</button>
	);
});
