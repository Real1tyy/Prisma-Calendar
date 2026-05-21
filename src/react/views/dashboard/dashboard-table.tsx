import { hexToRgb } from "@real1ty-obsidian-plugins";
import { memo, useCallback, useMemo, useState, type CSSProperties } from "react";

import type { ColumnDef, DashboardItem } from "./dashboard-types";

type SortDirection = "asc" | "desc";

export const ENTRIES_PER_PAGE = 20;

interface DashboardTableProps {
	items: DashboardItem[];
	columns: ColumnDef[];
	onItemClick?: (item: DashboardItem) => void;
	emptyMessage: string;
}

export const DashboardTable = memo(function DashboardTable({
	items,
	columns,
	onItemClick,
	emptyMessage,
}: DashboardTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [sortKey, setSortKey] = useState("count");
	const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
	const [currentPage, setCurrentPage] = useState(0);

	const filteredAndSorted = useMemo(() => {
		let result = items;

		if (searchQuery) {
			const q = searchQuery.toLowerCase().trim();
			result = result.filter((item) => item.title.toLowerCase().includes(q));
		}

		return [...result].sort((a, b) => {
			let valA: string | number;
			let valB: string | number;

			if (sortKey === "title") {
				valA = a.title;
				valB = b.title;
			} else if (sortKey === "count") {
				valA = a.count;
				valB = b.count;
			} else {
				valA = a.extraProps[sortKey] ?? "";
				valB = b.extraProps[sortKey] ?? "";
			}

			if (typeof valA === "number" && typeof valB === "number") {
				return sortDirection === "asc" ? valA - valB : valB - valA;
			}
			const cmp = String(valA).localeCompare(String(valB));
			return sortDirection === "asc" ? cmp : -cmp;
		});
	}, [items, searchQuery, sortKey, sortDirection]);

	const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / ENTRIES_PER_PAGE));
	const safePage = Math.min(currentPage, totalPages - 1);
	const pageItems = filteredAndSorted.slice(safePage * ENTRIES_PER_PAGE, (safePage + 1) * ENTRIES_PER_PAGE);

	const handleSort = useCallback(
		(key: string) => {
			if (sortKey === key) {
				setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
			} else {
				setSortKey(key);
				setSortDirection("desc");
			}
			setCurrentPage(0);
		},
		[sortKey]
	);

	if (items.length === 0) {
		return <div className="prisma-dashboard-section-empty">{emptyMessage}</div>;
	}

	return (
		<div className="prisma-dashboard-table-wrapper">
			<div className="prisma-dashboard-controls">
				<input
					type="text"
					placeholder="Filter..."
					className="prisma-dashboard-search-input"
					value={searchQuery}
					onChange={(e) => {
						setSearchQuery(e.target.value);
						setCurrentPage(0);
					}}
				/>
			</div>

			<div className="prisma-dashboard-table-scroll">
				<table className="prisma-dashboard-table">
					<thead>
						<tr>
							{columns.map((col) => (
								<th
									key={col.key}
									style={col.align ? { textAlign: col.align } : undefined}
									className={col.sortable !== false ? "prisma-dashboard-table-sortable" : undefined}
									onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
								>
									{col.label}
									{sortKey === col.key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{pageItems.length === 0 ? (
							<tr className="prisma-dashboard-table-empty-row">
								<td colSpan={columns.length}>No matching items</td>
							</tr>
						) : (
							pageItems.map((item) => (
								<DashboardTableRow key={item.key} item={item} columns={columns} onItemClick={onItemClick} />
							))
						)}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="prisma-dashboard-pagination">
					<button
						className="prisma-dashboard-pagination-btn"
						disabled={safePage === 0}
						onClick={() => setCurrentPage(safePage - 1)}
					>
						← Prev
					</button>
					<span className="prisma-dashboard-pagination-info">
						Page {safePage + 1} of {totalPages} ({filteredAndSorted.length} items)
					</span>
					<button
						className="prisma-dashboard-pagination-btn"
						disabled={safePage >= totalPages - 1}
						onClick={() => setCurrentPage(safePage + 1)}
					>
						Next →
					</button>
				</div>
			)}
		</div>
	);
});

interface DashboardTableRowProps {
	item: DashboardItem;
	columns: ColumnDef[];
	onItemClick?: ((item: DashboardItem) => void) | undefined;
}

const DashboardTableRow = memo(function DashboardTableRow({ item, columns, onItemClick }: DashboardTableRowProps) {
	const style = useMemo(() => {
		if (!item.color) return undefined;
		const rgb = hexToRgb(item.color);
		if (!rgb) return undefined;
		return { "--row-color-rgb": `${rgb.r}, ${rgb.g}, ${rgb.b}` } as CSSProperties;
	}, [item.color]);

	const className = [
		item.color ? "prisma-dashboard-table-row-colored" : "",
		onItemClick ? "prisma-dashboard-table-row-clickable" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<tr
			data-testid={`prisma-dashboard-table-row-${item.title}`}
			data-item-title={item.title}
			className={className || undefined}
			style={style}
			onClick={onItemClick ? () => onItemClick(item) : undefined}
		>
			{columns.map((col) => {
				let value: string;
				if (col.key === "title") {
					value = item.title;
				} else if (col.key === "count") {
					value = String(item.count);
				} else {
					value = String(item.extraProps[col.key] ?? "");
				}

				return (
					<td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
						{value}
					</td>
				);
			})}
		</tr>
	);
});
