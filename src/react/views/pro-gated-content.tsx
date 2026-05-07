import { useObservable } from "@real1ty-obsidian-plugins-react";
import { memo, type ReactNode, useEffect, useRef } from "react";

import { renderProUpgradeBanner } from "../../components/settings/pro-upgrade-banner";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ProFeatureKey } from "../../core/pro-feature-previews";

interface ProGatedContentProps {
	bundle: CalendarBundle;
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey;
	children: ReactNode;
}

export const ProGatedContent = memo(function ProGatedContent({
	bundle,
	featureName,
	description,
	previewKey,
	children,
}: ProGatedContentProps) {
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

	return <div ref={bannerRef} data-testid="prisma-pro-gated" />;
});
