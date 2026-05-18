import { memo } from "react";

import { cls, tid } from "../../../constants";

export interface SimpleEventGroupItem {
	key: string;
	title: string;
	count: number;
	onClick: () => void;
}

export const SimpleEventGroupList = memo(function SimpleEventGroupList({
	items,
	totalCount,
	countLabel,
	emptyMessage,
}: {
	items: SimpleEventGroupItem[];
	totalCount: number;
	countLabel: string;
	emptyMessage: string;
}) {
	const countText =
		items.length === totalCount ? `${totalCount} ${countLabel}` : `${items.length} of ${totalCount} ${countLabel}`;

	return (
		<>
			<p className={cls("generic-event-list-count")}>{countText}</p>
			<div className={cls("generic-event-list")}>
				{items.length === 0 ? (
					<p className={cls("generic-event-list-empty")}>{emptyMessage}</p>
				) : (
					items.map((item) => (
						<div
							key={item.key}
							className={cls("generic-event-list-item")}
							data-testid={tid("event-list-item", item.title)}
							data-event-title={item.title}
							onClick={item.onClick}
						>
							<div className={cls("generic-event-info")}>
								<div className={cls("generic-event-title")}>{item.title}</div>
								<div className={cls("generic-event-subtitle")}>
									{item.count} event{item.count === 1 ? "" : "s"}
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</>
	);
});
