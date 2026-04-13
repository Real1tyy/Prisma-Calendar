import type { ReactNode } from "react";
import { memo } from "react";

interface SettingItemProps {
	name: string;
	description?: string | undefined;
	children: ReactNode;
}

export const SettingItem = memo(function SettingItem({ name, description, children }: SettingItemProps) {
	return (
		<div className="setting-item">
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
				{description && <div className="setting-item-description">{description}</div>}
			</div>
			<div className="setting-item-control">{children}</div>
		</div>
	);
});

interface SettingHeadingProps {
	name: string;
}

export const SettingHeading = memo(function SettingHeading({ name }: SettingHeadingProps) {
	return (
		<div className="setting-item setting-item-heading">
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
			</div>
		</div>
	);
});
