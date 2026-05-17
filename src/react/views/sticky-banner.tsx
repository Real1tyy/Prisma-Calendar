import { useEscapeKey } from "@real1ty-obsidian-plugins-react";
import { memo } from "react";

import { cls, tid } from "../../constants";

interface StickyBannerProps {
	message: string;
	onCancel: () => void;
}

export const StickyBanner = memo(function StickyBanner({ message, onCancel }: StickyBannerProps) {
	useEscapeKey(onCancel);

	return (
		<div className={cls("prereq-selection-banner")} data-testid={tid("sticky-banner")}>
			<div className={cls("prereq-selection-banner-text")}>{message}</div>
			<button className={cls("prereq-selection-btn")} onClick={onCancel}>
				Cancel
			</button>
		</div>
	);
});
