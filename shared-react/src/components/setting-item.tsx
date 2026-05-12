import type { ReactNode } from "react";
import { memo } from "react";

import { useCls } from "../contexts/theme-context";
import { testIdAttr } from "../utils/test-id";

interface SettingItemProps {
	name: string;
	description?: ReactNode;
	children: ReactNode;
	/** When set, stamps `data-testid` on the outer `.setting-item` for E2E. */
	testId?: string | undefined;
}

export const SettingItem = memo(function SettingItem({ name, description, children, testId }: SettingItemProps) {
	return (
		<div className="setting-item" {...testIdAttr(testId)}>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				{description !== undefined && description !== null && description !== false && (
					<div className="setting-item-description">{description}</div>
				)}
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
});

interface SettingHeadingProps {
	name: string;
	testId?: string | undefined;
}

export const SettingHeading = memo(function SettingHeading({ name, testId }: SettingHeadingProps) {
	return (
		<div className="setting-item setting-item-heading" {...testIdAttr(testId)}>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
			</div>
		</div>
	);
});

interface SettingCardProps {
	children: ReactNode;
	testId?: string | undefined;
}

export const SettingCard = memo(function SettingCard({ children, testId }: SettingCardProps) {
	const cls = useCls();
	return (
		<div className={cls("settings-card")} {...testIdAttr(testId)}>
			{children}
		</div>
	);
});
