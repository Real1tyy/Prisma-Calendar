import { ChipList, type ChipListProps } from "@real1ty-obsidian-plugins-react";
import { PrismaSettingItem } from "../../event-form/prisma-setting-item";
import type { ReactNode } from "react";
import { memo, useCallback, useMemo } from "react";

const CONTENT_CLASS = "prisma-category-display-content";
const ACTION_BUTTON_CLASS = "prisma-assign-categories-button";

interface ChipFieldSectionProps {
	name: string;
	fieldTestId: string;
	value: string[];
	onChange: (next: string[]) => void;
	emptyText: string;
	renderPrefix?: ChipListProps["renderPrefix"];
	getDisplayName?: ChipListProps["getDisplayName"];
	getTooltip?: ChipListProps["getTooltip"];
	onItemClick?: ChipListProps["onItemClick"];
	trailing: ReactNode;
}

const ChipFieldSection = memo(function ChipFieldSection({
	name,
	fieldTestId,
	value,
	onChange,
	emptyText,
	renderPrefix,
	getDisplayName,
	getTooltip,
	onItemClick,
	trailing,
}: ChipFieldSectionProps) {
	return (
		<PrismaSettingItem name={name} testId={fieldTestId}>
			<div className={CONTENT_CLASS}>
				<ChipList
					value={value}
					onChange={onChange}
					emptyText={emptyText}
					{...(renderPrefix ? { renderPrefix } : {})}
					{...(getDisplayName ? { getDisplayName } : {})}
					{...(getTooltip ? { getTooltip } : {})}
					{...(onItemClick ? { onItemClick } : {})}
				/>
				{trailing}
			</div>
		</PrismaSettingItem>
	);
});

function AssignButton({ label, testId, onClick }: { label: string; testId: string; onClick: () => void }) {
	return (
		<button type="button" className={ACTION_BUTTON_CLASS} onClick={onClick} data-testid={testId}>
			{label}
		</button>
	);
}

interface CategorySectionProps {
	categories: string[];
	onChange: (categories: string[]) => void;
	categoryColors: Map<string, string>;
	defaultColor: string;
	onAssign: () => void;
	onCategoryClick?: ((name: string) => void) | undefined;
}

export const CategorySection = memo(function CategorySection({
	categories,
	onChange,
	categoryColors,
	defaultColor,
	onAssign,
	onCategoryClick,
}: CategorySectionProps) {
	const renderPrefix = useCallback(
		(item: string) => {
			const color = categoryColors.get(item) || defaultColor;
			return (
				<span className="prisma-category-color-dot" style={{ "--category-color": color } as React.CSSProperties} />
			);
		},
		[categoryColors, defaultColor]
	);

	return (
		<ChipFieldSection
			name="Categories"
			fieldTestId="prisma-event-field-categories"
			value={categories}
			onChange={onChange}
			emptyText="No categories"
			renderPrefix={renderPrefix}
			{...(onCategoryClick ? { onItemClick: onCategoryClick } : {})}
			trailing={
				<AssignButton label="Assign categories" testId="prisma-event-btn-assign-categories" onClick={onAssign} />
			}
		/>
	);
});

interface PrerequisiteSectionProps {
	prerequisites: string[];
	onChange: (prerequisites: string[]) => void;
	getDisplayName: (link: string) => string;
	onAssign: () => void;
}

const identityTooltip = (link: string) => link;

export const PrerequisiteSection = memo(function PrerequisiteSection({
	prerequisites,
	onChange,
	getDisplayName,
	onAssign,
}: PrerequisiteSectionProps) {
	return (
		<ChipFieldSection
			name="Prerequisites"
			fieldTestId="prisma-event-field-prerequisites"
			value={prerequisites}
			onChange={onChange}
			emptyText="No prerequisites"
			getDisplayName={getDisplayName}
			getTooltip={identityTooltip}
			trailing={
				<AssignButton label="Assign prerequisites" testId="prisma-event-btn-assign-prerequisites" onClick={onAssign} />
			}
		/>
	);
});

interface ParticipantSectionProps {
	participants: string[];
	onChange: (participants: string[]) => void;
	getDisplayName: (item: string) => string;
}

export const ParticipantSection = memo(function ParticipantSection({
	participants,
	onChange,
	getDisplayName,
}: ParticipantSectionProps) {
	const getTooltip = useMemo(() => {
		const isLink = (item: string) => /^\[\[.+\]\]$/.test(item);
		return (item: string) => (isLink(item) ? item : "");
	}, []);

	const handleAdd = useCallback(
		(value: string) => {
			const trimmed = value.trim();
			if (trimmed) onChange([...participants, trimmed]);
		},
		[participants, onChange]
	);

	return (
		<ChipFieldSection
			name="Participants"
			fieldTestId="prisma-event-field-participants"
			value={participants}
			onChange={onChange}
			emptyText="No participants"
			getDisplayName={getDisplayName}
			getTooltip={getTooltip}
			trailing={<ParticipantInput onAdd={handleAdd} />}
		/>
	);
});

function ParticipantInput({ onAdd }: { onAdd: (value: string) => void }) {
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			e.stopPropagation();
			const input = e.currentTarget;
			onAdd(input.value);
			input.value = "";
		},
		[onAdd]
	);

	const handleClick = useCallback(() => {
		const input = document.querySelector<HTMLInputElement>("[data-testid='prisma-event-control-participants']");
		if (!input) return;
		onAdd(input.value);
		input.value = "";
	}, [onAdd]);

	return (
		<div className="prisma-participant-input-row">
			<input
				type="text"
				className="prisma-participant-input"
				placeholder="Name or [[Link]]"
				onKeyDown={handleKeyDown}
				data-testid="prisma-event-control-participants"
			/>
			<button
				type="button"
				className={ACTION_BUTTON_CLASS}
				onClick={handleClick}
				data-testid="prisma-event-btn-add-participant"
			>
				Add
			</button>
		</div>
	);
}
