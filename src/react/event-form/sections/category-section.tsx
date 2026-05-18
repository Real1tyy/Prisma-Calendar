import { ChipList, type ChipCollection, type ChipDisplay, type ChipInteraction } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

import { PrismaSettingItem } from "../prisma-setting-item";

const CONTENT_CLASS = "prisma-category-display-content";
const ACTION_BUTTON_CLASS = "prisma-assign-categories-button";

interface ChipFieldSectionProps extends ChipCollection, ChipDisplay, ChipInteraction {
	name: string;
	fieldTestId: string;
	emptyText: string;
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
					renderPrefix={renderPrefix}
					getDisplayName={getDisplayName}
					getTooltip={getTooltip}
					onItemClick={onItemClick}
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

interface CategorySectionProps extends ChipCollection {
	categoryColors: Map<string, string>;
	defaultColor: string;
	onAssign: () => void;
	onCategoryClick?: ((name: string) => void) | undefined;
}

export const CategorySection = memo(function CategorySection({
	value,
	onChange,
	categoryColors,
	defaultColor,
	onAssign,
	onCategoryClick,
}: CategorySectionProps) {
	const renderPrefix = useCallback(
		(item: string) => {
			const color = categoryColors.get(item) || defaultColor;
			return <span className="prisma-category-color-dot" style={{ "--category-color": color } as CSSProperties} />;
		},
		[categoryColors, defaultColor]
	);

	return (
		<ChipFieldSection
			name="Categories"
			fieldTestId="prisma-event-field-categories"
			value={value}
			onChange={onChange}
			emptyText="No categories"
			renderPrefix={renderPrefix}
			onItemClick={onCategoryClick}
			trailing={
				<AssignButton label="Assign categories" testId="prisma-event-btn-assign-categories" onClick={onAssign} />
			}
		/>
	);
});

interface PrerequisiteSectionProps extends ChipCollection, Required<Pick<ChipDisplay, "getDisplayName">> {
	onAssign: () => void;
}

const identityTooltip = (link: string) => link;

export const PrerequisiteSection = memo(function PrerequisiteSection({
	value,
	onChange,
	getDisplayName,
	onAssign,
}: PrerequisiteSectionProps) {
	return (
		<ChipFieldSection
			name="Prerequisites"
			fieldTestId="prisma-event-field-prerequisites"
			value={value}
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

interface ParticipantSectionProps extends ChipCollection, Required<Pick<ChipDisplay, "getDisplayName">> {}

export const ParticipantSection = memo(function ParticipantSection({
	value,
	onChange,
	getDisplayName,
}: ParticipantSectionProps) {
	const getTooltip = useMemo(() => {
		const isLink = (item: string) => /^\[\[.+\]\]$/.test(item);
		return (item: string) => (isLink(item) ? item : "");
	}, []);

	const handleAdd = useCallback(
		(participant: string) => {
			onChange([...value, participant]);
		},
		[value, onChange]
	);

	return (
		<ChipFieldSection
			name="Participants"
			fieldTestId="prisma-event-field-participants"
			value={value}
			onChange={onChange}
			emptyText="No participants"
			getDisplayName={getDisplayName}
			getTooltip={getTooltip}
			trailing={<ParticipantInput onAdd={handleAdd} />}
		/>
	);
});

function ParticipantInput({ onAdd }: { onAdd: (value: string) => void }) {
	const [draft, setDraft] = useState("");

	const submit = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed) onAdd(trimmed);
		setDraft("");
	}, [draft, onAdd]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key !== "Enter") return;
			e.preventDefault();
			e.stopPropagation();
			submit();
		},
		[submit]
	);

	return (
		<div className="prisma-participant-input-row">
			<input
				type="text"
				className="prisma-participant-input"
				placeholder="Name or [[Link]]"
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={handleKeyDown}
				data-testid="prisma-event-control-participants"
			/>
			<button
				type="button"
				className={ACTION_BUTTON_CLASS}
				onClick={submit}
				data-testid="prisma-event-btn-add-participant"
			>
				Add
			</button>
		</div>
	);
}
