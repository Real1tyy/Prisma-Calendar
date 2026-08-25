import { memo, useCallback, useState, type DragEvent } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useInjectedStyles } from "../../hooks/styles/use-styles";
import { ObsidianIcon } from "../../primitives/atoms/obsidian-icon";
import { TextInput } from "../../primitives/controls";
import { cx } from "../../utils/cx";
import { buildPropertyOrderTableStyles } from "./property-order-table.styles";

export interface PropertyOrderEntry {
	/** Stable registry key (e.g. a settings key like "startProp"). */
	key: string;
	label: string;
	description?: string | undefined;
	/** Current frontmatter property name; empty when the property is unset. */
	name: string;
	placeholder?: string | undefined;
}

export interface PropertyOrderTableProps {
	/** Entries in their current resolved order. */
	entries: readonly PropertyOrderEntry[];
	/** Fired with the full key list after a drag-drop or arrow move. */
	onReorder: (orderedKeys: string[]) => void;
	/** Fired when a property's name input changes. */
	onRename: (key: string, name: string) => void;
}

/**
 * Reorderable table of a plugin's frontmatter properties — the settings surface
 * of the deterministic property-order convention: the row order users arrange
 * here is the on-disk key order every write enforces. Rows reorder by drag-and-
 * drop or the arrow buttons; the name input keeps the existing rename behavior.
 * See [[decision-deterministic-property-ordering]].
 */
export const PropertyOrderTable = memo(function PropertyOrderTable({
	entries,
	onReorder,
	onRename,
}: PropertyOrderTableProps) {
	const { cls, tid, cssPrefix } = useScoped("property-order");
	useInjectedStyles(`${cssPrefix}property-order-table-styles`, buildPropertyOrderTableStyles(cssPrefix));
	const [draggedKey, setDraggedKey] = useState<string | null>(null);
	const [dragOverKey, setDragOverKey] = useState<string | null>(null);

	const move = useCallback(
		(key: string, direction: -1 | 1) => {
			const keys = entries.map((e) => e.key);
			const idx = keys.indexOf(key);
			const target = idx + direction;
			if (idx < 0 || target < 0 || target >= keys.length) return;
			[keys[idx], keys[target]] = [keys[target], keys[idx]];
			onReorder(keys);
		},
		[entries, onReorder]
	);

	const drop = useCallback(
		(targetKey: string) => {
			setDragOverKey(null);
			if (!draggedKey || draggedKey === targetKey) return;
			const keys = entries.map((e) => e.key);
			const fromIdx = keys.indexOf(draggedKey);
			const toIdx = keys.indexOf(targetKey);
			if (fromIdx < 0 || toIdx < 0) return;
			keys.splice(fromIdx, 1);
			keys.splice(toIdx, 0, draggedKey);
			onReorder(keys);
		},
		[draggedKey, entries, onReorder]
	);

	return (
		<div className={cls("list")} data-testid={tid("list")}>
			{entries.map((entry, index) => (
				<div
					key={entry.key}
					className={cx(
						cls("row"),
						draggedKey === entry.key && cls("row-dragging"),
						dragOverKey === entry.key && cls("row-dragover")
					)}
					data-testid={tid("row", entry.key)}
					draggable
					onDragStart={(e: DragEvent<HTMLDivElement>) => {
						setDraggedKey(entry.key);
						e.dataTransfer.effectAllowed = "move";
					}}
					onDragEnd={() => {
						setDraggedKey(null);
						setDragOverKey(null);
					}}
					onDragOver={(e: DragEvent<HTMLDivElement>) => {
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
						setDragOverKey(entry.key);
					}}
					onDragLeave={() => setDragOverKey((prev) => (prev === entry.key ? null : prev))}
					onDrop={(e: DragEvent<HTMLDivElement>) => {
						e.preventDefault();
						drop(entry.key);
					}}
				>
					<span className={cls("grip")}>
						<ObsidianIcon icon="grip-vertical" />
					</span>
					<div className={cls("arrows")}>
						<button
							type="button"
							className={cls("move-btn")}
							onClick={() => move(entry.key, -1)}
							disabled={index === 0}
							data-testid={tid("up", entry.key)}
							aria-label={`Move ${entry.label} up`}
						>
							<ObsidianIcon icon="chevron-up" />
						</button>
						<button
							type="button"
							className={cls("move-btn")}
							onClick={() => move(entry.key, 1)}
							disabled={index === entries.length - 1}
							data-testid={tid("down", entry.key)}
							aria-label={`Move ${entry.label} down`}
						>
							<ObsidianIcon icon="chevron-down" />
						</button>
					</div>
					<div className={cls("info")}>
						<span className={cls("label")}>{entry.label}</span>
						{entry.description && (
							<span className={cls("description")} title={entry.description}>
								{entry.description}
							</span>
						)}
					</div>
					<span className={cls("name-input")} aria-label={`${entry.label} name`}>
						<TextInput
							value={entry.name}
							placeholder={entry.placeholder ?? ""}
							onChange={(name) => onRename(entry.key, name)}
							testId={tid("name", entry.key)}
						/>
					</span>
				</div>
			))}
		</div>
	);
});
