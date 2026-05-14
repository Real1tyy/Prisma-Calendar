import { cls, tid } from "@real1ty-obsidian-plugins";
import { useFocusOnMount, VirtualList, type VirtualListHandle } from "@real1ty-obsidian-plugins-react";
import type { ReactNode } from "react";
import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { removeZettelId } from "../../../utils/events/zettel-id";
import { type EventListAction, EventListItem, type EventListItemData } from "./event-list-item";

export interface EventListModalProps {
	items: readonly EventListItemData[];
	title: string;
	subtitle?: string;
	searchPlaceholder?: string;
	searchFields?: readonly (keyof EventListItemData)[];
	countSuffix?: string;
	actions: EventListAction[];
	emptyHint?: string;
	onItemClick?: (item: EventListItemData) => void;
	onContextMenu?: (item: EventListItemData, pos: { x: number; y: number }) => void;
	renderExtra?: (item: EventListItemData) => ReactNode;
	headerContent?: ReactNode;
	onClose?: () => void;
}

const ROW_ESTIMATE_SIZE = 52;

export const EventListModal = memo(function EventListModal({
	items,
	title,
	subtitle,
	searchPlaceholder = "Search events... (Ctrl/Cmd+F)",
	searchFields = ["title"],
	countSuffix,
	actions,
	emptyHint = "No events found.",
	onItemClick,
	onContextMenu,
	renderExtra,
	headerContent,
	onClose,
}: EventListModalProps) {
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const [activeIndex, setActiveIndex] = useState(-1);
	const searchRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<VirtualListHandle>(null);

	const filtered = useMemo(() => {
		if (!deferredQuery.trim()) return items;
		const q = deferredQuery.toLowerCase().trim();
		return items.filter((item) =>
			(searchFields as readonly string[]).some((field) => {
				const value = item[field as keyof EventListItemData];
				if (typeof value !== "string") return false;
				return removeZettelId(value).toLowerCase().includes(q);
			})
		);
	}, [items, deferredQuery, searchFields]);

	const countText = useMemo(() => {
		const isFiltered = filtered.length !== items.length;
		const total = items.length;
		const shown = filtered.length;
		const suffix = countSuffix ? ` ${countSuffix}` : "";
		const noun = total === 1 ? "event" : "events";
		return isFiltered ? `${shown} of ${total} ${noun}${suffix}` : `${total} ${noun}${suffix}`;
	}, [filtered.length, items.length, countSuffix]);

	useFocusOnMount(searchRef, { delayMs: 50 });

	useEffect(() => {
		setActiveIndex(-1);
	}, [filtered]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setActiveIndex((prev) => {
					const next = Math.min(prev + 1, filtered.length - 1);
					listRef.current?.scrollToIndex(next, { align: "auto" });
					return next;
				});
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setActiveIndex((prev) => {
					const next = Math.max(prev - 1, 0);
					listRef.current?.scrollToIndex(next, { align: "auto" });
					return next;
				});
			} else if (e.key === "Enter" && activeIndex >= 0 && activeIndex < filtered.length) {
				e.preventDefault();
				onItemClick?.(filtered[activeIndex]);
			} else if (e.key === "Escape") {
				if (searchRef.current && activeDocument.activeElement === searchRef.current) {
					if (query) {
						setQuery("");
						return;
					}
					searchRef.current.blur();
					return;
				}
				onClose?.();
			} else if ((e.ctrlKey || e.metaKey) && e.key === "f") {
				e.preventDefault();
				searchRef.current?.focus();
				searchRef.current?.select();
			}
		},
		[filtered, activeIndex, onItemClick, onClose, query]
	);

	const renderItem = useCallback(
		(item: EventListItemData, index: number) => (
			<div className={index === activeIndex ? cls("list-row-active") : undefined}>
				<EventListItem
					item={item}
					actions={actions}
					onClick={onItemClick}
					onContextMenu={onContextMenu}
					renderExtra={renderExtra}
				/>
			</div>
		),
		[actions, activeIndex, onItemClick, onContextMenu, renderExtra]
	);

	const getKey = useCallback((item: EventListItemData) => item.id ?? item.filePath, []);

	return (
		<div className={cls("generic-event-list-modal")} onKeyDown={handleKeyDown} data-testid={tid("list-modal")}>
			<h2>{title}</h2>
			{subtitle && <p className={cls("generic-event-list-subtitle")}>{subtitle}</p>}

			{headerContent}

			{items.length === 0 ? (
				<p data-testid={tid("list-empty")}>{emptyHint}</p>
			) : (
				<>
					<div className={cls("generic-event-list-search")}>
						<input
							ref={searchRef}
							type="text"
							placeholder={searchPlaceholder}
							className={cls("generic-event-search-input")}
							data-testid={tid("list-search")}
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>

					<p className={cls("generic-event-list-count")}>{countText}</p>

					{filtered.length === 0 ? (
						<p className={cls("generic-event-list-empty")} data-testid={tid("list-empty")}>
							No events match your search.
						</p>
					) : (
						<div className={cls("generic-event-list")} data-testid={tid("event-list-container")}>
							<VirtualList
								ref={listRef}
								items={filtered as EventListItemData[]}
								estimateSize={ROW_ESTIMATE_SIZE}
								renderItem={renderItem}
								getKey={getKey}
								className={cls("generic-event-list-virtual")}
								style={{ maxHeight: "60vh", minHeight: "12rem" }}
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
});
