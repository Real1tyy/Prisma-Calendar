import { useEscapeKey } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

interface StickyBannerProps {
	message: string;
	onCancel: () => void;
}

export const StickyBanner = memo(function StickyBanner({ message, onCancel }: StickyBannerProps) {
	useEscapeKey(onCancel);

	return (
		<div className="prisma-prereq-selection-banner" data-testid="prisma-sticky-banner">
			<div className="prisma-prereq-selection-banner-text">{message}</div>
			<button className="prisma-prereq-selection-btn" onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
});
