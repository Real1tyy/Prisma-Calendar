import { tid } from "../../constants";
import { useObservable } from "@real1ty-obsidian-plugins-react";
import { memo, type ReactNode, useEffect, useRef } from "react";

import { renderProUpgradeBanner } from "../../components/settings/pro-upgrade-banner";
import type { ProFeatureKey } from "../../core/pro-feature-previews";
import { useBundle } from "../contexts/bundle-context";

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
	const bannerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = bannerRef.current;
		if (isPro || !el) return;
		el.empty();
		renderProUpgradeBanner(el, featureName, description, previewKey);
		return () => {
			el.empty();
		};
	}, [isPro, featureName, description, previewKey]);

	if (isPro) return <>{children}</>;

	return <div ref={bannerRef} data-testid={tid("pro-gated")} />;
});
