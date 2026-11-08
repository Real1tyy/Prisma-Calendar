import { buildUtmUrl } from "@real1ty/obsidian-plugins";
import { PreviewableImage } from "@real1ty/obsidian-plugins-react";
import { memo } from "react";

import { cls, docsUrl, tid } from "../../constants";
import { PRO_PURCHASE_URL } from "../../core/license";
import {
	getFeatureDocUrl,
	getFeaturePreviewSrc,
	getFeaturePurchaseUrl,
	type ProFeatureKey,
} from "../../core/pro-feature-previews";

const FREE_VS_PRO_URL = docsUrl("/features/free-vs-pro");

interface ProUpgradeBannerProps {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey | undefined;
}

export const ProUpgradeBanner = memo(function ProUpgradeBanner({
	featureName,
	description,
	previewKey,
}: ProUpgradeBannerProps) {
	const purchaseUrl = previewKey ? getFeaturePurchaseUrl(previewKey) : PRO_PURCHASE_URL;
	const previewSrc = previewKey ? getFeaturePreviewSrc(previewKey) : null;
	const docUrl = previewKey ? getFeatureDocUrl(previewKey) : null;
	const learnMoreUrl = buildUtmUrl(FREE_VS_PRO_URL, "prisma-calendar", "plugin", "pro_gate", "learn_more");

	return (
		<div className={cls("pro-upgrade-banner")} {...(previewKey ? { "data-testid": tid("pro-gate", previewKey) } : {})}>
			{previewSrc && (
				<div className={cls("pro-upgrade-preview")}>
					<PreviewableImage
						src={previewSrc}
						label={`${featureName} preview`}
						imageClassName={cls("pro-upgrade-preview-img")}
						testId={tid("pro-upgrade-preview")}
						loading="lazy"
					/>
				</div>
			)}
			<span className={cls("pro-upgrade-badge")}>PRO</span>
			<h3 className={cls("pro-upgrade-title")}>{featureName}</h3>
			<p className={cls("pro-upgrade-description")}>{description}</p>
			<p className={cls("pro-upgrade-trial")}>
				Try every Pro feature with a 30-day free trial &mdash; cancel anytime.{" "}
				<a className={cls("pro-upgrade-learn-more")} href={learnMoreUrl} target="_blank" rel="noopener noreferrer">
					Learn more about Pro
				</a>
			</p>
			<div className={cls("pro-upgrade-actions")}>
				{docUrl && (
					<a className={cls("pro-upgrade-doc-link")} href={docUrl} target="_blank" rel="noopener noreferrer">
						View full feature documentation &rarr;
					</a>
				)}
				<a className={cls("pro-upgrade-link")} href={purchaseUrl} target="_blank" rel="noopener noreferrer">
					Start your free trial
				</a>
			</div>
		</div>
	);
});
