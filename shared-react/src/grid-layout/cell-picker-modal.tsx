import { buildGridStyles, type CellOption } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { memo, useMemo } from "react";

import { useScopedStyles } from "../hooks/use-scoped-styles";
import { showReactModal } from "../show-react-modal";

export interface CellPickerContentProps {
	cellPalette: CellOption[];
	currentId: string | undefined;
	usedIds: Set<string>;
	onSelect: (optionId: string) => void;
}

interface PickerItemView {
	id: string;
	label: string;
	isCurrent: boolean;
	isUsed: boolean;
}

function toPickerItems(
	palette: readonly CellOption[],
	currentId: string | undefined,
	usedIds: Set<string>
): PickerItemView[] {
	return palette.map(({ id, label }) => {
		const isCurrent = id === currentId;
		return { id, label, isCurrent, isUsed: !isCurrent && usedIds.has(id) };
	});
}

export const CellPickerContent = memo(function CellPickerContent({
	cellPalette,
	currentId,
	usedIds,
	onSelect,
}: CellPickerContentProps) {
	const { cls } = useScopedStyles("grid-picker", buildGridStyles);
	const items = useMemo(() => toPickerItems(cellPalette, currentId, usedIds), [cellPalette, currentId, usedIds]);

	return (
		<div>
			<div className={cls("list")}>
				{items.map((item) => {
					const classNames = [cls("item")];
					if (item.isCurrent) classNames.push(cls("item-current"));
					if (item.isUsed) classNames.push(cls("item-used"));
					return (
						<button
							key={item.id}
							type="button"
							className={classNames.join(" ")}
							data-option-id={item.id}
							onClick={() => {
								if (!item.isCurrent) onSelect(item.id);
							}}
						>
							<span className={cls("item-label")}>
								{item.label}
								{item.isCurrent ? (
									<span className={cls("item-badge")}>Current</span>
								) : item.isUsed ? (
									<span className={cls("item-badge")}>In use</span>
								) : null}
							</span>
						</button>
					);
				})}
			</div>
		</div>
	);
});

export interface OpenCellPickerOptions {
	cssPrefix: string;
	row: number;
	col: number;
	cellPalette: CellOption[];
	currentId?: string | undefined;
	usedIds: Set<string>;
	title?: string;
	onSelect: (optionId: string) => void;
}

export function openCellPicker(app: App, options: OpenCellPickerOptions): void {
	const { cssPrefix, row, col, cellPalette, currentId, usedIds, title, onSelect } = options;
	showReactModal({
		app,
		cls: `${cssPrefix}grid-picker-modal`,
		title: title ?? `Swap cell (${row + 1}, ${col + 1})`,
		cssPrefix,
		testIdPrefix: cssPrefix,
		render: (close) => (
			<CellPickerContent
				cellPalette={cellPalette}
				currentId={currentId}
				usedIds={usedIds}
				onSelect={(id) => {
					onSelect(id);
					close();
				}}
			/>
		),
	});
}
