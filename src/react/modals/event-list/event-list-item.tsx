import { cls, tid } from "@real1ty-obsidian-plugins";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { memo, useCallback } from "react";

import type { EventListItemData } from "../../../utils/events/event-list-mapping";

export type { EventListItemData };

export interface EventListAction {
	label: string;
	isPrimary?: boolean;
	handler: (item: EventListItemData) => void;
}

export interface EventListItemProps {
	item: EventListItemData;
	actions: EventListAction[];
	onClick?: ((item: EventListItemData) => void) | undefined;
	onContextMenu?: ((item: EventListItemData, pos: { x: number; y: number }) => void) | undefined;
	renderExtra?: ((item: EventListItemData) => ReactNode) | undefined;
}

export const EventListItem = memo(function EventListItem({
	item,
	actions,
	onClick,
	onContextMenu,
	renderExtra,
}: EventListItemProps) {
	const handleClick = useCallback(() => {
		onClick?.(item);
	}, [onClick, item]);

	const handleContextMenu = useCallback(
		(e: MouseEvent) => {
			if (!onContextMenu) return;
			e.preventDefault();
			onContextMenu(item, { x: e.clientX, y: e.clientY });
		},
		[onContextMenu, item]
	);

	const style: CSSProperties | undefined = item.categoryColor
		? ({ "--category-color": item.categoryColor } as CSSProperties)
		: undefined;

	return (
		<div
			className={cls("generic-event-list-item", item.categoryColor ? "recurring-event-categorized" : "")}
			style={style}
			data-testid={tid("list-row", item.id ?? item.filePath)}
			data-event-title={item.title}
			onClick={handleClick}
			onContextMenu={handleContextMenu}
		>
			<div className={cls("generic-event-info")}>
				<div className={cls("generic-event-title")}>{item.title}</div>
				{item.subtitle && <div className={cls("generic-event-subtitle")}>{item.subtitle}</div>}
			</div>

			{renderExtra?.(item)}

			{actions.length > 0 && (
				<div className={cls("generic-event-actions")}>
					{actions.map((action) => (
						<ActionButton key={action.label} action={action} item={item} />
					))}
				</div>
			)}
		</div>
	);
});

const ActionButton = memo(function ActionButton({
	action,
	item,
}: {
	action: EventListAction;
	item: EventListItemData;
}) {
	const handleClick = useCallback(
		(e: MouseEvent) => {
			e.stopPropagation();
			action.handler(item);
		},
		[action, item]
	);

	return (
		<button className={action.isPrimary ? "mod-cta" : undefined} onClick={handleClick}>
			{action.label}
		</button>
	);
});
