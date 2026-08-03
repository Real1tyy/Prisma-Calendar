import { memo, type ReactNode } from "react";

interface PrismaSettingItemProps {
	name: string;
	description?: ReactNode;
	children: ReactNode;
	testId?: string | undefined;
	/**
	 * Set on rows whose control is a checkbox or toggle. The mobile stylesheet
	 * widens the label on those rows so the control sits flush right instead of
	 * leaving a mid-row gap.
	 *
	 * Declared explicitly rather than detected from `children` with `:has()`:
	 * the control arrives as an opaque node, and `:has()` costs a parent
	 * invalidation pass on every match — the same reason `_base.scss` branches on
	 * `data-tab-id`.
	 */
	booleanControl?: boolean;
}

/**
 * Mirrors the DOM emitted by `BaseEventModal.createDiv(cls("setting-item"))` —
 * a flat `.prisma-setting-item` row with `.prisma-setting-item-name` label and
 * the control as a direct sibling. The CSS in `styles/_modals.scss` targets
 * these prefixed classes; the unprefixed `<SettingItem>` from shared-react
 * falls back to Obsidian's default layout and breaks the modal's spacing.
 */
export const PrismaSettingItem = memo(function PrismaSettingItem({
	name,
	description,
	children,
	testId,
	booleanControl,
}: PrismaSettingItemProps) {
	return (
		<div
			className="prisma-setting-item"
			{...(booleanControl ? { "data-control": "boolean" } : {})}
			{...(testId ? { "data-testid": testId } : {})}
		>
			<div className="prisma-setting-item-name">{name}</div>
			{description !== undefined && description !== null && description !== false && (
				<div className="prisma-setting-item-description">{description}</div>
			)}
			{children}
		</div>
	);
});

interface PrismaSettingHeadingProps {
	name: string;
	testId?: string | undefined;
}

export const PrismaSettingHeading = memo(function PrismaSettingHeading({ name, testId }: PrismaSettingHeadingProps) {
	return (
		<div className="prisma-setting-item prisma-setting-item-heading" {...(testId ? { "data-testid": testId } : {})}>
			<div className="prisma-setting-item-name">{name}</div>
		</div>
	);
});
