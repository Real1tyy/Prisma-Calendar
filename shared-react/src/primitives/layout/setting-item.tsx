import { memo, type ReactNode } from "react";

import { useCls } from "../../contexts/theme-context";
import { testIdAttr } from "../../utils/test-id";
import { OutboundLink } from "../atoms/outbound-link";

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
	/**
	 * When set, the heading shows a trailing "Guide ↗" link to the matching
	 * documentation section — used to surface help for the complex settings
	 * areas (license, integrations, …) right where users configure them.
	 * Pass an already-tracked URL (e.g. a plugin's `settingsDocUrl` helper).
	 */
	docHref?: string | undefined;
	/** Visible text for the doc link (default "Guide"). */
	docLabel?: string | undefined;
	/** Test id stamped on the doc link anchor. */
	docTestId?: string | undefined;
}

export const SettingHeading = memo(function SettingHeading({
	name,
	testId,
	docHref,
	docLabel,
	docTestId,
}: SettingHeadingProps) {
	return (
		<div className="setting-item setting-item-heading" {...testIdAttr(testId)}>
			<div className="setting-item-info">
				<div className="setting-item-name">{name}</div>
			</div>
			{docHref !== undefined && (
				<div className="setting-item-control">
					<OutboundLink href={docHref} testId={docTestId} ariaLabel={`Open documentation for ${name}`}>
						{`${docLabel ?? "Guide"} ↗`}
					</OutboundLink>
				</div>
			)}
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
