import { useObservable } from "@real1ty-obsidian-plugins-react";
import { memo, type ReactNode } from "react";

import { tid } from "../../constants";
import type { ProFeatureKey } from "../../core/pro-feature-previews";
import { useBundle } from "../contexts/bundle-context";
import { ProUpgradeBanner } from "../settings/pro-upgrade-banner";

interface ProGatedContentProps {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey;
	children: ReactNode;
}

export const ProGatedContent = memo(function ProGatedContent({
	featureName,
	description,
	previewKey,
	children,
}: ProGatedContentProps) {
	const bundle = useBundle();
	const isPro = useObservable(bundle.plugin.licenseManager.isPro$, bundle.plugin.licenseManager.isPro);

	if (isPro) return children;

	return (
		<div data-testid={tid("pro-gated")}>
			<ProUpgradeBanner featureName={featureName} description={description} previewKey={previewKey} />
		</div>
	);
});
