import { memo, useCallback, useMemo, useState } from "react";

import type { AggregationMode, WeeklyStatEntry } from "../../../utils/stats";
import { formatPercentage, pickDurationFormatter } from "../../../utils/stats";

const ENTRIES_PER_PAGE = 20;

interface StatsTableProps {
	entries: WeeklyStatEntry[];
	totalDuration: number;
	showDecimalHours: boolean;
	aggregationMode?: AggregationMode;
}

export const StatsTable = memo(function StatsTable({
	entries,
	totalDuration,
	showDecimalHours,
	aggregationMode = "name",
}: StatsTableProps) {
	const [currentPage, setCurrentPage] = useState(0);
	const totalPages = Math.max(1, Math.ceil(entries.length / ENTRIES_PER_PAGE));

	const pageEntries = useMemo(() => {
		const startIdx = currentPage * ENTRIES_PER_PAGE;
		return entries.slice(startIdx, startIdx + ENTRIES_PER_PAGE);
	}, [entries, currentPage]);

	const handlePageInput = useCallback(
		(value: string) => {
			const parsed = parseInt(value, 10);
			if (isNaN(parsed) || parsed < 1 || parsed > totalPages) return;
			setCurrentPage(parsed - 1);
		},
		[totalPages]
	);

	const formatDur = pickDurationFormatter({ showDecimalHours });

	return (
		<div className="prisma-stats-table-container">
			<div className="prisma-stats-table-divider" />
			<table className="prisma-stats-table" data-testid="prisma-stats-table">
				<thead>
					<tr>
						<th>{aggregationMode === "category" ? "Category" : "Event name"}</th>
						<th>Count</th>
						<th>Duration</th>
						<th>Percentage</th>
					</tr>
				</thead>
				<tbody>
					{pageEntries.map((entry) => (
						<tr key={entry.name} data-testid={`prisma-stats-entry-${entry.name}`} data-entry-name={entry.name}>
							<td className={entry.isRecurring ? "prisma-stats-recurring" : ""}>{entry.name}</td>
							<td data-testid={`prisma-stats-entry-count-${entry.name}`}>{entry.count}</td>
							<td data-testid={`prisma-stats-entry-duration-${entry.name}`}>{formatDur(entry.duration)}</td>
							<td>{formatPercentage(entry.duration, totalDuration)}</td>
						</tr>
					))}
				</tbody>
			</table>

			{totalPages > 1 && (
				<Pagination
					currentPage={currentPage}
					totalPages={totalPages}
					totalEntries={entries.length}
					onPageChange={setCurrentPage}
					onPageInput={handlePageInput}
				/>
			)}
		</div>
	);
});

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	totalEntries: number;
	onPageChange: (page: number) => void;
	onPageInput: (value: string) => void;
}

const Pagination = memo(function Pagination({
	currentPage,
	totalPages,
	totalEntries,
	onPageChange,
	onPageInput,
}: PaginationProps) {
	const [inputValue, setInputValue] = useState(String(currentPage + 1));

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") onPageInput(inputValue);
		},
		[onPageInput, inputValue]
	);

	const handleBlur = useCallback(() => {
		onPageInput(inputValue);
	}, [onPageInput, inputValue]);

	return (
		<div className="prisma-stats-pagination">
			<button className="prisma-stats-pagination-button" disabled={currentPage === 0} onClick={() => onPageChange(0)}>
				First
			</button>
			<button
				className="prisma-stats-pagination-button"
				disabled={currentPage === 0}
				onClick={() => onPageChange(currentPage - 1)}
			>
				Previous
			</button>

			<div className="prisma-stats-pagination-input-container">
				<span className="prisma-stats-pagination-label">Page </span>
				<input
					type="number"
					className="prisma-stats-pagination-input"
					min={1}
					max={totalPages}
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={handleBlur}
				/>
				<span className="prisma-stats-pagination-label"> of {totalPages}</span>
			</div>

			<div className="prisma-stats-pagination-info">({totalEntries} entries)</div>

			<button
				className="prisma-stats-pagination-button"
				disabled={currentPage >= totalPages - 1}
				onClick={() => onPageChange(currentPage + 1)}
			>
				Next
			</button>
			<button
				className="prisma-stats-pagination-button"
				disabled={currentPage >= totalPages - 1}
				onClick={() => onPageChange(totalPages - 1)}
			>
				Last
			</button>
		</div>
	);
});
